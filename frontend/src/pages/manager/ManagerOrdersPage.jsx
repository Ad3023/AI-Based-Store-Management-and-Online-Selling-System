import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const ManagerOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const targetOrderId = searchParams.get('order_id');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [fulfillmentStatusFilter, setFulfillmentStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected Order for Review/Verification Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusUpdateTarget, setStatusUpdateTarget] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [verifyingChapa, setVerifyingChapa] = useState(false);
  const [verificationReport, setVerificationReport] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (paymentStatusFilter) params.payment_status = paymentStatusFilter;
      if (fulfillmentStatusFilter) params.fulfillment_status = fulfillmentStatusFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await api.get('orders/', { params });
      const list = res.data.results || res.data || [];
      setOrders(list);

      // Keep selected order in sync if currently open
      if (selectedOrder) {
        const updated = list.find((o) => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err) {
      console.error('Error loading manager orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [paymentStatusFilter, fulfillmentStatusFilter, dateFrom, dateTo]);

  // Auto-open order review when arriving from an order notification link (?order_id=...)
  useEffect(() => {
    if (targetOrderId && orders.length > 0) {
      const match = orders.find(
        (o) => String(o.id) === String(targetOrderId) || String(o.order_number) === String(targetOrderId)
      );
      if (match) {
        setSelectedOrder(match);
      }
    }
  }, [orders, targetOrderId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setPaymentStatusFilter('');
    setFulfillmentStatusFilter('');
    setDateFrom('');
    setDateTo('');
    fetchOrders();
  };

  // Verify payment with Chapa official server-side verification
  const handleVerifyWithChapa = async (orderId) => {
    try {
      setVerifyingChapa(true);
      setVerificationReport(null);
      const res = await api.post(`orders/${orderId}/admin-verify-chapa/`, {});
      setVerificationReport(res.data);
      setFeedback({
        type: 'success',
        text: `Payment successfully verified with Chapa for Order #${res.data.order_number}! Status: PAID.`,
      });
      fetchOrders();
    } catch (err) {
      const data = err.response?.data;
      if (data && data.status === 'mismatch') {
        setVerificationReport(data);
        setFeedback({
          type: 'danger',
          text: `Payment discrepancy flagged! ${data.message}`,
        });
      } else {
        alert(data?.message || data?.error || 'Chapa payment verification failed.');
      }
      fetchOrders();
    } finally {
      setVerifyingChapa(false);
    }
  };

  // Open Status Transition Confirmation Modal
  const initiateStatusTransition = (targetStatus) => {
    setStatusUpdateTarget(targetStatus);
    setAdminComment('');
    setReconciliationNote('');
    setShowStatusConfirmModal(true);
  };

  // Submit Controlled Status Transition
  const submitStatusTransition = async () => {
    if (!selectedOrder || !statusUpdateTarget) return;

    try {
      setProcessingAction(true);
      const payload = {
        fulfillment_status: statusUpdateTarget,
        comment: adminComment.trim(),
        reconciliation_note: reconciliationNote.trim(),
      };

      const res = await api.patch(`orders/${selectedOrder.id}/status/`, payload);
      setFeedback({
        type: 'success',
        text: `Order #${selectedOrder.order_number} fulfillment status updated to: ${statusUpdateTarget}. Customer notified.`,
      });
      setSelectedOrder(res.data);
      setShowStatusConfirmModal(false);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update order status.');
    } finally {
      setProcessingAction(false);
    }
  };

  // Helper for Payment Status Badge
  const renderPaymentBadge = (statusStr) => {
    const s = String(statusStr || 'PENDING').toUpperCase();
    if (s === 'PAID') {
      return (
        <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25 rounded-pill px-2.5 py-1">
          <i className="bi bi-check-circle-fill me-1"></i> Paid / Verified
        </span>
      );
    }
    if (s === 'FAILED') {
      return (
        <span className="badge bg-danger bg-opacity-15 text-danger border border-danger border-opacity-25 rounded-pill px-2.5 py-1">
          <i className="bi bi-x-circle-fill me-1"></i> Failed
        </span>
      );
    }
    if (s === 'CANCELLED') {
      return (
        <span className="badge bg-secondary bg-opacity-15 text-secondary border rounded-pill px-2.5 py-1">
          Cancelled
        </span>
      );
    }
    if (s === 'REFUNDED') {
      return (
        <span className="badge bg-purple-100 text-purple-800 border border-purple-200 rounded-pill px-2.5 py-1">
          Refunded
        </span>
      );
    }
    if (s === 'REFUND_PENDING' || s === 'PARTIALLY_REFUNDED') {
      return (
        <span className="badge bg-warning bg-opacity-20 text-dark border border-warning rounded-pill px-2.5 py-1">
          {s.replace(/_/g, ' ')}
        </span>
      );
    }
    return (
      <span className="badge bg-amber-100 text-amber-800 border border-amber-300 rounded-pill px-2.5 py-1">
        <i className="bi bi-hourglass-split me-1"></i> Pending Payment
      </span>
    );
  };

  // Helper for Fulfillment Status Badge
  const renderFulfillmentBadge = (statusStr) => {
    const s = String(statusStr || 'PENDING').toUpperCase();
    switch (s) {
      case 'DELIVERED':
        return (
          <span className="badge bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-pill px-2.5 py-1">
            <i className="bi bi-house-check me-1"></i> Delivered
          </span>
        );
      case 'SHIPPED':
        return (
          <span className="badge bg-cyan-100 text-cyan-800 border border-cyan-300 rounded-pill px-2.5 py-1">
            <i className="bi bi-truck me-1"></i> Shipped
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="badge bg-blue-100 text-blue-800 border border-blue-300 rounded-pill px-2.5 py-1">
            <i className="bi bi-box-seam me-1"></i> Processing
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="badge bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-pill px-2.5 py-1">
            <i className="bi bi-check2-all me-1"></i> Confirmed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="badge bg-rose-100 text-rose-800 border border-rose-300 rounded-pill px-2.5 py-1">
            Cancelled
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="badge bg-purple-100 text-purple-800 border border-purple-200 rounded-pill px-2.5 py-1">
            Refunded
          </span>
        );
      default:
        return (
          <span className="badge bg-slate-100 text-slate-700 border border-slate-300 rounded-pill px-2.5 py-1">
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="container-fluid py-4 px-lg-5">
      {/* Page Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-primary bg-opacity-10 text-primary px-2.5 py-1 fw-bold text-xs rounded-pill">
              Admin Order Lifecycle
            </span>
            <span className="text-muted small">Server-Side Verified Payment Checks</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900">Order Management</h2>
          <p className="text-muted small mb-0" style={{ maxWidth: '680px' }}>
            Inspect customer orders, track payments verified directly through Chapa, enforce controlled fulfillment status transitions, and audit every administrative action.
          </p>
        </div>
        <button onClick={fetchOrders} className="btn btn-outline-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2">
          <i className="bi bi-arrow-clockwise"></i> Refresh Orders
        </button>
      </div>

      {/* Global Feedback Banner */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-4 small shadow-sm mb-4`} role="alert">
          <i className="bi bi-info-circle-fill me-2"></i>
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Filter Toolbar Card */}
      <div className="card border-0 shadow-sm rounded-4 p-3.5 bg-white mb-4">
        <div className="row g-2.5 align-items-center">
          {/* Search bar */}
          <div className="col-lg-3 col-md-6">
            <label className="form-label text-[11px] fw-bold text-muted text-uppercase mb-1">Search Reference / Customer</label>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-end-0 rounded-start-pill ps-3">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control bg-light border-start-0"
                placeholder="Order #, tx_ref, customer, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit(e)}
              />
            </div>
          </div>

          {/* Payment Status filter */}
          <div className="col-lg-2 col-md-6">
            <label className="form-label text-[11px] fw-bold text-muted text-uppercase mb-1">Payment Status</label>
            <select
              className="form-select form-select-sm rounded-pill"
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
            >
              <option value="">All Payment Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid / Verified</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          {/* Fulfillment Status filter */}
          <div className="col-lg-2 col-md-6">
            <label className="form-label text-[11px] fw-bold text-muted text-uppercase mb-1">Fulfillment Status</label>
            <select
              className="form-select form-select-sm rounded-pill"
              value={fulfillmentStatusFilter}
              onChange={(e) => setFulfillmentStatusFilter(e.target.value)}
            >
              <option value="">All Fulfillment Stages</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          {/* Date Range: From */}
          <div className="col-lg-2 col-md-3">
            <label className="form-label text-[11px] fw-bold text-muted text-uppercase mb-1">From Date</label>
            <input
              type="date"
              className="form-control form-control-sm rounded-pill"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          {/* Date Range: To */}
          <div className="col-lg-2 col-md-3">
            <label className="form-label text-[11px] fw-bold text-muted text-uppercase mb-1">To Date</label>
            <input
              type="date"
              className="form-control form-control-sm rounded-pill"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {/* Reset button */}
          <div className="col-lg-1 col-12 d-flex align-items-end">
            <button
              onClick={handleResetFilters}
              className="btn btn-sm btn-light border rounded-pill w-100"
              title="Reset all filters"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table Card */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
        <div className="p-3.5 border-bottom bg-slate-50 d-flex justify-content-between align-items-center">
          <span className="fw-bold text-slate-800 small">
            Order Registry ({orders.length})
          </span>
          <span className="text-muted text-xs">
            <i className="bi bi-clock-history me-1"></i> Ordered chronologically
          </span>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted small mt-2">Loading orders registry...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-5 text-muted small">
            <i className="bi bi-box-seam fs-1 text-slate-300 d-block mb-2"></i>
            No orders match the selected filters.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-sm">
              <thead className="table-light text-slate-600 text-xs text-uppercase">
                <tr>
                  <th className="ps-4">Order Reference</th>
                  <th>Customer Information</th>
                  <th>Ordered Items</th>
                  <th>Total (ETB)</th>
                  <th>Payment Status</th>
                  <th>Fulfillment Status</th>
                  <th>Order Date</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((ord) => (
                  <tr key={ord.id}>
                    {/* Order Reference */}
                    <td className="ps-4">
                      <div className="fw-bold font-monospace text-slate-900">{ord.order_number}</div>
                      {ord.chapa_tx_ref ? (
                        <div className="text-slate-400 font-monospace text-[10px] text-truncate" style={{ maxWidth: '170px' }} title={ord.chapa_tx_ref}>
                          <i className="bi bi-link-45deg me-0.5"></i>{ord.chapa_tx_ref}
                        </div>
                      ) : (
                        <small className="text-muted text-[10px]">No gateway ref</small>
                      )}
                    </td>

                    {/* Customer Info */}
                    <td>
                      <div className="fw-semibold text-slate-900">
                        {ord.shipping_name || ord.customer_name}
                      </div>
                      <div className="text-muted text-xs">{ord.customer_email}</div>
                      {ord.shipping_phone && (
                        <div className="text-slate-500 text-[11px]"><i className="bi bi-telephone me-1"></i>{ord.shipping_phone}</div>
                      )}
                    </td>

                    {/* Ordered Items */}
                    <td>
                      <div className="fw-semibold text-slate-800">{ord.items?.length || 0} product(s)</div>
                      <div className="text-muted text-[11px] text-truncate" style={{ maxWidth: '160px' }}>
                        {(ord.items || []).map((it) => it.product_name).join(', ')}
                      </div>
                    </td>

                    {/* Total Amount */}
                    <td className="fw-bold text-primary font-monospace">
                      {formatETB(ord.total_amount)}
                    </td>

                    {/* Payment Status */}
                    <td>
                      {renderPaymentBadge(ord.payment_status || (ord.status === 'PROCESSING' ? 'PAID' : 'PENDING'))}
                    </td>

                    {/* Fulfillment Status */}
                    <td>
                      {renderFulfillmentBadge(ord.fulfillment_status || ord.status)}
                    </td>

                    {/* Order Date */}
                    <td>
                      <div className="text-xs text-slate-700">
                        <div>{new Date(ord.created_at).toLocaleDateString()}</div>
                        <div className="text-muted">{new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </td>

                    {/* Action Button */}
                    <td className="text-end pe-4">
                      <button
                        className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold text-xs d-inline-flex align-items-center gap-1.5"
                        onClick={() => setSelectedOrder(ord)}
                      >
                        <i className="bi bi-sliders"></i> Manage Order
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Management & Verification Modal */}
      {selectedOrder && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1040 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content rounded-4 border-0 shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="modal-header border-bottom px-4 py-3 bg-slate-900 text-white">
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <h5 className="modal-title fw-bold text-white mb-0">
                      Order #{selectedOrder.order_number}
                    </h5>
                    {renderPaymentBadge(selectedOrder.payment_status || (selectedOrder.status === 'PROCESSING' ? 'PAID' : 'PENDING'))}
                    {renderFulfillmentBadge(selectedOrder.fulfillment_status || selectedOrder.status)}
                  </div>
                  <small className="text-slate-300">
                    Placed on {new Date(selectedOrder.created_at).toLocaleString()} by {selectedOrder.customer_name} ({selectedOrder.customer_email})
                  </small>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setSelectedOrder(null);
                    setVerificationReport(null);
                  }}
                ></button>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-slate-50">
                <div className="row g-4">
                  {/* Left Column: Payment Verification Section (Section 6 Requirements) */}
                  <div className="col-lg-6">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
                      <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                        <h6 className="fw-bold text-slate-900 mb-0 d-flex align-items-center gap-2">
                          <i className="bi bi-credit-card-2-front text-primary"></i>
                          Admin Payment Verification Section
                        </h6>
                        <span className="badge bg-slate-100 text-slate-700 border text-[11px]">
                          Gateway: {selectedOrder.payment_method || 'CHAPA'}
                        </span>
                      </div>

                      {/* Discrepancy Alert (if flagged) */}
                      {(selectedOrder.last_verification_result === 'MISMATCH_DETECTED' || selectedOrder.verification_mismatch_message) && (
                        <div className="alert alert-danger rounded-3 small p-3 mb-3">
                          <div className="fw-bold mb-1">
                            <i className="bi bi-exclamation-triangle-fill me-1"></i> Discrepancy Flagged
                          </div>
                          <div>{selectedOrder.verification_mismatch_message}</div>
                        </div>
                      )}

                      {/* Verification Key-Value Grid */}
                      <div className="p-3 bg-light rounded-3 border mb-3 small">
                        <div className="row g-2">
                          <div className="col-6">
                            <span className="text-muted d-block text-[11px] text-uppercase">Order Reference:</span>
                            <span className="fw-bold font-monospace text-slate-900">{selectedOrder.order_number}</span>
                          </div>
                          <div className="col-6">
                            <span className="text-muted d-block text-[11px] text-uppercase">Payment Tx Ref:</span>
                            <span className="font-monospace text-slate-900 text-xs text-truncate d-block" title={selectedOrder.chapa_tx_ref}>
                              {selectedOrder.chapa_tx_ref || 'None assigned'}
                            </span>
                          </div>
                          <div className="col-6">
                            <span className="text-muted d-block text-[11px] text-uppercase">Expected Order Amount:</span>
                            <span className="fw-bold text-primary fs-6">{formatETB(selectedOrder.total_amount)}</span>
                          </div>
                          <div className="col-6">
                            <span className="text-muted d-block text-[11px] text-uppercase">Verified Gateway Amount:</span>
                            <span className="fw-bold text-success fs-6">
                              {selectedOrder.verified_amount ? formatETB(selectedOrder.verified_amount) : 'Not verified yet'}
                            </span>
                          </div>
                          <div className="col-6">
                            <span className="text-muted d-block text-[11px] text-uppercase">Currency:</span>
                            <span className="fw-semibold text-slate-800">{selectedOrder.currency || 'ETB'}</span>
                          </div>
                          <div className="col-6">
                            <span className="text-muted d-block text-[11px] text-uppercase">Current Payment State:</span>
                            <span className="fw-semibold text-slate-800">{selectedOrder.payment_status || 'PENDING'}</span>
                          </div>
                          <div className="col-6">
                            <span className="text-muted d-block text-[11px] text-uppercase">Payment Initiated:</span>
                            <span className="text-slate-700 text-xs">
                              {selectedOrder.payment_initiated_at ? new Date(selectedOrder.payment_initiated_at).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                          <div className="col-6">
                            <span className="text-muted d-block text-[11px] text-uppercase">Verification Time:</span>
                            <span className="text-slate-700 text-xs">
                              {selectedOrder.payment_verified_at ? new Date(selectedOrder.payment_verified_at).toLocaleString() : 'Pending confirmation'}
                            </span>
                          </div>
                          <div className="col-12">
                            <span className="text-muted d-block text-[11px] text-uppercase">Last Verification Result:</span>
                            <span className={`fw-bold text-xs ${
                              selectedOrder.last_verification_result === 'VERIFIED_MATCH'
                                ? 'text-success'
                                : selectedOrder.last_verification_result === 'MISMATCH_DETECTED'
                                ? 'text-danger'
                                : 'text-slate-600'
                            }`}>
                              {selectedOrder.last_verification_result || 'Never verified'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Verify Action Button */}
                      <div className="mt-auto">
                        <button
                          className="btn btn-primary w-100 rounded-pill fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 py-2"
                          onClick={() => handleVerifyWithChapa(selectedOrder.id)}
                          disabled={verifyingChapa}
                        >
                          {verifyingChapa ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status"></span>
                              Cross-Checking with Chapa API...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-shield-check"></i> Verify Payment with Chapa Gateway
                            </>
                          )}
                        </button>
                        <small className="text-muted text-[11px] text-center d-block mt-1.5">
                          Queries the official Chapa server-to-server endpoint and compares amount/currency authenticity.
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Controlled Fulfillment Transitions & Audit History */}
                  <div className="col-lg-6">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
                      <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                        <h6 className="fw-bold text-slate-900 mb-0 d-flex align-items-center gap-2">
                          <i className="bi bi-arrow-right-circle text-primary"></i>
                          Controlled Fulfillment Workflow
                        </h6>
                        <span className="badge bg-light text-dark border text-[11px]">
                          Stage: {selectedOrder.fulfillment_status || selectedOrder.status}
                        </span>
                      </div>

                      {/* Controlled Action Buttons Sequence */}
                      <div className="mb-3">
                        <label className="form-label text-xs fw-bold text-slate-800 text-uppercase mb-2">
                          Allowed Next Transitions:
                        </label>
                        <div className="d-flex flex-wrap gap-2">
                          {/* Pending -> Confirmed */}
                          <button
                            className="btn btn-sm btn-outline-primary rounded-pill px-3"
                            onClick={() => initiateStatusTransition('CONFIRMED')}
                            disabled={selectedOrder.fulfillment_status === 'CONFIRMED' || selectedOrder.fulfillment_status === 'DELIVERED'}
                          >
                            <i className="bi bi-check-lg me-1"></i> Mark Confirmed
                          </button>

                          {/* Confirmed -> Processing */}
                          <button
                            className="btn btn-sm btn-outline-info rounded-pill px-3"
                            onClick={() => initiateStatusTransition('PROCESSING')}
                            disabled={selectedOrder.fulfillment_status === 'PROCESSING' || selectedOrder.fulfillment_status === 'DELIVERED'}
                          >
                            <i className="bi bi-box-seam me-1"></i> Start Processing
                          </button>

                          {/* Processing -> Shipped */}
                          <button
                            className="btn btn-sm btn-outline-cyan rounded-pill px-3 text-cyan-800 border-cyan-400"
                            onClick={() => initiateStatusTransition('SHIPPED')}
                            disabled={selectedOrder.fulfillment_status === 'SHIPPED' || selectedOrder.fulfillment_status === 'DELIVERED'}
                          >
                            <i className="bi bi-truck me-1"></i> Dispatch / Shipped
                          </button>

                          {/* Shipped -> Delivered */}
                          <button
                            className="btn btn-sm btn-outline-success rounded-pill px-3"
                            onClick={() => initiateStatusTransition('DELIVERED')}
                            disabled={selectedOrder.fulfillment_status === 'DELIVERED'}
                          >
                            <i className="bi bi-house-check me-1"></i> Mark Delivered
                          </button>

                          {/* Cancellation */}
                          <button
                            className="btn btn-sm btn-outline-danger rounded-pill px-3"
                            onClick={() => initiateStatusTransition('CANCELLED')}
                            disabled={selectedOrder.fulfillment_status === 'CANCELLED' || selectedOrder.fulfillment_status === 'DELIVERED'}
                          >
                            <i className="bi bi-x-circle me-1"></i> Cancel Order
                          </button>

                          {/* Refund */}
                          <button
                            className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                            onClick={() => initiateStatusTransition('REFUNDED')}
                            disabled={selectedOrder.fulfillment_status === 'REFUNDED'}
                          >
                            <i className="bi bi-arrow-counterclockwise me-1"></i> Process Refund
                          </button>
                        </div>
                      </div>

                      {/* Shipping & Delivery Details */}
                      <div className="p-3 bg-light rounded-3 border mb-3 small">
                        <span className="fw-bold text-slate-800 text-xs d-block mb-1">Delivery Address & Contact:</span>
                        <div className="text-slate-700">
                          <strong>{selectedOrder.shipping_name}</strong> • Phone: {selectedOrder.shipping_phone}
                        </div>
                        <div className="text-muted text-xs">
                          {selectedOrder.shipping_address}, {selectedOrder.shipping_city}
                        </div>
                        {selectedOrder.notes && (
                          <div className="text-slate-600 text-[11px] mt-1 fst-italic">
                            Instructions: "{selectedOrder.notes}"
                          </div>
                        )}
                      </div>

                      {/* Audit Log / Order Status History Timeline */}
                      <div className="mt-2">
                        <h6 className="fw-bold text-slate-900 text-xs text-uppercase mb-2">
                          <i className="bi bi-journal-text me-1"></i> Administrative Audit Trail
                        </h6>
                        <div
                          className="border rounded-3 p-2 bg-light overflow-auto"
                          style={{ maxHeight: '150px' }}
                        >
                          {selectedOrder.status_history && selectedOrder.status_history.length > 0 ? (
                            selectedOrder.status_history.map((h) => (
                              <div key={h.id} className="text-[11px] border-bottom border-slate-200 py-1">
                                <span className="text-muted">
                                  {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •
                                </span>{' '}
                                <strong className="text-slate-800">{h.status_type}:</strong>{' '}
                                <span className="badge bg-secondary bg-opacity-10 text-secondary border px-1.5 py-0.5">
                                  {h.previous_status}
                                </span>{' '}
                                &rarr;{' '}
                                <span className="badge bg-primary bg-opacity-10 text-primary border px-1.5 py-0.5">
                                  {h.new_status}
                                </span>{' '}
                                <span className="text-slate-500">by {h.changed_by_username || 'System'}</span>
                                {h.comment && <div className="text-slate-600 fst-italic ps-2">{h.comment}</div>}
                              </div>
                            ))
                          ) : (
                            <div className="text-muted text-xs text-center py-2">
                              No previous status transitions recorded yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order Items Breakdown Table */}
                  <div className="col-12">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white">
                      <h6 className="fw-bold text-slate-900 mb-2 small text-uppercase">
                        Purchased Products & Quantities ({selectedOrder.items?.length || 0})
                      </h6>
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0 text-xs">
                          <thead className="table-light text-slate-600">
                            <tr>
                              <th>Product</th>
                              <th>Quantity</th>
                              <th>Unit Price</th>
                              <th>Total Amount</th>
                              <th>Warranty Policy</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedOrder.items || []).map((it, idx) => (
                              <tr key={idx}>
                                <td>
                                  <span className="fw-bold text-slate-900">{it.product_name}</span>
                                </td>
                                <td>{it.quantity}</td>
                                <td>{formatETB(it.unit_price)}</td>
                                <td className="fw-bold text-slate-900">{formatETB(it.total_price)}</td>
                                <td>
                                  <span className="badge bg-light text-dark border">
                                    {it.warranty_duration_days} Days Guarantee
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-footer border-top px-4 py-3 bg-white d-flex justify-content-between">
                <div>
                  {selectedOrder.receipt && (
                    <Link
                      to={`/receipts/${selectedOrder.id}`}
                      target="_blank"
                      className="btn btn-outline-success btn-sm rounded-pill px-3"
                    >
                      <i className="bi bi-receipt me-1"></i> View Official Digital Receipt
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-light rounded-pill px-4 border"
                  onClick={() => {
                    setSelectedOrder(null);
                    setVerificationReport(null);
                  }}
                >
                  Close Modal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controlled Status Transition Confirmation Modal */}
      {showStatusConfirmModal && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-2xl">
              <div className="modal-header border-bottom px-4 py-3 bg-slate-50">
                <h6 className="modal-title fw-bold text-slate-900 mb-0">
                  Confirm Status Change &rarr; {statusUpdateTarget}
                </h6>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowStatusConfirmModal(false)}
                ></button>
              </div>

              <div className="modal-body p-4">
                <p className="text-slate-700 text-sm mb-3">
                  You are about to change the fulfillment status of Order <strong>#{selectedOrder?.order_number}</strong> to <strong>{statusUpdateTarget}</strong>.
                  The customer will automatically receive an in-app order notification.
                </p>

                {/* Unpaid Warning if advancing to confirmed/processing/shipped/delivered */}
                {selectedOrder?.payment_status !== 'PAID' && ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(statusUpdateTarget) && (
                  <div className="alert alert-warning rounded-3 small mb-3">
                    <div className="fw-bold mb-1">
                      <i className="bi bi-shield-exclamation me-1"></i> Payment Not Verified Yet
                    </div>
                    <div>
                      This order is currently unpaid. Advancing fulfillment requires a verified Chapa payment record or an authorized audit reconciliation note.
                    </div>
                    <div className="mt-2">
                      <label className="form-label text-[11px] fw-bold text-dark text-uppercase">
                        Reconciliation Audit Note (Required for Unpaid Orders):
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. Authorized by Store GM after manual phone verification"
                        value={reconciliationNote}
                        onChange={(e) => setReconciliationNote(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Optional Admin Comment */}
                <div className="mb-2">
                  <label className="form-label text-xs fw-bold text-slate-800">
                    Administrative Notes / Tracking Comment (Optional):
                  </label>
                  <textarea
                    className="form-control form-control-sm"
                    rows="2"
                    placeholder="e.g. Courier tracking reference, package inspected and handed over..."
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer border-top px-4 py-3 bg-slate-50 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-light rounded-pill px-3 border"
                  onClick={() => setShowStatusConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm"
                  onClick={submitStatusTransition}
                  disabled={processingAction}
                >
                  {processingAction ? 'Updating Status...' : 'Confirm Transition'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerOrdersPage;
