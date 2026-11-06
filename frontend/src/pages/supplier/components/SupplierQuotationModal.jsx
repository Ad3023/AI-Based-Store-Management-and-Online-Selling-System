import React, { useState, useEffect } from 'react';
import api from '../../../api';
import { formatETB } from '../../../utils/currency';

const SupplierQuotationModal = ({ rfq, onClose, onSuccess }) => {
  const [items, setItems] = useState([]);
  const [deliveryLeadTime, setDeliveryLeadTime] = useState('3 days');
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Bank transfer after delivery');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (rfq) {
      setErrorMsg('');
      const initialItems = (rfq.items || []).map((it) => ({
        rfq_item_id: it.id,
        product: it.product,
        product_name: it.product_name,
        requested_quantity: it.requested_quantity,
        target_price: it.target_price || '',
        offered_unit_price: it.target_price || '',
        available_quantity: it.requested_quantity,
        notes: ''
      }));
      setItems(initialItems);
      setEstimatedDeliveryDate(rfq.required_delivery_date || '');
    }
  }, [rfq]);

  if (!rfq) return null;

  const handleItemChange = (index, field, value) => {
    const next = [...items];
    next[index][field] = value;
    setItems(next);
  };

  const totalQuotationAmount = items.reduce((sum, it) => {
    const p = parseFloat(it.offered_unit_price || 0);
    const q = parseInt(it.requested_quantity || 0, 10);
    return sum + p * q;
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (items.some((it) => parseFloat(it.offered_unit_price || 0) <= 0)) {
      return setErrorMsg('Please enter a valid positive offered unit price for each requested product.');
    }

    try {
      setSubmitting(true);
      const payload = {
        rfq: rfq.id,
        delivery_lead_time: deliveryLeadTime.trim(),
        estimated_delivery_date: estimatedDeliveryDate || null,
        payment_terms: paymentTerms.trim(),
        notes: notes.trim(),
        items: items.map((it) => ({
          product: it.product,
          rfq_item: it.rfq_item_id,
          requested_quantity: it.requested_quantity,
          offered_unit_price: parseFloat(it.offered_unit_price).toFixed(2),
          available_quantity: parseInt(it.available_quantity || it.requested_quantity, 10),
          notes: it.notes.trim()
        }))
      };

      const res = await api.post('supplier/quotations/', payload);
      onSuccess(`Quotation #${res.data.quotation_number} submitted to Store Manager for evaluation.`);
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to submit quotation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block bg-slate-900/60 backdrop-blur-sm" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className="modal-header bg-slate-900 text-white px-4 py-3">
            <h6 className="modal-title fw-bold text-sm"><i className="bi bi-chat-quote me-2 text-teal-400"></i>Submit Quotation for #{rfq.rfq_number}</h6>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={submitting}></button>
          </div>
          <form onSubmit={handleSubmit} className="modal-body p-4 text-xs">
            {errorMsg && <div className="alert alert-danger py-2 px-3 rounded-3 mb-3">{errorMsg}</div>}
            
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-4">
                <label className="form-label fw-bold">Delivery Lead Time</label>
                <input type="text" className="form-control text-xs" value={deliveryLeadTime} onChange={(e) => setDeliveryLeadTime(e.target.value)} placeholder="e.g. 3 days" required />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label fw-bold">Estimated Delivery Date</label>
                <input type="date" className="form-control text-xs" value={estimatedDeliveryDate} onChange={(e) => setEstimatedDeliveryDate(e.target.value)} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label fw-bold">Payment Terms</label>
                <input type="text" className="form-control text-xs" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} required />
              </div>
            </div>

            <div className="fw-bold mb-2 text-slate-800">Quoted Products &amp; Unit Pricing ({items.length})</div>
            <div className="table-responsive border rounded-3 bg-slate-50 mb-3">
              <table className="table table-sm align-middle mb-0 text-xs">
                <thead>
                  <tr className="text-slate-400 text-[11px] border-bottom">
                    <th className="ps-3">Product Name</th>
                    <th>Req Qty</th>
                    <th>Offered Unit Price (ETB)</th>
                    <th>Available Qty</th>
                    <th className="text-end pe-3">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const lineTot = (parseFloat(it.offered_unit_price || 0) * parseInt(it.requested_quantity || 0, 10)) || 0;
                    return (
                      <tr key={idx} className="border-bottom border-slate-100">
                        <td className="ps-3 fw-semibold text-slate-900">{it.product_name}</td>
                        <td>{it.requested_quantity} pcs</td>
                        <td>
                          <input type="number" step="0.01" min="1" className="form-control form-control-sm text-xs fw-bold text-teal-700" value={it.offered_unit_price} onChange={(e) => handleItemChange(idx, 'offered_unit_price', e.target.value)} required />
                        </td>
                        <td>
                          <input type="number" min="1" className="form-control form-control-sm text-xs" value={it.available_quantity} onChange={(e) => handleItemChange(idx, 'available_quantity', e.target.value)} required />
                        </td>
                        <td className="text-end pe-3 fw-bold text-slate-900">{formatETB(lineTot)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="d-flex align-items-center justify-content-between p-3 bg-teal-50/50 rounded-3 border border-teal-200 mb-3">
              <span className="fw-bold text-teal-900">Total Quotation Value:</span>
              <span className="fs-5 fw-bolder text-teal-700">{formatETB(totalQuotationAmount)}</span>
            </div>

            <div className="mb-2">
              <label className="form-label fw-bold">Quotation Terms &amp; Conditions</label>
              <textarea rows="2" className="form-control text-xs" placeholder="e.g. Prices valid for 14 days. Delivered with original manufacturer packaging..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="modal-footer px-0 pb-0 pt-3 border-top">
              <button type="button" className="btn btn-sm btn-light rounded-pill px-3" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-teal text-white rounded-pill px-4" style={{ backgroundColor: '#0d9488' }} disabled={submitting || totalQuotationAmount <= 0}>
                {submitting ? 'Submitting...' : 'Submit Quotation to Store Manager'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SupplierQuotationModal;

