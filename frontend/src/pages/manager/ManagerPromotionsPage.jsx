import React, { useState, useEffect } from 'react';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const ManagerPromotionsPage = () => {
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [form, setForm] = useState({
    name: '',
    discount_type: 'PERCENTAGE',
    discount_value: '',
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
      const [promoRes, prodRes, catRes] = await Promise.all([
        api.get('products/promotions/'),
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
  }, []);

  const handleToggleActive = async (promo) => {
    try {
      await api.patch(`products/promotions/${promo.id}/`, {
        is_active: !promo.is_active,
      });
      setFeedback({
        type: 'success',
        text: `Promotion "${promo.name}" is now ${!promo.is_active ? 'Active' : 'Inactive'}.`,
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update promotion status.');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove promotion "${name}"?`)) return;
    try {
      await api.delete(`products/promotions/${id}/`);
      setFeedback({ type: 'success', text: `Promotion "${name}" deleted.` });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete promotion.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.discount_value) {
      alert('Please provide a name and discount value.');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('products/promotions/', {
        ...form,
        discount_value: Number(form.discount_value),
        products: form.products.map(Number),
        categories: form.categories.map(Number),
      });
      setShowModal(false);
      setFeedback({ type: 'success', text: 'New promotion created and scheduled successfully!' });
      setForm({
        name: '',
        discount_type: 'PERCENTAGE',
        discount_value: '',
        start_date: new Date().toISOString().slice(0, 16),
        end_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
        is_active: true,
        banner_announcement: '',
        products: [],
        categories: [],
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create promotion.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-lg-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h3 className="fw-bolder mb-1 text-slate-900">Promotions & Discounts Management</h3>
          <p className="text-muted small mb-0">
            Create, schedule, activate, and manage authoritative store discounts and announcement banners.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2"
        >
          <i className="bi bi-plus-circle"></i> Create New Promotion
        </button>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 small`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Promotions List */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
        <div className="p-3.5 border-bottom bg-slate-50 d-flex justify-content-between align-items-center">
          <span className="fw-bold text-slate-800 small">Active & Scheduled Promotions ({promotions.length})</span>
          <button onClick={fetchData} className="btn btn-sm btn-light rounded-pill border">
            <i className="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted small mt-2">Loading promotions ledger...</p>
          </div>
        ) : promotions.length === 0 ? (
          <div className="text-center py-5 text-muted small">
            No promotions configured yet. Click "Create New Promotion" above to launch a discount campaign.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-sm">
              <thead className="table-light text-slate-600 text-xs">
                <tr>
                  <th className="ps-4">Promotion Name</th>
                  <th>Discount</th>
                  <th>Scope</th>
                  <th>Schedule</th>
                  <th>Announcement Banner</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => {
                  const isCurrent =
                    p.is_active &&
                    new Date(p.start_date) <= new Date() &&
                    new Date(p.end_date) >= new Date();

                  return (
                    <tr key={p.id}>
                      <td className="ps-4">
                        <div className="fw-bold text-slate-900">{p.name}</div>
                        <small className="text-muted">ID: #{p.id}</small>
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
                          {p.categories?.length > 0 && (
                            <span className="badge bg-info bg-opacity-10 text-info me-1">
                              {p.categories.length} Categories
                            </span>
                          )}
                          {p.products?.length > 0 && (
                            <span className="badge bg-secondary bg-opacity-10 text-secondary">
                              {p.products.length} Products
                            </span>
                          )}
                          {p.categories?.length === 0 && p.products?.length === 0 && (
                            <span className="text-muted text-xs">Store-wide</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="text-xs">
                          <div><strong>Start:</strong> {new Date(p.start_date).toLocaleDateString()}</div>
                          <div><strong>End:</strong> {new Date(p.end_date).toLocaleDateString()}</div>
                        </div>
                      </td>
                      <td>
                        {p.banner_announcement ? (
                          <div className="text-xs text-truncate" style={{ maxWidth: '200px' }} title={p.banner_announcement}>
                            <i className="bi bi-megaphone text-cyan-600 me-1"></i>
                            {p.banner_announcement}
                          </div>
                        ) : (
                          <span className="text-muted text-xs">None</span>
                        )}
                      </td>
                      <td>
                        {isCurrent ? (
                          <span className="badge bg-success rounded-pill px-2.5 py-1">
                            <i className="bi bi-check-circle-fill me-1"></i> Live
                          </span>
                        ) : !p.is_active ? (
                          <span className="badge bg-secondary rounded-pill px-2.5 py-1">Inactive</span>
                        ) : new Date(p.end_date) < new Date() ? (
                          <span className="badge bg-warning text-dark rounded-pill px-2.5 py-1">Expired</span>
                        ) : (
                          <span className="badge bg-info text-dark rounded-pill px-2.5 py-1">Scheduled</span>
                        )}
                      </td>
                      <td className="text-end pe-4">
                        <div className="d-flex justify-content-end gap-1">
                          <button
                            onClick={() => handleToggleActive(p)}
                            className={`btn btn-sm ${p.is_active ? 'btn-outline-warning' : 'btn-outline-success'} rounded-pill text-xs`}
                            title={p.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {p.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="btn btn-sm btn-outline-danger rounded-pill text-xs"
                            title="Delete"
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

      {/* Create Promotion Modal */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(3px)' }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold">Create New Promotion Campaign</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label small fw-bold">Promotion Title *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Nexus Tech Days 15% Off"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Discount Type *</label>
                      <select
                        className="form-select"
                        value={form.discount_type}
                        onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                      >
                        <option value="PERCENTAGE">Percentage (% Off)</option>
                        <option value="FIXED">Fixed Amount (ETB Off)</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">
                        Discount Value * ({form.discount_type === 'PERCENTAGE' ? '%' : 'ETB'})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        className="form-control"
                        placeholder={form.discount_type === 'PERCENTAGE' ? 'e.g. 15' : 'e.g. 1000'}
                        value={form.discount_value}
                        onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Start Date & Time *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={form.start_date}
                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">End Date & Time *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={form.end_date}
                        onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-bold">Banner Announcement (Optional)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Special Offer: 15% OFF across all flagship gadgets!"
                        value={form.banner_announcement}
                        onChange={(e) => setForm({ ...form, banner_announcement: e.target.value })}
                      />
                      <small className="text-muted text-xs">
                        Will appear in the dismissible announcement bar at the top of the storefront.
                      </small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Apply to Specific Categories</label>
                      <select
                        multiple
                        className="form-select"
                        style={{ height: '110px' }}
                        value={form.categories}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                          setForm({ ...form, categories: selected });
                        }}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <small className="text-muted text-[11px]">Hold Ctrl/Cmd to select multiple</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Apply to Specific Products</label>
                      <select
                        multiple
                        className="form-select"
                        style={{ height: '110px' }}
                        value={form.products}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                          setForm({ ...form, products: selected });
                        }}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatETB(p.price)})
                          </option>
                        ))}
                      </select>
                      <small className="text-muted text-[11px]">Hold Ctrl/Cmd to select multiple</small>
                    </div>

                    <div className="col-12">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="promoActiveSwitch"
                          checked={form.is_active}
                          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                        />
                        <label className="form-check-label small fw-bold" htmlFor="promoActiveSwitch">
                          Activate Immediately
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top px-4 py-3">
                  <button
                    type="button"
                    className="btn btn-light rounded-pill px-4"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary rounded-pill px-4 fw-bold"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating Promotion...' : 'Launch Promotion'}
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
