import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const DashboardNavAdminOrdersGov = ({
  isAdmin,
  unreadCount,
  canManagePromotions,
  canViewOrders,
  canViewPayments,
  canManageWarranty,
  canManageFeedback,
  canViewCustomers,
  canViewReports,
  showGovernance,
  isSuperAdmin,
  canManageUsers,
  canManageRoles,
  canViewAudits,
  canManageSettings,
  onNavClick,
}) => {
  const location = useLocation();

  return (
    <>
      <NavLink
        to={isAdmin ? "/admin/dashboard?tab=notifications" : "/manager/dashboard?tab=notifications"}
        className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center justify-content-between text-decoration-none transition ${location.search.includes('tab=notifications') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
        onClick={onNavClick}
      >
        <div className="d-flex align-items-center gap-2.5">
          <i className="bi bi-bell-fill text-warning"></i> Stock Alerts
        </div>
        {unreadCount > 0 && (
          <span className="badge rounded-pill bg-danger text-white px-2 py-0.5" style={{ fontSize: '0.65rem' }}>{unreadCount}</span>
        )}
      </NavLink>

      {canManagePromotions && (
        <NavLink
          to={isAdmin ? "/admin/promotions" : "/manager/promotions"}
          className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
          onClick={onNavClick}
        >
          <i className="bi bi-tag-fill text-warning"></i> Promotions & Discounts
        </NavLink>
      )}

      {/* Orders & Payments */}
      {(canViewOrders || canViewPayments || canManageWarranty || canManageFeedback) && (
        <>
          <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
            Orders & Payments
          </div>

          {canViewOrders && (
            <NavLink
              to={isAdmin ? "/admin/orders" : "/manager/orders"}
              end
              className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive && !location.search ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-receipt-cutoff text-info"></i> Customer Orders
            </NavLink>
          )}

          <NavLink
            to={isAdmin ? "/admin/shipments" : "/manager/shipments"}
            className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
            onClick={onNavClick}
          >
            <i className="bi bi-truck text-warning"></i> Live Shipments &amp; Tracking
          </NavLink>

          {canViewPayments && (
            <NavLink
              to={isAdmin ? "/admin/payments" : "/manager/payments"}
              className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-credit-card-2-front-fill text-success"></i> Payment Verification
            </NavLink>
          )}

          {canManageWarranty && (
            <NavLink
              to={isAdmin ? "/admin/warranty" : "/manager/warranty"}
              className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-shield-check text-emerald-400"></i> Warranty Claims
            </NavLink>
          )}

          {canManageFeedback && (
            <NavLink
              to={isAdmin ? "/admin/feedback" : "/manager/feedback"}
              className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-chat-heart text-danger"></i> Customer Feedback
            </NavLink>
          )}
        </>
      )}

      {/* Intelligence & Reporting */}
      {(canViewCustomers || canViewReports) && (
        <>
          <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
            Intelligence & Reporting
          </div>

          {canViewCustomers && (
            <NavLink
              to={isAdmin ? "/admin/segmentation" : "/manager/segmentation"}
              className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-people text-info"></i> Customer Segmentation
            </NavLink>
          )}

          {canViewReports && (
            <NavLink
              to={isAdmin ? "/admin/reports" : "/manager/reports"}
              className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-pie-chart-fill text-warning"></i> Sales & Inventory Reports
            </NavLink>
          )}
        </>
      )}

      {/* Governance & Administration */}
      {showGovernance && (
        <>
          <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
            Governance & Administration
          </div>

          {(isSuperAdmin || canManageUsers) && (
            <NavLink
              to={isAdmin ? "/admin/users?tab=users" : "/manager/admin/users?tab=users"}
              className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.pathname.includes('/admin/users') && (!location.search || location.search.includes('tab=users')) ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-people-fill text-info"></i> User Management
            </NavLink>
          )}

          {(isSuperAdmin || canManageRoles) && (
            <NavLink
              to={isAdmin ? "/admin/users?tab=roles" : "/manager/admin/users?tab=roles"}
              className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.search.includes('tab=roles') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-shield-lock-fill text-warning"></i> Roles & Permissions
            </NavLink>
          )}

          {(isSuperAdmin || canViewAudits) && (
            <NavLink
              to={isAdmin ? "/admin/users?tab=audits" : "/manager/admin/users?tab=audits"}
              className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.search.includes('tab=audits') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-journal-text text-cyan-300"></i> Security Audit Trail
            </NavLink>
          )}

          {(isSuperAdmin || canManageSettings) && (
            <NavLink
              to={isAdmin ? "/admin/users?tab=config" : "/manager/admin/users?tab=config"}
              className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.search.includes('tab=config') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-sliders text-emerald-400"></i> Platform Configuration
            </NavLink>
          )}

          {isAdmin && (
            <NavLink
              to="/admin/delivery"
              className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              onClick={onNavClick}
            >
              <i className="bi bi-truck-front-fill text-warning"></i> Logistics &amp; Delivery Hub
            </NavLink>
          )}
        </>
      )}
    </>
  );
};

export default DashboardNavAdminOrdersGov;
