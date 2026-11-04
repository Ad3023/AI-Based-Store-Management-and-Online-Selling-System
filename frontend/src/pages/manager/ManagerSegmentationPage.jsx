import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const ManagerSegmentationPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Filters and Sorting
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('spent-desc');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const fetchSegmentation = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('recommendations/segmentation/');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load customer segmentation:', err);
      setFeedback({
        type: 'danger',
        text: 'Failed to load customer segmentation analytics. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSegmentation();
  }, [fetchSegmentation]);

  const handleRetrain = async () => {
    try {
      setRetraining(true);
      setFeedback({ type: '', text: '' });
      const res = await api.post('recommendations/segmentation/');
      setFeedback({
        type: 'success',
        text: res.data.message || 'AI Customer segmentation model retrained successfully.'
      });
      fetchSegmentation();
    } catch (err) {
      console.error('Retrain error:', err);
      setFeedback({
        type: 'danger',
        text: 'Failed to retrain segmentation model. Please check database connectivity.'
      });
    } finally {
      setRetraining(false);
    }
  };

  // Helper for segment badge styling
  const getSegmentBadgeStyle = (segmentName) => {
    const s = String(segmentName || '').toLowerCase();
    if (s.includes('champion') || s.includes('high-value') || s.includes('vip')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (s.includes('loyal') || s.includes('frequent') || s.includes('regular')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (s.includes('occasional') || s.includes('active')) {
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    }
    if (s.includes('new') || s.includes('prospect')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (s.includes('risk') || s.includes('dormant') || s.includes('inactive')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };

  // Filtered and sorted customer list
  const filteredCustomers = useMemo(() => {
    let list = data?.customers || [];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        (c.username && c.username.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.segment_name && c.segment_name.toLowerCase().includes(q))
      );
    }

    if (segmentFilter !== 'ALL') {
      list = list.filter((c) => c.segment_name === segmentFilter || String(c.cluster_id) === segmentFilter);
    }

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'spent-desc':
          return (Number(b.total_spent) || 0) - (Number(a.total_spent) || 0);
        case 'spent-asc':
          return (Number(a.total_spent) || 0) - (Number(b.total_spent) || 0);
        case 'orders-desc':
          return (b.order_count || 0) - (a.order_count || 0);
        case 'aov-desc':
          return (Number(b.avg_order_value) || 0) - (Number(a.avg_order_value) || 0);
        case 'recency-asc':
          return (a.last_order_days || 0) - (b.last_order_days || 0);
        case 'username':
          return (a.username || '').localeCompare(b.username || '');
        default:
          return (Number(b.total_spent) || 0) - (Number(a.total_spent) || 0);
      }
    });
  }, [data?.customers, search, segmentFilter, sortBy]);

  // Aggregate metrics
  const totalCustomers = data?.total_customers_segmented || 0;
  const clusters = data?.clusters_summary || [];
  const totalSpentAll = useMemo(() => {
    return (data?.customers || []).reduce((acc, c) => acc + (Number(c.total_spent) || 0), 0);
  }, [data?.customers]);
  const avgLifetimeValue = totalCustomers > 0 ? totalSpentAll / totalCustomers : 0;

  const uniqueSegments = useMemo(() => {
    const set = new Set();
    (data?.customers || []).forEach((c) => {
      if (c.segment_name) set.add(c.segment_name);
    });
    return Array.from(set);
  }, [data?.customers]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Computing customer behavioral RFM clusters...</p>
      </div>
    );
  }

  return (
    <div className="pb-5">
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-info border-opacity-25 bg-info bg-opacity-10">
            <i className="bi bi-people-fill text-info"></i>
            <span className="small fw-bold text-slate-800">Customer Intelligence &amp; Retention</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Customer Segmentation</h2>
          <p className="text-slate-500 text-xs mb-0">
            Behavioral RFM (Recency, Frequency, Monetary) analytics categorizing customers into actionable purchasing groups.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-outline-secondary rounded-pill px-3 py-2 text-xs font-bold d-flex align-items-center gap-1.5"
            onClick={fetchSegmentation}
          >
            <i className="bi bi-arrow-clockwise"></i> Refresh
          </button>

          <button
            type="button"
            className="btn btn-primary rounded-pill px-3 py-2 text-xs font-bold d-flex align-items-center gap-1.5 shadow-sm"
            onClick={handleRetrain}
            disabled={retraining}
          >
            {retraining ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status"></span>
                <span>Clustering...</span>
              </>
            ) : (
              <>
                <i className="bi bi-cpu-fill"></i> Retrain Model
              </>
            )}
          </button>
        </div>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm`} role="alert">
          <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-1.5`}></i>
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Top 4 KPI Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
            <div className="d-flex align-items-center gap-2.5">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                style={{ width: '40px', height: '40px', backgroundColor: 'rgba(27, 100, 218, 0.1)' }}
              >
                <i className="bi bi-people fs-5"></i>
              </div>
              <div>
                <span className="text-muted text-xs d-block">Total Customers</span>
                <h4 className="fw-bolder text-slate-900 mb-0">{totalCustomers}</h4>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
            <div className="d-flex align-items-center gap-2.5">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-success flex-shrink-0"
                style={{ width: '40px', height: '40px', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
              >
                <i className="bi bi-cash-stack fs-5"></i>
              </div>
              <div>
                <span className="text-muted text-xs d-block">Segmented Revenue</span>
                <h4 className="fw-bolder text-slate-900 mb-0">{formatETB(totalSpentAll)}</h4>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
            <div className="d-flex align-items-center gap-2.5">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-warning flex-shrink-0"
                style={{ width: '40px', height: '40px', backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
              >
                <i className="bi bi-graph-up-arrow fs-5"></i>
              </div>
              <div>
                <span className="text-muted text-xs d-block">Avg Customer LTV</span>
                <h4 className="fw-bolder text-slate-900 mb-0">{formatETB(avgLifetimeValue)}</h4>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
            <div className="d-flex align-items-center gap-2.5">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-info flex-shrink-0"
                style={{ width: '40px', height: '40px', backgroundColor: 'rgba(6, 182, 212, 0.1)' }}
              >
                <i className="bi bi-diagram-3 fs-5"></i>
              </div>
              <div>
                <span className="text-muted text-xs d-block">Active Clusters</span>
                <h4 className="fw-bolder text-slate-900 mb-0">{clusters.length}</h4>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Identified Customer Clusters Section */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold text-slate-900 text-sm mb-0">Identified Behavioral Groups</h5>
        <button
          type="button"
          className="btn btn-link btn-sm text-primary text-decoration-none text-xs p-0 d-flex align-items-center gap-1"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
        >
          <i className={`bi ${showTechnicalDetails ? 'bi-chevron-up' : 'bi-info-circle'}`}></i>
          <span>{showTechnicalDetails ? 'Hide Model Details' : 'How Segmentation Works'}</span>
        </button>
      </div>

      {/* Algorithm Explainer (Collapsible) */}
      {showTechnicalDetails && (
        <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 text-white" style={{ background: 'linear-gradient(135deg, #0c2340 0%, #0f172a 100%)' }}>
          <div className="row align-items-center g-3">
            <div className="col-lg-8">
              <h6 className="fw-bold text-white mb-2 d-flex align-items-center gap-2">
                <i className="bi bi-cpu text-info"></i> Machine Learning Architecture (RFM Clustering)
              </h6>
              <p className="text-slate-300 text-xs mb-3" style={{ lineHeight: '1.6' }}>
                The engine analyzes verified customer purchase transactions and builds an individual <strong>RFM vector</strong>:
                <strong> Recency</strong> (days since last confirmed purchase), <strong>Frequency</strong> (total order count),
                and <strong>Monetary value</strong> (lifetime expenditure).
                Vectors are standardized and grouped via K-Means to identify distinct purchasing personas.
              </p>
              <div className="d-flex flex-wrap gap-2 text-[11px]">
                <span className="badge bg-white bg-opacity-10 text-light border border-light border-opacity-25">StandardScaler</span>
                <span className="badge bg-white bg-opacity-10 text-light border border-light border-opacity-25">KMeans Clustering</span>
                <span className="badge bg-white bg-opacity-10 text-light border border-light border-opacity-25">Deterministic Recency Scoring</span>
              </div>
            </div>
            <div className="col-lg-4 text-lg-end">
              <div className="p-3 rounded-3 bg-white bg-opacity-5 border border-white border-opacity-10 d-inline-block text-start w-100">
                <span className="text-slate-400 text-xs d-block">Segmented Population:</span>
                <strong className="fs-4 text-info fw-bolder">{totalCustomers} Registered Customers</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cluster Summary Cards Grid */}
      {clusters.length === 0 ? (
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 text-center bg-white mb-4">
          <i className="bi bi-people fs-2 text-slate-300 mb-2"></i>
          <h6 className="fw-bold text-slate-800">No Customer Segments Computed Yet</h6>
          <p className="text-slate-500 text-xs mb-0">
            As customers register and place orders through the storefront, the segmentation engine will automatically group them into behavioral clusters.
          </p>
        </div>
      ) : (
        <div className="row g-3 mb-4">
          {clusters.map((cl) => {
            const avgSpend = cl.count > 0 ? cl.total_spent / cl.count : 0;
            const pct = totalCustomers > 0 ? Math.round((cl.count / totalCustomers) * 100) : 0;

            return (
              <div key={cl.cluster_id} className="col-md-6 col-xl-3">
                <div className="card ethio-card border-0 shadow-sm rounded-4 p-3.5 bg-white h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="badge bg-primary bg-opacity-10 text-primary text-[11px] rounded-pill font-mono">
                        Cluster #{cl.cluster_id}
                      </span>
                      <span className="fw-bold text-xs text-slate-900">
                        {cl.count} {cl.count === 1 ? 'customer' : 'customers'} ({pct}%)
                      </span>
                    </div>

                    <h6 className="fw-bold text-slate-900 mb-1">{cl.name}</h6>
                    <div className="text-xs text-slate-500 mb-2">
                      Avg Spend: <strong className="text-primary">{formatETB(avgSpend)}</strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-3 bg-slate-50 border border-slate-200 text-xs mt-2">
                    <strong className="text-slate-700 text-[11px] d-block mb-1">
                      <i className="bi bi-lightbulb text-warning me-1"></i> Suggested Action:
                    </strong>
                    <span className="text-slate-600 text-[11px]">{cl.suggested_action}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white mb-3">
        <div className="row g-2 align-items-center">
          {/* Search Box */}
          <div className="col-md-5">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control bg-slate-50 border-start-0 text-xs"
                placeholder="Search by customer name, email, or segment..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="btn btn-outline-secondary" type="button" onClick={() => setSearch('')}>
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
          </div>

          {/* Segment Filter Dropdown */}
          <div className="col-md-4 col-sm-6">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                <i className="bi bi-funnel"></i>
              </span>
              <select
                className="form-select bg-slate-50 border-start-0 text-xs"
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
              >
                <option value="ALL">All Segments ({totalCustomers})</option>
                {uniqueSegments.map((seg) => (
                  <option key={seg} value={seg}>
                    {seg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="col-md-3 col-sm-6">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-slate-50 border-end-0 text-muted">
                <i className="bi bi-sort-down"></i>
              </span>
              <select
                className="form-select bg-slate-50 border-start-0 text-xs"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="spent-desc">Highest Spend</option>
                <option value="spent-asc">Lowest Spend</option>
                <option value="orders-desc">Most Orders</option>
                <option value="aov-desc">Highest Avg Order</option>
                <option value="recency-asc">Most Recent</option>
                <option value="username">Username (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Classification Table */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
          <div>
            <h6 className="fw-bold text-slate-900 text-xs mb-0">Customer Segment Profiles</h6>
            <small className="text-slate-400 text-[11px]">
              Showing {filteredCustomers.length} of {totalCustomers} customers
            </small>
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-people fs-1 text-slate-300 mb-2 d-block"></i>
            <h6 className="fw-bold text-slate-700">No Customers Found</h6>
            <p className="text-slate-500 text-xs mb-0">
              {search || segmentFilter !== 'ALL'
                ? 'No customer records match the active search or segment filter.'
                : 'No customer accounts registered yet for segmentation.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
                <tr>
                  <th className="ps-4">Customer</th>
                  <th>Behavioral Segment</th>
                  <th className="text-center">Cluster</th>
                  <th className="text-center">Orders</th>
                  <th className="text-end">Total Spent</th>
                  <th className="text-end">Avg Order Value</th>
                  <th className="text-center">Recency</th>
                  <th className="pe-4">Suggested Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((cust) => {
                  const badgeClass = getSegmentBadgeStyle(cust.segment_name);

                  return (
                    <tr key={cust.id}>
                      <td className="ps-4">
                        <div className="fw-bold text-slate-900">{cust.username}</div>
                        <small className="text-slate-400 text-[11px]">{cust.email || 'No email'}</small>
                      </td>
                      <td>
                        <span className={`badge border rounded-pill px-2.5 py-1 text-[11px] fw-semibold ${badgeClass}`}>
                          {cust.segment_name || 'Active Shopper'}
                        </span>
                      </td>
                      <td className="text-center">
                        <code className="text-slate-600">#{cust.cluster_id}</code>
                      </td>
                      <td className="text-center fw-bold text-slate-800">
                        {cust.order_count || 0}
                      </td>
                      <td className="text-end fw-bolder text-slate-900">
                        {formatETB(cust.total_spent)}
                      </td>
                      <td className="text-end text-slate-600">
                        {formatETB(cust.avg_order_value)}
                      </td>
                      <td className="text-center text-slate-600">
                        {cust.last_order_days && cust.last_order_days < 999
                          ? `${cust.last_order_days}d ago`
                          : <span className="text-slate-400">New</span>}
                      </td>
                      <td className="pe-4">
                        <span className="text-slate-600 text-[11px] text-truncate d-inline-block" style={{ maxWidth: '280px' }} title={cust.suggested_action}>
                          {cust.suggested_action || 'Engage with targeted promotions.'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerSegmentationPage;
