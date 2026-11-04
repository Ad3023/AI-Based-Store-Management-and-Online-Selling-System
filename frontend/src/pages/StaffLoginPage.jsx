import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../utils/validation';

const StaffLoginPage = () => {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isCustomerError, setIsCustomerError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsCustomerError(false);

    if (!identifier.trim() || !password) {
      setError('Please provide your staff username/email and password.');
      return;
    }

    if (identifier.includes('@')) {
      const emailRes = validateEmail(identifier.trim(), true);
      if (!emailRes.isValid) {
        setError(emailRes.error);
        return;
      }
    }

    try {
      setLoading(true);
      // Explicitly declare portal as 'staff'
      const user = await login(identifier.trim(), password, rememberMe, 'staff');

      // Automatic Role-Based Redirection:
      // Identified authoritatively from backend user.role / dashboard_url
      // User NEVER chooses role manually
      const rawTarget = searchParams.get('redirect') || '';
      const safeTarget = rawTarget.startsWith('/') && !rawTarget.startsWith('//') ? rawTarget : '';

      if (user.role === 'admin' || user.is_super_admin || user.is_superuser) {
        if (safeTarget && safeTarget.startsWith('/admin')) {
          navigate(safeTarget);
        } else {
          navigate('/admin/dashboard');
        }
      } else if (user.role === 'order_manager') {
        if (safeTarget && safeTarget.startsWith('/order-manager')) {
          navigate(safeTarget);
        } else {
          navigate('/order-manager/dashboard');
        }
      } else if (user.role === 'store_manager' || user.role === 'sub_admin') {
        if (safeTarget && (safeTarget.startsWith('/store-manager') || safeTarget.startsWith('/manager'))) {
          navigate(safeTarget);
        } else {
          navigate('/store-manager/dashboard');
        }
      } else {
        // Fallback for custom staff roles
        navigate(user.dashboard_url || '/manager/dashboard');
      }
    } catch (err) {
      const respData = err.response?.data;
      const status = err.response?.status;

      if (respData) {
        if (respData.portal_access_denied) {
          setIsCustomerError(true);
          setError(respData.error || 'This portal is for authorized staff only. Please use Customer Login.');
        } else if (status >= 500) {
          setError('Unable to sign in right now. Please try again.');
        } else {
          const msg =
            respData.non_field_errors?.[0] ||
            respData.detail ||
            respData.error ||
            (typeof respData === 'string' ? respData : 'Invalid username/email or password.');
          setError(msg);
        }
      } else {
        // Network or server connection failure
        setError('Unable to sign in right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#0a101d',
        backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(27, 100, 218, 0.08) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(15, 118, 110, 0.08) 0%, transparent 40%)',
        minHeight: 'calc(100vh - 120px)'
      }}
      className="d-flex align-items-center py-4 py-md-5"
    >
      <div className="container" style={{ maxWidth: '1020px' }}>

        {/* Portal Switch Navigation Banner */}
        <div className="d-flex justify-content-between align-items-center mb-3 px-2 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-1.5 p-1 bg-slate-900 rounded-pill shadow-sm border border-slate-800">
            <Link
              to="/login"
              className="btn btn-sm btn-link text-slate-400 text-decoration-none px-3 py-1.5 text-xs fw-semibold rounded-pill hover-text-white"
              title="Return to Customer Storefront Login"
            >
              <i className="bi bi-cart3 me-1 text-primary"></i> &larr; Customer Login
            </Link>
            <span
              className="badge rounded-pill px-3 py-2 text-xs fw-bold text-white d-flex align-items-center gap-1.5 shadow-sm"
              style={{ backgroundColor: '#0f766e', border: '1px solid rgba(20, 184, 166, 0.4)' }}
            >
              <i className="bi bi-shield-lock-fill"></i> Staff Login (Active)
            </span>
          </div>

          <div className="text-slate-400 text-xs d-flex align-items-center gap-2">
            <span className="badge bg-danger bg-opacity-20 text-danger border border-danger border-opacity-30 rounded-pill px-2.5 py-1 text-[11px] fw-semibold">
              <i className="bi bi-lock-fill me-1"></i> Authorized Staff Only
            </span>
          </div>
        </div>

        {/* Staff Login Card */}
        <div className="card border-0 shadow-2xl overflow-hidden" style={{ borderRadius: '1.25rem', backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
          <div className="row g-0">
            
            {/* Left Panel - Staff Operations Showcase (Deep Navy / Dark Blue) */}
            <div
              className="col-lg-5 p-4 p-md-5 d-flex flex-column justify-content-between text-white"
              style={{
                backgroundColor: '#0b1a2d',
                background: 'linear-gradient(160deg, #0b1a2d 0%, #0c2340 100%)',
                borderRight: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div>
                {/* Brand Header */}
                <div className="d-flex align-items-center gap-2 mb-4">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-white shadow"
                    style={{ width: '42px', height: '42px', backgroundColor: '#1b64da' }}
                  >
                    <i className="bi bi-shield-check fs-4"></i>
                  </div>
                  <div>
                    <h5 className="fw-bolder mb-0 text-white tracking-tight lh-1">
                      EthioTech <span style={{ color: '#60a5fa' }}>Operations</span>
                    </h5>
                    <small className="text-slate-300" style={{ fontSize: '0.65rem' }}>
                      Staff &amp; Management Console
                    </small>
                  </div>
                </div>

                <div className="badge bg-primary bg-opacity-25 text-blue-200 border border-primary border-opacity-40 rounded-pill px-3 py-1.5 text-[11px] fw-semibold mb-3">
                  <i className="bi bi-shield-lock-fill me-1"></i> Authorized Staff Portal
                </div>

                <h3 className="fw-bold mb-2 text-white" style={{ lineHeight: '1.3' }}>
                  Enterprise Operations &amp; Management
                </h3>
                <p className="text-slate-300 text-xs mb-4">
                  Secure centralized gateway for authenticated management staff and platform operations.
                </p>

                {/* 3 Authorized Staff Roles */}
                <div className="d-flex flex-column gap-3 mb-4">
                  
                  {/* Administrator Role Card */}
                  <div className="p-3 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: '28px', height: '28px', backgroundColor: 'rgba(239, 68, 68, 0.25)', color: '#f87171' }}
                      >
                        <i className="bi bi-shield-shaded" style={{ fontSize: '13px' }}></i>
                      </div>
                      <div className="fw-bold text-xs text-white d-flex align-items-center gap-2">
                        Administrator
                        <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-30 rounded px-1.5 py-0.5 text-[10px]">
                          System Management
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-300 text-[11px] mb-0 ps-4">
                      Complete system administration, delivery hub governance, staff user provisioning, and security audit logs.
                    </p>
                  </div>

                  {/* Store Manager Role Card */}
                  <div className="p-3 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: '28px', height: '28px', backgroundColor: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd' }}
                      >
                        <i className="bi bi-boxes" style={{ fontSize: '13px' }}></i>
                      </div>
                      <div className="fw-bold text-xs text-white d-flex align-items-center gap-2">
                        Store Manager
                        <span className="badge bg-primary bg-opacity-25 text-blue-200 border border-primary border-opacity-30 rounded px-1.5 py-0.5 text-[10px]">
                          Products &amp; Inventory
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-300 text-[11px] mb-0 ps-4">
                      Catalog curation, stock adjustments, low-stock reorder alerts, supplier relations, and procurement.
                    </p>
                  </div>

                  {/* Order Manager Role Card */}
                  <div className="p-3 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: '28px', height: '28px', backgroundColor: 'rgba(16, 185, 129, 0.25)', color: '#6ee7b7' }}
                      >
                        <i className="bi bi-truck" style={{ fontSize: '13px' }}></i>
                      </div>
                      <div className="fw-bold text-xs text-white d-flex align-items-center gap-2">
                        Order Manager
                        <span className="badge bg-success bg-opacity-25 text-emerald-200 border border-success border-opacity-30 rounded px-1.5 py-0.5 text-[10px]">
                          Order Processing &amp; Fulfillment
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-300 text-[11px] mb-0 ps-4">
                      Order verification, workflow stage advancement, courier dispatch, and fulfillment tracking.
                    </p>
                  </div>

                </div>
              </div>

              {/* Bottom Security Disclaimer */}
              <div className="pt-3 border-top border-white border-opacity-10 text-slate-300 text-xs">
                <i className="bi bi-shield-lock-fill text-primary me-1.5"></i>
                Protected by role-based access control (RBAC). Sign-in attempts and security events are audited.
              </div>
            </div>

            {/* Right Panel - Staff Login Form (Crisp White Enterprise Panel) */}
            <div className="col-lg-7 p-4 p-md-5 d-flex flex-column justify-content-center bg-white">
              <div style={{ maxWidth: '440px', margin: '0 auto', width: '100%' }}>
                
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <h3 className="fw-bolder text-slate-900 mb-0" style={{ letterSpacing: '-0.02em' }}>
                    Staff Portal
                  </h3>
                  <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill px-2.5 py-1 text-[11px] fw-bold">
                    <i className="bi bi-shield-lock-fill me-1"></i> Authorized Personnel Only
                  </span>
                </div>
                <p className="text-muted text-xs mb-4">
                  Enter your assigned staff credentials. You will be redirected to your role-specific dashboard automatically.
                </p>

                {/* Error Alert */}
                {error && (
                  <div className="alert alert-danger rounded-3 text-xs mb-3 d-flex flex-column gap-2 border-danger border-opacity-25" role="alert">
                    <div className="d-flex align-items-start gap-2">
                      <i className="bi bi-exclamation-octagon-fill text-danger fs-6 shrink-0 mt-0.5"></i>
                      <div>{error}</div>
                    </div>
                    {isCustomerError && (
                      <div className="pt-2">
                        <Link
                          to="/login"
                          className="btn btn-sm btn-primary rounded-pill px-3 py-1 font-bold text-xs d-inline-flex align-items-center gap-1.5 shadow-sm"
                        >
                          <i className="bi bi-cart3"></i> Go to Customer Login Portal &rarr;
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleStaffLogin}>
                  {/* Staff Identifier (Email or Username) */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1" htmlFor="staffIdentifierInput">
                      Staff Email or Username
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-person-badge"></i>
                      </span>
                      <input
                        id="staffIdentifierInput"
                        type="text"
                        className="form-control form-control-lg text-sm bg-slate-50 border-start-0 ps-0"
                        placeholder="admin@ethiotech.com or username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label text-xs fw-semibold text-slate-700 mb-0" htmlFor="staffPasswordInput">
                        Password
                      </label>
                      <Link
                        to="/forgot-password?portal=staff"
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
                        id="staffPasswordInput"
                        type={showPassword ? 'text' : 'password'}
                        className="form-control form-control-lg text-sm bg-slate-50 border-start-0 border-end-0 ps-0"
                        placeholder="Enter your staff password"
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
                        id="staffRememberMeCheckbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <label className="form-check-label text-xs text-slate-600" htmlFor="staffRememberMeCheckbox">
                        Remember Me on This Device
                      </label>
                    </div>
                  </div>

                  {/* Sign In Button */}
                  <button
                    id="staffSubmitBtn"
                    type="submit"
                    disabled={loading}
                    className="btn w-100 py-2.5 fw-bold text-sm shadow mb-3 text-white transition"
                    style={{ backgroundColor: '#1b64da', borderColor: '#1b64da', borderRadius: '0.5rem' }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Authenticating Staff Credentials...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-shield-lock-fill me-1.5"></i> Sign In
                      </>
                    )}
                  </button>
                </form>

                {/* Staff Account Provisioning Information Notice */}
                <div className="p-3 rounded-3 bg-slate-50 border border-slate-200 text-slate-600 text-xs mb-3">
                  <div className="d-flex align-items-start gap-2">
                    <i className="bi bi-info-circle-fill text-primary mt-0.5"></i>
                    <div>
                      <div className="fw-semibold text-slate-900 mb-0.5">No Public Staff Registration</div>
                      <p className="mb-1 text-slate-600">
                        Public registration for staff roles is strictly disabled. Store Manager and Order Manager accounts are provisioned exclusively by authorized System Administrators.
                      </p>
                      <small className="text-slate-500 text-[11px]">
                        Need access? Please contact your organization administrator.
                      </small>
                    </div>
                  </div>
                </div>

                {/* Portal Switch Links */}
                <div className="text-center pt-2 border-top border-slate-100 d-flex flex-column gap-1.5">
                  <div>
                    <span className="text-slate-500 text-xs me-1">External Hardware Vendor?</span>
                    <Link to="/supplier/login" className="text-teal-600 fw-bold text-xs text-decoration-none">
                      Supplier Portal &rarr;
                    </Link>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs me-1">Looking for customer shopping?</span>
                    <Link to="/login" className="text-primary fw-bold text-xs text-decoration-none">
                      &larr; Return to Customer Login
                    </Link>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default StaffLoginPage;
