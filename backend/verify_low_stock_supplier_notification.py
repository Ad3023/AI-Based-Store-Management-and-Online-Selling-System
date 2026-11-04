"""
Comprehensive Automated Verification Script for:
AUTOMATIC LOW-STOCK ALERT AND SUPPLIER EMAIL NOTIFICATION
EthioTech Market E-Commerce Platform
"""

import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from products.models import (
    Product, Supplier, Category, StockMovement,
    SupplierNotificationLog, PurchaseRequest
)
from products.low_stock_service import LowStockAlertService
from orders.models import Order, OrderItem, Cart, CartItem

User = get_user_model()


def main():
    print("=" * 75)
    print("  VERIFYING AUTOMATIC LOW-STOCK ALERT & SUPPLIER EMAIL NOTIFICATION")
    print("=" * 75)

    client = APIClient()

    # 1. Retrieve or setup test users
    admin_user = User.objects.filter(role='admin').first() or User.objects.filter(is_superuser=True).first()
    store_mgr = User.objects.filter(role='store_manager').first()
    customer = User.objects.filter(role='customer').first()

    assert admin_user, "Admin user must exist"
    assert store_mgr, "Store Manager user must exist"
    assert customer, "Customer user must exist"
    print(f"[PASS] 1. Auth credentials verified: Store Manager ({store_mgr.username}), Customer ({customer.username}).")

    # 2. Setup Category and Suppliers
    category, _ = Category.objects.get_or_create(
        name="Enterprise Hardware & Laptops",
        defaults={'description': 'Corporate laptops and computing gear'}
    )

    dell_supplier, _ = Supplier.objects.get_or_create(
        name="Dell Ethiopia Distributor Ltd",
        defaults={
            'contact_person': 'Ato Getachew Tadesse',
            'email': 'gucheaddisu5@gmail.com',
            'phone': '+251 91 122 3344',
            'address': 'Bole Mega Building 4th Floor, Addis Ababa',
            'notes': 'Official certified distributor for Dell hardware.'
        }
    )
    dell_supplier.email = 'gucheaddisu5@gmail.com'
    dell_supplier.save()

    no_email_supplier, _ = Supplier.objects.get_or_create(
        name="Test Distributor Missing Email Ltd",
        defaults={
            'contact_person': 'Tesfaye Alemu',
            'email': '',  # Intentionally blank email
            'phone': '+251 91 100 0000',
            'address': 'Merkato, Addis Ababa'
        }
    )
    no_email_supplier.email = ''
    no_email_supplier.save()

    print("[PASS] 2. Verified suppliers: Dell Ethiopia Distributor (valid email) & Missing Email Supplier.")

    # 3. Setup Product A (Dell Laptop) with known stock & threshold
    product_a, _ = Product.objects.get_or_create(
        name="Dell Latitude 5540 Professional Laptop",
        defaults={
            'category': category,
            'supplier': dell_supplier,
            'description': '15.6 inch Core i7 16GB 512GB SSD Enterprise Laptop',
            'price': Decimal('78000.00'),
            'cost_price': Decimal('62000.00'),
            'stock': 12,
            'low_stock_threshold': 5,
            'reorder_quantity': 20,
            'low_stock_notified': False,
            'is_active': True
        }
    )
    product_a.supplier = dell_supplier
    product_a.stock = 12
    product_a.low_stock_threshold = 5
    product_a.reorder_quantity = 20
    product_a.low_stock_notified = False
    product_a.save()

    print(f"[PASS] 3. Product '{product_a.name}' configured: Stock=12, Min Level=5, Reorder Qty=20.")

    # 4. Healthy stock check: No alert triggered when stock > threshold
    res_healthy = LowStockAlertService.evaluate_and_notify_product(product_a)
    assert res_healthy['alert_needed'] is False
    assert res_healthy['status'] == 'HEALTHY'
    print(f"[PASS] 4. Healthy stock check passed: No alert sent when stock ({product_a.stock}) > threshold ({product_a.low_stock_threshold}).")

    # 5. Inventory adjustment: Stock reduced to 4 (<= low_stock_threshold 5)
    client.force_authenticate(user=store_mgr)
    adjust_resp = client.post('/api/products/inventory/', {
        'product_id': product_a.id,
        'quantity': -8,  # 12 - 8 = 4 units
        'movement_type': 'ADJUSTMENT',
        'reference': 'Audit stock adjustment'
    }, format='json')
    assert adjust_resp.status_code == status.HTTP_200_OK or adjust_resp.status_code == status.HTTP_201_CREATED
    product_a.refresh_from_db()
    assert product_a.stock == 4
    assert product_a.is_low_stock is True
    print(f"[PASS] 5. Stock reduced to 4 units: Product correctly identified as LOW STOCK (4 <= 5).")

    # 6. Automatic Supplier Email Verification
    product_a.refresh_from_db()
    assert product_a.low_stock_notified is True, "low_stock_notified must be set to True"
    assert product_a.last_low_stock_notification is not None, "Notification timestamp must be recorded"

    latest_log = SupplierNotificationLog.objects.filter(product=product_a).first()
    assert latest_log is not None, "Notification log entry must be created"
    assert latest_log.status == SupplierNotificationLog.Status.SENT, "Log status must be SENT"
    assert latest_log.supplier_email == 'gucheaddisu5@gmail.com'
    assert latest_log.current_stock == 4
    assert latest_log.min_stock_level == 5
    assert latest_log.reorder_quantity == 20
    assert "Dell Latitude 5540" in latest_log.subject
    print(f"[PASS] 6. Automatic supplier email sent to {latest_log.supplier_email}: Logged with ID #{latest_log.id}.")

    # 7. Duplicate Prevention Test
    dup_res = LowStockAlertService.evaluate_and_notify_product(product_a, trigger_type='AUTOMATIC')
    assert dup_res['alert_needed'] is False
    assert dup_res['status'] == 'ALREADY_NOTIFIED'
    count_logs_before = SupplierNotificationLog.objects.filter(product=product_a).count()
    print(f"[PASS] 7. Duplicate prevention verified: Subsequent check blocked duplicate email alert.")

    # 8. Manual Resend by Store Manager API
    client.force_authenticate(user=store_mgr)
    resend_resp = client.post(f'/api/products/items/{product_a.id}/resend-supplier-alert/', {}, format='json')
    assert resend_resp.status_code == status.HTTP_200_OK
    assert resend_resp.data['success'] is True
    assert resend_resp.data['status'] == 'SENT'
    count_logs_after = SupplierNotificationLog.objects.filter(product=product_a).count()
    assert count_logs_after == count_logs_before + 1
    new_log = SupplierNotificationLog.objects.filter(product=product_a).first()
    assert new_log.trigger_type == SupplierNotificationLog.TriggerType.MANUAL_RESEND
    print(f"[PASS] 8. Manual resend API succeeded: Store Manager resent email, recorded with trigger_type='MANUAL_RESEND'.")

    # 9. Replenishment Cycle Reset Test
    # Restock product above threshold (e.g. +16 units -> 20 units)
    product_a.stock = 20
    product_a.save()
    product_a.refresh_from_db()
    assert product_a.stock == 20
    assert product_a.low_stock_notified is False, "low_stock_notified must reset to False when stock > threshold"
    print(f"[PASS] 9. Stock replenished to 20 units: Duplicate prevention flag automatically reset to False.")

    # Subsequent sale drops stock to 3 units: should trigger a fresh alert for new cycle!
    product_a.stock = 3
    product_a.save()
    new_cycle_res = LowStockAlertService.evaluate_and_notify_product(product_a, trigger_type='AUTOMATIC')
    assert new_cycle_res['success'] is True
    assert new_cycle_res['status'] == 'SENT'
    product_a.refresh_from_db()
    assert product_a.low_stock_notified is True
    print(f"[PASS] 10. Fresh notification sent for new low-stock cycle when stock dropped to 3 units.")

    # 11. Missing Supplier Alert Test (Product with supplier=None)
    product_no_sup, _ = Product.objects.get_or_create(
        name="Generic Unbranded HDMI Adapter Cable",
        defaults={
            'category': category,
            'supplier': None,
            'description': 'HDMI 4K Cable',
            'price': Decimal('450.00'),
            'stock': 2,
            'low_stock_threshold': 5,
            'reorder_quantity': 50,
            'low_stock_notified': False,
            'is_active': True
        }
    )
    product_no_sup.supplier = None
    product_no_sup.stock = 2
    product_no_sup.low_stock_threshold = 5
    product_no_sup.low_stock_notified = False
    product_no_sup.save()

    res_no_sup = LowStockAlertService.evaluate_and_notify_product(product_no_sup)
    assert res_no_sup['success'] is False
    assert res_no_sup['missing_supplier'] is True
    assert "no supplier assigned" in res_no_sup['error'].lower()
    log_no_sup = SupplierNotificationLog.objects.filter(product=product_no_sup).first()
    assert log_no_sup.status == SupplierNotificationLog.Status.FAILED
    print(f"[PASS] 11. Missing supplier handled safely: Logged as FAILED with error '{log_no_sup.error_message}'.")

    # 12. Missing Supplier Email Alert Test (Supplier email='')
    product_no_email, _ = Product.objects.get_or_create(
        name="Keychron Mechanical Switch Replacements",
        defaults={
            'category': category,
            'supplier': no_email_supplier,
            'description': 'Gateron Red mechanical switches pack of 35',
            'price': Decimal('1200.00'),
            'stock': 3,
            'low_stock_threshold': 5,
            'reorder_quantity': 30,
            'low_stock_notified': False,
            'is_active': True
        }
    )
    product_no_email.supplier = no_email_supplier
    product_no_email.stock = 3
    product_no_email.low_stock_threshold = 5
    product_no_email.low_stock_notified = False
    product_no_email.save()

    res_no_email = LowStockAlertService.evaluate_and_notify_product(product_no_email)
    assert res_no_email['success'] is False
    assert "no valid email" in res_no_email['error'].lower()
    log_no_email = SupplierNotificationLog.objects.filter(product=product_no_email).first()
    assert log_no_email.status == SupplierNotificationLog.Status.FAILED
    print(f"[PASS] 12. Supplier without email handled safely: Logged as FAILED with error '{log_no_email.error_message}'.")

    # 13. Low Stock Management List API Test
    client.force_authenticate(user=store_mgr)
    list_resp = client.get('/api/products/low-stock/')
    assert list_resp.status_code == status.HTTP_200_OK
    assert 'products' in list_resp.data
    assert list_resp.data['count'] >= 3
    assert list_resp.data['missing_supplier_count'] >= 1
    assert list_resp.data['missing_email_count'] >= 1
    print(f"[PASS] 13. Low Stock Management List API: Returned {list_resp.data['count']} items (Missing Supplier: {list_resp.data['missing_supplier_count']}, Missing Email: {list_resp.data['missing_email_count']}).")

    # 14. Purchase Request Creation (Review & Approval Workflow)
    pr_create_resp = client.post('/api/products/purchase-requests/', {
        'product': product_a.id,
        'quantity': 20,
        'estimated_unit_cost': '62000.00',
        'notes': 'Please confirm stock availability and earliest dispatch date.'
    }, format='json')
    assert pr_create_resp.status_code == status.HTTP_201_CREATED
    pr_id = pr_create_resp.data['id']
    pr_req_num = pr_create_resp.data['request_number']
    assert pr_create_resp.data['status'] == 'SUBMITTED', "Purchase request must start in SUBMITTED state"
    assert pr_create_resp.data['total_estimated_cost'] == '1240000.00'
    print(f"[PASS] 14. Purchase Request {pr_req_num} created in SUBMITTED state (Total: ETB {pr_create_resp.data['total_estimated_cost']}).")

    # 15. Store Manager Review & Approval
    pr_approve_resp = client.patch(f'/api/products/purchase-requests/{pr_id}/', {
        'status': 'APPROVED'
    }, format='json')
    assert pr_approve_resp.status_code == status.HTTP_200_OK
    assert pr_approve_resp.data['status'] == 'APPROVED'
    assert pr_approve_resp.data['approved_by_username'] == store_mgr.username
    print(f"[PASS] 15. Store Manager approved Purchase Request {pr_req_num}.")

    # 16. Receive Physical Stock & Restock Inventory API
    initial_stock = product_a.stock
    receive_resp = client.post(f'/api/products/purchase-requests/{pr_id}/receive-stock/', {}, format='json')
    assert receive_resp.status_code == status.HTTP_200_OK
    assert receive_resp.data['success'] is True
    product_a.refresh_from_db()
    assert product_a.stock == initial_stock + 20
    assert product_a.low_stock_notified is False, "Stock replenishment must reset low_stock_notified"

    # Verify StockMovement was created
    latest_movement = StockMovement.objects.filter(product=product_a).first()
    assert latest_movement.movement_type == StockMovement.MovementType.RESTOCK
    assert latest_movement.quantity == 20
    print(f"[PASS] 16. Stock received (+20 units): New stock={product_a.stock}, RESTOCK movement logged, replenishment cycle reset.")

    # 17. Checkout Sale Integration: Stock decrement triggers low stock check
    # Set product stock to 6, threshold 5. Customer buys 2 units -> stock becomes 4 (triggers low stock!)
    product_a.stock = 6
    product_a.low_stock_notified = False
    product_a.save()

    client.force_authenticate(user=customer)
    cart, _ = Cart.objects.get_or_create(user=customer)
    cart.items.all().delete()
    CartItem.objects.create(cart=cart, product=product_a, quantity=2)

    checkout_resp = client.post('/api/orders/checkout/', {
        'shipping_name': 'Abebe Bikila',
        'shipping_phone': '+251911223344',
        'shipping_city': 'Addis Ababa',
        'shipping_address': 'Bole Subcity, Woreda 03',
        'payment_method': 'MANUAL_TELEBIRR',
        'delivery_method': 'THIRD_PARTY_COURIER'
    }, format='json')
    assert checkout_resp.status_code == status.HTTP_201_CREATED
    order_num = checkout_resp.data['order_number']
    product_a.refresh_from_db()
    assert product_a.stock == 4, f"Stock should be 4 after purchasing 2 units, got {product_a.stock}"
    assert product_a.low_stock_notified is True, "Checkout sale must trigger automatic supplier alert!"
    print(f"[PASS] 17. Customer Order #{order_num}: Stock reduced to 4 units during checkout -> Automatic low-stock alert triggered.")

    # 18. Order Rejection Stock Return Integration
    # When Order Manager rejects the order, the 2 units are returned to stock (4 + 2 = 6 units)
    order_obj = Order.objects.get(order_number=order_num)
    order_mgr = User.objects.filter(role='order_manager').first()
    client.force_authenticate(user=order_mgr)
    reject_resp = client.patch(f'/api/orders/{order_obj.id}/status/', {
        'status': 'REJECTED',
        'reason': 'Customer requested cancellation.'
    }, format='json')
    assert reject_resp.status_code == status.HTTP_200_OK
    product_a.refresh_from_db()
    assert product_a.stock == 6, f"Stock should be restored to 6 units after rejection, got {product_a.stock}"
    assert product_a.low_stock_notified is False, "Returning stock above threshold must reset low_stock_notified"
    print(f"[PASS] 18. Order #{order_num} rejection: 2 units returned to inventory -> Stock restored to 6 units & cycle reset.")

    print("=" * 75)
    print("  ALL 18 AUTOMATIC LOW-STOCK & SUPPLIER NOTIFICATION CHECKS PASSED!")
    print("=" * 75)


if __name__ == '__main__':
    main()
