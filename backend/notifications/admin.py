from django.contrib import admin
from .models import Notification, NewsletterSubscriber, PromotionalCampaign, CampaignDeliveryLog


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'notification_type', 'product_name', 'current_stock', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read', 'created_at')
    search_fields = ('title', 'message', 'user__username', 'product_name')


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ('email', 'is_verified', 'is_active', 'subscribed_at')
    list_filter = ('is_verified', 'is_active')
    search_fields = ('email',)


@admin.register(PromotionalCampaign)
class PromotionalCampaignAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'recipient_count', 'delivered_count', 'created_at')
    list_filter = ('status', 'created_at')

