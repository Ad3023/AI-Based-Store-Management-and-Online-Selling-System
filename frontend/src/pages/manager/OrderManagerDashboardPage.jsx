import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';
import { getProductImage } from '../../utils/productImages';
import {
  getPaymentStatusInfo,
  getFulfillmentStatusInfo,
  getOrderMilestones,
} from '../../utils/orderStatus';

const OrderManagerDashboardPage = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const targetOrderId = searchParams.get('order_id');

  // Stats / KPIs State
  const [stats, setStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    confirmed_orders: 0,
    processing_orders: 0,
    shipped_orders: 0,
    delivered_orders: 0,
    cancelled_orders: 0,
    total_revenue: 0,
  });

  // Orders List State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected Order for Modal / Drawer
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Status Transition Control in Modal
  const [transitionStatus, setTransitionStatus] = useState('');
  const [transitionComment, setTransitionComment] = useState('');
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  // Quick Reject Modal State
  const [rejectOrderTarget, setRejectOrderTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Alert Feedback
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [exportingCsv, setExportingCsv] = useState(false);

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api.get('orders/analytics/order-manager-stats/');
      if (res.data?.kpis) {
        setStats(res.data.kpis);
      }
    } catch (err) {
      console.error('Failed to load order manager stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Filtered Orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (fulfillmentFilter) params.fulfillment_status = fulfillmentFilter;
      if (paymentFilter) params.payment_status = paymentFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await api.get('orders/', { params });
      const list = res.data.results || res.data || [];
      setOrders(list);

      // Keep open order updated
      setSelectedOrder((prev) => {
        if (!prev) return null;
        return list.find((o) => o.id === prev.id) || prev;
      });
    } catch (err) {
      console.error('Failed to load orders for Order Manager:', err);
      setFeedback({
        type: 'danger',
        text: 'Failed to load customer orders. Please check your network or credentials.',
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, fulfillmentFilter, paymentFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-open target order from query params
  useEffect(() => {
    if (targetOrderId && orders.length > 0) {
      const match = orders.find(
        (o) => String(o.id) === String(targetOrderId) || String(o.order_number) === String(targetOrderId)
      );
      if (match) {
        setSelectedOrder(match);
        setShowDetailsModal(true);
      }
    }
  }, [orders, targetOrderId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFulfillmentFilter('');
    setPaymentFilter('');
    setDateFrom('');
    setDateTo('');
    fetchOrders();
  };

  const handleKpiCardClick = (statusKey) => {
    if (fulfillmentFilter === statusKey) {
      setFulfillmentFilter(''); // Toggle off
    } else {
      setFulfillmentFilter(statusKey);
    }
  };

  // Status Transition Execution
  const executeStatusTransition = async (orderId, targetStatus, comment = '', reconNote = '') => {
    try {
      setTransitioning(true);
      const payload = {
        fulfillment_status: targetStatus,
        comment: comment.trim(),
        reconciliation_note: reconNote.trim(),
      };

      const res = await api.patch(`orders/${orderId}/status/`, payload);
      setFeedback({
        type: 'success',
        text: `Order #${res.data.order_number} transitioned to ${targetStatus} successfully! Customer notified.`,
      });

      setSelectedOrder(res.data);
      setTransitionStatus('');
      setTransitionComment('');
      setReconciliationNote('');
      fetchOrders();
      fetchStats();
    } catch (err) {
      const errDetail = err.response?.data?.error || err.response?.data?.detail || 'Failed to update order status.';
      alert(`Status Update Failed: ${errDetail}`);
    } finally {
      setTransitioning(false);
    }
  };

  // Quick Reject Execution
  const handleQuickRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectOrderTarget) return;
    try {
      setRejecting(true);
      const payload = {
        fulfillment_status: 'CANCELLED',
        comment: rejectReason.trim() || 'Order rejected by Order Manager.',
      };
      const res = await api.patch(`orders/${rejectOrderTarget.id}/status/`, payload);
      setFeedback({
        type: 'warning',
        text: `Order #${res.data.order_number} was rejected and marked as Cancelled.`,
      });
      setRejectOrderTarget(null);
      setRejectReason('');
      fetchOrders();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject order.');
    } finally {
      setRejecting(false);
    }
  };

  // Export Sales Report CSV
  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const response = await api.get('orders/analytics/export-sales/', {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sales_orders_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export CSV error:', err);
      alert('Failed to export order report. Please check permissions.');
    } finally {
      setExportingCsv(false);
    }
  };

  // Allowed Transitions Helper
  const getAllowedTransitions = (currStatus) => {
    const s = String(currStatus || 'PENDING').toUpperCase();
    const transitions = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
      PAYMENT_SUBMITTED: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
      REFUNDED: [],
    };
    return transitions[s] || [];
  };

  return (
    <div className="pb-5">
      {/* Header Banner */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-warning border-opacity-25 bg-warning bg-opacity-10">
            <i className="bi bi-box-seam-fill text-warning"></i>
            <span className="small fw-bold text-amber-700">Order Management & Fulfillment Console</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Order Fulfillment Pipeline</h2>
          <p className="text-slate-500 text-xs mb-0">
            Confirm pending customer purchases, advance warehouse processing, track courier dispatches, and review status audit histories.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            onClick={fetchOrders}
            className="btn btn-outline-secondary btn-sm rounded-pill px-3 py-2 text-xs d-flex align-items-center gap-1.5 shadow-sm"
            title="Refresh order table"
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i> Refresh
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="btn btn-primary btn-sm rounded-pill px-3.5 py-2 text-xs fw-semibold d-flex align-items-center gap-1.5 shadow-sm"
          >
            {exportingCsv ? (
              <span className="spinner-border spinner-border-sm me-1"></span>
            ) : (
              <i className="bi bi-file-earmark-arrow-down-fill"></i>
            )}
            Export Orders CSV
          </button>
        </div>
      </div>

      {/* Alert Feedback */}
      {feedback.text && (
        <div
          className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm d-flex align-items-center justify-content-between`}
          role="alert"
        >
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'} fs-6`}></i>
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            className="btn-close btn-sm p-2"
            onClick={() => setFeedback({ type: '', text: '' })}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* ======================================================================
          KPI METRIC CARDS (Interactive Filtering)
          ====================================================================== */}
      <div className="row g-3 mb-4">
        {/* Total Orders Card */}
        <div className="col-6 col-md-4 col-xl-2">
          <div
            onClick={() => handleKpiCardClick('')}
            className={`card border-0 shadow-sm rounded-4 p-3 h-100 transition cursor-pointer ${
              fulfillmentFilter === '' ? 'ring-2 ring-primary bg-primary bg-opacity-5' : 'bg-white hover-shadow'
            }`}
            style={{ cursor: 'pointer' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-slate-500 text-[11px] font-bold text-uppercase">Total Orders</span>
              <div className="rounded-3 p-2 bg-primary bg-opacity-10 text-primary">
                <i className="bi bi-receipt-cutoff fs-6"></i>
              </div>
            </div>
            <h3 className="fw-bolder mb-0 text-slate-900">{statsLoading ? '...' : stats.total_orders}</h3>
            <small className="text-slate-400 text-[10px] mt-1 d-block">All customer orders</small>
          </div>
        </div>

        {/* Pending Orders Card */}
        <div className="col-6 col-md-4 col-xl-2">
          <div
            onClick={() => handleKpiCardClick('PENDING')}
            className={`card border-0 shadow-sm rounded-4 p-3 h-100 transition cursor-pointer ${
              fulfillmentFilter === 'PENDING' ? 'ring-2 ring-warning bg-warning bg-opacity-10' : 'bg-white hover-shadow'
            }`}
            style={{ cursor: 'pointer' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-amber-700 text-[11px] font-bold text-uppercase">Pending</span>
              <div className="rounded-3 p-2 bg-warning bg-opacity-15 text-amber-600">
                <i className="bi bi-hourglass-split fs-6"></i>
              </div>
            </div>
            <h3 className="fw-bolder mb-0 text-amber-700">{statsLoading ? '...' : stats.pending_orders}</h3>
            <small className="text-amber-600 text-[10px] mt-1 d-block font-semibold">Requires confirmation</small>
          </div>
        </div>

        {/* Confirmed Orders Card */}
        <div className="col-6 col-md-4 col-xl-2">
          <div
            onClick={() => handleKpiCardClick('CONFIRMED')}
            className={`card border-0 shadow-sm rounded-4 p-3 h-100 transition cursor-pointer ${
              fulfillmentFilter === 'CONFIRMED' ? 'ring-2 ring-indigo bg-indigo-50' : 'bg-white hover-shadow'
            }`}
            style={{ cursor: 'pointer' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-indigo-700 text-[11px] font-bold text-uppercase">Confirmed</span>
              <div className="rounded-3 p-2 bg-indigo-100 text-indigo-600">
                <i className="bi bi-check2-circle fs-6"></i>
              </div>
            </div>
            <h3 className="fw-bolder mb-0 text-indigo-900">{statsLoading ? '...' : stats.confirmed_orders}</h3>
            <small className="text-indigo-600 text-[10px] mt-1 d-block">Ready to process</small>
          </div>
        </div>

        {/* Processing Orders Card */}
        <div className="col-6 col-md-4 col-xl-2">
          <div
            onClick={() => handleKpiCardClick('PROCESSING')}
            className={`card border-0 shadow-sm rounded-4 p-3 h-100 transition cursor-pointer ${
              fulfillmentFilter === 'PROCESSING' ? 'ring-2 ring-blue bg-blue-50' : 'bg-white hover-shadow'
            }`}
            style={{ cursor: 'pointer' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-blue-700 text-[11px] font-bold text-uppercase">Processing</span>
              <div className="rounded-3 p-2 bg-blue-100 text-blue-600">
                <i className="bi bi-box-seam fs-6"></i>
              </div>
            </div>
            <h3 className="fw-bolder mb-0 text-blue-900">{statsLoading ? '...' : stats.processing_orders}</h3>
            <small className="text-blue-600 text-[10px] mt-1 d-block">Packing in warehouse</small>
          </div>
        </div>

        {/* Delivered Orders Card */}
        <div className="col-6 col-md-4 col-xl-2">
          <div
            onClick={() => handleKpiCardClick('DELIVERED')}
            className={`card border-0 shadow-sm rounded-4 p-3 h-100 transition cursor-pointer ${
              fulfillmentFilter === 'DELIVERED' ? 'ring-2 ring-emerald bg-emerald-50' : 'bg-white hover-shadow'
            }`}
            style={{ cursor: 'pointer' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-emerald-700 text-[11px] font-bold text-uppercase">Delivered</span>
              <div className="rounded-3 p-2 bg-emerald-100 text-emerald-600">
                <i className="bi bi-patch-check-fill fs-6"></i>
              </div>
            </div>
            <h3 className="fw-bolder mb-0 text-emerald-900">{statsLoading ? '...' : stats.delivered_orders}</h3>
            <small className="text-emerald-600 text-[10px] mt-1 d-block">Fulfilled orders</small>
          </div>
        </div>

        {/* Revenue Card */}
        <div className="col-6 col-md-4 col-xl-2">
          <div className="card border-0 shadow-sm rounded-4 p-3 h-100 bg-white">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-slate-500 text-[11px] font-bold text-uppercase">Paid Revenue</span>
              <div className="rounded-3 p-2 bg-teal-50 text-teal-600">
                <i className="bi bi-cash-coin fs-6"></i>
              </div>
            </div>
            <h4 className="fw-bolder mb-0 text-teal-800 fs-5 text-truncate">
              {statsLoading ? '...' : formatETB(stats.total_revenue)}
            </h4>
            <small className="text-slate-400 text-[10px] mt-1 d-block">Verified settlements</small>
          </div>
        </div>
      </div>

      {/* ======================================================================
          SEARCH & FILTERING BAR
          ====================================================================== */}
      <div className="card border-0 shadow-sm rounded-4 p-3.5 mb-4 bg-white">
        <div className="row g-2.5 align-items-center">
          {/* Text Search */}
          <div className="col-12 col-md-4 col-lg-3">
            <form onSubmit={handleSearchSubmit}>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-slate-50 border-end-0 text-slate-400">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control form-control-sm bg-slate-50 border-start-0 text-xs"
                  placeholder="Order #, customer, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-sm btn-primary px-2.5 text-xs">
                  Search
                </button>
              </div>
            </form>
          </div>

          {/* Fulfillment Status Filter */}
          <div className="col-6 col-md-3 col-lg-2">
            <select
              className="form-select form-select-sm text-xs rounded-3 bg-slate-50"
              value={fulfillmentFilter}
              onChange={(e) => setFulfillmentFilter(e.target.value)}
            >
              <option value="">Fulfillment: All</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div className="col-6 col-md-3 col-lg-2">
            <select
              className="form-select form-select-sm text-xs rounded-3 bg-slate-50"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="">Payment: All</option>
              <option value="PAID">Paid / Verified</option>
              <option value="PENDING">Pending Payment</option>
              <option value="FAILED">Payment Failed</option>
            </select>
          </div>

          {/* Date Range: From */}
          <div className="col-6 col-md-3 col-lg-2">
            <input
              type="date"
              className="form-control form-control-sm text-xs rounded-3 bg-slate-50"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          {/* Date Range: To */}
          <div className="col-6 col-md-3 col-lg-2">
            <input
              type="date"
              className="form-control form-control-sm text-xs rounded-3 bg-slate-50"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {/* Reset Filters */}
          <div className="col-12 col-lg-1 text-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-outline-secondary btn-sm w-100 text-xs rounded-3"
              title="Reset all filters"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ORDERS MANAGEMENT TABLE
          ====================================================================== */}
      <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between bg-white">
          <div className="d-flex align-items-center gap-2">
            <h5 className="fw-bold mb-0 text-slate-900 fs-6">Orders Pipeline</h5>
            <span className="badge bg-slate-100 text-slate-700 rounded-pill font-normal text-xs px-2.5 py-1">
              {orders.length} orders found
            </span>
          </div>
          {fulfillmentFilter && (
            <div className="d-flex align-items-center gap-1.5">
              <span className="text-slate-500 text-xs">Filtered by:</span>
              <span className="badge bg-warning bg-opacity-20 text-amber-800 text-xs fw-bold px-2 py-1">
                {fulfillmentFilter}
              </span>
              <button
                type="button"
                className="btn-close btn-sm p-1"
                onClick={() => setFulfillmentFilter('')}
                title="Clear filter"
              ></button>
            </div>
          )}
        </div>

        <div className="table-responsive">
          <table className="table align-middle mb-0 text-xs">
            <thead className="table-light text-uppercase text-[11px] text-slate-500 border-bottom">
              <tr>
                <th className="ps-3">Order # & Date</th>
                <th>Customer Details</th>
                <th>Purchased Items</th>
                <th>Total ETB</th>
                <th>Payment Status</th>
                <th>Fulfillment Status</th>
                <th className="text-end pe-3">Actions & Workflow</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                    <span className="text-slate-500">Loading order registry...</span>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <i className="bi bi-box2 fs-1 text-slate-300 d-block mb-2"></i>
                    <h6 className="fw-bold text-slate-700">No Orders Match the Filter</h6>
                    <p className="text-slate-400 text-xs mb-3">Try adjusting your search criteria or resetting filters.</p>
                    <button onClick={handleResetFilters} className="btn btn-sm btn-outline-primary rounded-pill px-3">
                      Clear Filters
                    </button>
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const payInfo = getPaymentStatusInfo(o);
                  const fulInfo = getFulfillmentStatusInfo(o);
                  const currFul = String(o.fulfillment_status || o.status || 'PENDING').toUpperCase();

                  return (
                    <tr key={o.id} className="border-bottom hover-bg-slate-50">
                      {/* Order # & Date */}
                      <td className="ps-3 py-3">
                        <div className="fw-bold text-slate-900 font-monospace">
                          #{o.order_number}
                        </div>
                        <small className="text-slate-400 text-[11px]">
                          {new Date(o.created_at).toLocaleDateString()} {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </small>
                      </td>

                      {/* Customer Details */}
                      <td>
                        <div className="fw-semibold text-slate-800">
                          {o.shipping_name || o.customer_name || 'Customer'}
                        </div>
                        <div className="text-slate-500 text-[11px]">{o.customer_email || 'No email provided'}</div>
                        {o.shipping_phone && (
                          <div className="text-slate-400 text-[10px]">
                            <i className="bi bi-telephone me-1"></i>{o.shipping_phone}
                          </div>
                        )}
                      </td>

                      {/* Items */}
                      <td style={{ maxWidth: '240px' }}>
                        <div className="text-truncate fw-medium text-slate-800">
                          {o.items?.map((item) => `${item.quantity}x ${item.product_name}`).join(', ') || 'No items'}
                        </div>
                        <small className="text-slate-400 text-[11px]">
                          {o.items?.length || 0} item{o.items?.length === 1 ? '' : 's'} &bull; {o.shipping_city || 'Addis Ababa'}
                        </small>
                      </td>

                      {/* Total Amount */}
                      <td>
                        <strong className="text-slate-900 font-semibold">{formatETB(o.total_amount)}</strong>
                      </td>

                      {/* Payment Status */}
                      <td>
                        <span className={`badge ${payInfo.badgeClass} rounded-pill px-2.5 py-1 text-[11px] fw-semibold`}>
                          {payInfo.label}
                        </span>
                      </td>

                      {/* Fulfillment Status */}
                      <td>
                        <span className={`badge ${fulInfo.badgeClass} rounded-pill px-2.5 py-1 text-[11px] fw-semibold`}>
                          {fulInfo.label}
                        </span>
                      </td>

                      {/* Action Workflow Controls */}
                      <td className="text-end pe-3">
                        <div className="d-inline-flex align-items-center gap-1.5 flex-wrap justify-content-end">
                          {/* PENDING -> CONFIRM or REJECT */}
                          {currFul === 'PENDING' && (
                            <>
                              <button
                                onClick={() => executeStatusTransition(o.id, 'CONFIRMED', 'Order verified and confirmed by Order Manager.')}
                                className="btn btn-sm btn-success rounded-pill px-2.5 py-1 text-xs fw-semibold shadow-sm d-inline-flex align-items-center gap-1"
                                title="Confirm this order"
                              >
                                <i className="bi bi-check-lg"></i> Confirm
                              </button>
                              <button
                                onClick={() => {
                                  setRejectOrderTarget(o);
                                  setRejectReason('');
                                }}
                                className="btn btn-sm btn-outline-danger rounded-pill px-2 py-1 text-xs fw-semibold"
                                title="Reject / cancel this order"
                              >
                                <i className="bi bi-x-lg"></i> Reject
                              </button>
                            </>
                          )}

                          {/* CONFIRMED -> PROCESSING */}
                          {currFul === 'CONFIRMED' && (
                            <button
                              onClick={() => executeStatusTransition(o.id, 'PROCESSING', 'Order moved to warehouse processing.')}
                              className="btn btn-sm btn-primary rounded-pill px-2.5 py-1 text-xs fw-semibold shadow-sm d-inline-flex align-items-center gap-1"
                              title="Advance to warehouse packing"
                            >
                              <i className="bi bi-box-seam"></i> Process
                            </button>
                          )}

                          {/* PROCESSING -> SHIPPED */}
                          {currFul === 'PROCESSING' && (
                            <button
                              onClick={() => executeStatusTransition(o.id, 'SHIPPED', 'Order dispatched with courier service.')}
                              className="btn btn-sm btn-info text-white rounded-pill px-2.5 py-1 text-xs fw-semibold shadow-sm d-inline-flex align-items-center gap-1"
                              title="Mark as dispatched / shipped"
                            >
                              <i className="bi bi-truck"></i> Ship
                            </button>
                          )}

                          {/* SHIPPED -> DELIVERED */}
                          {currFul === 'SHIPPED' && (
                            <button
                              onClick={() => executeStatusTransition(o.id, 'DELIVERED', 'Delivered and verified with customer.')}
                              className="btn btn-sm btn-emerald text-white rounded-pill px-2.5 py-1 text-xs fw-semibold shadow-sm d-inline-flex align-items-center gap-1"
                              style={{ backgroundColor: '#059669' }}
                              title="Mark delivered to recipient"
                            >
                              <i className="bi bi-patch-check-fill"></i> Deliver
                            </button>
                          )}

                          {/* Details Button */}
                          <button
                            onClick={() => {
                              setSelectedOrder(o);
                              setShowDetailsModal(true);
                              setTransitionStatus('');
                              setTransitionComment('');
                              setReconciliationNote('');
                            }}
                            className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1 text-xs"
                            title="Inspect order details and history"
                          >
                            <i className="bi bi-eye"></i> Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          MODAL: QUICK REJECT ORDER REASON MODAL
          ====================================================================== */}
      {rejectOrderTarget && (
        <div className="modal fade show d-block bg-black bg-opacity-50" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '440px' }}>
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom">
                <h6 className="modal-title fw-bold text-danger d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill"></i> Reject Order #{rejectOrderTarget.order_number}
                </h6>
                <button type="button" className="btn-close" onClick={() => setRejectOrderTarget(null)}></button>
              </div>
              <form onSubmit={handleQuickRejectSubmit}>
                <div className="modal-body p-4">
                  <p className="text-slate-600 text-xs mb-3">
                    Are you sure you want to reject this order? This will transition the order status to <strong>CANCELLED</strong> and notify customer <strong>{rejectOrderTarget.shipping_name || rejectOrderTarget.customer_name}</strong>.
                  </p>
                  <label className="form-label text-xs fw-bold text-slate-800">Reason for Rejection / Cancellation *</label>
                  <textarea
                    className="form-control text-xs"
                    rows="3"
                    placeholder="e.g. Unverified payment slip, out of stock, customer requested cancellation..."
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  ></textarea>
                </div>
                <div className="modal-footer border-top">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                    onClick={() => setRejectOrderTarget(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rejecting || !rejectReason.trim()}
                    className="btn btn-sm btn-danger rounded-pill px-4"
                  >
                    {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODAL: ORDER DETAILS, STATUS WORKFLOW & STATUS HISTORY TIMELINE
          ====================================================================== */}
      {showDetailsModal && selectedOrder && (
        <div className="modal fade show d-block bg-black bg-opacity-50" tabIndex="-1">
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content rounded-4 border-0 shadow-xl overflow-hidden">
              {/* Modal Header */}
              <div className="modal-header bg-slate-900 text-white p-3.5 border-bottom border-slate-800">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-white"
                    style={{ width: '40px', height: '40px', backgroundColor: '#1b64da' }}
                  >
                    <i className="bi bi-box-seam-fill fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-white mb-0 fs-6">
                      Order Details: #{selectedOrder.order_number}
                    </h5>
                    <small className="text-slate-400 text-xs">
                      Placed on {new Date(selectedOrder.created_at).toLocaleString()} &bull; Total: {formatETB(selectedOrder.total_amount)}
                    </small>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <span className={`badge ${getFulfillmentStatusInfo(selectedOrder).badgeClass} px-3 py-1.5 rounded-pill`}>
                    Fulfillment: {getFulfillmentStatusInfo(selectedOrder).label}
                  </span>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowDetailsModal(false)}
                    aria-label="Close"
                  ></button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-slate-50">
                <div className="row g-4">
                  {/* Left Column: Customer & Items Information */}
                  <div className="col-12 col-lg-7">
                    {/* Customer Info Card */}
                    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3 bg-white">
                      <h6 className="fw-bold text-slate-900 mb-2.5 fs-7 border-bottom pb-2">
                        <i className="bi bi-person-circle text-primary me-1.5"></i> Customer & Shipping Address
                      </h6>
                      <div className="row g-2 text-xs">
                        <div className="col-6">
                          <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Customer Name</span>
                          <strong className="text-slate-800">{selectedOrder.shipping_name || selectedOrder.customer_name}</strong>
                        </div>
                        <div className="col-6">
                          <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Email Address</span>
                          <span className="text-slate-700">{selectedOrder.customer_email || 'N/A'}</span>
                        </div>
                        <div className="col-6">
                          <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Phone Number</span>
                          <span className="text-slate-700">{selectedOrder.shipping_phone || 'N/A'}</span>
                        </div>
                        <div className="col-6">
                          <span className="text-slate-400 d-block text-[10px] uppercase font-bold">City / Location</span>
                          <span className="text-slate-700">{selectedOrder.shipping_city || 'Addis Ababa'}</span>
                        </div>
                        <div className="col-12 mt-1">
                          <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Street Address</span>
                          <span className="text-slate-800">{selectedOrder.shipping_address}</span>
                        </div>
                      </div>
                    </div>

                    {/* Ordered Items List */}
                    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3 bg-white">
                      <h6 className="fw-bold text-slate-900 mb-2.5 fs-7 border-bottom pb-2 d-flex justify-content-between">
                        <span><i className="bi bi-basket3 text-primary me-1.5"></i> Ordered Items ({selectedOrder.items?.length || 0})</span>
                        <span className="text-primary font-bold">{formatETB(selectedOrder.total_amount)}</span>
                      </h6>
                      <div className="d-flex flex-column gap-2">
                        {selectedOrder.items?.map((item) => (
                          <div key={item.id} className="p-2.5 rounded-3 bg-slate-50 border border-slate-100 d-flex align-items-center justify-content-between gap-3">
                            <div className="d-flex align-items-center gap-2.5 min-w-0">
                              <img
                                src={getProductImage(item.product)}
                                alt={item.product_name}
                                className="rounded-2 object-contain bg-white border p-1 shrink-0"
                                style={{ width: '46px', height: '46px' }}
                              />
                              <div className="min-w-0 text-xs">
                                <div className="fw-bold text-slate-900 text-truncate">{item.product_name}</div>
                                <small className="text-slate-500">
                                  Qty: <strong>{item.quantity}</strong> &bull; {formatETB(item.unit_price)} each
                                </small>
                              </div>
                            </div>
                            <div className="fw-bold text-slate-900 text-xs shrink-0">
                              {formatETB(item.total_price)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Information */}
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white">
                      <h6 className="fw-bold text-slate-900 mb-2.5 fs-7 border-bottom pb-2">
                        <i className="bi bi-credit-card-2-front text-primary me-1.5"></i> Payment & Gateway Details
                      </h6>
                      <div className="row g-2 text-xs">
                        <div className="col-6">
                          <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Payment Channel</span>
                          <strong className="text-slate-800">{selectedOrder.payment_method}</strong>
                        </div>
                        <div className="col-6">
                          <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Payment Status</span>
                          <span className={`badge ${getPaymentStatusInfo(selectedOrder).badgeClass} text-[10px] rounded-pill`}>
                            {getPaymentStatusInfo(selectedOrder).label}
                          </span>
                        </div>
                        {selectedOrder.chapa_tx_ref && (
                          <div className="col-12">
                            <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Chapa Transaction Reference</span>
                            <span className="font-monospace text-slate-700 bg-slate-100 p-1 rounded d-inline-block text-[11px]">
                              {selectedOrder.chapa_tx_ref}
                            </span>
                          </div>
                        )}
                        {selectedOrder.payment_evidence && (
                          <div className="col-12 mt-2 pt-2 border-top">
                            <span className="text-slate-400 d-block text-[10px] uppercase font-bold mb-1">
                              Bank Evidence Slip
                            </span>
                            <div className="d-flex align-items-center gap-3">
                              {selectedOrder.payment_evidence.evidence_image && (
                                <a
                                  href={selectedOrder.payment_evidence.evidence_image}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-outline-primary btn-sm rounded-pill text-xs py-1"
                                >
                                  <i className="bi bi-image me-1"></i> View Bank Slip
                                </a>
                              )}
                              <span className="text-slate-500 text-xs">
                                Ref: <strong>{selectedOrder.payment_evidence.transaction_reference}</strong>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Status Transitions & Status History Timeline */}
                  <div className="col-12 col-lg-5">
                    {/* Status Update Control Card */}
                    <div className="card border-0 shadow-sm rounded-4 p-3.5 mb-3 bg-white">
                      <h6 className="fw-bold text-slate-900 mb-2.5 fs-7 border-bottom pb-2">
                        <i className="bi bi-arrow-repeat text-primary me-1.5"></i> Update Fulfillment Status
                      </h6>

                      <div className="mb-2.5">
                        <label className="form-label text-xs fw-bold text-slate-700">Target Fulfillment Status *</label>
                        <select
                          className="form-select form-select-sm text-xs rounded-3"
                          value={transitionStatus}
                          onChange={(e) => setTransitionStatus(e.target.value)}
                        >
                          <option value="">-- Choose Next Status --</option>
                          {getAllowedTransitions(selectedOrder.fulfillment_status || selectedOrder.status).map((st) => (
                            <option key={st} value={st}>
                              {st} {st === 'CANCELLED' ? '(Reject/Cancel Order)' : ''}
                            </option>
                          ))}
                        </select>
                        <small className="text-slate-400 text-[10px] mt-1 d-block">
                          Current status: <strong className="text-slate-700">{selectedOrder.fulfillment_status || selectedOrder.status}</strong>
                        </small>
                      </div>

                      <div className="mb-2.5">
                        <label className="form-label text-xs fw-bold text-slate-700">Status Change Comment / Customer Note</label>
                        <textarea
                          className="form-control text-xs"
                          rows="2"
                          placeholder="Provide details about packing, tracking number, or dispatch note..."
                          value={transitionComment}
                          onChange={(e) => setTransitionComment(e.target.value)}
                        ></textarea>
                      </div>

                      {/* Reconciliation Note if order is unpaid and advancing */}
                      {!getPaymentStatusInfo(selectedOrder).isPaid &&
                        ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(transitionStatus) && (
                          <div className="alert alert-warning p-2.5 rounded-3 text-xs mb-2.5">
                            <i className="bi bi-exclamation-triangle-fill me-1"></i>
                            <strong>Payment Not Verified:</strong> Advancing fulfillment on an unpaid order requires an audited reconciliation note.
                            <input
                              type="text"
                              className="form-control form-control-sm mt-1.5 text-xs bg-white"
                              placeholder="Audited reconciliation reason..."
                              value={reconciliationNote}
                              onChange={(e) => setReconciliationNote(e.target.value)}
                              required
                            />
                          </div>
                        )}

                      <button
                        type="button"
                        onClick={() => executeStatusTransition(selectedOrder.id, transitionStatus, transitionComment, reconciliationNote)}
                        disabled={transitioning || !transitionStatus}
                        className="btn btn-primary btn-sm w-100 rounded-pill py-2 text-xs fw-bold shadow-sm"
                      >
                        {transitioning ? 'Saving Status Transition...' : 'Execute Status Update'}
                      </button>
                    </div>

                    {/* Order Status History Timeline */}
                    <div className="card border-0 shadow-sm rounded-4 p-3.5 bg-white">
                      <h6 className="fw-bold text-slate-900 mb-3 fs-7 border-bottom pb-2 d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-clock-history text-primary me-1.5"></i> Order Status Audit Timeline</span>
                        <span className="badge bg-slate-100 text-slate-600 rounded-pill text-[10px]">
                          {selectedOrder.status_history?.length || 0} events
                        </span>
                      </h6>

                      <div className="timeline position-relative ps-3" style={{ borderLeft: '2px solid #e2e8f0', marginLeft: '8px' }}>
                        {selectedOrder.status_history && selectedOrder.status_history.length > 0 ? (
                          selectedOrder.status_history.map((hist, idx) => (
                            <div key={hist.id || idx} className="position-relative mb-3 pb-1">
                              {/* Timeline Dot */}
                              <div
                                className="position-absolute rounded-circle bg-primary"
                                style={{
                                  width: '10px',
                                  height: '10px',
                                  left: '-20px',
                                  top: '4px',
                                  boxShadow: '0 0 0 3px #dbeafe',
                                }}
                              ></div>

                              <div className="d-flex align-items-center justify-content-between mb-1">
                                <span className="badge bg-slate-900 text-white text-[10px] fw-bold rounded-pill">
                                  {hist.new_status}
                                </span>
                                <small className="text-slate-400 text-[10px]">
                                  {new Date(hist.created_at).toLocaleString()}
                                </small>
                              </div>

                              <div className="text-xs text-slate-700">
                                <strong>{hist.changed_by_name || hist.changed_by_username || 'System'}</strong>
                                {hist.changed_by_role && (
                                  <span className="badge bg-secondary bg-opacity-25 text-slate-700 text-[9px] ms-1 text-uppercase">
                                    {hist.changed_by_role}
                                  </span>
                                )}
                              </div>

                              {hist.comment && (
                                <p className="text-slate-500 text-[11px] mb-0 mt-0.5 bg-slate-50 p-1.5 rounded border border-slate-100">
                                  {hist.comment}
                                </p>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400 text-xs italic">
                            No fulfillment transitions recorded yet. Initial status: {selectedOrder.status || 'PENDING'}.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-footer border-top bg-white p-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-4"
                  onClick={() => setShowDetailsModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagerDashboardPage;
