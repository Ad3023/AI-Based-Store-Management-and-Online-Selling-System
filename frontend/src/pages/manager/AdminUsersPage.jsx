import React, { useState, useEffect } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { formatETB } from '../../utils/currency';

const AdminUsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [systemAnalytics, setSystemAnalytics] = useState(null);
  const [platformConfig, setPlatformConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const isProtectedUser = (targetUser) => {
    if (!targetUser) return false;
    if (targetUser.is_superuser) return true;
    if (targetUser.username === 'addisuguche_admin') return true;
    if (currentUser && targetUser.id === currentUser.id && currentUser.role === 'admin') return true;
    return false;
  };

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      let usersUrl = 'auth/users/';
      const params = [];
      if (roleFilter) params.push(`role=${encodeURIComponent(roleFilter)}`);
      if (searchQuery.trim()) params.push(`search=${encodeURIComponent(searchQuery.trim())}`);
      if (params.length > 0) usersUrl += `?${params.join('&')}`;

      const [uRes, logRes, anaRes, cfgRes] = await Promise.all([
        api.get(usersUrl),
        api.get('auth/audit-logs/'),
        api.get('auth/system-analytics/').catch(() => ({ data: null })),
        api.get('auth/platform-config/').catch(() => ({ data: null })),
      ]);

      setUsers(uRes.data.results || uRes.data || []);
      setAuditLogs(logRes.data.results || logRes.data || []);
      if (anaRes.data) setSystemAnalytics(anaRes.data);
      if (cfgRes.data) setPlatformConfig(cfgRes.data);
    } catch (err) {
      console.error("Admin data fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [roleFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAdminData();
  };

  const handleRoleChange = async (userId, newRole) => {
    const target = users.find(u => u.id === userId);
    if (target && isProtectedUser(target)) {
      alert("The Main Administrator's role is protected and cannot be changed.");
      return;
    }
    try {
      await api.patch(`auth/users/${userId}/`, { role: newRole });
      setFeedback({ type: 'success', text: `User role successfully updated to ${newRole}.` });
      fetchAdminData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.role?.[0] || err.response?.data?.detail || "Failed to update user role.";
      alert(msg);
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    const target = users.find(u => u.id === userId);
    if (target && isProtectedUser(target)) {
      alert("The Main Administrator account cannot be deactivated.");
      return;
    }
    try {
      await api.patch(`auth/users/${userId}/`, { is_active: !currentActive });
      setFeedback({ type: 'success', text: `User account ${!currentActive ? 'activated' : 'deactivated'}.` });
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to toggle user status.");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-danger border-opacity-25 bg-danger bg-opacity-10">
            <i className="bi bi-shield-lock-fill text-danger"></i>
            <span className="small fw-semibold text-danger">System Administrator Console</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Governance, Access & Audits</h2>
          <p className="text-slate-500 text-xs mb-0">
            Enforce role-based access control, inspect security audit trails, monitor platform infrastructure, and manage global settings.
          </p>
        </div>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4`} role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback.text}
          <button type="button" className="btn-close btn-sm p-2" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-pills mb-4 small gap-1">
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-4 fw-semibold text-xs transition ${
              activeTab === 'users' ? 'active bg-danger text-white' : 'text-slate-600 bg-white border border-slate-200'
            }`}
            onClick={() => setActiveTab('users')}
          >
            <i className="bi bi-people-fill me-1.5"></i> User Management ({users.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-4 fw-semibold text-xs transition ${
              activeTab === 'permissions' ? 'active bg-danger text-white' : 'text-slate-600 bg-white border border-slate-200'
            }`}
            onClick={() => setActiveTab('permissions')}
          >
            <i className="bi bi-shield-check me-1.5"></i> Permissions Matrix
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-4 fw-semibold text-xs transition ${
              activeTab === 'audits' ? 'active bg-danger text-white' : 'text-slate-600 bg-white border border-slate-200'
            }`}
            onClick={() => setActiveTab('audits')}
          >
            <i className="bi bi-journal-text me-1.5"></i> Audit Trail ({auditLogs.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-4 fw-semibold text-xs transition ${
              activeTab === 'analytics' ? 'active bg-danger text-white' : 'text-slate-600 bg-white border border-slate-200'
            }`}
            onClick={() => setActiveTab('analytics')}
          >
            <i className="bi bi-cpu me-1.5"></i> System Analytics
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-4 fw-semibold text-xs transition ${
              activeTab === 'config' ? 'active bg-danger text-white' : 'text-slate-600 bg-white border border-slate-200'
            }`}
            onClick={() => setActiveTab('config')}
          >
            <i className="bi bi-sliders me-1.5"></i> Platform Config
          </button>
        </li>
      </ul>

      {loading && (
        <div className="text-center py-2 mb-3">
          <div className="spinner-border spinner-border-sm text-danger me-2" role="status"></div>
          <span className="text-slate-500 text-xs">Syncing administrator data...</span>
        </div>
      )}

      {/* TAB 1: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 gap-2">
            <div>
              <h5 className="fw-bold mb-0 text-slate-900">Registered Platform Users</h5>
              <small className="text-slate-400 text-xs">Authorize, promote, or deactivate accounts with instantaneous server enforcement</small>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <form onSubmit={handleSearchSubmit} className="d-flex gap-1">
                <input
                  type="text"
                  className="form-control form-control-sm rounded-pill text-xs"
                  placeholder="Search user or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '180px' }}
                />
                <button type="submit" className="btn btn-sm btn-outline-secondary rounded-pill px-2.5">
                  <i className="bi bi-search"></i>
                </button>
              </form>

              <select
                className="form-select form-select-sm rounded-pill text-xs"
                style={{ width: '150px' }}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="customer">Customer</option>
                <option value="store_manager">Store Manager</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light text-uppercase text-[11px] text-slate-500">
                <tr>
                  <th>User Identity</th>
                  <th>Contact Info</th>
                  <th>Current Role</th>
                  <th>Change Assigned Role</th>
                  <th>Account Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold"
                          style={{ width: '34px', height: '34px', background: 'var(--gradient-primary)' }}
                        >
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="fw-bold text-slate-900">{u.username}</div>
                          <small className="text-slate-400">{u.first_name} {u.last_name}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{u.email}</div>
                      <small className="text-slate-400">{u.phone_number || 'No phone recorded'}</small>
                    </td>
                    <td>
                      <span className={`badge rounded-full px-2.5 py-1 text-[10px] text-uppercase font-bold ${
                        u.role === 'admin' ? 'bg-danger text-white' : u.role === 'store_manager' ? 'bg-info text-dark' : 'bg-primary text-white'
                      }`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {isProtectedUser(u) ? (
                        <div className="d-inline-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill bg-slate-100 text-slate-700 border border-slate-200">
                          <i className="bi bi-shield-lock-fill text-danger"></i>
                          <span className="fw-bold text-[11px]">Protected Administrator</span>
                        </div>
                      ) : (
                        <select
                          className="form-select form-select-sm rounded-pill text-xs"
                          style={{ width: '150px' }}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          <option value="customer">Customer</option>
                          <option value="store_manager">Store Manager</option>
                          <option value="admin">Administrator</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {u.is_active !== false ? (
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2.5 py-1">
                          Active
                        </span>
                      ) : (
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill px-2.5 py-1">
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="text-end">
                      {isProtectedUser(u) ? (
                        <span className="badge bg-light text-muted border px-3 py-1.5 rounded-pill text-[10px]">
                          <i className="bi bi-lock me-1"></i> System Account
                        </span>
                      ) : (
                        <button
                          className={`btn btn-sm rounded-pill px-3 py-1 text-xs ${
                            u.is_active !== false ? 'btn-outline-danger' : 'btn-outline-success'
                          }`}
                          onClick={() => handleToggleActive(u.id, u.is_active !== false)}
                        >
                          {u.is_active !== false ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PERMISSIONS MATRIX */}
      {activeTab === 'permissions' && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="mb-4">
            <h5 className="fw-bold mb-1 text-slate-900">Role-Based Access Control (RBAC) Specification</h5>
            <p className="text-slate-400 text-xs mb-0">Server-enforced endpoint matrix per role identity</p>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle text-xs mb-0">
              <thead className="table-light text-[11px] text-uppercase">
                <tr>
                  <th>Capability / Module</th>
                  <th>Customer</th>
                  <th>Store Manager</th>
                  <th>Administrator</th>
                  <th>Security Enforcement Policy</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="fw-bold">Browse & Search Catalog</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td>Public read access for active items</td>
                </tr>
                <tr>
                  <td className="fw-bold">Cart, Checkout & Payments</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td>Must be authenticated customer</td>
                </tr>
                <tr>
                  <td className="fw-bold">AI Personalized Recommendations</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td>Personal interest TF-IDF feature space</td>
                </tr>
                <tr>
                  <td className="fw-bold">Private Order History & Receipts</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Own Only</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> All Orders</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> All Orders</td>
                  <td>Strict ownership filter; returns 403 on crossover</td>
                </tr>
                <tr>
                  <td className="fw-bold">Payment Evidence Verification</td>
                  <td className="text-danger"><i className="bi bi-x-circle-fill me-1"></i> Denied</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td>Protected by <code>IsStoreManagerOrAdmin</code></td>
                </tr>
                <tr>
                  <td className="fw-bold">Inventory & Restocking</td>
                  <td className="text-danger"><i className="bi bi-x-circle-fill me-1"></i> Denied</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td>Generates automatic StockMovement records</td>
                </tr>
                <tr>
                  <td className="fw-bold">AI Customer RFM Segmentation</td>
                  <td className="text-danger"><i className="bi bi-x-circle-fill me-1"></i> Denied</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td>K-Means clustering algorithm access</td>
                </tr>
                <tr>
                  <td className="fw-bold">User Account & Role Management</td>
                  <td className="text-danger"><i className="bi bi-x-circle-fill me-1"></i> Denied</td>
                  <td className="text-danger"><i className="bi bi-x-circle-fill me-1"></i> Denied</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td>Strictly protected by <code>IsAdminUserRole</code></td>
                </tr>
                <tr>
                  <td className="fw-bold">Security Audit Log Inspection</td>
                  <td className="text-danger"><i className="bi bi-x-circle-fill me-1"></i> Denied</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Allowed</td>
                  <td className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Full Access</td>
                  <td>Immutable server action log</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'audits' && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="mb-3">
            <h5 className="fw-bold mb-1 text-slate-900">Security & Operational Audit Trail</h5>
            <p className="text-slate-400 text-xs mb-0">Chronological ledger of user registrations, logins, payment verifications, and role modifications</p>
          </div>

          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light text-uppercase text-[11px] text-slate-500">
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Client IP</th>
                  <th>Event Details</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                    <td>
                      <span className="badge bg-slate-100 text-slate-800 border border-slate-200 font-semibold px-2 py-1">
                        {log.action}
                      </span>
                    </td>
                    <td className="fw-bold text-slate-900">{log.username || 'System Engine'}</td>
                    <td><code className="text-primary">{log.ip_address || '127.0.0.1'}</code></td>
                    <td className="text-slate-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM ANALYTICS */}
      {activeTab === 'analytics' && (
        <div>
          {systemAnalytics ? (
            <div className="row g-3">
              <div className="col-md-4">
                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                  <span className="text-xs text-slate-400 uppercase font-bold mb-2">User Distribution</span>
                  <h3 className="fw-bolder text-slate-900 mb-1">{systemAnalytics.users.total} Total</h3>
                  <div className="text-xs text-slate-500 mb-2">
                    {systemAnalytics.users.active} Active &bull; {systemAnalytics.users.inactive} Deactivated
                  </div>
                  <div className="d-flex flex-column gap-1 pt-2 border-top text-xs">
                    <div className="d-flex justify-content-between">
                      <span>Customers:</span>
                      <strong>{systemAnalytics.users.by_role.customer}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Store Managers:</span>
                      <strong>{systemAnalytics.users.by_role.store_manager}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Administrators:</span>
                      <strong>{systemAnalytics.users.by_role.admin}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                  <span className="text-xs text-slate-400 uppercase font-bold mb-2">Catalog Capacity</span>
                  <h3 className="fw-bolder text-slate-900 mb-1">{systemAnalytics.catalog.total_products} Products</h3>
                  <div className="text-xs text-slate-500 mb-2">
                    {systemAnalytics.catalog.active_products} Live &bull; {systemAnalytics.catalog.out_of_stock} Out of Stock
                  </div>
                  <div className="d-flex flex-column gap-1 pt-2 border-top text-xs">
                    <div className="d-flex justify-content-between">
                      <span>Total Orders:</span>
                      <strong>{systemAnalytics.orders.total_orders}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Platform Revenue:</span>
                      <strong>{formatETB(systemAnalytics.orders.total_revenue)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                  <span className="text-xs text-slate-400 uppercase font-bold mb-2">Infrastructure Status</span>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="spinner-grow spinner-grow-sm text-success" role="status"></span>
                    <span className="fw-bold text-success text-xs">Operational</span>
                  </div>
                  <div className="d-flex flex-column gap-1 pt-2 border-top text-xs">
                    <div className="d-flex justify-content-between">
                      <span>Framework:</span>
                      <strong>{systemAnalytics.security.system_version}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Python:</span>
                      <strong>{systemAnalytics.security.python_version}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Database:</span>
                      <strong className="text-uppercase">{systemAnalytics.security.database_engine}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Audit Logs:</span>
                      <strong>{systemAnalytics.security.audit_logs_recorded} events</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-5 text-muted small bg-white rounded-4 shadow-sm">
              Loading system metrics...
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PLATFORM CONFIGURATION */}
      {activeTab === 'config' && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="mb-4">
            <h5 className="fw-bold mb-1 text-slate-900">Platform-Wide Configuration</h5>
            <p className="text-slate-400 text-xs mb-0">Active payment channels, currency standard, delivery pricing, and taxes</p>
          </div>

          {platformConfig ? (
            <div className="row g-4">
              <div className="col-md-6">
                <h6 className="fw-bold text-slate-800 text-xs uppercase mb-3">Store Financial Parameters</h6>
                <div className="p-3 bg-slate-50 rounded-3 border border-slate-200">
                  <div className="d-flex justify-content-between text-xs py-1 border-bottom">
                    <span className="text-slate-500">Store Name:</span>
                    <strong className="text-slate-900">{platformConfig.platform_name}</strong>
                  </div>
                  <div className="d-flex justify-content-between text-xs py-1 border-bottom">
                    <span className="text-slate-500">Base Currency:</span>
                    <strong>{platformConfig.currency} (Ethiopian Birr)</strong>
                  </div>
                  <div className="d-flex justify-content-between text-xs py-1 border-bottom">
                    <span className="text-slate-500">VAT / Tax Rate:</span>
                    <strong>{(platformConfig.tax_rate * 100).toFixed(0)}% Standard</strong>
                  </div>
                  <div className="d-flex justify-content-between text-xs py-1">
                    <span className="text-slate-500">Chapa Gateway:</span>
                    <span className={`badge ${platformConfig.chapa_gateway_active ? 'bg-success' : 'bg-warning text-dark'}`}>
                      {platformConfig.chapa_gateway_active ? 'Active & Configured' : 'Sandbox Demo Mode'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <h6 className="fw-bold text-slate-800 text-xs uppercase mb-3">Active Payment Channels</h6>
                <div className="d-flex flex-column gap-2">
                  {platformConfig.payment_channels.map((ch) => (
                    <div key={ch.id} className="p-2.5 rounded-3 bg-slate-50 border border-slate-200 d-flex justify-content-between align-items-center text-xs">
                      <div>
                        <strong>{ch.name}</strong>
                        {ch.account && <div className="text-[11px] text-slate-400 font-mono">Acc: {ch.account}</div>}
                      </div>
                      <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                        Enabled
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-12">
                <h6 className="fw-bold text-slate-800 text-xs uppercase mb-2">Delivery Pricing Structure</h6>
                <div className="row g-2">
                  {platformConfig.delivery_options.map((del) => (
                    <div key={del.id} className="col-md-4">
                      <div className="p-3 bg-slate-50 rounded-3 border border-slate-200 h-100 text-xs">
                        <div className="fw-bold text-slate-900 mb-1">{del.name}</div>
                        <div className="text-primary fw-bold fs-6 mb-1">{formatETB(del.cost)}</div>
                        <div className="text-slate-400 text-[11px]">Timeframe: {del.days}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted small">Loading platform configuration...</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
