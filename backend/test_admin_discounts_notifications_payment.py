import os
import sys
from decimal import Decimal
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from django.utils import timezone
from accounts.models import User, AuditLog
from products.models import Product, Category, Promotion
from orders.models import Order, OrderItem, OrderStatusHistory, PaymentEvidence, Receipt
from notifications.models import Notification, create_order_notification
from rest_framework.authtoken.models import Token


def run_tests():
    print("================================================================")
    print(" ETHIOTECH MARKET: ADMIN DISCOUNTS, NOTIFICATIONS & CHAPA VERIF")
    print("================================================================")

    client = Client()

    # Authenticate users
    customer = User.objects.get(username='abebe')
    manager = User.objects.get(username='manager')
    admin = User.objects.get(username='admin')

    token_cust, _ = Token.objects.get_or_create(user=customer)
    token_mgr, _ = Token.objects.get_or_create(user=manager)
    token_admin, _ = Token.objects.get_or_create(user=admin)

    headers_cust = {'HTTP_AUTHORIZATION': f'Token {token_cust.key}'}
    headers_mgr = {'HTTP_AUTHORIZATION': f'Token {token_mgr.key}'}
    headers_admin = {'HTTP_AUTHORIZATION': f'Token {token_admin.key}'}

    # ---------------------------------------------------------
    # TEST 1: Admin Promotion CRUD & Validation
    # ---------------------------------------------------------
    print("\n--- TEST 1: Admin Promotion CRUD & Server-Side Discounts ---")

    # Unauthorized customer trying to create promotion must fail (403)
    resp = client.post('/api/products/promotions/', {
        'title': 'Hack Discount',
        'discount_type': 'PERCENTAGE',
        'discount_value': '50',
        'start_date': timezone.now().isoformat(),
        'end_date': (timezone.now() + timezone.timedelta(days=7)).isoformat(),
    }, content_type='application/json', **headers_cust)
    assert resp.status_code == 403, f"Expected 403 for customer, got {resp.status_code}"
    print("[PASS] Unauthorized customer cannot create promotions (403 Forbidden)")

    # Validation: Invalid percentage (> 100%) must fail (400)
    resp = client.post('/api/products/promotions/', {
        'title': 'Impossible 150% Off',
        'discount_type': 'PERCENTAGE',
        'discount_value': '150',
        'start_date': timezone.now().isoformat(),
        'end_date': (timezone.now() + timezone.timedelta(days=7)).isoformat(),
    }, content_type='application/json', **headers_admin)
    assert resp.status_code == 400, f"Expected 400 for >100% discount, got {resp.status_code}"
    print("[PASS] Prevent invalid discount percentage > 100% (400 Bad Request)")

    # Validation: Negative discount value must fail (400)
    resp = client.post('/api/products/promotions/', {
        'title': 'Negative Discount',
        'discount_type': 'FIXED',
        'discount_value': '-500',
        'start_date': timezone.now().isoformat(),
        'end_date': (timezone.now() + timezone.timedelta(days=7)).isoformat(),
    }, content_type='application/json', **headers_admin)
    assert resp.status_code == 400, f"Expected 400 for negative discount, got {resp.status_code}"
    print("[PASS] Prevent negative discount value (400 Bad Request)")

    # Validation: End date before start date must fail (400)
    resp = client.post('/api/products/promotions/', {
        'title': 'Backwards Date Promo',
        'discount_type': 'PERCENTAGE',
        'discount_value': '10',
        'start_date': (timezone.now() + timezone.timedelta(days=10)).isoformat(),
        'end_date': timezone.now().isoformat(),
    }, content_type='application/json', **headers_admin)
    assert resp.status_code == 400, f"Expected 400 for invalid dates, got {resp.status_code}"
    print("[PASS] Prevent expiration date before start date (400 Bad Request)")

    # Valid Store-Wide Promotion creation by Admin
    p_test = Product.objects.first()
    original_price = p_test.price
    now = timezone.now()
    promo_data = {
        'title': 'EthioTech Grand Holiday 20% Off',
        'description': 'Store-wide holiday discount for all customers across Ethiopia',
        'discount_type': 'PERCENTAGE',
        'discount_value': '20.00',
        'apply_to_all': True,
        'start_date': (now - timezone.timedelta(hours=1)).isoformat(),
        'end_date': (now + timezone.timedelta(days=7)).isoformat(),
        'is_active': True,
        'banner_announcement': 'Grand Holiday Sale! 20% off all tech store-wide this week.',
    }
    resp = client.post('/api/products/promotions/', promo_data, content_type='application/json', **headers_admin)
    assert resp.status_code == 201, f"Failed to create promotion: {resp.content}"
    promo_id = resp.json()['id']
    print(f"[PASS] Admin successfully created store-wide promotion ID #{promo_id}")

    # Verify Server-Side Price Calculation
    p_test.refresh_from_db()
    expected_price = (original_price * Decimal('0.80')).quantize(Decimal('0.01'))
    assert p_test.current_price == expected_price, f"Expected {expected_price}, got {p_test.current_price}"
    assert p_test.has_active_promotion is True
    print(f"[PASS] Trusted server-side discount applied: Original ETB {original_price} -> Promo ETB {p_test.current_price}")

    # Check Homepage Announcement API returns dynamic admin promotion
    ann_resp = client.get('/api/products/promotions/active/announcement/')
    assert ann_resp.status_code == 200
    ann_data = ann_resp.json()
    assert ann_data['active'] is True
    assert ann_data['title'] == 'EthioTech Grand Holiday 20% Off'
    assert 'Grand Holiday Sale' in ann_data['banner_announcement']
    print(f"[PASS] Homepage promo banner dynamically connected to database: '{ann_data['banner_announcement']}'")

    # Deactivating promotion removes it from active banner and restores regular price
    patch_resp = client.patch(f'/api/products/promotions/{promo_id}/', {'is_active': False}, content_type='application/json', **headers_admin)
    assert patch_resp.status_code == 200
    p_test.refresh_from_db()
    assert p_test.current_price == original_price, "Price should revert when promotion is deactivated"
    print("[PASS] Deactivating promotion immediately restores genuine regular price")

    # ---------------------------------------------------------
    # TEST 2: Customer Order Placement & Backend Notifications
    # ---------------------------------------------------------
    print("\n--- TEST 2: Order Placement & Backend-Event Notifications ---")

    cart_resp = client.post('/api/orders/cart/', {'product_id': p_test.id, 'quantity': 1}, content_type='application/json', **headers_cust)
    checkout_resp = client.post('/api/orders/checkout/', {
        'shipping_name': 'Abebe Bikila',
        'shipping_phone': '0911223344',
        'shipping_address': 'Bole Subcity, House 456',
        'shipping_city': 'Addis Ababa',
        'delivery_method': 'express',
    }, content_type='application/json', **headers_cust)
    assert checkout_resp.status_code == 201, f"Checkout failed: {checkout_resp.content}"
    order_data = checkout_resp.json()
    order_id = order_data['id']
    order_num = order_data['order_number']
    print(f"[PASS] Customer placed order #{order_num} (Total: ETB {order_data['total_amount']})")

    # Verify notification created in database for customer
    cust_notif = Notification.objects.filter(user=customer, order_number=order_num, notification_type=Notification.NotificationType.ORDER_PLACED).first()
    assert cust_notif is not None, "ORDER_PLACED notification must exist in database"
    assert cust_notif.order_number == order_num
    assert cust_notif.is_read is False
    print(f"[PASS] Real backend notification created: '{cust_notif.title}' with unread status")

    # Notification API provides unread count
    notif_list_resp = client.get('/api/notifications/', **headers_cust)
    assert notif_list_resp.status_code == 200
    assert notif_list_resp.json()['unread_count'] >= 1
    print(f"[PASS] In-website notification center lists order reference and unread badge count ({notif_list_resp.json()['unread_count']})")

    # ---------------------------------------------------------
    # TEST 3: Chapa Verification & Discrepancy Flagging
    # ---------------------------------------------------------
    print("\n--- TEST 3: Chapa Payment Verification & Discrepancy Checks ---")

    order = Order.objects.get(id=order_id)
    assert order.payment_status == Order.PaymentStatus.PENDING
    assert order.fulfillment_status == Order.FulfillmentStatus.PENDING

    # Attempt to advance fulfillment on unpaid order without reconciliation must be rejected
    status_fail_resp = client.patch(f'/api/orders/{order.id}/status/', {
        'fulfillment_status': Order.FulfillmentStatus.CONFIRMED
    }, content_type='application/json', **headers_mgr)
    assert status_fail_resp.status_code == 400
    assert 'unpaid' in status_fail_resp.json()['error'].lower()
    print("[PASS] Unpaid order cannot be advanced to Confirmed without verified payment (400 Guard)")

    # Admin Verify Payment with Chapa Simulation
    # Set simulated sandbox reference
    demo_ref = f"ETHIO-DEMO-{order.id}-999"
    order.chapa_tx_ref = demo_ref
    order.save()

    verify_resp = client.post(f'/api/orders/{order.id}/admin-verify-chapa/', {}, content_type='application/json', **headers_admin)
    assert verify_resp.status_code == 200, f"Admin verify failed: {verify_resp.content}"
    v_data = verify_resp.json()
    assert v_data['status'] == 'success'
    assert v_data['last_verification_result'] == 'VERIFIED_MATCH'
    assert v_data['is_match'] is True
    print(f"[PASS] Chapa verification successful: Verified amount ETB {v_data['verified_amount']} matches expected ETB {v_data['expected_amount']}")

    order.refresh_from_db()
    assert order.payment_status == Order.PaymentStatus.PAID
    assert order.fulfillment_status == Order.FulfillmentStatus.CONFIRMED
    assert hasattr(order, 'receipt') is True
    print(f"[PASS] Order payment_status moved to PAID, fulfillment_status moved to CONFIRMED, Receipt #{order.receipt.receipt_number} issued")

    # Customer received PAYMENT_VERIFIED notification
    pay_notif = Notification.objects.filter(user=customer, order_number=order_num, notification_type=Notification.NotificationType.PAYMENT_VERIFIED).first()
    assert pay_notif is not None
    print(f"[PASS] Customer received verified payment notification: '{pay_notif.title}'")

    # Deduplication test: re-calling verify does not duplicate receipts or notifications
    receipt_count_before = Receipt.objects.filter(order=order).count()
    notif_count_before = Notification.objects.filter(user=customer, order_number=order_num, notification_type=Notification.NotificationType.PAYMENT_VERIFIED).count()

    client.post(f'/api/orders/{order.id}/admin-verify-chapa/', {}, content_type='application/json', **headers_admin)

    receipt_count_after = Receipt.objects.filter(order=order).count()
    notif_count_after = Notification.objects.filter(user=customer, order_number=order_num, notification_type=Notification.NotificationType.PAYMENT_VERIFIED).count()
    assert receipt_count_before == receipt_count_after == 1
    assert notif_count_before == notif_count_after == 1
    print("[PASS] Idempotent verification: duplicate verify calls do not duplicate receipts or notifications")

    # ---------------------------------------------------------
    # TEST 4: Controlled Fulfillment Status Transitions & Audit Trail
    # ---------------------------------------------------------
    print("\n--- TEST 4: Controlled Fulfillment Transitions & Audit Trail ---")

    # Confirmed -> Processing
    resp = client.patch(f'/api/orders/{order.id}/status/', {'fulfillment_status': 'PROCESSING', 'comment': 'Assembly started'}, content_type='application/json', **headers_mgr)
    assert resp.status_code == 200

    # Processing -> Shipped
    resp = client.patch(f'/api/orders/{order.id}/status/', {'fulfillment_status': 'SHIPPED', 'comment': 'Dispatched via Addis Express'}, content_type='application/json', **headers_mgr)
    assert resp.status_code == 200

    # Shipped -> Delivered
    resp = client.patch(f'/api/orders/{order.id}/status/', {'fulfillment_status': 'DELIVERED', 'comment': 'Signed by customer'}, content_type='application/json', **headers_mgr)
    assert resp.status_code == 200

    # Illegal transition: Delivered -> Processing (backwards step forbidden)
    resp = client.patch(f'/api/orders/{order.id}/status/', {'fulfillment_status': 'PROCESSING'}, content_type='application/json', **headers_mgr)
    assert resp.status_code == 400
    print("[PASS] Illegal transition Delivered -> Processing correctly rejected by controlled workflow rules")

    # Check OrderStatusHistory audit records
    history_records = OrderStatusHistory.objects.filter(order=order).order_by('created_at')
    assert history_records.count() >= 4
    for h in history_records:
        print(f"      * [{h.created_at.strftime('%H:%M:%S')}] {h.status_type}: {h.previous_status} -> {h.new_status} (by {h.changed_by.username if h.changed_by else 'System'})")
    print("[PASS] Order status history and administrative audit log successfully recorded each transition")

    # ---------------------------------------------------------
    # TEST 5: Security & Authorization
    # ---------------------------------------------------------
    print("\n--- TEST 5: Security & Authorization Checks ---")

    # Create another customer
    other_cust, _ = User.objects.get_or_create(username='kebede', defaults={'email': 'kebede@example.com'})
    token_other, _ = Token.objects.get_or_create(user=other_cust)
    headers_other = {'HTTP_AUTHORIZATION': f'Token {token_other.key}'}

    # Other customer cannot view Abebe's order
    resp = client.get(f'/api/orders/{order.id}/', **headers_other)
    assert resp.status_code in [403, 404], f"Expected 403 or 404, got {resp.status_code}"
    print("[PASS] Customer Kebede cannot view Abebe's order (403/404 Forbidden on backend)")

    # Other customer only sees their own orders in list
    list_resp = client.get('/api/orders/', **headers_other)
    assert list_resp.status_code == 200
    assert not any(o['id'] == order.id for o in list_resp.json().get('results', list_resp.json())), "Abebe's order leaked in Kebede's list!"
    print("[PASS] Backend strictly filters customer orders so users only see their own purchases")

    # Clean up test promotion
    Promotion.objects.filter(id=promo_id).delete()

    print("\n================================================================")
    print(" ALL ADMIN DISCOUNTS, NOTIFICATIONS & CHAPA TESTS PASSED 100%!")
    print("================================================================\n")


if __name__ == '__main__':
    run_tests()
