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
import secrets
import random
import datetime
from django.utils import timezone
import django
from .models import User, AuditLog, CustomerProfile, Permission, Role, EmailVerificationToken, PasswordResetToken
from .email_service import (
    send_verification_email, send_password_reset_email, send_password_changed_notification
)
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


def mask_email(email_str):
    """
    Masks customer email for privacy on verification page, e.g. add***@gmail.com.
    """
    if not email_str or '@' not in email_str:
        return email_str or ''
    local, domain = email_str.split('@', 1)
    if len(local) <= 2:
        masked_local = local[0] + '*'
    elif len(local) <= 3:
        masked_local = local[:2] + '*'
    elif len(local) <= 5:
        masked_local = local[:3] + '**'
    else:
        masked_local = local[:3] + '***'
    return f"{masked_local}@{domain}"


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

            # Invalidate any prior unused tokens for this user
            EmailVerificationToken.objects.filter(user=user, is_used=False).update(is_used=True)

            # Generate cryptographically secure 6-digit numeric OTP
            otp_code = f"{secrets.randbelow(900000) + 100000}"
            token_str = secrets.token_urlsafe(32)
            # Expire in 10 minutes strictly
            expires = timezone.now() + datetime.timedelta(minutes=10)

            token_obj = EmailVerificationToken(
                user=user,
                token=token_str,
                purpose='email_verification',
                expires_at=expires
            )
            # Hash OTP securely into otp_hash (never store raw OTP)
            token_obj.set_otp(otp_code)
            token_obj.save()

            # Send verification email synchronously to verify SMTP delivery
            success, err_msg = send_verification_email(user, otp_code, token_str)
            if not success:
                # Do NOT tell customer email was sent when SMTP fails
                log_action(user, "User Registration Email Failed", f"SMTP delivery failed for {user.email}", request)
                return Response({
                    'requires_verification': True,
                    'email': user.email,
                    'masked_email': mask_email(user.email),
                    'email_sent': False,
                    'error': err_msg or 'We could not send the verification email at this time. Please try again later.'
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

            log_action(user, "User Registration", f"Registered customer account {user.email}. Verification email dispatched.", request)

            return Response({
                'requires_verification': True,
                'email': user.email,
                'masked_email': mask_email(user.email),
                'email_sent': True,
                'message': 'Account registered successfully! A 6-digit verification code has been sent to your email address. Please enter the code to activate your account.'
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        token = request.data.get('token', '').strip()
        otp = (request.data.get('otp') or request.data.get('otp_code') or request.data.get('code') or '').strip()

        # If token was supplied as a 6-digit numeric OTP, treat it as OTP
        if not otp and len(token) == 6 and token.isdigit():
            otp = token
            token = ''

        if not email:
            return Response({'error': 'Email address is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not token and not otp:
            return Response({'error': 'Please provide the 6-digit verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({'error': 'No account found with this email address.'}, status=status.HTTP_404_NOT_FOUND)

        if user.email_verified and user.is_active:
            return Response({
                'status': 'already_verified',
                'message': 'Your email is already verified. You can now sign in and start shopping.'
            }, status=status.HTTP_200_OK)

        # Look up active verification record for this user
        token_record = EmailVerificationToken.objects.filter(user=user, is_used=False).order_by('-created_at').first()
        if not token_record:
            return Response({
                'error': 'No active verification code found for this account. Please request a new verification code.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check maximum failed attempts limit (max 5 attempts)
        if token_record.failed_attempts >= 5:
            token_record.is_used = True
            token_record.save()
            return Response({
                'error': 'Maximum verification attempts exceeded (5/5). This code has been invalidated. Please request a new verification code.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check expiration (10 minutes)
        if timezone.now() > token_record.expires_at:
            token_record.is_used = True
            token_record.save()
            return Response({
                'error': 'The verification code has expired. Please request a new verification code.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Verify OTP code or token
        is_match = False
        if otp:
            is_match = token_record.verify_otp(otp)
        elif token:
            import hmac
            is_match = hmac.compare_digest(token_record.token, token)

        if not is_match:
            token_record.failed_attempts += 1
            if token_record.failed_attempts >= 5:
                token_record.is_used = True
            token_record.save()
            remaining = max(0, 5 - token_record.failed_attempts)
            if remaining == 0:
                return Response({
                    'error': 'Maximum verification attempts exceeded (5/5). This code has been invalidated. Please request a new code.'
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response({
                'error': f'Invalid verification code. You have {remaining} attempt(s) remaining.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Success! Mark token as used and activate account
        token_record.is_used = True
        token_record.verified_at = timezone.now()
        token_record.save()

        # Invalidate any remaining tokens for this user
        EmailVerificationToken.objects.filter(user=user, is_used=False).update(is_used=True)

        user.email_verified = True
        has_active_supplier = hasattr(user, 'supplier_profile') and user.supplier_profile and getattr(user.supplier_profile, 'status', '') == 'ACTIVE'

        if user.role == User.RoleChoices.SUPPLIER:
            if has_active_supplier:
                user.is_active = True
                user.save(update_fields=['is_active', 'email_verified', 'updated_at'])
                log_action(user, "EMAIL_VERIFICATION_SUCCESS", f"Supplier {user.email} verified email successfully with OTP", request)
                return Response({
                    'status': 'verified',
                    'role': 'supplier',
                    'message': 'Your Supplier Portal account email has been verified. You can now sign in to the Supplier Portal.',
                    'redirect_url': '/supplier/login'
                }, status=status.HTTP_200_OK)
            else:
                user.is_active = False
                user.save(update_fields=['is_active', 'email_verified', 'updated_at'])
                log_action(user, "EMAIL_VERIFICATION_PENDING_APPROVAL", f"Supplier {user.email} verified email, awaiting admin approval", request)
                return Response({
                    'status': 'verified_pending_approval',
                    'role': 'supplier',
                    'message': 'Your email has been verified successfully. Your account will become active upon Administrator approval.',
                    'redirect_url': '/supplier/login'
                }, status=status.HTTP_200_OK)
        else:
            user.is_active = True
            user.save(update_fields=['is_active', 'email_verified', 'updated_at'])
            log_action(user, "EMAIL_VERIFICATION_SUCCESS", f"Customer {user.email} verified email successfully with OTP", request)
            return Response({
                'status': 'verified',
                'message': 'Your EthioTech Market account has been activated. You can now sign in and start shopping.',
                'redirect_url': '/login'
            }, status=status.HTTP_200_OK)


class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email address is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({
                'error': 'No account found with this email address. Please register a customer account.'
            }, status=status.HTTP_404_NOT_FOUND)

        if user.email_verified and user.is_active:
            return Response({
                'status': 'already_verified',
                'message': 'Your account is already verified. You can log in.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check 60-second cooldown from latest token creation
        latest = EmailVerificationToken.objects.filter(user=user).order_by('-created_at').first()
        if latest:
            elapsed = (timezone.now() - latest.created_at).total_seconds()
            if elapsed < 60:
                remaining = int(60 - elapsed)
                return Response({
                    'error': f'Please wait {remaining} seconds before requesting a new verification code.',
                    'cooldown': remaining
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # Invalidate all prior unused tokens
        EmailVerificationToken.objects.filter(user=user, is_used=False).update(is_used=True)

        otp_code = f"{secrets.randbelow(900000) + 100000}"
        token_str = secrets.token_urlsafe(32)
        expires = timezone.now() + datetime.timedelta(minutes=10)

        token_obj = EmailVerificationToken(
            user=user,
            token=token_str,
            purpose='email_verification',
            expires_at=expires
        )
        token_obj.set_otp(otp_code)
        token_obj.save()

        # Send email
        success, err_msg = send_verification_email(user, otp_code, token_str)
        if not success:
            log_action(user, "RESEND_VERIFICATION_FAILED", f"Failed to resend verification email to {user.email}", request)
            return Response({
                'error': err_msg or 'We could not send the verification email at this time. Please try again later.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        log_action(user, "RESEND_VERIFICATION", f"Verification email re-sent to {user.email}", request)

        return Response({
            'message': 'A new 6-digit verification code has been sent to your email address.',
            'masked_email': mask_email(user.email),
            'cooldown': 60
        }, status=status.HTTP_200_OK)



def get_dashboard_url_for_user(user):
    """
    Returns the canonical role-based dashboard URL determined authoritatively by the Django backend.
    - Admin / Super Admin -> /admin/dashboard
    - Store Manager -> /store-manager/dashboard
    - Order Manager -> /order-manager/dashboard
    - Customer -> /customer/dashboard
    """
    if getattr(user, 'is_super_admin', False) or user.role in [User.RoleChoices.SUPER_ADMIN, User.RoleChoices.ADMIN]:
        return '/admin/dashboard'
    if getattr(user, 'is_order_manager', lambda: False)() or user.role == User.RoleChoices.ORDER_MANAGER:
        return '/order-manager/dashboard'
    if (
        user.role in [User.RoleChoices.STORE_MANAGER, User.RoleChoices.SUB_ADMIN] or
        (user.custom_role is not None and getattr(user.custom_role, 'code', '') != 'customer')
    ):
        return '/store-manager/dashboard'
    if getattr(user, 'is_supplier', lambda: False)() or user.role == User.RoleChoices.SUPPLIER:
        return '/supplier/dashboard'
    if getattr(user, 'is_delivery_driver', lambda: False)() or user.role == User.RoleChoices.DELIVERY or hasattr(user, 'delivery_profile'):
        return '/driver/dashboard'
    return '/customer/dashboard'


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    portal_type = None

    def post(self, request):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if self.portal_type and not data.get('portal'):
            data['portal'] = self.portal_type

        serializer = LoginSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']
            portal = data.get('portal')

            # Portal Role Separation Enforcement
            if portal == 'staff':
                if user.role == User.RoleChoices.SUPPLIER:
                    return Response({
                        'portal_access_denied': True,
                        'portal': 'staff',
                        'role': user.role,
                        'redirect_url': '/supplier/login',
                        'error': 'This portal is for internal staff only. Suppliers must sign in via the Supplier Portal.'
                    }, status=status.HTTP_403_FORBIDDEN)
                is_staff_user = bool(
                    getattr(user, 'is_super_admin', False) or
                    user.role in [
                        User.RoleChoices.SUPER_ADMIN,
                        User.RoleChoices.ADMIN,
                        User.RoleChoices.SUB_ADMIN,
                        User.RoleChoices.STORE_MANAGER,
                        User.RoleChoices.ORDER_MANAGER,
                        User.RoleChoices.CUSTOM,
                    ] or
                    (user.custom_role is not None and user.custom_role.code not in ['customer', 'supplier']) or
                    (not user.is_customer() and user.role != User.RoleChoices.SUPPLIER)
                )
                if not is_staff_user:
                    return Response({
                        'portal_access_denied': True,
                        'portal': 'staff',
                        'role': user.role,
                        'redirect_url': '/login',
                        'error': 'This portal is for authorized staff only. Please use Customer Login.'
                    }, status=status.HTTP_403_FORBIDDEN)
            elif portal == 'customer':
                if user.role == User.RoleChoices.SUPPLIER:
                    return Response({
                        'portal_access_denied': True,
                        'portal': 'customer',
                        'role': user.role,
                        'redirect_url': '/supplier/login',
                        'error': 'This login portal is reserved for customers only. Suppliers must sign in via the Supplier Portal.'
                    }, status=status.HTTP_403_FORBIDDEN)
                is_customer_user = bool(
                    user.is_customer() and
                    (user.custom_role is None or user.custom_role.code == 'customer') and
                    not getattr(user, 'is_super_admin', False) and
                    user.role == User.RoleChoices.CUSTOMER
                )
                if not is_customer_user:
                    return Response({
                        'portal_access_denied': True,
                        'portal': 'customer',
                        'role': user.role,
                        'is_staff': True,
                        'redirect_url': '/staff/login',
                        'error': 'This login portal is reserved for customers only. Staff members (Administrator, Store Manager, Order Manager) must sign in via the Staff Login portal.'
                    }, status=status.HTTP_403_FORBIDDEN)
            elif portal == 'driver':
                is_driver_user = bool(
                    user.role == User.RoleChoices.DELIVERY or
                    hasattr(user, 'delivery_profile') or
                    getattr(user, 'is_delivery_driver', lambda: False)()
                )
                if not is_driver_user:
                    return Response({
                        'portal_access_denied': True,
                        'portal': 'driver',
                        'role': user.role,
                        'redirect_url': '/login',
                        'error': 'This portal is strictly reserved for registered delivery personnel.'
                    }, status=status.HTTP_403_FORBIDDEN)
            elif portal == 'supplier':
                is_supplier_user = bool(
                    getattr(user, 'is_supplier', lambda: False)() or
                    user.role == User.RoleChoices.SUPPLIER or
                    (hasattr(user, 'supplier_profile') and user.supplier_profile is not None)
                )
                if not is_supplier_user:
                    return Response({
                        'portal_access_denied': True,
                        'portal': 'supplier',
                        'role': user.role,
                        'redirect_url': '/login',
                        'error': 'This portal is strictly reserved for registered hardware suppliers. Store staff and customers cannot log in here.'
                    }, status=status.HTTP_403_FORBIDDEN)

                if hasattr(user, 'supplier_profile') and user.supplier_profile:
                    if getattr(user.supplier_profile, 'status', '') in ['SUSPENDED', 'DEACTIVATED']:
                        return Response({
                            'error': f'Your supplier organization ({user.supplier_profile.name}) is currently {user.supplier_profile.status.lower()}. Please contact platform administration.'
                        }, status=status.HTTP_403_FORBIDDEN)

            token, _ = Token.objects.get_or_create(user=user)
            portal_label = portal or 'general'
            log_action(user, "User Login", f"Successful login via {portal_label} portal (Role: {user.role})", request)
            dashboard_url = get_dashboard_url_for_user(user)
            return Response({
                'token': token.key,
                'user': UserSerializer(user, context={'request': request}).data,
                'role': user.role,
                'dashboard_url': dashboard_url,
                'must_change_password': bool(getattr(user, 'must_change_password', False)),
                'message': 'Logged in successfully.'
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomerLoginView(LoginView):
    """
    Dedicated endpoint strictly for Customer login.
    Staff members (Admin, Store Manager, Order Manager) are rejected with HTTP 403.
    """
    portal_type = 'customer'


class StaffLoginView(LoginView):
    """
    Dedicated endpoint strictly for Staff (Admin, Store Manager, Order Manager) login.
    Customers are rejected with HTTP 403.
    """
    portal_type = 'staff'


class SupplierLoginView(LoginView):
    """
    Dedicated endpoint strictly for Supplier login.
    Customers and staff are rejected with HTTP 403.
    """
    portal_type = 'supplier'


class DriverLoginView(LoginView):
    """
    Dedicated endpoint strictly for Delivery Drivers.
    """
    portal_type = 'driver'


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
        # Prevent any escalation attempt: role is strictly read-only and stripped from profile updates
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        data.pop('role', None)

        if 'password' in data and str(data['password']).strip():
            new_pwd = str(data['password']).strip()
            if len(new_pwd) < 6:
                return Response({'error': 'Password must be at least 6 characters long.'}, status=status.HTTP_400_BAD_REQUEST)
            request.user.set_password(new_pwd)
            request.user.save()
            log_action(request.user, "Password Changed", "User updated their account password", request)

        old_email = request.user.email
        serializer = UserSerializer(request.user, data=data, partial=True, context={'request': request})
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
    permission_classes = [IsAdminUserRole]
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
    permission_classes = [IsAdminUserRole]
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

        # Protect the last active administrator
        if instance.is_admin() and User.active_admin_count() <= 1:
            return Response({'error': 'Cannot delete the last active administrator. The system must retain at least one active administrator.'}, status=status.HTTP_400_BAD_REQUEST)

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
            user = User.objects.filter(email__iexact=email, is_active=True).first()
            if user:
                raw_otp = f"{secrets.randbelow(900000) + 100000}"
                token_str = secrets.token_urlsafe(32)
                expires = timezone.now() + datetime.timedelta(hours=24)
                PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)
                prt = PasswordResetToken(
                    user=user,
                    token=token_str,
                    expires_at=expires
                )
                prt.set_otp(raw_otp)
                prt.save()
                send_password_reset_email(user, token_str, raw_otp=raw_otp)
                log_action(user, "Password Reset Requested", f"Password reset instructions and OTP sent to {email}", request)

            # Security requirement: Never return the secret token or reset URL to the browser.
            # The user MUST check their email to obtain the OTP or click the link in Gmail.
            return Response({
                'message': 'If an account exists with that email address, password recovery instructions and a 6-digit verification code have been sent to your email.'
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            token_or_otp = serializer.validated_data['token'].strip()
            new_password = serializer.validated_data['new_password']

            # Check 1: Match full URL token from email reset link
            reset_token = PasswordResetToken.objects.filter(user=user, token=token_or_otp, is_used=False).first()
            is_valid_token = False
            if reset_token and reset_token.is_valid():
                is_valid_token = True
                reset_token.is_used = True
                reset_token.save()
            elif len(token_or_otp) == 6:
                # Check 2: Match 6-digit OTP code entered by the user
                active_tokens = PasswordResetToken.objects.filter(user=user, is_used=False)
                for rt in active_tokens:
                    if rt.is_valid() and rt.verify_otp(token_or_otp):
                        is_valid_token = True
                        rt.is_used = True
                        rt.save()
                        break
            elif default_token_generator.check_token(user, token_or_otp):
                is_valid_token = True

            if not is_valid_token:
                return Response({
                    'error': 'The password reset link or verification code is invalid or has expired. Please check your email or request a new code.'
                }, status=status.HTTP_400_BAD_REQUEST)

            user.set_password(new_password)
            user.save()
            Token.objects.filter(user=user).delete()
            send_password_changed_notification(user)
            log_action(user, "Password Reset Completed", f"Password successfully changed for {user.email}", request)
            return Response({
                'status': 'success',
                'message': 'Password has been reset successfully. You can now log in with your new credentials.'
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        new_password_confirm = request.data.get('new_password_confirm')

        if not old_password or not new_password:
            return Response({'error': 'Current password and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.check_password(old_password):
            return Response({'old_password': ['Current password is incorrect.']}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 6:
            return Response({'new_password': ['New password must be at least 6 characters long.']}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != new_password_confirm:
            return Response({'new_password_confirm': ['Confirmation password does not match new password.']}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        if hasattr(request.user, 'must_change_password'):
            request.user.must_change_password = False
        request.user.save()

        try:
            send_password_changed_notification(request.user)
        except Exception:
            pass

        log_action(
            request.user,
            "PASSWORD_CHANGED",
            f"User {request.user.username} successfully updated their password",
            request
        )

        return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)


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
        portal = request.data.get('portal', '').strip().lower()
        if portal == 'customer' and user and not user.is_customer():
            return Response({
                'error': 'Access denied. Google Sign-In is only available for customer accounts. Staff members (Administrator, Store Manager, Order Manager) must sign in via the Staff Login portal using their staff credentials.',
                'is_staff': True,
                'role': user.role,
                'staff_portal_url': '/staff/login'
            }, status=status.HTTP_403_FORBIDDEN)

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
            # Verified Google accounts do not require a separate email OTP.
            user = User.objects.create(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=User.Role.CUSTOMER,
                custom_role=customer_role,
                is_staff=False,
                is_superuser=False,
                is_active=True,
                email_verified=True
            )
            user.set_unusable_password()
            user.save()
            CustomerProfile.objects.get_or_create(user=user)
            from orders.models import Cart
            Cart.objects.get_or_create(user=user)
            is_new = True
        else:
            # If customer already existed and signed in via Google, verify email
            if not user.email_verified or not user.is_active:
                user.email_verified = True
                user.is_active = True
                user.save(update_fields=['email_verified', 'is_active', 'updated_at'])

        token_obj, _ = Token.objects.get_or_create(user=user)
        log_action(user, "Google Authentication", f"User authenticated via Google ({email})", request)

        return Response({
            'token': token_obj.key,
            'is_new_user': is_new,
            'user': UserSerializer(user, context={'request': request}).data,
            'role': user.role,
            'dashboard_url': '/customer/dashboard',
            'message': 'Account created via Google successfully.' if is_new else 'Signed in via Google successfully.'
        }, status=status.HTTP_200_OK)

