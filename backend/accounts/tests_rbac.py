from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import Permission, Role, AuditLog
from accounts.rbac import init_rbac
from products.models import Category, Product
from orders.models import Order, PaymentEvidence

User = get_user_model()


class RBACTestCase(TestCase):
    def setUp(self):
        # Initialize canonical permissions and system roles
        init_rbac()

        self.client = APIClient()

        # 1. Super Admin
        self.super_admin = User.objects.create_user(
            username='main_superadmin',
            email='superadmin@ethio.com',
            password='password123',
            role=User.RoleChoices.SUPER_ADMIN,
            is_superuser=True,
            is_staff=True
        )

        # 2. Regular Admin
        admin_role = Role.objects.get(code='admin')
        self.admin = User.objects.create_user(
            username='dept_admin',
            email='admin@ethio.com',
            password='password123',
            role=User.RoleChoices.ADMIN,
            custom_role=admin_role,
            is_staff=True
        )

        # 3. Sub-Admin (Least privilege: starts with no permissions)
        sub_admin_role = Role.objects.get(code='sub_admin')
        self.sub_admin = User.objects.create_user(
            username='sub_officer',
            email='subadmin@ethio.com',
            password='password123',
            role=User.RoleChoices.SUB_ADMIN,
            custom_role=sub_admin_role,
            is_staff=True
        )

        # 4. Customer A & Customer B
        self.customer_a = User.objects.create_user(
            username='customera',
            email='customera@gmail.com',
            password='password123',
            role=User.RoleChoices.CUSTOMER
        )
        self.customer_b = User.objects.create_user(
            username='customerb',
            email='customerb@gmail.com',
            password='password123',
            role=User.RoleChoices.CUSTOMER
        )

        # Sample Category and Product
        self.category = Category.objects.create(name='Laptops', slug='laptops')
        self.product = Product.objects.create(
            name='ThinkPad X1 Carbon',
            slug='thinkpad-x1',
            category=self.category,
            price=Decimal('45000.00'),
            stock=5,
            is_active=True
        )

        # Sample Orders for Customer A and Customer B
        self.order_a = Order.objects.create(
            customer=self.customer_a,
            subtotal=Decimal('45000.00'),
            total_amount=Decimal('45000.00'),
            shipping_name='Customer A',
            shipping_phone='0911000001',
            shipping_address='Bole',
            shipping_city='Addis Ababa',
            payment_method='CHAPA'
        )
        self.order_b = Order.objects.create(
            customer=self.customer_b,
            subtotal=Decimal('2000.00'),
            total_amount=Decimal('2000.00'),
            shipping_name='Customer B',
            shipping_phone='0911000002',
            shipping_address='Megenagna',
            shipping_city='Addis Ababa',
            payment_method='CBE'
        )

    # -------------------------------------------------------------------------
    # 1. Super Admin Capabilities and Protection
    # -------------------------------------------------------------------------
    def test_super_admin_has_full_access(self):
        self.client.force_authenticate(user=self.super_admin)

        # Super admin can view all permissions
        res = self.client.get('/api/auth/permissions/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data['total'], 15)

        # Super admin can view all roles
        res = self.client.get('/api/auth/roles/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Super admin can access audit logs
        res = self.client.get('/api/auth/audit-logs/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Super admin can access system analytics
        res = self.client.get('/api/auth/system-analytics/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_super_admin_can_create_custom_role_with_granular_permissions(self):
        self.client.force_authenticate(user=self.super_admin)

        payload = {
            'code': 'custom_inventory_specialist',
            'name': 'Inventory Specialist',
            'description': 'Handles only stock replenishment and catalog inspection.',
            'permission_codes': ['products.view', 'inventory.manage']
        }
        res = self.client.post('/api/auth/roles/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['code'], 'custom_inventory_specialist')
        self.assertEqual(len(res.data['permission_codes']), 2)

        # Check AuditLog recorded
        log = AuditLog.objects.filter(action='ROLE_CREATED').first()
        self.assertIsNotNone(log)
        self.assertIn('Inventory Specialist', log.details)

    def test_super_admin_can_apply_predefined_template(self):
        self.client.force_authenticate(user=self.super_admin)

        # Apply Order Manager template
        payload = {
            'template_key': 'order_manager',
            'name': 'Regional Order Dispatcher',
            'code': 'regional_order_dispatcher'
        }
        res = self.client.post('/api/auth/roles/templates/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('orders.view', res.data['role']['permission_codes'])
        self.assertIn('orders.update', res.data['role']['permission_codes'])

    def test_super_admin_account_is_protected_against_downgrade_or_deactivation(self):
        self.client.force_authenticate(user=self.admin)

        # Regular admin tries to demote Super Admin
        res = self.client.patch(
            f'/api/auth/users/{self.super_admin.id}/',
            {'role': 'customer'},
            format='json'
        )
        self.assertIn(res.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN])

        # Regular admin tries to deactivate Super Admin
        res = self.client.patch(
            f'/api/auth/users/{self.super_admin.id}/',
            {'is_active': False},
            format='json'
        )
        self.assertIn(res.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN])

        # Regular admin tries to delete Super Admin
        res = self.client.delete(f'/api/auth/users/{self.super_admin.id}/')
        self.assertIn(res.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN])

    # -------------------------------------------------------------------------
    # 2. Sub-Admin Least-Privilege & Granular Permissions Enforcement
    # -------------------------------------------------------------------------
    def test_sub_admin_least_privilege_by_default(self):
        """Sub-admin with no assigned permissions is denied from management actions."""
        self.client.force_authenticate(user=self.sub_admin)

        # Cannot create product
        res = self.client.post('/api/products/items/', {'name': 'Unauthorized Item'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Cannot view all orders
        res = self.client.get('/api/orders/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Cannot verify payments
        res = self.client.post(f'/api/orders/{self.order_a.id}/verify-payment/', {'action': 'approve'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Cannot access roles management
        res = self.client.get('/api/auth/roles/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Cannot access audit logs
        res = self.client.get('/api/auth/audit-logs/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_sub_admin_granted_specific_permission_can_only_access_that_module(self):
        # Super Admin grants ONLY 'products.create' and 'products.view' to sub-admin
        self.client.force_authenticate(user=self.super_admin)
        res = self.client.post(
            f'/api/auth/users/{self.sub_admin.id}/assign-role/',
            {'direct_permission_codes': ['products.view', 'products.create']},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Now authenticate as sub-admin
        self.client.force_authenticate(user=self.sub_admin)

        # Can now create a product
        payload = {
            'name': 'Authorized Sub-Admin Laptop',
            'slug': 'sub-admin-laptop',
            'description': 'High performance business laptop.',
            'category': self.category.id,
            'price': '30000.00',
            'stock': 10,
            'is_active': True
        }
        res = self.client.post('/api/products/items/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # But still strictly CANNOT update order status
        res = self.client.patch(f'/api/orders/{self.order_a.id}/status/', {'status': 'CONFIRMED'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # And still strictly CANNOT verify payments
        res = self.client.post(f'/api/orders/{self.order_a.id}/verify-payment/', {'action': 'approve'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_sub_admin_cannot_grant_self_permissions_or_promote_to_super_admin(self):
        self.client.force_authenticate(user=self.sub_admin)

        # Tries to assign themselves super_admin
        res = self.client.post(
            f'/api/auth/users/{self.sub_admin.id}/assign-role/',
            {'role': 'super_admin'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Tries to create custom roles
        res = self.client.post(
            '/api/auth/roles/',
            {'code': 'rogue_role', 'name': 'Rogue Role', 'permission_codes': ['roles.manage']},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 3. Customer Data Isolation
    # -------------------------------------------------------------------------
    def test_customer_cannot_view_another_customers_order(self):
        # Customer A tries to access Customer B's order
        self.client.force_authenticate(user=self.customer_a)
        res = self.client.get(f'/api/orders/{self.order_b.id}/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_can_view_own_order(self):
        self.client.force_authenticate(user=self.customer_a)
        res = self.client.get(f'/api/orders/{self.order_a.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['id'], self.order_a.id)

    def test_customer_cannot_access_administrative_endpoints(self):
        self.client.force_authenticate(user=self.customer_a)

        # User management
        res = self.client.get('/api/auth/users/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Roles management
        res = self.client.get('/api/auth/roles/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Dashboard analytics
        res = self.client.get('/api/orders/analytics/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Inventory management
        res = self.client.post('/api/products/inventory/', {'product_id': self.product.id, 'quantity': 5})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 4. Guest (Unauthenticated) Restrictions
    # -------------------------------------------------------------------------
    def test_guest_can_browse_products_publicly(self):
        self.client.logout()

        res = self.client.get('/api/products/items/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        res = self.client.get('/api/products/categories/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_guest_cannot_access_authenticated_account_features(self):
        self.client.logout()

        res = self.client.get('/api/auth/profile/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        res = self.client.get('/api/orders/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        res = self.client.post('/api/orders/checkout/', {})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    # -------------------------------------------------------------------------
    # 5. Payment Security & Separation of Duties
    # -------------------------------------------------------------------------
    def test_order_fulfillment_separated_from_payment_verification(self):
        # Create an Order Manager role that has 'orders.update' but NOT 'payments.verify'
        order_mgr_role = Role.objects.get(code='order_manager')
        order_officer = User.objects.create_user(
            username='order_officer',
            email='order_officer@ethio.com',
            password='password123',
            role=User.RoleChoices.CUSTOM,
            custom_role=order_mgr_role,
            is_staff=True
        )

        self.client.force_authenticate(user=order_officer)

        # Has orders.update, can update fulfillment for confirmed order
        # But CANNOT verify payment!
        res = self.client.post(
            f'/api/orders/{self.order_a.id}/verify-payment/',
            {'action': 'approve'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    @patch('orders.views.ChapaService.verify_payment')
    def test_payment_status_requires_server_side_chapa_verification(self, mock_verify):
        # Payment verification relies on server-side Chapa verification response
        self.client.force_authenticate(user=self.super_admin)

        self.order_a.chapa_tx_ref = 'ETHIO-TEST-12345'
        self.order_a.save()

        # Mock Chapa API returning mismatch
        mock_verify.return_value = {
            'status': 'success',
            'data': {
                'status': 'success',
                'currency': 'ETB',
                'amount': 100.0,  # Expected 45000.00
                'reference': 'CHAPA-REF-123'
            }
        }

        res = self.client.post(
            f'/api/orders/{self.order_a.id}/admin-verify-chapa/',
            {'tx_ref': 'ETHIO-TEST-12345'},
            format='json'
        )
        # Must detect mismatch and refuse to mark paid!
        self.order_a.refresh_from_db()
        self.assertNotEqual(self.order_a.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(self.order_a.last_verification_result, 'MISMATCH_DETECTED')
