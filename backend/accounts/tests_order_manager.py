from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal

from accounts.models import User, Role, Permission
from accounts.rbac import init_rbac
from products.models import Category, Product
from orders.models import Order, OrderItem, OrderStatusHistory


class OrderManagerRoleAndPermissionsTests(TestCase):
    def setUp(self):
        init_rbac()
        self.client = APIClient()

        # 1. Create Super Admin
        self.admin_user = User.objects.create_superuser(
            username='admin_boss',
            email='admin@ethio.com',
            password='Password123!',
            role=User.RoleChoices.SUPER_ADMIN
        )

        # 2. Create Order Manager user
        self.order_manager = User.objects.create_user(
            username='order_mgr',
            email='ordermgr@ethio.com',
            password='Password123!',
            role=User.RoleChoices.ORDER_MANAGER,
            is_staff=True
        )

        # 3. Create Store Manager user
        self.store_manager = User.objects.create_user(
            username='store_mgr',
            email='storemgr@ethio.com',
            password='Password123!',
            role=User.RoleChoices.STORE_MANAGER,
            is_staff=True
        )

        # 4. Create Customer user
        self.customer = User.objects.create_user(
            username='customer_abebe',
            email='abebe@ethio.com',
            password='Password123!',
            role=User.RoleChoices.CUSTOMER
        )

        # 5. Create Sample Category & Product
        self.category = Category.objects.create(
            name='Laptops & Computers',
            slug='laptops-computers',
            is_active=True
        )
        self.product = Product.objects.create(
            name='Dell XPS 15',
            slug='dell-xps-15',
            sku='DELL-XPS-15-001',
            price=Decimal('120000.00'),
            stock=10,
            category=self.category,
            is_active=True
        )

        # 6. Create Sample Order for Customer
        self.order = Order.objects.create(
            customer=self.customer,
            order_number='ORD-TEST-1001',
            subtotal=Decimal('120000.00'),
            total_amount=Decimal('120000.00'),
            payment_method='CHAPA',
            payment_status=Order.PaymentStatus.PAID,
            fulfillment_status=Order.FulfillmentStatus.PENDING,
            status=Order.Status.PROCESSING,
            shipping_name='Abebe Bikila',
            shipping_address='Bole Atlas',
            shipping_city='Addis Ababa',
            shipping_phone='+251911223344'
        )
        OrderItem.objects.create(
            order=self.order,
            product=self.product,
            quantity=1,
            unit_price=self.product.price,
            total_price=self.product.price
        )

    def test_order_manager_role_properties_and_permissions(self):
        """Verify is_order_manager helper and canonical permissions assigned to Order Manager."""
        self.assertTrue(self.order_manager.is_order_manager())
        self.assertFalse(self.order_manager.is_customer())
        self.assertFalse(self.order_manager.is_admin())

        perms = self.order_manager.get_all_permissions()
        self.assertIn('orders.view', perms)
        self.assertIn('orders.update', perms)
        self.assertIn('products.view', perms)
        self.assertIn('customers.view', perms)
        self.assertIn('reports.view', perms)
        self.assertIn('payments.view', perms)

        # Ensure Admin-only permissions are NOT granted
        self.assertNotIn('products.create', perms)
        self.assertNotIn('products.edit', perms)
        self.assertNotIn('products.delete', perms)
        self.assertNotIn('categories.manage', perms)
        self.assertNotIn('inventory.manage', perms)
        self.assertNotIn('users.manage', perms)
        self.assertNotIn('roles.manage', perms)
        self.assertNotIn('settings.manage', perms)
        self.assertNotIn('audit_logs.view', perms)

    def test_order_manager_can_view_orders_and_details(self):
        """Order Manager should be able to list all customer orders and view order detail."""
        self.client.force_authenticate(user=self.order_manager)

        # List orders
        res = self.client.get('/api/orders/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        order_list = res.data.get('results', res.data)
        self.assertGreaterEqual(len(order_list), 1)

        # Retrieve order detail
        res_detail = self.client.get(f'/api/orders/{self.order.id}/')
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(res_detail.data['order_number'], 'ORD-TEST-1001')
        self.assertEqual(res_detail.data['customer_name'], 'customer_abebe')

    def test_order_manager_can_transition_order_status_and_records_history(self):
        """Order Manager should be able to advance fulfillment and status history is recorded."""
        self.client.force_authenticate(user=self.order_manager)

        # 1. PENDING -> CONFIRMED
        patch_res = self.client.patch(f'/api/orders/{self.order.id}/status/', {
            'fulfillment_status': 'CONFIRMED',
            'comment': 'Confirmed by Order Manager'
        })
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.fulfillment_status, Order.FulfillmentStatus.CONFIRMED)

        # Check OrderStatusHistory record
        history = OrderStatusHistory.objects.filter(order=self.order).order_by('-created_at').first()
        self.assertIsNotNone(history)
        self.assertEqual(history.previous_status, 'PENDING')
        self.assertEqual(history.new_status, 'CONFIRMED')
        self.assertEqual(history.changed_by, self.order_manager)
        self.assertIn('Confirmed by Order Manager', history.comment)

        # 2. CONFIRMED -> PROCESSING
        patch_res2 = self.client.patch(f'/api/orders/{self.order.id}/status/', {
            'fulfillment_status': 'PROCESSING',
            'comment': 'Warehouse team is packing item'
        })
        self.assertEqual(patch_res2.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.fulfillment_status, Order.FulfillmentStatus.PROCESSING)

        # 3. PROCESSING -> SHIPPED
        patch_res3 = self.client.patch(f'/api/orders/{self.order.id}/status/', {
            'fulfillment_status': 'SHIPPED',
            'comment': 'Handed over to courier driver'
        })
        self.assertEqual(patch_res3.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.fulfillment_status, Order.FulfillmentStatus.SHIPPED)

        # 4. SHIPPED -> DELIVERED
        patch_res4 = self.client.patch(f'/api/orders/{self.order.id}/status/', {
            'fulfillment_status': 'DELIVERED',
            'comment': 'Successfully delivered to Abebe'
        })
        self.assertEqual(patch_res4.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.fulfillment_status, Order.FulfillmentStatus.DELIVERED)

        # Total 4 history entries created
        self.assertEqual(OrderStatusHistory.objects.filter(order=self.order).count(), 4)

    def test_order_manager_can_reject_pending_order(self):
        """Order Manager should be able to reject pending order to CANCELLED."""
        self.client.force_authenticate(user=self.order_manager)

        res = self.client.patch(f'/api/orders/{self.order.id}/status/', {
            'fulfillment_status': 'CANCELLED',
            'comment': 'Order rejected due to customer request'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.fulfillment_status, Order.FulfillmentStatus.CANCELLED)

        history = OrderStatusHistory.objects.filter(order=self.order).first()
        self.assertEqual(history.new_status, 'CANCELLED')
        self.assertEqual(history.changed_by, self.order_manager)

    def test_order_manager_kpi_stats_and_csv_export(self):
        """Order Manager can access dedicated order manager stats and export order report CSV."""
        self.client.force_authenticate(user=self.order_manager)

        stats_res = self.client.get('/api/orders/analytics/order-manager-stats/')
        self.assertEqual(stats_res.status_code, status.HTTP_200_OK)
        self.assertIn('kpis', stats_res.data)
        self.assertEqual(stats_res.data['kpis']['total_orders'], 1)

        csv_res = self.client.get('/api/orders/analytics/export-sales/')
        self.assertEqual(csv_res.status_code, status.HTTP_200_OK)
        self.assertEqual(csv_res['Content-Type'], 'text/csv')

    def test_order_manager_is_forbidden_from_catalog_and_inventory_edits(self):
        """Order Manager MUST be forbidden from creating products, editing products, or adjusting inventory."""
        self.client.force_authenticate(user=self.order_manager)

        # 1. Cannot create product
        res_create_prod = self.client.post('/api/products/items/', {
            'name': 'Hacker Laptop',
            'sku': 'HACK-001',
            'price': '500.00',
            'category': self.category.id,
            'stock': 5
        })
        self.assertEqual(res_create_prod.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Cannot edit product price or details
        res_edit_prod = self.client.patch(f'/api/products/items/{self.product.id}/', {
            'price': '1.00'
        })
        self.assertEqual(res_edit_prod.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Cannot delete product
        res_del_prod = self.client.delete(f'/api/products/items/{self.product.id}/')
        self.assertEqual(res_del_prod.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Cannot create category
        res_cat = self.client.post('/api/products/categories/', {
            'name': 'New Category'
        })
        self.assertEqual(res_cat.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Cannot adjust inventory stock
        res_inv = self.client.post('/api/products/inventory/', {
            'product_id': self.product.id,
            'quantity': 100
        })
        self.assertEqual(res_inv.status_code, status.HTTP_403_FORBIDDEN)

    def test_order_manager_is_forbidden_from_admin_functions(self):
        """Order Manager MUST be forbidden from managing users, roles, and system settings."""
        self.client.force_authenticate(user=self.order_manager)

        # 1. Cannot list users
        res_users = self.client.get('/api/auth/users/')
        self.assertEqual(res_users.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Cannot create staff user
        res_create_user = self.client.post('/api/auth/users/', {
            'username': 'rogue_user',
            'email': 'rogue@ethio.com',
            'password': 'Password123!',
            'role': 'admin'
        })
        self.assertEqual(res_create_user.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Cannot assign roles
        res_assign = self.client.post(f'/api/auth/users/{self.customer.id}/assign-role/', {
            'role': 'admin'
        })
        self.assertEqual(res_assign.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Cannot create custom roles
        res_role = self.client.post('/api/auth/roles/', {
            'code': 'rogue_role',
            'name': 'Rogue Role'
        })
        self.assertEqual(res_role.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Cannot modify platform configuration
        res_config = self.client.put('/api/auth/platform-config/', {
            'platform_name': 'Hacked Store'
        })
        self.assertEqual(res_config.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_and_assign_order_manager(self):
        """Admin can create new Order Manager accounts and assign existing users to Order Manager."""
        self.client.force_authenticate(user=self.admin_user)

        # 1. Admin creates new Order Manager account
        create_res = self.client.post('/api/auth/users/', {
            'username': 'new_order_lead',
            'email': 'lead@ethio.com',
            'password': 'Password123!',
            'first_name': 'Chala',
            'last_name': 'Kebede',
            'role': 'order_manager'
        })
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        new_om = User.objects.get(username='new_order_lead')
        self.assertEqual(new_om.role, User.RoleChoices.ORDER_MANAGER)
        self.assertTrue(new_om.is_staff)
        self.assertTrue(new_om.is_order_manager())

        # 2. Admin assigns existing customer to Order Manager
        assign_res = self.client.post(f'/api/auth/users/{self.customer.id}/assign-role/', {
            'role': 'order_manager'
        })
        self.assertEqual(assign_res.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, User.RoleChoices.ORDER_MANAGER)
        self.assertTrue(self.customer.is_order_manager())
