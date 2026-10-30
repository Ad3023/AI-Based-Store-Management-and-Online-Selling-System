import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { formatETB } from '../../utils/currency';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import OrderManagerDashboardPage from './OrderManagerDashboardPage';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ManagerOverviewPage = () => {
  const { user, isAdmin, isSuperAdmin, hasPermission, hasAnyPermission } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);
  const [reportTimeframe, setReportTimeframe] = useState('Monthly');

  const canViewReports = isSuperAdmin || isAdmin || hasPermission('reports.view');
  const isOrderManagerRole = user?.role === 'order_manager';

  const fetchDashboard = useCallback(async (tf = reportTimeframe) => {
    if (!canViewReports || isOrderManagerRole) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorState(null);
      const res = await api.get(`orders/analytics/dashboard/?timeframe=${tf.toLowerCase()}`);
      setData(res.data);
    } catch (err) {
      console.error("Dashboard metrics error", err);
      setErrorState("Failed to retrieve store analytics from PostgreSQL. Please check your network connection or sign in again.");
    } finally {
      setLoading(false);
    }
  }, [canViewReports, isOrderManagerRole, reportTimeframe]);

  useEffect(() => {
    if (!isOrderManagerRole && canViewReports) {
      fetchDashboard(reportTimeframe);
    } else {
      setLoading(false);
    }
  }, [canViewReports, isOrderManagerRole, reportTimeframe, fetchDashboard]);

  const handleTimeframeChange = (tf) => {
    setReportTimeframe(tf);
    fetchDashboard(tf);
  };

  if (isOrderManagerRole) {
    return <OrderManagerDashboardPage />;
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Computing verified store analytics from PostgreSQL...</p>
      </div>
    );
  }

  if (errorState || !data) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 p-md-5 text-center mx-auto my-4" style={{ maxWidth: '560px' }}>
        <i className="bi bi-exclamation-octagon text-danger fs-1 mb-2"></i>
        <h5 className="fw-bold text-slate-900 mb-1">Failed to load store metrics</h5>
        <p className="text-muted small mb-4">{errorState || "Please check your database connection or authentication session."}</p>
        <button
          type="button"
          className="btn btn-ethio-primary rounded-pill px-4 mx-auto text-xs font-semibold d-inline-flex align-items-center gap-2"
          onClick={() => fetchDashboard(reportTimeframe)}
        >
          <i className="bi bi-arrow-repeat"></i> Retry Loading Analytics
        </button>
      </div>
    );
  }

  if (!canViewReports) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white mb-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <div className="rounded-circle p-3 bg-primary bg-opacity-10 text-primary">
              <i className="bi bi-person-badge fs-2"></i>
            </div>
            <div>
              <h4 className="fw-bolder mb-1 text-slate-900">Welcome, {user?.first_name || user?.username}</h4>
              <p className="text-muted small mb-0">
                Staff Profile: <span className="badge bg-primary text-uppercase">{user?.custom_role_name || user?.role}</span>
              </p>
            </div>
          </div>
          <p className="text-slate-600 mb-4">
            You are signed into EthioTech Market's management console under a specialized least-privilege role. Revenue and financial reports are restricted. Select one of your assigned operational modules below:
          </p>
          <div className="row g-3">
            {hasAnyPermission(['products.view', 'products.create']) && (
              <div className="col-md-4">
                <div className="card h-100 border p-3 rounded-3 shadow-none">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="bi bi-laptop text-primary fs-4"></i>
                    <h6 className="fw-bold mb-0">Products & Catalog</h6>
                  </div>
                  <p className="text-muted small">Manage tech hardware items, specifications, pricing, and stock status.</p>
                  <Link to="/manager/products" className="btn btn-sm btn-outline-primary mt-auto">Open Products</Link>
                </div>
              </div>
            )}
            {hasAnyPermission(['orders.view', 'orders.update']) && (
              <div className="col-md-4">
                <div className="card h-100 border p-3 rounded-3 shadow-none">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="bi bi-receipt text-info fs-4"></i>
                    <h6 className="fw-bold mb-0">Customer Orders</h6>
                  </div>
                  <p className="text-muted small">Review customer orders, dispatch packages, and update fulfillment milestones.</p>
                  <Link to="/manager/orders" className="btn btn-sm btn-outline-info mt-auto">Open Orders</Link>
                </div>
              </div>
            )}
            {hasAnyPermission(['payments.view', 'payments.verify']) && (
              <div className="col-md-4">
                <div className="card h-100 border p-3 rounded-3 shadow-none">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="bi bi-credit-card-2-front text-success fs-4"></i>
                    <h6 className="fw-bold mb-0">Payment Verification</h6>
                  </div>
                  <p className="text-muted small">Audit and verify Chapa payment transactions and bank transfer receipts.</p>
                  <Link to="/manager/payments" className="btn btn-sm btn-outline-success mt-auto">Verify Payments</Link>
                </div>
              </div>
            )}
            {hasPermission('inventory.manage') && (
              <div className="col-md-4">
                <div className="card h-100 border p-3 rounded-3 shadow-none">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="bi bi-box-seam text-warning fs-4"></i>
                    <h6 className="fw-bold mb-0">Inventory & Stock</h6>
                  </div>
                  <p className="text-muted small">Record stock movements, restocks, warehouse adjustments, and threshold alerts.</p>
                  <Link to="/manager/inventory" className="btn btn-sm btn-outline-warning mt-auto">Manage Inventory</Link>
                </div>
              </div>
            )}
            {hasPermission('refunds.manage') && (
              <div className="col-md-4">
                <div className="card h-100 border p-3 rounded-3 shadow-none">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="bi bi-shield-check text-success fs-4"></i>
                    <h6 className="fw-bold mb-0">Warranty Claims</h6>
                  </div>
                  <p className="text-muted small">Evaluate customer warranty claims, approve replacements, and inspect claims.</p>
                  <Link to="/manager/warranty" className="btn btn-sm btn-outline-dark mt-auto">Review Claims</Link>
                </div>
              </div>
            )}
            {hasPermission('promotions.manage') && (
              <div className="col-md-4">
                <div className="card h-100 border p-3 rounded-3 shadow-none">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="bi bi-tag-fill text-danger fs-4"></i>
                    <h6 className="fw-bold mb-0">Promotions & Discounts</h6>
                  </div>
                  <p className="text-muted small">Create and activate coupon codes, discount rates, and marketing banners.</p>
                  <Link to="/manager/promotions" className="btn btn-sm btn-outline-danger mt-auto">Manage Promotions</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { kpis, monthly_sales, yearly_sales, sales_chart, category_distribution, pending_verifications_queue, recent_orders, low_stock_items } = data;

  // Active sales chart data driven by timeframe filter
  const activeSeries = reportTimeframe === 'Yearly'
    ? (yearly_sales && yearly_sales.length > 0 ? yearly_sales : sales_chart || [])
    : (monthly_sales && monthly_sales.length > 0 ? monthly_sales : sales_chart || []);

  const hasSalesData = Array.isArray(activeSeries) && activeSeries.length > 0 && activeSeries.some(s => s.revenue > 0 || s.orders > 0);

  const chartLabels = hasSalesData
    ? activeSeries.map((m) => m.period || m.month)
    : [];

  const revenueData = hasSalesData
    ? activeSeries.map((m) => m.revenue)
    : [];

  const orderVolumeData = hasSalesData
    ? activeSeries.map((m) => m.orders)
    : [];

  const salesReportChart = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Gross Verified Revenue (ETB)',
        data: revenueData,
        borderColor: '#1b64da',
        backgroundColor: 'rgba(27, 100, 218, 0.08)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#1b64da',
        pointBorderColor: '#ffffff',
        pointRadius: 4,
      },
      {
        label: 'Orders Volume',
        data: orderVolumeData.map(v => v * 1000), // scaled for dual axis visualization
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.04)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#06b6d4',
        pointBorderColor: '#ffffff',
        pointRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { size: 11, weight: 'bold' },
          usePointStyle: true,
          boxWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: '#0b1a2d',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 11 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: function(context) {
            if (context.datasetIndex === 1) {
              const actualOrders = context.raw / 1000;
              return `Orders Volume: ${actualOrders} order${actualOrders === 1 ? '' : 's'}`;
            }
            return `Verified Revenue: ETB ${Number(context.raw || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
        }
      },
    },
    scales: {
      y: {
        grid: { color: 'rgba(226, 232, 240, 0.6)' },
        ticks: { font: { size: 10 }, color: '#64748b' },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, color: '#64748b' },
      },
    },
  };

  // Real Category Donut Chart
  const filteredCategories = Array.isArray(category_distribution)
    ? category_distribution.filter((c) => (c.product_count || 0) > 0)
    : [];
  const hasCategoryData = filteredCategories.length > 0;

  const donutLabels = hasCategoryData
    ? filteredCategories.map((c) => c.name)
    : [];

  const donutCounts = hasCategoryData
    ? filteredCategories.map((c) => c.product_count)
    : [];

  const categoryDonutData = {
    labels: donutLabels,
    datasets: [
      {
        data: donutCounts,
        backgroundColor: ['#1b64da', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6'],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { size: 10 },
          boxWidth: 8,
          usePointStyle: true,
        },
      },
    },
    cutout: '68%',
  };

  return (
    <div>
      {/* =========================================================================
          TOP HEADER
          ========================================================================= */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="text-slate-400 text-xs text-uppercase font-semibold tracking-wider mb-1">
            EthioTech Market &bull; {isAdmin ? 'System Administration' : 'Store Management'}
          </div>
          <h3 className="fw-bolder mb-0 text-slate-900 tracking-tight">
            {isAdmin ? 'System Overview & Analytics' : 'Store Manager Dashboard'}
          </h3>
          <p className="text-slate-500 text-xs mb-0 mt-0.5">
            {isAdmin
              ? 'Real-time performance analytics, verified transactions, and platform governance'
              : 'Inventory health, customer orders fulfillment, and catalog status'}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {isAdmin ? (
            <>
              <Link to="/admin/users" className="btn btn-ethio-primary btn-sm text-xs py-2 px-3 shadow-sm d-flex align-items-center gap-1.5">
                <i className="bi bi-people-fill"></i> Manage Users
              </Link>
              <Link to="/manager/reports" className="btn btn-outline-secondary btn-sm text-xs py-2 px-3 d-flex align-items-center gap-1.5">
                <i className="bi bi-file-earmark-bar-graph"></i> Export Reports
              </Link>
            </>
          ) : (
            <>
              <Link to="/manager/orders" className="btn btn-ethio-primary btn-sm text-xs py-2 px-3 shadow-sm d-flex align-items-center gap-1.5">
                <i className="bi bi-patch-check-fill"></i> Pending Payments ({kpis?.pending_verifications ?? 0})
              </Link>
              <Link to="/manager/products?action=add" className="btn btn-outline-secondary btn-sm text-xs py-2 px-3 d-flex align-items-center gap-1.5">
                <i className="bi bi-plus-circle"></i> Add Product
              </Link>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          4 KEY KPI METRICS (Screen 7 for Admin, Screen 6 for Manager)
          ========================================================================= */}
      {isAdmin ? (
        /* SCREEN 7: ADMIN METRICS */
        <div className="row g-3 mb-4">
          {/* 1. Total Users */}
          <div className="col-6 col-lg-3">
            <div className="card ethio-card p-3 p-md-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Users</span>
                <div className="w-8 h-8 rounded-3 bg-blue-50 text-blue-600 d-flex align-items-center justify-content-center">
                  <i className="bi bi-people-fill fs-6"></i>
                </div>
              </div>
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis?.total_users ?? kpis?.total_customers ?? 0}</h3>
              <small className="text-slate-500 font-medium text-xs d-flex align-items-center gap-1 mt-1">
                <i className="bi bi-person-check text-primary"></i> {kpis?.total_customers ?? 0} registered customers
              </small>
            </div>
          </div>

          {/* 2. Total Orders */}
          <div className="col-6 col-lg-3">
            <div className="card ethio-card p-3 p-md-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Orders</span>
                <div className="w-8 h-8 rounded-3 bg-emerald-50 text-emerald-600 d-flex align-items-center justify-content-center">
                  <i className="bi bi-bag-check-fill fs-6"></i>
                </div>
              </div>
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis?.total_orders ?? 0}</h3>
              <small className="text-emerald-600 font-semibold text-xs d-flex align-items-center gap-1 mt-1">
                <i className="bi bi-check-circle-fill"></i> {kpis?.paid_orders_count ?? 0} verified settlements
              </small>
            </div>
          </div>

          {/* 3. Total Revenue */}
          <div className="col-6 col-lg-3">
            <div className="card ethio-card p-3 p-md-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Revenue</span>
                <div className="w-8 h-8 rounded-3 bg-purple-50 text-purple-600 d-flex align-items-center justify-content-center">
                  <i className="bi bi-cash-stack fs-6"></i>
                </div>
              </div>
              <h3 className="fw-bolder text-slate-900 mb-0">{formatETB(kpis?.total_revenue ?? 0)}</h3>
              <small className="text-purple-600 font-medium text-xs d-flex align-items-center gap-1 mt-1">
                <i className="bi bi-shield-check"></i> Verified settlements only
              </small>
            </div>
          </div>

          {/* 4. Active Products */}
          <div className="col-6 col-lg-3">
            <div className="card ethio-card p-3 p-md-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Products</span>
                <div className="w-8 h-8 rounded-3 bg-amber-50 text-amber-600 d-flex align-items-center justify-content-center">
                  <i className="bi bi-box-seam-fill fs-6"></i>
                </div>
              </div>
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis?.active_products ?? kpis?.total_products ?? 0}</h3>
              <small className="text-slate-500 text-xs d-flex align-items-center gap-1 mt-1">
                <i className="bi bi-check2 text-success"></i> {kpis?.total_products ?? 0} total catalog items
              </small>
            </div>
          </div>
        </div>
      ) : (
        /* SCREEN 6: STORE MANAGER METRICS */
        <div className="row g-3 mb-4">
          {/* 1. Total Products */}
          <div className="col-6 col-lg-3">
            <div className="card ethio-card p-3 p-md-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Products</span>
                <div className="w-8 h-8 rounded-3 bg-blue-50 text-blue-600 d-flex align-items-center justify-content-center">
                  <i className="bi bi-laptop fs-6"></i>
                </div>
              </div>
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis?.total_products ?? 0}</h3>
              <small className="text-slate-400 text-xs mt-1 d-block">Listed in store catalog</small>
            </div>
          </div>

          {/* 2. Pending Orders */}
          <div className="col-6 col-lg-3">
            <div className="card ethio-card p-3 p-md-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Pending Orders</span>
                <div className="w-8 h-8 rounded-3 bg-amber-50 text-amber-600 d-flex align-items-center justify-content-center">
                  <i className="bi bi-hourglass-split fs-6"></i>
                </div>
              </div>
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis?.pending_orders ?? 0}</h3>
              <small className="text-amber-600 font-semibold text-xs mt-1 d-block">Awaiting fulfillment</small>
            </div>
          </div>

          {/* 3. Low Stock Alert */}
          <div className="col-6 col-lg-3">
            <div className="card ethio-card p-3 p-md-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Low Stock</span>
                <div className="w-8 h-8 rounded-3 bg-rose-50 text-rose-600 d-flex align-items-center justify-content-center">
                  <i className="bi bi-exclamation-triangle-fill fs-6"></i>
                </div>
              </div>
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis?.low_stock_count ?? 0}</h3>
              <small className="text-rose-600 font-semibold text-xs mt-1 d-block">Items below threshold</small>
            </div>
          </div>

          {/* 4. Active Promotions */}
          <div className="col-6 col-lg-3">
            <div className="card ethio-card p-3 p-md-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Promotions</span>
                <div className="w-8 h-8 rounded-3 bg-emerald-50 text-emerald-600 d-flex align-items-center justify-content-center">
                  <i className="bi bi-tag-fill fs-6"></i>
                </div>
              </div>
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis?.active_promotions ?? 0}</h3>
              <small className="text-emerald-600 font-semibold text-xs mt-1 d-block">Active discount campaigns</small>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ANALYTICS GRIDS
          ========================================================================= */}
      <div className="row g-4 mb-4">
        {/* Sales Overview Chart (Left) */}
        <div className="col-lg-8">
          <div className="card ethio-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 className="fw-bolder mb-1 text-slate-900">
                  {isAdmin ? 'Sales Overview & Inflow' : 'Purchase & Sales Report'}
                </h6>
                <p className="text-slate-400 text-xs mb-0">Verified order settlements across timeframes</p>
              </div>

              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className={`btn btn-xs ${reportTimeframe === 'Monthly' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => handleTimeframeChange('Monthly')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${reportTimeframe === 'Yearly' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => handleTimeframeChange('Yearly')}
                >
                  Yearly
                </button>
              </div>
            </div>

            <div style={{ height: '300px' }}>
              {hasSalesData ? (
                <Line data={salesReportChart} options={chartOptions} />
              ) : (
                <div className="d-flex flex-column align-items-center justify-content-center h-100 py-5 text-slate-400 text-xs">
                  <i className="bi bi-bar-chart-line fs-2 text-slate-300 mb-2"></i>
                  <span className="fw-semibold">No verified sales settled yet for the {reportTimeframe.toLowerCase()} timeframe.</span>
                  <span className="text-slate-400 mt-0.5">As customer payments are verified through Chapa, revenue will automatically populate here.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Widget: Donut Chart or Inventory Alerts */}
        <div className="col-lg-4">
          {isAdmin ? (
            /* Admin: Orders by Category Donut Chart */
            <div className="card ethio-card p-4 h-100">
              <h6 className="fw-bolder mb-1 text-slate-900">Products by Category</h6>
              <p className="text-slate-400 text-xs mb-3">Active catalog distribution across tech sectors</p>
              <div style={{ height: '240px' }} className="position-relative">
                {hasCategoryData ? (
                  <Doughnut data={categoryDonutData} options={donutOptions} />
                ) : (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 py-4 text-slate-400 text-xs">
                    <i className="bi bi-pie-chart fs-2 text-slate-300 mb-2"></i>
                    <span>No active categorized products found.</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Manager: Inventory Alerts */
            <div className="card ethio-card p-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bolder mb-0 text-slate-900">Inventory Alerts</h6>
                <Link to="/manager/inventory" className="text-xs text-primary text-decoration-none fw-bold">
                  View All &rarr;
                </Link>
              </div>
              <div className="d-flex flex-column gap-2.5">
                {(!low_stock_items || low_stock_items.length === 0) ? (
                  <div className="text-center py-4 text-slate-400 text-xs">
                    <i className="bi bi-check-circle-fill text-success fs-3 d-block mb-1.5"></i>
                    All active catalog products are currently adequately stocked.
                  </div>
                ) : (
                  low_stock_items.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-3 bg-slate-50 border border-slate-200 d-flex align-items-center justify-content-between">
                      <div>
                        <div className="fw-bold text-xs text-slate-900">{item.name}</div>
                        <span className="badge bg-danger bg-opacity-10 text-danger text-[10px]">
                          Low Stock: {item.stock} unit{item.stock === 1 ? '' : 's'} remaining
                        </span>
                      </div>
                      <Link to="/manager/inventory" className="btn btn-sm btn-outline-primary py-1 px-2 text-xs">
                        Restock
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          RECENT ACTIVITY & VERIFICATION QUEUE
          ========================================================================= */}
      <div className="row g-4">
        {/* Recent Orders Table */}
        <div className="col-lg-8">
          <div className="card ethio-card p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bolder mb-0 text-slate-900">Recent Orders</h6>
              <Link to="/manager/orders" className="text-xs text-primary text-decoration-none fw-bold">
                See All Orders &rarr;
              </Link>
            </div>

            {(!recent_orders || recent_orders.length === 0) ? (
              <div className="text-center py-4 text-slate-400 text-xs">
                <i className="bi bi-inbox fs-3 d-block mb-1"></i>
                No recent orders placed yet.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle text-xs mb-0">
                  <thead className="table-light text-slate-500 uppercase">
                    <tr>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent_orders.map((ord) => (
                      <tr key={ord.id}>
                        <td className="fw-bold">{ord.order_number}</td>
                        <td>{ord.customer_name || 'Customer'}</td>
                        <td className="fw-bold text-primary">{formatETB(ord.total_amount)}</td>
                        <td>
                          <span className="badge bg-primary bg-opacity-10 text-primary">
                            {ord.status}
                          </span>
                        </td>
                        <td className="text-end">
                          <Link to="/manager/orders" className="btn btn-xs btn-outline-secondary">
                            View
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

        {/* Right Widget: Quick Admin Shortcuts or Payment Queue */}
        <div className="col-lg-4">
          {isAdmin ? (
            <div className="card ethio-card p-4">
              <h6 className="fw-bolder mb-3 text-slate-900">Quick Admin Actions</h6>
              <div className="d-flex flex-column gap-2">
                <Link to="/admin/users" className="btn btn-outline-secondary text-start text-xs py-2 px-3 d-flex align-items-center justify-content-between">
                  <span><i className="bi bi-people me-2 text-primary"></i> Review User Roles</span>
                  <i className="bi bi-chevron-right text-slate-400"></i>
                </Link>
                <Link to="/manager/products" className="btn btn-outline-secondary text-start text-xs py-2 px-3 d-flex align-items-center justify-content-between">
                  <span><i className="bi bi-box-seam me-2 text-info"></i> Manage Product Catalog</span>
                  <i className="bi bi-chevron-right text-slate-400"></i>
                </Link>
                <Link to="/manager/orders" className="btn btn-outline-secondary text-start text-xs py-2 px-3 d-flex align-items-center justify-content-between">
                  <span><i className="bi bi-receipt me-2 text-success"></i> Customer Transactions</span>
                  <i className="bi bi-chevron-right text-slate-400"></i>
                </Link>
                <Link to="/manager/reports" className="btn btn-outline-secondary text-start text-xs py-2 px-3 d-flex align-items-center justify-content-between">
                  <span><i className="bi bi-file-earmark-spreadsheet me-2 text-warning"></i> Export Financial CSV</span>
                  <i className="bi bi-chevron-right text-slate-400"></i>
                </Link>
              </div>
            </div>
          ) : (
            <div className="card ethio-card p-4">
              <h6 className="fw-bolder mb-3 text-slate-900">Payment Evidence Queue</h6>
              {pending_verifications_queue.length === 0 ? (
                <div className="text-center py-3 text-slate-400 text-xs">
                  <i className="bi bi-check-circle text-success fs-4 d-block mb-1"></i>
                  All payment slips verified.
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {pending_verifications_queue.slice(0, 3).map((item) => (
                    <div key={item.id} className="p-2.5 rounded-3 bg-slate-50 border border-slate-200 text-xs">
                      <div className="d-flex justify-content-between">
                        <strong>{item.order_number}</strong>
                        <span className="text-primary fw-bold">{formatETB(item.total_amount)}</span>
                      </div>
                      <div className="text-slate-500 mt-1">{item.customer_name}</div>
                      <Link to="/manager/orders" className="btn btn-xs btn-ethio-primary w-100 mt-2">
                        Verify Transfer
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerOverviewPage;
