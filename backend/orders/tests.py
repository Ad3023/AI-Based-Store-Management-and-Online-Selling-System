from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from products.models import Category, Product
from orders.models import Cart, CartItem, Order, OrderItem, PaymentEvidence, Receipt

User = get_user_model()


class ChapaPaymentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testcustomer',
            email='customer@example.com',
            password='password123',
            phone_number='0911223344',
            first_name='Abebe',
            last_name='Bikila'
        )
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(name='Audio', slug='audio')
        self.product = Product.objects.create(
            name='Sony WH-1000XM5',
            slug='sony-wh-1000xm5',
            category=self.category,
            price=Decimal('1000.00'),
            stock=10,
            is_active=True
        )

    @patch('orders.chapa.requests.post')
    def test_checkout_initializes_chapa_and_calculates_server_amount(self, mock_post):
        # Mock Chapa initialize API response
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            'status': 'success',
            'message': 'Hosted Link',
            'data': {
                'checkout_url': 'https://checkout.chapa.co/checkout/payment/mock-checkout-key'
            }
        }

        # Add item to cart
        cart, _ = Cart.objects.get_or_create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=1)

        payload = {
            'shipping_name': 'Abebe Bikila',
            'shipping_phone': '0911223344',
            'shipping_address': 'Bole, House 102',
            'shipping_city': 'Addis Ababa',
            'delivery_method': 'express',  # 100 ETB
            'payment_method': 'CHAPA'
        }

        response = self.client.post('/api/orders/checkout/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Expected calculations: subtotal=1000, shipping=100, tax=150 (15%), total=1250
        order = Order.objects.get(id=response.data['id'])
        self.assertEqual(order.subtotal, Decimal('1000.00'))
        self.assertEqual(order.shipping_fee, Decimal('100.00'))
        self.assertEqual(order.tax, Decimal('150.00'))
        self.assertEqual(order.total_amount, Decimal('1250.00'))
        self.assertEqual(order.status, Order.Status.PENDING_PAYMENT)
        self.assertEqual(order.payment_method, 'CHAPA')
        self.assertTrue(order.chapa_tx_ref.startswith('NEXUS-'))
        self.assertEqual(response.data['checkout_url'], 'https://checkout.chapa.co/checkout/payment/mock-checkout-key')

    @patch('orders.chapa.requests.get')
    def test_chapa_verify_success(self, mock_get):
        # Create an order
        order = Order.objects.create(
            customer=self.user,
            subtotal=Decimal('1000.00'),
            tax=Decimal('150.00'),
            shipping_fee=Decimal('50.00'),
            total_amount=Decimal('1200.00'),
            shipping_name='Abebe Bikila',
            shipping_phone='0911223344',
            shipping_address='Bole, Addis Ababa',
            shipping_city='Addis Ababa',
            payment_method='CHAPA',
            chapa_tx_ref='NEXUS-999-TXREF12345',
            status=Order.Status.PENDING_PAYMENT
        )

        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            'status': 'success',
            'message': 'Payment details',
            'data': {
                'status': 'success',
                'currency': 'ETB',
                'amount': 1200.00,
                'method': 'telebirr',
                'reference': 'CHAPA-REF-1001',
                'tx_ref': 'NEXUS-999-TXREF12345'
            }
        }

        response = self.client.post(f'/api/orders/{order.id}/chapa/verify/', {
            'tx_ref': 'NEXUS-999-TXREF12345'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PROCESSING)

        # Check PaymentEvidence created
        evidence = PaymentEvidence.objects.get(order=order)
        self.assertEqual(evidence.verification_status, PaymentEvidence.VerificationStatus.APPROVED)
        self.assertIn('Chapa', evidence.payment_method)

        # Check Receipt created
        receipt = Receipt.objects.get(order=order)
        self.assertTrue(receipt.receipt_number.startswith('RCP-'))

    @patch('orders.chapa.requests.get')
    def test_chapa_verify_rejects_amount_mismatch(self, mock_get):
        order = Order.objects.create(
            customer=self.user,
            subtotal=Decimal('1000.00'),
            tax=Decimal('150.00'),
            shipping_fee=Decimal('50.00'),
            total_amount=Decimal('1200.00'),
            shipping_name='Abebe Bikila',
            shipping_phone='0911223344',
            shipping_address='Bole, Addis Ababa',
            shipping_city='Addis Ababa',
            payment_method='CHAPA',
            chapa_tx_ref='NEXUS-999-TXREF-UNDERPAID',
            status=Order.Status.PENDING_PAYMENT
        )

        # Mock underpaid amount (e.g. 10.00 instead of 1200.00)
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            'status': 'success',
            'data': {
                'status': 'success',
                'currency': 'ETB',
                'amount': 10.00,
                'method': 'cbe',
                'tx_ref': 'NEXUS-999-TXREF-UNDERPAID'
            }
        }

        response = self.client.post(f'/api/orders/{order.id}/chapa/verify/', {
            'tx_ref': 'NEXUS-999-TXREF-UNDERPAID'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Payment amount mismatch', response.data['message'])

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING_PAYMENT)
        self.assertFalse(hasattr(order, 'receipt'))

    @patch('orders.chapa.requests.get')
    def test_chapa_verify_rejects_currency_mismatch(self, mock_get):
        order = Order.objects.create(
            customer=self.user,
            subtotal=Decimal('1000.00'),
            tax=Decimal('150.00'),
            shipping_fee=Decimal('50.00'),
            total_amount=Decimal('1200.00'),
            shipping_name='Abebe Bikila',
            shipping_phone='0911223344',
            shipping_address='Bole, Addis Ababa',
            shipping_city='Addis Ababa',
            payment_method='CHAPA',
            chapa_tx_ref='NEXUS-999-TXREF-USD',
            status=Order.Status.PENDING_PAYMENT
        )

        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            'status': 'success',
            'data': {
                'status': 'success',
                'currency': 'USD',
                'amount': 1200.00,
                'tx_ref': 'NEXUS-999-TXREF-USD'
            }
        }

        response = self.client.post(f'/api/orders/{order.id}/chapa/verify/', {
            'tx_ref': 'NEXUS-999-TXREF-USD'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('currency mismatch', response.data['message'].lower())

    @patch('orders.chapa.requests.get')
    def test_chapa_verify_idempotency(self, mock_get):
        order = Order.objects.create(
            customer=self.user,
            subtotal=Decimal('1000.00'),
            tax=Decimal('150.00'),
            shipping_fee=Decimal('50.00'),
            total_amount=Decimal('1200.00'),
            shipping_name='Abebe Bikila',
            shipping_phone='0911223344',
            shipping_address='Bole, Addis Ababa',
            shipping_city='Addis Ababa',
            payment_method='CHAPA',
            chapa_tx_ref='NEXUS-999-IDEMPOTENT',
            status=Order.Status.PROCESSING
        )
        Receipt.objects.create(order=order)

        # Calling verify on an already processed order should return success without calling external API
        response = self.client.post(f'/api/orders/{order.id}/chapa/verify/', {
            'tx_ref': 'NEXUS-999-IDEMPOTENT'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Payment already verified.')
        mock_get.assert_not_called()


class AdminCartRestrictionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='system_admin',
            email='admin@example.com',
            password='adminpassword123',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True
        )
        self.customer = User.objects.create_user(
            username='regular_customer',
            email='customer2@example.com',
            password='custpassword123',
            role=User.Role.CUSTOMER
        )
        self.category = Category.objects.create(name='Computers', slug='computers')
        self.product = Product.objects.create(
            name='Dell XPS 15',
            slug='dell-xps-15',
            category=self.category,
            price=Decimal('25000.00'),
            stock=5,
            is_active=True
        )

    def test_admin_cannot_access_cart(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/orders/cart/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue('error' in response.data or 'detail' in response.data)

    def test_admin_cannot_add_product_to_cart(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/orders/cart/', {
            'product_id': self.product.id,
            'quantity': 1
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue('error' in response.data or 'detail' in response.data)

    def test_admin_cannot_update_cart(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.put('/api/orders/cart/', {
            'item_id': 1,
            'quantity': 2
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_cannot_delete_from_cart(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete('/api/orders/cart/', format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_cannot_checkout(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            'shipping_name': 'Admin User',
            'shipping_phone': '0911000000',
            'shipping_address': 'Headquarters, Addis Ababa',
            'shipping_city': 'Addis Ababa',
            'payment_method': 'CHAPA'
        }
        response = self.client.post('/api/orders/checkout/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue('error' in response.data or 'detail' in response.data)

    def test_admin_cannot_initialize_chapa_payment(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/orders/chapa/initialize/', {
            'order_id': 999
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_can_use_cart_normally(self):
        self.client.force_authenticate(user=self.customer)
        # GET empty cart
        get_res = self.client.get('/api/orders/cart/')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)

        # POST add item
        post_res = self.client.post('/api/orders/cart/', {
            'product_id': self.product.id,
            'quantity': 2
        }, format='json')
        self.assertEqual(post_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(post_res.data['items']), 1)
        self.assertEqual(post_res.data['items'][0]['quantity'], 2)

        # PUT update quantity
        item_id = post_res.data['items'][0]['id']
        put_res = self.client.put('/api/orders/cart/', {
            'item_id': item_id,
            'quantity': 3
        }, format='json')
        self.assertEqual(put_res.status_code, status.HTTP_200_OK)
        self.assertEqual(put_res.data['items'][0]['quantity'], 3)

        # DELETE remove item
        del_res = self.client.delete('/api/orders/cart/', {
            'item_id': item_id
        }, format='json')
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(del_res.data['items']), 0)

    def test_admin_retains_access_to_orders_oversight(self):
        # Admin should still have access to OrderListView to oversee customer orders
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/orders/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_customer_order_creates_notifications_for_admin_and_manager(self):
        from notifications.models import Notification
        manager = User.objects.create_user(
            username='mgr_notif',
            email='mgr_notif@example.com',
            password='password123',
            role='store_manager'
        )
        self.client.force_authenticate(user=self.customer)
        # Add item to cart
        self.client.post('/api/orders/cart/', {'product_id': self.product.id, 'quantity': 1}, format='json')

        # Place order
        response = self.client.post('/api/orders/checkout/', {
            'shipping_name': 'Customer Test',
            'shipping_phone': '0911000000',
            'shipping_address': 'Debre Birhan',
            'shipping_city': 'Debre Birhan',
            'delivery_method': 'standard',
            'payment_method': 'CBE_TRANSFER'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.data['id']

        # Verify customer notification exists
        cust_notif = Notification.objects.filter(user=self.customer).first()
        self.assertIsNotNone(cust_notif)
        self.assertIn(str(order_id), cust_notif.link)

        # Verify admin received notification with link to /admin/orders
        admin_notif = Notification.objects.filter(user=self.admin).first()
        self.assertIsNotNone(admin_notif)
        self.assertIn('/admin/orders', admin_notif.link)
        self.assertIn(f'order_id={order_id}', admin_notif.link)

        # Verify manager received notification with link to /manager/orders
        mgr_notif = Notification.objects.filter(user=manager).first()
        self.assertIsNotNone(mgr_notif)
        self.assertIn('/manager/orders', mgr_notif.link)
        self.assertIn(f'order_id={order_id}', mgr_notif.link)


