from django.db import models
from django.utils.text import slugify
from django.conf import settings


from django.utils import timezone


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
    low_stock_threshold = models.PositiveIntegerField(default=5)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    rating_average = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    rating_count = models.PositiveIntegerField(default=0)
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

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
        super().save(*args, **kwargs)

    def get_eligible_promotions(self, at_time=None):
        """
        Returns all active promotions applicable to this product at a given time:
        1. Directly attached to this product.
        2. Attached to this product's category.
        3. Store-wide promotions (apply_to_all=True).
        """
        from django.utils import timezone
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
        return 0 < self.stock <= self.low_stock_threshold

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
