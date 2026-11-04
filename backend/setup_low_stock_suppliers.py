import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from products.models import Supplier, Product

def run():
    print("Setting up realistic Hardware Suppliers...")

    # 1. Dell Ethiopia Distributor Ltd
    dell_sup, _ = Supplier.objects.get_or_create(
        name="Dell Ethiopia Distributor Ltd",
        defaults={
            'contact_person': 'Ato Getachew Tadesse',
            'email': 'gucheaddisu5@gmail.com', # Use verified email for testing real delivery
            'phone': '+251 91 122 3344',
            'address': 'Bole Road, Mega Building 4th Floor, Addis Ababa',
            'notes': 'Official certified distributor for Dell laptops, workstations, and server hardware.',
            'is_active': True,
        }
    )
    # Ensure active and email set
    dell_sup.email = 'gucheaddisu5@gmail.com'
    dell_sup.save()

    # 2. HP East Africa Technology Supplies Ltd
    hp_sup, _ = Supplier.objects.get_or_create(
        name="HP East Africa Technology Supplies Ltd",
        defaults={
            'contact_person': 'W/ro Almaz Kassa',
            'email': 'procurement@hpeastafrica.com',
            'phone': '+251 92 233 4455',
            'address': 'Kazanchis Business Center 2nd Floor, Addis Ababa',
            'notes': 'Authorized provider for HP Spectre, Envy, and Pavilion hardware units.',
            'is_active': True,
        }
    )

    # 3. Apple Redington Regional Hub
    apple_sup, _ = Supplier.objects.get_or_create(
        name="Apple Redington Regional Hub",
        defaults={
            'contact_person': 'Binyam Girma',
            'email': 'supplies@redington-apple.et',
            'phone': '+251 93 344 5566',
            'address': 'Sarbet, International Commercial Center, Addis Ababa',
            'notes': 'Authorized regional hub for Apple MacBooks, iPads, and accessories.',
            'is_active': True,
        }
    )

    # 4. Supplier WITHOUT Email (to test validation requirement 2 & 9)
    no_email_sup, _ = Supplier.objects.get_or_create(
        name="Alpha Electronics Import (No Email Registered)",
        defaults={
            'contact_person': 'Solomon Desta',
            'email': '',  # Deliberately empty email
            'phone': '+251 91 199 8877',
            'address': 'Merkato Wholesale District, Addis Ababa',
            'notes': 'Wholesale supplier registered with phone only, missing email.',
            'is_active': True,
        }
    )

    print("Linking products to suppliers...")

    # Link Dell products
    Product.objects.filter(name__icontains='Dell').update(
        supplier=dell_sup,
        reorder_quantity=20,
        low_stock_threshold=5
    )

    # Link HP products
    Product.objects.filter(name__icontains='HP').update(
        supplier=hp_sup,
        reorder_quantity=15,
        low_stock_threshold=5
    )

    # Link Apple products (MacBook, iPad)
    Product.objects.filter(name__icontains='MacBook').update(
        supplier=apple_sup,
        reorder_quantity=10,
        low_stock_threshold=5
    )
    Product.objects.filter(name__icontains='iPad').update(
        supplier=apple_sup,
        reorder_quantity=12,
        low_stock_threshold=5
    )

    # Link one product to the supplier with NO email (for alert verification)
    Product.objects.filter(name__icontains='Keychron').update(
        supplier=no_email_sup,
        reorder_quantity=25,
        low_stock_threshold=5
    )

    # Leave Apple Watch Ultra 2 with NO supplier (supplier=None) to test unassigned supplier alert!
    Product.objects.filter(name__icontains='Apple Watch Ultra').update(
        supplier=None,
        reorder_quantity=8,
        low_stock_threshold=5
    )

    print("Suppliers and products linked successfully!")
    for p in Product.objects.select_related('supplier').all()[:8]:
        sup_str = f"{p.supplier.name} ({p.supplier.email or 'NO EMAIL'})" if p.supplier else "NO SUPPLIER"
        print(f" - [{p.id}] {p.name[:35]}: stock={p.stock}, min={p.low_stock_threshold}, reorder={p.reorder_quantity} -> {sup_str}")

if __name__ == '__main__':
    run()
