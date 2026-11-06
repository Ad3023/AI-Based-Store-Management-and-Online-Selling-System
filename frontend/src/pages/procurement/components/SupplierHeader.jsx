import React from 'react';
import { Link } from 'react-router-dom';

const SupplierHeader = ({ activeTab, onTabChange, isAdmin, onOpenCreate }) => {
  return (
    <div className="d-flex flex-column mb-4 gap-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-info border-opacity-25 bg-info bg-opacity-10">
            <i className="bi bi-truck text-info"></i>
            <span className="small fw-bold text-cyan-800">Supplier Management Console</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Supplier Management</h2>
          <p className="text-slate-500 text-xs mb-0">
            Maintain verified hardware suppliers, portal login credentials, and procurement audit histories.
          </p>
        </div>
        <div className="d-flex gap-2">
          {!isAdmin && (
            <Link
              to="/manager/procurement/purchase-orders/create"
              className="btn btn-outline-primary rounded-pill px-3 py-2 font-bold text-xs d-flex align-items-center gap-2 shadow-sm"
            >
              <i className="bi bi-cart-plus"></i>
              <span>Create Purchase Order</span>
            </Link>
          )}
          {isAdmin && (
            <button
              type="button"
              className="btn btn-ethio-primary rounded-pill px-4 py-2 font-bold text-xs d-flex align-items-center gap-2 shadow-sm"
              style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
              onClick={onOpenCreate}
            >
              <i className="bi bi-plus-lg"></i>
              <span>Register New Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="d-flex gap-2 border-bottom border-slate-200 pb-2 overflow-x-auto text-xs">
        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-flex align-items-center gap-2 transition ${
            activeTab === 'directory'
              ? 'btn-primary text-white shadow-sm font-bold'
              : 'btn-light text-slate-700 hover:bg-slate-200'
          }`}
          onClick={() => onTabChange('directory')}
        >
          <i className="bi bi-building"></i>
          <span>Supplier Directory</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-flex align-items-center gap-2 transition ${
            activeTab === 'accounts'
              ? 'btn-primary text-white shadow-sm font-bold'
              : 'btn-light text-slate-700 hover:bg-slate-200'
          }`}
          onClick={() => onTabChange('accounts')}
        >
          <i className="bi bi-shield-lock"></i>
          <span>Supplier Portal Accounts</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-flex align-items-center gap-2 transition ${
            activeTab === 'history'
              ? 'btn-primary text-white shadow-sm font-bold'
              : 'btn-light text-slate-700 hover:bg-slate-200'
          }`}
          onClick={() => onTabChange('history')}
        >
          <i className="bi bi-clock-history"></i>
          <span>Supplier Activity History</span>
        </button>
      </div>
    </div>
  );
};

export default SupplierHeader;
