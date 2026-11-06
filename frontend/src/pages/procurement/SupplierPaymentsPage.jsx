import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import PaymentKPIs from './components/PaymentKPIs';
import ManualBankPaymentModal from './components/ManualBankPaymentModal';
import InvoicesAwaitingPaymentTable from './components/InvoicesAwaitingPaymentTable';
import PaymentDisbursementTable from './components/PaymentDisbursementTable';

const SupplierPaymentsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_super_admin || user?.is_superuser;

  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('AWAITING'); // 'AWAITING' or 'HISTORY'
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [payRes, invRes] = await Promise.all([
        api.get('products/supplier-payments/'),
        api.get('products/supplier-invoices/'),
      ]);
      setPayments(payRes.data.results || payRes.data || []);
      setInvoices(invRes.data.results || invRes.data || []);
    } catch (err) {
      console.error('Failed to load supplier payment data:', err);
      setFeedback({ type: 'danger', text: 'Failed to load payments and invoice settlements.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Approved invoices eligible for payment (balance > 0)
  const awaitingInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const s = (inv.status || '').toUpperCase();
      const isApproved = ['APPROVED', 'APPROVED_FOR_PAYMENT', 'PARTIALLY_PAID'].includes(s);
      const hasBalance = parseFloat(inv.outstanding_amount || 0) > 0;
      return isApproved && hasBalance;
    });
  }, [invoices]);

  const filteredAwaitingInvoices = useMemo(() => {
    return awaitingInvoices.filter((inv) => {
      return (
        (inv.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.supplier_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.purchase_order_number || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [awaitingInvoices, search]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      return (
        (p.transaction_reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.supplier_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.supplier_invoice || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [payments, search]);

  const handleOpenPayment = (inv = null) => {
    setSelectedInvoiceForPay(inv);
    setShowPaymentModal(true);
  };

  return (
    <div className="container-fluid px-0">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bolder text-slate-900 mb-1">
            <i className="bi bi-wallet2 me-2 text-emerald-600"></i>Supplier Payment Disbursements
          </h4>
          <p className="text-slate-500 text-xs mb-0">
            Execute external bank wire transfers, record transaction references, and archive verified deposit receipts.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="btn btn-sm btn-emerald text-white rounded-pill px-3 py-1.5 text-xs font-semibold shadow-sm"
            style={{ backgroundColor: '#059669' }}
            onClick={() => handleOpenPayment(null)}
            disabled={awaitingInvoices.length === 0}
          >
            <i className="bi bi-plus-lg me-1"></i>Record Bank Transfer
          </button>
        )}
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-4 text-xs py-2.5 px-3 mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close p-2.5" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      <PaymentKPIs payments={payments} awaitingInvoices={awaitingInvoices} />

      {/* Tabs and Search Bar */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <ul className="nav nav-pills text-xs">
            <li className="nav-item">
              <button
                className={`nav-link rounded-pill px-3 py-1.5 ${activeTab === 'AWAITING' ? 'active bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setActiveTab('AWAITING')}
              >
                Invoices Awaiting Wire <span className="badge bg-amber-500 ms-1">{awaitingInvoices.length}</span>
              </button>
            </li>
            <li className="nav-item ms-2">
              <button
                className={`nav-link rounded-pill px-3 py-1.5 ${activeTab === 'HISTORY' ? 'active bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setActiveTab('HISTORY')}
              >
                Disbursement History <span className="badge bg-slate-200 text-slate-800 ms-1">{payments.length}</span>
              </button>
            </li>
          </ul>

          <div style={{ maxWidth: '350px', width: '100%' }}>
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400"><i className="bi bi-search"></i></span>
              <input
                type="text"
                className="form-control text-xs"
                placeholder={activeTab === 'AWAITING' ? 'Search awaiting invoices...' : 'Search payments by ref, supplier...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5 text-slate-400 text-xs">
          <div className="spinner-border spinner-border-sm text-emerald-600 mb-2"></div>
          <div>Loading financial settlement records...</div>
        </div>
      ) : activeTab === 'AWAITING' ? (
        <InvoicesAwaitingPaymentTable invoices={filteredAwaitingInvoices} onRecordPayment={handleOpenPayment} />
      ) : (
        <PaymentDisbursementTable payments={filteredPayments} />
      )}

      <ManualBankPaymentModal
        show={showPaymentModal}
        invoice={selectedInvoiceForPay}
        eligibleInvoices={awaitingInvoices}
        onClose={() => { setShowPaymentModal(false); setSelectedInvoiceForPay(null); }}
        onSuccess={(msg) => { setFeedback({ type: 'success', text: msg }); fetchData(); }}
      />
    </div>
  );
};

export default SupplierPaymentsPage;
