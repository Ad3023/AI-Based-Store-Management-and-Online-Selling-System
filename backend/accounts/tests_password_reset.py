from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail

User = get_user_model()


class PasswordResetFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='ethio_customer',
            email='customer@ethiotech.com',
            password='InitialPassword123!',
            first_name='Abebe',
            last_name='Bikila'
        )

    def test_request_password_reset_valid_email(self):
        url = reverse('password-reset')
        resp = self.client.post(url, {'email': 'customer@ethiotech.com'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('reset_token', resp.data)
        self.assertIn('reset_url', resp.data)
        self.assertEqual(resp.data['email'], 'customer@ethiotech.com')

        # Verify email was dispatched via configured backend
        self.assertGreaterEqual(len(mail.outbox), 1)
        sent_email = mail.outbox[-1]
        self.assertIn('Password Reset Instructions', sent_email.subject)
        self.assertIn(resp.data['reset_token'], sent_email.body)

    def test_request_password_reset_case_insensitive(self):
        url = reverse('password-reset')
        resp = self.client.post(url, {'email': 'CUSTOMER@ETHIOTECH.COM'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['email'], 'customer@ethiotech.com')

    def test_request_password_reset_nonexistent_email(self):
        url = reverse('password-reset')
        resp = self.client.post(url, {'email': 'unknown_person@ethiotech.com'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', resp.data)

    def test_request_password_reset_empty_payload(self):
        url = reverse('password-reset')
        resp = self.client.post(url, {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_password_reset_successful(self):
        token = default_token_generator.make_token(self.user)
        confirm_url = reverse('password-reset-confirm')

        resp = self.client.post(confirm_url, {
            'email': 'customer@ethiotech.com',
            'token': token,
            'new_password': 'BrandNewSecurePassword456!',
            'new_password_confirm': 'BrandNewSecurePassword456!'
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get('status'), 'success')

        # Verify password actually changed in DB
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('BrandNewSecurePassword456!'))
        self.assertFalse(self.user.check_password('InitialPassword123!'))

        # Verify user can log in with new credentials
        login_resp = self.client.post(reverse('login'), {
            'username': 'ethio_customer',
            'password': 'BrandNewSecurePassword456!'
        })
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        self.assertIn('token', login_resp.data)

    def test_confirm_password_reset_invalid_token(self):
        confirm_url = reverse('password-reset-confirm')
        resp = self.client.post(confirm_url, {
            'email': 'customer@ethiotech.com',
            'token': 'bogus-or-tampered-token-12345',
            'new_password': 'BrandNewSecurePassword456!',
            'new_password_confirm': 'BrandNewSecurePassword456!'
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', resp.data)

    def test_confirm_password_reset_mismatched_confirmation(self):
        token = default_token_generator.make_token(self.user)
        confirm_url = reverse('password-reset-confirm')
        resp = self.client.post(confirm_url, {
            'email': 'customer@ethiotech.com',
            'token': token,
            'new_password': 'BrandNewSecurePassword456!',
            'new_password_confirm': 'CompletelyDifferentPassword999!'
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('new_password_confirm', resp.data)

    def test_confirm_password_reset_short_password(self):
        token = default_token_generator.make_token(self.user)
        confirm_url = reverse('password-reset-confirm')
        resp = self.client.post(confirm_url, {
            'email': 'customer@ethiotech.com',
            'token': token,
            'new_password': '123',
            'new_password_confirm': '123'
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('new_password', resp.data)
