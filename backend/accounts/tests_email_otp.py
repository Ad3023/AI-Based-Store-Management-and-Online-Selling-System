import datetime
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import EmailVerificationToken
from accounts.rbac import init_rbac

User = get_user_model()


class CustomerRegistrationAndEmailOTPTests(TestCase):
    def setUp(self):
        init_rbac()
        self.client = APIClient()
        self.reg_url = '/api/auth/register/'
        self.verify_url = '/api/auth/verify-email/'
        self.resend_url = '/api/auth/resend-otp/'
        self.login_url = '/api/auth/login/'
        self.customer_login_url = '/api/auth/login/customer/'
        self.staff_login_url = '/api/auth/login/staff/'

        self.valid_customer_data = {
            'full_name': 'Abebe Kebede',
            'email': 'abebe.kebede@example.com',
            'phone_number': '0911223344',
            'password': 'SecurePassword123!',
            'confirm_password': 'SecurePassword123!',
            'terms_accepted': True
        }

    @patch('accounts.views.send_verification_email')
    def test_customer_registration_success_creates_inactive_unverified_customer(self, mock_send_email):
        mock_send_email.return_value = (True, None)

        response = self.client.post(self.reg_url, self.valid_customer_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data.get('requires_verification'))
        self.assertEqual(response.data.get('masked_email'), 'abe***@example.com')
        self.assertTrue(response.data.get('email_sent'))

        # Verify no sensitive data leaked in response
        self.assertNotIn('otp', response.data)
        self.assertNotIn('otp_hash', response.data)
        self.assertNotIn('password', response.data)

        # Verify DB user record
        user = User.objects.get(email='abebe.kebede@example.com')
        self.assertFalse(user.is_active)
        self.assertFalse(user.email_verified)
        self.assertEqual(user.role, User.RoleChoices.CUSTOMER)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password('SecurePassword123!'))

        # Verify DB verification token
        token_obj = EmailVerificationToken.objects.filter(user=user, is_used=False).first()
        self.assertIsNotNone(token_obj)
        self.assertEqual(token_obj.purpose, 'email_verification')
        self.assertEqual(token_obj.failed_attempts, 0)
        self.assertTrue(bool(token_obj.otp_hash))
        self.assertGreater(token_obj.expires_at, timezone.now())

    @patch('accounts.views.send_verification_email')
    def test_registration_with_international_ethiopian_phone(self, mock_send_email):
        mock_send_email.return_value = (True, None)
        data = self.valid_customer_data.copy()
        data['email'] = 'phone.test@example.com'
        data['phone_number'] = '+251911223344'

        response = self.client.post(self.reg_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_registration_rejects_duplicate_email(self):
        User.objects.create_user(
            username='existing_user',
            email='existing@example.com',
            password='Password123!',
            role=User.RoleChoices.CUSTOMER
        )
        data = self.valid_customer_data.copy()
        data['email'] = 'existing@example.com'

        response = self.client.post(self.reg_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_registration_rejects_invalid_phone(self):
        data = self.valid_customer_data.copy()
        data['phone_number'] = '12345'

        response = self.client.post(self.reg_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone_number', response.data)

    def test_registration_rejects_duplicate_phone(self):
        User.objects.create_user(
            username='existing_phone_user',
            email='existing_phone@example.com',
            password='Password123!',
            phone_number='+251911223344',
            role=User.RoleChoices.CUSTOMER
        )
        data = self.valid_customer_data.copy()
        data['email'] = 'new_unique_email@example.com'
        data['phone_number'] = '0911223344'  # Same number in local format

        response = self.client.post(self.reg_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone_number', response.data)

    def test_registration_rejects_password_mismatch(self):
        data = self.valid_customer_data.copy()
        data['confirm_password'] = 'DifferentPassword123!'

        response = self.client.post(self.reg_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('confirm_password', response.data)

    def test_registration_rejects_unaccepted_terms(self):
        data = self.valid_customer_data.copy()
        data['terms_accepted'] = False

        response = self.client.post(self.reg_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('terms_accepted', response.data)

    @patch('accounts.views.send_verification_email')
    def test_registration_ignores_or_rejects_privileged_role_tampering(self, mock_send_email):
        mock_send_email.return_value = (True, None)
        data = self.valid_customer_data.copy()
        data['email'] = 'tamper@example.com'
        data['role'] = 'admin'

        response = self.client.post(self.reg_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email='tamper@example.com')
        # Role must still be CUSTOMER, never admin!
        self.assertEqual(user.role, User.RoleChoices.CUSTOMER)
        self.assertFalse(user.is_staff)

    @patch('accounts.views.send_verification_email')
    def test_smtp_failure_returns_503_and_informative_error(self, mock_send_email):
        mock_send_email.return_value = (False, 'We could not send the verification email at this time. Please try again later.')
        data = self.valid_customer_data.copy()
        data['email'] = 'smtp.fail@example.com'

        response = self.client.post(self.reg_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('We could not send the verification email', response.data.get('error', ''))

    @patch('accounts.views.send_verification_email')
    def test_unverified_customer_cannot_login(self, mock_send_email):
        mock_send_email.return_value = (True, None)
        self.client.post(self.reg_url, self.valid_customer_data, format='json')

        # Attempt to login via customer login
        login_res = self.client.post(self.customer_login_url, {
            'email': self.valid_customer_data['email'],
            'password': self.valid_customer_data['password'],
            'portal': 'customer'
        }, format='json')

        self.assertIn(login_res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_400_BAD_REQUEST])
        self.assertTrue(login_res.data.get('unverified'))
        self.assertNotIn('token', login_res.data)
        self.assertNotIn('tokens', login_res.data)

    @patch('accounts.views.send_verification_email')
    def test_correct_otp_verifies_account_and_enables_login(self, mock_send_email):
        mock_send_email.return_value = (True, None)
        self.client.post(self.reg_url, self.valid_customer_data, format='json')

        user = User.objects.get(email=self.valid_customer_data['email'])
        token_obj = EmailVerificationToken.objects.get(user=user, is_used=False)

        # Set a known OTP
        known_otp = '654321'
        token_obj.set_otp(known_otp)
        token_obj.save()

        # Submit OTP to verify endpoint
        verify_res = self.client.post(self.verify_url, {
            'email': user.email,
            'otp': known_otp
        }, format='json')

        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        self.assertEqual(verify_res.data.get('status'), 'verified')
        self.assertEqual(verify_res.data.get('redirect_url'), '/login')

        # Verify user is now active and email_verified
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertTrue(user.email_verified)

        # Verify token is marked used
        token_obj.refresh_from_db()
        self.assertTrue(token_obj.is_used)
        self.assertIsNotNone(token_obj.verified_at)

        # Verified customer can now log in
        login_res = self.client.post(self.customer_login_url, {
            'email': self.valid_customer_data['email'],
            'password': self.valid_customer_data['password'],
            'portal': 'customer'
        }, format='json')

        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertTrue('token' in login_res.data or 'tokens' in login_res.data)
        self.assertEqual(login_res.data.get('user', {}).get('role'), 'customer')

    @patch('accounts.views.send_verification_email')
    def test_incorrect_otp_increments_attempts(self, mock_send_email):
        mock_send_email.return_value = (True, None)
        self.client.post(self.reg_url, self.valid_customer_data, format='json')

        user = User.objects.get(email=self.valid_customer_data['email'])
        token_obj = EmailVerificationToken.objects.get(user=user, is_used=False)
        token_obj.set_otp('123456')
        token_obj.save()

        # Submit wrong OTP
        verify_res = self.client.post(self.verify_url, {
            'email': user.email,
            'otp': '999999'
        }, format='json')

        self.assertEqual(verify_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('4 attempt(s) remaining', verify_res.data.get('error', ''))

        token_obj.refresh_from_db()
        self.assertEqual(token_obj.failed_attempts, 1)

    @patch('accounts.views.send_verification_email')
    def test_five_failed_attempts_invalidates_otp(self, mock_send_email):
        mock_send_email.return_value = (True, None)
        self.client.post(self.reg_url, self.valid_customer_data, format='json')

        user = User.objects.get(email=self.valid_customer_data['email'])
        token_obj = EmailVerificationToken.objects.get(user=user, is_used=False)
        token_obj.set_otp('123456')
        token_obj.save()

        for _ in range(5):
            self.client.post(self.verify_url, {
                'email': user.email,
                'otp': '000000'
            }, format='json')

        token_obj.refresh_from_db()
        self.assertTrue(token_obj.is_used)

        # Even correct OTP now rejected
        res = self.client.post(self.verify_url, {
            'email': user.email,
            'otp': '123456'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('accounts.views.send_verification_email')
    def test_expired_otp_rejected(self, mock_send_email):
        mock_send_email.return_value = (True, None)
        self.client.post(self.reg_url, self.valid_customer_data, format='json')

        user = User.objects.get(email=self.valid_customer_data['email'])
        token_obj = EmailVerificationToken.objects.get(user=user, is_used=False)
        token_obj.set_otp('123456')
        token_obj.expires_at = timezone.now() - datetime.timedelta(seconds=1)
        token_obj.save()

        verify_res = self.client.post(self.verify_url, {
            'email': user.email,
            'otp': '123456'
        }, format='json')

        self.assertEqual(verify_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired', verify_res.data.get('error', '').lower())

    @patch('accounts.views.send_verification_email')
    def test_used_otp_cannot_be_reused(self, mock_send_email):
        mock_send_email.return_value = (True, None)
        self.client.post(self.reg_url, self.valid_customer_data, format='json')

        user = User.objects.get(email=self.valid_customer_data['email'])
        token_obj = EmailVerificationToken.objects.get(user=user, is_used=False)
        token_obj.set_otp('123456')
        token_obj.is_used = True
        token_obj.save()

        verify_res = self.client.post(self.verify_url, {
            'email': user.email,
            'otp': '123456'
        }, format='json')

        self.assertEqual(verify_res.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('accounts.views.send_verification_email')
    def test_resend_cooldown_and_invalidation(self, mock_send_email):
        mock_send_email.return_value = (True, None)
        self.client.post(self.reg_url, self.valid_customer_data, format='json')

        user = User.objects.get(email=self.valid_customer_data['email'])
        old_token = EmailVerificationToken.objects.get(user=user, is_used=False)

        # 1. Immediate resend must fail with 429
        resend_res1 = self.client.post(self.resend_url, {'email': user.email}, format='json')
        self.assertEqual(resend_res1.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('cooldown', resend_res1.data)

        # 2. Simulate 61 seconds passing
        old_token.created_at = timezone.now() - datetime.timedelta(seconds=61)
        old_token.save()

        # 3. Resend now succeeds
        resend_res2 = self.client.post(self.resend_url, {'email': user.email}, format='json')
        self.assertEqual(resend_res2.status_code, status.HTTP_200_OK)

        # Old token is invalidated
        old_token.refresh_from_db()
        self.assertTrue(old_token.is_used)

        # New token exists
        new_token = EmailVerificationToken.objects.filter(user=user, is_used=False).first()
        self.assertIsNotNone(new_token)
        self.assertNotEqual(old_token.id, new_token.id)

    @patch('accounts.views.send_verification_email')
    def test_customer_cannot_login_to_staff_portal(self, mock_send_email):
        mock_send_email.return_value = (True, None)
        self.client.post(self.reg_url, self.valid_customer_data, format='json')

        user = User.objects.get(email=self.valid_customer_data['email'])
        token_obj = EmailVerificationToken.objects.get(user=user, is_used=False)
        token_obj.set_otp('123456')
        token_obj.save()

        # Verify customer
        self.client.post(self.verify_url, {'email': user.email, 'otp': '123456'}, format='json')

        # Customer attempts Staff Login portal
        staff_login_res = self.client.post(self.staff_login_url, {
            'email': user.email,
            'password': self.valid_customer_data['password'],
            'portal': 'staff'
        }, format='json')

        self.assertEqual(staff_login_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(staff_login_res.data.get('portal_access_denied'))
