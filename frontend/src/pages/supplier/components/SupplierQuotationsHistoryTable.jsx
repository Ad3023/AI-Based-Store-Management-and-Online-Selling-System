import React from 'react';
import { formatETB } from '../../../utils/currency';

const getQuotationBadge = (status) => {
  const s = (status || '').toUpperCase();
  if (s === 'SELECTED') {
    return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i className="bi bi-patch-check-fill me-1"></i>Selected for Purchase Order</span>;
  }
  if (s === 'SUBMITTED') {
    return <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1"><i className="bi bi-hourglass-split me-1"></i>Under Evaluation</span>;
  }
  if (s === 'NOT_SELECTED') {
    return <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-2 py-1">Not Selected</span>;
  }
  return <span className="badge bg-secondary px-2 py-1">{status}</span>;
};

const SupplierQuotationsHistoryTable = ({ quotations = [] }) => {
  if (quotations.length === 0) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 text-center bg-white mb-4">
        <i className="bi bi-clock-history text-slate-300 fs-1 mb-2"></i>
        <h6 className="fw-bold text-slate-700">No Submitted Quotations</h6>
        <p className="text-slate-400 text-xs mb-0">Quotations you submit will appear here along with their review and selection status.</p>
      </div>
    );
  }

  return (
    <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase fw-semibold">
            <tr>
              <th className="ps-4">Quotation #</th>
              <th>RFQ Ref</th>
              <th>Date Submitted</th>
              <th>Items</th>
              <th>Total Amount</th>
              <th>Lead Time</th>
              <th>Payment Terms</th>
              <th>Evaluation Status</th>
              <th className="text-end pe-4">Purchase Order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotations.map((q) => (
              <tr key={q.id}>
                <td className="ps-4 fw-bold text-slate-900">{q.quotation_number}</td>
                <td className="text-teal-700 fw-semibold">{q.rfq_number || 'N/A'}</td>
                <td>{q.created_at ? new Date(q.created_at).toLocaleDateString() : '—'}</td>
                <td>
                  <span className="badge bg-slate-100 text-slate-800">{q.items?.length || 0} product(s)</span>
                </td>
                <td className="fw-bold text-teal-700">{formatETB(q.total_amount)}</td>
                <td>{q.delivery_lead_time || '3 days'}</td>
                <td className="text-slate-600">{q.payment_terms || 'Bank transfer'}</td>
                <td>{getQuotationBadge(q.status)}</td>
                <td className="text-end pe-4">
                  {q.purchase_order_number ? (
                    <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {q.purchase_order_number}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupplierQuotationsHistoryTable;

