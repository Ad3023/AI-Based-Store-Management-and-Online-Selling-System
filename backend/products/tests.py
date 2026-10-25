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

    def test_customer_cannot_create_promotions(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.post('/api/products/promotions/', {
            'title': 'Unauthorized Discount',
            'discount_type': 'PERCENTAGE',
            'discount_value': 50,
            'start_date': timezone.now().isoformat(),
            'end_date': (timezone.now() + timedelta(days=1)).isoformat(),
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_create_promotions(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post('/api/products/promotions/', {
            'title': 'Manager Promo',
            'discount_type': 'PERCENTAGE',
            'discount_value': 10,
            'start_date': timezone.now().isoformat(),
            'end_date': (timezone.now() + timedelta(days=5)).isoformat(),
            'is_active': True,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


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

