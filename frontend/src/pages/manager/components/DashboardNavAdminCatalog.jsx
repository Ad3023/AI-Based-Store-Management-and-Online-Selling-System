import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const DashboardNavAdminCatalog = ({
  isAdmin,
  canViewReports,
  canViewCatalog,
  canManageCategories,
  canManageInventory,
  hasPermission,
  onNavClick,
}) => {
  const location = useLocation();

  return (
    <>
      {/* 1. OVERVIEW */}
      {(isAdmin || canViewReports) && (
        <>
          <div className="px-3 text-uppercase fw-bold text-secondary mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
            Overview & Analytics
          </div>
          <NavLink
            to={isAdmin ? "/admin/dashboard" : "/manager/dashboard"}
            end
            className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
            onClick={onNavClick}
          >
            <i className="bi bi-grid-1x2"></i> Dashboard Overview
          </NavLink>
        </>
      )}

      {/* 2. CATALOG & INVENTORY */}
      {(canViewCatalog || canManageCategories || canManageInventory) && (
        <>
          <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
            Catalog & Inventory
          </div>

          {canViewCatalog && (
            <NavLink
              to={isAdmin ? "/admin/products" : "/manager/products"}
              end
              className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive && !location.search ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-laptop"></i> Manage Products
            </NavLink>
          )}

          {hasPermission('products.create') && (
            <NavLink
              to={isAdmin ? "/admin/products?action=add" : "/manager/products?action=add"}
              className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${(location.pathname.endsWith('/products')) && location.search.includes('action=add') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-plus-circle text-info"></i> Add Product
            </NavLink>
          )}

          {canManageCategories && (
            <NavLink
              to={isAdmin ? "/admin/categories" : "/manager/categories"}
              className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-diagram-3 text-cyan-300"></i> Categories
            </NavLink>
          )}

          {canManageInventory && (
            <NavLink
              to={isAdmin ? "/admin/inventory" : "/manager/inventory"}
              className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-box-seam"></i> Inventory & Stock
            </NavLink>
          )}
        </>
      )}
    </>
  );
};

export default DashboardNavAdminCatalog;

