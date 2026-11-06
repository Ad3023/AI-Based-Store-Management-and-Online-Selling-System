import re
from rest_framework import serializers

# Strict requirement: Email MUST have @gmail.com
GMAIL_REGEX = re.compile(
    r'^[a-zA-Z0-9_.+-]+@gmail\.com$',
    re.IGNORECASE
)

# Strict requirement: Phone number MUST be exactly 10 digits (e.g. 0911223344 or 0711223344)
TEN_DIGIT_PHONE_REGEX = re.compile(r'^\d{10}$')


def clean_phone_string(phone_str) -> str:
    """Strip spaces, dashes, brackets, pluses, and common delimiters from a phone string."""
    if not phone_str:
        return ''
    cleaned = re.sub(r'[\s\-\(\)\.]+', '', str(phone_str).strip())
    # If entered with +251 or 251 prefix followed by 9 digits (e.g. +251911223344), normalize to 10 digits 0911223344
    if cleaned.startswith('+251') and len(cleaned) == 13:
        cleaned = '0' + cleaned[4:]
    elif cleaned.startswith('251') and len(cleaned) == 12:
        cleaned = '0' + cleaned[3:]
    return cleaned


def is_valid_email(email_str) -> bool:
    """Return True if email_str is non-empty and has @gmail.com."""
    if not email_str or not isinstance(email_str, str):
        return False
    cleaned = email_str.strip().lower()
    if len(cleaned) > 254:
        return False
    return bool(GMAIL_REGEX.match(cleaned))


def is_valid_phone(phone_str) -> bool:
    """Return True if phone_str cleans to exactly 10 digits."""
    clean = clean_phone_string(phone_str)
    if not clean:
        return False
    return bool(TEN_DIGIT_PHONE_REGEX.match(clean))


def validate_email_address(value, required: bool = True) -> str:
    """
    Validate that email address is provided and has @gmail.com.
    Normalizes to lowercase.
    """
    if not value or not str(value).strip():
        if required:
            raise serializers.ValidationError("Email address is required.")
        return ''

    normalized = str(value).strip().lower()
    if len(normalized) > 254:
        raise serializers.ValidationError("Email address cannot exceed 254 characters.")

    if not GMAIL_REGEX.match(normalized):
        raise serializers.ValidationError(
            "Email must be a valid @gmail.com address (e.g., example@gmail.com)."
        )

    return normalized


def validate_business_email_address(value, required: bool = True) -> str:
    """
    Validate real business email address (allowing custom business domains and @gmail.com).
    Normalizes to lowercase and verifies basic RFC compliance.
    """
    if not value or not str(value).strip():
        if required:
            raise serializers.ValidationError("Business email address is required.")
        return ''

    normalized = str(value).strip().lower()
    if len(normalized) > 254:
        raise serializers.ValidationError("Email address cannot exceed 254 characters.")

    from django.core.validators import validate_email as django_validate_email
    from django.core.exceptions import ValidationError as DjangoValidationError
    try:
        django_validate_email(normalized)
    except DjangoValidationError:
        raise serializers.ValidationError("Please provide a valid business email address.")

    return normalized


def validate_phone_number_format(value, required: bool = True) -> str:
    """
    Validate that phone number is exactly 10 digits (e.g. 0911223344 or 0711223344).
    Accepts 10 digits directly or +2519xxxxxxxx format normalized to 10 digits.
    """
    if not value or not str(value).strip():
        if required:
            raise serializers.ValidationError("Phone number is required.")
        return ''

    clean = clean_phone_string(value)

    if not TEN_DIGIT_PHONE_REGEX.match(clean):
        raise serializers.ValidationError(
            "Phone number must be exactly 10 digits (e.g., 0911223344 or 0711223344)."
        )

    return clean
