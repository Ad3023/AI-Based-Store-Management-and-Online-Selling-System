import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import RFQTable from './components/RFQTable';
import RFQCreateModal from './components/RFQCreateModal';
import RFQDetailModal from './components/RFQDetailModal';
import QuotationComparisonTable from './components/QuotationComparisonTable';

const ManagerRFQPage = () => {
  const navigate = useNavigate();
  const [rfqs, setRfqs] = useState([]);
  const [comparisonRows, setComparisonRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('RFQS'); // 'RFQS' or 'COMPARE'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rfqRes, compRes] = await Promise.all([
        api.get('products/rfqs/'),
        api.get('products/quotations/compare/')
      ]);
      setRfqs(rfqRes.data.results || rfqRes.data || []);
      setComparisonRows(compRes.data.results || compRes.data || []);
    } catch (err) {
      console.error('Failed to load RFQs and quotations:', err);
      setFeedback({ type: 'danger', text: 'Failed to load quotation requests.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectQuotation = async (quotationId) => {
    try {
      setSubmittingAction(true);
      await api.post(`products/quotations/${quotationId}/select/`);
      setFeedback({ type: 'success', text: 'Quotation selected successfully! You can now generate the Purchase Order.' });
      fetchData();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to select quotation.' });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCreatePO = async (quotationId) => {
    try {
      setSubmittingAction(true);
      const res = await api.post(`products/quotations/${quotationId}/create-po/`);
      setFeedback({ type: 'success', text: `Purchase Order ${res.data.purchase_order.request_number} generated from quoted prices!` });
      fetchData();
      navigate('/manager/procurement/purchase-orders');
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to generate Purchase Order.' });
    } finally {
      setSubmittingAction(false);
    }
  };

  const filteredRfqs = useMemo(() => {
    return rfqs.filter((r) => {
      const matchSearch =
        (r.rfq_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.supplier_name || '').toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (statusFilter !== 'ALL' && (r.status || '').toUpperCase() !== statusFilter) return false;
      return true;
    });
  }, [rfqs, search, statusFilter]);

  return (
    <div className="container-fluid px-0">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bolder text-slate-900 mb-1">
            <i className="bi bi-chat-left-quote me-2 text-teal-600"></i>Supplier Communication &amp; Quotations
          </h4>
          <p className="text-slate-500 text-xs mb-0">
            Request official price quotations from registered suppliers and generate Purchase Orders with agreed pricing.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-teal text-white rounded-pill px-3 py-1.5 text-xs font-semibold shadow-sm"
          style={{ backgroundColor: '#0d9488' }}
          onClick={() => setShowCreateModal(true)}
        >
          <i className="bi bi-send-plus me-1"></i>Create RFQ
        </button>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-4 text-xs py-2.5 px-3 mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close p-2.5" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Navigation Tabs & Search */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <ul className="nav nav-pills text-xs">
            <li className="nav-item">
              <button
                className={`nav-link rounded-pill px-3 py-1.5 ${activeTab === 'RFQS' ? 'active bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setActiveTab('RFQS')}
              >
                All RFQs <span className="badge bg-teal-600 ms-1">{rfqs.length}</span>
              </button>
            </li>
            <li className="nav-item ms-2">
              <button
                className={`nav-link rounded-pill px-3 py-1.5 ${activeTab === 'COMPARE' ? 'active bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setActiveTab('COMPARE')}
              >
                Compare Quotations <span className="badge bg-slate-200 text-slate-800 ms-1">{comparisonRows.length}</span>
              </button>
            </li>
          </ul>

          <div style={{ maxWidth: '350px', width: '100%' }}>
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400"><i className="bi bi-search"></i></span>
              <input
                type="text"
                className="form-control text-xs"
                placeholder="Search RFQs or quotations..."
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
          <div>Loading quotation requests...</div>
        </div>
      ) : activeTab === 'RFQS' ? (
        <RFQTable rfqs={filteredRfqs} onSelectRFQ={(r) => setSelectedRFQ(r)} />
      ) : (
        <QuotationComparisonTable
          comparisonRows={comparisonRows}
          onSelectQuotation={handleSelectQuotation}
          onCreatePO={handleCreatePO}
          submitting={submittingAction}
        />
      )}

      <RFQCreateModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(msg) => { setFeedback({ type: 'success', text: msg }); fetchData(); }}
      />
      <RFQDetailModal
        rfq={selectedRFQ}
        onClose={() => setSelectedRFQ(null)}
        onRefresh={() => { fetchData(); setSelectedRFQ(null); }}
        onNavigateToPO={(poId) => navigate('/manager/procurement/purchase-orders')}
      />
    </div>
  );
};

export default ManagerRFQPage;

