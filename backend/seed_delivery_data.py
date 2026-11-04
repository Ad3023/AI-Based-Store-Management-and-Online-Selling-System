import os
import sys
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from delivery.models import (
    CourierCompany,
    DeliveryVehicle,
    DeliveryPersonnel,
    DeliveryFeeRule,
    DeliverySetting,
    DeliveryMethod,
)


def seed_delivery():
    print("--- Seeding Demonstration Logistics and Delivery Data ---")

    # 1. Delivery Settings
    settings_obj, _ = DeliverySetting.objects.get_or_create(id=1)
    settings_obj.default_delivery_method = DeliveryMethod.THIRD_PARTY_COURIER
    settings_obj.third_party_courier_enabled = True
    settings_obj.own_delivery_enabled = True
    settings_obj.otp_expiry_minutes = 5
    settings_obj.otp_max_attempts = 3
    settings_obj.otp_cooldown_seconds = 60
    settings_obj.save()
    print(" [x] Delivery Settings initialized (Default: Third-Party Courier).")

    # 2. Courier Companies (Demonstration Partners)
    couriers_data = [
        {
            'name': 'ABC Express Ethiopia (Demo)',
            'code': 'ABC_EXPRESS',
            'contact_person': 'Dawit Haile',
            'phone_number': '+251911223344',
            'email': 'info@abcexpress-demo.et',
            'office_address': 'Bole Medhanialem, Commercial Center 3rd Floor, Addis Ababa',
            'origin_city': 'Addis Ababa',
            'supported_destination_cities': [
                'Bahir Dar', 'Hawassa', 'Adama', 'Mekelle', 'Dire Dawa', 'Gondar', 'Jimma', 'Bishoftu'
            ],
            'service_description': '[DEMONSTRATION PARTNER] Express door-to-door and regional hub delivery with OTP proof of delivery.',
            'tracking_url_template': 'https://track.abcexpress-demo.et/{tracking_number}',
            'is_active': True,
        },
        {
            'name': 'Ethio Postal Logistics (Demo)',
            'code': 'ETHIO_POST',
            'contact_person': 'Almaz Kebede',
            'phone_number': '+251922334455',
            'email': 'support@ethiopost-demo.et',
            'office_address': 'Churchill Road, Central Post Office Building, Addis Ababa',
            'origin_city': 'Addis Ababa',
            'supported_destination_cities': [
                'Bahir Dar', 'Hawassa', 'Adama', 'Mekelle', 'Dire Dawa', 'Gondar', 'Jimma', 'Harar', 'Dessie'
            ],
            'service_description': '[DEMONSTRATION PARTNER] Universal national parcel distribution and regional branch pickup.',
            'tracking_url_template': 'https://track.ethiopost-demo.et/{tracking_number}',
            'is_active': True,
        },
        {
            'name': 'Tikur Abay Logistics (Demo)',
            'code': 'TIKUR_ABAY',
            'contact_person': 'Solomon Tadesse',
            'phone_number': '+251933445566',
            'email': 'operations@tikurabay-demo.et',
            'office_address': 'Kera Commercial Center, Addis Ababa',
            'origin_city': 'Addis Ababa',
            'supported_destination_cities': [
                'Bahir Dar', 'Gondar', 'Debre Markos', 'Adama'
            ],
            'service_description': '[DEMONSTRATION PARTNER] Regional North corridor freight and retail parcel express.',
            'tracking_url_template': 'https://track.tikurabay-demo.et/{tracking_number}',
            'is_active': True,
        },
    ]

    for cdata in couriers_data:
        obj, created = CourierCompany.objects.update_or_create(
            code=cdata['code'],
            defaults=cdata
        )
        print(f" [x] Courier Company: {obj.name} (Created: {created})")

    # 3. Delivery Vehicles (Own Fleet)
    vehicles_data = [
        {
            'registration_number': 'AA-3-98214',
            'vehicle_type': DeliveryVehicle.VehicleType.VAN,
            'model': 'Toyota HiAce 2022',
            'driver_name': 'Ermias Bekele',
            'driver_phone': '+251911556677',
            'current_city': 'Addis Ababa',
            'status': DeliveryVehicle.Status.AVAILABLE,
            'is_active': True,
        },
        {
            'registration_number': 'AA-2-41092',
            'vehicle_type': DeliveryVehicle.VehicleType.MOTORCYCLE,
            'model': 'TVS HLX 150 2023',
            'driver_name': 'Yonas Alemu',
            'driver_phone': '+251922667788',
            'current_city': 'Addis Ababa',
            'status': DeliveryVehicle.Status.AVAILABLE,
            'is_active': True,
        },
        {
            'registration_number': 'AM-3-12845',
            'vehicle_type': DeliveryVehicle.VehicleType.VAN,
            'model': 'Hyundai H-100 2021',
            'driver_name': 'Getachew Mengistu',
            'driver_phone': '+251933778899',
            'current_city': 'Bahir Dar',
            'status': DeliveryVehicle.Status.AVAILABLE,
            'is_active': True,
        },
        {
            'registration_number': 'AA-4-77120',
            'vehicle_type': DeliveryVehicle.VehicleType.TRUCK,
            'model': 'Isuzu Forward 2021',
            'driver_name': 'Tilahun Worku',
            'driver_phone': '+251944889900',
            'current_city': 'Addis Ababa',
            'status': DeliveryVehicle.Status.AVAILABLE,
            'is_active': True,
        },
    ]

    for vdata in vehicles_data:
        v_obj, created = DeliveryVehicle.objects.update_or_create(
            registration_number=vdata['registration_number'],
            defaults=vdata
        )
        print(f" [x] Vehicle: {v_obj.registration_number} ({v_obj.model})")

    # 4. Delivery Personnel
    abc_express = CourierCompany.objects.filter(code='ABC_EXPRESS').first()
    personnel_data = [
        {
            'full_name': 'Ermias Bekele',
            'phone_number': '+251911556677',
            'email': 'ermias.delivery@ethiotechmarket.com',
            'employee_code': 'EMP-DEL-101',
            'delivery_method': DeliveryPersonnel.Method.OWN_FLEET,
            'current_city': 'Addis Ababa',
            'is_available': True,
            'is_active': True,
        },
        {
            'full_name': 'Yonas Alemu',
            'phone_number': '+251922667788',
            'email': 'yonas.delivery@ethiotechmarket.com',
            'employee_code': 'EMP-DEL-102',
            'delivery_method': DeliveryPersonnel.Method.OWN_FLEET,
            'current_city': 'Addis Ababa',
            'is_available': True,
            'is_active': True,
        },
        {
            'full_name': 'Getachew Mengistu',
            'phone_number': '+251933778899',
            'email': 'getachew.delivery@ethiotechmarket.com',
            'employee_code': 'EMP-DEL-201',
            'delivery_method': DeliveryPersonnel.Method.THIRD_PARTY_LOCAL,
            'courier_company': abc_express,
            'current_city': 'Bahir Dar',
            'is_available': True,
            'is_active': True,
        },
        {
            'full_name': 'Bethelhem Tadesse',
            'phone_number': '+251955112233',
            'email': 'bethelhem.delivery@ethiotechmarket.com',
            'employee_code': 'EMP-DEL-301',
            'delivery_method': DeliveryPersonnel.Method.THIRD_PARTY_LOCAL,
            'courier_company': abc_express,
            'current_city': 'Hawassa',
            'is_available': True,
            'is_active': True,
        },
    ]

    for pdata in personnel_data:
        p_obj, created = DeliveryPersonnel.objects.update_or_create(
            employee_code=pdata['employee_code'],
            defaults=pdata
        )
        print(f" [x] Personnel: {p_obj.full_name} ({p_obj.current_city} - {p_obj.employee_code})")

    # 5. Delivery Fee Rules
    fee_rules_data = [
        {'orig': 'Addis Ababa', 'dest': 'Bahir Dar', 'method': 'ALL', 'base': Decimal('180.00'), 'kg': Decimal('35.00'), 'min_d': 2, 'max_d': 3},
        {'orig': 'Addis Ababa', 'dest': 'Hawassa', 'method': 'ALL', 'base': Decimal('150.00'), 'kg': Decimal('30.00'), 'min_d': 1, 'max_d': 2},
        {'orig': 'Addis Ababa', 'dest': 'Adama', 'method': 'ALL', 'base': Decimal('120.00'), 'kg': Decimal('25.00'), 'min_d': 1, 'max_d': 2},
        {'orig': 'Addis Ababa', 'dest': 'Mekelle', 'method': 'ALL', 'base': Decimal('220.00'), 'kg': Decimal('40.00'), 'min_d': 3, 'max_d': 5},
        {'orig': 'Addis Ababa', 'dest': 'Dire Dawa', 'method': 'ALL', 'base': Decimal('200.00'), 'kg': Decimal('35.00'), 'min_d': 2, 'max_d': 3},
        {'orig': 'Addis Ababa', 'dest': 'Gondar', 'method': 'ALL', 'base': Decimal('190.00'), 'kg': Decimal('35.00'), 'min_d': 2, 'max_d': 3},
        {'orig': 'Addis Ababa', 'dest': 'Addis Ababa', 'method': 'ALL', 'base': Decimal('80.00'), 'kg': Decimal('15.00'), 'min_d': 1, 'max_d': 1},
    ]

    for r in fee_rules_data:
        r_obj, created = DeliveryFeeRule.objects.update_or_create(
            origin_city=r['orig'],
            destination_city=r['dest'],
            delivery_method=r['method'],
            defaults={
                'base_fee': r['base'],
                'per_kg_fee': r['kg'],
                'estimated_days_min': r['min_d'],
                'estimated_days_max': r['max_d'],
                'is_active': True,
            }
        )
        print(f" [x] Fee Rule: {r['orig']} -> {r['dest']} (Base: ETB {r['base']})")

    print("--- Demonstration Logistics Data Seeding Finished Successfully ---")


if __name__ == '__main__':
    seed_delivery()
