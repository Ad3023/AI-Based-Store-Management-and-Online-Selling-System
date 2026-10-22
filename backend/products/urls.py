from django.urls import path
from .views import (
    CategoryListCreateView, CategoryDetailView,
    ProductListView, ProductDetailView,
    ProductReviewCreateView, ProductReviewModerationView,
    InventoryManagementView,
    PromotionListCreateView, PromotionDetailView,
    ActivePromotionAnnouncementView,
    WarrantyPolicyListCreateView, WarrantyPolicyDetailView,
    CustomerFeedbackListCreateView, CustomerFeedbackDetailView
)

urlpatterns = [
    path('categories/', CategoryListCreateView.as_view(), name='category-list'),
    path('categories/<int:pk>/', CategoryDetailView.as_view(), name='category-detail'),
    path('items/', ProductListView.as_view(), name='product-list'),
    path('items/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
    path('items/<int:product_id>/reviews/', ProductReviewCreateView.as_view(), name='product-review-create'),
    path('reviews/<int:review_id>/moderate/', ProductReviewModerationView.as_view(), name='product-review-moderate'),
    path('inventory/', InventoryManagementView.as_view(), name='inventory-management'),
    
    # Promotions
    path('promotions/', PromotionListCreateView.as_view(), name='promotion-list-create'),
    path('promotions/<int:pk>/', PromotionDetailView.as_view(), name='promotion-detail'),
    path('promotions/active/announcement/', ActivePromotionAnnouncementView.as_view(), name='promotion-active-announcement'),

    # Warranty Policies
    path('warranty-policies/', WarrantyPolicyListCreateView.as_view(), name='warranty-policy-list-create'),
    path('warranty-policies/<int:pk>/', WarrantyPolicyDetailView.as_view(), name='warranty-policy-detail'),

    # Customer Feedback & Inquiries
    path('feedback/', CustomerFeedbackListCreateView.as_view(), name='customer-feedback-list-create'),
    path('feedback/<int:pk>/', CustomerFeedbackDetailView.as_view(), name='customer-feedback-detail'),
]
