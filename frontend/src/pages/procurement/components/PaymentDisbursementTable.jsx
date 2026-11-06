import React from 'react';
import { formatETB } from '../../../utils/currency';

const PaymentDisbursementTable = ({ payments = [] }) => {
  if (payments.length === 0) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 text-center bg-white mb-4">
        <i className="bi bi-wallet2 text-slate-300 fs-1 mb-2"></i>
        <h6 className="fw-bold text-slate-700">No Payment Records Yet</h6>
        <p className="text-slate-400 text-xs mb-0">No external manual bank transfers have been recorded.</p>
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
              <th>Supplier</th>
              <th>Invoice #</th>
              <th>Payment Date</th>
              <th>Amount Settled</th>
              <th>Bank Account Used</th>
              <th>Bank Receipt</th>
              <th className="text-end pe-4">Authorized By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="ps-4 fw-bold text-slate-900">
                  <span className="badge bg-slate-100 text-slate-800 border p-1.5">{p.transaction_reference}</span>
                </td>
                <td className="fw-semibold text-slate-900">{p.supplier_name || 'N/A'}</td>
                <td className="text-teal-700 fw-medium">{p.invoice_number || p.supplier_invoice || '—'}</td>
                <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</td>
                <td className="fw-bolder text-emerald-600">{formatETB(p.amount_paid)}</td>
                <td>
                  <div>{p.bank_name || 'Commercial Bank of Ethiopia'}</div>
                  <div className="text-[11px] text-slate-400">{p.bank_account_number || ''}</div>
                </td>
                <td>
                  {p.receipt_url || p.receipt ? (
                    <a href={p.receipt_url || p.receipt} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-teal rounded-pill px-2.5 py-0.5">
                      <i className="bi bi-file-earmark-check me-1"></i>View Receipt
                    </a>
                  ) : <span className="text-muted">No receipt</span>}
                </td>
                <td className="text-end pe-4 text-slate-600">
                  <span className="badge bg-light text-slate-700">{p.authorized_by_username || 'Admin'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentDisbursementTable;

