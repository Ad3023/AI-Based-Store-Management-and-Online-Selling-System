import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    role: 'customer',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const user = await register(formData);
      if (user.role === 'store_manager') {
        navigate('/manager');
      } else {
        navigate('/');
      }
    } catch (err) {
      const errData = err.response?.data;
      if (typeof errData === 'object') {
        const msg = Object.entries(errData)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(' ') : val}`)
          .join(' | ');
        setError(msg || 'Registration failed.');
      } else {
        setError('Registration failed. Please check inputs.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-9 col-lg-6">
          <div className="card border-0 shadow-lg rounded-4 p-4 p-md-5 bg-white">
            <div className="text-center mb-4">
              <div
                className="mx-auto rounded-3 d-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
                style={{ width: '50px', height: '50px', background: 'var(--gradient-primary)' }}
              >
                <i className="bi bi-person-plus-fill fs-4"></i>
              </div>
              <h3 className="fw-bolder">Create Your Account</h3>
              <p className="text-muted small">Join NexusStore to get personalized AI product suggestions</p>
            </div>

            {error && (
              <div className="alert alert-danger rounded-3 small mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister}>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    className="form-control"
                    placeholder="e.g. Abebe"
                    value={formData.first_name}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    className="form-control"
                    placeholder="e.g. Bikila"
                    value={formData.last_name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold">Username *</label>
                <input
                  type="text"
                  name="username"
                  className="form-control"
                  placeholder="Choose a unique username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  className="form-control"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold">Phone Number</label>
                <input
                  type="tel"
                  name="phone_number"
                  className="form-control"
                  placeholder="+251 9..."
                  value={formData.phone_number}
                  onChange={handleChange}
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold">Password * (Min 6 characters)</label>
                <input
                  type="password"
                  name="password"
                  className="form-control"
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary-gradient w-100 rounded-pill py-2 fw-bold mb-3 shadow-sm"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Register Account'}
              </button>
            </form>

            <div className="text-center small text-muted">
              Already have an account? <Link to="/login" className="text-primary fw-bold text-decoration-none">Sign In</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
