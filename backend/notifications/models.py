from django.db import models
from django.conf import settings


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        ORDER_UPDATE = 'ORDER_UPDATE', 'Order Update'
        PAYMENT_VERIFIED = 'PAYMENT_VERIFIED', 'Payment Verified'
        PAYMENT_REJECTED = 'PAYMENT_REJECTED', 'Payment Rejected'
        STOCK_ALERT = 'STOCK_ALERT', 'Stock Alert'
        SYSTEM = 'SYSTEM', 'System'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM
    )
    is_read = models.BooleanField(default=False)
    link = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{'Read' if self.is_read else 'Unread'}] {self.title} for {self.user.username}"
