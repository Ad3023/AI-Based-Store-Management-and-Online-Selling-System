from django.urls import path
from .views import (
    PersonalizedRecommendationsView, SimilarProductsView,
    FrequentlyBoughtTogetherView, TrendingProductsView,
    CustomerSegmentationView, TrackActivityView
)

urlpatterns = [
    path('personalized/', PersonalizedRecommendationsView.as_view(), name='personalized-recommendations'),
    path('similar/<int:product_id>/', SimilarProductsView.as_view(), name='similar-products'),
    path('bought-together/<int:product_id>/', FrequentlyBoughtTogetherView.as_view(), name='bought-together-products'),
    path('trending/', TrendingProductsView.as_view(), name='trending-products'),
    path('segmentation/', CustomerSegmentationView.as_view(), name='customer-segmentation'),
    path('track/', TrackActivityView.as_view(), name='track-activity'),
]
