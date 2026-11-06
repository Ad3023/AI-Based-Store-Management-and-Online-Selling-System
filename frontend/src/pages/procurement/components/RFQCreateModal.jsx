import React, { useState, useEffect } from 'react';
import api from '../../../api';
import { formatETB } from '../../../utils/currency';

const RFQCreateModal = ({ show, onClose, onSuccess, initialSupplierId = '' }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState(initialSupplierId);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product: '', requested_quantity: 10, target_price: '', notes: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (show) {
      setErrorMsg('');
      api.get('products/suppliers/')
        .then((res) => setSuppliers(res.data.results || res.data || []))
        .catch(() => {});
      api.get('products/items/?page_size=250')
        .then((res) => setProducts(res.data.results || res.data || []))
        .catch(() => {});
      if (initialSupplierId) setSupplierId(initialSupplierId);
    }
  }, [show, initialSupplierId]);

  const handleAddItem = () => {
    setItems([...items, { product: '', requested_quantity: 10, target_price: '', notes: '' }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const next = [...items];
    next[index][field] = value;
    setItems(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!supplierId) return setErrorMsg('Please select a supplier.');
    if (items.some((it) => !it.product || parseInt(it.requested_quantity, 10) <= 0)) {
      return setErrorMsg('Please ensure all items have a valid product and positive requested quantity.');
    }

    try {
      setSubmitting(true);
      const payload = {
        supplier: supplierId,
        required_delivery_date: deliveryDate || null,
        notes: notes.trim(),
        items: items.map((it) => ({
          product: it.product,
          requested_quantity: parseInt(it.requested_quantity, 10),
          target_price: it.target_price ? parseFloat(it.target_price).toFixed(2) : null,
          notes: it.notes.trim()
        }))
      };
      const res = await api.post('products/rfqs/', payload);
      onSuccess(`Request for Quotation #${res.data.rfq_number} sent successfully.`);
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to send Request for Quotation.');
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
            <h6 className="modal-title fw-bold text-sm"><i className="bi bi-send-plus me-2 text-teal-400"></i>Create Request for Quotation (RFQ)</h6>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={submitting}></button>
          </div>
          <form onSubmit={handleSubmit} className="modal-body p-4 text-xs">
            {errorMsg && <div className="alert alert-danger py-2 px-3 rounded-3 mb-3">{errorMsg}</div>}
            
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold">Select Supplier Organization</label>
                <select className="form-select text-xs" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                  <option value="">-- Choose Registered Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.contact_person || s.email})</option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold">Required Delivery Date</label>
                <input type="date" className="form-control text-xs" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </div>
              <div className="col-12">
                <label className="form-label fw-bold">Instructions &amp; Specifications</label>
                <textarea rows="2" className="form-control text-xs" placeholder="e.g. Please quote bulk purchase with original warranty..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-bold text-slate-800">Requested Products ({items.length})</span>
              <button type="button" className="btn btn-xs btn-outline-teal rounded-pill px-2.5 py-1" onClick={handleAddItem}>
                <i className="bi bi-plus-lg me-1"></i>Add Product
              </button>
            </div>

            <div className="table-responsive border rounded-3 bg-slate-50 mb-3">
              <table className="table table-sm table-borderless align-middle mb-0 text-xs">
                <thead>
                  <tr className="text-slate-400 text-[11px] border-bottom">
                    <th className="ps-3" style={{ width: '40%' }}>Product</th>
                    <th style={{ width: '20%' }}>Quantity</th>
                    <th style={{ width: '25%' }}>Target Unit Price (ETB)</th>
                    <th className="text-end pe-3" style={{ width: '15%' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-bottom border-slate-100">
                      <td className="ps-3">
                        <select className="form-select form-select-sm text-xs" value={it.product} onChange={(e) => handleItemChange(idx, 'product', e.target.value)} required>
                          <option value="">-- Choose Product --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input type="number" min="1" className="form-control form-control-sm text-xs" value={it.requested_quantity} onChange={(e) => handleItemChange(idx, 'requested_quantity', e.target.value)} required />
                      </td>
                      <td>
                        <input type="number" step="0.01" min="0" placeholder="Optional" className="form-control form-control-sm text-xs" value={it.target_price} onChange={(e) => handleItemChange(idx, 'target_price', e.target.value)} />
                      </td>
                      <td className="text-end pe-3">
                        <button type="button" className="btn btn-xs btn-outline-danger" disabled={items.length <= 1} onClick={() => handleRemoveItem(idx)}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-footer px-0 pb-0 pt-3 border-top">
              <button type="button" className="btn btn-sm btn-light rounded-pill px-3" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-teal text-white rounded-pill px-4" style={{ backgroundColor: '#0d9488' }} disabled={submitting}>
                {submitting ? 'Transmitting RFQ...' : 'Send RFQ to Supplier'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RFQCreateModal;

