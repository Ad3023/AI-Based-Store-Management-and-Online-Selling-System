import React from 'react';
import { formatETB } from '../../../utils/currency';

const SupplierInvoiceDetailModal = ({ invoice, onClose }) => {
  if (!invoice) return null;

  const isRejected = (invoice.status || '').includes('REJECTED');

  return (
    <div className="modal show d-block bg-slate-900/60 backdrop-blur-sm" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className="modal-header bg-slate-900 text-white px-4 py-3">
            <h6 className="modal-title fw-bold text-sm">
              <i className="bi bi-receipt me-2 text-teal-400"></i>Invoice Details: #{invoice.invoice_number}
            </h6>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4 text-xs">
            {isRejected && (
              <div className="alert alert-danger py-2.5 px-3 rounded-3 mb-3">
                <div className="fw-bold"><i className="bi bi-exclamation-triangle-fill me-1"></i>Invoice Rejected</div>
                <div className="mt-1 text-slate-700">Reason: {invoice.rejection_reason || invoice.review_notes || 'No reason provided.'}</div>
              </div>
            )}
            <div className="row g-3">
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Invoice Status</span>
                <span className="badge bg-slate-100 text-slate-800 border p-1.5">{invoice.status_display || invoice.status}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Purchase Order</span>
                <span className="fw-bold">{invoice.purchase_order_number || 'N/A'}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Invoice Date</span>
                <span>{invoice.invoice_date || 'N/A'}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Due Date</span>
                <span>{invoice.due_date || 'N/A'}</span>
              </div>
              <div className="col-12"><hr className="my-1 border-slate-100" /></div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Ordered Qty</span>
                <span className="fw-semibold">{invoice.ordered_quantity ?? '—'}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Delivered Qty</span>
                <span className="fw-semibold">{invoice.delivered_quantity ?? '—'}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Store Accepted Qty</span>
                <span className="fw-bold text-teal-700">{invoice.accepted_quantity ?? '—'}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Invoiced Qty</span>
                <span className="fw-bold text-slate-900">{invoice.invoiced_quantity ?? '—'}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Unit Price</span>
                <span>{formatETB(invoice.unit_price)}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Subtotal</span>
                <span>{formatETB(invoice.subtotal || (invoice.invoiced_quantity * invoice.unit_price))}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Tax Amount</span>
                <span>{formatETB(invoice.tax_amount || 0)}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Total Amount</span>
                <span className="fw-bolder text-teal-700">{formatETB(invoice.total_amount)}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Paid Amount</span>
                <span className="fw-bold text-emerald-600">{formatETB(invoice.paid_amount || 0)}</span>
              </div>
              <div className="col-6 col-md-3">
                <span className="text-slate-400 d-block mb-1">Outstanding Balance</span>
                <span className="fw-bold text-amber-700">{formatETB(invoice.outstanding_amount)}</span>
              </div>
              <div className="col-12 col-md-6">
                <span className="text-slate-400 d-block mb-1">Invoice Attachment</span>
                {invoice.attachment_url || invoice.attachment ? (
                  <a href={invoice.attachment_url || invoice.attachment} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-teal rounded-pill px-2.5 py-1">
                    <i className="bi bi-file-earmark-pdf me-1"></i>View Uploaded Document
                  </a>
                ) : <span className="text-muted">No attachment provided</span>}
              </div>
              <div className="col-12"><hr className="my-1 border-slate-100" /></div>
              <div className="col-12 col-md-6">
                <span className="text-slate-400 d-block mb-1">Store Verification Status</span>
                {invoice.verified_by_store_username ? (
                  <div className="bg-slate-50 p-2 rounded-3 border border-slate-100">
                    <div><strong>Verified by:</strong> {invoice.verified_by_store_username}</div>
                    {invoice.store_verified_at && <div className="text-[11px] text-slate-400">{new Date(invoice.store_verified_at).toLocaleString()}</div>}
                    {invoice.store_verification_notes && <div className="mt-1 text-slate-600">"{invoice.store_verification_notes}"</div>}
                  </div>
                ) : <span className="text-muted">Awaiting store manager inspection</span>}
              </div>
              <div className="col-12 col-md-6">
                <span className="text-slate-400 d-block mb-1">Admin Payment Review</span>
                {invoice.approved_by_admin_username || invoice.reviewed_by_username ? (
                  <div className="bg-slate-50 p-2 rounded-3 border border-slate-100">
                    <div><strong>Reviewed by:</strong> {invoice.approved_by_admin_username || invoice.reviewed_by_username}</div>
                    {invoice.admin_approved_at && <div className="text-[11px] text-slate-400">{new Date(invoice.admin_approved_at).toLocaleString()}</div>}
                    {(invoice.admin_review_notes || invoice.review_notes) && <div className="mt-1 text-slate-600">"{invoice.admin_review_notes || invoice.review_notes}"</div>}
                  </div>
                ) : <span className="text-muted">Awaiting admin review</span>}
              </div>
            </div>
          </div>
          <div className="modal-footer px-4 py-2 bg-slate-50 border-top">
            <button type="button" className="btn btn-sm btn-light rounded-pill px-3" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierInvoiceDetailModal;
