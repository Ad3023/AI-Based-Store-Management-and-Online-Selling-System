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
from products.models import Product, Category
from orders.models import Order, OrderItem
from delivery.models import (
    CourierCompany,
    DeliveryVehicle,
    DeliveryPersonnel,
    Shipment,
    ShipmentStatus,
    DeliveryMethod,
    DeliveryOTP,
    DeliveryAttempt,
    DeliveryFeeRule,
    ShipmentTrackingEvent,
)
from delivery.services import (
    DeliveryFeeService,
    ShipmentWorkflowService,
    DeliveryOTPService,
)
from notifications.models import Notification

User = get_user_model()


def run_complete_delivery_workflow_tests():
    print("================================================================================")
    print("      COMPLETE 9-STAGE DELIVERY & LOGISTICS AUTOMATED TEST SUITE")
    print("   Workflow: Addis Ababa Store Fulfillment Dock -> Bahir Dar Customer Doorstep")
    print("================================================================================")

    # -------------------------------------------------------------------------
    # 0. Setup Test Users & Master Logistics Partners
    # -------------------------------------------------------------------------
    customer, _ = User.objects.get_or_create(
        username='workflow_customer_bd',
        defaults={
            'email': 'bahirdar.recipient@example.com',
            'first_name': 'Solomon',
            'last_name': 'Tekle',
            'role': User.Role.CUSTOMER,
            'is_active': True,
        }
    )
    customer.set_password('CustomerPass123!')
    customer.save()

    store_mgr, _ = User.objects.get_or_create(
        username='workflow_store_mgr',
        defaults={
            'email': 'store.dock.manager@ethiotechmarket.com',
            'first_name': 'Dawit',
            'last_name': 'Haile',
            'role': User.Role.STORE_MANAGER,
            'is_active': True,
        }
    )
    store_mgr.set_password('StoreMgrPass123!')
    store_mgr.save()

    order_mgr, _ = User.objects.get_or_create(
        username='workflow_order_mgr',
        defaults={
            'email': 'order.logistics.mgr@ethiotechmarket.com',
            'first_name': 'Hellen',
            'last_name': 'Girma',
            'role': User.Role.ORDER_MANAGER,
            'is_active': True,
        }
    )
    order_mgr.set_password('OrderMgrPass123!')
    order_mgr.save()

    # Active Courier Company
    courier, _ = CourierCompany.objects.get_or_create(
        code='ABC_EXPRESS',
        defaults={
            'name': 'ABC Express Ethiopia',
            'contact_person': 'Yonas Birhanu',
            'phone_number': '+251911002233',
            'email': 'dispatch@abcexpress-demo.et',
            'office_address': 'Bole Sub-city, Addis Ababa',
            'origin_city': 'Addis Ababa',
            'supported_destination_cities': 'Bahir Dar, Hawassa, Adama, Mekelle',
            'service_description': 'Regional intercity road transport & courier parcel delivery',
            'tracking_url_template': 'https://track.abcexpress.et/?waybill={waybill}',
            'is_active': True,
        }
    )

    # Local Delivery Personnel in Bahir Dar
    local_driver, _ = DeliveryPersonnel.objects.get_or_create(
        employee_code='BD-DRV-001',
        defaults={
            'full_name': 'Kassahun Worku',
            'phone_number': '+251922334455',
            'email': 'kassahun.bd@ethiotechmarket.com',
            'delivery_method': 'THIRD_PARTY_COURIER',
            'courier_company': courier,
            'current_city': 'Bahir Dar',
            'is_available': True,
            'is_active': True,
        }
    )

    # Product
    cat, _ = Category.objects.get_or_create(name='Hardware Tech', defaults={'slug': 'hardware-tech'})
    product, _ = Product.objects.get_or_create(
        sku='TECH-ROUTER-BD99',
        defaults={
            'name': 'Enterprise Dual-Band Mesh Router',
            'slug': 'enterprise-dual-band-mesh-router',
            'category': cat,
            'price': Decimal('4500.00'),
            'stock': 25,
            'is_active': True,
            'description': 'Gigabit Mesh Router for Home & Business',
        }
    )

    print("[0] Test Actors & Master Data Ready:")
    print(f"    - Customer: {customer.username} ({customer.email})")
    print(f"    - Store Manager: {store_mgr.username}")
    print(f"    - Order Manager: {order_mgr.username}")
    print(f"    - Regional Courier: {courier.name} ({courier.email})")
    print(f"    - Local Driver in Destination: {local_driver.full_name} ({local_driver.current_city})")

    # API Clients
    client_customer = APIClient()
    client_customer.force_authenticate(user=customer)

    client_store_mgr = APIClient()
    client_store_mgr.force_authenticate(user=store_mgr)

    client_order_mgr = APIClient()
    client_order_mgr.force_authenticate(user=order_mgr)

    # =========================================================================
    # PART 1: COMPLETE 9-STAGE SUCCESSFUL WORKFLOW
    # =========================================================================
    print("\n--------------------------------------------------------------------------------")
    print(" PART 1: 9-STAGE FULL SUCCESSFUL DELIVERY JOURNEY (ADDIS ABABA -> BAHIR DAR)")
    print("--------------------------------------------------------------------------------")

    # -------------------------------------------------------------------------
    # STAGE 1: Customer Places Order
    # -------------------------------------------------------------------------
    print("\n[STAGE 1] Customer Places Order to Bahir Dar:")
    order = Order.objects.create(
        customer=customer,
        shipping_name='Solomon Tekle',
        shipping_phone='+251911223344',
        shipping_address='Kebele 04, House 128',
        shipping_city='Bahir Dar',
        subtotal=Decimal('4500.00'),
        total_amount=Decimal('4767.50'),
        shipping_fee=Decimal('267.50'),
        payment_method='CASH_ON_DELIVERY',
        status=Order.Status.PROCESSING,
    )
    OrderItem.objects.create(
        order=order,
        product=product,
        quantity=1,
        unit_price=Decimal('4500.00'),
        total_price=Decimal('4500.00'),
        warranty_duration_days=365,
    )

    # Initialize Shipment
    shipment = Shipment.objects.create(
        order=order,
        delivery_method=DeliveryMethod.THIRD_PARTY_COURIER,
        origin_city='Addis Ababa',
        destination_city='Bahir Dar',
        recipient_name=order.shipping_name,
        recipient_phone=order.shipping_phone,
        delivery_address=order.shipping_address,
        shipping_fee=order.shipping_fee,
        weight_kg=Decimal('2.5'),
        courier_company=courier,
        status=ShipmentStatus.CONFIRMED,
    )

    assert shipment.status == ShipmentStatus.CONFIRMED
    assert shipment.destination_city == 'Bahir Dar'
    print(f"  -> Order #{order.order_number} created with destination {order.shipping_city}")
    print(f"  -> Shipment record created: Tracking Number = {shipment.tracking_number}")
    print(f"  -> Initial Status: {shipment.status} ({shipment.get_status_display()})")
    print("  -> PASSED: Stage 1 Verified in PostgreSQL.")

    # -------------------------------------------------------------------------
    # STAGE 2: Store Manager Prepares & Packs Package
    # -------------------------------------------------------------------------
    print("\n[STAGE 2] Store Manager Prepares & Packs Package at Addis Ababa Store:")
    res_pack = client_store_mgr.post(f'/api/delivery/shipments/{shipment.id}/ready-for-dispatch/', {
        'notes': 'Contents verified against pick-list. Foam cushioned in corrugated box.',
        'location': 'Addis Ababa Central Fulfillment Center',
    }, format='json')

    assert res_pack.status_code == 200, f"Store Manager pack failed: {res_pack.data if hasattr(res_pack, 'data') else res_pack.status_code}"
    shipment.refresh_from_db()
    order.refresh_from_db()

    assert shipment.status == ShipmentStatus.READY_FOR_DISPATCH
    assert order.status == Order.Status.PROCESSING
    print(f"  -> Shipment Status: {shipment.status} ({shipment.get_status_display()})")
    print(f"  -> Synchronized Order Status: {order.status}")
    print("  -> PASSED: Stage 2 Verified in PostgreSQL.")

    # -------------------------------------------------------------------------
    # STAGE 3: Order Manager Books Courier (Sends Booking Request)
    # -------------------------------------------------------------------------
    print("\n[STAGE 3] Order Manager Books Courier (ABC Express):")
    pickup_target_time = timezone.now() + timedelta(hours=4)
    res_book = client_order_mgr.post(f'/api/delivery/shipments/{shipment.id}/book-courier/', {
        'courier_company_id': courier.id,
        'requested_pickup_date': pickup_target_time.isoformat(),
        'package_weight_kg': 2.5,
        'package_dimensions': '35x25x20 cm',
        'booking_notes': 'Please send vehicle with tail-lift for commercial dock pick up.',
    }, format='json')

    assert res_book.status_code == 200, f"Book courier failed: {res_book.data}"
    shipment.refresh_from_db()

    assert shipment.status == ShipmentStatus.BOOKING_REQUESTED
    assert shipment.booking_status == 'REQUESTED'
    assert shipment.booking_reference.startswith('BKG-')
    assert shipment.booking_email_sent is True
    print(f"  -> Generated Courier Booking Reference: {shipment.booking_reference}")
    print(f"  -> Courier Email Dispatched: {shipment.booking_email_sent} to {courier.email}")
    print(f"  -> Shipment Status: {shipment.status} ({shipment.get_status_display()})")
    print("  -> PASSED: Stage 3 Verified in PostgreSQL.")

    # -------------------------------------------------------------------------
    # STAGE 4: Courier Confirms Booking & Issues Waybill
    # -------------------------------------------------------------------------
    print("\n[STAGE 4] Courier Confirms Booking & Issues Waybill:")
    res_confirm = client_order_mgr.post(f'/api/delivery/shipments/{shipment.id}/confirm-booking/', {
        'confirmed': True,
        'external_tracking_number': 'ABC-ET-BD-88912',
        'pickup_driver_name': 'Getachew Assefa',
        'pickup_driver_phone': '+251911445566',
        'pickup_vehicle_plate': 'AA-3-78219',
        'pickup_scheduled_at': (timezone.now() + timedelta(hours=2)).isoformat(),
        'notes': 'ABC Express driver confirmed arrival window at central store dock.',
    }, format='json')

    assert res_confirm.status_code == 200, f"Confirm booking failed: {res_confirm.data}"
    shipment.refresh_from_db()

    assert shipment.status == ShipmentStatus.BOOKING_CONFIRMED
    assert shipment.booking_status == 'CONFIRMED'
    assert shipment.external_tracking_number == 'ABC-ET-BD-88912'
    print(f"  -> Courier Waybill / Tracking #: {shipment.external_tracking_number}")
    print(f"  -> Booking Status: {shipment.booking_status}")
    print(f"  -> Shipment Status: {shipment.status} ({shipment.get_status_display()})")
    print("  -> PASSED: Stage 4 Verified in PostgreSQL.")

    # -------------------------------------------------------------------------
    # STAGE 5: Driver Pickup Scheduled
    # -------------------------------------------------------------------------
    print("\n[STAGE 5] Driver Pickup Scheduled:")
    res_sched = client_order_mgr.post(f'/api/delivery/shipments/{shipment.id}/schedule-pickup/', {
        'pickup_driver_name': 'Getachew Assefa',
        'pickup_driver_phone': '+251911445566',
        'pickup_vehicle_plate': 'AA-3-78219',
        'pickup_scheduled_at': (timezone.now() + timedelta(hours=1)).isoformat(),
        'notes': 'Assigned to Gate 3 loading bay.',
    }, format='json')

    assert res_sched.status_code == 200, f"Schedule pickup failed: {res_sched.data}"
    shipment.refresh_from_db()

    assert shipment.status == ShipmentStatus.PICKUP_SCHEDULED
    assert shipment.pickup_driver_name == 'Getachew Assefa'
    assert shipment.pickup_vehicle_plate == 'AA-3-78219'
    print(f"  -> Assigned Courier Driver: {shipment.pickup_driver_name} ({shipment.pickup_driver_phone})")
    print(f"  -> Vehicle Plate: {shipment.pickup_vehicle_plate}")
    print(f"  -> Shipment Status: {shipment.status} ({shipment.get_status_display()})")
    print("  -> PASSED: Stage 5 Verified in PostgreSQL.")

    # -------------------------------------------------------------------------
    # STAGE 6: Store Manager Confirms Physical Package Handover
    # -------------------------------------------------------------------------
    print("\n[STAGE 6] Store Manager Confirms Physical Package Handover at Store Dock:")
    res_handover = client_store_mgr.post(f'/api/delivery/shipments/{shipment.id}/confirm-handover/', {
        'driver_badge_verified': True,
        'package_sealed_verified': True,
        'handover_notes': 'Physical carton handed to driver Getachew Assefa. Waybill signed.',
        'location': 'Addis Ababa Central Fulfillment Center - Dock Bay 3',
    }, format='json')

    assert res_handover.status_code == 200, f"Confirm handover failed: {res_handover.data}"
    shipment.refresh_from_db()
    order.refresh_from_db()

    assert shipment.status == ShipmentStatus.PICKED_UP
    assert shipment.handover_confirmed_by == store_mgr
    assert shipment.handover_confirmed_at is not None
    assert order.status == Order.Status.SHIPPED
    print(f"  -> Store Handover Confirmed by: {shipment.handover_confirmed_by.username}")
    print(f"  -> Handover Timestamp: {shipment.handover_confirmed_at}")
    print(f"  -> Synchronized Order Fulfillment Status: {order.status}")
    print(f"  -> Shipment Status: {shipment.status} ({shipment.get_status_display()})")
    print("  -> PASSED: Stage 6 Verified in PostgreSQL.")

    # -------------------------------------------------------------------------
    # STAGE 7: Transportation & Intercity Highway Milestones
    # -------------------------------------------------------------------------
    print("\n[STAGE 7] Transportation Across Ethiopia (Addis Ababa -> Bahir Dar):")

    # Milestone 7A: In Transit on Highway
    res_transit = client_order_mgr.post(f'/api/delivery/shipments/{shipment.id}/status/', {
        'status': ShipmentStatus.IN_TRANSIT,
        'location': 'Addis Ababa - Gojjam Highway Corridor',
        'description': 'Carrier truck in motion towards Amhara regional destination hub.',
    }, format='json')
    assert res_transit.status_code == 200

    # Milestone 7B: Arrived at Regional Sorting Center
    res_sorting = client_order_mgr.post(f'/api/delivery/shipments/{shipment.id}/status/', {
        'status': ShipmentStatus.ARRIVED_AT_SORTING_CENTER,
        'location': 'Debre Markos Regional Sorting Station',
        'description': 'Parcel barcode scanned and sorted into Bahir Dar northern feeder container.',
    }, format='json')
    assert res_sorting.status_code == 200

    # Milestone 7C: Arrived at Destination Branch
    res_dest = client_order_mgr.post(f'/api/delivery/shipments/{shipment.id}/status/', {
        'status': ShipmentStatus.ARRIVED_AT_DESTINATION,
        'location': 'Bahir Dar Central Courier Hub - Kebele 03',
        'description': 'Package safely arrived at Bahir Dar branch office and unloaded.',
    }, format='json')
    assert res_dest.status_code == 200

    shipment.refresh_from_db()
    assert shipment.status == ShipmentStatus.ARRIVED_AT_DESTINATION
    events_count = ShipmentTrackingEvent.objects.filter(shipment=shipment).count()
    print(f"  -> Shipment Milestone: {shipment.status} ({shipment.get_status_display()})")
    print(f"  -> Total Logged Milestone Events: {events_count}")
    print("  -> PASSED: Stage 7 Verified in PostgreSQL.")

    # -------------------------------------------------------------------------
    # STAGE 8: Local Delivery in Bahir Dar
    # -------------------------------------------------------------------------
    print("\n[STAGE 8] Assign Local Delivery Personnel in Bahir Dar & Out for Delivery:")
    res_local = client_order_mgr.post(f'/api/delivery/shipments/{shipment.id}/assign-local/', {
        'delivery_personnel_id': local_driver.id,
        'notes': 'Bring parcel to customer residence in Kebele 04. Call prior to gate arrival.',
    }, format='json')

    assert res_local.status_code == 200, f"Assign local driver failed: {res_local.data}"
    shipment.refresh_from_db()

    assert shipment.status == ShipmentStatus.OUT_FOR_DELIVERY
    assert shipment.delivery_personnel == local_driver
    print(f"  -> Assigned Local Driver: {shipment.delivery_personnel.full_name} ({shipment.delivery_personnel.phone_number})")
    print(f"  -> Shipment Status: {shipment.status} ({shipment.get_status_display()})")
    print("  -> PASSED: Stage 8 Verified in PostgreSQL.")

    # -------------------------------------------------------------------------
    # STAGE 9: Customer Delivery Handover & Backend OTP Verification
    # -------------------------------------------------------------------------
    print("\n[STAGE 9] Customer Handover & Backend OTP Verification:")

    # 9A: Generate & Request OTP
    res_otp_req = client_order_mgr.post(f'/api/delivery/shipments/{shipment.id}/request-otp/', format='json')
    assert res_otp_req.status_code == 200, f"Request OTP failed: {res_otp_req.data}"

    # Critical Security Check: Ensure raw plain OTP is NEVER in the API response
    assert 'otp' not in res_otp_req.data, "SECURITY VIOLATION: Raw OTP was exposed in API response!"
    print("  -> Security Verification Passed: Raw OTP is NOT leaked in API response.")

    # Retrieve OTP record from DB
    otp_record = DeliveryOTP.objects.filter(shipment=shipment, is_used=False).latest('created_at')
    assert otp_record.otp_hash is not None, "OTP hash missing in database!"
    assert otp_record.attempts_count == 0
    print(f"  -> Database OTP record verified: Hashed Token = {otp_record.otp_hash[:16]}... (PBKDF2)")

    # 9B: Negative Test: Incorrect OTP Rejected
    res_wrong_otp = client_order_mgr.post(f'/api/delivery/shipments/{shipment.id}/verify-otp/', {
        'otp': '000000',
    }, format='json')
    assert res_wrong_otp.status_code == 400, "Wrong OTP should be rejected with 400!"
    otp_record.refresh_from_db()
    assert otp_record.attempts_count == 1
    print(f"  -> Negative Case Passed: Wrong OTP '000000' rejected. Attempt count incremented to {otp_record.attempts_count}.")

    # 9C: Retrieve the correct OTP that was dispatched to customer email/notifications
    # DeliveryOTPService sends email and system notification
    customer_notif = Notification.objects.filter(user=customer, notification_type=Notification.NotificationType.ORDER_UPDATE).latest('created_at')
    print(f"  -> Customer Notification Created: {customer_notif.title}")

    # Generate a fresh OTP for verification to test end-to-end matching
    fresh_plain_otp, fresh_otp_rec = DeliveryOTPService.generate_and_send_otp(shipment=shipment, requested_by=order_mgr)

    # 9D: Verify valid OTP
    res_valid_otp = client_order_mgr.post(f'/api/delivery/shipments/{shipment.id}/verify-otp/', {
        'otp': fresh_plain_otp,
    }, format='json')

    assert res_valid_otp.status_code == 200, f"Valid OTP verification failed: {res_valid_otp.data}"
    shipment.refresh_from_db()
    order.refresh_from_db()
    fresh_otp_rec.refresh_from_db()

    assert fresh_otp_rec.is_used is True
    assert shipment.status == ShipmentStatus.DELIVERED
    assert order.status == Order.Status.DELIVERED
    print(f"  -> Correct OTP '{fresh_plain_otp}' verified successfully by backend PBKDF2 validator.")
    print(f"  -> Final Shipment Status: {shipment.status} ({shipment.get_status_display()})")
    print(f"  -> Final Order Status: {order.status}")
    print("  -> PASSED: Stage 9 Verified in PostgreSQL.")

    # =========================================================================
    # PART 2: NEGATIVE EDGE CASES & PERMISSION ENFORCEMENT
    # =========================================================================
    print("\n--------------------------------------------------------------------------------")
    print(" PART 2: NEGATIVE EDGE CASES, REJECTIONS & SECURITY TESTS")
    print("--------------------------------------------------------------------------------")

    # -------------------------------------------------------------------------
    # Edge Case A: Courier Rejects Booking Request
    # -------------------------------------------------------------------------
    print("\n[Edge Case A] Courier Booking Rejection & Re-booking Flow:")
    order_b = Order.objects.create(
        customer=customer,
        shipping_name='Solomon Tekle',
        shipping_phone='+251911223344',
        shipping_address='Bahir Dar Lake Road, Kebele 02',
        shipping_city='Bahir Dar',
        subtotal=Decimal('4500.00'),
        total_amount=Decimal('4767.50'),
        shipping_fee=Decimal('267.50'),
        payment_method='CASH_ON_DELIVERY',
        status=Order.Status.PROCESSING,
    )
    shipment_b = Shipment.objects.create(
        order=order_b,
        delivery_method=DeliveryMethod.THIRD_PARTY_COURIER,
        origin_city='Addis Ababa',
        destination_city='Bahir Dar',
        recipient_name=order_b.shipping_name,
        recipient_phone=order_b.shipping_phone,
        delivery_address=order_b.shipping_address,
        shipping_fee=order_b.shipping_fee,
        weight_kg=Decimal('3.0'),
        courier_company=courier,
        status=ShipmentStatus.CONFIRMED,
    )
    # Pack
    ShipmentWorkflowService.advance_status(shipment=shipment_b, new_status=ShipmentStatus.READY_FOR_DISPATCH, updated_by=store_mgr)
    # Book
    ShipmentWorkflowService.book_courier(
        shipment=shipment_b,
        courier_company=courier,
        requested_pickup_date=timezone.now() + timedelta(days=1),
        package_weight_kg=Decimal('3.0'),
        package_dimensions='30x20x15 cm',
        booking_notes='Fragile router package',
        user=order_mgr,
    )
    assert shipment_b.booking_status == 'REQUESTED'

    # Courier rejects with reason
    res_reject = client_order_mgr.post(f'/api/delivery/shipments/{shipment_b.id}/confirm-booking/', {
        'confirmed': False,
        'rejection_reason': 'Truck maintenance in progress. No freight capacity today.',
        'notes': 'Courier dispatch called to decline.',
    }, format='json')

    assert res_reject.status_code == 200
    shipment_b.refresh_from_db()
    assert shipment_b.booking_status == 'REJECTED'
    assert 'freight capacity' in shipment_b.booking_rejection_reason
    print(f"  -> Booking rejection recorded: {shipment_b.booking_rejection_reason}")
    print(f"  -> Booking Status: {shipment_b.booking_status}")
    print("  -> PASSED: Courier Booking Rejection Verified.")

    # -------------------------------------------------------------------------
    # Edge Case B: Unauthorized Role Access (Store Handover)
    # -------------------------------------------------------------------------
    print("\n[Edge Case B] Unauthorized Handover Permission Enforcement:")
    # Customer user tries to confirm store dock package handover
    res_unauth_handover = client_customer.post(f'/api/delivery/shipments/{shipment.id}/confirm-handover/', {
        'driver_badge_verified': True,
        'package_sealed_verified': True,
    }, format='json')
    assert res_unauth_handover.status_code in [401, 403], f"Expected 403 Forbidden, got {res_unauth_handover.status_code}"
    print(f"  -> Unauthorized customer correctly blocked with HTTP {res_unauth_handover.status_code}.")
    print("  -> PASSED: Store Manager Permission Enforcement Verified.")

    # -------------------------------------------------------------------------
    # Edge Case C: Unauthorized Milestone Advance
    # -------------------------------------------------------------------------
    print("\n[Edge Case C] Unauthorized Logistics Status Update:")
    res_unauth_status = client_customer.post(f'/api/delivery/shipments/{shipment.id}/status/', {
        'status': ShipmentStatus.DELIVERED,
    }, format='json')
    assert res_unauth_status.status_code in [401, 403]
    print(f"  -> Customer blocked from updating logistics status: HTTP {res_unauth_status.status_code}.")
    print("  -> PASSED: Order Manager Permission Enforcement Verified.")

    # -------------------------------------------------------------------------
    # Edge Case D: Prevent Direct Marking as DELIVERED without OTP
    # -------------------------------------------------------------------------
    print("\n[Edge Case D] Prevent Marking Shipment DELIVERED without OTP Verification:")
    order_c = Order.objects.create(
        customer=customer,
        shipping_name='Solomon Tekle',
        shipping_phone='+251911223344',
        shipping_address='Bahir Dar University Gate',
        shipping_city='Bahir Dar',
        subtotal=Decimal('4500.00'),
        total_amount=Decimal('4767.50'),
        shipping_fee=Decimal('267.50'),
        payment_method='CASH_ON_DELIVERY',
        status=Order.Status.PROCESSING,
    )
    shipment_c = Shipment.objects.create(
        order=order_c,
        delivery_method=DeliveryMethod.THIRD_PARTY_COURIER,
        origin_city='Addis Ababa',
        destination_city='Bahir Dar',
        recipient_name=order_c.shipping_name,
        recipient_phone=order_c.shipping_phone,
        delivery_address=order_c.shipping_address,
        shipping_fee=order_c.shipping_fee,
        weight_kg=Decimal('2.0'),
        courier_company=courier,
        status=ShipmentStatus.CONFIRMED,
    )
    ShipmentWorkflowService.advance_status(shipment=shipment_c, new_status=ShipmentStatus.READY_FOR_DISPATCH, updated_by=store_mgr)
    ShipmentWorkflowService.book_courier(
        shipment=shipment_c,
        courier_company=courier,
        requested_pickup_date=timezone.now() + timedelta(days=1),
        package_weight_kg=Decimal('2.0'),
        package_dimensions='20x20x10 cm',
        booking_notes='Fast courier test',
        user=order_mgr
    )
    ShipmentWorkflowService.confirm_booking(
        shipment=shipment_c,
        confirmed=True,
        confirmed_by=order_mgr,
        external_tracking_number='ABC-99'
    )
    ShipmentWorkflowService.schedule_pickup(
        shipment=shipment_c,
        driver_name='Driver X',
        driver_phone='+251911000000',
        vehicle_plate='AA-2-11111',
        scheduled_at=timezone.now() + timedelta(hours=1),
        updated_by=order_mgr
    )
    ShipmentWorkflowService.confirm_handover(
        shipment=shipment_c,
        confirmed_by=store_mgr,
        notes='Dock release',
        location='Addis Ababa'
    )
    ShipmentWorkflowService.advance_status(
        shipment=shipment_c,
        new_status=ShipmentStatus.IN_TRANSIT,
        updated_by=order_mgr
    )
    ShipmentWorkflowService.advance_status(
        shipment=shipment_c,
        new_status=ShipmentStatus.ARRIVED_AT_DESTINATION,
        updated_by=order_mgr
    )
    ShipmentWorkflowService.assign_local_delivery(
        shipment=shipment_c,
        personnel=local_driver,
        notes='Out for delivery',
        user=order_mgr
    )

    # Attempt to bypass OTP by posting status='DELIVERED'
    res_bypass = client_order_mgr.post(f'/api/delivery/shipments/{shipment_c.id}/status/', {
        'status': ShipmentStatus.DELIVERED,
        'location': 'Bahir Dar Doorstep',
    }, format='json')

    assert res_bypass.status_code == 400
    assert 'OTP' in str(res_bypass.data) or 'otp' in str(res_bypass.data).lower()
    print(f"  -> Direct DELIVERED bypass blocked with 400: {res_bypass.data}")
    print("  -> PASSED: Mandatory OTP Enforcement Verified.")

    # -------------------------------------------------------------------------
    # Edge Case E: Record Failed Delivery Attempt
    # -------------------------------------------------------------------------
    print("\n[Edge Case E] Record Unsuccessful Delivery Attempt (Customer Unavailable):")
    res_attempt = client_order_mgr.post(f'/api/delivery/shipments/{shipment_c.id}/record-attempt/', {
        'reason': 'CUSTOMER_UNAVAILABLE',
        'notes': 'Arrived at customer gate. Called 3 times with no answer.',
        'next_scheduled_attempt': (timezone.now() + timedelta(days=1)).date().isoformat(),
    }, format='json')

    assert res_attempt.status_code in [200, 201]
    shipment_c.refresh_from_db()
    assert shipment_c.status == ShipmentStatus.DELIVERY_ATTEMPT_FAILED

    attempt_record = DeliveryAttempt.objects.filter(shipment=shipment_c).latest('attempted_at')
    assert attempt_record.reason == 'CUSTOMER_UNAVAILABLE'
    assert attempt_record.attempt_number == 1
    print(f"  -> Attempt logged: Attempt #{attempt_record.attempt_number} ({attempt_record.reason})")
    print(f"  -> Status moved to: {shipment_c.status} ({shipment_c.get_status_display()})")
    print("  -> PASSED: Failed Delivery Attempt Logging Verified.")

    # -------------------------------------------------------------------------
    # Edge Case F: OTP Attempt Limit Exhaustion
    # -------------------------------------------------------------------------
    print("\n[Edge Case F] OTP Max Attempts Exhaustion (3 Strikes):")
    # Generate OTP for shipment_c
    plain_otp, otp_c = DeliveryOTPService.generate_and_send_otp(shipment=shipment_c, requested_by=order_mgr)

    # Submit 3 wrong attempts
    for i in range(1, 4):
        res_fail = client_order_mgr.post(f'/api/delivery/shipments/{shipment_c.id}/verify-otp/', {
            'otp': f'11111{i}',
        }, format='json')
        assert res_fail.status_code == 400

    otp_c.refresh_from_db()
    assert otp_c.attempts_count >= 3

    # 4th attempt even with correct OTP must fail because max attempts exceeded
    res_strike4 = client_order_mgr.post(f'/api/delivery/shipments/{shipment_c.id}/verify-otp/', {
        'otp': plain_otp,
    }, format='json')
    assert res_strike4.status_code == 400
    assert 'attempts exceeded' in str(res_strike4.data).lower() or 'exhausted' in str(res_strike4.data).lower()
    print("  -> OTP invalidated after 3 incorrect attempts. Further verification rejected.")
    print("  -> PASSED: OTP Security Limits Verified.")

    print("\n================================================================================")
    print("   ALL TESTS PASSED: COMPLETE 9-STAGE DELIVERY SYSTEM FULLY OPERATIONAL!")
    print("================================================================================")


if __name__ == '__main__':
    run_complete_delivery_workflow_tests()
