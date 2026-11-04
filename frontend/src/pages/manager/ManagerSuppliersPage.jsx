import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import { validateEmail, validatePhone } from '../../utils/validation';

const ManagerSuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [currentSupplierId, setCurrentSupplierId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    supplied_categories: '',
    status: 'ACTIVE',
    is_active: true,
  });

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('products/suppliers/');
      const list = res.data.results || res.data || [];
      setSuppliers(list);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      setFeedback({ type: 'danger', text: 'Failed to load suppliers from server.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setCurrentSupplierId(null);
    setFormData({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
      supplied_categories: 'Laptops, Smartphones, Accessories',
      status: 'ACTIVE',
      is_active: true,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (sup) => {
    setModalMode('edit');
    setCurrentSupplierId(sup.id);
    setFormData({
      name: sup.name || '',
      contact_person: sup.contact_person || '',
      email: sup.email || '',
      phone: sup.phone || '',
      address: sup.address || '',
      notes: sup.notes || '',
      supplied_categories: sup.supplied_categories || '',
      status: sup.status || (sup.is_active ? 'ACTIVE' : 'SUSPENDED'),
      is_active: Boolean(sup.is_active),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Supplier name is required.');
      return;
    }
    if (formData.email && formData.email.trim()) {
      const emailRes = validateEmail(formData.email, false);
      if (!emailRes.isValid) {
        alert(emailRes.error);
        return;
      }
    }
    if (formData.phone && formData.phone.trim()) {
      const phoneRes = validatePhone(formData.phone, false);
      if (!phoneRes.isValid) {
        alert(phoneRes.error);
        return;
      }
    }
    try {
      setSubmitting(true);
      if (modalMode === 'create') {
        const res = await api.post('products/suppliers/', formData);
        setFeedback({ type: 'success', text: `Supplier "${res.data.name}" added successfully!` });
      } else {
        const res = await api.put(`products/suppliers/${currentSupplierId}/`, formData);
        setFeedback({ type: 'success', text: `Supplier "${res.data.name}" updated successfully!` });
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (err) {
      const msg = err.response?.data?.name?.[0] || err.response?.data?.error || 'Failed to save supplier.';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove supplier "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`products/suppliers/${id}/`);
      setFeedback({ type: 'success', text: `Supplier "${name}" was removed successfully.` });
      fetchSuppliers();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to delete supplier.';
      alert(msg);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.contact_person?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="pb-5">
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-info border-opacity-25 bg-info bg-opacity-10">
            <i className="bi bi-truck text-info"></i>
            <span className="small fw-bold text-cyan-800">Inventory & Supply Chain</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Suppliers Management</h2>
          <p className="text-slate-500 text-xs mb-0">
            Maintain hardware suppliers, procurement contacts, warranty liaisons, and replenishment sources.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-ethio-primary rounded-pill px-4 py-2 font-bold text-xs d-flex align-items-center gap-2 shadow-sm"
          style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
          onClick={handleOpenCreate}
        >
          <i className="bi bi-plus-lg"></i>
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-6 col-lg-4">
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control text-sm"
                placeholder="Search suppliers by name, contact or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-auto ms-auto text-xs text-slate-500">
            Total Suppliers: <strong className="text-slate-900">{filteredSuppliers.length}</strong>
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted small mt-2">Loading suppliers...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-truck-flatbed fs-1 text-slate-300 mb-2 d-block"></i>
            <h6 className="fw-bold text-slate-700">No Suppliers Found</h6>
            <p className="text-slate-500 text-xs mb-3">
              {search ? 'No suppliers match your search query.' : 'No suppliers have been registered yet.'}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs"
              onClick={handleOpenCreate}
            >
              <i className="bi bi-plus-lg me-1"></i> Register First Supplier
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
                <tr>
                  <th className="ps-4">Supplier Name</th>
                  <th>Contact Person</th>
                  <th>Supplied Categories</th>
                  <th>Email & Phone</th>
                  <th>Business Address</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="ps-4">
                      <div className="fw-bold text-slate-900">{s.name}</div>
                      {s.notes && <small className="text-slate-400 text-[11px] text-truncate d-block" style={{ maxWidth: '220px' }}>{s.notes}</small>}
                    </td>
                    <td>{s.contact_person || <span className="text-slate-400">—</span>}</td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        {s.supplied_categories || 'General Electronics'}
                      </span>
                    </td>
                    <td>
                      <div>
                        {s.email ? (
                          <a href={`mailto:${s.email}`} className="text-decoration-none text-primary d-block">
                            {s.email}
                          </a>
                        ) : null}
                        <small className="text-slate-500">{s.phone || '—'}</small>
                      </div>
                    </td>
                    <td className="text-slate-600">{s.address || <span className="text-slate-400">—</span>}</td>
                    <td>
                      <span className={`badge rounded-pill ${
                        s.status === 'ACTIVE' || (!s.status && s.is_active)
                          ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25'
                          : s.status === 'PENDING_APPROVAL'
                          ? 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25'
                          : 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25'
                      }`}>
                        {s.status || (s.is_active ? 'ACTIVE' : 'SUSPENDED')}
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm p-1 px-2"
                          title="Edit Supplier"
                          onClick={() => handleOpenEdit(s)}
                        >
                          <i className="bi bi-pencil text-xs"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm p-1 px-2"
                          title="Delete Supplier"
                          onClick={() => handleDelete(s.id, s.name)}
                        >
                          <i className="bi bi-trash text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-xl rounded-4">
              <form onSubmit={handleSubmit}>
                <div className="modal-header border-bottom border-slate-100 pb-3">
                  <h5 className="modal-title fw-bold text-slate-900 text-sm">
                    {modalMode === 'create' ? 'Add New Hardware Supplier' : `Edit Supplier: ${formData.name}`}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold text-slate-700">Supplier / Company Name *</label>
                    <input
                      type="text"
                      className="form-control text-sm py-2"
                      placeholder="e.g. Dell Ethiopia Distributor Ltd"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Contact Person</label>
                      <input
                        type="text"
                        className="form-control text-sm py-2"
                        placeholder="e.g. Abebe Kebede"
                        value={formData.contact_person}
                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Phone Number</label>
                      <input
                        type="tel"
                        className="form-control text-sm py-2"
                        placeholder="+251 9..."
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold text-slate-700">Email Address</label>
                    <input
                      type="email"
                      className="form-control text-sm py-2"
                      placeholder="contact@supplier.et"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold text-slate-700">Office / Warehouse Address</label>
                    <textarea
                      className="form-control text-sm py-2"
                      rows="2"
                      placeholder="Bole Subcity, Addis Ababa"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold text-slate-700">Supplied Product Categories</label>
                    <input
                      type="text"
                      className="form-control text-sm py-2"
                      placeholder="e.g. Laptops, Smartphones, Monitors"
                      value={formData.supplied_categories}
                      onChange={(e) => setFormData({ ...formData, supplied_categories: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold text-slate-700">Status</label>
                    <select
                      className="form-select text-sm py-2"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value, is_active: e.target.value === 'ACTIVE' })}
                    >
                      <option value="ACTIVE">ACTIVE (Approved for purchase orders)</option>
                      <option value="PENDING_APPROVAL">PENDING_APPROVAL (Under administrative review)</option>
                      <option value="SUSPENDED">SUSPENDED (Temporarily disabled)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold text-slate-700">Internal Procurement Notes</label>
                    <textarea
                      className="form-control text-sm py-2"
                      rows="2"
                      placeholder="Warranty terms, replenishment lead times, etc."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="form-check form-switch mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="supplierActiveSwitch"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <label className="form-check-label text-xs fw-bold text-slate-700" htmlFor="supplierActiveSwitch">
                      Active Supplier Account
                    </label>
                  </div>
                </div>

                <div className="modal-footer border-top border-slate-100 pt-3">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-ethio-primary btn-sm rounded-pill px-4 fw-bold"
                    style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : modalMode === 'create' ? 'Create Supplier' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerSuppliersPage;
