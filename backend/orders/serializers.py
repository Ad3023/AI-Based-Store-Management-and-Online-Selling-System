from rest_framework import serializers
from .models import (
    Cart, CartItem, Order, OrderItem, PaymentEvidence,
    Receipt, WarrantyClaim, OrderStatusHistory
)
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


class WarrantyClaimSerializer(serializers.ModelSerializer):
    customer_username = serializers.CharField(source='customer.username', read_only=True)
    product_name = serializers.CharField(source='order_item.product.name', read_only=True)
    product_image = serializers.SerializerMethodField()
    order_number = serializers.CharField(source='order_item.order.order_number', read_only=True)
    order_id = serializers.IntegerField(source='order_item.order.id', read_only=True)
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True)

    class Meta:
        model = WarrantyClaim
        fields = [
            'id', 'claim_number', 'order_item', 'order_id', 'customer', 'customer_username',
            'product_name', 'product_image', 'order_number', 'issue_description',
            'evidence_image', 'status', 'admin_notes', 'rejection_reason',
            'resolution_details', 'reviewed_by', 'reviewed_by_username',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'claim_number', 'customer', 'reviewed_by', 'created_at', 'updated_at']

    def get_product_image(self, obj):
        if obj.order_item.product.image:
            return obj.order_item.product.image.url
        return None


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image = serializers.SerializerMethodField()
    warranty_claims = WarrantyClaimSerializer(many=True, read_only=True)
    is_warranty_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'product_name', 'product_image', 'quantity',
            'unit_price', 'total_price', 'warranty_duration_days',
            'warranty_coverage', 'warranty_terms', 'warranty_start_date',
            'warranty_end_date', 'is_warranty_active', 'warranty_claims'
        ]

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
    subtotal = serializers.DecimalField(source='order.subtotal', max_digits=10, decimal_places=2, read_only=True)
    tax = serializers.DecimalField(source='order.tax', max_digits=10, decimal_places=2, read_only=True)
    shipping_fee = serializers.DecimalField(source='order.shipping_fee', max_digits=10, decimal_places=2, read_only=True)
    payment_method = serializers.CharField(source='order.payment_method', read_only=True)
    chapa_tx_ref = serializers.CharField(source='order.chapa_tx_ref', read_only=True)
    customer_name = serializers.CharField(source='order.shipping_name', read_only=True)
    customer_phone = serializers.CharField(source='order.shipping_phone', read_only=True)
    customer_email = serializers.CharField(source='order.customer.email', read_only=True)
    shipping_address = serializers.CharField(source='order.shipping_address', read_only=True)
    items = OrderItemSerializer(source='order.items', many=True, read_only=True)

    class Meta:
        model = Receipt
        fields = [
            'id', 'order', 'order_number', 'receipt_number', 'total_amount',
            'subtotal', 'tax', 'shipping_fee', 'payment_method', 'chapa_tx_ref',
            'customer_name', 'customer_phone', 'customer_email', 'shipping_address',
            'issued_at', 'verified_by', 'verified_by_name', 'download_count', 'items'
        ]
        read_only_fields = ['id', 'receipt_number', 'issued_at']


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_username = serializers.CharField(source='changed_by.username', read_only=True)
    changed_by_role = serializers.CharField(source='changed_by.role', read_only=True)
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderStatusHistory
        fields = [
            'id', 'order', 'changed_by', 'changed_by_username', 'changed_by_role', 'changed_by_name',
            'status_type', 'previous_status', 'new_status', 'comment', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_changed_by_name(self, obj):
        if not obj.changed_by:
            return 'System'
        return obj.changed_by.get_full_name() or obj.changed_by.username


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payment_evidence = PaymentEvidenceSerializer(read_only=True)
    receipt = ReceiptSerializer(read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.username', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    fulfillment_status_display = serializers.CharField(source='get_fulfillment_status_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer', 'customer_name', 'customer_email',
            'status', 'status_display',
            'payment_status', 'payment_status_display',
            'fulfillment_status', 'fulfillment_status_display',
            'currency', 'subtotal', 'tax', 'shipping_fee', 'total_amount',
            'payment_method', 'chapa_tx_ref',
            'verified_amount', 'payment_initiated_at', 'payment_verified_at',
            'last_verification_result', 'verification_mismatch_message',
            'shipping_name', 'shipping_phone', 'shipping_address', 'shipping_city',
            'notes', 'created_at', 'updated_at', 'items', 'payment_evidence', 'receipt',
            'status_history'
        ]
        read_only_fields = [
            'id', 'order_number', 'customer', 'subtotal', 'tax', 'shipping_fee',
            'total_amount', 'created_at', 'updated_at', 'verified_amount',
            'payment_verified_at', 'last_verification_result', 'verification_mismatch_message'
        ]
