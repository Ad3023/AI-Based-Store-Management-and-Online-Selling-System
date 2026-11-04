from django.db import models
from django.utils.text import slugify
from django.conf import settings


from django.utils import timezone
from decimal import Decimal


class WarrantyPolicy(models.Model):
    name = models.CharField(max_length=150)
    duration_days = models.PositiveIntegerField(
        default=7,
        help_text="Warranty duration in days (e.g. 7, 30, 365)"
    )
    coverage_summary = models.TextField(
        default="Standard replacement or repair for hardware defects and manufacturing faults."
    )
    terms_and_conditions = models.TextField(
        blank=True,
        default="Warranty is valid from confirmed delivery. Excludes water damage, accidental drops, or unauthorized modifications."
    )
    claim_instructions = models.TextField(
        blank=True,
        default="Submit a warranty claim from your order details page with description and evidence photo."
    )
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Warranty Policies'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.duration_days} Days)"


class Supplier(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active / Approved'
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
        SUSPENDED = 'SUSPENDED', 'Suspended'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supplier_profile'
    )
    name = models.CharField(max_length=150, unique=True)
    contact_person = models.CharField(max_length=120, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=30, blank=True, default='')
    address = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.ACTIVE
    )
    supplied_categories = models.ManyToManyField('Category', blank=True, related_name='suppliers')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    @property
    def company_name(self):
        return self.name

    @company_name.setter
    def company_name(self, value):
        self.name = value

    @property
    def total_purchases_amount(self):
        from django.db.models import Sum
        val = self.purchase_requests.exclude(status__in=['DRAFT', 'REJECTED', 'CANCELLED']).aggregate(s=Sum('total_estimated_cost'))['s']
        return val or Decimal('0.00')

    @property
    def total_paid_amount(self):
        from django.db.models import Sum
        val = self.payments.filter(payment_status__in=['PAID', 'AUTHORIZED']).aggregate(s=Sum('amount_paid'))['s']
        return val or Decimal('0.00')

    @property
    def outstanding_balance(self):
        return max(Decimal('0.00'), self.total_purchases_amount - self.total_paid_amount)

    def __str__(self):
        return f"{self.name} [{self.status}]"


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=150, unique=True, blank=True)
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
    warranty_policy = models.ForeignKey(
        WarrantyPolicy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='categories'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Promotion(models.Model):
    class DiscountType(models.TextChoices):
        PERCENTAGE = 'PERCENTAGE', 'Percentage Discount (%)'
        FIXED = 'FIXED', 'Fixed Amount Discount (ETB)'

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    discount_type = models.CharField(
        max_length=20,
        choices=DiscountType.choices,
        default=DiscountType.PERCENTAGE
    )
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, help_text="e.g. 15 for 15% or 500 for 500 ETB off")
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    products = models.ManyToManyField('Product', blank=True, related_name='promotions')
    categories = models.ManyToManyField(Category, blank=True, related_name='promotions')
    banner_announcement = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Short dismissible announcement text for storefront header"
    )
    apply_to_all = models.BooleanField(
        default=False,
        help_text="Apply promotion store-wide to all eligible products"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_promotions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def name(self):
        return self.title

    @name.setter
    def name(self, val):
        self.title = val

    @property
    def is_currently_active(self):
        now = timezone.now()
        return self.is_active and self.start_date <= now <= self.end_date

    def __str__(self):
        return f"{self.title} ({self.get_discount_type_display()} - {self.discount_value})"


class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products')
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products'
    )
    warranty_policy = models.ForeignKey(
        WarrantyPolicy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products'
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=280, unique=True, blank=True)
    sku = models.CharField(max_length=64, unique=True, blank=True)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    compare_at_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    stock = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5, help_text="Minimum stock level / reorder point")
    reorder_quantity = models.PositiveIntegerField(
        default=20,
        help_text="Recommended reorder quantity for supplier replenishment"
    )
    low_stock_notified = models.BooleanField(
        default=False,
        help_text="True if supplier notification has been sent for the current low-stock cycle"
    )
    out_of_stock_notified = models.BooleanField(
        default=False,
        help_text="True if out-of-stock notification has been sent for the current zero-stock event"
    )
    last_low_stock_notification = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of the most recent supplier low-stock alert"
    )
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    rating_average = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    rating_count = models.PositiveIntegerField(default=0)
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def min_stock_level(self):
        return self.low_stock_threshold

    @min_stock_level.setter
    def min_stock_level(self, val):
        self.low_stock_threshold = val

    @property
    def suggested_reorder_quantity(self):
        return self.reorder_quantity

    @suggested_reorder_quantity.setter
    def suggested_reorder_quantity(self, val):
        self.reorder_quantity = val

    @property
    def low_stock_alert_active(self):
        return self.is_low_stock

    @property
    def is_out_of_stock(self):
        return self.stock == 0

    @property
    def supplier_email_status(self):
        latest = self.supplier_notifications.first()
        return latest.status if latest else 'NOT_SENT'

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            candidate = base_slug
            counter = 1
            while Product.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base_slug}-{counter}"
                counter += 1
            self.slug = candidate
        if not self.sku:
            import uuid
            self.sku = f"SKU-{uuid.uuid4().hex[:8].upper()}"

        # Duplicate prevention reset:
        # When stock is replenished above zero, reset out-of-stock notification flag
        if self.stock > 0 and self.out_of_stock_notified:
            self.out_of_stock_notified = False

        # When stock is replenished above the minimum reorder level,
        # reset the low_stock_notified flag so future low stock events trigger a new alert.
        if self.stock > self.low_stock_threshold and self.low_stock_notified:
            self.low_stock_notified = False

        super().save(*args, **kwargs)

    def get_eligible_promotions(self, at_time=None):
        """
        Returns all active promotions applicable to this product at a given time:
        1. Directly attached to this product.
        2. Attached to this product's category.
        3. Store-wide promotions (apply_to_all=True).
        """
        # timezone and Decimal imported at top
        now = at_time or timezone.now()

        direct_promos = list(self.promotions.filter(
            is_active=True, start_date__lte=now, end_date__gte=now
        ))
        cat_promos = list(self.category.promotions.filter(
            is_active=True, start_date__lte=now, end_date__gte=now
        ))
        store_promos = list(Promotion.objects.filter(
            apply_to_all=True, is_active=True, start_date__lte=now, end_date__gte=now
        ))

        seen_ids = set()
        unique_promos = []
        for p in direct_promos + cat_promos + store_promos:
            if p.id not in seen_ids:
                seen_ids.add(p.id)
                unique_promos.append(p)
        return unique_promos

    def get_current_promotion(self, at_time=None):
        """
        Consistent conflict resolution rule:
        Apply the single promotion that yields the highest discount amount on this product.
        Promotions are never stacked.
        In case of a tie in monetary discount amount, preference order is:
        1. Product-specific promotion
        2. Category-level promotion
        3. Store-wide promotion
        4. More recently created promotion
        """
        eligible = self.get_eligible_promotions(at_time=at_time)
        if not eligible:
            return None

        from decimal import Decimal
        best_promo = None
        max_discount = Decimal('0.00')

        for promo in eligible:
            if promo.discount_type == Promotion.DiscountType.PERCENTAGE:
                discount = (self.price * promo.discount_value) / Decimal('100.0')
            elif promo.discount_type == Promotion.DiscountType.FIXED:
                discount = min(promo.discount_value, self.price)
            else:
                discount = Decimal('0.00')

            discount = max(discount, Decimal('0.00'))

            if discount > max_discount:
                max_discount = discount
                best_promo = promo
            elif discount == max_discount and best_promo is not None and discount > Decimal('0.00'):
                # Tie-breaker: Product-specific > Category-level > Store-wide
                promo_is_direct = self.promotions.filter(id=promo.id).exists()
                best_is_direct = self.promotions.filter(id=best_promo.id).exists()
                if promo_is_direct and not best_is_direct:
                    best_promo = promo
                elif not promo_is_direct and not best_is_direct:
                    promo_is_cat = self.category.promotions.filter(id=promo.id).exists()
                    best_is_cat = self.category.promotions.filter(id=best_promo.id).exists()
                    if promo_is_cat and not best_is_cat:
                        best_promo = promo

        if max_discount > Decimal('0.00'):
            return best_promo
        return None

    @property
    def current_price(self):
        promo = self.get_current_promotion()
        if not promo:
            return self.price
        from decimal import Decimal
        if promo.discount_type == Promotion.DiscountType.PERCENTAGE:
            discount = (self.price * promo.discount_value) / Decimal('100.0')
            return max(self.price - discount, Decimal('0.00')).quantize(Decimal('0.01'))
        elif promo.discount_type == Promotion.DiscountType.FIXED:
            return max(self.price - promo.discount_value, Decimal('0.00')).quantize(Decimal('0.01'))
        return self.price

    @property
    def has_active_promotion(self):
        promo = self.get_current_promotion()
        if not promo:
            return False
        return self.current_price < self.price

    @property
    def resolved_warranty(self):
        if self.warranty_policy:
            return self.warranty_policy
        if self.category.warranty_policy:
            return self.category.warranty_policy
        default = WarrantyPolicy.objects.filter(is_default=True).first()
        return default

    @property
    def is_in_stock(self):
        return self.stock > 0

    @property
    def is_low_stock(self):
        return self.stock <= self.low_stock_threshold

    def __str__(self):
        return f"{self.name} (ETB {self.price})"


class ProductReview(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews')
    rating = models.PositiveSmallIntegerField(choices=[(i, str(i)) for i in range(1, 6)])
    comment = models.TextField(blank=True, null=True)
    is_approved = models.BooleanField(default=True)
    manager_response = models.TextField(blank=True, null=True)
    response_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='review_responses'
    )
    responded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('product', 'user')

    def __str__(self):
        return f"Review by {self.user.username} for {self.product.name} ({self.rating}/5)"


class CustomerFeedback(models.Model):
    class CategoryChoice(models.TextChoices):
        GENERAL = 'GENERAL', 'General Feedback'
        SERVICE = 'SERVICE', 'Store Service & Support'
        DELIVERY = 'DELIVERY', 'Delivery & Logistics'
        QUALITY = 'QUALITY', 'Product Quality'
        SUGGESTION = 'SUGGESTION', 'Feature / Stock Suggestion'

    class FeedbackStatus(models.TextChoices):
        NEW = 'NEW', 'New / Unreviewed'
        IN_REVIEW = 'IN_REVIEW', 'In Review'
        RESOLVED = 'RESOLVED', 'Resolved'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='feedbacks')
    subject = models.CharField(max_length=200)
    category = models.CharField(
        max_length=30,
        choices=CategoryChoice.choices,
        default=CategoryChoice.GENERAL
    )
    message = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=FeedbackStatus.choices,
        default=FeedbackStatus.NEW
    )
    admin_response = models.TextField(blank=True, null=True)
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='responded_feedbacks'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.status}] {self.subject} by {self.user.username}"


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        RESTOCK = 'RESTOCK', 'Restock'
        SALE = 'SALE', 'Sale'
        RETURN = 'RETURN', 'Return'
        ADJUSTMENT = 'ADJUSTMENT', 'Inventory Adjustment'

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_movements')
    quantity = models.IntegerField(help_text="Positive for additions, negative for reductions")
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    reference = models.CharField(max_length=100, blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='stock_movements'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.movement_type} of {self.quantity} for {self.product.name}"


class SupplierNotificationLog(models.Model):
    class Status(models.TextChoices):
        SENT = 'SENT', 'Sent Successfully'
        FAILED = 'FAILED', 'Failed / Missing Email'

    class TriggerType(models.TextChoices):
        AUTOMATIC = 'AUTOMATIC', 'Automatic Low-Stock Alert'
        MANUAL_RESEND = 'MANUAL_RESEND', 'Manual Resend by Store Manager'

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='supplier_notifications')
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    supplier_name = models.CharField(max_length=150, blank=True, default='')
    supplier_email = models.CharField(max_length=255, blank=True, default='')
    current_stock = models.PositiveIntegerField()
    min_stock_level = models.PositiveIntegerField()
    reorder_quantity = models.PositiveIntegerField(default=20)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SENT)
    trigger_type = models.CharField(max_length=20, choices=TriggerType.choices, default=TriggerType.AUTOMATIC)
    subject = models.CharField(max_length=255)
    error_message = models.TextField(blank=True, default='')
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_supplier_notifications'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.status}] {self.product.name} -> {self.supplier_email or 'No Email'} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"


class PurchaseRequest(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved by Admin'
        SENT_TO_SUPPLIER = 'SENT_TO_SUPPLIER', 'Sent to Supplier'
        AWAITING_SUPPLIER = 'AWAITING_SUPPLIER', 'Awaiting Supplier Response'
        ACCEPTED = 'ACCEPTED', 'Accepted by Supplier'
        PARTIALLY_ACCEPTED = 'PARTIALLY_ACCEPTED', 'Partially Accepted'
        REJECTED = 'REJECTED', 'Rejected'
        PREPARING_ORDER = 'PREPARING_ORDER', 'Preparing Order'
        READY_FOR_DELIVERY = 'READY_FOR_DELIVERY', 'Ready for Delivery'
        SHIPPED = 'SHIPPED', 'Shipped / In Transit'
        DELIVERED = 'DELIVERED', 'Delivered to Store'
        PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED', 'Partially Received'
        RECEIVED = 'RECEIVED', 'Received / Inspected'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        # Backward compatibility choices
        SUBMITTED = 'SUBMITTED', 'Submitted for Review'
        ORDERED = 'ORDERED', 'Ordered from Supplier'

    request_number = models.CharField(max_length=50, unique=True, blank=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, null=True, blank=True, related_name='purchase_requests')
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_requests')
    quantity = models.PositiveIntegerField(default=20)
    received_quantity = models.PositiveIntegerField(default=0)
    damaged_quantity = models.PositiveIntegerField(default=0)
    agreed_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    estimated_unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_estimated_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    expected_supply_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requested_purchases'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_purchases'
    )
    approval_date = models.DateTimeField(null=True, blank=True)
    admin_feedback = models.TextField(blank=True, default='')
    supplier_confirmed_at = models.DateTimeField(null=True, blank=True)
    supplier_confirmation_notes = models.TextField(blank=True, default='')
    supplier_response = models.CharField(max_length=50, blank=True, default='')
    supplier_rejection_reason = models.TextField(blank=True, default='')
    supplier_suggested_delivery_date = models.DateField(null=True, blank=True)
    supplier_shipping_carrier = models.CharField(max_length=150, blank=True, default='')
    supplier_tracking_number = models.CharField(max_length=150, blank=True, default='')
    supplier_dispatched_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    notification_log = models.ForeignKey(
        SupplierNotificationLog,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_requests'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def outstanding_quantity(self):
        return max(0, self.quantity - self.received_quantity)

    @property
    def total_cost(self):
        return self.total_estimated_cost

    def save(self, *args, **kwargs):
        if not self.request_number:
            import uuid
            self.request_number = f"PO-{uuid.uuid4().hex[:8].upper()}"
        if not self.agreed_price and self.estimated_unit_cost:
            self.agreed_price = self.estimated_unit_cost
        elif self.agreed_price and not self.estimated_unit_cost:
            self.estimated_unit_cost = self.agreed_price
        eff_price = self.agreed_price or self.estimated_unit_cost or 0
        if not self.total_estimated_cost and eff_price:
            self.total_estimated_cost = eff_price * self.quantity
        super().save(*args, **kwargs)

    def __str__(self):
        item_label = self.product.name if self.product else f"{self.quantity} units"
        return f"{self.request_number} - {item_label} [{self.status}]"


class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(PurchaseRequest, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='po_items')
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    confirmed_quantity = models.PositiveIntegerField(null=True, blank=True, default=None)
    received_quantity = models.PositiveIntegerField(default=0)
    damaged_quantity = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    @property
    def outstanding_quantity(self):
        return max(0, self.quantity - self.received_quantity)

    def save(self, *args, **kwargs):
        if not self.total_cost and self.unit_price and self.quantity:
            self.total_cost = self.unit_price * self.quantity
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} ({self.quantity} units) - {self.purchase_order.request_number}"


class SupplierInvoice(models.Model):
    class Status(models.TextChoices):
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved for Payment'
        REJECTED = 'REJECTED', 'Rejected'
        PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
        PAID = 'PAID', 'Paid'
        CANCELLED = 'CANCELLED', 'Cancelled'

    invoice_number = models.CharField(max_length=100, db_index=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='invoices')
    purchase_order = models.ForeignKey(
        PurchaseRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices'
    )
    invoice_date = models.DateField(default=timezone.now)
    due_date = models.DateField(null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING_APPROVAL)
    notes = models.TextField(blank=True, default='')
    attachment = models.FileField(upload_to='supplier_invoices/', null=True, blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_invoices'
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_invoices'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('supplier', 'invoice_number')

    @property
    def outstanding_amount(self):
        tot = Decimal(str(self.total_amount)) if self.total_amount is not None else Decimal('0.00')
        paid = Decimal(str(self.paid_amount)) if self.paid_amount is not None else Decimal('0.00')
        return max(Decimal('0.00'), tot - paid)

    def __str__(self):
        return f"INV-{self.invoice_number} - {self.supplier.name} (ETB {self.total_amount}) [{self.status}]"


class SupplierPayment(models.Model):
    class PaymentStatus(models.TextChoices):
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
        APPROVED = 'APPROVED_FOR_PAYMENT', 'Approved for Payment'
        PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
        PAID = 'PAID', 'Paid'
        REJECTED = 'REJECTED', 'Rejected'
        OVERDUE = 'OVERDUE', 'Overdue'
        # Backward compatibility choices
        AUTHORIZED = 'AUTHORIZED', 'Authorized'
        PENDING = 'PENDING', 'Pending'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class PaymentMethod(models.TextChoices):
        BANK_TRANSFER = 'BANK_TRANSFER', 'Bank Transfer / Wire'
        TELEBIRR = 'TELEBIRR', 'Telebirr SuperApp / Merchant'
        CASH = 'CASH', 'Cash'
        CHEQUE = 'CHEQUE', 'Cheque / Certified Draft'
        OTHER = 'OTHER', 'Other External Settlement'

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='payments')
    purchase_order = models.ForeignKey(PurchaseRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    invoice = models.ForeignKey('SupplierInvoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    supplier_invoice = models.CharField(max_length=100, blank=True, default='')
    purchase_order_reference = models.CharField(max_length=100, blank=True, default='')
    total_purchase_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    payment_method = models.CharField(max_length=50, choices=PaymentMethod.choices, default=PaymentMethod.BANK_TRANSFER)
    transaction_reference = models.CharField(max_length=100, unique=True, blank=True)
    payment_date = models.DateTimeField(default=timezone.now)
    payment_status = models.CharField(max_length=30, choices=PaymentStatus.choices, default=PaymentStatus.PAID)
    authorized_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='authorized_supplier_payments'
    )
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-payment_date']

    def save(self, *args, **kwargs):
        if not self.transaction_reference:
            import uuid
            self.transaction_reference = f"SPAY-{uuid.uuid4().hex[:8].upper()}"
        if self.purchase_order and not self.purchase_order_reference:
            self.purchase_order_reference = self.purchase_order.request_number
        if self.total_purchase_amount and self.amount_paid:
            tot = Decimal(str(self.total_purchase_amount))
            paid = Decimal(str(self.amount_paid))
            self.outstanding_balance = max(Decimal('0.00'), tot - paid)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.transaction_reference} - {self.supplier.name} (ETB {self.amount_paid}) [{self.payment_status}]"


class StockAlertHistory(models.Model):
    class AlertType(models.TextChoices):
        LOW_STOCK = 'LOW_STOCK', 'Low Stock Alert'
        OUT_OF_STOCK = 'OUT_OF_STOCK', 'Out of Stock Alert'
        REPLENISHED = 'REPLENISHED', 'Stock Replenished'
        SUPPLIER_EMAIL = 'SUPPLIER_EMAIL', 'Supplier Reorder Email'
        MANUAL_RESEND = 'MANUAL_RESEND', 'Manual Resend'

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='alert_history')
    alert_type = models.CharField(max_length=30, choices=AlertType.choices)
    current_stock = models.IntegerField()
    min_stock_level = models.IntegerField()
    reorder_quantity = models.IntegerField(default=20)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='alert_history')
    supplier_email = models.CharField(max_length=255, blank=True, default='')
    email_status = models.CharField(max_length=50, blank=True, default='')
    email_sent_at = models.DateTimeField(null=True, blank=True)
    details = models.TextField(blank=True, default='')
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='triggered_stock_alerts'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.alert_type}] {self.product.name} (Stock: {self.current_stock}) at {self.created_at.strftime('%Y-%m-%d %H:%M')}"
