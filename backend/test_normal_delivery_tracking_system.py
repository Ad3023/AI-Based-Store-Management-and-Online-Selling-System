import os
import sys
import django
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from products.models import Product, Category
from orders.models import Order, OrderItem
from delivery.models import (
    CourierCompany,
    DeliveryVehicle,
    DeliveryPersonnel,
    Shipment,
    ShipmentStatus,
    DeliveryMethod,
    ShipmentTrackingEvent,
)

User = get_user_model()


def run_tests():
    print("================================================================================")
    print("       TESTING NORMAL DELIVERY TRACKING SYSTEM (ETHIOTECH MARKET)")
    print("================================================================================")
    client = APIClient()

    # 1. Setup Users (Valid @gmail.com emails)
    admin_user, _ = User.objects.get_or_create(
        username='tracking_admin',
        defaults={'email': 'admin.delivery@gmail.com', 'role': User.RoleChoices.ADMIN, 'is_active': True}
    )
    admin_user.set_password('AdminPass123!')
    admin_user.save()

    store_mgr, _ = User.objects.get_or_create(
        username='tracking_store_mgr',
        defaults={'email': 'mgr.delivery@gmail.com', 'role': User.RoleChoices.STORE_MANAGER, 'is_active': True}
    )
    store_mgr.set_password('ManagerPass123!')
    store_mgr.save()

    customer_a, _ = User.objects.get_or_create(
        username='customer_abebe',
        defaults={'email': 'abebe.customer@gmail.com', 'role': User.RoleChoices.CUSTOMER, 'is_active': True, 'email_verified': True}
    )
    customer_a.set_password('CustPass123!')
    customer_a.save()

    customer_b, _ = User.objects.get_or_create(
        username='customer_chala',
        defaults={'email': 'chala.customer@gmail.com', 'role': User.RoleChoices.CUSTOMER, 'is_active': True, 'email_verified': True}
    )
    customer_b.set_password('CustPass123!')
    customer_b.save()

    # Setup Product & Category
    category, _ = Category.objects.get_or_create(name='Laptops & Tablets', defaults={'slug': 'laptops-tablets'})
    product, _ = Product.objects.get_or_create(
        sku='DELIV-TEST-001',
        defaults={
            'name': 'Lenovo ThinkPad X1 Carbon Gen 11',
            'category': category,
            'price': Decimal('85000.00'),
            'cost_price': Decimal('70000.00'),
            'stock': 15,
            'is_active': True,
        }
    )

    # -------------------------------------------------------------------------
    # TEST 1: DELIVERY PERSONNEL MANAGEMENT (Register driver with credentials)
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Registering Delivery Personnel with Vehicle & Availability...")
    client.force_authenticate(user=admin_user)
    driver_reg_data = {
        'full_name': 'Kassahun Bekele',
        'phone_number': '0911223344',
        'email': 'kassahun.driver@gmail.com',
        'vehicle_type': 'Motorcycle',
        'vehicle_registration_number': 'AA-3-98765',
        'delivery_area': 'Bole, Kazanchis, Piazza',
        'current_city': 'Addis Ababa',
        'is_available': True,
        'is_active': True,
        'status': 'ACTIVE',
        'user_account_username': 'kassahun_driver',
        'user_account_password': 'DriverPass123!',
    }
    res = client.post('/api/delivery/personnel/', driver_reg_data, format='json')
    assert res.status_code in [status.HTTP_201_CREATED, status.HTTP_200_OK], f"Driver registration failed: {res.data}"
    driver_id = res.data['id']
    driver_personnel = DeliveryPersonnel.objects.get(pk=driver_id)
    assert driver_personnel.user is not None, "Driver user account was not linked!"
    assert driver_personnel.user.role == User.RoleChoices.DELIVERY, "Driver user role should be DELIVERY!"
    print(f"  -> Successfully registered driver: {driver_personnel.full_name} (Plate: {driver_personnel.vehicle_registration_number})")

    # Verify listing delivery personnel
    res_list = client.get('/api/delivery/personnel/')
    assert res_list.status_code == status.HTTP_200_OK
    assert any(p['id'] == driver_id for p in res_list.data.get('results', res_list.data)), "Driver not in personnel list!"
    print(f"  -> Delivery personnel list verified ({len(res_list.data.get('results', res_list.data))} drivers).")

    # -------------------------------------------------------------------------
    # TEST 2: DELIVERY ASSIGNMENT & ELIGIBILITY ENFORCEMENT
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Testing Delivery Assignment & Eligibility Rules...")
    # Create an eligible order for customer A
    order_eligible = Order.objects.create(
        customer=customer_a,
        subtotal=Decimal('85000.00'),
        shipping_fee=Decimal('150.00'),
        total_amount=Decimal('85150.00'),
        payment_status=Order.PaymentStatus.PAID,
        fulfillment_status=Order.FulfillmentStatus.PROCESSING,
        status=Order.Status.PROCESSING,
        shipping_name='Abebe Kebede',
        shipping_phone='0911556677',
        shipping_address='Bole Sub-City, Woreda 03, House 412',
        shipping_city='Addis Ababa'
    )
    OrderItem.objects.create(
        order=order_eligible,
        product=product,
        quantity=1,
        unit_price=Decimal('85000.00'),
        total_price=Decimal('85000.00')
    )

    # Store Manager assigns order to driver Kassahun
    client.force_authenticate(user=store_mgr)
    assign_payload = {
        'delivery_method': 'OWN_DELIVERY',
        'delivery_personnel_id': driver_personnel.id,
        'delivery_address': 'Bole Sub-City, Woreda 03, House 412 (Near Edna Mall)',
        'expected_delivery_date': (timezone.now() + timedelta(days=1)).strftime('%Y-%m-%d'),
        'notes': 'Call customer 15 minutes before arrival.'
    }
    res_assign = client.post(f'/api/delivery/orders/{order_eligible.id}/assign/', assign_payload, format='json')
    assert res_assign.status_code == status.HTTP_200_OK, f"Assignment failed: {res_assign.data}"
    shipment_data = res_assign.data['shipment']
    assert shipment_data['status'] == ShipmentStatus.ASSIGNED, f"Expected ASSIGNED, got {shipment_data['status']}"
    assert shipment_data['delivery_personnel']['id'] == driver_personnel.id
    confirmation_code = shipment_data.get('delivery_confirmation_code')
    assert confirmation_code and len(confirmation_code) >= 6, f"Confirmation code missing or too short: {confirmation_code}"
    print(f"  -> Successfully assigned order {order_eligible.order_number} to {driver_personnel.full_name}.")
    print(f"  -> Generated Customer Delivery Confirmation Code: {confirmation_code}")

    # Test assignment on ineligible CANCELLED order -> MUST BE REJECTED
    order_cancelled = Order.objects.create(
        customer=customer_a,
        subtotal=Decimal('5000.00'),
        total_amount=Decimal('5000.00'),
        status=Order.Status.CANCELLED,
        fulfillment_status=Order.FulfillmentStatus.CANCELLED,
        shipping_name='Abebe Kebede',
        shipping_phone='0911556677',
        shipping_address='Bole',
        shipping_city='Addis Ababa'
    )
    res_ineligible = client.post(f'/api/delivery/orders/{order_cancelled.id}/assign/', assign_payload, format='json')
    assert res_ineligible.status_code == status.HTTP_400_BAD_REQUEST, "Should block assigning a cancelled order!"
    print(f"  -> Properly blocked assignment on cancelled order: '{res_ineligible.data.get('error')}'")

    # -------------------------------------------------------------------------
    # TEST 3: DRIVER DASHBOARD & PERMISSIONS
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Testing Driver Dashboard & Isolation...")
    driver_user = driver_personnel.user
    client.force_authenticate(user=driver_user)

    # Driver fetches assigned deliveries
    res_driver_tasks = client.get('/api/delivery/driver/shipments/')
    assert res_driver_tasks.status_code == status.HTTP_200_OK, f"Failed to get driver shipments: {res_driver_tasks.data}"
    driver_shipments = res_driver_tasks.data.get('results', res_driver_tasks.data)
    assert len(driver_shipments) >= 1, "Assigned shipment should appear in driver list!"
    shipment_id = shipment_data['id']
    my_shipment = next(s for s in driver_shipments if s['id'] == shipment_id)
    assert my_shipment['order_number'] == order_eligible.order_number
    assert my_shipment['recipient_name'] == 'Abebe Kebede'
    assert 'order_items' in my_shipment and len(my_shipment['order_items']) > 0
    print(f"  -> Driver verified {len(driver_shipments)} assigned task(s). Order details and items verified.")

    # Driver profile & availability toggle
    res_prof = client.get('/api/delivery/driver/profile/')
    assert res_prof.status_code == status.HTTP_200_OK
    assert res_prof.data['is_available'] is True
    res_toggle = client.patch('/api/delivery/driver/profile/', {'is_available': False}, format='json')
    assert res_toggle.status_code == status.HTTP_200_OK and res_toggle.data['is_available'] is False
    print("  -> Driver availability toggle verified (Set to Busy/Unavailable).")

    # Unauthorized access: customer attempting driver dashboard
    client.force_authenticate(user=customer_a)
    res_unauth = client.get('/api/delivery/driver/shipments/')
    assert res_unauth.status_code == status.HTTP_403_FORBIDDEN, "Non-driver user must be forbidden from driver dashboard!"
    print("  -> Non-driver access to driver endpoints blocked (HTTP 403 Forbidden).")

    # -------------------------------------------------------------------------
    # TEST 4: DELIVERY STATUS TRANSITIONS & CONFIRMATION ENFORCEMENT
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Testing Driver Milestone Updates & Delivery Confirmation Code...")
    client.force_authenticate(user=driver_user)

    # 4a. Mark PICKED_UP
    res_pickup = client.post(f'/api/delivery/driver/shipments/{shipment_id}/update-status/', {
        'status': 'PICKED_UP',
        'delivery_note': 'Package picked up from Bole Fulfillment Hub.',
        'location': 'Bole Hub'
    }, format='json')
    assert res_pickup.status_code == status.HTTP_200_OK, f"Pickup failed: {res_pickup.data}"
    assert res_pickup.data['shipment']['status'] == ShipmentStatus.PICKED_UP
    print("  -> Driver advanced status: ASSIGNED -> PICKED_UP.")

    # 4b. Mark IN_TRANSIT
    res_transit = client.post(f'/api/delivery/driver/shipments/{shipment_id}/update-status/', {
        'status': 'IN_TRANSIT',
        'delivery_note': 'En route to customer residence.',
        'location': 'Addis Ababa Bole Road'
    }, format='json')
    assert res_transit.status_code == status.HTTP_200_OK
    assert res_transit.data['shipment']['status'] == ShipmentStatus.IN_TRANSIT
    print("  -> Driver advanced status: PICKED_UP -> IN_TRANSIT.")

    # 4c. Try to mark DELIVERED WITHOUT confirmation code -> MUST FAIL
    res_no_code = client.post(f'/api/delivery/driver/shipments/{shipment_id}/update-status/', {
        'status': 'DELIVERED',
        'delivery_note': 'Attempting delivery without code.',
    }, format='json')
    assert res_no_code.status_code == status.HTTP_400_BAD_REQUEST, "Should block DELIVERED without confirmation code!"
    print(f"  -> Blocked DELIVERED without confirmation code: '{res_no_code.data.get('error')}'")

    # 4d. Try to mark DELIVERED WITH WRONG confirmation code -> MUST FAIL
    res_wrong_code = client.post(f'/api/delivery/driver/shipments/{shipment_id}/update-status/', {
        'status': 'DELIVERED',
        'confirmation_code': '000000',
        'delivery_note': 'Attempting delivery with fake code.',
    }, format='json')
    assert res_wrong_code.status_code == status.HTTP_400_BAD_REQUEST, "Should block DELIVERED with invalid confirmation code!"
    print(f"  -> Blocked DELIVERED with wrong code: '{res_wrong_code.data.get('error')}'")

    # 4e. Mark DELIVERED WITH CORRECT confirmation code -> MUST SUCCEED
    res_delivered = client.post(f'/api/delivery/driver/shipments/{shipment_id}/update-status/', {
        'status': 'DELIVERED',
        'confirmation_code': confirmation_code,
        'delivery_note': 'Customer received and verified package at doorstep.',
        'location': 'Customer Residence'
    }, format='json')
    assert res_delivered.status_code == status.HTTP_200_OK, f"Delivery confirmation failed: {res_delivered.data}"
    assert res_delivered.data['shipment']['status'] == ShipmentStatus.DELIVERED
    print("  -> Driver confirmed delivery with Customer Confirmation Code -> DELIVERED!")

    # Verify parent order and warranty activation
    order_eligible.refresh_from_db()
    assert order_eligible.status == Order.Status.DELIVERED, f"Order status is {order_eligible.status}"
    assert order_eligible.fulfillment_status == Order.FulfillmentStatus.DELIVERED
    item = order_eligible.items.first()
    assert item.warranty_start_date is not None, "Item warranty was not activated upon delivery!"
    print("  -> Order fulfillment synced to DELIVERED; 7-day hardware warranty activated.")

    # -------------------------------------------------------------------------
    # TEST 5: LIVE SHIPMENTS DASHBOARD (ADMIN & STORE MANAGER)
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Testing Live Shipments Dashboard APIs...")
    client.force_authenticate(user=store_mgr)
    res_stats = client.get('/api/delivery/live-stats/')
    assert res_stats.status_code == status.HTTP_200_OK, f"Failed live stats: {res_stats.data}"
    assert 'delivered' in res_stats.data and res_stats.data['delivered'] >= 1
    assert 'total_active' in res_stats.data
    print(f"  -> Live stats verified: Delivered: {res_stats.data['delivered']}, Active: {res_stats.data['total_active']}")

    # -------------------------------------------------------------------------
    # TEST 6: CUSTOMER ORDER TRACKING & PRIVACY
    # -------------------------------------------------------------------------
    print("\n[TEST 6] Testing Customer Order Tracking & Privacy Protection...")
    # Customer A tracks their own order
    client.force_authenticate(user=customer_a)
    tracking_num = shipment_data['tracking_number']
    res_track = client.get(f'/api/delivery/track/{tracking_num}/')
    assert res_track.status_code == status.HTTP_200_OK, f"Customer track failed: {res_track.data}"
    assert res_track.data['tracking_number'] == tracking_num
    assert res_track.data['status'] == ShipmentStatus.DELIVERED
    assert len(res_track.data['events']) >= 3, "Tracking history events missing!"
    print(f"  -> Customer A successfully tracked order {order_eligible.order_number} ({len(res_track.data['events'])} events).")

    # Customer B attempts to track Customer A's order -> MUST BE FORBIDDEN
    client.force_authenticate(user=customer_b)
    res_unauth_track = client.get(f'/api/delivery/track/{tracking_num}/')
    assert res_unauth_track.status_code == status.HTTP_403_FORBIDDEN, "Customer B should NOT be able to track Customer A's order!"
    print("  -> Customer B blocked from tracking Customer A's private order (HTTP 403 Forbidden).")

    print("\n================================================================================")
    print("             ALL DELIVERY SYSTEM TESTS PASSED SUCCESSFULLY! (6/6)")
    print("================================================================================")


if __name__ == '__main__':
    run_tests()
