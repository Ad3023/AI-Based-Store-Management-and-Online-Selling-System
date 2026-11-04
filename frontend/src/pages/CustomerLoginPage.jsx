import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { validateEmail } from '../utils/validation';

const CustomerLoginPage = () => {
  const [searchParams] = useSearchParams();
  const { login, loginWithGoogle } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isStaffError, setIsStaffError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsStaffError(false);

    if (!identifier.trim() || !password) {
      setError('Please provide your registered customer email address and password.');
      return;
    }

    const emailRes = validateEmail(identifier.trim(), true);
    if (!emailRes.isValid) {
      setError(emailRes.error);
      return;
    }

    try {
      setLoading(true);
      // Explicitly declare portal as 'customer'
      const user = await login(identifier.trim(), password, rememberMe, 'customer');

      // Auto add-to-cart if coming from guest click
      const action = searchParams.get('action');
      const productId = searchParams.get('productId');
      const quantity = parseInt(searchParams.get('quantity') || '1', 10);
      if (action === 'add_to_cart' && productId) {
        try {
          await addToCart(parseInt(productId, 10), quantity);
        } catch (cartErr) {
          console.error("Auto add to cart after login error", cartErr);
        }
      }

      // Safe redirect validation: prevent open redirect vulnerabilities
      const rawTarget = searchParams.get('redirect') || '';
      const safeTarget = rawTarget.startsWith('/') && !rawTarget.startsWith('//') ? rawTarget : '';

      if (safeTarget && safeTarget !== '/' && safeTarget !== '/login' && !safeTarget.startsWith('/staff')) {
        navigate(safeTarget);
      } else {
        navigate('/customer/dashboard');
      }
    } catch (err) {
      const respData = err.response?.data;
      if (respData) {
        if (respData.portal_access_denied && respData.is_staff) {
          setIsStaffError(true);
          setError(respData.error || 'This login portal is reserved for customers only. Staff members (Administrator, Store Manager, Order Manager) must sign in via the Staff Login portal.');
        } else if (respData.unverified) {
          setError('Your email has not been verified yet. Please check your inbox or click below to enter your verification code.');
        } else {
          const msg =
            respData.non_field_errors?.[0] ||
            respData.detail ||
            respData.error ||
            (typeof respData === 'string' ? respData : 'Invalid email or password. Please verify your customer credentials.');
          setError(msg);
        }
      } else if (err.request) {
        setError('Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'An unexpected error occurred during customer sign in.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleToken = async (idToken) => {
    try {
      setLoading(true);
      setError('');
      setIsStaffError(false);
      const user = await loginWithGoogle(idToken);

      // Auto add-to-cart if coming from guest click
      const action = searchParams.get('action');
      const productId = searchParams.get('productId');
      const quantity = parseInt(searchParams.get('quantity') || '1', 10);
      if (action === 'add_to_cart' && productId) {
        try {
          await addToCart(parseInt(productId, 10), quantity);
        } catch (cartErr) {
          console.error('Auto add to cart after login error', cartErr);
        }
      }

      const rawTarget = searchParams.get('redirect') || '';
      const safeTarget = rawTarget.startsWith('/') && !rawTarget.startsWith('//') ? rawTarget : '';

      if (safeTarget && safeTarget !== '/' && safeTarget !== '/login' && !safeTarget.startsWith('/staff')) {
        navigate(safeTarget);
      } else {
        navigate('/customer/dashboard');
      }
    } catch (err) {
      const respData = err.response?.data;
      if (respData?.is_staff) {
        setIsStaffError(true);
      }
      const msg = respData?.error || respData?.detail || 'Google sign-in failed. Please verify your credentials or try email sign in.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f4f6fa', minHeight: 'calc(100vh - 120px)' }} className="d-flex align-items-center py-4 py-md-5">
      <div className="container" style={{ maxWidth: '960px' }}>

        {/* Top Breadcrumb and Portal Switch */}
        <div className="d-flex justify-content-between align-items-center mb-3 px-1 text-xs">
          <div className="d-flex align-items-center gap-2 text-slate-500">
            <Link to="/" className="text-decoration-none text-slate-600 hover-text-blue d-flex align-items-center gap-1">
              <i className="bi bi-house-door"></i> Home
            </Link>
            <span className="text-slate-400">/</span>
            <span className="fw-semibold text-slate-800">Customer Sign In</span>
          </div>

          <div className="d-flex align-items-center gap-3">
            <Link
              to="/supplier/login"
              className="text-decoration-none text-slate-600 hover-text-blue d-inline-flex align-items-center gap-1 fw-semibold"
              title="External Supplier & Vendor Portal"
            >
              <i className="bi bi-truck text-teal-600"></i> Supplier Portal &rarr;
            </Link>
            <span className="text-slate-300">|</span>
            <Link
              to="/staff/login"
              className="text-decoration-none text-slate-600 hover-text-blue d-inline-flex align-items-center gap-1 fw-semibold"
              title="Staff Portal (Admin, Store Manager, Order Manager)"
            >
              <i className="bi bi-shield-lock text-primary"></i> Staff Portal &rarr;
            </Link>
          </div>
        </div>

        {/* Main Card */}
        <div className="card ethio-card border-0 shadow-lg overflow-hidden bg-white" style={{ borderRadius: '1.25rem' }}>
          <div className="row g-0">
            
            {/* Left Panel - Branding & Customer Benefits */}
            <div
              className="col-lg-5 p-4 p-md-5 d-flex flex-column justify-content-between text-white position-relative overflow-hidden"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(11, 26, 45, 0.78) 0%, rgba(12, 35, 64, 0.94) 100%), url('/customer_login_shopping.jpg')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                minHeight: '500px',
              }}
            >
              <div className="position-relative z-1">
                {/* Brand Header */}
                <div className="d-flex align-items-center gap-2 mb-4">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-white shadow"
                    style={{ width: '40px', height: '40px', backgroundColor: '#10b981' }}
                  >
                    <i className="bi bi-cpu-fill fs-5"></i>
                  </div>
                  <div>
                    <h5 className="fw-bolder mb-0 text-white tracking-tight lh-1">
                      EthioTech <span style={{ color: '#34d399' }}>Market</span>
                    </h5>
                    <small className="text-slate-300 text-[11px]">
                      Better Tech. Brighter Future.
                    </small>
                  </div>
                </div>

                <h3 className="fw-bolder mb-2 text-white" style={{ lineHeight: '1.3' }}>
                  Modern Technology &amp; Electronics
                </h3>
                <p className="text-slate-200 text-xs mb-4" style={{ lineHeight: '1.6' }}>
                  Sign in to track deliveries, manage your wishlist, and view verified digital receipts.
                </p>

                {/* 3 Core Value Props */}
                <div className="d-flex flex-column gap-2.5">
                  <div className="d-flex align-items-start gap-3 p-2.5 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(6px)' }}>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: '30px', height: '30px', backgroundColor: 'rgba(16, 185, 129, 0.35)', color: '#34d399' }}
                    >
                      <i className="bi bi-truck text-xs fw-bold"></i>
                    </div>
                    <div>
                      <div className="fw-bold text-xs text-white">Fast Delivery</div>
                      <small className="text-slate-200 text-[11px]">Express delivery in Addis Ababa and reliable delivery nationwide.</small>
                    </div>
                  </div>

                  <div className="d-flex align-items-start gap-3 p-2.5 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(6px)' }}>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: '30px', height: '30px', backgroundColor: 'rgba(245, 158, 11, 0.35)', color: '#fcd34d' }}
                    >
                      <i className="bi bi-patch-check text-xs fw-bold"></i>
                    </div>
                    <div>
                      <div className="fw-bold text-xs text-white">Customer Support</div>
                      <small className="text-slate-200 text-[11px]">Dedicated assistance for orders, returns, and official warranties.</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Badge */}
              <div className="pt-3 border-top border-white border-opacity-15 text-slate-300 text-[11px] d-flex align-items-center gap-1.5 position-relative z-1">
                <i className="bi bi-shield-lock-fill text-emerald-400"></i>
                <span>SSL 256-bit encrypted authentication</span>
              </div>
            </div>

            {/* Right Panel - Sign In Form */}
            <div className="col-lg-7 p-4 p-md-5 bg-white d-flex flex-column justify-content-center">
              <div style={{ maxWidth: '420px', margin: '0 auto', width: '100%' }}>
                
                <h3 className="fw-bolder text-slate-900 mb-1" style={{ letterSpacing: '-0.02em' }}>
                  Sign In
                </h3>
                <p className="text-muted text-xs mb-4">
                  Welcome back! Please enter your details to access your account.
                </p>

                {/* Error Alert */}
                {error && (
                  <div className="alert alert-danger rounded-3 text-xs mb-3 d-flex flex-column gap-2 border-danger border-opacity-25" role="alert">
                    <div className="d-flex align-items-start gap-2">
                      <i className="bi bi-exclamation-triangle-fill text-danger fs-6 shrink-0 mt-0.5"></i>
                      <div>{error}</div>
                    </div>
                    {isStaffError && (
                      <div className="pt-2">
                        <Link
                          to="/staff/login"
                          className="btn btn-sm btn-primary rounded-pill px-3 py-1 font-bold text-xs d-inline-flex align-items-center gap-1.5 shadow-sm"
                        >
                          <i className="bi bi-shield-lock-fill"></i> Go to Staff Login Portal &rarr;
                        </Link>
                      </div>
                    )}
                    {error.toLowerCase().includes('verified') && (
                      <div className="pt-1">
                        <Link
                          to={`/verify-email?email=${encodeURIComponent(identifier.trim())}`}
                          className="btn btn-sm btn-outline-danger rounded-pill px-3 py-1 font-bold text-xs"
                        >
                          Verify Account Email Now &rarr;
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleLogin}>
                  {/* Email Input */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1" htmlFor="customerEmailInput">
                      Email address
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-envelope"></i>
                      </span>
                      <input
                        id="customerEmailInput"
                        type="email"
                        className="form-control form-control-lg text-sm bg-slate-50 border-start-0 ps-0"
                        placeholder="you@example.com"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label text-xs fw-semibold text-slate-700 mb-0" htmlFor="customerPasswordInput">
                        Password
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-primary fw-semibold text-decoration-none hover-underline"
                      >
                        Forgot Password?
                      </Link>
                    </div>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-lock"></i>
                      </span>
                      <input
                        id="customerPasswordInput"
                        type={showPassword ? 'text' : 'password'}
                        className="form-control form-control-lg text-sm bg-slate-50 border-start-0 border-end-0 ps-0"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                      <button
                        className="input-group-text bg-slate-50 border-start-0 text-muted"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="mb-4 d-flex align-items-center">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="customerRememberMeCheckbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <label className="form-check-label text-xs text-slate-600" htmlFor="customerRememberMeCheckbox">
                        Remember Me
                      </label>
                    </div>
                  </div>

                  {/* Sign In Button */}
                  <button
                    id="customerSubmitBtn"
                    type="submit"
                    disabled={loading}
                    className="btn w-100 py-2.5 fw-bold text-sm shadow-sm mb-3 text-white transition"
                    style={{ backgroundColor: '#10b981', borderColor: '#10b981', borderRadius: '0.5rem' }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Signing In...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-box-arrow-in-right me-1.5"></i> Sign In
                      </>
                    )}
                  </button>

                  {/* Google OAuth Option */}
                  <div className="d-flex align-items-center my-2.5">
                    <hr className="flex-grow-1 border-slate-200 my-0" />
                    <span className="px-2.5 text-slate-400 text-[11px] text-uppercase font-semibold">or continue with</span>
                    <hr className="flex-grow-1 border-slate-200 my-0" />
                  </div>

                  <GoogleSignInButton
                    text="continue_with"
                    buttonId="customer-google-signin-btn"
                    onSuccess={handleGoogleToken}
                    onError={(err) => {
                      const msg = typeof err === 'string' ? err : err?.message || 'Google sign-in was not completed.';
                      setError(msg);
                    }}
                    disabled={loading}
                  />
                </form>

                {/* Footer Link: Register Here */}
                <div className="text-center mt-3 pt-1">
                  <span className="text-muted text-xs me-1">Don't have an account?</span>
                  <Link to="/register" className="text-success fw-bold text-xs text-decoration-none hover-underline">
                    Create an account &rarr;
                  </Link>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default CustomerLoginPage;
