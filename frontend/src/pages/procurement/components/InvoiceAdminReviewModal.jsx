import React, { useState } from 'react';
import api from '../../../api';
import { formatETB } from '../../../utils/currency';

const InvoiceAdminReviewModal = ({ invoice, onClose, onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!invoice) return null;

  const handleAction = async (action) => {
    setErrorMsg('');
    if (action === 'reject' && !rejectionReason.trim()) {
      return setErrorMsg('Mandatory: Please provide a clear reason for rejecting this invoice.');
    }

    try {
      setSubmitting(true);
      const payload = {
        action,
        review_notes: action === 'reject' ? rejectionReason.trim() : notes.trim(),
        rejection_reason: action === 'reject' ? rejectionReason.trim() : '',
      };
      await api.post(`products/supplier-invoices/${invoice.id}/review/`, payload);
      onSuccess(action === 'approve'
        ? `Invoice #${invoice.invoice_number} approved for payment disbursement.`
        : `Invoice #${invoice.invoice_number} rejected.`
      );
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to submit review.');
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
              <i className="bi bi-patch-check me-2 text-blue-400"></i>Admin Payment Authorization: #{invoice.invoice_number}
            </h6>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={submitting}></button>
          </div>
          <div className="modal-body p-4 text-xs">
            {errorMsg && <div className="alert alert-danger py-2 px-3 rounded-3 mb-3">{errorMsg}</div>}
            
            <div className="alert alert-info py-2 px-3 rounded-3 mb-3">
              <i className="bi bi-info-circle me-1"></i>
              <strong>Financial Workflow Note:</strong> Approving this invoice authorizes it for external manual bank transfer. Actual payment transaction and receipt must be recorded separately.
            </div>

            <div className="row g-3">
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Supplier</span>
                <span className="fw-bold text-slate-900">{invoice.supplier_name || 'N/A'}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Total Invoiced</span>
                <span className="fw-bolder fs-6 text-slate-900">{formatETB(invoice.total_amount)}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Outstanding Balance</span>
                <span className="fw-bold text-amber-700">{formatETB(invoice.outstanding_amount)}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">PO Reference</span>
                <span className="fw-bold">{invoice.purchase_order_number || 'N/A'}</span>
              </div>

              <div className="col-12">
                <div className="card bg-slate-50 border-slate-200 rounded-3 p-3">
                  <div className="fw-bold mb-1 text-slate-800">Supplier Banking Details</div>
                  <div className="row g-2">
                    <div className="col-12 col-md-4"><strong>Bank:</strong> {invoice.supplier_bank_name || 'N/A'}</div>
                    <div className="col-12 col-md-4"><strong>Account Name:</strong> {invoice.supplier_bank_account_name || 'N/A'}</div>
                    <div className="col-12 col-md-4"><strong>Account Number:</strong> {invoice.supplier_bank_account_number || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="col-12">
                <div className="card bg-teal-50 border-teal-200 rounded-3 p-3 text-teal-900">
                  <div className="fw-bold mb-1"><i className="bi bi-check-circle-fill me-1"></i>Store Manager Verification</div>
                  <div><strong>Verified by:</strong> {invoice.verified_by_store_username || 'Verified'} ({invoice.store_verified_at ? new Date(invoice.store_verified_at).toLocaleDateString() : 'N/A'})</div>
                  {invoice.store_verification_notes && <div className="mt-1 text-slate-700">"{invoice.store_verification_notes}"</div>}
                </div>
              </div>

              <div className="col-12">
                <span className="text-slate-400 d-block mb-1">Attached Billing Document</span>
                {invoice.attachment_url || invoice.attachment ? (
                  <a href={invoice.attachment_url || invoice.attachment} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-teal rounded-pill px-3 py-1">
                    <i className="bi bi-file-earmark-pdf me-1"></i>Open Invoice Document
                  </a>
                ) : <span className="text-muted">No attachment provided.</span>}
              </div>

              {rejecting ? (
                <div className="col-12 mt-2">
                  <label className="form-label fw-bold text-danger">Rejection Reason (Mandatory)</label>
                  <textarea rows="2" className="form-control text-xs border-danger" placeholder="Specify why this invoice is rejected for payment..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} required />
                </div>
              ) : (
                <div className="col-12 mt-2">
                  <label className="form-label fw-bold">Admin Review Notes</label>
                  <textarea rows="2" className="form-control text-xs" placeholder="Optional comments on payment approval..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer px-4 py-2 bg-slate-50 border-top d-flex justify-content-between">
            <div>
              {rejecting ? (
                <button type="button" className="btn btn-sm btn-light rounded-pill px-3" onClick={() => setRejecting(false)}>Back to Approval</button>
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
                <button type="button" className="btn btn-sm btn-primary rounded-pill px-4" onClick={() => handleAction('approve')} disabled={submitting}>
                  {submitting ? 'Approving...' : 'Approve for Payment'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceAdminReviewModal;

