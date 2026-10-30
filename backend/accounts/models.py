from django.db import models
from django.contrib.auth.models import AbstractUser


class Permission(models.Model):
    code = models.CharField(max_length=60, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    module = models.CharField(max_length=60, db_index=True)
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['module', 'code']

    def __str__(self):
        return f"{self.name} ({self.code})"


class Role(models.Model):
    code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    is_system_role = models.BooleanField(default=False)
    permissions = models.ManyToManyField(Permission, blank=True, related_name='roles')
    created_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_roles')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class User(AbstractUser):
    class RoleChoices(models.TextChoices):
        SUPER_ADMIN = 'super_admin', 'Super Admin'
        ADMIN = 'admin', 'Administrator'
        SUB_ADMIN = 'sub_admin', 'Sub-Admin'
        CUSTOMER = 'customer', 'Customer'
        STORE_MANAGER = 'store_manager', 'Store Manager'
        ORDER_MANAGER = 'order_manager', 'Order Manager'
        CUSTOM = 'custom', 'Custom Role'

    # Alias for backward-compatibility with code accessing User.Role
    Role = RoleChoices

    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=30,
        choices=RoleChoices.choices,
        default=RoleChoices.CUSTOMER
    )
    custom_role = models.ForeignKey(
        'Role',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    direct_permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name='direct_users'
    )
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_super_admin(self):
        """Super Admin has full access to system configuration, users, roles, permissions, security, and audit logs."""
        return bool(
            self.is_superuser or
            self.role == self.RoleChoices.SUPER_ADMIN or
            self.username == 'addisuguche_admin'
        )

    def is_admin(self):
        return bool(self.is_super_admin or self.role == self.RoleChoices.ADMIN)

    def is_sub_admin(self):
        return bool(self.role == self.RoleChoices.SUB_ADMIN and not self.is_super_admin)

    def is_store_manager(self):
        return bool(
            self.is_super_admin or
            self.role in [self.RoleChoices.ADMIN, self.RoleChoices.STORE_MANAGER, self.RoleChoices.SUB_ADMIN] or
            self.custom_role is not None
        )

    def is_order_manager(self):
        return bool(self.role == self.RoleChoices.ORDER_MANAGER)

    def is_customer(self):
        return bool(
            self.role == self.RoleChoices.CUSTOMER and
            not self.is_super_admin and
            self.role != self.RoleChoices.ADMIN and
            self.role != self.RoleChoices.ORDER_MANAGER
        )

    def get_all_permissions(self):
        """Returns set of all permission code strings granted to this user."""
        if not self.is_authenticated or not self.is_active:
            return set()

        # Super Admin has all permissions unconditionally
        if self.is_super_admin:
            from accounts.rbac import CANONICAL_PERMISSIONS
            return set(p['code'] for p in CANONICAL_PERMISSIONS)

        perms = set()

        # Direct permissions assigned to user
        perms.update(self.direct_permissions.values_list('code', flat=True))

        # Permissions from assigned custom role
        if self.custom_role:
            perms.update(self.custom_role.permissions.values_list('code', flat=True))

        # Permissions from system role (DB first, fallback to canonical system definitions)
        system_role = Role.objects.filter(code=self.role).first()
        if system_role and system_role.permissions.exists():
            perms.update(system_role.permissions.values_list('code', flat=True))
        else:
            from accounts.rbac import SYSTEM_ROLES
            builtin = SYSTEM_ROLES.get(self.role)
            if builtin and isinstance(builtin.get('permissions'), list):
                perms.update(builtin['permissions'])

        return perms

    def has_permission(self, permission_code):
        """Check whether user has a specific permission code."""
        if not self.is_authenticated or not self.is_active:
            return False
        if self.is_super_admin:
            return True
        return permission_code in self.get_all_permissions()

    def has_perm(self, perm, obj=None):
        if not self.is_active:
            return False
        if self.is_super_admin:
            return True
        if '.' in perm and perm in self.get_all_permissions():
            return True
        return super().has_perm(perm, obj)

    def __str__(self):
        role_label = self.get_role_display()
        if self.custom_role:
            role_label = f"{role_label} ({self.custom_role.name})"
        return f"{self.username} [{role_label}]"


class CustomerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    total_spent = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    order_count = models.PositiveIntegerField(default=0)
    preferred_categories = models.JSONField(default=list, blank=True)
    loyalty_points = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile of {self.user.username}"


class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=100)
    details = models.TextField(blank=True, null=True)
    ip_address = models.CharField(max_length=45, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {self.action} by {self.user}"
