import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import { validateEmail, validatePhone } from '../../utils/validation';
import { formatETB } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';

const ProcurementSuppliersPage = () => {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentSupplierId, setCurrentSupplierId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
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

  // History & Profile Modal
  const [selectedSupplierHistory, setSelectedSupplierHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState('products'); // 'products', 'pos', 'invoices', 'payments'

  // Portal Account Provisioning Modal
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountSupplier, setAccountSupplier] = useState(null);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [accountFormData, setAccountFormData] = useState({
    email: '',
    phone: '',
    password: '',
    full_name: '',
  });

  const handleOpenCreatePortalAccount = (sup) => {
    setAccountSupplier(sup);
    setAccountFormData({
      email: sup.email && sup.email.endsWith('@gmail.com') ? sup.email : '',
      phone: sup.phone || '',
      password: '',
      full_name: sup.contact_person || sup.name || '',
    });
    setShowAccountModal(true);
  };

  const handleSubmitPortalAccount = async (e) => {
    e.preventDefault();
    if (!accountSupplier) return;

    const emailRes = validateEmail(accountFormData.email, true);
    if (!emailRes.isValid) {
      alert(emailRes.error || 'A valid @gmail.com email is required.');
      return;
    }

    const phoneRes = validatePhone(accountFormData.phone, true);
    if (!phoneRes.isValid) {
      alert(phoneRes.error || 'A valid 10-digit phone number is required.');
      return;
    }

    if (!accountFormData.password || accountFormData.password.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }

    try {
      setAccountSubmitting(true);
      const res = await api.post(`products/suppliers/${accountSupplier.id}/create-account/`, {
        email: emailRes.value,
        phone: phoneRes.formatted || phoneRes.value,
        password: accountFormData.password,
        full_name: accountFormData.full_name,
      });

      setFeedback({
        type: 'success',
        text: `Portal account successfully created for ${accountSupplier.name}! Login URL: /supplier/login`,
      });
      setShowAccountModal(false);
      await fetchSuppliers();
    } catch (err) {
      console.error('Failed to create portal account:', err);
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to create portal account.';
      alert(`Error: ${msg}`);
    } finally {
      setAccountSubmitting(false);
    }
  };

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('products/suppliers/');
      const list = res.data.results || res.data || [];
      setSuppliers(list);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      setFeedback({ type: 'danger', text: 'Failed to load suppliers from database.' });
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
        setFeedback({ type: 'success', text: `Supplier "${res.data.name}" registered successfully!` });
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

  const handleOpenHistory = async (supplierId) => {
    try {
      setLoadingHistory(true);
      setSelectedSupplierHistory(null);
      setHistoryTab('products');
      const res = await api.get(`products/suppliers/${supplierId}/history/`);
      setSelectedSupplierHistory(res.data);
    } catch (err) {
      console.error('Failed to load supplier history:', err);
      alert('Could not retrieve supplier history details.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch =
      !search.trim() ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="pb-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-info border-opacity-25 bg-info bg-opacity-10">
            <i className="bi bi-truck text-info"></i>
            <span className="small fw-bold text-cyan-800">Procurement &amp; Supply Chain</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Suppliers Directory</h2>
          <p className="text-slate-500 text-xs mb-0">
            Maintain verified hardware suppliers, contact details, supplied inventory, and procurement ledgers.
          </p>
        </div>

        <div className="d-flex gap-2">
          {!isAdmin && (
            <Link
              to="/manager/procurement/purchase-orders/create"
              className="btn btn-outline-primary rounded-pill px-3 py-2 font-bold text-xs d-flex align-items-center gap-2 shadow-sm"
            >
              <i className="bi bi-cart-plus"></i>
              <span>Create Purchase Order</span>
            </Link>
          )}
          <button
            type="button"
            className="btn btn-ethio-primary rounded-pill px-4 py-2 font-bold text-xs d-flex align-items-center gap-2 shadow-sm"
            style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
            onClick={handleOpenCreate}
          >
            <i className="bi bi-plus-lg"></i>
            <span>Register New Supplier</span>
          </button>
        </div>
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
          <div className="col-12 col-md-5 col-lg-4">
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control text-sm"
                placeholder="Search suppliers by name, contact or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-12 col-md-4 col-lg-3">
            <select
              className="form-select text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active / Approved</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
          <div className="col-auto ms-auto text-xs text-slate-500">
            Total Registered: <strong className="text-slate-900">{filteredSuppliers.length}</strong>
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
              {search || statusFilter !== 'ALL' ? 'No suppliers match the active search filters.' : 'No suppliers registered yet.'}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs"
              onClick={handleOpenCreate}
            >
              <i className="bi bi-plus-lg me-1"></i> Register Supplier
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
                <tr>
                  <th className="ps-4">Supplier &amp; Notes</th>
                  <th>Contact Person</th>
                  <th>Email &amp; Phone</th>
                  <th>Location</th>
                  <th>Total Purchases</th>
                  <th>Outstanding Balance</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="ps-4">
                      <div className="fw-bold text-slate-900 cursor-pointer text-primary hover:underline" onClick={() => handleOpenHistory(s.id)}>
                        {s.name}
                      </div>
                      {s.notes && <small className="text-slate-400 text-[11px] text-truncate d-block" style={{ maxWidth: '240px' }}>{s.notes}</small>}
                    </td>
                    <td>{s.contact_person || <span className="text-slate-400">—</span>}</td>
                    <td>
                      <div>
                        {s.email ? (
                          <a href={`mailto:${s.email}`} className="text-decoration-none text-primary d-block">
                            {s.email}
                          </a>
                        ) : null}
                        <small className="text-slate-500">{s.phone || '—'}</small>
                        {s.has_account ? (
                          <div className="mt-1">
                            <span className="badge bg-teal-50 text-teal-700 border border-teal-200 text-[10px] px-1.5 py-0.5">
                              <i className="bi bi-shield-check me-1"></i>Portal Active
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="text-slate-600">{s.address || <span className="text-slate-400">—</span>}</td>
                    <td className="fw-semibold text-slate-800">
                      {formatETB(s.total_purchases_amount || 0)}
                    </td>
                    <td>
                      <span className={`fw-bold ${Number(s.outstanding_balance || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                        {formatETB(s.outstanding_balance || 0)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge rounded-pill ${
                        s.status === 'ACTIVE'
                          ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25'
                          : s.status === 'PENDING_APPROVAL'
                          ? 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25'
                          : 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25'
                      }`}>
                        {s.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm p-1 px-2"
                          title="View History & Supplied Products"
                          onClick={() => handleOpenHistory(s.id)}
                        >
                          <i className="bi bi-clock-history me-1"></i>
                          <span>History</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm p-1 px-2"
                          title="Edit Supplier"
                          onClick={() => handleOpenEdit(s)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        {(isAdmin || isSuperAdmin) && !s.has_account && (
                          <button
                            type="button"
                            className="btn btn-outline-teal btn-sm p-1 px-2 text-teal-700"
                            style={{ borderColor: '#0d9488', color: '#0d9488' }}
                            title="Provision Supplier Portal Login"
                            onClick={() => handleOpenCreatePortalAccount(s)}
                          >
                            <i className="bi bi-person-plus me-1"></i>
                            <span>Portal Login</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Portal Account Modal */}
      {showAccountModal && accountSupplier && (
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
                    <small className="text-slate-400 text-xs">Supplier: {accountSupplier.name}</small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowAccountModal(false)}
                ></button>
              </div>

              <form onSubmit={handleSubmitPortalAccount}>
                <div className="modal-body p-4 bg-slate-50">
                  <div className="alert alert-info py-2 px-3 rounded-3 text-xs mb-3">
                    <i className="bi bi-info-circle me-1.5"></i>
                    This creates an external business credential for this supplier to log into the <strong>EthioTech Supplier Portal</strong>.
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700">Contact Full Name</label>
                    <input
                      type="text"
                      className="form-control text-xs"
                      placeholder="Contact person or company name"
                      value={accountFormData.full_name}
                      onChange={(e) => setAccountFormData({ ...accountFormData, full_name: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700">Supplier Gmail Address *</label>
                    <input
                      type="email"
                      className="form-control text-xs"
                      placeholder="vendor@gmail.com"
                      value={accountFormData.email}
                      onChange={(e) => setAccountFormData({ ...accountFormData, email: e.target.value })}
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
                      value={accountFormData.phone}
                      onChange={(e) => setAccountFormData({ ...accountFormData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                      required
                    />
                    <small className="text-slate-400 text-[11px]">Exactly 10 digits required.</small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700">Initial Password *</label>
                    <input
                      type="password"
                      className="form-control text-xs"
                      placeholder="Minimum 8 characters"
                      value={accountFormData.password}
                      onChange={(e) => setAccountFormData({ ...accountFormData, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer bg-white py-2.5 px-4 d-flex justify-content-end gap-2 border-top">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs"
                    onClick={() => setShowAccountModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-teal text-white rounded-pill px-4 text-xs fw-bold"
                    style={{ backgroundColor: '#0d9488' }}
                    disabled={accountSubmitting}
                  >
                    {accountSubmitting ? 'Creating Account...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Profile & History Modal */}
      {(selectedSupplierHistory || loadingHistory) && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-2xl rounded-4">
              <div className="modal-header bg-slate-900 text-white border-bottom border-slate-800 pb-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-3 p-2 bg-primary bg-opacity-25 text-white">
                    <i className="bi bi-truck fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-0 text-white text-sm">
                      {selectedSupplierHistory?.supplier?.name || 'Loading Supplier History...'}
                    </h5>
                    <small className="text-slate-400 text-xs">
                      Comprehensive procurement, PO, invoice, and disbursement records
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedSupplierHistory(null)}
                ></button>
              </div>

              <div className="modal-body p-4 bg-slate-50">
                {loadingHistory ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                    <p className="text-muted text-xs mt-2">Loading supplier ledger...</p>
                  </div>
                ) : (
                  <>
                    {/* Financial & Operational Summary Cards */}
                    <div className="row g-3 mb-4">
                      <div className="col-6 col-md-3">
                        <div className="card border-0 shadow-sm rounded-3 p-3 bg-white text-center">
                          <span className="text-muted text-[11px] fw-bold uppercase">Total Orders</span>
                          <h4 className="fw-bolder text-slate-900 mb-0 mt-1">
                            {selectedSupplierHistory?.metrics?.total_purchase_orders || 0}
                          </h4>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="card border-0 shadow-sm rounded-3 p-3 bg-white text-center">
                          <span className="text-muted text-[11px] fw-bold uppercase">Total Purchases</span>
                          <h4 className="fw-bolder text-primary mb-0 mt-1">
                            {formatETB(selectedSupplierHistory?.metrics?.total_purchased_amount || 0)}
                          </h4>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="card border-0 shadow-sm rounded-3 p-3 bg-white text-center">
                          <span className="text-muted text-[11px] fw-bold uppercase">Total Paid</span>
                          <h4 className="fw-bolder text-success mb-0 mt-1">
                            {formatETB(selectedSupplierHistory?.metrics?.total_paid_amount || 0)}
                          </h4>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="card border-0 shadow-sm rounded-3 p-3 bg-white text-center">
                          <span className="text-muted text-[11px] fw-bold uppercase">Outstanding Balance</span>
                          <h4 className="fw-bolder text-danger mb-0 mt-1">
                            {formatETB(selectedSupplierHistory?.metrics?.outstanding_balance || 0)}
                          </h4>
                        </div>
                      </div>
                    </div>

                    {/* Contact Bar */}
                    <div className="card border-0 shadow-sm rounded-3 p-3 mb-4 bg-white text-xs">
                      <div className="row g-2">
                        <div className="col-md-3">
                          <span className="text-muted d-block">Contact Person:</span>
                          <strong className="text-slate-800">{selectedSupplierHistory?.supplier?.contact_person || 'N/A'}</strong>
                        </div>
                        <div className="col-md-3">
                          <span className="text-muted d-block">Email:</span>
                          <strong className="text-slate-800">{selectedSupplierHistory?.supplier?.email || 'N/A'}</strong>
                        </div>
                        <div className="col-md-3">
                          <span className="text-muted d-block">Phone:</span>
                          <strong className="text-slate-800">{selectedSupplierHistory?.supplier?.phone || 'N/A'}</strong>
                        </div>
                        <div className="col-md-3">
                          <span className="text-muted d-block">Address:</span>
                          <strong className="text-slate-800">{selectedSupplierHistory?.supplier?.address || 'N/A'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Navigation Tabs */}
                    <ul className="nav nav-pills mb-3 gap-2 border-bottom pb-2">
                      <li className="nav-item">
                        <button
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 text-xs ${historyTab === 'products' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => setHistoryTab('products')}
                        >
                          <i className="bi bi-box-seam me-1"></i> Supplied Products ({selectedSupplierHistory?.products?.length || 0})
                        </button>
                      </li>
                      <li className="nav-item">
                        <button
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 text-xs ${historyTab === 'pos' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => setHistoryTab('pos')}
                        >
                          <i className="bi bi-cart-check me-1"></i> Purchase Orders ({selectedSupplierHistory?.purchase_orders?.length || 0})
                        </button>
                      </li>
                      <li className="nav-item">
                        <button
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 text-xs ${historyTab === 'invoices' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => setHistoryTab('invoices')}
                        >
                          <i className="bi bi-receipt me-1"></i> Invoices ({selectedSupplierHistory?.invoices?.length || 0})
                        </button>
                      </li>
                      <li className="nav-item">
                        <button
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 text-xs ${historyTab === 'payments' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => setHistoryTab('payments')}
                        >
                          <i className="bi bi-cash-stack me-1"></i> Disbursements ({selectedSupplierHistory?.payments?.length || 0})
                        </button>
                      </li>
                    </ul>

                    {/* Tab 1: Products */}
                    {historyTab === 'products' && (
                      <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
                        <div className="table-responsive">
                          <table className="table table-hover align-middle mb-0 text-xs">
                            <thead className="table-light">
                              <tr>
                                <th>Product Name</th>
                                <th>SKU</th>
                                <th>Warehouse Stock</th>
                                <th>Cost Price</th>
                                <th>Selling Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(!selectedSupplierHistory?.products || selectedSupplierHistory.products.length === 0) ? (
                                <tr>
                                  <td colSpan="5" className="text-center py-4 text-muted">No products assigned to this supplier yet.</td>
                                </tr>
                              ) : (
                                selectedSupplierHistory.products.map((p) => (
                                  <tr key={p.id}>
                                    <td className="fw-semibold text-slate-900">{p.name}</td>
                                    <td className="text-muted">{p.sku || '—'}</td>
                                    <td>
                                      <span className={`badge ${p.stock <= 5 ? 'bg-danger' : 'bg-success'}`}>
                                        {p.stock} in stock
                                      </span>
                                    </td>
                                    <td>{formatETB(p.cost_price)}</td>
                                    <td className="fw-bold text-slate-800">{formatETB(p.price)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Purchase Orders */}
                    {historyTab === 'pos' && (
                      <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
                        <div className="table-responsive">
                          <table className="table table-hover align-middle mb-0 text-xs">
                            <thead className="table-light">
                              <tr>
                                <th>PO Number</th>
                                <th>Date</th>
                                <th>Items</th>
                                <th>Total Cost</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(!selectedSupplierHistory?.purchase_orders || selectedSupplierHistory.purchase_orders.length === 0) ? (
                                <tr>
                                  <td colSpan="5" className="text-center py-4 text-muted">No purchase orders recorded for this supplier.</td>
                                </tr>
                              ) : (
                                selectedSupplierHistory.purchase_orders.map((po) => (
                                  <tr key={po.id}>
                                    <td className="fw-bold text-primary">{po.request_number}</td>
                                    <td className="text-muted">{new Date(po.created_at).toLocaleDateString()}</td>
                                    <td>{po.items?.length || 1} item(s) ({po.quantity} pcs)</td>
                                    <td className="fw-bold text-slate-900">{formatETB(po.total_estimated_cost)}</td>
                                    <td>
                                      <span className="badge bg-secondary">{po.status}</span>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tab 3: Invoices */}
                    {historyTab === 'invoices' && (
                      <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
                        <div className="table-responsive">
                          <table className="table table-hover align-middle mb-0 text-xs">
                            <thead className="table-light">
                              <tr>
                                <th>Invoice Number</th>
                                <th>Invoice Date</th>
                                <th>Total Amount</th>
                                <th>Paid Amount</th>
                                <th>Balance</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(!selectedSupplierHistory?.invoices || selectedSupplierHistory.invoices.length === 0) ? (
                                <tr>
                                  <td colSpan="6" className="text-center py-4 text-muted">No invoices submitted for this supplier.</td>
                                </tr>
                              ) : (
                                selectedSupplierHistory.invoices.map((inv) => (
                                  <tr key={inv.id}>
                                    <td className="fw-bold text-slate-900">#{inv.invoice_number}</td>
                                    <td className="text-muted">{inv.invoice_date}</td>
                                    <td className="fw-bold text-slate-800">{formatETB(inv.total_amount)}</td>
                                    <td className="text-success">{formatETB(inv.paid_amount)}</td>
                                    <td className="text-danger fw-bold">{formatETB(inv.outstanding_amount)}</td>
                                    <td>
                                      <span className="badge bg-info">{inv.status_display || inv.status}</span>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tab 4: Payments */}
                    {historyTab === 'payments' && (
                      <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
                        <div className="table-responsive">
                          <table className="table table-hover align-middle mb-0 text-xs">
                            <thead className="table-light">
                              <tr>
                                <th>Reference</th>
                                <th>Payment Date</th>
                                <th>Method</th>
                                <th>Amount Paid</th>
                                <th>Authorized By</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(!selectedSupplierHistory?.payments || selectedSupplierHistory.payments.length === 0) ? (
                                <tr>
                                  <td colSpan="6" className="text-center py-4 text-muted">No disbursement records found.</td>
                                </tr>
                              ) : (
                                selectedSupplierHistory.payments.map((pay) => (
                                  <tr key={pay.id}>
                                    <td className="fw-bold text-slate-900">{pay.transaction_reference}</td>
                                    <td className="text-muted">{new Date(pay.payment_date).toLocaleDateString()}</td>
                                    <td>
                                      <span className="badge bg-light text-dark border">{pay.payment_method}</span>
                                    </td>
                                    <td className="fw-bold text-success">{formatETB(pay.amount_paid)}</td>
                                    <td className="text-muted">{pay.authorized_by_username || 'Admin'}</td>
                                    <td>
                                      <span className="badge bg-success">{pay.payment_status}</span>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="modal-footer border-top bg-white p-3">
                {!isAdmin && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary rounded-pill px-3"
                    onClick={() => {
                      const sid = selectedSupplierHistory?.supplier?.id;
                      setSelectedSupplierHistory(null);
                      navigate(`/manager/procurement/purchase-orders/create?supplier=${sid}`);
                    }}
                  >
                    <i className="bi bi-cart-plus me-1"></i> Create Purchase Order for This Supplier
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-secondary rounded-pill px-4"
                  onClick={() => setSelectedSupplierHistory(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-xl rounded-4">
              <form onSubmit={handleSubmit}>
                <div className="modal-header border-bottom border-slate-100 pb-3">
                  <h5 className="modal-title fw-bold text-slate-900 text-sm">
                    {modalMode === 'create' ? 'Register New Hardware Supplier' : `Edit Supplier: ${formData.name}`}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold text-slate-700">Supplier / Company Name *</label>
                    <input
                      type="text"
                      className="form-control text-xs"
                      placeholder="e.g. Dell &amp; Lenovo Distribution East Africa"
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
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-ethio-primary btn-sm px-4 rounded-pill font-bold"
                    style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : modalMode === 'create' ? 'Register Supplier' : 'Save Changes'}
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

export default ProcurementSuppliersPage;
