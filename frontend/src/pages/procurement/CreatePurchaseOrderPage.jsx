import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const CreatePurchaseOrderPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedSupplierId = searchParams.get('supplier');

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState(preselectedSupplierId || '');
  const [expectedSupplyDate, setExpectedSupplyDate] = useState('');
  const [notes, setNotes] = useState('');

  // Line items: [{ product: '', quantity: 10, unit_price: 0, notes: '' }]
  const [items, setItems] = useState([
    { product: '', quantity: 20, unit_price: '', notes: '' }
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [supRes, prodRes] = await Promise.all([
          api.get('products/suppliers/'),
          api.get('products/items/?page_size=200')
        ]);
        const sList = supRes.data.results || supRes.data || [];
        const pList = prodRes.data.results || prodRes.data || [];
        setSuppliers(sList);
        setProducts(pList);

        if (preselectedSupplierId) {
          setSelectedSupplierId(preselectedSupplierId);
        }
      } catch (err) {
        console.error('Failed to load PO creation dependencies:', err);
        setFeedback({ type: 'danger', text: 'Failed to load suppliers and products.' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [preselectedSupplierId]);

  const selectedSupplier = suppliers.find((s) => String(s.id) === String(selectedSupplierId));

  // Filter products by selected supplier if supplier has assigned products, else show all
  const availableProducts = products.filter((p) => {
    if (!selectedSupplierId) return true;
    return !p.supplier || String(p.supplier) === String(selectedSupplierId);
  });

  const handleProductChange = (index, productId) => {
    const prod = products.find((p) => String(p.id) === String(productId));
    const newItems = [...items];
    newItems[index].product = productId;
    if (prod) {
      newItems[index].unit_price = prod.cost_price || prod.price || '';
      newItems[index].quantity = prod.reorder_quantity || 20;
    }
    setItems(newItems);
  };

  const handleQuantityChange = (index, qty) => {
    const val = Math.max(1, parseInt(qty, 10) || 1);
    const newItems = [...items];
    newItems[index].quantity = val;
    setItems(newItems);
  };

  const handlePriceChange = (index, price) => {
    const newItems = [...items];
    newItems[index].unit_price = price;
    setItems(newItems);
  };

  const handleItemNotesChange = (index, noteText) => {
    const newItems = [...items];
    newItems[index].notes = noteText;
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { product: '', quantity: 20, unit_price: '', notes: '' }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  // Calculations
  const totalCost = items.reduce((acc, it) => {
    const p = parseFloat(it.unit_price) || 0;
    const q = parseInt(it.quantity, 10) || 0;
    return acc + p * q;
  }, 0);

  const totalQuantity = items.reduce((acc, it) => {
    return acc + (parseInt(it.quantity, 10) || 0);
  }, 0);

  const handleSubmit = async (targetStatus) => {
    if (!selectedSupplierId) {
      alert('Please select a supplier for this purchase order.');
      return;
    }

    const validItems = items.filter((it) => it.product && it.quantity > 0);
    if (validItems.length === 0) {
      alert('Please select at least one valid product line with quantity greater than zero.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        supplier: selectedSupplierId,
        expected_supply_date: expectedSupplyDate || null,
        notes: notes.trim(),
        status: targetStatus, // 'DRAFT' or 'PENDING_APPROVAL'
        items: validItems.map((it) => ({
          product: it.product,
          quantity: parseInt(it.quantity, 10),
          unit_price: parseFloat(it.unit_price) || 0,
          notes: it.notes
        }))
      };

      const res = await api.post('products/purchase-requests/', payload);
      const poNum = res.data.request_number || 'New PO';

      if (targetStatus === 'PENDING_APPROVAL') {
        alert(`Purchase Order ${poNum} successfully created and submitted to Admin for approval!`);
      } else {
        alert(`Purchase Order ${poNum} saved as Draft.`);
      }

      navigate('/manager/procurement/purchase-orders');
    } catch (err) {
      console.error('Failed to create purchase order:', err);
      const errDetail = err.response?.data?.error || err.response?.data?.detail || 'Failed to submit purchase order.';
      alert(`Submission error: ${errDetail}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted text-xs mt-2">Loading procurement catalogue...</p>
      </div>
    );
  }

  return (
    <div className="pb-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-primary border-opacity-25 bg-primary bg-opacity-10">
            <i className="bi bi-cart-plus text-primary"></i>
            <span className="small fw-bold text-primary">Store Manager Purchasing</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Create Purchase Order</h2>
          <p className="text-slate-500 text-xs mb-0">
            Select an authorized supplier, specify product replenishment quantities, and submit for Admin financial approval.
          </p>
        </div>

        <Link
          to="/manager/procurement/purchase-orders"
          className="btn btn-outline-secondary rounded-pill px-3 py-2 text-xs font-bold d-flex align-items-center gap-2"
        >
          <i className="bi bi-arrow-left"></i>
          <span>View PO History</span>
        </Link>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} text-xs mb-4 shadow-sm`} role="alert">
          {feedback.text}
        </div>
      )}

      <div className="row g-4">
        {/* Left Column: Form Details & Items */}
        <div className="col-12 col-lg-8">
          {/* 1. Supplier & Expected Date Card */}
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
            <h6 className="fw-bold text-slate-900 mb-3 text-sm d-flex align-items-center gap-2">
              <i className="bi bi-building text-primary"></i> 1. Supplier &amp; Schedule
            </h6>

            <div className="row g-3">
              <div className="col-12 col-md-7">
                <label className="form-label text-xs fw-bold text-slate-700">Select Supplier *</label>
                <select
                  className="form-select text-xs"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Authorized Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.contact_person ? `(${s.contact_person})` : ''} - [{s.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-5">
                <label className="form-label text-xs fw-bold text-slate-700">Expected Delivery Date</label>
                <input
                  type="date"
                  className="form-control text-xs"
                  value={expectedSupplyDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setExpectedSupplyDate(e.target.value)}
                />
              </div>
            </div>

            {selectedSupplier && (
              <div className="mt-3 p-3 rounded-3 bg-slate-50 border border-slate-200 text-xs">
                <div className="row g-2">
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Contact Person:</span>
                    <strong className="text-slate-800">{selectedSupplier.contact_person || 'N/A'}</strong>
                  </div>
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Email &amp; Phone:</span>
                    <strong className="text-slate-800">{selectedSupplier.email || selectedSupplier.phone || 'N/A'}</strong>
                  </div>
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Outstanding Balance:</span>
                    <strong className="text-danger">{formatETB(selectedSupplier.outstanding_balance || 0)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Order Line Items Table */}
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold text-slate-900 mb-0 text-sm d-flex align-items-center gap-2">
                <i className="bi bi-box-seam text-primary"></i> 2. Requested Products &amp; Quantities
              </h6>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs d-flex align-items-center gap-1"
                onClick={handleAddItem}
              >
                <i className="bi bi-plus-circle"></i>
                <span>Add Product Line</span>
              </button>
            </div>

            <div className="table-responsive">
              <table className="table table-bordered align-middle text-xs mb-0">
                <thead className="table-light text-slate-600">
                  <tr>
                    <th style={{ width: '40%' }}>Product *</th>
                    <th style={{ width: '15%' }}>Quantity *</th>
                    <th style={{ width: '20%' }}>Unit Price (ETB)</th>
                    <th style={{ width: '20%' }}>Line Subtotal</th>
                    <th style={{ width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const lineSubtotal = (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity, 10) || 0);
                    const prodObj = products.find((p) => String(p.id) === String(item.product));

                    return (
                      <tr key={idx}>
                        <td>
                          <select
                            className="form-select form-select-sm text-xs"
                            value={item.product}
                            onChange={(e) => handleProductChange(idx, e.target.value)}
                            required
                          >
                            <option value="">-- Choose Product --</option>
                            {availableProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Stock: {p.stock})
                              </option>
                            ))}
                          </select>
                          {prodObj && (
                            <small className="text-muted text-[10px] d-block mt-1">
                              Current Stock: {prodObj.stock} units | Recommended Reorder: {prodObj.reorder_quantity || 20}
                            </small>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="form-control form-control-sm text-xs text-center"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(idx, e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control form-control-sm text-xs"
                            placeholder="0.00"
                            value={item.unit_price}
                            onChange={(e) => handlePriceChange(idx, e.target.value)}
                            required
                          />
                        </td>
                        <td className="fw-bold text-slate-900">
                          {formatETB(lineSubtotal)}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-link text-danger p-0"
                            title="Remove Line"
                            disabled={items.length <= 1}
                            onClick={() => handleRemoveItem(idx)}
                          >
                            <i className="bi bi-x-circle fs-6"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3">
              <button
                type="button"
                className="btn btn-sm btn-link text-decoration-none text-primary p-0 text-xs"
                onClick={handleAddItem}
              >
                + Add Another Product Line
              </button>
            </div>
          </div>

          {/* 3. Notes & Supporting Information */}
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 bg-white">
            <h6 className="fw-bold text-slate-900 mb-2 text-sm d-flex align-items-center gap-2">
              <i className="bi bi-card-text text-primary"></i> 3. Procurement Notes &amp; Supporting Info
            </h6>
            <textarea
              className="form-control text-xs"
              rows="3"
              placeholder="Enter special handling specifications, supplier quote references, discount agreements, or warehouse dock delivery notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
          </div>
        </div>

        {/* Right Column: Cost Summary & Action Controls */}
        <div className="col-12 col-lg-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 bg-white sticky-top" style={{ top: '100px' }}>
            <h6 className="fw-bold text-slate-900 mb-3 text-sm border-bottom pb-2">
              Purchase Cost Summary
            </h6>

            <div className="d-flex justify-content-between text-xs mb-2 text-slate-600">
              <span>Product Lines:</span>
              <strong className="text-slate-900">{items.filter((i) => i.product).length}</strong>
            </div>

            <div className="d-flex justify-content-between text-xs mb-2 text-slate-600">
              <span>Total Units to Replenish:</span>
              <strong className="text-slate-900">{totalQuantity} units</strong>
            </div>

            <div className="d-flex justify-content-between text-xs mb-2 text-slate-600">
              <span>Target Delivery Date:</span>
              <strong className="text-slate-900">{expectedSupplyDate || 'Not specified'}</strong>
            </div>

            <hr className="my-3" />

            <div className="d-flex justify-content-between align-items-baseline mb-4">
              <span className="text-xs fw-bold uppercase text-slate-500">Total Purchase Cost:</span>
              <span className="fs-4 fw-bolder text-primary">
                {formatETB(totalCost)}
              </span>
            </div>

            {/* Approval Notice */}
            <div className="alert alert-info py-2 px-3 rounded-3 text-[11px] mb-4">
              <i className="bi bi-shield-lock me-1"></i>
              <strong>Role Separation Policy:</strong> Purchase orders require formal Admin approval before ordering from the supplier.
            </div>

            {/* Actions */}
            <div className="d-grid gap-2">
              <button
                type="button"
                className="btn btn-ethio-primary py-2.5 rounded-pill font-bold text-xs d-flex align-items-center justify-content-center gap-2 shadow-sm"
                style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
                disabled={submitting}
                onClick={() => handleSubmit('PENDING_APPROVAL')}
              >
                <i className="bi bi-send-check"></i>
                <span>{submitting ? 'Submitting...' : 'Submit for Admin Approval'}</span>
              </button>

              <button
                type="button"
                className="btn btn-outline-secondary py-2 rounded-pill font-bold text-xs d-flex align-items-center justify-content-center gap-2"
                disabled={submitting}
                onClick={() => handleSubmit('DRAFT')}
              >
                <i className="bi bi-file-earmark"></i>
                <span>Save as Draft</span>
              </button>

              <Link
                to="/manager/procurement/purchase-orders"
                className="btn btn-link text-muted text-xs text-center text-decoration-none mt-2"
              >
                Cancel and Return
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePurchaseOrderPage;
