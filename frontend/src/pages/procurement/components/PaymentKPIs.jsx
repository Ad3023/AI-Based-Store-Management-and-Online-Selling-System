import React from 'react';
import { formatETB } from '../../../utils/currency';

const PaymentKPIs = ({ payments = [], awaitingInvoices = [] }) => {
  const totalDisbursed = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);
  const totalPendingLiability = awaitingInvoices.reduce((sum, inv) => sum + parseFloat(inv.outstanding_amount || 0), 0);

  return (
    <div className="row g-3 mb-4">
      <div className="col-12 col-sm-6 col-xl-3">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-emerald-500">
          <span className="text-xs text-emerald-700 uppercase fw-semibold">Total Disbursed</span>
          <div className="fs-5 fw-bolder text-emerald-600 my-1">{formatETB(totalDisbursed)}</div>
          <div className="text-[11px] text-slate-400">{payments.length} bank transfers settled</div>
        </div>
      </div>
      <div className="col-12 col-sm-6 col-xl-3">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-amber-500">
          <span className="text-xs text-amber-700 uppercase fw-semibold">Outstanding Liabilities</span>
          <div className="fs-5 fw-bolder text-amber-700 my-1">{formatETB(totalPendingLiability)}</div>
          <div className="text-[11px] text-slate-400">Approved invoices awaiting wire</div>
        </div>
      </div>
      <div className="col-12 col-sm-6 col-xl-3">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-blue-500">
          <span className="text-xs text-blue-700 uppercase fw-semibold">Invoices Awaiting Wire</span>
          <div className="fs-5 fw-bolder text-blue-700 my-1">{awaitingInvoices.length}</div>
          <div className="text-[11px] text-slate-400">Ready for payment recording</div>
        </div>
      </div>
      <div className="col-12 col-sm-6 col-xl-3">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
          <span className="text-xs text-slate-500 uppercase fw-semibold">Completed Transfers</span>
          <div className="fs-5 fw-bolder text-slate-900 my-1">{payments.length}</div>
          <div className="text-[11px] text-slate-400">With verified transaction receipts</div>
        </div>
      </div>
    </div>
  );
};

export default PaymentKPIs;

