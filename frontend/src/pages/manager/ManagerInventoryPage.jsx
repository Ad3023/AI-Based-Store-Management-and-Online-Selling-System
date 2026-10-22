import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const ManagerInventoryPage = () => {
  const [searchParams] = useSearchParams();
  const [inventoryData, setInventoryData] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Stock Adjust Modal state
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [adjustQuantity, setAdjustQuantity] = useState(10);
  const [movementType, setMovementType] = useState('RESTOCK');
  const [reference, setReference] = useState('');

  // Add / Edit Product Modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null => Create, object => Edit
  const [productForm, setProductForm] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    compare_at_price: '',
    cost_price: '',
    stock: 10,
    low_stock_threshold: 5,
    is_featured: false,
    is_active: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invRes, prodRes, catRes] = await Promise.all([
        api.get('products/inventory/'),
        api.get('products/items/'),
        api.get('products/categories/')
      ]);
      setInventoryData(invRes.data);
      const prodList = prodRes.data.results || prodRes.data || [];
      setProducts(prodList);
      setCategories(catRes.data.results || catRes.data || []);
    } catch (err) {
      console.error("Inventory error", err);
    } finally {
      setLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      category: categories.length > 0 ? categories[0].id : '',
      description: '',
      price: '',
      compare_at_price: '',
      cost_price: '',
      stock: 10,
      low_stock_threshold: 5,
      is_featured: false,
      is_active: true,
    });
    setShowProductModal(true);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'add' && categories.length > 0) {
      handleOpenCreateModal();
    }
  }, [searchParams, categories]);

  // Handle Delete Product with Explicit Confirmation Dialog
  const handleDeleteProduct = async (product) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${product.name}" (SKU: ${product.sku})?\n\nThis destructive action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);
      await api.delete(`products/items/${product.id}/`);
      setMessage({
        type: 'success',
        text: `Product "${product.name}" was permanently removed from the catalog.`,
      });
      fetchData();
    } catch (err) {
      console.error('Delete product error', err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Failed to delete product. It may be linked to existing order items.';
      alert(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category: product.category,
      description: product.description || '',
      price: product.price,
      compare_at_price: product.compare_at_price || '',
      cost_price: product.cost_price || 0,
      stock: product.stock,
      low_stock_threshold: product.low_stock_threshold || 5,
      is_featured: !!product.is_featured,
      is_active: product.is_active !== undefined ? product.is_active : true,
    });
    setShowProductModal(true);
  };

  // Submit Product Form (Create or Edit)
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        name: productForm.name,
        category: Number(productForm.category),
        description: productForm.description,
        price: parseFloat(productForm.price),
        compare_at_price: productForm.compare_at_price ? parseFloat(productForm.compare_at_price) : null,
        cost_price: productForm.cost_price ? parseFloat(productForm.cost_price) : 0,
        stock: parseInt(productForm.stock, 10),
        low_stock_threshold: parseInt(productForm.low_stock_threshold, 10),
        is_featured: productForm.is_featured,
        is_active: productForm.is_active,
      };

      if (editingProduct) {
        await api.patch(`products/items/${editingProduct.id}/`, payload);
        setMessage({ type: 'success', text: `Product "${payload.name}" updated successfully.` });
      } else {
        await api.post('products/items/', payload);
        setMessage({ type: 'success', text: `New product "${payload.name}" created and added to catalog.` });
      }

      setShowProductModal(false);
      setEditingProduct(null);
      fetchData();
    } catch (err) {
      console.error(err);
      const errDetail = err.response?.data
        ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${v}`).join(' ')
        : "Failed to save product.";
      alert(errDetail);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Stock Movement Adjustment
  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustProduct) return;

    try {
      setSubmitting(true);
      const res = await api.post('products/inventory/', {
        product_id: adjustProduct.id,
        quantity: movementType === 'RESTOCK' ? Math.abs(adjustQuantity) : -Math.abs(adjustQuantity),
        movement_type: movementType,
        reference: reference || 'Manual store inventory adjustment'
      });
      setMessage({ type: 'success', text: res.data.message });
      setAdjustProduct(null);
      setReference('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to adjust stock.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory ? String(p.category) === String(filterCategory) : true;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Loading stock levels and catalog items...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bolder mb-1 text-dark">Inventory & Catalog Management</h2>
          <p className="text-muted small mb-0">Create products, update retail pricing, monitor stock thresholds, and track inventory movements</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-primary-gradient rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2"
            onClick={handleOpenCreateModal}
          >
            <i className="bi bi-plus-circle-fill"></i> Add New Product
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible fade show rounded-3 mb-4`} role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Stock Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white">
            <span className="text-muted small fw-bold text-uppercase">Total Catalog Items</span>
            <h3 className="fw-bolder text-dark mb-0">{inventoryData?.total_products || products.length}</h3>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white border-start border-4 border-warning">
            <span className="text-muted small fw-bold text-uppercase">Low Stock Alert (&le; 5 units)</span>
            <h3 className="fw-bolder text-warning mb-0">{inventoryData?.low_stock_count || 0}</h3>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white border-start border-4 border-danger">
            <span className="text-muted small fw-bold text-uppercase">Out of Stock</span>
            <h3 className="fw-bolder text-danger mb-0">{inventoryData?.out_of_stock_count || 0}</h3>
          </div>
        </div>
      </div>

      {/* Products Stock Table */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-5">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
          <h5 className="fw-bold mb-0">Live Catalog & Stock Levels ({filteredProducts.length})</h5>
          <div className="d-flex gap-2">
            <input
              type="text"
              className="form-control form-control-sm rounded-pill px-3"
              placeholder="Search product or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '220px' }}
            />
            <select
              className="form-select form-select-sm rounded-pill px-3"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="table-light text-uppercase small text-muted" style={{ fontSize: '0.72rem' }}>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Cost Price</th>
                <th>Retail Price</th>
                <th>Stock Level</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="small">
              {filteredProducts.map((p) => (
                <tr key={p.id}>
                  <td><code>{p.sku}</code></td>
                  <td>
                    <div className="fw-semibold text-dark">{p.name}</div>
                    {p.is_featured && <span className="badge bg-warning text-dark text-[10px]">Featured</span>}
                    {!p.is_active && <span className="badge bg-secondary text-[10px] ms-1">Inactive</span>}
                  </td>
                  <td className="text-muted">{p.category_name}</td>
                  <td>{formatETB(p.cost_price)}</td>
                  <td className="fw-bold text-dark">
                    {formatETB(p.price)}
                    {p.compare_at_price && (
                      <div className="text-muted text-decoration-line-through text-[11px]">
                        {formatETB(p.compare_at_price)}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="fw-bolder fs-6 text-dark">{p.stock}</span> units
                  </td>
                  <td>
                    {p.stock === 0 ? (
                      <span className="badge bg-danger">Out of Stock</span>
                    ) : p.stock <= p.low_stock_threshold ? (
                      <span className="badge bg-warning text-dark">Low Stock ({p.stock})</span>
                    ) : (
                      <span className="badge bg-success">In Stock</span>
                    )}
                  </td>
                  <td className="text-end">
                    <div className="d-flex justify-content-end gap-1">
                      <button
                        className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1"
                        onClick={() => handleOpenEditModal(p)}
                        title="Edit Product Details & Pricing"
                      >
                        <i className="bi bi-pencil me-1"></i> Edit
                      </button>
                      <button
                        className="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-1"
                        onClick={() => setAdjustProduct(p)}
                        title="Adjust Stock Level"
                      >
                        <i className="bi bi-box-arrow-in-down me-1"></i> Adjust
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-1"
                        onClick={() => handleDeleteProduct(p)}
                        title="Permanently Delete Product"
                      >
                        <i className="bi bi-trash me-1"></i> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Movements Audit Trail */}
      <div className="card border-0 shadow-sm rounded-4 p-4">
        <h5 className="fw-bold mb-3">Recent Stock Movements Audit Log</h5>
        {inventoryData?.recent_movements?.length === 0 ? (
          <div className="text-center py-4 text-muted small">No recent movements recorded.</div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light text-uppercase small text-muted" style={{ fontSize: '0.72rem' }}>
                <tr>
                  <th>Timestamp</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Quantity Change</th>
                  <th>Reference / Note</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody className="small">
                {inventoryData?.recent_movements?.map((m) => (
                  <tr key={m.id}>
                    <td className="text-muted">{new Date(m.created_at).toLocaleString()}</td>
                    <td className="fw-bold text-dark">{m.product_name}</td>
                    <td>
                      <span className={`badge ${
                        m.movement_type === 'RESTOCK' ? 'bg-success' : m.movement_type === 'SALE' ? 'bg-primary' : 'bg-warning text-dark'
                      }`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className={`fw-bold ${m.quantity > 0 ? 'text-success' : 'text-danger'}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="text-muted">{m.reference || 'N/A'}</td>
                    <td>{m.created_by_username || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Product */}
      {showProductModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: 'rgba(0, 0, 0, 0.65)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow-2xl p-3">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">
                  {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Create New Catalog Product'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowProductModal(false)}></button>
              </div>
              <form onSubmit={handleProductSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-8">
                      <label className="form-label small fw-bold">Product Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Samsung Galaxy S24 Ultra 256GB"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Category *</label>
                      <select
                        className="form-select"
                        value={productForm.category}
                        onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                        required
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-bold">Product Description *</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        placeholder="Describe technical specs, warranty, features..."
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        required
                      ></textarea>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Retail Price (ETB) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        placeholder="0.00"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Compare-at Price (ETB)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        placeholder="Optional original price"
                        value={productForm.compare_at_price}
                        onChange={(e) => setProductForm({ ...productForm, compare_at_price: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Cost Price (ETB)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        placeholder="Wholesale cost"
                        value={productForm.cost_price}
                        onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Current Stock Quantity</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={productForm.stock}
                        onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Low Stock Alert Threshold</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control"
                        value={productForm.low_stock_threshold}
                        onChange={(e) => setProductForm({ ...productForm, low_stock_threshold: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-12 d-flex gap-4 pt-2">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="isFeaturedSwitch"
                          checked={productForm.is_featured}
                          onChange={(e) => setProductForm({ ...productForm, is_featured: e.target.checked })}
                        />
                        <label className="form-check-label small fw-semibold" htmlFor="isFeaturedSwitch">
                          Featured on Homepage & Deals
                        </label>
                      </div>

                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="isActiveSwitch"
                          checked={productForm.is_active}
                          onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                        />
                        <label className="form-check-label small fw-semibold" htmlFor="isActiveSwitch">
                          Active (Visible in Storefront)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-3" onClick={() => setShowProductModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary-gradient rounded-pill px-4 fw-bold" disabled={submitting}>
                    {submitting ? 'Saving...' : editingProduct ? 'Save Product Changes' : 'Create Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustProduct && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: 'rgba(0, 0, 0, 0.65)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-2xl p-3">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Stock Adjustment</h5>
                <button type="button" className="btn-close" onClick={() => setAdjustProduct(null)}></button>
              </div>
              <form onSubmit={handleAdjustSubmit}>
                <div className="modal-body">
                  <div className="p-3 rounded-3 bg-light border mb-3">
                    <div className="fw-bold text-dark">{adjustProduct.name}</div>
                    <div className="small text-muted">SKU: <code>{adjustProduct.sku}</code></div>
                    <div className="small mt-1">Current Stock: <strong className="text-primary fs-6">{adjustProduct.stock} units</strong></div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Adjustment Action</label>
                    <select
                      className="form-select"
                      value={movementType}
                      onChange={(e) => setMovementType(e.target.value)}
                    >
                      <option value="RESTOCK">Restock (Add to inventory)</option>
                      <option value="ADJUSTMENT">Adjustment (Correction / Count)</option>
                      <option value="RETURN">Customer Return (Add back)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Quantity</label>
                    <input
                      type="number"
                      className="form-control"
                      value={adjustQuantity}
                      min="1"
                      onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Reason / Reference Document</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Supplier PO #4928 from Warehouse"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-3" onClick={() => setAdjustProduct(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary-gradient rounded-pill px-4 fw-bold" disabled={submitting}>
                    {submitting ? 'Updating...' : 'Save Stock Adjustment'}
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

export default ManagerInventoryPage;
