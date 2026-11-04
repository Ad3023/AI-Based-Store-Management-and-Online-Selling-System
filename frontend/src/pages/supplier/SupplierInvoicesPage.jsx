import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const SupplierInvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    purchase_order: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    total_amount: '',
    notes: '',
  });
  const [attachmentFile, setAttachmentFile] = useState(null);

  // Selected Invoice Detail
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [invRes, poRes] = await Promise.all([
        api.get('supplier/invoices/'),
        api.get('supplier/purchase-orders/'),
      ]);
      const invList = invRes.data.results || invRes.data || [];
      const poList = poRes.data.results || poRes.data || [];
      setInvoices(invList);
      setPurchaseOrders(poList);
    } catch (err) {
      console.error('Failed to load supplier invoices:', err);
      setFeedback({ type: 'danger', text: 'Failed to load invoices and purchase orders.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Invoice calculations
  const totalInvoiced = useMemo(
    () => invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0),
    [invoices]
  );
  const totalPaid = useMemo(
    () => invoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0),
    [invoices]
  );
  const totalOutstanding = totalInvoiced - totalPaid;

  // Filtered List
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchSearch =
        (inv.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.purchase_order_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.notes || '').toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      if (statusFilter !== 'ALL') {
        return (inv.status || '').toUpperCase() === statusFilter.toUpperCase();
      }
      return true;
    });
  }, [invoices, search, statusFilter]);

  const handleOpenUpload = () => {
    setFormData({
      purchase_order: '',
      invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +14 days default
      total_amount: '',
      notes: '',
    });
    setAttachmentFile(null);
    setShowUploadModal(true);
  };

  const handlePOSelectChange = (poId) => {
    setFormData((prev) => {
      const selectedPO = purchaseOrders.find((p) => p.id === parseInt(poId, 10));
      return {
        ...prev,
        purchase_order: poId,
        total_amount: selectedPO ? selectedPO.total_cost || '' : prev.total_amount,
      };
    });
  };

  const handleSubmitInvoice = async (e) => {
    e.preventDefault();

    if (!formData.purchase_order) {
      alert('Please link this invoice to a purchase order.');
      return;
    }
    if (!formData.invoice_number.trim()) {
      alert('Invoice number is required.');
      return;
    }
    if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
      alert('Please enter a valid invoice amount.');
      return;
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('purchase_order', formData.purchase_order);
      data.append('invoice_number', formData.invoice_number);
      data.append('invoice_date', formData.invoice_date);
      if (formData.due_date) data.append('due_date', formData.due_date);
      data.append('total_amount', formData.total_amount);
      if (formData.notes) data.append('notes', formData.notes);
      if (attachmentFile) {
        data.append('attachment', attachmentFile);
      }

      const res = await api.post('supplier/invoices/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setFeedback({ type: 'success', text: `Invoice ${formData.invoice_number} submitted to Admin for payment review.` });
      setShowUploadModal(false);
      await fetchData();
    } catch (err) {
      console.error('Failed to submit invoice:', err);
      const msg = err.response?.data?.error || err.response?.data?.invoice_number?.[0] || 'Failed to submit invoice.';
      alert(`Error: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PAID':
        return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i className="bi bi-check-circle me-1"></i>Paid</span>;
      case 'APPROVED':
        return <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1"><i className="bi bi-patch-check me-1"></i>Approved for Payment</span>;
      case 'PARTIALLY_PAID':
        return <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1"><i className="bi bi-pie-chart me-1"></i>Partially Paid</span>;
      case 'SUBMITTED':
      case 'DRAFT':
        return <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-2 py-1"><i className="bi bi-hourglass-split me-1"></i>Pending Admin Approval</span>;
      case 'REJECTED':
        return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1"><i className="bi bi-x-circle me-1"></i>Rejected</span>;
      default:
        return <span className="badge bg-secondary bg-opacity-10 text-secondary px-2 py-1">{status}</span>;
    }
  };

  return (
    <div className="container-fluid px-0">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bolder text-slate-900 mb-1">
            <i className="bi bi-receipt-cutoff me-2 text-teal-600"></i>
            Supplier Invoices &amp; Billing
          </h4>
          <p className="text-slate-500 text-xs mb-0">
            Submit formal billing invoices against fulfilled purchase orders and track payment disbursements.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-teal text-white rounded-pill px-3 py-1.5 text-xs font-semibold shadow-sm"
            style={{ backgroundColor: '#0d9488' }}
            onClick={handleOpenUpload}
          >
            <i className="bi bi-plus-lg me-1"></i> Submit New Invoice
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-4 text-xs py-2.5 px-3 mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close p-2.5" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
            <span className="text-xs text-slate-500 uppercase fw-semibold">Total Invoiced</span>
            <div className="fs-4 fw-bolder text-slate-900 my-1">{formatETB(totalInvoiced)}</div>
            <div className="text-[11px] text-slate-400">{invoices.length} invoices submitted</div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-emerald-500">
            <span className="text-xs text-emerald-700 uppercase fw-semibold">Total Disbursed / Paid</span>
            <div className="fs-4 fw-bolder text-emerald-600 my-1">{formatETB(totalPaid)}</div>
            <div className="text-[11px] text-slate-400">Processed by Admin Finance</div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-amber-500">
            <span className="text-xs text-amber-700 uppercase fw-semibold">Outstanding Balance</span>
            <div className="fs-4 fw-bolder text-amber-700 my-1">{formatETB(totalOutstanding)}</div>
            <div className="text-[11px] text-slate-400">Awaiting clearance or review</div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
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
                placeholder="Search by invoice #, PO #, or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-12 col-md-4">
            <select
              className="form-select text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Pending Admin Approval</option>
              <option value="APPROVED">Approved for Payment</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Fully Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div className="col-auto ms-auto text-xs text-slate-500">
            Showing <strong className="text-slate-900">{filteredInvoices.length}</strong> invoices
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-teal-600" role="status" style={{ color: '#0d9488' }}></div>
            <p className="text-muted small mt-2">Loading invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-receipt fs-1 text-slate-300 mb-2 d-block"></i>
            <h6 className="fw-bold text-slate-700">No Invoices Found</h6>
            <p className="text-slate-500 text-xs mb-3">
              {search || statusFilter !== 'ALL'
                ? 'No invoices match your active filters.'
                : 'You have not submitted any invoices yet.'}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-outline-teal rounded-pill px-3 text-xs"
              style={{ borderColor: '#0d9488', color: '#0d9488' }}
              onClick={handleOpenUpload}
            >
              <i className="bi bi-plus-lg me-1"></i> Submit Invoice
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
                <tr>
                  <th className="ps-4">Invoice #</th>
                  <th>PO Reference</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th>Total Amount</th>
                  <th>Paid Amount</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="ps-4 font-monospace fw-bold text-slate-900">
                      {inv.invoice_number}
                      {inv.attachment && (
                        <i className="bi bi-paperclip ms-1 text-teal-600" title="Attachment attached"></i>
                      )}
                    </td>
                    <td className="font-monospace text-slate-700">
                      {inv.purchase_order_number || `PO-${inv.purchase_order}`}
                    </td>
                    <td className="text-slate-600">
                      {inv.invoice_date || '—'}
                    </td>
                    <td className="text-slate-600">
                      {inv.due_date || '—'}
                    </td>
                    <td className="fw-bold text-slate-900">
                      {formatETB(inv.total_amount || 0)}
                    </td>
                    <td className="fw-semibold text-emerald-600">
                      {formatETB(inv.paid_amount || 0)}
                    </td>
                    <td>
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="text-end pe-4">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1 text-xs"
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <i className="bi bi-eye me-1"></i> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit Invoice Modal */}
      {showUploadModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              <div className="modal-header bg-slate-900 text-white py-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-3 p-1.5 bg-teal-600 text-white">
                    <i className="bi bi-receipt fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-white mb-0">Submit Supplier Invoice</h5>
                    <small className="text-slate-400 text-xs">EthioTech Market Finance &amp; Procurement</small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowUploadModal(false)}
                ></button>
              </div>

              <form onSubmit={handleSubmitInvoice}>
                <div className="modal-body p-4 bg-slate-50">
                  <div className="row g-3">
                    {/* Link to Purchase Order */}
                    <div className="col-12">
                      <label className="form-label text-xs fw-semibold text-slate-700">
                        Link to Purchase Order *
                      </label>
                      <select
                        className="form-select text-xs"
                        value={formData.purchase_order}
                        onChange={(e) => handlePOSelectChange(e.target.value)}
                        required
                      >
                        <option value="">-- Select an active / approved Purchase Order --</option>
                        {purchaseOrders.map((po) => (
                          <option key={po.id} value={po.id}>
                            {po.request_number || `PO-${po.id}`} — {po.status} — {formatETB(po.total_cost || 0)} (Issued: {new Date(po.created_at).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                      <small className="text-slate-500 text-[11px]">
                        Select the purchase order that corresponds to these delivered goods.
                      </small>
                    </div>

                    {/* Invoice Number */}
                    <div className="col-12 col-md-6">
                      <label className="form-label text-xs fw-semibold text-slate-700">
                        Your Invoice Number *
                      </label>
                      <input
                        type="text"
                        className="form-control text-xs font-monospace"
                        placeholder="e.g., INV-2026-0012"
                        value={formData.invoice_number}
                        onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                        required
                      />
                    </div>

                    {/* Total Amount */}
                    <div className="col-12 col-md-6">
                      <label className="form-label text-xs fw-semibold text-slate-700">
                        Total Invoice Amount (ETB) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control text-xs fw-bold"
                        placeholder="0.00"
                        value={formData.total_amount}
                        onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                        required
                      />
                    </div>

                    {/* Invoice Date */}
                    <div className="col-12 col-md-6">
                      <label className="form-label text-xs fw-semibold text-slate-700">
                        Invoice Date *
                      </label>
                      <input
                        type="date"
                        className="form-control text-xs"
                        value={formData.invoice_date}
                        onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                        required
                      />
                    </div>

                    {/* Due Date */}
                    <div className="col-12 col-md-6">
                      <label className="form-label text-xs fw-semibold text-slate-700">
                        Payment Due Date
                      </label>
                      <input
                        type="date"
                        className="form-control text-xs"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      />
                    </div>

                    {/* File Attachment */}
                    <div className="col-12">
                      <label className="form-label text-xs fw-semibold text-slate-700">
                        Attach Formal Invoice Document (PDF, PNG, JPG)
                      </label>
                      <input
                        type="file"
                        className="form-control text-xs"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        onChange={(e) => setAttachmentFile(e.target.files[0] || null)}
                      />
                      <small className="text-slate-400 text-[11px]">
                        Upload a signed or stamped copy of your commercial invoice.
                      </small>
                    </div>

                    {/* Notes / Bank Details */}
                    <div className="col-12">
                      <label className="form-label text-xs fw-semibold text-slate-700">
                        Notes / Bank Payment Instructions
                      </label>
                      <textarea
                        className="form-control text-xs"
                        rows="3"
                        placeholder="Specify preferred disbursement method, Bank Account # (CBE, Awash, Telebirr Merchant ID), payment terms..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-white py-2.5 px-4 d-flex justify-content-end gap-2 border-top">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs"
                    onClick={() => setShowUploadModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-teal text-white rounded-pill px-4 text-xs fw-bold"
                    style={{ backgroundColor: '#0d9488' }}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting Invoice...' : 'Submit to Admin Finance'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              <div className="modal-header bg-slate-900 text-white py-2.5 px-3">
                <span className="text-xs fw-bold">Invoice Details: {selectedInvoice.invoice_number}</span>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedInvoice(null)}></button>
              </div>
              <div className="modal-body p-3 bg-white text-xs">
                <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Status</span>
                    {getStatusBadge(selectedInvoice.status)}
                  </div>
                  <div className="text-end">
                    <span className="text-slate-400 text-[10px] uppercase block">Invoice Amount</span>
                    <strong className="fs-6 text-slate-900">{formatETB(selectedInvoice.total_amount)}</strong>
                  </div>
                </div>

                <div className="mb-2">
                  <strong className="text-slate-600">Linked Purchase Order:</strong>{' '}
                  <span className="font-monospace">{selectedInvoice.purchase_order_number || `PO #${selectedInvoice.purchase_order}`}</span>
                </div>
                <div className="mb-2">
                  <strong className="text-slate-600">Invoice Date:</strong> {selectedInvoice.invoice_date || '—'}
                </div>
                <div className="mb-2">
                  <strong className="text-slate-600">Due Date:</strong> {selectedInvoice.due_date || '—'}
                </div>
                <div className="mb-2">
                  <strong className="text-slate-600">Paid Amount:</strong>{' '}
                  <span className="text-emerald-600 fw-bold">{formatETB(selectedInvoice.paid_amount || 0)}</span>
                </div>
                {selectedInvoice.notes && (
                  <div className="mb-2 bg-slate-50 p-2 rounded border">
                    <strong className="text-slate-600 d-block mb-1">Notes / Bank Details:</strong>
                    <div className="text-slate-700">{selectedInvoice.notes}</div>
                  </div>
                )}
                {selectedInvoice.attachment && (
                  <div className="mt-3">
                    <a
                      href={selectedInvoice.attachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-teal rounded-pill px-3 py-1 text-xs"
                      style={{ borderColor: '#0d9488', color: '#0d9488' }}
                    >
                      <i className="bi bi-file-earmark-arrow-down me-1"></i> Download Invoice Document
                    </a>
                  </div>
                )}
              </div>
              <div className="modal-footer py-2 bg-light">
                <button type="button" className="btn btn-sm btn-secondary rounded-pill px-3 text-xs" onClick={() => setSelectedInvoice(null)}>
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

