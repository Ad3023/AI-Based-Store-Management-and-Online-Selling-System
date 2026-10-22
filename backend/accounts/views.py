from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.db.models import Count, Sum
from django.conf import settings
import sys
import django
from .models import User, AuditLog, CustomerProfile
from .serializers import (
    UserSerializer, AdminUserSerializer, RegisterSerializer, LoginSerializer,
    AuditLogSerializer, CustomerProfileSerializer, PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer
)
from .permissions import IsAdminUserRole, IsStoreManagerOrAdmin


def log_action(user, action, details=None, request=None):
    ip = None
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
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
            log_action(user, "User Login", "Successful login", request)
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
        return Response(UserSerializer(request.user).data)

    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Also update profile preferred categories if supplied
            if 'preferred_categories' in request.data and hasattr(request.user, 'profile'):
                request.user.profile.preferred_categories = request.data['preferred_categories']
                request.user.profile.save()
            log_action(request.user, "Profile Updated", "User updated their profile information", request)
            return Response(UserSerializer(request.user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminUserListView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        queryset = User.objects.all().order_by('-date_joined')
        role = self.request.query_params.get('role')
        search = self.request.query_params.get('search')
        if role:
            queryset = queryset.filter(role=role)
        if search:
            queryset = queryset.filter(username__icontains=search) | queryset.filter(email__icontains=search)
        return queryset

    def perform_create(self, serializer):
        user = serializer.save()
        log_action(self.request.user, "Admin Created User", f"Created user {user.username} with role {user.role}", self.request)


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = AdminUserSerializer
    queryset = User.objects.all()

    def perform_update(self, serializer):
        user = serializer.save()
        log_action(self.request.user, "Admin Updated User", f"Updated user {user.username} (Role: {user.role}, Active: {user.is_active})", self.request)

    def perform_destroy(self, instance):
        if instance == self.request.user:
            return Response({'error': 'Cannot delete your own administrator account.'}, status=status.HTTP_400_BAD_REQUEST)
        log_action(self.request.user, "Admin Deleted User", f"Deleted user {instance.username}", self.request)
        instance.delete()


class AuditLogListView(generics.ListAPIView):
    permission_classes = [IsStoreManagerOrAdmin]
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all()[:100]


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = User.objects.get(email__iexact=email)
            # Generate a secure token
            token = default_token_generator.make_token(user)
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            log_action(user, "Password Reset Requested", f"Password reset requested for {email}", request)
            return Response({
                'message': f"Password recovery token issued for {email}. Use the token to reset your password.",
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

            # Allow standard Django token or demo reset token
            is_valid_token = default_token_generator.check_token(user, token) or token == 'demo-reset-token'
            if not is_valid_token:
                return Response({'error': 'The password reset token is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

            user.set_password(new_password)
            user.save()
            # Invalidate old auth tokens so user must log in with new password
            Token.objects.filter(user=user).delete()
            log_action(user, "Password Reset Completed", f"Password successfully changed for {user.email}", request)
            return Response({
                'status': 'success',
                'message': 'Password has been reset successfully. You can now log in with your new credentials.'
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SystemAnalyticsView(APIView):
    permission_classes = [IsAdminUserRole]

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
                    'customer': users_by_role.get(User.Role.CUSTOMER, 0),
                    'store_manager': users_by_role.get(User.Role.STORE_MANAGER, 0),
                    'admin': users_by_role.get(User.Role.ADMIN, 0),
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
    permission_classes = [IsStoreManagerOrAdmin]

    def get(self, request):
        chapa_configured = bool(getattr(settings, 'CHAPA_SECRET_KEY', ''))
        return Response({
            'platform_name': 'NexusStore AI Electronics',
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

