from django.db import models
from django.utils.text import slugify
from django.conf import settings


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=150, unique=True, blank=True)
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
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


class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products')
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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('product', 'user')

    def __str__(self):
        return f"Review by {self.user.username} for {self.product.name} ({self.rating}/5)"


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
