import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import api from '../api';

const UnsubscribePage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const isVerificationMode = location.pathname.includes('/newsletter/verify');
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [loading, setLoading] = useState(false);
  const [statusState, setStatusState] = useState({ type: '', text: '' });
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    // If token is present in URL, auto-process
    if (token) {
      if (isVerificationMode) {
        handleVerifyNewsletter(token);
      } else {
        handleUnsubscribeWithToken(token);
      }
    }
  }, [token, isVerificationMode]);

  const handleVerifyNewsletter = async (verificationToken) => {
    try {
      setLoading(true);
      setStatusState({ type: '', text: '' });
      const res = await api.get(`notifications/newsletter/verify/?token=${encodeURIComponent(verificationToken)}`);
      setCompleted(true);
      setStatusState({
        type: 'success',
        text: res.data.message || 'Your email has been confirmed! You are now subscribed to EthioTech Market promotions.',
      });
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Invalid or expired confirmation link.';
      setStatusState({ type: 'danger', text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribeWithToken = async (unsubToken) => {
    try {
      setLoading(true);
      setStatusState({ type: '', text: '' });
      const res = await api.post('notifications/newsletter/unsubscribe/', { token: unsubToken });
      setCompleted(true);
      setStatusState({
        type: 'success',
        text: res.data.message || 'You have been successfully unsubscribed from marketing and promotional emails.',
      });
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to process unsubscribe request.';
      setStatusState({ type: 'danger', text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleManualUnsubscribe = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setStatusState({ type: 'danger', text: 'Please enter your email address.' });
      return;
    }
    try {
      setLoading(true);
      setStatusState({ type: '', text: '' });
      const res = await api.post('notifications/newsletter/unsubscribe/', { email: email.trim().toLowerCase() });
      setCompleted(true);
      setStatusState({
        type: 'success',
        text: res.data.message || 'You have been successfully unsubscribed.',
      });
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Subscriber record not found.';
      setStatusState({ type: 'danger', text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-11 col-sm-10 col-md-8 col-lg-5">
          <div className="card border-0 shadow-xl rounded-4 p-4 p-md-5 bg-white text-center">
            {/* Header Icon */}
            <div
              className="mx-auto rounded-3 d-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
              style={{
                width: '56px',
                height: '56px',
                background: isVerificationMode
                  ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                  : 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
              }}
            >
              <i className={`bi ${isVerificationMode ? 'bi-envelope-check-fill' : 'bi-envelope-x-fill'} fs-3`}></i>
            </div>

            <h3 className="fw-bolder text-slate-900 tracking-tight mb-1">
              {isVerificationMode ? 'Confirm Newsletter Subscription' : 'Newsletter Preferences'}
            </h3>
            <p className="text-slate-500 text-xs mb-4">
              {isVerificationMode
                ? 'Thank you for confirming your subscription to EthioTech Market promotions.'
                : 'Manage your marketing email preferences or opt out of promotional broadcasts.'}
            </p>

            {/* Status Alert */}
            {statusState.text && (
              <div
                className={`alert alert-${statusState.type} rounded-3 text-xs mb-4 d-flex align-items-start gap-2 border-${statusState.type} border-opacity-25 text-start`}
                role="alert"
              >
                <i
                  className={`bi ${
                    statusState.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-circle-fill text-danger'
                  } fs-6 shrink-0 mt-0.5`}
                ></i>
                <div className="flex-grow-1">{statusState.text}</div>
              </div>
            )}

            {completed ? (
              <div className="pt-2">
                <Link to="/" className="btn btn-ethio-primary rounded-pill px-4 py-2 text-xs fw-bold">
                  Return to EthioTech Market Storefront &rarr;
                </Link>
              </div>
            ) : !isVerificationMode ? (
              <form onSubmit={handleManualUnsubscribe}>
                <div className="mb-3 text-start">
                  <label className="form-label text-xs fw-bold text-slate-700" htmlFor="unsub-email">
                    Email Address to Unsubscribe
                  </label>
                  <input
                    id="unsub-email"
                    type="email"
                    className="form-control text-sm py-2"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-outline-danger w-100 py-2.5 fw-bold text-xs rounded-pill shadow-sm mb-3"
                  disabled={loading || !email.trim()}
                >
                  {loading ? 'Processing...' : 'Unsubscribe from Promotional Emails'}
                </button>

                <div className="text-center mt-3">
                  <Link to="/" className="text-slate-500 text-xs text-decoration-none">
                    Cancel & Return Home
                  </Link>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnsubscribePage;
