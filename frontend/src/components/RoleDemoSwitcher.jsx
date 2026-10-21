import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const RoleDemoSwitcher = () => {
  const { user, login, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleQuickLogin = async (username, password, redirectPath) => {
    try {
      setLoading(true);
      await login(username, password);
      setIsOpen(false);
      navigate(redirectPath);
    } catch (err) {
      alert("Demo login failed: " + (err.response?.data?.non_field_errors || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Demo Persona Pill */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
        }}
      >
        <button
          className="btn btn-dark shadow-lg rounded-pill px-3 py-2 d-flex align-items-center gap-2 border border-primary border-opacity-50"
          onClick={() => setIsOpen(!isOpen)}
          style={{ backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.92)' }}
        >
          <span className="spinner-grow spinner-grow-sm text-info" role="status" style={{ width: '10px', height: '10px' }}></span>
          <span className="small fw-bold text-white">Project Roles Demo</span>
          <span className="badge bg-primary text-uppercase" style={{ fontSize: '0.65rem' }}>
            {user ? user.role : 'Guest'}
          </span>
        </button>

        {isOpen && (
          <div
            className="card shadow-2xl mt-2 p-3 border-0 rounded-4"
            style={{
              position: 'absolute',
              bottom: '50px',
              right: '0',
              width: '320px',
              background: '#0f172a',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-people-fill text-info"></i> Switch Role Demo
              </h6>
              <button className="btn-close btn-close-white btn-sm" onClick={() => setIsOpen(false)}></button>
            </div>
            <p className="small text-secondary mb-3">
              1-click persona switch for testing Customer, Manager, and Admin capabilities:
            </p>

            <div className="d-grid gap-2">
              <button
                className={`btn btn-sm text-start p-2 rounded-3 d-flex align-items-center justify-content-between ${
                  user?.username === 'abebe' ? 'btn-primary' : 'btn-outline-light'
                }`}
                onClick={() => handleQuickLogin('abebe', 'customer123', '/')}
                disabled={loading}
              >
                <div>
                  <div className="fw-bold">1. Customer (Abebe)</div>
                  <small className="opacity-75">Browse, AI Recommend, Cart, Pay</small>
                </div>
                <i className="bi bi-cart3 fs-5"></i>
              </button>

              <button
                className={`btn btn-sm text-start p-2 rounded-3 d-flex align-items-center justify-content-between ${
                  user?.role === 'store_manager' ? 'btn-info text-dark' : 'btn-outline-info'
                }`}
                onClick={() => handleQuickLogin('manager', 'manager123', '/manager')}
                disabled={loading}
              >
                <div>
                  <div className="fw-bold">2. Store Manager</div>
                  <small className="opacity-75">Verify Payments, Stock, AI Segments</small>
                </div>
                <i className="bi bi-speedometer2 fs-5"></i>
              </button>

              <button
                className={`btn btn-sm text-start p-2 rounded-3 d-flex align-items-center justify-content-between ${
                  user?.role === 'admin' ? 'btn-danger' : 'btn-outline-danger'
                }`}
                onClick={() => handleQuickLogin('admin', 'admin123', '/manager/admin/users')}
                disabled={loading}
              >
                <div>
                  <div className="fw-bold">3. Administrator</div>
                  <small className="opacity-75">User Roles, Permissions, Audits</small>
                </div>
                <i className="bi bi-shield-lock fs-5"></i>
              </button>
            </div>

            {user && (
              <div className="mt-3 pt-2 border-top border-secondary text-center">
                <button
                  className="btn btn-link btn-sm text-danger text-decoration-none p-0"
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                    navigate('/');
                  }}
                >
                  <i className="bi bi-box-arrow-right me-1"></i> Log Out ({user.username})
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default RoleDemoSwitcher;
