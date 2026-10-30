import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute: Requires user to be authenticated.
 * Redirects to /login?redirect=... if not logged in.
 */
export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Checking authentication...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return children;
};

/**
 * PermissionRoute: Requires user to have a specific granular permission or any of given permissions.
 */
export const PermissionRoute = ({ permission, permissions: permList, children }) => {
  const { user, loading, isSuperAdmin, hasPermission, hasAnyPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const authorized = isSuperAdmin ||
    (permission ? hasPermission(permission) : true) &&
    (permList ? hasAnyPermission(permList) : true);

  if (!authorized) {
    const requiredStr = permission || (permList ? permList.join(', ') : 'Specialized privileges');
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-lg rounded-4 p-5 mx-auto max-w-lg bg-white">
          <i className="bi bi-shield-slash fs-1 text-danger mb-3"></i>
          <h4 className="fw-bolder text-slate-900">403 - Permission Required</h4>
          <p className="text-slate-500 small mb-2">
            Your account ({user.username}, Role: <strong className="text-uppercase">{user.role}</strong>) does not have the required permission:
          </p>
          <div className="badge bg-danger bg-opacity-10 text-danger font-monospace px-3 py-2 mb-4">
            {requiredStr}
          </div>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/manager" className="btn btn-primary rounded-pill px-4">Dashboard</Link>
            <Link to="/" className="btn btn-outline-secondary rounded-pill px-4">Storefront</Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

/**
 * ManagerRoute: Requires Store Manager, Sub-Admin, Admin, or Super Admin role.
 */
export const ManagerRoute = ({ children }) => {
  const { user, loading, isManagerOrAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!isManagerOrAdmin) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-lg rounded-4 p-5 mx-auto max-w-lg bg-white">
          <i className="bi bi-shield-x fs-1 text-danger mb-3"></i>
          <h4 className="fw-bolder text-slate-900">403 - Forbidden</h4>
          <p className="text-slate-500 small mb-4">
            Your account ({user.username}, Role: <strong className="text-uppercase">{user.role}</strong>) does not have staff or management privileges.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/" className="btn btn-primary rounded-pill px-4">Return to Storefront</Link>
            <Link to="/profile" className="btn btn-outline-secondary rounded-pill px-4">Customer Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

/**
 * OrderManagerRoute: Requires Order Manager, Store Manager, Admin, or orders.view permission.
 */
export const OrderManagerRoute = ({ children }) => {
  const { user, loading, isOrderManager, isStoreManager, isAdmin, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const authorized = isOrderManager || isStoreManager || isAdmin || hasPermission('orders.view');

  if (!authorized) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-lg rounded-4 p-5 mx-auto max-w-lg bg-white">
          <i className="bi bi-shield-x fs-1 text-danger mb-3"></i>
          <h4 className="fw-bolder text-slate-900">403 - Order Manager Access Required</h4>
          <p className="text-slate-500 small mb-4">
            Your account ({user.username}, Role: <strong className="text-uppercase">{user.role}</strong>) does not have order fulfillment or management privileges.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/" className="btn btn-primary rounded-pill px-4">Return to Storefront</Link>
            <Link to="/profile" className="btn btn-outline-secondary rounded-pill px-4">Customer Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

/**
 * AdminRoute: Strictly requires Administrator or Super Administrator role.
 */
export const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin, isSuperAdmin, hasAnyPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const authorized = isAdmin || isSuperAdmin || hasAnyPermission(['users.manage', 'roles.manage', 'audit_logs.view', 'settings.manage']);

  if (!authorized) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-lg rounded-4 p-5 mx-auto max-w-lg bg-white">
          <i className="bi bi-shield-lock-fill fs-1 text-danger mb-3"></i>
          <h4 className="fw-bolder text-slate-900">403 - Administrator Access Required</h4>
          <p className="text-slate-500 small mb-4">
            This module is strictly restricted to platform Administrators, Super Administrators, and staff with explicit governance permissions.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/manager" className="btn btn-info text-dark rounded-pill px-4">Manager Overview</Link>
            <Link to="/" className="btn btn-outline-secondary rounded-pill px-4">Return to Store</Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

/**
 * SuperAdminRoute: Strictly reserved for Super Administrators.
 */
export const SuperAdminRoute = ({ children }) => {
  const { user, loading, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!isSuperAdmin) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-lg rounded-4 p-5 mx-auto max-w-lg bg-white">
          <i className="bi bi-shield-lock-fill fs-1 text-danger mb-3"></i>
          <h4 className="fw-bolder text-slate-900">403 - Super Administrator Required</h4>
          <p className="text-slate-500 small mb-4">
            This action is strictly restricted to the Super Administrator.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/manager" className="btn btn-primary rounded-pill px-4">Back to Console</Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
