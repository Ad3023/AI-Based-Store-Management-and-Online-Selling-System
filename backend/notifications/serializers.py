from rest_framework import serializers
from .models import Notification, NewsletterSubscriber, PromotionalCampaign, CampaignDeliveryLog


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'notification_type',
            'product', 'product_name', 'current_stock', 'min_stock_level',
            'suggested_reorder_qty', 'supplier_email_status',
            'order_number', 'is_read', 'link', 'created_at'
        ]
        read_only_fields = [
            'id', 'title', 'message', 'notification_type',
            'product', 'product_name', 'current_stock', 'min_stock_level',
            'suggested_reorder_qty', 'supplier_email_status',
            'order_number', 'link', 'created_at'
        ]


class NewsletterSubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterSubscriber
        fields = ['id', 'email', 'is_verified', 'is_active', 'subscribed_at', 'verified_at', 'unsubscribed_at']
        read_only_fields = ['id', 'is_verified', 'is_active', 'subscribed_at', 'verified_at', 'unsubscribed_at']

    def validate_email(self, value):
        from accounts.validators import validate_email_address
        return validate_email_address(value, required=True)


class CampaignDeliveryLogSerializer(serializers.ModelSerializer):
    subscriber_email = serializers.CharField(source='subscriber.email', read_only=True)

    class Meta:
        model = CampaignDeliveryLog
        fields = ['id', 'campaign', 'subscriber', 'subscriber_email', 'status', 'error_message', 'sent_at']
        read_only_fields = ['id', 'sent_at']


class PromotionalCampaignSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    delivery_logs = CampaignDeliveryLogSerializer(many=True, read_only=True)

    class Meta:
        model = PromotionalCampaign
        fields = [
            'id', 'promotion', 'title', 'subject', 'message', 'discount_info',
            'banner_image', 'status', 'sent_at', 'recipient_count',
            'delivered_count', 'failed_count', 'created_by', 'created_by_name',
            'created_by_username', 'delivery_logs', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'status', 'sent_at', 'recipient_count', 'delivered_count',
            'failed_count', 'created_by', 'created_at', 'updated_at'
        ]
