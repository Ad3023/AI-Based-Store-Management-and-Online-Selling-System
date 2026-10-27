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
        return self.product.current_price * self.quantity

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

    class PaymentStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PAID = 'PAID', 'Paid'
        FAILED = 'FAILED', 'Failed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        EXPIRED = 'EXPIRED', 'Expired'
        REFUND_PENDING = 'REFUND_PENDING', 'Refund Pending'
        PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED', 'Partially Refunded'
        REFUNDED = 'REFUNDED', 'Refunded'

    class FulfillmentStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        CONFIRMED = 'CONFIRMED', 'Confirmed'
        PROCESSING = 'PROCESSING', 'Processing'
        SHIPPED = 'SHIPPED', 'Shipped'
        DELIVERED = 'DELIVERED', 'Delivered'
        CANCELLED = 'CANCELLED', 'Cancelled'
        REFUNDED = 'REFUNDED', 'Refunded'

    order_number = models.CharField(max_length=32, unique=True, editable=False)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING_PAYMENT)
    
    payment_status = models.CharField(
        max_length=32,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        db_index=True
    )
    fulfillment_status = models.CharField(
        max_length=32,
        choices=FulfillmentStatus.choices,
        default=FulfillmentStatus.PENDING,
        db_index=True
    )
    currency = models.CharField(max_length=10, default='ETB')

    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)

    payment_method = models.CharField(max_length=50, default='CHAPA')
    chapa_tx_ref = models.CharField(max_length=120, blank=True, null=True, db_index=True)

    verified_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payment_initiated_at = models.DateTimeField(null=True, blank=True)
    payment_verified_at = models.DateTimeField(null=True, blank=True)
    last_verification_result = models.CharField(max_length=100, blank=True, null=True)
    verification_mismatch_message = models.TextField(blank=True, null=True)

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

        # Keep legacy status field in sync with payment_status & fulfillment_status
        if self.payment_status == self.PaymentStatus.PAID:
            if self.fulfillment_status == self.FulfillmentStatus.DELIVERED:
                self.status = self.Status.DELIVERED
            elif self.fulfillment_status == self.FulfillmentStatus.SHIPPED:
                self.status = self.Status.SHIPPED
            else:
                self.status = self.Status.PROCESSING
        elif self.fulfillment_status == self.FulfillmentStatus.CANCELLED or self.payment_status == self.PaymentStatus.CANCELLED:
            self.status = self.Status.CANCELLED

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.order_number} by {self.customer.username} (ETB {self.total_amount})"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='order_items')
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    # Warranty policy snapshot at purchase time
    warranty_duration_days = models.PositiveIntegerField(default=7)
    warranty_coverage = models.TextField(blank=True, default="Standard replacement or repair for hardware defects.")
    warranty_terms = models.TextField(blank=True, default="Valid from delivery date. Excludes liquid damage or physical drops.")
    warranty_start_date = models.DateTimeField(null=True, blank=True)
    warranty_end_date = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        self.total_price = self.unit_price * self.quantity
        if not self.warranty_duration_days:
            policy = getattr(self.product, 'resolved_warranty', None)
            if policy:
                self.warranty_duration_days = policy.duration_days
                self.warranty_coverage = policy.coverage_summary
                self.warranty_terms = policy.terms_and_conditions
        super().save(*args, **kwargs)

    @property
    def is_warranty_active(self):
        from django.utils import timezone
        now = timezone.now()
        if self.warranty_start_date and self.warranty_end_date:
            return self.warranty_start_date <= now <= self.warranty_end_date
        return False

    def __str__(self):
        return f"{self.quantity}x {self.product.name} in {self.order.order_number}"


class WarrantyClaim(models.Model):
    class ClaimStatus(models.TextChoices):
        SUBMITTED = 'SUBMITTED', 'Submitted'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        APPROVED = 'APPROVED', 'Approved (Replacement / Repair)'
        REJECTED = 'REJECTED', 'Rejected'
        RESOLVED = 'RESOLVED', 'Resolved'

    claim_number = models.CharField(max_length=32, unique=True, editable=False)
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE, related_name='warranty_claims')
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='warranty_claims')
    issue_description = models.TextField()
    evidence_image = models.ImageField(upload_to='warranty_evidence/', blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=ClaimStatus.choices,
        default=ClaimStatus.SUBMITTED
    )
    admin_notes = models.TextField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True, null=True)
    resolution_details = models.TextField(blank=True, null=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_warranty_claims'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.claim_number:
            import datetime
            now_str = datetime.datetime.now().strftime('%Y%m%d')
            self.claim_number = f"CLM-{now_str}-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Claim {self.claim_number} ({self.status}) for {self.order_item.product.name}"


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


class OrderStatusHistory(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_status_changes'
    )
    status_type = models.CharField(max_length=30, default='FULFILLMENT')  # 'FULFILLMENT' or 'PAYMENT'
    previous_status = models.CharField(max_length=50)
    new_status = models.CharField(max_length=50)
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.order.order_number}: {self.previous_status} -> {self.new_status} at {self.created_at}"
