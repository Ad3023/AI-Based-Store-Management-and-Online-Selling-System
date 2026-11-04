import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';

const ManagerProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, isSuperAdmin, isStoreManager, hasPermission } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [filterFeatured, setFilterFeatured] = useState('ALL'); // 'ALL' | 'FEATURED' | 'REGULAR'

  // Modals State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null => Create, object => Edit
  const [previewProduct, setPreviewProduct] = useState(null);
  const [deleteTargetProduct, setDeleteTargetProduct] = useState(null);

  // Form State
  const [productForm, setProductForm] = useState({
    name: '',
    category: '',
    supplier: '',
    description: '',
    price: '',
    compare_at_price: '',
    cost_price: '',
    initial_stock: 10,
    low_stock_threshold: 5,
    reorder_quantity: 20,
    is_featured: false,
    is_active: true,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const canCreate = isSuperAdmin || isAdmin || isStoreManager || hasPermission('products.create');
  const canEdit = isSuperAdmin || isAdmin || isStoreManager || hasPermission('products.edit');
  const canDelete = isSuperAdmin || isAdmin || isStoreManager || hasPermission('products.delete');

  const fetchCatalogData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, supRes] = await Promise.all([
        api.get('products/items/'),
        api.get('products/categories/'),
        api.get('products/suppliers/'),
      ]);
      const prodList = prodRes.data.results || prodRes.data || [];
      setProducts(prodList);
      setCategories(catRes.data.results || catRes.data || []);
      setSuppliers(supRes.data.results || supRes.data || []);
    } catch (err) {
      console.error('Failed to load catalog data', err);
      setMessage({ type: 'danger', text: 'Failed to load catalog products from database.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogData();
  }, [fetchCatalogData]);

  // Open Create Modal
  const handleOpenCreateModal = useCallback(() => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      category: categories.length > 0 ? categories[0].id : '',
      supplier: suppliers.length > 0 ? suppliers[0].id : '',
      description: '',
      price: '',
      compare_at_price: '',
      cost_price: '',
      initial_stock: 10,
      low_stock_threshold: 5,
      reorder_quantity: 20,
      is_featured: false,
      is_active: true,
    });
    setImageFile(null);
    setImagePreviewUrl('');
    setShowProductModal(true);
  }, [categories, suppliers]);

  // Handle URL query trigger e.g. /admin/products?action=add
  useEffect(() => {
    if (searchParams.get('action') === 'add' && categories.length > 0) {
      handleOpenCreateModal();
    }
  }, [searchParams, categories, handleOpenCreateModal]);

  // Open Edit Modal
  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || '',
      category: product.category || (categories[0]?.id || ''),
      supplier: product.supplier || '',
      description: product.description || '',
      price: product.price || '',
      compare_at_price: product.compare_at_price || '',
      cost_price: product.cost_price || '',
      initial_stock: product.stock, // shown read-only in edit mode
      low_stock_threshold: product.low_stock_threshold || 5,
      reorder_quantity: product.reorder_quantity || 20,
      is_featured: Boolean(product.is_featured),
      is_active: product.is_active !== undefined ? Boolean(product.is_active) : true,
    });
    setImageFile(null);
    setImagePreviewUrl(product.image || '');
    setShowProductModal(true);
  };

  // Image Selection Handler
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const objectUrl = URL.createObjectURL(file);
      setImagePreviewUrl(objectUrl);
    }
  };

  // Submit Product Create or Edit
  const handleProductSubmit = async (e) => {
    e.preventDefault();

    if (!productForm.name.trim()) {
      alert('Product name is required.');
      return;
    }
    if (!productForm.category) {
      alert('Please select a product category.');
      return;
    }
    if (!productForm.price || parseFloat(productForm.price) <= 0) {
      alert('Please enter a valid retail selling price.');
      return;
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('name', productForm.name.trim());
      data.append('category', productForm.category);
      if (productForm.supplier) {
        data.append('supplier', productForm.supplier);
      }
      data.append('description', productForm.description);
      data.append('price', parseFloat(productForm.price));
      if (productForm.compare_at_price) {
        data.append('compare_at_price', parseFloat(productForm.compare_at_price));
      }
      if (productForm.cost_price) {
        data.append('cost_price', parseFloat(productForm.cost_price));
      }
      data.append('low_stock_threshold', parseInt(productForm.low_stock_threshold, 10) || 5);
      data.append('reorder_quantity', parseInt(productForm.reorder_quantity, 10) || 20);
      data.append('is_featured', productForm.is_featured ? 'true' : 'false');
      data.append('is_active', productForm.is_active ? 'true' : 'false');

      if (imageFile) {
        data.append('image', imageFile);
      }

      if (editingProduct) {
        // IMPORTANT: When editing product catalog metadata, DO NOT pass stock so existing inventory is preserved
        await api.patch(`products/items/${editingProduct.id}/`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setMessage({ type: 'success', text: `Product "${productForm.name}" updated successfully.` });
      } else {
        // On initial creation, stock can be assigned initial level
        data.append('stock', parseInt(productForm.initial_stock, 10) || 0);
        await api.post('products/items/', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setMessage({ type: 'success', text: `New product "${productForm.name}" created and added to catalog.` });
      }

      setShowProductModal(false);
      setEditingProduct(null);
      setImageFile(null);
      setImagePreviewUrl('');
      await fetchCatalogData();
    } catch (err) {
      console.error('Failed to save product', err);
      const errDetail = err.response?.data
        ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${v}`).join(' ')
        : 'Failed to save product.';
      alert(`Error: ${errDetail}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Toggle Active/Inactive Status
  const handleToggleActive = async (product) => {
    try {
      const nextStatus = !product.is_active;
      await api.patch(`products/items/${product.id}/`, { is_active: nextStatus });
      setMessage({
        type: 'success',
        text: `Product "${product.name}" is now ${nextStatus ? 'ACTIVE' : 'INACTIVE (Archived)'}.`,
      });
      fetchCatalogData();
    } catch (err) {
      console.error('Failed to toggle active status', err);
      alert('Failed to update product status.');
    }
  };

  // Confirm and Execute Delete Product
  const handleConfirmDelete = async () => {
    if (!deleteTargetProduct) return;
    try {
      setSubmitting(true);
      await api.delete(`products/items/${deleteTargetProduct.id}/`);
      setMessage({
        type: 'success',
        text: `Product "${deleteTargetProduct.name}" (SKU: ${deleteTargetProduct.sku}) was permanently deleted.`,
      });
      setDeleteTargetProduct(null);
      fetchCatalogData();
    } catch (err) {
      console.error('Failed to delete product', err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Cannot delete product because it has associated customer order records. Consider deactivating it instead.';
      alert(`Delete Failed: ${errMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        (p.name || '').toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term) ||
        (p.category_name || '').toLowerCase().includes(term) ||
        (p.supplier_name || '').toLowerCase().includes(term);

      if (!matchSearch) return false;

      if (filterCategory && String(p.category) !== String(filterCategory)) {
        return false;
      }

      if (filterStatus === 'ACTIVE' && !p.is_active) return false;
      if (filterStatus === 'INACTIVE' && p.is_active) return false;

      if (filterFeatured === 'FEATURED' && !p.is_featured) return false;
      if (filterFeatured === 'REGULAR' && p.is_featured) return false;

      return true;
    });
  }, [products, searchTerm, filterCategory, filterStatus, filterFeatured]);

  // Catalog Summary Statistics
  const totalCount = products.length;
  const activeCount = products.filter((p) => p.is_active).length;
  const inactiveCount = totalCount - activeCount;
  const featuredCount = products.filter((p) => p.is_featured).length;

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Loading product catalog...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid px-0">
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h4 className="fw-bolder mb-1 text-slate-900">
            <i className="bi bi-laptop me-2 text-primary"></i>
            Manage Product Catalog
          </h4>
          <p className="text-slate-500 text-xs mb-0">
            Create products, update retail pricing, configure brand specifications, upload media, and manage active status.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Link
            to={isAdmin ? '/admin/inventory' : '/manager/inventory'}
            className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs fw-semibold"
          >
            <i className="bi bi-boxes me-1 text-primary"></i> Go to Inventory &amp; Stock
          </Link>
          {canCreate && (
            <button
              type="button"
              className="btn btn-sm btn-primary rounded-pill px-4 text-xs fw-bold shadow-sm d-flex align-items-center gap-1.5"
              onClick={handleOpenCreateModal}
            >
              <i className="bi bi-plus-circle-fill"></i> Add New Product
            </button>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible fade show rounded-4 text-xs py-2.5 px-3 mb-4`} role="alert">
          {message.text}
          <button type="button" className="btn-close p-2.5" onClick={() => setMessage({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Catalog KPI Statistics */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</span>
              <div className="rounded-3 p-2 bg-blue-50 text-blue-600">
                <i className="bi bi-laptop fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-bolder text-slate-900 mb-1">{totalCount}</div>
            <div className="text-[11px] text-slate-500">Across all catalog categories</div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-emerald-500">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Active in Store</span>
              <div className="rounded-3 p-2 bg-emerald-50 text-emerald-700">
                <i className="bi bi-check-circle fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-bolder text-emerald-600 mb-1">{activeCount}</div>
            <div className="text-[11px] text-slate-500">Visible for customer shopping</div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-amber-500">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Featured Items</span>
              <div className="rounded-3 p-2 bg-amber-50 text-amber-700">
                <i className="bi bi-star-fill fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-bolder text-amber-600 mb-1">{featuredCount}</div>
            <div className="text-[11px] text-slate-500">Highlighted on homepage showcase</div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-slate-400">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Archived / Inactive</span>
              <div className="rounded-3 p-2 bg-slate-100 text-slate-600">
                <i className="bi bi-archive fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-bolder text-slate-700 mb-1">{inactiveCount}</div>
            <div className="text-[11px] text-slate-500">Hidden from public catalog</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-4">
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control text-xs"
                placeholder="Search products by name, SKU, or supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-3">
            <select
              className="form-select text-xs"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select
              className="form-select text-xs"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Archived Only</option>
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select
              className="form-select text-xs"
              value={filterFeatured}
              onChange={(e) => setFilterFeatured(e.target.value)}
            >
              <option value="ALL">All Products</option>
              <option value="FEATURED">Featured Only</option>
              <option value="REGULAR">Standard Items</option>
            </select>
          </div>

          <div className="col-auto ms-auto text-xs text-slate-500">
            Total Matching: <strong className="text-slate-900">{filteredProducts.length}</strong>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-laptop fs-1 text-slate-300 mb-2 d-block"></i>
            <h6 className="fw-bold text-slate-700">No Products Found</h6>
            <p className="text-slate-500 text-xs mb-3">
              {searchTerm || filterCategory || filterStatus !== 'ALL'
                ? 'No products match your active search filters.'
                : 'No products registered in the catalog yet.'}
            </p>
            {canCreate && (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs"
                onClick={handleOpenCreateModal}
              >
                <i className="bi bi-plus-lg me-1"></i> Add First Product
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
                <tr>
                  <th className="ps-4">Product &amp; Details</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Selling Price</th>
                  <th>Cost Price</th>
                  <th>Featured</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="ps-4">
                      <div className="d-flex align-items-center gap-2.5">
                        <div
                          className="rounded-3 bg-slate-100 border border-slate-200 overflow-hidden shrink-0 d-flex align-items-center justify-content-center"
                          style={{ width: '42px', height: '42px' }}
                        >
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-100 h-100 object-fit-cover" />
                          ) : (
                            <i className="bi bi-laptop text-slate-400 fs-5"></i>
                          )}
                        </div>
                        <div>
                          <div
                            className="fw-bold text-slate-900 cursor-pointer text-primary hover:underline text-truncate"
                            style={{ maxWidth: '240px' }}
                            onClick={() => setPreviewProduct(p)}
                            title={p.name}
                          >
                            {p.name}
                          </div>
                          <small className="text-slate-400 text-[11px] d-block text-truncate" style={{ maxWidth: '240px' }}>
                            {p.supplier_name ? `Vendor: ${p.supplier_name}` : 'Direct In-House Item'}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td className="font-monospace text-slate-600">
                      {p.sku || '—'}
                    </td>

                    <td>
                      <span className="badge bg-slate-100 text-slate-700 border text-[10px]">
                        {p.category_name || 'Unassigned'}
                      </span>
                    </td>

                    <td>
                      <div className="fw-bolder text-slate-900">
                        {formatETB(p.price)}
                      </div>
                      {p.compare_at_price && Number(p.compare_at_price) > Number(p.price) && (
                        <small className="text-slate-400 text-[10px] text-decoration-line-through">
                          {formatETB(p.compare_at_price)}
                        </small>
                      )}
                    </td>

                    <td className="text-slate-600 font-semibold">
                      {p.cost_price ? formatETB(p.cost_price) : '—'}
                    </td>

                    <td>
                      {p.is_featured ? (
                        <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-30 text-[10px]">
                          <i className="bi bi-star-fill me-1"></i>Featured
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Regular</span>
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className={`badge rounded-pill border-0 cursor-pointer px-2 py-1 ${
                          p.is_active
                            ? 'bg-success bg-opacity-10 text-success border border-success'
                            : 'bg-secondary bg-opacity-10 text-secondary'
                        }`}
                        onClick={() => canEdit && handleToggleActive(p)}
                        title={canEdit ? 'Click to toggle Active / Inactive' : undefined}
                      >
                        {p.is_active ? 'Active' : 'Archived'}
                      </button>
                    </td>

                    <td className="text-end pe-4">
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm p-1 px-2"
                          title="Preview Product Details"
                          onClick={() => setPreviewProduct(p)}
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm p-1 px-2"
                            title="Edit Product Info"
                            onClick={() => handleOpenEditModal(p)}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm p-1 px-2"
                            title="Delete Product"
                            onClick={() => setDeleteTargetProduct(p)}
                          >
                            <i className="bi bi-trash"></i>
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

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              <div className="modal-header bg-slate-900 text-white py-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-3 p-1.5 bg-primary text-white">
                    <i className="bi bi-laptop fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-white mb-0">
                      {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Catalog Product'}
                    </h5>
                    <small className="text-slate-400 text-xs">
                      {editingProduct ? `SKU: ${editingProduct.sku}` : 'Fill in specifications, pricing and media'}
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowProductModal(false)}
                ></button>
              </div>

              <form onSubmit={handleProductSubmit}>
                <div className="modal-body p-4 bg-slate-50">
                  <div className="row g-3">
                    {/* Product Name */}
                    <div className="col-12">
                      <label className="form-label text-xs fw-semibold text-slate-700">Product Name *</label>
                      <input
                        type="text"
                        className="form-control text-xs"
                        placeholder="e.g. Dell XPS 15 9530 Core i9 32GB RAM 1TB SSD"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        required
                      />
                    </div>

                    {/* Category */}
                    <div className="col-12 col-md-6">
                      <label className="form-label text-xs fw-semibold text-slate-700">Category *</label>
                      <select
                        className="form-select text-xs"
                        value={productForm.category}
                        onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                        required
                      >
                        <option value="">-- Select Category --</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Supplier */}
                    <div className="col-12 col-md-6">
                      <label className="form-label text-xs fw-semibold text-slate-700">Vendor / Supplier</label>
                      <select
                        className="form-select text-xs"
                        value={productForm.supplier}
                        onChange={(e) => setProductForm({ ...productForm, supplier: e.target.value })}
                      >
                        <option value="">-- Select Hardware Supplier (Optional) --</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Selling Price */}
                    <div className="col-12 col-md-4">
                      <label className="form-label text-xs fw-semibold text-slate-700">Retail Selling Price (ETB) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control text-xs fw-bold"
                        placeholder="0.00"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        required
                      />
                    </div>

                    {/* Compare at Price */}
                    <div className="col-12 col-md-4">
                      <label className="form-label text-xs fw-semibold text-slate-700">Compare at / List Price (ETB)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control text-xs"
                        placeholder="Original price before discount"
                        value={productForm.compare_at_price}
                        onChange={(e) => setProductForm({ ...productForm, compare_at_price: e.target.value })}
                      />
                    </div>

                    {/* Cost Price */}
                    <div className="col-12 col-md-4">
                      <label className="form-label text-xs fw-semibold text-slate-700">Unit Cost Price (ETB)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control text-xs"
                        placeholder="Supplier cost price"
                        value={productForm.cost_price}
                        onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                      />
                    </div>

                    {/* Image Upload */}
                    <div className="col-12">
                      <label className="form-label text-xs fw-semibold text-slate-700">Product Image (JPEG, PNG, WebP)</label>
                      <input
                        type="file"
                        className="form-control text-xs"
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                      {imagePreviewUrl && (
                        <div className="mt-2 d-flex align-items-center gap-3">
                          <img
                            src={imagePreviewUrl}
                            alt="Preview"
                            className="rounded-3 border border-slate-200 object-fit-cover shadow-sm"
                            style={{ width: '80px', height: '80px' }}
                          />
                          <small className="text-slate-500 text-xs">Image preview loaded</small>
                        </div>
                      )}
                    </div>

                    {/* Description & Specifications */}
                    <div className="col-12">
                      <label className="form-label text-xs fw-semibold text-slate-700">Product Description &amp; Specifications</label>
                      <textarea
                        className="form-control text-xs"
                        rows="4"
                        placeholder="Detailed technical specifications, CPU, RAM, storage, display resolution, battery life, included accessories..."
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      ></textarea>
                    </div>

                    {/* Stock Note in Edit Mode vs Create Mode */}
                    {!editingProduct ? (
                      <div className="col-12 col-md-4">
                        <label className="form-label text-xs fw-semibold text-slate-700">Initial Stock Quantity</label>
                        <input
                          type="number"
                          min="0"
                          className="form-control text-xs"
                          value={productForm.initial_stock}
                          onChange={(e) => setProductForm({ ...productForm, initial_stock: e.target.value })}
                        />
                        <small className="text-slate-400 text-[11px]">Subsequent stock changes are managed in Inventory.</small>
                      </div>
                    ) : (
                      <div className="col-12">
                        <div className="alert alert-info py-2 px-3 rounded-3 text-xs mb-0 d-flex align-items-center gap-2">
                          <i className="bi bi-info-circle-fill"></i>
                          <span>Current Stock: <strong>{editingProduct.stock} units</strong>. Stock quantity is strictly managed through the <strong>Inventory &amp; Stock</strong> module to prevent accidental overwrites.</span>
                        </div>
                      </div>
                    )}

                    {/* Toggles */}
                    <div className="col-12 d-flex gap-4 pt-2">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="featuredSwitch"
                          checked={productForm.is_featured}
                          onChange={(e) => setProductForm({ ...productForm, is_featured: e.target.checked })}
                        />
                        <label className="form-check-label text-xs fw-semibold text-slate-700" htmlFor="featuredSwitch">
                          Featured on Storefront
                        </label>
                      </div>

                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="activeSwitch"
                          checked={productForm.is_active}
                          onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                        />
                        <label className="form-check-label text-xs fw-semibold text-slate-700" htmlFor="activeSwitch">
                          Active (Visible in Catalog)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-white py-2.5 px-4 d-flex justify-content-end gap-2 border-top">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs"
                    onClick={() => setShowProductModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary rounded-pill px-4 text-xs fw-bold"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Product Details Preview Modal */}
      {previewProduct && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              <div className="modal-header bg-slate-900 text-white py-2.5 px-3">
                <span className="text-xs fw-bold">Product Details: {previewProduct.name}</span>
                <button type="button" className="btn-close btn-close-white" onClick={() => setPreviewProduct(null)}></button>
              </div>
              <div className="modal-body p-4 bg-white text-xs">
                <div className="row g-3">
                  <div className="col-12 col-md-5 text-center">
                    <div className="rounded-3 border border-slate-200 p-2 bg-slate-50 d-inline-block">
                      {previewProduct.image ? (
                        <img
                          src={previewProduct.image}
                          alt={previewProduct.name}
                          className="rounded-2 object-fit-contain"
                          style={{ maxWidth: '100%', maxHeight: '220px' }}
                        />
                      ) : (
                        <div className="py-5 text-slate-400">
                          <i className="bi bi-image fs-1 d-block mb-1"></i>
                          No image uploaded
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-12 col-md-7">
                    <div className="badge bg-slate-100 text-slate-700 border mb-1">
                      {previewProduct.category_name}
                    </div>
                    <h5 className="fw-bolder text-slate-900 mb-1">{previewProduct.name}</h5>
                    <div className="text-slate-400 font-monospace text-xs mb-3">
                      SKU: {previewProduct.sku}
                    </div>

                    <div className="d-flex align-items-baseline gap-2 mb-3">
                      <span className="fs-4 fw-bolder text-primary">
                        {formatETB(previewProduct.price)}
                      </span>
                      {previewProduct.compare_at_price && (
                        <span className="text-slate-400 text-decoration-line-through text-xs">
                          {formatETB(previewProduct.compare_at_price)}
                        </span>
                      )}
                    </div>

                    <div className="row g-2 mb-3 bg-slate-50 p-2.5 rounded-3 border">
                      <div className="col-6">
                        <span className="text-slate-400 text-[10px] uppercase d-block">Physical Stock:</span>
                        <strong className="text-slate-800">{previewProduct.stock} units</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-slate-400 text-[10px] uppercase d-block">Cost Price:</span>
                        <strong className="text-slate-800">{formatETB(previewProduct.cost_price || 0)}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-slate-400 text-[10px] uppercase d-block">Storefront Status:</span>
                        <span className={`badge ${previewProduct.is_active ? 'bg-success' : 'bg-secondary'}`}>
                          {previewProduct.is_active ? 'Active' : 'Archived'}
                        </span>
                      </div>
                      <div className="col-6">
                        <span className="text-slate-400 text-[10px] uppercase d-block">Supplier:</span>
                        <strong className="text-slate-800">{previewProduct.supplier_name || 'N/A'}</strong>
                      </div>
                    </div>

                    <div className="mb-2">
                      <strong className="text-slate-700 d-block mb-1">Description &amp; Specifications:</strong>
                      <p className="text-slate-600 text-xs mb-0" style={{ whiteSpace: 'pre-line' }}>
                        {previewProduct.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer py-2 bg-light d-flex justify-content-between">
                <Link
                  to={`/product/${previewProduct.id}`}
                  target="_blank"
                  className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs"
                >
                  <i className="bi bi-box-arrow-up-right me-1"></i> View in Storefront
                </Link>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary rounded-pill px-3 text-xs"
                  onClick={() => setPreviewProduct(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetProduct && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              <div className="modal-header bg-danger text-white py-2.5 px-3">
                <span className="text-xs fw-bold">Confirm Delete Product</span>
                <button type="button" className="btn-close btn-close-white" onClick={() => setDeleteTargetProduct(null)}></button>
              </div>
              <div className="modal-body p-4 bg-white text-xs">
                <div className="d-flex align-items-start gap-3">
                  <div className="rounded-circle p-2 bg-danger bg-opacity-10 text-danger shrink-0">
                    <i className="bi bi-exclamation-triangle-fill fs-3"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold text-slate-900 mb-1">
                      Are you sure you want to permanently delete this product?
                    </h6>
                    <p className="text-slate-600 mb-2">
                      Product: <strong>{deleteTargetProduct.name}</strong><br />
                      SKU: <strong>{deleteTargetProduct.sku}</strong>
                    </p>
                    <p className="text-slate-500 text-[11px] mb-0">
                      This action cannot be reversed. If the product has historical customer orders, the system will prevent deletion to preserve audit history (in that case, deactivate it instead).
                    </p>
                  </div>
                </div>
              </div>
              <div className="modal-footer py-2 bg-light d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs"
                  onClick={() => setDeleteTargetProduct(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger rounded-pill px-4 text-xs fw-bold"
                  disabled={submitting}
                  onClick={handleConfirmDelete}
                >
                  {submitting ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerProductsPage;

