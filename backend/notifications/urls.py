from django.urls import path
from .views import (
    NotificationListView, NotificationMarkReadView, NotificationDeleteView,
    NewsletterSubscribeView, NewsletterVerifyView, NewsletterUnsubscribeView,
    NewsletterStatusView, NewsletterSubscriberListView,
    PromotionalCampaignListCreateView, PromotionalCampaignDetailView,
    PromotionalCampaignPreviewView, PromotionalCampaignSendView
)

urlpatterns = [
    # In-app notifications
    path('', NotificationListView.as_view(), name='notification-list'),
    path('<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('<int:pk>/delete/', NotificationDeleteView.as_view(), name='notification-delete'),
    path('<int:pk>/', NotificationDeleteView.as_view(), name='notification-detail'),

    # Newsletter subscriptions
    path('newsletter/subscribe/', NewsletterSubscribeView.as_view(), name='newsletter-subscribe'),
    path('newsletter/verify/', NewsletterVerifyView.as_view(), name='newsletter-verify'),
    path('newsletter/unsubscribe/', NewsletterUnsubscribeView.as_view(), name='newsletter-unsubscribe'),
    path('newsletter/status/', NewsletterStatusView.as_view(), name='newsletter-status'),
    path('newsletter/subscribers/', NewsletterSubscriberListView.as_view(), name='newsletter-subscribers'),

    # Promotional campaigns (Admin)
    path('campaigns/', PromotionalCampaignListCreateView.as_view(), name='campaign-list-create'),
    path('campaigns/<int:pk>/', PromotionalCampaignDetailView.as_view(), name='campaign-detail'),
    path('campaigns/<int:pk>/preview/', PromotionalCampaignPreviewView.as_view(), name='campaign-preview'),
    path('campaigns/<int:pk>/send/', PromotionalCampaignSendView.as_view(), name='campaign-send'),
]
