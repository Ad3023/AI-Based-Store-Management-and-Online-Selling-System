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
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    is_currently_active = serializers.BooleanField(read_only=True)
    product_count = serializers.IntegerField(source='products.count', read_only=True)
    category_count = serializers.IntegerField(source='categories.count', read_only=True)

    class Meta:
        model = Promotion
        fields = [
            'id', 'title', 'description', 'discount_type', 'discount_value',
            'start_date', 'end_date', 'is_active', 'is_currently_active',
            'products', 'categories', 'banner_announcement',
            'created_by', 'created_by_username', 'product_count', 'category_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']


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
