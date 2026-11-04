from django.urls import path
from .views import (
    RegisterView, VerifyEmailView, ResendVerificationView,
    LoginView, CustomerLoginView, StaffLoginView, SupplierLoginView, LogoutView, CurrentUserView, UserAvatarView,
    ChangePasswordView,
    AdminUserListView, AdminUserDetailView, AuditLogListView,
    PasswordResetRequestView, PasswordResetConfirmView, GoogleAuthView,
    SystemAnalyticsView, PlatformConfigView,
    PermissionListView, RoleListCreateView, RoleDetailView,
    ApplyRoleTemplateView, UserRoleAssignView
)

urlpatterns = [
    # Auth & Profile
    path('register/', RegisterView.as_view(), name='register'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('resend-otp/', ResendVerificationView.as_view(), name='resend-otp'),
    path('resend-verification/', ResendVerificationView.as_view(), name='resend-verification'),
    path('login/', LoginView.as_view(), name='login'),
    path('login/customer/', CustomerLoginView.as_view(), name='customer-login'),
    path('login/staff/', StaffLoginView.as_view(), name='staff-login'),
    path('login/supplier/', SupplierLoginView.as_view(), name='supplier-login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('google/', GoogleAuthView.as_view(), name='google-auth'),
    path('profile/', CurrentUserView.as_view(), name='profile'),
    path('profile/avatar/', UserAvatarView.as_view(), name='profile-avatar'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),

    # User Management
    path('users/', AdminUserListView.as_view(), name='admin-users-list'),
    path('users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('users/<int:pk>/assign-role/', UserRoleAssignView.as_view(), name='user-assign-role'),

    # RBAC: Permissions & Roles
    path('permissions/', PermissionListView.as_view(), name='rbac-permissions-list'),
    path('roles/', RoleListCreateView.as_view(), name='rbac-roles-list-create'),
    path('roles/<int:pk>/', RoleDetailView.as_view(), name='rbac-role-detail'),
    path('roles/templates/', ApplyRoleTemplateView.as_view(), name='rbac-role-templates'),

    # Administration, Audits & Config
    path('audit-logs/', AuditLogListView.as_view(), name='audit-logs'),
    path('system-analytics/', SystemAnalyticsView.as_view(), name='system-analytics'),
    path('platform-config/', PlatformConfigView.as_view(), name='platform-config'),
]
