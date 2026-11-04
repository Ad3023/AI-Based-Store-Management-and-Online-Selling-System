import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';

const ManagerInventoryPage = () => {
  const { isAdmin, isSuperAdmin, isStoreManager, hasPermission } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [inventoryStats, setInventoryStats] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active View Tab: 'stock_levels' | 'movements' | 'incoming_pos' | 'forecasting'
  const [activeTab, setActiveTab] = useState('stock_levels');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState('ALL'); // 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'RESERVED'

  // Stock Adjustment Modal
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [adjustQuantity, setAdjustQuantity] = useState(10);
  const [movementType, setMovementType] = useState('RESTOCK');
  const [adjustmentReference, setAdjustmentReference] = useState('');

  // Thresholds & Reorder Settings Modal
  const [thresholdProduct, setThresholdProduct] = useState(null);
  const [minStockLevel, setMinStockLevel] = useState(5);
  const [reorderQuantity, setReorderQuantity] = useState(20);

  // AI Demand Forecasting State
  const [forecastingData, setForecastingData] = useState(null);
  const [forecastingLoading, setForecastingLoading] = useState(false);
  const [forecastingDays, setForecastingDays] = useState(60);
  const [riskFilter, setRiskFilter] = useState('ALL');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const canManageInventory = isSuperAdmin || isAdmin || isStoreManager || hasPermission('inventory.manage');

  const fetchInventoryData = useCallback(async () => {
    try {
      setLoading(true);
      const [invRes, prodRes, catRes, poRes] = await Promise.all([
        api.get('products/inventory/'),
        api.get('products/items/'),
        api.get('products/categories/'),
        api.get('products/purchase-requests/').catch(() => ({ data: [] })),
      ]);

      setInventoryStats(invRes.data);
      const prodList = prodRes.data.results || prodRes.data || [];
      setProducts(prodList);
      setCategories(catRes.data.results || catRes.data || []);
      const poList = poRes.data.results || poRes.data || [];
      setPurchaseOrders(poList);
      setStockMovements(invRes.data?.recent_movements || []);
    } catch (err) {
      console.error('Failed to load inventory data', err);
      setMessage({ type: 'danger', text: 'Failed to retrieve warehouse stock records.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchForecasting = useCallback(async (days = forecastingDays) => {
    try {
      setForecastingLoading(true);
      const res = await api.get(`recommendations/forecasting/?days=${days}`);
      setForecastingData(res.data);
    } catch (err) {
      console.warn('Inventory forecasting fetch error', err);
    } finally {
      setForecastingLoading(false);
    }
  }, [forecastingDays]);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  // Open Adjust Modal
  const handleOpenAdjustModal = (product, defaultType = 'RESTOCK', defaultQty = 10) => {
    setAdjustProduct(product);
    setMovementType(defaultType);
    setAdjustQuantity(defaultQty);
    setAdjustmentReference(
      defaultType === 'RESTOCK'
        ? 'Warehouse restock replenishment'
        : defaultType === 'DAMAGE'
        ? 'Defective or damaged unit written off'
        : 'Stock count audit correction'
    );
  };

  // Open Thresholds Modal
  const handleOpenThresholdModal = (product) => {
    setThresholdProduct(product);
    setMinStockLevel(product.low_stock_threshold || product.min_stock_level || 5);
    setReorderQuantity(product.reorder_quantity || product.suggested_reorder_quantity || 20);
  };

  // Submit Stock Adjustment
  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustProduct) return;

    const qty = parseInt(adjustQuantity, 10);
    if (!qty || qty <= 0) {
      alert('Please enter a valid positive quantity.');
      return;
    }
    if (!adjustmentReference.trim()) {
      alert('Please specify an audit reason or reference for this adjustment.');
      return;
    }

    try {
      setSubmitting(true);
      // If movement is negative adjustment, make quantity negative
      const isDeduction = movementType === 'DAMAGE' || movementType === 'SALE' || movementType === 'RETURN_TO_SUPPLIER';
      const finalQuantity = isDeduction ? -Math.abs(qty) : Math.abs(qty);

      const res = await api.post('products/inventory/', {
        product_id: adjustProduct.id,
        quantity: finalQuantity,
        movement_type: movementType,
        reference: adjustmentReference.trim(),
      });

      setMessage({ type: 'success', text: res.data.message || 'Stock quantity updated successfully.' });
      setAdjustProduct(null);
      setAdjustmentReference('');
      await fetchInventoryData();
    } catch (err) {
      console.error('Failed to adjust stock', err);
      const errMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to adjust stock quantity.';
      alert(`Error: ${errMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Thresholds Update
  const handleThresholdSubmit = async (e) => {
    e.preventDefault();
    if (!thresholdProduct) return;

    try {
      setSubmitting(true);
      await api.patch(`products/items/${thresholdProduct.id}/reorder-settings/`, {
        low_stock_threshold: parseInt(minStockLevel, 10),
        reorder_quantity: parseInt(reorderQuantity, 10),
      });

      setMessage({
        type: 'success',
        text: `Reorder thresholds for "${thresholdProduct.name}" updated successfully.`,
      });
      setThresholdProduct(null);
      await fetchInventoryData();
    } catch (err) {
      console.error('Failed to update thresholds', err);
      const errMsg = err.response?.data?.error || 'Failed to save reorder thresholds.';
      alert(`Error: ${errMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Restock from AI Forecasting
  const handleQuickRestockFromForecast = (forecastItem) => {
    const matched = products.find((p) => p.id === forecastItem.product_id) || {
      id: forecastItem.product_id,
      name: forecastItem.name,
      sku: forecastItem.sku,
      stock: forecastItem.current_stock,
    };
    handleOpenAdjustModal(matched, 'RESTOCK', forecastItem.suggested_reorder_qty || 10);
    setAdjustmentReference(`AI Demand Forecast recommendation (+${forecastItem.suggested_reorder_qty || 10})`);
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        (p.name || '').toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term) ||
        (p.category_name || '').toLowerCase().includes(term);

      if (!matchSearch) return false;

      if (filterCategory && String(p.category) !== String(filterCategory)) {
        return false;
      }

      const threshold = p.low_stock_threshold || 5;
      if (filterStockStatus === 'OUT_OF_STOCK' && p.stock > 0) return false;
      if (filterStockStatus === 'LOW_STOCK' && (p.stock === 0 || p.stock > threshold)) return false;
      if (filterStockStatus === 'IN_STOCK' && p.stock <= threshold) return false;
      if (filterStockStatus === 'RESERVED' && (!p.reserved_quantity || p.reserved_quantity === 0)) return false;

      return true;
    });
  }, [products, searchTerm, filterCategory, filterStockStatus]);

  // Filtered Forecasts
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

  // Aggregate Metrics
  const totalTracked = products.length;
  const totalPhysicalUnits = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalReservedUnits = products.reduce((acc, p) => acc + (p.reserved_quantity || 0), 0);
  const totalAvailableUnits = products.reduce((acc, p) => acc + (p.available_quantity !== undefined ? p.available_quantity : Math.max(0, p.stock - (p.reserved_quantity || 0))), 0);
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= (p.low_stock_threshold || 5)).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  const totalRetailValuation = products.reduce((acc, p) => acc + ((p.stock || 0) * parseFloat(p.price || 0)), 0);
  const totalCostValuation = products.reduce((acc, p) => acc + ((p.stock || 0) * parseFloat(p.cost_price || 0)), 0);

  // Incoming Purchase Requests (approved or in transit)
  const incomingPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const s = (po.status || '').toUpperCase();
      return (
        s === 'APPROVED' ||
        s === 'SENT_TO_SUPPLIER' ||
        s === 'AWAITING_SUPPLIER' ||
        s === 'ACCEPTED' ||
        s === 'PARTIALLY_ACCEPTED' ||
        s === 'PREPARING_ORDER' ||
        s === 'READY_FOR_DELIVERY' ||
        s === 'SHIPPED' ||
        s === 'PARTIALLY_RECEIVED'
      );
    });
  }, [purchaseOrders]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Loading warehouse inventory &amp; stock levels...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid px-0">
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h4 className="fw-bolder mb-1 text-slate-900">
            <i className="bi bi-boxes me-2 text-primary"></i>
            Inventory &amp; Stock Quantity Management
          </h4>
          <p className="text-slate-500 text-xs mb-0">
            Real-time warehouse stock ledger: track physical stock, customer order reservations, available units, incoming purchase orders, and audit history.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Link
            to={isAdmin ? '/admin/products' : '/manager/products'}
            className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs fw-semibold"
          >
            <i className="bi bi-laptop me-1 text-primary"></i> Go to Product Catalog
          </Link>
          {canManageInventory && (
            <button
              type="button"
              className="btn btn-sm btn-primary rounded-pill px-3.5 py-1.5 text-xs fw-bold shadow-sm d-flex align-items-center gap-1.5"
              onClick={() => handleOpenAdjustModal(products[0] || null, 'RESTOCK', 10)}
            >
              <i className="bi bi-plus-slash-minus"></i> Record Stock Adjustment
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

      {/* Inventory Summary Statistics Cards */}
      <div className="row g-3 mb-4">
        {/* Physical Stock Units */}
        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Physical Stock</span>
              <div className="rounded-3 p-2 bg-blue-50 text-blue-600">
                <i className="bi bi-box-seam fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-bolder text-slate-900 mb-1">{totalPhysicalUnits} <small className="fs-6 fw-normal text-slate-400">units</small></div>
            <div className="text-[11px] text-slate-500">Across {totalTracked} catalog items</div>
          </div>
        </div>

        {/* Available Units */}
        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-emerald-500">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Available for Sale</span>
              <div className="rounded-3 p-2 bg-emerald-50 text-emerald-700">
                <i className="bi bi-check2-circle fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-bolder text-emerald-600 mb-1">{totalAvailableUnits} <small className="fs-6 fw-normal text-slate-400">units</small></div>
            <div className="text-[11px] text-slate-500">Unreserved &amp; ready to ship</div>
          </div>
        </div>

        {/* Reserved Units */}
        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-cyan-500">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-xs font-semibold text-cyan-700 uppercase tracking-wider">Reserved in Orders</span>
              <div className="rounded-3 p-2 bg-cyan-50 text-cyan-700">
                <i className="bi bi-cart-check fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-bolder text-cyan-700 mb-1">{totalReservedUnits} <small className="fs-6 fw-normal text-slate-400">units</small></div>
            <div className="text-[11px] text-slate-500">Held in pending / processing orders</div>
          </div>
        </div>

        {/* Stock Alerts (Low & Out of Stock) */}
        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-rose-500">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Stock Alerts</span>
              <div className="rounded-3 p-2 bg-rose-50 text-rose-700">
                <i className="bi bi-exclamation-triangle fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-bolder text-rose-600 mb-1">{lowStockCount + outOfStockCount}</div>
            <div className="text-[11px] text-slate-500">
              <span className="text-danger fw-semibold">{outOfStockCount} out of stock</span> &bull; <span className="text-warning fw-semibold">{lowStockCount} low stock</span>
            </div>
          </div>
        </div>
      </div>

      {/* Valuation Summary Banner */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-6 border-end-md border-slate-200">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-3 p-2.5 bg-indigo-50 text-indigo-600">
                <i className="bi bi-cash-stack fs-4"></i>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase fw-semibold">Total Inventory Retail Value</span>
                <div className="fs-5 fw-bold text-slate-900">{formatETB(totalRetailValuation)}</div>
                <small className="text-slate-400 text-[11px]">Potential revenue at current retail selling prices</small>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-3 p-2.5 bg-emerald-50 text-emerald-600">
                <i className="bi bi-wallet2 fs-4"></i>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase fw-semibold">Total Warehouse Cost Asset Value</span>
                <div className="fs-5 fw-bold text-emerald-700">{formatETB(totalCostValuation)}</div>
                <small className="text-slate-400 text-[11px]">Asset value calculated from supplier cost prices</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-2 mb-3 bg-white">
        <div className="d-flex flex-wrap gap-1">
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'stock_levels' ? 'bg-primary text-white shadow-sm' : 'btn-light text-slate-600'
            }`}
            onClick={() => setActiveTab('stock_levels')}
          >
            <i className="bi bi-boxes me-1.5"></i>
            Stock Levels &amp; Availability
            <span className="badge rounded-pill bg-white text-primary ms-1.5">{filteredProducts.length}</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'incoming_pos' ? 'bg-primary text-white shadow-sm' : 'btn-light text-slate-600'
            }`}
            onClick={() => setActiveTab('incoming_pos')}
          >
            <i className="bi bi-truck me-1.5"></i>
            Incoming Purchase Orders
            {incomingPOs.length > 0 && (
              <span className="badge rounded-pill bg-teal-500 text-white ms-1.5">{incomingPOs.length}</span>
            )}
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'movements' ? 'bg-primary text-white shadow-sm' : 'btn-light text-slate-600'
            }`}
            onClick={() => setActiveTab('movements')}
          >
            <i className="bi bi-clock-history me-1.5"></i>
            Stock Movement Audit Logs
            <span className="badge rounded-pill bg-slate-200 text-slate-700 ms-1.5">{stockMovements.length}</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'forecasting' ? 'bg-primary text-white shadow-sm' : 'btn-light text-slate-600'
            }`}
            onClick={() => {
              setActiveTab('forecasting');
              if (!forecastingData) fetchForecasting(forecastingDays);
            }}
          >
            <i className="bi bi-lightning-charge-fill me-1.5 text-warning"></i>
            AI Demand Forecasting
          </button>
        </div>
      </div>

      {/* TAB 1: STOCK LEVELS & AVAILABILITY */}
      {activeTab === 'stock_levels' && (
        <>
          {/* Filters Bar */}
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-5">
                <div className="input-group">
                  <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control text-xs"
                    placeholder="Search stock by product name or SKU..."
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

              <div className="col-6 col-md-3">
                <select
                  className="form-select text-xs"
                  value={filterStockStatus}
                  onChange={(e) => setFilterStockStatus(e.target.value)}
                >
                  <option value="ALL">All Stock Statuses</option>
                  <option value="IN_STOCK">Normal In-Stock (&gt; threshold)</option>
                  <option value="LOW_STOCK">Low Stock Alert (&le; threshold)</option>
                  <option value="OUT_OF_STOCK">Out of Stock (0 units)</option>
                  <option value="RESERVED">Has Reserved Orders</option>
                </select>
              </div>

              <div className="col-auto ms-auto text-xs text-slate-500">
                Filtered: <strong className="text-slate-900">{filteredProducts.length}</strong> items
              </div>
            </div>
          </div>

          {/* Stock Table */}
          <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-box-seam fs-1 text-slate-300 mb-2 d-block"></i>
                <h6 className="fw-bold text-slate-700">No Inventory Records Found</h6>
                <p className="text-slate-500 text-xs mb-0">No items match the active filters.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0 text-xs">
                  <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
                    <tr>
                      <th className="ps-4">Product Name</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th className="text-center">Physical Stock</th>
                      <th className="text-center">Reserved</th>
                      <th className="text-center">Available</th>
                      <th className="text-center">Incoming (POs)</th>
                      <th className="text-center">Min Threshold</th>
                      <th>Stock Health</th>
                      <th className="text-end pe-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const threshold = p.low_stock_threshold || 5;
                      const physical = p.stock || 0;
                      const reserved = p.reserved_quantity || 0;
                      const available = p.available_quantity !== undefined ? p.available_quantity : Math.max(0, physical - reserved);
                      const incoming = p.incoming_quantity || 0;

                      return (
                        <tr key={p.id}>
                          <td className="ps-4">
                            <div className="fw-bold text-slate-900 text-truncate" style={{ maxWidth: '240px' }} title={p.name}>
                              {p.name}
                            </div>
                            <small className="text-slate-400 text-[11px]">
                              Retail: {formatETB(p.price)} &bull; Cost: {formatETB(p.cost_price || 0)}
                            </small>
                          </td>

                          <td className="font-monospace text-slate-600">
                            {p.sku || '—'}
                          </td>

                          <td>
                            <span className="badge bg-slate-100 text-slate-700 border text-[10px]">
                              {p.category_name || 'Unassigned'}
                            </span>
                          </td>

                          <td className="text-center">
                            <span className="fs-6 fw-bold text-slate-900">{physical}</span>
                          </td>

                          <td className="text-center">
                            {reserved > 0 ? (
                              <span className="badge bg-cyan-50 text-cyan-700 border border-cyan-200">
                                <i className="bi bi-lock me-1"></i>{reserved}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>

                          <td className="text-center">
                            <span className={`fw-bolder ${available === 0 ? 'text-danger' : available <= threshold ? 'text-warning' : 'text-emerald-600'}`}>
                              {available}
                            </span>
                          </td>

                          <td className="text-center">
                            {incoming > 0 ? (
                              <span className="badge bg-teal-50 text-teal-700 border border-teal-200">
                                <i className="bi bi-truck me-1"></i>+{incoming}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="text-center font-monospace text-slate-600">
                            &le; {threshold}
                          </td>

                          <td>
                            {physical === 0 ? (
                              <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1">
                                <i className="bi bi-x-circle me-1"></i>Out of Stock
                              </span>
                            ) : physical <= threshold ? (
                              <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1">
                                <i className="bi bi-exclamation-triangle me-1"></i>Low Stock
                              </span>
                            ) : (
                              <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                                <i className="bi bi-check-circle me-1"></i>Healthy
                              </span>
                            )}
                          </td>

                          <td className="text-end pe-4">
                            <div className="btn-group btn-group-sm">
                              {canManageInventory && (
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm p-1 px-2"
                                  title="Record Stock Adjustment"
                                  onClick={() => handleOpenAdjustModal(p)}
                                >
                                  <i className="bi bi-plus-slash-minus me-1"></i>
                                  <span>Adjust</span>
                                </button>
                              )}
                              {canManageInventory && (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm p-1 px-2"
                                  title="Configure Min & Reorder Thresholds"
                                  onClick={() => handleOpenThresholdModal(p)}
                                >
                                  <i className="bi bi-sliders"></i>
                                </button>
                              )}
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
        </>
      )}

      {/* TAB 2: INCOMING PURCHASE ORDERS & QUICK RECEIVING */}
      {activeTab === 'incoming_pos' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
          <div className="card-header bg-white py-3 px-4 border-bottom border-slate-100 d-flex align-items-center justify-content-between">
            <div>
              <h6 className="fw-bold text-slate-900 mb-0">Incoming Stock from Approved Purchase Orders</h6>
              <small className="text-slate-500 text-xs">
                POs approved by Admin and accepted/dispatched by suppliers waiting for physical dock check-in.
              </small>
            </div>
            <Link
              to={isAdmin ? '/admin/procurement/approvals' : '/manager/procurement/receive'}
              className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs fw-semibold"
            >
              <i className="bi bi-box-arrow-up-right me-1"></i>
              {isAdmin ? 'View All PO Approvals' : 'Go to Physical Receiving Dock'}
            </Link>
          </div>

          <div className="card-body p-0">
            {incomingPOs.length === 0 ? (
              <div className="text-center py-5 text-muted text-xs">
                <i className="bi bi-truck fs-1 text-slate-300 d-block mb-2"></i>
                <h6 className="fw-bold text-slate-700">No Incoming Shipments Pending</h6>
                <p className="text-slate-500 mb-0">All approved purchase orders have been received or completed.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0 text-xs">
                  <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="ps-4">PO Reference</th>
                      <th>Supplier</th>
                      <th>Expected Date</th>
                      <th>Delivery Location</th>
                      <th>Carrier &amp; Tracking</th>
                      <th>Status</th>
                      <th className="text-end pe-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomingPOs.map((po) => (
                      <tr key={po.id}>
                        <td className="ps-4 font-monospace fw-bold text-slate-900">
                          {po.request_number || `PO-${po.id}`}
                        </td>
                        <td className="fw-semibold text-slate-800">{po.supplier_name || '—'}</td>
                        <td className="text-slate-600">
                          {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'Immediate'}
                        </td>
                        <td className="text-slate-600 text-truncate" style={{ maxWidth: '180px' }}>
                          {po.delivery_location || 'Main EthioTech Depot'}
                        </td>
                        <td>
                          {po.supplier_shipping_carrier ? (
                            <span className="text-slate-800 font-monospace">
                              {po.supplier_shipping_carrier} ({po.supplier_tracking_number || 'No tracking #'})
                            </span>
                          ) : (
                            <span className="text-slate-400">Carrier unassigned</span>
                          )}
                        </td>
                        <td>
                          <span className="badge bg-teal-50 text-teal-700 border border-teal-200">
                            {po.status}
                          </span>
                        </td>
                        <td className="text-end pe-4">
                          <Link
                            to={isAdmin ? '/admin/procurement/approvals' : '/manager/procurement/receive'}
                            className="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-1 text-xs"
                          >
                            Receive Dock &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STOCK MOVEMENT AUDIT LOGS */}
      {activeTab === 'movements' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
          <div className="card-header bg-white py-3 px-4 border-bottom border-slate-100 d-flex align-items-center justify-content-between">
            <div>
              <h6 className="fw-bold text-slate-900 mb-0">Stock Movement Audit History</h6>
              <small className="text-slate-500 text-xs">
                Immutable ledger recording all additions, customer sales deductions, PO receptions, and manual adjustments.
              </small>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs"
              onClick={fetchInventoryData}
            >
              <i className="bi bi-arrow-clockwise me-1"></i> Refresh Logs
            </button>
          </div>

          <div className="card-body p-0">
            {stockMovements.length === 0 ? (
              <div className="text-center py-5 text-muted text-xs">
                <i className="bi bi-clock-history fs-1 text-slate-300 d-block mb-2"></i>
                No stock movement logs recorded yet.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0 text-xs">
                  <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="ps-4">Timestamp</th>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Movement Type</th>
                      <th className="text-center">Quantity Delta</th>
                      <th>Reference Reason</th>
                      <th className="text-end pe-4">Authorized User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockMovements.map((m) => (
                      <tr key={m.id}>
                        <td className="ps-4 text-slate-600">
                          {m.created_at ? new Date(m.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="fw-bold text-slate-900">{m.product_name}</td>
                        <td className="font-monospace text-slate-500">{m.product_sku || '—'}</td>
                        <td>
                          <span className={`badge rounded-pill ${
                            m.movement_type === 'RESTOCK' || m.movement_type === 'PURCHASE_ORDER'
                              ? 'bg-success bg-opacity-10 text-success border border-success'
                              : m.movement_type === 'DAMAGE'
                              ? 'bg-danger bg-opacity-10 text-danger border border-danger'
                              : 'bg-primary bg-opacity-10 text-primary border border-primary'
                          }`}>
                            {m.movement_type_display || m.movement_type}
                          </span>
                        </td>
                        <td className="text-center font-monospace fw-bold">
                          <span className={m.quantity > 0 ? 'text-success' : 'text-danger'}>
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td className="text-slate-600 text-truncate" style={{ maxWidth: '240px' }} title={m.reference}>
                          {m.reference || 'Stock adjustment'}
                        </td>
                        <td className="text-end pe-4 font-semibold text-slate-700">
                          {m.created_by_username || 'System Admin'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AI DEMAND FORECASTING */}
      {activeTab === 'forecasting' && (
        <div>
          {/* Controls Bar */}
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-4">
                <div className="d-flex align-items-center gap-2">
                  <span className="text-xs fw-semibold text-slate-700">Forecast Horizon:</span>
                  <div className="btn-group btn-group-sm">
                    {[30, 60, 90].map((days) => (
                      <button
                        key={days}
                        type="button"
                        className={`btn btn-xs ${forecastingDays === days ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => {
                          setForecastingDays(days);
                          fetchForecasting(days);
                        }}
                      >
                        {days} Days
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-4">
                <select
                  className="form-select text-xs"
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                >
                  <option value="ALL">All Risk Levels</option>
                  <option value="WARNINGS">Warnings Only (Critical &amp; High Risk)</option>
                  <option value="CRITICAL_OUT_OF_STOCK">Critical Out of Stock</option>
                  <option value="HIGH_STOCKOUT_RISK">High Stockout Risk</option>
                  <option value="HEALTHY">Healthy Run-Rate</option>
                </select>
              </div>

              <div className="col-auto ms-auto text-xs text-slate-500">
                {forecastingLoading ? (
                  <span>Computing demand projections...</span>
                ) : (
                  <span>Projected items: <strong className="text-slate-900">{filteredForecasts.length}</strong></span>
                )}
              </div>
            </div>
          </div>

          {/* Forecasting Table */}
          <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
            {forecastingLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="text-muted small mt-2">Computing sales velocities and stockout probability...</p>
              </div>
            ) : filteredForecasts.length === 0 ? (
              <div className="text-center py-5 text-muted text-xs">
                <i className="bi bi-shield-check fs-1 text-success d-block mb-2"></i>
                <h6 className="fw-bold text-slate-700">No Stockout Risks Detected</h6>
                <p className="text-slate-500 mb-0">All items have sufficient run-rate for the selected timeframe.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0 text-xs">
                  <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="ps-4">Product Name</th>
                      <th>SKU</th>
                      <th className="text-center">Current Stock</th>
                      <th className="text-center">Days Remaining</th>
                      <th className="text-center">Suggested Reorder</th>
                      <th>Risk Level</th>
                      <th className="text-end pe-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredForecasts.map((f) => (
                      <tr key={f.product_id}>
                        <td className="ps-4 fw-bold text-slate-900">{f.name}</td>
                        <td className="font-monospace text-slate-500">{f.sku}</td>
                        <td className="text-center fw-semibold text-slate-800">{f.current_stock}</td>
                        <td className="text-center">
                          <span className={`fw-bold ${f.days_until_stockout <= 7 ? 'text-danger' : f.days_until_stockout <= 20 ? 'text-warning' : 'text-slate-700'}`}>
                            {f.days_until_stockout === 0 ? 'Depleted' : `${f.days_until_stockout} days`}
                          </span>
                        </td>
                        <td className="text-center font-monospace fw-bold text-teal-700">
                          +{f.suggested_reorder_qty}
                        </td>
                        <td>
                          <span className={`badge rounded-pill ${
                            f.risk_level === 'CRITICAL_OUT_OF_STOCK'
                              ? 'bg-danger text-white'
                              : f.risk_level === 'HIGH_STOCKOUT_RISK'
                              ? 'bg-warning text-dark'
                              : 'bg-success bg-opacity-10 text-success'
                          }`}>
                            {f.risk_level_display || f.risk_level}
                          </span>
                        </td>
                        <td className="text-end pe-4">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-1 text-xs"
                            onClick={() => handleQuickRestockFromForecast(f)}
                          >
                            <i className="bi bi-lightning-charge me-1"></i> Quick Restock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Stock Adjustment Modal */}
      {adjustProduct && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              <div className="modal-header bg-slate-900 text-white py-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-3 p-1.5 bg-primary text-white">
                    <i className="bi bi-plus-slash-minus fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-white mb-0">Record Stock Adjustment</h5>
                    <small className="text-slate-400 text-xs">Product: {adjustProduct.name}</small>
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setAdjustProduct(null)}></button>
              </div>

              <form onSubmit={handleAdjustSubmit}>
                <div className="modal-body p-4 bg-slate-50 text-xs">
                  <div className="p-3 bg-white rounded-3 border mb-3">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase block">Current Physical Stock</span>
                        <div className="fs-5 fw-bold text-slate-900">{adjustProduct.stock} units</div>
                      </div>
                      <div className="text-end">
                        <span className="text-slate-400 text-[10px] uppercase block">Product SKU</span>
                        <div className="font-monospace fw-semibold text-slate-700">{adjustProduct.sku}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700">Movement Type / Reason *</label>
                    <select
                      className="form-select text-xs"
                      value={movementType}
                      onChange={(e) => setMovementType(e.target.value)}
                      required
                    >
                      <option value="RESTOCK">Restock / Warehouse Replenishment (+)</option>
                      <option value="PURCHASE_ORDER">Purchase Order Delivery Check-In (+)</option>
                      <option value="RETURN">Customer Return to Stock (+)</option>
                      <option value="DAMAGE">Damaged / Defective Stock Write-off (-)</option>
                      <option value="AUDIT_CORRECTION">Physical Inventory Audit Adjustment</option>
                      <option value="SALE">Direct Manual Store Sale (-)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700">Quantity (Units) *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control text-xs fw-bold"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                      required
                    />
                    <small className="text-slate-400 text-[11px]">
                      {movementType === 'DAMAGE' || movementType === 'SALE'
                        ? 'Units will be subtracted from current stock.'
                        : 'Units will be added to warehouse stock.'}
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700">Audit Reference / Reason Note *</label>
                    <input
                      type="text"
                      className="form-control text-xs"
                      placeholder="e.g. PO-2026-0045, Monthly physical count discrepancy, Broken carton..."
                      value={adjustmentReference}
                      onChange={(e) => setAdjustmentReference(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer bg-white py-2.5 px-4 d-flex justify-content-end gap-2 border-top">
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs" onClick={() => setAdjustProduct(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary rounded-pill px-4 text-xs fw-bold" disabled={submitting}>
                    {submitting ? 'Updating Stock...' : 'Save Stock Adjustment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Thresholds & Reorder Settings Modal */}
      {thresholdProduct && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              <div className="modal-header bg-slate-900 text-white py-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-3 p-1.5 bg-warning text-slate-900">
                    <i className="bi bi-sliders fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-white mb-0">Set Reorder Thresholds</h5>
                    <small className="text-slate-400 text-xs">Product: {thresholdProduct.name}</small>
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setThresholdProduct(null)}></button>
              </div>

              <form onSubmit={handleThresholdSubmit}>
                <div className="modal-body p-4 bg-slate-50 text-xs">
                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700">Low Stock Alert Threshold *</label>
                    <input
                      type="number"
                      min="0"
                      className="form-control text-xs"
                      value={minStockLevel}
                      onChange={(e) => setMinStockLevel(e.target.value)}
                      required
                    />
                    <small className="text-slate-400 text-[11px]">
                      When warehouse stock drops to or below this level, low-stock warnings are triggered.
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-semibold text-slate-700">Recommended Reorder Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control text-xs"
                      value={reorderQuantity}
                      onChange={(e) => setReorderQuantity(e.target.value)}
                      required
                    />
                    <small className="text-slate-400 text-[11px]">
                      Standard quantity pre-filled when drafting purchase orders with hardware suppliers.
                    </small>
                  </div>
                </div>

                <div className="modal-footer bg-white py-2.5 px-4 d-flex justify-content-end gap-2 border-top">
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs" onClick={() => setThresholdProduct(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary rounded-pill px-4 text-xs fw-bold" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Reorder Settings'}
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
