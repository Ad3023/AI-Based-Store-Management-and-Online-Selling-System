import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const isStaff = searchParams.get('portal') === 'staff';
  const navigate = useNavigate();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const isFromEmailLink = Boolean(searchParams.get('token'));
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Live password strength feedback
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: '', color: '', percent: 0 };
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    const config = [
      { label: 'Very Weak', color: 'bg-danger', percent: 25 },
      { label: 'Weak', color: 'bg-warning', percent: 50 },
      { label: 'Good', color: 'bg-info', percent: 75 },
      { label: 'Strong', color: 'bg-success', percent: 100 },
    ];
    return config[Math.min(score, 4) - 1] || { label: 'Too Short', color: 'bg-danger', percent: 15 };
  }, [newPassword]);

  const passwordsMatch = !newPasswordConfirm || newPassword === newPasswordConfirm;

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    if (!token.trim()) {
      setError('Please enter the 6-digit recovery OTP code sent to your Gmail inbox or open the reset link from your email.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must contain at least 6 characters.');
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setError('Passwords do not match. Please verify your confirmation password.');
      return;
    }

    try {
      setLoading(true);
      await api.post('auth/password-reset/confirm/', {
        email: email.trim().toLowerCase(),
        token: token.trim(),
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      });
      setSuccess(true);
    } catch (err) {
      const respData = err.response?.data;
      if (respData) {
        const msg =
          respData.error ||
          respData.detail ||
          respData.token?.[0] ||
          respData.new_password?.[0] ||
          'Failed to reset password. The token may be expired or invalid.';
        setError(msg);
      } else {
        setError('Network error. Unable to reach the server.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-11 col-sm-10 col-md-8 col-lg-5">
          <div className="card border-0 shadow-xl rounded-4 p-4 p-md-5 bg-white">
            {/* Header */}
            <div className="text-center mb-4">
              <div
                className="mx-auto rounded-3 d-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
                style={{ width: '52px', height: '52px', background: 'var(--gradient-primary)' }}
              >
                <i className="bi bi-shield-lock-fill fs-4"></i>
              </div>
              <h3 className="fw-bolder text-slate-900 tracking-tight mb-1">Set New Password</h3>
              <p className="text-slate-500 text-xs mb-0">Create a secure, updated password for your account</p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="alert alert-danger rounded-3 text-xs mb-4 d-flex align-items-start gap-2 border-danger border-opacity-25" role="alert">
                <i className="bi bi-exclamation-circle-fill text-danger fs-6 shrink-0 mt-0.5"></i>
                <div className="flex-grow-1">{error}</div>
                <button type="button" className="btn-close btn-sm p-1" onClick={() => setError('')} aria-label="Close"></button>
              </div>
            )}

            {/* Success State */}
            {success ? (
              <div className="text-center py-4">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center text-white shadow-lg mx-auto mb-3"
                  style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
                >
                  <i className="bi bi-check-lg fs-2"></i>
                </div>
                <h5 className="fw-bolder text-slate-900 mb-2">Password Successfully Reset!</h5>
                <p className="text-slate-500 text-xs mb-4">
                  Your credentials have been securely updated in the database. You can now sign in using your new password.
                </p>
                {isStaff ? (
                  <div className="d-flex flex-column gap-2">
                    <button
                      type="button"
                      className="btn rounded-pill px-4 py-2.5 fw-bold text-sm shadow-md text-white"
                      style={{ backgroundColor: '#0f766e', border: '1px solid #14b8a6' }}
                      onClick={() => navigate('/staff/login')}
                    >
                      <i className="bi bi-shield-lock-fill me-1.5"></i> Sign In to Staff Console &rarr;
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm rounded-pill py-1.5"
                      onClick={() => navigate('/login')}
                    >
                      Customer Login
                    </button>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    <button
                      type="button"
                      className="btn btn-primary-gradient rounded-pill px-4 py-2.5 fw-bold text-sm shadow-md"
                      onClick={() => navigate('/login')}
                    >
                      Proceed to Customer Sign In &rarr;
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm rounded-pill py-1.5"
                      onClick={() => navigate('/staff/login')}
                    >
                      Staff Portal Login
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleResetPassword} noValidate>
                {/* Email Address */}
                <div className="mb-3">
                  <label className="form-label text-xs fw-bold text-slate-700" htmlFor="reset-email">
                    Account Email
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
                </div>

                {/* Reset Token or 6-Digit OTP */}
                {isFromEmailLink ? (
                  <div className="alert alert-success d-flex align-items-center gap-2 p-2.5 rounded-3 mb-3 text-xs border-success border-opacity-25 bg-emerald-50 text-emerald-900">
                    <i className="bi bi-shield-check fs-5 text-success shrink-0"></i>
                    <div>
                      <span className="fw-bold d-block">Verified Reset Link from Gmail</span>
                      Your email recovery link has been verified. Enter your new password below.
                    </div>
                  </div>
                ) : (
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label text-xs fw-bold text-slate-700 mb-0" htmlFor="reset-token">
                        6-Digit Recovery Code (OTP) *
                      </label>
                      <span className="text-[11px] text-primary fw-semibold">Sent to Gmail</span>
                    </div>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                        <i className="bi bi-shield-lock-fill"></i>
                      </span>
                      <input
                        id="reset-token"
                        type="text"
                        className="form-control text-sm py-2 font-mono"
                        placeholder="Enter 6-digit code (e.g. 542918)"
                        value={token}
                        onChange={(e) => setToken(e.target.value.trim())}
                        required
                        disabled={loading}
                        maxLength={120}
                      />
                    </div>
                    <div className="form-text text-[11px] text-slate-500 mt-1">
                      <i className="bi bi-envelope-open me-1 text-primary"></i>
                      Enter the 6-digit verification code sent to your Gmail inbox, or click the direct link in the email.
                    </div>
                  </div>
                )}

                {/* New Password */}
                <div className="mb-2">
                  <label className="form-label text-xs fw-bold text-slate-700" htmlFor="reset-new-password">
                    New Password * (Min 6 characters)
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                      <i className="bi bi-lock"></i>
                    </span>
                    <input
                      id="reset-new-password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-control text-sm py-2"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary border-slate-200 text-slate-500"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                    </button>
                  </div>
                </div>

                {/* Strength Meter */}
                {newPassword && (
                  <div className="p-2 rounded-2xl bg-slate-50 border border-slate-200 mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-[11px] text-slate-500">Strength:</span>
                      <span className={`badge ${passwordStrength.color} text-white text-[10px] px-2 py-0.5`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="progress" style={{ height: '3px' }}>
                      <div
                        className={`progress-bar ${passwordStrength.color}`}
                        style={{ width: `${passwordStrength.percent}%`, transition: 'width 0.3s' }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Confirm New Password */}
                <div className="mb-4">
                  <label className="form-label text-xs fw-bold text-slate-700" htmlFor="reset-confirm-password">
                    Confirm New Password *
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                      <i className="bi bi-shield-check"></i>
                    </span>
                    <input
                      id="reset-confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      className={`form-control text-sm py-2 ${!passwordsMatch ? 'is-invalid' : ''}`}
                      placeholder="Confirm new password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary border-slate-200 text-slate-500"
                      onClick={() => setShowConfirm(!showConfirm)}
                      tabIndex={-1}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      <i className={`bi ${showConfirm ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                    </button>
                  </div>
                  {!passwordsMatch && (
                    <div className="invalid-feedback d-block text-[11px]">
                      Passwords do not match.
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="btn btn-primary-gradient w-100 rounded-pill py-2.5 fw-bold text-sm mb-3 shadow-md d-flex align-items-center justify-content-center gap-2"
                  disabled={loading || !email.trim() || !token.trim() || !newPassword || !passwordsMatch}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Saving new password...</span>
                    </>
                  ) : (
                    <>
                      <span>Set New Password</span>
                      <i className="bi bi-check-circle"></i>
                    </>
                  )}
                </button>

                <div className="text-center text-xs text-slate-500 pt-2 border-top border-slate-100">
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
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
