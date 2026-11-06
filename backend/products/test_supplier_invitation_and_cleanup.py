import json
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from products.models import Supplier, Product, Category
from accounts.models_tokens import EmailVerificationToken

User = get_user_model()


class SupplierInvitationAndAccountCleanupTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin_clean_test',
            email='addisuguche68@gmail.com',
            password='AdminPassword123!',
            role=User.RoleChoices.ADMIN,
            is_active=True,
            email_verified=True
        )
        self.manager = User.objects.create_user(
            username='manager_clean_test',
            email='gucheaddisu10@gmail.com',
            password='ManagerPassword123!',
            role=User.RoleChoices.STORE_MANAGER,
            is_active=True,
            email_verified=True
        )
        self.supplier_org = Supplier.objects.create(
            name='Acme Genuine Hardware Distro',
            email='sales@acmetech.com',
            status=Supplier.Status.ACTIVE
        )

    def test_preserved_accounts_roles_and_authentication(self):
        """Admin and Store Manager accounts must retain exact roles and authenticate."""
        self.assertEqual(self.admin.role, User.RoleChoices.ADMIN)
        self.assertEqual(self.manager.role, User.RoleChoices.STORE_MANAGER)

        admin_login = self.client.post('/api/auth/login/', {
            'identifier': 'addisuguche68@gmail.com',
            'password': 'AdminPassword123!',
            'portal': 'staff'
        }, format='json')
        self.assertEqual(admin_login.status_code, status.HTTP_200_OK)
        self.assertEqual(admin_login.data['role'], 'admin')

        mgr_login = self.client.post('/api/auth/login/', {
            'identifier': 'gucheaddisu10@gmail.com',
            'password': 'ManagerPassword123!',
            'portal': 'staff'
        }, format='json')
        self.assertEqual(mgr_login.status_code, status.HTTP_200_OK)
        self.assertEqual(mgr_login.data['role'], 'store_manager')

    def test_case_insensitive_duplicate_prevention_and_lowercase_storage(self):
        """Emails must be normalized to lowercase and duplicates prevented across letter cases."""
        # 1. Attempt registering existing admin email in uppercase
        reg_res = self.client.post('/api/auth/register/', {
            'email': 'ADDISUGUCHE68@GMAIL.COM',
            'password': 'NewPassword123!',
            'confirm_password': 'NewPassword123!',
            'full_name': 'Test Duplicate User'
        }, format='json')
        self.assertEqual(reg_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', reg_res.data)

        # 2. Creating a user with mixed case saves lowercase
        user = User.objects.create_user(
            username='mixedcase_user',
            email='MyCustomSupplier@Business.COM',
            password='ValidPassword123!'
        )
        user.refresh_from_db()
        self.assertEqual(user.email, 'mycustomsupplier@business.com')

    @patch('accounts.supplier_email_service._send_mail_sync')
    def test_genuine_supplier_invitation_and_email_verification_workflow(self, mock_send_mail):
        """Admin invites supplier -> email sent -> unverified blocked -> OTP verifies -> active."""
        mock_send_mail.return_value = (True, None)
        self.client.force_authenticate(user=self.admin)

        # 1. Admin invites supplier
        invite_payload = {
            'email': 'Invoices@AcmeTech.COM',
            'phone': '0911223344',
            'password': 'SupplierTempPass123!'
        }
        res = self.client.post(f'/api/products/suppliers/{self.supplier_org.id}/create-account/', invite_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(mock_send_mail.called)

        # 2. Supplier user created inactive & unverified
        supplier_user = User.objects.get(email='invoices@acmetech.com')
        self.assertFalse(supplier_user.email_verified)
        self.assertFalse(supplier_user.is_active)
        self.assertEqual(supplier_user.role, User.RoleChoices.SUPPLIER)

        # 3. Supplier attempts login before verification -> blocked
        self.client.logout()
        unverified_login = self.client.post('/api/auth/login/', {
            'identifier': 'invoices@acmetech.com',
            'password': 'SupplierTempPass123!',
            'portal': 'supplier'
        }, format='json')
        self.assertEqual(unverified_login.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(unverified_login.data.get('unverified'))

        # 4. Supplier verifies with 6-digit OTP
        token_record = EmailVerificationToken.objects.filter(user=supplier_user, is_used=False).first()
        raw_otp = '123456'
        token_record.set_otp(raw_otp)
        token_record.save()

        verify_res = self.client.post('/api/auth/verify-email/', {
            'email': 'invoices@acmetech.com',
            'otp': raw_otp
        }, format='json')
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        self.assertEqual(verify_res.data['status'], 'verified')

        # 5. Account is now active & can log in
        supplier_user.refresh_from_db()
        self.assertTrue(supplier_user.email_verified)
        self.assertTrue(supplier_user.is_active)

        success_login = self.client.post('/api/auth/login/', {
            'identifier': 'invoices@acmetech.com',
            'password': 'SupplierTempPass123!',
            'portal': 'supplier'
        }, format='json')
        self.assertEqual(success_login.status_code, status.HTTP_200_OK)
        self.assertEqual(success_login.data['role'], 'supplier')

    @patch('accounts.supplier_email_service._send_mail_sync')
    def test_supplier_invitation_fails_when_email_service_unconfigured(self, mock_send_mail):
        """When email delivery fails, endpoint returns 503 and does not pretend verification succeeded."""
        mock_send_mail.return_value = (False, "SMTP authentication failed. App Password invalid.")
        self.client.force_authenticate(user=self.admin)

        invite_payload = {
            'email': 'dispatch@genuinevendor.com',
            'password': 'VendorSecure123!'
        }
        res = self.client.post(f'/api/products/suppliers/{self.supplier_org.id}/create-account/', invite_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(res.data.get('email_sent'))
        self.assertIn('SMTP authentication failed', res.data.get('error'))

