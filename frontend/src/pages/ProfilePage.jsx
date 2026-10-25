import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CustomerSidebar from '../components/CustomerSidebar';
import { cleanDisplayName, getUserRoleLabel } from '../utils/orderStatus';
import { getMediaUrl, getDefaultAvatar } from '../utils/imageUrl';
import api from '../api';

const ProfilePage = () => {
  const { user, updateProfile, uploadAvatar, removeAvatar, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone_number: user?.phone_number || '',
    address: user?.address || '',
    city: user?.city || '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone_number: user.phone_number || '',
        address: user.address || '',
        city: user.city || '',
      });
    }
  }, [user]);

  // Password State
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  // Photo Upload & Preview State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  // Status & Notifications
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  if (!user) {
    return (
      <div className="container py-5 text-center">
        <div className="card ethio-card p-5 mx-auto" style={{ maxWidth: '480px' }}>
          <h5>Authentication Required</h5>
          <p className="text-muted text-xs">Please sign in to access your profile settings.</p>
          <Link to="/login?redirect=/profile" className="btn btn-ethio-primary">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const displayName = cleanDisplayName(user);
  const currentAvatarUrl = user?.avatar ? getMediaUrl(user.avatar) : null;

  // Handle Photo Selection for Preview
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Client-side file size check (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setProfileMsg({ type: 'danger', text: 'Image file is too large. Maximum allowed size is 5MB.' });
      return;
    }

    // Client-side format check
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowed.includes(file.type.toLowerCase())) {
      setProfileMsg({ type: 'danger', text: 'Please choose a JPEG, PNG, or WebP image file.' });
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setProfileMsg({ type: '', text: '' });
  };

  // Cancel Preview
  const handleCancelPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save Uploaded Photo
  const handleSavePhoto = async () => {
    if (!selectedFile) return;
    try {
      setUploadingPhoto(true);
      setProfileMsg({ type: '', text: '' });
      await uploadAvatar(selectedFile);
      setProfileMsg({ type: 'success', text: 'Profile photo updated successfully!' });
      handleCancelPreview();
    } catch (err) {
      setProfileMsg({
        type: 'danger',
        text: err.response?.data?.error || err.message || 'Failed to upload photo.',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Remove Photo & Revert to Default
  const handleRemovePhoto = async () => {
    if (!window.confirm('Remove profile photo and restore default avatar?')) return;
    try {
      setUploadingPhoto(true);
      setProfileMsg({ type: '', text: '' });
      await removeAvatar();
      handleCancelPreview();
      setProfileMsg({ type: 'success', text: 'Profile photo removed. Default avatar restored.' });
    } catch (err) {
      setProfileMsg({
        type: 'danger',
        text: err.response?.data?.error || err.message || 'Failed to remove photo.',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Save Personal Info & Email
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });

    const trimmedEmail = (formData.email || '').trim();
    if (!trimmedEmail) {
      setProfileMsg({ type: 'danger', text: 'Email address cannot be empty.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setProfileMsg({ type: 'danger', text: 'Please enter a valid email address format (e.g. name@domain.com).' });
      return;
    }

    try {
      setSavingProfile(true);
      await updateProfile({
        ...formData,
        email: trimmedEmail.toLowerCase(),
      });
      setProfileMsg({ type: 'success', text: 'Profile details and email saved successfully!' });
    } catch (err) {
      const respData = err.response?.data;
      let errMsg = 'Failed to update profile information.';
      if (respData) {
        if (respData.email) {
          errMsg = Array.isArray(respData.email) ? respData.email[0] : respData.email;
        } else if (respData.error) {
          errMsg = respData.error;
        } else if (respData.role) {
          errMsg = Array.isArray(respData.role) ? respData.role[0] : respData.role;
        } else if (respData.detail) {
          errMsg = respData.detail;
        }
      }
      setProfileMsg({ type: 'danger', text: errMsg });
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (!passwordData.new_password || passwordData.new_password.length < 6) {
      setPasswordMsg({ type: 'danger', text: 'New password must contain at least 6 characters.' });
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordMsg({ type: 'danger', text: 'New passwords do not match. Please verify.' });
      return;
    }

    try {
      setSavingPassword(true);
      // Change password via API
      await api.put('auth/profile/', {
        password: passwordData.new_password,
      });
      setPasswordMsg({ type: 'success', text: 'Password updated successfully!' });
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPasswordMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Unable to update password. Please check your inputs.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="ethio-dashboard-layout">
      {/* Fixed Left Sidebar */}
      <CustomerSidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        activeItem="profile"
      />

      {/* Main Content Area */}
      <div className="ethio-dashboard-content">
        
        {/* Top Bar for Mobile Toggle & Profile Title */}
        <div className="bg-white border-bottom py-3 px-4 d-flex align-items-center justify-content-between sticky-top z-2">
          <div className="d-flex align-items-center gap-3">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-lg-none p-1.5"
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar menu"
            >
              <i className="bi bi-list fs-5"></i>
            </button>
            <h5 className="fw-bolder text-slate-900 mb-0">My Profile & Photo</h5>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Link
              to={
                user.role === 'admin' || user.is_superuser
                  ? '/admin/dashboard'
                  : user.role === 'store_manager'
                  ? '/manager/dashboard'
                  : '/customer/dashboard'
              }
              className="btn btn-sm btn-ethio-outline text-xs"
            >
              <i className="bi bi-grid me-1"></i> Dashboard
            </Link>
          </div>
        </div>

        {/* Content Container (Screenshot 5) */}
        <div className="p-3 p-md-4 max-w-7xl">
          
          {/* Privileged Role Navigation Notice */}
          {(user.role === 'admin' || user.role === 'store_manager' || user.is_superuser) && (
            <div className="alert alert-info rounded-3 p-3 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2 text-xs shadow-sm border border-cyan-200">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-shield-check fs-5 text-cyan-700"></i>
                <span>
                  You are editing profile settings for your <strong className="text-uppercase">{getUserRoleLabel(user)}</strong> account.
                </span>
              </div>
              <Link
                to={user.role === 'admin' || user.is_superuser ? '/admin/dashboard' : '/manager/dashboard'}
                className="btn btn-sm btn-primary rounded-pill px-3 py-1 font-bold text-xs shrink-0 shadow-sm"
              >
                Go to {user.role === 'admin' || user.is_superuser ? 'Admin Console' : 'Store Manager Portal'} &rarr;
              </Link>
            </div>
          )}

          {/* Notification Messages */}
          {profileMsg.text && (
            <div className={`alert alert-${profileMsg.type} rounded-3 text-xs mb-3 d-flex align-items-center gap-2`} role="alert">
              <i className={`bi ${profileMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-6`}></i>
              <div>{profileMsg.text}</div>
            </div>
          )}

          <div className="row g-4">
            
            {/* Left Card: My Profile & Avatar (Screenshot 5) */}
            <div className="col-lg-7">
              <div className="card ethio-card p-4 p-md-4">
                <h6 className="fw-bold text-slate-900 mb-4 pb-2 border-bottom">
                  Personal Information & Profile Photo
                </h6>

                {/* Profile Photo Upload Section */}
                <div className="d-flex flex-column flex-sm-row align-items-center gap-4 mb-4 pb-3 border-bottom">
                  
                  {/* Photo Display / Preview */}
                  <div className="position-relative">
                    <img
                      src={previewUrl || currentAvatarUrl || getDefaultAvatar(displayName)}
                      alt={displayName}
                      className="rounded-circle shadow-sm object-fit-cover"
                      style={{
                        width: '96px',
                        height: '96px',
                        border: '3px solid #1b64da',
                        backgroundColor: '#f1f5f9',
                      }}
                      onError={(e) => { e.target.src = getDefaultAvatar(displayName); }}
                    />
                    {uploadingPhoto && (
                      <div
                        className="position-absolute inset-0 rounded-circle d-flex align-items-center justify-content-center"
                        style={{ background: 'rgba(0,0,0,0.5)', top: 0, left: 0, right: 0, bottom: 0 }}
                      >
                        <span className="spinner-border spinner-border-sm text-white"></span>
                      </div>
                    )}
                  </div>

                  {/* Photo Action Controls */}
                  <div className="text-center text-sm-start flex-grow-1">
                    <div className="fw-bold text-slate-900 text-sm mb-1">{displayName}</div>
                    <div className="text-muted text-xs mb-2">
                      Accepted formats: JPEG, PNG, WebP (Max size: 5MB)
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/jpeg,image/png,image/webp"
                      className="d-none"
                    />

                    {previewUrl ? (
                      /* Actions during preview */
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-ethio-primary py-1 px-3 text-xs"
                          onClick={handleSavePhoto}
                          disabled={uploadingPhoto}
                        >
                          <i className="bi bi-check-lg"></i> Save Photo
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-1 px-3 text-xs"
                          onClick={handleCancelPreview}
                          disabled={uploadingPhoto}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      /* Default actions */
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-ethio-primary py-1 px-3 text-xs"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                        >
                          <i className="bi bi-camera"></i> {currentAvatarUrl ? 'Change Photo' : 'Upload Photo'}
                        </button>

                        {currentAvatarUrl && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-1 px-3 text-xs"
                            onClick={handleRemovePhoto}
                            disabled={uploadingPhoto}
                          >
                            <i className="bi bi-trash"></i> Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Edit Form */}
                <form onSubmit={handleProfileSubmit}>
                  <div className="row g-3">
                    <div className="col-sm-6">
                      <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        className="form-control text-sm"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-sm-6">
                      <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        className="form-control text-sm"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      />
                    </div>

                    <div className="col-12">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="form-label text-xs fw-semibold text-slate-700 mb-0">
                          Email Address *
                        </label>
                        {user.role === 'admin' && (
                          <span className="badge bg-primary bg-opacity-10 text-primary text-[10px] fw-semibold">
                            <i className="bi bi-shield-check me-1"></i> Editable Admin Credential
                          </span>
                        )}
                      </div>
                      <input
                        type="email"
                        className="form-control text-sm"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        placeholder="you@example.com"
                      />
                      <small className="text-muted text-[11px]">
                        Used for account login, password recovery, and administrative security alerts.
                      </small>
                    </div>

                    {/* System Protected Role Indicator */}
                    <div className="col-12">
                      <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                        Assigned Role & System Access
                      </label>
                      <div className="d-flex align-items-center justify-content-between p-2.5 rounded-3 bg-slate-50 border border-slate-200">
                        <div className="d-flex align-items-center gap-2">
                          <i className="bi bi-shield-lock-fill text-danger fs-5"></i>
                          <div>
                            <span className="fw-bold text-xs text-slate-900 text-uppercase">{getUserRoleLabel(user)}</span>
                            <div className="text-slate-500 text-[11px]">
                              {user.role === 'admin'
                                ? 'Main Administrator role is permanently locked and protected.'
                                : user.role === 'store_manager'
                                ? 'Store Manager with product catalog and inventory permissions.'
                                : 'Standard Customer account for storefront browsing and purchases.'}
                            </div>
                          </div>
                        </div>
                        <span className="badge bg-light text-slate-600 border border-slate-300 text-[10px] px-2.5 py-1">
                          <i className="bi bi-lock-fill me-1 text-slate-400"></i> Role Locked
                        </span>
                      </div>
                    </div>

                    <div className="col-sm-6">
                      <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        className="form-control text-sm"
                        placeholder="+251 9XX XXX XXX"
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      />
                    </div>

                    <div className="col-sm-6">
                      <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        className="form-control text-sm"
                        placeholder="e.g. Addis Ababa"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                        Delivery Address
                      </label>
                      <textarea
                        className="form-control text-sm"
                        rows="2"
                        placeholder="House / Street / Sub-City address for deliveries"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      ></textarea>
                    </div>

                    <div className="col-12 text-end pt-2">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="btn btn-ethio-primary py-2 px-4"
                      >
                        {savingProfile ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                    </div>
                  </div>
                </form>

              </div>
            </div>

            {/* Right Card: Change Password (Screenshot 5) */}
            <div className="col-lg-5">
              <div className="card ethio-card p-4">
                <h6 className="fw-bold text-slate-900 mb-4 pb-2 border-bottom">
                  Change Password
                </h6>

                {passwordMsg.text && (
                  <div className={`alert alert-${passwordMsg.type} rounded-3 text-xs mb-3`} role="alert">
                    {passwordMsg.text}
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit}>
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      className="form-control text-sm"
                      placeholder="Enter new password"
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label text-xs fw-semibold text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      className="form-control text-sm"
                      placeholder="Re-enter new password"
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="btn btn-ethio-primary w-100 py-2"
                  >
                    {savingPassword ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </form>

                {/* Account Security Info Box */}
                <div className="mt-4 p-3 bg-slate-50 rounded-3 border text-muted text-xs">
                  <div className="fw-bold text-slate-800 mb-1">
                    <i className="bi bi-shield-lock text-primary me-1"></i> Security Notice
                  </div>
                  Your password is hashed with cryptographic PBKDF2 on the server. Never share your password with anyone.
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfilePage;
