import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
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
      setError('Please provide your email address and password.');
      return;
    }

    try {
      setLoading(true);
      const user = await login(identifier.trim(), password, rememberMe);

      // Check for pending add_to_cart action
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
      if (user.role === 'store_manager') {
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

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-11 col-sm-9 col-md-7 col-lg-5">
          <div className="card border-0 shadow-xl rounded-4 p-4 p-md-5 bg-white">
            {/* Header / Brand */}
            <div className="text-center mb-4">
              <div
                className="mx-auto rounded-3 d-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
                style={{ width: '52px', height: '52px', background: 'var(--gradient-primary)' }}
              >
                <i className="bi bi-cpu-fill fs-4"></i>
              </div>
              <h3 className="fw-bolder text-slate-900 tracking-tight mb-1">Welcome Back</h3>
              <p className="text-slate-500 text-xs mb-0">Sign in to your verified NexusStore account</p>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div className="alert alert-danger rounded-3 text-xs mb-4 d-flex align-items-start gap-2 border-danger border-opacity-25" role="alert">
                <i className="bi bi-exclamation-circle-fill text-danger fs-6 shrink-0 mt-0.5"></i>
                <div className="flex-grow-1">{error}</div>
                <button type="button" className="btn-close btn-sm p-1" onClick={() => setError('')} aria-label="Close"></button>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} noValidate>
              {/* Email Address */}
              <div className="mb-3">
                <label className="form-label text-xs fw-bold text-slate-700" htmlFor="login-identifier">
                  Email Address or Username
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                    <i className="bi bi-envelope"></i>
                  </span>
                  <input
                    id="login-identifier"
                    type="text"
                    className="form-control text-sm py-2"
                    placeholder="name@example.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="username"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password with Show/Hide toggle */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label text-xs fw-bold text-slate-700 mb-0" htmlFor="login-password">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-primary text-xs text-decoration-none fw-semibold hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="input-group">
                  <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                    <i className="bi bi-lock"></i>
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-control text-sm py-2"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary border-slate-200 text-slate-500 hover:text-slate-700"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="mb-4 form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="remember-me-check"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label className="form-check-label text-xs text-slate-600 user-select-none" htmlFor="remember-me-check">
                  Keep me signed in on this device
                </label>
              </div>

              {/* Sign In Button with loading & disabled state */}
              <button
                type="submit"
                className="btn btn-primary-gradient w-100 rounded-pill py-2.5 fw-bold text-sm mb-3 shadow-md d-flex align-items-center justify-content-center gap-2"
                disabled={loading || !identifier.trim() || !password}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <i className="bi bi-arrow-right"></i>
                  </>
                )}
              </button>
            </form>

            {/* Create Account Link */}
            <div className="text-center text-xs text-slate-500 pt-3 border-top border-slate-100">
              Don't have an account yet?{' '}
              <Link to="/register" className="text-primary fw-bold text-decoration-none hover:underline">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
