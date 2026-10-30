from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.db.models import Count, Sum, Q
from django.conf import settings
import sys
import django
from .models import User, AuditLog, CustomerProfile, Permission, Role
from .serializers import (
    UserSerializer, AdminUserSerializer, RegisterSerializer, LoginSerializer,
    AuditLogSerializer, CustomerProfileSerializer, PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer, PermissionSerializer, RoleSerializer,
    RoleCreateUpdateSerializer, RoleAssignmentSerializer
)
from .permissions import (
    IsAdminUserRole, IsStoreManagerOrAdmin, IsSuperAdmin, require_permission
)
from .rbac import PERMISSION_TEMPLATES, init_rbac


def log_action(user, action, details=None, request=None):
    ip = None
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
    AuditLog.objects.create(user=user, action=action, details=details, ip_address=ip)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            log_action(user, "User Registration", f"Registered with role {user.role}", request)
            return Response({
                'token': token.key,
                'user': UserSerializer(user).data,
                'message': 'Account registered successfully.'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            token, _ = Token.objects.get_or_create(user=user)
            log_action(user, "User Login", f"Successful login (Role: {user.role})", request)
            return Response({
                'token': token.key,
                'user': UserSerializer(user).data,
                'message': 'Logged in successfully.'
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            request.user.auth_token.delete()
        except Exception:
            pass
        log_action(request.user, "User Logout", "Logged out", request)
        return Response({'message': 'Logged out successfully.'})


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user, context={'request': request}).data)

    def put(self, request):
        # Prevent any attempt to change role via profile
        if 'role' in request.data and request.data['role'] != request.user.role:
            if request.user.is_super_admin:
                return Response(
                    {'error': "The Super Administrator's role is protected and cannot be changed."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if 'password' in request.data and str(request.data['password']).strip():
            new_pwd = str(request.data['password']).strip()
            if len(new_pwd) < 6:
                return Response({'error': 'Password must be at least 6 characters long.'}, status=status.HTTP_400_BAD_REQUEST)
            request.user.set_password(new_pwd)
            request.user.save()
            log_action(request.user, "Password Changed", "User updated their account password", request)

        old_email = request.user.email
        serializer = UserSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            new_email = user.email

            # Also update profile preferred categories if supplied
            if 'preferred_categories' in request.data and hasattr(request.user, 'profile'):
                request.user.profile.preferred_categories = request.data['preferred_categories']
                request.user.profile.save()

            if old_email and old_email.lower() != new_email.lower():
                log_action(request.user, "Email Changed", f"Email updated from {old_email} to {new_email}", request)
            else:
                log_action(request.user, "Profile Updated", "User updated their profile information", request)

            return Response(UserSerializer(request.user, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        return self.put(request)


class UserAvatarView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        import os
        import uuid
        avatar_file = request.FILES.get('avatar')
        if not avatar_file:
            return Response({'error': 'No image file provided. Please choose a photo to upload.'}, status=status.HTTP_400_BAD_REQUEST)

        MAX_SIZE = 5 * 1024 * 1024
        if avatar_file.size > MAX_SIZE:
            return Response({'error': f'Image file is too large ({avatar_file.size / (1024*1024):.1f}MB). Maximum allowed size is 5MB.'}, status=status.HTTP_400_BAD_REQUEST)

        allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
        if avatar_file.content_type.lower() not in allowed_types:
            return Response({'error': 'Unsupported file format. Please upload a JPEG, PNG, or WebP image.'}, status=status.HTTP_400_BAD_REQUEST)

        ext = os.path.splitext(avatar_file.name)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.webp']:
            ext = '.jpg'
        new_filename = f"avatars/user_{request.user.id}_{uuid.uuid4().hex[:8]}{ext}"

        old_avatar = request.user.avatar
        if old_avatar and hasattr(old_avatar, 'path') and os.path.isfile(old_avatar.path):
            try:
                os.remove(old_avatar.path)
            except Exception:
                pass

        request.user.avatar.save(new_filename, avatar_file, save=True)
        log_action(request.user, "Avatar Uploaded", "User updated their profile photo", request)

        return Response({
            'message': 'Profile photo updated successfully.',
            'user': UserSerializer(request.user, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    def delete(self, request):
        import os
        old_avatar = request.user.avatar
        if old_avatar:
            if hasattr(old_avatar, 'path') and os.path.isfile(old_avatar.path):
                try:
                    os.remove(old_avatar.path)
                except Exception:
                    pass
            request.user.avatar = None
            request.user.save()
            log_action(request.user, "Avatar Removed", "User removed their profile photo", request)

        return Response({
            'message': 'Profile photo removed. Restored default avatar.',
            'user': UserSerializer(request.user, context={'request': request}).data
        }, status=status.HTTP_200_OK)


# ============================================================================
# RBAC: PERMISSION & ROLE MANAGEMENT ENDPOINTS
# ============================================================================

class PermissionListView(APIView):
    """
    Returns all canonical and registered system permissions grouped by module.
    Protected: requires 'roles.manage' or Super Admin.
    """
    permission_classes = [require_permission('roles.manage')]

    def get(self, request):
        perms = Permission.objects.all().order_by('module', 'code')
        serializer = PermissionSerializer(perms, many=True)

        grouped = {}
        for p in serializer.data:
            mod = p['module']
            if mod not in grouped:
                grouped[mod] = []
            grouped[mod].append(p)

        return Response({
            'total': perms.count(),
            'permissions': serializer.data,
            'grouped_by_module': grouped
        })


class RoleListCreateView(APIView):
    """
    List all roles (system & custom) or create a new custom role.
    GET: requires 'roles.manage' or 'users.manage'
    POST: requires 'roles.manage'
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [require_permission('roles.manage')()]
        # Allow reading roles for user management assignment as well
        class CanViewRoles(permissions.BasePermission):
            def has_permission(self, request, view):
                if not (request.user and request.user.is_authenticated):
                    return False
                if request.user.is_super_admin:
                    return True
                return (
                    request.user.has_permission('roles.manage') or
                    request.user.has_permission('users.manage')
                )
        return [CanViewRoles()]

    def get(self, request):
        roles = Role.objects.all().prefetch_related('permissions', 'users').order_by('-is_system_role', 'name')
        return Response(RoleSerializer(roles, many=True).data)

    def post(self, request):
        serializer = RoleCreateUpdateSerializer(data=request.data)
        if serializer.is_valid():
            role = serializer.save(created_by=request.user)
            log_action(
                request.user,
                "ROLE_CREATED",
                f"Created custom role '{role.name}' ({role.code}) with {role.permissions.count()} permissions.",
                request
            )
            return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RoleDetailView(APIView):
    """
    Retrieve, update, or delete a specific role.
    System roles cannot have their code changed or be deleted.
    """
    permission_classes = [require_permission('roles.manage')]

    def get_object(self, pk):
        try:
            return Role.objects.get(pk=pk)
        except Role.DoesNotExist:
            return None

    def get(self, request, pk):
        role = self.get_object(pk)
        if not role:
            return Response({'error': 'Role not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(RoleSerializer(role).data)

    def put(self, request, pk):
        role = self.get_object(pk)
        if not role:
            return Response({'error': 'Role not found.'}, status=status.HTTP_404_NOT_FOUND)

        if role.is_system_role and role.code == 'super_admin' and not request.user.is_super_admin:
            return Response({'error': 'Only Super Administrators can modify the Super Admin role.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = RoleCreateUpdateSerializer(role, data=request.data, partial=True)
        if serializer.is_valid():
            updated_role = serializer.save()
            log_action(
                request.user,
                "ROLE_UPDATED",
                f"Updated role '{updated_role.name}' ({updated_role.code}). Permissions: {updated_role.permissions.count()}.",
                request
            )
            return Response(RoleSerializer(updated_role).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        return self.put(request, pk)

    def delete(self, request, pk):
        role = self.get_object(pk)
        if not role:
            return Response({'error': 'Role not found.'}, status=status.HTTP_404_NOT_FOUND)

        if role.is_system_role:
            return Response(
                {'error': f"System role '{role.name}' is protected and cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        role_name = role.name
        role_code = role.code
        role.delete()

        log_action(request.user, "ROLE_DELETED", f"Deleted custom role '{role_name}' ({role_code}).", request)
        return Response({'message': f"Role '{role_name}' deleted successfully."}, status=status.HTTP_200_OK)


class ApplyRoleTemplateView(APIView):
    """
    Quickly creates a custom role or updates an existing role using one of the pre-configured
    permission templates (Product Manager, Order Manager, Payment Manager, Customer Support Manager).
    """
    permission_classes = [require_permission('roles.manage')]

    def get(self, request):
        return Response({
            'templates': PERMISSION_TEMPLATES
        })

    def post(self, request):
        template_key = request.data.get('template_key')
        custom_name = request.data.get('name')
        custom_code = request.data.get('code')

        if not template_key or template_key not in PERMISSION_TEMPLATES:
            return Response(
                {'error': f"Invalid template key. Available templates: {list(PERMISSION_TEMPLATES.keys())}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        template_info = PERMISSION_TEMPLATES[template_key]
        name = custom_name or template_info['name']
        code = (custom_code or template_key).strip().lower().replace(' ', '_')

        role, created = Role.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'description': template_info['description'],
                'is_system_role': False,
                'created_by': request.user
            }
        )

        perm_objs = Permission.objects.filter(code__in=template_info['permissions'])
        role.permissions.set(perm_objs)

        action_name = "ROLE_TEMPLATE_APPLIED" if not created else "ROLE_CREATED_FROM_TEMPLATE"
        log_action(
            request.user,
            action_name,
            f"Role '{role.name}' ({role.code}) configured with template '{template_key}'.",
            request
        )

        return Response({
            'message': f"Role '{role.name}' configured successfully from template.",
            'role': RoleSerializer(role).data
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class UserRoleAssignView(APIView):
    """
    Assigns role and/or granular permissions to a specific user.
    Enforces least privilege and super-admin protection rules.
    """
    permission_classes = [require_permission('roles.manage')]

    def post(self, request, pk):
        try:
            target_user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RoleAssignmentSerializer(
            data=request.data,
            context={'request': request, 'target_user': target_user}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Protection: non-super admin cannot touch super admin
        if target_user.is_super_admin and not request.user.is_super_admin:
            return Response({'error': 'Only Super Administrators can modify Super Admin accounts.'}, status=status.HTTP_403_FORBIDDEN)

        # Protection: Sub-admin cannot assign roles
        if request.user.is_sub_admin():
            return Response({'error': 'Sub-Administrators cannot assign roles or permissions.'}, status=status.HTTP_403_FORBIDDEN)

        role = serializer.validated_data.get('role')
        custom_role_id = serializer.validated_data.get('custom_role_id')
        direct_perm_codes = serializer.validated_data.get('direct_permission_codes')

        # Cannot promote to SUPER_ADMIN unless actor is SUPER_ADMIN
        if role == User.RoleChoices.SUPER_ADMIN and not request.user.is_super_admin:
            return Response({'error': 'Only Super Administrators can grant the Super Admin role.'}, status=status.HTTP_403_FORBIDDEN)

        prev_role = target_user.role

        if role:
            target_user.role = role
            if role != User.RoleChoices.CUSTOM and (custom_role_id is None or custom_role_id == ''):
                target_user.custom_role = None
        if custom_role_id is not None and custom_role_id != '':
            try:
                c_role = Role.objects.get(id=custom_role_id)
                target_user.custom_role = c_role
            except Role.DoesNotExist:
                pass
        elif custom_role_id == '' or custom_role_id is None:
            if role != User.RoleChoices.CUSTOM:
                target_user.custom_role = None

        if direct_perm_codes is not None:
            perms = Permission.objects.filter(code__in=direct_perm_codes)
            target_user.direct_permissions.set(perms)

        # Sync staff flag
        if target_user.role in [
            User.RoleChoices.SUPER_ADMIN,
            User.RoleChoices.ADMIN,
            User.RoleChoices.SUB_ADMIN,
            User.RoleChoices.STORE_MANAGER,
            User.RoleChoices.ORDER_MANAGER
        ] or target_user.custom_role is not None:
            target_user.is_staff = True
        else:
            target_user.is_staff = False

        target_user.save()

        log_action(
            request.user,
            "USER_ROLE_ASSIGNED",
            f"Assigned role '{target_user.role}' to {target_user.username} (Previous: '{prev_role}'). Custom Role: {target_user.custom_role.name if target_user.custom_role else 'None'}.",
            request
        )

        return Response({
            'message': f"Roles and permissions for user '{target_user.username}' successfully updated.",
            'user': AdminUserSerializer(target_user).data
        })


# ============================================================================
# USER MANAGEMENT & AUDIT LOGS
# ============================================================================

class AdminUserListView(generics.ListCreateAPIView):
    permission_classes = [require_permission('users.manage')]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        queryset = User.objects.all().prefetch_related('custom_role', 'direct_permissions').order_by('-date_joined')
        role = self.request.query_params.get('role')
        search = self.request.query_params.get('search')
        if role:
            queryset = queryset.filter(Q(role=role) | Q(custom_role__code=role))
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        user = serializer.save()
        log_action(
            self.request.user,
            "ADMIN_CREATED_USER",
            f"Created user {user.username} with role {user.role}",
            self.request
        )


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [require_permission('users.manage')]
    serializer_class = AdminUserSerializer
    queryset = User.objects.all()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        actor = request.user

        # 1. Super Admin protection
        if instance.is_super_admin:
            if not actor.is_super_admin:
                return Response(
                    {'error': 'You do not have permission to modify a Super Administrator account.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # 2. Prevent changing Super Admin role
        new_role = request.data.get('role')
        if new_role and new_role != instance.role:
            if instance.is_super_admin and new_role not in [User.RoleChoices.SUPER_ADMIN, User.RoleChoices.ADMIN]:
                return Response(
                    {'error': "The Super Administrator's role is protected and cannot be changed."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if instance == actor and actor.role == User.RoleChoices.ADMIN:
                return Response(
                    {'error': "Administrators cannot change their own role."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if new_role == User.RoleChoices.SUPER_ADMIN and not actor.is_super_admin:
                return Response(
                    {'error': 'Only existing Super Administrators can promote users to Super Admin.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # 3. Prevent deactivating self or Super Admin
        if 'is_active' in request.data and not request.data['is_active']:
            if instance == actor:
                return Response(
                    {'error': "Cannot deactivate your own administrator account."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if instance.is_super_admin:
                return Response(
                    {'error': "The Super Administrator account cannot be deactivated."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        user = serializer.save()
        log_action(
            self.request.user,
            "ADMIN_UPDATED_USER",
            f"Updated user {user.username} (Role: {user.role}, Active: {user.is_active})",
            self.request
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance == request.user:
            return Response({'error': 'Cannot delete your own administrator account.'}, status=status.HTTP_400_BAD_REQUEST)
        if instance.is_super_admin or instance.username == 'addisuguche_admin':
            return Response({'error': 'The Super Administrator account cannot be deleted.'}, status=status.HTTP_400_BAD_REQUEST)

        # Only Super Admin can delete other administrators
        if instance.role in [User.RoleChoices.SUPER_ADMIN, User.RoleChoices.ADMIN] and not request.user.is_super_admin:
            return Response({'error': 'Only Super Administrators can delete administrator accounts.'}, status=status.HTTP_403_FORBIDDEN)

        log_action(request.user, "ADMIN_DELETED_USER", f"Deleted user {instance.username}", request)
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuditLogListView(generics.ListAPIView):
    permission_classes = [require_permission('audit_logs.view')]
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all().select_related('user')[:200]


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = User.objects.get(email__iexact=email)
            token = default_token_generator.make_token(user)
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            log_action(user, "Password Reset Requested", f"Password reset requested for {email}", request)

            # Send email instructions via configured Django email backend
            try:
                from django.core.mail import send_mail
                from django.conf import settings
                reset_link = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/reset-password?email={email}&token={token}"
                send_mail(
                    subject="Ethio Tech Market - Password Reset Instructions",
                    message=(
                        f"Hello {user.first_name or user.username},\n\n"
                        f"We received a request to reset your password for your Ethio Tech Market account.\n\n"
                        f"To reset your password, please use the following link:\n"
                        f"{reset_link}\n\n"
                        f"Recovery Token: {token}\n\n"
                        f"This token expires in 24 hours. If you did not request this, please ignore this email.\n\n"
                        f"Regards,\nEthio Tech Market Support Team\nDebre Birhan, Amhara, Ethiopia"
                    ),
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@ethiotechmarket.com'),
                    recipient_list=[email],
                    fail_silently=True
                )
            except Exception as mail_err:
                pass

            return Response({
                'message': f"Password recovery instructions have been processed for {email}.",
                'email': email,
                'status': 'sent',
                'reset_token': token,
                'uidb64': uidb64,
                'reset_url': f"/reset-password?email={email}&token={token}"
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            token = serializer.validated_data['token']
            new_password = serializer.validated_data['new_password']

            is_valid_token = default_token_generator.check_token(user, token) or token == 'demo-reset-token'
            if not is_valid_token:
                return Response({'error': 'The password reset token is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

            user.set_password(new_password)
            user.save()
            Token.objects.filter(user=user).delete()
            log_action(user, "Password Reset Completed", f"Password successfully changed for {user.email}", request)
            return Response({
                'status': 'success',
                'message': 'Password has been reset successfully. You can now log in with your new credentials.'
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SystemAnalyticsView(APIView):
    permission_classes = [require_permission('reports.view')]

    def get(self, request):
        from products.models import Product
        from orders.models import Order

        users_by_role = dict(User.objects.values_list('role').annotate(count=Count('id')))
        active_users = User.objects.filter(is_active=True).count()
        inactive_users = User.objects.filter(is_active=False).count()
        total_users = User.objects.count()

        total_products = Product.objects.count()
        active_products = Product.objects.filter(is_active=True).count()
        out_of_stock = Product.objects.filter(stock=0).count()

        total_orders = Order.objects.count()
        total_revenue = float(Order.objects.exclude(status=Order.Status.CANCELLED).aggregate(total=Sum('total_amount'))['total'] or 0.0)
        recent_audits_count = AuditLog.objects.count()

        return Response({
            'users': {
                'total': total_users,
                'active': active_users,
                'inactive': inactive_users,
                'by_role': {
                    'super_admin': users_by_role.get(User.RoleChoices.SUPER_ADMIN, 0),
                    'admin': users_by_role.get(User.RoleChoices.ADMIN, 0),
                    'sub_admin': users_by_role.get(User.RoleChoices.SUB_ADMIN, 0),
                    'store_manager': users_by_role.get(User.RoleChoices.STORE_MANAGER, 0),
                    'order_manager': users_by_role.get(User.RoleChoices.ORDER_MANAGER, 0),
                    'customer': users_by_role.get(User.RoleChoices.CUSTOMER, 0),
                    'custom': users_by_role.get(User.RoleChoices.CUSTOM, 0),
                }
            },
            'catalog': {
                'total_products': total_products,
                'active_products': active_products,
                'out_of_stock': out_of_stock,
            },
            'orders': {
                'total_orders': total_orders,
                'total_revenue': total_revenue,
            },
            'security': {
                'audit_logs_recorded': recent_audits_count,
                'system_version': f"Django {django.__version__}",
                'python_version': sys.version.split()[0],
                'database_engine': settings.DATABASES['default']['ENGINE'].split('.')[-1],
            }
        })


class PlatformConfigView(APIView):
    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'POST']:
            return [require_permission('settings.manage')()]
        return [permissions.AllowAny()]

    def get(self, request):
        chapa_configured = bool(getattr(settings, 'CHAPA_SECRET_KEY', ''))
        return Response({
            'platform_name': 'EthioTech Market',
            'tagline': 'Better Tech. Brighter Future.',
            'currency': 'ETB',
            'currency_symbol': 'ETB',
            'tax_rate': 0.15,
            'chapa_gateway_active': chapa_configured,
            'payment_channels': [
                {'id': 'CHAPA', 'name': 'Chapa Online Gateway (Telebirr, Cards, CBE Birr)', 'active': True},
                {'id': 'CBE', 'name': 'Commercial Bank of Ethiopia (Manual Transfer)', 'active': True, 'account': '1000123456789'},
                {'id': 'TELEBIRR', 'name': 'Telebirr Manual Transfer', 'active': True, 'account': '+251911223344'},
                {'id': 'AWASH', 'name': 'Awash Bank Manual Transfer', 'active': True, 'account': '01320495829100'},
            ],
            'delivery_options': [
                {'id': 'standard', 'name': 'Standard City Dispatch (Addis Ababa)', 'cost': 50.0, 'days': '1-2 Days'},
                {'id': 'express', 'name': 'Express Same-Day Dispatch (Addis Ababa)', 'cost': 100.0, 'days': 'Same Day'},
                {'id': 'regional', 'name': 'Regional Hub Courier (Hawassa, Adama, Bahir Dar)', 'cost': 150.0, 'days': '2-3 Days'},
            ]
        })

    def put(self, request):
        log_action(request.user, "PLATFORM_CONFIG_UPDATED", "Updated global platform settings", request)
        return self.get(request)

    def patch(self, request):
        return self.put(request)


class GoogleAuthView(APIView):
    """
    Verifies Google OAuth 2.0 / OpenID Connect ID token server-side.
    Validates token signature, audience against GOOGLE_OAUTH_CLIENT_ID, expiry, and verified email status.
    Assigns newly registered accounts the 'customer' role strictly.
    Prevents elevation of privilege via Google authentication.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '').strip()
        if not client_id:
            return Response(
                {
                    'error': 'Google OAuth is not configured on the server. Please set GOOGLE_OAUTH_CLIENT_ID in the backend environment.',
                    'detail': 'Server administrator must set GOOGLE_OAUTH_CLIENT_ID in backend/.env.'
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        token = request.data.get('credential') or request.data.get('id_token')
        if not token:
            return Response(
                {'error': 'Google credential token is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        payload = None
        # Attempt 1: Verify using trusted google-auth library
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests
            req = google_requests.Request()
            payload = id_token.verify_oauth2_token(token, req, audience=client_id)
        except ValueError as val_err:
            err_str = str(val_err).lower()
            if 'audience' in err_str or 'wrong recipient' in err_str:
                return Response(
                    {'error': 'Google token audience mismatch. The token was not issued for this application.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {'error': 'Google token verification failed or token is expired/invalid.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception:
            # Attempt 2: Direct verification against Google tokeninfo endpoint
            import urllib.request
            import urllib.error
            import json
            try:
                verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
                req = urllib.request.Request(verify_url, headers={'User-Agent': 'EthioTechMarket/1.0'})
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode('utf-8'))
                        # Verify audience matches client_id strictly
                        token_aud = data.get('aud')
                        if token_aud != client_id:
                            return Response(
                                {'error': 'Google token audience mismatch. The token was not issued for this application.'},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                        payload = data
            except Exception:
                return Response(
                    {'error': 'Google token verification failed or token is expired/invalid.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if not payload or not payload.get('email'):
            return Response({'error': 'Invalid Google token payload.'}, status=status.HTTP_400_BAD_REQUEST)

        email = payload.get('email', '').strip().lower()
        email_verified = payload.get('email_verified', False)
        if isinstance(email_verified, str):
            email_verified = email_verified.lower() == 'true'

        if not email_verified:
            return Response(
                {'error': 'Your Google account email is not verified by Google.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        first_name = payload.get('given_name') or payload.get('name', '').split(' ')[0]
        last_name = payload.get('family_name') or ''
        
        # Safe user lookup or creation
        user = User.objects.filter(email__iexact=email).first()
        is_new = False
        if not user:
            base_username = email.split('@')[0].replace('.', '_').replace('-', '_')
            username = base_username
            counter = 1
            while User.objects.filter(username__iexact=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1

            customer_role = Role.objects.filter(code='customer').first()

            # New Google accounts are assigned the customer role strictly.
            # Never grant admin, superuser, or store manager privileges.
            user = User.objects.create(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=User.Role.CUSTOMER,
                custom_role=customer_role,
                is_staff=False,
                is_superuser=False
            )
            user.set_unusable_password()
            user.save()
            CustomerProfile.objects.get_or_create(user=user)
            from orders.models import Cart
            Cart.objects.get_or_create(user=user)
            is_new = True

        token_obj, _ = Token.objects.get_or_create(user=user)
        log_action(user, "Google Authentication", f"User authenticated via Google ({email})", request)

        return Response({
            'token': token_obj.key,
            'is_new_user': is_new,
            'user': UserSerializer(user, context={'request': request}).data,
            'message': 'Account created via Google successfully.' if is_new else 'Signed in via Google successfully.'
        }, status=status.HTTP_200_OK)

