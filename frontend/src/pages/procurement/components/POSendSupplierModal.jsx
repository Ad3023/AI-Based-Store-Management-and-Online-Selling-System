import React from 'react';

export const POSendSupplierModal = ({ modal, onClose, onConfirm, submitting }) => {
  if (!modal.show || !modal.order) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className="modal-header bg-info text-dark pb-3">
            <h5 className="modal-title fw-bold text-sm">Send Order to Supplier</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4 text-xs bg-slate-50">
            <div className="p-3 bg-white rounded-3 border mb-3">
              <span className="text-muted d-block">Purchase Order:</span>
              <strong className="fs-6 text-slate-900">{modal.order.request_number}</strong>
              <div className="text-slate-600 mt-1">
                Recipient Supplier: <strong>{modal.order.supplier_name}</strong>
              </div>
            </div>
            <div className="mb-2">
              <label className="form-label text-xs fw-bold text-slate-700">Dispatch Notes / Reference:</label>
              <textarea
                className="form-control text-xs"
                rows="3"
                placeholder="e.g. Sent via email / vendor portal. Expected dock arrival next week."
                value={modal.notes}
                onChange={(e) => modal.setNotes(e.target.value)}
              ></textarea>
            </div>
          </div>
          <div className="modal-footer border-top bg-white p-3">
            <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-info text-dark rounded-pill px-4 font-bold"
              disabled={submitting}
              onClick={onConfirm}
            >
              {submitting ? 'Recording...' : 'Mark as Sent to Supplier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSendSupplierModal;

