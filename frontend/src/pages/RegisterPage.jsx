import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    password_confirm: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  // Real-time password-strength calculation
  const passwordStrength = useMemo(() => {
    const pwd = formData.password;
    if (!pwd) return { score: 0, label: '', color: '', percent: 0, criteria: [] };

    let score = 0;
    const criteria = [
      { met: pwd.length >= 8, label: 'At least 8 characters' },
      { met: /[A-Z]/.test(pwd), label: 'Uppercase letter (A-Z)' },
      { met: /[0-9]/.test(pwd), label: 'Number (0-9)' },
      { met: /[^A-Za-z0-9]/.test(pwd), label: 'Special symbol (!@#$%^&*)' },
    ];

    criteria.forEach((c) => {
      if (c.met) score += 1;
    });

    const config = [
      { label: 'Very Weak', color: 'bg-danger', percent: 25 },
      { label: 'Weak', color: 'bg-warning', percent: 50 },
      { label: 'Moderate', color: 'bg-info', percent: 75 },
      { label: 'Strong', color: 'bg-success', percent: 100 },
    ];

    const current = config[Math.min(score, 4) - 1] || { label: 'Too Short', color: 'bg-danger', percent: 15 };
    return { score, label: current.label, color: current.color, percent: current.percent, criteria };
  }, [formData.password]);

  const passwordsMatch = !formData.password_confirm || formData.password === formData.password_confirm;

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.full_name.trim()) {
      setError('Please provide your full name.');
      return;
    }

    if (!formData.email.trim()) {
      setError('Please provide a valid email address.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (formData.password !== formData.password_confirm) {
      setError('Passwords do not match. Please re-enter your password confirmation.');
      return;
    }

    if (!termsAccepted) {
      setError('You must acknowledge and accept the Terms of Service and Privacy Policy to proceed.');
      return;
    }

    try {
      setLoading(true);
      await register({
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        password_confirm: formData.password_confirm,
        phone_number: formData.phone_number.trim(),
      });
      navigate('/customer/dashboard');
    } catch (err) {
      const errData = err.response?.data;
      if (errData && typeof errData === 'object') {
        const errorList = [];
        Object.entries(errData).forEach(([key, val]) => {
          const formattedKey = key === 'email' ? 'Email' : key === 'password' ? 'Password' : key;
          const msg = Array.isArray(val) ? val.join(' ') : String(val);
          errorList.push(`${formattedKey}: ${msg}`);
        });
        setError(errorList.join(' | ') || 'Registration failed.');
      } else if (err.request) {
        setError('Cannot connect to the server. Please verify Django backend is running.');
      } else {
        setError(err.message || 'An error occurred during account registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-11 col-sm-10 col-md-8 col-lg-6">
          <div className="card border-0 shadow-xl rounded-4 p-4 p-md-5 bg-white">
            {/* Header */}
            <div className="text-center mb-4">
              <div
                className="mx-auto rounded-3 d-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
                style={{ width: '52px', height: '52px', background: 'var(--gradient-primary)' }}
              >
                <i className="bi bi-person-plus-fill fs-4"></i>
              </div>
              <h3 className="fw-bolder text-slate-900 tracking-tight mb-1">Create Customer Account</h3>
              <p className="text-slate-500 text-xs mb-0">Join NexusStore for personalized AI shopping and verified receipts</p>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div className="alert alert-danger rounded-3 text-xs mb-4 d-flex align-items-start gap-2 border-danger border-opacity-25" role="alert">
                <i className="bi bi-exclamation-circle-fill text-danger fs-6 shrink-0 mt-0.5"></i>
                <div className="flex-grow-1">{error}</div>
                <button type="button" className="btn-close btn-sm p-1" onClick={() => setError('')} aria-label="Close"></button>
              </div>
            )}

            <form onSubmit={handleRegister} noValidate>
              {/* Full Name */}
              <div className="mb-3">
                <label className="form-label text-xs fw-bold text-slate-700" htmlFor="reg-fullname">
                  Full Name *
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                    <i className="bi bi-person"></i>
                  </span>
                  <input
                    id="reg-fullname"
                    type="text"
                    name="full_name"
                    className="form-control text-sm py-2"
                    placeholder="e.g. Abebe Bikila"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="mb-3">
                <label className="form-label text-xs fw-bold text-slate-700" htmlFor="reg-email">
                  Email Address *
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                    <i className="bi bi-envelope"></i>
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    name="email"
                    className="form-control text-sm py-2"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="email"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="form-text text-[11px] text-slate-400">
                  Used for order notifications, Chapa verification, and digital receipt delivery.
                </div>
              </div>

              {/* Phone Number */}
              <div className="mb-3">
                <label className="form-label text-xs fw-bold text-slate-700" htmlFor="reg-phone">
                  Phone Number
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                    <i className="bi bi-telephone"></i>
                  </span>
                  <input
                    id="reg-phone"
                    type="tel"
                    name="phone_number"
                    className="form-control text-sm py-2"
                    placeholder="+251 9..."
                    value={formData.phone_number}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-2">
                <label className="form-label text-xs fw-bold text-slate-700" htmlFor="reg-password">
                  Password * (Min 6 characters)
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                    <i className="bi bi-lock"></i>
                  </span>
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    className="form-control text-sm py-2"
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="new-password"
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

              {/* Password Strength Meter */}
              {formData.password && (
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-[11px] text-slate-500">Password Strength:</span>
                    <span className={`badge ${passwordStrength.color} text-white text-[10px] px-2 py-0.5`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="progress" style={{ height: '4px' }}>
                    <div
                      className={`progress-bar ${passwordStrength.color}`}
                      style={{ width: `${passwordStrength.percent}%`, transition: 'width 0.3s' }}
                    ></div>
                  </div>
                  <div className="row g-1 mt-1 text-[11px] text-slate-500">
                    {passwordStrength.criteria.map((c, idx) => (
                      <div key={idx} className="col-6 d-flex align-items-center gap-1">
                        <i className={`bi ${c.met ? 'bi-check-circle-fill text-success' : 'bi-circle text-slate-300'}`}></i>
                        <span>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              <div className="mb-3">
                <label className="form-label text-xs fw-bold text-slate-700" htmlFor="reg-password-confirm">
                  Confirm Password *
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                    <i className="bi bi-shield-check"></i>
                  </span>
                  <input
                    id="reg-password-confirm"
                    type={showPasswordConfirm ? 'text' : 'password'}
                    name="password_confirm"
                    className={`form-control text-sm py-2 ${!passwordsMatch ? 'is-invalid' : ''}`}
                    placeholder="Repeat your password"
                    value={formData.password_confirm}
                    onChange={handleChange}
                    autoComplete="new-password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary border-slate-200 text-slate-500"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    tabIndex={-1}
                    aria-label={showPasswordConfirm ? 'Hide password' : 'Show password'}
                  >
                    <i className={`bi ${showPasswordConfirm ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                  </button>
                </div>
                {!passwordsMatch && (
                  <div className="invalid-feedback d-block text-[11px]">
                    Passwords do not match.
                  </div>
                )}
              </div>

              {/* Terms and Privacy Policy Acknowledgement */}
              <div className="mb-4 form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="terms-check"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  required
                />
                <label className="form-check-label text-xs text-slate-600 user-select-none" htmlFor="terms-check">
                  I acknowledge and agree to the{' '}
                  <Link to="/terms" target="_blank" className="text-primary fw-semibold hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" target="_blank" className="text-primary fw-semibold hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </label>
              </div>

              {/* Sign Up Button with loading and disabled states */}
              <button
                type="submit"
                className="btn btn-primary-gradient w-100 rounded-pill py-2.5 fw-bold text-sm mb-3 shadow-md d-flex align-items-center justify-content-center gap-2"
                disabled={
                  loading ||
                  !formData.full_name.trim() ||
                  !formData.email.trim() ||
                  !formData.password ||
                  !termsAccepted ||
                  !passwordsMatch
                }
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span>Creating your account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Customer Account</span>
                    <i className="bi bi-arrow-right"></i>
                  </>
                )}
              </button>
            </form>

            {/* Link to Sign In */}
            <div className="text-center text-xs text-slate-500 pt-3 border-top border-slate-100">
              Already have an account?{' '}
              <Link to="/login" className="text-primary fw-bold text-decoration-none hover:underline">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
