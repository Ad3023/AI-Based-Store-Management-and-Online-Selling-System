import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../api';
import { formatETB } from '../utils/currency';
import ProductCard from '../components/ProductCard';

const ProfilePage = () => {
  const { user, updateProfile, logout } = useAuth();
  const { cartCount } = useCart();
  const { notifications, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Tab State
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [orders, setOrders] = useState([]);
  const [warrantyClaims, setWarrantyClaims] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // Profile Form
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone_number: user?.phone_number || '',
    address: user?.address || '',
    city: user?.city || '',
  });

  // Feedback Form
  const [feedbackForm, setFeedbackForm] = useState({
    category: 'CUSTOMER_SERVICE',
    subject: '',
    message: '',
    order_number: '',
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    let isMounted = true;
    const fetchUserData = async () => {
      if (!user) return;
      try {
        setLoadingOrders(true);
        const oRes = await api.get('orders/');
        if (isMounted) {
          setOrders(oRes.data.results || oRes.data || []);
        }
      } catch (err) {
        console.error('Orders fetch error', err);
      } finally {
        if (isMounted) setLoadingOrders(false);
      }

      try {
        setLoadingClaims(true);
        const wRes = await api.get('orders/warranty-claims/').catch(() => ({ data: [] }));
        if (isMounted) {
          setWarrantyClaims(wRes.data.results || wRes.data || []);
        }
      } catch (err) {
        console.error('Warranty claims fetch error', err);
      } finally {
        if (isMounted) setLoadingClaims(false);
      }

      try {
        setLoadingFeedback(true);
        const fRes = await api.get('products/feedback/').catch(() => ({ data: [] }));
        if (isMounted) {
          setFeedbackList(fRes.data.results || fRes.data || []);
        }
      } catch (err) {
        console.error('Feedback fetch error', err);
      } finally {
        if (isMounted) setLoadingFeedback(false);
      }

      try {
        const rRes = await api.get('recommendations/personalized/?limit=4').catch(() => ({ data: { results: [] } }));
        if (isMounted) {
          setRecommendations(rRes.data.results || []);
        }
      } catch {
        // Silently handle
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      setSaving(true);
      await updateProfile(formData);
      setMessage({ type: 'success', text: 'Profile details updated successfully.' });
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to update profile.';
      setMessage({ type: 'danger', text: errMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackForm.subject || !feedbackForm.message) {
      alert('Please fill in subject and message.');
      return;
    }
    try {
      setSubmittingFeedback(true);
      await api.post('products/feedback/', feedbackForm);
      setMessage({ type: 'success', text: 'Your feedback was submitted! Our support team will review it shortly.' });
      setFeedbackForm({
        category: 'CUSTOMER_SERVICE',
        subject: '',
        message: '',
        order_number: '',
      });
      // Refresh list
      const res = await api.get('products/feedback/');
      setFeedbackList(res.data.results || res.data || []);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (!user) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '480px' }}>
          <i className="bi bi-person-lock fs-1 text-primary mb-3"></i>
          <h4 className="fw-bolder">Please Sign In</h4>
          <p className="text-muted small mb-4">You must authenticate before accessing your account dashboard.</p>
          <Link to="/login?redirect=/profile" className="btn btn-primary rounded-pill px-4">Sign In</Link>
        </div>
      </div>
    );
  }

  const displayName = user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.username;
  const verifiedOrdersCount = orders.filter((o) =>
    ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status)
  ).length;

  const getBadgeClass = (status) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-success text-white';
      case 'SHIPPED':
        return 'bg-info text-dark';
      case 'PROCESSING':
        return 'bg-primary text-white';
      case 'PAYMENT_PENDING':
        return 'bg-warning text-dark';
      case 'CANCELLED':
        return 'bg-danger text-white';
      default:
        return 'bg-secondary text-white';
    }
  };

  return (
    <div className="container py-4">
      {/* Breadcrumb Navigation */}
      <nav aria-label="breadcrumb" className="mb-4">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
          <li className="breadcrumb-item active" aria-current="page">Customer Account</li>
        </ol>
      </nav>

      <div className="row g-4">
        {/* Left Sidebar Navigation (Exact items requested) */}
        <div className="col-lg-3">
          <div className="card border-0 shadow-sm rounded-4 p-3.5 bg-white sticky-top" style={{ top: '80px' }}>
            {/* User Profile Mini Header */}
            <div className="d-flex align-items-center gap-3 pb-3 mb-3 border-bottom border-slate-100">
              <div
                className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold shadow-sm"
                style={{ width: '46px', height: '46px', background: 'var(--gradient-primary)', fontSize: '1.1rem' }}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="text-truncate">
                <h6 className="fw-bolder mb-0 text-slate-900 text-truncate">{displayName}</h6>
                <div className="text-xs text-slate-400 text-truncate">{user.email}</div>
                <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-0.5 text-[10px] uppercase font-bold mt-1">
                  Customer
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="nav flex-column gap-1">
              <button
                className={`btn text-start d-flex align-items-center gap-2.5 py-2 px-3 rounded-xl fw-semibold text-xs transition ${
                  activeTab === 'profile' ? 'btn-primary text-white shadow-sm' : 'btn-light text-slate-600 border-0 hover:bg-slate-100'
                }`}
                onClick={() => setActiveTab('profile')}
              >
                <i className="bi bi-person-circle"></i> My Profile
              </button>

              <Link
                to="/cart"
                className="btn btn-light text-slate-600 border-0 text-start d-flex justify-content-between align-items-center py-2 px-3 rounded-xl fw-semibold text-xs hover:bg-slate-100"
              >
                <div className="d-flex align-items-center gap-2.5">
                  <i className="bi bi-cart3 text-primary"></i> My Cart
                </div>
                <span className="badge bg-primary text-white rounded-pill px-2">{cartCount}</span>
              </Link>

              <button
                className={`btn text-start d-flex align-items-center gap-2.5 py-2 px-3 rounded-xl fw-semibold text-xs transition ${
                  activeTab === 'orders' ? 'btn-primary text-white shadow-sm' : 'btn-light text-slate-600 border-0 hover:bg-slate-100'
                }`}
                onClick={() => setActiveTab('orders')}
              >
                <i className="bi bi-bag-check-fill"></i> My Orders ({orders.length})
              </button>

              <button
                className={`btn text-start d-flex align-items-center gap-2.5 py-2 px-3 rounded-xl fw-semibold text-xs transition ${
                  activeTab === 'receipts' ? 'btn-primary text-white shadow-sm' : 'btn-light text-slate-600 border-0 hover:bg-slate-100'
                }`}
                onClick={() => setActiveTab('receipts')}
              >
                <i className="bi bi-receipt-cutoff"></i> Digital Receipts ({verifiedOrdersCount})
              </button>

              <button
                className={`btn text-start d-flex align-items-center gap-2.5 py-2 px-3 rounded-xl fw-semibold text-xs transition ${
                  activeTab === 'warranty' ? 'btn-primary text-white shadow-sm' : 'btn-light text-slate-600 border-0 hover:bg-slate-100'
                }`}
                onClick={() => setActiveTab('warranty')}
              >
                <i className="bi bi-shield-check text-emerald-600"></i> Warranty and Claims ({warrantyClaims.length})
              </button>

              <button
                className={`btn text-start d-flex align-items-center gap-2.5 py-2 px-3 rounded-xl fw-semibold text-xs transition ${
                  activeTab === 'feedback' ? 'btn-primary text-white shadow-sm' : 'btn-light text-slate-600 border-0 hover:bg-slate-100'
                }`}
                onClick={() => setActiveTab('feedback')}
              >
                <i className="bi bi-chat-left-heart"></i> My Feedback ({feedbackList.length})
              </button>

              <button
                className={`btn text-start d-flex align-items-center gap-2.5 py-2 px-3 rounded-xl fw-semibold text-xs transition ${
                  activeTab === 'notifications' ? 'btn-primary text-white shadow-sm' : 'btn-light text-slate-600 border-0 hover:bg-slate-100'
                }`}
                onClick={() => setActiveTab('notifications')}
              >
                <i className="bi bi-bell"></i> Notifications
                {notifications.filter((n) => !n.is_read).length > 0 && (
                  <span className="badge bg-danger rounded-pill ms-auto">
                    {notifications.filter((n) => !n.is_read).length}
                  </span>
                )}
              </button>

              <button
                className={`btn text-start d-flex align-items-center gap-2.5 py-2 px-3 rounded-xl fw-semibold text-xs transition ${
                  activeTab === 'settings' ? 'btn-primary text-white shadow-sm' : 'btn-light text-slate-600 border-0 hover:bg-slate-100'
                }`}
                onClick={() => setActiveTab('settings')}
              >
                <i className="bi bi-gear"></i> Settings
              </button>

              <hr className="my-2 border-slate-200" />

              <button
                className="btn btn-outline-danger btn-sm text-start d-flex align-items-center gap-2 py-2 px-3 rounded-xl fw-semibold text-xs mt-1"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                <i className="bi bi-box-arrow-right"></i> Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Right Main Content */}
        <div className="col-lg-9">
          {message.text && (
            <div className={`alert alert-${message.type} alert-dismissible fade show rounded-3 small mb-4`} role="alert">
              {message.text}
              <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })}></button>
            </div>
          )}

          {/* TAB 1: MY PROFILE */}
          {activeTab === 'profile' && (
            <div>
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
                <div className="mb-4">
                  <h4 className="fw-bolder text-slate-900 mb-1">My Customer Profile</h4>
                  <p className="text-slate-500 text-xs mb-0">Your personal credentials and default delivery address details</p>
                </div>

                <form onSubmit={handleProfileSubmit}>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-xs fw-bold text-slate-700">First Name</label>
                      <input
                        type="text"
                        name="first_name"
                        className="form-control text-sm py-2"
                        value={formData.first_name}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Last Name</label>
                      <input
                        type="text"
                        name="last_name"
                        className="form-control text-sm py-2"
                        value={formData.last_name}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Email Address (Read-only)</label>
                      <input
                        type="email"
                        className="form-control text-sm py-2 bg-slate-50"
                        value={user.email}
                        disabled
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Phone Number</label>
                      <input
                        type="tel"
                        name="phone_number"
                        className="form-control text-sm py-2"
                        placeholder="+251 9..."
                        value={formData.phone_number}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-xs fw-bold text-slate-700">Delivery Address</label>
                    <textarea
                      name="address"
                      className="form-control text-sm py-2"
                      rows="2"
                      placeholder="Street, Subcity, House No."
                      value={formData.address}
                      onChange={handleChange}
                    ></textarea>
                  </div>

                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label text-xs fw-bold text-slate-700">City / Region</label>
                      <input
                        type="text"
                        name="city"
                        className="form-control text-sm py-2"
                        placeholder="e.g. Addis Ababa"
                        value={formData.city}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-xs fw-bold text-slate-700">Account Role</label>
                      <input
                        type="text"
                        className="form-control text-sm py-2 bg-slate-50 text-uppercase fw-bold text-primary"
                        value={user.role}
                        disabled
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary-gradient rounded-pill px-4 py-2.5 fw-bold text-sm shadow-md"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </form>
              </div>

              {recommendations.length > 0 && (
                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold text-slate-900 mb-0">Recommended for You</h6>
                    <Link to="/recommendations" className="text-primary text-xs fw-bold text-decoration-none">
                      View all &rarr;
                    </Link>
                  </div>
                  <div className="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-3">
                    {recommendations.slice(0, 4).map((p) => (
                      <div key={p.id} className="col">
                        <ProductCard product={p} aiTag="Personalized" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY ORDERS */}
          {activeTab === 'orders' && (
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h4 className="fw-bolder text-slate-900 mb-1">My Orders & Tracking</h4>
                  <p className="text-slate-500 text-xs mb-0">Track real-time delivery milestones and payment status</p>
                </div>
                <Link to="/track" className="btn btn-outline-custom btn-sm rounded-pill px-3">
                  <i className="bi bi-geo-alt me-1"></i> Live Tracker
                </Link>
              </div>

              {loadingOrders ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status"></div>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-5 bg-slate-50 rounded-3">
                  <p className="text-muted small mb-3">You have not placed any orders yet.</p>
                  <Link to="/shop" className="btn btn-primary rounded-pill px-4 btn-sm">Shop Catalog</Link>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead className="table-light text-uppercase text-[11px] text-slate-500">
                      <tr>
                        <th>Order #</th>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Total Amount</th>
                        <th>Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td className="fw-bold">
                            <Link to={`/orders/${o.id}`} className="text-primary text-decoration-none">
                              {o.order_number}
                            </Link>
                          </td>
                          <td className="text-slate-500">{new Date(o.created_at).toLocaleDateString()}</td>
                          <td className="text-slate-700">{o.items?.length || 1} items</td>
                          <td className="fw-bold text-slate-900">{formatETB(o.total_amount)}</td>
                          <td>
                            <span className={`badge rounded-pill px-2.5 py-1 text-[10px] uppercase font-bold ${getBadgeClass(o.status)}`}>
                              {o.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end gap-1.5">
                              <Link to={`/orders/${o.id}`} className="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-1">
                                View
                              </Link>
                              {['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status) && (
                                <Link to={`/receipts/${o.id}`} className="btn btn-sm btn-outline-success rounded-pill px-2.5 py-1">
                                  Receipt
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIGITAL RECEIPTS */}
          {activeTab === 'receipts' && (
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
              <div className="mb-4">
                <h4 className="fw-bolder text-slate-900 mb-1">Official Digital Receipts</h4>
                <p className="text-slate-500 text-xs mb-0">
                  Tax-compliant digital receipts generated automatically after verified Chapa payment.
                </p>
              </div>

              {orders.filter((o) => ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status)).length === 0 ? (
                <div className="text-center py-5 bg-slate-50 rounded-3">
                  <i className="bi bi-receipt-cutoff fs-1 text-slate-400 mb-2 d-block"></i>
                  <h6 className="fw-bold text-slate-700">No verified receipts yet</h6>
                  <p className="text-slate-400 text-xs mb-0">
                    Receipts are automatically generated immediately once your Chapa payment is confirmed.
                  </p>
                </div>
              ) : (
                <div className="row g-3">
                  {orders
                    .filter((o) => ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status))
                    .map((o) => (
                      <div key={o.id} className="col-md-6">
                        <div className="p-4 rounded-3 border border-slate-200 bg-slate-50 h-100 d-flex flex-column justify-content-between">
                          <div>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2.5 py-1 text-[10px] font-bold">
                                VERIFIED PAID
                              </span>
                              <small className="text-slate-400 text-[11px]">
                                {new Date(o.created_at).toLocaleDateString()}
                              </small>
                            </div>
                            <h6 className="fw-bold text-slate-900 mb-1">Order #{o.order_number}</h6>
                            <p className="text-slate-500 text-xs mb-2">Total: <strong>{formatETB(o.total_amount)}</strong></p>
                            <div className="text-[11px] text-slate-500 mb-1">
                              Payment Gateway: <strong>Chapa</strong>
                            </div>
                            {o.chapa_reference && (
                              <div className="text-[10px] text-muted">
                                Tx Ref: <code>{o.chapa_reference}</code>
                              </div>
                            )}
                          </div>

                          <div className="pt-3 border-top border-slate-200 mt-3">
                            <Link to={`/receipts/${o.id}`} className="btn btn-primary-gradient btn-sm rounded-pill px-3 py-1.5 w-100 fw-bold">
                              <i className="bi bi-printer me-1"></i> View & Print Receipt
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: WARRANTY AND CLAIMS */}
          {activeTab === 'warranty' && (
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h4 className="fw-bolder text-slate-900 mb-1">Warranty Coverage & Claims</h4>
                  <p className="text-slate-500 text-xs mb-0">
                    Official snapshot policies recorded with your purchases, active coverage dates, and claim status
                  </p>
                </div>
              </div>

              {loadingClaims ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status"></div>
                </div>
              ) : (
                <>
                  <h6 className="fw-bold text-slate-800 mb-3">Submitted Claims ({warrantyClaims.length})</h6>
                  {warrantyClaims.length === 0 ? (
                    <div className="text-center py-4 bg-slate-50 rounded-3 mb-4 text-muted small">
                      You have not submitted any warranty claims. You can submit claims directly from any verified order item.
                    </div>
                  ) : (
                    <div className="table-responsive mb-4">
                      <table className="table align-middle text-xs">
                        <thead className="table-light text-slate-600">
                          <tr>
                            <th>Claim #</th>
                            <th>Product</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Resolution Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {warrantyClaims.map((wc) => (
                            <tr key={wc.id}>
                              <td><strong>{wc.claim_number}</strong></td>
                              <td>{wc.product_name}</td>
                              <td>{new Date(wc.created_at).toLocaleDateString()}</td>
                              <td>
                                <span
                                  className={`badge rounded-pill px-2.5 py-1 ${
                                    wc.status === 'APPROVED' || wc.status === 'RESOLVED'
                                      ? 'bg-success'
                                      : wc.status === 'REJECTED'
                                      ? 'bg-danger'
                                      : 'bg-warning text-dark'
                                  }`}
                                >
                                  {wc.status}
                                </span>
                              </td>
                              <td>
                                {wc.resolution_details || wc.rejection_reason || (
                                  <span className="text-muted">Under review</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <hr className="my-4" />

                  <h6 className="fw-bold text-slate-800 mb-2">Purchased Products with Active Warranty</h6>
                  <p className="text-muted text-xs mb-3">
                    Every hardware product purchased includes the exact official warranty policy recorded at the time of purchase.
                  </p>
                  <div className="row g-3">
                    {orders
                      .filter((o) => ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status))
                      .flatMap((o) => o.items || [])
                      .map((item, idx) => (
                        <div key={`w-item-${idx}`} className="col-md-6">
                          <div className="p-3 rounded-3 border bg-slate-50">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <strong className="text-slate-900 small">{item.product_name}</strong>
                              <span className="badge bg-cyan-100 text-cyan-800 rounded-pill px-2 py-0.5 text-[10px]">
                                {item.warranty_duration_days ? `${item.warranty_duration_days} Days Policy` : 'Standard Coverage'}
                              </span>
                            </div>
                            <div className="text-xs text-muted mb-2">
                              {item.warranty_coverage || 'Comprehensive replacement & manufacturer guarantee.'}
                            </div>
                            {item.warranty_end_date && (
                              <div className="text-xs text-slate-700">
                                <strong>Valid until:</strong> {new Date(item.warranty_end_date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 5: MY FEEDBACK */}
          {activeTab === 'feedback' && (
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
              <div className="mb-4">
                <h4 className="fw-bolder text-slate-900 mb-1">Customer Service & Feedback</h4>
                <p className="text-slate-500 text-xs mb-0">Submit inquiries, praise, or complaints directly to the store management</p>
              </div>

              {/* Submit Form */}
              <form onSubmit={handleFeedbackSubmit} className="mb-5 p-4 rounded-3 bg-slate-50 border">
                <h6 className="fw-bold text-slate-800 mb-3">Send Message to Management</h6>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label text-xs fw-bold text-slate-700">Inquiry Category *</label>
                    <select
                      className="form-select text-sm"
                      value={feedbackForm.category}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, category: e.target.value })}
                    >
                      <option value="CUSTOMER_SERVICE">Customer Service</option>
                      <option value="ORDER_ISSUE">Order Issue / Delivery</option>
                      <option value="PRODUCT_QUALITY">Product Quality</option>
                      <option value="SUGGESTION">Store Suggestion</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label text-xs fw-bold text-slate-700">Related Order Number (Optional)</label>
                    <input
                      type="text"
                      className="form-control text-sm"
                      placeholder="e.g. ORD-20261022-XXXX"
                      value={feedbackForm.order_number}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, order_number: e.target.value })}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label text-xs fw-bold text-slate-700">Subject *</label>
                    <input
                      type="text"
                      className="form-control text-sm"
                      placeholder="Summary of your inquiry..."
                      value={feedbackForm.subject}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, subject: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label text-xs fw-bold text-slate-700">Message *</label>
                    <textarea
                      className="form-control text-sm"
                      rows="3"
                      placeholder="Please provide details about your inquiry or feedback..."
                      value={feedbackForm.message}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                      required
                    ></textarea>
                  </div>

                  <div className="col-12">
                    <button
                      type="submit"
                      className="btn btn-primary rounded-pill px-4 fw-bold text-xs"
                      disabled={submittingFeedback}
                    >
                      {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Submissions List */}
              <h6 className="fw-bold text-slate-800 mb-3">Your Previous Inquiries ({feedbackList.length})</h6>
              {loadingFeedback ? (
                <div className="text-center py-3">
                  <div className="spinner-border text-primary" role="status"></div>
                </div>
              ) : feedbackList.length === 0 ? (
                <div className="text-center py-4 text-muted small bg-light rounded-3">
                  No inquiries submitted yet.
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {feedbackList.map((fb) => (
                    <div key={fb.id} className="p-3 rounded-3 border bg-light">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <strong className="text-slate-900 small">{fb.subject}</strong>
                        <span
                          className={`badge rounded-pill px-2.5 py-1 text-[10px] ${
                            fb.status === 'RESOLVED' ? 'bg-success' : 'bg-warning text-dark'
                          }`}
                        >
                          {fb.status}
                        </span>
                      </div>
                      <p className="text-muted text-xs mb-2">{fb.message}</p>
                      {fb.admin_response && (
                        <div className="p-2.5 rounded-2 bg-white border border-success border-opacity-30 text-xs">
                          <strong className="text-success d-block mb-1">
                            <i className="bi bi-reply-fill me-1"></i> Staff Response:
                          </strong>
                          <span className="text-slate-800">{fb.admin_response}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h4 className="fw-bolder text-slate-900 mb-1">In-App Notifications</h4>
                  <p className="text-slate-500 text-xs mb-0">Real-time alerts for payments, order milestones, and warranty updates</p>
                </div>
                {notifications.length > 0 && (
                  <button onClick={markAllAsRead} className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs">
                    Mark All as Read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-5 bg-slate-50 rounded-3 text-muted small">
                  <i className="bi bi-bell-slash fs-1 text-slate-400 mb-2 d-block"></i>
                  No notifications yet.
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-3 border transition ${
                        n.is_read ? 'bg-white' : 'bg-blue-50 border-blue-200'
                      }`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        markAsRead(n.id);
                        if (n.link) navigate(n.link);
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <strong className="text-slate-900 small">{n.title}</strong>
                        <small className="text-muted text-[11px]">{new Date(n.created_at).toLocaleString()}</small>
                      </div>
                      <p className="text-secondary text-xs mb-0">{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
              <div className="mb-4">
                <h4 className="fw-bolder text-slate-900 mb-1">Account & Security Settings</h4>
                <p className="text-slate-500 text-xs mb-0">Manage password and security options for your customer account</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-3 border mb-4">
                <h6 className="fw-bold text-slate-800 small mb-2">Password Update</h6>
                <p className="text-muted text-xs mb-3">
                  Need to change or reset your password? You can request a secure reset link.
                </p>
                <Link to="/forgot-password" className="btn btn-sm btn-outline-primary rounded-pill px-3">
                  Request Password Reset
                </Link>
              </div>

              <div className="p-3 bg-slate-50 rounded-3 border">
                <h6 className="fw-bold text-slate-800 small mb-2">Account Privacy</h6>
                <p className="text-muted text-xs mb-0">
                  Your payment data is securely verified through Chapa. We never store debit/credit card numbers or secret PINs on our servers.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
