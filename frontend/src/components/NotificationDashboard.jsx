import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { formatETB } from '../utils/currency';

const NotificationDashboard = ({ initialFilter = 'all', onSelectProduct = null }) => {
  const { user, isAdmin, isStoreManager, isSuperAdmin } = useAuth();
  const { markAsRead, markAllAsRead, fetchNotifications: refreshGlobalNotifications } = useNotifications();
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] = useState(initialFilter); // 'all', 'low_stock', 'out_of_stock', 'supplier_email_sent', 'supplier_email_failed'
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({
    all: 0,
    unread: 0,
    low_stock: 0,
    out_of_stock: 0,
    supplier_email_sent: 0,
    supplier_email_failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFeedback, setActionFeedback] = useState({ type: '', text: '' });

  // Action Modals State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productDetailsLoading, setProductDetailsLoading] = useState(false);

  const [viewingSupplier, setViewingSupplier] = useState(null);

  const [prProduct, setPrProduct] = useState(null);
  const [prQuantity, setPrQuantity] = useState(20);
  const [prUnitCost, setPrUnitCost] = useState(0);
  const [prNotes, setPrNotes] = useState('');
  const [submittingPR, setSubmittingPR] = useState(false);

  const [reorderProduct, setReorderProduct] = useState(null);
  const [editReorderQty, setEditReorderQty] = useState(20);
  const [editMinLevel, setEditMinLevel] = useState(5);
  const [savingReorder, setSavingReorder] = useState(false);

  const [resendingEmailId, setResendingEmailId] = useState(null);

  // Fetch notifications according to active filter
  const fetchFilteredData = useCallback(async (filterType = activeFilter) => {
    try {
      setLoading(true);
      const res = await api.get(`notifications/?filter=${filterType}`);
      setNotifications(res.data.notifications || []);
      if (res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setActionFeedback({ type: 'danger', text: 'Failed to retrieve notifications from server.' });
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchFilteredData(activeFilter);
  }, [activeFilter, fetchFilteredData]);

  // Mark single as read
  const handleMarkAsRead = async (notif) => {
    await markAsRead(notif.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
    );
    setCounts((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setCounts((prev) => ({ ...prev, unread: 0 }));
    setActionFeedback({ type: 'success', text: 'All notifications marked as read.' });
    refreshGlobalNotifications();
  };

  // 1. View Product action
  const handleViewProduct = async (productId) => {
    if (!productId) return;
    try {
      setProductDetailsLoading(true);
      const res = await api.get(`products/items/${productId}/`);
      setSelectedProduct(res.data);
    } catch (err) {
      console.error('Failed to fetch product details', err);
      alert('Could not retrieve product specifications.');
    } finally {
      setProductDetailsLoading(false);
    }
  };

  // 2. View Supplier action
  const handleViewSupplier = async (notif) => {
    if (notif.product) {
      try {
        const prodRes = await api.get(`products/items/${notif.product}/`);
        if (prodRes.data?.supplier) {
          const supRes = await api.get(`products/suppliers/${prodRes.data.supplier}/`);
          setViewingSupplier(supRes.data);
          return;
        }
      } catch (err) {
        console.error('Failed to load supplier from product', err);
      }
    }
    setActionFeedback({ type: 'warning', text: 'No supplier registered for this product yet.' });
  };

  // 3. Send / Resend Supplier Email action
  const handleResendSupplierEmail = async (productId, productName) => {
    if (!productId) return;
    try {
      setResendingEmailId(productId);
      const res = await api.post(`products/items/${productId}/resend-supplier-alert/`, {});
      setActionFeedback({
        type: 'success',
        text: res.data.message || `Reorder inquiry email sent to registered supplier for ${productName}.`,
      });
      fetchFilteredData();
      refreshGlobalNotifications();
    } catch (err) {
      console.error('Error sending supplier email:', err);
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to dispatch supplier email.';
      setActionFeedback({ type: 'danger', text: msg });
    } finally {
      setResendingEmailId(null);
    }
  };

  // 4. Open Create Purchase Request modal
  const handleOpenPRModal = (notif) => {
    setPrProduct({
      id: notif.product,
      name: notif.product_name || notif.title,
      suggested_qty: notif.suggested_reorder_qty || 20,
      current_stock: notif.current_stock || 0,
    });
    setPrQuantity(notif.suggested_reorder_qty || 20);
    setPrUnitCost(0);
    setPrNotes(`Reorder inquiry generated from stock alert: ${notif.title}`);
  };

  // Submit Purchase Request
  const handleSubmitPR = async (e) => {
    e.preventDefault();
    if (!prProduct) return;
    try {
      setSubmittingPR(true);
      const res = await api.post('products/purchase-requests/', {
        product: prProduct.id,
        quantity: parseInt(prQuantity, 10),
        estimated_unit_cost: parseFloat(prUnitCost) || 0,
        notes: prNotes,
      });
      setActionFeedback({
        type: 'success',
        text: `Purchase Request #${res.data.request_number} created successfully in SUBMITTED state.`,
      });
      setPrProduct(null);
    } catch (err) {
      console.error('Failed to submit purchase request:', err);
      const msg = err.response?.data?.error || 'Failed to create purchase request.';
      alert(msg);
    } finally {
      setSubmittingPR(false);
    }
  };

  // 5. Open Update Reorder Quantity modal
  const handleOpenReorderModal = (notif) => {
    setReorderProduct({
      id: notif.product,
      name: notif.product_name || notif.title,
    });
    setEditReorderQty(notif.suggested_reorder_qty || 20);
    setEditMinLevel(notif.min_stock_level || 5);
  };

  // Submit Update Reorder Settings
  const handleSaveReorderSettings = async (e) => {
    e.preventDefault();
    if (!reorderProduct) return;
    try {
      setSavingReorder(true);
      const res = await api.patch(`products/items/${reorderProduct.id}/reorder-settings/`, {
        reorder_quantity: parseInt(editReorderQty, 10),
        low_stock_threshold: parseInt(editMinLevel, 10),
      });
      setActionFeedback({
        type: 'success',
        text: `Reorder threshold set to ${editMinLevel} and suggested reorder quantity to ${editReorderQty} for ${reorderProduct.name}.`,
      });
      setReorderProduct(null);
      fetchFilteredData();
    } catch (err) {
      console.error('Failed to update reorder settings:', err);
      alert(err.response?.data?.error || 'Failed to update reorder settings.');
    } finally {
      setSavingReorder(false);
    }
  };

  // Filtered notifications list based on search term
  const displayedNotifications = notifications.filter((n) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (n.title && n.title.toLowerCase().includes(term)) ||
      (n.message && n.message.toLowerCase().includes(term)) ||
      (n.product_name && n.product_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="notification-dashboard-container">
      {/* Alert / Feedback message */}
      {actionFeedback.text && (
        <div
          className={`alert alert-${actionFeedback.type} alert-dismissible fade show rounded-4 text-xs shadow-sm mb-4`}
          role="alert"
        >
          <div className="d-flex align-items-center gap-2">
            <i
              className={`bi ${
                actionFeedback.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger'
              } fs-6`}
            ></i>
            <span>{actionFeedback.text}</span>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setActionFeedback({ type: '', text: '' })}
          ></button>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-white"
                style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' }}
              >
                <i className="bi bi-bell-fill fs-5"></i>
              </div>
              <h4 className="fw-bolder text-slate-900 mb-0">Inventory &amp; Low-Stock Notifications</h4>
              {counts.unread > 0 && (
                <span className="badge rounded-pill bg-danger text-white text-xs px-2.5 py-1">
                  {counts.unread} Action Required
                </span>
              )}
            </div>
            <p className="text-muted small mb-0">
              Automated inventory monitoring alerts for minimum stock thresholds, out-of-stock conditions, and supplier reorder inquiries.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            {counts.unread > 0 && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-pill px-3 fw-bold text-xs d-inline-flex align-items-center gap-1.5 shadow-sm"
                onClick={handleMarkAllRead}
              >
                <i className="bi bi-check2-all"></i> Mark All as Read
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline-primary btn-sm rounded-pill px-3 fw-bold text-xs d-inline-flex align-items-center gap-1.5 shadow-sm"
              onClick={() => fetchFilteredData(activeFilter)}
              disabled={loading}
            >
              <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i> Refresh
            </button>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="d-flex flex-wrap gap-2 mt-4 pt-3 border-top border-slate-100">
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3.5 py-1.5 fw-bold text-xs d-inline-flex align-items-center gap-1.5 transition ${
              activeFilter === 'all'
                ? 'btn-dark text-white shadow-sm'
                : 'btn-outline-secondary text-slate-700 bg-white'
            }`}
            onClick={() => setActiveFilter('all')}
          >
            <span>All Notifications</span>
            <span className={`badge rounded-pill text-[10px] ${activeFilter === 'all' ? 'bg-white text-dark' : 'bg-slate-100 text-slate-700'}`}>
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3.5 py-1.5 fw-bold text-xs d-inline-flex align-items-center gap-1.5 transition ${
              activeFilter === 'low_stock'
                ? 'btn-warning text-dark shadow-sm'
                : 'btn-outline-secondary text-slate-700 bg-white'
            }`}
            onClick={() => setActiveFilter('low_stock')}
          >
            <i className="bi bi-exclamation-triangle-fill text-warning"></i>
            <span>Low Stock</span>
            <span className={`badge rounded-pill text-[10px] ${activeFilter === 'low_stock' ? 'bg-dark text-white' : 'bg-warning bg-opacity-25 text-warning-emphasis'}`}>
              {counts.low_stock}
            </span>
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3.5 py-1.5 fw-bold text-xs d-inline-flex align-items-center gap-1.5 transition ${
              activeFilter === 'out_of_stock'
                ? 'btn-danger text-white shadow-sm'
                : 'btn-outline-secondary text-slate-700 bg-white'
            }`}
            onClick={() => setActiveFilter('out_of_stock')}
          >
            <i className="bi bi-x-octagon-fill text-danger"></i>
            <span>Out of Stock</span>
            <span className={`badge rounded-pill text-[10px] ${activeFilter === 'out_of_stock' ? 'bg-white text-danger' : 'bg-danger bg-opacity-25 text-danger'}`}>
              {counts.out_of_stock}
            </span>
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3.5 py-1.5 fw-bold text-xs d-inline-flex align-items-center gap-1.5 transition ${
              activeFilter === 'supplier_email_sent'
                ? 'btn-success text-white shadow-sm'
                : 'btn-outline-secondary text-slate-700 bg-white'
            }`}
            onClick={() => setActiveFilter('supplier_email_sent')}
          >
            <i className="bi bi-envelope-check-fill text-success"></i>
            <span>Supplier Email Sent</span>
            <span className={`badge rounded-pill text-[10px] ${activeFilter === 'supplier_email_sent' ? 'bg-white text-success' : 'bg-success bg-opacity-25 text-success'}`}>
              {counts.supplier_email_sent}
            </span>
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3.5 py-1.5 fw-bold text-xs d-inline-flex align-items-center gap-1.5 transition ${
              activeFilter === 'supplier_email_failed'
                ? 'btn-danger text-white shadow-sm'
                : 'btn-outline-secondary text-slate-700 bg-white'
            }`}
            onClick={() => setActiveFilter('supplier_email_failed')}
          >
            <i className="bi bi-envelope-exclamation-fill text-danger"></i>
            <span>Supplier Email Failed</span>
            <span className={`badge rounded-pill text-[10px] ${activeFilter === 'supplier_email_failed' ? 'bg-white text-danger' : 'bg-danger bg-opacity-25 text-danger'}`}>
              {counts.supplier_email_failed}
            </span>
          </button>

          <div className="ms-auto" style={{ minWidth: '220px' }}>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0 text-xs rounded-end-pill"
                placeholder="Search alerts or products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List View */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted text-xs mt-2">Checking inventory alerts and supplier correspondence...</p>
        </div>
      ) : displayedNotifications.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
          <i className="bi bi-check-circle-fill text-emerald-500 fs-1 mb-2"></i>
          <h5 className="fw-bold text-slate-800">No Notifications in this Category</h5>
          <p className="text-muted small mb-0">
            {searchTerm
              ? `No notifications matched "${searchTerm}". Try a different keyword.`
              : 'All products currently comply with inventory threshold rules.'}
          </p>
        </div>
      ) : (
        <div className="row g-3 mb-4">
          {displayedNotifications.map((n) => {
            const isZero = n.notification_type === 'OUT_OF_STOCK';
            const isLow = n.notification_type === 'LOW_STOCK' || n.notification_type === 'STOCK_ALERT';
            const isSent = n.notification_type === 'SUPPLIER_EMAIL_SENT';
            const isFail = n.notification_type === 'SUPPLIER_EMAIL_FAILED';

            // Severity styling
            const cardBorder = isZero
              ? 'border-start border-4 border-danger'
              : isLow
              ? 'border-start border-4 border-warning'
              : isSent
              ? 'border-start border-4 border-success'
              : isFail
              ? 'border-start border-4 border-danger'
              : 'border-start border-4 border-primary';

            const badgeColor = isZero
              ? 'bg-danger text-white'
              : isLow
              ? 'bg-warning text-dark'
              : isSent
              ? 'bg-success text-white'
              : isFail
              ? 'bg-danger text-white'
              : 'bg-primary text-white';

            const badgeText = isZero
              ? 'CRITICAL: OUT OF STOCK'
              : isLow
              ? 'WARNING: LOW STOCK'
              : isSent
              ? 'SUPPLIER EMAIL DISPATCHED'
              : isFail
              ? 'SUPPLIER EMAIL NOTICE'
              : 'SYSTEM ALERT';

            const formattedTime = new Date(n.created_at).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={n.id} className="col-12">
                <div
                  className={`card ethio-card border-0 shadow-sm rounded-4 p-3.5 bg-white ${cardBorder} ${
                    !n.is_read ? 'bg-amber-50 bg-opacity-25' : ''
                  }`}
                >
                  <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                    {/* Left: Indicator, Title & Specs */}
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-1.5">
                        <span className={`badge rounded-pill text-[10px] fw-bold px-2.5 py-1 ${badgeColor}`}>
                          {badgeText}
                        </span>
                        {!n.is_read && (
                          <span className="badge rounded-pill bg-danger text-white text-[10px] px-2 py-0.5">
                            Unread
                          </span>
                        )}
                        <span className="text-muted text-[11px]">
                          <i className="bi bi-clock me-1"></i> {formattedTime}
                        </span>
                      </div>

                      <h6 className="fw-bolder text-slate-900 mb-1 text-sm">{n.title}</h6>
                      <p className="text-slate-600 text-xs mb-2 leading-relaxed">{n.message}</p>

                      {/* Stock Specs Pill Box */}
                      {(n.product_name || n.current_stock !== null || n.min_stock_level !== null) && (
                        <div className="d-inline-flex flex-wrap align-items-center gap-2.5 p-2 rounded-3 bg-slate-50 border border-slate-200 text-xs">
                          {n.product_name && (
                            <span className="fw-bold text-slate-800">
                              <i className="bi bi-box me-1 text-primary"></i>
                              {n.product_name}
                            </span>
                          )}
                          {n.current_stock !== null && (
                            <span className="badge bg-white text-slate-800 border border-slate-300">
                              Current Stock:{' '}
                              <strong className={n.current_stock === 0 ? 'text-danger' : 'text-warning-emphasis'}>
                                {n.current_stock} units
                              </strong>
                            </span>
                          )}
                          {n.min_stock_level !== null && (
                            <span className="badge bg-white text-slate-700 border border-slate-200">
                              Min Stock Level: <strong>{n.min_stock_level} units</strong>
                            </span>
                          )}
                          {n.suggested_reorder_qty && (
                            <span className="badge bg-blue-50 text-blue-700 border border-blue-200">
                              Suggested Reorder: <strong>{n.suggested_reorder_qty} units</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="d-flex flex-wrap align-items-center gap-1.5 shrink-0 justify-content-lg-end">
                      {/* Store Manager Inventory Actions (Section 7) */}
                      {n.product && (
                        <>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm rounded-pill text-[11px] px-3 py-1 font-semibold"
                            onClick={() => handleViewProduct(n.product)}
                            title="View product details, pricing, and stock history"
                          >
                            <i className="bi bi-eye me-1"></i> View Product
                          </button>

                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm rounded-pill text-[11px] px-3 py-1 font-semibold"
                            onClick={() => handleViewSupplier(n)}
                            title="View registered supplier contact details"
                          >
                            <i className="bi bi-truck me-1"></i> View Supplier
                          </button>

                          <button
                            type="button"
                            className="btn btn-warning btn-sm rounded-pill text-[11px] px-3 py-1 font-bold text-slate-900 shadow-sm"
                            onClick={() => handleResendSupplierEmail(n.product, n.product_name)}
                            disabled={resendingEmailId === n.product}
                            title="Send or re-send official reorder inquiry email to supplier"
                          >
                            <i className={`bi bi-envelope-paper me-1 ${resendingEmailId === n.product ? 'spin' : ''}`}></i>
                            {resendingEmailId === n.product ? 'Sending...' : 'Send/Resend Email'}
                          </button>

                          <button
                            type="button"
                            className="btn btn-dark btn-sm rounded-pill text-[11px] px-3 py-1 font-semibold shadow-sm"
                            onClick={() => handleOpenPRModal(n)}
                            title="Create purchase request for review and replenishment"
                          >
                            <i className="bi bi-cart-plus me-1"></i> Purchase Request
                          </button>

                          <button
                            type="button"
                            className="btn btn-outline-info btn-sm rounded-pill text-[11px] px-3 py-1 font-semibold"
                            onClick={() => handleOpenReorderModal(n)}
                            title="Update suggested reorder quantity & threshold"
                          >
                            <i className="bi bi-sliders me-1"></i> Reorder Qty
                          </button>
                        </>
                      )}

                      {/* Link to product inventory page */}
                      {n.link ? (
                        <Link
                          to={n.link}
                          className="btn btn-outline-secondary btn-sm rounded-pill text-[11px] px-3 py-1"
                          title="Open in Inventory Manager"
                        >
                          <i className="bi bi-arrow-up-right me-1"></i> Inventory Page
                        </Link>
                      ) : n.product ? (
                        <Link
                          to={`/manager/inventory?product_id=${n.product}`}
                          className="btn btn-outline-secondary btn-sm rounded-pill text-[11px] px-3 py-1"
                        >
                          <i className="bi bi-arrow-up-right me-1"></i> Inventory
                        </Link>
                      ) : null}

                      {/* Mark as read / Mark as reviewed */}
                      {!n.is_read ? (
                        <button
                          type="button"
                          className="btn btn-success btn-sm rounded-pill text-[11px] px-3 py-1 font-semibold"
                          onClick={() => handleMarkAsRead(n)}
                          title="Mark this alert as reviewed"
                        >
                          <i className="bi bi-check-lg me-1"></i> Mark Reviewed
                        </button>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-500 rounded-pill text-[10px] px-2.5 py-1">
                          <i className="bi bi-check2"></i> Reviewed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: VIEW PRODUCT DETAILS
          ========================================================================= */}
      {selectedProduct && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1060 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <div className="modal-header bg-slate-900 text-white p-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-laptop text-info"></i>
                  <h6 className="modal-title fw-bold mb-0">Product Details: {selectedProduct.name}</h6>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedProduct(null)}
                ></button>
              </div>
              <div className="modal-body p-4 text-xs">
                <div className="row g-3">
                  <div className="col-md-4 text-center">
                    {selectedProduct.image ? (
                      <img
                        src={selectedProduct.image}
                        alt={selectedProduct.name}
                        className="img-fluid rounded-3 border p-1"
                        style={{ maxHeight: '180px', objectFit: 'contain' }}
                      />
                    ) : (
                      <div
                        className="rounded-3 bg-slate-100 d-flex align-items-center justify-content-center text-slate-400 border mx-auto"
                        style={{ width: '150px', height: '150px' }}
                      >
                        <i className="bi bi-laptop fs-1"></i>
                      </div>
                    )}
                    <div className="mt-3">
                      <span
                        className={`badge rounded-pill px-3 py-1.5 ${
                          selectedProduct.stock === 0
                            ? 'bg-danger'
                            : selectedProduct.stock <= selectedProduct.low_stock_threshold
                            ? 'bg-warning text-dark'
                            : 'bg-success'
                        }`}
                      >
                        {selectedProduct.stock === 0
                          ? 'Out of Stock'
                          : selectedProduct.stock <= selectedProduct.low_stock_threshold
                          ? `Low Stock (${selectedProduct.stock} units)`
                          : `Healthy Stock (${selectedProduct.stock} units)`}
                      </span>
                    </div>
                  </div>

                  <div className="col-md-8">
                    <table className="table table-sm table-borderless mb-0">
                      <tbody>
                        <tr>
                          <td className="text-muted fw-semibold" style={{ width: '35%' }}>Product Name:</td>
                          <td className="fw-bold text-slate-900">{selectedProduct.name}</td>
                        </tr>
                        <tr>
                          <td className="text-muted fw-semibold">SKU / Code:</td>
                          <td><code>{selectedProduct.sku}</code></td>
                        </tr>
                        <tr>
                          <td className="text-muted fw-semibold">Category:</td>
                          <td className="text-slate-800">{selectedProduct.category_name || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td className="text-muted fw-semibold">Retail Price:</td>
                          <td className="fw-bold text-primary">{formatETB(selectedProduct.price)}</td>
                        </tr>
                        <tr>
                          <td className="text-muted fw-semibold">Cost Price:</td>
                          <td>{formatETB(selectedProduct.cost_price)}</td>
                        </tr>
                        <tr>
                          <td className="text-muted fw-semibold">Current Stock:</td>
                          <td className="fw-bolder fs-6 text-danger">{selectedProduct.stock} units</td>
                        </tr>
                        <tr>
                          <td className="text-muted fw-semibold">Min Stock Level:</td>
                          <td>{selectedProduct.low_stock_threshold} units</td>
                        </tr>
                        <tr>
                          <td className="text-muted fw-semibold">Recommended Reorder:</td>
                          <td className="fw-bold text-info">{selectedProduct.reorder_quantity} units</td>
                        </tr>
                        <tr>
                          <td className="text-muted fw-semibold">Assigned Supplier:</td>
                          <td className="fw-semibold text-emerald-700">
                            {selectedProduct.supplier_name || 'No Supplier Assigned'}
                            {selectedProduct.supplier_email && (
                              <span className="text-muted small d-block">({selectedProduct.supplier_email})</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="modal-footer bg-slate-50 p-3 px-4 d-flex justify-content-between">
                <Link
                  to={`/manager/inventory?product_id=${selectedProduct.id}`}
                  className="btn btn-outline-primary btn-sm rounded-pill text-xs px-3"
                  onClick={() => setSelectedProduct(null)}
                >
                  Edit in Inventory Page &rarr;
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm rounded-pill px-4 text-xs"
                  onClick={() => setSelectedProduct(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: VIEW SUPPLIER DETAILS
          ========================================================================= */}
      {viewingSupplier && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1060 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <div className="modal-header bg-slate-900 text-white p-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-truck text-emerald-400"></i>
                  <h6 className="modal-title fw-bold mb-0">Supplier Profile: {viewingSupplier.name}</h6>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setViewingSupplier(null)}
                ></button>
              </div>
              <div className="modal-body p-4 text-xs">
                <div className="d-flex flex-column gap-2">
                  <div className="p-3 bg-slate-50 rounded-3 border">
                    <div className="text-muted fw-semibold">Supplier Name</div>
                    <div className="fw-bold text-sm text-slate-900">{viewingSupplier.name}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-3 border">
                    <div className="text-muted fw-semibold">Contact Person</div>
                    <div className="fw-semibold text-slate-800">{viewingSupplier.contact_person || 'Not Specified'}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-3 border">
                    <div className="text-muted fw-semibold">Email Address (for Reorders)</div>
                    <div className="fw-bold text-primary">
                      {viewingSupplier.email ? (
                        <a href={`mailto:${viewingSupplier.email}`} className="text-decoration-none">
                          {viewingSupplier.email}
                        </a>
                      ) : (
                        <span className="text-danger fw-bold">No registered email address!</span>
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-3 border">
                    <div className="text-muted fw-semibold">Phone</div>
                    <div className="fw-semibold text-slate-800">{viewingSupplier.phone || 'N/A'}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-3 border">
                    <div className="text-muted fw-semibold">Physical Address</div>
                    <div className="text-slate-700">{viewingSupplier.address || 'N/A'}</div>
                  </div>
                </div>
              </div>
              <div className="modal-footer bg-slate-50 p-3 px-4">
                <Link
                  to="/manager/suppliers"
                  className="btn btn-outline-primary btn-sm rounded-pill text-xs px-3"
                  onClick={() => setViewingSupplier(null)}
                >
                  Manage in Suppliers Hub &rarr;
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm rounded-pill px-4 text-xs"
                  onClick={() => setViewingSupplier(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: CREATE PURCHASE REQUEST (Workflow Approval)
          ========================================================================= */}
      {prProduct && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1060 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <div className="modal-header bg-slate-900 text-white p-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-cart-plus text-warning"></i>
                  <h6 className="modal-title fw-bold mb-0">Create Purchase Request: {prProduct.name}</h6>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setPrProduct(null)}
                ></button>
              </div>
              <form onSubmit={handleSubmitPR}>
                <div className="modal-body p-4 text-xs">
                  <div className="alert alert-info py-2 px-3 rounded-3 text-[11px] mb-3">
                    <i className="bi bi-info-circle me-1"></i>
                    This creates an internal procurement requisition for Store Manager review and approval. It does not auto-commit funds.
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-slate-600 fw-bold">Reorder Quantity (Units)</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control form-control-sm rounded-pill px-3"
                      value={prQuantity}
                      onChange={(e) => setPrQuantity(e.target.value)}
                      required
                    />
                    <small className="text-muted text-[11px]">Recommended supplier replenishment batch size.</small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-slate-600 fw-bold">Estimated Unit Cost (ETB)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control form-control-sm rounded-pill px-3"
                      value={prUnitCost}
                      onChange={(e) => setPrUnitCost(e.target.value)}
                      placeholder="e.g. 52000.00"
                    />
                    <small className="text-muted text-[11px]">Estimated total: {formatETB((parseFloat(prUnitCost) || 0) * parseInt(prQuantity || 0, 10))}</small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-slate-600 fw-bold">Procurement Notes / Instructions</label>
                    <textarea
                      rows="3"
                      className="form-control rounded-3 text-xs"
                      value={prNotes}
                      onChange={(e) => setPrNotes(e.target.value)}
                      placeholder="Note required delivery dates, supplier quotes, or warehouse handling specs..."
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer bg-slate-50 p-3 px-4">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                    onClick={() => setPrProduct(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm rounded-pill px-4 fw-bold"
                    disabled={submittingPR}
                  >
                    {submittingPR ? 'Submitting...' : 'Submit Requisition'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: UPDATE REORDER QUANTITY & THRESHOLD
          ========================================================================= */}
      {reorderProduct && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1060 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <div className="modal-header bg-slate-900 text-white p-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-sliders text-info"></i>
                  <h6 className="modal-title fw-bold mb-0">Reorder Settings: {reorderProduct.name}</h6>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setReorderProduct(null)}
                ></button>
              </div>
              <form onSubmit={handleSaveReorderSettings}>
                <div className="modal-body p-4 text-xs">
                  <div className="mb-3">
                    <label className="form-label text-slate-700 fw-bold">Minimum Stock Level (Alert Point)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-control form-control-sm rounded-pill px-3"
                      value={editMinLevel}
                      onChange={(e) => setEditMinLevel(e.target.value)}
                      required
                    />
                    <small className="text-muted text-[11px]">When stock falls at or below this number, low stock alert triggers.</small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-slate-700 fw-bold">Suggested Reorder Quantity (Units)</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control form-control-sm rounded-pill px-3"
                      value={editReorderQty}
                      onChange={(e) => setEditReorderQty(e.target.value)}
                      required
                    />
                    <small className="text-muted text-[11px]">Recommended units requested on supplier reorder emails.</small>
                  </div>
                </div>
                <div className="modal-footer bg-slate-50 p-3 px-4">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                    onClick={() => setReorderProduct(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm rounded-pill px-4 fw-bold"
                    disabled={savingReorder}
                  >
                    {savingReorder ? 'Saving...' : 'Update Settings'}
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

export default NotificationDashboard;
