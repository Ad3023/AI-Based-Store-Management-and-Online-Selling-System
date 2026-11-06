import React, { useState, useEffect } from 'react';
import api from '../../../api';
import { formatETB } from '../../../utils/currency';

const ManualBankPaymentModal = ({ show, invoice: preselectedInvoice, eligibleInvoices = [], onClose, onSuccess }) => {
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [txRef, setTxRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (show) {
      setErrorMsg('');
      setReceipt(null);
      const target = preselectedInvoice || (eligibleInvoices.length > 0 ? eligibleInvoices[0] : null);
      setSelectedInvoice(target);
      if (target) {
        setAmountPaid(parseFloat(target.outstanding_amount || 0).toFixed(2));
        setBankName(target.supplier_bank_name || 'Commercial Bank of Ethiopia');
        setBankAccount(target.supplier_bank_account_number || '');
      }
      setTxRef(`CBE-FT-${Math.floor(1000000 + Math.random() * 9000000)}`);
    }
  }, [show, preselectedInvoice, eligibleInvoices]);

  const handleInvoiceChange = (invId) => {
    const inv = eligibleInvoices.find((i) => i.id === parseInt(invId, 10));
    setSelectedInvoice(inv || null);
    if (inv) {
      setAmountPaid(parseFloat(inv.outstanding_amount || 0).toFixed(2));
      setBankName(inv.supplier_bank_name || 'Commercial Bank of Ethiopia');
      setBankAccount(inv.supplier_bank_account_number || '');
    }
  };

  const outstanding = parseFloat(selectedInvoice?.outstanding_amount || 0);
  const payAmt = parseFloat(amountPaid || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedInvoice) return setErrorMsg('Please select an eligible approved invoice.');
    if (!txRef.trim()) return setErrorMsg('Bank Transaction Reference is required.');
    if (payAmt <= 0) return setErrorMsg('Payment amount must be greater than zero.');
    if (payAmt > outstanding) return setErrorMsg(`Payment amount (${formatETB(payAmt)}) exceeds outstanding balance (${formatETB(outstanding)}).`);

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('invoice', selectedInvoice.id);
      formData.append('supplier', selectedInvoice.supplier);
      formData.append('amount_paid', payAmt.toFixed(2));
      formData.append('payment_method', 'BANK_TRANSFER');
      formData.append('transaction_reference', txRef.trim());
      formData.append('payment_date', paymentDate);
      formData.append('bank_name', bankName);
      formData.append('bank_account_number', bankAccount);
      formData.append('notes', notes);
      if (receipt) formData.append('receipt', receipt);

      await api.post('products/supplier-payments/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSuccess(`Payment of ${formatETB(payAmt)} (Ref: ${txRef.trim()}) recorded successfully.`);
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to record manual payment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block bg-slate-900/60 backdrop-blur-sm" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className="modal-header bg-slate-900 text-white px-4 py-3">
            <h6 className="modal-title fw-bold text-sm"><i className="bi bi-bank2 me-2 text-emerald-400"></i>Record Manual Bank Transfer Settlement</h6>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={submitting}></button>
          </div>
          <form onSubmit={handleSubmit} className="modal-body p-4 text-xs">
            {errorMsg && <div className="alert alert-danger py-2 px-3 rounded-3 mb-3">{errorMsg}</div>}
            
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold">Select Approved Invoice</label>
                <select className="form-select text-xs" value={selectedInvoice?.id || ''} onChange={(e) => handleInvoiceChange(e.target.value)} required>
                  {eligibleInvoices.length === 0 && <option value="">No approved invoices awaiting payment</option>}
                  {eligibleInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      #{inv.invoice_number} - {inv.supplier_name} (Balance: {formatETB(inv.outstanding_amount)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label fw-bold">Bank Transaction Reference (Unique)</label>
                <input type="text" className="form-control text-xs" value={txRef} onChange={(e) => setTxRef(e.target.value)} placeholder="e.g. CBE-FT-9920192 or Telebirr ID" required />
              </div>

              {selectedInvoice && (
                <div className="col-12">
                  <div className="card bg-slate-50 border-slate-200 rounded-3 p-3">
                    <div className="fw-bold mb-1 text-slate-800">Target Supplier Account Information</div>
                    <div className="row g-2">
                      <div className="col-4"><strong>Bank:</strong> {selectedInvoice.supplier_bank_name || 'Commercial Bank of Ethiopia'}</div>
                      <div className="col-4"><strong>Account Name:</strong> {selectedInvoice.supplier_bank_account_name || selectedInvoice.supplier_name}</div>
                      <div className="col-4"><strong>Account Number:</strong> {selectedInvoice.supplier_bank_account_number || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="col-6 col-md-4">
                <label className="form-label fw-bold">Invoice Total</label>
                <div className="form-control text-xs bg-slate-50">{formatETB(selectedInvoice?.total_amount || 0)}</div>
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label fw-bold">Outstanding Balance</label>
                <div className="form-control text-xs bg-amber-50 text-amber-800 fw-bold">{formatETB(outstanding)}</div>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label fw-bold">Amount Being Paid (ETB)</label>
                <input type="number" step="0.01" max={outstanding} min="1" className="form-control text-xs fw-bold text-emerald-700" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} required />
              </div>

              <div className="col-6">
                <label className="form-label fw-bold">Payment Transfer Date</label>
                <input type="date" className="form-control text-xs" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
              </div>
              <div className="col-6">
                <label className="form-label fw-bold">Bank Name Used</label>
                <input type="text" className="form-control text-xs" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
              </div>

              <div className="col-12">
                <label className="form-label fw-bold">Upload Bank Deposit Slip / Transfer Receipt (PDF / Image)</label>
                <input type="file" className="form-control text-xs" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setReceipt(e.target.files[0])} />
              </div>

              <div className="col-12">
                <label className="form-label fw-bold">Settlement Notes</label>
                <textarea rows="2" className="form-control text-xs" placeholder="e.g. Manual bank wire transfer cleared via CBE Birr..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="modal-footer px-0 pb-0 pt-3 mt-3 border-top">
              <button type="button" className="btn btn-sm btn-light rounded-pill px-3" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-emerald text-white rounded-pill px-4" style={{ backgroundColor: '#059669' }} disabled={submitting || !selectedInvoice || outstanding <= 0}>
                {submitting ? 'Recording Settlement...' : 'Record Manual Bank Settlement'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ManualBankPaymentModal;

