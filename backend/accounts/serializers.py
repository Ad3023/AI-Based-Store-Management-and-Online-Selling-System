from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .models import User, CustomerProfile, AuditLog


class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerProfile
        fields = ['id', 'total_spent', 'order_count', 'preferred_categories', 'loyalty_points']
        read_only_fields = ['total_spent', 'order_count', 'loyalty_points']


class UserSerializer(serializers.ModelSerializer):
    profile = CustomerProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'is_staff', 'is_superuser', 'phone_number', 'address', 'city', 'avatar',
            'created_at', 'profile'
        ]
        # Prevent privilege escalation: customers cannot change their own role or flags
        read_only_fields = ['id', 'created_at', 'role', 'is_staff', 'is_superuser']

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
        # Check if client attempted to pass 'role' in initial_data to change protected role
        if hasattr(self, 'initial_data') and 'role' in self.initial_data:
            submitted_role = self.initial_data.get('role')
            current_user = request.user if request and request.user else getattr(self, 'instance', None)
            if current_user and submitted_role != current_user.role:
                if current_user.role == User.Role.ADMIN or current_user.is_superuser:
                    raise serializers.ValidationError({
                        'role': "The Main Administrator's role is protected and cannot be changed."
                    })
        return attrs


class AdminUserSerializer(serializers.ModelSerializer):
    profile = CustomerProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'is_active', 'is_staff', 'is_superuser', 'phone_number', 'address', 'city', 'avatar',
            'created_at', 'profile'
        ]
        read_only_fields = ['id', 'created_at', 'is_staff', 'is_superuser']

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
        if instance and new_role and new_role != instance.role:
            # 1. Main administrator role protection
            if instance.is_superuser or instance.username == 'addisuguche_admin':
                raise serializers.ValidationError({
                    'role': "The Main Administrator's role is protected and cannot be changed."
                })
            # 2. Prevent any administrator from changing their own role
            if request and request.user and request.user.id == instance.id and request.user.role == User.Role.ADMIN:
                raise serializers.ValidationError({
                    'role': "Administrators cannot change their own role."
                })
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
        return User.Role.CUSTOMER

    def create(self, validated_data):
        password = validated_data.pop('password')
        # Public self-registration is strictly restricted to Customer
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number', ''),
            role=User.Role.CUSTOMER
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
        user = None
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
