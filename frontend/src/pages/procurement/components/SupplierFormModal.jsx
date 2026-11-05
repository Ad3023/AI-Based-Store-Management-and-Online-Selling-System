import React from 'react';

const SupplierFormModal = ({
  show,
  mode,
  formData,
  setFormData,
  onSubmit,
  onClose,
  submitting,
}) => {
  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-xl rounded-4">
          <form onSubmit={onSubmit}>
            <div className="modal-header border-bottom border-slate-100 pb-3">
              <h5 className="modal-title fw-bold text-slate-900 text-sm">
                {mode === 'create' ? 'Register New Hardware Supplier' : `Edit Supplier: ${formData.name}`}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body p-4">
              <div className="mb-3">
                <label className="form-label text-xs fw-bold text-slate-700">Supplier / Company Name *</label>
                <input
                  type="text"
                  className="form-control text-xs"
                  placeholder="e.g. Dell & Lenovo Distribution East Africa"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label text-xs fw-bold text-slate-700">Contact Person</label>
                  <input
                    type="text"
                    className="form-control text-xs"
                    placeholder="e.g. Dawit Tadesse"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label text-xs fw-bold text-slate-700">Contact Phone</label>
                  <input
                    type="text"
                    className="form-control text-xs"
                    placeholder="e.g. +251 911 234 567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label text-xs fw-bold text-slate-700">Procurement Email</label>
                <input
                  type="email"
                  className="form-control text-xs"
                  placeholder="orders@supplier.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="mb-3">
                <label className="form-label text-xs fw-bold text-slate-700">Physical / Warehouse Address</label>
                <input
                  type="text"
                  className="form-control text-xs"
                  placeholder="e.g. Bole Subcity, Woreda 03, Addis Ababa"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label text-xs fw-bold text-slate-700">Status</label>
                  <select
                    className="form-select text-xs"
                    value={formData.status}
                    onChange={(e) => setFormData({
                      ...formData,
                      status: e.target.value,
                      is_active: e.target.value === 'ACTIVE'
                    })}
                  >
                    <option value="ACTIVE">Active / Approved</option>
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label text-xs fw-bold text-slate-700">Categories Supplied</label>
                  <input
                    type="text"
                    className="form-control text-xs"
                    placeholder="Laptops, Accessories"
                    value={formData.supplied_categories}
                    onChange={(e) => setFormData({ ...formData, supplied_categories: e.target.value })}
                  />
                </div>
              </div>
              <div className="mb-2">
                <label className="form-label text-xs fw-bold text-slate-700">Procurement Notes / Terms</label>
                <textarea
                  className="form-control text-xs"
                  rows="2"
                  placeholder="Credit terms, warranty return policy, lead times..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                ></textarea>
              </div>
            </div>
            <div className="modal-footer border-top border-slate-100 p-3">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm px-3 rounded-pill"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-ethio-primary btn-sm px-4 rounded-pill font-bold"
                style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : mode === 'create' ? 'Register Supplier' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SupplierFormModal;

