import React from 'react';

const SupplierPortalModal = ({
  show,
  supplier,
  formData,
  setFormData,
  onSubmit,
  onClose,
  submitting,
}) => {
  if (!show || !supplier) return null;

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = 'Sup!';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password: pwd });
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <div className="modal-dialog modal-md modal-dialog-centered">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className="modal-header bg-slate-900 text-white py-3 px-4">
            <div className="d-flex align-items-center gap-2">
              <div className="rounded-3 p-1.5 bg-teal-600 text-white">
                <i className="bi bi-shield-lock fs-5"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold text-white mb-0">Provision Supplier Portal Account</h5>
                <small className="text-slate-400 text-xs">Supplier: {supplier.name}</small>
              </div>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <form onSubmit={onSubmit}>
            <div className="modal-body p-4 bg-slate-50">
              <div className="alert alert-info py-2 px-3 rounded-3 text-xs mb-3">
                <i className="bi bi-info-circle me-1.5"></i>
                Provisions credentials for the <strong>EthioTech Supplier Portal</strong>. Role is strictly locked to <strong>SUPPLIER</strong> with mandatory first-login password change.
              </div>

              <div className="mb-3">
                <label className="form-label text-xs fw-semibold text-slate-700">Contact Full Name</label>
                <input
                  type="text"
                  className="form-control text-xs"
                  placeholder="Contact person or company name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>

              <div className="mb-3">
                <label className="form-label text-xs fw-semibold text-slate-700">Supplier Gmail Address *</label>
                <input
                  type="email"
                  className="form-control text-xs"
                  placeholder="vendor@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <small className="text-slate-400 text-[11px]">Must end with @gmail.com per system rules.</small>
              </div>

              <div className="mb-3">
                <label className="form-label text-xs fw-semibold text-slate-700">10-Digit Mobile Phone *</label>
                <input
                  type="tel"
                  className="form-control text-xs"
                  placeholder="0912345678"
                  maxLength={10}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                  required
                />
              </div>

              <div className="mb-2">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label text-xs fw-semibold text-slate-700 mb-0">Initial Temporary Password *</label>
                  <button
                    type="button"
                    className="btn btn-link text-teal-600 p-0 text-[11px] text-decoration-none fw-bold"
                    onClick={handleGeneratePassword}
                  >
                    <i className="bi bi-magic me-1"></i>Generate Secure Password
                  </button>
                </div>
                <input
                  type="text"
                  className="form-control text-xs font-monospace"
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <small className="text-slate-400 text-[11px]">
                  System forces the supplier to change this password immediately upon their first login.
                </small>
              </div>
            </div>

            <div className="modal-footer bg-white py-2.5 px-4 d-flex justify-content-end gap-2 border-top">
              <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm text-white rounded-pill px-4 text-xs fw-bold"
                style={{ backgroundColor: '#0d9488' }}
                disabled={submitting}
              >
                {submitting ? 'Saving Account...' : 'Save Portal Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SupplierPortalModal;
