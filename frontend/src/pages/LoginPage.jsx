import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import GoogleSignInButton from '../components/GoogleSignInButton';

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const { login, loginWithGoogle } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Please provide your registered email address and password.');
      return;
    }

    try {
      setLoading(true);
      const user = await login(identifier.trim(), password, rememberMe);

      // Handle pending add_to_cart action if coming from guest click
      const action = searchParams.get('action');
      const productId = searchParams.get('productId');
      const quantity = parseInt(searchParams.get('quantity') || '1', 10);
      if (user.role === 'customer' && action === 'add_to_cart' && productId) {
        try {
          await addToCart(parseInt(productId, 10), quantity);
        } catch (cartErr) {
          console.error("Auto add to cart after login error", cartErr);
        }
      }

      // Safe redirect validation: prevent open redirect vulnerabilities
      const rawTarget = searchParams.get('redirect') || '';
      const safeTarget = rawTarget.startsWith('/') && !rawTarget.startsWith('//') ? rawTarget : '';

      // Route authorized users strictly to their designated role dashboard
      if (user.role === 'order_manager') {
        navigate('/order-manager/dashboard');
      } else if (user.role === 'store_manager') {
        navigate('/manager/dashboard');
      } else if (user.role === 'admin' || user.is_superuser) {
        navigate('/admin/dashboard');
      } else {
        // Customer
        if (safeTarget && safeTarget !== '/' && safeTarget !== '/login') {
          navigate(safeTarget);
        } else {
          navigate('/customer/dashboard');
        }
      }
    } catch (err) {
      const respData = err.response?.data;
      if (respData) {
        const msg =
          respData.non_field_errors?.[0] ||
          respData.detail ||
          respData.error ||
          (typeof respData === 'string' ? respData : 'Invalid email or password. Please verify your credentials.');
        setError(msg);
      } else if (err.request) {
        setError('Cannot connect to the backend server. Please verify Django is running on port 8000.');
      } else {
        setError(err.message || 'An unexpected error occurred during sign in.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleToken = async (idToken) => {
    try {
      setLoading(true);
      setError('');
      const user = await loginWithGoogle(idToken);

      // Handle pending add_to_cart action if coming from guest click
      const action = searchParams.get('action');
      const productId = searchParams.get('productId');
      const quantity = parseInt(searchParams.get('quantity') || '1', 10);
      if (user.role === 'customer' && action === 'add_to_cart' && productId) {
        try {
          await addToCart(parseInt(productId, 10), quantity);
        } catch (cartErr) {
          console.error('Auto add to cart after login error', cartErr);
        }
      }

      // Safe redirect validation: prevent open redirect vulnerabilities
      const rawTarget = searchParams.get('redirect') || '';
      const safeTarget = rawTarget.startsWith('/') && !rawTarget.startsWith('//') ? rawTarget : '';

      if (user.role === 'order_manager') {
        navigate('/order-manager/dashboard');
      } else if (user.role === 'store_manager') {
        navigate('/manager/dashboard');
      } else if (user.role === 'admin' || user.is_superuser) {
        navigate('/admin/dashboard');
      } else {
        if (safeTarget && safeTarget !== '/' && safeTarget !== '/login') {
          navigate(safeTarget);
        } else {
          navigate('/customer/dashboard');
        }
      }
    } catch (err) {
      const respData = err.response?.data;
      const msg = respData?.error || respData?.detail || 'Google sign-in failed. Please verify your credentials or try email sign in.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f4f6fa', minHeight: 'calc(100vh - 120px)' }} className="d-flex align-items-center py-4 py-md-5">
      <div className="container" style={{ maxWidth: '980px' }}>
        <div className="card ethio-card border-0 shadow-lg overflow-hidden" style={{ borderRadius: '1.25rem' }}>
          <div className="row g-0">
            
            {/* Left Panel - Deep Navy Blue (Screenshot 2) */}
            <div
              className="col-lg-5 p-4 p-md-5 d-flex flex-column justify-content-between text-white"
              style={{
                backgroundColor: '#0b1a2d',
                background: 'linear-gradient(145deg, #0b1a2d 0%, #0c2340 100%)',
              }}
            >
              <div>
                {/* Brand Header */}
                <div className="d-flex align-items-center gap-2 mb-4">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-white"
                    style={{ width: '38px', height: '38px', backgroundColor: '#1b64da' }}
                  >
                    <i className="bi bi-cart3 fs-5"></i>
                  </div>
                  <div>
                    <h5 className="fw-bolder mb-0 text-white tracking-tight lh-1">
                      EthioTech <span style={{ color: '#60a5fa' }}>Market</span>
                    </h5>
                    <small className="text-slate-400" style={{ fontSize: '0.65rem' }}>
                      Better Tech. Brighter Future.
                    </small>
                  </div>
                </div>

                <h3 className="fw-bold mb-4 text-white" style={{ lineHeight: '1.3' }}>
                  Sign in to continue your shopping journey
                </h3>

                {/* 3 Value Props (Screenshot 2) */}
                <div className="d-flex flex-column gap-3 mb-4">
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: '28px', height: '28px', backgroundColor: 'rgba(27, 100, 218, 0.25)', color: '#60a5fa' }}
                    >
                      <i className="bi bi-check-lg fw-bold"></i>
                    </div>
                    <div>
                      <div className="fw-bold text-sm text-white">Best Products</div>
                      <small className="text-slate-400 text-xs">Genuine warranty-backed electronics and accessories.</small>
                    </div>
                  </div>

                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: '28px', height: '28px', backgroundColor: 'rgba(16, 185, 129, 0.25)', color: '#34d399' }}
                    >
                      <i className="bi bi-shield-check fw-bold"></i>
                    </div>
                    <div>
                      <div className="fw-bold text-sm text-white">Secure Payment</div>
                      <small className="text-slate-400 text-xs">Official Chapa checkout with Telebirr, CBE, and bank cards.</small>
                    </div>
                  </div>

                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: '28px', height: '28px', backgroundColor: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24' }}
                    >
                      <i className="bi bi-truck fw-bold"></i>
                    </div>
                    <div>
                      <div className="fw-bold text-sm text-white">Fast Delivery</div>
                      <small className="text-slate-400 text-xs">Same-day Addis Ababa delivery and regional dispatch.</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Notice */}
              <div className="pt-3 border-top border-white border-opacity-10 text-slate-400 text-xs">
                Protected by Django backend permissions and server-side RBAC.
              </div>
            </div>

            {/* Right Panel - Sign In Form (Screenshot 2) */}
            <div className="col-lg-7 p-4 p-md-5 bg-white d-flex flex-column justify-content-center">
              <div style={{ maxWidth: '440px', margin: '0 auto', width: '100%' }}>
                
                <h3 className="fw-bolder text-slate-900 mb-1" style={{ letterSpacing: '-0.02em' }}>
                  Welcome Back
                </h3>
                <p className="text-muted text-xs mb-4">
                  Sign in to your account using your email and password
                </p>

                {/* Error Alert */}
                {error && (
                  <div className="alert alert-danger rounded-3 text-xs mb-3 d-flex align-items-start gap-2 border-danger border-opacity-25" role="alert">
                    <i className="bi bi-exclamation-triangle-fill text-danger fs-6 shrink-0 mt-0.5"></i>
                    <div>{error}</div>
                  </div>
                )}

                <form onSubmit={handleLogin}>
                  {/* Email Input */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                      Email address
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-envelope"></i>
                      </span>
                      <input
                        type="text"
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
                      <label className="form-label text-xs fw-semibold text-slate-700 mb-0">
                        Password
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-primary fw-semibold text-decoration-none hover-underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-lock"></i>
                      </span>
                      <input
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
                        id="rememberMeCheckbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <label className="form-check-label text-xs text-slate-600" htmlFor="rememberMeCheckbox">
                        Remember me
                      </label>
                    </div>
                  </div>

                  {/* Sign In Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-ethio-primary w-100 py-2.5 fw-bold text-sm shadow-sm mb-3"
                    style={{ backgroundColor: '#1b64da', color: '#ffffff', borderRadius: '0.5rem' }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </button>

                  {/* Google OAuth Option */}
                  <div className="d-flex align-items-center my-2.5">
                    <hr className="flex-grow-1 border-slate-200 my-0" />
                    <span className="px-2.5 text-slate-400 text-[11px] text-uppercase font-semibold">or</span>
                    <hr className="flex-grow-1 border-slate-200 my-0" />
                  </div>

                  <GoogleSignInButton
                    text="continue_with"
                    buttonId="continue-with-google-btn"
                    onSuccess={handleGoogleToken}
                    onError={(err) => {
                      const msg = typeof err === 'string' ? err : err?.message || 'Google sign-in was not completed.';
                      setError(msg);
                    }}
                    disabled={loading}
                  />
                </form>

                {/* Footer Link: Create Account */}
                <div className="text-center mt-3 pt-1">
                  <span className="text-muted text-xs me-1">Don't have an account?</span>
                  <Link to="/register" className="text-primary fw-bold text-xs text-decoration-none">
                    Create account
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

export default LoginPage;
