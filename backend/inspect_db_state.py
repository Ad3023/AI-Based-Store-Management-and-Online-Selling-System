import django
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from products.models import Product, Category, Supplier, PurchaseRequest, PurchaseOrderItem, SupplierInvoice, SupplierPayment, StockMovement, ProductReview
from orders.models import Order, OrderItem, PaymentEvidence, Receipt, WarrantyClaim, Cart, CartItem
from accounts.models import AuditLog, PasswordResetToken, EmailVerificationToken
from notifications.models import Notification

User = get_user_model()

print("=== ALL USERS IN DATABASE ===")
for u in User.objects.all().order_by('role', 'id'):
    print(f"ID: {u.id:<3} | Role: {u.role:<14} | Email: {u.email:<32} | Username: {u.username:<22} | Superuser: {str(u.is_superuser):<5} | Active: {str(u.is_active):<5}")

print("\n=== RECORD COUNTS ===")
print("Users (Total):", User.objects.count())
print("  - Customers:", User.objects.filter(role='customer').count())
print("  - Store Managers:", User.objects.filter(role='store_manager').count())
print("  - Order Managers:", User.objects.filter(role='order_manager').count())
print("  - Admins:", User.objects.filter(role='admin').count())

print("\n--- Transactions / Dynamic Activity ---")
print("Orders:", Order.objects.count())
print("OrderItems:", OrderItem.objects.count())
print("PaymentEvidences:", PaymentEvidence.objects.count())
print("Receipts:", Receipt.objects.count())
print("WarrantyClaims:", WarrantyClaim.objects.count())
print("Carts:", Cart.objects.count())
print("CartItems:", CartItem.objects.count())
print("ProductReviews:", ProductReview.objects.count())
print("PurchaseRequests:", PurchaseRequest.objects.count())
print("PurchaseOrderItems:", PurchaseOrderItem.objects.count())
print("SupplierInvoices:", SupplierInvoice.objects.count())
print("SupplierPayments:", SupplierPayment.objects.count())
print("StockMovements:", StockMovement.objects.count())
print("Notifications:", Notification.objects.count())
print("AuditLogs:", AuditLog.objects.count())
print("EmailVerificationTokens:", EmailVerificationToken.objects.count())
print("PasswordResetTokens:", PasswordResetToken.objects.count())

print("\n--- Master Data to PRESERVE ---")
print("Categories:", Category.objects.count())
print("Products:", Product.objects.count())
print("Suppliers:", Supplier.objects.count())

try:
    from delivery.models import Courier, DeliveryOrder, DeliveryAssignment, CourierSettlement
    print("Couriers (Master):", Courier.objects.count())
    print("DeliveryOrders:", DeliveryOrder.objects.count())
    print("DeliveryAssignments:", DeliveryAssignment.objects.count())
    print("CourierSettlements:", CourierSettlement.objects.count())
except Exception as e:
    print("Delivery error:", e)
