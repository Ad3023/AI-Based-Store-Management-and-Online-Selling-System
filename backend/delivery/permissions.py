from rest_framework import permissions
from accounts.models import User


class CanManageLogisticsAdmin(permissions.BasePermission):
    """
    Grants access to Administrator and Super Administrator for logistics fleet,
    courier management, and fee configuration.
    """
    message = "Access denied. Requires Administrator or Super Administrator privileges."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return bool(
            getattr(request.user, 'is_super_admin', False) or
            getattr(request.user, 'is_admin', lambda: False)() or
            request.user.role in [User.RoleChoices.ADMIN, User.RoleChoices.SUPER_ADMIN]
        )


class CanManageShipments(permissions.BasePermission):
    """
    Grants access to Order Managers, Administrators, and Super Administrators
    to assign carriers, update shipment milestones, and oversee deliveries.
    """
    message = "Access denied. Requires Order Manager or Administrator privileges."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return bool(
            getattr(request.user, 'is_super_admin', False) or
            getattr(request.user, 'is_admin', lambda: False)() or
            getattr(request.user, 'is_order_manager', lambda: False)() or
            request.user.role in [
                User.RoleChoices.ADMIN,
                User.RoleChoices.SUPER_ADMIN,
                User.RoleChoices.ORDER_MANAGER
            ]
        )


class CanPrepareAndDispatch(permissions.BasePermission):
    """
    Grants access to Store Managers, Order Managers, and Administrators
    to inspect warehouse orders, pack packages, and mark READY_FOR_DISPATCH.
    """
    message = "Access denied. Requires Store Manager, Order Manager, or Administrator privileges."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return bool(
            getattr(request.user, 'is_super_admin', False) or
            getattr(request.user, 'is_admin', lambda: False)() or
            getattr(request.user, 'is_store_manager', lambda: False)() or
            getattr(request.user, 'is_order_manager', lambda: False)() or
            request.user.role in [
                User.RoleChoices.ADMIN,
                User.RoleChoices.SUPER_ADMIN,
                User.RoleChoices.STORE_MANAGER,
                User.RoleChoices.ORDER_MANAGER
            ]
        )


class CanVerifyHandover(permissions.BasePermission):
    """
    Grants permission to verify OTP and confirm physical delivery.
    Permitted for Order Managers, Admins, and authenticated delivery personnel.
    """
    message = "Access denied. Requires delivery authorization."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if (
            getattr(request.user, 'is_super_admin', False) or
            getattr(request.user, 'is_admin', lambda: False)() or
            getattr(request.user, 'is_order_manager', lambda: False)() or
            request.user.role in [
                User.RoleChoices.ADMIN,
                User.RoleChoices.SUPER_ADMIN,
                User.RoleChoices.ORDER_MANAGER
            ]
        ):
            return True
        # Check if user has a linked delivery profile
        return hasattr(request.user, 'delivery_profile') and request.user.delivery_profile.is_active
