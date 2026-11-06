import React from 'react';

const getRFQBadge = (status) => {
  const s = (status || '').toUpperCase();
  if (s === 'RESPONDED') {
    return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i className="bi bi-chat-quote-fill me-1"></i>Responded / Quoted</span>;
  }
  if (s === 'VIEWED') {
    return <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1"><i className="bi bi-eye-fill me-1"></i>Viewed by Supplier</span>;
  }
  if (s === 'SENT') {
    return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1"><i className="bi bi-send-check me-1"></i>Sent</span>;
  }
  if (s === 'DECLINED') {
    return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1"><i className="bi bi-x-circle me-1"></i>Declined</span>;
  }
  return <span className="badge bg-secondary px-2 py-1">{status}</span>;
};

const RFQTable = ({ rfqs = [], onSelectRFQ }) => {
  if (rfqs.length === 0) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 text-center bg-white mb-4">
        <i className="bi bi-chat-square-quote text-slate-300 fs-1 mb-2"></i>
        <h6 className="fw-bold text-slate-700">No Quotation Requests Found</h6>
        <p className="text-slate-400 text-xs mb-0">Create a new RFQ to request product prices from registered suppliers.</p>
      </div>
    );
  }

  return (
    <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase fw-semibold">
            <tr>
              <th className="ps-4">RFQ Number</th>
              <th>Supplier</th>
              <th>Date Sent</th>
              <th>Required Delivery</th>
              <th>Items Requested</th>
              <th>Quotations</th>
              <th>Status</th>
              <th className="text-end pe-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rfqs.map((rfq) => (
              <tr key={rfq.id}>
                <td className="ps-4 fw-bold text-teal-700">{rfq.rfq_number}</td>
                <td>
                  <div className="fw-semibold text-slate-900">{rfq.supplier_name || 'N/A'}</div>
                  <div className="text-[11px] text-slate-400">{rfq.supplier_email || ''}</div>
                </td>
                <td>{rfq.sent_at ? new Date(rfq.sent_at).toLocaleDateString() : '—'}</td>
                <td>{rfq.required_delivery_date || 'Flexible'}</td>
                <td>
                  <span className="badge bg-slate-100 text-slate-700">{rfq.items?.length || 0} product(s)</span>
                </td>
                <td>
                  <span className={`badge ${rfq.quotations_count > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-500'}`}>
                    {rfq.quotations_count || 0} quote(s)
                  </span>
                </td>
                <td>{getRFQBadge(rfq.status)}</td>
                <td className="text-end pe-4">
                  <button
                    type="button"
                    className="btn btn-xs btn-outline-teal rounded-pill px-2.5 py-1"
                    onClick={() => onSelectRFQ(rfq)}
                  >
                    <i className="bi bi-eye me-1"></i>View Quotes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RFQTable;

