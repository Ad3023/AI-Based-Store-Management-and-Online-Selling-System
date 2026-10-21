import React from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DashboardLayout = () => {
  const { user, logout, isStoreManager, isAdmin } = useAuth();
  const navigate = useNavigate();

  if (!user || (!isStoreManager && !isAdmin)) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '520px' }}>
          <i className="bi bi-shield-x fs-1 text-danger mb-3"></i>
          <h4 className="fw-bold">Access Restricted</h4>
          <p className="text-muted small mb-4">
            This management console is strictly reserved for Store Managers and Administrators.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/login" className="btn btn-primary rounded-pill px-4">Sign In as Manager</Link>
            <Link to="/" className="btn btn-outline-secondary rounded-pill px-4">Return Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex" style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Sidebar */}
      <aside className="dashboard-sidebar shadow-lg">
        {/* Sidebar Brand */}
        <div className="p-4 border-bottom border-secondary border-opacity-25">
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center text-white"
              style={{ width: '36px', height: '36px', background: 'var(--gradient-primary)' }}
            >
              <i className="bi bi-cpu-fill fs-5"></i>
            </div>
            <div>
              <span className="fw-bolder text-white">Nexus</span>
              <span className="text-info fw-bolder">Admin</span>
              <span className="badge bg-info bg-opacity-25 text-info ms-2" style={{ fontSize: '0.62rem' }}>PORTAL</span>
            </div>
          </Link>
        </div>

        {/* User Persona Pill */}
        <div className="p-3 mx-3 my-3 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold small"
              style={{ width: '34px', height: '34px', background: 'var(--color-primary)' }}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="text-truncate">
              <div className="fw-bold text-white small text-truncate">{user.first_name ? `${user.first_name} ${user.last_name}` : user.username}</div>
              <span className="badge bg-primary text-uppercase" style={{ fontSize: '0.6rem' }}>
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <div className="flex-grow-1 py-2">
          <div className="px-4 text-uppercase fw-bold text-secondary mb-2" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
            Store Operations
          </div>

          <NavLink
            to="/manager"
            end
            className={({ isActive }) => `dashboard-nav-item ${isActive ? 'active' : ''}`}
          >
            <i className="bi bi-grid-1x2"></i> Overview & Metrics
          </NavLink>

          <NavLink
            to="/manager/orders"
            className={({ isActive }) => `dashboard-nav-item ${isActive ? 'active' : ''}`}
          >
            <i className="bi bi-patch-check"></i> Payment & Orders
          </NavLink>

          <NavLink
            to="/manager/inventory"
            className={({ isActive }) => `dashboard-nav-item ${isActive ? 'active' : ''}`}
          >
            <i className="bi bi-box-seam"></i> Inventory & Stock
          </NavLink>

          <NavLink
            to="/manager/segmentation"
            className={({ isActive }) => `dashboard-nav-item ${isActive ? 'active' : ''}`}
          >
            <i className="bi bi-pie-chart"></i> AI Customer Segments
          </NavLink>

          <NavLink
            to="/manager/reports"
            className={({ isActive }) => `dashboard-nav-item ${isActive ? 'active' : ''}`}
          >
            <i className="bi bi-file-earmark-spreadsheet"></i> Export Reports
          </NavLink>

          {isAdmin && (
            <>
              <div className="px-4 text-uppercase fw-bold text-secondary mt-4 mb-2" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                Administrator
              </div>
              <NavLink
                to="/manager/admin/users"
                className={({ isActive }) => `dashboard-nav-item ${isActive ? 'active' : ''}`}
              >
                <i className="bi bi-shield-lock"></i> Users & Audit Logs
              </NavLink>
            </>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-top border-secondary border-opacity-25 d-flex flex-column gap-2">
          <Link to="/" className="btn btn-outline-light btn-sm text-start py-2 d-flex align-items-center gap-2 rounded-3">
            <i className="bi bi-shop"></i> View Public Store
          </Link>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="btn btn-danger btn-sm text-start py-2 d-flex align-items-center gap-2 rounded-3 bg-danger bg-opacity-25 border-danger border-opacity-50 text-danger"
          >
            <i className="bi bi-box-arrow-right"></i> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow-1 p-4 p-md-5 overflow-auto" style={{ maxHeight: '100vh' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
