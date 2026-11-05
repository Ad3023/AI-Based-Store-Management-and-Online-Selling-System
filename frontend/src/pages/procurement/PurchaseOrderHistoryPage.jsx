import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import POFilterBar from './components/POFilterBar';
import POTableRow from './components/POTableRow';
import POInspectorModal from './components/POInspectorModal';
import PODecisionModal from './components/PODecisionModal';
import POSendSupplierModal from './components/POSendSupplierModal';

const PurchaseOrderHistoryPage = ({ adminApprovalMode = false }) => {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(adminApprovalMode ? 'PENDING_APPROVAL' : 'ALL');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [inspectingOrder, setInspectingOrder] = useState(null);
  const [decisionModal, setDecisionModal] = useState({ show: false, order: null, action: 'approve', feedbackText: '' });
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [sendSupplierModal, setSendSupplierModal] = useState({ show: false, order: null, notes: '' });
  const [sendSubmitting, setSendSubmitting] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('products/purchase-requests/');
      setOrders(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
      setFeedback({ type: 'danger', text: 'Failed to load purchase orders.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleConfirmDecision = async () => {
    const { order, action, feedbackText } = decisionModal;
    if (!order) return;
    if (action === 'reject' && !feedbackText.trim()) {
      alert('A rejection reason is required.');
      return;
    }
    try {
      setDecisionSubmitting(true);
      await api.patch(`products/purchase-requests/${order.id}/`, {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED', admin_feedback: feedbackText.trim()
      });
      setFeedback({ type: action === 'approve' ? 'success' : 'warning', text: `PO ${order.request_number} was ${action}d.` });
      setDecisionModal({ show: false, order: null, action: 'approve', feedbackText: '' });
      setInspectingOrder(null);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit decision.');
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const handleConfirmSendToSupplier = async () => {
    const { order, notes } = sendSupplierModal;
    if (!order) return;
    try {
      setSendSubmitting(true);
      await api.post(`products/purchase-requests/${order.id}/send-to-supplier/`, { supplier_confirmation_notes: notes.trim() });
      setFeedback({ type: 'success', text: `PO ${order.request_number} marked as sent to supplier.` });
      setSendSupplierModal({ show: false, order: null, notes: '' });
      setInspectingOrder(null);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to dispatch purchase order.');
    } finally {
      setSendSubmitting(false);
    }
  };

  const handleSubmitDraft = async (order) => {
    if (!window.confirm(`Submit PO ${order.request_number} for financial approval?`)) return;
    try {
      await api.patch(`products/purchase-requests/${order.id}/`, { status: 'PENDING_APPROVAL' });
      setFeedback({ type: 'success', text: `PO ${order.request_number} submitted to Admin.` });
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit draft.');
    }
  };

  const filteredOrders = orders.filter((po) => {
    const q = search.toLowerCase();
    const matchQ = !q || po.request_number?.toLowerCase().includes(q) || po.supplier_name?.toLowerCase().includes(q) || po.product_name?.toLowerCase().includes(q);
    const matchS = statusFilter === 'PENDING_APPROVAL' ? (po.status === 'PENDING_APPROVAL' || po.status === 'SUBMITTED') : statusFilter === 'ALL' ? true : po.status === statusFilter;
    return matchQ && matchS;
  });

  const pendingCount = orders.filter(o => o.status === 'PENDING_APPROVAL' || o.status === 'SUBMITTED').length;

  return (
    <div className="pb-5">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-info border-opacity-25 bg-info bg-opacity-10">
            <i className={`bi ${adminApprovalMode ? 'bi-shield-check text-warning' : 'bi-clock-history text-info'}`}></i>
            <span className="small fw-bold text-slate-800">{adminApprovalMode ? 'Admin Financial Control' : 'Store Purchasing History'}</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">{adminApprovalMode ? 'Purchase Order Approvals' : 'Purchase Order History'}</h2>
          <p className="text-slate-500 text-xs mb-0">Track store purchase requisitions, approvals, and deliveries.</p>
        </div>
        {!adminApprovalMode && (
          <Link to="/manager/procurement/purchase-orders/create" className="btn btn-ethio-primary rounded-pill px-4 py-2 font-bold text-xs d-flex align-items-center gap-2 shadow-sm" style={{ backgroundColor: '#1b64da', color: '#ffffff' }}>
            <i className="bi bi-plus-lg"></i><span>Create Purchase Order</span>
          </Link>
        )}
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm`} role="alert">
          {feedback.text}<button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      <POFilterBar search={search} onSearchChange={setSearch} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} pendingCount={pendingCount} />

      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div><p className="text-muted small mt-2">Loading orders...</p></div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 text-slate-300 mb-2 d-block"></i>
            <h6 className="fw-bold text-slate-700">No Purchase Orders Found</h6>
            <p className="text-slate-500 text-xs mb-3">{statusFilter !== 'ALL' || search ? 'No orders match filters.' : 'No purchase orders recorded yet.'}</p>
            {!adminApprovalMode && (
              <Link to="/manager/procurement/purchase-orders/create" className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs">
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
                {filteredOrders.map((po) => (
                  <POTableRow key={po.id} po={po} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} onInspect={setInspectingOrder} onOpenDecision={(ord, action) => setDecisionModal({ show: true, order: ord, action, feedbackText: '' })} onSubmitDraft={handleSubmitDraft} onSendToSupplier={(ord) => setSendSupplierModal({ show: true, order: ord, notes: 'Sent to supplier.' })} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <POInspectorModal order={inspectingOrder} onClose={() => setInspectingOrder(null)} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} onOpenDecision={(action) => { const ord = inspectingOrder; setInspectingOrder(null); setDecisionModal({ show: true, order: ord, action, feedbackText: '' }); }} />
      <PODecisionModal modal={{ ...decisionModal, setFeedbackText: (txt) => setDecisionModal(m => ({ ...m, feedbackText: txt })) }} onClose={() => setDecisionModal({ show: false, order: null, action: 'approve', feedbackText: '' })} onConfirm={handleConfirmDecision} submitting={decisionSubmitting} />
      <POSendSupplierModal modal={{ ...sendSupplierModal, setNotes: (txt) => setSendSupplierModal(m => ({ ...m, notes: txt })) }} onClose={() => setSendSupplierModal({ show: false, order: null, notes: '' })} onConfirm={handleConfirmSendToSupplier} submitting={sendSubmitting} />
    </div>
  );
};

export default PurchaseOrderHistoryPage;
