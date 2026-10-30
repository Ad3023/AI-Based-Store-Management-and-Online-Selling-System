from django.urls import path
from .views import (
    PersonalizedRecommendationsView, SimilarProductsView,
    FrequentlyBoughtTogetherView, TrendingProductsView,
    CustomerSegmentationView, TrackActivityView,
    AIAssistantView, AIProductComparisonView,
    AIDemandForecastingView
)

urlpatterns = [
    path('personalized/', PersonalizedRecommendationsView.as_view(), name='personalized-recommendations'),
    path('similar/<int:product_id>/', SimilarProductsView.as_view(), name='similar-products'),
    path('bought-together/<int:product_id>/', FrequentlyBoughtTogetherView.as_view(), name='bought-together-products'),
    path('trending/', TrendingProductsView.as_view(), name='trending-products'),
    path('segmentation/', CustomerSegmentationView.as_view(), name='customer-segmentation'),
    path('forecasting/', AIDemandForecastingView.as_view(), name='ai-demand-forecasting'),
    path('track/', TrackActivityView.as_view(), name='track-activity'),
    path('assistant/', AIAssistantView.as_view(), name='ai-shopping-assistant'),
    path('compare/', AIProductComparisonView.as_view(), name='ai-product-comparison'),
]
