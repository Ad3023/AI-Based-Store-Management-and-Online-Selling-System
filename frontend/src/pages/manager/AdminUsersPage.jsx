import React, { useState, useEffect } from 'react';
import api from '../../api';

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [roleFilter, setRoleFilter] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const url = roleFilter ? `auth/users/?role=${roleFilter}` : 'auth/users/';
      const [uRes, logRes] = await Promise.all([
        api.get(url),
        api.get('auth/audit-logs/')
      ]);
      setUsers(uRes.data.results || uRes.data || []);
      setAuditLogs(logRes.data.results || logRes.data || []);
    } catch (err) {
      console.error("Admin users fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`auth/users/${userId}/`, { role: newRole });
      setFeedback({ type: 'success', text: `User role successfully updated to ${newRole}.` });
      fetchUsers();
    } catch (err) {
      alert("Failed to update user role.");
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    try {
      await api.patch(`auth/users/${userId}/`, { is_active: !currentActive });
      setFeedback({ type: 'success', text: `User account ${!currentActive ? 'activated' : 'deactivated'}.` });
      fetchUsers();
    } catch (err) {
      alert("Failed to toggle user status.");
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-danger border-opacity-25 bg-danger bg-opacity-10">
            <i className="bi bi-shield-lock-fill text-danger"></i>
            <span className="small fw-semibold text-danger">System Administrator Console</span>
          </div>
          <h2 className="fw-bolder mb-1 text-dark">User Accounts & System Audits</h2>
          <p className="text-muted small mb-0">Manage roles, permissions, account activity, and inspect the system audit trail</p>
        </div>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 mb-4`} role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-pills mb-4 small">
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-4 fw-semibold ${activeTab === 'users' ? 'active bg-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="bi bi-people-fill me-2"></i> All User Accounts ({users.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-4 fw-semibold ${activeTab === 'audits' ? 'active bg-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('audits')}
          >
            <i className="bi bi-journal-text me-2"></i> Security Audit Trail ({auditLogs.length})
          </button>
        </li>
      </ul>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="card border-0 shadow-sm rounded-4 p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold mb-0">Registered Users</h5>
            <div className="d-flex align-items-center gap-2">
              <label className="small text-muted mb-0">Filter Role:</label>
              <select
                className="form-select form-select-sm rounded-pill"
                style={{ width: '160px' }}
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
              <thead className="table-light text-uppercase small text-muted" style={{ fontSize: '0.72rem' }}>
                <tr>
                  <th>User</th>
                  <th>Contact</th>
                  <th>Current Role</th>
                  <th>Change Role</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="small">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold"
                          style={{ width: '32px', height: '32px', background: 'var(--color-primary)' }}
                        >
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="fw-bold text-dark">{u.username}</div>
                          <small className="text-muted">{u.first_name} {u.last_name}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{u.email}</div>
                      <small className="text-muted">{u.phone_number || 'No phone'}</small>
                    </td>
                    <td>
                      <span className={`badge rounded-pill text-uppercase ${
                        u.role === 'admin' ? 'bg-danger' : u.role === 'store_manager' ? 'bg-info text-dark' : 'bg-primary'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm rounded-pill"
                        style={{ width: '150px' }}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="customer">Customer</option>
                        <option value="store_manager">Store Manager</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>
                    <td>
                      {u.is_active !== false ? (
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill">
                          Active
                        </span>
                      ) : (
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill">
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="text-end">
                      <button
                        className={`btn btn-sm rounded-pill px-3 ${
                          u.is_active !== false ? 'btn-outline-danger' : 'btn-outline-success'
                        }`}
                        onClick={() => handleToggleActive(u.id, u.is_active !== false)}
                      >
                        {u.is_active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audits' && (
        <div className="card border-0 shadow-sm rounded-4 p-4">
          <h5 className="fw-bold mb-3">Security & Administrative Activity Audit Trail</h5>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light text-uppercase small text-muted" style={{ fontSize: '0.72rem' }}>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Performed By</th>
                  <th>IP Address</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody className="small">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-muted">{new Date(log.created_at).toLocaleString()}</td>
                    <td><span className="badge bg-light text-dark border">{log.action}</span></td>
                    <td className="fw-bold">{log.username || 'System'}</td>
                    <td><code>{log.ip_address || '127.0.0.1'}</code></td>
                    <td className="text-secondary">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
