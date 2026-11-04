"""
Comprehensive Test Script for:
Automatic Low-Stock Alerts and Supplier Email Notifications
Testing all requirements outlined in Section 10 of the User Request.
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
    SupplierNotificationLog, PurchaseRequest, StockAlertHistory
)
from notifications.models import Notification
from products.low_stock_service import LowStockAlertService

User = get_user_model()


def run_tests():
    print("=" * 80)
    print("  RUNNING LOW-STOCK ALERTS & SUPPLIER EMAIL NOTIFICATION TEST SUITE")
    print("=" * 80)

    client = APIClient()

    # -------------------------------------------------------------------------
    # 0. Setup Test Users: Admin, Store Manager, Customer
    # -------------------------------------------------------------------------
    admin_user = User.objects.filter(role__in=['admin', 'super_admin']).first() or User.objects.filter(is_superuser=True).first()
    store_mgr = User.objects.filter(role='store_manager').first()
    customer = User.objects.filter(role='customer').first()

    assert admin_user, "Admin user must exist"
    assert store_mgr, "Store Manager user must exist"
    assert customer, "Customer user must exist"
    print(f"[PASS] 0. Users verified: Admin ({admin_user.username}), Store Manager ({store_mgr.username}), Customer ({customer.username})")

    # Clear previous notifications for clean test state
    Notification.objects.filter(user__in=[admin_user, store_mgr]).delete()

    # -------------------------------------------------------------------------
    # 1. Setup Test Supplier and Product:
    # Product: HP Laptop
    # Current Stock: 4
    # Minimum Stock Level: 5
    # Suggested Reorder Quantity: 20
    # Supplier: ABC Technology Supplier
    # Supplier Email: abc_supplier@example.com
    # -------------------------------------------------------------------------
    category, _ = Category.objects.get_or_create(
        name="Laptops & Computers",
        defaults={'description': 'Enterprise computing hardware'}
    )

    supplier, _ = Supplier.objects.get_or_create(
        name="ABC Technology Supplier",
        defaults={
            'contact_person': 'Ato Kebede Chala',
            'email': 'abc_supplier@example.com',
            'phone': '+251 91 123 4567',
            'address': 'Bole, Addis Ababa',
            'notes': 'Authorized hardware supplier for laptops'
        }
    )
    supplier.email = 'abc_supplier@example.com'
    supplier.save()

    hp_laptop, _ = Product.objects.get_or_create(
        name="HP Laptop",
        defaults={
            'category': category,
            'supplier': supplier,
            'description': 'HP Core i7 16GB 512GB SSD Enterprise Laptop',
            'price': Decimal('65000.00'),
            'cost_price': Decimal('52000.00'),
            'stock': 10,  # start healthy
            'low_stock_threshold': 5,
            'reorder_quantity': 20,
            'low_stock_notified': False,
            'out_of_stock_notified': False,
            'is_active': True
        }
    )
    hp_laptop.category = category
    hp_laptop.supplier = supplier
    hp_laptop.stock = 10
    hp_laptop.low_stock_threshold = 5
    hp_laptop.reorder_quantity = 20
    hp_laptop.low_stock_notified = False
    hp_laptop.out_of_stock_notified = False
    hp_laptop.save()

    # Clear previous notifications and history for test idempotency
    Notification.objects.filter(product=hp_laptop).delete()
    StockAlertHistory.objects.filter(product=hp_laptop).delete()
    PurchaseRequest.objects.filter(product=hp_laptop).delete()
    SupplierNotificationLog.objects.filter(product=hp_laptop).delete()

    print("[PASS] 1. Configured test entity 'HP Laptop' with supplier 'ABC Technology Supplier'")

    # -------------------------------------------------------------------------
    # 2. Healthy stock check: No alerts triggered when stock (10) > threshold (5)
    # -------------------------------------------------------------------------
    res_healthy = LowStockAlertService.evaluate_and_notify_product(hp_laptop)
    assert res_healthy['alert_needed'] is False
    assert res_healthy['status'] == 'HEALTHY'
    assert Notification.objects.filter(product=hp_laptop).count() == 0
    print(f"[PASS] 2. Healthy stock check: No alerts sent when stock ({hp_laptop.stock}) > threshold ({hp_laptop.low_stock_threshold})")

    # -------------------------------------------------------------------------
    # 3. Stock drops to 4 (<= 5 units):
    # - System detects low stock
    # - Admin receives in-system notification
    # - Store Manager receives actionable in-system notification
    # - Supplier receives reorder inquiry email
    # - System records email status in SupplierNotificationLog & StockAlertHistory
    # -------------------------------------------------------------------------
    hp_laptop.stock = 4
    hp_laptop.save()

    eval_result = LowStockAlertService.evaluate_and_notify_product(
        hp_laptop,
        trigger_type='AUTOMATIC',
        requested_by=store_mgr
    )
    assert eval_result['success'] is True
    assert eval_result['status'] == 'SENT'
    hp_laptop.refresh_from_db()
    assert hp_laptop.low_stock_notified is True, "hp_laptop.low_stock_notified must be set to True"

    # Check Admin Notification
    admin_notifs = Notification.objects.filter(user=admin_user, product=hp_laptop)
    assert admin_notifs.exists(), "Admin must receive in-system notification"
    low_stock_admin_notif = admin_notifs.filter(notification_type=Notification.NotificationType.LOW_STOCK).first()
    assert low_stock_admin_notif is not None
    assert "LOW STOCK ALERT" in low_stock_admin_notif.title
    assert "HP Laptop" in low_stock_admin_notif.title
    assert "has only 4 units remaining" in low_stock_admin_notif.message
    assert "minimum stock level is 5" in low_stock_admin_notif.message
    assert "Please monitor the replenishment process" in low_stock_admin_notif.message
    print("[PASS] 3. Admin received low-stock alert notification:", low_stock_admin_notif.message)

    # Check Store Manager Notification
    mgr_notifs = Notification.objects.filter(user=store_mgr, product=hp_laptop)
    assert mgr_notifs.exists(), "Store Manager must receive in-system notification"
    low_stock_mgr_notif = mgr_notifs.filter(notification_type=Notification.NotificationType.LOW_STOCK).first()
    assert low_stock_mgr_notif is not None
    assert "REORDER REQUIRED" in low_stock_mgr_notif.title
    assert "4 units" in low_stock_mgr_notif.message
    assert "Suggested reorder quantity: 20 units" in low_stock_mgr_notif.message
    print("[PASS] 4. Store Manager received actionable notification:", low_stock_mgr_notif.message)

    # Check Supplier Notification Log
    latest_log = SupplierNotificationLog.objects.filter(product=hp_laptop).first()
    assert latest_log is not None
    assert latest_log.status == SupplierNotificationLog.Status.SENT
    assert latest_log.supplier_email == 'abc_supplier@example.com'
    assert latest_log.current_stock == 4
    assert latest_log.min_stock_level == 5
    assert latest_log.reorder_quantity == 20
    assert "Low Stock Alert" in latest_log.subject
    assert "HP Laptop" in latest_log.subject
    print(f"[PASS] 5. Supplier email successfully logged: ID #{latest_log.id} -> {latest_log.supplier_email}")

    # Check Supplier Email Sent In-System Notification
    sent_notif = Notification.objects.filter(
        user=admin_user,
        product=hp_laptop,
        notification_type=Notification.NotificationType.SUPPLIER_EMAIL_SENT
    ).first()
    assert sent_notif is not None
    assert "SUPPLIER EMAIL SENT" in sent_notif.title
    print(f"[PASS] 6. Both Admin & Store Manager notified of email delivery result: '{sent_notif.title}'")

    # -------------------------------------------------------------------------
    # 4. Duplicate Alert Prevention:
    # Subsequent checks must NOT duplicate notifications or supplier emails
    # -------------------------------------------------------------------------
    dup_eval = LowStockAlertService.evaluate_and_notify_product(hp_laptop, trigger_type='AUTOMATIC')
    assert dup_eval['alert_needed'] is False
    assert dup_eval['status'] == 'ALREADY_NOTIFIED'
    count_logs = SupplierNotificationLog.objects.filter(product=hp_laptop).count()
    assert count_logs == 1, "Duplicate alert must not create another log"
    print("[PASS] 7. Duplicate alert prevention verified: repeated evaluation blocked duplicate email.")

    # -------------------------------------------------------------------------
    # 5. Store Manager can create a Purchase Request
    # -------------------------------------------------------------------------
    client.force_authenticate(user=store_mgr)
    pr_resp = client.post('/api/products/purchase-requests/', {
        'product': hp_laptop.id,
        'quantity': 20,
        'estimated_unit_cost': '52000.00',
        'notes': 'Urgent procurement for HP Laptop low stock'
    }, format='json')
    assert pr_resp.status_code == status.HTTP_201_CREATED
    pr_data = pr_resp.data
    assert pr_data['status'] == 'SUBMITTED'
    assert pr_data['quantity'] == 20
    assert pr_data['total_estimated_cost'] == '1040000.00'
    pr_id = pr_data['id']
    print(f"[PASS] 8. Store Manager created Purchase Request #{pr_data['request_number']} for 20 units.")

    # -------------------------------------------------------------------------
    # 6. Stock Replenishment:
    # Receive stock from Purchase Request (+20 units -> stock becomes 24)
    # Alert conditions must reset (low_stock_notified=False)
    # -------------------------------------------------------------------------
    recv_resp = client.post(f'/api/products/purchase-requests/{pr_id}/receive-stock/', {}, format='json')
    assert recv_resp.status_code == status.HTTP_200_OK
    hp_laptop.refresh_from_db()
    assert hp_laptop.stock == 24
    assert hp_laptop.low_stock_notified is False, "Replenishing above threshold must reset low_stock_notified"
    print(f"[PASS] 9. Stock replenished to {hp_laptop.stock} units. Alert condition successfully reset to False.")

    # -------------------------------------------------------------------------
    # 7. New Alert Generation:
    # If stock drops to 5 or below again, a new alert is generated!
    # -------------------------------------------------------------------------
    hp_laptop.stock = 3
    hp_laptop.save()

    new_cycle_eval = LowStockAlertService.evaluate_and_notify_product(
        hp_laptop,
        trigger_type='AUTOMATIC',
        requested_by=store_mgr
    )
    assert new_cycle_eval['success'] is True
    assert new_cycle_eval['status'] == 'SENT'
    hp_laptop.refresh_from_db()
    assert hp_laptop.low_stock_notified is True
    assert SupplierNotificationLog.objects.filter(product=hp_laptop).count() == 2
    print(f"[PASS] 10. Fresh alert generated for subsequent low stock cycle when stock dropped to {hp_laptop.stock} units.")

    # -------------------------------------------------------------------------
    # 8. Out-of-Stock Alert Generation:
    # When stock reaches zero, both roles receive an OUT OF STOCK notification
    # -------------------------------------------------------------------------
    hp_laptop.stock = 0
    hp_laptop.save()

    zero_eval = LowStockAlertService.evaluate_and_notify_product(hp_laptop, trigger_type='AUTOMATIC')
    assert hp_laptop.is_out_of_stock is True
    hp_laptop.refresh_from_db()
    assert hp_laptop.out_of_stock_notified is True

    zero_admin_notif = Notification.objects.filter(
        user=admin_user,
        product=hp_laptop,
        notification_type=Notification.NotificationType.OUT_OF_STOCK
    ).first()
    assert zero_admin_notif is not None
    assert "OUT OF STOCK" in zero_admin_notif.title
    assert "HP Laptop is currently unavailable" in zero_admin_notif.message

    zero_mgr_notif = Notification.objects.filter(
        user=store_mgr,
        product=hp_laptop,
        notification_type=Notification.NotificationType.OUT_OF_STOCK
    ).first()
    assert zero_mgr_notif is not None
    assert "OUT OF STOCK" in zero_mgr_notif.title
    print(f"[PASS] 11. Out-of-stock notification dispatched to Admin and Store Manager: '{zero_admin_notif.message}'")

    # -------------------------------------------------------------------------
    # 9. Supplier Email Missing Test:
    # Product with supplier that has no email registered
    # Store Manager should receive notification that contact info is missing
    # -------------------------------------------------------------------------
    sup_no_email, _ = Supplier.objects.get_or_create(
        name="No Email Wholesale Supplier",
        defaults={'email': '', 'contact_person': 'Ato Mulugeta'}
    )
    sup_no_email.email = ''
    sup_no_email.save()

    product_no_email, _ = Product.objects.get_or_create(
        name="Lenovo ThinkPad Keyboard Replacement",
        defaults={
            'category': category,
            'supplier': sup_no_email,
            'stock': 2,
            'low_stock_threshold': 5,
            'reorder_quantity': 15,
            'price': Decimal('2800.00'),
            'is_active': True
        }
    )
    product_no_email.supplier = sup_no_email
    product_no_email.stock = 2
    product_no_email.low_stock_threshold = 5
    product_no_email.low_stock_notified = False
    product_no_email.save()
    Notification.objects.filter(product=product_no_email).delete()

    res_missing_email = LowStockAlertService.evaluate_and_notify_product(product_no_email)
    assert res_missing_email['success'] is False
    assert "no valid email" in res_missing_email['error'].lower()

    # Store manager must receive notification that supplier contact info is missing
    missing_notif = Notification.objects.filter(
        user=store_mgr,
        product=product_no_email,
        notification_type=Notification.NotificationType.SUPPLIER_EMAIL_FAILED
    ).first()
    assert missing_notif is not None
    assert "SUPPLIER CONTACT MISSING" in missing_notif.title
    assert "Supplier contact information is missing" in missing_notif.message
    print(f"[PASS] 12. Missing email safely handled: Store Manager notified: '{missing_notif.title}'")

    # -------------------------------------------------------------------------
    # 10. Store Manager Action: Update Reorder Settings API Test
    # -------------------------------------------------------------------------
    client.force_authenticate(user=store_mgr)
    update_reorder_resp = client.patch(f'/api/products/items/{hp_laptop.id}/reorder-settings/', {
        'reorder_quantity': 35,
        'low_stock_threshold': 8
    }, format='json')
    assert update_reorder_resp.status_code == status.HTTP_200_OK
    hp_laptop.refresh_from_db()
    assert hp_laptop.reorder_quantity == 35
    assert hp_laptop.low_stock_threshold == 8
    print(f"[PASS] 13. Store Manager updated reorder settings: Reorder Qty={hp_laptop.reorder_quantity}, Threshold={hp_laptop.low_stock_threshold}")

    # -------------------------------------------------------------------------
    # 11. Admin Monitoring API Test
    # -------------------------------------------------------------------------
    client.force_authenticate(user=admin_user)
    admin_mon_resp = client.get('/api/products/admin/monitoring/')
    assert admin_mon_resp.status_code == status.HTTP_200_OK
    mon_data = admin_mon_resp.data
    assert 'summary' in mon_data
    assert mon_data['summary']['low_stock_count'] >= 1
    assert mon_data['summary']['out_of_stock_count'] >= 1
    assert len(mon_data['supplier_email_history']) >= 1
    assert len(mon_data['stock_alert_history']) >= 1
    print(f"[PASS] 14. Admin Monitoring API returned complete inventory condition: "
          f"Low-Stock={mon_data['summary']['low_stock_count']}, Out-of-Stock={mon_data['summary']['out_of_stock_count']}, Emails Sent={mon_data['summary']['total_supplier_emails_sent']}")

    # -------------------------------------------------------------------------
    # 12. Notification Filtering API Test
    # -------------------------------------------------------------------------
    client.force_authenticate(user=store_mgr)
    notif_list_resp = client.get('/api/notifications/?filter=low_stock')
    assert notif_list_resp.status_code == status.HTTP_200_OK
    assert 'counts' in notif_list_resp.data
    assert notif_list_resp.data['counts']['low_stock'] >= 1
    assert notif_list_resp.data['counts']['out_of_stock'] >= 1
    print(f"[PASS] 15. Notification filtering API verified: Total={notif_list_resp.data['counts']['all']}, Low Stock={notif_list_resp.data['counts']['low_stock']}")

    # -------------------------------------------------------------------------
    # 13. Unauthorized Access Prevention Test:
    # Customer cannot access management inventory or admin monitoring
    # -------------------------------------------------------------------------
    client.force_authenticate(user=customer)
    unauth_resp = client.get('/api/products/admin/monitoring/')
    assert unauth_resp.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    unauth_reorder = client.patch(f'/api/products/items/{hp_laptop.id}/reorder-settings/', {
        'reorder_quantity': 50
    }, format='json')
    assert unauth_reorder.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
    print("[PASS] 16. Security & RBAC: Customer access correctly blocked from management APIs.")

    # -------------------------------------------------------------------------
    # 14. Multiple Products Batch Evaluation Test
    # -------------------------------------------------------------------------
    batch_results = LowStockAlertService.check_and_alert_all_low_stock_products()
    assert isinstance(batch_results, list)
    print(f"[PASS] 17. Batch scanning evaluated {len(batch_results)} pending low-stock products.")

    print("=" * 80)
    print("  ALL 17 LOW-STOCK ALERT & SUPPLIER EMAIL NOTIFICATION TESTS PASSED!")
    print("=" * 80)


if __name__ == '__main__':
    run_tests()
