import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api';
import SupplierInvoiceKPIs from './components/SupplierInvoiceKPIs';
import SupplierInvoiceSubmitModal from './components/SupplierInvoiceSubmitModal';
import SupplierInvoiceDetailModal from './components/SupplierInvoiceDetailModal';
import SupplierInvoiceTable from './components/SupplierInvoiceTable';

const SupplierInvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('supplier/invoices/');
      setInvoices(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load supplier invoices:', err);
      setFeedback({ type: 'danger', text: 'Failed to load invoices.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchSearch =
        (inv.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.purchase_order_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.notes || '').toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (statusFilter !== 'ALL') {
        const s = (inv.status || '').toUpperCase();
        if (statusFilter === 'REVIEW') {
          return ['SUBMITTED', 'UNDER_STORE_REVIEW', 'PENDING_APPROVAL'].includes(s);
        }
        if (statusFilter === 'APPROVED') {
          return ['APPROVED', 'APPROVED_FOR_PAYMENT'].includes(s);
        }
        if (statusFilter === 'REJECTED') {
          return s.includes('REJECTED');
        }
        return s === statusFilter;
      }
      return true;
    });
  }, [invoices, search, statusFilter]);

  return (
    <div className="container-fluid px-0">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bolder text-slate-900 mb-1">
            <i className="bi bi-receipt-cutoff me-2 text-teal-600"></i>Supplier Invoices &amp; Billing
          </h4>
          <p className="text-slate-500 text-xs mb-0">
            Submit formal billing invoices against accepted purchase orders and track multi-stage verification.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-teal text-white rounded-pill px-3 py-1.5 text-xs font-semibold shadow-sm"
          style={{ backgroundColor: '#0d9488' }}
          onClick={() => setShowSubmitModal(true)}
        >
          <i className="bi bi-plus-lg me-1"></i>Submit Final Invoice
        </button>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-4 text-xs py-2.5 px-3 mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close p-2.5" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      <SupplierInvoiceKPIs invoices={invoices} />

      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-6">
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400"><i className="bi bi-search"></i></span>
              <input
                type="text"
                className="form-control text-xs"
                placeholder="Search by invoice #, PO #, or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-12 col-md-6">
            <select className="form-select text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Verification Statuses</option>
              <option value="REVIEW">Under Store Review</option>
              <option value="PENDING_ADMIN_APPROVAL">Pending Admin Approval</option>
              <option value="APPROVED">Approved for Payment</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Fully Paid</option>
              <option value="REJECTED">Rejected Invoices</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5 text-slate-400 text-xs">
          <div className="spinner-border spinner-border-sm text-teal-600 mb-2"></div>
          <div>Loading invoice records...</div>
        </div>
      ) : (
        <SupplierInvoiceTable invoices={filteredInvoices} onSelectInvoice={setSelectedInvoice} />
      )}

      <SupplierInvoiceSubmitModal
        show={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onSuccess={(msg) => { setFeedback({ type: 'success', text: msg }); fetchInvoices(); }}
      />
      <SupplierInvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
    </div>
  );
};

export default SupplierInvoicesPage;
