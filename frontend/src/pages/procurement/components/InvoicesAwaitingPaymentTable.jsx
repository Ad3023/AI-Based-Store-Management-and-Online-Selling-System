import React from 'react';
import { formatETB } from '../../../utils/currency';

const InvoicesAwaitingPaymentTable = ({ invoices = [], onRecordPayment }) => {
  if (invoices.length === 0) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 text-center bg-white mb-4">
        <i className="bi bi-check2-all text-emerald-400 fs-1 mb-2"></i>
        <h6 className="fw-bold text-slate-700">No Invoices Awaiting Settlement</h6>
        <p className="text-slate-400 text-xs mb-0">All approved supplier invoices have been fully paid and settled.</p>
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
              <th>Invoice #</th>
              <th>PO Ref</th>
              <th>Total Amount</th>
              <th>Paid So Far</th>
              <th>Outstanding Balance</th>
              <th>Status</th>
              <th className="text-end pe-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="ps-4">
                  <div className="fw-bold text-slate-900">{inv.supplier_name || 'N/A'}</div>
                  <div className="text-[11px] text-slate-400">{inv.supplier_bank_name || 'Commercial Bank of Ethiopia'}</div>
                </td>
                <td className="fw-bold text-teal-700">{inv.invoice_number}</td>
                <td>{inv.purchase_order_number || 'N/A'}</td>
                <td className="fw-semibold text-slate-900">{formatETB(inv.total_amount)}</td>
                <td className="text-emerald-600">{formatETB(inv.paid_amount || 0)}</td>
                <td className="fw-bolder text-amber-700">{formatETB(inv.outstanding_amount)}</td>
                <td>
                  <span className="badge bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1">
                    {inv.status_display || inv.status}
                  </span>
                </td>
                <td className="text-end pe-4">
                  <button
                    type="button"
                    className="btn btn-xs btn-emerald text-white rounded-pill px-3 py-1 shadow-sm"
                    style={{ backgroundColor: '#059669' }}
                    onClick={() => onRecordPayment(inv)}
                  >
                    <i className="bi bi-bank me-1"></i>Record Bank Transfer
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

export default InvoicesAwaitingPaymentTable;
