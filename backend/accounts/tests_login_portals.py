from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import Role, Permission, AuditLog, PasswordResetToken
from accounts.rbac import init_rbac
from accounts.views import get_dashboard_url_for_user

User = get_user_model()


class LoginPortalsAndRoleRedirectionTests(TestCase):
    def setUp(self):
        init_rbac()
        self.client = APIClient()

        # 1. Administrator
        self.admin = User.objects.create_user(
            username='system_admin',
            email='admin@ethiotech.com',
            password='Password123!',
            role=User.RoleChoices.ADMIN,
            is_staff=True,
            email_verified=True
        )

        # 2. Store Manager
        self.store_manager = User.objects.create_user(
            username='store_lead',
            email='storemanager@ethiotech.com',
            password='Password123!',
            role=User.RoleChoices.STORE_MANAGER,
            is_staff=True,
            email_verified=True
        )

        # 3. Order Manager
        self.order_manager = User.objects.create_user(
            username='order_lead',
            email='ordermanager@ethiotech.com',
            password='Password123!',
            role=User.RoleChoices.ORDER_MANAGER,
            is_staff=True,
            email_verified=True
        )

        # 4. Customer
        self.customer = User.objects.create_user(
            username='customer_chala',
            email='chala@gmail.com',
            password='Password123!',
            role=User.RoleChoices.CUSTOMER,
            is_staff=False,
            email_verified=True
        )

    def test_backend_identifies_canonical_dashboard_urls_for_four_roles(self):
        """Backend must identify correct dashboard URL without user manual selection."""
        self.assertEqual(get_dashboard_url_for_user(self.admin), '/admin/dashboard')
        self.assertEqual(get_dashboard_url_for_user(self.store_manager), '/store-manager/dashboard')
        self.assertEqual(get_dashboard_url_for_user(self.order_manager), '/order-manager/dashboard')
        self.assertEqual(get_dashboard_url_for_user(self.customer), '/customer/dashboard')

    def test_customer_login_portal_success_for_customer(self):
        """Customer can sign in via Customer Login portal and gets Customer Dashboard URL."""
        res = self.client.post('/api/auth/login/customer/', {
            'username': 'chala@gmail.com',
            'password': 'Password123!'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('token', res.data)
        self.assertEqual(res.data['role'], 'customer')
        self.assertEqual(res.data['dashboard_url'], '/customer/dashboard')

    def test_customer_login_portal_rejects_staff_members(self):
        """Staff members (Admin, Store Manager, Order Manager) are rejected on Customer Login portal."""
        # 1. Admin rejected
        res_admin = self.client.post('/api/auth/login/customer/', {
            'username': 'admin@ethiotech.com',
            'password': 'Password123!'
        })
        self.assertEqual(res_admin.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(res_admin.data.get('portal_access_denied'))
        self.assertEqual(res_admin.data.get('redirect_url'), '/staff/login')
        self.assertIn('Staff members', res_admin.data.get('error', ''))

        # 2. Store Manager rejected
        res_sm = self.client.post('/api/auth/login/customer/', {
            'username': 'storemanager@ethiotech.com',
            'password': 'Password123!'
        })
        self.assertEqual(res_sm.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(res_sm.data.get('portal_access_denied'))

        # 3. Order Manager rejected
        res_om = self.client.post('/api/auth/login/customer/', {
            'username': 'ordermanager@ethiotech.com',
            'password': 'Password123!'
        })
        self.assertEqual(res_om.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(res_om.data.get('portal_access_denied'))

    def test_staff_login_portal_success_for_admin(self):
        """Admin signs in via Staff Login portal and is redirected to Admin Dashboard."""
        res = self.client.post('/api/auth/login/staff/', {
            'username': 'admin@ethiotech.com',
            'password': 'Password123!'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['role'], 'admin')
        self.assertEqual(res.data['dashboard_url'], '/admin/dashboard')

    def test_staff_login_portal_success_for_store_manager(self):
        """Store Manager signs in via Staff Login portal and is redirected to Store Manager Dashboard."""
        res = self.client.post('/api/auth/login/staff/', {
            'username': 'storemanager@ethiotech.com',
            'password': 'Password123!'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['role'], 'store_manager')
        self.assertEqual(res.data['dashboard_url'], '/store-manager/dashboard')

    def test_staff_login_portal_success_for_order_manager(self):
        """Order Manager signs in via Staff Login portal and is redirected to Order Manager Dashboard."""
        res = self.client.post('/api/auth/login/staff/', {
            'username': 'ordermanager@ethiotech.com',
            'password': 'Password123!'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['role'], 'order_manager')
        self.assertEqual(res.data['dashboard_url'], '/order-manager/dashboard')

    def test_staff_login_portal_rejects_customer(self):
        """Customers are strictly forbidden from signing in on Staff Login portal."""
        res = self.client.post('/api/auth/login/staff/', {
            'username': 'chala@gmail.com',
            'password': 'Password123!'
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(res.data.get('portal_access_denied'))
        self.assertEqual(res.data.get('redirect_url'), '/login')
        self.assertEqual(res.data.get('error'), 'This portal is for authorized staff only. Please use Customer Login.')

    def test_general_login_endpoint_remains_backward_compatible(self):
        """General login without portal param continues to work for legacy clients."""
        res = self.client.post('/api/auth/login/', {
            'username': 'chala@gmail.com',
            'password': 'Password123!'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['role'], 'customer')
        self.assertEqual(res.data['dashboard_url'], '/customer/dashboard')

    def test_public_registration_never_allows_staff_role(self):
        """Public registration always forces customer role even if role is passed."""
        res = self.client.post('/api/auth/register/', {
            'email': 'newguy@gmail.com',
            'password': 'Password123!',
            'password_confirm': 'Password123!',
            'full_name': 'New Customer',
            'role': 'admin'  # Attempt privilege escalation
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_user = User.objects.get(email='newguy@gmail.com')
        self.assertEqual(new_user.role, User.RoleChoices.CUSTOMER)
        self.assertFalse(new_user.is_staff)

    def test_only_admin_can_create_staff_accounts(self):
        """Only Admin can create staff accounts and assign staff roles."""
        # Customer cannot create staff account
        self.client.force_authenticate(user=self.customer)
        res_cust = self.client.post('/api/auth/users/', {
            'username': 'rogue_sm',
            'email': 'rogue@ethiotech.com',
            'password': 'Password123!',
            'role': 'store_manager'
        })
        self.assertEqual(res_cust.status_code, status.HTTP_403_FORBIDDEN)

        # Store Manager cannot create staff account
        self.client.force_authenticate(user=self.store_manager)
        res_sm = self.client.post('/api/auth/users/', {
            'username': 'rogue_sm2',
            'email': 'rogue2@ethiotech.com',
            'password': 'Password123!',
            'role': 'store_manager'
        })
        self.assertEqual(res_sm.status_code, status.HTTP_403_FORBIDDEN)

        # Admin CAN create staff account
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.post('/api/auth/users/', {
            'username': 'new_staff_om',
            'email': 'newom@ethiotech.com',
            'password': 'Password123!',
            'first_name': 'New',
            'last_name': 'OrderManager',
            'role': 'order_manager'
        })
        self.assertEqual(res_admin.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(username='new_staff_om')
        self.assertEqual(created_user.role, User.RoleChoices.ORDER_MANAGER)
        self.assertTrue(created_user.is_staff)

    def test_staff_cannot_change_their_own_role(self):
        """Staff members cannot alter their own roles via the profile endpoint."""
        # 1. Order Manager attempts privilege escalation to admin
        self.client.force_authenticate(user=self.order_manager)
        res_om = self.client.put('/api/auth/profile/', {
            'role': 'admin'
        })
        self.assertEqual(res_om.status_code, status.HTTP_400_BAD_REQUEST)
        self.order_manager.refresh_from_db()
        self.assertEqual(self.order_manager.role, User.RoleChoices.ORDER_MANAGER)

        # 2. Store Manager attempts role change to customer or admin
        self.client.force_authenticate(user=self.store_manager)
        res_sm = self.client.put('/api/auth/profile/', {
            'role': 'admin'
        })
        self.assertEqual(res_sm.status_code, status.HTTP_400_BAD_REQUEST)
        self.store_manager.refresh_from_db()
        self.assertEqual(self.store_manager.role, User.RoleChoices.STORE_MANAGER)

    def test_staff_forgot_password_and_recovery_workflow(self):
        """Staff members can safely reset passwords via forgot-password workflow."""
        # Step 1: Request password reset
        req_res = self.client.post('/api/auth/password-reset/', {
            'email': 'storemanager@ethiotech.com'
        })
        self.assertEqual(req_res.status_code, status.HTTP_200_OK)

        token_record = PasswordResetToken.objects.filter(user=self.store_manager, is_used=False).first()
        self.assertIsNotNone(token_record)

        # Step 2: Confirm password reset with new password
        confirm_res = self.client.post('/api/auth/password-reset/confirm/', {
            'email': 'storemanager@ethiotech.com',
            'token': token_record.token,
            'new_password': 'BrandNewStaffPassword123!',
            'new_password_confirm': 'BrandNewStaffPassword123!'
        })
        self.assertEqual(confirm_res.status_code, status.HTTP_200_OK)

        # Step 3: Login to staff portal with new password
        login_res = self.client.post('/api/auth/login/staff/', {
            'username': 'storemanager@ethiotech.com',
            'password': 'BrandNewStaffPassword123!'
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertEqual(login_res.data['dashboard_url'], '/store-manager/dashboard')

    def test_customer_forgot_password_and_recovery_workflow(self):
        """Customer password recovery remains completely operational without breaking customer login."""
        # Step 1: Request password reset
        req_res = self.client.post('/api/auth/password-reset/', {
            'email': 'chala@gmail.com'
        })
        self.assertEqual(req_res.status_code, status.HTTP_200_OK)

        token_record = PasswordResetToken.objects.filter(user=self.customer, is_used=False).first()
        self.assertIsNotNone(token_record)

        # Step 2: Confirm password reset
        confirm_res = self.client.post('/api/auth/password-reset/confirm/', {
            'email': 'chala@gmail.com',
            'token': token_record.token,
            'new_password': 'CustomerNewPassword123!',
            'new_password_confirm': 'CustomerNewPassword123!'
        })
        self.assertEqual(confirm_res.status_code, status.HTTP_200_OK)

        # Step 3: Login to customer portal with new password
        login_res = self.client.post('/api/auth/login/customer/', {
            'username': 'chala@gmail.com',
            'password': 'CustomerNewPassword123!'
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertEqual(login_res.data['dashboard_url'], '/customer/dashboard')

    def test_audit_logs_record_events_without_exposing_sensitive_tokens_or_passwords(self):
        """Audit logs capture login actions while guaranteeing passwords and tokens are never saved."""
        AuditLog.objects.all().delete()

        # Staff login
        self.client.post('/api/auth/login/staff/', {
            'username': 'admin@ethiotech.com',
            'password': 'Password123!'
        })

        # Customer rejected from staff login
        self.client.post('/api/auth/login/staff/', {
            'username': 'chala@gmail.com',
            'password': 'Password123!'
        })

        logs = AuditLog.objects.all()
        self.assertTrue(logs.exists())

        for log in logs:
            # Sensitive secrets must never appear in action or details
            self.assertNotIn('Password123!', log.action)
            self.assertNotIn('Password123!', log.details)
            if hasattr(self.admin, 'auth_token'):
                self.assertNotIn(self.admin.auth_token.key, log.details)

    def test_case_insensitive_staff_username_and_email_login(self):
        """Case variations in username and email must authenticate successfully."""
        # 1. Mixed-case username 'Order_Lead'
        res_user_case = self.client.post('/api/auth/login/staff/', {
            'username': 'Order_Lead',
            'password': 'Password123!'
        })
        self.assertEqual(res_user_case.status_code, status.HTTP_200_OK)
        self.assertEqual(res_user_case.data['dashboard_url'], '/order-manager/dashboard')

        # 2. Uppercase email 'ADMIN@ETHIOTECH.COM'
        res_email_case = self.client.post('/api/auth/login/staff/', {
            'username': 'ADMIN@ETHIOTECH.COM',
            'password': 'Password123!'
        })
        self.assertEqual(res_email_case.status_code, status.HTTP_200_OK)
        self.assertEqual(res_email_case.data['dashboard_url'], '/admin/dashboard')

    def test_staff_login_with_flexible_identifier_field_names(self):
        """Backend supports 'username', 'email', and 'identifier' payload keys."""
        # 1. Key 'identifier'
        res_id = self.client.post('/api/auth/login/staff/', {
            'identifier': 'storemanager@ethiotech.com',
            'password': 'Password123!'
        })
        self.assertEqual(res_id.status_code, status.HTTP_200_OK)
        self.assertEqual(res_id.data['dashboard_url'], '/store-manager/dashboard')

        # 2. Key 'email'
        res_email = self.client.post('/api/auth/login/staff/', {
            'email': 'storemanager@ethiotech.com',
            'password': 'Password123!'
        })
        self.assertEqual(res_email.status_code, status.HTTP_200_OK)
        self.assertEqual(res_email.data['dashboard_url'], '/store-manager/dashboard')

    def test_staff_login_invalid_password_returns_safe_error(self):
        """Invalid password returns standardized safe error message."""
        res = self.client.post('/api/auth/login/staff/', {
            'username': 'admin@ethiotech.com',
            'password': 'WrongPassword999!'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data.get('non_field_errors', [''])[0], 'Invalid username/email or password.')

    def test_staff_login_inactive_account_rejected(self):
        """Inactive staff accounts are rejected with clear account status message."""
        self.store_manager.is_active = False
        self.store_manager.save()

        res = self.client.post('/api/auth/login/staff/', {
            'username': 'storemanager@ethiotech.com',
            'password': 'Password123!'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data.get('non_field_errors', [''])[0], 'This account has been deactivated.')
