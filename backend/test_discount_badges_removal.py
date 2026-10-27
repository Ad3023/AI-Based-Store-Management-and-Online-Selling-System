import os
import django
from decimal import Decimal
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from products.models import Product, Category, Promotion
from products.serializers import ProductSerializer
from accounts.models import User
from orders.models import Cart, CartItem, Order, OrderItem
from rest_framework.test import APIClient


def run_discount_badge_tests():
    print("==================================================================")
    print(" ETHIOTECH MARKET: VERIFYING DISCOUNT BADGES & PROMOTIONS")
    print("==================================================================")

    # Clean existing promotions for a pristine test state
    Promotion.objects.all().delete()
    # Ensure compare_at_price is None on all products
    Product.objects.update(compare_at_price=None)

    keyboard = Product.objects.filter(name__icontains='Keychron').first()
    if not keyboard:
        cat = Category.objects.first()
        keyboard = Product.objects.create(
            name='Keychron K2 Pro Keyboard',
            category=cat,
            price=Decimal('89.00'),
            stock=10
        )
    mouse = Product.objects.filter(name__icontains='Logitech').first()
    if not mouse:
        mouse = Product.objects.exclude(id=keyboard.id).first()

    admin_user = User.objects.filter(role=User.Role.ADMIN).first()
    if not admin_user:
        admin_user = User.objects.create_superuser('testadmin', 'admin@ethiotech.et', 'AdminPass123!')

    customer_user = User.objects.filter(role=User.Role.CUSTOMER).first()
    if not customer_user:
        customer_user = User.objects.create_user('testcust', 'cust@ethiotech.et', 'CustPass123!', role=User.Role.CUSTOMER)

    # -------------------------------------------------------------
    # Scenario 1: A product with no promotion displays no discount badge
    # -------------------------------------------------------------
    data = ProductSerializer(keyboard).data
    assert data['has_promotion'] is False, f"Expected has_promotion=False, got {data['has_promotion']}"
    assert data['discount_label'] is None, f"Expected discount_label=None, got {data['discount_label']}"
    assert data['compare_at_price'] is None, f"Expected compare_at_price=None, got {data['compare_at_price']}"
    assert Decimal(str(data['current_price'])) == keyboard.price, f"Expected current_price == price"
    print("[PASS] Scenario 1: Product with no promotion displays no red discount badge or strikethrough price")

    # -------------------------------------------------------------
    # Scenario 2: An inactive promotion displays no discount badge
    # -------------------------------------------------------------
    now = timezone.now()
    inactive_promo = Promotion.objects.create(
        title="Inactive Flash Sale",
        discount_type=Promotion.DiscountType.PERCENTAGE,
        discount_value=Decimal('25.00'),
        start_date=now - timedelta(days=1),
        end_date=now + timedelta(days=5),
        is_active=False,
        created_by=admin_user
    )
    inactive_promo.products.add(keyboard)

    data = ProductSerializer(keyboard).data
    assert data['has_promotion'] is False, "Inactive promo should not activate promotion"
    assert data['discount_label'] is None, "Inactive promo should have no discount label"
    assert data['compare_at_price'] is None, "Inactive promo should have no compare_at_price"
    assert Decimal(str(data['current_price'])) == keyboard.price
    print("[PASS] Scenario 2: Inactive promotion (is_active=False) displays no discount badge")
    inactive_promo.delete()

    # -------------------------------------------------------------
    # Scenario 3: An expired promotion displays no discount badge
    # -------------------------------------------------------------
    expired_promo = Promotion.objects.create(
        title="Expired Yesterday Promo",
        discount_type=Promotion.DiscountType.PERCENTAGE,
        discount_value=Decimal('20.00'),
        start_date=now - timedelta(days=10),
        end_date=now - timedelta(days=1),
        is_active=True,
        created_by=admin_user
    )
    expired_promo.products.add(keyboard)

    data = ProductSerializer(keyboard).data
    assert data['has_promotion'] is False, "Expired promo should not activate promotion"
    assert data['discount_label'] is None
    assert data['compare_at_price'] is None
    print("[PASS] Scenario 3: Expired promotion (end_date in past) displays no discount badge")
    expired_promo.delete()

    # -------------------------------------------------------------
    # Scenario 4: A product excluded from promotion displays no discount badge
    # -------------------------------------------------------------
    targeted_promo = Promotion.objects.create(
        title="Exclusive Keyboard Promo",
        discount_type=Promotion.DiscountType.PERCENTAGE,
        discount_value=Decimal('15.00'),
        start_date=now - timedelta(days=1),
        end_date=now + timedelta(days=5),
        is_active=True,
        created_by=admin_user
    )
    targeted_promo.products.add(keyboard)

    # Check keyboard: has promotion
    kb_data = ProductSerializer(keyboard).data
    assert kb_data['has_promotion'] is True
    assert kb_data['discount_label'] == "15% OFF"
    assert kb_data['compare_at_price'] == str(keyboard.price)
    expected_kb_price = (keyboard.price * Decimal('0.85')).quantize(Decimal('0.01'))
    assert Decimal(str(kb_data['current_price'])) == expected_kb_price

    # Check mouse: excluded from promo
    mouse_data = ProductSerializer(mouse).data
    assert mouse_data['has_promotion'] is False, "Excluded product must have has_promotion=False"
    assert mouse_data['discount_label'] is None, "Excluded product must have discount_label=None"
    assert mouse_data['compare_at_price'] is None, "Excluded product must have compare_at_price=None"
    assert Decimal(str(mouse_data['current_price'])) == mouse.price
    print("[PASS] Scenario 4: Product excluded from promotion displays no discount badge")

    # -------------------------------------------------------------
    # Scenario 5: Product with valid active promotion displays correct badge
    # -------------------------------------------------------------
    print(f"[PASS] Scenario 5: Active promo displays badge '{kb_data['discount_label']}', strikethrough ETB {kb_data['compare_at_price']} and selling price ETB {kb_data['current_price']}")

    # -------------------------------------------------------------
    # Scenario 6: Deactivating a promotion removes its badge immediately
    # -------------------------------------------------------------
    targeted_promo.is_active = False
    targeted_promo.save()

    kb_data_deactivated = ProductSerializer(keyboard).data
    assert kb_data_deactivated['has_promotion'] is False, "Deactivated promo must remove promotion"
    assert kb_data_deactivated['discount_label'] is None, "Deactivated promo must remove discount label"
    assert kb_data_deactivated['compare_at_price'] is None, "Deactivated promo must remove compare_at_price"
    assert Decimal(str(kb_data_deactivated['current_price'])) == keyboard.price
    print("[PASS] Scenario 6: Deactivating promotion immediately removes badge and restores normal price")
    targeted_promo.delete()

    # -------------------------------------------------------------
    # Scenario 7: All Products page API returns clean regular prices
    # -------------------------------------------------------------
    client = APIClient()
    res = client.get('/api/products/items/')
    assert res.status_code == 200
    catalog = res.data.get('results', res.data)
    for prod in catalog:
        assert prod['has_promotion'] is False, f"Product {prod['name']} unexpectedly has promotion"
        assert prod['discount_label'] is None, f"Product {prod['name']} unexpectedly has discount label"
        assert prod['compare_at_price'] is None, f"Product {prod['name']} unexpectedly has compare_at_price"
        assert prod['price'] == prod['current_price'], f"Product {prod['name']} price mismatch"
    print(f"[PASS] Scenario 7: All {len(catalog)} catalog products return clean regular prices with zero fake badges")

    # -------------------------------------------------------------
    # Scenario 8: Displayed price matches checkout price exactly
    # -------------------------------------------------------------
    # Create active store-wide promo (10% off)
    store_promo = Promotion.objects.create(
        title="Storewide 10% Off",
        discount_type=Promotion.DiscountType.PERCENTAGE,
        discount_value=Decimal('10.00'),
        apply_to_all=True,
        start_date=now - timedelta(days=1),
        end_date=now + timedelta(days=7),
        is_active=True,
        created_by=admin_user
    )

    kb_promo_data = ProductSerializer(keyboard).data
    displayed_price = Decimal(str(kb_promo_data['current_price']))
    assert displayed_price == (keyboard.price * Decimal('0.90')).quantize(Decimal('0.01'))

    # Add to cart and check CartItem subtotal
    cart, _ = Cart.objects.get_or_create(user=customer_user)
    cart.items.all().delete()
    cart_item = CartItem.objects.create(cart=cart, product=keyboard, quantity=2)
    expected_subtotal = displayed_price * 2
    assert cart_item.subtotal == expected_subtotal, f"Expected {expected_subtotal}, got {cart_item.subtotal}"

    # Perform Checkout
    client.force_authenticate(user=customer_user)
    checkout_payload = {
        'first_name': 'Abebe',
        'last_name': 'Kebede',
        'shipping_address': 'Bole Atlas',
        'shipping_city': 'Addis Ababa',
        'shipping_phone': '+251911223344',
        'delivery_method': 'STANDARD'
    }
    checkout_res = client.post('/api/orders/checkout/', checkout_payload, format='json')
    assert checkout_res.status_code == 201, f"Checkout failed: {checkout_res.data}"
    order_data = checkout_res.data
    order_subtotal = Decimal(str(order_data['subtotal']))
    assert order_subtotal == expected_subtotal, f"Checkout subtotal {order_subtotal} must match {expected_subtotal}"
    print(f"[PASS] Scenario 8: Displayed discounted price (ETB {displayed_price}) matches checkout item subtotal (ETB {order_subtotal})")

    # Cleanup test promotion
    store_promo.delete()
    print("==================================================================")
    print(" ALL 8 DISCOUNT BADGE VERIFICATION SCENARIOS PASSED 100%!")
    print("==================================================================")

if __name__ == '__main__':
    run_discount_badge_tests()
