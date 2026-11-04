import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

const SupplierLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifications(true);
      const res = await api.get('supplier/notifications/');
      const list = res.data.results || res.data || [];
      setNotifications(list);
      const unread = list.filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      // Quiet fail if notifications not loaded
      console.warn('Failed to fetch supplier notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // 1-min poll
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleSignOut = () => {
    logout();
    navigate('/supplier/login');
  };

  const supplierName = user?.supplier_name || 'Vendor Partner';

  return (
    <div className="ethio-dashboard-layout">
      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div
          className="ethio-drawer-backdrop z-3 d-lg-none"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Persistent Supplier Sidebar */}
      <aside
        className={`ethio-sidebar ${mobileDrawerOpen ? 'open' : ''}`}
        aria-label="Supplier Portal Navigation"
      >
        {/* Sidebar Brand */}
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

        {/* Supplier Identity Card */}
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

        {/* Navigation Menu */}
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

        {/* Sidebar Footer */}
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

      {/* Main Content Area */}
      <div className="ethio-dashboard-content">
        {/* Top Navbar */}
        <header className="sticky-top bg-white border-bottom border-slate-200 px-3 px-lg-4 py-2.5 d-flex align-items-center justify-content-between z-2">
          <div className="d-flex align-items-center gap-3">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-lg-none"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open sidebar"
            >
              <i className="bi bi-list fs-5"></i>
            </button>
            <div className="d-none d-sm-block">
              <span className="badge bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 text-xs">
                <i className="bi bi-building me-1.5 text-teal-600"></i>
                Supplier Organization: <strong className="text-slate-900">{supplierName}</strong>
              </span>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3">
            {/* Notification Bell Dropdown */}
            <div className="position-relative">
              <button
                type="button"
                className="btn btn-sm btn-light rounded-circle position-relative p-2"
                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                title="Notifications"
                aria-label="Notifications"
              >
                <i className="bi bi-bell fs-6 text-slate-700"></i>
                {unreadCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.65rem' }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotificationDropdown && (
                <div
                  className="card position-absolute end-0 mt-2 shadow-lg border-0 rounded-4 p-0 z-3"
                  style={{ width: '340px', maxWidth: '90vw' }}
                >
                  <div className="card-header bg-slate-900 text-white d-flex align-items-center justify-content-between py-2 px-3 rounded-top-4">
                    <span className="text-xs fw-bold">Supplier Notifications</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-white-50 p-0 text-xs text-decoration-none"
                      onClick={() => setShowNotificationDropdown(false)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="card-body p-0 max-h-80 overflow-y-auto">
                    {loadingNotifications ? (
                      <div className="text-center py-3 text-muted text-xs">
                        <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                        Loading alerts...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="text-center py-4 text-muted text-xs">
                        <i className="bi bi-bell-slash fs-4 d-block mb-1 text-slate-300"></i>
                        No notifications yet.
                      </div>
                    ) : (
                      <div className="list-group list-group-flush text-xs">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`list-group-item list-group-item-action p-2.5 ${!n.is_read ? 'bg-teal-50 border-start border-3 border-teal-500' : ''}`}
                          >
                            <div className="fw-semibold text-slate-800">{n.title}</div>
                            <div className="text-slate-600 text-[11px] mt-0.5">{n.message}</div>
                            <div className="text-slate-400 text-[10px] mt-1">
                              {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Pill */}
            <div className="d-flex align-items-center gap-2 border-start border-slate-200 ps-3">
              <div className="text-end d-none d-md-block">
                <div className="text-xs fw-bold text-slate-900">{user?.first_name || user?.username}</div>
                <div className="text-[11px] text-teal-600 fw-semibold">Supplier Account</div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-1 text-xs"
                onClick={handleSignOut}
                title="Sign out of Supplier Portal"
              >
                <i className="bi bi-box-arrow-right me-1"></i>
                <span className="d-none d-sm-inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Child Views */}
        <main className="p-3 p-lg-4 flex-grow-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SupplierLayout;

