from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from products.models import Category, Product, WarrantyPolicy, Promotion, CustomerFeedback, ProductReview
from orders.models import Order, OrderItem, WarrantyClaim

User = get_user_model()


class PromotionAndPricingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='cust_user',
            email='cust@example.com',
            password='Password123!',
            role='customer'
        )
        self.manager = User.objects.create_user(
            username='mgr_user',
            email='mgr@example.com',
            password='Password123!',
            role='store_manager'
        )
        self.admin = User.objects.create_user(
            username='admin_user',
            email='admin@example.com',
            password='Password123!',
            role='admin'
        )
        self.category = Category.objects.create(name='Laptops', slug='laptops')
        self.product = Product.objects.create(
            name='MacBook Pro M3',
            slug='macbook-pro-m3',
            category=self.category,
            price=Decimal('100000.00'),
            stock=10,
            is_active=True
        )

    def test_percentage_discount_calculation(self):
        now = timezone.now()
        promo = Promotion.objects.create(
            title='10% Tech Sale',
            discount_type=Promotion.DiscountType.PERCENTAGE,
            discount_value=Decimal('10.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=True
        )
        promo.products.add(self.product)

        self.assertTrue(self.product.has_active_promotion)
        self.assertEqual(self.product.current_price, Decimal('90000.00'))

    def test_fixed_discount_calculation(self):
        now = timezone.now()
        promo = Promotion.objects.create(
            title='5000 ETB Off',
            discount_type=Promotion.DiscountType.FIXED,
            discount_value=Decimal('5000.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=True
        )
        promo.products.add(self.product)

        self.assertEqual(self.product.current_price, Decimal('95000.00'))

    def test_category_level_promotion(self):
        now = timezone.now()
        promo = Promotion.objects.create(
            title='Category 15% Off',
            discount_type=Promotion.DiscountType.PERCENTAGE,
            discount_value=Decimal('15.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=True
        )
        promo.categories.add(self.category)

        self.assertEqual(self.product.current_price, Decimal('85000.00'))

    def test_storewide_promotion_calculation(self):
        now = timezone.now()
        promo = Promotion.objects.create(
            title='Store-Wide 5% Off',
            discount_type=Promotion.DiscountType.PERCENTAGE,
            discount_value=Decimal('5.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            apply_to_all=True,
            is_active=True
        )
        self.assertEqual(self.product.current_price, Decimal('95000.00'))

    def test_future_scheduled_promotion_does_not_apply_yet(self):
        now = timezone.now()
        promo = Promotion.objects.create(
            title='Upcoming Black Friday',
            discount_type=Promotion.DiscountType.PERCENTAGE,
            discount_value=Decimal('30.00'),
            start_date=now + timedelta(days=3),
            end_date=now + timedelta(days=7),
            is_active=True
        )
        promo.products.add(self.product)

        self.assertFalse(self.product.has_active_promotion)
        self.assertEqual(self.product.current_price, Decimal('100000.00'))

    def test_expired_promotion_does_not_apply(self):
        now = timezone.now()
        promo = Promotion.objects.create(
            title='Expired Sale',
            discount_type=Promotion.DiscountType.PERCENTAGE,
            discount_value=Decimal('20.00'),
            start_date=now - timedelta(days=10),
            end_date=now - timedelta(days=2),
            is_active=True
        )
        promo.products.add(self.product)

        self.assertFalse(self.product.has_active_promotion)
        self.assertEqual(self.product.current_price, Decimal('100000.00'))

    def test_invalid_discount_value_negative_or_zero(self):
        self.client.force_authenticate(user=self.admin)
        now = timezone.now()

        # Zero discount value
        resp1 = self.client.post('/api/products/promotions/', {
            'title': 'Zero Discount',
            'discount_type': 'PERCENTAGE',
            'discount_value': 0,
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=5)).isoformat(),
            'apply_to_all': True
        })
        self.assertEqual(resp1.status_code, status.HTTP_400_BAD_REQUEST)

        # Negative discount value
        resp2 = self.client.post('/api/products/promotions/', {
            'title': 'Negative Discount',
            'discount_type': 'FIXED',
            'discount_value': -100,
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=5)).isoformat(),
            'apply_to_all': True
        })
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_percentage_exceeding_100(self):
        self.client.force_authenticate(user=self.admin)
        now = timezone.now()
        resp = self.client.post('/api/products/promotions/', {
            'title': '120% Discount',
            'discount_type': 'PERCENTAGE',
            'discount_value': 120,
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=5)).isoformat(),
            'apply_to_all': True
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_dates_end_before_start(self):
        self.client.force_authenticate(user=self.admin)
        now = timezone.now()
        resp = self.client.post('/api/products/promotions/', {
            'title': 'Bad Dates',
            'discount_type': 'PERCENTAGE',
            'discount_value': 10,
            'start_date': (now + timedelta(days=5)).isoformat(),
            'end_date': now.isoformat(),
            'apply_to_all': True
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_targeting_scope_rejected(self):
        self.client.force_authenticate(user=self.admin)
        now = timezone.now()
        resp = self.client.post('/api/products/promotions/', {
            'title': 'No Scope',
            'discount_type': 'PERCENTAGE',
            'discount_value': 10,
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=5)).isoformat(),
            'apply_to_all': False,
            'products': [],
            'categories': []
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_promotion_conflict_highest_discount_wins(self):
        """
        Verify consistent conflict rule:
        Highest eligible monetary discount wins without stacking.
        """
        now = timezone.now()

        # Category promo: 10% off (10,000 ETB off 100,000 ETB)
        cat_promo = Promotion.objects.create(
            title='Laptops 10% Off',
            discount_type=Promotion.DiscountType.PERCENTAGE,
            discount_value=Decimal('10.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=True
        )
        cat_promo.categories.add(self.category)

        # Product promo: 25% off (25,000 ETB off 100,000 ETB)
        prod_promo = Promotion.objects.create(
            title='MacBook 25% Off',
            discount_type=Promotion.DiscountType.PERCENTAGE,
            discount_value=Decimal('25.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=True
        )
        prod_promo.products.add(self.product)

        # Store-wide promo: 5,000 ETB fixed off
        store_promo = Promotion.objects.create(
            title='Storewide 5000 Off',
            discount_type=Promotion.DiscountType.FIXED,
            discount_value=Decimal('5000.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            apply_to_all=True,
            is_active=True
        )

        # The product should pick the 25% promo (25,000 discount) instead of stacking or picking a lower discount
        self.assertEqual(self.product.get_current_promotion(), prod_promo)
        self.assertEqual(self.product.current_price, Decimal('75000.00'))

    def test_promotions_do_not_stack(self):
        """
        Ensure multiple active promotions do not compound or stack discounts.
        """
        now = timezone.now()
        # Promo 1: 5,000 ETB fixed off
        p1 = Promotion.objects.create(
            title='Promo 1',
            discount_type=Promotion.DiscountType.FIXED,
            discount_value=Decimal('5000.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=True
        )
        p1.products.add(self.product)

        # Promo 2: 10,000 ETB fixed off
        p2 = Promotion.objects.create(
            title='Promo 2',
            discount_type=Promotion.DiscountType.FIXED,
            discount_value=Decimal('10000.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=True
        )
        p2.products.add(self.product)

        # Current price must be 100000 - 10000 = 90000, NOT 100000 - 15000 = 85000
        self.assertEqual(self.product.current_price, Decimal('90000.00'))

    def test_negative_price_prevention(self):
        """
        Ensure fixed discount larger than product price floors at 0.00 ETB.
        """
        now = timezone.now()
        promo = Promotion.objects.create(
            title='Mega Off',
            discount_type=Promotion.DiscountType.FIXED,
            discount_value=Decimal('150000.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=True
        )
        promo.products.add(self.product)

        self.assertEqual(self.product.current_price, Decimal('0.00'))

    def test_admin_can_create_promotions(self):
        self.client.force_authenticate(user=self.admin)
        now = timezone.now()
        response = self.client.post('/api/products/promotions/', {
            'title': 'Admin Special Promo',
            'discount_type': 'PERCENTAGE',
            'discount_value': 15,
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=5)).isoformat(),
            'apply_to_all': True,
            'is_active': True,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_store_manager_without_permission_cannot_create_promotions(self):
        self.client.force_authenticate(user=self.manager)
        now = timezone.now()
        response = self.client.post('/api/products/promotions/', {
            'title': 'Manager Attempt',
            'discount_type': 'PERCENTAGE',
            'discount_value': 10,
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=5)).isoformat(),
            'apply_to_all': True,
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_store_manager_with_explicit_permission_can_create_promotions(self):
        from accounts.models import Permission
        perm, _ = Permission.objects.get_or_create(code='promotions.manage', defaults={'name': 'Manage Promotions'})
        self.manager.direct_permissions.add(perm)

        self.client.force_authenticate(user=self.manager)
        now = timezone.now()
        response = self.client.post('/api/products/promotions/', {
            'title': 'Authorized Manager Promo',
            'discount_type': 'PERCENTAGE',
            'discount_value': 10,
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=5)).isoformat(),
            'apply_to_all': True,
            'is_active': True,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_customer_cannot_create_promotions(self):
        self.client.force_authenticate(user=self.customer)
        now = timezone.now()
        response = self.client.post('/api/products/promotions/', {
            'title': 'Customer Attempt',
            'discount_type': 'PERCENTAGE',
            'discount_value': 50,
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=1)).isoformat(),
            'apply_to_all': True,
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cart_and_checkout_use_server_calculated_discounted_totals(self):
        from orders.models import Cart, CartItem
        now = timezone.now()
        promo = Promotion.objects.create(
            title='10% Tech Sale',
            discount_type=Promotion.DiscountType.PERCENTAGE,
            discount_value=Decimal('10.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=True
        )
        promo.products.add(self.product)

        # Base price 100,000 ETB, 10% discount = 90,000 ETB each * 2 units = 180,000 ETB subtotal
        cart = Cart.objects.create(user=self.customer)
        item = CartItem.objects.create(cart=cart, product=self.product, quantity=2)

        self.assertEqual(item.subtotal, Decimal('180000.00'))
        self.assertEqual(cart.total_price, Decimal('180000.00'))


class WarrantyAndClaimTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer1 = User.objects.create_user(
            username='buyer1',
            email='buyer1@example.com',
            password='Password123!',
            role='customer'
        )
        self.customer2 = User.objects.create_user(
            username='buyer2',
            email='buyer2@example.com',
            password='Password123!',
            role='customer'
        )
        self.manager = User.objects.create_user(
            username='mgr',
            email='mgr@example.com',
            password='Password123!',
            role='store_manager'
        )
        self.category = Category.objects.create(name='Smartphones', slug='smartphones')
        self.policy = WarrantyPolicy.objects.create(
            name='30-Day Hardware Guarantee',
            duration_days=30,
            coverage_summary='Covers all screen and motherboard hardware defects.',
            is_default=True
        )
        self.product = Product.objects.create(
            name='Galaxy S24 Ultra',
            slug='galaxy-s24-ultra',
            category=self.category,
            warranty_policy=self.policy,
            price=Decimal('120000.00'),
            stock=5,
            is_active=True
        )

        # Create confirmed order for customer1
        self.order1 = Order.objects.create(
            customer=self.customer1,
            subtotal=Decimal('120000.00'),
            tax=Decimal('18000.00'),
            shipping_fee=Decimal('100.00'),
            total_amount=Decimal('138100.00'),
            status=Order.Status.PROCESSING,
            payment_method='CHAPA'
        )
        self.order_item1 = OrderItem.objects.create(
            order=self.order1,
            product=self.product,
            unit_price=Decimal('120000.00'),
            quantity=1,
            warranty_duration_days=30,
            warranty_coverage=self.policy.coverage_summary,
            warranty_start_date=timezone.now(),
            warranty_end_date=timezone.now() + timedelta(days=30)
        )

    def test_customer_can_submit_warranty_claim(self):
        self.client.force_authenticate(user=self.customer1)
        response = self.client.post('/api/orders/warranty-claims/', {
            'order_item': self.order_item1.id,
            'issue_description': 'Screen does not turn on after power button press.'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['claim_number'].startswith('CLM-'))
        self.assertEqual(response.data['status'], 'SUBMITTED')

    def test_customer_cannot_claim_another_users_order_item(self):
        self.client.force_authenticate(user=self.customer2)
        response = self.client.post('/api/orders/warranty-claims/', {
            'order_item': self.order_item1.id,
            'issue_description': 'Attempting unauthorized claim'
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('not found or does not belong to your account', response.data['error'])

    def test_manager_can_review_and_approve_claim(self):
        # Create claim first
        self.client.force_authenticate(user=self.customer1)
        claim_res = self.client.post('/api/orders/warranty-claims/', {
            'order_item': self.order_item1.id,
            'issue_description': 'Hardware glitch'
        })
        claim_id = claim_res.data['id']

        # Manager reviews claim
        self.client.force_authenticate(user=self.manager)
        patch_res = self.client.patch(f'/api/orders/warranty-claims/{claim_id}/', {
            'status': 'APPROVED',
            'admin_notes': 'Defect confirmed by Addis Ababa service center.',
            'resolution_details': 'Replacement unit dispatched.'
        })
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['status'], 'APPROVED')


class VerifiedReviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='reviewer',
            email='reviewer@example.com',
            password='Password123!',
            role='customer'
        )
        self.category = Category.objects.create(name='Audio', slug='audio')
        self.product = Product.objects.create(
            name='Sony Headphones',
            slug='sony-headphones',
            category=self.category,
            price=Decimal('5000.00'),
            stock=10,
            is_active=True
        )

    def test_unverified_purchaser_cannot_review_product(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.post(f'/api/products/items/{self.product.id}/reviews/', {
            'rating': 5,
            'comment': 'I never bought this item but I want to leave a rating.'
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('verified customer purchase required', response.data['error'].lower())

    def test_verified_purchaser_can_review_product(self):
        # Create completed order with this product
        order = Order.objects.create(
            customer=self.customer,
            subtotal=Decimal('5000.00'),
            total_amount=Decimal('5750.00'),
            status=Order.Status.DELIVERED,
            payment_method='CHAPA'
        )
        OrderItem.objects.create(order=order, product=self.product, unit_price=Decimal('5000.00'), quantity=1)

        self.client.force_authenticate(user=self.customer)
        response = self.client.post(f'/api/products/items/{self.product.id}/reviews/', {
            'rating': 5,
            'comment': 'Outstanding noise cancellation and sound quality!'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ProductReview.objects.filter(product=self.product).count(), 1)


class ProductCategoryFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.cat_laptops = Category.objects.create(name='Laptops & Computers', slug='laptops-computers')
        self.cat_wearables = Category.objects.create(name='Smart Wearables', slug='smart-wearables')

        self.p_laptop = Product.objects.create(
            name='Dell XPS 15',
            slug='dell-xps-15',
            category=self.cat_laptops,
            price=Decimal('85000.00'),
            stock=5,
            is_active=True
        )
        self.p_watch = Product.objects.create(
            name='Galaxy Watch 6',
            slug='galaxy-watch-6',
            category=self.cat_wearables,
            price=Decimal('22000.00'),
            stock=8,
            is_active=True
        )

    def test_filter_by_partial_name(self):
        response = self.client.get('/api/products/items/?category=Wearables')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Galaxy Watch 6')

    def test_filter_by_slug(self):
        response = self.client.get('/api/products/items/?category=smart-wearables')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Galaxy Watch 6')

    def test_filter_by_id(self):
        response = self.client.get(f'/api/products/items/?category={self.cat_wearables.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Galaxy Watch 6')

    def test_filter_by_category_and_search_query(self):
        response = self.client.get('/api/products/items/?category=Wearables&search=Galaxy')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Galaxy Watch 6')

        # When search does not match within category
        response_mismatch = self.client.get('/api/products/items/?category=Wearables&search=Dell')
        self.assertEqual(response_mismatch.status_code, status.HTTP_200_OK)
        results_mismatch = response_mismatch.data.get('results', response_mismatch.data)
        self.assertEqual(len(results_mismatch), 0)

