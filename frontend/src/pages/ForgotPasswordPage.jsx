import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusState, setStatusState] = useState({ type: '', text: '' });
  const [resetData, setResetData] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusState({ type: '', text: '' });
    setResetData(null);

    if (!email.trim()) {
      setStatusState({ type: 'danger', text: 'Please enter your registered email address.' });
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('auth/password-reset/', { email: email.trim().toLowerCase() });
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
                style={{ width: '52px', height: '52px', background: 'var(--gradient-primary)' }}
              >
                <i className="bi bi-key-fill fs-4"></i>
              </div>
              <h3 className="fw-bolder text-slate-900 tracking-tight mb-1">Forgot Password</h3>
              <p className="text-slate-500 text-xs mb-0">
                Enter your verified email address to receive password recovery instructions.
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
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center mb-4">
                <i className="bi bi-shield-check text-success fs-1 mb-2 d-block"></i>
                <h6 className="fw-bold text-slate-900 mb-1">Recovery Token Ready</h6>
                <p className="text-slate-500 text-xs mb-3">
                  A secure recovery token has been generated for <strong>{email}</strong>. Click below to set your new password.
                </p>

                <div className="d-grid gap-2 mb-3">
                  <button
                    type="button"
                    className="btn btn-primary-gradient btn-sm rounded-pill fw-bold py-2"
                    onClick={() => {
                      const tokenParam = resetData.reset_token ? `&token=${encodeURIComponent(resetData.reset_token)}` : '';
                      navigate(`/reset-password?email=${encodeURIComponent(email)}${tokenParam}`);
                    }}
                  >
                    Proceed to Reset Password &rarr;
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm rounded-pill py-1.5"
                    onClick={() => {
                      setResetData(null);
                      setStatusState({ type: '', text: '' });
                    }}
                  >
                    Try Another Email
                  </button>
                </div>
              </div>
            )}

            <div className="text-center text-xs text-slate-500 pt-3 border-top border-slate-100">
              Remember your password?{' '}
              <Link to="/login" className="text-primary fw-bold text-decoration-none hover:underline">
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
