import React from 'react';
import { formatETB } from '../../../utils/currency';

const getBadge = (status) => {
  const s = (status || '').toUpperCase();
  if (s === 'PAID') {
    return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i className="bi bi-check-circle me-1"></i>Paid</span>;
  }
  if (s === 'APPROVED_FOR_PAYMENT' || s === 'APPROVED') {
    return <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1"><i className="bi bi-patch-check me-1"></i>Approved for Payment</span>;
  }
  if (s === 'PARTIALLY_PAID') {
    return <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1"><i className="bi bi-pie-chart me-1"></i>Partially Paid</span>;
  }
  if (s === 'PENDING_ADMIN_APPROVAL') {
    return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1"><i className="bi bi-shield-check me-1"></i>Pending Admin Approval</span>;
  }
  if (s === 'SUBMITTED' || s === 'UNDER_STORE_REVIEW' || s === 'DRAFT' || s === 'PENDING_APPROVAL') {
    return <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-2 py-1"><i className="bi bi-hourglass-split me-1"></i>Under Store Review</span>;
  }
  if (s.includes('REJECTED')) {
    const label = s.includes('STORE') ? 'Rejected by Store' : 'Rejected by Admin';
    return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1"><i className="bi bi-x-circle me-1"></i>{label}</span>;
  }
  return <span className="badge bg-secondary px-2 py-1">{status}</span>;
};

const ProcurementInvoiceTable = ({ invoices = [], isAdmin = false, onVerify, onAdminReview }) => {
  if (invoices.length === 0) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
        <i className="bi bi-receipt-cutoff text-slate-300 fs-1 mb-2"></i>
        <h6 className="fw-bold text-slate-700">No Invoices Found</h6>
        <p className="text-slate-400 text-xs mb-0">No supplier invoices match your current search and filter settings.</p>
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
              <th>Qty (Inv / Acc)</th>
              <th>Total Amount</th>
              <th>Outstanding</th>
              <th>Review Status</th>
              <th className="text-end pe-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => {
              const statusStr = (inv.status || '').toUpperCase();
              const canStoreVerify = ['SUBMITTED', 'UNDER_STORE_REVIEW', 'PENDING_APPROVAL'].includes(statusStr);
              const canAdminApprove = isAdmin && statusStr === 'PENDING_ADMIN_APPROVAL';

              return (
                <tr key={inv.id}>
                  <td className="ps-4">
                    <div className="fw-bold text-slate-900">{inv.supplier_name || 'N/A'}</div>
                    <div className="text-[11px] text-slate-400">{inv.supplier_email || ''}</div>
                  </td>
                  <td className="fw-bold text-teal-700">{inv.invoice_number}</td>
                  <td>{inv.purchase_order_number || 'N/A'}</td>
                  <td>
                    <span className="fw-semibold">{inv.invoiced_quantity ?? '—'}</span>
                    <span className="text-slate-400 ms-1">/ {inv.accepted_quantity ?? '—'}</span>
                  </td>
                  <td className="fw-bold text-slate-900">{formatETB(inv.total_amount)}</td>
                  <td className="fw-semibold text-amber-700">{formatETB(inv.outstanding_amount)}</td>
                  <td>{getBadge(inv.status)}</td>
                  <td className="text-end pe-4">
                    {canStoreVerify && (
                      <button
                        type="button"
                        className="btn btn-xs btn-teal text-white rounded-pill px-2.5 py-1 me-1 shadow-sm"
                        style={{ backgroundColor: '#0d9488' }}
                        onClick={() => onVerify(inv)}
                      >
                        <i className="bi bi-shield-check me-1"></i>Verify Goods
                      </button>
                    )}
                    {canAdminApprove && (
                      <button
                        type="button"
                        className="btn btn-xs btn-primary rounded-pill px-2.5 py-1 me-1 shadow-sm"
                        onClick={() => onAdminReview(inv)}
                      >
                        <i className="bi bi-patch-check me-1"></i>Review / Approve
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-xs btn-outline-secondary rounded-pill px-2 py-1"
                      onClick={() => (isAdmin ? onAdminReview(inv) : onVerify(inv))}
                    >
                      <i className="bi bi-eye"></i>
                    </button>
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

export default ProcurementInvoiceTable;
