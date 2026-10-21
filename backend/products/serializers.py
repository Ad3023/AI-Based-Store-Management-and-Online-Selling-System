from rest_framework import serializers
from .models import Category, Product, ProductReview, StockMovement


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source='products.count', read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'image', 'is_active', 'product_count', 'created_at']
        read_only_fields = ['id', 'slug', 'created_at']


class ProductReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ProductReview
        fields = ['id', 'product', 'user', 'username', 'rating', 'comment', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    reviews = ProductReviewSerializer(many=True, read_only=True)
    is_in_stock = serializers.BooleanField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'category', 'category_name', 'name', 'slug', 'sku',
            'description', 'price', 'compare_at_price', 'cost_price',
            'stock', 'low_stock_threshold', 'is_in_stock', 'is_low_stock',
            'image', 'rating_average', 'rating_count', 'is_featured',
            'is_active', 'created_at', 'updated_at', 'reviews'
        ]
        read_only_fields = ['id', 'slug', 'sku', 'rating_average', 'rating_count', 'created_at', 'updated_at']


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
