import React, { useState, useEffect } from 'react';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const ManagerPromotionsPage = () => {
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, scheduled, expired, inactive
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    discount_type: 'PERCENTAGE',
    discount_value: '',
    apply_to_all: false,
    start_date: new Date().toISOString().slice(0, 16),
    end_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
    is_active: true,
    banner_announcement: '',
    products: [],
    categories: [],
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const [promoRes, prodRes, catRes] = await Promise.all([
        api.get('products/promotions/', { params }),
        api.get('products/items/?limit=100'),
        api.get('products/categories/'),
      ]);
      setPromotions(promoRes.data.results || promoRes.data || []);
      setProducts(prodRes.data.results || prodRes.data || []);
      setCategories(catRes.data.results || catRes.data || []);
    } catch (err) {
      console.error('Error fetching promotions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const handleOpenCreateModal = () => {
    setEditingPromo(null);
    setForm({
      title: '',
      description: '',
      discount_type: 'PERCENTAGE',
      discount_value: '',
      apply_to_all: true,
      start_date: new Date().toISOString().slice(0, 16),
      end_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
      is_active: true,
      banner_announcement: '',
      products: [],
      categories: [],
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (promo) => {
    setEditingPromo(promo);
    setForm({
      title: promo.title || promo.name || '',
      description: promo.description || '',
      discount_type: promo.discount_type || 'PERCENTAGE',
      discount_value: String(promo.discount_value || ''),
      apply_to_all: Boolean(promo.apply_to_all),
      start_date: promo.start_date ? new Date(promo.start_date).toISOString().slice(0, 16) : '',
      end_date: promo.end_date ? new Date(promo.end_date).toISOString().slice(0, 16) : '',
      is_active: Boolean(promo.is_active),
      banner_announcement: promo.banner_announcement || '',
      products: (promo.products || []).map(String),
      categories: (promo.categories || []).map(String),
    });
    setShowModal(true);
  };

  const handleToggleActive = async (promo) => {
    try {
      const updatedStatus = !promo.is_active;
      await api.patch(`products/promotions/${promo.id}/`, {
        is_active: updatedStatus,
      });
      setFeedback({
        type: 'success',
        text: `Promotion "${promo.title || promo.name}" is now ${updatedStatus ? 'Active' : 'Deactivated'}.`,
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update promotion status.');
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to permanently delete promotion "${title}"?`)) return;
    try {
      await api.delete(`products/promotions/${id}/`);
      setFeedback({ type: 'success', text: `Promotion "${title}" was successfully deleted.` });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete promotion.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert('Please provide a promotion title.');
      return;
    }

    const numVal = parseFloat(form.discount_value);
    if (isNaN(numVal) || numVal <= 0) {
      alert('Please provide a positive discount value.');
      return;
    }

    if (form.discount_type === 'PERCENTAGE' && (numVal < 0.01 || numVal > 100)) {
      alert('Percentage discount must be between 0.01% and 100%.');
      return;
    }

    if (new Date(form.start_date) >= new Date(form.end_date)) {
      alert('Expiration date must be strictly after the start date.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      discount_type: form.discount_type,
      discount_value: numVal,
      apply_to_all: Boolean(form.apply_to_all),
      start_date: new Date(form.start_date).toISOString(),
      end_date: new Date(form.end_date).toISOString(),
      is_active: Boolean(form.is_active),
      banner_announcement: form.banner_announcement.trim(),
      products: form.apply_to_all ? [] : form.products.map(Number),
      categories: form.apply_to_all ? [] : form.categories.map(Number),
    };

    try {
      setSubmitting(true);
      if (editingPromo) {
        await api.patch(`products/promotions/${editingPromo.id}/`, payload);
        setFeedback({ type: 'success', text: `Promotion "${form.title}" updated successfully!` });
      } else {
        await api.post('products/promotions/', payload);
        setFeedback({ type: 'success', text: `New promotion "${form.title}" created successfully!` });
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      const errorMsg =
        err.response?.data?.discount_value?.[0] ||
        err.response?.data?.end_date?.[0] ||
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Failed to save promotion. Please verify the dates and discount values.';
      alert(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-lg-5">
      {/* Page Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-primary bg-opacity-10 text-primary px-2.5 py-1 fw-bold text-xs rounded-pill">
              Admin Module
            </span>
            <span className="text-muted small">Server-Side Trusted Pricing</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900">Discount and Promotion Management</h2>
          <p className="text-muted small mb-0" style={{ maxWidth: '680px' }}>
            Configure authoritative store promotions, fixed and percentage discounts, product or category scopes, and dynamic homepage banners. All discounts are securely calculated on the server.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2"
        >
          <i className="bi bi-plus-circle-fill"></i> Create New Promotion
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-4 small shadow-sm`} role="alert">
          <i className="bi bi-info-circle-fill me-2"></i>
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Status Filter Tabs & Search Bar */}
      <div className="card border-0 shadow-sm rounded-4 p-3 bg-white mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          {/* Filter Pills */}
          <ul className="nav nav-pills gap-1 small">
            {[
              { id: 'all', label: 'All Promotions' },
              { id: 'active', label: 'Active (Live Now)' },
              { id: 'scheduled', label: 'Scheduled (Upcoming)' },
              { id: 'expired', label: 'Expired' },
              { id: 'inactive', label: 'Inactive' },
            ].map((tab) => (
              <li className="nav-item" key={tab.id}>
                <button
                  className={`nav-link rounded-pill px-3 py-1.5 fw-semibold ${
                    statusFilter === tab.id ? 'active bg-primary text-white shadow-sm' : 'text-slate-600'
                  }`}
                  onClick={() => setStatusFilter(tab.id)}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="d-flex align-items-center gap-2">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-end-0 rounded-start-pill ps-3">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control bg-light border-start-0"
                placeholder="Search promotions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ minWidth: '180px' }}
              />
              <button type="submit" className="btn btn-outline-secondary rounded-end-pill px-3">
                Search
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                fetchData();
              }}
              className="btn btn-sm btn-light border rounded-pill"
              title="Reset Filters"
            >
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </form>
        </div>
      </div>

      {/* Promotions Table Card */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
        <div className="p-3.5 border-bottom bg-slate-50 d-flex justify-content-between align-items-center">
          <span className="fw-bold text-slate-800 small">
            Configured Promotions ({promotions.length})
          </span>
          <span className="text-muted text-xs">
            <i className="bi bi-shield-lock text-success me-1"></i>
            All discounts enforced through trusted database rules
          </span>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted small mt-2">Loading promotions ledger...</p>
          </div>
        ) : promotions.length === 0 ? (
          <div className="text-center py-5 text-muted small">
            <i className="bi bi-tag fs-1 text-slate-300 d-block mb-2"></i>
            No promotions found under the selected filter.
            <div className="mt-2">
              <button onClick={handleOpenCreateModal} className="btn btn-sm btn-outline-primary rounded-pill">
                Launch a New Promotion
              </button>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-sm">
              <thead className="table-light text-slate-600 text-xs text-uppercase">
                <tr>
                  <th className="ps-4">Promotion Title</th>
                  <th>Discount Rule</th>
                  <th>Scope</th>
                  <th>Validity Period</th>
                  <th>Homepage Banner</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => {
                  const now = new Date();
                  const startDate = new Date(p.start_date);
                  const endDate = new Date(p.end_date);
                  const isCurrent = p.is_active && startDate <= now && endDate >= now;
                  const isScheduled = p.is_active && startDate > now;
                  const isExpired = endDate < now;

                  return (
                    <tr key={p.id}>
                      <td className="ps-4">
                        <div className="fw-bold text-slate-900">{p.title || p.name}</div>
                        {p.description && (
                          <div className="text-muted text-xs text-truncate" style={{ maxWidth: '240px' }}>
                            {p.description}
                          </div>
                        )}
                        <small className="text-slate-400 font-monospace text-[11px]">ID #{p.id}</small>
                      </td>
                      <td>
                        <span className="badge bg-primary bg-opacity-10 text-primary fw-bold px-2.5 py-1">
                          {p.discount_type === 'PERCENTAGE'
                            ? `${p.discount_value}% OFF`
                            : `-${formatETB(p.discount_value)}`}
                        </span>
                      </td>
                      <td>
                        <div className="small">
                          {p.apply_to_all ? (
                            <span className="badge bg-purple-100 text-purple-800 border border-purple-200">
                              <i className="bi bi-shop me-1"></i> Store-Wide (All Products)
                            </span>
                          ) : (
                            <>
                              {p.categories?.length > 0 && (
                                <span className="badge bg-cyan-100 text-cyan-800 border border-cyan-200 me-1">
                                  {p.categories.length} Categories
                                </span>
                              )}
                              {p.products?.length > 0 && (
                                <span className="badge bg-slate-100 text-slate-800 border border-slate-200">
                                  {p.products.length} Products
                                </span>
                              )}
                              {p.categories?.length === 0 && p.products?.length === 0 && (
                                <span className="text-muted text-xs">Eligible items</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="text-xs text-slate-700">
                          <div><span className="text-muted">Start:</span> {startDate.toLocaleDateString()} {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <div><span className="text-muted">End:</span> {endDate.toLocaleDateString()} {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </td>
                      <td>
                        {p.banner_announcement ? (
                          <div className="text-xs text-truncate" style={{ maxWidth: '200px' }} title={p.banner_announcement}>
                            <i className="bi bi-megaphone-fill text-amber-500 me-1"></i>
                            {p.banner_announcement}
                          </div>
                        ) : (
                          <span className="text-muted text-xs fst-italic">Standard announcement</span>
                        )}
                      </td>
                      <td>
                        {isCurrent ? (
                          <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25 rounded-pill px-2.5 py-1">
                            <i className="bi bi-check-circle-fill me-1"></i> Active (Live)
                          </span>
                        ) : !p.is_active ? (
                          <span className="badge bg-secondary bg-opacity-15 text-secondary border rounded-pill px-2.5 py-1">
                            Inactive (Deactivated)
                          </span>
                        ) : isScheduled ? (
                          <span className="badge bg-info bg-opacity-15 text-info border border-info border-opacity-25 rounded-pill px-2.5 py-1">
                            <i className="bi bi-clock-history me-1"></i> Scheduled
                          </span>
                        ) : isExpired ? (
                          <span className="badge bg-warning bg-opacity-15 text-warning border border-warning border-opacity-25 rounded-pill px-2.5 py-1">
                            Expired
                          </span>
                        ) : (
                          <span className="badge bg-light text-muted border rounded-pill px-2.5 py-1">Idle</span>
                        )}
                      </td>
                      <td className="text-end pe-4">
                        <div className="d-flex justify-content-end gap-1.5">
                          {/* Toggle Active Button */}
                          <button
                            onClick={() => handleToggleActive(p)}
                            className={`btn btn-sm ${p.is_active ? 'btn-outline-warning' : 'btn-outline-success'} rounded-pill text-xs px-2.5`}
                            title={p.is_active ? 'Deactivate Promotion' : 'Activate Promotion'}
                          >
                            <i className={`bi ${p.is_active ? 'bi-pause-circle' : 'bi-play-circle'} me-1`}></i>
                            {p.is_active ? 'Pause' : 'Activate'}
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="btn btn-sm btn-outline-primary rounded-pill text-xs px-2.5"
                            title="Edit Promotion"
                          >
                            <i className="bi bi-pencil-square me-1"></i> Edit
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDelete(p.id, p.title || p.name)}
                            className="btn btn-sm btn-outline-danger rounded-pill text-xs px-2"
                            title="Delete Promotion"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Promotion Modal */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow-2xl overflow-hidden">
              <div className="modal-header border-bottom px-4 py-3 bg-slate-50">
                <div>
                  <h5 className="modal-title fw-bold text-slate-900">
                    {editingPromo ? 'Edit Promotion Campaign' : 'Create New Promotion Campaign'}
                  </h5>
                  <p className="text-muted small mb-0">
                    {editingPromo
                      ? `Updating details for promotion #${editingPromo.id}`
                      : 'Define trusted server-side discount rates and storefront announcements'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    {/* Title */}
                    <div className="col-12">
                      <label className="form-label small fw-bold text-slate-800">Promotion Title *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Addis Tech Expo 15% Off Flagships"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        required
                      />
                    </div>

                    {/* Description */}
                    <div className="col-12">
                      <label className="form-label small fw-bold text-slate-800">Description (Optional)</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        placeholder="Describe the promotion context, campaign terms, or target customer segment..."
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      ></textarea>
                    </div>

                    {/* Discount Type */}
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-slate-800">Discount Type *</label>
                      <select
                        className="form-select"
                        value={form.discount_type}
                        onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                      >
                        <option value="PERCENTAGE">Percentage (% Off Regular Price)</option>
                        <option value="FIXED">Fixed Amount (ETB Off Regular Price)</option>
                      </select>
                    </div>

                    {/* Discount Value */}
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-slate-800">
                        Discount Value * ({form.discount_type === 'PERCENTAGE' ? '%' : 'ETB'})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={form.discount_type === 'PERCENTAGE' ? '100' : undefined}
                        className="form-control"
                        placeholder={form.discount_type === 'PERCENTAGE' ? 'e.g. 15 (between 0.01% - 100%)' : 'e.g. 500 (ETB)'}
                        value={form.discount_value}
                        onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                        required
                      />
                      <small className="text-muted text-[11px]">
                        {form.discount_type === 'PERCENTAGE'
                          ? 'Valid range: 0.01% to 100.00%.'
                          : 'Must be positive; server prevents prices from dropping below 0 ETB.'}
                      </small>
                    </div>

                    {/* Validity Start & End Dates */}
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-slate-800">Start Date & Time *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={form.start_date}
                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-slate-800">Expiration Date & Time *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={form.end_date}
                        onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                        required
                      />
                    </div>

                    {/* Promotion Scope: Store-Wide Checkbox */}
                    <div className="col-12">
                      <div className="p-3 rounded-3 bg-light border">
                        <div className="form-check form-switch mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="applyToAllSwitch"
                            checked={form.apply_to_all}
                            onChange={(e) => setForm({ ...form, apply_to_all: e.target.checked })}
                          />
                          <label className="form-check-label fw-bold small text-slate-900" htmlFor="applyToAllSwitch">
                            Apply Store-Wide to All Products
                          </label>
                        </div>
                        <small className="text-muted text-xs d-block">
                          When checked, this promotion applies automatically to every active product in the catalog unless overridden by a product-specific promotion.
                        </small>
                      </div>
                    </div>

                    {/* Category & Product Selectors (if not store-wide) */}
                    {!form.apply_to_all && (
                      <>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold text-slate-800">Apply to Specific Categories</label>
                          <select
                            multiple
                            className="form-select"
                            style={{ height: '115px' }}
                            value={form.categories}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                              setForm({ ...form, categories: selected });
                            }}
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={String(c.id)}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <small className="text-muted text-[11px]">Hold Ctrl/Cmd to select multiple categories</small>
                        </div>

                        <div className="col-md-6">
                          <label className="form-label small fw-bold text-slate-800">Apply to Specific Products</label>
                          <select
                            multiple
                            className="form-select"
                            style={{ height: '115px' }}
                            value={form.products}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                              setForm({ ...form, products: selected });
                            }}
                          >
                            {products.map((p) => (
                              <option key={p.id} value={String(p.id)}>
                                {p.name} ({formatETB(p.price)})
                              </option>
                            ))}
                          </select>
                          <small className="text-muted text-[11px]">Hold Ctrl/Cmd to select multiple products</small>
                        </div>
                      </>
                    )}

                    {/* Banner Announcement */}
                    <div className="col-12">
                      <label className="form-label small fw-bold text-slate-800">
                        Homepage Banner Announcement (Optional)
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Limited-Time Offer: 15% OFF flagship laptops and smart tech! Free Addis delivery."
                        value={form.banner_announcement}
                        onChange={(e) => setForm({ ...form, banner_announcement: e.target.value })}
                      />
                      <small className="text-muted text-xs">
                        This text appears dynamically in the storefront's dismissible announcement bar while this promotion is active.
                      </small>
                    </div>

                    {/* Immediate Activation */}
                    <div className="col-12">
                      <div className="form-check form-switch mt-1">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="promoActiveSwitch"
                          checked={form.is_active}
                          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                        />
                        <label className="form-check-label small fw-bold text-slate-800" htmlFor="promoActiveSwitch">
                          Activate Promotion Immediately
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top px-4 py-3 bg-slate-50 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-light rounded-pill px-4 border"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm"
                    disabled={submitting}
                  >
                    {submitting
                      ? 'Saving Promotion...'
                      : editingPromo
                      ? 'Save Changes'
                      : 'Launch Promotion'}
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

export default ManagerPromotionsPage;
