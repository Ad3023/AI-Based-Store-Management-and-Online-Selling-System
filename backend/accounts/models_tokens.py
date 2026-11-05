import hashlib
import hmac
import secrets
from django.db import models
from django.conf import settings
from django.utils import timezone


class EmailVerificationToken(models.Model):
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='verification_tokens')
    token = models.CharField(max_length=100, unique=True, db_index=True)
    otp_code = models.CharField(max_length=6, db_index=True, blank=True, default='')
    otp_hash = models.CharField(max_length=128, db_index=True, blank=True, default='')
    purpose = models.CharField(max_length=50, default='email_verification')
    failed_attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    verified_at = models.DateTimeField(null=True, blank=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        app_label = 'accounts'
        ordering = ['-created_at']

    @staticmethod
    def hash_otp(user_id, otp):
        secret = getattr(settings, 'SECRET_KEY', 'ethiotech-secret-fallback')
        salt = f"{user_id}:{secret}:ethiotech_email_otp"
        return hashlib.sha256(f"{salt}:{str(otp).strip()}".encode('utf-8')).hexdigest()

    def set_otp(self, raw_otp):
        self.otp_hash = self.hash_otp(self.user_id, raw_otp)
        self.otp_code = ''

    def verify_otp(self, input_otp):
        if not input_otp:
            return False
        clean_otp = str(input_otp).strip()
        if len(clean_otp) != 6:
            return False
        expected_hash = self.hash_otp(self.user_id, clean_otp)
        if self.otp_hash:
            return hmac.compare_digest(self.otp_hash, expected_hash)
        elif self.otp_code:
            return hmac.compare_digest(self.otp_code, clean_otp)
        return False

    def is_valid(self):
        return not self.is_used and self.failed_attempts < 5 and timezone.now() <= self.expires_at

    def __str__(self):
        return f"Verification for {self.user.email} (Used: {self.is_used}, Attempts: {self.failed_attempts})"


class PasswordResetToken(models.Model):
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.CharField(max_length=120, unique=True, db_index=True)
    otp_code = models.CharField(max_length=6, db_index=True, blank=True, default='')
    otp_hash = models.CharField(max_length=128, db_index=True, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        app_label = 'accounts'
        ordering = ['-created_at']

    @staticmethod
    def hash_otp(user_id, otp):
        secret = getattr(settings, 'SECRET_KEY', 'ethiotech-secret-fallback')
        salt = f"{user_id}:{secret}:ethiotech_password_reset_otp"
        return hashlib.sha256(f"{salt}:{str(otp).strip()}".encode('utf-8')).hexdigest()

    def set_otp(self, raw_otp):
        self.otp_hash = self.hash_otp(self.user_id, raw_otp)
        self.otp_code = ''

    def verify_otp(self, input_otp):
        if not input_otp:
            return False
        clean_otp = str(input_otp).strip()
        if len(clean_otp) != 6:
            return False
        expected_hash = self.hash_otp(self.user_id, clean_otp)
        if self.otp_hash:
            return hmac.compare_digest(self.otp_hash, expected_hash)
        elif self.otp_code:
            return hmac.compare_digest(self.otp_code, clean_otp)
        return False

    def is_valid(self):
        return not self.is_used and timezone.now() <= self.expires_at

    def __str__(self):
        return f"ResetToken for {self.user.email} (Used: {self.is_used})"

