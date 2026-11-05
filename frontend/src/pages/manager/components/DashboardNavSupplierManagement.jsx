import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const DashboardNavSupplierManagement = ({ onNavClick }) => {
  const location = useLocation();

  const isDirectoryActive =
    location.pathname === '/admin/suppliers' &&
    (!location.search || location.search.includes('tab=directory'));

  const isRegisterActive =
    location.pathname === '/admin/suppliers' &&
    location.search.includes('action=add');

  const isAccountsActive =
    location.pathname === '/admin/suppliers' &&
    location.search.includes('tab=accounts');

  const isHistoryActive =
    location.pathname === '/admin/suppliers' &&
    location.search.includes('tab=history');

  return (
    <>
      {/* 1. SUPPLIER MANAGEMENT */}
      <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
        Supplier Management
      </div>

      <NavLink
        to="/admin/suppliers"
        end
        className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isDirectoryActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-truck text-emerald-400"></i>
        <span>Supplier Directory</span>
      </NavLink>

      <NavLink
        to="/admin/suppliers?action=add"
        className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isRegisterActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-person-plus text-info"></i>
        <span>Register New Supplier</span>
      </NavLink>

      <NavLink
        to="/admin/suppliers?tab=accounts"
        className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isAccountsActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-shield-lock text-cyan-300"></i>
        <span>Supplier Portal Accounts</span>
      </NavLink>

      <NavLink
        to="/admin/suppliers?tab=history"
        className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isHistoryActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-clock-history text-warning"></i>
        <span>Supplier Activity History</span>
      </NavLink>

      {/* 2. SUPPLIER PROCUREMENT & PAYMENTS */}
      <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
        Supplier Procurement &amp; Payments
      </div>

      <NavLink
        to="/admin/procurement/approvals"
        className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-check2-square text-warning"></i> Purchase Order Approvals
      </NavLink>

      <NavLink
        to="/admin/procurement/invoices"
        className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-receipt text-info"></i> Supplier Invoices
      </NavLink>

      <NavLink
        to="/admin/procurement/payments"
        className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive && location.pathname.endsWith('/payments') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-cash-stack text-success"></i> Supplier Payments
      </NavLink>

      <NavLink
        to="/admin/procurement/payment-history"
        className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-clock-history text-cyan-300"></i> Supplier Payment History
      </NavLink>

      <NavLink
        to="/admin/procurement/reports"
        className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-graph-up-arrow text-emerald-400"></i> Procurement Reports
      </NavLink>
    </>
  );
};

export default DashboardNavSupplierManagement;

