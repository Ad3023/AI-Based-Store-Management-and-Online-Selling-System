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
 * ManagerRoute: Strictly requires Store Manager or Administrator role.
 * Validated against actual backend user data.
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
            Your account ({user.username}, Role: <strong className="text-uppercase">{user.role}</strong>) does not have Store Manager or Administrator privileges.
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
 * AdminRoute: Strictly requires Administrator role.
 * Validated against actual backend user data.
 */
export const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
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

  if (!isAdmin) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-lg rounded-4 p-5 mx-auto max-w-lg bg-white">
          <i className="bi bi-shield-lock-fill fs-1 text-danger mb-3"></i>
          <h4 className="fw-bolder text-slate-900">403 - Administrator Access Required</h4>
          <p className="text-slate-500 small mb-4">
            This module is strictly restricted to platform Administrators. Store Managers and Customers are not authorized to view or manage user accounts, permissions, or system configurations.
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

export default ProtectedRoute;
