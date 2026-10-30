from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .models import User, CustomerProfile, AuditLog, Permission, Role


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'code', 'name', 'module', 'description', 'created_at']


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_codes = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Role
        fields = [
            'id', 'code', 'name', 'description', 'is_system_role',
            'permissions', 'permission_codes', 'user_count',
            'created_by', 'created_by_username', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'is_system_role', 'created_at', 'updated_at']

    def get_permission_codes(self, obj):
        return list(obj.permissions.values_list('code', flat=True))

    def get_user_count(self, obj):
        return obj.users.count() + User.objects.filter(role=obj.code).count()


class RoleCreateUpdateSerializer(serializers.ModelSerializer):
    permission_codes = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = Role
        fields = ['id', 'code', 'name', 'description', 'permission_codes']

    def validate_code(self, value):
        normalized = value.strip().lower().replace(' ', '_')
        if not normalized:
            raise serializers.ValidationError("Role code cannot be empty.")
        if self.instance and self.instance.is_system_role and self.instance.code != normalized:
            raise serializers.ValidationError("System role code cannot be modified.")
        qs = Role.objects.filter(code=normalized)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"A role with code '{normalized}' already exists.")
        return normalized

    def create(self, validated_data):
        perm_codes = validated_data.pop('permission_codes', [])
        role = Role.objects.create(**validated_data)
        if perm_codes:
            perms = Permission.objects.filter(code__in=perm_codes)
            role.permissions.set(perms)
        return role

    def update(self, instance, validated_data):
        perm_codes = validated_data.pop('permission_codes', None)
        instance.name = validated_data.get('name', instance.name)
        instance.description = validated_data.get('description', instance.description)
        if not instance.is_system_role:
            instance.code = validated_data.get('code', instance.code)
        instance.save()

        if perm_codes is not None:
            perms = Permission.objects.filter(code__in=perm_codes)
            instance.permissions.set(perms)
        return instance


class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerProfile
        fields = ['id', 'total_spent', 'order_count', 'preferred_categories', 'loyalty_points']
        read_only_fields = ['total_spent', 'order_count', 'loyalty_points']


class UserSerializer(serializers.ModelSerializer):
    profile = CustomerProfileSerializer(read_only=True)
    custom_role = RoleSerializer(read_only=True)
    is_super_admin = serializers.BooleanField(read_only=True)
    is_sub_admin = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'custom_role', 'is_super_admin', 'is_sub_admin', 'is_staff', 'is_superuser',
            'phone_number', 'address', 'city', 'avatar',
            'permissions', 'created_at', 'profile'
        ]
        read_only_fields = ['id', 'created_at', 'role', 'custom_role', 'is_staff', 'is_superuser', 'permissions']

    def get_is_sub_admin(self, obj):
        return obj.is_sub_admin()

    def get_permissions(self, obj):
        return list(obj.get_all_permissions())

    def validate_email(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Email address cannot be empty.")
        normalized = str(value).strip().lower()
        qs = User.objects.filter(email__iexact=normalized)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("An account with this email address already exists. Please choose a different email.")
        return normalized

    def validate(self, attrs):
        request = self.context.get('request')
        # Prevent privilege escalation: users cannot change their own role or assign roles
        if hasattr(self, 'initial_data') and 'role' in self.initial_data:
            submitted_role = self.initial_data.get('role')
            current_user = request.user if request and request.user else getattr(self, 'instance', None)
            if current_user and submitted_role != current_user.role:
                if current_user.is_super_admin:
                    raise serializers.ValidationError({
                        'role': "The Super Administrator's role is protected and cannot be changed."
                    })
        return attrs


class AdminUserSerializer(serializers.ModelSerializer):
    profile = CustomerProfileSerializer(read_only=True)
    custom_role = RoleSerializer(read_only=True)
    custom_role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source='custom_role',
        write_only=True,
        required=False,
        allow_null=True
    )
    direct_permission_codes = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False
    )
    is_super_admin = serializers.BooleanField(read_only=True)
    is_sub_admin = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password', 'first_name', 'last_name',
            'role', 'custom_role', 'custom_role_id', 'direct_permission_codes',
            'is_active', 'is_staff', 'is_superuser', 'is_super_admin', 'is_sub_admin',
            'phone_number', 'address', 'city', 'avatar',
            'permissions', 'created_at', 'profile'
        ]
        read_only_fields = ['id', 'created_at', 'is_staff', 'is_superuser', 'permissions']

    def get_is_sub_admin(self, obj):
        return obj.is_sub_admin()

    def get_permissions(self, obj):
        return list(obj.get_all_permissions())

    def validate_email(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Email address cannot be empty.")
        normalized = str(value).strip().lower()
        qs = User.objects.filter(email__iexact=normalized)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("An account with this email address already exists. Please choose a different email.")
        return normalized

    def validate(self, attrs):
        request = self.context.get('request')
        instance = getattr(self, 'instance', None)
        new_role = attrs.get('role')
        actor = request.user if request else None

        # 1. Protection of Super Administrator accounts
        if instance and (instance.is_super_admin or instance.username == 'addisuguche_admin'):
            if new_role and new_role not in [User.RoleChoices.SUPER_ADMIN, User.RoleChoices.ADMIN]:
                raise serializers.ValidationError({
                    'role': "The Super Administrator's role is protected and cannot be downgraded."
                })
            if 'is_active' in attrs and not attrs['is_active']:
                raise serializers.ValidationError({
                    'is_active': "The Super Administrator account cannot be deactivated."
                })

        # 2. Prevent self-demotion or self-role change
        if instance and actor and actor.id == instance.id and new_role and new_role != instance.role:
            raise serializers.ValidationError({
                'role': "Administrators cannot change their own role."
            })

        # 3. Only Super Admin can promote to SUPER_ADMIN
        if new_role == User.RoleChoices.SUPER_ADMIN:
            if not actor or not actor.is_super_admin:
                raise serializers.ValidationError({
                    'role': "Only existing Super Administrators can promote users to Super Admin."
                })

        # 4. Non-Super-Admins (Admins and Sub-Admins) cannot edit Super Admin accounts
        if instance and instance.is_super_admin:
            if actor and not actor.is_super_admin:
                raise serializers.ValidationError({
                    'error': "You do not have permission to modify a Super Administrator account."
                })

        # 5. Sub-Admins cannot modify Admin or Super Admin accounts
        if instance and (instance.role == User.RoleChoices.ADMIN or instance.is_super_admin):
            if actor and actor.is_sub_admin():
                raise serializers.ValidationError({
                    'error': "Sub-Administrators cannot modify Administrator accounts."
                })

        return attrs

    def create(self, validated_data):
        direct_perm_codes = validated_data.pop('direct_permission_codes', None)
        password = validated_data.pop('password', None)
        user = super().create(validated_data)

        if password:
            user.set_password(password)

        if direct_perm_codes is not None:
            perms = Permission.objects.filter(code__in=direct_perm_codes)
            user.direct_permissions.set(perms)

        # Ensure staff flag is aligned with administrative roles
        if user.role in [
            User.RoleChoices.SUPER_ADMIN,
            User.RoleChoices.ADMIN,
            User.RoleChoices.SUB_ADMIN,
            User.RoleChoices.STORE_MANAGER,
            User.RoleChoices.ORDER_MANAGER
        ] or user.custom_role is not None:
            user.is_staff = True
        else:
            user.is_staff = False
        user.save()

        return user

    def update(self, instance, validated_data):
        direct_perm_codes = validated_data.pop('direct_permission_codes', None)
        user = super().update(instance, validated_data)

        if direct_perm_codes is not None:
            perms = Permission.objects.filter(code__in=direct_perm_codes)
            user.direct_permissions.set(perms)

        # Ensure staff flag is aligned with administrative roles
        if user.role in [
            User.RoleChoices.SUPER_ADMIN,
            User.RoleChoices.ADMIN,
            User.RoleChoices.SUB_ADMIN,
            User.RoleChoices.STORE_MANAGER,
            User.RoleChoices.ORDER_MANAGER
        ] or user.custom_role is not None:
            user.is_staff = True
        else:
            user.is_staff = False
        user.save(update_fields=['is_staff'])

        return user


class RoleAssignmentSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=User.RoleChoices.choices, required=False)
    custom_role_id = serializers.IntegerField(required=False, allow_null=True)
    direct_permission_codes = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )

    def validate(self, attrs):
        request = self.context.get('request')
        target_user = self.context.get('target_user')
        actor = request.user if request else None

        if target_user and target_user.is_super_admin and actor and not actor.is_super_admin:
            raise serializers.ValidationError("Only Super Administrators can modify Super Admin accounts.")

        role = attrs.get('role')
        if role == User.RoleChoices.SUPER_ADMIN and (not actor or not actor.is_super_admin):
            raise serializers.ValidationError("Only Super Administrators can grant the Super Admin role.")

        if actor and actor.is_sub_admin():
            raise serializers.ValidationError("Sub-Administrators cannot assign roles or permissions.")

        return attrs


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True, required=False)
    full_name = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'full_name', 'first_name', 'last_name', 'phone_number']
        extra_kwargs = {
            'username': {'required': False},
        }

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email address already exists. Please sign in instead.")
        return normalized

    def validate(self, data):
        pwd = data.get('password')
        pwd_conf = data.get('password_confirm')
        if pwd_conf and pwd != pwd_conf:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})

        # Auto-generate unique username if not provided
        if not data.get('username'):
            base_user = data['email'].split('@')[0]
            candidate = base_user
            counter = 1
            while User.objects.filter(username__iexact=candidate).exists():
                candidate = f"{base_user}{counter}"
                counter += 1
            data['username'] = candidate

        # Parse full_name if first_name not given
        full_name = data.pop('full_name', None)
        if full_name and not data.get('first_name'):
            parts = full_name.strip().split(' ', 1)
            data['first_name'] = parts[0]
            if len(parts) > 1:
                data['last_name'] = parts[1]

        data.pop('password_confirm', None)
        return data

    def validate_role(self, value):
        # Public self-registration is strictly restricted to Customer role
        return User.RoleChoices.CUSTOMER

    def create(self, validated_data):
        password = validated_data.pop('password')
        customer_role = Role.objects.filter(code='customer').first()
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number', ''),
            role=User.RoleChoices.CUSTOMER,
            custom_role=customer_role
        )
        Token.objects.create(user=user)
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("No registered account found with this email address.")
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=6)
    new_password_confirm = serializers.CharField(required=False)

    def validate(self, data):
        email = data.get('email', '').strip().lower()
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({'email': 'No registered account found with this email address.'})

        pwd = data.get('new_password')
        pwd_conf = data.get('new_password_confirm')
        if pwd_conf and pwd != pwd_conf:
            raise serializers.ValidationError({'new_password_confirm': 'Passwords do not match.'})

        data['user'] = user
        return data


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')

        # Allow logging in with either username or email
        if '@' in username:
            try:
                user_obj = User.objects.get(email__iexact=username)
                username = user_obj.username
            except User.DoesNotExist:
                pass

        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError("Invalid username/email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account has been deactivated.")

        data['user'] = user
        return data


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'username', 'action', 'details', 'ip_address', 'created_at']
