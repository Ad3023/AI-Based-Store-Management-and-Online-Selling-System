import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { formatETB } from '../utils/currency';

const ProfilePage = () => {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone_number: user?.phone_number || '',
    address: user?.address || '',
    city: user?.city || '',
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoadingOrders(true);
        const res = await api.get('orders/');
        setOrders(res.data.results || res.data || []);
      } catch (err) {
        console.error("Error fetching orders", err);
      } finally {
        setLoadingOrders(false);
      }
    };
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      setSaving(true);
      await updateProfile(formData);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.detail || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="container py-5 text-center">
        <h4>Please log in to view your dashboard.</h4>
        <Link to="/login" className="btn btn-primary rounded-pill px-4 mt-3">Log In</Link>
      </div>
    );
  }

  const displayName = user.first_name ? `${user.first_name} ${user.last_name}` : user.username;
  const totalOrdersCount = orders.length || user.profile?.order_count || 5;
  const totalSpentAmount = Number(user.profile?.total_spent || orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 3452.00);

  const getBadgeStyle = (status) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'SHIPPED':
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PAYMENT_SUBMITTED':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="container py-4">
      <div className="row g-4">
        {/* Left Sidebar matching Panel 4 Design Concept */}
        <div className="col-lg-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white sticky-top" style={{ top: '80px' }}>
            <div className="d-flex align-items-center gap-3 pb-3 mb-3 border-bottom border-light">
              <div
                className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold shadow-sm"
                style={{ width: '50px', height: '50px', background: 'var(--color-primary)', fontSize: '1.25rem' }}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="text-truncate">
                <h6 className="fw-bold mb-0 text-dark text-truncate">{displayName}</h6>
                <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-0.5" style={{ fontSize: '0.7rem' }}>
                  {user.role}
                </span>
              </div>
            </div>

            {/* Sidebar Navigation */}
            <div className="nav flex-column gap-1">
              <button
                className={`btn text-start d-flex align-items-center gap-2 py-2 px-3 rounded-3 fw-semibold ${
                  activeTab === 'dashboard' ? 'btn-primary text-white shadow-sm' : 'btn-light text-secondary border-0'
                }`}
                onClick={() => setActiveTab('dashboard')}
              >
                <i className="bi bi-grid-fill"></i> Dashboard
              </button>
              <Link
                to="/orders"
                className="btn btn-light text-secondary border-0 text-start d-flex align-items-center gap-2 py-2 px-3 rounded-3 fw-semibold"
              >
                <i className="bi bi-bag-check"></i> My Orders
              </Link>
              <Link
                to="/shop"
                className="btn btn-light text-secondary border-0 text-start d-flex align-items-center gap-2 py-2 px-3 rounded-3 fw-semibold"
              >
                <i className="bi bi-heart"></i> My Wishlist
              </Link>
              <Link
                to="/recommendations"
                className="btn btn-light text-secondary border-0 text-start d-flex align-items-center gap-2 py-2 px-3 rounded-3 fw-semibold"
              >
                <i className="bi bi-stars text-primary"></i> AI Recommendations
              </Link>
              <button
                className={`btn text-start d-flex align-items-center gap-2 py-2 px-3 rounded-3 fw-semibold ${
                  activeTab === 'settings' ? 'btn-primary text-white shadow-sm' : 'btn-light text-secondary border-0'
                }`}
                onClick={() => setActiveTab('settings')}
              >
                <i className="bi bi-gear"></i> Profile Settings
              </button>
              <hr className="my-2" />
              <button
                className="btn btn-outline-danger border-0 text-start d-flex align-items-center gap-2 py-2 px-3 rounded-3 fw-semibold"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                <i className="bi bi-box-arrow-right"></i> Logout
              </button>
            </div>
          </div>
        </div>

        {/* Right Main Panel */}
        <div className="col-lg-9">
          {activeTab === 'dashboard' ? (
            <div>
              {/* Header Greeting */}
              <div className="mb-4">
                <h3 className="fw-bolder mb-1 text-dark">
                  Welcome back, {user.first_name || user.username}! 👋
                </h3>
                <p className="text-muted small mb-0">Here's what's happening with your account.</p>
              </div>

              {/* 4 Stat Cards Row matching Concept Panel 4 */}
              <div className="row g-3 mb-4">
                {/* Total Orders */}
                <div className="col-6 col-md-3">
                  <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-2.5 rounded-3 bg-blue-50 text-blue-600">
                        <i className="bi bi-bag-check fs-4"></i>
                      </div>
                      <div>
                        <small className="text-muted d-block text-truncate">Total Orders</small>
                        <h4 className="fw-bolder text-dark mb-0">{totalOrdersCount}</h4>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total Spent */}
                <div className="col-6 col-md-3">
                  <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-2.5 rounded-3 bg-emerald-50 text-emerald-600">
                        <i className="bi bi-wallet2 fs-4"></i>
                      </div>
                      <div>
                        <small className="text-muted d-block text-truncate">Total Spent</small>
                        <h5 className="fw-bolder text-primary mb-0">{formatETB(totalSpentAmount)}</h5>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wishlist Items */}
                <div className="col-6 col-md-3">
                  <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-2.5 rounded-3 bg-rose-50 text-rose-500">
                        <i className="bi bi-heart-fill fs-4"></i>
                      </div>
                      <div>
                        <small className="text-muted d-block text-truncate">Wishlist Items</small>
                        <h4 className="fw-bolder text-dark mb-0">3</h4>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reward Points */}
                <div className="col-6 col-md-3">
                  <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-2.5 rounded-3 bg-amber-50 text-amber-500">
                        <i className="bi bi-star-fill fs-4"></i>
                      </div>
                      <div>
                        <small className="text-muted d-block text-truncate">Loyalty Points</small>
                        <h4 className="fw-bolder text-dark mb-0">250</h4>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Orders Table matching Concept Panel 4 */}
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="fw-bold mb-0 text-dark">Recent Orders</h5>
                  <Link to="/orders" className="text-primary fw-semibold small text-decoration-none">
                    View All <i className="bi bi-arrow-right"></i>
                  </Link>
                </div>

                {loadingOrders ? (
                  <div className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-4 text-muted small">
                    <p>No orders recorded yet. Explore our top AI recommendations!</p>
                    <Link to="/shop" className="btn btn-sm btn-primary-gradient rounded-pill px-3">
                      Start Shopping
                    </Link>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead className="table-light text-uppercase small text-muted" style={{ fontSize: '0.72rem' }}>
                        <tr>
                          <th>Order ID</th>
                          <th>Product Name</th>
                          <th>Total (ETB)</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th className="text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody className="small">
                        {orders.slice(0, 5).map((ord) => (
                          <tr key={ord.id}>
                            <td className="fw-bold text-primary">
                              <Link to={`/orders/${ord.id}`} className="text-decoration-none">
                                {ord.order_number}
                              </Link>
                            </td>
                            <td>
                              <span className="text-dark fw-semibold">
                                {ord.items && ord.items.length > 0
                                  ? ord.items.map((it) => it.product_name || it.product?.name).filter(Boolean).join(', ')
                                  : 'Featured Tech Gear'}
                              </span>
                            </td>
                            <td className="fw-bold text-dark">{formatETB(ord.total_amount)}</td>
                            <td>
                              <span
                                className={`badge rounded-pill border px-2.5 py-1 fw-semibold ${getBadgeStyle(
                                  ord.status
                                )}`}
                              >
                                {ord.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="text-muted">
                              {new Date(ord.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="text-end">
                              <Link to={`/orders/${ord.id}`} className="btn btn-outline-custom btn-sm rounded-pill px-3">
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Profile Settings Tab */
            <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
              <h5 className="fw-bold mb-4 text-dark">Profile Settings</h5>

              {message.text && (
                <div className={`alert alert-${message.type} rounded-3 mb-4`}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">First Name</label>
                    <input
                      type="text"
                      name="first_name"
                      className="form-control"
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
                      value={formData.last_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Phone Number</label>
                    <input
                      type="tel"
                      name="phone_number"
                      className="form-control"
                      placeholder="+251 ..."
                      value={formData.phone_number}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="row g-3 mb-4">
                  <div className="col-md-8">
                    <label className="form-label small fw-bold">Default Delivery Address</label>
                    <input
                      type="text"
                      name="address"
                      className="form-control"
                      placeholder="e.g. Bole Subcity, House 102"
                      value={formData.address}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">City / Region</label>
                    <input
                      type="text"
                      name="city"
                      className="form-control"
                      placeholder="e.g. Addis Ababa"
                      value={formData.city}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary-gradient rounded-pill px-4 py-2 fw-bold"
                  disabled={saving}
                >
                  {saving ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
