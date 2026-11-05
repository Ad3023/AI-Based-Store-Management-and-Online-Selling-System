import React from 'react';
import { formatETB } from '../../../utils/currency';
import POStatusBadge from './POStatusBadge';

export const POInspectorModal = ({ order, onClose, isAdmin, isSuperAdmin, onOpenDecision }) => {
  if (!order) return null;
  const isPending = order.status === 'PENDING_APPROVAL' || order.status === 'SUBMITTED';

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className="modal-header bg-slate-900 text-white pb-3">
            <div className="d-flex align-items-center gap-2">
              <div className="p-2 rounded-3 bg-primary bg-opacity-25 text-white">
                <i className="bi bi-receipt-cutoff fs-5"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold text-white text-sm mb-0">PO: {order.request_number}</h5>
                <small className="text-slate-400 text-xs">Supplier: {order.supplier_name}</small>
              </div>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4 bg-slate-50 text-xs">
            <div className="row g-2 mb-4">
              <div className="col-4">
                <div className="p-3 bg-white rounded-3 border text-center">
                  <span className="text-muted d-block text-[10px] uppercase font-bold">Status</span>
                  <div className="mt-1"><POStatusBadge status={order.status} /></div>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 bg-white rounded-3 border text-center">
                  <span className="text-muted d-block text-[10px] uppercase font-bold">Total Cost</span>
                  <h5 className="fw-bolder text-primary mb-0 mt-1">{formatETB(order.total_estimated_cost)}</h5>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 bg-white rounded-3 border text-center">
                  <span className="text-muted d-block text-[10px] uppercase font-bold">Received Units</span>
                  <h5 className="fw-bolder text-success mb-0 mt-1">{order.received_quantity} / {order.quantity}</h5>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm rounded-3 p-3 mb-4 bg-white">
              <h6 className="fw-bold text-slate-800 text-xs mb-2">Audit &amp; Timeline</h6>
              <div className="row g-2">
                <div className="col-6 col-md-3">
                  <span className="text-muted d-block">Requested By:</span>
                  <strong className="text-slate-800">{order.requested_by_username || 'Staff'}</strong>
                </div>
                <div className="col-6 col-md-3">
                  <span className="text-muted d-block">Created:</span>
                  <strong className="text-slate-800">{new Date(order.created_at).toLocaleDateString()}</strong>
                </div>
                <div className="col-6 col-md-3">
                  <span className="text-muted d-block">Approved By:</span>
                  <strong className="text-slate-800">{order.approved_by_username || 'Pending Admin'}</strong>
                </div>
                <div className="col-6 col-md-3">
                  <span className="text-muted d-block">Target Delivery:</span>
                  <strong className="text-slate-800">{order.expected_supply_date || 'Not specified'}</strong>
                </div>
              </div>

              {order.admin_feedback && (
                <div className="mt-3 p-2 rounded-2 bg-light border border-slate-200">
                  <strong className="text-slate-700 d-block">Admin Comments:</strong>
                  <span className="text-slate-600">{order.admin_feedback}</span>
                </div>
              )}
              {order.notes && (
                <div className="mt-2 text-slate-600">
                  <span className="text-muted d-block">Store Notes:</span>
                  {order.notes}
                </div>
              )}
            </div>

            <h6 className="fw-bold text-slate-800 text-xs mb-2">Replenishment Items</h6>
            <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white mb-3">
              <div className="table-responsive">
                <table className="table table-bordered align-middle mb-0 text-xs">
                  <thead className="table-light">
                    <tr>
                      <th>Product</th>
                      <th className="text-center">Ordered</th>
                      <th className="text-center">Received</th>
                      <th className="text-center">Damaged</th>
                      <th className="text-end">Unit Price</th>
                      <th className="text-end">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items && order.items.length > 0 ? (
                      order.items.map((it) => (
                        <tr key={it.id}>
                          <td className="fw-semibold text-slate-900">{it.product_name}</td>
                          <td className="text-center">{it.quantity}</td>
                          <td className="text-center text-success font-bold">{it.received_quantity}</td>
                          <td className="text-center text-danger">{it.damaged_quantity}</td>
                          <td className="text-end">{formatETB(it.unit_price)}</td>
                          <td className="text-end fw-bold text-slate-900">{formatETB(it.total_cost)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="fw-semibold text-slate-900">{order.product_name || 'Item'}</td>
                        <td className="text-center">{order.quantity}</td>
                        <td className="text-center text-success font-bold">{order.received_quantity}</td>
                        <td className="text-center text-danger">{order.damaged_quantity}</td>
                        <td className="text-end">{formatETB(order.estimated_unit_cost)}</td>
                        <td className="text-end fw-bold text-slate-900">{formatETB(order.total_estimated_cost)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="modal-footer border-top bg-white p-3 d-flex justify-content-between">
            <div>
              {(isAdmin || isSuperAdmin) && isPending && (
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-sm btn-success rounded-pill px-3" onClick={() => onOpenDecision('approve')}>
                    <i className="bi bi-check-lg me-1"></i> Approve PO
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-danger rounded-pill px-3" onClick={() => onOpenDecision('reject')}>
                    <i className="bi bi-x-lg me-1"></i> Reject PO
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="btn btn-sm btn-secondary rounded-pill px-4" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POInspectorModal;

