import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

  // Active View Tab: 'catalog' | 'forecasting' | 'movements'
  const [activeTab, setActiveTab] = useState('catalog');

  // AI Demand Forecasting State
  const [forecastingData, setForecastingData] = useState(null);
  const [forecastingLoading, setForecastingLoading] = useState(false);
  const [forecastingDays, setForecastingDays] = useState(60);
  const [riskFilter, setRiskFilter] = useState('ALL');

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

  const fetchForecasting = useCallback(async (days = forecastingDays) => {
    try {
      setForecastingLoading(true);
      const res = await api.get(`recommendations/forecasting/?days=${days}`);
      setForecastingData(res.data);
    } catch (err) {
      console.warn("Inventory forecasting fetch error", err);
    } finally {
      setForecastingLoading(false);
    }
  }, [forecastingDays]);

  const handleQuickRestockFromForecast = (forecastItem) => {
    const matched = products.find((p) => p.id === forecastItem.product_id) || {
      id: forecastItem.product_id,
      name: forecastItem.name,
      sku: forecastItem.sku,
      stock: forecastItem.current_stock,
    };
    setAdjustProduct(matched);
    setAdjustQuantity(forecastItem.suggested_reorder_qty || 10);
    setMovementType('RESTOCK');
    setReference(`AI Demand Run-Rate: Recommended restock (+${forecastItem.suggested_reorder_qty || 10})`);
  };

  const filteredForecasts = useMemo(() => {
    if (!forecastingData?.forecasts) return [];
    if (riskFilter === 'ALL') return forecastingData.forecasts;
    if (riskFilter === 'WARNINGS') {
      return forecastingData.forecasts.filter(
        (f) => f.risk_level === 'CRITICAL_OUT_OF_STOCK' || f.risk_level === 'HIGH_STOCKOUT_RISK'
      );
    }
    return forecastingData.forecasts.filter((f) => f.risk_level === riskFilter);
  }, [forecastingData, riskFilter]);

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
    fetchForecasting(forecastingDays);
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

      {/* Navigation Tabs */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3.5 py-2 fw-bold d-inline-flex align-items-center gap-2 shadow-sm transition ${
            activeTab === 'catalog' ? 'btn-primary' : 'btn-white bg-white text-slate-700 border border-slate-200'
          }`}
          onClick={() => setActiveTab('catalog')}
        >
          <i className="bi bi-boxes"></i>
          <span>Live Catalog & Stock</span>
          <span className={`badge rounded-pill px-2 ${activeTab === 'catalog' ? 'bg-white text-primary' : 'bg-slate-100 text-slate-700'}`}>
            {filteredProducts.length}
          </span>
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3.5 py-2 fw-bold d-inline-flex align-items-center gap-2 shadow-sm transition ${
            activeTab === 'forecasting' ? 'btn-primary' : 'btn-white bg-white text-slate-700 border border-slate-200'
          }`}
          onClick={() => {
            setActiveTab('forecasting');
            if (!forecastingData) fetchForecasting(forecastingDays);
          }}
        >
          <i className="bi bi-lightning-charge-fill text-warning"></i>
          <span>AI Demand Forecasting</span>
          {forecastingData?.stockout_warnings_count > 0 && (
            <span className="badge bg-danger text-white rounded-pill px-2">
              {forecastingData.stockout_warnings_count} Alert{forecastingData.stockout_warnings_count === 1 ? '' : 's'}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3.5 py-2 fw-bold d-inline-flex align-items-center gap-2 shadow-sm transition ${
            activeTab === 'movements' ? 'btn-primary' : 'btn-white bg-white text-slate-700 border border-slate-200'
          }`}
          onClick={() => setActiveTab('movements')}
        >
          <i className="bi bi-clock-history"></i>
          <span>Stock Movement Logs</span>
          <span className={`badge rounded-pill px-2 ${activeTab === 'movements' ? 'bg-white text-primary' : 'bg-slate-100 text-slate-700'}`}>
            {inventoryData?.recent_movements?.length || 0}
          </span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: LIVE CATALOG & STOCK
          ========================================================================= */}
      {activeTab === 'catalog' && (
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
                      {p.has_promotion && p.current_price && Number(p.current_price) < Number(p.price) && (
                        <div className="text-success text-[11px] fw-bold">
                          Promo: {formatETB(p.current_price)} ({p.discount_label})
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
      )}

      {/* =========================================================================
          TAB 2: AI DEMAND FORECASTING & RESTOCK INTELLIGENCE
          ========================================================================= */}
      {activeTab === 'forecasting' && (
        <div className="card border-0 shadow-sm rounded-4 p-4 mb-5 bg-white">
          {/* Header & Controls */}
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
            <div>
              <div className="d-flex align-items-center gap-2">
                <span className="p-1.5 rounded-3 bg-amber-500 bg-opacity-10 text-amber-600">
                  <i className="bi bi-cpu-fill fs-5"></i>
                </span>
                <h5 className="fw-bold mb-0 text-slate-900">AI Stock Intelligence & Demand Forecasting</h5>
              </div>
              <p className="text-muted small mb-0 mt-1">
                Grounded moving sales velocity algorithm analyzes verified order histories to predict 30-day demand and prevent warehouse stockouts.
              </p>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <div className="d-flex align-items-center gap-1.5 bg-slate-50 border rounded-pill px-3 py-1 text-xs">
                <span className="text-slate-500">History:</span>
                <select
                  className="form-select form-select-sm border-0 bg-transparent text-xs fw-bold p-0 pe-4 shadow-none"
                  value={forecastingDays}
                  onChange={(e) => {
                    const days = Number(e.target.value);
                    setForecastingDays(days);
                    fetchForecasting(days);
                  }}
                  style={{ width: 'auto' }}
                >
                  <option value={30}>Past 30 Days</option>
                  <option value={60}>Past 60 Days</option>
                  <option value={90}>Past 90 Days</option>
                </select>
              </div>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-pill px-3 d-inline-flex align-items-center gap-1"
                onClick={() => fetchForecasting(forecastingDays)}
                disabled={forecastingLoading}
              >
                <i className={`bi bi-arrow-repeat ${forecastingLoading ? 'spin' : ''}`}></i>
                <span>Refresh AI Model</span>
              </button>
            </div>
          </div>

          {/* Alert if critical stockouts exist */}
          {forecastingData?.stockout_warnings_count > 0 && (
            <div className="alert alert-warning border-warning border-opacity-25 rounded-3 d-flex align-items-center gap-3 mb-4">
              <i className="bi bi-exclamation-triangle-fill text-warning fs-4 shrink-0"></i>
              <div className="text-xs">
                <strong className="d-block text-slate-900 font-semibold mb-0.5">
                  Restocking Action Required ({forecastingData.stockout_warnings_count} hardware items at high risk)
                </strong>
                Estimated days of stock are below 14 days or products are out of stock. Suggested reorder units have been computed automatically based on current sales velocity.
              </div>
            </div>
          )}

          {/* Forecasting KPI Summary Cards */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <div className="p-3 rounded-3 bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[11px] text-uppercase fw-bold">Monitored Items</span>
                <h4 className="fw-bolder text-slate-900 mb-0 mt-1">
                  {forecastingData?.total_products_monitored || 0}
                </h4>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-3 rounded-3 bg-red-50 border border-red-200">
                <span className="text-red-700 text-[11px] text-uppercase fw-bold">Stockout Alerts</span>
                <h4 className="fw-bolder text-red-600 mb-0 mt-1">
                  {forecastingData?.stockout_warnings_count || 0}
                </h4>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-3 rounded-3 bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[11px] text-uppercase fw-bold">Forecast Horizon</span>
                <h4 className="fw-bolder text-primary mb-0 mt-1">
                  30 Days
                </h4>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-3 rounded-3 bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[11px] text-uppercase fw-bold">Analysis Window</span>
                <h4 className="fw-bolder text-slate-900 mb-0 mt-1">
                  {forecastingData?.analysis_window_days || forecastingDays} Days
                </h4>
              </div>
            </div>
          </div>

          {/* Risk Level Filter Chips */}
          <div className="d-flex flex-wrap gap-1.5 mb-3 align-items-center">
            <span className="text-xs text-slate-500 me-1">Risk Filter:</span>
            {[
              { id: 'ALL', label: 'All Items' },
              { id: 'WARNINGS', label: 'Urgent Alerts' },
              { id: 'CRITICAL_OUT_OF_STOCK', label: 'Out of Stock' },
              { id: 'HIGH_STOCKOUT_RISK', label: 'High Risk (<14d)' },
              { id: 'MODERATE_REORDER_SOON', label: 'Reorder Soon' },
              { id: 'ADEQUATE_STOCK', label: 'Stock Healthy' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`btn btn-xs rounded-pill px-2.5 py-1 ${
                  riskFilter === f.id ? 'btn-primary' : 'btn-outline-secondary'
                }`}
                onClick={() => setRiskFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Forecasting Table */}
          {forecastingLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary spinner-border-sm" role="status"></div>
              <p className="text-muted small mt-2">Computing 30-day demand forecast from PostgreSQL orders...</p>
            </div>
          ) : filteredForecasts.length === 0 ? (
            <div className="text-center py-5 text-slate-400 text-xs">
              <i className="bi bi-check-circle-fill text-success fs-3 d-block mb-1"></i>
              No products match the selected risk filter.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle text-xs mb-0">
                <thead className="table-light text-slate-500 text-uppercase" style={{ fontSize: '0.7rem' }}>
                  <tr>
                    <th>Product & SKU</th>
                    <th>Category</th>
                    <th className="text-center">Current Stock</th>
                    <th className="text-center">Sales Velocity</th>
                    <th className="text-center">30-Day Demand</th>
                    <th className="text-center">Days of Stock</th>
                    <th className="text-center">Urgency</th>
                    <th className="text-center">Suggested Reorder</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredForecasts.map((f) => (
                    <tr key={f.product_id}>
                      <td>
                        <div className="fw-bold text-slate-900">{f.name}</div>
                        <code className="text-[10px] text-slate-400">{f.sku}</code>
                      </td>
                      <td className="text-slate-500">{f.category}</td>
                      <td className="text-center">
                        <span className={`fw-bold ${f.current_stock === 0 ? 'text-danger' : f.current_stock <= f.low_stock_threshold ? 'text-warning font-semibold' : 'text-slate-900'}`}>
                          {f.current_stock}
                        </span>
                        <span className="text-[10px] text-slate-400 d-block">Threshold: {f.low_stock_threshold}</span>
                      </td>
                      <td className="text-center">
                        <span className="fw-semibold text-slate-700">{f.daily_sales_velocity}</span>
                        <span className="text-[10px] text-slate-400 d-block">units/day</span>
                      </td>
                      <td className="text-center">
                        <span className="fw-bold text-primary">{f.predicted_30d_demand}</span>
                        <span className="text-[10px] text-slate-400 d-block">predicted</span>
                      </td>
                      <td className="text-center">
                        {f.estimated_days_of_stock >= 999 ? (
                          <span className="text-slate-400">&infin;</span>
                        ) : (
                          <span className={`fw-bold ${f.estimated_days_of_stock < 14 ? 'text-danger' : f.estimated_days_of_stock < 30 ? 'text-warning' : 'text-success'}`}>
                            ~{Math.round(f.estimated_days_of_stock)} days
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        {f.risk_level === 'CRITICAL_OUT_OF_STOCK' && (
                          <span className="badge bg-danger text-white text-[10px] px-2 py-0.5">
                            Out of Stock
                          </span>
                        )}
                        {f.risk_level === 'HIGH_STOCKOUT_RISK' && (
                          <span className="badge bg-danger bg-opacity-10 text-danger text-[10px] px-2 py-0.5">
                            High Risk
                          </span>
                        )}
                        {f.risk_level === 'MODERATE_REORDER_SOON' && (
                          <span className="badge bg-warning bg-opacity-15 text-warning text-[10px] px-2 py-0.5">
                            Reorder Soon
                          </span>
                        )}
                        {f.risk_level === 'ADEQUATE_STOCK' && (
                          <span className="badge bg-success bg-opacity-10 text-success text-[10px] px-2 py-0.5">
                            Healthy
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        {f.suggested_reorder_qty > 0 ? (
                          <span className="badge bg-primary bg-opacity-10 text-primary fw-bold text-[11px] px-2 py-0.5">
                            +{f.suggested_reorder_qty} units
                          </span>
                        ) : (
                          <span className="text-slate-400">&mdash;</span>
                        )}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-xs btn-primary-gradient rounded-pill px-2.5 py-1 fw-bold shadow-sm"
                          onClick={() => handleQuickRestockFromForecast(f)}
                          title="Restock this item"
                        >
                          <i className="bi bi-box-arrow-in-down me-1"></i> Restock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: STOCK MOVEMENTS AUDIT TRAIL
          ========================================================================= */}
      {activeTab === 'movements' && (
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
      )}

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
