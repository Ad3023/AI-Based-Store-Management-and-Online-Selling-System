import React, { useState } from 'react';
import api from '../../../api';
import { formatETB } from '../../../utils/currency';

const RFQDetailModal = ({ rfq, onClose, onRefresh, onNavigateToPO }) => {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  if (!rfq) return null;

  const handleSelectQuotation = async (quotationId) => {
    try {
      setSubmitting(true);
      await api.post(`products/quotations/${quotationId}/select/`);
      setFeedback({ type: 'success', text: 'Quotation selected successfully! You can now generate the Purchase Order.' });
      onRefresh();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to select quotation.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePO = async (quotationId) => {
    try {
      setSubmitting(true);
      const res = await api.post(`products/quotations/${quotationId}/create-po/`);
      setFeedback({ type: 'success', text: `Purchase Order ${res.data.purchase_order.request_number} generated successfully and submitted for Admin approval!` });
      onRefresh();
      if (onNavigateToPO) onNavigateToPO(res.data.purchase_order.id);
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to create Purchase Order.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block bg-slate-900/60 backdrop-blur-sm" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className="modal-header bg-slate-900 text-white px-4 py-3">
            <h6 className="modal-title fw-bold text-sm"><i className="bi bi-file-earmark-text me-2 text-teal-400"></i>RFQ Details: #{rfq.rfq_number}</h6>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4 text-xs">
            {feedback.text && <div className={`alert alert-${feedback.type} py-2 px-3 rounded-3 mb-3`}>{feedback.text}</div>}
            {rfq.status === 'DECLINED' && (
              <div className="alert alert-danger py-2 px-3 rounded-3 mb-3">
                <strong><i className="bi bi-x-circle me-1"></i>Supplier Declined RFQ:</strong> {rfq.decline_reason || 'No decline reason provided.'}
              </div>
            )}
            <div className="row g-3 mb-3">
              <div className="col-6 col-md-3"><span className="text-slate-400 d-block">Supplier</span><span className="fw-bold">{rfq.supplier_name}</span></div>
              <div className="col-6 col-md-3"><span className="text-slate-400 d-block">Date Sent</span><span>{rfq.sent_at ? new Date(rfq.sent_at).toLocaleDateString() : '—'}</span></div>
              <div className="col-6 col-md-3"><span className="text-slate-400 d-block">Delivery Needed</span><span>{rfq.required_delivery_date || 'Flexible'}</span></div>
              <div className="col-6 col-md-3"><span className="text-slate-400 d-block">Status</span><span className="badge bg-slate-100 text-slate-800 border">{rfq.status_display || rfq.status}</span></div>
            </div>

            <div className="fw-bold mb-2 text-slate-800">Requested Products ({rfq.items?.length || 0})</div>
            <div className="table-responsive border rounded-3 bg-slate-50 mb-4">
              <table className="table table-sm align-middle mb-0 text-xs">
                <thead>
                  <tr className="text-slate-400 border-bottom text-[11px]">
                    <th className="ps-3">Product Name</th>
                    <th>Requested Qty</th>
                    <th>Target Price</th>
                    <th>Item Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rfq.items?.map((it) => (
                    <tr key={it.id} className="border-bottom border-slate-100">
                      <td className="ps-3 fw-semibold text-slate-900">{it.product_name}</td>
                      <td>{it.requested_quantity} pcs</td>
                      <td>{it.target_price ? formatETB(it.target_price) : 'Open Quote'}</td>
                      <td className="text-slate-500">{it.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="fw-bold mb-2 text-slate-800">Supplier Quotations Received ({rfq.quotations?.length || 0})</div>
            {rfq.quotations?.length === 0 ? (
              <div className="card bg-slate-50 border-dashed rounded-3 p-3 text-center text-slate-400">
                Awaiting supplier response with price quotation.
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {rfq.quotations.map((q) => {
                  const isSelected = q.status === 'SELECTED';
                  const hasPO = Boolean(q.purchase_order);
                  return (
                    <div key={q.id} className={`card rounded-3 p-3 border ${isSelected ? 'border-teal-500 bg-teal-50/20' : 'border-slate-200'}`}>
                      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-2">
                        <div>
                          <span className="fw-bold text-slate-900 text-sm me-2">Quote #{q.quotation_number}</span>
                          <span className="badge bg-slate-100 text-slate-700 border me-2">Lead Time: {q.delivery_lead_time || '3 days'}</span>
                          <span className="badge bg-blue-50 text-blue-700 border border-blue-200">Terms: {q.payment_terms}</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fs-6 fw-bolder text-teal-700">{formatETB(q.total_amount)}</span>
                          {!isSelected && q.status !== 'NOT_SELECTED' && (
                            <button type="button" className="btn btn-xs btn-outline-teal rounded-pill px-3 py-1" onClick={() => handleSelectQuotation(q.id)} disabled={submitting}>
                              <i className="bi bi-check2-circle me-1"></i>Select Quotation
                            </button>
                          )}
                          {isSelected && !hasPO && (
                            <button type="button" className="btn btn-xs btn-teal text-white rounded-pill px-3 py-1" style={{ backgroundColor: '#0d9488' }} onClick={() => handleCreatePO(q.id)} disabled={submitting}>
                              <i className="bi bi-cart-plus me-1"></i>Create Purchase Order
                            </button>
                          )}
                          {hasPO && (
                            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                              <i className="bi bi-check-circle me-1"></i>PO Created: {q.purchase_order_number}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="table-responsive border rounded-2 bg-white">
                        <table className="table table-sm table-borderless align-middle mb-0 text-xs">
                          <thead>
                            <tr className="text-slate-400 text-[11px] border-bottom">
                              <th className="ps-2">Quoted Product</th>
                              <th>Requested</th>
                              <th>Available</th>
                              <th>Offered Unit Price</th>
                              <th>Line Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {q.items?.map((qi) => (
                              <tr key={qi.id} className="border-bottom border-slate-50">
                                <td className="ps-2 fw-semibold text-slate-800">{qi.product_name}</td>
                                <td>{qi.requested_quantity} pcs</td>
                                <td className="text-emerald-700 fw-bold">{qi.available_quantity} pcs</td>
                                <td className="fw-bold text-slate-900">{formatETB(qi.offered_unit_price)}</td>
                                <td className="fw-bold text-teal-700">{formatETB(qi.line_total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="modal-footer px-4 py-2 bg-slate-50 border-top">
            <button type="button" className="btn btn-sm btn-light rounded-pill px-3" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RFQDetailModal;

