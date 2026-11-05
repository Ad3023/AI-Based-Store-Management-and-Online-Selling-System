import React from 'react';

const SupplierNavbar = ({
  supplierName,
  user,
  setMobileDrawerOpen,
  unreadCount,
  showNotificationDropdown,
  setShowNotificationDropdown,
  loadingNotifications,
  notifications,
  handleSignOut,
}) => {
  return (
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
  );
};

export default SupplierNavbar;

