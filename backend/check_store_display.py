import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from products.models import Product, Category, Supplier

print("=== VERIFYING PRODUCTS READY FOR DISPLAY ===")
categories = Category.objects.filter(is_active=True)
print(f"\nActive Categories ({categories.count()}):")
for cat in categories:
    prods = cat.products.filter(is_active=True)
    print(f"  * {cat.name} ({prods.count()} items):")
    for p in prods:
        print(f"      - ID {p.id:2d}: {p.name:<55} | ETB {p.price:>10} | Stock: {p.stock:2d} | Rating: {p.rating_average}")

print(f"\nTotal Active Products in Database: {Product.objects.filter(is_active=True).count()}")
