import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUserRoleLabel } from '../../../utils/orderStatus';

const DashboardHeader = ({
  user,
  isAdmin,
  isOrderManager,
  unreadCount,
  showBellDropdown,
  setShowBellDropdown,
  notifications,
  markAsRead,
  markAllAsRead,
  setMobileDrawerOpen,
}) => {
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile Top Bar */}
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
          <h6 className="fw-bolder text-slate-900 mb-0">EthioTech Portal</h6>
        </div>
        <Link to="/" className="btn btn-sm btn-outline-primary text-xs py-1 px-2.5">
          <i className="bi bi-shop me-1"></i> Storefront
        </Link>
      </div>

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

        {/* Right Header Actions */}
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
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-white text-white shadow-sm" style={{ fontSize: '0.65rem' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showBellDropdown && (
              <div className="card position-absolute end-0 top-100 mt-2 shadow-lg border-0 rounded-4 z-3 overflow-hidden bg-white" style={{ width: '380px', maxWidth: '90vw' }}>
                <div className="p-3 bg-slate-900 text-white d-flex align-items-center justify-content-between border-bottom border-slate-800">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-bell-fill text-warning"></i>
                    <span className="fw-bold text-sm">Stock Alerts &amp; Notifications</span>
                    {unreadCount > 0 && (
                      <span className="badge bg-danger text-white rounded-pill text-[10px]">{unreadCount} new</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button type="button" className="btn btn-link text-info p-0 text-xs text-decoration-none fw-semibold" onClick={() => markAllAsRead()}>
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
                      const badgeBg = isZero ? 'bg-danger text-white' : isLow ? 'bg-warning text-dark' : 'bg-primary text-white';
                      const badgeText = isZero ? 'Out of Stock' : isLow ? 'Low Stock' : 'System';

                      return (
                        <div
                          key={n.id}
                          className={`p-3 border-bottom transition cursor-pointer ${!n.is_read ? 'bg-amber-50 bg-opacity-30' : 'hover:bg-slate-50'}`}
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
                            <span className={`badge rounded-pill text-[10px] fw-bold ${badgeBg}`}>{badgeText}</span>
                            <span className="text-[10px] text-muted">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="fw-bold text-xs text-slate-900 mb-1 line-clamp-1">{n.title}</div>
                          <div className="text-muted text-[11px] line-clamp-2 mb-1.5">{n.message}</div>
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
                  <button type="button" className="btn btn-sm btn-link text-muted p-0 text-xs text-decoration-none" onClick={() => setShowBellDropdown(false)}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardHeader;

