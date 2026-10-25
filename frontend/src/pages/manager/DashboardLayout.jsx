import React, { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cleanDisplayName, getUserRoleLabel } from '../../utils/orderStatus';
import { getMediaUrl, getDefaultAvatar } from '../../utils/imageUrl';

const DashboardLayout = () => {
  const { user, logout, isStoreManager, isAdmin } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || (!isStoreManager && !isAdmin)) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '520px' }}>
          <i className="bi bi-shield-x fs-1 text-danger mb-3"></i>
          <h4 className="fw-bold">Access Restricted</h4>
          <p className="text-muted small mb-4">
            This management console is strictly reserved for authenticated Store Managers and Administrators.
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

  const avatarUrl = user?.profile_image
    ? getMediaUrl(user.profile_image)
    : getDefaultAvatar(user?.first_name || user?.username);

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
              <span className="badge bg-primary bg-opacity-25 text-info mt-1" style={{ fontSize: '0.62rem' }}>
                {isAdmin ? 'ADMINISTRATOR' : 'STORE MANAGER'}
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

        {/* User Persona Pill with Real Photo */}
        <div className="p-2.5 mx-3 my-2.5 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div className="d-flex align-items-center gap-2.5">
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
            <div className="text-truncate min-w-0">
              <div className="fw-bold text-white small text-truncate" style={{ fontSize: '0.8rem' }}>
                {cleanDisplayName(user)}
              </div>
              <span className="badge bg-primary text-uppercase" style={{ fontSize: '0.6rem' }}>
                {getUserRoleLabel(user)}
              </span>
            </div>
          </div>
        </div>

        {/* Nav Links Container (Internal Scroll Area) */}
        <div className="flex-grow-1 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: 'thin' }}>
          {/* ========================================================
              STORE MANAGER NAVIGATION (Exact Requirement 5 Links)
              ======================================================== */}
          {!isAdmin && isStoreManager && (
            <>
              <div className="px-3 text-uppercase fw-bold text-secondary mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                Store Manager Operations
              </div>

              {/* 1. Dashboard Overview */}
              <NavLink
                to="/manager/dashboard"
                end
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-grid-1x2"></i> Dashboard Overview
              </NavLink>

              {/* 2. Add or Upload Product */}
              <NavLink
                to="/manager/products?action=add"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.pathname === '/manager/products' && location.search.includes('action=add') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-plus-circle text-info"></i> Add or Upload Product
              </NavLink>

              {/* 3. Manage Products */}
              <NavLink
                to="/manager/products"
                end
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive && !location.search ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-laptop"></i> Manage Products
              </NavLink>

              {/* 4. Update Product Prices */}
              <NavLink
                to="/manager/products?action=pricing"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.search.includes('action=pricing') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-currency-exchange text-success"></i> Update Product Prices
              </NavLink>

              {/* 5. Discounts and Promotions */}
              <NavLink
                to="/manager/promotions"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-tag-fill text-warning"></i> Discounts and Promotions
              </NavLink>

              {/* 6. Inventory and Stock */}
              <NavLink
                to="/manager/inventory"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-box-seam"></i> Inventory and Stock
              </NavLink>

              {/* 7. Customer Orders */}
              <NavLink
                to="/manager/orders"
                end
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive && !location.search ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-cart-check"></i> Customer Orders
              </NavLink>

              {/* 8. Update Order Status */}
              <NavLink
                to="/manager/orders?filter=status"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.search.includes('filter=status') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-pencil-square text-cyan-400"></i> Update Order Status
              </NavLink>

              {/* 9. Customer Feedback and Reviews */}
              <NavLink
                to="/manager/feedback"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-chat-heart text-danger"></i> Customer Feedback and Reviews
              </NavLink>

              {/* 10. Warranty or Claim Requests */}
              <NavLink
                to="/manager/warranty"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-shield-check text-emerald-400"></i> Warranty or Claim Requests
              </NavLink>

              {/* 11. Notifications */}
              <NavLink
                to="/customer/dashboard?tab=notifications"
                className="dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none text-slate-300 hover:text-white hover:bg-slate-800 transition"
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-bell text-warning"></i> Notifications
              </NavLink>

              {/* 12. Manager Profile */}
              <NavLink
                to="/customer/dashboard?tab=profile"
                className="dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none text-slate-300 hover:text-white hover:bg-slate-800 transition"
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-person-circle"></i> Manager Profile
              </NavLink>
            </>
          )}

          {/* ========================================================
              ADMINISTRATOR NAVIGATION (Exact Requirement 5 Links)
              ======================================================== */}
          {isAdmin && (
            <>
              <div className="px-3 text-uppercase fw-bold text-secondary mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                Administrator Operations
              </div>

              {/* 1. Admin Dashboard */}
              <NavLink
                to="/admin/dashboard"
                end
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-speedometer2"></i> Admin Dashboard
              </NavLink>

              {/* 2. User Management */}
              <NavLink
                to="/manager/admin/users?tab=users"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.pathname.includes('/admin/users') && (!location.search || location.search.includes('tab=users')) ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-people-fill"></i> User Management
              </NavLink>

              {/* 3. Approve or Assign Store Managers */}
              <NavLink
                to="/manager/admin/users?role=store_manager"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.search.includes('role=store_manager') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-person-check-fill text-info"></i> Approve or Assign Store Managers
              </NavLink>

              {/* 4. Role and Permission Management */}
              <NavLink
                to="/manager/admin/users?tab=permissions"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.search.includes('tab=permissions') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-shield-lock-fill text-warning"></i> Role and Permission Management
              </NavLink>

              {/* 5. Store Managers */}
              <NavLink
                to="/manager/admin/users?filter=store_manager"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.search.includes('filter=store_manager') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-person-badge-fill text-cyan-300"></i> Store Managers
              </NavLink>

              {/* 6. Products and Categories */}
              <NavLink
                to="/manager/products"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-boxes"></i> Products and Categories
              </NavLink>

              {/* 7. Orders and Payments */}
              <NavLink
                to="/manager/orders"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-credit-card-2-front text-cyan-400"></i> Orders and Payments
              </NavLink>

              {/* 8. Customer Feedback */}
              <NavLink
                to="/manager/feedback"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-chat-dots-fill text-primary"></i> Customer Feedback
              </NavLink>

              {/* 9. Promotions and Advertisements */}
              <NavLink
                to="/manager/promotions"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-megaphone-fill text-warning"></i> Promotions and Advertisements
              </NavLink>

              {/* 10. Reports and Analytics */}
              <NavLink
                to="/manager/reports"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${isActive ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-pie-chart-fill text-info"></i> Reports and Analytics
              </NavLink>

              {/* 11. System Notifications */}
              <NavLink
                to="/customer/dashboard?tab=notifications"
                className="dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none text-slate-300 hover:text-white hover:bg-slate-800 transition"
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-bell-fill text-warning"></i> System Notifications
              </NavLink>

              {/* 12. Security and Settings */}
              <NavLink
                to="/manager/admin/users?tab=audit"
                className={({ isActive }) => `dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none transition ${location.search.includes('tab=audit') ? 'active bg-primary text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-sliders2 text-danger"></i> Security and Settings
              </NavLink>

              {/* 13. Admin Profile */}
              <NavLink
                to="/customer/dashboard?tab=profile"
                className="dashboard-nav-item py-1.5 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none text-slate-300 hover:text-white hover:bg-slate-800 transition"
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="bi bi-person-circle"></i> Admin Profile
              </NavLink>
            </>
          )}
        </div>

        {/* Sidebar Footer with Sign Out Near Bottom */}
        <div className="p-3 border-top border-secondary border-opacity-25 d-flex flex-column gap-2 mt-auto">
          <Link
            to="/"
            className="btn btn-outline-light btn-sm text-start py-2 d-flex align-items-center gap-2 rounded-3 text-xs"
          >
            <i className="bi bi-shop"></i> View Public Store
          </Link>
          <button
            onClick={handleSignOut}
            className="btn btn-danger btn-sm text-start py-2 d-flex align-items-center gap-2 rounded-3 bg-danger bg-opacity-25 border-danger border-opacity-50 text-danger text-xs fw-bold"
          >
            <i className="bi bi-box-arrow-right"></i> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area: Independent fluid scroll */}
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
              EthioTech {isAdmin ? 'Admin' : 'Manager'}
            </h6>
          </div>
          <Link to="/" className="btn btn-sm btn-outline-primary text-xs py-1 px-2.5">
            <i className="bi bi-shop me-1"></i> Storefront
          </Link>
        </div>

        <main className="p-3 p-md-4 p-lg-5" style={{ minWidth: 0 }}>
          {/* Navigation Breadcrumb with Back Button */}
          <div className="d-flex align-items-center mb-4">
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate(isAdmin ? '/admin/dashboard' : '/manager/dashboard');
                }
              }}
              className="btn btn-sm btn-outline-secondary rounded-pill me-3 d-inline-flex align-items-center gap-1 shadow-sm px-3"
              aria-label="Go back"
            >
              <i className="bi bi-arrow-left"></i> Back
            </button>
            <nav aria-label="breadcrumb" className="small flex-grow-1">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Storefront</Link></li>
                <li className="breadcrumb-item">
                  <Link to={isAdmin ? '/admin/dashboard' : '/manager/dashboard'} className="text-decoration-none">
                    {isAdmin ? 'Admin Console' : 'Store Management'}
                  </Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">Portal</li>
              </ol>
            </nav>
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
