import React, { useState } from 'react';

const SupplierPortalAccountsTable = ({
  suppliers,
  loading,
  onOpenPortalAccount,
  onToggleStatus,
  isAdmin,
}) => {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL', 'WITH_ACCOUNT', 'NO_ACCOUNT'

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.name?.toLowerCase().includes(q) ||
      s.contact_person?.toLowerCase().includes(q) ||
      s.user_username?.toLowerCase().includes(q) ||
      s.user_email?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q);

    if (filterMode === 'WITH_ACCOUNT') return matchesSearch && s.has_account;
    if (filterMode === 'NO_ACCOUNT') return matchesSearch && !s.has_account;
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Loading supplier portal accounts...</p>
      </div>
    );
  }

  return (
    <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
      {/* Sub-header Filter Bar */}
      <div className="p-3 border-bottom bg-slate-50 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
        <div className="d-flex align-items-center gap-2">
          <input
            type="text"
            className="form-control text-xs"
            placeholder="Search portal accounts by supplier, username, email..."
            style={{ maxWidth: '340px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="btn-group btn-group-sm">
          <button
            type="button"
            className={`btn btn-xs ${filterMode === 'ALL' ? 'btn-primary font-bold' : 'btn-outline-secondary'}`}
            onClick={() => setFilterMode('ALL')}
          >
            All ({suppliers.length})
          </button>
          <button
            type="button"
            className={`btn btn-xs ${filterMode === 'WITH_ACCOUNT' ? 'btn-primary font-bold' : 'btn-outline-secondary'}`}
            onClick={() => setFilterMode('WITH_ACCOUNT')}
          >
            Active Accounts ({suppliers.filter((s) => s.has_account).length})
          </button>
          <button
            type="button"
            className={`btn btn-xs ${filterMode === 'NO_ACCOUNT' ? 'btn-primary font-bold' : 'btn-outline-secondary'}`}
            onClick={() => setFilterMode('NO_ACCOUNT')}
          >
            Unlinked ({suppliers.filter((s) => !s.has_account).length})
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 text-xs">
          <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
            <tr>
              <th className="ps-4">Supplier Organization</th>
              <th>Linked Portal User</th>
              <th>Assigned Role</th>
              <th>Account Status</th>
              <th>Last Active / Login</th>
              <th className="text-end pe-4">Account Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-5 text-muted">
                  <i className="bi bi-shield-x fs-2 d-block text-slate-300 mb-2"></i>
                  No supplier portal accounts match the search criteria.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id}>
                  <td className="ps-4">
                    <div className="fw-bold text-slate-900">{s.name}</div>
                    <small className="text-slate-500">{s.contact_person || 'No contact specified'}</small>
                  </td>
                  <td>
                    {s.has_account ? (
                      <div>
                        <div className="fw-semibold text-slate-800 d-flex align-items-center gap-1.5">
                          <i className="bi bi-person-badge text-teal-600"></i>
                          <span>{s.user_username || 'sup_account'}</span>
                        </div>
                        <small className="text-slate-500 text-[11px]">{s.user_email || s.email}</small>
                      </div>
                    ) : (
                      <span className="text-muted fst-italic">No portal login provisioned</span>
                    )}
                  </td>
                  <td>
                    <span className="badge bg-teal-100 text-teal-800 border border-teal-200 text-[10px] font-monospace text-uppercase">
                      SUPPLIER
                    </span>
                  </td>
                  <td>
                    {s.has_account ? (
                      <div>
                        {s.must_change_password ? (
                          <span className="badge bg-warning bg-opacity-25 text-warning-emphasis border border-warning text-[10px]">
                            <i className="bi bi-key-fill me-1"></i>Must Change Password
                          </span>
                        ) : s.user_is_active ? (
                          <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 text-[10px]">
                            <i className="bi bi-check-circle-fill me-1"></i>Active &amp; Verified
                          </span>
                        ) : (
                          <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 text-[10px]">
                            <i className="bi bi-x-circle-fill me-1"></i>Account Suspended
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="badge bg-secondary bg-opacity-15 text-secondary border border-secondary border-opacity-25 text-[10px]">
                        Not Provisioned
                      </span>
                    )}
                  </td>
                  <td>
                    <small className="text-slate-600">
                      {s.user_last_login ? new Date(s.user_last_login).toLocaleString() : 'Never logged in'}
                    </small>
                  </td>
                  <td className="text-end pe-4">
                    <div className="d-flex justify-content-end gap-1.5">
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            className={`btn btn-xs rounded-pill px-2.5 py-1 ${
                              s.has_account ? 'btn-outline-primary' : 'btn-ethio-primary text-white'
                            }`}
                            style={!s.has_account ? { backgroundColor: '#0d9488', borderColor: '#0d9488' } : {}}
                            onClick={() => onOpenPortalAccount(s)}
                            title={s.has_account ? 'Reset or Update Password' : 'Create Supplier Login'}
                          >
                            <i className={`bi ${s.has_account ? 'bi-shield-lock' : 'bi-person-plus'} me-1`}></i>
                            <span>{s.has_account ? 'Reset / Update' : 'Provision Login'}</span>
                          </button>

                          {s.has_account && (
                            <button
                              type="button"
                              className={`btn btn-xs rounded-pill px-2.5 py-1 ${
                                s.user_is_active ? 'btn-outline-danger' : 'btn-outline-success'
                              }`}
                              onClick={() => onToggleStatus(s.id, s.user_is_active ? 'SUSPENDED' : 'ACTIVE')}
                              title={s.user_is_active ? 'Suspend Login Access' : 'Activate Login Access'}
                            >
                              <i className={`bi ${s.user_is_active ? 'bi-lock-fill' : 'bi-unlock-fill'} me-1`}></i>
                              <span>{s.user_is_active ? 'Suspend' : 'Activate'}</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupplierPortalAccountsTable;

