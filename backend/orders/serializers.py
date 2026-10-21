from rest_framework import serializers
from .models import Cart, CartItem, Order, OrderItem, PaymentEvidence, Receipt
from products.serializers import ProductSerializer


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = CartItem
        fields = ['id', 'product', 'product_id', 'quantity', 'subtotal', 'added_at']


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_items = serializers.IntegerField(read_only=True)

    class Meta:
        model = Cart
        fields = ['id', 'items', 'total_price', 'total_items', 'updated_at']


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'product_image', 'quantity', 'unit_price', 'total_price']

    def get_product_image(self, obj):
        if obj.product.image:
            return obj.product.image.url
        return None


class PaymentEvidenceSerializer(serializers.ModelSerializer):
    verified_by_name = serializers.CharField(source='verified_by.username', read_only=True)

    class Meta:
        model = PaymentEvidence
        fields = [
            'id', 'order', 'payment_method', 'transaction_reference',
            'evidence_image', 'verification_status', 'verified_by',
            'verified_by_name', 'verified_at', 'rejection_reason', 'submitted_at'
        ]
        read_only_fields = ['id', 'verification_status', 'verified_by', 'verified_at', 'submitted_at']


class ReceiptSerializer(serializers.ModelSerializer):
    verified_by_name = serializers.CharField(source='verified_by.username', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    total_amount = serializers.DecimalField(source='order.total_amount', max_digits=10, decimal_places=2, read_only=True)
    customer_name = serializers.CharField(source='order.shipping_name', read_only=True)

    class Meta:
        model = Receipt
        fields = [
            'id', 'order', 'order_number', 'receipt_number', 'total_amount',
            'customer_name', 'issued_at', 'verified_by', 'verified_by_name',
            'download_count'
        ]
        read_only_fields = ['id', 'receipt_number', 'issued_at']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payment_evidence = PaymentEvidenceSerializer(read_only=True)
    receipt = ReceiptSerializer(read_only=True)
    customer_name = serializers.CharField(source='customer.username', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer', 'customer_name', 'customer_email',
            'status', 'subtotal', 'tax', 'shipping_fee', 'total_amount',
            'payment_method', 'chapa_tx_ref',
            'shipping_name', 'shipping_phone', 'shipping_address', 'shipping_city',
            'notes', 'created_at', 'updated_at', 'items', 'payment_evidence', 'receipt'
        ]
        read_only_fields = ['id', 'order_number', 'customer', 'subtotal', 'tax', 'shipping_fee', 'total_amount', 'created_at', 'updated_at']
