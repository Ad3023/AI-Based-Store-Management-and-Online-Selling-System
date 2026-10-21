from rest_framework import permissions
from .models import User


class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.CUSTOMER)


class IsStoreManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.role == User.Role.STORE_MANAGER or request.user.is_superuser
        ))


class IsAdminUserRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.role == User.Role.ADMIN or request.user.is_superuser
        ))


class IsStoreManagerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.role in [User.Role.STORE_MANAGER, User.Role.ADMIN] or request.user.is_superuser
        ))
