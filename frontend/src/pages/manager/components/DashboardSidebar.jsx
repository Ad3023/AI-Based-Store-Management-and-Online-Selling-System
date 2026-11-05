import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { cleanDisplayName } from '../../../utils/orderStatus';
import { getDefaultAvatar } from '../../../utils/imageUrl';
import DashboardNavAdminCatalog from './DashboardNavAdminCatalog';
import DashboardNavSupplierManagement from './DashboardNavSupplierManagement';
import DashboardNavAdminOrdersGov from './DashboardNavAdminOrdersGov';
import DashboardNavManager from './DashboardNavManager';

const DashboardSidebar = ({
  mobileDrawerOpen,
  setMobileDrawerOpen,
  user,
  avatarUrl,
  roleLabel,
  roleBadgeClass,
  isAdmin,
  isOrderManager,
  isSuperAdmin,
  canViewReports,
  canViewCatalog,
  canManageCategories,
  canManageInventory,
  canManagePromotions,
  canViewOrders,
  canViewPayments,
  canManageWarranty,
  canManageFeedback,
  canViewCustomers,
  showGovernance,
  canManageUsers,
  canManageRoles,
  canViewAudits,
  canManageSettings,
  unreadCount,
  hasPermission,
  handleSignOut,
}) => {
  const onNavClick = () => setMobileDrawerOpen(false);

  return (
    <>
      {mobileDrawerOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-50 z-3 d-lg-none"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      <aside className={`ethio-sidebar ${mobileDrawerOpen ? 'open' : ''}`} aria-label="Management Navigation">
        {/* Sidebar Brand */}
        <div className="p-3 border-bottom border-white border-opacity-10 d-flex align-items-center justify-content-between">
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none text-white">
            <div className="rounded-3 d-flex align-items-center justify-content-center text-white shadow-sm" style={{ width: '34px', height: '34px', background: 'var(--color-primary)' }}>
              <i className="bi bi-cpu-fill fs-6"></i>
            </div>
            <div>
              <div className="fw-bolder text-white lh-1 text-sm">EthioTech <span className="text-info">Market</span></div>
              {roleLabel && (
                <span className={`badge ${roleBadgeClass} mt-1 text-uppercase`} style={{ fontSize: '0.62rem', letterSpacing: '0.5px' }}>
                  {roleLabel} PORTAL
                </span>
              )}
            </div>
          </Link>
          <button type="button" className="btn btn-sm btn-link text-white-50 d-lg-none p-0 text-decoration-none" onClick={() => setMobileDrawerOpen(false)} aria-label="Close menu">
            <i className="bi bi-x-lg fs-5"></i>
          </button>
        </div>

        {/* User Persona Pill */}
        <div className="p-2.5 mx-3 my-2.5 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div className="d-flex align-items-center gap-2.5">
            <Link to="/profile" title="Edit Profile & Photo">
              <img
                src={avatarUrl}
                alt={cleanDisplayName(user)}
                className="rounded-circle object-fit-cover shrink-0 border border-white border-opacity-25"
                style={{ width: '36px', height: '36px' }}
                onError={(e) => { e.target.onerror = null; e.target.src = getDefaultAvatar(user?.username); }}
              />
            </Link>
            <div className="text-truncate min-w-0">
              <Link to="/profile" className="text-decoration-none text-white fw-bold small text-truncate d-block" style={{ fontSize: '0.8rem' }} title="Edit Profile & Photo">
                {cleanDisplayName(user)}
              </Link>
              {roleLabel && (
                <span className={`badge ${roleBadgeClass} text-uppercase`} style={{ fontSize: '0.6rem', letterSpacing: '0.5px' }}>
                  {roleLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Nav Links */}
        <div className="flex-grow-1 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: 'thin' }}>
          {isOrderManager ? (
            <DashboardNavManager isOrderManager={true} onNavClick={onNavClick} />
          ) : (
            <>
              <DashboardNavAdminCatalog
                isAdmin={isAdmin}
                canViewReports={canViewReports}
                canViewCatalog={canViewCatalog}
                canManageCategories={canManageCategories}
                canManageInventory={canManageInventory}
                hasPermission={hasPermission}
                onNavClick={onNavClick}
              />

              {isAdmin ? (
                <DashboardNavSupplierManagement onNavClick={onNavClick} />
              ) : (
                <DashboardNavManager isOrderManager={false} onNavClick={onNavClick} />
              )}

              <DashboardNavAdminOrdersGov
                isAdmin={isAdmin}
                unreadCount={unreadCount}
                canManagePromotions={canManagePromotions}
                canViewOrders={canViewOrders}
                canViewPayments={canViewPayments}
                canManageWarranty={canManageWarranty}
                canManageFeedback={canManageFeedback}
                canViewCustomers={canViewCustomers}
                canViewReports={canViewReports}
                showGovernance={showGovernance}
                isSuperAdmin={isSuperAdmin}
                canManageUsers={canManageUsers}
                canManageRoles={canManageRoles}
                canViewAudits={canViewAudits}
                canManageSettings={canManageSettings}
                onNavClick={onNavClick}
              />
            </>
          )}

          <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
            Account
          </div>
          <NavLink
            to="/profile"
            className="dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none text-slate-300 hover:text-white hover:bg-slate-800 transition"
            onClick={onNavClick}
          >
            <i className="bi bi-person-circle"></i> My Account & Photo
          </NavLink>
        </div>

        {/* Footer */}
        <div className="p-3 border-top border-secondary border-opacity-25 d-flex flex-column gap-2 mt-auto">
          <Link to="/" className="btn btn-outline-light btn-sm text-start py-2 d-flex align-items-center gap-2 rounded-3 text-xs">
            <i className="bi bi-shop"></i> Storefront
          </Link>
          <button
            onClick={handleSignOut}
            className="btn btn-danger btn-sm text-start py-2 d-flex align-items-center gap-2 rounded-3 bg-danger bg-opacity-25 border-danger border-opacity-50 text-danger text-xs fw-bold"
          >
            <i className="bi bi-box-arrow-right"></i> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;

