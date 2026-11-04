import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { formatETB } from '../../utils/currency';
import AdminInventoryMonitoring from '../../components/AdminInventoryMonitoring';
import NotificationDashboard from '../../components/NotificationDashboard';
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
  Filler,
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

const AdminDashboardPage = () => {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Tab State
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam && ['overview', 'monitoring', 'notifications'].includes(tabParam)
      ? tabParam
      : 'overview'
  );

  useEffect(() => {
    if (tabParam && ['overview', 'monitoring', 'notifications'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setSearchParams({ tab: tabName });
  };

  // Metrics State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('Monthly');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Quick User Management in Admin Dashboard
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState(null);

  // Quick Campaign State
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [sendingCampaignId, setSendingCampaignId] = useState(null);
  const [previewCampaignId, setPreviewCampaignId] = useState(null);

  // Fetch Dashboard Analytics
  const fetchAnalytics = useCallback(async (tf = timeframe) => {
    try {
      setLoading(true);
      const res = await api.get(`orders/analytics/dashboard/?timeframe=${tf.toLowerCase()}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
      setFeedback({ type: 'danger', text: 'Failed to load administrator metrics. Please try again.' });
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  // Fetch Users for inline role management
  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const params = {};
      if (userSearch.trim()) params.search = userSearch.trim();
      if (userRoleFilter) params.role = userRoleFilter;
      const res = await api.get('auth/admin/users/', { params });
      setUsers(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load users for admin dashboard:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch, userRoleFilter]);

  // Fetch Campaigns
  const fetchCampaigns = useCallback(async () => {
    try {
      setCampaignsLoading(true);
      const res = await api.get('notifications/campaigns/');
      setCampaigns(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load promotional campaigns:', err);
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(timeframe);
    fetchUsers();
    fetchCampaigns();
  }, [fetchAnalytics, fetchUsers, fetchCampaigns, timeframe]);

  // Handle Inline Role Assignment directly from table
  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.role === newRole) return;
    if (
      (targetUser.role === 'admin' || targetUser.role === 'super_admin') &&
      newRole !== 'admin' &&
      newRole !== 'super_admin'
    ) {
      if (!window.confirm(`Warning: You are demoting administrator "${targetUser.username}" to "${newRole}". Are you sure?`)) {
        return;
      }
    }

    try {
      setRoleUpdatingUserId(targetUser.id);
      await api.patch(`auth/admin/users/${targetUser.id}/`, { role: newRole });
      setFeedback({
        type: 'success',
        text: `Role for "${targetUser.username}" updated to "${newRole.toUpperCase()}" successfully!`,
      });
      fetchUsers();
      fetchAnalytics(timeframe);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to update user role.';
      alert(`Role Update Error: ${msg}`);
    } finally {
      setRoleUpdatingUserId(null);
    }
  };

  // Toggle user active status
  const handleToggleUserActive = async (targetUser) => {
    try {
      setRoleUpdatingUserId(targetUser.id);
      await api.patch(`auth/admin/users/${targetUser.id}/`, { is_active: !targetUser.is_active });
      setFeedback({
        type: 'success',
        text: `User "${targetUser.username}" has been ${targetUser.is_active ? 'deactivated' : 'activated'}.`,
      });
      fetchUsers();
      fetchAnalytics(timeframe);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update user status.';
      alert(msg);
    } finally {
      setRoleUpdatingUserId(null);
    }
  };

  // Dispatch campaign
  const handleSendCampaign = async (campaignId, title) => {
    if (!window.confirm(`Send promotional campaign "${title}" to all verified active subscribers now?`)) {
      return;
    }
    try {
      setSendingCampaignId(campaignId);
      const res = await api.post(`notifications/campaigns/${campaignId}/send/`);
      setFeedback({
        type: 'success',
        text: res.data.message || `Campaign "${title}" dispatched successfully.`,
      });
      fetchCampaigns();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send campaign.';
      alert(msg);
    } finally {
      setSendingCampaignId(null);
    }
  };

  // Preview campaign
  const handlePreviewCampaign = async (campaignId) => {
    try {
      setPreviewCampaignId(campaignId);
      const res = await api.post(`notifications/campaigns/${campaignId}/preview/`, {
        email: user.email,
      });
      alert(res.data.message || `Preview sent to your email (${user.email}).`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send preview email.');
    } finally {
      setPreviewCampaignId(null);
    }
  };

  const kpis = data?.kpis || {};

  // Chart: Sales Over Time
  const salesChartData = {
    labels: (data?.monthly_sales || []).map((s) => s.period || s.month),
    datasets: [
      {
        label: 'Revenue (ETB)',
        data: (data?.monthly_sales || []).map((s) => s.revenue),
        borderColor: '#1b64da',
        backgroundColor: 'rgba(27, 100, 218, 0.1)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#1b64da',
        pointRadius: 4,
      },
    ],
  };

  // Chart: User Distribution
  const userDistData = {
    labels: ['Customers', 'Store Managers', 'Order Managers', 'Admins'],
    datasets: [
      {
        data: [
          kpis.total_customers || 0,
          kpis.total_store_managers || 0,
          kpis.total_order_managers || 0,
          kpis.total_admins || 0,
        ],
        backgroundColor: ['#1b64da', '#0ea5e9', '#f59e0b', '#dc2626'],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="pb-5">
      {/* Admin Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-danger border-opacity-25 bg-danger bg-opacity-10">
            <i className="bi bi-shield-lock-fill text-danger"></i>
            <span className="small fw-bold text-danger">Supervisory Admin Control Center</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">System & Executive Dashboard</h2>
          <p className="text-slate-500 text-xs mb-0">
            Global store analytics, role governance, system administration, and verified subscriber marketing.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <div className="btn-group btn-group-sm shadow-sm" role="group">
            <button
              type="button"
              className={`btn ${timeframe === 'Monthly' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => {
                setTimeframe('Monthly');
                fetchAnalytics('Monthly');
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`btn ${timeframe === 'Yearly' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => {
                setTimeframe('Yearly');
                fetchAnalytics('Yearly');
              }}
            >
              Yearly
            </button>
          </div>

          <Link
            to="/admin/delivery"
            className="btn btn-warning btn-sm rounded-pill px-3.5 py-1.5 text-xs fw-bold shadow-sm text-slate-900"
          >
            <i className="bi bi-truck-front-fill me-1"></i> Logistics Hub
          </Link>

          <Link
            to="/admin/users"
            className="btn btn-ethio-primary btn-sm rounded-pill px-3 fw-bold"
            style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
          >
            <i className="bi bi-person-gear me-1"></i> Full User Console
          </Link>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* ADMIN SUB-NAVIGATION TABS */}
      <div className="d-flex flex-wrap gap-2 mb-4 border-bottom pb-3">
        <button
          type="button"
          className={`btn btn-sm rounded-pill px-4 fw-bold text-xs d-flex align-items-center gap-2 ${activeTab === 'overview' ? 'btn-primary shadow-sm' : 'btn-light border'}`}
          onClick={() => handleTabChange('overview')}
        >
          <i className="bi bi-grid-1x2-fill"></i>
          <span>Executive Overview</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-pill px-4 fw-bold text-xs d-flex align-items-center gap-2 ${activeTab === 'monitoring' ? 'btn-primary shadow-sm' : 'btn-light border'}`}
          onClick={() => handleTabChange('monitoring')}
        >
          <i className="bi bi-shield-shaded"></i>
          <span>Inventory &amp; Replenishment Oversight</span>
          {((kpis.low_stock_count || 0) + (kpis.out_of_stock_count || 0)) > 0 && (
            <span className="badge bg-danger rounded-pill px-2">
              {(kpis.low_stock_count || 0) + (kpis.out_of_stock_count || 0)}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-pill px-4 fw-bold text-xs d-flex align-items-center gap-2 ${activeTab === 'notifications' ? 'btn-primary shadow-sm' : 'btn-light border'}`}
          onClick={() => handleTabChange('notifications')}
        >
          <i className="bi bi-bell-fill"></i>
          <span>Stock Alerts &amp; In-System Notifications</span>
        </button>
      </div>

      {/* VIEW 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'overview' && (
        <>
          {/* SECTION 1: GLOBAL STATS CARDS */}
      <div className="row g-3 mb-4">
        {/* Total Users */}
        <div className="col-6 col-md-3 col-xl-2">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 h-100 bg-white">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-xs uppercase fw-bold text-slate-500">Total Users</span>
              <div className="rounded-3 p-2 bg-blue-50 text-blue-600">
                <i className="bi bi-people-fill fs-6"></i>
              </div>
            </div>
            <h3 className="fw-bolder text-slate-900 mb-0">{kpis.total_users || 0}</h3>
            <small className="text-muted text-[11px] mt-1 d-block">{kpis.active_users || 0} Active Accounts</small>
          </div>
        </div>

        {/* Total Customers */}
        <div className="col-6 col-md-3 col-xl-2">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 h-100 bg-white">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-xs uppercase fw-bold text-slate-500">Customers</span>
              <div className="rounded-3 p-2 bg-emerald-50 text-emerald-600">
                <i className="bi bi-person-check fs-6"></i>
              </div>
            </div>
            <h3 className="fw-bolder text-slate-900 mb-0">{kpis.total_customers || 0}</h3>
            <small className="text-muted text-[11px] mt-1 d-block">Verified Shoppers</small>
          </div>
        </div>

        {/* Store Managers */}
        <div className="col-6 col-md-3 col-xl-2">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 h-100 bg-white">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-xs uppercase fw-bold text-slate-500">Store Managers</span>
              <div className="rounded-3 p-2 bg-cyan-50 text-cyan-600">
                <i className="bi bi-shop fs-6"></i>
              </div>
            </div>
            <h3 className="fw-bolder text-slate-900 mb-0">{kpis.total_store_managers || 0}</h3>
            <small className="text-muted text-[11px] mt-1 d-block">Catalog & Stock</small>
          </div>
        </div>

        {/* Order Managers */}
        <div className="col-6 col-md-3 col-xl-2">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 h-100 bg-white">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-xs uppercase fw-bold text-slate-500">Order Managers</span>
              <div className="rounded-3 p-2 bg-amber-50 text-amber-600">
                <i className="bi bi-box-seam fs-6"></i>
              </div>
            </div>
            <h3 className="fw-bolder text-slate-900 mb-0">{kpis.total_order_managers || 0}</h3>
            <small className="text-muted text-[11px] mt-1 d-block">Fulfillment Team</small>
          </div>
        </div>

        {/* Total Products */}
        <div className="col-6 col-md-3 col-xl-2">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 h-100 bg-white">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-xs uppercase fw-bold text-slate-500">Total Products</span>
              <div className="rounded-3 p-2 bg-purple-50 text-purple-600">
                <i className="bi bi-laptop fs-6"></i>
              </div>
            </div>
            <h3 className="fw-bolder text-slate-900 mb-0">{kpis.total_products || 0}</h3>
            <small className="text-muted text-[11px] mt-1 d-block">{kpis.active_products || 0} Listed Items</small>
          </div>
        </div>

        {/* Total Orders */}
        <div className="col-6 col-md-3 col-xl-2">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 h-100 bg-white">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-xs uppercase fw-bold text-slate-500">Total Orders</span>
              <div className="rounded-3 p-2 bg-indigo-50 text-indigo-600">
                <i className="bi bi-receipt fs-6"></i>
              </div>
            </div>
            <h3 className="fw-bolder text-slate-900 mb-0">{kpis.total_orders || 0}</h3>
            <small className="text-muted text-[11px] mt-1 d-block">{kpis.paid_orders_count || 0} Settled</small>
          </div>
        </div>
      </div>

      {/* SECTION 2: REVENUE, SALES & LOW STOCK STATS */}
      <div className="row g-3 mb-4">
        {/* Total Sales & Revenue */}
        <div className="col-12 col-md-6 col-lg-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
            <span className="text-xs uppercase fw-bold text-slate-500 mb-1">Total Verified Revenue</span>
            <h2 className="fw-bolder text-emerald-600 tracking-tight mb-2">
              {formatETB(kpis.total_revenue || 0)}
            </h2>
            <div className="d-flex justify-content-between text-xs text-slate-600 pt-2 border-top">
              <span>Paid Orders: <strong>{kpis.paid_orders_count || 0}</strong></span>
              <span>Pending Orders: <strong>{kpis.pending_orders || 0}</strong></span>
            </div>
            <div className="mt-3">
              <span className="badge bg-success bg-opacity-10 text-success p-2 rounded-3 text-xs w-100 text-center">
                <i className="bi bi-shield-check me-1"></i> Authoritative Chapa & Bank Reconciled
              </span>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="col-12 col-md-6 col-lg-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-xs uppercase fw-bold text-slate-500">Inventory Health</span>
              <span className="badge bg-warning bg-opacity-10 text-amber-700">Stock Alerts</span>
            </div>
            <div className="d-flex align-items-baseline gap-3 my-2">
              <div>
                <h3 className="fw-bolder text-amber-600 mb-0">{kpis.low_stock_count || 0}</h3>
                <small className="text-muted text-[11px]">Low Stock (&le; 5 units)</small>
              </div>
              <div className="border-start ps-3">
                <h3 className="fw-bolder text-danger mb-0">{kpis.out_of_stock_count || 0}</h3>
                <small className="text-muted text-[11px]">Out of Stock (0 units)</small>
              </div>
            </div>
            <div className="pt-2 border-top mt-auto d-flex justify-content-between align-items-center">
              <button
                type="button"
                className="btn btn-link p-0 text-primary text-xs fw-bold text-decoration-none"
                onClick={() => handleTabChange('monitoring')}
              >
                Open Replenishment Oversight &rarr;
              </button>
              <Link to="/admin/inventory" className="text-slate-500 text-xs text-decoration-none">
                Inventory Catalog
              </Link>
            </div>
          </div>
        </div>

        {/* User Role Distribution Doughnut */}
        <div className="col-12 col-md-12 col-lg-4">
          <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
            <span className="text-xs uppercase fw-bold text-slate-500 mb-2">Role Architecture</span>
            <div style={{ height: '140px' }} className="d-flex justify-content-center">
              <Doughnut data={userDistData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }} />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: SALES CHART */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h5 className="fw-bold text-slate-900 mb-0">Sales & Order Volume Performance</h5>
            <small className="text-muted text-xs">Authoritative revenue trajectory from settled orders</small>
          </div>
          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-pill text-xs font-semibold">
            {timeframe} Trajectory
          </span>
        </div>
        <div style={{ height: '260px' }}>
          <Line data={salesChartData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }} />
        </div>
      </div>

      {/* SECTION 4: USER MANAGEMENT & INLINE ROLE ASSIGNMENT TABLE */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 mb-4 overflow-hidden bg-white">
        <div className="p-3 border-bottom d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
          <div>
            <h5 className="fw-bold text-slate-900 mb-0">Registered Users & Role Assignment</h5>
            <small className="text-muted text-xs">
              Assign or change roles directly from this table. Protected from removing the last active administrator.
            </small>
          </div>

          <div className="d-flex align-items-center gap-2">
            <input
              type="text"
              className="form-control form-control-sm text-xs"
              placeholder="Search user by name or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              style={{ width: '220px' }}
            />
            <select
              className="form-select form-select-sm text-xs"
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              style={{ width: '150px' }}
            >
              <option value="">All Roles</option>
              <option value="customer">Customer</option>
              <option value="store_manager">Store Manager</option>
              <option value="order_manager">Order Manager</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
        </div>

        {usersLoading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary spinner-border-sm" role="status"></div>
            <span className="text-muted text-xs ms-2">Loading user accounts...</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="ps-4">User</th>
                  <th>Email</th>
                  <th>Assigned Role</th>
                  <th>Email Verified</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 8).map((u) => (
                  <tr key={u.id}>
                    <td className="ps-4">
                      <div className="fw-bold text-slate-900">{u.username}</div>
                      <small className="text-muted">{u.first_name} {u.last_name}</small>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="form-select form-select-sm text-xs font-semibold py-1"
                        value={u.role}
                        disabled={roleUpdatingUserId === u.id || (u.is_super_admin && !isSuperAdmin)}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        style={{ width: '160px' }}
                      >
                        <option value="customer">Customer</option>
                        <option value="store_manager">Store Manager</option>
                        <option value="order_manager">Order Manager</option>
                        <option value="admin">Administrator</option>
                        {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                      </select>
                    </td>
                    <td>
                      {u.email_verified ? (
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                          <i className="bi bi-check-circle me-1"></i> Verified
                        </span>
                      ) : (
                        <span className="badge bg-warning bg-opacity-10 text-amber-700 border border-warning border-opacity-25">
                          <i className="bi bi-clock me-1"></i> Pending
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'}`}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <button
                        type="button"
                        className={`btn btn-xs rounded-pill px-2.5 py-1 ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                        disabled={roleUpdatingUserId === u.id || (u.is_super_admin && !isSuperAdmin)}
                        onClick={() => handleToggleUserActive(u)}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 5: PROMOTIONAL CAMPAIGNS & NEWSLETTER BROADCASTS */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 mb-4 overflow-hidden bg-white">
        <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
          <div>
            <h5 className="fw-bold text-slate-900 mb-0">Newsletter & Promotional Campaigns</h5>
            <small className="text-muted text-xs">
              Dispatch discounts and product launch emails to verified active subscribers
            </small>
          </div>
          <Link to="/admin/promotions" className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs">
            Manage Discounts & Promos &rarr;
          </Link>
        </div>

        {campaignsLoading ? (
          <div className="text-center py-4 text-muted text-xs">Loading campaign broadcasts...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-4 text-muted text-xs">
            No promotional campaigns have been dispatched yet. Create promotions from the Promotions module.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="ps-4">Campaign Title</th>
                  <th>Subject</th>
                  <th>Discount Info</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th>Delivered</th>
                  <th className="text-end pe-4">Dispatch Action</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="ps-4 fw-bold text-slate-900">{c.title}</td>
                    <td>{c.subject}</td>
                    <td>
                      {c.discount_info ? (
                        <span className="badge bg-success bg-opacity-10 text-success">{c.discount_info}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${c.status === 'SENT' ? 'bg-success' : c.status === 'SENDING' ? 'bg-info' : 'bg-secondary'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>{c.recipient_count || 0}</td>
                    <td>{c.delivered_count || 0}</td>
                    <td className="text-end pe-4">
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm text-xs py-1"
                          disabled={previewCampaignId === c.id}
                          onClick={() => handlePreviewCampaign(c.id)}
                        >
                          {previewCampaignId === c.id ? 'Sending...' : 'Preview'}
                        </button>
                        {c.status !== 'SENT' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm text-xs py-1 font-bold"
                            disabled={sendingCampaignId === c.id || c.status === 'SENDING'}
                            onClick={() => handleSendCampaign(c.id, c.title)}
                          >
                            {sendingCampaignId === c.id ? 'Sending...' : 'Send Bulk'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {/* VIEW 2: ADMIN INVENTORY & REPLENISHMENT OVERSIGHT */}
      {activeTab === 'monitoring' && (
        <AdminInventoryMonitoring />
      )}

      {/* VIEW 3: STOCK ALERTS & IN-SYSTEM NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <NotificationDashboard />
      )}
    </div>
  );
};

export default AdminDashboardPage;
