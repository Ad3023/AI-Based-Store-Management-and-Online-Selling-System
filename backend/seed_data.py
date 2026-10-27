import os
import sys
from pathlib import Path

# Ensure backend directory is in sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from accounts.models import User, CustomerProfile
from products.models import Category, Product, ProductReview, StockMovement
from orders.models import Cart, Order, OrderItem, PaymentEvidence, Receipt
from recommendations.models import CustomerActivity
from recommendations.engine import AIRecommendationEngine
from notifications.models import Notification

def seed():
    print("--- Starting Database Seeding ---")

    # 1. Create Roles & Users
    admin_user, _ = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@store.com',
            'first_name': 'System',
            'last_name': 'Administrator',
            'role': User.Role.ADMIN,
            'is_staff': True,
            'is_superuser': True
        }
    )
    admin_user.set_password('admin123')
    admin_user.save()
    Token.objects.get_or_create(user=admin_user)
    print("Admin created: admin / admin123")

    manager_user, _ = User.objects.get_or_create(
        username='manager',
        defaults={
            'email': 'manager@store.com',
            'first_name': 'Alemayehu',
            'last_name': 'Store Manager',
            'role': User.Role.STORE_MANAGER,
            'is_staff': True
        }
    )
    manager_user.set_password('manager123')
    manager_user.save()
    Token.objects.get_or_create(user=manager_user)
    print("Store Manager created: manager / manager123")

    customers_data = [
        {
            'username': 'abebe',
            'email': 'abebe@gmail.com',
            'first_name': 'Abebe',
            'last_name': 'Bikila',
            'phone_number': '+251911223344',
            'address': 'Bole Subcity, House 241',
            'city': 'Addis Ababa',
        },
        {
            'username': 'sara',
            'email': 'sara@gmail.com',
            'first_name': 'Sara',
            'last_name': 'Yohannes',
            'phone_number': '+251922334455',
            'address': 'Piazza, Main St',
            'city': 'Hawassa',
        },
        {
            'username': 'dawit',
            'email': 'dawit@gmail.com',
            'first_name': 'Dawit',
            'last_name': 'Kebede',
            'phone_number': '+251933445566',
            'address': 'Kebele 04, House 112',
            'city': 'Adama',
        },
        {
            'username': 'tigist',
            'email': 'tigist@gmail.com',
            'first_name': 'Tigist',
            'last_name': 'Alemu',
            'phone_number': '+251944556677',
            'address': 'Diaspora Village',
            'city': 'Bahir Dar',
        }
    ]

    customers = []
    for c_info in customers_data:
        c_user, created = User.objects.get_or_create(
            username=c_info['username'],
            defaults={
                'email': c_info['email'],
                'first_name': c_info['first_name'],
                'last_name': c_info['last_name'],
                'phone_number': c_info['phone_number'],
                'address': c_info['address'],
                'city': c_info['city'],
                'role': User.Role.CUSTOMER
            }
        )
        c_user.set_password('customer123')
        c_user.save()
        Token.objects.get_or_create(user=c_user)
        CustomerProfile.objects.get_or_create(user=c_user)
        Cart.objects.get_or_create(user=c_user)
        customers.append(c_user)
    print("Customers created with password 'customer123'")

    # 2. Categories
    categories_info = [
        {'name': 'Smartphones & Tablets', 'description': 'Flagship mobile devices, 5G smartphones, and high-performance tablets.'},
        {'name': 'Laptops & Computers', 'description': 'Ultraportable notebooks, developer workstations, and creative powerhouses.'},
        {'name': 'Audio & Headphones', 'description': 'Audiophile wireless headphones, earbuds, and spatial sound gear.'},
        {'name': 'Smart Wearables', 'description': 'Fitness smartwatches, health trackers, and connected wristwear.'},
        {'name': 'Accessories & Gadgets', 'description': 'High-speed chargers, ergonomic mechanical keyboards, and precision mice.'},
    ]

    cats = {}
    for c_data in categories_info:
        cat, _ = Category.objects.get_or_create(name=c_data['name'], defaults={'description': c_data['description']})
        cats[c_data['name']] = cat
    print("Categories created.")

    # 3. Products
    products_info = [
        {
            'category': cats['Smartphones & Tablets'],
            'name': 'iPhone 15 Pro Max 256GB Titanium',
            'description': 'Forged in aerospace-grade titanium with the powerful A17 Pro chip, customizable Action button, and advanced 48MP camera system with 5x optical telephoto.',
            'price': 1199.99,
            'cost_price': 980.00,
            'stock': 15,
            'is_featured': True,
            'rating_average': 4.90,
            'rating_count': 18
        },
        {
            'category': cats['Smartphones & Tablets'],
            'name': 'Samsung Galaxy S24 Ultra AI Smartphone',
            'description': 'Galaxy AI with Circle to Search, Live Translate, Note Assist, 200MP camera with Quad Telephoto, Titanium exterior, and built-in S Pen.',
            'price': 1249.99,
            'cost_price': 1020.00,
            'stock': 12,
            'is_featured': True,
            'rating_average': 4.85,
            'rating_count': 14
        },
        {
            'category': cats['Smartphones & Tablets'],
            'name': 'iPad Air 11-inch M2 Liquid Retina',
            'description': 'Blazing fast Apple M2 silicon with 8-core CPU and 10-core GPU, landscape 12MP front camera with Center Stage, and Wi-Fi 6E connectivity.',
            'price': 599.00,
            'cost_price': 480.00,
            'stock': 8,
            'is_featured': False,
            'rating_average': 4.75,
            'rating_count': 9
        },
        {
            'category': cats['Laptops & Computers'],
            'name': 'MacBook Pro 14 M3 Pro 18GB/512GB Space Black',
            'description': 'Next-generation M3 Pro chip featuring hardware-accelerated ray tracing, Liquid Retina XDR display with 1600 nits peak brightness, and up to 18 hours battery life.',
            'price': 1999.00,
            'cost_price': 1650.00,
            'stock': 6,
            'is_featured': True,
            'rating_average': 4.95,
            'rating_count': 22
        },
        {
            'category': cats['Laptops & Computers'],
            'name': 'Dell XPS 15 OLED Core i7 16GB RTX 4060',
            'description': 'Stunning 3.5K OLED InfinityEdge touch display, 13th Gen Intel Core i7 processor, NVIDIA GeForce RTX 4060 graphics, and machined aluminum chassis.',
            'price': 1749.00,
            'cost_price': 1420.00,
            'stock': 4,  # Low stock
            'is_featured': True,
            'rating_average': 4.70,
            'rating_count': 11
        },
        {
            'category': cats['Audio & Headphones'],
            'name': 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
            'description': 'Industry-leading noise cancelation with two processors and eight microphones, Auto NC Optimizer, crystal-clear hands-free calling, and 30-hour battery life.',
            'price': 349.99,
            'cost_price': 250.00,
            'stock': 16,
            'is_featured': True,
            'rating_average': 4.80,
            'rating_count': 26
        },
        {
            'category': cats['Audio & Headphones'],
            'name': 'Apple AirPods Pro 2nd Gen USB-C Active Noise Cancellation',
            'description': 'H2 chip power, up to 2x more Active Noise Cancellation, Adaptive Audio, Transparency mode, Personalized Spatial Audio, and MagSafe Charging Case (USB-C).',
            'price': 239.00,
            'cost_price': 175.00,
            'stock': 20,
            'is_featured': True,
            'rating_average': 4.88,
            'rating_count': 35
        },
        {
            'category': cats['Smart Wearables'],
            'name': 'Apple Watch Ultra 2 Rugged Titanium GPS+Cellular',
            'description': 'Extreme sports and outdoor watch with 49mm titanium case, 3000-nit display, precision dual-frequency GPS, customizable Action button, and 36-hour battery life.',
            'price': 779.00,
            'cost_price': 630.00,
            'stock': 3,  # Low stock
            'is_featured': True,
            'rating_average': 4.92,
            'rating_count': 12
        },
        {
            'category': cats['Smart Wearables'],
            'name': 'Samsung Galaxy Watch 6 Classic 47mm LTE',
            'description': 'Rotating physical bezel, sapphire crystal glass, advanced sleep coaching, body composition analysis BIA sensor, and stainless steel housing.',
            'price': 329.00,
            'cost_price': 240.00,
            'stock': 9,
            'is_featured': False,
            'rating_average': 4.65,
            'rating_count': 8
        },
        {
            'category': cats['Accessories & Gadgets'],
            'name': 'Anker 737 Power Bank 24000mAh 140W GaNPrime',
            'description': 'Ultra-powerful two-way charging with Power Delivery 3.1 and bi-directional technology to quickly recharge the portable charger or power high-drain laptops.',
            'price': 109.99,
            'cost_price': 68.00,
            'stock': 24,
            'is_featured': False,
            'rating_average': 4.82,
            'rating_count': 19
        },
        {
            'category': cats['Accessories & Gadgets'],
            'name': 'Logitech MX Master 3S Ergonomic Mouse',
            'description': 'Quiet clicks with 8000 DPI any-surface tracking including glass, MagSpeed electromagnetic scrolling, and customizable ergonomic thumb buttons.',
            'price': 99.99,
            'cost_price': 65.00,
            'stock': 18,
            'is_featured': False,
            'rating_average': 4.91,
            'rating_count': 30
        },
        {
            'category': cats['Accessories & Gadgets'],
            'name': 'Keychron K2 Pro QMK Wireless Mechanical Keyboard',
            'description': '75% compact wireless mechanical keyboard, hot-swappable Keychron K Pro switches, south-facing RGB backlighting, and programmable QMK/VIA firmware.',
            'price': 89.00,
            'cost_price': 52.00,
            'stock': 2,  # Low stock alert
            'is_featured': False,
            'rating_average': 4.78,
            'rating_count': 15
        }
    ]

    products = []
    for p_info in products_info:
        prod, created = Product.objects.get_or_create(
            name=p_info['name'],
            defaults=p_info
        )
        products.append(prod)
    print("Products created.")

    # 4. Realistic Completed and Pending Orders
    # Order 1: Abebe purchased iPhone + AirPods (Verified, Receipt issued)
    p_iphone = products[0]
    p_airpods = products[6]

    order1, _ = Order.objects.get_or_create(
        order_number='ORD-20261015-ABEBE1',
        defaults={
            'customer': customers[0],
            'status': Order.Status.PROCESSING,
            'subtotal': p_iphone.price + p_airpods.price,
            'tax': round(float(p_iphone.price + p_airpods.price) * 0.15, 2),
            'shipping_fee': 50.00,
            'total_amount': float(p_iphone.price + p_airpods.price) * 1.15 + 50.00,
            'shipping_name': 'Abebe Bikila',
            'shipping_phone': '+251911223344',
            'shipping_address': 'Bole Subcity, House 241',
            'shipping_city': 'Addis Ababa',
        }
    )
    OrderItem.objects.get_or_create(order=order1, product=p_iphone, defaults={'quantity': 1, 'unit_price': p_iphone.price, 'total_price': p_iphone.price})
    OrderItem.objects.get_or_create(order=order1, product=p_airpods, defaults={'quantity': 1, 'unit_price': p_airpods.price, 'total_price': p_airpods.price})

    # Payment Evidence approved
    ev1, _ = PaymentEvidence.objects.get_or_create(
        order=order1,
        defaults={
            'payment_method': 'Commercial Bank of Ethiopia (CBE Birr)',
            'transaction_reference': 'CBE-FT20261015-998822',
            'verification_status': PaymentEvidence.VerificationStatus.APPROVED,
            'verified_by': manager_user
        }
    )
    # Receipt issued
    Receipt.objects.get_or_create(
        order=order1,
        defaults={
            'receipt_number': 'RCP-20261015-7721',
            'verified_by': manager_user
        }
    )

    # Order 2: Sara purchased MacBook Pro + MX Master 3S (Payment Submitted - Waiting Store Manager Approval)
    p_mac = products[3]
    p_mouse = products[10]

    order2, _ = Order.objects.get_or_create(
        order_number='ORD-20261018-SARA02',
        defaults={
            'customer': customers[1],
            'status': Order.Status.PAYMENT_SUBMITTED,
            'subtotal': p_mac.price + p_mouse.price,
            'tax': round(float(p_mac.price + p_mouse.price) * 0.15, 2),
            'shipping_fee': 50.00,
            'total_amount': float(p_mac.price + p_mouse.price) * 1.15 + 50.00,
            'shipping_name': 'Sara Yohannes',
            'shipping_phone': '+251922334455',
            'shipping_address': 'Piazza, Main St',
            'shipping_city': 'Hawassa',
            'notes': 'Please call before delivery'
        }
    )
    OrderItem.objects.get_or_create(order=order2, product=p_mac, defaults={'quantity': 1, 'unit_price': p_mac.price, 'total_price': p_mac.price})
    OrderItem.objects.get_or_create(order=order2, product=p_mouse, defaults={'quantity': 1, 'unit_price': p_mouse.price, 'total_price': p_mouse.price})

    PaymentEvidence.objects.get_or_create(
        order=order2,
        defaults={
            'payment_method': 'Telebirr SuperApp',
            'transaction_reference': 'TB-8899332211',
            'verification_status': PaymentEvidence.VerificationStatus.PENDING,
        }
    )

    # Order 3: Dawit purchased Sony WH-1000XM5 + Anker Power Bank (Pending Payment)
    p_sony = products[5]
    p_anker = products[9]

    order3, _ = Order.objects.get_or_create(
        order_number='ORD-20261019-DAWIT03',
        defaults={
            'customer': customers[2],
            'status': Order.Status.PENDING_PAYMENT,
            'subtotal': p_sony.price + p_anker.price,
            'tax': round(float(p_sony.price + p_anker.price) * 0.15, 2),
            'shipping_fee': 50.00,
            'total_amount': float(p_sony.price + p_anker.price) * 1.15 + 50.00,
            'shipping_name': 'Dawit Kebede',
            'shipping_phone': '+251933445566',
            'shipping_address': 'Kebele 04, House 112',
            'shipping_city': 'Adama',
        }
    )
    OrderItem.objects.get_or_create(order=order3, product=p_sony, defaults={'quantity': 1, 'unit_price': p_sony.price, 'total_price': p_sony.price})
    OrderItem.objects.get_or_create(order=order3, product=p_anker, defaults={'quantity': 1, 'unit_price': p_anker.price, 'total_price': p_anker.price})

    # 5. Customer Activities for AI training
    for cust, prod in zip(customers, products[:4]):
        CustomerActivity.objects.get_or_create(
            user=cust,
            product=prod,
            activity_type=CustomerActivity.ActivityType.PURCHASE
        )
    for prod in products:
        CustomerActivity.objects.get_or_create(
            user=customers[0],
            product=prod,
            activity_type=CustomerActivity.ActivityType.VIEW
        )

    # 6. Run AI Customer Segmentation
    print("Training AI Customer Segmentation (K-Means)...")
    AIRecommendationEngine.run_customer_segmentation()
    print("Customer Segmentation trained and saved.")

    # 7. Seed sample in-app notifications
    Notification.objects.get_or_create(
        user=customers[0],
        title="Payment Verified & Receipt Ready",
        defaults={
            'message': 'Your payment for Order #ORD-20261015-ABEBE1 has been verified! You can now download your official receipt.',
            'notification_type': Notification.NotificationType.PAYMENT_VERIFIED,
            'is_read': False,
            'link': f"/receipts/{order1.id}"
        }
    )
    Notification.objects.get_or_create(
        user=manager_user,
        title="Pending Payment Evidence",
        defaults={
            'message': 'Customer Sara Yohannes submitted payment evidence for Order #ORD-20261018-SARA02. Awaiting review.',
            'notification_type': Notification.NotificationType.ORDER_UPDATE,
            'is_read': False,
            'link': f"/manager/orders/{order2.id}"
        }
    )

    print("--- Database Seeding Completed Successfully! ---")

if __name__ == '__main__':
    seed()
