import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';

const PurchaseOrderHistoryPage = ({ adminApprovalMode = false }) => {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(adminApprovalMode ? 'PENDING_APPROVAL' : 'ALL');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Inspector Modal
  const [inspectingOrder, setInspectingOrder] = useState(null);

  // Admin Approval / Rejection Modal
  const [decisionModal, setDecisionModal] = useState({
    show: false,
    order: null,
    action: 'approve', // 'approve' or 'reject'
    feedbackText: ''
  });
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);

  // Store Manager Send to Supplier Modal
  const [sendSupplierModal, setSendSupplierModal] = useState({
    show: false,
    order: null,
    notes: ''
  });
  const [sendSubmitting, setSendSubmitting] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('products/purchase-requests/');
      const list = res.data.results || res.data || [];
      setOrders(list);
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
      setFeedback({ type: 'danger', text: 'Failed to load purchase orders from server.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle Admin Decision (Approve / Reject)
  const handleConfirmDecision = async () => {
    const { order, action, feedbackText } = decisionModal;
    if (!order) return;

    if (action === 'reject' && !feedbackText.trim()) {
      alert('A rejection reason is required so the Store Manager knows why it was not approved.');
      return;
    }

    try {
      setDecisionSubmitting(true);
      const targetStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
      const payload = {
        status: targetStatus,
        admin_feedback: feedbackText.trim()
      };

      await api.patch(`products/purchase-requests/${order.id}/`, payload);
      setFeedback({
        type: action === 'approve' ? 'success' : 'warning',
        text: `Purchase Order ${order.request_number} was successfully ${action === 'approve' ? 'approved' : 'rejected'}.`
      });

      setDecisionModal({ show: false, order: null, action: 'approve', feedbackText: '' });
      setInspectingOrder(null);
      fetchOrders();
    } catch (err) {
      console.error('Failed to record purchase order decision:', err);
      const msg = err.response?.data?.error || 'Failed to submit decision.';
      alert(msg);
    } finally {
      setDecisionSubmitting(false);
    }
  };

  // Handle Store Manager Send to Supplier
  const handleConfirmSendToSupplier = async () => {
    const { order, notes } = sendSupplierModal;
    if (!order) return;

    try {
      setSendSubmitting(true);
      await api.post(`products/purchase-requests/${order.id}/send-to-supplier/`, {
        supplier_confirmation_notes: notes.trim()
      });

      setFeedback({
        type: 'success',
        text: `Purchase Order ${order.request_number} marked as sent to ${order.supplier_name}.`
      });

      setSendSupplierModal({ show: false, order: null, notes: '' });
      setInspectingOrder(null);
      fetchOrders();
    } catch (err) {
      console.error('Failed to dispatch purchase order:', err);
      alert(err.response?.data?.error || 'Failed to dispatch purchase order.');
    } finally {
      setSendSubmitting(false);
    }
  };

  // Handle Store Manager Submit Draft for Approval
  const handleSubmitDraft = async (order) => {
    if (!window.confirm(`Submit Purchase Order ${order.request_number} to Admin for financial approval?`)) {
      return;
    }
    try {
      await api.patch(`products/purchase-requests/${order.id}/`, {
        status: 'PENDING_APPROVAL'
      });
      setFeedback({
        type: 'success',
        text: `Purchase Order ${order.request_number} submitted to Admin for approval!`
      });
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit draft.');
    }
  };

  // Status Styling Badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <span className="badge bg-secondary">Draft</span>;
      case 'PENDING_APPROVAL':
      case 'SUBMITTED':
        return <span className="badge bg-warning text-dark border border-warning">Pending Approval</span>;
      case 'APPROVED':
        return <span className="badge bg-success">Approved</span>;
      case 'SENT_TO_SUPPLIER':
        return <span className="badge bg-info text-dark">Sent to Supplier</span>;
      case 'PARTIALLY_RECEIVED':
        return <span className="badge bg-primary">Partially Received</span>;
      case 'RECEIVED':
        return <span className="badge bg-success">Received / Complete</span>;
      case 'REJECTED':
        return <span className="badge bg-danger">Rejected</span>;
      case 'CANCELLED':
        return <span className="badge bg-dark">Cancelled</span>;
      default:
        return <span className="badge bg-secondary">{status}</span>;
    }
  };

  const filteredOrders = orders.filter((po) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      po.request_number?.toLowerCase().includes(q) ||
      po.supplier_name?.toLowerCase().includes(q) ||
      po.product_name?.toLowerCase().includes(q);

    let matchesStatus = true;
    if (statusFilter === 'PENDING_APPROVAL') {
      matchesStatus = po.status === 'PENDING_APPROVAL' || po.status === 'SUBMITTED';
    } else if (statusFilter !== 'ALL') {
      matchesStatus = po.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const pendingApprovalsCount = orders.filter(
    (o) => o.status === 'PENDING_APPROVAL' || o.status === 'SUBMITTED'
  ).length;

  return (
    <div className="pb-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-info border-opacity-25 bg-info bg-opacity-10">
            <i className={`bi ${adminApprovalMode ? 'bi-shield-check text-warning' : 'bi-clock-history text-info'}`}></i>
            <span className="small fw-bold text-slate-800">
              {adminApprovalMode ? 'Admin Financial Control' : 'Store Purchasing History'}
            </span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">
            {adminApprovalMode ? 'Purchase Order Approvals' : 'Purchase Order History'}
          </h2>
          <p className="text-slate-500 text-xs mb-0">
            {adminApprovalMode
              ? 'Review quantities, prices, and supplier commitments submitted by the Store Manager before ordering.'
              : 'Track store purchase requisitions, Admin approvals, supplier communications, and delivery progress.'}
          </p>
        </div>

        {!adminApprovalMode && (
          <Link
            to="/manager/procurement/purchase-orders/create"
            className="btn btn-ethio-primary rounded-pill px-4 py-2 font-bold text-xs d-flex align-items-center gap-2 shadow-sm"
            style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
          >
            <i className="bi bi-plus-lg"></i>
            <span>Create Purchase Order</span>
          </Link>
        )}
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Admin Pending Review Banner */}
      {adminApprovalMode && pendingApprovalsCount > 0 && (
        <div className="alert alert-warning border-0 shadow-sm rounded-4 p-3 mb-4 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-warning bg-opacity-25 rounded-3 text-warning-emphasis">
              <i className="bi bi-exclamation-triangle-fill fs-5"></i>
            </div>
            <div>
              <div className="fw-bold text-sm text-slate-900">
                {pendingApprovalsCount} Purchase Order(s) Awaiting Your Review
              </div>
              <small className="text-slate-600">
                Store Managers cannot place orders with suppliers until you grant financial approval.
              </small>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-dark rounded-pill px-3 text-xs"
            onClick={() => setStatusFilter('PENDING_APPROVAL')}
          >
            View Pending Approvals ({pendingApprovalsCount})
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-5 col-lg-4">
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control text-sm"
                placeholder="Search by PO #, supplier, product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-12 col-md-7 col-lg-8">
            <div className="d-flex flex-wrap gap-1 justify-content-md-end">
              {[
                { key: 'ALL', label: 'All Orders' },
                { key: 'PENDING_APPROVAL', label: `Pending (${pendingApprovalsCount})` },
                { key: 'APPROVED', label: 'Approved' },
                { key: 'SENT_TO_SUPPLIER', label: 'Sent' },
                { key: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
                { key: 'RECEIVED', label: 'Received' },
                { key: 'DRAFT', label: 'Drafts' },
                { key: 'REJECTED', label: 'Rejected' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 text-xs ${
                    statusFilter === tab.key
                      ? 'btn-primary font-bold'
                      : 'btn-outline-secondary'
                  }`}
                  onClick={() => setStatusFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Orders Table */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted small mt-2">Loading purchase orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 text-slate-300 mb-2 d-block"></i>
            <h6 className="fw-bold text-slate-700">No Purchase Orders Found</h6>
            <p className="text-slate-500 text-xs mb-3">
              {statusFilter !== 'ALL' || search
                ? 'No purchase orders match the active filter criteria.'
                : 'No purchase orders recorded yet.'}
            </p>
            {!adminApprovalMode && (
              <Link
                to="/manager/procurement/purchase-orders/create"
                className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs"
              >
                <i className="bi bi-plus-lg me-1"></i> Create First Purchase Order
              </Link>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
                <tr>
                  <th className="ps-4">PO Number &amp; Date</th>
                  <th>Supplier</th>
                  <th>Items &amp; Units</th>
                  <th>Total Cost</th>
                  <th>Target Delivery</th>
                  <th>Status</th>
                  <th>Admin Feedback</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((po) => {
                  const isPending = po.status === 'PENDING_APPROVAL' || po.status === 'SUBMITTED';
                  const isApproved = po.status === 'APPROVED';
                  const isSent = po.status === 'SENT_TO_SUPPLIER';
                  const isReceivable = isApproved || isSent || po.status === 'PARTIALLY_RECEIVED';

                  return (
                    <tr key={po.id}>
                      <td className="ps-4">
                        <div
                          className="fw-bold text-primary cursor-pointer hover:underline"
                          onClick={() => setInspectingOrder(po)}
                        >
                          {po.request_number}
                        </div>
                        <small className="text-slate-400 text-[11px] d-block">
                          {new Date(po.created_at).toLocaleDateString()} by {po.requested_by_username || 'Staff'}
                        </small>
                      </td>
                      <td>
                        <div className="fw-semibold text-slate-900">{po.supplier_name || 'N/A'}</div>
                        {po.supplier_phone && <small className="text-slate-400 text-[10px]">{po.supplier_phone}</small>}
                      </td>
                      <td>
                        <div className="text-slate-800">
                          {po.items?.length > 1
                            ? `${po.items.length} product lines (${po.quantity} pcs)`
                            : `${po.product_name || 'Product'} (${po.quantity} pcs)`}
                        </div>
                        {po.received_quantity > 0 && (
                          <small className="text-success text-[10px] d-block">
                            Received: {po.received_quantity} / {po.quantity} pcs
                          </small>
                        )}
                      </td>
                      <td className="fw-bolder text-slate-900">
                        {formatETB(po.total_estimated_cost)}
                      </td>
                      <td className="text-slate-600">
                        {po.expected_supply_date || <span className="text-slate-400">—</span>}
                      </td>
                      <td>{renderStatusBadge(po.status)}</td>
                      <td>
                        {po.admin_feedback ? (
                          <span className="text-truncate d-inline-block text-slate-600" style={{ maxWidth: '160px' }} title={po.admin_feedback}>
                            {po.admin_feedback}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="text-end pe-4">
                        <div className="d-flex justify-content-end gap-1">
                          {/* Admin Review Action */}
                          {(isAdmin || isSuperAdmin) && isPending && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-success px-2.5 py-1 text-xs rounded-pill"
                                title="Approve Purchase Order"
                                onClick={() =>
                                  setDecisionModal({
                                    show: true,
                                    order: po,
                                    action: 'approve',
                                    feedbackText: ''
                                  })
                                }
                              >
                                <i className="bi bi-check-lg me-1"></i> Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger px-2.5 py-1 text-xs rounded-pill"
                                title="Reject Purchase Order"
                                onClick={() =>
                                  setDecisionModal({
                                    show: true,
                                    order: po,
                                    action: 'reject',
                                    feedbackText: ''
                                  })
                                }
                              >
                                <i className="bi bi-x-lg me-1"></i> Reject
                              </button>
                            </>
                          )}

                          {/* Store Manager Draft Submit */}
                          {!isAdmin && po.status === 'DRAFT' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary px-2 py-1 text-xs rounded-pill"
                              title="Submit Draft for Approval"
                              onClick={() => handleSubmitDraft(po)}
                            >
                              <i className="bi bi-send me-1"></i> Submit
                            </button>
                          )}

                          {/* Store Manager Send to Supplier */}
                          {!isAdmin && isApproved && (
                            <button
                              type="button"
                              className="btn btn-sm btn-info text-dark px-2.5 py-1 text-xs rounded-pill"
                              title="Dispatch to Supplier"
                              onClick={() =>
                                setSendSupplierModal({
                                  show: true,
                                  order: po,
                                  notes: 'Dispatched via supplier procurement portal / email.'
                                })
                              }
                            >
                              <i className="bi bi-truck me-1"></i> Send to Supplier
                            </button>
                          )}

                          {/* Store Manager Receive Stock */}
                          {!isAdmin && isReceivable && po.received_quantity < po.quantity && (
                            <Link
                              to={`/manager/procurement/receive?po=${po.id}`}
                              className="btn btn-sm btn-outline-success px-2 py-1 text-xs rounded-pill"
                              title="Record Physical Stock Receiving"
                            >
                              <i className="bi bi-box-arrow-in-down me-1"></i> Receive
                            </Link>
                          )}

                          {/* Store Manager Record Invoice */}
                          {!isAdmin && isReceivable && (
                            <Link
                              to={`/manager/procurement/invoices?po=${po.id}&supplier=${po.supplier}`}
                              className="btn btn-sm btn-outline-secondary px-2 py-1 text-xs rounded-pill"
                              title="Submit Supplier Invoice"
                            >
                              <i className="bi bi-receipt"></i>
                            </Link>
                          )}

                          {/* Inspect Details Button */}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary px-2 py-1 text-xs rounded-pill"
                            title="Inspect Details"
                            onClick={() => setInspectingOrder(po)}
                          >
                            <i className="bi bi-eye"></i>
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

      {/* PO Inspector Modal */}
      {inspectingOrder && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-2xl rounded-4">
              <div className="modal-header bg-slate-900 text-white pb-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 rounded-3 bg-primary bg-opacity-25 text-white">
                    <i className="bi bi-receipt-cutoff fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-white text-sm mb-0">
                      Purchase Order: {inspectingOrder.request_number}
                    </h5>
                    <small className="text-slate-400 text-xs">
                      Supplier: {inspectingOrder.supplier_name}
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setInspectingOrder(null)}
                ></button>
              </div>

              <div className="modal-body p-4 bg-slate-50 text-xs">
                {/* Status & Summary Cards */}
                <div className="row g-2 mb-4">
                  <div className="col-4">
                    <div className="p-3 bg-white rounded-3 border text-center">
                      <span className="text-muted d-block text-[10px] uppercase font-bold">Status</span>
                      <div className="mt-1">{renderStatusBadge(inspectingOrder.status)}</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="p-3 bg-white rounded-3 border text-center">
                      <span className="text-muted d-block text-[10px] uppercase font-bold">Total Cost</span>
                      <h5 className="fw-bolder text-primary mb-0 mt-1">{formatETB(inspectingOrder.total_estimated_cost)}</h5>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="p-3 bg-white rounded-3 border text-center">
                      <span className="text-muted d-block text-[10px] uppercase font-bold">Received Units</span>
                      <h5 className="fw-bolder text-success mb-0 mt-1">
                        {inspectingOrder.received_quantity} / {inspectingOrder.quantity}
                      </h5>
                    </div>
                  </div>
                </div>

                {/* Audit & Routing Metadata */}
                <div className="card border-0 shadow-sm rounded-3 p-3 mb-4 bg-white">
                  <h6 className="fw-bold text-slate-800 text-xs mb-2">Audit &amp; Authorization Timeline</h6>
                  <div className="row g-2">
                    <div className="col-6 col-md-3">
                      <span className="text-muted d-block">Requested By:</span>
                      <strong className="text-slate-800">{inspectingOrder.requested_by_username || 'Staff'}</strong>
                    </div>
                    <div className="col-6 col-md-3">
                      <span className="text-muted d-block">Creation Date:</span>
                      <strong className="text-slate-800">{new Date(inspectingOrder.created_at).toLocaleString()}</strong>
                    </div>
                    <div className="col-6 col-md-3">
                      <span className="text-muted d-block">Approved By:</span>
                      <strong className="text-slate-800">{inspectingOrder.approved_by_username || 'Pending Admin'}</strong>
                    </div>
                    <div className="col-6 col-md-3">
                      <span className="text-muted d-block">Expected Delivery:</span>
                      <strong className="text-slate-800">{inspectingOrder.expected_supply_date || 'Not specified'}</strong>
                    </div>
                  </div>

                  {inspectingOrder.admin_feedback && (
                    <div className="mt-3 p-2 rounded-2 bg-light border border-slate-200">
                      <strong className="text-slate-700 d-block">Admin Decision Comments:</strong>
                      <span className="text-slate-600">{inspectingOrder.admin_feedback}</span>
                    </div>
                  )}

                  {inspectingOrder.supplier_confirmation_notes && (
                    <div className="mt-2 p-2 rounded-2 bg-info bg-opacity-10 border border-info border-opacity-25">
                      <strong className="text-cyan-900 d-block">Supplier Confirmation:</strong>
                      <span className="text-cyan-800">{inspectingOrder.supplier_confirmation_notes}</span>
                    </div>
                  )}

                  {inspectingOrder.notes && (
                    <div className="mt-2">
                      <span className="text-muted d-block">Store Manager Notes:</span>
                      <p className="mb-0 text-slate-700">{inspectingOrder.notes}</p>
                    </div>
                  )}
                </div>

                {/* Products Line Items */}
                <h6 className="fw-bold text-slate-800 text-xs mb-2">Replenishment Line Items</h6>
                <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white mb-3">
                  <div className="table-responsive">
                    <table className="table table-bordered align-middle mb-0 text-xs">
                      <thead className="table-light">
                        <tr>
                          <th>Product</th>
                          <th className="text-center">Ordered</th>
                          <th className="text-center">Received</th>
                          <th className="text-center">Damaged</th>
                          <th className="text-end">Unit Price</th>
                          <th className="text-end">Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspectingOrder.items && inspectingOrder.items.length > 0 ? (
                          inspectingOrder.items.map((it) => (
                            <tr key={it.id}>
                              <td className="fw-semibold text-slate-900">{it.product_name}</td>
                              <td className="text-center">{it.quantity}</td>
                              <td className="text-center text-success font-bold">{it.received_quantity}</td>
                              <td className="text-center text-danger">{it.damaged_quantity}</td>
                              <td className="text-end">{formatETB(it.unit_price)}</td>
                              <td className="text-end fw-bold text-slate-900">{formatETB(it.total_cost)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="fw-semibold text-slate-900">{inspectingOrder.product_name || 'Item'}</td>
                            <td className="text-center">{inspectingOrder.quantity}</td>
                            <td className="text-center text-success font-bold">{inspectingOrder.received_quantity}</td>
                            <td className="text-center text-danger">{inspectingOrder.damaged_quantity}</td>
                            <td className="text-end">{formatETB(inspectingOrder.estimated_unit_cost)}</td>
                            <td className="text-end fw-bold text-slate-900">{formatETB(inspectingOrder.total_estimated_cost)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="modal-footer border-top bg-white p-3 d-flex justify-content-between">
                <div>
                  {(isAdmin || isSuperAdmin) && (inspectingOrder.status === 'PENDING_APPROVAL' || inspectingOrder.status === 'SUBMITTED') && (
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-success rounded-pill px-3"
                        onClick={() => {
                          const ord = inspectingOrder;
                          setInspectingOrder(null);
                          setDecisionModal({ show: true, order: ord, action: 'approve', feedbackText: '' });
                        }}
                      >
                        <i className="bi bi-check-lg me-1"></i> Approve PO
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger rounded-pill px-3"
                        onClick={() => {
                          const ord = inspectingOrder;
                          setInspectingOrder(null);
                          setDecisionModal({ show: true, order: ord, action: 'reject', feedbackText: '' });
                        }}
                      >
                        <i className="bi bi-x-lg me-1"></i> Reject PO
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-secondary rounded-pill px-4"
                  onClick={() => setInspectingOrder(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Approval / Rejection Decision Modal */}
      {decisionModal.show && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4">
              <div className={`modal-header ${decisionModal.action === 'approve' ? 'bg-success' : 'bg-danger'} text-white pb-3`}>
                <h5 className="modal-title fw-bold text-sm text-white">
                  {decisionModal.action === 'approve' ? 'Approve Purchase Order' : 'Reject Purchase Order'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setDecisionModal({ show: false, order: null, action: 'approve', feedbackText: '' })}
                ></button>
              </div>
              <div className="modal-body p-4 text-xs">
                <div className="mb-3">
                  <span className="text-muted d-block">Purchase Order:</span>
                  <strong className="fs-6 text-slate-900">{decisionModal.order?.request_number}</strong>
                  <div className="text-slate-600 mt-1">
                    Supplier: <strong>{decisionModal.order?.supplier_name}</strong> | Total Cost:{' '}
                    <strong className="text-primary">{formatETB(decisionModal.order?.total_estimated_cost)}</strong>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label text-xs fw-bold text-slate-700">
                    {decisionModal.action === 'approve'
                      ? 'Approval Comments / Conditions (Optional):'
                      : 'Rejection Reason (Required): *'}
                  </label>
                  <textarea
                    className="form-control text-xs"
                    rows="3"
                    placeholder={
                      decisionModal.action === 'approve'
                        ? 'e.g. Approved within Q4 hardware procurement allocation.'
                        : 'e.g. Unit prices are higher than negotiated quote; please renegotiate.'
                    }
                    value={decisionModal.feedbackText}
                    onChange={(e) => setDecisionModal({ ...decisionModal, feedbackText: e.target.value })}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer border-top p-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                  onClick={() => setDecisionModal({ show: false, order: null, action: 'approve', feedbackText: '' })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${decisionModal.action === 'approve' ? 'btn-success' : 'btn-danger'} rounded-pill px-4 font-bold`}
                  disabled={decisionSubmitting}
                  onClick={handleConfirmDecision}
                >
                  {decisionSubmitting
                    ? 'Recording...'
                    : decisionModal.action === 'approve'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Store Manager Send to Supplier Modal */}
      {sendSupplierModal.show && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4">
              <div className="modal-header bg-info text-dark pb-3">
                <h5 className="modal-title fw-bold text-sm">Send Order to Supplier</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSendSupplierModal({ show: false, order: null, notes: '' })}
                ></button>
              </div>
              <div className="modal-body p-4 text-xs">
                <p className="text-slate-600 mb-3">
                  Confirm that Purchase Order <strong>{sendSupplierModal.order?.request_number}</strong> has been communicated
                  to <strong>{sendSupplierModal.order?.supplier_name}</strong>.
                </p>
                <div className="mb-2">
                  <label className="form-label text-xs fw-bold text-slate-700">Supplier Confirmation Notes / Courier Dispatch Ref:</label>
                  <textarea
                    className="form-control text-xs"
                    rows="3"
                    placeholder="e.g. Supplier accepted order via email. Expected to deliver to warehouse dock Friday morning."
                    value={sendSupplierModal.notes}
                    onChange={(e) => setSendSupplierModal({ ...sendSupplierModal, notes: e.target.value })}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer border-top p-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                  onClick={() => setSendSupplierModal({ show: false, order: null, notes: '' })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-info text-dark rounded-pill px-4 font-bold"
                  disabled={sendSubmitting}
                  onClick={handleConfirmSendToSupplier}
                >
                  {sendSubmitting ? 'Recording...' : 'Mark as Sent to Supplier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderHistoryPage;
