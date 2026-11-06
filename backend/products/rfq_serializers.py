from decimal import Decimal
from rest_framework import serializers
from .models import RequestForQuotation, RFQItem, SupplierQuotation, SupplierQuotationItem


class RFQItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = RFQItem
        fields = ['id', 'rfq', 'product', 'product_name', 'product_sku', 'requested_quantity', 'target_price', 'notes']
        read_only_fields = ['id', 'rfq']


class SupplierQuotationItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = SupplierQuotationItem
        fields = [
            'id', 'quotation', 'rfq_item', 'product', 'product_name', 'product_sku',
            'requested_quantity', 'offered_unit_price', 'available_quantity', 'line_total', 'notes'
        ]
        read_only_fields = ['id', 'quotation', 'line_total']


class SupplierQuotationSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    rfq_number = serializers.CharField(source='rfq.rfq_number', read_only=True)
    submitted_by_username = serializers.CharField(source='submitted_by.username', read_only=True)
    selected_by_username = serializers.CharField(source='selected_by.username', read_only=True)
    purchase_order_number = serializers.CharField(source='purchase_order.request_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = SupplierQuotationItemSerializer(many=True, read_only=True)

    class Meta:
        model = SupplierQuotation
        fields = [
            'id', 'quotation_number', 'rfq', 'rfq_number', 'supplier', 'supplier_name',
            'submitted_by', 'submitted_by_username', 'status', 'status_display',
            'total_amount', 'delivery_lead_time', 'estimated_delivery_date', 'payment_terms',
            'valid_until', 'notes', 'selection_notes', 'selected_by', 'selected_by_username',
            'selected_at', 'purchase_order', 'purchase_order_number', 'created_at', 'updated_at', 'items'
        ]
        read_only_fields = [
            'id', 'quotation_number', 'total_amount', 'submitted_by', 'selected_by',
            'selected_at', 'purchase_order', 'created_at', 'updated_at'
        ]


class RequestForQuotationSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_email = serializers.CharField(source='supplier.email', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = RFQItemSerializer(many=True, read_only=True)
    quotations = SupplierQuotationSerializer(many=True, read_only=True)
    quotations_count = serializers.SerializerMethodField()

    class Meta:
        model = RequestForQuotation
        fields = [
            'id', 'rfq_number', 'supplier', 'supplier_name', 'supplier_email',
            'created_by', 'created_by_username', 'status', 'status_display',
            'required_delivery_date', 'notes', 'decline_reason',
            'sent_at', 'viewed_at', 'responded_at', 'created_at', 'updated_at',
            'items', 'quotations', 'quotations_count'
        ]
        read_only_fields = ['id', 'rfq_number', 'created_by', 'sent_at', 'viewed_at', 'responded_at', 'created_at', 'updated_at']

    def get_quotations_count(self, obj):
        return obj.quotations.count()

