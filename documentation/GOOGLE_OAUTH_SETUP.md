# Google OAuth 2.0 & OpenID Connect Setup Guide

This document outlines the architecture, configuration, and security specifications for Google OAuth authentication in the Ethio Tech Market application.

---

## 1. Authentication Architecture

Ethio Tech Market utilizes Google Identity Services (GIS) and OpenID Connect (OIDC) for social authentication:

```
+------------------+         1. Popup / OIDC Token Request        +-----------------------+
|  React Frontend  | -------------------------------------------> |  Google Auth Servers  |
| (localhost:5173) | <------------------------------------------- |                       |
+------------------+          2. OpenID Connect ID Token (JWT)    +-----------------------+
        |
        | 3. POST /api/auth/google/ { credential: "<id_token_jwt>" }
        v
+------------------+         4. Validate Token Signature & "aud"   +-----------------------+
|  Django Backend  | -------------------------------------------> | Google Tokeninfo API  |
| (localhost:8000) | <------------------------------------------- |                       |
+------------------+          5. Token Payload (email, name, etc.)+-----------------------+
        |
        | 6. Safe User Lookup / Creation (Role: Strictly 'customer')
        | 7. Generate DRF Auth Token
        v
+------------------+
|  Return Session  | ===> Customer Dashboard Redirect
+------------------+
```

---

## 2. Google Cloud Console Configuration

Follow these steps to create your OAuth 2.0 credentials:

### Step 1: Create a Project
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown and click **New Project**.
3. Name your project (e.g., `EthioTechMarket`) and click **Create**.

### Step 2: Configure the OAuth Consent Screen
1. Go to **APIs & Services** &gt; **OAuth consent screen**.
2. Select User Type:
   - **Internal** (for Google Workspace organizations), or
   - **External** (for general public / testing).
3. Fill in the App Information:
   - App name: `Ethio Tech Market`
   - User support email: your email address
   - Developer contact email: your email address
4. Scopes:
   - Ensure `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `openid` are selected.
5. In **Test users** (if in External "Testing" status), add the Google email addresses allowed to sign in during testing.

### Step 3: Create Web OAuth 2.0 Credentials
1. Go to **APIs & Services** &gt; **Credentials**.
2. Click **Create Credentials** &rarr; **OAuth client ID**.
3. Set **Application type** to **Web application**.
4. Set **Name** to `Ethio Tech Market Web Client`.
5. **Authorized JavaScript origins**:
   ```
   http://localhost:5173
   http://127.0.0.1:5173
   https://your-production-domain.com
   ```
6. **Authorized redirect URIs**:
   > **Note on Popup vs Redirect**: When using modern Google Identity Services (GIS) popup authentication, redirect URIs are not required by Google. However, for redirect-based fallbacks, specify:
   ```
   http://localhost:5173/login
   https://your-production-domain.com/login
   ```
7. Click **Create**. Copy your **Client ID** (format: `xxxxxxxxxxxx-xxxxxxxx.apps.googleusercontent.com`).

---

## 3. Environment Variables Configuration

### Frontend (`frontend/.env`)
Add your Google Client ID to the frontend environment:
```env
# API Base Endpoint
VITE_API_BASE_URL=http://127.0.0.1:8000/api/
VITE_BACKEND_URL=http://127.0.0.1:8000

# Google OAuth 2.0 Web Client ID
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### Backend (`backend/.env`)
Add the same Client ID to the Django backend configuration:
```env
# Google OAuth 2.0 Client Validation
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

> **Security Reminder**: Never commit `.env` files with active API secrets to version control. Both `frontend/.env` and `backend/.env` are included in `.gitignore`.

---

## 4. Security & Role Safeguards

The backend endpoint `/api/auth/google/` enforces strict multi-layered security checks:

1. **Strict Audience Verification (`aud`)**:
   Every token's `aud` (audience) claim must strictly match the backend's configured `GOOGLE_OAUTH_CLIENT_ID`. Tokens issued for other apps or services are rejected with HTTP 400.
2. **Verified Email Requirement (`email_verified`)**:
   Only Google accounts with verified email addresses are accepted.
3. **Strict Customer Role Assignment**:
   Newly registered users authenticating via Google are assigned the default `customer` role (`is_staff=False`, `is_superuser=False`). Administrative and Store Manager privileges are never granted automatically.
4. **Existing Account Safety (No Overwrites)**:
   If an existing user signs in via Google with a matching email, their existing role and credentials remain unchanged. Their password is not reset or altered.
5. **No Secret Leakage**:
   When OAuth configuration is missing, the server returns a clean HTTP 503 response without leaking database connection strings, secret keys, or stack traces.

---

## 5. Local Development Without Google Credentials

If you are developing locally or testing without configured Google credentials:
- The storefront button displays a professional Google button.
- If clicked without `VITE_GOOGLE_CLIENT_ID`, a developer warning is logged in the browser console, and a user-friendly error message directs the user to standard email/password authentication.
- Standard email/password authentication remains fully operational.
