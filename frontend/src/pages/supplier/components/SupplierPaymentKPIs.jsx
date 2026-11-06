import React from 'react';
import { formatETB } from '../../../utils/currency';

const SupplierPaymentKPIs = ({ payments = [], invoices = [] }) => {
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
  const totalOutstanding = Math.max(0, totalInvoiced - totalPaid);

  return (
    <div className="row g-3 mb-4">
      <div className="col-12 col-md-4">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-emerald-500">
          <span className="text-xs text-emerald-700 uppercase fw-semibold">Total Settlements Received</span>
          <div className="fs-4 fw-bolder text-emerald-600 my-1">{formatETB(totalPaid)}</div>
          <div className="text-[11px] text-slate-400">{payments.length} bank transfers processed</div>
        </div>
      </div>
      <div className="col-12 col-md-4">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-amber-500">
          <span className="text-xs text-amber-700 uppercase fw-semibold">Pending Outstanding Balance</span>
          <div className="fs-4 fw-bolder text-amber-700 my-1">{formatETB(totalOutstanding)}</div>
          <div className="text-[11px] text-slate-400">Approved invoices awaiting transfer</div>
        </div>
      </div>
      <div className="col-12 col-md-4">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
          <span className="text-xs text-slate-500 uppercase fw-semibold">Completed Transfers</span>
          <div className="fs-4 fw-bolder text-slate-900 my-1">{payments.length}</div>
          <div className="text-[11px] text-slate-400">With verified bank receipts</div>
        </div>
      </div>
    </div>
  );
};

export default SupplierPaymentKPIs;
