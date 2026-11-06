import React from 'react';

const getRFQBadge = (status) => {
  const s = (status || '').toUpperCase();
  if (s === 'RESPONDED') {
    return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i className="bi bi-check-circle-fill me-1"></i>Quotation Submitted</span>;
  }
  if (s === 'VIEWED') {
    return <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1"><i className="bi bi-eye-fill me-1"></i>Awaiting Your Quote</span>;
  }
  if (s === 'SENT') {
    return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1"><i className="bi bi-bell-fill me-1"></i>New Request</span>;
  }
  if (s === 'DECLINED') {
    return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1"><i className="bi bi-x-circle me-1"></i>Declined</span>;
  }
  return <span className="badge bg-secondary px-2 py-1">{status}</span>;
};

const SupplierRFQTable = ({ rfqs = [], onRespond, onDecline }) => {
  if (rfqs.length === 0) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 text-center bg-white mb-4">
        <i className="bi bi-inbox text-slate-300 fs-1 mb-2"></i>
        <h6 className="fw-bold text-slate-700">No Pending Quotation Requests</h6>
        <p className="text-slate-400 text-xs mb-0">When EthioTech Market requests price quotations for products, they will appear here.</p>
      </div>
    );
  }

  return (
    <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase fw-semibold">
            <tr>
              <th className="ps-4">RFQ Ref</th>
              <th>Date Received</th>
              <th>Delivery Needed By</th>
              <th>Items Requested</th>
              <th>Instructions</th>
              <th>Status</th>
              <th className="text-end pe-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rfqs.map((rfq) => {
              const canQuote = ['SENT', 'VIEWED'].includes((rfq.status || '').toUpperCase());
              return (
                <tr key={rfq.id}>
                  <td className="ps-4 fw-bold text-teal-700">{rfq.rfq_number}</td>
                  <td>{rfq.sent_at ? new Date(rfq.sent_at).toLocaleDateString() : '—'}</td>
                  <td>{rfq.required_delivery_date || 'Flexible'}</td>
                  <td>
                    <span className="badge bg-slate-100 text-slate-800">{rfq.items?.length || 0} product(s)</span>
                  </td>
                  <td className="text-truncate text-slate-500" style={{ maxWidth: '200px' }}>
                    {rfq.notes || 'Standard specifications requested.'}
                  </td>
                  <td>{getRFQBadge(rfq.status)}</td>
                  <td className="text-end pe-4">
                    {canQuote ? (
                      <div className="d-flex justify-content-end gap-1">
                        <button
                          type="button"
                          className="btn btn-xs btn-teal text-white rounded-pill px-2.5 py-1"
                          style={{ backgroundColor: '#0d9488' }}
                          onClick={() => onRespond(rfq)}
                        >
                          <i className="bi bi-pencil-square me-1"></i>Submit Quote
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-danger rounded-pill px-2 py-1"
                          onClick={() => onDecline(rfq)}
                        >
                          <i className="bi bi-x"></i>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-secondary rounded-pill px-2.5 py-1"
                        onClick={() => onRespond(rfq)}
                      >
                        <i className="bi bi-eye me-1"></i>View Items
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupplierRFQTable;

