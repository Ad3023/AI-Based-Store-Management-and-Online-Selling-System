import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    password_confirm: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

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
      setError('Passwords do not match. Please verify both passwords.');
      return;
    }

    if (!termsAccepted) {
      setError('Please agree to the Terms of Service and Privacy Policy to proceed.');
      return;
    }

    try {
      setLoading(true);
      await register({
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        password_confirm: formData.password_confirm,
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

  const handleGoogleToken = async (credential) => {
    try {
      setLoading(true);
      setError('');
      await loginWithGoogle(credential);
      navigate('/customer/dashboard');
    } catch (authErr) {
      const msg = authErr.response?.data?.error || authErr.response?.data?.detail || 'Google registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f4f6fa', minHeight: 'calc(100vh - 120px)' }} className="d-flex align-items-center py-4 py-md-5">
      <div className="container" style={{ maxWidth: '980px' }}>
        <div className="card ethio-card border-0 shadow-lg overflow-hidden" style={{ borderRadius: '1.25rem' }}>
          <div className="row g-0">
            
            {/* Left Panel - Image & Welcome Message (Screenshot 3) */}
            <div
              className="col-lg-5 p-4 p-md-5 d-flex flex-column justify-content-between text-white position-relative"
              style={{
                backgroundColor: '#0b1a2d',
                background: 'linear-gradient(145deg, #0b1a2d 0%, #0d2745 100%)',
              }}
            >
              <div>
                {/* Brand Header */}
                <div className="d-flex align-items-center gap-2 mb-4">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-white"
                    style={{ width: '38px', height: '38px', backgroundColor: '#1b64da' }}
                  >
                    <i className="bi bi-cart3 fs-5"></i>
                  </div>
                  <div>
                    <h5 className="fw-bolder mb-0 text-white tracking-tight lh-1">
                      EthioTech <span style={{ color: '#60a5fa' }}>Market</span>
                    </h5>
                    <small className="text-slate-400" style={{ fontSize: '0.65rem' }}>
                      Better Tech. Brighter Future.
                    </small>
                  </div>
                </div>

                <div className="text-center my-4">
                  <img
                    src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80"
                    alt="Premium Audio Headphones"
                    className="img-fluid rounded-4 shadow-md"
                    style={{ maxHeight: '200px', objectFit: 'cover' }}
                  />
                </div>

                <h4 className="fw-bold mb-2 text-white">Join EthioTech Market</h4>
                <p className="text-slate-300 text-xs mb-0" style={{ lineHeight: '1.6' }}>
                  Create your free customer account and enjoy personalized AI recommendations, official warranty claims, and secure Chapa checkout.
                </p>
              </div>

              {/* Bottom Security Note */}
              <div className="pt-3 border-top border-white border-opacity-10 text-slate-400 text-xs">
                <i className="bi bi-shield-lock-fill text-primary me-1"></i>
                All public registrations default to verified customer accounts.
              </div>
            </div>

            {/* Right Panel - Registration Form (Screenshot 3) */}
            <div className="col-lg-7 p-4 p-md-5 bg-white d-flex flex-column justify-content-center">
              <div style={{ maxWidth: '440px', margin: '0 auto', width: '100%' }}>
                
                <h3 className="fw-bolder text-slate-900 mb-1" style={{ letterSpacing: '-0.02em' }}>
                  Create Account
                </h3>
                <p className="text-muted text-xs mb-4">
                  Start your journey with us in just a few seconds
                </p>

                {/* Error Alert */}
                {error && (
                  <div className="alert alert-danger rounded-3 text-xs mb-3 d-flex align-items-start gap-2 border-danger border-opacity-25" role="alert">
                    <i className="bi bi-exclamation-triangle-fill text-danger fs-6 shrink-0 mt-0.5"></i>
                    <div>{error}</div>
                  </div>
                )}

                <form onSubmit={handleRegister}>
                  {/* Full Name */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                      Full name
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-person"></i>
                      </span>
                      <input
                        type="text"
                        name="full_name"
                        className="form-control text-sm bg-slate-50 border-start-0 ps-0"
                        placeholder="Enter your full name"
                        value={formData.full_name}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                      Email address
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-envelope"></i>
                      </span>
                      <input
                        type="email"
                        name="email"
                        className="form-control text-sm bg-slate-50 border-start-0 ps-0"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                      Password
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-lock"></i>
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        className="form-control text-sm bg-slate-50 border-start-0 border-end-0 ps-0"
                        placeholder="Create a password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        minLength={6}
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

                  {/* Confirm Password */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                      Confirm password
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                        <i className="bi bi-lock-fill"></i>
                      </span>
                      <input
                        type={showPasswordConfirm ? 'text' : 'password'}
                        name="password_confirm"
                        className="form-control text-sm bg-slate-50 border-start-0 border-end-0 ps-0"
                        placeholder="Confirm your password"
                        value={formData.password_confirm}
                        onChange={handleChange}
                        required
                        minLength={6}
                      />
                      <button
                        className="input-group-text bg-slate-50 border-start-0 text-muted"
                        type="button"
                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                        aria-label={showPasswordConfirm ? 'Hide password' : 'Show password'}
                      >
                        <i className={`bi ${showPasswordConfirm ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  {/* Terms & Conditions */}
                  <div className="mb-4">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="termsCheckbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                      />
                      <label className="form-check-label text-xs text-slate-600" htmlFor="termsCheckbox">
                        I agree to the <Link to="/terms" className="text-primary text-decoration-none">Terms</Link> and <Link to="/privacy" className="text-primary text-decoration-none">Privacy Policy</Link>
                      </label>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-ethio-primary w-100 py-2.5 fw-bold text-sm shadow-sm mb-3"
                    style={{ backgroundColor: '#1b64da', color: '#ffffff', borderRadius: '0.5rem' }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>

                  {/* Google OAuth Option */}
                  <div className="d-flex align-items-center my-2.5">
                    <hr className="flex-grow-1 border-slate-200 my-0" />
                    <span className="px-2.5 text-slate-400 text-[11px] text-uppercase font-semibold">or</span>
                    <hr className="flex-grow-1 border-slate-200 my-0" />
                  </div>

                  <GoogleSignInButton
                    text="signup_with"
                    buttonId="register-with-google-btn"
                    onSuccess={handleGoogleToken}
                    onError={(err) => {
                      const msg = typeof err === 'string' ? err : err?.message || 'Google registration was not completed.';
                      setError(msg);
                    }}
                    disabled={loading}
                  />
                </form>

                {/* Footer Link: Sign In */}
                <div className="text-center mt-3 pt-1">
                  <span className="text-muted text-xs me-1">Already have an account?</span>
                  <Link to="/login" className="text-primary fw-bold text-xs text-decoration-none">
                    Sign in
                  </Link>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
