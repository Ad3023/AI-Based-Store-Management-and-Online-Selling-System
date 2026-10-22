import React, { useState, useEffect } from 'react';
import api from '../../api';

const ManagerCategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get('products/categories/');
      setCategories(res.data.results || res.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenModal = (cat = null) => {
    setEditingCategory(cat);
    if (cat) {
      setName(cat.name);
      setSlug(cat.slug || '');
      setDescription(cat.description || '');
    } else {
      setName('');
      setSlug('');
      setDescription('');
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        slug: slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: description.trim(),
      };

      if (editingCategory) {
        await api.patch(`products/categories/${editingCategory.id}/`, payload);
        setFeedback({ type: 'success', text: `Category "${name}" updated successfully.` });
      } else {
        await api.post('products/categories/', payload);
        setFeedback({ type: 'success', text: `Category "${name}" created successfully.` });
      }
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save category.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-lg-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h3 className="fw-bolder mb-1 text-slate-900">Categories Management</h3>
          <p className="text-muted small mb-0">Organize electronics catalog hierarchy and category groupings.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2"
        >
          <i className="bi bi-folder-plus"></i> Add New Category
        </button>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 small`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        <div className="p-3.5 border-bottom bg-slate-50 d-flex justify-content-between align-items-center">
          <span className="fw-bold text-slate-800 small">All Categories ({categories.length})</span>
          <button onClick={fetchCategories} className="btn btn-sm btn-light rounded-pill border">
            <i className="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted small mt-2">Loading categories...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-sm">
              <thead className="table-light text-slate-600 text-xs">
                <tr>
                  <th className="ps-4">ID</th>
                  <th>Category Name</th>
                  <th>Slug</th>
                  <th>Description</th>
                  <th>Products in Catalog</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="ps-4 text-muted">#{c.id}</td>
                    <td>
                      <strong className="text-slate-900">{c.name}</strong>
                    </td>
                    <td>
                      <code className="text-slate-600">{c.slug}</code>
                    </td>
                    <td style={{ maxWidth: '280px' }}>
                      <span className="text-muted text-xs text-truncate d-block">
                        {c.description || 'No description'}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2.5 py-1">
                        {c.product_count || 0} products
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <button
                        onClick={() => handleOpenModal(c)}
                        className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs"
                      >
                        <i className="bi bi-pencil me-1"></i> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(3px)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold">
                  {editingCategory ? 'Edit Category' : 'Create New Category'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Category Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Smart Wearables"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Slug (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. smart-wearables"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                    />
                    <small className="text-muted text-xs">Leave blank to generate automatically</small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Short description of this product line..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    ></textarea>
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
                    {submitting ? 'Saving...' : 'Save Category'}
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

export default ManagerCategoriesPage;
