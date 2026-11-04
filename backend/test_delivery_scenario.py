import os
import sys
import django
from decimal import Decimal
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
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
from delivery.services import (
    DeliveryFeeService,
    ShipmentWorkflowService,
    DeliveryOTPService,
)

User = get_user_model()


def run_full_delivery_verification():
    print("==================================================================")
    print("   ETHIOTECH MARKET: DELIVERY & LOGISTICS VERIFICATION SUITE")
    print("==================================================================")

    # 1. Setup / Retrieve Test Users
    customer, _ = User.objects.get_or_create(
        username='test_bahirdar_customer',
        defaults={
            'email': 'bahirdar.customer@test.com',
            'first_name': 'Abebe',
            'last_name': 'Bikila',
            'role': User.Role.CUSTOMER,
            'is_active': True,
        }
    )
    customer.set_password('CustomerPass123!')
    customer.save()

    order_mgr, _ = User.objects.get_or_create(
        username='test_order_manager',
        defaults={
            'email': 'order.manager@ethiotechmarket.com',
            'first_name': 'Hanna',
            'last_name': 'Kassahun',
            'role': User.Role.ORDER_MANAGER,
            'is_active': True,
        }
    )
    order_mgr.set_password('ManagerPass123!')
    order_mgr.save()

    store_mgr, _ = User.objects.get_or_create(
        username='test_store_manager',
        defaults={
            'email': 'store.manager@ethiotechmarket.com',
            'first_name': 'Tariku',
            'last_name': 'Lemma',
            'role': User.Role.STORE_MANAGER,
            'is_active': True,
        }
    )
    store_mgr.set_password('ManagerPass123!')
    store_mgr.save()

    # Product
    cat, _ = Category.objects.get_or_create(name='Computers & Laptops', defaults={'slug': 'computers-laptops'})
    product, _ = Product.objects.get_or_create(
        sku='LAP-DELL-XPS-BD',
        defaults={
            'name': 'Dell XPS 15 Gaming Laptop',
            'slug': 'dell-xps-15-laptop-bd',
            'category': cat,
            'price': Decimal('85000.00'),
            'stock': 15,
            'is_active': True,
            'description': 'High performance laptop',
        }
    )

    print(" [1] Verified test users (Customer, Order Manager, Store Manager) & sample product.")

    # 2. Test Delivery Fee Calculation for Bahir Dar
    fee_calc = DeliveryFeeService.calculate_shipping_fee(
        destination_city='Bahir Dar',
        delivery_method=DeliveryMethod.THIRD_PARTY_COURIER,
        weight_kg=2.5,
        origin_city='Addis Ababa'
    )
    assert fee_calc['destination_city'] == 'Bahir Dar', "Destination mismatch"
    assert fee_calc['total_shipping_fee'] > 0, "Fee calculation failed"
    print(f" [2] Delivery fee to Bahir Dar: ETB {fee_calc['total_shipping_fee']} (Base: {fee_calc['base_fee']}, PerKg: {fee_calc['per_kg_fee']}).")

    # 3. Customer places order to Bahir Dar
    order = Order.objects.create(
        customer=customer,
        subtotal=product.price,
        shipping_fee=Decimal(str(fee_calc['total_shipping_fee'])),
        tax=round(product.price * Decimal('0.15'), 2),
        total_amount=product.price + Decimal(str(fee_calc['total_shipping_fee'])) + round(product.price * Decimal('0.15'), 2),
        shipping_name='Abebe Bikila',
        shipping_phone='+251918765432',
        shipping_address='Kebele 04, House 128, Near Felege Hiwot Hospital',
        shipping_city='Bahir Dar',
        notes='Please call before arrival.',
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

    shipment = Shipment.objects.create(
        order=order,
        delivery_method=DeliveryMethod.THIRD_PARTY_COURIER,
        origin_city='Addis Ababa',
        destination_city='Bahir Dar',
        recipient_name=order.shipping_name,
        recipient_phone=order.shipping_phone,
        delivery_address=order.shipping_address,
        shipping_fee=order.shipping_fee,
        status=ShipmentStatus.PENDING,
    )
    print(f" [3] Order #{order.order_number} created with Shipment {shipment.tracking_number}.")

    # 4. Step 2: Order Manager confirms order
    ShipmentWorkflowService.advance_status(
        shipment=shipment,
        new_status=ShipmentStatus.CONFIRMED,
        location='Addis Ababa',
        description='Order verified and confirmed by Order Manager.',
        updated_by=order_mgr
    )
    order.refresh_from_db()
    assert order.fulfillment_status == Order.FulfillmentStatus.CONFIRMED
    print(f" [4] Step 2 passed: Order Manager confirmed order -> Shipment {shipment.status}, Order {order.fulfillment_status}.")

    # 5. Step 3: Store Manager prepares package & marks READY_FOR_DISPATCH
    ShipmentWorkflowService.advance_status(
        shipment=shipment,
        new_status=ShipmentStatus.PROCESSING,
        location='Addis Ababa Fulfillment Center',
        description='Stock picked and condition verified by Store Manager.',
        updated_by=store_mgr
    )
    ShipmentWorkflowService.advance_status(
        shipment=shipment,
        new_status=ShipmentStatus.READY_FOR_DISPATCH,
        location='Addis Ababa Dispatch Dock',
        description='Package boxed, weighed (2.5 kg), and ready for courier pickup.',
        updated_by=store_mgr
    )
    assert shipment.status == ShipmentStatus.READY_FOR_DISPATCH
    print(f" [5] Step 3 passed: Store Manager prepared package -> {shipment.status}.")

    # 6. Step 4 & 5: Assign ABC Express courier & mark PICKED_UP
    abc_express, _ = CourierCompany.objects.get_or_create(
        code='ABC_EXPRESS',
        defaults={
            'name': 'ABC Express Ethiopia',
            'contact_person': 'Abebe Courier',
            'phone_number': '+251911998877',
            'email': 'dispatch@abcexpress.et',
            'office_address': 'Bole, Addis Ababa',
            'origin_city': 'Addis Ababa',
            'supported_destination_cities': ['Bahir Dar', 'Hawassa', 'Adama']
        }
    )
    shipment.courier_company = abc_express
    shipment.external_tracking_number = 'ABC-ET-BD-88412'
    shipment.save()

    ShipmentWorkflowService.advance_status(
        shipment=shipment,
        new_status=ShipmentStatus.COURIER_ASSIGNED,
        location='Addis Ababa',
        description=f"Assigned to {abc_express.name}. External waybill: {shipment.external_tracking_number}.",
        updated_by=order_mgr
    )
    ShipmentWorkflowService.advance_status(
        shipment=shipment,
        new_status=ShipmentStatus.PICKED_UP,
        location='Addis Ababa Courier Branch',
        description=f"Courier collected parcel from warehouse dock.",
        updated_by=order_mgr
    )
    order.refresh_from_db()
    assert order.fulfillment_status == Order.FulfillmentStatus.SHIPPED
    print(f" [6] Step 4 & 5 passed: Assigned ABC Express & collected by courier -> {shipment.status}.")

    # 7. Step 6: In transit along Addis Ababa -> Bahir Dar highway
    ShipmentWorkflowService.advance_status(
        shipment=shipment,
        new_status=ShipmentStatus.IN_TRANSIT,
        location='Debre Markos Transit Corridor',
        description='Package in transit on regional transport vehicle.',
        updated_by=order_mgr
    )
    assert shipment.status == ShipmentStatus.IN_TRANSIT
    print(f" [7] Step 6 passed: Package in transit -> {shipment.status}.")

    # 8. Step 7 & 8: Arrives at Bahir Dar destination hub
    ShipmentWorkflowService.advance_status(
        shipment=shipment,
        new_status=ShipmentStatus.ARRIVED_AT_DESTINATION,
        location='Bahir Dar ABC Express Hub, Kebele 03',
        description='Package scanned and arrived at Bahir Dar distribution station.',
        updated_by=order_mgr
    )
    assert shipment.status == ShipmentStatus.ARRIVED_AT_DESTINATION
    print(f" [8] Step 7 & 8 passed: Package arrived at Bahir Dar station -> {shipment.status}.")

    # 9. Step 9 & 10: Assign local delivery agent & Out for delivery
    local_agent = DeliveryPersonnel.objects.filter(current_city='Bahir Dar').first()
    if not local_agent:
        local_agent = DeliveryPersonnel.objects.create(
            full_name='Getachew Mengistu',
            phone_number='+251933778899',
            employee_code='DRV-BD-01',
            current_city='Bahir Dar',
            delivery_method=DeliveryPersonnel.Method.THIRD_PARTY_LOCAL,
            is_active=True
        )
    shipment.delivery_personnel = local_agent
    shipment.save(update_fields=['delivery_personnel'])

    ShipmentWorkflowService.advance_status(
        shipment=shipment,
        new_status=ShipmentStatus.OUT_FOR_DELIVERY,
        location='Bahir Dar City',
        description=f"Out for local delivery with driver {local_agent.full_name} ({local_agent.phone_number}).",
        updated_by=order_mgr
    )
    assert shipment.status == ShipmentStatus.OUT_FOR_DELIVERY
    print(f" [9] Step 9 & 10 passed: Assigned local driver {local_agent.full_name} & Out for delivery -> {shipment.status}.")

    # 10. Step 11 & 12: Delivery OTP Request & Verification
    otp_res = DeliveryOTPService.request_delivery_otp(shipment=shipment, requested_by=order_mgr)
    assert otp_res['success'] is True, "OTP generation failed"
    print(f" [10] Step 11 passed: Secure OTP dispatched to customer. (Masked recipient: {otp_res['recipient_email_masked']}).")

    # Verify plain OTP is NOT returned in API response
    assert 'otp' not in otp_res and 'raw_otp' not in otp_res, "Security breach: plain OTP leaked in response!"

    # Test invalid OTP rejection
    otp_obj = DeliveryOTP.objects.filter(shipment=shipment, is_used=False).latest('created_at')
    try:
        DeliveryOTPService.verify_delivery_otp(shipment=shipment, raw_otp='000000', verified_by_user=order_mgr)
        assert False, "Invalid OTP should have failed!"
    except ValueError as e:
        print(f" [11] Invalid OTP correctly rejected: {e}")

    # Enter valid OTP (simulating customer reading the code from their email)
    # Check that check_otp works with the correct raw code
    # We can retrieve the record, test check_otp
    # In test context, we can extract or generate known OTP
    raw_valid_code = "987654"
    otp_obj.set_otp(raw_valid_code)
    otp_obj.attempts_count = 0
    otp_obj.save()

    verify_res = DeliveryOTPService.verify_delivery_otp(
        shipment=shipment,
        raw_otp=raw_valid_code,
        verified_by_user=order_mgr
    )
    assert verify_res['success'] is True, "OTP verification failed"

    shipment.refresh_from_db()
    order.refresh_from_db()
    assert shipment.status == ShipmentStatus.DELIVERED, "Shipment not DELIVERED"
    assert order.fulfillment_status == Order.FulfillmentStatus.DELIVERED, "Order fulfillment not DELIVERED"
    assert order.status == Order.Status.DELIVERED, "Order status not DELIVERED"
    assert shipment.actual_delivery_date is not None, "Actual delivery date not recorded"

    # Verify warranty activated
    item = order.items.first()
    assert item.warranty_start_date is not None, "Warranty not activated on delivery"
    print(f" [12] Step 12 passed: Valid OTP verified! Shipment & Order DELIVERED. Warranty activated until {item.warranty_end_date.strftime('%Y-%m-%d')}.")

    # 11. Test Method B: Own Delivery Service Scenario
    print("\n--- Testing Method B: Own Fleet Delivery ---")
    order_b = Order.objects.create(
        customer=customer,
        subtotal=Decimal('5000.00'),
        shipping_fee=Decimal('80.00'),
        tax=Decimal('750.00'),
        total_amount=Decimal('5830.00'),
        shipping_name='Abebe Bikila',
        shipping_phone='+251918765432',
        shipping_address='Bole Subcity, Woreda 03, Addis Ababa',
        shipping_city='Addis Ababa',
        payment_status=Order.PaymentStatus.PAID,
        fulfillment_status=Order.FulfillmentStatus.CONFIRMED,
    )
    vehicle = DeliveryVehicle.objects.filter(vehicle_type='VAN', current_city='Addis Ababa').first()
    if not vehicle:
        vehicle = DeliveryVehicle.objects.create(
            registration_number='AA-3-98214',
            vehicle_type=DeliveryVehicle.VehicleType.VAN,
            model='Toyota HiAce Cargo',
            current_city='Addis Ababa',
            is_active=True
        )
    driver = DeliveryPersonnel.objects.filter(delivery_method=DeliveryPersonnel.Method.OWN_FLEET).first()
    if not driver:
        driver = DeliveryPersonnel.objects.create(
            full_name='Ermias Bekele',
            phone_number='+251911443322',
            employee_code='DRV-AA-01',
            current_city='Addis Ababa',
            delivery_method=DeliveryPersonnel.Method.OWN_FLEET,
            is_active=True
        )

    shipment_b = Shipment.objects.create(
        order=order_b,
        delivery_method=DeliveryMethod.OWN_DELIVERY,
        origin_city='Addis Ababa',
        destination_city='Addis Ababa',
        recipient_name=order_b.shipping_name,
        recipient_phone=order_b.shipping_phone,
        delivery_address=order_b.shipping_address,
        shipping_fee=order_b.shipping_fee,
        vehicle=vehicle,
        delivery_personnel=driver,
        status=ShipmentStatus.READY_FOR_DISPATCH,
    )
    ShipmentWorkflowService.advance_status(
        shipment=shipment_b,
        new_status=ShipmentStatus.PICKED_UP,
        location='Addis Ababa Warehouse',
        description=f"Collected by company vehicle {vehicle.registration_number} ({driver.full_name}).",
        updated_by=order_mgr
    )
    ShipmentWorkflowService.advance_status(
        shipment=shipment_b,
        new_status=ShipmentStatus.OUT_FOR_DELIVERY,
        location='Addis Ababa Bole Corridor',
        description=f"Own fleet van out for delivery with {driver.full_name}.",
        updated_by=order_mgr
    )
    assert shipment_b.vehicle.registration_number == vehicle.registration_number
    assert shipment_b.delivery_personnel.full_name == driver.full_name
    print(f" [13] Own fleet dispatch passed: Vehicle {vehicle.registration_number}, Driver {driver.full_name} -> {shipment_b.status}.")

    # 12. Test Delivery Attempt Failure
    attempt = DeliveryAttempt.objects.create(
        shipment=shipment_b,
        delivery_personnel=driver,
        attempt_number=1,
        reason=DeliveryAttempt.Reason.CUSTOMER_UNAVAILABLE,
        notes='Customer gate locked, phone rang with no answer.',
        next_scheduled_attempt=(timezone.now() + timezone.timedelta(days=1)).date()
    )
    ShipmentWorkflowService.advance_status(
        shipment=shipment_b,
        new_status=ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
        location='Bole, Addis Ababa',
        description=f"Attempt #1 failed: {attempt.get_reason_display()}.",
        updated_by=order_mgr,
        force=True
    )
    assert shipment_b.status == ShipmentStatus.DELIVERY_ATTEMPT_FAILED
    print(f" [14] Failed delivery attempt recorded: {attempt.get_reason_display()} -> Status {shipment_b.status}.")

    # 13. Test Customer Delivery Complaint
    complaint = DeliveryComplaint.objects.create(
        shipment=shipment,
        order=order,
        customer=customer,
        complaint_type=DeliveryComplaint.ComplaintType.DAMAGED,
        description='External laptop box had minor tear upon unboxing.',
        status=DeliveryComplaint.Status.OPEN
    )
    assert complaint.status == DeliveryComplaint.Status.OPEN
    # Order manager investigates and resolves
    complaint.status = DeliveryComplaint.Status.RESOLVED
    complaint.resolution_notes = 'Inspected photos. Laptop intact, issued 500 ETB courtesy store voucher.'
    complaint.investigated_by = order_mgr
    complaint.resolved_at = timezone.now()
    complaint.save()
    assert complaint.status == DeliveryComplaint.Status.RESOLVED
    print(f" [15] Customer complaint logged & resolved by Order Manager: {complaint.get_complaint_type_display()}.")

    # 14. Verify Complete Event History for Bahir Dar Shipment
    events = shipment.events.all()
    print(f"\n [16] Shipment {shipment.tracking_number} Full Tracking Event History ({events.count()} events):")
    for ev in events:
        print(f"      - [{ev.timestamp.strftime('%H:%M:%S')}] {ev.status:<26} @ {ev.location:<30} : {ev.description}")

    assert events.count() >= 8, f"Expected at least 8 tracking events, got {events.count()}"
    print("\n==================================================================")
    print("   ALL LOGISTICS & DELIVERY VERIFICATION TESTS PASSED SUCCESSFULLY! ")
    print("==================================================================")


if __name__ == '__main__':
    run_full_delivery_verification()
