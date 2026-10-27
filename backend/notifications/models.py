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
        SYSTEM = 'SYSTEM', 'System'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=32,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM
    )
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
