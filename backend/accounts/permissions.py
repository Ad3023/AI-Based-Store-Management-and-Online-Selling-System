from rest_framework import permissions
from .models import User


def require_permission(perm_code):
    """
    Factory creating a DRF Permission class that verifies whether the authenticated
    user possesses the specified granular permission code (or is a Super Admin).
    """
    class PermissionChecker(permissions.BasePermission):
        message = f"Access denied. Required permission: '{perm_code}'."

        def has_permission(self, request, view):
            if not (request.user and request.user.is_authenticated):
                return False
            # Super Admin has all permissions unconditionally
            if getattr(request.user, 'is_super_admin', False):
                return True
            return request.user.has_permission(perm_code)

    PermissionChecker.__name__ = f"Require_{perm_code.replace('.', '_')}"
    return PermissionChecker


class HasPermission(permissions.BasePermission):
    """
    General permission class used when perm_code is defined on the view:
    e.g. view.required_permission = 'products.create'
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if getattr(request.user, 'is_super_admin', False):
            return True
        required_perm = getattr(view, 'required_permission', None)
        if not required_perm:
            return True
        return request.user.has_permission(required_perm)


class IsSuperAdmin(permissions.BasePermission):
    message = "Access denied. Strictly reserved for Super Administrators."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'is_super_admin', False)
        )


class IsAdminUserRole(permissions.BasePermission):
    message = "Access denied. Requires Administrator or Super Administrator privileges."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and (
                getattr(request.user, 'is_admin', lambda: False)() or
                getattr(request.user, 'is_super_admin', False) or
                request.user.has_permission('users.manage')
            )
        )


class IsSubAdminRole(permissions.BasePermission):
    message = "Access denied. Requires Sub-Admin privileges."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'is_sub_admin', lambda: False)()
        )


class IsStoreManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'is_store_manager', lambda: False)()
        )


class IsOrderManager(permissions.BasePermission):
    message = "Access denied. Requires Order Manager privileges."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'is_order_manager', lambda: False)()
        )


class IsStoreManagerOrAdmin(permissions.BasePermission):
    message = "Access denied. Requires Store Manager, Order Manager, Administrator, or appropriate staff permissions."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if getattr(request.user, 'is_super_admin', False):
            return True
        if getattr(request.user, 'is_store_manager', lambda: False)():
            return True
        if getattr(request.user, 'is_order_manager', lambda: False)():
            return True
        # Also allow if user has any administrative or management permissions
        return len(request.user.get_all_permissions()) > 0


class IsCustomer(permissions.BasePermission):
    message = "Access denied. This feature is reserved for customer accounts."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'is_customer', lambda: False)()
        )


class IsNotAdmin(permissions.BasePermission):
    message = "Administrators are restricted from personal shopping and cart operations. Please use a customer account."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return True
        # Restrict Super Admin and Admin from customer shopping carts
        if getattr(request.user, 'is_super_admin', False) or request.user.role == User.RoleChoices.ADMIN:
            return False
        return True
