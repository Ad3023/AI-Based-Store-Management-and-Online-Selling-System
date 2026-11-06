import React, { useState, useEffect } from 'react';
import api from '../../../api';
import { formatETB } from '../../../utils/currency';

const SupplierInvoiceSubmitModal = ({ show, onClose, onSuccess }) => {
  const [eligiblePOs, setEligiblePOs] = useState([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [formData, setFormData] = useState({
    purchase_order: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    invoiced_quantity: '',
    unit_price: '',
    tax_amount: '0.00',
    notes: '',
  });
  const [attachment, setAttachment] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (show) {
      setLoadingPOs(true);
      setErrorMsg('');
      api.get('supplier/invoices/?eligible_pos=true')
        .then((res) => {
          const list = res.data.results || res.data || [];
          setEligiblePOs(list);
          if (list.length > 0) handlePOChange(list[0].id, list);
        })
        .catch(() => setErrorMsg('Failed to load eligible purchase orders.'))
        .finally(() => setLoadingPOs(false));
      setFormData((prev) => ({
        ...prev,
        invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      }));
      setAttachment(null);
    }
  }, [show]);

  const handlePOChange = (poId, list = eligiblePOs) => {
    const po = list.find((p) => p.id === parseInt(poId, 10));
    setSelectedPO(po || null);
    if (po) {
      const unitCost = parseFloat(po.unit_price || 0);
      setFormData((prev) => ({
        ...prev,
        purchase_order: po.id,
        invoiced_quantity: po.accepted_quantity || 1,
        unit_price: unitCost.toFixed(2),
      }));
    }
  };

  const invQty = parseInt(formData.invoiced_quantity || 0, 10);
  const unitPrice = parseFloat(formData.unit_price || 0);
  const tax = parseFloat(formData.tax_amount || 0);
  const subtotal = invQty * unitPrice;
  const total = subtotal + tax;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!formData.purchase_order) return setErrorMsg('Please select an eligible purchase order.');
    if (!formData.invoice_number.trim()) return setErrorMsg('Invoice number is required.');
    if (!selectedPO || selectedPO.accepted_quantity <= 0) return setErrorMsg('Selected PO has no accepted goods.');
    if (invQty <= 0) return setErrorMsg('Invoiced quantity must be greater than zero.');
    if (invQty > selectedPO.accepted_quantity) {
      return setErrorMsg(`Invoiced quantity (${invQty}) cannot exceed store-accepted quantity (${selectedPO.accepted_quantity}).`);
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      Object.entries(formData).forEach(([k, v]) => data.append(k, v));
      data.append('total_amount', total.toFixed(2));
      if (attachment) data.append('attachment', attachment);

      await api.post('supplier/invoices/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSuccess(`Invoice #${formData.invoice_number} submitted successfully for Store verification.`);
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to submit invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block bg-slate-900/60 backdrop-blur-sm" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className="modal-header bg-slate-900 text-white px-4 py-3">
            <h6 className="modal-title fw-bold text-sm"><i className="bi bi-file-earmark-plus me-2 text-teal-400"></i>Submit Final Invoice</h6>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={submitting}></button>
          </div>
          <form onSubmit={handleSubmit} className="modal-body p-4 text-xs">
            {errorMsg && <div className="alert alert-danger py-2 px-3 rounded-3 mb-3">{errorMsg}</div>}
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold">Eligible Purchase Order (Accepted Goods)</label>
                {loadingPOs ? <div className="text-muted">Loading eligible orders...</div> : (
                  <select className="form-select text-xs" value={formData.purchase_order} onChange={(e) => handlePOChange(e.target.value)} required>
                    {eligiblePOs.length === 0 && <option value="">No received orders available to invoice</option>}
                    {eligiblePOs.map((p) => (
                      <option key={p.id} value={p.id}>{p.request_number} - {p.product_name} (Accepted: {p.accepted_quantity})</option>
                    ))}
                  </select>
                )}
                {selectedPO && (
                  <div className="badge bg-teal-50 text-teal-700 border border-teal-200 mt-1.5 p-1.5">
                    Ordered: {selectedPO.ordered_quantity} | Delivered: {selectedPO.delivered_quantity} | <strong>Accepted: {selectedPO.accepted_quantity}</strong>
                  </div>
                )}
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold">Invoice Number</label>
                <input type="text" className="form-control text-xs" value={formData.invoice_number} onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })} required />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label fw-bold">Invoiced Quantity</label>
                <input type="number" min="1" max={selectedPO?.accepted_quantity || 9999} className="form-control text-xs" value={formData.invoiced_quantity} onChange={(e) => setFormData({ ...formData, invoiced_quantity: e.target.value })} required />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label fw-bold">Unit Price (ETB)</label>
                <input type="number" step="0.01" className="form-control text-xs" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })} required />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label fw-bold">Tax Amount (ETB)</label>
                <input type="number" step="0.01" className="form-control text-xs" value={formData.tax_amount} onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label fw-bold">Calculated Total</label>
                <div className="form-control text-xs bg-slate-50 fw-bold text-teal-700">{formatETB(total)}</div>
              </div>
              <div className="col-6">
                <label className="form-label fw-bold">Invoice Date</label>
                <input type="date" className="form-control text-xs" value={formData.invoice_date} onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })} required />
              </div>
              <div className="col-6">
                <label className="form-label fw-bold">Payment Due Date</label>
                <input type="date" className="form-control text-xs" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
              </div>
              <div className="col-12">
                <label className="form-label fw-bold">Invoice Document (PDF / Image)</label>
                <input type="file" className="form-control text-xs" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setAttachment(e.target.files[0])} />
              </div>
              <div className="col-12">
                <label className="form-label fw-bold">Notes</label>
                <textarea rows="2" className="form-control text-xs" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional billing details..." />
              </div>
            </div>
            <div className="modal-footer px-0 pb-0 pt-3 mt-3 border-top">
              <button type="button" className="btn btn-sm btn-light rounded-pill px-3" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-teal text-white rounded-pill px-4" style={{ backgroundColor: '#0d9488' }} disabled={submitting || !selectedPO || selectedPO.accepted_quantity <= 0}>
                {submitting ? 'Submitting...' : 'Submit Invoice for Review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SupplierInvoiceSubmitModal;

