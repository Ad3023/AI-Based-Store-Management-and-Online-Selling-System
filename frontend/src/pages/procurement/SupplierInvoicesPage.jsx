import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';

const SupplierInvoicesPage = () => {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPoId = searchParams.get('po');
  const preselectedSupplierId = searchParams.get('supplier');

  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Record Invoice Modal
  const [showCreateModal, setShowCreateModal] = useState(Boolean(preselectedPoId));
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [formData, setFormData] = useState({
    supplier: preselectedSupplierId || '',
    purchase_order: preselectedPoId || '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    total_amount: '',
    notes: '',
  });

  // Admin Review Modal (Approve / Reject)
  const [reviewModal, setReviewModal] = useState({
    show: false,
    invoice: null,
    action: 'approve',
    notes: '',
  });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Inspector Modal
  const [inspectingInvoice, setInspectingInvoice] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [invRes, supRes, poRes] = await Promise.all([
        api.get('products/supplier-invoices/'),
        api.get('products/suppliers/'),
        api.get('products/purchase-requests/'),
      ]);
      setInvoices(invRes.data.results || invRes.data || []);
      setSuppliers(supRes.data.results || supRes.data || []);
      setPurchaseOrders(poRes.data.results || poRes.data || []);
    } catch (err) {
      console.error('Failed to load supplier invoices:', err);
      setFeedback({ type: 'danger', text: 'Failed to load invoices and procurement data.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When PO is selected in form, auto-fill supplier and amount
  const handleSelectPoInForm = (poId) => {
    const po = purchaseOrders.find((p) => String(p.id) === String(poId));
    if (po) {
      setFormData((prev) => ({
        ...prev,
        purchase_order: poId,
        supplier: po.supplier || prev.supplier,
        total_amount: po.total_estimated_cost || prev.total_amount,
      }));
    } else {
      setFormData((prev) => ({ ...prev, purchase_order: poId }));
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier) {
      alert('Supplier is required.');
      return;
    }
    if (!formData.invoice_number.trim()) {
      alert('Invoice number is required.');
      return;
    }
    if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
      alert('Total invoice amount must be greater than zero.');
      return;
    }

    try {
      setSubmittingInvoice(true);
      const payload = {
        supplier: formData.supplier,
        purchase_order: formData.purchase_order || null,
        invoice_number: formData.invoice_number.trim(),
        invoice_date: formData.invoice_date,
        due_date: formData.due_date || null,
        total_amount: parseFloat(formData.total_amount),
        notes: formData.notes.trim(),
      };

      const res = await api.post('products/supplier-invoices/', payload);
      setFeedback({
        type: 'success',
        text: `Invoice #${res.data.invoice_number} submitted to Admin for payment review!`,
      });

      setShowCreateModal(false);
      setFormData({
        supplier: '',
        purchase_order: '',
        invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        total_amount: '',
        notes: '',
      });
      fetchData();
    } catch (err) {
      console.error('Failed to submit invoice:', err);
      const msg = err.response?.data?.error || 'Failed to submit supplier invoice.';
      alert(msg);
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const handleConfirmReview = async () => {
    const { invoice, action, notes } = reviewModal;
    if (!invoice) return;

    if (action === 'reject' && !notes.trim()) {
      alert('Please provide a rejection reason for the supplier invoice.');
      return;
    }

    try {
      setReviewSubmitting(true);
      await api.post(`products/supplier-invoices/${invoice.id}/review/`, {
        action,
        review_notes: notes.trim(),
      });

      setFeedback({
        type: action === 'approve' ? 'success' : 'warning',
        text: `Invoice #${invoice.invoice_number} was successfully ${action === 'approve' ? 'approved for payment' : 'rejected'}.`,
      });

      setReviewModal({ show: false, invoice: null, action: 'approve', notes: '' });
      setInspectingInvoice(null);
      fetchData();
    } catch (err) {
      console.error('Review decision error:', err);
      alert(err.response?.data?.error || 'Failed to submit review decision.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return <span className="badge bg-warning text-dark border border-warning">Pending Admin Review</span>;
      case 'APPROVED':
        return <span className="badge bg-info text-dark">Approved for Payment</span>;
      case 'PARTIALLY_PAID':
        return <span className="badge bg-primary">Partially Paid</span>;
      case 'PAID':
        return <span className="badge bg-success">Paid / Settled</span>;
      case 'REJECTED':
        return <span className="badge bg-danger">Rejected</span>;
      case 'CANCELLED':
        return <span className="badge bg-dark">Cancelled</span>;
      default:
        return <span className="badge bg-secondary">{status}</span>;
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.supplier_name?.toLowerCase().includes(q) ||
      inv.purchase_order_number?.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = invoices.filter((i) => i.status === 'PENDING_APPROVAL').length;
  const approvedUnpaidCount = invoices.filter(
    (i) => (i.status === 'APPROVED' || i.status === 'PARTIALLY_PAID') && Number(i.outstanding_amount || 0) > 0
  ).length;

  return (
    <div className="pb-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-info border-opacity-25 bg-info bg-opacity-10">
            <i className="bi bi-receipt text-info"></i>
            <span className="small fw-bold text-slate-800">Supplier Invoices &amp; Payables</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Supplier Invoices</h2>
          <p className="text-slate-500 text-xs mb-0">
            Store Managers record invoices against approved purchase orders; Admin verifies amounts and authorizes payment.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-ethio-primary rounded-pill px-4 py-2 font-bold text-xs d-flex align-items-center gap-2 shadow-sm"
          style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
          onClick={() => setShowCreateModal(true)}
        >
          <i className="bi bi-plus-lg"></i>
          <span>Record Supplier Invoice</span>
        </button>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Admin Notice Banner */}
      {(isAdmin || isSuperAdmin) && pendingCount > 0 && (
        <div className="alert alert-warning border-0 shadow-sm rounded-4 p-3 mb-4 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-warning bg-opacity-25 rounded-3 text-warning-emphasis">
              <i className="bi bi-file-earmark-check-fill fs-5"></i>
            </div>
            <div>
              <div className="fw-bold text-sm text-slate-900">
                {pendingCount} Invoice(s) Awaiting Your Review &amp; Payment Approval
              </div>
              <small className="text-slate-600">
                Verify line item quantities and compare against received goods before approving payment.
              </small>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-dark rounded-pill px-3 text-xs"
            onClick={() => setStatusFilter('PENDING_APPROVAL')}
          >
            Review Invoices ({pendingCount})
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
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
                placeholder="Search by invoice #, supplier, PO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-12 col-md-7 col-lg-8">
            <div className="d-flex flex-wrap gap-1 justify-content-md-end">
              {[
                { key: 'ALL', label: 'All Invoices' },
                { key: 'PENDING_APPROVAL', label: `Pending (${pendingCount})` },
                { key: 'APPROVED', label: `Approved (${approvedUnpaidCount})` },
                { key: 'PARTIALLY_PAID', label: 'Partially Paid' },
                { key: 'PAID', label: 'Paid' },
                { key: 'REJECTED', label: 'Rejected' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 text-xs ${
                    statusFilter === tab.key ? 'btn-primary font-bold' : 'btn-outline-secondary'
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

      {/* Invoices Table */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted small mt-2">Loading supplier invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-receipt fs-1 text-slate-300 mb-2 d-block"></i>
            <h6 className="fw-bold text-slate-700">No Invoices Found</h6>
            <p className="text-slate-500 text-xs mb-3">
              {search || statusFilter !== 'ALL'
                ? 'No invoices match the active filter criteria.'
                : 'No supplier invoices have been submitted yet.'}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs"
              onClick={() => setShowCreateModal(true)}
            >
              <i className="bi bi-plus-lg me-1"></i> Record First Invoice
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
                <tr>
                  <th className="ps-4">Invoice # &amp; Date</th>
                  <th>Supplier</th>
                  <th>Related PO</th>
                  <th>Total Amount</th>
                  <th>Paid Amount</th>
                  <th>Outstanding Balance</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const isPending = inv.status === 'PENDING_APPROVAL';
                  const isPayable = (inv.status === 'APPROVED' || inv.status === 'PARTIALLY_PAID') && Number(inv.outstanding_amount || 0) > 0;

                  return (
                    <tr key={inv.id}>
                      <td className="ps-4">
                        <div
                          className="fw-bold text-slate-900 cursor-pointer text-primary hover:underline"
                          onClick={() => setInspectingInvoice(inv)}
                        >
                          #{inv.invoice_number}
                        </div>
                        <small className="text-slate-400 text-[10px]">
                          Dated: {inv.invoice_date}
                        </small>
                      </td>
                      <td>
                        <strong className="text-slate-800">{inv.supplier_name || 'N/A'}</strong>
                      </td>
                      <td>
                        {inv.purchase_order_number ? (
                          <span className="badge bg-light text-primary border">
                            {inv.purchase_order_number}
                          </span>
                        ) : (
                          <span className="text-slate-400">None attached</span>
                        )}
                      </td>
                      <td className="fw-bold text-slate-900">{formatETB(inv.total_amount)}</td>
                      <td className="text-success font-semibold">{formatETB(inv.paid_amount || 0)}</td>
                      <td>
                        <strong className={Number(inv.outstanding_amount || 0) > 0 ? 'text-danger' : 'text-success'}>
                          {formatETB(inv.outstanding_amount || 0)}
                        </strong>
                      </td>
                      <td className="text-slate-600">{inv.due_date || '—'}</td>
                      <td>{renderStatusBadge(inv.status)}</td>
                      <td className="text-end pe-4">
                        <div className="d-flex justify-content-end gap-1">
                          {/* Admin Review Actions */}
                          {(isAdmin || isSuperAdmin) && isPending && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-success px-2 py-1 text-xs rounded-pill"
                                title="Approve for Payment"
                                onClick={() =>
                                  setReviewModal({
                                    show: true,
                                    invoice: inv,
                                    action: 'approve',
                                    notes: '',
                                  })
                                }
                              >
                                <i className="bi bi-check-lg me-1"></i> Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger px-2 py-1 text-xs rounded-pill"
                                title="Reject Invoice"
                                onClick={() =>
                                  setReviewModal({
                                    show: true,
                                    invoice: inv,
                                    action: 'reject',
                                    notes: '',
                                  })
                                }
                              >
                                <i className="bi bi-x-lg me-1"></i> Reject
                              </button>
                            </>
                          )}

                          {/* Admin Record Payment Action */}
                          {(isAdmin || isSuperAdmin) && isPayable && (
                            <Link
                              to={`/admin/procurement/payments?invoice=${inv.id}&supplier=${inv.supplier}`}
                              className="btn btn-sm btn-primary px-2.5 py-1 text-xs rounded-pill"
                              title="Authorize & Record Supplier Disbursement"
                            >
                              <i className="bi bi-credit-card-2-front me-1"></i> Pay
                            </Link>
                          )}

                          {/* Inspect Details */}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary px-2 py-1 text-xs rounded-pill"
                            title="Inspect Invoice Details"
                            onClick={() => setInspectingInvoice(inv)}
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

      {/* Record Invoice Modal */}
      {showCreateModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4">
              <form onSubmit={handleCreateSubmit}>
                <div className="modal-header border-bottom border-slate-100 pb-3">
                  <h5 className="modal-title fw-bold text-sm text-slate-900">
                    Record Supplier Invoice
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
                </div>

                <div className="modal-body p-4 text-xs">
                  {/* Notice */}
                  <div className="alert alert-info py-2 px-3 text-[11px] mb-3">
                    <i className="bi bi-info-circle me-1"></i>
                    Invoices are submitted for Admin verification and payment approval. Store Managers cannot authorize disbursements.
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold text-slate-700">Select Supplier *</label>
                    <select
                      className="form-select text-xs"
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Supplier --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold text-slate-700">Attach Related Purchase Order (Optional)</label>
                    <select
                      className="form-select text-xs"
                      value={formData.purchase_order}
                      onChange={(e) => handleSelectPoInForm(e.target.value)}
                    >
                      <option value="">-- No Specific PO --</option>
                      {purchaseOrders
                        .filter((p) => !formData.supplier || String(p.supplier) === String(formData.supplier))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.request_number} - {p.supplier_name} ({formatETB(p.total_estimated_cost)}) [{p.status}]
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Supplier Invoice Number *</label>
                      <input
                        type="text"
                        className="form-control text-xs"
                        placeholder="e.g. INV-90423"
                        value={formData.invoice_number}
                        onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Total Invoice Amount (ETB) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="form-control text-xs"
                        placeholder="0.00"
                        value={formData.total_amount}
                        onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Invoice Date *</label>
                      <input
                        type="date"
                        className="form-control text-xs"
                        value={formData.invoice_date}
                        onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Payment Due Date</label>
                      <input
                        type="date"
                        className="form-control text-xs"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label text-xs fw-bold text-slate-700">Invoice Notes / Payment Terms</label>
                    <textarea
                      className="form-control text-xs"
                      rows="2"
                      placeholder="e.g. Verified against warehouse stock receipt. Net 15 days bank transfer terms."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer border-top p-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-ethio-primary rounded-pill px-4 font-bold"
                    style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
                    disabled={submittingInvoice}
                  >
                    {submittingInvoice ? 'Submitting...' : 'Submit to Admin for Approval'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Admin Review Modal */}
      {reviewModal.show && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4">
              <div className={`modal-header ${reviewModal.action === 'approve' ? 'bg-success' : 'bg-danger'} text-white pb-3`}>
                <h5 className="modal-title fw-bold text-sm text-white">
                  {reviewModal.action === 'approve' ? 'Approve Invoice for Payment' : 'Reject Supplier Invoice'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setReviewModal({ show: false, invoice: null, action: 'approve', notes: '' })}
                ></button>
              </div>

              <div className="modal-body p-4 text-xs">
                <div className="mb-3">
                  <span className="text-muted d-block">Invoice Details:</span>
                  <strong className="fs-6 text-slate-900">#{reviewModal.invoice?.invoice_number}</strong>
                  <div className="text-slate-600 mt-1">
                    Supplier: <strong>{reviewModal.invoice?.supplier_name}</strong> | Amount:{' '}
                    <strong className="text-primary">{formatETB(reviewModal.invoice?.total_amount)}</strong>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label text-xs fw-bold text-slate-700">
                    {reviewModal.action === 'approve'
                      ? 'Approval Notes (Optional):'
                      : 'Rejection Reason (Required): *'}
                  </label>
                  <textarea
                    className="form-control text-xs"
                    rows="3"
                    placeholder={
                      reviewModal.action === 'approve'
                        ? 'e.g. Invoice matches delivery receipt note and approved PO.'
                        : 'e.g. Discrepancy between invoiced amount and quantities received.'
                    }
                    value={reviewModal.notes}
                    onChange={(e) => setReviewModal({ ...reviewModal, notes: e.target.value })}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer border-top p-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                  onClick={() => setReviewModal({ show: false, invoice: null, action: 'approve', notes: '' })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${reviewModal.action === 'approve' ? 'btn-success' : 'btn-danger'} rounded-pill px-4 font-bold`}
                  disabled={reviewSubmitting}
                  onClick={handleConfirmReview}
                >
                  {reviewSubmitting
                    ? 'Processing...'
                    : reviewModal.action === 'approve'
                    ? 'Authorize for Payment'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Invoice Modal */}
      {inspectingInvoice && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4">
              <div className="modal-header bg-slate-900 text-white pb-3">
                <h5 className="modal-title fw-bold text-white text-sm">
                  Invoice Details: #{inspectingInvoice.invoice_number}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setInspectingInvoice(null)}
                ></button>
              </div>

              <div className="modal-body p-4 text-xs bg-slate-50">
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <span className="text-muted d-block">Supplier:</span>
                    <strong className="text-slate-900 fs-6">{inspectingInvoice.supplier_name}</strong>
                  </div>
                  <div className="col-6">
                    <span className="text-muted d-block">Status:</span>
                    <div className="mt-1">{renderStatusBadge(inspectingInvoice.status)}</div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-3 border mb-3">
                  <div className="row g-2">
                    <div className="col-4 text-center">
                      <span className="text-muted d-block text-[10px] uppercase font-bold">Total Invoiced</span>
                      <strong className="text-primary">{formatETB(inspectingInvoice.total_amount)}</strong>
                    </div>
                    <div className="col-4 text-center">
                      <span className="text-muted d-block text-[10px] uppercase font-bold">Amount Paid</span>
                      <strong className="text-success">{formatETB(inspectingInvoice.paid_amount || 0)}</strong>
                    </div>
                    <div className="col-4 text-center">
                      <span className="text-muted d-block text-[10px] uppercase font-bold">Outstanding</span>
                      <strong className="text-danger">{formatETB(inspectingInvoice.outstanding_amount || 0)}</strong>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm rounded-3 p-3 bg-white mb-2">
                  <div className="row g-2">
                    <div className="col-6">
                      <span className="text-muted d-block">Related PO:</span>
                      <strong>{inspectingInvoice.purchase_order_number || 'None'}</strong>
                    </div>
                    <div className="col-6">
                      <span className="text-muted d-block">Due Date:</span>
                      <strong>{inspectingInvoice.due_date || 'Not specified'}</strong>
                    </div>
                    <div className="col-6">
                      <span className="text-muted d-block">Submitted By:</span>
                      <strong>{inspectingInvoice.submitted_by_username || 'Staff'}</strong>
                    </div>
                    <div className="col-6">
                      <span className="text-muted d-block">Reviewed By:</span>
                      <strong>{inspectingInvoice.reviewed_by_username || 'Pending Review'}</strong>
                    </div>
                  </div>

                  {inspectingInvoice.review_notes && (
                    <div className="mt-2 p-2 bg-light rounded text-[11px]">
                      <strong>Review Comments:</strong> {inspectingInvoice.review_notes}
                    </div>
                  )}

                  {inspectingInvoice.notes && (
                    <div className="mt-2 text-[11px] text-slate-600">
                      <strong>Notes:</strong> {inspectingInvoice.notes}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer border-top bg-white p-3 d-flex justify-content-between">
                <div>
                  {(isAdmin || isSuperAdmin) && (inspectingInvoice.status === 'APPROVED' || inspectingInvoice.status === 'PARTIALLY_PAID') && Number(inspectingInvoice.outstanding_amount || 0) > 0 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary rounded-pill px-3"
                      onClick={() => {
                        const inv = inspectingInvoice;
                        setInspectingInvoice(null);
                        navigate(`/admin/procurement/payments?invoice=${inv.id}&supplier=${inv.supplier}`);
                      }}
                    >
                      <i className="bi bi-credit-card-2-front me-1"></i> Authorize Payment
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary rounded-pill px-4"
                  onClick={() => setInspectingInvoice(null)}
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

export default SupplierInvoicesPage;
