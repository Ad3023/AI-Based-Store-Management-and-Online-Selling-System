import React from 'react';
import { formatETB } from '../../../utils/currency';

const InvoiceKPIs = ({ invoices = [] }) => {
  const totalInvoiced = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
  const totalApproved = invoices
    .filter((inv) => ['APPROVED', 'APPROVED_FOR_PAYMENT', 'PARTIALLY_PAID', 'PAID'].includes((inv.status || '').toUpperCase()))
    .reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0);
  const totalOutstanding = Math.max(0, totalInvoiced - totalPaid);

  return (
    <div className="row g-3 mb-4">
      <div className="col-12 col-sm-6 col-xl-3">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
          <span className="text-xs text-slate-500 uppercase fw-semibold">Total Invoiced</span>
          <div className="fs-5 fw-bolder text-slate-900 my-1">{formatETB(totalInvoiced)}</div>
          <div className="text-[11px] text-slate-400">{invoices.length} invoices received</div>
        </div>
      </div>
      <div className="col-12 col-sm-6 col-xl-3">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-blue-500">
          <span className="text-xs text-blue-700 uppercase fw-semibold">Approved for Payment</span>
          <div className="fs-5 fw-bolder text-blue-700 my-1">{formatETB(totalApproved)}</div>
          <div className="text-[11px] text-slate-400">Admin authorized liabilities</div>
        </div>
      </div>
      <div className="col-12 col-sm-6 col-xl-3">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-emerald-500">
          <span className="text-xs text-emerald-700 uppercase fw-semibold">Disbursed / Settled</span>
          <div className="fs-5 fw-bolder text-emerald-600 my-1">{formatETB(totalPaid)}</div>
          <div className="text-[11px] text-slate-400">External manual bank transfers</div>
        </div>
      </div>
      <div className="col-12 col-sm-6 col-xl-3">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-amber-500">
          <span className="text-xs text-amber-700 uppercase fw-semibold">Outstanding Balance</span>
          <div className="fs-5 fw-bolder text-amber-700 my-1">{formatETB(totalOutstanding)}</div>
          <div className="text-[11px] text-slate-400">Pending clearance / review</div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceKPIs;

