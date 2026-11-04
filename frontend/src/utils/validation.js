/**
 * EthioTech Market - Centralized Validation Utilities
 * Strict validation:
 * 1. Email MUST have @gmail.com
 * 2. Phone number MUST be exactly 10 digits
 */

// Must end with @gmail.com
export const GMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@gmail\.com$/i;

// Exactly 10 digits
export const TEN_DIGIT_PHONE_REGEX = /^\d{10}$/;

/**
 * Remove whitespace, dashes, parentheses, plus signs, and dots from phone string.
 * If entered as +2519... or 2519... (12/13 chars), normalizes to 10 digits (09...).
 */
export const cleanPhoneString = (phone) => {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[\s\-().]+/g, '').trim();
  if (cleaned.startsWith('+251') && cleaned.length === 13) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('251') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(3);
  }
  return cleaned;
};

/**
 * Quick boolean check if string is non-empty and has @gmail.com.
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const cleaned = email.trim().toLowerCase();
  if (cleaned.length > 254) return false;
  return GMAIL_REGEX.test(cleaned);
};

/**
 * Quick boolean check if string cleans to exactly 10 digits.
 */
export const isValidPhone = (phone) => {
  const clean = cleanPhoneString(phone);
  if (!clean) return false;
  return TEN_DIGIT_PHONE_REGEX.test(clean);
};

/**
 * Validates an email address requiring @gmail.com.
 * @param {string} email
 * @param {boolean} required
 * @returns {{ isValid: boolean, error: string, value: string }}
 */
export const validateEmail = (email, required = true) => {
  const value = (email || '').trim().toLowerCase();

  if (!value) {
    if (required) {
      return { isValid: false, error: 'Email address is required.', value: '' };
    }
    return { isValid: true, error: '', value: '' };
  }

  if (value.length > 254) {
    return { isValid: false, error: 'Email address cannot exceed 254 characters.', value };
  }

  if (!GMAIL_REGEX.test(value)) {
    return {
      isValid: false,
      error: 'Email must be a valid @gmail.com address (e.g. example@gmail.com).',
      value,
    };
  }

  return { isValid: true, error: '', value };
};

/**
 * Validates a phone number requiring exactly 10 digits.
 * @param {string} phone
 * @param {boolean} required
 * @returns {{ isValid: boolean, error: string, value: string, formatted: string }}
 */
export const validatePhone = (phone, required = true) => {
  const raw = (phone || '').trim();
  const clean = cleanPhoneString(raw);

  if (!clean) {
    if (required) {
      return {
        isValid: false,
        error: 'Phone number is required.',
        value: '',
        formatted: '',
      };
    }
    return { isValid: true, error: '', value: '', formatted: '' };
  }

  if (!TEN_DIGIT_PHONE_REGEX.test(clean)) {
    return {
      isValid: false,
      error: 'Phone number must be exactly 10 digits (e.g., 0911223344 or 0711223344).',
      value: clean,
      formatted: '',
    };
  }

  return { isValid: true, error: '', value: clean, formatted: clean };
};

/**
 * Format 10-digit phone for human readability in UI (e.g. 0911 22 33 44).
 */
export const formatPhoneDisplay = (phone) => {
  if (!phone) return '';
  const clean = cleanPhoneString(phone);
  if (clean.length === 10) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 6)} ${clean.slice(6, 8)} ${clean.slice(8)}`;
  }
  return phone;
};
