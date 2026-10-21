import React, { useState, useEffect } from 'react';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const ManagerOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Order for Review/Verification Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const url = statusFilter ? `orders/?status=${statusFilter}` : 'orders/';
      const res = await api.get(url);
      setOrders(res.data.results || res.data || []);
    } catch (err) {
      console.error("Manager orders error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleVerify = async (action) => {
    if (!selectedOrder) return;
    if (action === 'reject' && !rejectionReason.trim()) {
      alert("Please provide a rejection reason so the customer can correct it.");
      return;
    }

    try {
      setProcessingAction(true);
      const res = await api.post(`orders/${selectedOrder.id}/verify-payment/`, {
        action,
        reason: rejectionReason
      });

      setFeedback({
        type: action === 'approve' ? 'success' : 'warning',
        text: `Order #${selectedOrder.order_number} has been ${action === 'approve' ? 'verified & approved' : 'rejected'}. Customer notified.`
      });

      setSelectedOrder(null);
      setRejectionReason('');
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || "Action failed.");
    } finally {
      setProcessingAction(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await api.patch(`orders/${orderId}/status/`, { status: newStatus });
      setFeedback({ type: 'success', text: `Order status updated to ${newStatus}.` });
      fetchOrders();
    } catch (err) {
      alert("Failed to update status.");
    }
  };

  const statusTabs = [
    { label: 'All Orders', value: '' },
    { label: 'Pending Payment', value: 'PENDING_PAYMENT' },
    { label: 'Under Review', value: 'PAYMENT_SUBMITTED' },
    { label: 'Verified & Processing', value: 'PROCESSING' },
    { label: 'Shipped', value: 'SHIPPED' },
    { label: 'Delivered', value: 'DELIVERED' },
  ];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bolder mb-1 text-dark">Payment Verification & Orders</h2>
          <p className="text-muted small mb-0">Review customer bank receipts, approve transactions, and update shipping lifecycle</p>
        </div>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 mb-4`} role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="card border-0 shadow-sm rounded-4 p-2 mb-4">
        <ul className="nav nav-pills small">
          {statusTabs.map((tab) => (
            <li className="nav-item" key={tab.value}>
              <button
                className={`nav-link rounded-pill px-3 py-2 fw-semibold ${
                  statusFilter === tab.value ? 'active bg-primary' : 'text-secondary'
                }`}
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Orders Table */}
      <div className="card border-0 shadow-sm rounded-4 p-4">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-5 text-muted small">
            No orders found under this status.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light text-uppercase small text-muted" style={{ fontSize: '0.72rem' }}>
                <tr>
                  <th>Order No.</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Payment Status</th>
                  <th>Order Lifecycle</th>
                  <th className="text-end">Verification & Actions</th>
                </tr>
              </thead>
              <tbody className="small">
                {orders.map((ord) => (
                  <tr key={ord.id}>
                    <td>
                      <span className="fw-bold text-dark">{ord.order_number}</span>
                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                        {ord.items?.length || 0} items
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">{ord.shipping_name || ord.customer_name}</div>
                      <small className="text-muted">{ord.customer_email}</small>
                    </td>
                    <td className="text-muted">{new Date(ord.created_at).toLocaleDateString()}</td>
                    <td className="fw-bold text-primary">{formatETB(ord.total_amount)}</td>
                    <td>
                      {ord.payment_evidence ? (
                        <span className={`badge rounded-pill ${
                          ord.payment_evidence.verification_status === 'APPROVED'
                            ? 'badge-status-approved'
                            : ord.payment_evidence.verification_status === 'REJECTED'
                            ? 'badge-status-rejected'
                            : 'badge-status-submitted'
                        }`}>
                          {ord.payment_evidence.verification_status}
                        </span>
                      ) : (
                        <span className="badge bg-light text-muted border">No Evidence</span>
                      )}
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm rounded-pill"
                        style={{ width: '150px', fontSize: '0.78rem' }}
                        value={ord.status}
                        onChange={(e) => handleStatusChange(ord.id, e.target.value)}
                      >
                        <option value="PENDING_PAYMENT">Pending Payment</option>
                        <option value="PAYMENT_SUBMITTED">Under Review</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="SHIPPED">Shipped</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </td>
                    <td className="text-end">
                      {ord.payment_evidence ? (
                        <button
                          className="btn btn-sm btn-outline-primary rounded-pill px-3"
                          onClick={() => setSelectedOrder(ord)}
                        >
                          <i className="bi bi-eye me-1"></i> Review Evidence
                        </button>
                      ) : (
                        <span className="text-muted small">Awaiting Upload</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Payment Evidence Modal */}
      {selectedOrder && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-2xl p-2">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">
                  Payment Verification: Order #{selectedOrder.order_number}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedOrder(null)}
                ></button>
              </div>

              <div className="modal-body">
                <div className="row g-4">
                  {/* Evidence Image */}
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted">Uploaded Transfer Screenshot:</label>
                    <div
                      className="rounded-3 p-2 bg-light border text-center d-flex align-items-center justify-content-center"
                      style={{ minHeight: '260px' }}
                    >
                      {selectedOrder.payment_evidence?.evidence_image ? (
                        <img
                          src={selectedOrder.payment_evidence.evidence_image}
                          alt="Evidence"
                          className="img-fluid rounded"
                          style={{ maxHeight: '280px', objectFit: 'contain' }}
                        />
                      ) : (
                        <div className="text-muted small">
                          <i className="bi bi-image fs-1 d-block mb-1"></i>
                          Reference only, image file not attached.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transaction Metadata */}
                  <div className="col-md-6">
                    <div className="p-3 rounded-3 bg-light border mb-3 small">
                      <div className="mb-2">
                        <span className="text-muted">Customer:</span>
                        <strong className="text-dark ms-2">{selectedOrder.customer_name} ({selectedOrder.customer_email})</strong>
                      </div>
                      <div className="mb-2">
                        <span className="text-muted">Order Amount:</span>
                        <strong className="text-primary fs-5 ms-2">{formatETB(selectedOrder.total_amount)}</strong>
                      </div>
                      <div className="mb-2">
                        <span className="text-muted">Bank Channel:</span>
                        <span className="badge bg-light text-dark border ms-2">
                          {selectedOrder.payment_evidence?.payment_method}
                        </span>
                      </div>
                      <div className="mb-2">
                        <span className="text-muted">Transaction Reference:</span>
                        <code className="fs-6 ms-2 text-dark">{selectedOrder.payment_evidence?.transaction_reference}</code>
                      </div>
                      <div>
                        <span className="text-muted">Submitted At:</span>
                        <span className="ms-2">{new Date(selectedOrder.payment_evidence?.submitted_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Rejection reason input */}
                    <div className="mb-3">
                      <label className="form-label small fw-bold text-danger">Rejection Reason (if rejecting):</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. Transaction ID not found in CBE statement"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-success flex-grow-1 rounded-pill fw-bold"
                        onClick={() => handleVerify('approve')}
                        disabled={processingAction}
                      >
                        <i className="bi bi-check-circle-fill me-1"></i> Approve & Issue Receipt
                      </button>
                      <button
                        className="btn btn-outline-danger flex-grow-1 rounded-pill fw-bold"
                        onClick={() => handleVerify('reject')}
                        disabled={processingAction}
                      >
                        <i className="bi bi-x-circle-fill me-1"></i> Reject Evidence
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerOrdersPage;
