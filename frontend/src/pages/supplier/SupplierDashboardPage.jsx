import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';

const SupplierDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('supplier/dashboard/');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load supplier dashboard:', err);
      setError('Unable to load dashboard data. Please try again or check your network.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-teal-600" role="status" style={{ width: '3rem', height: '3rem', color: '#0d9488' }}></div>
        <p className="text-muted small mt-3">Loading supplier portal overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-0 shadow-sm rounded-4 p-4 text-center bg-white my-4">
        <i className="bi bi-exclamation-triangle-fill fs-1 text-warning mb-2"></i>
        <h5 className="fw-bold text-slate-800">Connection Error</h5>
        <p className="text-slate-500 text-sm mb-3">{error}</p>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary rounded-pill px-4"
          onClick={fetchDashboardData}
        >
          <i className="bi bi-arrow-clockwise me-1"></i> Retry
        </button>
      </div>
    );
  }

  const supplier = data?.supplier || {};
  const metrics = data?.metrics || {};
  const recentOrders = data?.recent_purchase_orders || [];
  const recentInvoices = data?.recent_invoices || [];

  const awaitingCount = (metrics.awaiting_response || 0) + (metrics.new_orders || 0);

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'AWAITING_SUPPLIER':
      case 'SENT_TO_SUPPLIER':
        return <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1"><i className="bi bi-clock-history me-1"></i>Action Needed</span>;
      case 'ACCEPTED':
        return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i className="bi bi-check-circle me-1"></i>Accepted</span>;
      case 'PARTIALLY_ACCEPTED':
        return <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1"><i className="bi bi-dash-circle me-1"></i>Partially Accepted</span>;
      case 'PREPARING_ORDER':
        return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1"><i className="bi bi-box-seam me-1"></i>Preparing</span>;
      case 'READY_FOR_DELIVERY':
        return <span className="badge bg-cyan bg-opacity-10 text-cyan-600 border border-info border-opacity-25 px-2 py-1"><i className="bi bi-truck-flatbed me-1"></i>Ready for Delivery</span>;
      case 'SHIPPED':
        return <span className="badge bg-purple bg-opacity-10 text-indigo-600 border border-indigo-200 px-2 py-1"><i className="bi bi-send-check me-1"></i>In Transit / Shipped</span>;
      case 'DELIVERED':
      case 'RECEIVED':
      case 'COMPLETED':
        return <span className="badge bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1"><i className="bi bi-check2-all me-1"></i>Delivered</span>;
      case 'REJECTED':
      case 'CANCELLED':
        return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1"><i className="bi bi-x-circle me-1"></i>Declined</span>;
      default:
        return <span className="badge bg-secondary bg-opacity-10 text-secondary px-2 py-1">{status}</span>;
    }
  };

  return (
    <div className="container-fluid px-0">
      {/* Welcome Banner */}
      <div
        className="card border-0 rounded-4 shadow-sm p-4 mb-4 text-white position-relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0b1a2d 0%, #134e4a 100%)' }}
      >
        <div className="row align-items-center position-relative z-1">
          <div className="col-12 col-md-8">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="badge bg-teal-500 bg-opacity-25 text-teal-200 border border-teal-400 border-opacity-30 text-xs px-2.5 py-1">
                Vendor Hub
              </span>
              <span className="text-white-50 text-xs">
                Account: <strong className="text-white">{user?.email}</strong>
              </span>
            </div>
            <h3 className="fw-bolder mb-1 text-white">
              Welcome back, {supplier.name || user?.first_name || 'Partner'}!
            </h3>
            <p className="text-white-50 small mb-0" style={{ maxWidth: '640px' }}>
              Review new purchase orders from EthioTech Market, report product availability, confirm delivery schedules, and manage your billing invoices seamlessly.
            </p>
          </div>
          <div className="col-12 col-md-4 text-md-end mt-3 mt-md-0">
            <Link
              to="/supplier/purchase-orders"
              className="btn btn-light rounded-pill px-4 text-xs fw-bold shadow-sm"
              style={{ color: '#0f766e' }}
            >
              <i className="bi bi-clipboard-data me-1.5"></i>
              Manage Orders
            </Link>
          </div>
        </div>
      </div>

      {/* Action Needed Alert if any */}
      {awaitingCount > 0 && (
        <div className="alert alert-warning border-0 rounded-4 shadow-sm d-flex align-items-center justify-content-between p-3 mb-4 bg-amber-50 border-start border-4 border-warning">
          <div className="d-flex align-items-center gap-3">
            <i className="bi bi-bell-fill fs-3 text-warning"></i>
            <div>
              <h6 className="fw-bold text-slate-900 mb-0">
                You have {awaitingCount} Purchase {awaitingCount === 1 ? 'Order' : 'Orders'} awaiting response!
              </h6>
              <p className="text-slate-600 text-xs mb-0">
                Please review requested quantities, delivery timelines, and confirm acceptance or suggest adjustments.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-warning btn-sm rounded-pill px-3 text-xs fw-bold text-slate-900"
            onClick={() => navigate('/supplier/purchase-orders?filter=AWAITING')}
          >
            Review Orders <i className="bi bi-arrow-right ms-1"></i>
          </button>
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="row g-3 mb-4">
        {/* Total Purchase Orders */}
        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Orders</span>
              <div className="rounded-3 p-2 bg-slate-100 text-slate-700">
                <i className="bi bi-file-earmark-text fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-bolder text-slate-900 mb-1">
              {metrics.total_purchase_orders || 0}
            </div>
            <div className="text-[11px] text-slate-500">
              Across all contract lifecycles
            </div>
          </div>
        </div>

        {/* Action Needed / Awaiting */}
        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-amber-500">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Awaiting Response</span>
              <div className="rounded-3 p-2 bg-amber-100 text-amber-700">
                <i className="bi bi-hourglass-split fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-bolder text-amber-600 mb-1">
              {awaitingCount}
            </div>
            <div className="text-[11px] text-slate-500">
              Pending your acceptance or note
            </div>
          </div>
        </div>

        {/* In Progress / Active Fulfillment */}
        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-cyan-500">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-xs font-semibold text-cyan-700 uppercase tracking-wider">In Fulfillment</span>
              <div className="rounded-3 p-2 bg-cyan-50 text-cyan-700">
                <i className="bi bi-truck fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-bolder text-cyan-700 mb-1">
              {(metrics.preparing_orders || 0) + (metrics.shipped_orders || 0)}
            </div>
            <div className="text-[11px] text-slate-500">
              {metrics.shipped_orders || 0} in transit, {metrics.preparing_orders || 0} preparing
            </div>
          </div>
        </div>

        {/* Delivered / Completed */}
        <div className="col-6 col-lg-3">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-top border-3 border-emerald-500">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Delivered</span>
              <div className="rounded-3 p-2 bg-emerald-50 text-emerald-700">
                <i className="bi bi-check2-circle fs-5"></i>
              </div>
            </div>
            <div className="fs-3 fw-bolder text-emerald-600 mb-1">
              {(metrics.delivered_orders || 0) + (metrics.received_orders || 0)}
            </div>
            <div className="text-[11px] text-slate-500">
              Delivered to warehouse dock
            </div>
          </div>
        </div>
      </div>

      {/* Financial Health Summary Banner */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-4 border-end-md border-slate-200">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-3 p-2.5 bg-indigo-50 text-indigo-600">
                <i className="bi bi-receipt fs-4"></i>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase fw-semibold">Total Invoiced</span>
                <div className="fs-5 fw-bold text-slate-900">
                  {formatETB(metrics.total_invoiced_amount || 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4 border-end-md border-slate-200">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-3 p-2.5 bg-emerald-50 text-emerald-600">
                <i className="bi bi-wallet2 fs-4"></i>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase fw-semibold">Total Paid</span>
                <div className="fs-5 fw-bold text-emerald-600">
                  {formatETB(metrics.total_paid_amount || 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-3 p-2.5 bg-amber-50 text-amber-600">
                <i className="bi bi-clock-history fs-4"></i>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase fw-semibold">Outstanding Balance</span>
                <div className="fs-5 fw-bold text-amber-700">
                  {formatETB(metrics.outstanding_balance || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders & Invoices Tables */}
      <div className="row g-4">
        {/* Recent Purchase Orders */}
        <div className="col-12 col-xl-7">
          <div className="card ethio-card border-0 shadow-sm rounded-4 bg-white overflow-hidden h-100">
            <div className="card-header bg-white border-bottom border-slate-100 py-3 px-4 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-clipboard2-check text-teal-600 fs-5"></i>
                <h6 className="fw-bold text-slate-900 mb-0">Recent Purchase Orders</h6>
              </div>
              <Link to="/supplier/purchase-orders" className="text-teal-600 text-xs fw-semibold text-decoration-none">
                View All <i className="bi bi-arrow-right"></i>
              </Link>
            </div>
            <div className="card-body p-0">
              {recentOrders.length === 0 ? (
                <div className="text-center py-5 text-muted text-xs">
                  <i className="bi bi-inbox fs-2 text-slate-300 d-block mb-1"></i>
                  No purchase orders found yet.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 text-xs">
                    <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="ps-4">PO Ref</th>
                        <th>Date</th>
                        <th>Total Cost</th>
                        <th>Status</th>
                        <th className="text-end pe-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((po) => (
                        <tr key={po.id}>
                          <td className="ps-4 font-monospace fw-bold text-slate-900">
                            {po.request_number || `PO-${po.id}`}
                          </td>
                          <td className="text-slate-600">
                            {po.created_at ? new Date(po.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="fw-semibold text-slate-900">
                            {formatETB(po.total_cost || 0)}
                          </td>
                          <td>
                            {getStatusBadge(po.status)}
                          </td>
                          <td className="text-end pe-4">
                            <Link
                              to={`/supplier/purchase-orders?select=${po.id}`}
                              className="btn btn-sm btn-outline-teal rounded-pill px-2.5 py-1 text-xs"
                              style={{ borderColor: '#0d9488', color: '#0d9488' }}
                            >
                              Details
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="col-12 col-xl-5">
          <div className="card ethio-card border-0 shadow-sm rounded-4 bg-white overflow-hidden h-100">
            <div className="card-header bg-white border-bottom border-slate-100 py-3 px-4 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-receipt-cutoff text-teal-600 fs-5"></i>
                <h6 className="fw-bold text-slate-900 mb-0">Recent Invoices</h6>
              </div>
              <Link to="/supplier/invoices" className="text-teal-600 text-xs fw-semibold text-decoration-none">
                View Invoices <i className="bi bi-arrow-right"></i>
              </Link>
            </div>
            <div className="card-body p-0">
              {recentInvoices.length === 0 ? (
                <div className="text-center py-5 text-muted text-xs">
                  <i className="bi bi-journal-x fs-2 text-slate-300 d-block mb-1"></i>
                  No invoices submitted yet.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 text-xs">
                    <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="ps-4">Invoice #</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="ps-4 font-monospace fw-bold text-slate-900">
                            {inv.invoice_number}
                          </td>
                          <td className="fw-semibold text-slate-900">
                            {formatETB(inv.total_amount || 0)}
                          </td>
                          <td>
                            <span className={`badge rounded-pill ${
                              inv.status === 'PAID'
                                ? 'bg-success bg-opacity-10 text-success'
                                : inv.status === 'APPROVED'
                                ? 'bg-info bg-opacity-10 text-info'
                                : inv.status === 'REJECTED'
                                ? 'bg-danger bg-opacity-10 text-danger'
                                : 'bg-warning bg-opacity-10 text-warning'
                            }`}>
                              {inv.status || 'SUBMITTED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierDashboardPage;

