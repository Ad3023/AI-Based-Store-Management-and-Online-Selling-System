from django.urls import path
from .views import (
    CategoryListCreateView, CategoryDetailView,
    ProductListView, ProductDetailView,
    ProductReviewCreateView, InventoryManagementView
)

urlpatterns = [
    path('categories/', CategoryListCreateView.as_view(), name='category-list'),
    path('categories/<int:pk>/', CategoryDetailView.as_view(), name='category-detail'),
    path('items/', ProductListView.as_view(), name='product-list'),
    path('items/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
    path('items/<int:product_id>/reviews/', ProductReviewCreateView.as_view(), name='product-review-create'),
    path('inventory/', InventoryManagementView.as_view(), name='inventory-management'),
]
