import React, { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { cleanDisplayName, getUserRoleLabel, getUserRoleBadgeClass } from '../../utils/orderStatus';
import { getMediaUrl, getDefaultAvatar } from '../../utils/imageUrl';

const DashboardLayout = () => {
  const {
    user,
    logout,
    isStoreManager,
    isOrderManager,
    isAdmin,
    isSuperAdmin,
    isSubAdmin,
    hasPermission,
    hasAnyPermission
  } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || (!isStoreManager && !isAdmin && !isSuperAdmin && !isSubAdmin && !isOrderManager)) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '520px' }}>
          <i className="bi bi-shield-x fs-1 text-danger mb-3"></i>
          <h4 className="fw-bold">Access Restricted</h4>
          <p className="text-muted small mb-4">
            This management console is strictly reserved for authenticated administrators and authorized staff.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/login" className="btn btn-ethio-primary px-4">Sign In</Link>
            <Link to="/" className="btn btn-outline-secondary px-4">Return Home</Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  const avatarUrl = user?.avatar
    ? getMediaUrl(user.avatar)
    : getDefaultAvatar(user?.first_name || user?.username);

  const roleLabel = getUserRoleLabel(user);
  const roleBadgeClass = getUserRoleBadgeClass(user);

  // Permission conditions for module visibility
  const canViewCatalog = isSuperAdmin || hasAnyPermission(['products.view', 'products.create', 'products.edit', 'products.delete']);
  const canManageCategories = isSuperAdmin || hasAnyPermission(['categories.manage', 'products.view']);
  const canManageInventory = isSuperAdmin || hasAnyPermission(['inventory.manage', 'products.view']);
  const canManagePromotions = isSuperAdmin || hasPermission('promotions.manage');
  const canViewOrders = isSuperAdmin || hasAnyPermission(['orders.view', 'orders.update']);
  const canViewPayments = isSuperAdmin || hasAnyPermission(['payments.view', 'payments.verify']);
  const canManageWarranty = isSuperAdmin || hasPermission('refunds.manage');
  const canManageFeedback = isSuperAdmin || hasAnyPermission(['products.edit', 'refunds.manage']);
  const canViewCustomers = isSuperAdmin || hasPermission('customers.view');
  const canViewReports = isSuperAdmin || hasPermission('reports.view');
  const canManageUsers = isSuperAdmin || hasPermission('users.manage');
  const canManageRoles = isSuperAdmin || hasPermission('roles.manage');
  const canViewAudits = isSuperAdmin || hasPermission('audit_logs.view');
  const canManageSettings = isSuperAdmin || hasPermission('settings.manage');

  const isActualStoreManager = user?.role === 'store_manager';
  const showGovernance = !isActualStoreManager && (isSuperAdmin || isAdmin || canManageUsers || canManageRoles || canViewAudits || canManageSettings);

  return (
    <div className="ethio-dashboard-layout">
      {/* Mobile Backdrop */}
      {mobileDrawerOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-50 z-3 d-lg-none"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Persistent Fixed Left Sidebar */}
      <aside
        className={`ethio-sidebar ${mobileDrawerOpen ? 'open' : ''}`}
        aria-label="Management Navigation"
      >
        {/* Sidebar Brand */}
        <div className="p-3 border-bottom border-white border-opacity-10 d-flex align-items-center justify-content-between">
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none text-white">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center text-white shadow-sm"
              style={{ width: '34px', height: '34px', background: 'var(--color-primary)' }}
            >
              <i className="bi bi-cpu-fill fs-6"></i>
            </div>
            <div>
              <div className="fw-bolder text-white lh-1 text-sm">EthioTech <span className="text-info">Market</span></div>
              {roleLabel && (
                <span
                  className={`badge ${roleBadgeClass} mt-1 text-uppercase`}
                  style={{ fontSize: '0.62rem', letterSpacing: '0.5px' }}
                >
                  {roleLabel} PORTAL
                </span>
              )}
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

        {/* User Persona Pill */}
        <div className="p-2.5 mx-3 my-2.5 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div className="d-flex align-items-center gap-2.5">
            <Link to="/profile" title="Edit Profile & Photo">
              <img
                src={avatarUrl}
                alt={cleanDisplayName(user)}
                className="rounded-circle object-fit-cover shrink-0 border border-white border-opacity-25"
                style={{ width: '36px', height: '36px' }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = getDefaultAvatar(user?.username);
                }}
              />
            </Link>
            <div className="text-truncate min-w-0">
              <Link to="/profile" className="text-decoration-none text-white fw-bold small text-truncate d-block" style={{ fontSize: '0.8rem' }} title="Edit Profile & Photo">
                {cleanDisplayName(user)}
              </Link>
              {roleLabel && (
                <span
                  className={`badge ${roleBadgeClass} text-uppercase`}
                  style={{ fontSize: '0.6rem', letterSpacing: '0.5px' }}
                >
                  {roleLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic RBAC Nav Links */}
        <div className="flex-grow-1 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: 'thin' }}>
          {isOrderManager ? (
            <>
              <div className="px-3 text-uppercase fw-bold text-secondary mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                Fulfillment Management
              </div>
              <NavLink
                to="/order-manager/dashboard"
                end
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-speedometer2 text-amber-400"></i> Order Dashboard
              </NavLink>

              <NavLink
                to="/order-manager/orders"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-receipt-cutoff text-info"></i> Customer Orders
              </NavLink>

              <NavLink
                to="/order-manager/shipments"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-truck-front-fill text-warning"></i> Shipments &amp; Logistics
              </NavLink>

              <NavLink
                to="/order-manager/reports"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-pie-chart-fill text-warning"></i> Order Reports
              </NavLink>
            </>
          ) : (
            <>
          {/* 1. OVERVIEW */}
          {(isSuperAdmin || isAdmin || canViewReports) && (
            <>
              <div className="px-3 text-uppercase fw-bold text-secondary mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                Overview & Analytics
              </div>
              <NavLink
                to={isAdmin ? "/admin/dashboard" : "/manager/dashboard"}
                end
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-grid-1x2"></i> Dashboard Overview
              </NavLink>
            </>
          )}

          {/* 2. CATALOG & INVENTORY */}
          {(canViewCatalog || canManageCategories || canManageInventory || canManagePromotions) && (
            <>
              <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                Catalog & Inventory
              </div>

              {canViewCatalog && (
                <NavLink
                  to="/manager/products"
                  end
                  className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive && !location.search ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-laptop"></i> Manage Products
                </NavLink>
              )}

              {hasPermission('products.create') && (
                <NavLink
                  to="/manager/products?action=add"
                  className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.pathname === '/manager/products' && location.search.includes('action=add') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-plus-circle text-info"></i> Add Product
                </NavLink>
              )}

              {canManageCategories && (
                <NavLink
                  to="/manager/categories"
                  className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-diagram-3 text-cyan-300"></i> Categories
                </NavLink>
              )}

              {canManageInventory && (
                <NavLink
                  to="/manager/inventory"
                  className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-box-seam"></i> Inventory & Stock
                </NavLink>
              )}

              {/* Role-Specific Procurement Navigation */}
              {(isAdmin || isSuperAdmin) ? (
                <>
                  <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                    Supplier Procurement &amp; Payments
                  </div>

                  <NavLink
                    to="/admin/procurement/approvals"
                    className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <i className="bi bi-check2-square text-warning"></i> Purchase Order Approvals
                  </NavLink>

                  <NavLink
                    to="/admin/procurement/invoices"
                    className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <i className="bi bi-receipt text-info"></i> Supplier Invoices
                  </NavLink>

                  <NavLink
                    to="/admin/procurement/payments"
                    className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive && location.pathname.endsWith('/payments') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <i className="bi bi-cash-stack text-success"></i> Supplier Payments
                  </NavLink>

                  <NavLink
                    to="/admin/procurement/payment-history"
                    className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <i className="bi bi-clock-history text-cyan-300"></i> Supplier Payment History
                  </NavLink>

                  <NavLink
                    to="/admin/procurement/reports"
                    className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <i className="bi bi-graph-up-arrow text-emerald-400"></i> Procurement Reports
                  </NavLink>
                </>
              ) : (
                <>
                  <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                    Procurement &amp; Suppliers
                  </div>

                  <NavLink
                    to="/manager/procurement/suppliers"
                    className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive || location.pathname === '/manager/suppliers' ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <i className="bi bi-truck text-emerald-400"></i> Manage Suppliers
                  </NavLink>

                  <NavLink
                    to="/manager/procurement/purchase-orders/create"
                    className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <i className="bi bi-cart-plus text-info"></i> Create Purchase Order
                  </NavLink>

                  <NavLink
                    to="/manager/procurement/purchase-orders"
                    end
                    className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <i className="bi bi-receipt-cutoff text-warning"></i> Purchase Order History
                  </NavLink>

                  <NavLink
                    to="/manager/procurement/receive"
                    className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <i className="bi bi-box-arrow-in-down text-cyan-300"></i> Receive Products
                  </NavLink>

                  <NavLink
                    to="/manager/procurement/invoices"
                    className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <i className="bi bi-file-earmark-spreadsheet text-amber-400"></i> Supplier Invoices
                  </NavLink>

                  <NavLink
                    to="/manager/procurement/history"
                    className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <i className="bi bi-clock-history text-secondary"></i> Procurement History
                  </NavLink>
                </>
              )}

              <NavLink
                to={isAdmin ? "/admin/dashboard?tab=notifications" : "/manager/dashboard?tab=notifications"}
                className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center justify-content-between text-decoration-none transition ${location.search.includes('tab=notifications') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <div className="d-flex align-items-center gap-2.5">
                  <i className="bi bi-bell-fill text-warning"></i> Stock Alerts
                </div>
                {unreadCount > 0 && (
                  <span className="badge rounded-pill bg-danger text-white px-2 py-0.5" style={{ fontSize: '0.65rem' }}>
                    {unreadCount}
                  </span>
                )}
              </NavLink>

              {canManagePromotions && (
                <NavLink
                  to="/manager/promotions"
                  className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-tag-fill text-warning"></i> Promotions & Discounts
                </NavLink>
              )}
            </>
          )}

          {/* 3. ORDERS & PAYMENTS */}
          {(canViewOrders || canViewPayments || canManageWarranty || canManageFeedback) && (
            <>
              <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                Orders & Payments
              </div>

              {canViewOrders && (
                <NavLink
                  to="/manager/orders"
                  end
                  className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive && !location.search ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-receipt-cutoff text-info"></i> Customer Orders
                </NavLink>
              )}

              {canViewPayments && (
                <NavLink
                  to="/manager/payments"
                  className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-credit-card-2-front-fill text-success"></i> Payment Verification
                </NavLink>
              )}

              {canManageWarranty && (
                <NavLink
                  to="/manager/warranty"
                  className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-shield-check text-emerald-400"></i> Warranty Claims
                </NavLink>
              )}

              {canManageFeedback && (
                <NavLink
                  to="/manager/feedback"
                  className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-chat-heart text-danger"></i> Customer Feedback
                </NavLink>
              )}
            </>
          )}

          {/* 4. CUSTOMERS & INTELLIGENCE */}
          {(canViewCustomers || canViewReports) && (
            <>
              <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                Intelligence & Reporting
              </div>

              {canViewCustomers && (
                <NavLink
                  to={isAdmin ? "/admin/segmentation" : "/manager/segmentation"}
                  className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-people text-info"></i> Customer Segmentation
                </NavLink>
              )}

              {canViewReports && (
                <NavLink
                  to="/manager/reports"
                  className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-pie-chart-fill text-warning"></i> Sales & Inventory Reports
                </NavLink>
              )}
            </>
          )}

          {/* 5. GOVERNANCE & RBAC */}
          {showGovernance && (
            <>
              <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                Governance & Administration
              </div>

              {(isSuperAdmin || canManageUsers) && (
                <NavLink
                  to={isAdmin ? "/admin/users?tab=users" : "/manager/admin/users?tab=users"}
                  className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.pathname.includes('/admin/users') && (!location.search || location.search.includes('tab=users')) ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-people-fill text-info"></i> User Management
                </NavLink>
              )}

              {(isSuperAdmin || canManageRoles) && (
                <NavLink
                  to={isAdmin ? "/admin/users?tab=roles" : "/manager/admin/users?tab=roles"}
                  className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.search.includes('tab=roles') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-shield-lock-fill text-warning"></i> Roles & Permissions
                </NavLink>
              )}

              {(isSuperAdmin || canViewAudits) && (
                <NavLink
                  to={isAdmin ? "/admin/users?tab=audits" : "/manager/admin/users?tab=audits"}
                  className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.search.includes('tab=audits') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-journal-text text-cyan-300"></i> Security Audit Trail
                </NavLink>
              )}

              {(isSuperAdmin || canManageSettings) && (
                <NavLink
                  to={isAdmin ? "/admin/users?tab=config" : "/manager/admin/users?tab=config"}
                  className={() => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.search.includes('tab=config') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-sliders text-emerald-400"></i> Platform Configuration
                </NavLink>
              )}

              {(isSuperAdmin || isAdmin) && (
                <NavLink
                  to="/admin/delivery"
                  className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <i className="bi bi-truck-front-fill text-warning"></i> Logistics &amp; Delivery Hub
                </NavLink>
              )}
            </>
          )}
            </>
          )}

          {/* Account Profile */}
          <div className="px-3 text-uppercase fw-bold text-secondary mt-3 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
            Account
          </div>
          <NavLink
            to="/profile"
            className="dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none text-slate-300 hover:text-white hover:bg-slate-800 transition"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <i className="bi bi-person-circle"></i> My Account & Photo
          </NavLink>
        </div>

        {/* Sidebar Footer with Sign Out */}
        <div className="p-3 border-top border-secondary border-opacity-25 d-flex flex-column gap-2 mt-auto">
          <Link
            to="/"
            className="btn btn-outline-light btn-sm text-start py-2 d-flex align-items-center gap-2 rounded-3 text-xs"
          >
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

      {/* Main Content Area */}
      <div className="ethio-dashboard-content">
        {/* Mobile Header Bar */}
        <div className="bg-white border-bottom py-2.5 px-3 px-md-4 d-flex align-items-center justify-content-between sticky-top z-2 d-lg-none">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary p-1.5"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open sidebar menu"
            >
              <i className="bi bi-list fs-5"></i>
            </button>
            <h6 className="fw-bolder text-slate-900 mb-0">
              EthioTech Portal
            </h6>
          </div>
          <Link to="/" className="btn btn-sm btn-outline-primary text-xs py-1 px-2.5">
            <i className="bi bi-shop me-1"></i> Storefront
          </Link>
        </div>

        <main className="p-3 p-md-4 p-lg-5" style={{ minWidth: 0 }}>
          {/* Top Bar with Navigation Breadcrumbs & Notification Bell Icon */}
          <div className="d-flex align-items-center justify-content-between mb-4 pb-2 border-bottom border-slate-200">
            <div className="d-flex align-items-center">
              <button
                onClick={() => {
                  if (window.history.length > 1) {
                    navigate(-1);
                  } else {
                    navigate(isAdmin ? '/admin/dashboard' : isOrderManager ? '/order-manager/dashboard' : '/manager/dashboard');
                  }
                }}
                className="btn btn-sm btn-outline-secondary rounded-pill me-3 d-inline-flex align-items-center gap-1 shadow-sm px-3"
                aria-label="Go back"
              >
                <i className="bi bi-arrow-left"></i> Back
              </button>
              <nav aria-label="breadcrumb" className="small">
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Storefront</Link></li>
                  <li className="breadcrumb-item">
                    <Link to={isAdmin ? '/admin/dashboard' : isOrderManager ? '/order-manager/dashboard' : '/manager/dashboard'} className="text-decoration-none">
                      {getUserRoleLabel(user)} Console
                    </Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">Portal</li>
                </ol>
              </nav>
            </div>

            {/* Right Header Actions: Notification Bell with Dropdown */}
            <div className="d-flex align-items-center gap-2 position-relative">
              <Link to="/" className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1.5 d-none d-sm-inline-flex align-items-center gap-1.5 text-xs">
                <i className="bi bi-shop"></i> Storefront
              </Link>

              {/* Notification Bell Button */}
              <div className="position-relative">
                <button
                  type="button"
                  id="dashboard-notification-bell"
                  className={`btn btn-sm rounded-circle p-2 d-flex align-items-center justify-content-center shadow-sm transition position-relative ${
                    unreadCount > 0 ? 'btn-danger text-white' : 'btn-outline-secondary text-slate-700 bg-white'
                  }`}
                  style={{ width: '40px', height: '40px' }}
                  onClick={() => setShowBellDropdown(!showBellDropdown)}
                  title={`${unreadCount} Unread Stock & System Notifications`}
                  aria-expanded={showBellDropdown}
                >
                  <i className={`bi ${unreadCount > 0 ? 'bi-bell-fill' : 'bi-bell'} fs-6`}></i>
                  {unreadCount > 0 && (
                    <span
                      className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-white text-white shadow-sm"
                      style={{ fontSize: '0.65rem' }}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Panel */}
                {showBellDropdown && (
                  <div
                    className="card position-absolute end-0 top-100 mt-2 shadow-lg border-0 rounded-4 z-3 overflow-hidden bg-white"
                    style={{ width: '380px', maxWidth: '90vw' }}
                  >
                    <div className="p-3 bg-slate-900 text-white d-flex align-items-center justify-content-between border-bottom border-slate-800">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-bell-fill text-warning"></i>
                        <span className="fw-bold text-sm">Stock Alerts &amp; Notifications</span>
                        {unreadCount > 0 && (
                          <span className="badge bg-danger text-white rounded-pill text-[10px]">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          className="btn btn-link text-info p-0 text-xs text-decoration-none fw-semibold"
                          onClick={() => markAllAsRead()}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="overflow-y-auto" style={{ maxHeight: '360px', scrollbarWidth: 'thin' }}>
                      {notifications.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                          <i className="bi bi-bell-slash fs-2 d-block mb-2 text-slate-300"></i>
                          <div className="text-xs fw-semibold">No notifications right now</div>
                          <div className="text-[11px] text-slate-400">Stock condition is healthy and monitored.</div>
                        </div>
                      ) : (
                        notifications.slice(0, 8).map((n) => {
                          const isLow = n.notification_type === 'LOW_STOCK' || n.notification_type === 'STOCK_ALERT';
                          const isZero = n.notification_type === 'OUT_OF_STOCK';
                          const isSent = n.notification_type === 'SUPPLIER_EMAIL_SENT';
                          const isFail = n.notification_type === 'SUPPLIER_EMAIL_FAILED';

                          const badgeBg = isZero
                            ? 'bg-danger text-white'
                            : isLow
                            ? 'bg-warning text-dark'
                            : isSent
                            ? 'bg-success text-white'
                            : isFail
                            ? 'bg-danger text-white'
                            : 'bg-primary text-white';

                          const badgeText = isZero
                            ? 'Out of Stock'
                            : isLow
                            ? 'Low Stock'
                            : isSent
                            ? 'Email Sent'
                            : isFail
                            ? 'Email Failed'
                            : 'System';

                          return (
                            <div
                              key={n.id}
                              className={`p-3 border-bottom transition cursor-pointer ${
                                !n.is_read ? 'bg-amber-50 bg-opacity-30' : 'hover:bg-slate-50'
                              }`}
                              onClick={() => {
                                markAsRead(n.id);
                                setShowBellDropdown(false);
                                if (n.product) {
                                  navigate(`/manager/inventory?product_id=${n.product}`);
                                } else {
                                  navigate(isAdmin ? '/admin/dashboard?tab=notifications' : '/manager/dashboard?tab=notifications');
                                }
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-1">
                                <span className={`badge rounded-pill text-[10px] fw-bold ${badgeBg}`}>
                                  {badgeText}
                                </span>
                                <span className="text-[10px] text-muted">
                                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="fw-bold text-xs text-slate-900 mb-1 line-clamp-1">{n.title}</div>
                              <div className="text-muted text-[11px] line-clamp-2 mb-1.5">{n.message}</div>
                              {n.product_name && (
                                <div className="d-flex align-items-center gap-2 text-[10px] bg-white p-1.5 rounded border border-slate-200">
                                  <span className="fw-semibold text-slate-700">{n.product_name}</span>
                                  {n.current_stock !== null && (
                                    <span className="text-danger fw-bold ms-auto">Stock: {n.current_stock}</span>
                                  )}
                                  {n.suggested_reorder_qty && (
                                    <span className="text-primary fw-semibold">&bull; Reorder: {n.suggested_reorder_qty}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="p-2.5 bg-slate-50 border-top text-center d-flex justify-content-between align-items-center px-3">
                      <Link
                        to={isAdmin ? '/admin/dashboard?tab=notifications' : '/manager/dashboard?tab=notifications'}
                        className="text-xs fw-bold text-primary text-decoration-none"
                        onClick={() => setShowBellDropdown(false)}
                      >
                        Open Notification Center &rarr;
                      </Link>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-muted p-0 text-xs text-decoration-none"
                        onClick={() => setShowBellDropdown(false)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
