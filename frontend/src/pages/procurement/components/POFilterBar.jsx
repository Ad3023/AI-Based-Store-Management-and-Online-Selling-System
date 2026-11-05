import React from 'react';

const STATUS_TABS = [
  { key: 'ALL', label: 'All Orders' },
  { key: 'PENDING_APPROVAL', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'SENT_TO_SUPPLIER', label: 'Sent' },
  { key: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
  { key: 'RECEIVED', label: 'Received' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'REJECTED', label: 'Rejected' },
];

export const POFilterBar = ({ search, onSearchChange, statusFilter, onStatusFilterChange, pendingCount }) => {
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
              placeholder="Search PO #, supplier..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
        <div className="col-12 col-md-7 col-lg-8">
          <div className="d-flex flex-wrap gap-1 justify-content-md-end">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`btn btn-sm rounded-pill px-3 text-xs ${
                  statusFilter === tab.key ? 'btn-primary font-bold' : 'btn-outline-secondary'
                }`}
                onClick={() => onStatusFilterChange(tab.key)}
              >
                {tab.key === 'PENDING_APPROVAL' ? `Pending (${pendingCount})` : tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default POFilterBar;

