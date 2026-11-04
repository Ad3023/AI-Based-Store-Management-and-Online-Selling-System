import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DriverLoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('Please enter your driver username or email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      setLoading(true);
      const user = await login(identifier.trim(), password, rememberMe, 'driver');
      const from = location.state?.from?.pathname || user.dashboard_url || '/driver/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Driver sign-in error:', err);
      const resData = err.response?.data;
      if (resData?.portal_access_denied) {
        setError(resData.error || 'Access restricted to authorized delivery personnel.');
      } else {
        setError(resData?.error || resData?.detail || 'Invalid username or password. Please verify your driver credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-slate-100 py-5 px-3">
      <div className="card border-0 shadow-lg rounded-4 overflow-hidden bg-white" style={{ maxWidth: '440px', width: '100%' }}>
        <div className="p-4 p-md-5">
          <div className="text-center mb-4">
            <div
              className="rounded-circle d-inline-flex align-items-center justify-content-center bg-primary text-white mb-3 shadow"
              style={{ width: '56px', height: '56px' }}
            >
              <i className="bi bi-bicycle fs-3"></i>
            </div>
            <h4 className="fw-bolder text-slate-900 mb-1">Driver Portal</h4>
            <p className="text-muted text-xs mb-0">
              EthioTech Market &bull; Field Delivery &amp; Handover Console
            </p>
          </div>

          {error && (
            <div className="alert alert-danger rounded-3 py-2.5 px-3 text-xs mb-3 d-flex align-items-start gap-2" role="alert">
              <i className="bi bi-exclamation-triangle-fill fs-6 shrink-0 mt-0.5"></i>
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold text-xs text-slate-700">Driver Username or Email</label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0"><i className="bi bi-person text-muted"></i></span>
                <input
                  type="text"
                  className="form-control bg-light border-start-0 text-sm"
                  placeholder="e.g. kassahun_driver"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold text-xs text-slate-700">Password</label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0"><i className="bi bi-lock text-muted"></i></span>
                <input
                  type="password"
                  className="form-control bg-light border-start-0 text-sm"
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between mb-4">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="rememberDriver"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label className="form-check-label text-xs text-slate-600" htmlFor="rememberDriver">
                  Keep me signed in
                </label>
              </div>
              <Link to="/contact" className="text-decoration-none text-xs text-primary">
                Contact Dispatch
              </Link>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 rounded-pill py-2.5 fw-bold text-sm shadow-sm d-flex align-items-center justify-content-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right"></i>
                  <span>Sign In to Driver Console</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-4 pt-3 border-top">
            <span className="text-muted text-xs">Are you an administrator or store manager?</span>
            <div className="mt-1">
              <Link to="/staff/login" className="text-decoration-none text-xs fw-bold text-slate-800 me-3">
                Staff Login &rarr;
              </Link>
              <Link to="/" className="text-decoration-none text-xs text-muted">
                Storefront
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverLoginPage;

