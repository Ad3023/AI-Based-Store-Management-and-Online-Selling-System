import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';

const SupplierPaymentsPage = ({ defaultTab = 'disbursements' }) => {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedInvoiceId = searchParams.get('invoice');
  const preselectedSupplierId = searchParams.get('supplier');

  const [activeTab, setActiveTab] = useState(defaultTab); // 'disbursements' or 'history'
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Disbursement Modal
  const [showDisburseModal, setShowDisburseModal] = useState(Boolean(preselectedInvoiceId));
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [formData, setFormData] = useState({
    supplier: preselectedSupplierId || '',
    invoice: preselectedInvoiceId || '',
    amount_paid: '',
    payment_method: 'BANK_TRANSFER',
    transaction_reference: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_status: 'PAID',
    notes: '',
  });

  // Filters for History
  const [historySearch, setHistorySearch] = useState('');
  const [historyMethodFilter, setHistoryMethodFilter] = useState('ALL');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [payRes, invRes, supRes] = await Promise.all([
        api.get('products/supplier-payments/'),
        api.get('products/supplier-invoices/'),
        api.get('products/suppliers/'),
      ]);
      setPayments(payRes.data.results || payRes.data || []);
      const invList = invRes.data.results || invRes.data || [];
      setInvoices(invList);
      setSuppliers(supRes.data.results || supRes.data || []);

      if (preselectedInvoiceId) {
        const inv = invList.find((i) => String(i.id) === String(preselectedInvoiceId));
        if (inv) {
          setFormData((prev) => ({
            ...prev,
            invoice: inv.id,
            supplier: inv.supplier,
            amount_paid: inv.outstanding_amount || '',
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load supplier payment ledgers:', err);
      setFeedback({ type: 'danger', text: 'Failed to load payments and approved invoices.' });
    } finally {
      setLoading(false);
    }
  }, [preselectedInvoiceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle invoice selection in payment form
  const handleSelectInvoice = (invId) => {
    const inv = invoices.find((i) => String(i.id) === String(invId));
    if (inv) {
      setFormData((prev) => ({
        ...prev,
        invoice: invId,
        supplier: inv.supplier,
        amount_paid: inv.outstanding_amount || '',
      }));
    } else {
      setFormData((prev) => ({ ...prev, invoice: invId }));
    }
  };

  const handleOpenDisburseForInvoice = (inv) => {
    setFormData({
      supplier: inv.supplier,
      invoice: inv.id,
      amount_paid: inv.outstanding_amount || '',
      payment_method: 'BANK_TRANSFER',
      transaction_reference: `TX-CBE-${Math.floor(100000 + Math.random() * 900000)}`,
      payment_date: new Date().toISOString().split('T')[0],
      payment_status: 'PAID',
      notes: `Disbursement for Invoice #${inv.invoice_number}`,
    });
    setShowDisburseModal(true);
  };

  const handleDisburseSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier) {
      alert('Supplier is required.');
      return;
    }
    const amt = parseFloat(formData.amount_paid);
    if (!amt || amt <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }
    if (!formData.transaction_reference.trim()) {
      alert('Transaction reference (e.g. Bank slip or Telebirr TxID) is required.');
      return;
    }

    try {
      setSubmittingPayment(true);
      const payload = {
        supplier: formData.supplier,
        invoice: formData.invoice || null,
        amount_paid: amt,
        payment_method: formData.payment_method,
        transaction_reference: formData.transaction_reference.trim(),
        payment_date: formData.payment_date,
        payment_status: formData.payment_status,
        notes: formData.notes.trim(),
      };

      const res = await api.post('products/supplier-payments/', payload);
      setFeedback({
        type: 'success',
        text: `Supplier payment of ${formatETB(res.data.amount_paid)} authorized & recorded successfully! (Ref: ${res.data.transaction_reference})`,
      });

      setShowDisburseModal(false);
      fetchData();
      setActiveTab('history');
    } catch (err) {
      console.error('Payment authorization failed:', err);
      const msg = err.response?.data?.error || 'Failed to authorize payment.';
      alert(msg);
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Approved unpaid invoices
  const approvedUnpaidInvoices = invoices.filter(
    (i) => (i.status === 'APPROVED' || i.status === 'PARTIALLY_PAID') && Number(i.outstanding_amount || 0) > 0
  );

  const totalOutstandingToPay = approvedUnpaidInvoices.reduce(
    (acc, i) => acc + (parseFloat(i.outstanding_amount) || 0),
    0
  );

  const totalDisbursed = payments.reduce(
    (acc, p) => acc + (parseFloat(p.amount_paid) || 0),
    0
  );

  // Filtered payments for history tab
  const filteredPayments = payments.filter((p) => {
    const q = historySearch.toLowerCase();
    const matchesSearch =
      !q ||
      p.transaction_reference?.toLowerCase().includes(q) ||
      p.supplier_name?.toLowerCase().includes(q) ||
      p.supplier_invoice?.toLowerCase().includes(q);

    const matchesMethod = historyMethodFilter === 'ALL' || p.payment_method === historyMethodFilter;
    return matchesSearch && matchesMethod;
  });

  return (
    <div className="pb-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-success border-opacity-25 bg-success bg-opacity-10">
            <i className="bi bi-cash-coin text-success"></i>
            <span className="small fw-bold text-success">Admin Financial Settlement</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Supplier Payments &amp; Disbursements</h2>
          <p className="text-slate-500 text-xs mb-0">
            Authorize full or partial disbursements for approved supplier invoices via bank transfer, Telebirr, or certified draft.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-ethio-primary rounded-pill px-4 py-2 font-bold text-xs d-flex align-items-center gap-2 shadow-sm"
          style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
          onClick={() => {
            setFormData({
              supplier: '',
              invoice: '',
              amount_paid: '',
              payment_method: 'BANK_TRANSFER',
              transaction_reference: `TX-CBE-${Math.floor(100000 + Math.random() * 900000)}`,
              payment_date: new Date().toISOString().split('T')[0],
              payment_status: 'PAID',
              notes: '',
            });
            setShowDisburseModal(true);
          }}
        >
          <i className="bi bi-credit-card-2-front"></i>
          <span>Record New Disbursement</span>
        </button>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Financial Summary Metric Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
            <span className="text-muted text-[11px] fw-bold uppercase">Approved Payables</span>
            <h4 className="fw-bolder text-warning-emphasis mb-0 mt-1">{approvedUnpaidInvoices.length} Invoices</h4>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
            <span className="text-muted text-[11px] fw-bold uppercase">Pending Payout Amount</span>
            <h4 className="fw-bolder text-danger mb-0 mt-1">{formatETB(totalOutstandingToPay)}</h4>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
            <span className="text-muted text-[11px] fw-bold uppercase">Total Disbursed to Date</span>
            <h4 className="fw-bolder text-success mb-0 mt-1">{formatETB(totalDisbursed)}</h4>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
            <span className="text-muted text-[11px] fw-bold uppercase">Completed Payments</span>
            <h4 className="fw-bolder text-slate-900 mb-0 mt-1">{payments.length} Transactions</h4>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="d-flex gap-2 mb-4">
        <button
          type="button"
          className={`btn btn-sm rounded-pill px-4 font-bold text-xs ${
            activeTab === 'disbursements' ? 'btn-primary' : 'btn-outline-secondary'
          }`}
          onClick={() => setActiveTab('disbursements')}
        >
          <i className="bi bi-clock-history me-1"></i>
          <span>Approved Invoices Queue ({approvedUnpaidInvoices.length})</span>
        </button>
        <button
          type="button"
          className={`btn btn-sm rounded-pill px-4 font-bold text-xs ${
            activeTab === 'history' ? 'btn-primary' : 'btn-outline-secondary'
          }`}
          onClick={() => setActiveTab('history')}
        >
          <i className="bi bi-journal-text me-1"></i>
          <span>Supplier Payment History ({payments.length})</span>
        </button>
      </div>

      {/* TAB 1: APPROVED INVOICES QUEUE */}
      {activeTab === 'disbursements' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <div>
              <h6 className="fw-bold text-slate-900 mb-0 text-sm">
                Approved Supplier Invoices Awaiting Payment
              </h6>
              <small className="text-muted text-[11px]">
                Invoices verified and approved for disbursement by Admin.
              </small>
            </div>
            <span className="badge bg-danger-subtle text-danger border border-danger border-opacity-25 px-3 py-2">
              Outstanding: {formatETB(totalOutstandingToPay)}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="text-muted small mt-2">Loading approved invoices...</p>
            </div>
          ) : approvedUnpaidInvoices.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-check2-circle fs-1 text-success mb-2 d-block"></i>
              <h6 className="fw-bold text-slate-700">No Outstanding Invoices to Pay</h6>
              <p className="text-slate-500 text-xs mb-0">
                All approved supplier invoices have been fully paid and settled.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-xs">
                <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
                  <tr>
                    <th className="ps-4">Invoice # &amp; Date</th>
                    <th>Supplier</th>
                    <th>Related PO</th>
                    <th>Total Invoiced</th>
                    <th>Already Paid</th>
                    <th>Outstanding Balance</th>
                    <th>Due Date</th>
                    <th className="text-end pe-4">Authorize Action</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedUnpaidInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="ps-4">
                        <strong className="text-slate-900">#{inv.invoice_number}</strong>
                        <small className="text-slate-400 text-[10px] d-block">{inv.invoice_date}</small>
                      </td>
                      <td>
                        <strong className="text-slate-800">{inv.supplier_name}</strong>
                      </td>
                      <td>
                        {inv.purchase_order_number ? (
                          <span className="badge bg-light text-primary border">
                            {inv.purchase_order_number}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="fw-bold text-slate-800">{formatETB(inv.total_amount)}</td>
                      <td className="text-success">{formatETB(inv.paid_amount || 0)}</td>
                      <td>
                        <strong className="text-danger fs-6">{formatETB(inv.outstanding_amount || 0)}</strong>
                      </td>
                      <td className="text-slate-600">{inv.due_date || '—'}</td>
                      <td className="text-end pe-4">
                        <button
                          type="button"
                          className="btn btn-sm btn-success px-3 py-1.5 text-xs rounded-pill font-bold d-inline-flex align-items-center gap-1 shadow-sm"
                          onClick={() => handleOpenDisburseForInvoice(inv)}
                        >
                          <i className="bi bi-cash-stack"></i>
                          <span>Disburse Payment</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUPPLIER PAYMENT HISTORY */}
      {activeTab === 'history' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
          <div className="p-3 border-bottom">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-5">
                <input
                  type="text"
                  className="form-control text-xs"
                  placeholder="Filter payment history by reference, supplier, or invoice..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
              <div className="col-12 col-md-4">
                <select
                  className="form-select text-xs"
                  value={historyMethodFilter}
                  onChange={(e) => setHistoryMethodFilter(e.target.value)}
                >
                  <option value="ALL">All Payment Methods</option>
                  <option value="BANK_TRANSFER">Bank Transfer / Wire</option>
                  <option value="TELEBIRR">Telebirr SuperApp / Merchant</option>
                  <option value="CHEQUE">Cheque / Certified Draft</option>
                  <option value="CASH">Cash Settlement</option>
                  <option value="OTHER">Other External</option>
                </select>
              </div>
              <div className="col-auto ms-auto text-xs text-muted">
                Total Ledger Records: <strong>{filteredPayments.length}</strong>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="text-muted small mt-2">Loading payment ledger...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-clock-history fs-1 text-slate-300 mb-2 d-block"></i>
              <h6 className="fw-bold text-slate-700">No Payment Records Found</h6>
              <p className="text-slate-500 text-xs mb-0">
                {historySearch || historyMethodFilter !== 'ALL'
                  ? 'No payments match the active filter.'
                  : 'No supplier payments have been authorized or recorded yet.'}
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-xs">
                <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
                  <tr>
                    <th className="ps-4">Transaction Ref &amp; Date</th>
                    <th>Supplier</th>
                    <th>Invoice / PO Reference</th>
                    <th>Disbursed Amount</th>
                    <th>Payment Method</th>
                    <th>Authorized By</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="ps-4">
                        <strong className="text-slate-900">{p.transaction_reference}</strong>
                        <small className="text-slate-400 text-[10px] d-block">
                          {new Date(p.payment_date).toLocaleDateString()}
                        </small>
                      </td>
                      <td>
                        <strong className="text-slate-800">{p.supplier_name}</strong>
                      </td>
                      <td>
                        {p.invoice_number ? (
                          <span className="badge bg-light text-dark border">
                            Inv #{p.invoice_number}
                          </span>
                        ) : p.supplier_invoice ? (
                          <span className="badge bg-light text-dark border">{p.supplier_invoice}</span>
                        ) : (
                          <span className="text-slate-400">Direct Settlement</span>
                        )}
                      </td>
                      <td className="fw-bolder text-success fs-6">
                        {formatETB(p.amount_paid)}
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">
                          {p.payment_method_display || p.payment_method}
                        </span>
                      </td>
                      <td className="text-slate-700">
                        {p.authorized_by_username || 'Admin'}
                      </td>
                      <td>
                        <span className="badge bg-success">
                          {p.payment_status_display || p.payment_status}
                        </span>
                      </td>
                      <td className="text-slate-500 text-[11px] text-truncate" style={{ maxWidth: '180px' }} title={p.notes}>
                        {p.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Authorize & Record Payment Modal */}
      {showDisburseModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4">
              <form onSubmit={handleDisburseSubmit}>
                <div className="modal-header bg-slate-900 text-white pb-3">
                  <h5 className="modal-title fw-bold text-sm text-white">
                    Authorize Supplier Disbursement
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowDisburseModal(false)}
                  ></button>
                </div>

                <div className="modal-body p-4 text-xs">
                  {/* Warning on Separate Financial Channel */}
                  <div className="alert alert-warning py-2 px-3 text-[11px] mb-3">
                    <i className="bi bi-shield-exclamation me-1"></i>
                    <strong>Financial Separation Policy:</strong> Supplier payments are external corporate disbursements (Bank/Telebirr/Cheque). Do not mix with customer checkout.
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold text-slate-700">Select Supplier *</label>
                    <select
                      className="form-select text-xs"
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Supplier --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (Outstanding: {formatETB(s.outstanding_balance || 0)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold text-slate-700">Attach Approved Invoice (Optional)</label>
                    <select
                      className="form-select text-xs"
                      value={formData.invoice}
                      onChange={(e) => handleSelectInvoice(e.target.value)}
                    >
                      <option value="">-- Direct Supplier Advance / Settlement --</option>
                      {approvedUnpaidInvoices
                        .filter((i) => !formData.supplier || String(i.supplier) === String(formData.supplier))
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            #{i.invoice_number} - {i.supplier_name} (Outstanding: {formatETB(i.outstanding_amount)})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Amount to Disburse (ETB) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="form-control text-xs fw-bold text-success"
                        placeholder="0.00"
                        value={formData.amount_paid}
                        onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Payment Method *</label>
                      <select
                        className="form-select text-xs"
                        value={formData.payment_method}
                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                        required
                      >
                        <option value="BANK_TRANSFER">Bank Transfer / Wire (CBE, Awash)</option>
                        <option value="TELEBIRR">Telebirr SuperApp / Merchant</option>
                        <option value="CHEQUE">Cheque / Certified Draft</option>
                        <option value="CASH">Cash Settlement</option>
                        <option value="OTHER">Other External</option>
                      </select>
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Transaction Reference *</label>
                      <input
                        type="text"
                        className="form-control text-xs"
                        placeholder="e.g. CBE-FT26090123"
                        value={formData.transaction_reference}
                        onChange={(e) => setFormData({ ...formData, transaction_reference: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Payment Date *</label>
                      <input
                        type="date"
                        className="form-control text-xs"
                        value={formData.payment_date}
                        onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label text-xs fw-bold text-slate-700">Disbursement Notes / Bank Slip Details</label>
                    <textarea
                      className="form-control text-xs"
                      rows="2"
                      placeholder="e.g. Transferred from corporate CBE operating account to supplier Awash account."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer border-top p-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                    onClick={() => setShowDisburseModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-success rounded-pill px-4 font-bold"
                    disabled={submittingPayment}
                  >
                    {submittingPayment ? 'Recording...' : 'Authorize & Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPaymentsPage;
