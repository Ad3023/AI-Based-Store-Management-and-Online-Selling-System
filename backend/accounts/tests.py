from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from accounts.models import Role

User = get_user_model()


class RoleBasedAuthSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create standard customer
        self.customer = User.objects.create_user(
            username='test_customer',
            email='customer@nexusstore.com',
            password='Password123!',
            first_name='Test',
            last_name='Customer',
            role=User.Role.CUSTOMER
        )
        self.customer_token, _ = Token.objects.get_or_create(user=self.customer)

        from accounts.rbac import init_rbac
        from accounts.models import Permission
        init_rbac()
        manager_role = Role.objects.filter(code='store_manager').first()
        admin_role = Role.objects.filter(code='admin').first()

        # Create store manager
        self.manager = User.objects.create_user(
            username='test_manager',
            email='manager@nexusstore.com',
            password='Password123!',
            first_name='Store',
            last_name='Manager',
            role=User.Role.STORE_MANAGER,
            custom_role=manager_role,
            is_staff=True
        )
        perm_audit = Permission.objects.filter(code='audit_logs.view').first()
        if perm_audit:
            self.manager.direct_permissions.add(perm_audit)
        self.manager_token, _ = Token.objects.get_or_create(user=self.manager)

        # Create administrator
        self.admin = User.objects.create_user(
            username='test_admin',
            email='admin@nexusstore.com',
            password='Password123!',
            first_name='System',
            last_name='Admin',
            role=User.Role.ADMIN,
            custom_role=admin_role,
            is_staff=True,
            is_superuser=True
        )
        self.admin_token, _ = Token.objects.get_or_create(user=self.admin)

    def test_registration_forces_customer_role_and_prevents_escalation(self):
        """Public registration must strictly assign CUSTOMER role even if client submits 'admin'"""
        payload = {
            'username': 'malicious_user',
            'email': 'attacker@example.com',
            'password': 'SecurePassword123!',
            'password_confirm': 'SecurePassword123!',
            'role': 'admin'  # Attempting privilege escalation
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(username='malicious_user')
        self.assertEqual(created_user.role, User.Role.CUSTOMER)
        self.assertFalse(created_user.is_staff)
        self.assertFalse(created_user.is_superuser)

    def test_duplicate_email_registration_rejected(self):
        """Registration with an existing email returns 400 Bad Request with informative error"""
        payload = {
            'username': 'different_username',
            'email': 'customer@nexusstore.com',  # Already exists
            'password': 'Password123!',
            'password_confirm': 'Password123!'
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_customer_cannot_escalate_role_via_profile_update(self):
        """Updating user profile cannot change the role field"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.customer_token.key}')
        payload = {
            'first_name': 'UpdatedName',
            'role': 'admin'  # Attempt to escalate
        }
        response = self.client.put('/api/auth/profile/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, User.Role.CUSTOMER)
        self.assertEqual(self.customer.first_name, 'UpdatedName')

    def test_customer_forbidden_from_admin_and_manager_endpoints(self):
        """Customer receives 403 Forbidden on sensitive administrative endpoints"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.customer_token.key}')
        
        # User list
        res_users = self.client.get('/api/auth/users/')
        self.assertEqual(res_users.status_code, status.HTTP_403_FORBIDDEN)

        # Audit logs
        res_audits = self.client.get('/api/auth/audit-logs/')
        self.assertEqual(res_audits.status_code, status.HTTP_403_FORBIDDEN)

        # System analytics
        res_analytics = self.client.get('/api/auth/system-analytics/')
        self.assertEqual(res_analytics.status_code, status.HTTP_403_FORBIDDEN)

    def test_store_manager_forbidden_from_admin_user_management(self):
        """Store Manager can view audit logs but cannot alter user roles or view user accounts list"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.manager_token.key}')
        
        res_users = self.client.get('/api/auth/users/')
        self.assertEqual(res_users.status_code, status.HTTP_403_FORBIDDEN)

        # Store manager CAN view audit logs
        res_audits = self.client.get('/api/auth/audit-logs/')
        self.assertEqual(res_audits.status_code, status.HTTP_200_OK)

    def test_admin_has_full_administrative_access(self):
        """Admin can list users, update user roles, and view system analytics"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')

        res_users = self.client.get('/api/auth/users/')
        self.assertEqual(res_users.status_code, status.HTTP_200_OK)

        res_analytics = self.client.get('/api/auth/system-analytics/')
        self.assertEqual(res_analytics.status_code, status.HTTP_200_OK)
        self.assertIn('users', res_analytics.data)
        self.assertIn('security', res_analytics.data)

    def test_password_reset_flow_end_to_end(self):
        """Requesting password reset generates token, and confirming token resets password securely"""
        # Step 1: Request reset
        req_res = self.client.post('/api/auth/password-reset/', {'email': 'customer@nexusstore.com'}, format='json')
        self.assertEqual(req_res.status_code, status.HTTP_200_OK)
        token = req_res.data.get('reset_token')
        self.assertTrue(token)

        # Step 2: Confirm reset
        confirm_payload = {
            'email': 'customer@nexusstore.com',
            'token': token,
            'new_password': 'BrandNewPassword99!',
            'new_password_confirm': 'BrandNewPassword99!'
        }
        conf_res = self.client.post('/api/auth/password-reset/confirm/', confirm_payload, format='json')
        self.assertEqual(conf_res.status_code, status.HTTP_200_OK)

        # Step 3: Login with new password
        login_res = self.client.post('/api/auth/login/', {
            'username': 'customer@nexusstore.com',
            'password': 'BrandNewPassword99!'
        }, format='json')
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertIn('token', login_res.data)


class MainAdminSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Main Administrator
        self.main_admin = User.objects.create_user(
            username='addisuguche_admin',
            email='addisuguche68@gmail.com',
            password='AdminPassword123!',
            first_name='Addisu',
            last_name='Guche',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True
        )
        self.admin_token, _ = Token.objects.get_or_create(user=self.main_admin)

        # Create Store Manager
        self.manager = User.objects.create_user(
            username='gucheaddisu_manager',
            email='gucheaddisu5@gmail.com',
            password='ManagerPassword123!',
            first_name='Store',
            last_name='Manager',
            role=User.Role.STORE_MANAGER,
            is_staff=True,
            is_superuser=False
        )
        self.manager_token, _ = Token.objects.get_or_create(user=self.manager)

        # Create Customer
        self.customer = User.objects.create_user(
            username='ethio_customer',
            email='customer@example.com',
            password='CustomerPassword123!',
            first_name='Abebe',
            last_name='Bikila',
            role=User.Role.CUSTOMER
        )
        self.customer_token, _ = Token.objects.get_or_create(user=self.customer)

    def test_main_admin_can_update_email_successfully(self):
        """The Main Administrator can update their email address via Profile Settings"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')
        new_email = 'admin.updated@ethiotech.com'

        response = self.client.put('/api/auth/profile/', {
            'first_name': 'Addisu',
            'last_name': 'Guche',
            'email': new_email
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], new_email)

        # Verify persisted in database
        self.main_admin.refresh_from_db()
        self.assertEqual(self.main_admin.email, new_email)
        self.assertEqual(self.main_admin.role, User.Role.ADMIN)

        # Verify login works with the updated email
        login_res = self.client.post('/api/auth/login/', {
            'username': new_email,
            'password': 'AdminPassword123!'
        }, format='json')
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertIn('token', login_res.data)

        # Verify login also still works with the username
        login_username_res = self.client.post('/api/auth/login/', {
            'username': 'addisuguche_admin',
            'password': 'AdminPassword123!'
        }, format='json')
        self.assertEqual(login_username_res.status_code, status.HTTP_200_OK)

        # Verify administrative access remains functional
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {login_res.data["token"]}')
        dash_res = self.client.get('/api/auth/system-analytics/')
        self.assertEqual(dash_res.status_code, status.HTTP_200_OK)

    def test_main_admin_email_uniqueness_validation(self):
        """Updating email to an address already registered to another account is rejected"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')

        # Attempt to use store manager's email
        response = self.client.put('/api/auth/profile/', {
            'email': 'gucheaddisu5@gmail.com'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

        # Confirm email remained unchanged in DB
        self.main_admin.refresh_from_db()
        self.assertEqual(self.main_admin.email, 'addisuguche68@gmail.com')

    def test_main_admin_email_format_validation(self):
        """Updating email with an invalid format is rejected"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')

        response = self.client.put('/api/auth/profile/', {
            'email': 'invalid-email-address'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_main_admin_cannot_change_own_role_via_profile(self):
        """The Main Administrator cannot change their role through profile settings API"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')

        for demoted_role in ['customer', 'store_manager']:
            response = self.client.put('/api/auth/profile/', {
                'first_name': 'Addisu',
                'role': demoted_role
            }, format='json')

            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.main_admin.refresh_from_db()
            self.assertEqual(self.main_admin.role, User.Role.ADMIN)

    def test_main_admin_cannot_change_own_role_via_users_api(self):
        """The Main Administrator cannot change their role via the user management API"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')

        for demoted_role in ['customer', 'store_manager']:
            response = self.client.patch(f'/api/auth/users/{self.main_admin.id}/', {
                'role': demoted_role
            }, format='json')

            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.main_admin.refresh_from_db()
            self.assertEqual(self.main_admin.role, User.Role.ADMIN)

    def test_main_admin_account_cannot_be_deactivated_or_deleted(self):
        """The Main Administrator account cannot be deactivated or deleted"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')

        # Attempt deactivation
        deact_res = self.client.patch(f'/api/auth/users/{self.main_admin.id}/', {
            'is_active': False
        }, format='json')
        self.assertEqual(deact_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.main_admin.refresh_from_db()
        self.assertTrue(self.main_admin.is_active)

        # Attempt deletion
        del_res = self.client.delete(f'/api/auth/users/{self.main_admin.id}/')
        self.assertEqual(del_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.filter(id=self.main_admin.id).exists())

    def test_admin_can_manage_other_users_roles(self):
        """Admin retains ability to manage roles for other accounts (e.g. promoting customer to store manager)"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')

        response = self.client.patch(f'/api/auth/users/{self.customer.id}/', {
            'role': 'store_manager'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, User.Role.STORE_MANAGER)

    def test_store_manager_permissions_preserved(self):
        """Store Managers retain their existing permissions and cannot alter admin roles"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.manager_token.key}')

        # Store Manager cannot modify admin account
        response = self.client.patch(f'/api/auth/users/{self.main_admin.id}/', {
            'role': 'customer'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

