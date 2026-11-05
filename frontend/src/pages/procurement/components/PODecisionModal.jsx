import React from 'react';
import { formatETB } from '../../../utils/currency';

export const PODecisionModal = ({ modal, onClose, onConfirm, submitting }) => {
  if (!modal.show || !modal.order) return null;
  const isApprove = modal.action === 'approve';

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className={`modal-header ${isApprove ? 'bg-success' : 'bg-danger'} text-white pb-3`}>
            <h5 className="modal-title fw-bold text-sm text-white">
              {isApprove ? 'Approve Purchase Order' : 'Reject Purchase Order'}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4 text-xs bg-slate-50">
            <div className="mb-3 p-3 bg-white rounded-3 border">
              <span className="text-muted d-block">Purchase Order:</span>
              <strong className="fs-6 text-slate-900">{modal.order.request_number}</strong>
              <div className="text-slate-600 mt-1">
                Supplier: <strong>{modal.order.supplier_name}</strong> | Total Cost:{' '}
                <strong className="text-primary">{formatETB(modal.order.total_estimated_cost)}</strong>
              </div>
            </div>

            <div className="mb-2">
              <label className="form-label text-xs fw-bold text-slate-700">
                {isApprove ? 'Approval Comments (Optional):' : 'Rejection Reason (Required): *'}
              </label>
              <textarea
                className="form-control text-xs"
                rows="3"
                placeholder={
                  isApprove
                    ? 'e.g. Approved within hardware procurement allocation.'
                    : 'e.g. Price higher than negotiated; please renegotiate.'
                }
                value={modal.feedbackText}
                onChange={(e) => modal.setFeedbackText(e.target.value)}
              ></textarea>
            </div>
          </div>
          <div className="modal-footer border-top bg-white p-3">
            <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn btn-sm ${isApprove ? 'btn-success' : 'btn-danger'} rounded-pill px-4 font-bold`}
              disabled={submitting}
              onClick={onConfirm}
            >
              {submitting ? 'Recording...' : isApprove ? 'Confirm Approval' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PODecisionModal;

