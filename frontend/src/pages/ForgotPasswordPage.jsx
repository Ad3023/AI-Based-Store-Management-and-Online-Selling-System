import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { validateEmail } from '../utils/validation';

const ForgotPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const isStaff = searchParams.get('portal') === 'staff';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusState, setStatusState] = useState({ type: '', text: '' });
  const [resetData, setResetData] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusState({ type: '', text: '' });
    setResetData(null);

    const emailRes = validateEmail(email, true);
    if (!emailRes.isValid) {
      setStatusState({ type: 'danger', text: emailRes.error });
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('auth/password-reset/', { email: emailRes.value });
      setResetData(res.data);
      setStatusState({
        type: 'success',
        text: res.data.message || 'Password recovery instructions processed successfully.'
      });
    } catch (err) {
      const errMsg =
        err.response?.data?.email?.[0] ||
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Unable to process password reset request. Please verify your email and try again.';
      setStatusState({ type: 'danger', text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-11 col-sm-9 col-md-7 col-lg-5">
          <div className="card border-0 shadow-xl rounded-4 p-4 p-md-5 bg-white">
            {/* Header */}
            <div className="text-center mb-4">
              <div
                className="mx-auto rounded-3 d-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
                style={{ width: '52px', height: '52px', background: isStaff ? 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)' : 'var(--gradient-primary)' }}
              >
                <i className={`bi ${isStaff ? 'bi-shield-lock-fill' : 'bi-key-fill'} fs-4`}></i>
              </div>
              {isStaff && (
                <div className="mb-2">
                  <span className="badge rounded-pill px-2.5 py-1 text-xs fw-semibold" style={{ backgroundColor: 'rgba(15, 118, 110, 0.1)', color: '#0f766e', border: '1px solid rgba(20, 184, 166, 0.3)' }}>
                    <i className="bi bi-shield-shaded me-1"></i> Staff Account Password Recovery
                  </span>
                </div>
              )}
              <h3 className="fw-bolder text-slate-900 tracking-tight mb-1">Forgot Password</h3>
              <p className="text-slate-500 text-xs mb-0">
                Enter your verified {isStaff ? 'staff' : ''} email address to receive password recovery instructions.
              </p>
            </div>

            {/* Status Alert */}
            {statusState.text && (
              <div
                className={`alert alert-${statusState.type} rounded-3 text-xs mb-4 d-flex align-items-start gap-2 border-${statusState.type} border-opacity-25`}
                role="alert"
              >
                <i className={`bi ${statusState.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-circle-fill text-danger'} fs-6 shrink-0 mt-0.5`}></i>
                <div className="flex-grow-1">{statusState.text}</div>
              </div>
            )}

            {!resetData ? (
              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-4">
                  <label className="form-label text-xs fw-bold text-slate-700" htmlFor="reset-email">
                    Registered Email Address
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                      <i className="bi bi-envelope"></i>
                    </span>
                    <input
                      id="reset-email"
                      type="email"
                      className="form-control text-sm py-2"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="form-text text-[11px] text-slate-400 mt-1">
                    We will verify your account and issue a time-limited recovery token.
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary-gradient w-100 rounded-pill py-2.5 fw-bold text-sm mb-3 shadow-md d-flex align-items-center justify-content-center gap-2"
                  disabled={loading || !email.trim()}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Processing recovery...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Recovery Instructions</span>
                      <i className="bi bi-arrow-right"></i>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center mb-4">
                <div
                  className="mx-auto rounded-circle d-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
                  style={{ width: '56px', height: '56px', backgroundColor: '#059669' }}
                >
                  <i className="bi bi-envelope-check-fill fs-3"></i>
                </div>
                <h5 className="fw-bolder text-slate-900 mb-1">Check Your Email</h5>
                <p className="text-slate-600 text-xs mb-3" style={{ lineHeight: '1.6' }}>
                  A secure <strong>6-digit recovery code</strong> and a <strong>password reset link</strong> have been dispatched to <strong>{email}</strong>.
                </p>

                <div className="alert alert-info rounded-3 text-start text-xs p-3 mb-3 border-info border-opacity-25 bg-blue-50">
                  <div className="fw-bold text-slate-900 mb-1.5 d-flex align-items-center gap-1.5">
                    <i className="bi bi-shield-check text-primary"></i> Two ways to set your new password:
                  </div>
                  <ul className="mb-0 ps-3 text-slate-600">
                    <li className="mb-1"><strong>Click the direct link</strong> sent to your Gmail inbox, OR</li>
                    <li><strong>Enter the 6-digit OTP code</strong> sent to your email.</li>
                  </ul>
                </div>

                <div className="d-grid gap-2 mb-2">
                  <button
                    type="button"
                    className="btn btn-primary-gradient btn-sm rounded-pill fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-1.5"
                    onClick={() => {
                      const portalParam = isStaff ? '&portal=staff' : '';
                      navigate(`/reset-password?email=${encodeURIComponent(email)}${portalParam}`);
                    }}
                  >
                    <i className="bi bi-key-fill"></i>
                    <span>Enter 6-Digit Recovery Code</span>
                    <i className="bi bi-arrow-right"></i>
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm rounded-pill py-1.5"
                    onClick={() => {
                      setResetData(null);
                      setStatusState({ type: '', text: '' });
                    }}
                  >
                    Send to Another Email
                  </button>
                </div>
              </div>
            )}

            <div className="text-center text-xs text-slate-500 pt-3 border-top border-slate-100">
              Remember your password?{' '}
              {isStaff ? (
                <>
                  <Link to="/staff/login" className="text-teal-600 fw-bold text-decoration-none hover:underline">
                    Back to Staff Login
                  </Link>
                  <span className="mx-2 text-slate-300">|</span>
                  <Link to="/login" className="text-slate-400 text-decoration-none hover:underline">
                    Customer Login
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-primary fw-bold text-decoration-none hover:underline">
                    Back to Sign In
                  </Link>
                  <span className="mx-2 text-slate-300">|</span>
                  <Link to="/staff/login" className="text-slate-400 text-decoration-none hover:underline">
                    Staff Portal
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
