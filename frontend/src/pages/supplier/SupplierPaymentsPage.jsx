import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api';
import SupplierPaymentKPIs from './components/SupplierPaymentKPIs';
import SupplierPaymentTable from './components/SupplierPaymentTable';

const SupplierPaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [payRes, invRes] = await Promise.all([
        api.get('supplier/payments/'),
        api.get('supplier/invoices/'),
      ]);
      setPayments(payRes.data.results || payRes.data || []);
      setInvoices(invRes.data.results || invRes.data || []);
    } catch (err) {
      console.error('Failed to load supplier payments:', err);
      setFeedback({ type: 'danger', text: 'Failed to load payment settlement records.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchSearch =
        (p.transaction_reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.invoice_number || p.supplier_invoice || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.purchase_order_reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.notes || '').toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [payments, search]);

  return (
    <div className="container-fluid px-0">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bolder text-slate-900 mb-1">
            <i className="bi bi-wallet2 me-2 text-teal-600"></i>Supplier Payment Disbursements
          </h4>
          <p className="text-slate-500 text-xs mb-0">
            View external manual bank transfer settlements, transaction references, and download official payment receipts.
          </p>
        </div>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-4 text-xs py-2.5 px-3 mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close p-2.5" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      <SupplierPaymentKPIs payments={payments} invoices={invoices} />

      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="input-group">
          <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400"><i className="bi bi-search"></i></span>
          <input
            type="text"
            className="form-control text-xs"
            placeholder="Search payments by bank transaction ref, invoice #, PO #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5 text-slate-400 text-xs">
          <div className="spinner-border spinner-border-sm text-teal-600 mb-2"></div>
          <div>Loading financial settlements...</div>
        </div>
      ) : (
        <SupplierPaymentTable payments={filteredPayments} />
      )}
    </div>
  );
};

export default SupplierPaymentsPage;
