import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 600; // 10 minutes

const maskEmail = (emailStr) => {
  if (!emailStr || typeof emailStr !== 'string' || !emailStr.includes('@')) {
    return emailStr || '';
  }
  const [local, domain] = emailStr.split('@');
  if (local.length <= 2) {
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return `${local.slice(0, 3)}***@${domain}`;
};

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlEmail = searchParams.get('email') || '';
  const urlMasked = searchParams.get('masked') || '';
  const urlToken = searchParams.get('token') || '';
  const urlEmailSent = searchParams.get('email_sent') !== 'false';
  const urlError = searchParams.get('error') || '';

  const [email, setEmail] = useState(urlEmail.trim().toLowerCase());
  const [maskedEmail, setMaskedEmail] = useState(urlMasked || (urlEmail ? maskEmail(urlEmail) : ''));
  const [isEditingEmail, setIsEditingEmail] = useState(!urlEmail);
  const [emailSent, setEmailSent] = useState(urlEmailSent);

  // 6 separate OTP input boxes
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(OTP_EXPIRY_SECONDS);
  const [statusState, setStatusState] = useState({
    type: urlEmailSent ? '' : 'danger',
    text: urlError || (urlEmailSent ? '' : 'We could not send the verification email at this time. Please click "Resend Verification Code" below to dispatch your code.'),
  });
  const [verified, setVerified] = useState(false);

  // Sync masked email whenever email changes
  useEffect(() => {
    if (email) {
      setMaskedEmail(maskEmail(email));
    }
  }, [email]);

  // Resend cooldown timer (1 second ticks)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // OTP Expiry countdown timer (10 minutes)
  useEffect(() => {
    if (verified || expirySeconds <= 0) return;
    const interval = setInterval(() => {
      setExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [verified, expirySeconds]);

  // Auto-focus first empty OTP input on load
  useEffect(() => {
    if (!verified && !isEditingEmail) {
      const firstEmptyIndex = otpDigits.findIndex((d) => !d);
      const targetIndex = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
      inputRefs.current[targetIndex]?.focus();
    }
  }, [isEditingEmail, verified]);

  // Execute verification API call
  const performVerification = useCallback(
    async (codeToVerify, emailToVerify) => {
      const cleanEmail = (emailToVerify || email).trim().toLowerCase();
      const cleanCode = (codeToVerify || otpDigits.join('')).trim();

      if (!cleanEmail) {
        setStatusState({
          type: 'danger',
          text: 'Please provide your registered customer email address.',
        });
        setIsEditingEmail(true);
        return;
      }

      if (!cleanCode || cleanCode.length < OTP_LENGTH) {
        setStatusState({
          type: 'danger',
          text: 'Please enter all 6 digits of the verification code.',
        });
        return;
      }

      try {
        setLoading(true);
        setStatusState({ type: '', text: '' });

        const res = await api.post('auth/verify-email/', {
          email: cleanEmail,
          otp: cleanCode,
          code: cleanCode,
          token: cleanCode,
        });

        setVerified(true);
        setStatusState({
          type: 'success',
          text:
            res.data.message ||
            'Your EthioTech Market account has been activated. You can now sign in and start shopping.',
        });
      } catch (err) {
        const respData = err.response?.data;
        const errMsg =
          respData?.error ||
          respData?.detail ||
          respData?.non_field_errors?.[0] ||
          'Verification failed. The code may be incorrect, expired, or already used.';
        setStatusState({ type: 'danger', text: errMsg });
      } finally {
        setLoading(false);
      }
    },
    [email, otpDigits]
  );

  // Auto-verify if 6-digit or link token was passed in URL query param
  useEffect(() => {
    if (urlToken && urlEmail) {
      performVerification(urlToken, urlEmail);
    }
  }, [urlToken, urlEmail, performVerification]);

  // Handle single digit input
  const handleDigitChange = (index, value) => {
    const char = value.slice(-1);
    if (char && !/^\d$/.test(char)) return; // Only allow digits

    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);

    // Auto-advance to next input if digit entered
    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace / arrow navigation
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        // Current box is empty, jump to previous and clear it
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle paste of 6-digit code
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    const numericOnly = pasteData.replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!numericOnly) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < OTP_LENGTH; i++) {
      newDigits[i] = numericOnly[i] || '';
    }
    setOtpDigits(newDigits);

    // Focus last filled box or next empty box
    const nextIdx = Math.min(numericOnly.length, OTP_LENGTH - 1);
    inputRefs.current[nextIdx]?.focus();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    performVerification();
  };

  // Resend code handler
  const handleResend = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setStatusState({
        type: 'danger',
        text: 'Please enter your registered email address to resend the code.',
      });
      setIsEditingEmail(true);
      return;
    }

    try {
      setResending(true);
      setStatusState({ type: '', text: '' });

      const res = await api.post('auth/resend-otp/', {
        email: cleanEmail,
      });

      setEmailSent(true);
      setStatusState({
        type: 'success',
        text:
          res.data.message ||
          'A new 6-digit verification code has been sent to your email address.',
      });

      // Reset timers and inputs
      setResendCooldown(res.data.cooldown || 60);
      setExpirySeconds(OTP_EXPIRY_SECONDS);
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setEmailSent(false);
      const respData = err.response?.data;
      const errMsg =
        respData?.error ||
        respData?.detail ||
        'We could not send the verification email at this time. Please try again later.';
      setStatusState({ type: 'danger', text: errMsg });
      if (respData?.cooldown) {
        setResendCooldown(respData.cooldown);
      }
    } finally {
      setResending(false);
    }
  };

  // Format expiry seconds into MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  const isOtpComplete = otpDigits.every((d) => d !== '');

  return (
    <div
      style={{ backgroundColor: '#f4f6fa', minHeight: 'calc(100vh - 120px)' }}
      className="d-flex align-items-center py-5"
    >
      <div className="container" style={{ maxWidth: '560px' }}>
        <div className="card ethio-card border-0 shadow-lg rounded-4 p-4 p-md-5 bg-white">
          {/* Header */}
          <div className="text-center mb-4">
            <div
              className="mx-auto rounded-circle d-flex align-items-center justify-content-center text-white mb-3 shadow"
              style={{
                width: '64px',
                height: '64px',
                background: verified
                  ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                  : 'linear-gradient(135deg, #1b64da 0%, #00a8ff 100%)',
              }}
            >
              <i
                className={`bi ${
                  verified ? 'bi-check-circle-fill' : 'bi-envelope-check-fill'
                } fs-2`}
              ></i>
            </div>

            <h3 className="fw-bolder text-slate-900 tracking-tight mb-2">
              {verified ? 'Email Verified Successfully!' : 'Verify Your Email'}
            </h3>

            <p className="text-slate-600 text-sm mb-0 px-2" style={{ lineHeight: '1.5' }}>
              {verified
                ? 'Your EthioTech Market account has been activated. You can now sign in and start shopping.'
                : emailSent
                ? 'We have sent a verification code to your registered email address. Please enter the code below to verify your account.'
                : 'Your customer account is pending verification, but the verification email could not be delivered. Please click "Resend Verification Code" below to dispatch your code.'}
            </p>
          </div>

          {/* Masked Email Badge / Edit Email */}
          {!verified && (
            <div className="mb-4">
              {isEditingEmail ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-3">
                  <label
                    htmlFor="email-edit-input"
                    className="form-label text-xs fw-bold text-slate-700 mb-1"
                  >
                    Registered Email Address
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-white border-slate-200 text-slate-400">
                      <i className="bi bi-envelope"></i>
                    </span>
                    <input
                      id="email-edit-input"
                      type="email"
                      className="form-control text-sm py-2"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm px-3 fw-bold text-xs"
                      onClick={() => setIsEditingEmail(false)}
                      disabled={!email.trim()}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="d-flex align-items-center justify-content-between p-3 bg-slate-50 border border-slate-200 rounded-3">
                  <div className="d-flex align-items-center gap-2 overflow-hidden">
                    <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary p-2">
                      <i className="bi bi-envelope-at-fill fs-6"></i>
                    </span>
                    <div className="text-start text-truncate">
                      <div className="text-[11px] text-slate-400 fw-semibold text-uppercase">
                        Verification Sent To
                      </div>
                      <div className="fw-bold text-slate-900 font-monospace text-sm text-truncate">
                        {maskedEmail || email || 'No email specified'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-decoration-none text-primary fw-semibold text-xs p-0 ms-2"
                    onClick={() => setIsEditingEmail(true)}
                  >
                    Change Email
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Status Alert Banner */}
          {statusState.text && (
            <div
              className={`alert alert-${statusState.type} rounded-3 text-xs mb-4 d-flex align-items-start gap-2 border-${statusState.type} border-opacity-25 shadow-sm`}
              role="alert"
            >
              <i
                className={`bi ${
                  statusState.type === 'success'
                    ? 'bi-check-circle-fill text-success'
                    : 'bi-exclamation-triangle-fill text-danger'
                } fs-6 shrink-0 mt-0.5`}
              ></i>
              <div className="flex-grow-1">{statusState.text}</div>
            </div>
          )}

          {/* SUCCESS VIEW */}
          {verified ? (
            <div className="text-center pt-2">
              <div
                className="p-4 rounded-3 mb-4 text-center"
                style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}
              >
                <i className="bi bi-patch-check-fill text-success fs-1 d-block mb-2"></i>
                <div className="fw-bold text-emerald-900 fs-6 mb-1">
                  Email Verified Successfully!
                </div>
                <p className="text-emerald-700 text-xs mb-0">
                  Your EthioTech Market account has been activated. You can now sign in and start shopping.
                </p>
              </div>

              <button
                id="continueToLoginBtn"
                type="button"
                className="btn w-100 py-3 fw-bold text-sm text-white shadow transition"
                style={{ backgroundColor: '#10b981', borderColor: '#10b981', borderRadius: '0.5rem' }}
                onClick={() => navigate('/login')}
              >
                <i className="bi bi-box-arrow-in-right me-1.5"></i> Continue to Customer Login &rarr;
              </button>
            </div>
          ) : (
            /* OTP INPUT & VERIFICATION FORM */
            <div>
              <form onSubmit={handleSubmit} noValidate>
                {/* 6 Separate Digit Boxes */}
                <div className="mb-3 text-center">
                  <label className="form-label text-xs fw-bold text-slate-700 mb-2 d-block">
                    Enter 6-Digit Verification Code
                  </label>
                  <div
                    className="d-flex justify-content-between gap-2 mx-auto"
                    style={{ maxWidth: '380px' }}
                    onPaste={handlePaste}
                  >
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (inputRefs.current[idx] = el)}
                        id={`otp-input-${idx}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        disabled={loading}
                        className="form-control text-center fw-bolder font-monospace"
                        style={{
                          width: '48px',
                          height: '56px',
                          fontSize: '1.5rem',
                          borderRadius: '0.6rem',
                          border: digit ? '2px solid #1b64da' : '1.5px solid #cbd5e1',
                          backgroundColor: digit ? '#eff6ff' : '#ffffff',
                          boxShadow: digit ? '0 0 0 3px rgba(27, 100, 218, 0.15)' : 'none',
                          transition: 'all 0.15s ease-in-out',
                        }}
                        aria-label={`Digit ${idx + 1} of verification code`}
                      />
                    ))}
                  </div>

                  {/* Validity Timer & Expiration Notice */}
                  <div className="d-flex align-items-center justify-content-center gap-2 mt-3 text-xs text-slate-500">
                    <i className="bi bi-clock-history"></i>
                    {expirySeconds > 0 ? (
                      <span>
                        Code valid for:{' '}
                        <strong className="text-slate-800 font-monospace">
                          {formatTime(expirySeconds)}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-danger fw-bold">
                        Code has expired. Please request a new code.
                      </span>
                    )}
                  </div>
                </div>

                {/* Verify Email Button */}
                <button
                  id="verifyEmailBtn"
                  type="submit"
                  disabled={loading || !isOtpComplete}
                  className="btn btn-ethio-primary w-100 py-2.5 fw-bold text-sm shadow-sm mb-3 text-white transition"
                  style={{ backgroundColor: '#1b64da', borderColor: '#1b64da', borderRadius: '0.5rem' }}
                >
                  {loading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Verifying Code...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-shield-check me-1.5"></i> Verify Email
                    </>
                  )}
                </button>
              </form>

              {/* Resend Verification Code with 60s cooldown */}
              <div className="p-3 bg-slate-50 rounded-3 border border-slate-200 text-center mt-3">
                <div className="text-xs text-slate-600 mb-2">
                  Didn't receive the verification email?
                </div>
                <button
                  id="resendOtpBtn"
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1.5 text-xs fw-bold"
                  onClick={handleResend}
                  disabled={resending || resendCooldown > 0 || !email.trim()}
                >
                  {resending ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-1"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Sending Code...
                    </>
                  ) : resendCooldown > 0 ? (
                    <>
                      <i className="bi bi-hourglass-split me-1"></i> Resend code in {resendCooldown}s
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-clockwise me-1"></i> Resend Verification Code
                    </>
                  )}
                </button>
              </div>

              {/* Navigation Options: Back to Sign Up / Customer Login */}
              <div className="d-flex justify-content-between align-items-center mt-4 pt-2 border-top border-slate-100 text-xs">
                <Link to="/register" className="text-slate-500 hover-text-primary text-decoration-none">
                  &larr; Back to Sign Up
                </Link>
                <Link to="/login" className="text-primary fw-bold text-decoration-none">
                  Customer Login &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
