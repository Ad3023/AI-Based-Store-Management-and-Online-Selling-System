import uuid
from django.db import models
from django.conf import settings
from products.models import Product


class Cart(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cart')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def total_price(self):
        return sum(item.subtotal for item in self.items.all())

    @property
    def total_items(self):
        return sum(item.quantity for item in self.items.all())

    def __str__(self):
        return f"Cart of {self.user.username}"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('cart', 'product')

    @property
    def subtotal(self):
        return self.product.price * self.quantity

    def __str__(self):
        return f"{self.quantity}x {self.product.name} in cart"


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING_PAYMENT = 'PENDING_PAYMENT', 'Pending Payment'
        PAYMENT_SUBMITTED = 'PAYMENT_SUBMITTED', 'Payment Submitted (Under Review)'
        PROCESSING = 'PROCESSING', 'Processing (Payment Verified)'
        SHIPPED = 'SHIPPED', 'Shipped'
        DELIVERED = 'DELIVERED', 'Delivered'
        CANCELLED = 'CANCELLED', 'Cancelled'

    order_number = models.CharField(max_length=32, unique=True, editable=False)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING_PAYMENT)
    
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)

    payment_method = models.CharField(max_length=50, default='MANUAL_BANK')
    chapa_tx_ref = models.CharField(max_length=120, blank=True, null=True)

    shipping_name = models.CharField(max_length=150)
    shipping_phone = models.CharField(max_length=25)
    shipping_address = models.TextField()
    shipping_city = models.CharField(max_length=100)
    notes = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.order_number:
            import datetime
            now_str = datetime.datetime.now().strftime('%Y%m%d')
            self.order_number = f"ORD-{now_str}-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.order_number} by {self.customer.username} (ETB {self.total_amount})"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='order_items')
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    def save(self, *args, **kwargs):
        self.total_price = self.unit_price * self.quantity
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.quantity}x {self.product.name} in {self.order.order_number}"


class PaymentEvidence(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending Verification'
        APPROVED = 'APPROVED', 'Approved / Verified'
        REJECTED = 'REJECTED', 'Rejected'

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment_evidence')
    payment_method = models.CharField(max_length=100)
    transaction_reference = models.CharField(max_length=100)
    evidence_image = models.ImageField(upload_to='payment_evidences/', blank=True, null=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_payments'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment for {self.order.order_number} ({self.get_verification_status_display()})"


class Receipt(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='receipt')
    receipt_number = models.CharField(max_length=32, unique=True, editable=False)
    issued_at = models.DateTimeField(auto_now_add=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='issued_receipts'
    )
    download_count = models.PositiveIntegerField(default=0)

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            import datetime
            now_str = datetime.datetime.now().strftime('%Y%m%d')
            self.receipt_number = f"RCP-{now_str}-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Receipt {self.receipt_number} for {self.order.order_number}"
