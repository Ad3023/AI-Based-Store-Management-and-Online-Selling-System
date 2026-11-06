import React, { useState } from 'react';
import api from '../../../api';

const SupplierDeclineRFQModal = ({ rfq, onClose, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!rfq) return null;

  const handleDecline = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      setSubmitting(true);
      await api.post(`supplier/rfqs/${rfq.id}/`, {
        action: 'decline',
        decline_reason: reason.trim()
      });
      onSuccess(`RFQ #${rfq.rfq_number} declined.`);
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to decline RFQ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block bg-slate-900/60 backdrop-blur-sm" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className="modal-header bg-slate-900 text-white px-4 py-3">
            <h6 className="modal-title fw-bold text-sm"><i className="bi bi-x-circle me-2 text-danger"></i>Decline Quotation Request</h6>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={submitting}></button>
          </div>
          <form onSubmit={handleDecline} className="modal-body p-4 text-xs">
            {errorMsg && <div className="alert alert-danger py-2 px-3 rounded-3 mb-3">{errorMsg}</div>}
            <p className="text-slate-600 mb-3">
              Are you sure you want to decline RFQ <strong>#{rfq.rfq_number}</strong>? Please explain why (e.g. out of stock, cannot meet timeline).
            </p>
            <div className="mb-3">
              <label className="form-label fw-bold">Reason for Declining (Optional)</label>
              <textarea
                rows="3"
                className="form-control text-xs"
                placeholder="e.g. Products currently out of stock or discontinued..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="modal-footer px-0 pb-0 pt-3 border-top">
              <button type="button" className="btn btn-sm btn-light rounded-pill px-3" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-danger rounded-pill px-4" disabled={submitting}>
                {submitting ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SupplierDeclineRFQModal;

