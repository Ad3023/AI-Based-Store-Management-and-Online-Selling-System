import React, { useState, useEffect } from 'react';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const ManagerSegmentationPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [message, setMessage] = useState('');

  const fetchSegmentation = async () => {
    try {
      setLoading(true);
      const res = await api.get('recommendations/segmentation/');
      setData(res.data);
    } catch (err) {
      console.error("Segmentation error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSegmentation();
  }, []);

  const handleRetrain = async () => {
    try {
      setRetraining(true);
      setMessage('');
      const res = await api.post('recommendations/segmentation/');
      setMessage(res.data.message || 'Model retrained successfully.');
      fetchSegmentation();
    } catch (err) {
      alert("Failed to retrain K-Means model.");
    } finally {
      setRetraining(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Running Scikit-learn K-Means RFM clustering on database...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-2">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-primary border-opacity-25 bg-primary bg-opacity-10">
            <i className="bi bi-robot text-primary"></i>
            <span className="small fw-semibold text-primary">Unsupervised Machine Learning</span>
          </div>
          <h2 className="fw-bolder mb-1 text-dark">AI Customer Segmentation</h2>
          <p className="text-muted small mb-0">
            K-Means clustering on Recency, Frequency, and Monetary (RFM) vectors for customer behavioral insights
          </p>
        </div>

        <button
          className="btn btn-primary-gradient rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2"
          onClick={handleRetrain}
          disabled={retraining}
        >
          {retraining ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status"></span>
              Fitting K-Means...
            </>
          ) : (
            <>
              <i className="bi bi-arrow-repeat"></i> Retrain K-Means Model
            </>
          )}
        </button>
      </div>

      {message && (
        <div className="alert alert-success alert-dismissible fade show rounded-3 mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {message}
          <button type="button" className="btn-close" onClick={() => setMessage('')}></button>
        </div>
      )}

      {/* Algorithm Explainer Banner */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)', color: '#fff' }}>
        <div className="row align-items-center g-4">
          <div className="col-md-8">
            <h5 className="fw-bold text-white mb-2 d-flex align-items-center gap-2">
              <i className="bi bi-cpu-fill text-info"></i> How the AI Segmentation Works
            </h5>
            <p className="text-secondary small mb-3" style={{ lineHeight: '1.6' }}>
              The engine queries live PostgreSQL transactions and builds an RFM vector for every customer:
              <strong> Recency</strong> (days since last purchase), <strong>Frequency</strong> (total order count),
              and <strong>Monetary value</strong> (lifetime expenditure).
              Features are scaled with Scikit-learn's <code>StandardScaler</code> and grouped using <code>KMeans</code> into distinct shopping personas.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <span className="badge bg-white bg-opacity-10 text-light border border-light border-opacity-25">StandardScaler</span>
              <span className="badge bg-white bg-opacity-10 text-light border border-light border-opacity-25">KMeans(k=4)</span>
              <span className="badge bg-white bg-opacity-10 text-light border border-light border-opacity-25">RFM Feature Vector</span>
            </div>
          </div>
          <div className="col-md-4 text-md-end">
            <div className="p-3 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <span className="text-secondary small d-block">Total Customers Segmented:</span>
              <h2 className="fw-bolder text-info mb-0">{data?.total_customers_segmented || 0}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Cluster Summaries Cards */}
      <h5 className="fw-bold mb-3">Identified Customer Clusters</h5>
      <div className="row g-3 mb-4">
        {data?.clusters_summary?.map((cl) => (
          <div key={cl.cluster_id} className="col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill">
                  Cluster #{cl.cluster_id}
                </span>
                <span className="fw-bold text-dark">{cl.count} customers</span>
              </div>

              <h6 className="fw-bold text-dark mb-2">{cl.name}</h6>

              <div className="small text-muted mb-3">
                Avg Spend: <strong className="text-primary">{formatETB(cl.total_spent / (cl.count || 1))}</strong>
              </div>

              <div className="p-2 rounded-3 bg-light border small text-secondary">
                <strong className="text-dark d-block mb-1" style={{ fontSize: '0.72rem' }}>AI Suggested Action:</strong>
                <span style={{ fontSize: '0.78rem' }}>{cl.suggested_action}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Segmented Customers Table */}
      <div className="card border-0 shadow-sm rounded-4 p-4">
        <h5 className="fw-bold mb-3">Individual Customer Segment Classification</h5>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="table-light text-uppercase small text-muted" style={{ fontSize: '0.72rem' }}>
              <tr>
                <th>Customer</th>
                <th>Assigned AI Segment</th>
                <th>Cluster ID</th>
                <th>Lifetime Orders</th>
                <th>Total Spent</th>
                <th>Avg Order Value</th>
                <th>Suggested Marketing Action</th>
              </tr>
            </thead>
            <tbody className="small">
              {data?.customers?.map((cust) => (
                <tr key={cust.id}>
                  <td>
                    <div className="fw-bold text-dark">{cust.username}</div>
                    <small className="text-muted">{cust.email}</small>
                  </td>
                  <td>
                    <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1 rounded-pill fw-semibold">
                      {cust.segment_name}
                    </span>
                  </td>
                  <td><code>#{cust.cluster_id}</code></td>
                  <td className="fw-bold">{cust.order_count}</td>
                  <td className="fw-bold text-primary">{formatETB(cust.total_spent)}</td>
                  <td className="text-muted">{formatETB(cust.avg_order_value)}</td>
                  <td className="text-secondary small">{cust.suggested_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManagerSegmentationPage;
