import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from products.models import Category, Product, Supplier

def seed_catalog():
    print("=== Seeding Fresh Catalog Products ===")

    # 1. Suppliers
    suppliers_data = [
        {'name': 'Apple Authorized Distributor East Africa', 'contact_person': 'Daniel Haile', 'email': 'apple.orders@eastafricadist.com', 'phone': '+251911001122'},
        {'name': 'Samsung Electronics East Africa Hub', 'contact_person': 'Helen Tadesse', 'email': 'b2b.samsung@ethiotech.com', 'phone': '+251911334455'},
        {'name': 'Sony Middle East & Africa FZE', 'contact_person': 'Markos Berhe', 'email': 'sony.mea.dist@ethiotech.com', 'phone': '+251911556677'},
        {'name': 'Dell Technologies Partner Network', 'contact_person': 'Sara Gebre', 'email': 'dell.enterprise@ethiotech.com', 'phone': '+251911778899'},
        {'name': 'Anker Innovations Official Partner', 'contact_person': 'Kenenisa Bekele', 'email': 'anker.supplies@ethiotech.com', 'phone': '+251911990011'},
        {'name': 'Logitech & Keychron Regional Distribution', 'contact_person': 'Tigist Assefa', 'email': 'peripherals@ethiotech.com', 'phone': '+251911223388'},
    ]
    suppliers = {}
    for s_info in suppliers_data:
        sup, _ = Supplier.objects.get_or_create(
            name=s_info['name'],
            defaults=s_info
        )
        suppliers[s_info['name']] = sup
    print(f"Created/Verified {len(suppliers)} Suppliers.")

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
        cat, _ = Category.objects.get_or_create(
            name=c_data['name'],
            defaults={'description': c_data['description'], 'is_active': True}
        )
        cats[c_data['name']] = cat
    print(f"Created/Verified {len(cats)} Categories.")

    # 3. 12 Flagship Products
    products_info = [
        {
            'category': cats['Smartphones & Tablets'],
            'supplier': suppliers['Apple Authorized Distributor East Africa'],
            'name': 'iPhone 15 Pro Max 256GB Titanium',
            'description': 'Forged in aerospace-grade titanium with the powerful A17 Pro chip, customizable Action button, and advanced 48MP camera system with 5x optical telephoto.',
            'price': Decimal('1199.99'),
            'cost_price': Decimal('980.00'),
            'stock': 15,
            'low_stock_threshold': 5,
            'reorder_quantity': 20,
            'is_featured': True,
            'rating_average': Decimal('4.90'),
            'rating_count': 18
        },
        {
            'category': cats['Smartphones & Tablets'],
            'supplier': suppliers['Samsung Electronics East Africa Hub'],
            'name': 'Samsung Galaxy S24 Ultra AI Smartphone',
            'description': 'Galaxy AI with Circle to Search, Live Translate, Note Assist, 200MP camera with Quad Telephoto, Titanium exterior, and built-in S Pen.',
            'price': Decimal('1249.99'),
            'cost_price': Decimal('1020.00'),
            'stock': 12,
            'low_stock_threshold': 4,
            'reorder_quantity': 15,
            'is_featured': True,
            'rating_average': Decimal('4.85'),
            'rating_count': 14
        },
        {
            'category': cats['Smartphones & Tablets'],
            'supplier': suppliers['Apple Authorized Distributor East Africa'],
            'name': 'iPad Air 11-inch M2 Liquid Retina',
            'description': 'Blazing fast Apple M2 silicon with 8-core CPU and 10-core GPU, landscape 12MP front camera with Center Stage, and Wi-Fi 6E connectivity.',
            'price': Decimal('599.00'),
            'cost_price': Decimal('480.00'),
            'stock': 8,
            'low_stock_threshold': 3,
            'reorder_quantity': 10,
            'is_featured': False,
            'rating_average': Decimal('4.75'),
            'rating_count': 9
        },
        {
            'category': cats['Laptops & Computers'],
            'supplier': suppliers['Apple Authorized Distributor East Africa'],
            'name': 'MacBook Pro 14 M3 Pro 18GB/512GB Space Black',
            'description': 'Next-generation M3 Pro chip featuring hardware-accelerated ray tracing, Liquid Retina XDR display with 1600 nits peak brightness, and up to 18 hours battery life.',
            'price': Decimal('1999.00'),
            'cost_price': Decimal('1650.00'),
            'stock': 6,
            'low_stock_threshold': 2,
            'reorder_quantity': 8,
            'is_featured': True,
            'rating_average': Decimal('4.95'),
            'rating_count': 22
        },
        {
            'category': cats['Laptops & Computers'],
            'supplier': suppliers['Dell Technologies Partner Network'],
            'name': 'Dell XPS 15 OLED Core i7 16GB RTX 4060',
            'description': 'Stunning 3.5K OLED InfinityEdge touch display, 13th Gen Intel Core i7 processor, NVIDIA GeForce RTX 4060 graphics, and machined aluminum chassis.',
            'price': Decimal('1749.00'),
            'cost_price': Decimal('1420.00'),
            'stock': 7,
            'low_stock_threshold': 3,
            'reorder_quantity': 6,
            'is_featured': True,
            'rating_average': Decimal('4.70'),
            'rating_count': 11
        },
        {
            'category': cats['Audio & Headphones'],
            'supplier': suppliers['Sony Middle East & Africa FZE'],
            'name': 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
            'description': 'Industry-leading noise cancelation with two processors and eight microphones, Auto NC Optimizer, crystal-clear hands-free calling, and 30-hour battery life.',
            'price': Decimal('349.99'),
            'cost_price': Decimal('250.00'),
            'stock': 16,
            'low_stock_threshold': 5,
            'reorder_quantity': 15,
            'is_featured': True,
            'rating_average': Decimal('4.80'),
            'rating_count': 26
        },
        {
            'category': cats['Audio & Headphones'],
            'supplier': suppliers['Apple Authorized Distributor East Africa'],
            'name': 'Apple AirPods Pro 2nd Gen USB-C Active Noise Cancellation',
            'description': 'H2 chip power, up to 2x more Active Noise Cancellation, Adaptive Audio, Transparency mode, Personalized Spatial Audio, and MagSafe Charging Case (USB-C).',
            'price': Decimal('239.00'),
            'cost_price': Decimal('175.00'),
            'stock': 20,
            'low_stock_threshold': 5,
            'reorder_quantity': 25,
            'is_featured': True,
            'rating_average': Decimal('4.88'),
            'rating_count': 35
        },
        {
            'category': cats['Smart Wearables'],
            'supplier': suppliers['Apple Authorized Distributor East Africa'],
            'name': 'Apple Watch Ultra 2 Rugged Titanium GPS+Cellular',
            'description': 'Extreme sports and outdoor watch with 49mm titanium case, 3000-nit display, precision dual-frequency GPS, customizable Action button, and 36-hour battery life.',
            'price': Decimal('779.00'),
            'cost_price': Decimal('630.00'),
            'stock': 5,
            'low_stock_threshold': 3,
            'reorder_quantity': 10,
            'is_featured': True,
            'rating_average': Decimal('4.92'),
            'rating_count': 12
        },
        {
            'category': cats['Smart Wearables'],
            'supplier': suppliers['Samsung Electronics East Africa Hub'],
            'name': 'Samsung Galaxy Watch 6 Classic 47mm LTE',
            'description': 'Rotating physical bezel, sapphire crystal glass, advanced sleep coaching, body composition analysis BIA sensor, and stainless steel housing.',
            'price': Decimal('329.00'),
            'cost_price': Decimal('240.00'),
            'stock': 9,
            'low_stock_threshold': 3,
            'reorder_quantity': 10,
            'is_featured': False,
            'rating_average': Decimal('4.65'),
            'rating_count': 8
        },
        {
            'category': cats['Accessories & Gadgets'],
            'supplier': suppliers['Anker Innovations Official Partner'],
            'name': 'Anker 737 Power Bank 24000mAh 140W GaNPrime',
            'description': 'Ultra-powerful two-way charging with Power Delivery 3.1 and bi-directional technology to quickly recharge the portable charger or power high-drain laptops.',
            'price': Decimal('109.99'),
            'cost_price': Decimal('68.00'),
            'stock': 24,
            'low_stock_threshold': 6,
            'reorder_quantity': 25,
            'is_featured': False,
            'rating_average': Decimal('4.82'),
            'rating_count': 19
        },
        {
            'category': cats['Accessories & Gadgets'],
            'supplier': suppliers['Logitech & Keychron Regional Distribution'],
            'name': 'Logitech MX Master 3S Ergonomic Mouse',
            'description': 'Quiet clicks with 8000 DPI any-surface tracking including glass, MagSpeed electromagnetic scrolling, and customizable ergonomic thumb buttons.',
            'price': Decimal('99.99'),
            'cost_price': Decimal('65.00'),
            'stock': 18,
            'low_stock_threshold': 5,
            'reorder_quantity': 20,
            'is_featured': False,
            'rating_average': Decimal('4.91'),
            'rating_count': 30
        },
        {
            'category': cats['Accessories & Gadgets'],
            'supplier': suppliers['Logitech & Keychron Regional Distribution'],
            'name': 'Keychron K2 Pro QMK Wireless Mechanical Keyboard',
            'description': '75% compact wireless mechanical keyboard, hot-swappable Keychron K Pro switches, south-facing RGB backlighting, and programmable QMK/VIA firmware.',
            'price': Decimal('89.00'),
            'cost_price': Decimal('52.00'),
            'stock': 10,
            'low_stock_threshold': 4,
            'reorder_quantity': 15,
            'is_featured': False,
            'rating_average': Decimal('4.78'),
            'rating_count': 15
        }
    ]

    created_count = 0
    for p_info in products_info:
        prod, created = Product.objects.get_or_create(
            name=p_info['name'],
            defaults=p_info
        )
        if created:
            created_count += 1
            print(f"  + Created: {prod.name} (SKU: {prod.sku}, Price: ${prod.price})")
        else:
            print(f"  - Exists: {prod.name} (SKU: {prod.sku})")

    print(f"\nSuccessfully populated {created_count} products across {len(cats)} categories.")

if __name__ == '__main__':
    seed_catalog()
