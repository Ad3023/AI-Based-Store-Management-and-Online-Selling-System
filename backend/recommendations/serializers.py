from rest_framework import serializers
from .models import CustomerSegment, CustomerActivity
from products.serializers import ProductSerializer


class CustomerSegmentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = CustomerSegment
        fields = [
            'id', 'user', 'username', 'email', 'segment_name', 'cluster_id',
            'total_spent', 'order_count', 'avg_order_value', 'last_order_days',
            'suggested_action', 'updated_at'
        ]


class CustomerActivitySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = CustomerActivity
        fields = ['id', 'user', 'session_key', 'product', 'product_name', 'activity_type', 'created_at']
