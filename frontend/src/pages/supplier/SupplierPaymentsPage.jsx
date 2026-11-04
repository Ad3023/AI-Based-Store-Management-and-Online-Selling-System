import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const SupplierPaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('supplier/payments/');
      const list = res.data.results || res.data || [];
      setPayments(list);
    } catch (err) {
      console.error('Failed to load supplier payments:', err);
      setFeedback({ type: 'danger', text: 'Failed to load payment history.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const totalPaid = useMemo(
    () => payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    [payments]
  );

  const completedCount = useMemo(
    () => payments.filter((p) => (p.payment_status || '').toUpperCase() === 'COMPLETED').length,
    [payments]
  );

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchSearch =
        (p.payment_reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.transaction_reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.notes || '').toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      if (statusFilter !== 'ALL') {
        return (p.payment_status || '').toUpperCase() === statusFilter.toUpperCase();
      }
      return true;
    });
  }, [payments, search, statusFilter]);

  const getStatusBadge = (st) => {
    const s = (st || '').toUpperCase();
    switch (s) {
      case 'COMPLETED':
        return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i className="bi bi-check-circle me-1"></i>Completed</span>;
      case 'PENDING':
        return <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1"><i className="bi bi-clock-history me-1"></i>Pending</span>;
      case 'FAILED':
        return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1"><i className="bi bi-x-circle me-1"></i>Failed</span>;
      default:
        return <span className="badge bg-secondary bg-opacity-10 text-secondary px-2 py-1">{st}</span>;
    }
  };

  return (
    <div className="container-fluid px-0">
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bolder text-slate-900 mb-1">
            <i className="bi bi-cash-coin me-2 text-teal-600"></i>
            Supplier Payment Ledger
          </h4>
          <p className="text-slate-500 text-xs mb-0">
            Read-only record of all financial disbursements and payment settlements issued by EthioTech Market.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-xs"
          onClick={fetchPayments}
        >
          <i className="bi bi-arrow-clockwise me-1"></i> Refresh Ledger
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-4 text-xs py-2.5 px-3 mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close p-2.5" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Financial Summary */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6 col-lg-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-teal-500">
            <span className="text-xs text-slate-500 uppercase fw-semibold">Total Settlements Received</span>
            <div className="fs-4 fw-bolder text-teal-700 my-1">{formatETB(totalPaid)}</div>
            <div className="text-[11px] text-slate-400">Sum of all approved disbursements</div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-emerald-500">
            <span className="text-xs text-emerald-700 uppercase fw-semibold">Completed Transfers</span>
            <div className="fs-4 fw-bolder text-emerald-600 my-1">{completedCount}</div>
            <div className="text-[11px] text-slate-400">Successfully verified bank / mobile payments</div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-slate-300">
            <span className="text-xs text-slate-500 uppercase fw-semibold">Financial Control Authority</span>
            <div className="fs-6 fw-bold text-slate-900 my-1">EthioTech Admin Finance</div>
            <div className="text-[11px] text-slate-400">All disbursements authorized by Admin</div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-6 col-lg-5">
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control text-xs"
                placeholder="Search by Payment Ref, Invoice #, or Transaction ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-12 col-md-4 col-lg-3">
            <select
              className="form-select text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending Verification</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          <div className="col-auto ms-auto text-xs text-slate-500">
            Total records: <strong className="text-slate-900">{filteredPayments.length}</strong>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-teal-600" role="status" style={{ color: '#0d9488' }}></div>
            <p className="text-muted small mt-2">Loading payment records...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-cash-stack fs-1 text-slate-300 mb-2 d-block"></i>
            <h6 className="fw-bold text-slate-700">No Payment Records Found</h6>
            <p className="text-slate-500 text-xs mb-0">
              {search || statusFilter !== 'ALL'
                ? 'No transactions match the selected filter.'
                : 'No payments have been disbursed to your account yet.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
                <tr>
                  <th className="ps-4">Payment Reference</th>
                  <th>Payment Date</th>
                  <th>Linked Invoice</th>
                  <th>Method</th>
                  <th>Transaction / Check #</th>
                  <th>Disbursed Amount</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="ps-4 font-monospace fw-bold text-slate-900">
                      {p.payment_reference || `PAY-${p.id}`}
                    </td>
                    <td className="text-slate-600">
                      {p.payment_date || (p.created_at ? new Date(p.created_at).toLocaleDateString() : '—')}
                    </td>
                    <td className="font-monospace text-slate-700">
                      {p.invoice_number || 'Direct Payment'}
                    </td>
                    <td>
                      <span className="badge bg-slate-100 text-slate-700 border px-2 py-1">
                        {p.payment_method_display || p.payment_method || 'Bank Transfer'}
                      </span>
                    </td>
                    <td className="font-monospace text-slate-600">
                      {p.transaction_reference || '—'}
                    </td>
                    <td className="fw-bolder text-emerald-600">
                      {formatETB(p.amount || 0)}
                    </td>
                    <td>
                      {getStatusBadge(p.payment_status)}
                    </td>
                    <td className="text-end pe-4">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-teal rounded-pill px-2.5 py-1 text-xs"
                        style={{ borderColor: '#0d9488', color: '#0d9488' }}
                        onClick={() => setSelectedPayment(p)}
                      >
                        <i className="bi bi-file-earmark-check me-1"></i> Voucher
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Voucher Modal */}
      {selectedPayment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              <div className="modal-header bg-slate-900 text-white py-2.5 px-3">
                <span className="text-xs fw-bold">Payment Voucher: {selectedPayment.payment_reference || `PAY-${selectedPayment.id}`}</span>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedPayment(null)}></button>
              </div>
              <div className="modal-body p-4 bg-white text-xs">
                <div className="text-center pb-3 border-bottom mb-3">
                  <div className="rounded-circle bg-emerald-100 text-emerald-700 d-inline-flex p-3 mb-2">
                    <i className="bi bi-check-lg fs-3"></i>
                  </div>
                  <h5 className="fw-bold text-slate-900 mb-0">Disbursement Confirmation</h5>
                  <div className="fs-4 fw-bolder text-emerald-600 mt-1">
                    {formatETB(selectedPayment.amount)}
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <span className="text-slate-400 text-[10px] uppercase d-block">Payment Date:</span>
                    <strong className="text-slate-800">{selectedPayment.payment_date || '—'}</strong>
                  </div>
                  <div className="col-6 text-end">
                    <span className="text-slate-400 text-[10px] uppercase d-block">Status:</span>
                    {getStatusBadge(selectedPayment.payment_status)}
                  </div>
                  <div className="col-6">
                    <span className="text-slate-400 text-[10px] uppercase d-block">Payment Method:</span>
                    <strong className="text-slate-800">{selectedPayment.payment_method_display || selectedPayment.payment_method}</strong>
                  </div>
                  <div className="col-6 text-end">
                    <span className="text-slate-400 text-[10px] uppercase d-block">Transaction / Cheque:</span>
                    <span className="font-monospace fw-bold text-slate-800">{selectedPayment.transaction_reference || '—'}</span>
                  </div>
                  <div className="col-12 mt-2">
                    <span className="text-slate-400 text-[10px] uppercase d-block">Settled Invoice:</span>
                    <span className="font-monospace fw-bold text-slate-900">{selectedPayment.invoice_number || 'Direct Order Settlement'}</span>
                  </div>
                </div>

                {selectedPayment.notes && (
                  <div className="bg-slate-50 p-2.5 rounded-3 border text-slate-700 text-xs mb-3">
                    <strong>Payment Remarks:</strong> {selectedPayment.notes}
                  </div>
                )}

                <div className="border-top pt-2 text-[10px] text-slate-400 text-center">
                  Authorized disbursement issued by EthioTech Market Administrative Treasury.
                </div>
              </div>
              <div className="modal-footer py-2 bg-light d-flex justify-content-between">
                <button type="button" className="btn btn-sm btn-secondary rounded-pill px-3 text-xs" onClick={() => setSelectedPayment(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-teal rounded-pill px-3 text-xs"
                  style={{ borderColor: '#0d9488', color: '#0d9488' }}
                  onClick={() => window.print()}
                >
                  <i className="bi bi-printer me-1"></i> Print Voucher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPaymentsPage;

