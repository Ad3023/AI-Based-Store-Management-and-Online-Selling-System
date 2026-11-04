import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const ProcurementReportsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('products/procurement/reports/');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load procurement reports:', err);
      setFeedback({ type: 'danger', text: 'Failed to load procurement intelligence data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted text-xs mt-2">Computing procurement financial analytics...</p>
      </div>
    );
  }

  const summary = data?.summary || {};
  const supplierBreakdown = data?.supplier_breakdown || [];
  const monthlyExpenses = data?.monthly_expenses || [];
  const yearlyExpenses = data?.yearly_expenses || [];

  return (
    <div className="pb-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-info border-opacity-25 bg-info bg-opacity-10">
            <i className="bi bi-pie-chart text-info"></i>
            <span className="small fw-bold text-slate-800">Financial Control &amp; Analytics</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Procurement &amp; Supplier Reports</h2>
          <p className="text-slate-500 text-xs mb-0">
            Supervisory audit of hardware purchasing commitments, disbursements, outstanding balances, and monthly expense trends.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-secondary rounded-pill px-3 py-2 text-xs font-bold d-flex align-items-center gap-2"
          onClick={fetchReports}
        >
          <i className="bi bi-arrow-clockwise"></i>
          <span>Refresh Analytics</span>
        </button>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        {/* Total Purchases */}
        <div className="col-12 col-sm-6 col-lg-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 bg-white position-relative overflow-hidden">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <span className="text-muted text-xs fw-bold uppercase">Total Purchases Committed</span>
                <h3 className="fw-bolder text-primary mb-1 mt-1">{formatETB(summary.total_purchases || 0)}</h3>
                <small className="text-slate-500 text-[11px]">Approved, dispatched, &amp; received POs</small>
              </div>
              <div className="p-3 bg-primary bg-opacity-10 rounded-3 text-primary">
                <i className="bi bi-bag-check fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Total Payments */}
        <div className="col-12 col-sm-6 col-lg-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 bg-white position-relative overflow-hidden">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <span className="text-muted text-xs fw-bold uppercase">Total Supplier Payments</span>
                <h3 className="fw-bolder text-success mb-1 mt-1">{formatETB(summary.total_supplier_payments || 0)}</h3>
                <small className="text-slate-500 text-[11px]">Authorized external disbursements</small>
              </div>
              <div className="p-3 bg-success bg-opacity-10 rounded-3 text-success">
                <i className="bi bi-cash-stack fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="col-12 col-sm-6 col-lg-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 bg-white position-relative overflow-hidden">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <span className="text-muted text-xs fw-bold uppercase">Outstanding Supplier Balance</span>
                <h3 className={`fw-bolder mb-1 mt-1 ${Number(summary.outstanding_supplier_balance || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                  {formatETB(summary.outstanding_supplier_balance || 0)}
                </h3>
                <small className="text-slate-500 text-[11px]">Total purchases minus disbursements</small>
              </div>
              <div className="p-3 bg-danger bg-opacity-10 rounded-3 text-danger">
                <i className="bi bi-hourglass-split fs-4"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Attention Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white d-flex flex-row align-items-center justify-content-between">
            <div>
              <span className="text-muted text-[11px] fw-bold uppercase d-block">POs Awaiting Approval</span>
              <h4 className="fw-bolder text-warning-emphasis mb-0 mt-1">{summary.pos_awaiting_approval || 0} Orders</h4>
            </div>
            <Link
              to="/admin/procurement/approvals"
              className="btn btn-sm btn-outline-warning rounded-pill px-3 text-xs"
            >
              Review POs &rarr;
            </Link>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white d-flex flex-row align-items-center justify-content-between">
            <div>
              <span className="text-muted text-[11px] fw-bold uppercase d-block">Unpaid Supplier Invoices</span>
              <h4 className="fw-bolder text-danger mb-0 mt-1">
                {summary.unpaid_invoices_count || 0} ({formatETB(summary.unpaid_invoices_amount || 0)})
              </h4>
            </div>
            <Link
              to="/admin/procurement/invoices"
              className="btn btn-sm btn-outline-danger rounded-pill px-3 text-xs"
            >
              Inspect &rarr;
            </Link>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white d-flex flex-row align-items-center justify-content-between">
            <div>
              <span className="text-muted text-[11px] fw-bold uppercase d-block">Registered Suppliers</span>
              <h4 className="fw-bolder text-slate-800 mb-0 mt-1">{summary.suppliers_count || 0} Partners</h4>
            </div>
            <Link
              to="/admin/suppliers"
              className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs"
            >
              Directory &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Monthly Expenses Table & Trends */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
        <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
          <div>
            <h6 className="fw-bold text-slate-900 mb-0 text-sm">Monthly Procurement Expenses (Last 12 Months)</h6>
            <small className="text-muted text-[11px]">Comparison of purchasing commitments vs disbursements</small>
          </div>
          <span className="badge bg-light text-dark border">12-Month Window</span>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 text-xs">
            <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
              <tr>
                <th className="ps-4">Month</th>
                <th>Purchase Orders Committed</th>
                <th>Payments Disbursed</th>
                <th>Net Balance Variation</th>
              </tr>
            </thead>
            <tbody>
              {monthlyExpenses.map((m, idx) => {
                const purch = parseFloat(m.purchases) || 0;
                const pays = parseFloat(m.payments) || 0;
                const diff = purch - pays;
                return (
                  <tr key={idx}>
                    <td className="ps-4 fw-bold text-slate-800">{m.label}</td>
                    <td className="fw-semibold text-primary">{formatETB(purch)}</td>
                    <td className="fw-semibold text-success">{formatETB(pays)}</td>
                    <td>
                      <span className={`fw-bold ${diff > 0 ? 'text-danger' : diff < 0 ? 'text-success' : 'text-slate-400'}`}>
                        {diff > 0 ? `+${formatETB(diff)}` : formatETB(diff)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Breakdown Table */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
          <div>
            <h6 className="fw-bold text-slate-900 mb-0 text-sm">Supplier Balances &amp; Order Breakdown</h6>
            <small className="text-muted text-[11px]">Aggregated spend and outstanding balances per vendor</small>
          </div>
          <span className="badge bg-light text-dark border">
            {supplierBreakdown.length} Suppliers Active
          </span>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 text-xs">
            <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
              <tr>
                <th className="ps-4">Supplier Name</th>
                <th>Contact</th>
                <th>Email / Phone</th>
                <th>Total Orders</th>
                <th>Total Purchased</th>
                <th>Total Disbursed</th>
                <th>Outstanding Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {supplierBreakdown.map((s) => (
                <tr key={s.id}>
                  <td className="ps-4">
                    <strong className="text-slate-900">{s.name}</strong>
                  </td>
                  <td>{s.contact_person || <span className="text-slate-400">—</span>}</td>
                  <td>
                    <div>
                      {s.email ? <span className="d-block text-primary">{s.email}</span> : null}
                      <small className="text-slate-400">{s.phone || '—'}</small>
                    </div>
                  </td>
                  <td className="fw-bold text-slate-800">{s.po_count} POs</td>
                  <td className="fw-semibold text-primary">{formatETB(s.total_purchases)}</td>
                  <td className="fw-semibold text-success">{formatETB(s.total_paid)}</td>
                  <td>
                    <strong className={Number(s.outstanding_balance) > 0 ? 'text-danger' : 'text-success'}>
                      {formatETB(s.outstanding_balance)}
                    </strong>
                  </td>
                  <td>
                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProcurementReportsPage;
