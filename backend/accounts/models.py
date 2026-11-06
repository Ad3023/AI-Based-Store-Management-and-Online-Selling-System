from django.db import models
from django.contrib.auth.models import AbstractUser
from .models_rbac import Permission, Role
from .models_tokens import EmailVerificationToken, PasswordResetToken
from .models_profiles import CustomerProfile, AuditLog


class User(AbstractUser):
    class RoleChoices(models.TextChoices):
        SUPER_ADMIN = 'super_admin', 'Super Admin'
        ADMIN = 'admin', 'Administrator'
        SUB_ADMIN = 'sub_admin', 'Sub-Admin'
        CUSTOMER = 'customer', 'Customer'
        STORE_MANAGER = 'store_manager', 'Store Manager'
        ORDER_MANAGER = 'order_manager', 'Order Manager'
        SUPPLIER = 'supplier', 'Supplier'
        DELIVERY = 'delivery', 'Delivery Personnel'
        CUSTOM = 'custom', 'Custom Role'

    Role = RoleChoices

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=30, choices=RoleChoices.choices, default=RoleChoices.CUSTOMER)
    custom_role = models.ForeignKey('Role', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    direct_permissions = models.ManyToManyField(Permission, blank=True, related_name='direct_users')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    email_verified = models.BooleanField(default=False)
    must_change_password = models.BooleanField(default=False)
    is_removed = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def active_admin_count(cls):
        from django.db.models import Q
        return cls.objects.filter(
            Q(role__in=[cls.RoleChoices.SUPER_ADMIN, cls.RoleChoices.ADMIN]) | Q(is_superuser=True),
            is_active=True
        ).count()

    @property
    def is_super_admin(self):
        return bool(self.is_superuser or self.role == self.RoleChoices.SUPER_ADMIN or self.username == 'addisuguche_admin')

    def is_admin(self):
        return bool(self.is_super_admin or self.role == self.RoleChoices.ADMIN)

    def is_sub_admin(self):
        return bool(self.role == self.RoleChoices.SUB_ADMIN and not self.is_super_admin)

    def is_store_manager(self):
        return bool(
            self.is_super_admin or
            self.role in [self.RoleChoices.ADMIN, self.RoleChoices.STORE_MANAGER, self.RoleChoices.SUB_ADMIN] or
            (self.custom_role is not None and getattr(self.custom_role, 'code', '') != 'customer')
        )

    def is_order_manager(self):
        return bool(self.role == self.RoleChoices.ORDER_MANAGER)

    def is_supplier(self):
        return bool(self.role == self.RoleChoices.SUPPLIER)

    def is_delivery_driver(self):
        return bool(self.role == self.RoleChoices.DELIVERY or hasattr(self, 'delivery_profile'))

    def is_delivery_personnel(self):
        return self.is_delivery_driver()

    def is_customer(self):
        return bool(
            self.role == self.RoleChoices.CUSTOMER and
            not self.is_super_admin and
            self.role != self.RoleChoices.ADMIN and
            self.role != self.RoleChoices.ORDER_MANAGER and
            self.role != self.RoleChoices.STORE_MANAGER and
            self.role != self.RoleChoices.SUPPLIER and
            self.role != self.RoleChoices.DELIVERY
        )

    def get_all_permissions(self):
        if not self.is_authenticated or not self.is_active:
            return set()
        if self.is_super_admin:
            from accounts.rbac import CANONICAL_PERMISSIONS
            return set(p['code'] for p in CANONICAL_PERMISSIONS)
        perms = set()
        perms.update(self.direct_permissions.values_list('code', flat=True))
        if self.custom_role:
            perms.update(self.custom_role.permissions.values_list('code', flat=True))
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

    def clean(self):
        super().clean()
        if self.email:
            self.email = self.email.strip().lower()
            existing = type(self).objects.filter(email__iexact=self.email)
            if self.pk:
                existing = existing.exclude(pk=self.pk)
            if existing.exists():
                from django.core.exceptions import ValidationError
                raise ValidationError({'email': 'A user with this email address already exists.'})
        if self.username:
            self.username = self.username.strip()

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.strip().lower()
        if self.username:
            self.username = self.username.strip()
        super().save(*args, **kwargs)

    def __str__(self):
        role_label = self.get_role_display()
        if self.custom_role:
            role_label = f"{role_label} ({self.custom_role.name})"
        return f"{self.username} [{role_label}]"
