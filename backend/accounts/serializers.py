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
            'role', 'phone_number', 'address', 'city', 'avatar',
            'created_at', 'profile'
        ]
        read_only_fields = ['id', 'created_at']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'phone_number']

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
        return value


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
