import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { formatETB } from '../utils/currency';

const AdminInventoryMonitoring = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('low_stock'); // 'low_stock', 'awaiting', 'emails', 'failed_emails', 'prs', 'replenishment', 'audit'
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchMonitoringData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.get('products/admin/monitoring/');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load admin inventory monitoring data:', err);
      setErrorMsg('Failed to load inventory monitoring ledger from server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  if (loading) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted text-xs mt-2 mb-0">Aggregating real-time inventory, procurement, and supplier alerts...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="alert alert-danger rounded-4 text-xs shadow-sm p-4">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        {errorMsg}
        <button className="btn btn-sm btn-outline-danger ms-3 rounded-pill" onClick={fetchMonitoringData}>
          Try Again
        </button>
      </div>
    );
  }

  const summary = data?.summary || {
    total_products: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
    awaiting_replenishment_count: 0,
    total_supplier_emails_sent: 0,
    failed_supplier_emails_count: 0,
    pending_purchase_requests_count: 0,
    total_restocks_count: 0,
  };

  const lowStockProducts = data?.low_stock_products || [];
  const outOfStockProducts = data?.out_of_stock_products || [];
  const awaitingReplenishment = data?.awaiting_replenishment || [];
  const supplierEmails = data?.supplier_email_history || [];
  const failedEmails = data?.failed_supplier_emails || [];
  const pendingPRs = data?.pending_purchase_requests || [];
  const replenishmentHistory = data?.replenishment_history || [];
  const alertHistory = data?.stock_alert_history || [];

  return (
    <div className="admin-inventory-monitoring-module">
      {/* Module Title & Overview */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-white"
                style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}
              >
                <i className="bi bi-shield-check fs-5"></i>
              </div>
              <h4 className="fw-bolder text-slate-900 mb-0">Inventory &amp; Replenishment Oversight</h4>
              <span className="badge bg-primary text-white text-xs px-2.5 py-1 rounded-pill">
                Admin Audit Console
              </span>
            </div>
            <p className="text-muted small mb-0">
              High-level supervisory monitoring of warehouse stock, supplier communication, and replenishment workflows without performing operational purchasing.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-pill px-3 fw-bold text-xs d-inline-flex align-items-center gap-1.5 shadow-sm"
              onClick={fetchMonitoringData}
            >
              <i className="bi bi-arrow-clockwise"></i> Refresh Audit
            </button>
            <Link
              to="/manager/suppliers"
              className="btn btn-outline-primary btn-sm rounded-pill px-3 fw-bold text-xs d-inline-flex align-items-center gap-1.5 shadow-sm"
            >
              <i className="bi bi-truck"></i> Suppliers Directory
            </Link>
          </div>
        </div>

        {/* 6 Executive Summary Metrics Cards */}
        <div className="row g-3 mt-2">
          {/* 1. Low-Stock Products */}
          <div className="col-6 col-md-4 col-xl-2">
            <div
              className={`p-3 rounded-4 border transition cursor-pointer ${
                activeSubTab === 'low_stock' ? 'bg-amber-50 border-warning shadow-sm' : 'bg-slate-50 border-slate-200'
              }`}
              onClick={() => setActiveSubTab('low_stock')}
            >
              <span className="text-muted text-[11px] fw-bold uppercase d-block mb-1">Low-Stock Items</span>
              <div className="d-flex align-items-baseline gap-2">
                <h4 className="fw-bolder text-warning mb-0">{summary.low_stock_count}</h4>
                <small className="text-muted text-[10px]">&le; Min Level</small>
              </div>
            </div>
          </div>

          {/* 2. Out-of-Stock Products */}
          <div className="col-6 col-md-4 col-xl-2">
            <div
              className={`p-3 rounded-4 border transition cursor-pointer ${
                activeSubTab === 'out_of_stock' ? 'bg-red-50 border-danger shadow-sm' : 'bg-slate-50 border-slate-200'
              }`}
              onClick={() => setActiveSubTab('out_of_stock')}
            >
              <span className="text-muted text-[11px] fw-bold uppercase d-block mb-1">Out of Stock</span>
              <div className="d-flex align-items-baseline gap-2">
                <h4 className="fw-bolder text-danger mb-0">{summary.out_of_stock_count}</h4>
                <small className="text-muted text-[10px]">0 Units</small>
              </div>
            </div>
          </div>

          {/* 3. Awaiting Replenishment */}
          <div className="col-6 col-md-4 col-xl-2">
            <div
              className={`p-3 rounded-4 border transition cursor-pointer ${
                activeSubTab === 'awaiting' ? 'bg-blue-50 border-primary shadow-sm' : 'bg-slate-50 border-slate-200'
              }`}
              onClick={() => setActiveSubTab('awaiting')}
            >
              <span className="text-muted text-[11px] fw-bold uppercase d-block mb-1">In Procurement</span>
              <div className="d-flex align-items-baseline gap-2">
                <h4 className="fw-bolder text-primary mb-0">{summary.awaiting_replenishment_count}</h4>
                <small className="text-muted text-[10px]">Active PRs</small>
              </div>
            </div>
          </div>

          {/* 4. Supplier Emails Sent */}
          <div className="col-6 col-md-4 col-xl-2">
            <div
              className={`p-3 rounded-4 border transition cursor-pointer ${
                activeSubTab === 'emails' ? 'bg-emerald-50 border-success shadow-sm' : 'bg-slate-50 border-slate-200'
              }`}
              onClick={() => setActiveSubTab('emails')}
            >
              <span className="text-muted text-[11px] fw-bold uppercase d-block mb-1">Emails Sent</span>
              <div className="d-flex align-items-baseline gap-2">
                <h4 className="fw-bolder text-success mb-0">{summary.total_supplier_emails_sent}</h4>
                <small className="text-muted text-[10px]">Inquiries</small>
              </div>
            </div>
          </div>

          {/* 5. Failed Supplier Emails */}
          <div className="col-6 col-md-4 col-xl-2">
            <div
              className={`p-3 rounded-4 border transition cursor-pointer ${
                activeSubTab === 'failed_emails' ? 'bg-rose-50 border-danger shadow-sm' : 'bg-slate-50 border-slate-200'
              }`}
              onClick={() => setActiveSubTab('failed_emails')}
            >
              <span className="text-muted text-[11px] fw-bold uppercase d-block mb-1">Failed Attempts</span>
              <div className="d-flex align-items-baseline gap-2">
                <h4 className="fw-bolder text-danger mb-0">{summary.failed_supplier_emails_count}</h4>
                <small className="text-muted text-[10px]">Need Email</small>
              </div>
            </div>
          </div>

          {/* 6. Pending Purchase Requests */}
          <div className="col-6 col-md-4 col-xl-2">
            <div
              className={`p-3 rounded-4 border transition cursor-pointer ${
                activeSubTab === 'prs' ? 'bg-purple-50 border-purple-300 shadow-sm' : 'bg-slate-50 border-slate-200'
              }`}
              onClick={() => setActiveSubTab('prs')}
            >
              <span className="text-muted text-[11px] fw-bold uppercase d-block mb-1">Pending PRs</span>
              <div className="d-flex align-items-baseline gap-2">
                <h4 className="fw-bolder text-purple-700 mb-0">{summary.pending_purchase_requests_count}</h4>
                <small className="text-muted text-[10px]">Awaiting Mgr</small>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="d-flex flex-wrap gap-2 mt-4 pt-3 border-top border-slate-100">
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs fw-bold transition ${
              activeSubTab === 'low_stock' ? 'btn-warning text-dark shadow-sm' : 'btn-outline-secondary bg-white'
            }`}
            onClick={() => setActiveSubTab('low_stock')}
          >
            <i className="bi bi-exclamation-triangle-fill me-1 text-warning"></i>
            Low-Stock Products ({lowStockProducts.length})
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs fw-bold transition ${
              activeSubTab === 'out_of_stock' ? 'btn-danger text-white shadow-sm' : 'btn-outline-secondary bg-white'
            }`}
            onClick={() => setActiveSubTab('out_of_stock')}
          >
            <i className="bi bi-x-octagon-fill me-1"></i>
            Out-of-Stock ({outOfStockProducts.length})
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs fw-bold transition ${
              activeSubTab === 'awaiting' ? 'btn-primary text-white shadow-sm' : 'btn-outline-secondary bg-white'
            }`}
            onClick={() => setActiveSubTab('awaiting')}
          >
            <i className="bi bi-hourglass-split me-1"></i>
            Awaiting Replenishment ({awaitingReplenishment.length})
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs fw-bold transition ${
              activeSubTab === 'emails' ? 'btn-success text-white shadow-sm' : 'btn-outline-secondary bg-white'
            }`}
            onClick={() => setActiveSubTab('emails')}
          >
            <i className="bi bi-envelope-check-fill me-1"></i>
            Supplier Email History ({supplierEmails.length})
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs fw-bold transition ${
              activeSubTab === 'failed_emails' ? 'btn-danger text-white shadow-sm' : 'btn-outline-secondary bg-white'
            }`}
            onClick={() => setActiveSubTab('failed_emails')}
          >
            <i className="bi bi-envelope-exclamation-fill me-1"></i>
            Failed Email Attempts ({failedEmails.length})
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs fw-bold transition ${
              activeSubTab === 'prs' ? 'btn-dark text-white shadow-sm' : 'btn-outline-secondary bg-white'
            }`}
            onClick={() => setActiveSubTab('prs')}
          >
            <i className="bi bi-file-earmark-text me-1"></i>
            Pending Purchase Requests ({pendingPRs.length})
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs fw-bold transition ${
              activeSubTab === 'replenishment' ? 'btn-info text-white shadow-sm' : 'btn-outline-secondary bg-white'
            }`}
            onClick={() => setActiveSubTab('replenishment')}
          >
            <i className="bi bi-arrow-repeat me-1"></i>
            Replenishment History ({replenishmentHistory.length})
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 text-xs fw-bold transition ${
              activeSubTab === 'audit' ? 'btn-secondary text-white shadow-sm' : 'btn-outline-secondary bg-white'
            }`}
            onClick={() => setActiveSubTab('audit')}
          >
            <i className="bi bi-journal-text me-1"></i>
            Alert Audit Trail ({alertHistory.length})
          </button>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: LOW STOCK PRODUCTS
          ===================================================================== */}
      {activeSubTab === 'low_stock' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 className="fw-bold text-slate-900 mb-0">
              Low-Stock Products (Stock &le; Reorder Point)
            </h6>
            <span className="badge bg-warning text-dark text-xs">{lowStockProducts.length} Items</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase text-[11px]">
                <tr>
                  <th className="ps-4">Product Name &amp; SKU</th>
                  <th>Current Stock</th>
                  <th>Min Level</th>
                  <th>Suggested Reorder</th>
                  <th>Assigned Supplier</th>
                  <th>Email Status</th>
                  <th>Last Notified</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4 text-muted">
                      No products are currently in low-stock condition.
                    </td>
                  </tr>
                ) : (
                  lowStockProducts.map((p) => (
                    <tr key={p.id}>
                      <td className="ps-4">
                        <div className="fw-bold text-slate-900">{p.name}</div>
                        <code className="text-[11px] text-muted">{p.sku}</code>
                      </td>
                      <td>
                        <span className="fw-bold text-warning-emphasis fs-6">{p.stock}</span> units
                      </td>
                      <td>{p.low_stock_threshold} units</td>
                      <td className="fw-bold text-primary">{p.reorder_quantity} units</td>
                      <td>
                        {p.supplier_name ? (
                          <div>
                            <span className="fw-semibold text-slate-800">{p.supplier_name}</span>
                            {p.supplier_email ? (
                              <div className="text-muted text-[10px]">{p.supplier_email}</div>
                            ) : (
                              <div className="text-danger text-[10px] fw-bold">Missing Email</div>
                            )}
                          </div>
                        ) : (
                          <span className="badge bg-danger-subtle text-danger">No Supplier</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill text-[10px] ${
                            p.notification_status === 'SENT'
                              ? 'bg-success text-white'
                              : p.notification_status === 'FAILED'
                              ? 'bg-danger text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.notification_status || 'Pending'}
                        </span>
                      </td>
                      <td className="text-muted">
                        {p.last_notification_date
                          ? new Date(p.last_notification_date).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </td>
                      <td className="text-end pe-4">
                        <Link
                          to={`/manager/inventory?product_id=${p.id}`}
                          className="btn btn-outline-secondary btn-sm rounded-pill text-[11px] px-3 py-1"
                        >
                          Inspect &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: OUT OF STOCK PRODUCTS
          ===================================================================== */}
      {activeSubTab === 'out_of_stock' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 className="fw-bold text-slate-900 mb-0">
              Out of Stock Products (Stock = 0)
            </h6>
            <span className="badge bg-danger text-white text-xs">{outOfStockProducts.length} Items</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase text-[11px]">
                <tr>
                  <th className="ps-4">Product Name &amp; SKU</th>
                  <th>Current Stock</th>
                  <th>Min Level</th>
                  <th>Reorder Batch</th>
                  <th>Supplier</th>
                  <th>Supplier Contact</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {outOfStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      No products are currently out of stock.
                    </td>
                  </tr>
                ) : (
                  outOfStockProducts.map((p) => (
                    <tr key={p.id}>
                      <td className="ps-4">
                        <div className="fw-bold text-danger">{p.name}</div>
                        <code className="text-[11px] text-muted">{p.sku}</code>
                      </td>
                      <td>
                        <span className="badge bg-danger text-white px-2.5 py-1">0 Units</span>
                      </td>
                      <td>{p.low_stock_threshold} units</td>
                      <td className="fw-bold text-primary">{p.reorder_quantity} units</td>
                      <td className="fw-semibold text-slate-800">{p.supplier_name || 'Unassigned'}</td>
                      <td className="text-muted">{p.supplier_email || 'No email registered'}</td>
                      <td className="text-end pe-4">
                        <Link
                          to={`/manager/inventory?product_id=${p.id}`}
                          className="btn btn-outline-danger btn-sm rounded-pill text-[11px] px-3 py-1 font-semibold"
                        >
                          View in Inventory
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: AWAITING REPLENISHMENT
          ===================================================================== */}
      {activeSubTab === 'awaiting' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 className="fw-bold text-slate-900 mb-0">
              Products Awaiting Replenishment (Active Purchase Orders &amp; Inquiries)
            </h6>
            <span className="badge bg-primary text-white text-xs">{awaitingReplenishment.length} Orders</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase text-[11px]">
                <tr>
                  <th className="ps-4">Requisition #</th>
                  <th>Product</th>
                  <th>Supplier</th>
                  <th>Order Quantity</th>
                  <th>Estimated Cost</th>
                  <th>Status</th>
                  <th>Requested By</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {awaitingReplenishment.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4 text-muted">
                      No purchase requests are currently pending replenishment.
                    </td>
                  </tr>
                ) : (
                  awaitingReplenishment.map((pr) => (
                    <tr key={pr.id}>
                      <td className="ps-4 fw-bold"><code>{pr.request_number}</code></td>
                      <td className="fw-semibold text-slate-800">{pr.product_name}</td>
                      <td className="text-slate-700">{pr.supplier_name || 'N/A'}</td>
                      <td className="fw-bolder text-info fs-6">{pr.quantity} units</td>
                      <td className="fw-bold text-dark">{formatETB(pr.total_estimated_cost)}</td>
                      <td>
                        <span
                          className={`badge rounded-pill text-[10px] ${
                            pr.status === 'APPROVED'
                              ? 'bg-success text-white'
                              : pr.status === 'ORDERED'
                              ? 'bg-info text-white'
                              : 'bg-warning text-dark'
                          }`}
                        >
                          {pr.status_display || pr.status}
                        </span>
                      </td>
                      <td className="text-muted">{pr.requested_by_username || 'Manager'}</td>
                      <td className="text-muted">
                        {new Date(pr.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: SUPPLIER EMAIL HISTORY
          ===================================================================== */}
      {activeSubTab === 'emails' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 className="fw-bold text-slate-900 mb-0">
              Supplier Email Transmission Ledger (Sent &amp; Failed)
            </h6>
            <span className="badge bg-success text-white text-xs">{supplierEmails.length} Logs</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase text-[11px]">
                <tr>
                  <th className="ps-4">Product</th>
                  <th>Supplier Recipient</th>
                  <th>Stock / Reorder</th>
                  <th>Trigger Mode</th>
                  <th>Status</th>
                  <th>Subject</th>
                  <th>Transmission Time</th>
                </tr>
              </thead>
              <tbody>
                {supplierEmails.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      No supplier email transmissions recorded yet.
                    </td>
                  </tr>
                ) : (
                  supplierEmails.map((log) => (
                    <tr key={log.id}>
                      <td className="ps-4 fw-bold text-slate-900">{log.product_name}</td>
                      <td>
                        <span className="fw-semibold text-slate-800">{log.supplier_name}</span>
                        <div className="text-muted text-[10px]">{log.supplier_email || 'No Email'}</div>
                      </td>
                      <td>
                        Stock: <strong>{log.current_stock}</strong> / Min: {log.min_stock_level} (Reorder: {log.reorder_quantity})
                      </td>
                      <td>
                        <span className="badge bg-slate-100 text-slate-700">
                          {log.trigger_type_display || log.trigger_type}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill text-[10px] ${
                            log.status === 'SENT' ? 'bg-success text-white' : 'bg-danger text-white'
                          }`}
                        >
                          {log.status === 'SENT' ? 'Sent' : 'Failed'}
                        </span>
                      </td>
                      <td className="text-slate-700 text-truncate" style={{ maxWidth: '240px' }} title={log.subject}>
                        {log.subject}
                      </td>
                      <td className="text-muted">
                        {new Date(log.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: FAILED SUPPLIER EMAILS
          ===================================================================== */}
      {activeSubTab === 'failed_emails' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4 border-start border-4 border-danger">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 className="fw-bold text-danger mb-0">
              <i className="bi bi-exclamation-triangle-fill me-2"></i> Failed Supplier Email Dispatches
            </h6>
            <span className="badge bg-danger text-white text-xs">{failedEmails.length} Failures</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase text-[11px]">
                <tr>
                  <th className="ps-4">Product Name</th>
                  <th>Supplier</th>
                  <th>Missing / Error Details</th>
                  <th>Stock Levels</th>
                  <th>Attempted At</th>
                  <th className="text-end pe-4">Resolution</th>
                </tr>
              </thead>
              <tbody>
                {failedEmails.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                      No failed email transmissions found. All registered suppliers have received correspondence.
                    </td>
                  </tr>
                ) : (
                  failedEmails.map((log) => (
                    <tr key={log.id}>
                      <td className="ps-4 fw-bold text-slate-900">{log.product_name}</td>
                      <td>
                        <span className="fw-semibold text-slate-800">{log.supplier_name || 'No Supplier'}</span>
                      </td>
                      <td className="text-danger font-mono text-[11px]" style={{ maxWidth: '300px' }}>
                        {log.error_message || 'Missing supplier email address in Hardware Suppliers.'}
                      </td>
                      <td>
                        Stock: {log.current_stock} &le; Min: {log.min_stock_level}
                      </td>
                      <td className="text-muted">
                        {new Date(log.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="text-end pe-4">
                        <Link
                          to="/manager/suppliers"
                          className="btn btn-outline-danger btn-sm rounded-pill text-[11px] px-3 py-1 font-semibold"
                        >
                          Update Supplier &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 6: REPLENISHMENT HISTORY
          ===================================================================== */}
      {activeSubTab === 'replenishment' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 className="fw-bold text-slate-900 mb-0">
              Warehouse Replenishment Ledger (Restock Stock Movements)
            </h6>
            <span className="badge bg-info text-white text-xs">{replenishmentHistory.length} Restocks</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase text-[11px]">
                <tr>
                  <th className="ps-4">Product Name</th>
                  <th>Quantity Added</th>
                  <th>Reference / Note</th>
                  <th>Received By</th>
                  <th>Date &amp; Time</th>
                </tr>
              </thead>
              <tbody>
                {replenishmentHistory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-muted">
                      No stock replenishment movements logged yet.
                    </td>
                  </tr>
                ) : (
                  replenishmentHistory.map((mov) => (
                    <tr key={mov.id}>
                      <td className="ps-4 fw-bold text-slate-900">{mov.product_name}</td>
                      <td>
                        <span className="badge bg-success-subtle text-success border border-success-subtle fw-bold fs-6 px-2.5 py-1">
                          +{mov.quantity} units
                        </span>
                      </td>
                      <td className="text-slate-700">{mov.reference || 'Restock'}</td>
                      <td className="text-muted">{mov.created_by_username || 'Staff'}</td>
                      <td className="text-muted">
                        {new Date(mov.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 7: ALERT AUDIT TRAIL
          ===================================================================== */}
      {activeSubTab === 'audit' && (
        <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 className="fw-bold text-slate-900 mb-0">
              Complete Stock Alert Audit Trail &amp; Event History
            </h6>
            <span className="badge bg-secondary text-white text-xs">{alertHistory.length} Events</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase text-[11px]">
                <tr>
                  <th className="ps-4">Product</th>
                  <th>Alert Event</th>
                  <th>Stock Recorded</th>
                  <th>Supplier Recipient</th>
                  <th>Email Status</th>
                  <th>Triggered By</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {alertHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      No stock alert audit records yet.
                    </td>
                  </tr>
                ) : (
                  alertHistory.map((h) => (
                    <tr key={h.id}>
                      <td className="ps-4 fw-bold text-slate-900">{h.product_name}</td>
                      <td>
                        <span
                          className={`badge rounded-pill text-[10px] ${
                            h.alert_type === 'OUT_OF_STOCK'
                              ? 'bg-danger text-white'
                              : h.alert_type === 'LOW_STOCK'
                              ? 'bg-warning text-dark'
                              : h.alert_type === 'REPLENISHED'
                              ? 'bg-info text-white'
                              : 'bg-primary text-white'
                          }`}
                        >
                          {h.alert_type_display || h.alert_type}
                        </span>
                      </td>
                      <td>
                        <strong>{h.current_stock}</strong> / Min: {h.min_stock_level}
                      </td>
                      <td className="text-slate-700">{h.supplier_name || 'N/A'}</td>
                      <td>
                        <span className="badge bg-slate-100 text-slate-700">{h.email_status || 'N/A'}</span>
                      </td>
                      <td className="text-muted">{h.triggered_by_username || 'System'}</td>
                      <td className="text-muted">
                        {new Date(h.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInventoryMonitoring;
