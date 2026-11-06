import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api';
import SupplierRFQTable from './components/SupplierRFQTable';
import SupplierQuotationModal from './components/SupplierQuotationModal';
import SupplierDeclineRFQModal from './components/SupplierDeclineRFQModal';
import SupplierQuotationsHistoryTable from './components/SupplierQuotationsHistoryTable';

const SupplierQuotationsPage = () => {
  const [rfqs, setRfqs] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('RFQS'); // 'RFQS' or 'QUOTATIONS'
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [selectedRFQForQuote, setSelectedRFQForQuote] = useState(null);
  const [selectedRFQForDecline, setSelectedRFQForDecline] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rfqRes, quoRes] = await Promise.all([
        api.get('supplier/rfqs/'),
        api.get('supplier/quotations/'),
      ]);
      setRfqs(rfqRes.data.results || rfqRes.data || []);
      setQuotations(quoRes.data.results || quoRes.data || []);
    } catch (err) {
      console.error('Failed to load supplier RFQs and quotations:', err);
      setFeedback({ type: 'danger', text: 'Failed to load quotation requests.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRfqs = useMemo(() => {
    return rfqs.filter((r) => {
      return (
        (r.rfq_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.notes || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [rfqs, search]);

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      return (
        (q.quotation_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (q.rfq_number || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [quotations, search]);

  return (
    <div className="container-fluid px-0">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bolder text-slate-900 mb-1">
            <i className="bi bi-chat-left-quote me-2 text-teal-600"></i>Quotation Requests &amp; Pricing
          </h4>
          <p className="text-slate-500 text-xs mb-0">
            Receive RFQs from EthioTech Market, submit competitive price quotations, and track order selections.
          </p>
        </div>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-4 text-xs py-2.5 px-3 mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close p-2.5" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Navigation Tabs and Search Bar */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <ul className="nav nav-pills text-xs">
            <li className="nav-item">
              <button
                className={`nav-link rounded-pill px-3 py-1.5 ${activeTab === 'RFQS' ? 'active bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setActiveTab('RFQS')}
              >
                Quotation Requests <span className="badge bg-teal-600 ms-1">{rfqs.length}</span>
              </button>
            </li>
            <li className="nav-item ms-2">
              <button
                className={`nav-link rounded-pill px-3 py-1.5 ${activeTab === 'QUOTATIONS' ? 'active bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setActiveTab('QUOTATIONS')}
              >
                My Submitted Quotations <span className="badge bg-slate-200 text-slate-800 ms-1">{quotations.length}</span>
              </button>
            </li>
          </ul>

          <div style={{ maxWidth: '350px', width: '100%' }}>
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400"><i className="bi bi-search"></i></span>
              <input
                type="text"
                className="form-control text-xs"
                placeholder={activeTab === 'RFQS' ? 'Search requests...' : 'Search quotations...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5 text-slate-400 text-xs">
          <div className="spinner-border spinner-border-sm text-teal-600 mb-2"></div>
          <div>Loading quotation data...</div>
        </div>
      ) : activeTab === 'RFQS' ? (
        <SupplierRFQTable
          rfqs={filteredRfqs}
          onRespond={(r) => setSelectedRFQForQuote(r)}
          onDecline={(r) => setSelectedRFQForDecline(r)}
        />
      ) : (
        <SupplierQuotationsHistoryTable quotations={filteredQuotations} />
      )}

      <SupplierQuotationModal
        rfq={selectedRFQForQuote}
        onClose={() => setSelectedRFQForQuote(null)}
        onSuccess={(msg) => { setFeedback({ type: 'success', text: msg }); fetchData(); }}
      />

      <SupplierDeclineRFQModal
        rfq={selectedRFQForDecline}
        onClose={() => setSelectedRFQForDecline(null)}
        onSuccess={(msg) => { setFeedback({ type: 'info', text: msg }); fetchData(); }}
      />
    </div>
  );
};

export default SupplierQuotationsPage;

