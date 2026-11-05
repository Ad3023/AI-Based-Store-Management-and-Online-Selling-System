import React, { useState } from 'react';
import api from '../../api';

const SupplierChangePasswordModal = ({ show, onPasswordChanged }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError('Please enter your current temporary password.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    try {
      setLoading(true);
      await api.post('auth/change-password/', {
        old_password: currentPassword,
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      });
      onPasswordChanged();
    } catch (err) {
      const resp = err.response?.data;
      const msg =
        resp?.old_password?.[0] ||
        resp?.new_password?.[0] ||
        resp?.new_password_confirm?.[0] ||
        resp?.error ||
        resp?.detail ||
        'Failed to update password. Please verify current credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(11, 26, 45, 0.85)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '440px' }}>
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden bg-white">
          <div className="modal-header bg-slate-900 text-white py-3.5 px-4 border-0">
            <div className="d-flex align-items-center gap-2.5">
              <div className="rounded-3 p-2 bg-amber-500 bg-opacity-20 text-amber-400">
                <i className="bi bi-shield-lock-fill fs-5"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold text-white mb-0 text-sm">Security Action Required</h5>
                <small className="text-slate-400 text-xs">Set Your Permanent Supplier Password</small>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              <div className="alert alert-info py-2 px-3 rounded-3 text-xs mb-3 border-0 bg-info bg-opacity-10 text-slate-700">
                <i className="bi bi-info-circle me-1.5 text-info"></i>
                An administrator provisioned this supplier account. For your security, you must replace the temporary password with a secure permanent password.
              </div>

              {error && (
                <div className="alert alert-danger py-2 px-3 rounded-3 text-xs mb-3">
                  <i className="bi bi-exclamation-triangle me-1.5"></i>
                  {error}
                </div>
              )}

              <div className="mb-3">
                <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                  Temporary / Current Password *
                </label>
                <div className="input-group">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    className="form-control text-xs py-2"
                    placeholder="Enter the password provided by Admin"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowCurrent(!showCurrent)}
                  >
                    <i className={`bi bi-eye${showCurrent ? '-slash' : ''}`}></i>
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                  New Permanent Password *
                </label>
                <div className="input-group">
                  <input
                    type={showNew ? 'text' : 'password'}
                    className="form-control text-xs py-2"
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowNew(!showNew)}
                  >
                    <i className={`bi bi-eye${showNew ? '-slash' : ''}`}></i>
                  </button>
                </div>
                <small className="text-slate-400 text-[11px]">Choose a strong, confidential password.</small>
              </div>

              <div className="mb-2">
                <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  className="form-control text-xs py-2"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-footer bg-slate-50 py-3 px-4 border-top">
              <button
                type="submit"
                className="btn btn-sm btn-ethio-primary w-100 py-2 rounded-pill font-bold text-xs"
                style={{ backgroundColor: '#0d9488', color: '#ffffff' }}
                disabled={loading}
              >
                {loading ? 'Updating Password...' : 'Save Password & Continue to Dashboard'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SupplierChangePasswordModal;

