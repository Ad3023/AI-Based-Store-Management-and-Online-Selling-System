import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  getGoogleClientId,
  isGoogleClientConfigured,
  loadGoogleIdentityServices,
  initGoogleIdentityServices,
  subscribeGoogleAuth,
  triggerGooglePrompt,
} from '../utils/googleAuth';

/**
 * GoogleSignInButton Component
 *
 * Renders the official Google Identity Services button using a dedicated,
 * unmanaged DOM container ref. This prevents React reconciliation errors
 * (specifically `NotFoundError: Failed to execute 'removeChild' on 'Node'`).
 *
 * Guarantees:
 * 1. Single controlled initialization of Google Identity Services.
 * 2. Dedicated ref container that React never mounts children into.
 * 3. Safe unmount cleanup on component unmount or StrictMode remounts.
 * 4. Graceful fallback button for unconfigured environments or script blockage.
 *
 * @param {Object} props
 * @param {'continue_with' | 'signin_with' | 'signup_with'} [props.text='continue_with']
 * @param {'outline' | 'filled_blue' | 'filled_black'} [props.theme='outline']
 * @param {'large' | 'medium' | 'small'} [props.size='large']
 * @param {number} [props.width=320]
 * @param {(credential: string) => void} props.onSuccess - Callback receiving Google ID token
 * @param {(error: Error | string) => void} [props.onError] - Error callback
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.buttonId]
 * @param {string} [props.className='']
 */
const GoogleSignInButton = ({
  text = 'continue_with',
  theme = 'outline',
  size = 'large',
  width = 320,
  onSuccess,
  onError,
  disabled = false,
  buttonId,
  className = '',
}) => {
  const googleContainerRef = useRef(null);
  const [isGisReady, setIsGisReady] = useState(false);

  const clientId = getGoogleClientId();
  const isConfigured = isGoogleClientConfigured(clientId);

  const handleAuthSuccess = useCallback(
    (credential) => {
      if (onSuccess) {
        onSuccess(credential);
      }
    },
    [onSuccess]
  );

  const handleAuthError = useCallback(
    (err) => {
      if (onError) {
        onError(err);
      }
    },
    [onError]
  );

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    let isMounted = true;

    // Subscribe callbacks to the centralized GIS dispatcher
    const unsubscribe = subscribeGoogleAuth({
      onSuccess: (credential) => {
        if (isMounted) {
          handleAuthSuccess(credential);
        }
      },
      onError: (err) => {
        if (isMounted) {
          handleAuthError(err);
        }
      },
    });

    // Ensure GIS script is loaded, then initialize and render button
    loadGoogleIdentityServices()
      .then(() => {
        if (!isMounted || !googleContainerRef.current) return;

        // Initialize GIS in one controlled place
        const initialized = initGoogleIdentityServices(clientId);
        if (!initialized) return;

        // Dedicated container: clean previous non-React children safely
        const container = googleContainerRef.current;
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }

        // Render GIS button directly into the dedicated ref
        window.google.accounts.id.renderButton(container, {
          type: 'standard',
          theme,
          size,
          text,
          shape: 'rectangular',
          logo_alignment: 'left',
          width,
        });

        if (isMounted) {
          setIsGisReady(true);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setIsGisReady(false);
          console.warn('[Google OAuth] Could not load Google Identity Services:', err.message);
        }
      });

    const currentContainer = googleContainerRef.current;
    return () => {
      isMounted = false;
      unsubscribe();

      // Safely empty dedicated container on unmount.
      // Because React has no virtual DOM children inside container,
      // this never triggers removeChild errors.
      if (currentContainer) {
        while (currentContainer.firstChild) {
          currentContainer.removeChild(currentContainer.firstChild);
        }
      }
    };
  }, [clientId, isConfigured, text, theme, size, width, handleAuthSuccess, handleAuthError]);

  const handleFallbackClick = () => {
    if (!isConfigured) {
      if (import.meta.env.DEV) {
        console.warn(
          '[Google OAuth] Google Sign-In is unavailable: VITE_GOOGLE_CLIENT_ID is missing or invalid in frontend/.env. ' +
          'Please refer to documentation/GOOGLE_OAUTH_SETUP.md for developer configuration instructions.'
        );
        handleAuthError(
          'Developer Notice: Google OAuth is not configured. Set a valid VITE_GOOGLE_CLIENT_ID in frontend/.env to activate Google Sign-In.'
        );
      } else {
        handleAuthError(
          text === 'signup_with'
            ? 'Google Sign-In is temporarily unavailable. Please register with your email and password.'
            : 'Google Sign-In is temporarily unavailable. Please sign in with your email and password.'
        );
      }
      return;
    }

    if (window.google?.accounts?.id) {
      triggerGooglePrompt({
        onNotification: (notification) => {
          if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
            handleAuthError(
              'Google Sign-In popup is unavailable. Please check that third-party popups are allowed or use email authentication.'
            );
          }
        },
        onError: () => {
          handleAuthError('Could not connect to Google Identity Services. Please try again or use email.');
        },
      });
    } else {
      handleAuthError(
        'Google Sign-In is loading or blocked by your browser. Please refresh the page or use email authentication.'
      );
    }
  };

  const buttonLabel = text === 'signup_with' ? 'Sign up with Google' : 'Continue with Google';

  return (
    <div
      className={`d-flex justify-content-center w-100 ${className}`}
      style={{ minHeight: '44px' }}
    >
      {/* Dedicated DOM node owned exclusively by Google GIS - React NEVER renders children here */}
      <div
        ref={googleContainerRef}
        id={buttonId}
        data-client-id={isConfigured ? clientId : undefined}
        style={{
          display: isGisReady && isConfigured ? 'flex' : 'none',
          justifyContent: 'center',
          width: '100%',
          maxWidth: `${width}px`,
        }}
      />

      {/* Fallback button owned and managed strictly by React */}
      {(!isGisReady || !isConfigured) && (
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={disabled}
          className="btn btn-outline-secondary w-100 py-2.5 text-xs font-semibold rounded-2 d-flex align-items-center justify-content-center gap-2 border-slate-300 shadow-2xs hover:bg-slate-50 transition-colors"
          style={{ maxWidth: `${width}px` }}
          aria-label={buttonLabel}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>{buttonLabel}</span>
        </button>
      )}
    </div>
  );
};

export default GoogleSignInButton;
