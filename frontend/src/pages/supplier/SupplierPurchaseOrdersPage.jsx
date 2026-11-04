import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const SupplierPurchaseOrdersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'ALL';
  const preselectId = searchParams.get('select');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(initialFilter);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Response Sub-modals
  const [actionModal, setActionModal] = useState(null); // 'accept' | 'partial' | 'reject' | 'reschedule' | 'delivery' | 'print'
  const [submittingAction, setSubmittingAction] = useState(false);

  // Form states
  const [rejectionReason, setRejectionReason] = useState('');
  const [suggestedDate, setSuggestedDate] = useState('');
  const [responseNotes, setResponseNotes] = useState('');
  const [partialItems, setPartialItems] = useState({});

  // Delivery Form
  const [deliveryStatus, setDeliveryStatus] = useState('PREPARING_ORDER');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('supplier/purchase-orders/');
      const list = res.data.results || res.data || [];
      setOrders(list);
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
      setFeedback({ type: 'danger', text: 'Failed to load purchase orders.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const loadOrderDetail = useCallback(async (id) => {
    try {
      setLoadingDetail(true);
      const res = await api.get(`supplier/purchase-orders/${id}/`);
      setSelectedOrder(res.data);
      // Initialize partial items state
      const initialPartials = {};
      (res.data.items || []).forEach((it) => {
        initialPartials[it.id] = it.confirmed_quantity ?? it.requested_quantity ?? it.quantity;
      });
      setPartialItems(initialPartials);
    } catch (err) {
      console.error('Failed to load order detail:', err);
      setFeedback({ type: 'danger', text: 'Could not load order details.' });
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (preselectId && orders.length > 0) {
      loadOrderDetail(preselectId);
    }
  }, [preselectId, orders, loadOrderDetail]);

  // Tab Filtering
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        (o.request_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.notes || '').toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      const st = (o.status || '').toUpperCase();
      if (activeTab === 'AWAITING') {
        return st === 'AWAITING_SUPPLIER' || st === 'SENT_TO_SUPPLIER';
      }
      if (activeTab === 'ACCEPTED') {
        return st === 'ACCEPTED' || st === 'PARTIALLY_ACCEPTED';
      }
      if (activeTab === 'FULFILLMENT') {
        return st === 'PREPARING_ORDER' || st === 'READY_FOR_DELIVERY';
      }
      if (activeTab === 'SHIPPED') {
        return st === 'SHIPPED';
      }
      if (activeTab === 'DELIVERED') {
        return st === 'DELIVERED' || st === 'RECEIVED' || st === 'COMPLETED';
      }
      if (activeTab === 'REJECTED') {
        return st === 'REJECTED' || st === 'CANCELLED';
      }
      return true; // ALL
    });
  }, [orders, search, activeTab]);

  const handleOpenOrder = (id) => {
    loadOrderDetail(id);
    setActionModal(null);
  };

  const handleCloseDetail = () => {
    setSelectedOrder(null);
    setActionModal(null);
    if (searchParams.get('select')) {
      searchParams.delete('select');
      setSearchParams(searchParams);
    }
  };

  // Submit Order Response
  const handleSubmitResponse = async (actionType) => {
    if (!selectedOrder) return;

    if (actionType === 'reject' && !rejectionReason.trim()) {
      alert('Please provide a reason for rejecting this purchase order.');
      return;
    }

    if (actionType === 'reschedule' && !suggestedDate) {
      alert('Please specify the suggested delivery date.');
      return;
    }

    try {
      setSubmittingAction(true);
      const payload = {
        action: actionType,
        notes: responseNotes,
        rejection_reason: rejectionReason,
        suggested_delivery_date: suggestedDate,
      };

      if (actionType === 'partial' || actionType === 'accept') {
        payload.confirmed_items = Object.entries(partialItems).map(([id, qty]) => ({
          id: parseInt(id, 10),
          confirmed_quantity: parseInt(qty, 10) || 0,
        }));
      }

      const res = await api.post(`supplier/purchase-orders/${selectedOrder.id}/respond/`, payload);
      setFeedback({ type: 'success', text: res.data.message || 'Response successfully submitted to EthioTech Market.' });
      setActionModal(null);
      await loadOrderDetail(selectedOrder.id);
      await fetchOrders();
    } catch (err) {
      console.error('Failed to submit response:', err);
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to submit response.';
      alert(`Error: ${msg}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Delivery Tracking Update
  const handleSubmitDeliveryUpdate = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    if (deliveryStatus === 'SHIPPED' && !carrier.trim()) {
      alert('Carrier name is required when marking order as shipped.');
      return;
    }

    try {
      setSubmittingAction(true);
      const payload = {
        status: deliveryStatus,
        shipping_carrier: carrier,
        tracking_number: trackingNumber,
        notes: deliveryNotes,
      };

      const res = await api.post(`supplier/purchase-orders/${selectedOrder.id}/delivery-update/`, payload);
      setFeedback({ type: 'success', text: res.data.message || 'Fulfillment status updated.' });
      setActionModal(null);
      await loadOrderDetail(selectedOrder.id);
      await fetchOrders();
    } catch (err) {
      console.error('Failed to update delivery:', err);
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to update delivery status.';
      alert(`Error: ${msg}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'AWAITING_SUPPLIER':
      case 'SENT_TO_SUPPLIER':
        return <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1"><i className="bi bi-clock-history me-1"></i>Awaiting Response</span>;
      case 'ACCEPTED':
        return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i className="bi bi-check-circle me-1"></i>Accepted</span>;
      case 'PARTIALLY_ACCEPTED':
        return <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1"><i className="bi bi-dash-circle me-1"></i>Partially Accepted</span>;
      case 'PREPARING_ORDER':
        return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1"><i className="bi bi-box-seam me-1"></i>Preparing</span>;
      case 'READY_FOR_DELIVERY':
        return <span className="badge bg-cyan bg-opacity-10 text-cyan-600 border border-info border-opacity-25 px-2 py-1"><i className="bi bi-truck-flatbed me-1"></i>Ready for Delivery</span>;
      case 'SHIPPED':
        return <span className="badge bg-purple bg-opacity-10 text-indigo-600 border border-indigo-200 px-2 py-1"><i className="bi bi-send-check me-1"></i>Shipped / In Transit</span>;
      case 'DELIVERED':
      case 'RECEIVED':
      case 'COMPLETED':
        return <span className="badge bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1"><i className="bi bi-check2-all me-1"></i>Delivered</span>;
      case 'REJECTED':
      case 'CANCELLED':
        return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1"><i className="bi bi-x-circle me-1"></i>Declined</span>;
      default:
        return <span className="badge bg-secondary bg-opacity-10 text-secondary px-2 py-1">{status}</span>;
    }
  };

  const isAwaitingAction = (st) => {
    const s = (st || '').toUpperCase();
    return s === 'AWAITING_SUPPLIER' || s === 'SENT_TO_SUPPLIER';
  };

  const isFulfillable = (st) => {
    const s = (st || '').toUpperCase();
    return (
      s === 'ACCEPTED' ||
      s === 'PARTIALLY_ACCEPTED' ||
      s === 'PREPARING_ORDER' ||
      s === 'READY_FOR_DELIVERY' ||
      s === 'SHIPPED'
    );
  };

  return (
    <div className="container-fluid px-0">
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bolder text-slate-900 mb-1">
            <i className="bi bi-clipboard2-check me-2 text-teal-600"></i>
            Purchase Orders
          </h4>
          <p className="text-slate-500 text-xs mb-0">
            Review orders, confirm line item quantities, report availability, and update fulfillment progress.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs"
            onClick={fetchOrders}
            title="Refresh Orders"
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh
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

      {/* Filter Tabs */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-2 mb-3 bg-white">
        <div className="d-flex flex-wrap gap-1">
          {[
            { id: 'ALL', label: 'All Orders', icon: 'bi-grid' },
            { id: 'AWAITING', label: 'Action Needed', icon: 'bi-clock-history' },
            { id: 'ACCEPTED', label: 'Accepted', icon: 'bi-check-circle' },
            { id: 'FULFILLMENT', label: 'In Preparation', icon: 'bi-box-seam' },
            { id: 'SHIPPED', label: 'In Transit', icon: 'bi-truck' },
            { id: 'DELIVERED', label: 'Delivered', icon: 'bi-check2-all' },
            { id: 'REJECTED', label: 'Declined', icon: 'bi-x-circle' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'btn-light text-slate-600 hover-bg-slate-100'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`bi ${tab.icon} me-1.5`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-6 col-lg-5">
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control text-xs"
                placeholder="Search by PO Number or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-auto ms-auto text-xs text-slate-500">
            Showing <strong className="text-slate-900">{filteredOrders.length}</strong> purchase orders
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-teal-600" role="status" style={{ color: '#0d9488' }}></div>
            <p className="text-muted small mt-2">Loading purchase orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-clipboard-x fs-1 text-slate-300 mb-2 d-block"></i>
            <h6 className="fw-bold text-slate-700">No Purchase Orders Found</h6>
            <p className="text-slate-500 text-xs mb-0">
              {search || activeTab !== 'ALL'
                ? 'No orders match the selected filter.'
                : 'No purchase orders have been sent to your account yet.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
                <tr>
                  <th className="ps-4">PO Reference</th>
                  <th>Date Issued</th>
                  <th>Expected Delivery</th>
                  <th>Delivery Location</th>
                  <th>Total Cost</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="ps-4">
                      <div
                        className="fw-bold font-monospace text-slate-900 cursor-pointer text-teal-700 hover:underline"
                        onClick={() => handleOpenOrder(o.id)}
                      >
                        {o.request_number || `PO-${o.id}`}
                      </div>
                      {o.items && o.items.length > 0 && (
                        <small className="text-slate-400 text-[11px]">
                          {o.items.length} line {o.items.length === 1 ? 'item' : 'items'}
                        </small>
                      )}
                    </td>
                    <td className="text-slate-600">
                      {o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="text-slate-600 font-semibold">
                      {o.expected_delivery_date
                        ? new Date(o.expected_delivery_date).toLocaleDateString()
                        : 'Not specified'}
                    </td>
                    <td className="text-slate-600 text-truncate" style={{ maxWidth: '180px' }}>
                      {o.delivery_location || 'Main EthioTech Warehouse'}
                    </td>
                    <td className="fw-bold text-slate-900">
                      {formatETB(o.total_cost || 0)}
                    </td>
                    <td>
                      {getStatusBadge(o.status)}
                    </td>
                    <td className="text-end pe-4">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-teal rounded-pill px-3 py-1 text-xs"
                        style={{ borderColor: '#0d9488', color: '#0d9488' }}
                        onClick={() => handleOpenOrder(o.id)}
                      >
                        {isAwaitingAction(o.status) ? (
                          <span className="fw-bold">
                            <i className="bi bi-pencil-square me-1"></i> Respond
                          </span>
                        ) : (
                          <span>
                            <i className="bi bi-eye me-1"></i> Review
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail & Actions Modal */}
      {selectedOrder && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              {/* Modal Header */}
              <div className="modal-header bg-slate-900 text-white border-bottom border-slate-800 pb-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-3 p-1.5 bg-teal-600 text-white">
                    <i className="bi bi-file-earmark-text fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-white mb-0">
                      Purchase Order: {selectedOrder.request_number || `PO-${selectedOrder.id}`}
                    </h5>
                    <small className="text-slate-400 text-xs">
                      Issued on {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString() : '—'}
                    </small>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light rounded-pill px-2.5 py-1 text-xs"
                    onClick={() => setActionModal('print')}
                    title="Print Purchase Order"
                  >
                    <i className="bi bi-printer me-1"></i> Print / PDF
                  </button>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={handleCloseDetail}
                    aria-label="Close"
                  ></button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-slate-50">
                {/* Status & Fulfillment Tracking Banner */}
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white mb-4">
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom border-slate-100">
                    <div>
                      <span className="text-slate-500 text-xs uppercase font-semibold">Current State:</span>
                      <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs uppercase font-semibold">Expected Delivery:</span>
                      <div className="fw-bold text-slate-900 text-sm mt-0.5">
                        {selectedOrder.expected_delivery_date
                          ? new Date(selectedOrder.expected_delivery_date).toLocaleDateString()
                          : 'Immediate / As agreed'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs uppercase font-semibold">Destination:</span>
                      <div className="fw-semibold text-slate-800 text-xs mt-0.5">
                        {selectedOrder.delivery_location || 'EthioTech Central Depot, Addis Ababa'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs uppercase font-semibold">Total Order Value:</span>
                      <div className="fw-bold text-teal-700 text-sm mt-0.5">
                        {formatETB(selectedOrder.total_cost || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Carrier / Tracking Information if present */}
                  {selectedOrder.supplier_shipping_carrier && (
                    <div className="alert alert-info py-2 px-3 rounded-3 text-xs mb-0 d-flex align-items-center justify-content-between">
                      <div>
                        <i className="bi bi-truck me-2"></i>
                        Carrier: <strong>{selectedOrder.supplier_shipping_carrier}</strong> | Tracking / Waybill: <strong>{selectedOrder.supplier_tracking_number || 'N/A'}</strong>
                      </div>
                      {selectedOrder.supplier_dispatched_at && (
                        <div className="text-slate-500">
                          Dispatched: {new Date(selectedOrder.supplier_dispatched_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Supplier Notes / Reasons if present */}
                  {selectedOrder.supplier_rejection_reason && (
                    <div className="alert alert-danger py-2 px-3 rounded-3 text-xs mb-0 mt-2">
                      <i className="bi bi-exclamation-circle me-1.5"></i>
                      Rejection Reason: <strong>{selectedOrder.supplier_rejection_reason}</strong>
                    </div>
                  )}
                  {selectedOrder.supplier_suggested_delivery_date && (
                    <div className="alert alert-warning py-2 px-3 rounded-3 text-xs mb-0 mt-2">
                      <i className="bi bi-calendar-event me-1.5"></i>
                      Supplier Suggested Delivery Date: <strong>{selectedOrder.supplier_suggested_delivery_date}</strong>
                    </div>
                  )}
                </div>

                {/* Line Items Table */}
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
                  <div className="card-header bg-white py-3 px-3 border-bottom border-slate-100 d-flex align-items-center justify-content-between">
                    <h6 className="fw-bold text-slate-900 mb-0">Requested Line Items</h6>
                    <span className="text-xs text-slate-500">
                      Total items: <strong>{(selectedOrder.items || []).length}</strong>
                    </span>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 text-xs">
                      <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                        <tr>
                          <th className="ps-3">Product Name</th>
                          <th>SKU / Code</th>
                          <th className="text-center">Requested Qty</th>
                          <th className="text-center">Confirmed Qty</th>
                          <th className="text-end">Unit Price</th>
                          <th className="text-end pe-3">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedOrder.items || []).map((item) => (
                          <tr key={item.id}>
                            <td className="ps-3 fw-bold text-slate-900">
                              {item.product_name || `Product #${item.product_id}`}
                            </td>
                            <td className="font-monospace text-slate-500">
                              {item.product_sku || '—'}
                            </td>
                            <td className="text-center fw-semibold text-slate-800">
                              {item.requested_quantity ?? item.quantity}
                            </td>
                            <td className="text-center">
                              {actionModal === 'partial' ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={item.requested_quantity ?? item.quantity}
                                  className="form-control form-control-sm text-center mx-auto"
                                  style={{ width: '80px' }}
                                  value={partialItems[item.id] ?? ''}
                                  onChange={(e) =>
                                    setPartialItems({
                                      ...partialItems,
                                      [item.id]: e.target.value,
                                    })
                                  }
                                />
                              ) : (
                                <span className={`badge ${
                                  item.confirmed_quantity !== null && item.confirmed_quantity < (item.requested_quantity ?? item.quantity)
                                    ? 'bg-warning bg-opacity-10 text-warning border border-warning'
                                    : 'bg-slate-100 text-slate-800'
                                }`}>
                                  {item.confirmed_quantity !== null ? item.confirmed_quantity : (item.requested_quantity ?? item.quantity)}
                                </span>
                              )}
                            </td>
                            <td className="text-end text-slate-700">
                              {formatETB(item.unit_price || 0)}
                            </td>
                            <td className="text-end pe-3 fw-bold text-slate-900">
                              {formatETB(item.total_price || (item.unit_price * (item.confirmed_quantity ?? item.requested_quantity ?? item.quantity)) || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="table-light">
                        <tr>
                          <td colSpan="5" className="text-end fw-bold text-slate-700 ps-3">Grand Total:</td>
                          <td className="text-end pe-3 fw-bolder text-teal-700 fs-6">
                            {formatETB(selectedOrder.total_cost || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Additional Notes / Instructions from Store Manager */}
                {selectedOrder.notes && (
                  <div className="card border-0 shadow-sm rounded-4 p-3 bg-white mb-4">
                    <h6 className="fw-bold text-slate-900 mb-1 text-xs uppercase tracking-wider">
                      Store Manager Notes & Instructions:
                    </h6>
                    <p className="text-slate-600 text-xs mb-0 bg-slate-50 p-2.5 rounded-3 border border-slate-100">
                      {selectedOrder.notes}
                    </p>
                  </div>
                )}

                {/* ACTION FORMS (Awaiting Response) */}
                {isAwaitingAction(selectedOrder.status) && (
                  <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border-top border-4 border-warning">
                    <h6 className="fw-bold text-slate-900 mb-2">
                      <i className="bi bi-send-check text-warning me-2"></i>
                      Select Your Response to EthioTech Market
                    </h6>
                    <p className="text-slate-500 text-xs mb-3">
                      Please indicate whether you can fulfill this purchase order in full, partial quantity, need to propose a different date, or must decline.
                    </p>

                    <div className="d-flex flex-wrap gap-2 mb-3">
                      <button
                        type="button"
                        className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs font-semibold ${
                          actionModal === 'accept'
                            ? 'btn-success text-white'
                            : 'btn-outline-success'
                        }`}
                        onClick={() => setActionModal(actionModal === 'accept' ? null : 'accept')}
                      >
                        <i className="bi bi-check-circle me-1.5"></i>
                        Accept Order in Full
                      </button>

                      <button
                        type="button"
                        className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs font-semibold ${
                          actionModal === 'partial'
                            ? 'btn-info text-white'
                            : 'btn-outline-info'
                        }`}
                        onClick={() => setActionModal(actionModal === 'partial' ? null : 'partial')}
                      >
                        <i className="bi bi-dash-circle me-1.5"></i>
                        Accept with Partial Quantities
                      </button>

                      <button
                        type="button"
                        className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs font-semibold ${
                          actionModal === 'reschedule'
                            ? 'btn-warning text-slate-900'
                            : 'btn-outline-warning'
                        }`}
                        onClick={() => setActionModal(actionModal === 'reschedule' ? null : 'reschedule')}
                      >
                        <i className="bi bi-calendar2-range me-1.5"></i>
                        Suggest Alternate Delivery Date
                      </button>

                      <button
                        type="button"
                        className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs font-semibold ${
                          actionModal === 'reject'
                            ? 'btn-danger text-white'
                            : 'btn-outline-danger'
                        }`}
                        onClick={() => setActionModal(actionModal === 'reject' ? null : 'reject')}
                      >
                        <i className="bi bi-x-circle me-1.5"></i>
                        Decline Order
                      </button>
                    </div>

                    {/* Sub-form based on selection */}
                    {actionModal === 'accept' && (
                      <div className="bg-success bg-opacity-10 p-3 rounded-3 border border-success border-opacity-25 mt-2">
                        <h6 className="fw-bold text-success text-xs mb-1">Confirm Full Acceptance</h6>
                        <p className="text-slate-600 text-xs mb-2">
                          You are confirming that you will supply 100% of the requested items at the agreed prices by the specified delivery date.
                        </p>
                        <div className="mb-3">
                          <label className="form-label text-xs fw-semibold text-slate-700">Optional Notes for EthioTech Procurement:</label>
                          <input
                            type="text"
                            className="form-control text-xs"
                            placeholder="e.g., Stock reserved, preparing dispatch packaging..."
                            value={responseNotes}
                            onChange={(e) => setResponseNotes(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-success rounded-pill px-4 text-xs fw-bold"
                          disabled={submittingAction}
                          onClick={() => handleSubmitResponse('accept')}
                        >
                          {submittingAction ? 'Submitting...' : 'Confirm Acceptance'}
                        </button>
                      </div>
                    )}

                    {actionModal === 'partial' && (
                      <div className="bg-info bg-opacity-10 p-3 rounded-3 border border-info border-opacity-25 mt-2">
                        <h6 className="fw-bold text-info-emphasis text-xs mb-1">Confirm Partial Fulfillment</h6>
                        <p className="text-slate-600 text-xs mb-2">
                          Please edit the "Confirmed Qty" column in the table above for any product that is partially available or out of stock.
                        </p>
                        <div className="mb-3">
                          <label className="form-label text-xs fw-semibold text-slate-700">Explanation for partial supply:</label>
                          <input
                            type="text"
                            className="form-control text-xs"
                            placeholder="e.g., Limited factory allocation for Model X..."
                            value={responseNotes}
                            onChange={(e) => setResponseNotes(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-info text-white rounded-pill px-4 text-xs fw-bold"
                          disabled={submittingAction}
                          onClick={() => handleSubmitResponse('partial')}
                        >
                          {submittingAction ? 'Submitting...' : 'Submit Partial Acceptance'}
                        </button>
                      </div>
                    )}

                    {actionModal === 'reschedule' && (
                      <div className="bg-warning bg-opacity-10 p-3 rounded-3 border border-warning border-opacity-25 mt-2">
                        <h6 className="fw-bold text-warning-emphasis text-xs mb-1">Propose New Delivery Date</h6>
                        <p className="text-slate-600 text-xs mb-2">
                          Specify when you can realistically deliver the requested goods.
                        </p>
                        <div className="row g-2 mb-3">
                          <div className="col-12 col-md-6">
                            <label className="form-label text-xs fw-semibold text-slate-700">Suggested Delivery Date *</label>
                            <input
                              type="date"
                              className="form-control text-xs"
                              value={suggestedDate}
                              onChange={(e) => setSuggestedDate(e.target.value)}
                              required
                            />
                          </div>
                          <div className="col-12 col-md-6">
                            <label className="form-label text-xs fw-semibold text-slate-700">Reason for Schedule Adjustment</label>
                            <input
                              type="text"
                              className="form-control text-xs"
                              placeholder="e.g., Shipping cargo delays, clearance..."
                              value={responseNotes}
                              onChange={(e) => setResponseNotes(e.target.value)}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-warning rounded-pill px-4 text-xs fw-bold text-slate-900"
                          disabled={submittingAction}
                          onClick={() => handleSubmitResponse('reschedule')}
                        >
                          {submittingAction ? 'Submitting...' : 'Send Reschedule Proposal'}
                        </button>
                      </div>
                    )}

                    {actionModal === 'reject' && (
                      <div className="bg-danger bg-opacity-10 p-3 rounded-3 border border-danger border-opacity-25 mt-2">
                        <h6 className="fw-bold text-danger text-xs mb-1">Decline Purchase Order</h6>
                        <p className="text-slate-600 text-xs mb-2">
                          Please state clearly why this order cannot be fulfilled.
                        </p>
                        <div className="mb-3">
                          <label className="form-label text-xs fw-semibold text-slate-700">Reason for Declining *</label>
                          <textarea
                            className="form-control text-xs"
                            rows="2"
                            placeholder="e.g., Products discontinued, insufficient lead time, price discrepancy..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            required
                          ></textarea>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger rounded-pill px-4 text-xs fw-bold"
                          disabled={submittingAction}
                          onClick={() => handleSubmitResponse('reject')}
                        >
                          {submittingAction ? 'Declining...' : 'Confirm Decline'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* FULFILLMENT / DELIVERY PROGRESS UPDATE */}
                {isFulfillable(selectedOrder.status) && (
                  <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border-top border-4 border-cyan-500">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div>
                        <h6 className="fw-bold text-slate-900 mb-0">
                          <i className="bi bi-truck text-cyan-600 me-2"></i>
                          Update Fulfillment & Delivery Progress
                        </h6>
                        <small className="text-slate-500 text-xs">
                          Keep EthioTech logistics informed of your packaging, dispatch, and delivery status.
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-cyan text-white rounded-pill px-3 py-1 text-xs font-semibold"
                        style={{ backgroundColor: '#0891b2' }}
                        onClick={() => setActionModal(actionModal === 'delivery' ? null : 'delivery')}
                      >
                        <i className="bi bi-arrow-repeat me-1"></i> Update Status
                      </button>
                    </div>

                    {actionModal === 'delivery' && (
                      <form onSubmit={handleSubmitDeliveryUpdate} className="bg-slate-50 p-3 rounded-3 border border-slate-200 mt-2">
                        <div className="row g-3">
                          <div className="col-12 col-md-4">
                            <label className="form-label text-xs fw-semibold text-slate-700">New Fulfillment Status *</label>
                            <select
                              className="form-select text-xs"
                              value={deliveryStatus}
                              onChange={(e) => setDeliveryStatus(e.target.value)}
                              required
                            >
                              <option value="PREPARING_ORDER">Preparing Order (Packing / Staging)</option>
                              <option value="READY_FOR_DELIVERY">Ready for Delivery / Pick-up</option>
                              <option value="SHIPPED">Shipped / Dispatched (In Transit)</option>
                              <option value="DELIVERED">Delivered to Warehouse Dock</option>
                            </select>
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="form-label text-xs fw-semibold text-slate-700">
                              Carrier / Transport Vehicle {deliveryStatus === 'SHIPPED' ? '*' : '(Optional)'}
                            </label>
                            <input
                              type="text"
                              className="form-control text-xs"
                              placeholder="e.g., Ethio Post, DHL, Supplier Van #ET-4432"
                              value={carrier}
                              onChange={(e) => setCarrier(e.target.value)}
                              required={deliveryStatus === 'SHIPPED'}
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="form-label text-xs fw-semibold text-slate-700">
                              Waybill / Tracking / Consignment #
                            </label>
                            <input
                              type="text"
                              className="form-control text-xs"
                              placeholder="e.g., TRK-987654"
                              value={trackingNumber}
                              onChange={(e) => setTrackingNumber(e.target.value)}
                            />
                          </div>

                          <div className="col-12">
                            <label className="form-label text-xs fw-semibold text-slate-700">Delivery Notes / Handover Details</label>
                            <input
                              type="text"
                              className="form-control text-xs"
                              placeholder="e.g., Fragile cartons marked; driver contact: 0911..."
                              value={deliveryNotes}
                              onChange={(e) => setDeliveryNotes(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="d-flex justify-content-end gap-2 mt-3">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs"
                            onClick={() => setActionModal(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="btn btn-sm btn-primary rounded-pill px-4 text-xs fw-bold"
                            disabled={submittingAction}
                          >
                            {submittingAction ? 'Updating...' : 'Save Fulfillment Update'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="modal-footer bg-white border-top border-slate-200 py-2.5 px-4 d-flex justify-content-between">
                <div className="text-slate-400 text-xs">
                  EthioTech Market &bull; Supplier Procurement Services
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary rounded-pill px-4 text-xs"
                  onClick={handleCloseDetail}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable PO Modal */}
      {actionModal === 'print' && selectedOrder && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4">
              <div className="modal-header bg-slate-900 text-white py-2 px-3">
                <span className="text-xs fw-bold">Official Purchase Order Document</span>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActionModal(null)}></button>
              </div>
              <div className="modal-body p-4 bg-white" id="printable-po-area">
                <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                  <div>
                    <h4 className="fw-bolder text-slate-900 mb-0">EthioTech Market</h4>
                    <p className="text-slate-500 text-xs mb-0">Bole Subcity, Addis Ababa, Ethiopia | orders@ethiotech.com</p>
                  </div>
                  <div className="text-end">
                    <span className="badge bg-slate-100 text-slate-800 border px-3 py-1 font-monospace text-xs">
                      {selectedOrder.request_number || `PO-${selectedOrder.id}`}
                    </span>
                    <div className="text-slate-400 text-[11px] mt-1">
                      Date: {new Date(selectedOrder.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="row g-3 text-xs mb-3">
                  <div className="col-6">
                    <strong className="text-slate-800 d-block uppercase text-[10px] text-slate-400">Supplier / Vendor:</strong>
                    <div className="fw-bold text-slate-900">{selectedOrder.supplier_name}</div>
                    <div>{selectedOrder.supplier_email}</div>
                    <div>{selectedOrder.supplier_phone}</div>
                  </div>
                  <div className="col-6 text-end">
                    <strong className="text-slate-800 d-block uppercase text-[10px] text-slate-400">Ship To Warehouse:</strong>
                    <div className="fw-bold text-slate-900">{selectedOrder.delivery_location || 'EthioTech Central Logistics Depot'}</div>
                    <div>Addis Ababa, Ethiopia</div>
                    <div>Expected: {selectedOrder.expected_delivery_date || 'Prompt Delivery'}</div>
                  </div>
                </div>

                <table className="table table-bordered table-sm text-xs mb-3">
                  <thead className="table-light text-slate-600">
                    <tr>
                      <th>#</th>
                      <th>Item Description</th>
                      <th>SKU</th>
                      <th className="text-center">Qty</th>
                      <th className="text-end">Unit Price</th>
                      <th className="text-end">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrder.items || []).map((it, idx) => (
                      <tr key={it.id}>
                        <td>{idx + 1}</td>
                        <td className="fw-semibold">{it.product_name}</td>
                        <td className="font-monospace text-slate-500">{it.product_sku || '—'}</td>
                        <td className="text-center">{it.confirmed_quantity ?? it.requested_quantity ?? it.quantity}</td>
                        <td className="text-end">{formatETB(it.unit_price || 0)}</td>
                        <td className="text-end fw-bold">{formatETB(it.total_price || (it.unit_price * (it.confirmed_quantity ?? it.requested_quantity ?? it.quantity)) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan="5" className="text-end">Total Value:</th>
                      <th className="text-end fw-bolder text-teal-700">{formatETB(selectedOrder.total_cost || 0)}</th>
                    </tr>
                  </tfoot>
                </table>

                {selectedOrder.notes && (
                  <div className="text-xs text-slate-600 border p-2 rounded mb-3">
                    <strong>Instructions:</strong> {selectedOrder.notes}
                  </div>
                )}

                <div className="border-top pt-3 text-[11px] text-slate-400 text-center">
                  This document serves as an official commercial purchase order contract issued by EthioTech Market.
                </div>
              </div>
              <div className="modal-footer py-2 bg-light d-flex justify-content-between">
                <button type="button" className="btn btn-sm btn-secondary rounded-pill px-3 text-xs" onClick={() => setActionModal(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary rounded-pill px-4 text-xs fw-bold"
                  onClick={() => window.print()}
                >
                  <i className="bi bi-printer me-1"></i> Print / Save as PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPurchaseOrdersPage;

