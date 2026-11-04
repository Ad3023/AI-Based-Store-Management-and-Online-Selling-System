from django.contrib import admin
from .models import (
    Category, Product, Supplier, StockMovement, SupplierNotificationLog,
    PurchaseRequest, PurchaseOrderItem, SupplierInvoice, SupplierPayment,
    WarrantyPolicy, Promotion, ProductReview, CustomerFeedback, StockAlertHistory
)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'contact_person', 'email', 'phone', 'status', 'is_active', 'created_at')
    search_fields = ('name', 'contact_person', 'email')
    list_filter = ('status', 'is_active')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'supplier', 'stock', 'low_stock_threshold', 'reorder_quantity', 'low_stock_notified', 'price', 'is_active')
    search_fields = ('name', 'sku', 'slug')
    list_filter = ('category', 'supplier', 'is_active', 'low_stock_notified')


@admin.register(SupplierNotificationLog)
class SupplierNotificationLogAdmin(admin.ModelAdmin):
    list_display = ('product', 'supplier_name', 'supplier_email', 'status', 'trigger_type', 'current_stock', 'min_stock_level', 'reorder_quantity', 'created_at')
    list_filter = ('status', 'trigger_type', 'created_at')
    search_fields = ('product__name', 'supplier_name', 'supplier_email')


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 0


@admin.register(PurchaseRequest)
class PurchaseRequestAdmin(admin.ModelAdmin):
    list_display = ('request_number', 'supplier', 'product', 'quantity', 'received_quantity', 'damaged_quantity', 'total_estimated_cost', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('request_number', 'product__name', 'supplier__name')
    inlines = [PurchaseOrderItemInline]


@admin.register(SupplierInvoice)
class SupplierInvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'supplier', 'purchase_order', 'total_amount', 'paid_amount', 'status', 'invoice_date', 'due_date', 'created_at')
    list_filter = ('status', 'invoice_date', 'created_at')
    search_fields = ('invoice_number', 'supplier__name', 'purchase_order__request_number')


@admin.register(SupplierPayment)
class SupplierPaymentAdmin(admin.ModelAdmin):
    list_display = ('transaction_reference', 'supplier', 'invoice', 'purchase_order', 'amount_paid', 'payment_method', 'payment_status', 'payment_date', 'authorized_by')
    list_filter = ('payment_status', 'payment_method', 'payment_date')
    search_fields = ('transaction_reference', 'supplier__name', 'invoice__invoice_number')


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('product', 'movement_type', 'quantity', 'reference', 'created_by', 'created_at')
    list_filter = ('movement_type', 'created_at')


@admin.register(StockAlertHistory)
class StockAlertHistoryAdmin(admin.ModelAdmin):
    list_display = ('product', 'alert_type', 'current_stock', 'min_stock_level', 'supplier_email', 'email_status', 'created_at')
    list_filter = ('alert_type', 'email_status', 'created_at')
    search_fields = ('product__name', 'supplier_email')


admin.site.register(Category)
admin.site.register(WarrantyPolicy)
admin.site.register(Promotion)
admin.site.register(ProductReview)
admin.site.register(CustomerFeedback)
