import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import api from '../api';
import { validateEmail, validatePhone } from '../utils/validation';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    confirm_password: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    const pwd = formData.password;
    if (!pwd) return { score: 0, label: '', color: '', percent: 0 };

    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) {
      return { score: 1, label: 'Weak', color: '#ef4444', percent: 25 };
    } else if (score === 2) {
      return { score: 2, label: 'Fair', color: '#f59e0b', percent: 50 };
    } else if (score <= 4) {
      return { score: 3, label: 'Good', color: '#3b82f6', percent: 75 };
    } else {
      return { score: 4, label: 'Strong', color: '#10b981', percent: 100 };
    }
  }, [formData.password]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (error) setError('');
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required.';
    }

    const emailRes = validateEmail(formData.email, true);
    if (!emailRes.isValid) {
      errors.email = emailRes.error;
    }

    const phoneRes = validatePhone(formData.phone_number, true);
    if (!phoneRes.isValid) {
      errors.phone_number = phoneRes.error;
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    if (!formData.confirm_password) {
      errors.confirm_password = 'Please confirm your password.';
    } else if (formData.password !== formData.confirm_password) {
      errors.confirm_password = 'Passwords do not match.';
    }

    if (!termsAccepted) {
      errors.terms = 'You must agree to the Terms and Conditions to create an account.';
    }

    return errors;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError('Please resolve the errors highlighted below.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('auth/register/', {
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone_number: validatePhone(formData.phone_number, true).formatted || formData.phone_number.trim(),
        password: formData.password,
        confirm_password: formData.confirm_password,
        password_confirm: formData.confirm_password,
        terms_accepted: true,
      });

      const userEmail = encodeURIComponent(formData.email.trim().toLowerCase());
      const maskedEmail = res.data?.masked_email
        ? `&masked=${encodeURIComponent(res.data.masked_email)}`
        : '';
      navigate(`/verify-email?email=${userEmail}${maskedEmail}&email_sent=true`);
    } catch (err) {
      const errData = err.response?.data;
      if (err.response?.status === 503 && errData?.requires_verification) {
        // Account was created, but email dispatch failed
        const userEmail = encodeURIComponent(formData.email.trim().toLowerCase());
        const maskedEmail = errData?.masked_email
          ? `&masked=${encodeURIComponent(errData.masked_email)}`
          : '';
        const errMsg = encodeURIComponent(errData.error || 'We could not send the verification email at this time.');
        navigate(`/verify-email?email=${userEmail}${maskedEmail}&email_sent=false&error=${errMsg}`);
        return;
      }

      if (errData && typeof errData === 'object') {
        const newFieldErrors = {};
        const errorList = [];
        Object.entries(errData).forEach(([key, val]) => {
          const msg = Array.isArray(val) ? val.join(' ') : String(val);
          if (
            ['full_name', 'email', 'phone_number', 'password', 'confirm_password', 'password_confirm'].includes(key)
          ) {
            newFieldErrors[key === 'password_confirm' ? 'confirm_password' : key] = msg;
          } else {
            errorList.push(msg);
          }
        });
        setFieldErrors(newFieldErrors);
        setError(
          errorList.join(' | ') ||
            (Object.keys(newFieldErrors).length > 0
              ? 'Please correct the highlighted fields.'
              : 'Registration failed. Please check your information.')
        );
      } else if (err.request) {
        setError('Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'An error occurred during account registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleToken = async (credential) => {
    try {
      setLoading(true);
      setError('');
      await loginWithGoogle(credential);
      navigate('/customer/dashboard');
    } catch (authErr) {
      const msg =
        authErr.response?.data?.error ||
        authErr.response?.data?.detail ||
        'Google registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ backgroundColor: '#f4f6fa', minHeight: 'calc(100vh - 120px)' }}
      className="d-flex align-items-center py-4 py-md-5"
    >
      <div className="container" style={{ maxWidth: '960px' }}>
        {/* Navigation Breadcrumb and Sign In Switch */}
        <div className="d-flex justify-content-between align-items-center mb-3 px-1 text-xs">
          <div className="d-flex align-items-center gap-2 text-slate-500">
            <Link to="/" className="text-decoration-none text-slate-600 hover-text-blue d-flex align-items-center gap-1">
              <i className="bi bi-house-door"></i> Home
            </Link>
            <span className="text-slate-400">/</span>
            <span className="fw-semibold text-slate-800">Register</span>
          </div>

          <div>
            <Link
              to="/login"
              className="text-decoration-none text-slate-600 hover-text-blue d-inline-flex align-items-center gap-1 fw-semibold"
            >
              <span>Already registered?</span>
              <span className="text-success fw-bold">Sign In &rarr;</span>
            </Link>
          </div>
        </div>

        {/* Main Registration Card */}
        <div className="card ethio-card border-0 shadow-lg overflow-hidden bg-white" style={{ borderRadius: '1.25rem' }}>
          <div className="row g-0">
            {/* Left Panel - Shopping Imagery & Customer Perks */}
            <div
              className="col-lg-5 p-4 p-md-5 d-flex flex-column justify-content-between text-white position-relative overflow-hidden"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(11, 26, 45, 0.78) 0%, rgba(12, 35, 64, 0.94) 100%), url('/customer_login_shopping.jpg')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                minHeight: '560px',
              }}
            >
              <div className="position-relative z-1">
                {/* Brand Header */}
                <div className="d-flex align-items-center gap-2 mb-4">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-white shadow"
                    style={{ width: '40px', height: '40px', backgroundColor: '#10b981' }}
                  >
                    <i className="bi bi-cpu-fill fs-5"></i>
                  </div>
                  <div>
                    <h5 className="fw-bolder mb-0 text-white tracking-tight lh-1">
                      EthioTech <span style={{ color: '#34d399' }}>Market</span>
                    </h5>
                    <small className="text-slate-300 text-[11px]">
                      Better Tech. Brighter Future.
                    </small>
                  </div>
                </div>

                <h3 className="fw-bolder mb-2 text-white" style={{ lineHeight: '1.3' }}>
                  Create Customer Account
                </h3>
                <p className="text-slate-200 text-xs mb-4" style={{ lineHeight: '1.6' }}>
                  Join thousands of shoppers across Ethiopia enjoying authentic electronics, digital Chapa payments, and verified local warranty.
                </p>

                {/* 3 Customer Value Props */}
                <div className="d-flex flex-column gap-3 mb-4">
                  <div
                    className="d-flex align-items-start gap-3 p-2.5 rounded-3"
                    style={{ background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(8px)' }}
                  >
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: 'rgba(16, 185, 129, 0.35)',
                        color: '#34d399',
                      }}
                    >
                      <i className="bi bi-patch-check fw-bold"></i>
                    </div>
                    <div>
                      <div className="fw-bold text-sm text-white">Genuine Tech &amp; Warranty</div>
                      <small className="text-slate-200 text-xs">
                        Official manufacturer warranty on all tech purchases.
                      </small>
                    </div>
                  </div>

                  <div
                    className="d-flex align-items-start gap-3 p-2.5 rounded-3"
                    style={{ background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(8px)' }}
                  >
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: 'rgba(59, 130, 246, 0.35)',
                        color: '#93c5fd',
                      }}
                    >
                      <i className="bi bi-truck fw-bold"></i>
                    </div>
                    <div>
                      <div className="fw-bold text-sm text-white">Fast Doorstep Delivery</div>
                      <small className="text-slate-200 text-xs">
                        Prompt dispatch across Addis Ababa and regional hubs.
                      </small>
                    </div>
                  </div>

                  <div
                    className="d-flex align-items-start gap-3 p-2.5 rounded-3"
                    style={{ background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(8px)' }}
                  >
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: 'rgba(245, 158, 11, 0.35)',
                        color: '#fcd34d',
                      }}
                    >
                      <i className="bi bi-shield-lock-fill fw-bold"></i>
                    </div>
                    <div>
                      <div className="fw-bold text-sm text-white">Secure OTP Verification</div>
                      <small className="text-slate-200 text-xs">
                        Protected account activation with 6-digit email OTP.
                      </small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Security Note */}
              <div className="pt-3 border-top border-white border-opacity-20 text-slate-200 text-xs d-flex justify-content-between align-items-center position-relative z-1 flex-wrap gap-2">
                <span>Already have an account?</span>
                <Link
                  to="/login"
                  className="text-info fw-bold text-decoration-none bg-black bg-opacity-30 px-2.5 py-1 rounded-pill"
                >
                  Sign In &rarr;
                </Link>
              </div>
            </div>

            {/* Right Panel - Customer Registration Form */}
            <div className="col-lg-7 p-4 p-md-5 bg-white d-flex flex-column justify-content-center">
              <div style={{ maxWidth: '440px', margin: '0 auto', width: '100%' }}>
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <h3 className="fw-bolder text-slate-900 mb-0" style={{ letterSpacing: '-0.02em' }}>
                    Create Account
                  </h3>
                  <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2.5 py-1 text-[11px] fw-bold">
                    Customer Role
                  </span>
                </div>
                <p className="text-muted text-xs mb-4">
                  Fill in your details below to set up your customer account.
                </p>

                {/* Error Alert */}
                {error && (
                  <div
                    className="alert alert-danger rounded-3 text-xs mb-3 d-flex align-items-start gap-2 border-danger border-opacity-25"
                    role="alert"
                  >
                    <i className="bi bi-exclamation-triangle-fill text-danger fs-6 shrink-0 mt-0.5"></i>
                    <div>{error}</div>
                  </div>
                )}

                <form onSubmit={handleRegister} noValidate>
                  {/* Full Name */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1" htmlFor="regFullName">
                      Full Name <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-person"></i>
                      </span>
                      <input
                        id="regFullName"
                        type="text"
                        name="full_name"
                        className={`form-control text-sm bg-slate-50 border-start-0 ps-0 ${
                          fieldErrors.full_name ? 'is-invalid' : ''
                        }`}
                        placeholder="e.g. Abebe Bikila"
                        value={formData.full_name}
                        onChange={handleChange}
                        required
                        disabled={loading}
                      />
                    </div>
                    {fieldErrors.full_name && (
                      <div className="text-danger text-[11px] mt-1 fw-semibold">
                        <i className="bi bi-exclamation-circle me-1"></i>
                        {fieldErrors.full_name}
                      </div>
                    )}
                  </div>

                  {/* Email Address */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1" htmlFor="regEmail">
                      Email Address <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-envelope"></i>
                      </span>
                      <input
                        id="regEmail"
                        type="email"
                        name="email"
                        className={`form-control text-sm bg-slate-50 border-start-0 ps-0 ${
                          fieldErrors.email ? 'is-invalid' : ''
                        }`}
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        autoComplete="email"
                        required
                        disabled={loading}
                      />
                    </div>
                    {fieldErrors.email && (
                      <div className="text-danger text-[11px] mt-1 fw-semibold">
                        <i className="bi bi-exclamation-circle me-1"></i>
                        {fieldErrors.email}
                        {fieldErrors.email.toLowerCase().includes('unverified') && (
                          <div className="mt-1.5">
                            <Link
                              to={`/verify-email?email=${encodeURIComponent(formData.email.trim())}`}
                              className="btn btn-sm btn-outline-danger rounded-pill px-3 py-1 text-[11px] fw-bold d-inline-flex align-items-center gap-1 shadow-sm"
                            >
                              <i className="bi bi-shield-check"></i> Verify Email Now &rarr;
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1" htmlFor="regPhone">
                      Phone Number <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-telephone"></i>
                      </span>
                      <input
                        id="regPhone"
                        type="tel"
                        name="phone_number"
                        className={`form-control text-sm bg-slate-50 border-start-0 ps-0 ${
                          fieldErrors.phone_number ? 'is-invalid' : ''
                        }`}
                        placeholder="0911223344 or +251911223344"
                        value={formData.phone_number}
                        onChange={handleChange}
                        autoComplete="tel"
                        required
                        disabled={loading}
                      />
                    </div>
                    {fieldErrors.phone_number ? (
                      <div className="text-danger text-[11px] mt-1 fw-semibold">
                        <i className="bi bi-exclamation-circle me-1"></i>
                        {fieldErrors.phone_number}
                      </div>
                    ) : (
                      <div className="form-text text-[11px] text-slate-400 mt-1">
                        Format: Ethiopian mobile (09/07...) or international (+251...)
                      </div>
                    )}
                  </div>

                  {/* Password with Strength Guidance */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1" htmlFor="regPassword">
                      Password <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-lock"></i>
                      </span>
                      <input
                        id="regPassword"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        className={`form-control text-sm bg-slate-50 border-start-0 border-end-0 ps-0 ${
                          fieldErrors.password ? 'is-invalid' : ''
                        }`}
                        placeholder="Minimum 6 characters"
                        value={formData.password}
                        onChange={handleChange}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        disabled={loading}
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

                    {/* Password Strength Meter */}
                    {formData.password && (
                      <div className="mt-2">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-[11px] text-slate-500">Password Strength:</span>
                          <span
                            className="text-[11px] fw-bold font-monospace"
                            style={{ color: passwordStrength.color }}
                          >
                            {passwordStrength.label}
                          </span>
                        </div>
                        <div className="progress" style={{ height: '4px' }}>
                          <div
                            className="progress-bar transition"
                            role="progressbar"
                            style={{
                              width: `${passwordStrength.percent}%`,
                              backgroundColor: passwordStrength.color,
                            }}
                            aria-valuenow={passwordStrength.percent}
                            aria-valuemin="0"
                            aria-valuemax="100"
                          ></div>
                        </div>
                      </div>
                    )}

                    {fieldErrors.password && (
                      <div className="text-danger text-[11px] mt-1 fw-semibold">
                        <i className="bi bi-exclamation-circle me-1"></i>
                        {fieldErrors.password}
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1" htmlFor="regConfirmPassword">
                      Confirm Password <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-lock-fill"></i>
                      </span>
                      <input
                        id="regConfirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirm_password"
                        className={`form-control text-sm bg-slate-50 border-start-0 border-end-0 ps-0 ${
                          fieldErrors.confirm_password ? 'is-invalid' : ''
                        }`}
                        placeholder="Re-enter your password"
                        value={formData.confirm_password}
                        onChange={handleChange}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        disabled={loading}
                      />
                      <button
                        className="input-group-text bg-slate-50 border-start-0 text-muted"
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>

                    {/* Matching indicator */}
                    {formData.confirm_password && (
                      <div className="mt-1 text-[11px]">
                        {formData.password === formData.confirm_password ? (
                          <span className="text-success fw-semibold">
                            <i className="bi bi-check-circle-fill me-1"></i> Passwords match
                          </span>
                        ) : (
                          <span className="text-danger fw-semibold">
                            <i className="bi bi-x-circle-fill me-1"></i> Passwords do not match
                          </span>
                        )}
                      </div>
                    )}

                    {fieldErrors.confirm_password && (
                      <div className="text-danger text-[11px] mt-1 fw-semibold">
                        <i className="bi bi-exclamation-circle me-1"></i>
                        {fieldErrors.confirm_password}
                      </div>
                    )}
                  </div>

                  {/* Terms & Conditions Checkbox */}
                  <div className="mb-4">
                    <div className="form-check">
                      <input
                        className={`form-check-input ${fieldErrors.terms ? 'is-invalid' : ''}`}
                        type="checkbox"
                        id="termsCheckbox"
                        checked={termsAccepted}
                        onChange={(e) => {
                          setTermsAccepted(e.target.checked);
                          if (fieldErrors.terms) {
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next.terms;
                              return next;
                            });
                          }
                        }}
                        disabled={loading}
                      />
                      <label className="form-check-label text-xs text-slate-600" htmlFor="termsCheckbox">
                        I agree to the{' '}
                        <button
                          type="button"
                          className="btn btn-link p-0 text-primary text-decoration-none fw-semibold text-xs align-baseline"
                          onClick={() => setShowTermsModal(true)}
                        >
                          Terms and Conditions
                        </button>{' '}
                        and{' '}
                        <button
                          type="button"
                          className="btn btn-link p-0 text-primary text-decoration-none fw-semibold text-xs align-baseline"
                          onClick={() => setShowPrivacyModal(true)}
                        >
                          Privacy Policy
                        </button>{' '}
                        <span className="text-danger">*</span>
                      </label>
                    </div>
                    {fieldErrors.terms && (
                      <div className="text-danger text-[11px] mt-1 fw-semibold">
                        <i className="bi bi-exclamation-circle me-1"></i>
                        {fieldErrors.terms}
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    id="registerSubmitBtn"
                    type="submit"
                    disabled={loading}
                    className="btn w-100 py-2.5 fw-bold text-sm shadow-sm mb-3 text-white transition"
                    style={{ backgroundColor: '#10b981', borderColor: '#10b981', borderRadius: '0.5rem' }}
                  >
                    {loading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Creating Customer Account...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-person-check-fill me-1.5"></i> Create Account
                      </>
                    )}
                  </button>

                  {/* Google OAuth Option */}
                  <div className="d-flex align-items-center my-2.5">
                    <hr className="flex-grow-1 border-slate-200 my-0" />
                    <span className="px-2.5 text-slate-400 text-[11px] text-uppercase font-semibold">
                      or sign up with
                    </span>
                    <hr className="flex-grow-1 border-slate-200 my-0" />
                  </div>

                  <GoogleSignInButton
                    text="signup_with"
                    buttonId="register-with-google-btn"
                    onSuccess={handleGoogleToken}
                    onError={(err) => {
                      const msg =
                        typeof err === 'string'
                          ? err
                          : err?.message || 'Google registration was not completed.';
                      setError(msg);
                    }}
                    disabled={loading}
                  />
                </form>

                {/* Footer Navigation */}
                <div className="text-center mt-3 pt-1">
                  <span className="text-muted text-xs me-1">Already have an account?</span>
                  <Link to="/login" className="text-success fw-bold text-xs text-decoration-none">
                    Customer Login &rarr;
                  </Link>
                </div>

                <div className="text-center mt-2">
                  <Link to="/" className="text-muted text-xs text-decoration-none">
                    <i className="bi bi-arrow-left me-1"></i> Back to Homepage
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)', zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-file-text me-2 text-primary"></i>
                  EthioTech Market Terms &amp; Conditions
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowTermsModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body text-slate-700 text-xs" style={{ lineHeight: '1.6' }}>
                <h6 className="fw-bold text-slate-900">1. Customer Account &amp; Verification</h6>
                <p>
                  By creating an account with EthioTech Market, you confirm that the information you provide is accurate
                  and current. All customer accounts require email OTP verification before activation.
                </p>
                <h6 className="fw-bold text-slate-900">2. Security &amp; Passwords</h6>
                <p>
                  You are responsible for maintaining the confidentiality of your account credentials. EthioTech Market
                  will never ask for your password or raw verification codes.
                </p>
                <h6 className="fw-bold text-slate-900">3. Orders, Payments &amp; Delivery</h6>
                <p>
                  Orders placed on the platform are processed using official Chapa digital payment channels (Telebirr,
                  CBE Birr, bank cards). Deliveries are dispatched to your designated shipping address in accordance with
                  our delivery guidelines.
                </p>
                <h6 className="fw-bold text-slate-900">4. Warranty &amp; Authenticity</h6>
                <p>
                  All tech products listed on EthioTech Market carry genuine manufacturer warranty as detailed in each
                  product's description.
                </p>
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-4 fw-bold rounded-pill"
                  onClick={() => {
                    setTermsAccepted(true);
                    setShowTermsModal(false);
                  }}
                >
                  I Understand &amp; Agree
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)', zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-shield-check me-2 text-success"></i>
                  EthioTech Market Privacy Policy
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPrivacyModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body text-slate-700 text-xs" style={{ lineHeight: '1.6' }}>
                <h6 className="fw-bold text-slate-900">Data Protection &amp; Confidentiality</h6>
                <p>
                  EthioTech Market values your privacy. We collect your name, email, and phone number solely to
                  authenticate your account, fulfill orders, process payments securely, and notify you regarding shipments.
                </p>
                <h6 className="fw-bold text-slate-900">No Third-Party Sharing</h6>
                <p>
                  We never sell or disclose your personal data to unauthorized third parties. All sensitive credentials
                  and verification codes are encrypted and hashed using enterprise standards.
                </p>
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm px-4 fw-bold rounded-pill"
                  onClick={() => setShowPrivacyModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterPage;
