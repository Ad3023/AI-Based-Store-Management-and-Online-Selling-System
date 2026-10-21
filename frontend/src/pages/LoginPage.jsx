import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const user = await login(username, password);
      if (user.role === 'store_manager') {
        navigate('/manager');
      } else if (user.role === 'admin' || user.is_superuser) {
        navigate('/manager/admin/users');
      } else {
        navigate(redirectTarget);
      }
    } catch (err) {
      setError(err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || "Invalid login credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (u, p, dest) => {
    setUsername(u);
    setPassword(p);
    setError('');
    try {
      setLoading(true);
      await login(u, p);
      navigate(dest);
    } catch (err) {
      setError("Demo login error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-5">
          <div className="card border-0 shadow-lg rounded-4 p-4 p-md-5 bg-white">
            <div className="text-center mb-4">
              <div
                className="mx-auto rounded-3 d-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
                style={{ width: '50px', height: '50px', background: 'var(--gradient-primary)' }}
              >
                <i className="bi bi-cpu-fill fs-4"></i>
              </div>
              <h3 className="fw-bolder">Welcome Back</h3>
              <p className="text-muted small">Sign in to your NexusStore account</p>
            </div>

            {error && (
              <div className="alert alert-danger rounded-3 small mb-4 d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-circle-fill"></i>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label small fw-bold">Username or Email</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter your username or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label small fw-bold mb-0">Password</label>
                  <Link to="/forgot-password" className="text-primary text-xs text-decoration-none">
                    Forgot Password?
                  </Link>
                </div>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary-gradient w-100 rounded-pill py-2 fw-bold mb-3 shadow-sm"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            <div className="text-center small text-muted mb-4">
              Don't have an account? <Link to="/register" className="text-primary fw-bold text-decoration-none">Create Account</Link>
            </div>

            {/* Quick Demo Fill Buttons for Presentation/Testing */}
            <div className="p-3 rounded-3 bg-light border">
              <div className="small fw-bold text-dark mb-2 text-center text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                <i className="bi bi-lightning-charge-fill text-warning me-1"></i> Quick Demo Logins
              </div>
              <div className="d-grid gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary text-start d-flex justify-content-between align-items-center py-2 rounded-3"
                  onClick={() => handleQuickDemo('abebe', 'customer123', '/')}
                >
                  <span>1. Customer (Abebe)</span>
                  <span className="badge bg-primary">Customer</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-info text-start d-flex justify-content-between align-items-center py-2 rounded-3 text-dark"
                  onClick={() => handleQuickDemo('manager', 'manager123', '/manager')}
                >
                  <span>2. Store Manager</span>
                  <span className="badge bg-info text-dark">Manager</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger text-start d-flex justify-content-between align-items-center py-2 rounded-3"
                  onClick={() => handleQuickDemo('admin', 'admin123', '/manager/admin/users')}
                >
                  <span>3. Administrator</span>
                  <span className="badge bg-danger">Admin</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
