import React, { useState } from 'react';
import api from '../../../api';
import { formatETB } from '../../../utils/currency';

const InvoiceVerifyModal = ({ invoice, onClose, onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!invoice) return null;

  const hasQtyMismatch = (invoice.invoiced_quantity || 0) > (invoice.accepted_quantity || 0);

  const handleAction = async (action) => {
    setErrorMsg('');
    if (action === 'reject' && !rejectionReason.trim()) {
      return setErrorMsg('Mandatory: Please provide a clear reason for rejecting this invoice.');
    }

    try {
      setSubmitting(true);
      const payload = {
        action,
        notes: action === 'reject' ? rejectionReason.trim() : notes.trim(),
        rejection_reason: action === 'reject' ? rejectionReason.trim() : '',
      };
      await api.post(`products/supplier-invoices/${invoice.id}/store-verify/`, payload);
      onSuccess(action === 'verify'
        ? `Invoice #${invoice.invoice_number} verified and forwarded to Admin.`
        : `Invoice #${invoice.invoice_number} rejected.`
      );
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to submit verification.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block bg-slate-900/60 backdrop-blur-sm" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className="modal-header bg-slate-900 text-white px-4 py-3">
            <h6 className="modal-title fw-bold text-sm">
              <i className="bi bi-shield-check me-2 text-teal-400"></i>Store Manager Verification: #{invoice.invoice_number}
            </h6>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={submitting}></button>
          </div>
          <div className="modal-body p-4 text-xs">
            {errorMsg && <div className="alert alert-danger py-2 px-3 rounded-3 mb-3">{errorMsg}</div>}
            {hasQtyMismatch && (
              <div className="alert alert-warning py-2.5 px-3 rounded-3 mb-3">
                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                <strong>Quantity Discrepancy Warning:</strong> Invoiced quantity ({invoice.invoiced_quantity}) exceeds store-accepted quantity ({invoice.accepted_quantity}).
              </div>
            )}
            <div className="row g-3">
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Supplier</span>
                <span className="fw-bold text-slate-900">{invoice.supplier_name || 'N/A'}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Purchase Order</span>
                <span className="fw-bold">{invoice.purchase_order_number || 'N/A'}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Invoice Date</span>
                <span>{invoice.invoice_date || '—'}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Due Date</span>
                <span>{invoice.due_date || '—'}</span>
              </div>

              <div className="col-12">
                <div className="card bg-slate-50 border-slate-200 rounded-3 p-3">
                  <div className="fw-bold mb-2 text-slate-800">Physical Goods vs Billing Verification</div>
                  <div className="row g-2 text-center">
                    <div className="col-3">
                      <div className="text-slate-400 text-[11px]">Ordered Qty</div>
                      <div className="fs-6 fw-semibold text-slate-700">{invoice.ordered_quantity ?? '—'}</div>
                    </div>
                    <div className="col-3">
                      <div className="text-slate-400 text-[11px]">Delivered Qty</div>
                      <div className="fs-6 fw-semibold text-slate-700">{invoice.delivered_quantity ?? '—'}</div>
                    </div>
                    <div className="col-3">
                      <div className="text-teal-700 text-[11px] fw-bold">Accepted Qty</div>
                      <div className="fs-6 fw-bold text-teal-700">{invoice.accepted_quantity ?? '—'}</div>
                    </div>
                    <div className="col-3">
                      <div className="text-slate-900 text-[11px] fw-bold">Invoiced Qty</div>
                      <div className={`fs-6 fw-bold ${hasQtyMismatch ? 'text-danger' : 'text-slate-900'}`}>{invoice.invoiced_quantity ?? '—'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Unit Price</span>
                <span className="fw-semibold">{formatETB(invoice.unit_price)}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Subtotal</span>
                <span>{formatETB(invoice.subtotal)}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Tax Amount</span>
                <span>{formatETB(invoice.tax_amount)}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Total Amount</span>
                <span className="fw-bolder text-teal-700">{formatETB(invoice.total_amount)}</span>
              </div>

              <div className="col-12">
                <span className="text-slate-400 d-block mb-1">Invoice Attachment Document</span>
                {invoice.attachment_url || invoice.attachment ? (
                  <a href={invoice.attachment_url || invoice.attachment} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-teal rounded-pill px-3 py-1">
                    <i className="bi bi-file-earmark-pdf me-1"></i>Inspect Attached Document
                  </a>
                ) : <span className="text-muted">No document attachment uploaded.</span>}
              </div>

              {rejecting ? (
                <div className="col-12 mt-2">
                  <label className="form-label fw-bold text-danger">Rejection Reason (Mandatory)</label>
                  <textarea rows="2" className="form-control text-xs border-danger" placeholder="Specify why the invoice is being rejected..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} required />
                </div>
              ) : (
                <div className="col-12 mt-2">
                  <label className="form-label fw-bold">Verification Inspection Notes</label>
                  <textarea rows="2" className="form-control text-xs" placeholder="e.g. Products inspected in warehouse, matched with accepted quantities..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer px-4 py-2 bg-slate-50 border-top d-flex justify-content-between">
            <div>
              {rejecting ? (
                <button type="button" className="btn btn-sm btn-light rounded-pill px-3" onClick={() => setRejecting(false)}>Back to Verification</button>
              ) : (
                <button type="button" className="btn btn-sm btn-outline-danger rounded-pill px-3" onClick={() => setRejecting(true)}>Reject Invoice...</button>
              )}
            </div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-light rounded-pill px-3" onClick={onClose} disabled={submitting}>Cancel</button>
              {rejecting ? (
                <button type="button" className="btn btn-sm btn-danger rounded-pill px-4" onClick={() => handleAction('reject')} disabled={submitting || !rejectionReason.trim()}>
                  {submitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              ) : (
                <button type="button" className="btn btn-sm btn-teal text-white rounded-pill px-4" style={{ backgroundColor: '#0d9488' }} onClick={() => handleAction('verify')} disabled={submitting}>
                  {submitting ? 'Verifying...' : 'Verify & Forward to Admin'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceVerifyModal;
