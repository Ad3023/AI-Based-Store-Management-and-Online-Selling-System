import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const ReceiveProductsPage = () => {
  const [searchParams] = useSearchParams();
  const targetPoId = searchParams.get('po');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receivingItems, setReceivingItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('products/purchase-requests/');
      const allOrders = res.data.results || res.data || [];
      // Eligible orders for receiving: Approved, Sent, or Partially Received with remaining quantity > 0
      const receivable = allOrders.filter(
        (o) =>
          (o.status === 'APPROVED' || o.status === 'SENT_TO_SUPPLIER' || o.status === 'PARTIALLY_RECEIVED') &&
          o.outstanding_quantity > 0
      );
      setOrders(receivable);

      if (targetPoId) {
        const found = receivable.find((o) => String(o.id) === String(targetPoId));
        if (found) {
          selectOrderForReceiving(found);
        }
      }
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
      setFeedback({ type: 'danger', text: 'Failed to load purchase orders for goods receipt.' });
    } finally {
      setLoading(false);
    }
  }, [targetPoId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const selectOrderForReceiving = (order) => {
    setSelectedOrder(order);
    if (order.items && order.items.length > 0) {
      setReceivingItems(
        order.items.map((it) => {
          const remaining = Math.max(0, it.quantity - it.received_quantity);
          return {
            id: it.id,
            product_name: it.product_name,
            quantity: it.quantity,
            received_quantity: it.received_quantity,
            damaged_quantity: it.damaged_quantity,
            incoming_received: remaining,
            incoming_damaged: 0,
            notes: ''
          };
        })
      );
    } else {
      const remaining = Math.max(0, order.quantity - order.received_quantity);
      setReceivingItems([
        {
          id: null,
          product_name: order.product_name || 'Replenishment Item',
          quantity: order.quantity,
          received_quantity: order.received_quantity,
          damaged_quantity: order.damaged_quantity || 0,
          incoming_received: remaining,
          incoming_damaged: 0,
          notes: ''
        }
      ]);
    }
    setNotes('');
  };

  const handleItemReceivedChange = (index, val) => {
    const updated = [...receivingItems];
    updated[index].incoming_received = Math.max(0, parseInt(val, 10) || 0);
    setReceivingItems(updated);
  };

  const handleItemDamagedChange = (index, val) => {
    const updated = [...receivingItems];
    updated[index].incoming_damaged = Math.max(0, parseInt(val, 10) || 0);
    setReceivingItems(updated);
  };

  const handleItemNotesChange = (index, val) => {
    const updated = [...receivingItems];
    updated[index].notes = val;
    setReceivingItems(updated);
  };

  const handleSubmitReceiving = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const totalIncoming = receivingItems.reduce((acc, it) => acc + (it.incoming_received || 0), 0);
    const totalDamaged = receivingItems.reduce((acc, it) => acc + (it.incoming_damaged || 0), 0);

    if (totalIncoming <= 0 && totalDamaged <= 0) {
      alert('Please enter at least one received or damaged unit count.');
      return;
    }

    try {
      setSubmitting(true);
      let payload;
      if (selectedOrder.items && selectedOrder.items.length > 0) {
        payload = {
          items: receivingItems.map((it) => ({
            id: it.id,
            received_quantity: it.incoming_received,
            damaged_quantity: it.incoming_damaged,
            notes: it.notes
          })),
          notes: notes.trim()
        };
      } else {
        payload = {
          received_quantity: receivingItems[0]?.incoming_received || 0,
          damaged_quantity: receivingItems[0]?.incoming_damaged || 0,
          notes: notes.trim()
        };
      }

      const res = await api.post(
        `products/purchase-requests/${selectedOrder.id}/receive-stock/`,
        payload
      );

      setFeedback({
        type: 'success',
        text: res.data.message || 'Goods received and inventory warehouse stock updated successfully!'
      });

      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      console.error('Stock receipt failed:', err);
      alert(err.response?.data?.error || 'Failed to record stock receiving.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-success border-opacity-25 bg-success bg-opacity-10">
            <i className="bi bi-box-arrow-in-down text-success"></i>
            <span className="small fw-bold text-success">Warehouse Physical Receiving</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Receive Products &amp; Update Inventory</h2>
          <p className="text-slate-500 text-xs mb-0">
            Inspect arriving supplier shipments, record good vs. damaged quantities, and increment warehouse stock.
          </p>
        </div>

        <Link
          to="/manager/procurement/purchase-orders"
          className="btn btn-outline-secondary rounded-pill px-3 py-2 text-xs font-bold"
        >
          View All Purchase Orders
        </Link>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      <div className="row g-4">
        {/* Left Column: Eligible Orders Awaiting Delivery */}
        <div className="col-12 col-lg-5">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 bg-white">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold text-slate-900 mb-0 text-sm">
                Orders Awaiting Delivery ({orders.length})
              </h6>
              <span className="badge bg-primary bg-opacity-10 text-primary">Authorized</span>
            </div>

            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                <p className="text-muted text-[11px] mt-2">Checking open shipments...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-4 text-muted text-xs">
                <i className="bi bi-check-circle fs-2 text-success mb-2 d-block"></i>
                <strong>No Open Deliveries</strong>
                <p className="text-slate-400 text-[11px] mb-0 mt-1">
                  All approved purchase orders have been received or none are currently awaiting fulfillment.
                </p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-2" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {orders.map((po) => {
                  const isSelected = selectedOrder?.id === po.id;
                  return (
                    <div
                      key={po.id}
                      className={`p-3 rounded-3 border transition cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary bg-opacity-10'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                      onClick={() => selectOrderForReceiving(po)}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <strong className="text-primary text-xs">{po.request_number}</strong>
                        <span className="badge bg-secondary text-[10px]">{po.status}</span>
                      </div>
                      <div className="fw-bold text-slate-900 text-xs">{po.supplier_name}</div>
                      <div className="text-slate-500 text-[11px] mt-1">
                        {po.items?.length > 1
                          ? `${po.items.length} product lines`
                          : po.product_name}
                      </div>
                      <div className="d-flex justify-content-between text-[11px] mt-2 text-slate-600 border-top pt-2">
                        <span>Ordered: <strong>{po.quantity} pcs</strong></span>
                        <span>Received: <strong className="text-success">{po.received_quantity}</strong></span>
                        <span>Outstanding: <strong className="text-danger">{po.outstanding_quantity}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Physical Receiving Form */}
        <div className="col-12 col-lg-7">
          {selectedOrder ? (
            <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 bg-white">
              <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3">
                <div>
                  <span className="text-muted text-[11px] uppercase font-bold">Inspect Arriving Goods</span>
                  <h5 className="fw-bold text-slate-900 mb-0 mt-1">
                    Receipt for PO: {selectedOrder.request_number}
                  </h5>
                  <small className="text-slate-500 text-xs">
                    Supplier: <strong>{selectedOrder.supplier_name}</strong>
                  </small>
                </div>
                <span className="badge bg-info text-dark px-3 py-2">
                  Status: {selectedOrder.status}
                </span>
              </div>

              {/* Warehouse Inventory Protection Notice */}
              <div className="alert alert-light border border-info border-opacity-25 rounded-3 p-3 text-xs mb-4">
                <div className="d-flex gap-2">
                  <i className="bi bi-shield-check text-success fs-5"></i>
                  <div>
                    <strong className="text-slate-900">Inventory Stock Protection:</strong>
                    <p className="mb-0 text-slate-600 mt-1">
                      Warehouse sellable stock will only be incremented by the <strong>Good Condition Received</strong> units.
                      Any damaged or missing units are documented for vendor return/credit and will NOT be added to sellable stock.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmitReceiving}>
                <div className="table-responsive mb-4">
                  <table className="table table-bordered align-middle text-xs mb-0">
                    <thead className="table-light text-slate-700">
                      <tr>
                        <th>Product</th>
                        <th className="text-center" style={{ width: '15%' }}>Ordered / Left</th>
                        <th className="text-center" style={{ width: '22%' }}>Good Units Received *</th>
                        <th className="text-center" style={{ width: '22%' }}>Damaged / Defect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivingItems.map((item, idx) => {
                        const remaining = Math.max(0, item.quantity - item.received_quantity);
                        return (
                          <tr key={idx}>
                            <td>
                              <strong className="text-slate-900 d-block">{item.product_name}</strong>
                              <small className="text-muted">Already Received: {item.received_quantity} pcs</small>
                            </td>
                            <td className="text-center">
                              <span className="d-block fw-bold text-slate-800">{item.quantity}</span>
                              <span className="badge bg-warning text-dark text-[10px]">
                                {remaining} remaining
                              </span>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max={remaining}
                                className="form-control form-control-sm text-center fw-bold text-success"
                                value={item.incoming_received}
                                onChange={(e) => handleItemReceivedChange(idx, e.target.value)}
                                required
                              />
                              <small className="text-muted text-[10px] d-block text-center mt-1">
                                Adds to warehouse
                              </small>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className="form-control form-control-sm text-center text-danger font-bold"
                                value={item.incoming_damaged}
                                onChange={(e) => handleItemDamagedChange(idx, e.target.value)}
                              />
                              <small className="text-muted text-[10px] d-block text-center mt-1">
                                Logged as damaged
                              </small>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mb-4">
                  <label className="form-label text-xs fw-bold text-slate-700">Receiving Notes / Inspection Comments</label>
                  <textarea
                    className="form-control text-xs"
                    rows="2"
                    placeholder="e.g. Delivered by ABC Logistics truck. Boxes undamaged, factory seals intact. Batch inspected."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  ></textarea>
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                    onClick={() => setSelectedOrder(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-success rounded-pill px-4 font-bold d-flex align-items-center gap-2"
                    disabled={submitting}
                  >
                    <i className="bi bi-check2-circle"></i>
                    <span>{submitting ? 'Recording Receipt...' : 'Confirm Goods Receipt & Update Stock'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 bg-white text-center text-muted">
              <i className="bi bi-box-seam fs-1 text-slate-300 mb-3 d-block"></i>
              <h6 className="fw-bold text-slate-700">No Purchase Order Selected</h6>
              <p className="text-slate-500 text-xs mb-0">
                Select an authorized purchase order from the left list to begin recording goods receipt and inventory restocking.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiveProductsPage;
