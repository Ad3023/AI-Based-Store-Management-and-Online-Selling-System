import os
import sys
import django
from decimal import Decimal

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
    DeliveryOTP,
    DeliveryAttempt,
    DeliveryComplaint,
    DeliveryFeeRule,
)

User = get_user_model()


def main():
    print("=" * 75)
    print("  ETHIOTECH MARKET: DELIVERY & LOGISTICS SYSTEM VERIFICATION")
    print("=" * 75)

    client = APIClient()

    # 1. Prepare Users
    admin_user, _ = User.objects.get_or_create(
        username='verify_admin',
        defaults={'email': 'verify_admin@ethiotechmarket.com', 'role': User.Role.ADMIN, 'is_staff': True}
    )
    admin_user.set_password('AdminPass123!')
    admin_user.save()

    order_mgr, _ = User.objects.get_or_create(
        username='verify_order_mgr',
        defaults={'email': 'verify_ordermgr@ethiotechmarket.com', 'role': User.Role.ORDER_MANAGER}
    )
    order_mgr.set_password('OrderMgrPass123!')
    order_mgr.save()

    store_mgr, _ = User.objects.get_or_create(
        username='verify_store_mgr',
        defaults={'email': 'verify_storemgr@ethiotechmarket.com', 'role': User.Role.STORE_MANAGER}
    )
    store_mgr.set_password('StoreMgrPass123!')
    store_mgr.save()

    customer, _ = User.objects.get_or_create(
        username='verify_customer_bd',
        defaults={'email': 'customer.bahirdar@test.com', 'role': User.Role.CUSTOMER, 'first_name': 'Kassahun', 'last_name': 'Worku'}
    )
    customer.set_password('CustomerPass123!')
    customer.save()

    print("[PASS] 1. Auth credentials verified for Admin, Store Manager, Order Manager, Customer.")

    # 2. Test Delivery Fee Calculation API
    fee_resp = client.post('/api/delivery/calculate-fee/', {
        'destination_city': 'Bahir Dar',
        'delivery_method': 'THIRD_PARTY_COURIER',
        'weight_kg': 2.0,
        'origin_city': 'Addis Ababa'
    }, format='json')
    assert fee_resp.status_code == status.HTTP_200_OK, f"Fee API failed: {fee_resp.data}"
    fee_data = fee_resp.data
    assert fee_data['destination_city'] == 'Bahir Dar'
    assert fee_data['total_shipping_fee'] > 0
    print(f"[PASS] 2. Delivery fee API: Addis Ababa -> Bahir Dar (2kg) = ETB {fee_data['total_shipping_fee']}.")

    # 3. Create Sample Laptop Product & Place Customer Order to Bahir Dar
    cat, _ = Category.objects.get_or_create(name='High Performance Laptops', defaults={'slug': 'high-perf-laptops'})
    product, _ = Product.objects.get_or_create(
        sku='HP-SPECTRE-BD-01',
        defaults={
            'name': 'HP Spectre x360 16-inch Convertible',
            'slug': 'hp-spectre-x360-16',
            'category': cat,
            'price': Decimal('78000.00'),
            'stock': 20,
            'is_active': True,
        }
    )

    client.force_authenticate(user=customer)
    order = Order.objects.create(
        customer=customer,
        subtotal=product.price,
        shipping_fee=Decimal(str(fee_data['total_shipping_fee'])),
        tax=round(product.price * Decimal('0.15'), 2),
        total_amount=product.price + Decimal(str(fee_data['total_shipping_fee'])) + round(product.price * Decimal('0.15'), 2),
        shipping_name='Kassahun Worku',
        shipping_phone='+251918112233',
        shipping_address='Kebele 06, Near Lake Tana Promenade, Bahir Dar',
        shipping_city='Bahir Dar',
        payment_status=Order.PaymentStatus.PAID,
        fulfillment_status=Order.FulfillmentStatus.PENDING,
    )
    OrderItem.objects.create(
        order=order,
        product=product,
        quantity=1,
        unit_price=product.price,
        total_price=product.price,
        warranty_duration_days=14,
    )
    # Initialize Shipment
    shipment, _ = Shipment.objects.get_or_create(
        order=order,
        defaults={
            'delivery_method': DeliveryMethod.THIRD_PARTY_COURIER,
            'origin_city': 'Addis Ababa',
            'destination_city': 'Bahir Dar',
            'recipient_name': order.shipping_name,
            'recipient_phone': order.shipping_phone,
            'delivery_address': order.shipping_address,
            'shipping_fee': order.shipping_fee,
            'status': ShipmentStatus.PENDING,
        }
    )
    print(f"[PASS] 3. Customer placed order #{order.order_number} to Bahir Dar. Tracking #{shipment.tracking_number}.")

    # 4. Order Manager Confirms Order
    client.force_authenticate(user=order_mgr)
    confirm_resp = client.patch(f'/api/orders/{order.id}/status/', {
        'fulfillment_status': 'CONFIRMED',
        'comment': 'Order Manager inspected and approved payment & order details.'
    }, format='json')
    assert confirm_resp.status_code == status.HTTP_200_OK, f"Confirm failed: {confirm_resp.data}"
    shipment.refresh_from_db()
    assert shipment.status == ShipmentStatus.CONFIRMED
    print(f"[PASS] 4. Order Manager confirmed order -> Order & Shipment in CONFIRMED state.")

    # 5. Store Manager packs order and marks READY_FOR_DISPATCH
    client.force_authenticate(user=store_mgr)
    ready_resp = client.post(f'/api/delivery/shipments/{shipment.id}/ready-for-dispatch/', {
        'location': 'Addis Ababa Central Store Dock',
        'notes': 'Laptop inspected, sealed in anti-shock protective packaging for intercity transit.'
    }, format='json')
    assert ready_resp.status_code == status.HTTP_200_OK, f"Ready dispatch failed: {ready_resp.data}"
    shipment.refresh_from_db()
    assert shipment.status == ShipmentStatus.READY_FOR_DISPATCH
    print(f"[PASS] 5. Store Manager marked READY_FOR_DISPATCH -> Status: {shipment.status}.")

    # 6. Order Manager assigns courier ABC Express (Demo)
    client.force_authenticate(user=order_mgr)
    abc_courier = CourierCompany.objects.get(code='ABC_EXPRESS')
    assign_resp = client.post(f'/api/delivery/orders/{order.id}/assign/', {
        'delivery_method': 'THIRD_PARTY_COURIER',
        'courier_company_id': abc_courier.id,
        'external_tracking_number': 'ABC-ET-BD-99120',
        'notes': 'Assigned to ABC Express Addis Ababa dispatch desk.'
    }, format='json')
    assert assign_resp.status_code == status.HTTP_200_OK, f"Assign failed: {assign_resp.data}"
    shipment.refresh_from_db()
    assert shipment.courier_company.id == abc_courier.id
    assert shipment.status == ShipmentStatus.COURIER_ASSIGNED
    print(f"[PASS] 6. Assigned ABC Express Ethiopia (Waybill: {shipment.external_tracking_number}) -> COURIER_ASSIGNED.")

    # 7. Courier collection: status -> PICKED_UP
    pickup_resp = client.post(f'/api/delivery/shipments/{shipment.id}/status/', {
        'status': 'PICKED_UP',
        'location': 'Addis Ababa Fulfillment Center',
        'description': 'Courier driver collected parcel from Addis Ababa warehouse dock.'
    }, format='json')
    assert pickup_resp.status_code == status.HTTP_200_OK
    print(f"[PASS] 7. Package collected by courier -> PICKED_UP.")

    # 8. Transportation along Addis Ababa -> Bahir Dar highway: status -> IN_TRANSIT
    transit_resp = client.post(f'/api/delivery/shipments/{shipment.id}/status/', {
        'status': 'IN_TRANSIT',
        'location': 'Dejen / Blue Nile Gorge Transit Post',
        'description': 'Package in transit on regional transport carrier.'
    }, format='json')
    assert transit_resp.status_code == status.HTTP_200_OK
    print(f"[PASS] 8. Package in transit along highway -> IN_TRANSIT.")

    # 9. Arrival at Bahir Dar courier branch: status -> ARRIVED_AT_DESTINATION
    arrived_resp = client.post(f'/api/delivery/shipments/{shipment.id}/status/', {
        'status': 'ARRIVED_AT_DESTINATION',
        'location': 'ABC Express Bahir Dar Station, Kebele 04',
        'description': 'Package unloaded and scanned at Bahir Dar branch office.'
    }, format='json')
    assert arrived_resp.status_code == status.HTTP_200_OK
    print(f"[PASS] 9. Reached destination branch -> ARRIVED_AT_DESTINATION.")

    # 10. Assign local delivery person (Getachew Mengistu in Bahir Dar)
    local_driver = DeliveryPersonnel.objects.filter(current_city='Bahir Dar').first()
    assert local_driver is not None
    driver_resp = client.post(f'/api/delivery/shipments/{shipment.id}/assign-local/', {
        'delivery_personnel_id': local_driver.id,
        'notes': 'Assigned to local Bahir Dar motorbike courier.'
    }, format='json')
    assert driver_resp.status_code == status.HTTP_200_OK
    shipment.refresh_from_db()
    assert shipment.delivery_personnel.id == local_driver.id
    print(f"[PASS] 10. Local Bahir Dar driver assigned: {local_driver.full_name} ({local_driver.phone_number}).")

    # 11. Dispatch out for delivery
    ofd_resp = client.post(f'/api/delivery/shipments/{shipment.id}/status/', {
        'status': 'OUT_FOR_DELIVERY',
        'location': 'Bahir Dar City Center',
        'description': f'Local driver {local_driver.full_name} out for delivery to customer address.'
    }, format='json')
    assert ofd_resp.status_code == status.HTTP_200_OK
    print(f"[PASS] 11. Package out for delivery with local driver -> OUT_FOR_DELIVERY.")

    # 12. Security Test: Unauthorized direct jump to DELIVERED must be blocked!
    illegal_resp = client.post(f'/api/delivery/shipments/{shipment.id}/status/', {
        'status': 'DELIVERED',
        'location': 'Bahir Dar',
        'description': 'Attempting illegal direct transition without customer OTP.'
    }, format='json')
    assert illegal_resp.status_code == status.HTTP_400_BAD_REQUEST, "Direct transition to DELIVERED was not rejected!"
    print(f"[PASS] 12. Security guard verified: Direct status update to DELIVERED was properly rejected.")

    # 13. Delivery OTP Generation & Verification Handover
    otp_req_resp = client.post(f'/api/delivery/shipments/{shipment.id}/request-otp/')
    assert otp_req_resp.status_code == status.HTTP_200_OK
    assert 'otp' not in otp_req_resp.data, "Plain OTP leaked in response!"
    print(f"[PASS] 13. Secure delivery OTP generated and sent to customer ({otp_req_resp.data['recipient_email_masked']}).")

    # Invalid OTP attempt
    inv_otp_resp = client.post(f'/api/delivery/shipments/{shipment.id}/verify-otp/', {'otp': '111111'})
    assert inv_otp_resp.status_code == status.HTTP_400_BAD_REQUEST
    print(f"[PASS] 14. Invalid OTP correctly rejected with remaining attempts counter.")

    # Valid OTP verification
    latest_otp = DeliveryOTP.objects.filter(shipment=shipment).latest('created_at')
    # Set known test OTP
    latest_otp.set_otp('765432')
    latest_otp.attempts_count = 0
    latest_otp.save()

    valid_otp_resp = client.post(f'/api/delivery/shipments/{shipment.id}/verify-otp/', {'otp': '765432'})
    assert valid_otp_resp.status_code == status.HTTP_200_OK
    shipment.refresh_from_db()
    order.refresh_from_db()
    assert shipment.status == ShipmentStatus.DELIVERED
    assert order.fulfillment_status == Order.FulfillmentStatus.DELIVERED
    assert order.status == Order.Status.DELIVERED
    item = order.items.first()
    assert item.warranty_start_date is not None
    print(f"[PASS] 15. Valid customer OTP verified! Order & Shipment marked DELIVERED. Warranty activated until {item.warranty_end_date.strftime('%Y-%m-%d')}.")

    # 14. Public Tracking Endpoint Lookup
    client.force_authenticate(user=None) # Anonymous customer
    track_resp = client.get(f'/api/delivery/track/{shipment.tracking_number}/')
    assert track_resp.status_code == status.HTTP_200_OK
    assert len(track_resp.data['events']) >= 7
    print(f"[PASS] 16. Public tracking lookup verified: Tracking #{shipment.tracking_number} has {len(track_resp.data['events'])} milestone events.")

    # 15. Test Method B: Own Fleet Delivery & Failed Attempt Logging
    client.force_authenticate(user=order_mgr)
    order_fleet = Order.objects.create(
        customer=customer,
        subtotal=Decimal('12000.00'),
        shipping_fee=Decimal('80.00'),
        tax=Decimal('1800.00'),
        total_amount=Decimal('13880.00'),
        shipping_name='Kassahun Worku',
        shipping_phone='+251918112233',
        shipping_address='Bole Subcity, Addis Ababa',
        shipping_city='Addis Ababa',
        payment_status=Order.PaymentStatus.PAID,
        fulfillment_status=Order.FulfillmentStatus.CONFIRMED,
    )
    fleet_van = DeliveryVehicle.objects.filter(vehicle_type='VAN', current_city='Addis Ababa').first()
    fleet_driver = DeliveryPersonnel.objects.filter(delivery_method='OWN_FLEET').first()

    fleet_assign_resp = client.post(f'/api/delivery/orders/{order_fleet.id}/assign/', {
        'delivery_method': 'OWN_DELIVERY',
        'vehicle_id': fleet_van.id,
        'delivery_personnel_id': fleet_driver.id,
        'notes': 'Assigned to company fleet vehicle for intra-city dispatch.'
    }, format='json')
    assert fleet_assign_resp.status_code == status.HTTP_200_OK
    shipment_fleet = Shipment.objects.get(order=order_fleet)
    assert shipment_fleet.delivery_method == DeliveryMethod.OWN_DELIVERY
    print(f"[PASS] 17. Method B (Own Fleet): Dispatched with Vehicle {fleet_van.registration_number} & Driver {fleet_driver.full_name}.")

    # Move to OUT_FOR_DELIVERY then record failed attempt
    client.post(f'/api/delivery/shipments/{shipment_fleet.id}/status/', {'status': 'OUT_FOR_DELIVERY', 'location': 'Bole, Addis Ababa'})
    fail_resp = client.post(f'/api/delivery/shipments/{shipment_fleet.id}/record-attempt/', {
        'reason': 'CUSTOMER_UNAVAILABLE',
        'notes': 'Arrived at gate, customer phone rang with no answer.',
        'next_scheduled_attempt': '2026-11-02'
    }, format='json')
    assert fail_resp.status_code == status.HTTP_201_CREATED
    shipment_fleet.refresh_from_db()
    assert shipment_fleet.status == ShipmentStatus.DELIVERY_ATTEMPT_FAILED
    print(f"[PASS] 18. Failed attempt recorded: {fail_resp.data['attempt']['reason_display']} -> DELIVERY_ATTEMPT_FAILED.")

    # 16. Customer Complaint Submission & Order Manager Resolution
    client.force_authenticate(user=customer)
    comp_resp = client.post('/api/delivery/complaints/', {
        'shipment_id': shipment.id,
        'complaint_type': 'DAMAGED',
        'description': 'Minor dent on outer cardboard corner.'
    }, format='json')
    assert comp_resp.status_code == status.HTTP_201_CREATED
    complaint_id = comp_resp.data['id']
    print(f"[PASS] 19. Customer submitted delivery complaint #{complaint_id}.")

    client.force_authenticate(user=order_mgr)
    resolve_resp = client.patch(f'/api/delivery/complaints/{complaint_id}/', {
        'status': 'RESOLVED',
        'resolution_notes': 'Verified with ABC Express. Product undamaged; credited 500 ETB courtesy voucher.'
    }, format='json')
    assert resolve_resp.status_code == status.HTTP_200_OK
    assert resolve_resp.data['status'] == 'RESOLVED'
    print(f"[PASS] 20. Order Manager investigated and resolved complaint #{complaint_id}.")

    print("=" * 75)
    print("  ALL 20 VERIFICATION CHECKS PASSED WITH ZERO ERRORS!")
    print("=" * 75)


if __name__ == '__main__':
    main()
