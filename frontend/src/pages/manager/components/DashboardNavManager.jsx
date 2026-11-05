import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const DashboardNavManager = ({ isOrderManager, onNavClick }) => {
  const location = useLocation();

  if (isOrderManager) {
    return (
      <>
        <div className="px-3 text-uppercase fw-bold text-secondary mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
          Fulfillment Management
        </div>
        <NavLink
          to="/order-manager/dashboard"
          end
          className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
          onClick={onNavClick}
        >
          <i className="bi bi-speedometer2 text-amber-400"></i> Order Dashboard
        </NavLink>

        <NavLink
          to="/order-manager/orders"
          className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
          onClick={onNavClick}
        >
          <i className="bi bi-receipt-cutoff text-info"></i> Customer Orders
        </NavLink>

        <NavLink
          to="/order-manager/shipments"
          className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
          onClick={onNavClick}
        >
          <i className="bi bi-truck-front-fill text-warning"></i> Shipments &amp; Logistics
        </NavLink>

        <NavLink
          to="/order-manager/reports"
          className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
          onClick={onNavClick}
        >
          <i className="bi bi-pie-chart-fill text-warning"></i> Order Reports
        </NavLink>
      </>
    );
  }

  return (
    <>
      <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
        Procurement &amp; Suppliers
      </div>

      <NavLink
        to="/manager/procurement/suppliers"
        className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive || location.pathname === '/manager/suppliers' ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-truck text-emerald-400"></i> Manage Suppliers
      </NavLink>

      <NavLink
        to="/manager/procurement/purchase-orders/create"
        className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-cart-plus text-info"></i> Create Purchase Order
      </NavLink>

      <NavLink
        to="/manager/procurement/purchase-orders"
        end
        className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-receipt-cutoff text-warning"></i> Purchase Order History
      </NavLink>

      <NavLink
        to="/manager/procurement/receive"
        className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-box-arrow-in-down text-cyan-300"></i> Receive Products
      </NavLink>

      <NavLink
        to="/manager/procurement/invoices"
        className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-file-earmark-spreadsheet text-amber-400"></i> Supplier Invoices
      </NavLink>

      <NavLink
        to="/manager/procurement/history"
        className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <i className="bi bi-clock-history text-secondary"></i> Procurement History
      </NavLink>
    </>
  );
};

export default DashboardNavManager;

