import React from 'react';
import { formatETB } from '../../../utils/currency';

const SupplierPaymentTable = ({ payments = [] }) => {
  if (payments.length === 0) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 text-center bg-white mb-4">
        <i className="bi bi-wallet2 text-slate-300 fs-1 mb-2"></i>
        <h6 className="fw-bold text-slate-700">No Payment Records Found</h6>
        <p className="text-slate-400 text-xs mb-0">No external manual bank settlements recorded for your account yet.</p>
      </div>
    );
  }

  return (
    <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase fw-semibold">
            <tr>
              <th className="ps-4">Transaction Ref</th>
              <th>Invoice #</th>
              <th>PO Ref</th>
              <th>Transfer Date</th>
              <th>Amount Received</th>
              <th>Bank Account Used</th>
              <th>Settlement Status</th>
              <th className="text-end pe-4">Bank Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="ps-4 fw-bold text-slate-900">
                  <span className="badge bg-slate-100 text-slate-800 border p-1.5">{p.transaction_reference}</span>
                </td>
                <td className="fw-bold text-teal-700">{p.invoice_number || p.supplier_invoice || '—'}</td>
                <td className="text-slate-600">{p.purchase_order_reference || '—'}</td>
                <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</td>
                <td className="fw-bolder text-emerald-600">{formatETB(p.amount_paid)}</td>
                <td>
                  <div>{p.bank_name || 'Commercial Bank of Ethiopia'}</div>
                  <div className="text-[11px] text-slate-400">{p.bank_account_number || ''}</div>
                </td>
                <td>
                  <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                    <i className="bi bi-check-circle me-1"></i>Settled
                  </span>
                </td>
                <td className="text-end pe-4">
                  {p.receipt_url || p.receipt ? (
                    <a
                      href={p.receipt_url || p.receipt}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-xs btn-outline-teal rounded-pill px-2.5 py-1"
                    >
                      <i className="bi bi-file-earmark-check me-1"></i>Download Receipt
                    </a>
                  ) : (
                    <span className="text-muted">No receipt file</span>
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

export default SupplierPaymentTable;

