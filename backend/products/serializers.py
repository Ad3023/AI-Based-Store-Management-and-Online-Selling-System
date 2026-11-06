from rest_framework import serializers
from .models import (
    Category, Product, ProductReview, StockMovement, Promotion,
    WarrantyPolicy, CustomerFeedback, Supplier, SupplierNotificationLog, PurchaseRequest, StockAlertHistory,
    SupplierPayment, PurchaseOrderItem, SupplierInvoice
)


class SupplierSerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source='products.count', read_only=True)
    company_name = serializers.CharField(source='name', required=False)
    phone_number = serializers.CharField(source='phone', required=False)
    business_address = serializers.CharField(source='address', required=False)
    supplied_categories_details = serializers.SerializerMethodField()
    total_purchases_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    outstanding_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    supplied_products = serializers.SerializerMethodField()

    user_username = serializers.CharField(source='user.username', read_only=True, allow_null=True)
    user_email = serializers.CharField(source='user.email', read_only=True, allow_null=True)
    user_is_active = serializers.BooleanField(source='user.is_active', read_only=True, allow_null=True)
    must_change_password = serializers.BooleanField(source='user.must_change_password', read_only=True, allow_null=True)
    user_last_login = serializers.DateTimeField(source='user.last_login', read_only=True, allow_null=True)
    has_account = serializers.SerializerMethodField()

    def get_has_account(self, obj):
        return obj.user is not None

    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'company_name', 'contact_person', 'email', 'phone', 'phone_number',
            'address', 'business_address', 'bank_name', 'bank_account_name', 'bank_account_number',
            'notes', 'status', 'supplied_categories',
            'supplied_categories_details', 'is_active', 'product_count',
            'total_purchases_amount', 'total_paid_amount', 'outstanding_balance',
            'supplied_products', 'user', 'user_username', 'user_email', 'user_is_active',
            'must_change_password', 'user_last_login', 'has_account', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'total_purchases_amount', 'total_paid_amount', 'outstanding_balance', 'created_at', 'updated_at']

    def get_supplied_categories_details(self, obj):
        return [{'id': c.id, 'name': c.name, 'slug': c.slug} for c in obj.supplied_categories.all()]

    def get_supplied_products(self, obj):
        prods = obj.products.all()[:20]
        return [
            {
                'id': p.id,
                'name': p.name,
                'sku': p.sku,
                'stock': p.stock,
                'price': str(p.price),
                'cost_price': str(p.cost_price),
                'image': p.image.url if p.image else None
            }
            for p in prods
        ]

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'company_name' in data and not data.get('name'):
            data['name'] = data['company_name']
        if 'phone_number' in data and not data.get('phone'):
            data['phone'] = data['phone_number']
        if 'business_address' in data and not data.get('address'):
            data['address'] = data['business_address']
        if 'supplied_categories' in data and isinstance(data['supplied_categories'], str):
            val = data['supplied_categories']
            from products.models import Category
            cat_names = [c.strip() for c in val.split(',') if c.strip()]
            cat_ids = list(Category.objects.filter(name__in=cat_names).values_list('id', flat=True))
            data['supplied_categories'] = cat_ids
        return super().to_internal_value(data)

    def validate_email(self, value):
        if not value or not str(value).strip():
            return ''
        from accounts.validators import validate_email_address
        return validate_email_address(value, required=False)

    def validate_phone(self, value):
        if not value or not str(value).strip():
            return ''
        from accounts.validators import validate_phone_number_format
        return validate_phone_number_format(value, required=False)

    def validate_phone_number(self, value):
        if not value or not str(value).strip():
            return ''
        from accounts.validators import validate_phone_number_format
        return validate_phone_number_format(value, required=False)


class WarrantyPolicySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source='products.count', read_only=True)
    category_count = serializers.IntegerField(source='categories.count', read_only=True)

    class Meta:
        model = WarrantyPolicy
        fields = [
            'id', 'name', 'duration_days', 'coverage_summary',
            'terms_and_conditions', 'claim_instructions', 'is_default',
            'product_count', 'category_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source='products.count', read_only=True)
    warranty_name = serializers.CharField(source='warranty_policy.name', read_only=True)

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'slug', 'description', 'image', 'is_active',
            'warranty_policy', 'warranty_name', 'product_count', 'created_at'
        ]
        read_only_fields = ['id', 'slug', 'created_at']


class PromotionSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='title', required=False)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    is_currently_active = serializers.BooleanField(read_only=True)
    product_count = serializers.IntegerField(source='products.count', read_only=True)
    category_count = serializers.IntegerField(source='categories.count', read_only=True)
    target_type = serializers.SerializerMethodField()
    target_summary = serializers.SerializerMethodField()

    class Meta:
        model = Promotion
        fields = [
            'id', 'title', 'name', 'description', 'discount_type', 'discount_value',
            'start_date', 'end_date', 'is_active', 'is_currently_active',
            'apply_to_all', 'products', 'categories', 'target_type', 'target_summary',
            'banner_announcement', 'created_by', 'created_by_username',
            'product_count', 'category_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_target_type(self, obj):
        if obj.apply_to_all:
            return 'all'
        if obj.products.exists():
            return 'products'
        if obj.categories.exists():
            return 'category'
        return 'all'

    def get_target_summary(self, obj):
        if obj.apply_to_all:
            return 'Store-Wide (All Products)'
        if obj.products.exists():
            cnt = obj.products.count()
            return f"{cnt} Selected Product{'s' if cnt != 1 else ''}"
        if obj.categories.exists():
            cnt = obj.categories.count()
            cat_names = ", ".join(obj.categories.values_list('name', flat=True)[:2])
            return f"Category: {cat_names}{'...' if cnt > 2 else ''}"
        return 'Unassigned'

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'name' in data and not data.get('title'):
            data['title'] = data['name']
        return super().to_internal_value(data)

    def validate(self, attrs):
        title = attrs.get('title')
        if not title and not self.instance:
            raise serializers.ValidationError({'title': 'Promotion title is required.'})

        discount_type = attrs.get('discount_type', getattr(self.instance, 'discount_type', None))
        discount_value = attrs.get('discount_value', getattr(self.instance, 'discount_value', None))

        if discount_value is not None:
            from decimal import Decimal
            try:
                val = Decimal(str(discount_value))
            except Exception:
                raise serializers.ValidationError({'discount_value': 'Invalid numerical discount value.'})

            if val <= Decimal('0.00'):
                raise serializers.ValidationError({'discount_value': 'Discount value must be greater than zero.'})

            if discount_type == Promotion.DiscountType.PERCENTAGE:
                if val > Decimal('100.00'):
                    raise serializers.ValidationError({'discount_value': 'Percentage discount cannot exceed 100%.'})
                if val < Decimal('0.01'):
                    raise serializers.ValidationError({'discount_value': 'Percentage discount must be at least 0.01%.'})

        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start_date and end_date and start_date >= end_date:
            raise serializers.ValidationError({'end_date': 'Promotion expiration date must be after start date.'})

        # Validate targeting options: Specific Products, Selected Category, or Store-Wide (when explicitly selected)
        apply_to_all = attrs.get('apply_to_all', getattr(self.instance, 'apply_to_all', False) if self.instance else False)
        products = attrs.get('products', None)
        categories = attrs.get('categories', None)

        if not self.instance or ('apply_to_all' in attrs or 'products' in attrs or 'categories' in attrs):
            has_products = bool(products) if products is not None else (self.instance and self.instance.products.exists())
            has_categories = bool(categories) if categories is not None else (self.instance and self.instance.categories.exists())

            if not apply_to_all and not has_products and not has_categories:
                raise serializers.ValidationError({
                    'targeting': 'Please select targeting scope: specific products, a category, or explicitly choose store-wide.'
                })

        return attrs


class ProductReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    response_by_username = serializers.CharField(source='response_by.username', read_only=True)

    class Meta:
        model = ProductReview
        fields = [
            'id', 'product', 'user', 'username', 'rating', 'comment',
            'is_approved', 'manager_response', 'response_by', 'response_by_username',
            'responded_at', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'response_by', 'responded_at', 'created_at']


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_email = serializers.CharField(source='supplier.email', read_only=True, allow_null=True)
    supplier_phone = serializers.CharField(source='supplier.phone', read_only=True, allow_null=True)
    min_stock_level = serializers.IntegerField(source='low_stock_threshold', required=False)
    suggested_reorder_quantity = serializers.IntegerField(source='reorder_quantity', required=False)
    low_stock_alert_active = serializers.BooleanField(read_only=True)
    is_out_of_stock = serializers.BooleanField(read_only=True)
    supplier_email_status = serializers.CharField(read_only=True)
    reviews = ProductReviewSerializer(many=True, read_only=True)
    is_in_stock = serializers.BooleanField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    reserved_quantity = serializers.SerializerMethodField()
    available_quantity = serializers.SerializerMethodField()
    incoming_quantity = serializers.SerializerMethodField()
    current_price = serializers.SerializerMethodField()
    has_promotion = serializers.SerializerMethodField()
    discount_label = serializers.SerializerMethodField()
    compare_at_price = serializers.SerializerMethodField()
    promotion_title = serializers.SerializerMethodField()
    warranty_info = serializers.SerializerMethodField()
    latest_notification = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'category', 'category_name', 'supplier', 'supplier_name', 'supplier_email', 'supplier_phone',
            'warranty_policy', 'name', 'slug', 'sku',
            'description', 'price', 'current_price', 'has_promotion', 'discount_label',
            'promotion_title', 'compare_at_price', 'cost_price',
            'stock', 'reserved_quantity', 'available_quantity', 'incoming_quantity',
            'low_stock_threshold', 'min_stock_level', 'reorder_quantity', 'suggested_reorder_quantity',
            'low_stock_notified', 'out_of_stock_notified', 'last_low_stock_notification', 'latest_notification',
            'is_in_stock', 'is_low_stock', 'is_out_of_stock', 'low_stock_alert_active', 'supplier_email_status',
            'image', 'rating_average', 'rating_count', 'is_featured',
            'is_active', 'warranty_info', 'created_at', 'updated_at', 'reviews'
        ]
        read_only_fields = [
            'id', 'slug', 'sku', 'rating_average', 'rating_count',
            'low_stock_notified', 'out_of_stock_notified', 'last_low_stock_notification',
            'is_in_stock', 'is_low_stock', 'is_out_of_stock', 'low_stock_alert_active', 'supplier_email_status',
            'reserved_quantity', 'available_quantity', 'incoming_quantity',
            'created_at', 'updated_at'
        ]

    def get_reserved_quantity(self, obj):
        try:
            from orders.models import Order, OrderItem
            from django.db.models import Sum
            val = OrderItem.objects.filter(
                product=obj,
                order__status__in=[
                    Order.Status.PENDING_PAYMENT,
                    Order.Status.PAYMENT_SUBMITTED,
                    Order.Status.PROCESSING
                ]
            ).aggregate(total=Sum('quantity'))['total']
            return int(val or 0)
        except Exception:
            return 0

    def get_available_quantity(self, obj):
        reserved = self.get_reserved_quantity(obj)
        return max(0, obj.stock - reserved)

    def get_incoming_quantity(self, obj):
        try:
            from products.models import PurchaseOrderItem, PurchaseRequest
            active_statuses = [
                PurchaseRequest.Status.APPROVED,
                PurchaseRequest.Status.SENT_TO_SUPPLIER,
                PurchaseRequest.Status.AWAITING_SUPPLIER,
                PurchaseRequest.Status.ACCEPTED,
                PurchaseRequest.Status.PARTIALLY_ACCEPTED,
                PurchaseRequest.Status.PREPARING_ORDER,
                PurchaseRequest.Status.READY_FOR_DELIVERY,
                PurchaseRequest.Status.SHIPPED,
            ]
            items = PurchaseOrderItem.objects.filter(
                product=obj,
                purchase_request__status__in=active_statuses
            )
            incoming = 0
            for item in items:
                target_qty = item.confirmed_quantity if item.confirmed_quantity is not None else item.requested_quantity
                remaining = max(0, target_qty - (item.received_quantity or 0))
                incoming += remaining
            return incoming
        except Exception:
            return 0

    def get_latest_notification(self, obj):
        log = obj.supplier_notifications.first()
        if not log:
            return None
        return {
            'id': log.id,
            'status': log.status,
            'status_display': log.get_status_display(),
            'trigger_type': log.trigger_type,
            'trigger_type_display': log.get_trigger_type_display(),
            'supplier_name': log.supplier_name,
            'supplier_email': log.supplier_email,
            'error_message': log.error_message,
            'created_at': log.created_at.isoformat()
        }

    def get_current_price(self, obj):
        return str(obj.current_price)

    def get_has_promotion(self, obj):
        return obj.has_active_promotion

    def get_compare_at_price(self, obj):
        # Authoritative discount rule: only present when an active admin promotion is in effect
        if obj.has_active_promotion and obj.current_price < obj.price:
            return str(obj.price)
        return None

    def get_discount_label(self, obj):
        promo = obj.get_current_promotion()
        if not promo:
            return None
        if promo.discount_type == Promotion.DiscountType.PERCENTAGE:
            return f"{int(promo.discount_value)}% OFF"
        return f"ETB {promo.discount_value} OFF"

    def get_promotion_title(self, obj):
        promo = obj.get_current_promotion()
        return promo.title if promo else None

    def get_warranty_info(self, obj):
        policy = obj.resolved_warranty
        if not policy:
            return {
                'duration_days': 7,
                'coverage_summary': 'Standard 7-Day Guarantee',
                'terms_and_conditions': 'Valid from delivery date. Excludes physical/water damage.',
                'claim_instructions': 'Submit a claim from your order details page.'
            }
        return {
            'id': policy.id,
            'name': policy.name,
            'duration_days': policy.duration_days,
            'coverage_summary': policy.coverage_summary,
            'terms_and_conditions': policy.terms_and_conditions,
            'claim_instructions': policy.claim_instructions
        }


class CustomerFeedbackSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    responded_by_username = serializers.CharField(source='responded_by.username', read_only=True)

    class Meta:
        model = CustomerFeedback
        fields = [
            'id', 'user', 'username', 'user_email', 'subject', 'category',
            'message', 'status', 'admin_response', 'responded_by',
            'responded_by_username', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'responded_by', 'created_at', 'updated_at']


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    movement_type_display = serializers.CharField(source='get_movement_type_display', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'product_name', 'product_sku', 'quantity',
            'movement_type', 'movement_type_display', 'reference', 'created_by', 'created_by_username',
            'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']


class SupplierNotificationLogSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    trigger_type_display = serializers.CharField(source='get_trigger_type_display', read_only=True)
    sent_by_username = serializers.CharField(source='sent_by.username', read_only=True, allow_null=True)

    class Meta:
        model = SupplierNotificationLog
        fields = [
            'id', 'product', 'product_name', 'product_image',
            'supplier', 'supplier_name', 'supplier_email',
            'current_stock', 'min_stock_level', 'reorder_quantity',
            'status', 'status_display', 'trigger_type', 'trigger_type_display',
            'subject', 'error_message', 'sent_by', 'sent_by_username',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_product_image(self, obj):
        if obj.product and obj.product.image:
            return obj.product.image.url
        return None


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_image = serializers.SerializerMethodField()
    outstanding_quantity = serializers.IntegerField(read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = [
            'id', 'purchase_order', 'product', 'product_name', 'product_sku', 'product_image',
            'quantity', 'confirmed_quantity', 'unit_price', 'total_cost', 'received_quantity', 'damaged_quantity',
            'outstanding_quantity', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'total_cost', 'outstanding_quantity', 'created_at']

    def get_product_image(self, obj):
        if obj.product and obj.product.image:
            return obj.product.image.url
        return None


class PurchaseRequestSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True, allow_null=True)
    product_image = serializers.SerializerMethodField()
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, allow_null=True)
    supplier_email = serializers.CharField(source='supplier.email', read_only=True, allow_null=True)
    supplier_phone = serializers.CharField(source='supplier.phone', read_only=True, allow_null=True)
    supplier_contact = serializers.CharField(source='supplier.contact_person', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    requested_by_username = serializers.CharField(source='requested_by.username', read_only=True, allow_null=True)
    approved_by_username = serializers.CharField(source='approved_by.username', read_only=True, allow_null=True)
    outstanding_quantity = serializers.IntegerField(read_only=True)
    total_cost = serializers.DecimalField(max_digits=12, decimal_places=2, source='total_estimated_cost', read_only=True)
    invoices_count = serializers.IntegerField(source='invoices.count', read_only=True)

    class Meta:
        model = PurchaseRequest
        fields = [
            'id', 'request_number', 'product', 'product_name', 'product_image',
            'supplier', 'supplier_name', 'supplier_email', 'supplier_phone', 'supplier_contact',
            'quantity', 'received_quantity', 'damaged_quantity', 'outstanding_quantity',
            'agreed_price', 'estimated_unit_cost', 'total_estimated_cost', 'total_cost',
            'expected_supply_date', 'status', 'status_display',
            'requested_by', 'requested_by_username',
            'approved_by', 'approved_by_username', 'approval_date',
            'admin_feedback', 'supplier_confirmed_at', 'supplier_confirmation_notes',
            'supplier_response', 'supplier_rejection_reason', 'supplier_suggested_delivery_date',
            'supplier_shipping_carrier', 'supplier_tracking_number', 'supplier_dispatched_at',
            'notes', 'notification_log', 'items', 'invoices_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'request_number', 'total_estimated_cost', 'outstanding_quantity',
            'requested_by', 'approved_by', 'approval_date', 'created_at', 'updated_at'
        ]

    def get_product_image(self, obj):
        if obj.product and obj.product.image:
            return obj.product.image.url
        return None


class SupplierInvoiceSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, allow_null=True)
    supplier_email = serializers.CharField(source='supplier.email', read_only=True, allow_null=True)
    supplier_bank_name = serializers.CharField(source='supplier.bank_name', read_only=True, default='')
    supplier_bank_account_name = serializers.CharField(source='supplier.bank_account_name', read_only=True, default='')
    supplier_bank_account_number = serializers.CharField(source='supplier.bank_account_number', read_only=True, default='')
    purchase_order_number = serializers.CharField(source='purchase_order.request_number', read_only=True, allow_null=True)
    product_name = serializers.CharField(source='purchase_order.product.name', read_only=True, allow_null=True)
    submitted_by_username = serializers.CharField(source='submitted_by.username', read_only=True, allow_null=True)
    verified_by_store_username = serializers.CharField(source='verified_by_store.username', read_only=True, allow_null=True)
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True, allow_null=True)
    approved_by_admin_username = serializers.CharField(source='approved_by_admin.username', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    outstanding_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = SupplierInvoice
        fields = [
            'id', 'invoice_number', 'supplier', 'supplier_name', 'supplier_email',
            'supplier_bank_name', 'supplier_bank_account_name', 'supplier_bank_account_number',
            'purchase_order', 'purchase_order_number', 'product_name',
            'ordered_quantity', 'delivered_quantity', 'accepted_quantity', 'invoiced_quantity',
            'unit_price', 'subtotal', 'tax_amount', 'total_amount', 'paid_amount', 'outstanding_amount',
            'status', 'status_display', 'notes', 'attachment', 'attachment_url', 'rejection_reason',
            'submitted_by', 'submitted_by_username',
            'verified_by_store', 'verified_by_store_username', 'store_verified_at', 'store_verification_notes',
            'reviewed_by', 'reviewed_by_username', 'reviewed_at', 'review_notes',
            'approved_by_admin', 'approved_by_admin_username', 'admin_approved_at', 'admin_review_notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'paid_amount', 'outstanding_amount', 'submitted_by',
            'verified_by_store', 'store_verified_at',
            'reviewed_by', 'reviewed_at',
            'approved_by_admin', 'admin_approved_at',
            'created_at', 'updated_at'
        ]

    def get_attachment_url(self, obj):
        if obj.attachment:
            return obj.attachment.url
        return None


class SupplierPaymentSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, allow_null=True)
    supplier_bank_name = serializers.CharField(source='supplier.bank_name', read_only=True, default='')
    supplier_bank_account_number = serializers.CharField(source='supplier.bank_account_number', read_only=True, default='')
    authorized_by_username = serializers.CharField(source='authorized_by.username', read_only=True, allow_null=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True, allow_null=True)
    receipt_url = serializers.SerializerMethodField()

    class Meta:
        model = SupplierPayment
        fields = [
            'id', 'supplier', 'supplier_name', 'supplier_bank_name', 'supplier_bank_account_number',
            'purchase_order', 'invoice', 'invoice_number',
            'supplier_invoice', 'purchase_order_reference',
            'total_purchase_amount', 'amount_paid', 'outstanding_balance',
            'payment_method', 'payment_method_display',
            'transaction_reference', 'payment_date',
            'payment_status', 'payment_status_display',
            'authorized_by', 'authorized_by_username',
            'receipt', 'receipt_url', 'bank_name', 'bank_account_number',
            'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'authorized_by', 'created_at', 'updated_at']

    def get_receipt_url(self, obj):
        if obj.receipt:
            return obj.receipt.url
        return None



class LowStockProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default='')
    supplier_email = serializers.CharField(source='supplier.email', read_only=True, default='')
    supplier_phone = serializers.CharField(source='supplier.phone', read_only=True, default='')
    supplier_contact = serializers.CharField(source='supplier.contact_person', read_only=True, default='')
    min_stock_level = serializers.IntegerField(source='low_stock_threshold', read_only=True)
    suggested_reorder_quantity = serializers.IntegerField(source='reorder_quantity', read_only=True)
    is_out_of_stock = serializers.BooleanField(read_only=True)
    low_stock_alert_active = serializers.BooleanField(read_only=True)
    supplier_email_status = serializers.CharField(read_only=True)
    has_supplier = serializers.SerializerMethodField()
    has_supplier_email = serializers.SerializerMethodField()
    notification_status = serializers.SerializerMethodField()
    last_notification_date = serializers.DateTimeField(source='last_low_stock_notification', read_only=True)
    latest_log = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'sku', 'image',
            'category', 'category_name',
            'supplier', 'supplier_name', 'supplier_email', 'supplier_phone', 'supplier_contact',
            'has_supplier', 'has_supplier_email',
            'stock', 'low_stock_threshold', 'min_stock_level', 'reorder_quantity', 'suggested_reorder_quantity',
            'price', 'cost_price', 'is_out_of_stock', 'low_stock_alert_active', 'supplier_email_status',
            'low_stock_notified', 'out_of_stock_notified', 'last_notification_date', 'notification_status', 'latest_log'
        ]

    def get_has_supplier(self, obj):
        return bool(obj.supplier_id)

    def get_has_supplier_email(self, obj):
        return bool(obj.supplier and obj.supplier.email and '@' in obj.supplier.email)

    def get_notification_status(self, obj):
        latest = obj.supplier_notifications.first()
        if not latest:
            return 'NEVER_NOTIFIED'
        return latest.status

    def get_latest_log(self, obj):
        log = obj.supplier_notifications.first()
        if not log:
            return None
        return {
            'id': log.id,
            'status': log.status,
            'trigger_type': log.trigger_type,
            'recipient': log.supplier_email,
            'error_message': log.error_message,
            'created_at': log.created_at.isoformat()
        }


class StockAlertHistorySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default='')
    triggered_by_username = serializers.CharField(source='triggered_by.username', read_only=True, default='System')
    alert_type_display = serializers.CharField(source='get_alert_type_display', read_only=True)

    class Meta:
        model = StockAlertHistory
        fields = [
            'id', 'product', 'product_name', 'product_sku', 'alert_type', 'alert_type_display',
            'current_stock', 'min_stock_level', 'reorder_quantity',
            'supplier', 'supplier_name', 'supplier_email',
            'email_status', 'email_sent_at', 'details',
            'triggered_by', 'triggered_by_username', 'created_at'
        ]
        read_only_fields = fields
