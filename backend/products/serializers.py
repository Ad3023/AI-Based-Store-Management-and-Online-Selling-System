from rest_framework import serializers
from .models import Category, Product, ProductReview, StockMovement, Promotion, WarrantyPolicy, CustomerFeedback


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
    reviews = ProductReviewSerializer(many=True, read_only=True)
    is_in_stock = serializers.BooleanField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    current_price = serializers.SerializerMethodField()
    has_promotion = serializers.SerializerMethodField()
    discount_label = serializers.SerializerMethodField()
    compare_at_price = serializers.SerializerMethodField()
    promotion_title = serializers.SerializerMethodField()
    warranty_info = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'category', 'category_name', 'warranty_policy', 'name', 'slug', 'sku',
            'description', 'price', 'current_price', 'has_promotion', 'discount_label',
            'promotion_title', 'compare_at_price', 'cost_price',
            'stock', 'low_stock_threshold', 'is_in_stock', 'is_low_stock',
            'image', 'rating_average', 'rating_count', 'is_featured',
            'is_active', 'warranty_info', 'created_at', 'updated_at', 'reviews'
        ]
        read_only_fields = ['id', 'slug', 'sku', 'rating_average', 'rating_count', 'created_at', 'updated_at']

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
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'product_name', 'quantity',
            'movement_type', 'reference', 'created_by', 'created_by_username',
            'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']
