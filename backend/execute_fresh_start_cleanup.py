"""
Controlled Database Cleanup and Fresh Start Script for EthioTech Market.

Preserves ONLY the user-confirmed staff accounts:
- addisuguche68@gmail.com (addisuguche_admin — Administrator / Superuser)
- gucheaddisu10@gmail.com (gucheaddisu10 — Store Manager)

Deletes:
- All other staff accounts (meseretguche01@gmail.com, ordermanager@ethiotech.com, gucheaddisu_manager, etc.)
- All customer accounts
- All customer orders, order items, payment evidence, receipts, warranty claims, and carts
- All shipments, tracking events, OTPs, delivery attempts, complaints, and courier settlements
- All purchase requests, PO items, supplier invoices, and supplier payments
- All historical stock movements, notification logs, email/password tokens, and audit logs

Preserves:
- All master product categories
- All master products (keeps active, catalog intact)
- All master suppliers
- All master courier companies, vehicles, delivery fee rules, and delivery settings
- Platform settings, permissions, and roles
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from django.contrib.auth import get_user_model

from products.models import (
    Category, Product, Supplier,
    PurchaseRequest, PurchaseOrderItem,
    SupplierInvoice, SupplierPayment,
    StockMovement, StockAlertHistory, SupplierNotificationLog,
    ProductReview
)
from orders.models import (
    Order, OrderItem, PaymentEvidence, Receipt, WarrantyClaim,
    Cart, CartItem
)
from delivery.models import (
    CourierCompany, DeliveryVehicle, DeliveryPersonnel,
    DeliveryFeeRule, DeliverySetting,
    Shipment, ShipmentTrackingEvent, DeliveryOTP, DeliveryAttempt,
    DeliveryComplaint, CourierSettlement
)
from notifications.models import Notification
from accounts.models import (
    EmailVerificationToken, PasswordResetToken, AuditLog
)

User = get_user_model()

KEPT_EMAILS = [
    'addisuguche68@gmail.com',
    'gucheaddisu10@gmail.com'
]

def execute_cleanup():
    print("======================================================================")
    print("STARTING CONTROLLED DATABASE CLEANUP & FRESH START")
    print("======================================================================")

    # 1. Verify kept accounts exist
    kept_users = list(User.objects.filter(email__in=KEPT_EMAILS))
    print(f"[*] Verified kept accounts to preserve ({len(kept_users)}):")
    for u in kept_users:
        print(f"    - ID: {u.id} | Email: {u.email} | Username: {u.username} | Role: {u.role} | Superuser: {u.is_superuser}")

    assert len(kept_users) >= 2, f"Expected at least 2 kept accounts matching {KEPT_EMAILS}, found {len(kept_users)}"

    kept_ids = [u.id for u in kept_users]

    with transaction.atomic():
        # A. Clean dynamic Delivery & Shipment transactions
        print("\n--- Cleaning Delivery & Shipment Transactions ---")
        cnt_settle = CourierSettlement.objects.all().delete()[0]
        cnt_complaints = DeliveryComplaint.objects.all().delete()[0]
        cnt_attempts = DeliveryAttempt.objects.all().delete()[0]
        cnt_otps = DeliveryOTP.objects.all().delete()[0]
        cnt_events = ShipmentTrackingEvent.objects.all().delete()[0]
        cnt_shipments = Shipment.objects.all().delete()[0]
        print(f"[+] Deleted {cnt_shipments} shipments, {cnt_events} tracking events, {cnt_otps} delivery OTPs, {cnt_settle} settlements.")

        # B. Clean dynamic Orders & Payments transactions
        print("\n--- Cleaning Customer Orders & Payments ---")
        cnt_claims = WarrantyClaim.objects.all().delete()[0]
        cnt_receipts = Receipt.objects.all().delete()[0]
        cnt_evidence = PaymentEvidence.objects.all().delete()[0]
        cnt_order_items = OrderItem.objects.all().delete()[0]
        cnt_orders = Order.objects.all().delete()[0]
        cnt_cart_items = CartItem.objects.all().delete()[0]
        cnt_carts = Cart.objects.all().delete()[0]
        print(f"[+] Deleted {cnt_orders} orders, {cnt_order_items} items, {cnt_evidence} payment evidence, {cnt_receipts} receipts, {cnt_claims} warranty claims.")

        # C. Clean dynamic Procurement & Supplier transactions
        print("\n--- Cleaning Supplier Procurement & Payment Transactions ---")
        cnt_supp_pmts = SupplierPayment.objects.all().delete()[0]
        cnt_supp_inv = SupplierInvoice.objects.all().delete()[0]
        cnt_po_items = PurchaseOrderItem.objects.all().delete()[0]
        cnt_pos = PurchaseRequest.objects.all().delete()[0]
        cnt_logs = SupplierNotificationLog.objects.all().delete()[0]
        cnt_alerts = StockAlertHistory.objects.all().delete()[0]
        cnt_movements = StockMovement.objects.all().delete()[0]
        cnt_reviews = ProductReview.objects.all().delete()[0]
        print(f"[+] Deleted {cnt_pos} purchase requests, {cnt_po_items} items, {cnt_supp_inv} invoices, {cnt_supp_pmts} payments, {cnt_movements} stock movement logs.")

        # D. Clean Notifications & Activity
        print("\n--- Cleaning Notifications & Security Tokens ---")
        cnt_notifs = Notification.objects.all().delete()[0]
        cnt_email_toks = EmailVerificationToken.objects.all().delete()[0]
        cnt_pw_toks = PasswordResetToken.objects.all().delete()[0]
        cnt_audits = AuditLog.objects.all().delete()[0]
        print(f"[+] Deleted {cnt_notifs} notifications, {cnt_email_toks} verification tokens, {cnt_pw_toks} reset tokens, {cnt_audits} audit logs.")

        # E. Clean User Accounts NOT in KEPT_EMAILS
        print("\n--- Cleaning User Accounts ---")
        users_to_delete = User.objects.exclude(id__in=kept_ids)
        print(f"[*] Accounts being removed ({users_to_delete.count()}):")
        for u in users_to_delete:
            print(f"    - Removing: ID: {u.id} | Email: '{u.email}' | Username: {u.username} | Role: {u.role}")

        cnt_users = users_to_delete.delete()[0]
        print(f"[+] Deleted {cnt_users} unauthorized/customer/test user accounts.")

        # F. Ensure both kept users have a clean Cart initialized
        for u in kept_users:
            Cart.objects.get_or_create(user=u)

        # G. Reset any notification flags on master products
        Product.objects.all().update(
            low_stock_notified=False,
            out_of_stock_notified=False
        )

    print("\n======================================================================")
    print("CLEANUP COMPLETED SUCCESSFULLY! VERIFYING POST-CLEANUP DATABASE STATE:")
    print("======================================================================")
    remaining_users = list(User.objects.all().order_by('id'))
    print(f"Remaining Users ({len(remaining_users)}):")
    for u in remaining_users:
        print(f"  - ID: {u.id} | Email: {u.email} | Username: {u.username} | Role: {u.role} | Superuser: {u.is_superuser}")

    print("\nMaster Data Preserved:")
    print(f"  - Product Categories: {Category.objects.count()}")
    print(f"  - Products: {Product.objects.count()}")
    print(f"  - Suppliers: {Supplier.objects.count()}")
    print(f"  - Courier Companies: {CourierCompany.objects.count()}")
    print(f"  - Delivery Vehicles: {DeliveryVehicle.objects.count()}")
    print(f"  - Delivery Personnel: {DeliveryPersonnel.objects.count()}")
    print(f"  - Delivery Fee Rules: {DeliveryFeeRule.objects.count()}")

    print("\nDynamic Transactions Remaining:")
    print(f"  - Orders: {Order.objects.count()}")
    print(f"  - Order Items: {OrderItem.objects.count()}")
    print(f"  - Payment Evidence: {PaymentEvidence.objects.count()}")
    print(f"  - Receipts: {Receipt.objects.count()}")
    print(f"  - Purchase Requests: {PurchaseRequest.objects.count()}")
    print(f"  - Supplier Invoices: {SupplierInvoice.objects.count()}")
    print(f"  - Supplier Payments: {SupplierPayment.objects.count()}")
    print(f"  - Shipments: {Shipment.objects.count()}")
    print(f"  - Carts (1 for each kept staff): {Cart.objects.count()}")

    print("======================================================================")

if __name__ == '__main__':
    execute_cleanup()

