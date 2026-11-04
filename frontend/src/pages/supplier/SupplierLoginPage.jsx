import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { validateEmail } from '../../utils/validation';

const SupplierLoginPage = () => {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
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

    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setError('Please provide your registered supplier email address and password.');
      return;
    }

    const emailRes = validateEmail(cleanId, true);
    if (!emailRes.isValid) {
      setError(emailRes.error);
      return;
    }

    try {
      setLoading(true);
      const user = await login(cleanId, password, rememberMe, 'supplier');
      const redirect = searchParams.get('redirect') || '/supplier/dashboard';
      navigate(redirect, { replace: true });
    } catch (err) {
      const respData = err.response?.data;
      const msg =
        respData?.error ||
        respData?.detail ||
        (typeof respData === 'string' ? respData : 'Invalid supplier credentials. Please verify your email and password.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column justify-content-center bg-slate-950 py-5 px-3">
      <div className="container" style={{ maxWidth: '460px' }}>
        {/* Brand Header */}
        <div className="text-center mb-4">
          <Link to="/" className="d-inline-flex align-items-center gap-2 text-decoration-none mb-3">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center text-white shadow-lg"
              style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
            >
              <i className="bi bi-truck-front-fill fs-5"></i>
            </div>
            <span className="fs-4 fw-bolder text-white tracking-tight">
              EthioTech <span className="text-amber-400">Market</span>
            </span>
          </Link>
          <div className="d-inline-block px-3 py-1 rounded-pill bg-amber-500 bg-opacity-10 border border-amber-500 border-opacity-25 text-amber-300 small fw-bold mb-2">
            <i className="bi bi-shield-lock-fill me-1.5"></i> OFFICIAL SUPPLIER PORTAL
          </div>
          <h1 className="h4 fw-bold text-white mb-1">Hardware Supplier Sign In</h1>
          <p className="text-slate-400 text-xs mb-0">
            Secure external portal for authorized hardware vendors, purchase order confirmation, and invoice management.
          </p>
        </div>

        {/* Login Card */}
        <div className="card border-0 shadow-2xl rounded-4 bg-slate-900 border border-slate-800 text-white overflow-hidden">
          <div className="card-body p-4 p-sm-4.5">
            {error && (
              <div className="alert alert-danger bg-danger bg-opacity-10 border border-danger border-opacity-25 text-danger d-flex align-items-start gap-2 py-2.5 px-3 rounded-3 text-xs mb-4">
                <i className="bi bi-exclamation-triangle-fill fs-6 mt-0.5 shrink-0"></i>
                <div className="flex-grow-1">{error}</div>
                <button
                  type="button"
                  className="btn-close btn-close-white btn-sm p-1"
                  aria-label="Close"
                  onClick={() => setError('')}
                ></button>
              </div>
            )}

            <form onSubmit={handleLogin} noValidate>
              {/* Email Address */}
              <div className="mb-3">
                <label className="form-label text-xs fw-semibold text-slate-300 mb-1" htmlFor="supplierEmail">
                  Registered Supplier Email <span className="text-amber-400">*</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-slate-800 border-slate-700 text-slate-400">
                    <i className="bi bi-envelope"></i>
                  </span>
                  <input
                    type="email"
                    id="supplierEmail"
                    className="form-control bg-slate-800 border-slate-700 text-white placeholder-slate-500 text-sm py-2"
                    placeholder="company@gmail.com"
                    autoComplete="email"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
                <small className="text-slate-500 text-[11px] mt-1 d-block">
                  Must be the authorized contact email provided during vendor onboarding.
                </small>
              </div>

              {/* Password */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label text-xs fw-semibold text-slate-300 mb-0" htmlFor="supplierPassword">
                    Account Password <span className="text-amber-400">*</span>
                  </label>
                  <Link
                    to="/forgot-password?portal=supplier"
                    className="text-amber-400 hover:text-amber-300 text-xs text-decoration-none fw-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="input-group">
                  <span className="input-group-text bg-slate-800 border-slate-700 text-slate-400">
                    <i className="bi bi-lock"></i>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="supplierPassword"
                    className="form-control bg-slate-800 border-slate-700 text-white placeholder-slate-500 text-sm py-2"
                    placeholder="Enter your portal password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary border-slate-700 text-slate-400 bg-slate-800 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="form-check mb-4">
                <input
                  type="checkbox"
                  id="rememberMe"
                  className="form-check-input bg-slate-800 border-slate-700"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label className="form-check-label text-xs text-slate-300" htmlFor="rememberMe">
                  Keep me signed in on this device
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn w-100 py-2.5 rounded-3 fw-bold text-slate-950 shadow-lg d-flex align-items-center justify-content-center gap-2 transition"
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-box-arrow-in-right fs-6"></i>
                    <span>Sign In to Supplier Portal</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="card-footer bg-slate-950 bg-opacity-50 border-top border-slate-800 p-3 text-center">
            <span className="text-slate-400 text-xs">
              Need a supplier login? <span className="text-slate-300">Supplier accounts are provisioned exclusively by EthioTech Market Procurement Administration.</span>
            </span>
          </div>
        </div>

        {/* Portal Switching Links */}
        <div className="mt-4 text-center">
          <div className="d-flex justify-content-center gap-3 text-xs text-slate-400">
            <Link to="/staff/login" className="text-slate-400 hover:text-white text-decoration-none">
              <i className="bi bi-person-badge me-1"></i> Staff Login
            </Link>
            <span className="text-slate-700">&bull;</span>
            <Link to="/login" className="text-slate-400 hover:text-white text-decoration-none">
              <i className="bi bi-person me-1"></i> Customer Login
            </Link>
            <span className="text-slate-700">&bull;</span>
            <Link to="/" className="text-slate-400 hover:text-white text-decoration-none">
              <i className="bi bi-shop me-1"></i> Marketplace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierLoginPage;

