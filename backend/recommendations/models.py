from django.db import models
from django.conf import settings
from products.models import Product


class CustomerActivity(models.Model):
    class ActivityType(models.TextChoices):
        VIEW = 'VIEW', 'Product View'
        ADD_TO_CART = 'ADD_TO_CART', 'Add to Cart'
        PURCHASE = 'PURCHASE', 'Purchase'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activities'
    )
    session_key = models.CharField(max_length=64, blank=True, null=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=ActivityType.choices, default=ActivityType.VIEW)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        actor = self.user.username if self.user else f"Guest ({self.session_key[:8] if self.session_key else 'Unknown'})"
        return f"{actor} - {self.activity_type} - {self.product.name}"


class CustomerSegment(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='segment')
    segment_name = models.CharField(max_length=100)
    cluster_id = models.IntegerField(default=0)
    total_spent = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    order_count = models.PositiveIntegerField(default=0)
    avg_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    last_order_days = models.PositiveIntegerField(default=0)
    suggested_action = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-total_spent']

    def __str__(self):
        return f"{self.user.username}: {self.segment_name} (Cluster {self.cluster_id})"
