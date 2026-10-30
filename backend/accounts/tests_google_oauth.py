from unittest.mock import patch
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from accounts.models import Role, CustomerProfile
from orders.models import Cart

User = get_user_model()


class GoogleOAuthTests(TestCase):
    """
    Automated test suite verifying Google OAuth authentication:
    - Missing backend configuration (HTTP 503, no secrets leaked)
    - Missing token validation (HTTP 400)
    - Invalid token rejection (HTTP 400)
    - Audience mismatch validation (HTTP 400)
    - Unverified email rejection (HTTP 400)
    - Successful new user creation strictly as 'customer' (HTTP 200)
    - Safe duplicate account / existing user retrieval without privilege escalation (HTTP 200)
    - Prevention of admin or store-manager elevation via Google auth
    """

    def setUp(self):
        self.client = APIClient()
        self.client_id = 'test-client-123.apps.googleusercontent.com'
        self.google_auth_url = '/api/auth/google/'

        # Ensure canonical customer role exists
        self.customer_role, _ = Role.objects.get_or_create(
            code='customer',
            defaults={'name': 'Customer', 'description': 'Store customer', 'is_system_role': True}
        )

    @override_settings(GOOGLE_OAUTH_CLIENT_ID='')
    def test_missing_configuration_returns_503_without_leaking_secrets(self):
        """When GOOGLE_OAUTH_CLIENT_ID is not configured, return 503 and no server secrets."""
        response = self.client.post(self.google_auth_url, {'id_token': 'fake_token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        data = response.data
        self.assertIn('error', data)
        self.assertIn('not configured', data['error'].lower())
        # Verify no database passwords, secret keys, or internal tracebacks are in the response
        response_text = str(response.content)
        self.assertNotIn('password', response_text.lower())
        self.assertNotIn('django-insecure', response_text)
        self.assertNotIn('postgresql', response_text.lower())

    @override_settings(GOOGLE_OAUTH_CLIENT_ID='test-client-123.apps.googleusercontent.com')
    def test_missing_token_returns_400(self):
        """When request contains no token or credential, return 400 Bad Request."""
        response = self.client.post(self.google_auth_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('token is required', response.data['error'].lower())

    @override_settings(GOOGLE_OAUTH_CLIENT_ID='test-client-123.apps.googleusercontent.com')
    def test_invalid_token_rejected_with_400(self):
        """When a forged or expired token is sent, verification fails cleanly."""
        response = self.client.post(self.google_auth_url, {'id_token': 'garbage.token.here'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('verification failed', response.data['error'].lower())

    @override_settings(GOOGLE_OAUTH_CLIENT_ID='test-client-123.apps.googleusercontent.com')
    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_audience_mismatch_rejected(self, mock_verify):
        """When token audience does not match GOOGLE_OAUTH_CLIENT_ID, reject with 400."""
        mock_verify.side_effect = ValueError("Token has wrong audience test-client-123.apps.googleusercontent.com")

        response = self.client.post(self.google_auth_url, {'id_token': 'token_for_other_app'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('audience mismatch', response.data['error'].lower())

    @override_settings(GOOGLE_OAUTH_CLIENT_ID='test-client-123.apps.googleusercontent.com')
    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_unverified_email_rejected(self, mock_verify):
        """When Google user email is not verified, reject with 400."""
        mock_verify.return_value = {
            'aud': 'test-client-123.apps.googleusercontent.com',
            'email': 'unverified@gmail.com',
            'email_verified': False,
            'name': 'Unverified User'
        }

        response = self.client.post(self.google_auth_url, {'id_token': 'valid_token_unverified'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('not verified', response.data['error'].lower())

    @override_settings(GOOGLE_OAUTH_CLIENT_ID='test-client-123.apps.googleusercontent.com')
    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_successful_new_user_created_strictly_as_customer(self, mock_verify):
        """New Google users are assigned 'customer' role strictly and cannot be admin."""
        mock_verify.return_value = {
            'aud': 'test-client-123.apps.googleusercontent.com',
            'email': 'newcustomer@gmail.com',
            'email_verified': True,
            'given_name': 'Solomon',
            'family_name': 'Tadesse',
            'name': 'Solomon Tadesse'
        }

        response = self.client.post(self.google_auth_url, {'credential': 'valid_jwt_credential'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_new_user'])
        self.assertIn('token', response.data)

        # Inspect database record
        user = User.objects.get(email='newcustomer@gmail.com')
        self.assertEqual(user.role, User.Role.CUSTOMER)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.first_name, 'Solomon')
        self.assertEqual(user.last_name, 'Tadesse')

        # Verify CustomerProfile & Cart were provisioned
        self.assertTrue(CustomerProfile.objects.filter(user=user).exists())
        self.assertTrue(Cart.objects.filter(user=user).exists())

    @override_settings(GOOGLE_OAUTH_CLIENT_ID='test-client-123.apps.googleusercontent.com')
    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_existing_user_duplicate_account_safely_retrieved(self, mock_verify):
        """Existing users logging in with Google retain their existing role and password."""
        # Pre-seed an existing manager account
        existing_manager = User.objects.create_user(
            username='store_manager_test',
            email='manager_existing@store.com',
            password='SecureManagerPass123!',
            role=User.Role.STORE_MANAGER,
            is_staff=True
        )

        mock_verify.return_value = {
            'aud': 'test-client-123.apps.googleusercontent.com',
            'email': 'manager_existing@store.com',
            'email_verified': True,
            'name': 'Store Manager Test'
        }

        response = self.client.post(self.google_auth_url, {'id_token': 'valid_manager_token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_new_user'])

        # Verify user record was not overwritten or corrupted
        existing_manager.refresh_from_db()
        self.assertEqual(existing_manager.role, User.Role.STORE_MANAGER)
        self.assertTrue(existing_manager.is_staff)
        self.assertTrue(existing_manager.check_password('SecureManagerPass123!'))

    @override_settings(GOOGLE_OAUTH_CLIENT_ID='test-client-123.apps.googleusercontent.com')
    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_admin_elevation_prevented_for_deceptive_usernames(self, mock_verify):
        """Even if the Google email looks like 'admin@gmail.com', the assigned role is strictly customer."""
        mock_verify.return_value = {
            'aud': 'test-client-123.apps.googleusercontent.com',
            'email': 'admin_mimic@gmail.com',
            'email_verified': True,
            'name': 'Administrator'
        }

        response = self.client.post(self.google_auth_url, {'id_token': 'admin_mimic_token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        user = User.objects.get(email='admin_mimic@gmail.com')
        self.assertEqual(user.role, User.Role.CUSTOMER)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
