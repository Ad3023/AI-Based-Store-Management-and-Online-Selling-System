from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from .models import User, AuditLog, CustomerProfile
from .serializers import (
    UserSerializer, RegisterSerializer, LoginSerializer,
    AuditLogSerializer, CustomerProfileSerializer, PasswordResetRequestSerializer
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
            log_action(user, "User Login", f"Successful login", request)
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
    serializer_class = UserSerializer

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
    serializer_class = UserSerializer
    queryset = User.objects.all()

    def perform_update(self, serializer):
        user = serializer.save()
        log_action(self.request.user, "Admin Updated User", f"Updated user {user.username} (Role: {user.role}, Active: {user.is_active})", self.request)

    def perform_destroy(self, instance):
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
            log_action(user, "Password Reset Requested", f"Password reset requested for {email}", request)
            return Response({
                'message': f"Password recovery instructions have been processed for {email}. In a production environment, a secure time-limited token link is dispatched to your registered address.",
                'email': email,
                'status': 'sent'
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

