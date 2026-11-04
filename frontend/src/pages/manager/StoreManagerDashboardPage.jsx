import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { formatETB } from '../../utils/currency';
import NotificationDashboard from '../../components/NotificationDashboard';

const StoreManagerDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Metrics State
  const [stats, setStats] = useState({
    total_products: 0,
    available_products: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
    total_categories: 0,
    total_suppliers: 0,
    inventory_value: 0,
    low_stock_products: [],
    out_of_stock_products: [],
    recent_movements: [],
  });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Low-Stock Management & Supplier Alerts State
  const [lowStockList, setLowStockList] = useState([]);
  const [lowStockStats, setLowStockStats] = useState({
    count: 0,
    missing_supplier_count: 0,
    missing_email_count: 0,
    notified_count: 0,
  });
  const [loadingLowStock, setLoadingLowStock] = useState(false);
  const [resendingId, setResendingId] = useState(null);

  // Purchase Requests & Procurement State
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [loadingPR, setLoadingPR] = useState(false);

  // Registered Suppliers list (for dropdowns / quick assign)
  const [suppliers, setSuppliers] = useState([]);

  // Store Dispatch Queue State
  const [dispatchShipments, setDispatchShipments] = useState([]);
  const [loadingDispatch, setLoadingDispatch] = useState(false);
  const [packingShipmentId, setPackingShipmentId] = useState(null);

  // Physical Package Handover Modal State (Stage 6)
  const [handoverShipment, setHandoverShipment] = useState(null);
  const [handoverNotes, setHandoverNotes] = useState('');
  const [handoverLocation, setHandoverLocation] = useState('Addis Ababa Fulfillment Center');
  const [handoverDriverVerified, setHandoverDriverVerified] = useState(false);
  const [confirmingHandover, setConfirmingHandover] = useState(false);

  // Quick Stock Adjustment Modal State
  const [adjustTargetProduct, setAdjustTargetProduct] = useState(null);
  const [adjustQuantity, setAdjustQuantity] = useState(10);
  const [adjustType, setAdjustType] = useState('RESTOCK');
  const [adjustReference, setAdjustReference] = useState('Supplier Replenishment');
  const [adjusting, setAdjusting] = useState(false);

  // Modal State for Supplier Details
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Modal State for Quick Supplier Assign
  const [assigningProduct, setAssigningProduct] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Modal State for Purchase Request
  const [prProduct, setPrProduct] = useState(null);
  const [prQuantity, setPrQuantity] = useState(20);
  const [prUnitCost, setPrUnitCost] = useState(0);
  const [prNotes, setPrNotes] = useState('');
  const [submittingPR, setSubmittingPR] = useState(false);

  // Notification Error Log Modal
  const [logModalProduct, setLogModalProduct] = useState(null);
  const [productLogs, setProductLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Active Tab for Procurement / Dispatch toggle
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam && ['low-stock', 'purchase-requests', 'dispatch-queue', 'notifications'].includes(tabParam)
      ? tabParam
      : 'low-stock'
  );

  useEffect(() => {
    if (tabParam && ['low-stock', 'purchase-requests', 'dispatch-queue', 'notifications'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setSearchParams({ tab: tabName });
  };

  // Fetch Inventory Stats
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('products/inventory/');
      if (res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to load store manager stats:', err);
      setFeedback({
        type: 'danger',
        text: 'Failed to retrieve catalog and inventory data. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Low-Stock Products & Supplier Notification status
  const fetchLowStockData = useCallback(async () => {
    try {
      setLoadingLowStock(true);
      const res = await api.get('products/low-stock/');
      if (res.data) {
        setLowStockList(res.data.products || []);
        setLowStockStats({
          count: res.data.count || 0,
          missing_supplier_count: res.data.missing_supplier_count || 0,
          missing_email_count: res.data.missing_email_count || 0,
          notified_count: res.data.notified_count || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load low stock data:', err);
    } finally {
      setLoadingLowStock(false);
    }
  }, []);

  // Fetch Purchase Requests
  const fetchPurchaseRequests = useCallback(async () => {
    try {
      setLoadingPR(true);
      const res = await api.get('products/purchase-requests/');
      setPurchaseRequests(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load purchase requests:', err);
    } finally {
      setLoadingPR(false);
    }
  }, []);

  // Fetch Suppliers for quick assign
  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await api.get('products/suppliers/');
      setSuppliers(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    }
  }, []);

  // Fetch Dispatch Queue
  const fetchDispatchQueue = useCallback(async () => {
    try {
      setLoadingDispatch(true);
      const res = await api.get('delivery/dispatch-orders/');
      setDispatchShipments(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load dispatch queue:', err);
    } finally {
      setLoadingDispatch(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLowStockData();
    fetchPurchaseRequests();
    fetchSuppliers();
    fetchDispatchQueue();
  }, [fetchStats, fetchLowStockData, fetchPurchaseRequests, fetchSuppliers, fetchDispatchQueue]);

  // Handle Resend Supplier Alert
  const handleResendSupplierAlert = async (productId, productName) => {
    try {
      setResendingId(productId);
      const res = await api.post(`products/items/${productId}/resend-supplier-alert/`);
      if (res.data.success) {
        setFeedback({
          type: 'success',
          text: `Low-stock reorder notification successfully sent to ${res.data.supplier_name} (${res.data.recipient}) for "${productName}".`,
        });
      } else {
        setFeedback({
          type: 'warning',
          text: res.data.error || res.data.message || 'Notification was not sent.',
        });
      }
      fetchLowStockData();
      fetchStats();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to send supplier email alert.';
      setFeedback({ type: 'danger', text: errorMsg });
    } finally {
      setResendingId(null);
    }
  };

  // Open Purchase Request Modal
  const handleOpenPurchaseRequestModal = (product) => {
    setPrProduct(product);
    setPrQuantity(product.reorder_quantity || 20);
    setPrUnitCost(product.cost_price > 0 ? product.cost_price : Math.round(Number(product.price) * 0.7));
    setPrNotes(`Reorder replenishment inquiry for low stock product "${product.name}". Please confirm unit pricing and earliest dispatch schedule.`);
  };

  // Submit Purchase Request
  const handleSubmitPurchaseRequest = async (e) => {
    e.preventDefault();
    if (!prProduct) return;
    try {
      setSubmittingPR(true);
      const payload = {
        product: prProduct.id,
        quantity: parseInt(prQuantity, 10),
        estimated_unit_cost: parseFloat(prUnitCost),
        notes: prNotes.trim(),
      };
      const res = await api.post('products/purchase-requests/', payload);
      setFeedback({
        type: 'success',
        text: `Purchase Request ${res.data.request_number} submitted for review! Store Manager can approve before commitment.`,
      });
      setPrProduct(null);
      fetchPurchaseRequests();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to submit purchase request.';
      alert(msg);
    } finally {
      setSubmittingPR(false);
    }
  };

  // Approve Purchase Request
  const handleApprovePurchaseRequest = async (prId, requestNumber) => {
    if (!window.confirm(`Approve Purchase Request ${requestNumber}? This verifies procurement approval from store management.`)) {
      return;
    }
    try {
      await api.patch(`products/purchase-requests/${prId}/`, { status: 'APPROVED' });
      setFeedback({
        type: 'success',
        text: `Purchase Request ${requestNumber} approved! Ready to place order with supplier.`,
      });
      fetchPurchaseRequests();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to approve purchase request.' });
    }
  };

  // Reject Purchase Request
  const handleRejectPurchaseRequest = async (prId, requestNumber) => {
    if (!window.confirm(`Reject Purchase Request ${requestNumber}?`)) {
      return;
    }
    try {
      await api.patch(`products/purchase-requests/${prId}/`, { status: 'REJECTED' });
      setFeedback({
        type: 'info',
        text: `Purchase Request ${requestNumber} rejected.`,
      });
      fetchPurchaseRequests();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to reject purchase request.' });
    }
  };

  // Receive Stock & Restock Inventory
  const handleReceiveStock = async (prId, requestNumber, productName) => {
    if (!window.confirm(`Confirm receipt of supplier shipment for ${requestNumber}? This will automatically increment warehouse stock and log an inventory RESTOCK.`)) {
      return;
    }
    try {
      const res = await api.post(`products/purchase-requests/${prId}/receive-stock/`);
      setFeedback({
        type: 'success',
        text: res.data.message || `Stock for "${productName}" received and warehouse inventory updated!`,
      });
      fetchPurchaseRequests();
      fetchLowStockData();
      fetchStats();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to receive stock.' });
    }
  };

  // Open Quick Supplier Assign Modal
  const handleOpenAssignSupplier = (product) => {
    setAssigningProduct(product);
    setSelectedSupplierId(product.supplier || '');
  };

  // Save Supplier Assignment
  const handleSaveSupplierAssignment = async (e) => {
    e.preventDefault();
    if (!assigningProduct) return;
    try {
      setSavingSupplier(true);
      await api.patch(`products/items/${assigningProduct.id}/`, {
        supplier: selectedSupplierId ? Number(selectedSupplierId) : null,
      });
      setFeedback({
        type: 'success',
        text: `Supplier successfully assigned to "${assigningProduct.name}".`,
      });
      setAssigningProduct(null);
      fetchLowStockData();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign supplier.');
    } finally {
      setSavingSupplier(false);
    }
  };

  // View Notification Logs Modal
  const handleViewLogs = async (product) => {
    setLogModalProduct(product);
    try {
      setLoadingLogs(true);
      const res = await api.get(`products/items/${product.id}/supplier-notifications/`);
      setProductLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Ready for Dispatch
  const handleMarkReadyForDispatch = async (shipmentId) => {
    try {
      setPackingShipmentId(shipmentId);
      await api.post(`delivery/shipments/${shipmentId}/ready-for-dispatch/`, {
        location: 'Addis Ababa Fulfillment Center',
        notes: 'Inspected, boxed, and sealed with tamper-proof security tape for carrier collection.',
      });
      setFeedback({ type: 'success', text: 'Order marked READY_FOR_DISPATCH for courier carrier handover.' });
      fetchDispatchQueue();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to update dispatch status.' });
    } finally {
      setPackingShipmentId(null);
    }
  };

  // Open Package Handover Modal (Stage 6)
  const handleOpenHandoverModal = (shipment) => {
    setHandoverShipment(shipment);
    setHandoverNotes(`Handover confirmed to driver ${shipment.pickup_driver_name || 'Courier Driver'}. Package carton inspected, shipping barcode verified.`);
    setHandoverLocation('Addis Ababa Fulfillment Center');
    setHandoverDriverVerified(false);
  };

  // Submit Package Handover
  const handleConfirmHandoverSubmit = async (e) => {
    e.preventDefault();
    if (!handoverShipment) return;
    try {
      setConfirmingHandover(true);
      const res = await api.post(`delivery/shipments/${handoverShipment.id}/confirm-handover/`, {
        notes: handoverNotes,
        location: handoverLocation,
      });
      setFeedback({
        type: 'success',
        text: res.data.message || `Package for shipment ${handoverShipment.tracking_number} successfully handed over to driver!`,
      });
      setHandoverShipment(null);
      fetchDispatchQueue();
      fetchStats();
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.error || 'Failed to confirm physical package handover.',
      });
    } finally {
      setConfirmingHandover(false);
    }
  };

  // Execute Quick Stock Adjust
  const handleStockAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustTargetProduct) return;
    try {
      setAdjusting(true);
      const qty = adjustType === 'WRITE_OFF' || adjustType === 'DAMAGE' ? -Math.abs(Number(adjustQuantity)) : Math.abs(Number(adjustQuantity));
      const res = await api.post('products/inventory/', {
        product_id: adjustTargetProduct.id,
        quantity: qty,
        movement_type: adjustType,
        reference: adjustReference.trim() || 'Store Manager Inventory Update',
      });
      setFeedback({
        type: 'success',
        text: res.data.message || `Stock for "${adjustTargetProduct.name}" updated successfully!`,
      });
      setAdjustTargetProduct(null);
      fetchStats();
      fetchLowStockData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update stock level.';
      alert(msg);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="pb-5">
      {/* Store Manager Header Banner */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-info border-opacity-25 bg-info bg-opacity-10">
            <i className="bi bi-shop text-info"></i>
            <span className="small fw-bold text-cyan-800">Store Manager Inventory &amp; Procurement Hub</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Store Management Console</h2>
          <p className="text-slate-500 text-xs mb-0">
            Automated Low-Stock Detection, Registered Supplier Reorders, Warehouse Packing &amp; Inventory Replenishment.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Link
            to="/manager/products"
            className="btn btn-ethio-primary btn-sm rounded-pill px-3 py-2 fw-bold text-xs d-flex align-items-center gap-2 shadow-sm"
            style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
          >
            <i className="bi bi-plus-lg"></i>
            <span>Add / Edit Products</span>
          </Link>
          <Link
            to="/manager/suppliers"
            className="btn btn-outline-secondary btn-sm rounded-pill px-3 py-2 fw-bold text-xs"
          >
            <i className="bi bi-truck me-1"></i> Hardware Suppliers
          </Link>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm`} role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : feedback.type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} fs-5`}></i>
            <div>{feedback.text}</div>
          </div>
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* SECTION 1: MANDATORY STORE MANAGER KPI CARDS */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Catalog Size</span>
              <div className="rounded-3 p-2 bg-blue-50 text-blue-600">
                <i className="bi bi-boxes fs-6"></i>
              </div>
            </div>
            <h2 className="fw-bolder text-slate-900 mb-0">{stats.total_products}</h2>
            <small className="text-muted text-[11px] mt-1 d-block">{stats.available_products} items currently in stock</small>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-4 border-warning">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Low Stock Items</span>
              <div className="rounded-3 p-2 bg-amber-50 text-amber-600">
                <i className="bi bi-exclamation-triangle-fill fs-6"></i>
              </div>
            </div>
            <h2 className="fw-bolder text-amber-600 mb-0">{lowStockStats.count}</h2>
            <small className="text-muted text-[11px] mt-1 d-block">
              {lowStockStats.notified_count} suppliers alerted via email
            </small>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-4 border-danger">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Supplier Alerts</span>
              <div className="rounded-3 p-2 bg-red-50 text-red-600">
                <i className="bi bi-envelope-exclamation-fill fs-6"></i>
              </div>
            </div>
            <h2 className="fw-bolder text-red-600 mb-0">{lowStockStats.missing_supplier_count + lowStockStats.missing_email_count}</h2>
            <small className="text-muted text-[11px] mt-1 d-block">
              {lowStockStats.missing_supplier_count} unassigned, {lowStockStats.missing_email_count} missing email
            </small>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Inventory Valuation</span>
              <div className="rounded-3 p-2 bg-emerald-50 text-emerald-600">
                <i className="bi bi-cash-stack fs-6"></i>
              </div>
            </div>
            <h2 className="fw-bolder text-emerald-700 mb-0">{formatETB(stats.inventory_value || 0)}</h2>
            <small className="text-muted text-[11px] mt-1 d-block">Store warehouse stock valuation</small>
          </div>
        </div>
      </div>

      {/* SECTION 2: NAVIGATION TABS FOR STORE OPERATIONS */}
      <div className="d-flex flex-wrap gap-2 mb-4 border-bottom pb-2">
        <button
          type="button"
          className={`btn btn-sm rounded-pill px-4 fw-bold text-xs d-flex align-items-center gap-2 ${activeTab === 'low-stock' ? 'btn-danger shadow-sm' : 'btn-light border'}`}
          onClick={() => handleTabChange('low-stock')}
        >
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span>Low-Stock Alerts &amp; Reorders</span>
          {lowStockStats.count > 0 && (
            <span className="badge bg-white text-danger rounded-pill px-2">{lowStockStats.count}</span>
          )}
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-pill px-4 fw-bold text-xs d-flex align-items-center gap-2 ${activeTab === 'notifications' ? 'btn-danger shadow-sm text-white' : 'btn-light border'}`}
          onClick={() => handleTabChange('notifications')}
        >
          <i className="bi bi-bell-fill"></i>
          <span>Stock Alerts &amp; Notifications</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-pill px-4 fw-bold text-xs d-flex align-items-center gap-2 ${activeTab === 'purchase-requests' ? 'btn-primary shadow-sm' : 'btn-light border'}`}
          onClick={() => handleTabChange('purchase-requests')}
        >
          <i className="bi bi-file-earmark-text-fill"></i>
          <span>Purchase Requests &amp; Approvals</span>
          {purchaseRequests.length > 0 && (
            <span className="badge bg-white text-primary rounded-pill px-2">{purchaseRequests.length}</span>
          )}
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-pill px-4 fw-bold text-xs d-flex align-items-center gap-2 ${activeTab === 'dispatch-queue' ? 'btn-dark shadow-sm' : 'btn-light border'}`}
          onClick={() => handleTabChange('dispatch-queue')}
        >
          <i className="bi bi-box-seam-fill"></i>
          <span>Warehouse Packaging &amp; Dispatch Queue</span>
          {dispatchShipments.length > 0 && (
            <span className="badge bg-white text-dark rounded-pill px-2">{dispatchShipments.length}</span>
          )}
        </button>
      </div>

      {/* SECTION 3: LOW STOCK MANAGEMENT TABLE */}
      {activeTab === 'low-stock' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 mb-4 overflow-hidden bg-white">
          <div className="p-3 border-bottom d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
            <div>
              <div className="d-flex align-items-center gap-2">
                <h5 className="fw-bold text-slate-900 mb-0">
                  <i className="bi bi-bell-fill text-danger me-2"></i> Low Stock Management &amp; Supplier Email Alerts
                </h5>
                <span className="badge bg-danger-subtle text-danger border border-danger-subtle text-xs">
                  {lowStockList.length} Items Below Reorder Level
                </span>
              </div>
              <small className="text-muted text-xs">
                Automatically detects low stock (&le; Minimum Stock Level) and notifies registered hardware suppliers via official email inquiry.
              </small>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-pill px-3 text-xs"
                onClick={fetchLowStockData}
                disabled={loadingLowStock}
              >
                <i className={`bi bi-arrow-clockwise me-1 ${loadingLowStock ? 'spin' : ''}`}></i> Refresh
              </button>
            </div>
          </div>

          {/* Supplier/Email Warnings Banner */}
          {(lowStockStats.missing_supplier_count > 0 || lowStockStats.missing_email_count > 0) && (
            <div className="bg-amber-50 border-bottom border-amber-200 px-4 py-2 d-flex align-items-center justify-content-between text-xs text-amber-900">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-octagon-fill text-amber-600 fs-5"></i>
                <span>
                  <strong>Procurement Alert:</strong> {lowStockStats.missing_supplier_count} products have no registered supplier, and {lowStockStats.missing_email_count} suppliers have no saved email. Assign suppliers in Hardware Suppliers to enable automated email dispatch.
                </span>
              </div>
              <Link to="/manager/suppliers" className="btn btn-xs btn-outline-dark rounded-pill px-3 py-1 font-bold">
                Manage Suppliers &rarr;
              </Link>
            </div>
          )}

          {loadingLowStock ? (
            <div className="text-center py-5 text-muted text-xs">
              <div className="spinner-border spinner-border-sm me-2 text-primary"></div>
              Checking inventory reorder levels against hardware suppliers...
            </div>
          ) : lowStockList.length === 0 ? (
            <div className="text-center py-5 text-muted text-xs">
              <i className="bi bi-shield-check text-success fs-1 mb-2 d-block"></i>
              <h6 className="fw-bold text-slate-800">All Products Maintain Healthy Stock Levels</h6>
              <p className="text-muted mb-0">No products are currently at or below their minimum reorder threshold.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-xs">
                <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="ps-4">Product Details</th>
                    <th>Current Stock</th>
                    <th>Min Level</th>
                    <th>Reorder Qty</th>
                    <th>Registered Supplier</th>
                    <th>Supplier Email</th>
                    <th>Email Notification Status</th>
                    <th>Last Notified</th>
                    <th className="text-end pe-4">Procurement Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockList.map((p) => {
                    const isOutOfStock = p.stock === 0;
                    const hasSupplier = p.has_supplier;
                    const hasEmail = p.has_supplier_email;
                    const isResending = resendingId === p.id;

                    return (
                      <tr key={p.id}>
                        {/* 1. Product Name & Image */}
                        <td className="ps-4" style={{ minWidth: '220px' }}>
                          <div className="d-flex align-items-center gap-3">
                            {p.image ? (
                              <img
                                src={p.image}
                                alt={p.name}
                                className="rounded-3 object-cover border"
                                style={{ width: '40px', height: '40px' }}
                              />
                            ) : (
                              <div className="rounded-3 bg-slate-100 d-flex align-items-center justify-content-center text-slate-400 border" style={{ width: '40px', height: '40px' }}>
                                <i className="bi bi-laptop fs-5"></i>
                              </div>
                            )}
                            <div>
                              <div className="fw-bold text-slate-900">{p.name}</div>
                              <div className="text-muted text-[11px]">
                                SKU: <span className="font-mono text-slate-600">{p.sku}</span> &bull; {p.category_name}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Current Stock */}
                        <td>
                          <span className={`badge rounded-pill px-2.5 py-1 font-bold ${isOutOfStock ? 'bg-danger text-white' : 'bg-warning text-dark'}`}>
                            {isOutOfStock ? '0 units (OUT)' : `${p.stock} units`}
                          </span>
                        </td>

                        {/* 3. Minimum Stock Level */}
                        <td>
                          <span className="fw-semibold text-slate-700">{p.min_stock_level} units</span>
                        </td>

                        {/* 4. Recommended Reorder Qty */}
                        <td>
                          <span className="badge bg-blue-50 text-blue-700 border border-blue-200 fw-bold px-2 py-0.5">
                            {p.reorder_quantity || 20} units
                          </span>
                        </td>

                        {/* 5. Supplier Company Name */}
                        <td>
                          {hasSupplier ? (
                            <button
                              type="button"
                              className="btn btn-link p-0 text-decoration-none fw-bold text-slate-800 text-start text-xs d-flex align-items-center gap-1"
                              onClick={() => setSelectedSupplier({
                                id: p.supplier,
                                name: p.supplier_name,
                                email: p.supplier_email,
                                phone: p.supplier_phone,
                                contact_person: p.supplier_contact,
                              })}
                            >
                              <span>{p.supplier_name}</span>
                              <i className="bi bi-box-arrow-up-right text-[10px] text-primary"></i>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="badge bg-danger-subtle text-danger border border-danger-subtle btn btn-xs p-1 text-[11px]"
                              onClick={() => handleOpenAssignSupplier(p)}
                            >
                              <i className="bi bi-plus-circle me-1"></i> No Supplier (Assign)
                            </button>
                          )}
                        </td>

                        {/* 6. Supplier Email */}
                        <td>
                          {hasSupplier && hasEmail ? (
                            <div className="text-slate-700 font-mono text-[11px]">
                              <i className="bi bi-envelope text-primary me-1"></i>
                              {p.supplier_email}
                            </div>
                          ) : hasSupplier && !hasEmail ? (
                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle text-[10px]">
                              <i className="bi bi-exclamation-triangle me-1"></i> Missing Email
                            </span>
                          ) : (
                            <span className="text-muted text-[11px]">&mdash;</span>
                          )}
                        </td>

                        {/* 7. Email Notification Status */}
                        <td>
                          {p.notification_status === 'SENT' ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 text-[11px] d-inline-flex align-items-center gap-1">
                              <i className="bi bi-check-circle-fill"></i> Email Sent
                            </span>
                          ) : p.notification_status === 'FAILED' ? (
                            <button
                              type="button"
                              className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 text-[11px] btn btn-xs d-inline-flex align-items-center gap-1"
                              onClick={() => handleViewLogs(p)}
                              title="Click to view error log"
                            >
                              <i className="bi bi-x-circle-fill"></i> Failed (View Log)
                            </button>
                          ) : (
                            <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1 text-[11px]">
                              Never Notified
                            </span>
                          )}
                        </td>

                        {/* 8. Last Notification Date */}
                        <td className="text-muted text-[11px]">
                          {p.last_notification_date ? (
                            <div>
                              <div>{new Date(p.last_notification_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                              <small className="text-slate-400">{new Date(p.last_notification_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                            </div>
                          ) : (
                            <span>&mdash;</span>
                          )}
                        </td>

                        {/* 9. Action Buttons */}
                        <td className="text-end pe-4">
                          <div className="d-flex align-items-center justify-content-end gap-1">
                            {/* View Supplier Button */}
                            {hasSupplier && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm rounded-pill px-2 py-1 text-[11px]"
                                onClick={() => setSelectedSupplier({
                                  id: p.supplier,
                                  name: p.supplier_name,
                                  email: p.supplier_email,
                                  phone: p.supplier_phone,
                                  contact_person: p.supplier_contact,
                                })}
                                title="View Supplier Profile"
                              >
                                <i className="bi bi-person-lines-fill"></i> View
                              </button>
                            )}

                            {/* Send Email Again Button */}
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm rounded-pill px-2.5 py-1 text-[11px] fw-bold d-inline-flex align-items-center gap-1"
                              onClick={() => handleResendSupplierAlert(p.id, p.name)}
                              disabled={isResending || !hasSupplier || !hasEmail}
                              title={!hasSupplier ? 'Assign a supplier first' : !hasEmail ? 'Supplier has no valid email' : 'Resend Reorder Inquiry to Supplier'}
                            >
                              {isResending ? (
                                <span className="spinner-border spinner-border-sm"></span>
                              ) : (
                                <i className="bi bi-send-fill text-primary"></i>
                              )}
                              <span>Send Again</span>
                            </button>

                            {/* Create Purchase Request Button */}
                            <button
                              type="button"
                              className="btn btn-success btn-sm rounded-pill px-2.5 py-1 text-[11px] fw-bold d-inline-flex align-items-center gap-1 shadow-sm"
                              onClick={() => handleOpenPurchaseRequestModal(p)}
                              title="Create Purchase Request for Store Review"
                            >
                              <i className="bi bi-cart-plus-fill"></i>
                              <span>Purchase Request</span>
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
      )}

      {/* SECTION 4: PURCHASE REQUESTS & PROCUREMENT APPROVAL */}
      {activeTab === 'purchase-requests' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 mb-4 overflow-hidden bg-white">
          <div className="p-3 border-bottom d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
            <div>
              <h5 className="fw-bold text-slate-900 mb-0">
                <i className="bi bi-file-earmark-check-fill text-primary me-2"></i> Procurement Inquiries &amp; Purchase Requests
              </h5>
              <small className="text-muted text-xs">
                Formal purchase requests sent to suppliers. Requires Store Manager approval before commitment. Stock can be received once delivered.
              </small>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-pill px-3 text-xs"
              onClick={fetchPurchaseRequests}
              disabled={loadingPR}
            >
              <i className="bi bi-arrow-clockwise me-1"></i> Refresh Requests
            </button>
          </div>

          {loadingPR ? (
            <div className="text-center py-4 text-muted text-xs">
              <div className="spinner-border spinner-border-sm me-2"></div> Loading purchase requests...
            </div>
          ) : purchaseRequests.length === 0 ? (
            <div className="text-center py-5 text-muted text-xs">
              <i className="bi bi-clipboard-x text-slate-300 fs-1 mb-2 d-block"></i>
              <h6 className="fw-bold text-slate-800">No Purchase Requests Created Yet</h6>
              <p className="text-muted mb-0">Click "Purchase Request" on any low-stock product to initiate a formal supplier procurement inquiry.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-xs">
                <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="ps-4">Request #</th>
                    <th>Product</th>
                    <th>Supplier</th>
                    <th>Quantity</th>
                    <th>Unit Cost</th>
                    <th>Total Estimated Cost</th>
                    <th>Approval Status</th>
                    <th>Created</th>
                    <th className="text-end pe-4">Manager Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseRequests.map((pr) => (
                    <tr key={pr.id}>
                      <td className="ps-4">
                        <span className="font-mono fw-bold text-primary">{pr.request_number}</span>
                      </td>
                      <td>
                        <div className="fw-semibold text-slate-900">{pr.product_name}</div>
                      </td>
                      <td>
                        <div className="text-slate-800 fw-medium">{pr.supplier_name || 'N/A'}</div>
                        <small className="text-muted text-[11px] font-mono">{pr.supplier_email}</small>
                      </td>
                      <td>
                        <span className="badge bg-slate-100 text-slate-800 font-bold px-2.5 py-1 text-xs">
                          {pr.quantity} units
                        </span>
                      </td>
                      <td>{formatETB(pr.estimated_unit_cost)}</td>
                      <td className="fw-bold text-slate-900">{formatETB(pr.total_estimated_cost)}</td>
                      <td>
                        <span className={`badge px-2.5 py-1 text-[11px] ${
                          pr.status === 'APPROVED' ? 'bg-success-subtle text-success border border-success-subtle' :
                          pr.status === 'RECEIVED' ? 'bg-info-subtle text-cyan-800 border border-info-subtle' :
                          pr.status === 'REJECTED' ? 'bg-danger-subtle text-danger border border-danger-subtle' :
                          'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                        }`}>
                          {pr.status_display}
                        </span>
                      </td>
                      <td className="text-muted text-[11px]">
                        {new Date(pr.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="text-end pe-4">
                        <div className="d-flex align-items-center justify-content-end gap-1">
                          {pr.status === 'SUBMITTED' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success rounded-pill px-2.5 py-0.5 text-xs font-bold"
                                onClick={() => handleApprovePurchaseRequest(pr.id, pr.request_number)}
                              >
                                <i className="bi bi-check-lg me-1"></i> Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-0.5 text-xs font-bold"
                                onClick={() => handleRejectPurchaseRequest(pr.id, pr.request_number)}
                              >
                                <i className="bi bi-x-lg me-1"></i> Reject
                              </button>
                            </>
                          )}
                          {pr.status === 'APPROVED' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary-gradient rounded-pill px-3 py-1 text-xs font-bold shadow-sm"
                              style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
                              onClick={() => handleReceiveStock(pr.id, pr.request_number, pr.product_name)}
                            >
                              <i className="bi bi-box-arrow-in-down me-1"></i> Receive Stock &amp; Restock
                            </button>
                          )}
                          {pr.status === 'RECEIVED' && (
                            <span className="text-success text-[11px] font-semibold">
                              <i className="bi bi-check2-all me-1"></i> Restocked
                            </span>
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
      )}

      {/* SECTION 5: WAREHOUSE ORDER PACKAGING & DISPATCH QUEUE */}
      {activeTab === 'dispatch-queue' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 mb-4 overflow-hidden bg-white">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <div>
              <h5 className="fw-bold text-slate-900 mb-0">
                <i className="bi bi-box-seam-fill text-primary me-2"></i> Warehouse Packaging &amp; Dispatch Queue
              </h5>
              <small className="text-muted text-xs">Confirmed customer orders awaiting product picking, packaging, and carrier dispatch</small>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-pill px-3 text-xs"
              onClick={fetchDispatchQueue}
              disabled={loadingDispatch}
            >
              <i className="bi bi-arrow-clockwise me-1"></i> Refresh Queue
            </button>
          </div>

          {loadingDispatch ? (
            <div className="text-center py-4 text-muted text-xs">
              <div className="spinner-border spinner-border-sm me-2"></div> Checking warehouse packaging queue...
            </div>
          ) : dispatchShipments.length === 0 ? (
            <div className="text-center py-4 text-muted text-xs">
              <i className="bi bi-check2-circle text-success fs-3 mb-1 d-block"></i>
              All confirmed customer orders have been packed and handed over to logistics carriers!
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-xs">
                <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="ps-4">Tracking # &amp; Order</th>
                    <th>Destination Hub</th>
                    <th>Customer Recipient</th>
                    <th>Logistics Method</th>
                    <th>Status</th>
                    <th className="text-end pe-4">Fulfillment Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchShipments.map((s) => (
                    <tr key={s.id}>
                      <td className="ps-4">
                        <span className="fw-bold font-mono text-primary">{s.tracking_number}</span>
                        <div className="text-muted text-[11px]">Order #{s.order_number}</div>
                      </td>
                      <td>
                        <span className="fw-semibold text-slate-800"><i className="bi bi-geo-alt me-1 text-danger"></i>{s.destination_city}</span>
                      </td>
                      <td>
                        <div className="text-slate-800">{s.recipient_name}</div>
                        <div className="text-muted text-[11px]">{s.recipient_phone}</div>
                      </td>
                      <td>
                        <span className="badge bg-light text-slate-700 border text-[11px]">{s.delivery_method_display}</span>
                      </td>
                      <td>
                        <span className={`badge px-2 py-0.5 text-[11px] ${
                          s.status === 'READY_FOR_DISPATCH'
                            ? 'bg-info-subtle text-cyan-800 border border-info-subtle'
                            : s.status === 'PICKUP_SCHEDULED'
                            ? 'bg-warning-subtle text-amber-900 border border-warning-subtle'
                            : s.status === 'BOOKING_CONFIRMED'
                            ? 'bg-primary-subtle text-primary border border-primary-subtle'
                            : s.status === 'PICKED_UP'
                            ? 'bg-success-subtle text-success border border-success-subtle'
                            : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                        }`}>
                          {s.status_display}
                        </span>
                        {s.pickup_driver_name && (
                          <div className="text-muted text-[10px] mt-0.5">
                            <i className="bi bi-person-fill text-primary me-0.5"></i> Driver: {s.pickup_driver_name}
                          </div>
                        )}
                      </td>
                      <td className="text-end pe-4">
                        {['PICKUP_SCHEDULED', 'BOOKING_CONFIRMED', 'COURIER_ASSIGNED'].includes(s.status) ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-success rounded-pill px-3 py-1 text-xs font-bold shadow-sm"
                            onClick={() => handleOpenHandoverModal(s)}
                          >
                            <i className="bi bi-box-arrow-right me-1"></i> Confirm Driver Handover
                          </button>
                        ) : s.status === 'READY_FOR_DISPATCH' || s.status === 'BOOKING_REQUESTED' ? (
                          <div className="d-inline-flex flex-column align-items-end">
                            <span className="badge bg-light text-slate-700 border text-[11px] mb-0.5">
                              <i className="bi bi-check2-circle text-success me-1"></i> Packed in Warehouse
                            </span>
                            <small className="text-muted text-[10px]">Awaiting courier driver arrival</small>
                          </div>
                        ) : s.status === 'PICKED_UP' ? (
                          <span className="text-success fw-bold text-xs">
                            <i className="bi bi-check-all me-1"></i> Handover Complete
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-dark rounded-pill px-3 py-1 text-xs font-bold shadow-sm"
                            onClick={() => handleMarkReadyForDispatch(s.id)}
                            disabled={packingShipmentId === s.id}
                          >
                            {packingShipmentId === s.id ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-1"></span> Packing...
                              </>
                            ) : (
                              <>
                                <i className="bi bi-box-seam me-1"></i> Pack &amp; Ready for Dispatch
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: NOTIFICATIONS & LOW-STOCK ALERT DASHBOARD */}
      {activeTab === 'notifications' && (
        <div className="mb-4">
          <NotificationDashboard />
        </div>
      )}

      {/* SECTION 6: INVENTORY MOVEMENT AUDIT TRAIL */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 mb-4 overflow-hidden bg-white">
        <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
          <div>
            <h5 className="fw-bold text-slate-900 mb-0">Recent Stock Movements</h5>
            <small className="text-muted text-xs">Real-time audit log of sales, supplier restocks, and returns</small>
          </div>
          <Link to="/manager/inventory" className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs">
            Open Full Ledger &rarr;
          </Link>
        </div>

        {stats.recent_movements.length === 0 ? (
          <div className="text-center py-4 text-muted text-xs">No stock movements recorded yet.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="ps-4">Product</th>
                  <th>Movement Type</th>
                  <th>Quantity Delta</th>
                  <th>Audit Reference</th>
                  <th>Authorized By</th>
                  <th className="text-end pe-4">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_movements.slice(0, 8).map((m) => (
                  <tr key={m.id}>
                    <td className="ps-4 fw-bold text-slate-900">{m.product_name}</td>
                    <td>
                      <span className={`badge rounded-pill ${m.quantity > 0 ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25' : 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25'}`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="font-monospace fw-bold">
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity} units
                    </td>
                    <td className="text-slate-600">{m.reference || 'Stock Adjustment'}</td>
                    <td>{m.created_by_name || 'Store Manager'}</td>
                    <td className="text-end pe-4 text-muted">
                      {new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: VIEW SUPPLIER DETAILS */}
      {/* ===================================================================== */}
      {selectedSupplier && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-xl rounded-4">
              <div className="modal-header border-bottom border-slate-100 pb-3">
                <h5 className="modal-title fw-bold text-slate-900 text-sm d-flex align-items-center gap-2">
                  <i className="bi bi-truck text-primary"></i>
                  <span>Hardware Supplier Profile</span>
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedSupplier(null)}></button>
              </div>
              <div className="modal-body p-4">
                <h5 className="fw-bolder text-slate-900 mb-1">{selectedSupplier.name}</h5>
                <p className="text-muted text-xs mb-3">Registered Hardware Procurement Partner</p>

                <div className="bg-slate-50 p-3 rounded-3 border mb-3 text-xs">
                  <div className="row g-2">
                    <div className="col-4 text-slate-500 font-semibold">Contact Person:</div>
                    <div className="col-8 fw-bold text-slate-800">{selectedSupplier.contact_person || 'N/A'}</div>

                    <div className="col-4 text-slate-500 font-semibold">Official Email:</div>
                    <div className="col-8 fw-mono text-primary font-bold">{selectedSupplier.email || 'None Registered'}</div>

                    <div className="col-4 text-slate-500 font-semibold">Phone:</div>
                    <div className="col-8 text-slate-800">{selectedSupplier.phone || 'N/A'}</div>

                    <div className="col-4 text-slate-500 font-semibold">Office Address:</div>
                    <div className="col-8 text-slate-800">{selectedSupplier.address || 'Addis Ababa, Ethiopia'}</div>
                  </div>
                </div>

                <div className="alert alert-info rounded-3 text-xs mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  When low stock is detected, reorder inquiry emails are dispatched directly to <strong>{selectedSupplier.email}</strong>.
                </div>
              </div>
              <div className="modal-footer border-top border-slate-100 pt-3">
                <Link to="/manager/suppliers" className="btn btn-outline-primary btn-sm rounded-pill px-3 text-xs">
                  Edit in Suppliers Module &rarr;
                </Link>
                <button type="button" className="btn btn-secondary btn-sm rounded-pill px-3 text-xs" onClick={() => setSelectedSupplier(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: CREATE PURCHASE REQUEST */}
      {/* ===================================================================== */}
      {prProduct && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-xl rounded-4">
              <form onSubmit={handleSubmitPurchaseRequest}>
                <div className="modal-header border-bottom border-slate-100 pb-3">
                  <h5 className="modal-title fw-bold text-slate-900 text-sm d-flex align-items-center gap-2">
                    <i className="bi bi-file-earmark-plus text-success"></i>
                    <span>Create Purchase Request (Procurement Inquiry)</span>
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setPrProduct(null)}></button>
                </div>
                <div className="modal-body p-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-3 border mb-3">
                    <div className="text-slate-500 text-[11px]">Product:</div>
                    <div className="fw-bold text-slate-900 fs-6">{prProduct.name}</div>
                    <div className="text-muted text-[11px] mt-1">
                      Current Stock: <span className="text-danger fw-bold">{prProduct.stock} units</span> &bull; Minimum Reorder Level: {prProduct.min_stock_level} units
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold text-slate-700">Hardware Supplier</label>
                    <input
                      type="text"
                      className="form-control text-xs py-2 bg-light"
                      value={prProduct.supplier_name || 'No Supplier Assigned'}
                      readOnly
                    />
                    <small className="text-muted text-[10px]">Recipient: {prProduct.supplier_email || 'No email registered'}</small>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-bold text-slate-700">Reorder Quantity (Units)</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control text-xs py-2"
                        value={prQuantity}
                        onChange={(e) => setPrQuantity(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-bold text-slate-700">Estimated Unit Cost (ETB)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control text-xs py-2"
                        value={prUnitCost}
                        onChange={(e) => setPrUnitCost(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-3 border border-blue-200 mb-3 text-blue-900">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="font-semibold">Estimated Total Commitment:</span>
                      <span className="fs-6 fw-bold">{formatETB(Number(prQuantity) * Number(prUnitCost))}</span>
                    </div>
                    <small className="text-[10px] text-blue-700 d-block mt-1">
                      Note: This is a reorder inquiry. Store Manager must review and approve before business commitment.
                    </small>
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-bold text-slate-700">Notes &amp; Inquiry Instructions for Supplier</label>
                    <textarea
                      rows="3"
                      className="form-control text-xs"
                      value={prNotes}
                      onChange={(e) => setPrNotes(e.target.value)}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer border-top border-slate-100 pt-3">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3 text-xs" onClick={() => setPrProduct(null)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success btn-sm rounded-pill px-4 fw-bold text-xs"
                    disabled={submittingPR}
                  >
                    {submittingPR ? 'Submitting Request...' : 'Submit Purchase Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: QUICK ASSIGN SUPPLIER */}
      {/* ===================================================================== */}
      {assigningProduct && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-xl rounded-4">
              <form onSubmit={handleSaveSupplierAssignment}>
                <div className="modal-header border-bottom border-slate-100 pb-3">
                  <h5 className="modal-title fw-bold text-slate-900 text-sm">
                    Assign Hardware Supplier
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setAssigningProduct(null)}></button>
                </div>
                <div className="modal-body p-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-3 border mb-3">
                    <div className="text-slate-500 text-[11px]">Product:</div>
                    <div className="fw-bold text-slate-900">{assigningProduct.name}</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold text-slate-700">Select Supplier</label>
                    <select
                      className="form-select text-xs py-2"
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Hardware Supplier --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.email ? s.email : 'No email'})
                        </option>
                      ))}
                    </select>
                    <small className="text-muted text-[10px] mt-1 d-block">
                      The supplier's saved email will receive automated reorder requests when stock is low.
                    </small>
                  </div>
                </div>
                <div className="modal-footer border-top border-slate-100 pt-3">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3 text-xs" onClick={() => setAssigningProduct(null)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm rounded-pill px-4 fw-bold text-xs"
                    disabled={savingSupplier}
                  >
                    {savingSupplier ? 'Saving...' : 'Link Supplier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: NOTIFICATION LOGS / ERROR AUDIT */}
      {/* ===================================================================== */}
      {logModalProduct && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-xl rounded-4">
              <div className="modal-header border-bottom border-slate-100 pb-3">
                <h5 className="modal-title fw-bold text-slate-900 text-sm">
                  Email Alert Audit Log: {logModalProduct.name}
                </h5>
                <button type="button" className="btn-close" onClick={() => setLogModalProduct(null)}></button>
              </div>
              <div className="modal-body p-4 text-xs">
                {loadingLogs ? (
                  <div className="text-center py-4 text-muted">
                    <div className="spinner-border spinner-border-sm me-2"></div> Loading notification history...
                  </div>
                ) : productLogs.length === 0 ? (
                  <div className="text-center py-4 text-muted">No notification logs recorded for this product yet.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered align-middle mb-0">
                      <thead className="table-light text-[11px]">
                        <tr>
                          <th>Timestamp</th>
                          <th>Status</th>
                          <th>Trigger Type</th>
                          <th>Recipient</th>
                          <th>Details / Error Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="text-muted text-[11px]">
                              {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td>
                              <span className={`badge px-2 py-0.5 text-[10px] ${log.status === 'SENT' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
                                {log.status_display}
                              </span>
                            </td>
                            <td>
                              <span className="badge bg-light text-slate-700 border text-[10px]">
                                {log.trigger_type_display}
                              </span>
                            </td>
                            <td className="font-mono text-[11px]">{log.supplier_email || 'N/A'}</td>
                            <td>
                              {log.error_message ? (
                                <span className="text-danger fw-semibold">{log.error_message}</span>
                              ) : (
                                <span className="text-success">Delivered successfully</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer border-top border-slate-100 pt-3">
                <button type="button" className="btn btn-secondary btn-sm rounded-pill px-3 text-xs" onClick={() => setLogModalProduct(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK STOCK ADJUST MODAL */}
      {adjustTargetProduct && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-xl rounded-4">
              <form onSubmit={handleStockAdjustSubmit}>
                <div className="modal-header border-bottom border-slate-100 pb-3">
                  <h5 className="modal-title fw-bold text-slate-900 text-sm">
                    Stock Replenishment: {adjustTargetProduct.name}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setAdjustTargetProduct(null)}></button>
                </div>
                <div className="modal-body p-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-3 border mb-3">
                    <div className="text-slate-500">Current Warehouse Stock Level:</div>
                    <div className="fs-5 fw-bold text-slate-900">{adjustTargetProduct.stock} units</div>
                    <small className="text-muted text-[11px]">
                      Minimum Reorder Threshold: {adjustTargetProduct.low_stock_threshold || adjustTargetProduct.min_stock_level || 5} units
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold text-slate-700">Movement Operation</label>
                    <select
                      className="form-select text-xs py-2"
                      value={adjustType}
                      onChange={(e) => setAdjustType(e.target.value)}
                    >
                      <option value="RESTOCK">RESTOCK (+ Add stock from supplier)</option>
                      <option value="RETURN">RETURN (+ Customer product return)</option>
                      <option value="DAMAGE">DAMAGE (- Damaged or defective stock)</option>
                      <option value="WRITE_OFF">WRITE_OFF (- Audit inventory shrinkage)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold text-slate-700">Units Quantity</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control text-xs py-2"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold text-slate-700">Audit Reference / Supplier Note</label>
                    <input
                      type="text"
                      className="form-control text-xs py-2"
                      placeholder="e.g. Dell Logistics Batch #4410"
                      value={adjustReference}
                      onChange={(e) => setAdjustReference(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer border-top border-slate-100 pt-3">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3 text-xs" onClick={() => setAdjustTargetProduct(null)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-ethio-primary btn-sm rounded-pill px-4 fw-bold text-xs"
                    style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
                    disabled={adjusting}
                  >
                    {adjusting ? 'Updating Stock...' : 'Confirm Stock Adjustment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* PHYSICAL PACKAGE HANDOVER MODAL (WORKFLOW STAGE 6) */}
      {handoverShipment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              <form onSubmit={handleConfirmHandoverSubmit}>
                <div className="modal-header bg-slate-900 text-white border-0 py-3 px-4">
                  <div className="d-flex align-items-center gap-2">
                    <div className="rounded-circle bg-emerald-500 text-white p-2 text-center" style={{ width: '36px', height: '36px' }}>
                      <i className="bi bi-box-arrow-right fs-6"></i>
                    </div>
                    <div>
                      <h5 className="modal-title fw-bold text-white text-base mb-0">
                        Confirm Physical Package Handover
                      </h5>
                      <small className="text-slate-400 text-xs">
                        Stage 6: Store Manager confirms package release to assigned courier driver
                      </small>
                    </div>
                  </div>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setHandoverShipment(null)}></button>
                </div>

                <div className="modal-body p-4 text-xs">
                  {/* Shipment Info Banner */}
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <div className="p-3 rounded-3 bg-slate-50 border">
                        <span className="text-slate-500 text-[11px] uppercase fw-bold d-block">Shipment Tracking #</span>
                        <div className="fw-bolder font-mono text-primary fs-6">{handoverShipment.tracking_number}</div>
                        <small className="text-muted">Order #{handoverShipment.order_number}</small>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="p-3 rounded-3 bg-slate-50 border">
                        <span className="text-slate-500 text-[11px] uppercase fw-bold d-block">Destination City &amp; Recipient</span>
                        <div className="fw-bolder text-slate-800 fs-6">
                          <i className="bi bi-geo-alt-fill text-danger me-1"></i>
                          {handoverShipment.destination_city}
                        </div>
                        <small className="text-muted">{handoverShipment.recipient_name} ({handoverShipment.recipient_phone})</small>
                      </div>
                    </div>
                  </div>

                  {/* Scheduled Driver Card */}
                  <div className="card border-primary border-opacity-25 bg-blue-50 bg-opacity-40 rounded-3 p-3 mb-3">
                    <h6 className="fw-bold text-slate-900 mb-2 d-flex align-items-center gap-2">
                      <i className="bi bi-person-badge-fill text-primary"></i>
                      <span>Assigned Courier Driver Credentials</span>
                    </h6>
                    <div className="row g-2">
                      <div className="col-6 col-md-4">
                        <span className="text-slate-500 text-[11px]">Driver Name:</span>
                        <div className="fw-bold text-slate-900">{handoverShipment.pickup_driver_name || 'Designated Courier Driver'}</div>
                      </div>
                      <div className="col-6 col-md-4">
                        <span className="text-slate-500 text-[11px]">Contact Phone:</span>
                        <div className="fw-bold font-mono text-slate-900">{handoverShipment.pickup_driver_phone || 'N/A'}</div>
                      </div>
                      <div className="col-12 col-md-4">
                        <span className="text-slate-500 text-[11px]">Vehicle Plate #:</span>
                        <div className="fw-bold font-mono text-slate-900">{handoverShipment.pickup_vehicle_plate || 'Courier Fleet Vehicle'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Physical Verification Checklist */}
                  <div className="p-3 rounded-3 border bg-white mb-3">
                    <span className="fw-bold text-slate-800 d-block mb-2">Store Manager Physical Inspection Checklist:</span>
                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="chkDriverId"
                        checked={handoverDriverVerified}
                        onChange={(e) => setHandoverDriverVerified(e.target.checked)}
                        required
                      />
                      <label className="form-check-label text-slate-700" htmlFor="chkDriverId">
                        I have verified the driver's official courier ID badge and phone number match the dispatch record.
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="chkPackageCarton"
                        defaultChecked
                        required
                      />
                      <label className="form-check-label text-slate-700" htmlFor="chkPackageCarton">
                        Package carton is undamaged, sealed with security tape, and destination barcode is clearly affixed.
                      </label>
                    </div>
                  </div>

                  {/* Handover Location & Notes */}
                  <div className="mb-3">
                    <label className="form-label fw-bold text-slate-700">Handover Fulfillment Location</label>
                    <input
                      type="text"
                      className="form-control text-xs py-2"
                      value={handoverLocation}
                      onChange={(e) => setHandoverLocation(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-bold text-slate-700">Handover Confirmation Notes</label>
                    <textarea
                      className="form-control text-xs py-2"
                      rows="2"
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      placeholder="Add inspection notes or carrier vehicle notes..."
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer border-top border-slate-100 py-2.5 px-4 bg-slate-50 d-flex justify-content-between">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3 text-xs" onClick={() => setHandoverShipment(null)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success btn-sm rounded-pill px-4 fw-bold text-xs shadow-sm"
                    disabled={confirmingHandover || !handoverDriverVerified}
                  >
                    {confirmingHandover ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1"></span> Confirming...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle me-1"></i> Confirm Handover &amp; Release Package
                      </>
                    )}
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

export default StoreManagerDashboardPage;
