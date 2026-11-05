import React from 'react';

const SupplierFilterBar = ({ search, setSearch, statusFilter, setStatusFilter, totalCount }) => {
  return (
    <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
      <div className="row g-2 align-items-center">
        <div className="col-12 col-md-5 col-lg-4">
          <div className="input-group">
            <span className="input-group-text bg-slate-50 border-slate-200 text-slate-400">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control text-sm"
              placeholder="Search suppliers by name, contact or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="col-12 col-md-4 col-lg-3">
          <select
            className="form-select text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active / Approved</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
        <div className="col-auto ms-auto text-xs text-slate-500">
          Total Registered: <strong className="text-slate-900">{totalCount}</strong>
        </div>
      </div>
    </div>
  );
};

export default SupplierFilterBar;

