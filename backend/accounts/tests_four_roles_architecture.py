from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch

from accounts.models import EmailVerificationToken, AuditLog
from products.models import Category, Product, Supplier, PurchaseRequest, SupplierPayment
from orders.models import Order, Cart, CartItem
from delivery.models import (
    DeliveryPersonnel, Shipment, ShipmentStatus,
    DeliveryMethod, CourierSettlement
)

User = get_user_model()


class FourRolesArchitectureTestSuite(TestCase):
    """
    Comprehensive verification for ETHIOTECH MARKET – FINAL FOUR-ROLE SYSTEM ARCHITECTURE:
    1. Exactly 4 roles: Admin, Store Manager, Order Manager, Customer.
    2. Exactly 2 login portals (Customer vs Staff).
    3. Distinct staff permissions & dashboards.
    4. External Suppliers & Couriers (not login roles).
    5. Supplier payments & Courier settlements.
    6. Customer checkout with separate product amount and shipping fee.
    7. Unauthorized API access prevention.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Provision Admin (super_admin / admin)
        self.admin = User.objects.create_user(
            username='admin_user',
            email='admin@ethiotech.com',
            password='AdminPassword123!',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
            email_verified=True
        )

        # 2. Provision Store Manager
        self.store_manager = User.objects.create_user(
            username='store_manager_user',
            email='storemanager@ethiotech.com',
            password='ManagerPassword123!',
            role=User.Role.STORE_MANAGER,
            is_staff=True,
            is_superuser=False,
            email_verified=True
        )

        # 3. Provision Order Manager
        self.order_manager = User.objects.create_user(
            username='order_manager_user',
            email='ordermanager@ethiotech.com',
            password='OrderPassword123!',
            role=User.Role.ORDER_MANAGER,
            is_staff=True,
            is_superuser=False,
            email_verified=True
        )

        # 4. Provision Customer
        self.customer = User.objects.create_user(
            username='customer_user',
            email='customer@ethiotech.com',
            password='CustomerPassword123!',
            role=User.Role.CUSTOMER,
            is_staff=False,
            is_superuser=False,
            email_verified=True
        )

        # Sample catalog entities
        self.category = Category.objects.create(name='Laptops', slug='laptops')
        self.supplier = Supplier.objects.create(
            name='Ethio Electronics Import',
            contact_person='Ato Tadesse',
            email='tadesse@supplier.com',
            phone='+251911000001',
            address='Bole Sub-City, Addis Ababa',
            status='ACTIVE'
        )
        self.product = Product.objects.create(
            name='ThinkPad X1 Carbon',
            category=self.category,
            supplier=self.supplier,
            price=Decimal('85000.00'),
            cost_price=Decimal('70000.00'),
            stock=15,
            low_stock_threshold=5,
            reorder_quantity=10
        )

        # External Courier Record (not a user account)
        self.courier = DeliveryPersonnel.objects.create(
            full_name='Kassahun Delivery Express',
            phone_number='+251911999888',
            email='kassahun@courier.com',
            employee_code='CR-889900',
            vehicle_type='Motorcycle',
            vehicle_registration_number='AA-3-44556',
            delivery_area='Addis Ababa Central Zone',
            status='ACTIVE',
            is_available=True
        )

    # =========================================================================
    # 1. PUBLIC REGISTRATION & EMAIL OTP VERIFICATION
    # =========================================================================

    def test_customer_registration_automatically_assigns_customer_role(self):
        """Public registration automatically assigns Customer role, never Staff."""
        payload = {
            'username': 'newcustomer',
            'email': 'newcustomer@gmail.com',
            'password': 'SecurePassword123!',
            'role': 'admin'  # Attempting to tamper and request admin
        }
        res = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email='newcustomer@gmail.com')
        self.assertEqual(user.role, User.Role.CUSTOMER)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

        # OTP token must be generated and hashed for security
        token = EmailVerificationToken.objects.filter(user=user, is_used=False).first()
        self.assertIsNotNone(token)
        self.assertTrue(bool(token.otp_hash))

    def test_otp_verification_activates_customer_account(self):
        """Submitting valid 6-digit OTP activates customer account."""
        user = User.objects.create_user(
            username='unverified_user',
            email='unverified@gmail.com',
            password='Password123!',
            role=User.Role.CUSTOMER,
            is_active=False,
            email_verified=False
        )
        token = EmailVerificationToken.objects.create(
            user=user,
            otp_code='654321',
            token='sample_token_32_characters_long_123',
            purpose='email_verification',
            expires_at=token_expiry()
        )

        verify_res = self.client.post('/api/auth/verify-email/', {
            'email': user.email,
            'otp': '654321'
        }, format='json')
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)

        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertTrue(user.email_verified)

    # =========================================================================
    # 2. TWO MAIN LOGIN PORTALS (CUSTOMER vs STAFF)
    # =========================================================================

    def test_customer_portal_authenticates_customer_and_rejects_staff(self):
        """Customer portal accepts Customer and rejects Staff with clear error."""
        # Customer success
        res = self.client.post('/api/auth/login/customer/', {
            'identifier': 'customer@ethiotech.com',
            'password': 'CustomerPassword123!'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('token', res.data)

        # Staff rejected on customer portal
        res_admin = self.client.post('/api/auth/login/customer/', {
            'identifier': 'admin@ethiotech.com',
            'password': 'AdminPassword123!'
        }, format='json')
        self.assertEqual(res_admin.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(res_admin.data.get('portal_access_denied'))

    def test_staff_portal_authenticates_staff_and_rejects_customer(self):
        """Staff portal accepts Admin, Store Manager, Order Manager, and rejects Customer."""
        # 1. Admin login
        res_admin = self.client.post('/api/auth/login/staff/', {
            'identifier': 'admin@ethiotech.com',
            'password': 'AdminPassword123!'
        }, format='json')
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(res_admin.data['user']['role'], 'admin')

        # 2. Store Manager login
        res_sm = self.client.post('/api/auth/login/staff/', {
            'identifier': 'storemanager@ethiotech.com',
            'password': 'ManagerPassword123!'
        }, format='json')
        self.assertEqual(res_sm.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sm.data['user']['role'], 'store_manager')

        # 3. Order Manager login
        res_om = self.client.post('/api/auth/login/staff/', {
            'identifier': 'ordermanager@ethiotech.com',
            'password': 'OrderPassword123!'
        }, format='json')
        self.assertEqual(res_om.status_code, status.HTTP_200_OK)
        self.assertEqual(res_om.data['user']['role'], 'order_manager')

        # 4. Customer denied on staff portal
        res_cust = self.client.post('/api/auth/login/staff/', {
            'identifier': 'customer@ethiotech.com',
            'password': 'CustomerPassword123!'
        }, format='json')
        self.assertEqual(res_cust.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(res_cust.data.get('portal_access_denied'))

    # =========================================================================
    # 3. STORE MANAGER PROCUREMENT & PURCHASE ORDERS
    # =========================================================================

    def test_store_manager_can_create_purchase_order_and_receive_partial_stock(self):
        """Store Manager creates purchase order and receives partial & full stock."""
        self.client.force_authenticate(user=self.store_manager)

        po_res = self.client.post('/api/products/purchase-requests/', {
            'product': self.product.id,
            'supplier': self.supplier.id,
            'quantity': 20,
            'agreed_price': '70000.00',
            'status': 'APPROVED'
        }, format='json')
        self.assertEqual(po_res.status_code, status.HTTP_201_CREATED)
        po_id = po_res.data['id']

        initial_stock = self.product.stock  # 15

        # Partially receive 8 units
        rec_res = self.client.post(f'/api/products/purchase-requests/{po_id}/receive-stock/', {
            'received_quantity': 8
        }, format='json')
        self.assertEqual(rec_res.status_code, status.HTTP_200_OK)
        self.assertEqual(rec_res.data['status'], 'PARTIALLY_RECEIVED')
        self.assertEqual(rec_res.data['received_quantity'], 8)
        self.assertEqual(rec_res.data['outstanding_quantity'], 12)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, initial_stock + 8)

    # =========================================================================
    # 4. ADMIN SUPPLIER PAYMENTS
    # =========================================================================

    def test_admin_can_record_supplier_payment_and_store_manager_is_restricted(self):
        """Admin authorizes and records external supplier payments."""
        po = PurchaseRequest.objects.create(
            product=self.product,
            supplier=self.supplier,
            quantity=10,
            agreed_price=Decimal('70000.00'),
            total_estimated_cost=Decimal('700000.00'),
            status=PurchaseRequest.Status.RECEIVED
        )

        # Store Manager cannot authorize/record payments
        self.client.force_authenticate(user=self.store_manager)
        unauth_res = self.client.post('/api/products/supplier-payments/', {
            'supplier': self.supplier.id,
            'purchase_order': po.id,
            'supplier_invoice': 'INV-2026-9901',
            'total_purchase_amount': '700000.00',
            'amount_paid': '350000.00',
            'payment_method': 'BANK_TRANSFER',
            'payment_status': 'PAID'
        }, format='json')
        self.assertEqual(unauth_res.status_code, status.HTTP_403_FORBIDDEN)

        # Admin can authorize/record payments
        self.client.force_authenticate(user=self.admin)
        auth_res = self.client.post('/api/products/supplier-payments/', {
            'supplier': self.supplier.id,
            'purchase_order': po.id,
            'supplier_invoice': 'INV-2026-9901',
            'total_purchase_amount': '700000.00',
            'amount_paid': '350000.00',
            'payment_method': 'BANK_TRANSFER',
            'payment_status': 'PAID'
        }, format='json')
        self.assertEqual(auth_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(str(auth_res.data['outstanding_balance'])), Decimal('350000.00'))

    # =========================================================================
    # 5. ORDER MANAGER COURIER ASSIGNMENT & DELIVERIES
    # =========================================================================

    def test_order_manager_can_assign_courier_and_advance_delivery_status(self):
        """Order Manager assigns registered courier to customer order and updates milestone."""
        order = Order.objects.create(
            customer=self.customer,
            subtotal=Decimal('85000.00'),
            shipping_fee=Decimal('100.00'),
            tax=Decimal('12750.00'),
            total_amount=Decimal('97850.00'),
            shipping_name='Abebe Kebede',
            shipping_phone='+251911223344',
            shipping_address='Bole Medhanialem, House 450',
            shipping_city='Addis Ababa',
            payment_status=Order.PaymentStatus.PAID
        )

        self.client.force_authenticate(user=self.order_manager)

        # Assign courier
        assign_res = self.client.post(f'/api/delivery/orders/{order.id}/assign/', {
            'delivery_method': 'THIRD_PARTY_COURIER',
            'delivery_personnel_id': self.courier.id,
            'notes': 'Handed to registered courier Kassahun for dispatch.'
        }, format='json')
        self.assertEqual(assign_res.status_code, status.HTTP_200_OK)

        shipment = Shipment.objects.get(order=order)
        self.assertEqual(shipment.delivery_personnel, self.courier)

        # Advance milestone to OUT_FOR_DELIVERY
        status_res = self.client.post(f'/api/delivery/shipments/{shipment.id}/status/', {
            'status': 'OUT_FOR_DELIVERY',
            'location': 'Bole District Hub',
            'description': 'Out for delivery to customer residence.'
        }, format='json')
        self.assertEqual(status_res.status_code, status.HTTP_200_OK)

    # =========================================================================
    # 6. ADMIN COURIER SETTLEMENTS
    # =========================================================================

    def test_admin_can_record_courier_settlement(self):
        """Admin records settlements for delivery personnel."""
        self.client.force_authenticate(user=self.admin)
        settle_res = self.client.post('/api/delivery/settlements/', {
            'courier': self.courier.id,
            'customer_delivery_fee': '150.00',
            'courier_amount_payable': '120.00',
            'amount_settled': '120.00',
            'settlement_status': 'SETTLED',
            'payment_method': 'BANK_TRANSFER',
            'notes': 'Weekly courier remittance settled.'
        }, format='json')
        self.assertEqual(settle_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(settle_res.data['settlement_status'], 'SETTLED')

    # =========================================================================
    # 7. CUSTOMER CHECKOUT WITH SEPARATE PRODUCT & SHIPPING FEES
    # =========================================================================

    @patch('orders.chapa.requests.post')
    def test_customer_checkout_separates_product_and_delivery_fees(self, mock_post):
        """Customer checkout charges once via Chapa while storing product amount and delivery fee separately."""
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            'status': 'success',
            'data': {'checkout_url': 'https://checkout.chapa.co/test-payment'}
        }

        self.client.force_authenticate(user=self.customer)

        cart, _ = Cart.objects.get_or_create(user=self.customer)
        CartItem.objects.create(cart=cart, product=self.product, quantity=1)

        payload = {
            'shipping_name': 'Customer Test',
            'shipping_phone': '+251911223344',
            'shipping_address': 'Bole, House 200',
            'shipping_city': 'Addis Ababa',
            'delivery_method': 'express',
            'payment_method': 'CHAPA'
        }
        checkout_res = self.client.post('/api/orders/checkout/', payload, format='json')
        self.assertEqual(checkout_res.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(id=checkout_res.data['id'])
        # Product subtotal and shipping fee must be distinct fields in DB
        self.assertEqual(order.subtotal, Decimal('85000.00'))
        self.assertEqual(order.shipping_fee, Decimal('100.00'))
        self.assertEqual(order.tax, Decimal('12750.00'))
        self.assertEqual(order.total_amount, Decimal('97850.00'))


def token_expiry():
    from django.utils import timezone
    import datetime
    return timezone.now() + datetime.timedelta(minutes=10)
