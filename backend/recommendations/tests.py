from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from products.models import Category, Product
from orders.models import Order, OrderItem
from accounts.models import Role, Permission
from accounts.rbac import init_rbac

User = get_user_model()


class AIDemandForecastingTests(TestCase):
    def setUp(self):
        init_rbac()
        self.client = APIClient()

        # Users
        self.admin = User.objects.create_superuser(
            username='admin_user',
            email='admin@ethio.com',
            password='Password123!',
            role=User.RoleChoices.SUPER_ADMIN
        )

        self.manager = User.objects.create_user(
            username='manager_user',
            email='manager@ethio.com',
            password='Password123!',
            role=User.RoleChoices.STORE_MANAGER,
            is_staff=True
        )

        self.customer = User.objects.create_user(
            username='customer_user',
            email='customer@ethio.com',
            password='Password123!',
            role=User.RoleChoices.CUSTOMER
        )

        # Catalog setup
        self.category = Category.objects.create(name='Smartphones & Tablets', slug='smartphones', is_active=True)

        # Product 1: Out of stock (critical)
        self.prod_oos = Product.objects.create(
            name='Samsung Galaxy Ultra',
            slug='samsung-galaxy-ultra',
            category=self.category,
            price=Decimal('85000.00'),
            cost_price=Decimal('70000.00'),
            stock=0,
            low_stock_threshold=5,
            is_active=True
        )

        # Product 2: Low stock with high sales velocity
        self.prod_low = Product.objects.create(
            name='iPhone 15 Pro',
            slug='iphone-15-pro',
            category=self.category,
            price=Decimal('120000.00'),
            cost_price=Decimal('95000.00'),
            stock=4,
            low_stock_threshold=5,
            is_active=True
        )

        # Product 3: Healthy stock
        self.prod_healthy = Product.objects.create(
            name='USB-C Fast Charger',
            slug='usbc-fast-charger',
            category=self.category,
            price=Decimal('1500.00'),
            cost_price=Decimal('800.00'),
            stock=150,
            low_stock_threshold=10,
            is_active=True
        )

        # Create historical paid orders to simulate sales velocity
        now = timezone.now()
        for i in range(6):
            order = Order.objects.create(
                customer=self.customer,
                order_number=f'ORD-FC-{100 + i}',
                subtotal=Decimal('200000.00'),
                total_amount=Decimal('200000.00'),
                status=Order.Status.DELIVERED,
                payment_status=Order.PaymentStatus.PAID,
                payment_method='CHAPA'
            )
            # Create sales for iPhone 15 Pro (2 units per order = 12 units sold in 60 days)
            OrderItem.objects.create(
                order=order,
                product=self.prod_low,
                quantity=2,
                unit_price=Decimal('120000.00'),
                total_price=Decimal('240000.00')
            )
            # Create sales for Samsung Galaxy Ultra (1 unit per order = 6 units sold)
            OrderItem.objects.create(
                order=order,
                product=self.prod_oos,
                quantity=1,
                unit_price=Decimal('85000.00'),
                total_price=Decimal('85000.00')
            )

    def test_anonymous_user_cannot_access_forecasting(self):
        url = reverse('ai-demand-forecasting')
        resp = self.client.get(url)
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_customer_cannot_access_forecasting(self):
        self.client.force_authenticate(user=self.customer)
        url = reverse('ai-demand-forecasting')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_access_forecasting(self):
        self.client.force_authenticate(user=self.manager)
        url = reverse('ai-demand-forecasting')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('forecasts', resp.data)
        self.assertIn('stockout_warnings_count', resp.data)
        self.assertIn('total_products_monitored', resp.data)

    def test_admin_can_access_forecasting(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('ai-demand-forecasting')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_forecasting_calculations_and_risk_levels(self):
        self.client.force_authenticate(user=self.manager)
        url = f"{reverse('ai-demand-forecasting')}?days=60"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        forecasts = {f['product_id']: f for f in resp.data['forecasts']}

        # 1. Product with 0 stock must be CRITICAL_OUT_OF_STOCK
        oos_fc = forecasts[self.prod_oos.id]
        self.assertEqual(oos_fc['risk_level'], 'CRITICAL_OUT_OF_STOCK')
        self.assertEqual(oos_fc['current_stock'], 0)
        self.assertGreater(oos_fc['suggested_reorder_qty'], 0)

        # 2. Product with stock <= threshold or low days of stock must be HIGH_STOCKOUT_RISK
        low_fc = forecasts[self.prod_low.id]
        self.assertEqual(low_fc['risk_level'], 'HIGH_STOCKOUT_RISK')
        self.assertEqual(low_fc['current_stock'], 4)
        self.assertGreater(low_fc['suggested_reorder_qty'], 0)

        # 3. Product with large stock and 0 velocity must be ADEQUATE_STOCK
        healthy_fc = forecasts[self.prod_healthy.id]
        self.assertEqual(healthy_fc['risk_level'], 'ADEQUATE_STOCK')
        self.assertEqual(healthy_fc['suggested_reorder_qty'], 0)

        # Total warnings must match the 2 high/critical items
        self.assertEqual(resp.data['stockout_warnings_count'], 2)
