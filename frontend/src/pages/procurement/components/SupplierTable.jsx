import React from 'react';
import { formatETB } from '../../../utils/currency';

const SupplierTable = ({
  loading,
  suppliers,
  search,
  statusFilter,
  onOpenCreate,
  onOpenEdit,
  onOpenHistory,
  onOpenPortalAccount,
  onUpdateStatus,
  onDeleteSupplier,
  isAdmin,
  isSuperAdmin,
}) => {
  if (loading) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Loading suppliers...</p>
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white text-center py-5 text-muted">
        <i className="bi bi-truck-flatbed fs-1 text-slate-300 mb-2 d-block"></i>
        <h6 className="fw-bold text-slate-700">No Suppliers Found</h6>
        <p className="text-slate-500 text-xs mb-3">
          {search || statusFilter !== 'ALL'
            ? 'No suppliers match the active search filters.'
            : 'No suppliers registered yet.'}
        </p>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs"
          onClick={onOpenCreate}
        >
          <i className="bi bi-plus-lg me-1"></i> Register Supplier
        </button>
      </div>
    );
  }

  return (
    <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 text-xs">
          <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
            <tr>
              <th className="ps-4">Supplier Organization</th>
              <th>Contact Details</th>
              <th>Location</th>
              <th>Total Purchases</th>
              <th>Outstanding Balance</th>
              <th>Status</th>
              <th className="text-end pe-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => {
              const currentStatus = s.status || (s.is_active ? 'ACTIVE' : 'SUSPENDED');
              return (
                <tr key={s.id}>
                  <td className="ps-4">
                    <div
                      className="fw-bold text-slate-900 cursor-pointer text-primary hover:underline"
                      onClick={() => onOpenHistory(s.id)}
                    >
                      {s.name}
                    </div>
                    {s.contact_person && (
                      <small className="text-slate-500 d-block">Attn: {s.contact_person}</small>
                    )}
                  </td>
                  <td>
                    <div>
                      {s.email ? (
                        <a href={`mailto:${s.email}`} className="text-decoration-none text-primary d-block">
                          {s.email}
                        </a>
                      ) : null}
                      <small className="text-slate-500">{s.phone || '—'}</small>
                      {s.has_account && (
                        <div className="mt-0.5">
                          <span className="badge bg-teal-50 text-teal-700 border border-teal-200 text-[10px] px-1.5 py-0.5">
                            <i className="bi bi-shield-check me-1"></i>Portal Active
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="text-slate-600">{s.address || <span className="text-slate-400">—</span>}</td>
                  <td className="fw-semibold text-slate-800">
                    {formatETB(s.total_purchases_amount || 0)}
                  </td>
                  <td>
                    <span className={`fw-bold ${Number(s.outstanding_balance || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                      {formatETB(s.outstanding_balance || 0)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge rounded-pill ${
                      currentStatus === 'ACTIVE'
                        ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25'
                        : currentStatus === 'PENDING_APPROVAL'
                        ? 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25'
                        : 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25'
                    }`}>
                      {currentStatus}
                    </span>
                  </td>
                  <td className="text-end pe-4">
                    <div className="btn-group btn-group-sm">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm p-1 px-2"
                        title="View Full History & Financials"
                        onClick={() => onOpenHistory(s.id)}
                      >
                        <i className="bi bi-clock-history me-1"></i>History
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm p-1 px-2"
                        title="Edit Supplier"
                        onClick={() => onOpenEdit(s)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      {(isAdmin || isSuperAdmin) && (
                        <>
                          {currentStatus !== 'ACTIVE' ? (
                            <button
                              type="button"
                              className="btn btn-outline-success btn-sm p-1 px-2"
                              title="Activate Supplier"
                              onClick={() => onUpdateStatus(s.id, 'ACTIVE')}
                            >
                              <i className="bi bi-check-circle"></i>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline-warning btn-sm p-1 px-2"
                              title="Suspend Supplier"
                              onClick={() => onUpdateStatus(s.id, 'SUSPENDED')}
                            >
                              <i className="bi bi-pause-circle"></i>
                            </button>
                          )}
                          {!s.has_account && (
                            <button
                              type="button"
                              className="btn btn-outline-teal btn-sm p-1 px-2 text-teal-700"
                              style={{ borderColor: '#0d9488', color: '#0d9488' }}
                              title="Provision Supplier Portal Login"
                              onClick={() => onOpenPortalAccount(s)}
                            >
                              <i className="bi bi-person-plus me-1"></i>Login
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm p-1 px-2"
                            title="Delete Supplier"
                            onClick={() => onDeleteSupplier(s.id, s.name)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </>
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
  );
};

export default SupplierTable;
