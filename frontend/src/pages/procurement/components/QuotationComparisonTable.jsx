import React from 'react';
import { formatETB } from '../../../utils/currency';

const QuotationComparisonTable = ({ comparisonRows = [], onSelectQuotation, onCreatePO, submitting }) => {
  if (comparisonRows.length === 0) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 text-center bg-white mb-4">
        <i className="bi bi-bar-chart-steps text-slate-300 fs-1 mb-2"></i>
        <h6 className="fw-bold text-slate-700">No Supplier Quotations to Compare Yet</h6>
        <p className="text-slate-400 text-xs mb-0">Quotations submitted by suppliers in response to RFQs will appear here for price evaluation.</p>
      </div>
    );
  }

  return (
    <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase fw-semibold">
            <tr>
              <th className="ps-4">Supplier</th>
              <th>Product</th>
              <th>Req / Avail Qty</th>
              <th>Offered Unit Price</th>
              <th>Total Quote</th>
              <th>Delivery Timeline</th>
              <th>Payment Terms</th>
              <th>Status</th>
              <th className="text-end pe-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comparisonRows.map((row, idx) => {
              const isSelected = row.quotation_status === 'SELECTED';
              return (
                <tr key={`${row.quotation_id}-${idx}`} className={isSelected ? 'bg-teal-50/30' : ''}>
                  <td className="ps-4">
                    <div className="fw-bold text-slate-900">{row.supplier_name}</div>
                    <div className="text-[11px] text-teal-700">Quote #{row.quotation_number}</div>
                  </td>
                  <td>
                    <div className="fw-semibold text-slate-800">{row.product_name}</div>
                    <div className="text-[11px] text-slate-400">Ref: {row.rfq_number}</div>
                  </td>
                  <td>
                    <span className="fw-bold">{row.requested_quantity}</span> requested
                    <span className="text-emerald-700 fw-semibold d-block text-[11px]">{row.available_quantity} available</span>
                  </td>
                  <td className="fw-bolder text-slate-900">{formatETB(row.offered_unit_price)}</td>
                  <td className="fw-bolder text-teal-700">{formatETB(row.total_quotation_amount)}</td>
                  <td>
                    <div>{row.delivery_lead_time || '3 days'}</div>
                    <div className="text-[11px] text-slate-400">{row.estimated_delivery_date || ''}</div>
                  </td>
                  <td className="text-slate-600">{row.payment_terms || 'Bank transfer'}</td>
                  <td>
                    {isSelected ? (
                      <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                        <i className="bi bi-check-circle-fill me-1"></i>Selected
                      </span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-700 px-2 py-1">{row.quotation_status}</span>
                    )}
                  </td>
                  <td className="text-end pe-4">
                    {!isSelected && row.quotation_status !== 'NOT_SELECTED' && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-teal rounded-pill px-2.5 py-1"
                        onClick={() => onSelectQuotation(row.quotation_id)}
                        disabled={submitting}
                      >
                        <i className="bi bi-check2 me-1"></i>Select
                      </button>
                    )}
                    {isSelected && (
                      <button
                        type="button"
                        className="btn btn-xs btn-teal text-white rounded-pill px-2.5 py-1"
                        style={{ backgroundColor: '#0d9488' }}
                        onClick={() => onCreatePO(row.quotation_id)}
                        disabled={submitting}
                      >
                        <i className="bi bi-cart-plus me-1"></i>Create PO
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

export default QuotationComparisonTable;

