import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusState, setStatusState] = useState({ type: '', text: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusState({ type: '', text: '' });

    if (!email.trim()) {
      setStatusState({ type: 'danger', text: 'Please enter your registered email address.' });
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('auth/password-reset/', { email: email.trim() });
      setSubmitted(true);
      setStatusState({
        type: 'success',
        text: res.data.message || 'Password recovery instructions have been dispatched to your email address.'
      });
    } catch (err) {
      const errMsg =
        err.response?.data?.email?.[0] ||
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Unable to process password reset request. Please check your email and try again.';
      setStatusState({ type: 'danger', text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-7 col-lg-5">
          <div className="card border-0 shadow-lg rounded-4 p-4 p-md-5 bg-white">
            <div className="text-center mb-4">
              <div
                className="mx-auto rounded-3 d-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
                style={{ width: '50px', height: '50px', background: 'var(--gradient-primary)' }}
              >
                <i className="bi bi-key-fill fs-4"></i>
              </div>
              <h3 className="fw-bolder">Reset Password</h3>
              <p className="text-muted small">
                Enter your verified NexusStore email address to receive password recovery instructions.
              </p>
            </div>

            {statusState.text && (
              <div className={`alert alert-${statusState.type} rounded-3 small mb-4 d-flex align-items-center gap-2`}>
                <i className={`bi ${statusState.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}`}></i>
                <span>{statusState.text}</span>
              </div>
            )}

            {!submitted ? (
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="form-label small fw-bold">Email Address</label>
                  <input
                    type="email"
                    className="form-control py-2.5"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <div className="form-text small text-muted">
                    We will send an encrypted account verification link to this email address.
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary-gradient w-100 rounded-pill py-2.5 fw-bold mb-3 shadow-sm"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  ) : null}
                  {loading ? 'Processing Recovery...' : 'Send Recovery Instructions'}
                </button>
              </form>
            ) : (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center mb-4">
                <i className="bi bi-envelope-check-fill text-success fs-1 mb-2 d-block"></i>
                <h6 className="fw-bold mb-1">Check Your Email</h6>
                <p className="text-muted text-xs mb-3">
                  A reset token has been generated for <strong>{email}</strong>. For demonstration accounts, you can also sign in using the quick demo role buttons on the login screen.
                </p>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                  onClick={() => {
                    setSubmitted(false);
                    setStatusState({ type: '', text: '' });
                  }}
                >
                  Enter Different Email
                </button>
              </div>
            )}

            <div className="text-center small text-muted">
              Remember your password?{' '}
              <Link to="/login" className="text-primary fw-bold text-decoration-none">
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
