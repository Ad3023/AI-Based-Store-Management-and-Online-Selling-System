import React from 'react';
import { NavLink, Link } from 'react-router-dom';

const SupplierSidebar = ({ mobileDrawerOpen, setMobileDrawerOpen, supplierName, user, handleSignOut }) => {
  return (
    <>
      {mobileDrawerOpen && (
        <div
          className="ethio-drawer-backdrop z-3 d-lg-none"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`ethio-sidebar ${mobileDrawerOpen ? 'open' : ''}`}
        aria-label="Supplier Portal Navigation"
      >
        <div className="p-3 border-bottom border-white border-opacity-10 d-flex align-items-center justify-content-between">
          <Link to="/supplier/dashboard" className="d-flex align-items-center gap-2 text-decoration-none text-white">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center text-white shadow-sm"
              style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)' }}
            >
              <i className="bi bi-truck fs-5"></i>
            </div>
            <div>
              <div className="fw-bolder text-white lh-1 text-sm">EthioTech <span className="text-teal-400">Market</span></div>
              <span
                className="badge mt-1 text-uppercase text-dark font-monospace"
                style={{ fontSize: '0.62rem', letterSpacing: '0.5px', backgroundColor: '#5eead4' }}
              >
                Supplier Portal
              </span>
            </div>
          </Link>
          <button
            type="button"
            className="btn btn-sm btn-link text-white-50 d-lg-none p-0 text-decoration-none"
            onClick={() => setMobileDrawerOpen(false)}
            aria-label="Close menu"
          >
            <i className="bi bi-x-lg fs-5"></i>
          </button>
        </div>

        <div className="p-3 mx-3 my-3 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div className="d-flex align-items-center gap-2.5">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shrink-0"
              style={{ width: '38px', height: '38px', backgroundColor: '#0d9488' }}
            >
              {supplierName.charAt(0).toUpperCase()}
            </div>
            <div className="text-truncate min-w-0">
              <div className="text-white fw-bold small text-truncate" title={supplierName}>
                {supplierName}
              </div>
              <div className="text-white-50 text-xs text-truncate">
                {user?.email}
              </div>
              <span className="badge bg-teal-500 bg-opacity-25 text-teal-300 border border-teal-500 border-opacity-30 mt-1" style={{ fontSize: '0.62rem' }}>
                <i className="bi bi-patch-check-fill me-1"></i>Verified Supplier
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-grow-1 overflow-y-auto px-2 py-1" style={{ scrollbarWidth: 'thin' }}>
          <div className="px-3 text-uppercase fw-bold text-white-50 mb-2" style={{ fontSize: '0.65rem', letterSpacing: '0.6px' }}>
            Supplier Management
          </div>

          <NavLink
            to="/supplier/dashboard"
            end
            className={({ isActive }) =>
              `d-flex align-items-center gap-2.5 px-3 py-2 rounded-3 text-decoration-none text-xs fw-medium mb-1 transition-colors ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-white-50 hover-bg-white-10 hover-text-white'
              }`
            }
          >
            <i className="bi bi-grid-1x2-fill fs-6"></i>
            <span>Dashboard Overview</span>
          </NavLink>

          <NavLink
            to="/supplier/purchase-orders"
            className={({ isActive }) =>
              `d-flex align-items-center gap-2.5 px-3 py-2 rounded-3 text-decoration-none text-xs fw-medium mb-1 transition-colors ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-white-50 hover-bg-white-10 hover-text-white'
              }`
            }
          >
            <i className="bi bi-clipboard-check-fill fs-6"></i>
            <span className="flex-grow-1">Purchase Orders</span>
          </NavLink>

          <NavLink
            to="/supplier/invoices"
            className={({ isActive }) =>
              `d-flex align-items-center gap-2.5 px-3 py-2 rounded-3 text-decoration-none text-xs fw-medium mb-1 transition-colors ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-white-50 hover-bg-white-10 hover-text-white'
              }`
            }
          >
            <i className="bi bi-receipt-cutoff fs-6"></i>
            <span>Invoices & Billing</span>
          </NavLink>

          <NavLink
            to="/supplier/payments"
            className={({ isActive }) =>
              `d-flex align-items-center gap-2.5 px-3 py-2 rounded-3 text-decoration-none text-xs fw-medium mb-1 transition-colors ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-white-50 hover-bg-white-10 hover-text-white'
              }`
            }
          >
            <i className="bi bi-cash-coin fs-6"></i>
            <span>Payment History</span>
          </NavLink>
        </nav>

        <div className="p-3 border-top border-white border-opacity-10 d-flex flex-column gap-2">
          <Link
            to="/"
            className="btn btn-sm btn-outline-light d-flex align-items-center justify-content-center gap-2 rounded-pill text-xs w-100"
          >
            <i className="bi bi-shop"></i>
            <span>Storefront</span>
          </Link>
          <button
            type="button"
            className="btn btn-sm btn-danger bg-opacity-25 text-danger-subtle border-0 d-flex align-items-center justify-content-center gap-2 rounded-pill text-xs w-100 py-1.5"
            onClick={handleSignOut}
          >
            <i className="bi bi-box-arrow-right"></i>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default SupplierSidebar;

