/**
 * Google Identity Services (GIS) Authentication Utility
 *
 * Provides single-point initialization, safe script loading, subscriber routing,
 * and button rendering for Google Identity Services (GIS) ID-token flow.
 *
 * Prevents:
 * 1. Multiple initialization warnings ([GSI_LOGGER]: google.accounts.id.initialize() is called multiple times)
 * 2. React DOM reconciliation conflicts (NotFoundError: Failed to execute 'removeChild' on 'Node')
 * 3. Race conditions between GIS script loading and component mounting
 */

// Track global GIS initialization state to prevent duplicate initialization
let isGisInitialized = false;
let currentInitializedClientId = null;
let scriptLoadingPromise = null;

// Active subscribers listening for Google credential callbacks
const authSubscribers = new Set();

/**
 * Retrieves and sanitizes the Google OAuth Client ID from Vite environment variables.
 * Strips accidental wrapping quotes (single or double) and whitespace.
 *
 * @returns {string} Sanitized Google Client ID or empty string if not configured
 */
export const getGoogleClientId = () => {
  const rawId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!rawId || typeof rawId !== 'string') {
    return '';
  }
  return rawId.trim().replace(/^["']|["']$/g, '').trim();
};

/**
 * Validates whether the provided Google OAuth Client ID is properly configured.
 * Returns true only when a non-empty, authentic Google OAuth Web Client ID is provided.
 *
 * @param {string | undefined | null} clientId
 * @returns {boolean}
 */
export const isGoogleClientConfigured = (clientId) => {
  if (!clientId || typeof clientId !== 'string') {
    return false;
  }

  const cleaned = clientId.trim().replace(/^["']|["']$/g, '').trim();
  if (!cleaned) {
    return false;
  }

  const lower = cleaned.toLowerCase();
  if (
    lower.includes('your_google') ||
    lower.includes('your-google') ||
    lower.includes('placeholder') ||
    lower.includes('change_me') ||
    lower === 'undefined' ||
    lower === 'null' ||
    lower === 'false'
  ) {
    return false;
  }

  // Authentic Google OAuth 2.0 Web Client IDs end with .apps.googleusercontent.com or contain .googleusercontent.com
  return lower.endsWith('.apps.googleusercontent.com') || lower.includes('.googleusercontent.com');
};

/**
 * Subscribes a listener to receive Google authentication responses.
 * Returns an unsubscribe cleanup function.
 *
 * @param {Object} listener
 * @param {(credential: string) => void} listener.onSuccess
 * @param {(error: Error) => void} [listener.onError]
 * @returns {() => void} Unsubscribe function
 */
export const subscribeGoogleAuth = (listener) => {
  if (!listener) return () => {};
  authSubscribers.add(listener);
  return () => {
    authSubscribers.delete(listener);
  };
};

/**
 * Internal dispatch handler registered once with google.accounts.id.initialize.
 * Broadcasts the returned ID token credential to all registered active subscribers.
 *
 * @param {Object} response - GIS credential response
 */
const handleCredentialResponse = (response) => {
  if (response && response.credential) {
    authSubscribers.forEach((subscriber) => {
      try {
        subscriber.onSuccess?.(response.credential);
      } catch (err) {
        console.error('[Google OAuth] Error in subscriber onSuccess:', err);
      }
    });
  } else {
    const error = new Error('Google Sign-In did not return a valid credential.');
    authSubscribers.forEach((subscriber) => {
      try {
        subscriber.onError?.(error);
      } catch (err) {
        console.error('[Google OAuth] Error in subscriber onError:', err);
      }
    });
  }
};

/**
 * Safely loads the Google Identity Services client script (https://accounts.google.com/gsi/client)
 * if it is not already available.
 *
 * @returns {Promise<any>} Resolves with window.google.accounts.id when ready
 */
export const loadGoogleIdentityServices = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window object is not available.'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
    let scriptElement = document.querySelector(`script[src="${SCRIPT_URL}"]`);

    const checkGis = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google.accounts.id);
        return true;
      }
      return false;
    };

    if (checkGis()) return;

    if (!scriptElement) {
      scriptElement = document.createElement('script');
      scriptElement.src = SCRIPT_URL;
      scriptElement.async = true;
      scriptElement.defer = true;
      document.head.appendChild(scriptElement);
    }

    const handleLoad = () => {
      let checkAttempts = 0;
      const interval = setInterval(() => {
        checkAttempts += 1;
        if (checkGis()) {
          clearInterval(interval);
        } else if (checkAttempts >= 40) {
          clearInterval(interval);
          scriptLoadingPromise = null;
          reject(new Error('Google Identity Services script loaded but window.google.accounts.id is unavailable.'));
        }
      }, 50);
    };

    const handleError = () => {
      scriptLoadingPromise = null;
      reject(new Error('Failed to load Google Identity Services script. Please check your network or ad blocker.'));
    };

    scriptElement.addEventListener('load', handleLoad, { once: true });
    scriptElement.addEventListener('error', handleError, { once: true });

    // Fallback timeout
    setTimeout(() => {
      if (!checkGis()) {
        scriptLoadingPromise = null;
        reject(new Error('Timed out waiting for Google Identity Services to initialize.'));
      }
    }, 10000);
  });

  return scriptLoadingPromise;
};

/**
 * Initializes Google Identity Services in ONE controlled place.
 * Idempotent: Avoids duplicate calls to window.google.accounts.id.initialize
 * across LoginPage, RegisterPage, StrictMode remounts, or component re-renders.
 *
 * @param {string} clientId - Google OAuth Client ID
 * @returns {boolean} Whether GIS was successfully initialized
 */
export const initGoogleIdentityServices = (clientId) => {
  if (!clientId || !isGoogleClientConfigured(clientId)) {
    return false;
  }

  if (!window.google?.accounts?.id) {
    return false;
  }

  // Already initialized with this client ID: DO NOT call initialize() again
  if (isGisInitialized && currentInitializedClientId === clientId) {
    return true;
  }

  try {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    isGisInitialized = true;
    currentInitializedClientId = clientId;
    return true;
  } catch (err) {
    console.error('[Google OAuth] Error during google.accounts.id.initialize:', err);
    return false;
  }
};

/**
 * Safely renders the Google Sign-In button into a dedicated DOM container element.
 * The caller must ensure that the container element has NO React-managed children
 * so that React reconciler and Google's DOM do not collide.
 *
 * @param {Object} options
 * @param {HTMLElement} options.element - Dedicated container element
 * @param {string} options.clientId - Google OAuth Web Client ID
 * @param {(idToken: string) => void} [options.onSuccess] - Callback receiving Google ID token
 * @param {(err: Error | string) => void} [options.onError] - Error callback
 * @param {'continue_with' | 'signin_with' | 'signup_with'} [options.text='continue_with']
 * @param {'outline' | 'filled_blue' | 'filled_black'} [options.theme='outline']
 * @param {'large' | 'medium' | 'small'} [options.size='large']
 * @param {number} [options.width=320]
 * @returns {(() => void) | false} Cleanup function or false if rendering could not proceed
 */
export const renderGoogleSignInButton = ({
  element,
  clientId,
  onSuccess,
  onError,
  text = 'continue_with',
  theme = 'outline',
  size = 'large',
  width = 320,
}) => {
  if (!element || !clientId || !isGoogleClientConfigured(clientId)) {
    return false;
  }

  if (!window.google?.accounts?.id) {
    return false;
  }

  // Controlled single initialization
  const initialized = initGoogleIdentityServices(clientId);
  if (!initialized) {
    return false;
  }

  let unsubscribe = null;
  if (onSuccess || onError) {
    unsubscribe = subscribeGoogleAuth({
      onSuccess,
      onError,
    });
  }

  try {
    // Only clear existing non-React children inside this dedicated container
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }

    window.google.accounts.id.renderButton(element, {
      type: 'standard',
      theme,
      size,
      text,
      shape: 'rectangular',
      logo_alignment: 'left',
      width,
    });

    return () => {
      if (unsubscribe) unsubscribe();
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    };
  } catch (err) {
    console.warn('[Google OAuth] GIS renderButton error:', err);
    if (unsubscribe) unsubscribe();
    if (onError) onError(err);
    return false;
  }
};

/**
 * Triggers the Google One Tap / prompt flow in a controlled manner.
 *
 * @param {Object} [options]
 * @param {(notification: any) => void} [options.onNotification]
 * @param {(error: Error) => void} [options.onError]
 */
export const triggerGooglePrompt = ({ onNotification, onError } = {}) => {
  if (!window.google?.accounts?.id) {
    if (onError) onError(new Error('Google Identity Services is not loaded.'));
    return;
  }

  try {
    window.google.accounts.id.prompt((notification) => {
      if (onNotification) onNotification(notification);
    });
  } catch (err) {
    if (onError) onError(err);
  }
};
