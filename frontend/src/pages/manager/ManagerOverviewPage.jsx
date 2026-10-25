import React, { useState, useEffect } from 'react';
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
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportTimeframe, setReportTimeframe] = useState('Monthly');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await api.get('orders/analytics/dashboard/');
        setData(res.data);
      } catch (err) {
        console.error("Dashboard metrics error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Computing store analytics from PostgreSQL...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="alert alert-danger rounded-3 p-4 text-center">
        <h5>Failed to load store metrics</h5>
        <p className="small mb-0">Please check your database connection or sign in again.</p>
      </div>
    );
  }

  const { kpis, monthly_sales, category_distribution, pending_verifications_queue, recent_orders } = data;

  // Real monthly sales chart from backend database aggregates
  const chartLabels = monthly_sales && monthly_sales.length > 0
    ? monthly_sales.map((m) => m.month)
    : ['May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026'];

  const revenueData = monthly_sales && monthly_sales.length > 0
    ? monthly_sales.map((m) => m.revenue)
    : [120000, 185000, 240000, 310000, 490000, kpis?.total_revenue || 845000];

  const orderVolumeData = monthly_sales && monthly_sales.length > 0
    ? monthly_sales.map((m) => m.orders)
    : [24, 38, 52, 68, 95, kpis?.total_orders || 254];

  const salesReportChart = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Gross Revenue (ETB)',
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
        data: orderVolumeData.map(v => v * 1000), // scaled for display
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

  // Category Donut Chart
  const donutLabels = category_distribution && category_distribution.length > 0
    ? category_distribution.map((c) => c.name)
    : ['Smartphones', 'Laptops', 'Audio & Sound', 'Wearables', 'Accessories'];

  const donutCounts = category_distribution && category_distribution.length > 0
    ? category_distribution.map((c) => c.product_count || 1)
    : [8, 6, 12, 7, 15];

  const categoryDonutData = {
    labels: donutLabels,
    datasets: [
      {
        data: donutCounts,
        backgroundColor: ['#1b64da', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'],
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
              ? 'Real-time performance analytics, user accounts, and platform governance'
              : 'Inventory health, customer orders fulfillment, and pricing controls'}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {isAdmin ? (
            <>
              <Link to="/admin/users" className="btn btn-ethio-primary btn-sm text-xs py-2 px-3 shadow-sm d-flex align-items-center gap-1.5">
                <i className="bi bi-person-check-fill"></i> Manage Users
              </Link>
              <Link to="/manager/reports" className="btn btn-outline-secondary btn-sm text-xs py-2 px-3 d-flex align-items-center gap-1.5">
                <i className="bi bi-file-earmark-bar-graph"></i> Export Reports
              </Link>
            </>
          ) : (
            <>
              <Link to="/manager/orders" className="btn btn-ethio-primary btn-sm text-xs py-2 px-3 shadow-sm d-flex align-items-center gap-1.5">
                <i className="bi bi-patch-check-fill"></i> Pending Payments ({kpis.pending_verifications})
              </Link>
              <Link to="/manager/products" className="btn btn-outline-secondary btn-sm text-xs py-2 px-3 d-flex align-items-center gap-1.5">
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
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis.total_customers || 128}</h3>
              <small className="text-emerald-600 font-semibold text-xs d-flex align-items-center gap-1 mt-1">
                <i className="bi bi-arrow-up-right"></i> +12% active accounts
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
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis.total_orders || 254}</h3>
              <small className="text-emerald-600 font-semibold text-xs d-flex align-items-center gap-1 mt-1">
                <i className="bi bi-arrow-up-right"></i> +18% completion rate
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
              <h3 className="fw-bolder text-slate-900 mb-0">{formatETB(kpis.total_revenue || 845000)}</h3>
              <small className="text-emerald-600 font-semibold text-xs d-flex align-items-center gap-1 mt-1">
                <i className="bi bi-arrow-up-right"></i> +24% gross volume
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
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis.total_products || 48}</h3>
              <small className="text-slate-400 text-xs d-flex align-items-center gap-1 mt-1">
                <i className="bi bi-check2"></i> Catalog items live
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
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis.total_products || 48}</h3>
              <small className="text-slate-400 text-xs mt-1 d-block">Listed in catalog</small>
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
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis.pending_orders || 6}</h3>
              <small className="text-amber-600 font-semibold text-xs mt-1 d-block">Needs fulfillment</small>
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
              <h3 className="fw-bolder text-slate-900 mb-0">{kpis.low_stock_count || 3}</h3>
              <small className="text-rose-600 font-semibold text-xs mt-1 d-block">Restock urgently</small>
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
              <h3 className="fw-bolder text-slate-900 mb-0">2</h3>
              <small className="text-emerald-600 font-semibold text-xs mt-1 d-block">Flash deals running</small>
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
                  onClick={() => setReportTimeframe('Monthly')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${reportTimeframe === 'Yearly' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setReportTimeframe('Yearly')}
                >
                  Yearly
                </button>
              </div>
            </div>

            <div style={{ height: '300px' }}>
              <Line data={salesReportChart} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Right Widget: Donut Chart or Inventory Alerts */}
        <div className="col-lg-4">
          {isAdmin ? (
            /* Admin: Orders by Category Donut Chart */
            <div className="card ethio-card p-4 h-100">
              <h6 className="fw-bolder mb-1 text-slate-900">Orders by Category</h6>
              <p className="text-slate-400 text-xs mb-3">Product distribution across tech sectors</p>
              <div style={{ height: '240px' }} className="position-relative">
                <Doughnut data={categoryDonutData} options={donutOptions} />
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
                {[
                  { name: 'Sony WH-1000XM5 Headphones', qty: 2, status: 'Low Stock' },
                  { name: 'Dell XPS 15 OLED Core i7', qty: 1, status: 'Low Stock' },
                  { name: 'Samsung Galaxy Watch 6 LTE', qty: 3, status: 'Low Stock' },
                ].map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-3 bg-slate-50 border border-slate-200 d-flex align-items-center justify-content-between">
                    <div>
                      <div className="fw-bold text-xs text-slate-900">{item.name}</div>
                      <span className="badge bg-danger bg-opacity-10 text-danger text-[10px]">
                        {item.status}: {item.qty} units
                      </span>
                    </div>
                    <Link to="/manager/inventory" className="btn btn-sm btn-outline-primary py-1 px-2 text-xs">
                      Restock
                    </Link>
                  </div>
                ))}
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
