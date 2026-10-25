from django.urls import path
from .views import (
    RegisterView, LoginView, LogoutView, CurrentUserView, UserAvatarView,
    AdminUserListView, AdminUserDetailView, AuditLogListView,
    PasswordResetRequestView, PasswordResetConfirmView,
    SystemAnalyticsView, PlatformConfigView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', CurrentUserView.as_view(), name='profile'),
    path('profile/avatar/', UserAvatarView.as_view(), name='profile-avatar'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('users/', AdminUserListView.as_view(), name='admin-users-list'),
    path('users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('audit-logs/', AuditLogListView.as_view(), name='audit-logs'),
    path('system-analytics/', SystemAnalyticsView.as_view(), name='system-analytics'),
    path('platform-config/', PlatformConfigView.as_view(), name='platform-config'),
]
