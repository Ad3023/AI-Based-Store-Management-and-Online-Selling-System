from django.db import models
from django.conf import settings


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        ORDER_PLACED = 'ORDER_PLACED', 'Order Placed'
        PAYMENT_VERIFIED = 'PAYMENT_VERIFIED', 'Payment Verified'
        PAYMENT_PENDING = 'PAYMENT_PENDING', 'Payment Pending'
        PAYMENT_FAILED = 'PAYMENT_FAILED', 'Payment Failed'
        ORDER_CONFIRMED = 'ORDER_CONFIRMED', 'Order Confirmed'
        ORDER_PROCESSING = 'ORDER_PROCESSING', 'Order Processing'
        ORDER_SHIPPED = 'ORDER_SHIPPED', 'Order Shipped'
        ORDER_DELIVERED = 'ORDER_DELIVERED', 'Order Delivered'
        ORDER_CANCELLED = 'ORDER_CANCELLED', 'Order Cancelled'
        ORDER_REFUNDED = 'ORDER_REFUNDED', 'Order Refunded'
        ORDER_UPDATE = 'ORDER_UPDATE', 'Order Update'
        PAYMENT_REJECTED = 'PAYMENT_REJECTED', 'Payment Rejected'
        STOCK_ALERT = 'STOCK_ALERT', 'Stock Alert'
        LOW_STOCK = 'LOW_STOCK', 'Low Stock'
        OUT_OF_STOCK = 'OUT_OF_STOCK', 'Out of Stock'
        SUPPLIER_EMAIL_SENT = 'SUPPLIER_EMAIL_SENT', 'Supplier Email Sent'
        SUPPLIER_EMAIL_FAILED = 'SUPPLIER_EMAIL_FAILED', 'Supplier Email Failed'
        SYSTEM = 'SYSTEM', 'System'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=32,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )
    product_name = models.CharField(max_length=255, blank=True, default='')
    current_stock = models.IntegerField(null=True, blank=True)
    min_stock_level = models.IntegerField(null=True, blank=True)
    suggested_reorder_qty = models.IntegerField(null=True, blank=True)
    supplier_email_status = models.CharField(max_length=50, blank=True, default='')
    order_number = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    event_key = models.CharField(max_length=160, blank=True, null=True, unique=True)
    is_read = models.BooleanField(default=False)
    link = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{'Read' if self.is_read else 'Unread'}] {self.title} for {self.user.username}"


def create_order_notification(user, title, message, notification_type, order_number=None, link=None, event_key=None):
    """
    Creates an order-driven notification safely and idempotently.
    Prevents duplicate notifications on webhook or callback retries.
    """
    if event_key:
        existing = Notification.objects.filter(event_key=event_key).first()
        if existing:
            return existing
    return Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        order_number=order_number,
        link=link,
        event_key=event_key
    )


class NewsletterSubscriber(models.Model):
    email = models.EmailField(unique=True, db_index=True)
    is_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=100, unique=True, db_index=True)
    is_active = models.BooleanField(default=True)
    unsubscribe_token = models.CharField(max_length=100, unique=True, db_index=True)
    subscribed_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.CharField(max_length=45, blank=True, null=True)

    class Meta:
        ordering = ['-subscribed_at']

    def __str__(self):
        status_label = "Verified" if self.is_verified else "Unverified"
        active_label = "Subscribed" if self.is_active else "Unsubscribed"
        return f"{self.email} ({status_label}, {active_label})"


class PromotionalCampaign(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        SENDING = 'SENDING', 'Sending'
        SENT = 'SENT', 'Sent'
        FAILED = 'FAILED', 'Failed'

    promotion = models.ForeignKey(
        'products.Promotion',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='campaigns'
    )
    title = models.CharField(max_length=255)
    subject = models.CharField(max_length=255)
    message = models.TextField()
    discount_info = models.CharField(max_length=150, blank=True, null=True)
    banner_image = models.ImageField(upload_to='promotions/campaigns/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    sent_at = models.DateTimeField(null=True, blank=True)
    recipient_count = models.PositiveIntegerField(default=0)
    delivered_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_campaigns'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Campaign: {self.title} [{self.status}]"


class CampaignDeliveryLog(models.Model):
    class Status(models.TextChoices):
        SENT = 'SENT', 'Sent'
        FAILED = 'FAILED', 'Failed'

    campaign = models.ForeignKey(
        PromotionalCampaign,
        on_delete=models.CASCADE,
        related_name='delivery_logs'
    )
    subscriber = models.ForeignKey(
        NewsletterSubscriber,
        on_delete=models.CASCADE,
        related_name='campaign_logs'
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SENT)
    error_message = models.TextField(blank=True, null=True)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-sent_at']

    def __str__(self):
        return f"{self.campaign.title} -> {self.subscriber.email}: {self.status}"

