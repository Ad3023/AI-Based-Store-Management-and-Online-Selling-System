import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { formatETB } from '../../utils/currency';
import { cleanDisplayName, getUserRoleLabel, getUserRoleBadgeClass } from '../../utils/orderStatus';

const AdminUsersPage = () => {
  const { user: currentUser, isSuperAdmin, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary Data States
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissionsList, setPermissionsList] = useState([]);
  const [permissionsGrouped, setPermissionsGrouped] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [systemAnalytics, setSystemAnalytics] = useState(null);
  const [platformConfig, setPlatformConfig] = useState(null);
  const [templates, setTemplates] = useState({});

  // UI Control States
  const [loading, setLoading] = useState(true);
  const initialTab = searchParams.get('tab') || 'users';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || searchParams.get('filter') || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Modals States
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleFormData, setRoleFormData] = useState({
    code: '',
    name: '',
    description: '',
    permission_codes: []
  });

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningUser, setAssigningUser] = useState(null);
  const [assignFormData, setAssignFormData] = useState({
    role: '',
    custom_role_id: '',
    direct_permission_codes: []
  });

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserFormData, setNewUserFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    role: 'sub_admin',
    custom_role_id: ''
  });

  // Sync tab with URL
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  const isProtectedUser = (targetUser) => {
    if (!targetUser) return false;
    if (targetUser.is_super_admin || targetUser.is_superuser) return true;
    if (targetUser.username === 'addisuguche_admin') return true;
    if (currentUser && targetUser.id === currentUser.id && (currentUser.is_super_admin || currentUser.role === 'admin')) return true;
    return false;
  };

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);

      let usersUrl = 'auth/users/';
      const params = [];
      if (roleFilter) params.push(`role=${encodeURIComponent(roleFilter)}`);
      if (searchQuery.trim()) params.push(`search=${encodeURIComponent(searchQuery.trim())}`);
      if (params.length > 0) usersUrl += `?${params.join('&')}`;

      const [uRes, rRes, pRes, tRes, logRes, anaRes, cfgRes] = await Promise.all([
        api.get(usersUrl),
        api.get('auth/roles/').catch(() => ({ data: [] })),
        api.get('auth/permissions/').catch(() => ({ data: { permissions: [], grouped_by_module: {} } })),
        api.get('auth/roles/templates/').catch(() => ({ data: { templates: {} } })),
        api.get('auth/audit-logs/').catch(() => ({ data: [] })),
        api.get('auth/system-analytics/').catch(() => ({ data: null })),
        api.get('auth/platform-config/').catch(() => ({ data: null })),
      ]);

      setUsers(uRes.data.results || uRes.data || []);
      setRoles(rRes.data || []);
      setPermissionsList(pRes.data?.permissions || []);
      setPermissionsGrouped(pRes.data?.grouped_by_module || {});
      setTemplates(tRes.data?.templates || {});
      setAuditLogs(logRes.data.results || logRes.data || []);
      if (anaRes.data) setSystemAnalytics(anaRes.data);
      if (cfgRes.data) setPlatformConfig(cfgRes.data);
    } catch (err) {
      console.error("Admin data fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, searchQuery]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAdminData();
  };

  // Toggle user activation status
  const handleToggleActive = async (targetUser) => {
    if (isProtectedUser(targetUser)) {
      alert("The Super Administrator account cannot be deactivated.");
      return;
    }
    try {
      await api.patch(`auth/users/${targetUser.id}/`, { is_active: !targetUser.is_active });
      setFeedback({
        type: 'success',
        text: `Account for ${targetUser.username} has been ${!targetUser.is_active ? 'activated' : 'suspended'}.`
      });
      fetchAdminData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.is_active?.[0] || "Failed to update account status.";
      alert(msg);
    }
  };

  // Open Role Modal for Creation or Editing
  const openCreateRoleModal = () => {
    setEditingRole(null);
    setRoleFormData({
      code: '',
      name: '',
      description: '',
      permission_codes: []
    });
    setShowRoleModal(true);
  };

  const openEditRoleModal = (role) => {
    setEditingRole(role);
    setRoleFormData({
      code: role.code,
      name: role.name,
      description: role.description || '',
      permission_codes: role.permission_codes || []
    });
    setShowRoleModal(true);
  };

  // Save Role
  const handleSaveRole = async (e) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await api.put(`auth/roles/${editingRole.id}/`, roleFormData);
        setFeedback({ type: 'success', text: `Role '${roleFormData.name}' successfully updated.` });
      } else {
        await api.post('auth/roles/', roleFormData);
        setFeedback({ type: 'success', text: `Custom role '${roleFormData.name}' created successfully.` });
      }
      setShowRoleModal(false);
      fetchAdminData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.code?.[0] || err.response?.data?.name?.[0] || "Failed to save role.";
      alert(msg);
    }
  };

  // Delete Custom Role
  const handleDeleteRole = async (role) => {
    if (role.is_system_role) {
      alert(`System role '${role.name}' is protected and cannot be deleted.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the custom role '${role.name}'?`)) {
      return;
    }
    try {
      await api.delete(`auth/roles/${role.id}/`);
      setFeedback({ type: 'success', text: `Role '${role.name}' deleted.` });
      fetchAdminData();
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to delete role.";
      alert(msg);
    }
  };

  // Quick Apply Predefined Template
  const handleApplyTemplate = async (templateKey) => {
    const template = templates[templateKey];
    if (!template) return;

    if (!window.confirm(`Initialize or refresh the '${template.name}' role profile?`)) {
      return;
    }

    try {
      const res = await api.post('auth/roles/templates/', { template_key: templateKey });
      setFeedback({ type: 'success', text: res.data.message || `Template '${template.name}' applied.` });
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to apply permission profile template.");
    }
  };

  // Open Assign Role Modal
  const openAssignModal = (targetUser) => {
    setAssigningUser(targetUser);
    setAssignFormData({
      role: targetUser.role || 'customer',
      custom_role_id: targetUser.custom_role?.id || '',
      direct_permission_codes: targetUser.permissions || []
    });
    setShowAssignModal(true);
  };

  // Submit User Role & Permission Assignment
  const handleSaveUserAssignment = async (e) => {
    e.preventDefault();
    if (!assigningUser) return;

    try {
      await api.post(`auth/users/${assigningUser.id}/assign-role/`, {
        role: assignFormData.role,
        custom_role_id: assignFormData.role === 'custom' ? (assignFormData.custom_role_id || null) : null,
        direct_permission_codes: assignFormData.direct_permission_codes
      });
      setFeedback({
        type: 'success',
        text: `Permissions and role for ${assigningUser.username} updated successfully.`
      });
      setShowAssignModal(false);
      fetchAdminData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.role?.[0] || "Failed to update user role.";
      alert(msg);
    }
  };

  // Create New Staff Account
  const handleCreateNewUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('auth/users/', newUserFormData);
      setFeedback({
        type: 'success',
        text: `New user account '${newUserFormData.username}' created successfully.`
      });
      setShowCreateUserModal(false);
      setNewUserFormData({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        phone_number: '',
        role: 'sub_admin',
        custom_role_id: ''
      });
      fetchAdminData();
    } catch (err) {
      const errData = err.response?.data;
      const msg = typeof errData === 'object' ? Object.values(errData).flat().join(' ') : "Failed to create user account.";
      alert(msg);
    }
  };

  // Helper to toggle checkbox in permission list
  const togglePermissionCode = (code, list, setList) => {
    if (list.includes(code)) {
      setList(list.filter(c => c !== code));
    } else {
      setList([...list, code]);
    }
  };

  // Helper to toggle all module permissions
  const toggleAllModulePermissions = (modulePerms, currentCodes, setCodes) => {
    const moduleCodes = modulePerms.map(p => p.code);
    const hasAll = moduleCodes.every(c => currentCodes.includes(c));
    if (hasAll) {
      setCodes(currentCodes.filter(c => !moduleCodes.includes(c)));
    } else {
      const unique = Array.from(new Set([...currentCodes, ...moduleCodes]));
      setCodes(unique);
    }
  };

  return (
    <div className="pb-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-danger border-opacity-25 bg-danger bg-opacity-10">
            <i className="bi bi-shield-lock-fill text-danger"></i>
            <span className="small fw-semibold text-danger">
              {isSuperAdmin ? 'Super Administrator Console' : 'Administrator Access Console'}
            </span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Role-Based Access Control (RBAC) & Governance</h2>
          <p className="text-slate-500 text-xs mb-0">
            Manage system roles, configure granular permissions, audit security events, and control staff authorization with backend enforcement.
          </p>
        </div>

        <div className="d-flex gap-2">
          {(isSuperAdmin || hasPermission('roles.manage')) && (
            <button
              onClick={openCreateRoleModal}
              className="btn btn-primary btn-sm rounded-pill px-3 py-2 text-xs d-flex align-items-center gap-1.5 shadow-sm"
            >
              <i className="bi bi-plus-circle"></i> Create Custom Role
            </button>
          )}

          {(isSuperAdmin || hasPermission('users.manage')) && (
            <button
              onClick={() => setShowCreateUserModal(true)}
              className="btn btn-dark btn-sm rounded-pill px-3 py-2 text-xs d-flex align-items-center gap-1.5 shadow-sm"
            >
              <i className="bi bi-person-plus-fill"></i> Add Staff Account
            </button>
          )}
        </div>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm`} role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback.text}
          <button type="button" className="btn-close btn-sm p-2" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Tabs Bar */}
      <ul className="nav nav-pills mb-4 small gap-1 flex-wrap">
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-3 py-1.5 fw-semibold text-xs transition ${
              activeTab === 'users' ? 'active bg-danger text-white' : 'text-slate-600 bg-white border border-slate-200'
            }`}
            onClick={() => handleTabChange('users')}
          >
            <i className="bi bi-people-fill me-1.5"></i> Users ({users.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-3 py-1.5 fw-semibold text-xs transition ${
              activeTab === 'roles' ? 'active bg-danger text-white' : 'text-slate-600 bg-white border border-slate-200'
            }`}
            onClick={() => handleTabChange('roles')}
          >
            <i className="bi bi-shield-lock-fill me-1.5"></i> Roles & Profiles ({roles.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-3 py-1.5 fw-semibold text-xs transition ${
              activeTab === 'permissions' ? 'active bg-danger text-white' : 'text-slate-600 bg-white border border-slate-200'
            }`}
            onClick={() => handleTabChange('permissions')}
          >
            <i className="bi bi-key-fill me-1.5"></i> Granular Permissions ({permissionsList.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-3 py-1.5 fw-semibold text-xs transition ${
              activeTab === 'audits' ? 'active bg-danger text-white' : 'text-slate-600 bg-white border border-slate-200'
            }`}
            onClick={() => handleTabChange('audits')}
          >
            <i className="bi bi-journal-text me-1.5"></i> Audit Trail ({auditLogs.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-3 py-1.5 fw-semibold text-xs transition ${
              activeTab === 'analytics' ? 'active bg-danger text-white' : 'text-slate-600 bg-white border border-slate-200'
            }`}
            onClick={() => handleTabChange('analytics')}
          >
            <i className="bi bi-cpu me-1.5"></i> System Analytics
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link rounded-pill px-3 py-1.5 fw-semibold text-xs transition ${
              activeTab === 'config' ? 'active bg-danger text-white' : 'text-slate-600 bg-white border border-slate-200'
            }`}
            onClick={() => handleTabChange('config')}
          >
            <i className="bi bi-sliders me-1.5"></i> Platform Config
          </button>
        </li>
      </ul>

      {loading && (
        <div className="text-center py-2 mb-3">
          <div className="spinner-border spinner-border-sm text-danger me-2" role="status"></div>
          <span className="text-slate-500 text-xs">Synchronizing access control data...</span>
        </div>
      )}

      {/* ======================================================================
          TAB 1: USER MANAGEMENT
          ====================================================================== */}
      {activeTab === 'users' && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 gap-2">
            <div>
              <h5 className="fw-bold mb-0 text-slate-900">User Identity & Access Directory</h5>
              <small className="text-slate-400 text-xs">Assign roles, inspect individual granted permissions, or toggle account access</small>
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
                style={{ width: '160px' }}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Administrator</option>
                <option value="sub_admin">Sub-Admin</option>
                <option value="store_manager">Store Manager</option>
                <option value="order_manager">Order Manager</option>
                <option value="customer">Customer</option>
                {roles.filter(r => !r.is_system_role).map(r => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light text-uppercase text-[11px] text-slate-500">
                <tr>
                  <th>User Identity</th>
                  <th>Current Role</th>
                  <th>Permissions Summary</th>
                  <th>Account Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {users.map((u) => {
                  const isProtected = isProtectedUser(u);
                  const isSelf = currentUser && u.id === currentUser.id;
                  const perms = u.permissions || [];
                  return (
                    <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle bg-slate-100 border text-slate-600 fw-bold d-flex align-items-center justify-content-center text-xs"
                            style={{ width: '34px', height: '34px' }}
                          >
                            {(u.first_name?.[0] || u.username[0] || '?').toUpperCase()}
                          </div>
                          <div>
                            <div className="fw-bold text-slate-900 d-flex align-items-center gap-1.5">
                              {cleanDisplayName(u)}
                              {isProtected && (
                                <i className="bi bi-shield-fill-check text-danger" title="Protected System Account"></i>
                              )}
                              {isSelf && (
                                <span className="badge bg-secondary" style={{ fontSize: '0.6rem' }}>You</span>
                              )}
                            </div>
                            <small className="text-slate-400 d-block">{u.email}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`badge ${getUserRoleBadgeClass(u)} text-uppercase`} style={{ fontSize: '0.65rem' }}>
                          {getUserRoleLabel(u)}
                        </span>
                        {u.custom_role && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Custom: {u.custom_role.name}
                          </div>
                        )}
                      </td>

                      <td>
                        {u.is_super_admin ? (
                          <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">
                            <i className="bi bi-infinity me-1"></i> Full Unrestricted Permissions
                          </span>
                        ) : perms.length > 0 ? (
                          <span className="badge bg-light text-dark border">
                            <i className="bi bi-check-all me-1 text-success"></i> {perms.length} Action{perms.length === 1 ? '' : 's'} Authorized
                          </span>
                        ) : (
                          <span className="badge bg-secondary bg-opacity-10 text-secondary border">
                            <i className="bi bi-shield-x me-1"></i> Least Privilege (None)
                          </span>
                        )}
                      </td>

                      <td>
                        {u.is_active ? (
                          <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                            Active
                          </span>
                        ) : (
                          <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">
                            Suspended
                          </span>
                        )}
                      </td>

                      <td className="text-end">
                        <div className="d-flex justify-content-end align-items-center gap-1.5">
                          {/* Assign Role / Custom Permissions Button */}
                          {(isSuperAdmin || hasPermission('roles.manage')) && (
                            <button
                              className="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-1 text-xs"
                              onClick={() => openAssignModal(u)}
                              title="Assign Role and Permissions"
                            >
                              <i className="bi bi-shield-lock me-1"></i> Permissions
                            </button>
                          )}

                          {/* Toggle Active / Suspend Button */}
                          {(isSuperAdmin || hasPermission('users.manage')) && (
                            isProtected ? (
                              <span className="text-slate-400 text-[11px] fst-italic px-2">Protected</span>
                            ) : (
                              <button
                                className={`btn btn-sm rounded-pill px-2.5 py-1 text-xs ${
                                  u.is_active ? 'btn-outline-danger' : 'btn-outline-success'
                                }`}
                                onClick={() => handleToggleActive(u)}
                              >
                                {u.is_active ? 'Suspend' : 'Activate'}
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 2: ROLES & PROFILES MANAGEMENT
          ====================================================================== */}
      {activeTab === 'roles' && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
            <div>
              <h5 className="fw-bold mb-0 text-slate-900">System Roles & Permission Profiles</h5>
              <small className="text-slate-400 text-xs">Define custom roles, assign granular capabilities, or apply pre-built functional templates</small>
            </div>

            {(isSuperAdmin || hasPermission('roles.manage')) && (
              <button
                onClick={openCreateRoleModal}
                className="btn btn-primary btn-sm rounded-pill px-3 py-1.5 text-xs d-flex align-items-center gap-1.5"
              >
                <i className="bi bi-plus-circle"></i> Create Custom Role
              </button>
            )}
          </div>

          {/* Quick Apply Templates Section */}
          <div className="p-3 bg-light rounded-3 mb-4 border">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-bold text-xs text-slate-700 text-uppercase tracking-wider">
                <i className="bi bi-magic me-1.5 text-primary"></i> Optional Functional Profiles (One-Click Setup)
              </span>
              <span className="text-slate-400 text-[11px]">Deploy curated least-privilege permission profiles</span>
            </div>
            <div className="row g-2">
              {Object.entries(templates).map(([key, t]) => (
                <div key={key} className="col-12 col-md-6 col-lg-3">
                  <div className="card border h-100 p-2.5 bg-white shadow-2xs">
                    <div className="fw-bold text-xs text-slate-900 mb-1">{t.name}</div>
                    <p className="text-slate-500 text-[11px] mb-2 line-clamp-2" style={{ minHeight: '32px' }}>
                      {t.description}
                    </p>
                    <div className="mt-auto d-flex align-items-center justify-content-between">
                      <span className="badge bg-secondary bg-opacity-10 text-secondary" style={{ fontSize: '0.62rem' }}>
                        {t.permissions.length} perms
                      </span>
                      {(isSuperAdmin || hasPermission('roles.manage')) && (
                        <button
                          onClick={() => handleApplyTemplate(key)}
                          className="btn btn-outline-primary btn-xs py-1 px-2 rounded-pill text-[11px]"
                        >
                          Deploy Profile
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Roles Table */}
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light text-uppercase text-[11px] text-slate-500">
                <tr>
                  <th>Role Name & Code</th>
                  <th>Role Type</th>
                  <th>Permissions Assigned</th>
                  <th>Assigned Users</th>
                  <th className="text-end">Manage</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {roles.map((r) => {
                  const permCodes = r.permission_codes || [];
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="fw-bold text-slate-900">{r.name}</div>
                        <div className="font-monospace text-[11px] text-slate-400">{r.code}</div>
                        {r.description && (
                          <small className="text-slate-500 text-[11px] d-block mt-0.5">{r.description}</small>
                        )}
                      </td>

                      <td>
                        {r.is_system_role ? (
                          <span className="badge bg-dark bg-opacity-10 text-dark border">
                            <i className="bi bi-lock-fill me-1"></i> Core System Role
                          </span>
                        ) : (
                          <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25">
                            <i className="bi bi-gear-fill me-1"></i> Custom Role
                          </span>
                        )}
                      </td>

                      <td>
                        {r.code === 'super_admin' ? (
                          <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">
                            All ({permissionsList.length}) Permissions
                          </span>
                        ) : permCodes.length > 0 ? (
                          <div className="d-flex flex-wrap gap-1" style={{ maxWidth: '320px' }}>
                            {permCodes.slice(0, 4).map((c) => (
                              <span key={c} className="badge bg-light text-slate-700 border text-[10px]">
                                {c}
                              </span>
                            ))}
                            {permCodes.length > 4 && (
                              <span className="badge bg-light text-slate-500 border text-[10px]">
                                +{permCodes.length - 4} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">No permissions assigned (Least Privilege)</span>
                        )}
                      </td>

                      <td>
                        <span className="badge bg-light text-slate-700 border">
                          <i className="bi bi-person me-1"></i> {r.user_count} user{r.user_count === 1 ? '' : 's'}
                        </span>
                      </td>

                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1.5">
                          {(isSuperAdmin || hasPermission('roles.manage')) && (
                            <button
                              onClick={() => openEditRoleModal(r)}
                              className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1 text-xs"
                              title="Edit Role Permissions"
                            >
                              <i className="bi bi-pencil me-1"></i> Edit
                            </button>
                          )}

                          {!r.is_system_role && (isSuperAdmin || hasPermission('roles.manage')) && (
                            <button
                              onClick={() => handleDeleteRole(r)}
                              className="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-1 text-xs"
                              title="Delete Role"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 3: GRANULAR PERMISSIONS MATRIX
          ====================================================================== */}
      {activeTab === 'permissions' && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="mb-4">
            <h5 className="fw-bold mb-1 text-slate-900">Granular Permission Specifications</h5>
            <p className="text-slate-400 text-xs mb-0">Complete list of server-enforced permissions governing catalog, orders, payments, promotions, and platform governance</p>
          </div>

          <div className="row g-4">
            {Object.entries(permissionsGrouped).map(([moduleName, perms]) => (
              <div key={moduleName} className="col-12 col-lg-6">
                <div className="border rounded-3 p-3 h-100 bg-light">
                  <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                    <span className="fw-bold text-slate-900 text-xs text-uppercase tracking-wider">
                      <i className="bi bi-folder-fill text-warning me-1.5"></i> {moduleName} Module
                    </span>
                    <span className="badge bg-secondary bg-opacity-25 text-dark" style={{ fontSize: '0.62rem' }}>
                      {perms.length} Capabilities
                    </span>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    {perms.map((p) => (
                      <div key={p.code} className="p-2 bg-white rounded-2 border">
                        <div className="d-flex align-items-center justify-content-between mb-0.5">
                          <span className="fw-bold text-xs text-slate-800">{p.name}</span>
                          <code className="text-danger bg-danger bg-opacity-10 px-1.5 py-0.5 rounded text-[11px]">
                            {p.code}
                          </code>
                        </div>
                        <p className="text-slate-500 text-[11px] mb-0">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 4: AUDIT TRAIL
          ====================================================================== */}
      {activeTab === 'audits' && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="mb-3">
            <h5 className="fw-bold mb-1 text-slate-900">Security & Operational Audit Trail</h5>
            <p className="text-slate-400 text-xs mb-0">Chronological immutable ledger of role assignments, logins, permission updates, and administrative security events</p>
          </div>

          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light text-uppercase text-[11px] text-slate-500">
                <tr>
                  <th>Timestamp</th>
                  <th>Action Event</th>
                  <th>Actor</th>
                  <th>Client IP</th>
                  <th>Event Details</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-nowrap text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge bg-slate-100 text-slate-800 border font-monospace">
                        {log.action}
                      </span>
                    </td>
                    <td className="fw-semibold text-slate-900">
                      {log.username || 'System Agent'}
                    </td>
                    <td className="font-monospace text-slate-500 text-[11px]">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="text-slate-600 text-xs">
                      {log.details || 'N/A'}
                    </td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center text-slate-400 py-4">No audit records logged yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 5: SYSTEM ANALYTICS
          ====================================================================== */}
      {activeTab === 'analytics' && systemAnalytics && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="mb-4">
            <h5 className="fw-bold mb-1 text-slate-900">System Infrastructure & Role Distribution</h5>
            <p className="text-slate-400 text-xs mb-0">Platform health indicators, user identity distributions, and infrastructure telemetry</p>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <div className="border rounded-3 p-3 bg-light">
                <span className="text-slate-400 text-xs">Super Administrators</span>
                <h4 className="fw-bold text-danger mb-0 mt-1">{systemAnalytics.users?.by_role?.super_admin || 0}</h4>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="border rounded-3 p-3 bg-light">
                <span className="text-slate-400 text-xs">Administrators</span>
                <h4 className="fw-bold text-slate-900 mb-0 mt-1">{systemAnalytics.users?.by_role?.admin || 0}</h4>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="border rounded-3 p-3 bg-light">
                <span className="text-slate-400 text-xs">Sub-Administrators</span>
                <h4 className="fw-bold text-warning mb-0 mt-1">{systemAnalytics.users?.by_role?.sub_admin || 0}</h4>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="border rounded-3 p-3 bg-light">
                <span className="text-slate-400 text-xs">Registered Customers</span>
                <h4 className="fw-bold text-primary mb-0 mt-1">{systemAnalytics.users?.by_role?.customer || 0}</h4>
              </div>
            </div>
          </div>

          <div className="p-3 bg-light rounded-3 border">
            <div className="fw-bold text-xs text-slate-700 mb-2">Platform Stack Specifications</div>
            <div className="row g-2 text-xs">
              <div className="col-6 col-md-3"><strong>Framework:</strong> {systemAnalytics.security?.system_version}</div>
              <div className="col-6 col-md-3"><strong>Runtime:</strong> Python {systemAnalytics.security?.python_version}</div>
              <div className="col-6 col-md-3"><strong>Database:</strong> {systemAnalytics.security?.database_engine}</div>
              <div className="col-6 col-md-3"><strong>Audit Records:</strong> {systemAnalytics.security?.audit_logs_recorded}</div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 6: PLATFORM CONFIGURATION
          ====================================================================== */}
      {activeTab === 'config' && platformConfig && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="mb-4">
            <h5 className="fw-bold mb-1 text-slate-900">Platform Settings & Payment Gateways</h5>
            <p className="text-slate-400 text-xs mb-0">Protected settings managed by Super Admin or staff with settings.manage permission</p>
          </div>

          <div className="row g-4">
            <div className="col-12 col-lg-6">
              <h6 className="fw-bold text-xs text-slate-800 text-uppercase mb-2">Supported Payment Channels</h6>
              <div className="list-group">
                {platformConfig.payment_channels?.map((c) => (
                  <div key={c.id} className="list-group-item d-flex align-items-center justify-content-between p-3">
                    <div>
                      <div className="fw-bold text-xs">{c.name}</div>
                      {c.account && <small className="text-slate-500 font-monospace">Acc: {c.account}</small>}
                    </div>
                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">Active</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <h6 className="fw-bold text-xs text-slate-800 text-uppercase mb-2">Delivery Channels & Tariffs</h6>
              <div className="list-group">
                {platformConfig.delivery_options?.map((d) => (
                  <div key={d.id} className="list-group-item d-flex align-items-center justify-content-between p-3">
                    <div>
                      <div className="fw-bold text-xs">{d.name}</div>
                      <small className="text-slate-500">{d.days}</small>
                    </div>
                    <span className="fw-bold text-xs text-primary">{formatETB(d.cost)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODAL 1: CREATE / EDIT ROLE MODAL
          ====================================================================== */}
      {showRoleModal && (
        <div className="modal fade show d-block bg-black bg-opacity-50" tabIndex="-1">
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-slate-900 fs-6">
                  {editingRole ? `Edit Role: ${editingRole.name}` : 'Create Custom Role'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowRoleModal(false)}></button>
              </div>

              <form onSubmit={handleSaveRole}>
                <div className="modal-body p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-xs fw-bold">Role Display Name *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. Catalog Specialist"
                        required
                        value={roleFormData.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRoleFormData({
                            ...roleFormData,
                            name: val,
                            code: editingRole ? roleFormData.code : val.toLowerCase().replace(/[^a-z0-9]+/g, '_')
                          });
                        }}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-xs fw-bold">Role Code Identifier *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-monospace"
                        placeholder="e.g. catalog_specialist"
                        required
                        disabled={Boolean(editingRole && editingRole.is_system_role)}
                        value={roleFormData.code}
                        onChange={(e) => setRoleFormData({ ...roleFormData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                      />
                      {editingRole && editingRole.is_system_role && (
                        <small className="text-muted text-[10px]">System role codes are protected and cannot be altered.</small>
                      )}
                    </div>
                    <div className="col-12">
                      <label className="form-label text-xs fw-bold">Role Description</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows="2"
                        placeholder="Brief summary of duties and responsibilities..."
                        value={roleFormData.description}
                        onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                      ></textarea>
                    </div>
                  </div>

                  {/* Permissions Selection Matrix */}
                  <div className="mt-4">
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <div>
                        <div className="fw-bold text-xs text-slate-900">Granular Permission Matrix</div>
                        <small className="text-slate-400 text-[11px]">Select capabilities granted to this role</small>
                      </div>
                      <span className="badge bg-primary text-white">
                        {roleFormData.permission_codes.length} Selected
                      </span>
                    </div>

                    <div className="d-flex flex-column gap-3">
                      {Object.entries(permissionsGrouped).map(([mod, perms]) => {
                        const moduleCodes = perms.map(p => p.code);
                        const hasAll = moduleCodes.every(c => roleFormData.permission_codes.includes(c));
                        return (
                          <div key={mod} className="p-3 bg-light rounded-3 border">
                            <div className="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom">
                              <span className="fw-bold text-xs text-slate-800 text-uppercase tracking-wider">
                                {mod} Module
                              </span>
                              <button
                                type="button"
                                className="btn btn-link btn-xs p-0 text-decoration-none text-primary"
                                onClick={() => toggleAllModulePermissions(
                                  perms,
                                  roleFormData.permission_codes,
                                  (newCodes) => setRoleFormData({ ...roleFormData, permission_codes: newCodes })
                                )}
                              >
                                {hasAll ? 'Deselect Module' : 'Select All in Module'}
                              </button>
                            </div>

                            <div className="row g-2">
                              {perms.map((p) => {
                                const isChecked = roleFormData.permission_codes.includes(p.code);
                                return (
                                  <div key={p.code} className="col-12 col-md-6">
                                    <div
                                      onClick={() => togglePermissionCode(
                                        p.code,
                                        roleFormData.permission_codes,
                                        (newCodes) => setRoleFormData({ ...roleFormData, permission_codes: newCodes })
                                      )}
                                      className={`p-2 rounded-2 border cursor-pointer transition ${
                                        isChecked ? 'bg-primary bg-opacity-10 border-primary' : 'bg-white'
                                      }`}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <div className="form-check form-check-inline mb-0 pointer-events-none">
                                        <input
                                          type="checkbox"
                                          className="form-check-input"
                                          checked={isChecked}
                                          onChange={() => {}}
                                        />
                                        <label className="form-check-label fw-semibold text-xs ms-1 text-slate-900">
                                          {p.name}
                                        </label>
                                      </div>
                                      <p className="text-slate-500 text-[10px] mb-0 ps-4">{p.description}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => setShowRoleModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary rounded-pill px-4">
                    Save Role Configuration
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODAL 2: ASSIGN USER ROLE & DIRECT PERMISSIONS MODAL
          ====================================================================== */}
      {showAssignModal && assigningUser && (
        <div className="modal fade show d-block bg-black bg-opacity-50" tabIndex="-1">
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom">
                <div>
                  <h5 className="modal-title fw-bold text-slate-900 fs-6">
                    Assign Role & Permissions: {cleanDisplayName(assigningUser)}
                  </h5>
                  <small className="text-slate-400 text-xs">Username: @{assigningUser.username} | Email: {assigningUser.email}</small>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowAssignModal(false)}></button>
              </div>

              <form onSubmit={handleSaveUserAssignment}>
                <div className="modal-body p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  {/* Select System Role */}
                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold">Primary Role Assignment *</label>
                    <select
                      className="form-select form-select-sm"
                      value={assignFormData.role}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        const roleObj = roles.find(r => r.code === newRole);
                        setAssignFormData({
                          ...assignFormData,
                          role: newRole,
                          custom_role_id: newRole === 'custom' ? assignFormData.custom_role_id : '',
                          direct_permission_codes: roleObj?.permission_codes || assignFormData.direct_permission_codes
                        });
                      }}
                    >
                      <option value="super_admin">Super Admin (Unrestricted Full Access)</option>
                      <option value="admin">Administrator</option>
                      <option value="sub_admin">Sub-Admin (Explicit Least-Privilege)</option>
                      <option value="store_manager">Store Manager</option>
                      <option value="order_manager">Order Manager (Fulfillment & Dispatch)</option>
                      <option value="custom">Custom Role Profile</option>
                      <option value="customer">Customer (Storefront Personal Account)</option>
                    </select>
                  </div>

                  {/* Select Custom Role if custom chosen */}
                  {assignFormData.role === 'custom' && (
                    <div className="mb-3 p-3 bg-light rounded-3 border">
                      <label className="form-label text-xs fw-bold">Select Custom Role Profile</label>
                      <select
                        className="form-select form-select-sm"
                        value={assignFormData.custom_role_id}
                        onChange={(e) => {
                          const cId = e.target.value;
                          const cRole = roles.find(r => String(r.id) === String(cId));
                          setAssignFormData({
                            ...assignFormData,
                            custom_role_id: cId,
                            direct_permission_codes: cRole?.permission_codes || []
                          });
                        }}
                      >
                        <option value="">-- Choose Custom Role --</option>
                        {roles.filter(r => !r.is_system_role).map(r => (
                          <option key={r.id} value={r.id}>{r.name} ({r.permissions.length} perms)</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Sub-Admin or Custom Permission Overrides */}
                  <div className="mt-4">
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <div>
                        <div className="fw-bold text-xs text-slate-900">Direct Granular Permissions</div>
                        <small className="text-slate-400 text-[11px]">Explicit authorization checklist for this account</small>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {assignFormData.role !== 'super_admin' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-xs btn-outline-primary py-0 px-2 rounded-pill"
                              style={{ fontSize: '11px' }}
                              onClick={() => {
                                const allCodes = permissionsList.map(p => p.code);
                                setAssignFormData({ ...assignFormData, direct_permission_codes: allCodes });
                              }}
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-outline-secondary py-0 px-2 rounded-pill"
                              style={{ fontSize: '11px' }}
                              onClick={() => setAssignFormData({ ...assignFormData, direct_permission_codes: [] })}
                            >
                              Clear
                            </button>
                          </>
                        )}
                        <span className="badge bg-primary text-white">
                          {assignFormData.direct_permission_codes.length} Granted
                        </span>
                      </div>
                    </div>

                    {assignFormData.role === 'super_admin' ? (
                      <div className="p-3 bg-danger bg-opacity-10 text-danger rounded-3 text-xs">
                        <i className="bi bi-info-circle-fill me-1"></i> Super Administrators hold full unrestricted access to all modules unconditionally. Individual permission checkboxes do not apply.
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-3">
                        {Object.entries(permissionsGrouped).map(([mod, perms]) => (
                          <div key={mod} className="p-3 bg-light rounded-3 border">
                            <div className="fw-bold text-xs text-slate-800 text-uppercase mb-2 pb-1 border-bottom">
                              {mod} Module
                            </div>
                            <div className="row g-2">
                              {perms.map((p) => {
                                const isChecked = assignFormData.direct_permission_codes.includes(p.code);
                                return (
                                  <div key={p.code} className="col-12 col-md-6">
                                    <div
                                      onClick={() => togglePermissionCode(
                                        p.code,
                                        assignFormData.direct_permission_codes,
                                        (newCodes) => setAssignFormData({ ...assignFormData, direct_permission_codes: newCodes })
                                      )}
                                      className={`p-2 rounded-2 border cursor-pointer transition ${
                                        isChecked ? 'bg-primary bg-opacity-10 border-primary' : 'bg-white'
                                      }`}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <div className="form-check form-check-inline mb-0 pointer-events-none">
                                        <input
                                          type="checkbox"
                                          className="form-check-input"
                                          checked={isChecked}
                                          onChange={() => {}}
                                        />
                                        <label className="form-check-label fw-semibold text-xs ms-1 text-slate-900">
                                          {p.name}
                                        </label>
                                      </div>
                                      <p className="text-slate-500 text-[10px] mb-0 ps-4">{p.description}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => setShowAssignModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary rounded-pill px-4">
                    Save User Role & Permissions
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODAL 3: CREATE NEW STAFF ACCOUNT
          ====================================================================== */}
      {showCreateUserModal && (
        <div className="modal fade show d-block bg-black bg-opacity-50" tabIndex="-1">
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-slate-900 fs-6">
                  Add Administrator / Staff Account
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateUserModal(false)}></button>
              </div>

              <form onSubmit={handleCreateNewUser}>
                <div className="modal-body p-4">
                  <div className="mb-2.5">
                    <label className="form-label text-xs fw-bold">Username *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. adama_officer"
                      required
                      value={newUserFormData.username}
                      onChange={(e) => setNewUserFormData({ ...newUserFormData, username: e.target.value })}
                    />
                  </div>

                  <div className="mb-2.5">
                    <label className="form-label text-xs fw-bold">Email Address *</label>
                    <input
                      type="email"
                      className="form-control form-control-sm"
                      placeholder="officer@ethio.com"
                      required
                      value={newUserFormData.email}
                      onChange={(e) => setNewUserFormData({ ...newUserFormData, email: e.target.value })}
                    />
                  </div>

                  <div className="mb-2.5">
                    <label className="form-label text-xs fw-bold">Initial Password *</label>
                    <input
                      type="password"
                      className="form-control form-control-sm"
                      placeholder="Minimum 6 characters"
                      required
                      minLength="6"
                      value={newUserFormData.password}
                      onChange={(e) => setNewUserFormData({ ...newUserFormData, password: e.target.value })}
                    />
                  </div>

                  <div className="row g-2 mb-2.5">
                    <div className="col-6">
                      <label className="form-label text-xs fw-bold">First Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="First name"
                        value={newUserFormData.first_name}
                        onChange={(e) => setNewUserFormData({ ...newUserFormData, first_name: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-xs fw-bold">Last Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Last name"
                        value={newUserFormData.last_name}
                        onChange={(e) => setNewUserFormData({ ...newUserFormData, last_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold">Initial Role *</label>
                    <select
                      className="form-select form-select-sm"
                      value={newUserFormData.role}
                      onChange={(e) => setNewUserFormData({ ...newUserFormData, role: e.target.value })}
                    >
                      {isSuperAdmin && (
                        <option value="super_admin">Super Admin</option>
                      )}
                      <option value="admin">Administrator</option>
                      <option value="sub_admin">Sub-Admin (Least Privilege)</option>
                      <option value="store_manager">Store Manager</option>
                      <option value="order_manager">Order Manager (Fulfillment & Dispatch)</option>
                      {roles.filter(r => !r.is_system_role).map(r => (
                        <option key={r.code} value={r.code}>{r.name} (Custom)</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => setShowCreateUserModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-dark rounded-pill px-4">
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
