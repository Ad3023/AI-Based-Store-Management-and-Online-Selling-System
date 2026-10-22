import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../api';
import { formatETB } from '../utils/currency';
import ProductCard from '../components/ProductCard';

const CustomerDashboardPage = () => {
  const { user, updateProfile, logout } = useAuth();
  const { cartCount } = useCart();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Active Tab from query param or default 'overview'
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const [orders, setOrders] = useState([]);
  const [warrantyClaims, setWarrantyClaims] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingClaims, setLoadingClaims] = useState(false);

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
    const tabFromUrl = queryParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [location.search]);

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
        const fRes = await api.get('products/feedback/').catch(() => ({ data: [] }));
        if (isMounted) {
          setFeedbackList(fRes.data.results || fRes.data || []);
        }
      } catch {
        // Silently handle
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
      setMessage({ type: 'success', text: 'Your inquiry was submitted! Our team will respond shortly.' });
      setFeedbackForm({
        category: 'CUSTOMER_SERVICE',
        subject: '',
        message: '',
        order_number: '',
      });
      const res = await api.get('products/feedback/');
      setFeedbackList(res.data.results || res.data || []);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '480px' }}>
          <i className="bi bi-person-lock fs-1 text-primary mb-3"></i>
          <h4 className="fw-bolder">Please Sign In</h4>
          <p className="text-muted small mb-4">You must authenticate before accessing your customer dashboard.</p>
          <Link to="/login?redirect=/customer/dashboard" className="btn btn-primary rounded-pill px-4">Sign In</Link>
        </div>
      </div>
    );
  }

  const displayName = user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.username;
  const verifiedOrdersCount = orders.filter((o) =>
    ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status)
  ).length;

  const totalSpentAmount = orders.reduce((sum, o) => {
    if (o.status !== 'CANCELLED') {
      return sum + Number(o.total_amount || 0);
    }
    return sum;
  }, 0);

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
    <div className="d-flex flex-column flex-md-row" style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Mobile Top Header with Drawer Toggle */}
      <div className="d-md-none bg-dark text-white p-3 d-flex justify-content-between align-items-center sticky-top z-3 border-bottom border-slate-800">
        <div className="d-flex align-items-center gap-2">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center text-white"
            style={{ width: '32px', height: '32px', background: 'var(--gradient-primary)' }}
          >
            <i className="bi bi-cpu-fill fs-6"></i>
          </div>
          <span className="fw-bold fs-6">Customer Dashboard</span>
        </div>
        <button
          className="btn btn-sm btn-outline-light rounded-pill px-3"
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          aria-label="Toggle navigation drawer"
        >
          <i className={`bi ${mobileDrawerOpen ? 'bi-x-lg' : 'bi-list'}`}></i> Menu
        </button>
      </div>

      {/* Persistent Fixed Left Sidebar for Customer */}
      <aside
        className={`dashboard-sidebar shadow-lg ${mobileDrawerOpen ? 'd-flex' : 'd-none d-md-flex'}`}
        style={{
          width: '260px',
          minWidth: '260px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          background: '#0a1020',
          color: '#ffffff',
          flexDirection: 'column',
          zIndex: 1040,
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Brand */}
        <div className="p-3.5 border-bottom border-secondary border-opacity-25 d-flex align-items-center justify-content-between">
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none text-white">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center text-white shadow-sm"
              style={{ width: '34px', height: '34px', background: 'var(--gradient-primary)' }}
            >
              <i className="bi bi-cpu-fill fs-6"></i>
            </div>
            <div>
              <span className="fw-bolder">Nexus</span>
              <span className="text-info fw-bolder">Store</span>
              <span className="badge bg-primary bg-opacity-25 text-primary ms-1.5" style={{ fontSize: '0.6rem' }}>
                CUSTOMER
              </span>
            </div>
          </Link>
        </div>

        {/* User Card */}
        <div className="p-2.5 mx-3 my-2.5 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold small shrink-0"
              style={{ width: '32px', height: '32px', background: 'var(--color-primary)' }}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="text-truncate">
              <div className="fw-bold text-white small text-truncate" style={{ fontSize: '0.78rem' }}>{displayName}</div>
              <small className="text-slate-400 text-truncate d-block" style={{ fontSize: '0.65rem' }}>{user.email}</small>
            </div>
          </div>
        </div>

        {/* Customer Navigation Links Container (Exact list requested) */}
        <div className="flex-grow-1 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: 'thin' }}>
          <div className="px-3 text-uppercase fw-bold text-secondary mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
            Account Navigation
          </div>

          {/* 1. Dashboard */}
          <button
            type="button"
            className={`w-100 text-start py-2 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 border-0 transition ${
              activeTab === 'overview' ? 'bg-primary text-white font-bold shadow-sm' : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            onClick={() => {
              setActiveTab('overview');
              setMobileDrawerOpen(false);
            }}
          >
            <i className="bi bi-grid-1x2"></i> Dashboard
          </button>

          {/* 2. Browse Products */}
          <Link
            to="/shop"
            className="w-100 text-start py-2 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none text-slate-300 hover:text-white hover:bg-slate-800 transition"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <i className="bi bi-shop"></i> Browse Products
          </Link>

          {/* 3. My Cart */}
          <Link
            to="/cart"
            className="w-100 text-start py-2 px-3 mb-1 rounded-2 text-xs d-flex justify-content-between align-items-center text-decoration-none text-slate-300 hover:text-white hover:bg-slate-800 transition"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <div className="d-flex align-items-center gap-2.5">
              <i className="bi bi-cart3 text-primary"></i> My Cart
            </div>
            <span className="badge bg-primary text-white rounded-pill px-2">{cartCount}</span>
          </Link>

          {/* 4. My Orders */}
          <button
            type="button"
            className={`w-100 text-start py-2 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 border-0 transition ${
              activeTab === 'orders' ? 'bg-primary text-white font-bold shadow-sm' : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            onClick={() => {
              setActiveTab('orders');
              setMobileDrawerOpen(false);
            }}
          >
            <i className="bi bi-bag-check"></i> My Orders ({orders.length})
          </button>

          {/* 5. Order Tracking */}
          <Link
            to="/track"
            className="w-100 text-start py-2 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 text-decoration-none text-slate-300 hover:text-white hover:bg-slate-800 transition"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <i className="bi bi-geo-alt text-info"></i> Order Tracking
          </Link>

          {/* 6. Payment History */}
          <button
            type="button"
            className={`w-100 text-start py-2 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 border-0 transition ${
              activeTab === 'payments' ? 'bg-primary text-white font-bold shadow-sm' : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            onClick={() => {
              setActiveTab('payments');
              setMobileDrawerOpen(false);
            }}
          >
            <i className="bi bi-credit-card text-cyan-400"></i> Payment History
          </button>

          {/* 7. Receipts */}
          <button
            type="button"
            className={`w-100 text-start py-2 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 border-0 transition ${
              activeTab === 'receipts' ? 'bg-primary text-white font-bold shadow-sm' : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            onClick={() => {
              setActiveTab('receipts');
              setMobileDrawerOpen(false);
            }}
          >
            <i className="bi bi-receipt-cutoff text-success"></i> Receipts ({verifiedOrdersCount})
          </button>

          {/* 8. Warranty and Claims */}
          <button
            type="button"
            className={`w-100 text-start py-2 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 border-0 transition ${
              activeTab === 'warranty' ? 'bg-primary text-white font-bold shadow-sm' : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            onClick={() => {
              setActiveTab('warranty');
              setMobileDrawerOpen(false);
            }}
          >
            <i className="bi bi-shield-check text-emerald-400"></i> Warranty and Claims ({warrantyClaims.length})
          </button>

          {/* 9. Notifications */}
          <button
            type="button"
            className={`w-100 text-start py-2 px-3 mb-1 rounded-2 text-xs d-flex justify-content-between align-items-center border-0 transition ${
              activeTab === 'notifications' ? 'bg-primary text-white font-bold shadow-sm' : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            onClick={() => {
              setActiveTab('notifications');
              setMobileDrawerOpen(false);
            }}
          >
            <div className="d-flex align-items-center gap-2.5">
              <i className="bi bi-bell"></i> Notifications
            </div>
            {notifications.filter((n) => !n.is_read).length > 0 && (
              <span className="badge bg-danger rounded-pill px-1.5 py-0.5 text-[10px]">
                {notifications.filter((n) => !n.is_read).length}
              </span>
            )}
          </button>

          {/* 10. My Profile */}
          <button
            type="button"
            className={`w-100 text-start py-2 px-3 mb-1 rounded-2 text-xs d-flex align-items-center gap-2.5 border-0 transition ${
              activeTab === 'profile' ? 'bg-primary text-white font-bold shadow-sm' : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            onClick={() => {
              setActiveTab('profile');
              setMobileDrawerOpen(false);
            }}
          >
            <i className="bi bi-person-circle"></i> My Profile
          </button>
        </div>

        {/* 11. Sign Out near the bottom */}
        <div className="p-3 border-top border-secondary border-opacity-25 mt-auto">
          <button
            onClick={handleSignOut}
            className="btn btn-danger btn-sm text-start py-2 w-100 d-flex align-items-center gap-2 rounded-3 bg-danger bg-opacity-25 border-danger border-opacity-50 text-danger text-xs fw-bold"
          >
            <i className="bi bi-box-arrow-right"></i> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area: Independent Scroll */}
      <main
        className="flex-grow-1 p-3 p-md-4 p-lg-5 overflow-y-auto"
        style={{ height: 'calc(100vh - 60px)', minHeight: '100vh' }}
      >
        {/* Navigation Breadcrumb with Back Button */}
        <div className="d-flex align-items-center mb-4">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            className="btn btn-sm btn-outline-secondary rounded-pill me-3 d-inline-flex align-items-center gap-1 shadow-sm px-3"
            aria-label="Go back"
          >
            <i className="bi bi-arrow-left"></i> Back
          </button>
          <nav aria-label="breadcrumb" className="small flex-grow-1">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Storefront</Link></li>
              <li className="breadcrumb-item active" aria-current="page">Customer Dashboard</li>
            </ol>
          </nav>
        </div>

        {message.text && (
          <div className={`alert alert-${message.type} alert-dismissible fade show rounded-3 small mb-4`} role="alert">
            {message.text}
            <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })}></button>
          </div>
        )}

        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            <div className="mb-4">
              <h3 className="fw-bolder text-slate-900 tracking-tight mb-1">Customer Dashboard</h3>
              <p className="text-slate-500 text-xs mb-0">Welcome back, {displayName}! Summary of your shopping activity and verified receipts</p>
            </div>

            {/* Metric Cards */}
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-xs fw-bold uppercase text-slate-400">Total Orders</span>
                    <div className="rounded-xl p-2 bg-blue-50 text-blue-600">
                      <i className="bi bi-bag-check fs-5"></i>
                    </div>
                  </div>
                  <h3 className="fw-bolder text-slate-900 mb-0">{orders.length}</h3>
                  <small className="text-slate-400 text-xs">Total orders placed</small>
                </div>
              </div>

              <div className="col-md-4">
                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-xs fw-bold uppercase text-slate-400">Total Spent</span>
                    <div className="rounded-xl p-2 bg-emerald-50 text-emerald-600">
                      <i className="bi bi-cash-stack fs-5"></i>
                    </div>
                  </div>
                  <h3 className="fw-bolder text-slate-900 mb-0">{formatETB(totalSpentAmount)}</h3>
                  <small className="text-slate-400 text-xs">Accumulated purchase value in ETB</small>
                </div>
              </div>

              <div className="col-md-4">
                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-xs fw-bold uppercase text-slate-400">Verified Receipts</span>
                    <div className="rounded-xl p-2 bg-purple-50 text-purple-600">
                      <i className="bi bi-receipt fs-5"></i>
                    </div>
                  </div>
                  <h3 className="fw-bolder text-slate-900 mb-0">{verifiedOrdersCount}</h3>
                  <small className="text-slate-400 text-xs">Official receipts issued</small>
                </div>
              </div>
            </div>

            {/* Recent Orders Shelf */}
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-slate-900 mb-0">Recent Orders</h5>
                <button
                  className="btn btn-link btn-sm text-primary p-0 text-xs fw-bold text-decoration-none"
                  onClick={() => setActiveTab('orders')}
                >
                  View All Orders &rarr;
                </button>
              </div>

              {loadingOrders ? (
                <div className="text-center py-4 text-muted small">Loading order history...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-5 bg-slate-50 rounded-3">
                  <i className="bi bi-bag-x fs-1 text-slate-400 mb-2 d-block"></i>
                  <h6 className="fw-bold text-slate-700">No orders placed yet</h6>
                  <p className="text-slate-400 text-xs mb-3">Explore our high-performance electronics and add items to your cart.</p>
                  <Link to="/shop" className="btn btn-primary rounded-pill px-4 btn-sm">Browse Products</Link>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead className="table-light text-uppercase text-[11px] text-slate-500">
                      <tr>
                        <th>Order #</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Payment Status</th>
                        <th>Order Status</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {orders.slice(0, 5).map((o) => (
                        <tr key={o.id}>
                          <td className="fw-bold">
                            <Link to={`/orders/${o.id}`} className="text-primary text-decoration-none">
                              {o.order_number}
                            </Link>
                          </td>
                          <td className="text-slate-500">{new Date(o.created_at).toLocaleDateString()}</td>
                          <td className="fw-bold text-slate-900">{formatETB(o.total_amount)}</td>
                          <td>
                            <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2 py-0.5 text-[10px]">
                              {o.payment_method === 'CHAPA' ? 'Chapa Gateway' : 'Online'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge rounded-pill px-2.5 py-1 text-[10px] uppercase font-bold ${getBadgeClass(o.status)}`}>
                              {o.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="text-end">
                            <Link to={`/orders/${o.id}`} className="btn btn-outline-primary btn-sm rounded-pill px-3 py-1 text-xs">
                              Details
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* AI Recommendations */}
            {recommendations.length > 0 && (
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold text-slate-900 mb-0">Personalized Product Recommendations</h6>
                  <Link to="/recommendations" className="text-primary text-xs fw-bold text-decoration-none">
                    View AI Center &rarr;
                  </Link>
                </div>
                <div className="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-3">
                  {recommendations.slice(0, 4).map((p) => (
                    <div key={p.id} className="col">
                      <ProductCard product={p} aiTag="Personal Match" />
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
                <p className="text-slate-500 text-xs mb-0">All orders placed with real delivery milestone status</p>
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
                <p className="text-muted small mb-3">No orders found.</p>
                <Link to="/shop" className="btn btn-primary rounded-pill px-4 btn-sm">Shop Catalog</Link>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light text-uppercase text-[11px] text-slate-500">
                    <tr>
                      <th>Order Number</th>
                      <th>Date Placed</th>
                      <th>Items Count</th>
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

        {/* TAB 3: PAYMENT HISTORY */}
        {activeTab === 'payments' && (
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <div className="mb-4">
              <h4 className="fw-bolder text-slate-900 mb-1">Chapa Payment History</h4>
              <p className="text-slate-500 text-xs mb-0">
                Authoritative transaction ledger for payments completed through the Chapa gateway
              </p>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-5 bg-slate-50 rounded-3 text-muted small">No payments recorded.</div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0 text-sm">
                  <thead className="table-light text-slate-600 text-xs">
                    <tr>
                      <th>Order #</th>
                      <th>Gateway</th>
                      <th>Chapa Tx Ref</th>
                      <th>Amount (ETB)</th>
                      <th>Date</th>
                      <th>Payment Status</th>
                      <th className="text-end">Digital Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {orders.map((o) => {
                      const isPaid = ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status);
                      return (
                        <tr key={`pay-${o.id}`}>
                          <td className="fw-bold">
                            <Link to={`/orders/${o.id}`} className="text-primary text-decoration-none">
                              {o.order_number}
                            </Link>
                          </td>
                          <td>
                            <span className="badge bg-slate-100 text-slate-800">Chapa</span>
                          </td>
                          <td>
                            {o.chapa_reference ? (
                              <code className="text-xs bg-light px-2 py-0.5 rounded text-dark">
                                {o.chapa_reference}
                              </code>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                          <td><strong>{formatETB(o.total_amount)}</strong></td>
                          <td>{new Date(o.created_at).toLocaleDateString()}</td>
                          <td>
                            {isPaid ? (
                              <span className="badge bg-success rounded-pill px-2 py-0.5 text-[10px]">
                                Verified Paid
                              </span>
                            ) : o.status === 'CANCELLED' ? (
                              <span className="badge bg-danger rounded-pill px-2 py-0.5 text-[10px]">Cancelled</span>
                            ) : (
                              <span className="badge bg-warning text-dark rounded-pill px-2 py-0.5 text-[10px]">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="text-end">
                            {isPaid ? (
                              <Link to={`/receipts/${o.id}`} className="btn btn-sm btn-outline-success rounded-pill px-2.5 py-1 text-xs">
                                <i className="bi bi-receipt"></i> Receipt
                              </Link>
                            ) : (
                              <span className="text-muted text-xs">Pending verification</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: RECEIPTS */}
        {activeTab === 'receipts' && (
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <div className="mb-4">
              <h4 className="fw-bolder text-slate-900 mb-1">Official Digital Receipts</h4>
              <p className="text-slate-500 text-xs mb-0">
                Tax-compliant digital receipts generated automatically after server-side Chapa payment verification
              </p>
            </div>

            {orders.filter((o) => ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status)).length === 0 ? (
              <div className="text-center py-5 bg-slate-50 rounded-3">
                <i className="bi bi-receipt-cutoff fs-1 text-slate-400 mb-2 d-block"></i>
                <h6 className="fw-bold text-slate-700">No verified receipts yet</h6>
                <p className="text-slate-400 text-xs mb-0">
                  Digital receipts are generated automatically upon successful Chapa payment confirmation.
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
                          <p className="text-slate-500 text-xs mb-2">Total Paid: <strong>{formatETB(o.total_amount)}</strong></p>
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

        {/* TAB 5: WARRANTY AND CLAIMS */}
        {activeTab === 'warranty' && (
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <div className="mb-4">
              <h4 className="fw-bolder text-slate-900 mb-1">Warranty Protection & Claims</h4>
              <p className="text-slate-500 text-xs mb-0">
                Official snapshot policies recorded with each purchased product, active duration, and claims status
              </p>
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
                    No warranty claims submitted yet. You can submit claims directly from any verified order item.
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
                          <th>Resolution / Staff Notes</th>
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
                                <span className="text-muted">Under investigation</span>
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
                              {item.warranty_duration_days ? `${item.warranty_duration_days} Days Policy` : 'Standard Policy'}
                            </span>
                          </div>
                          <div className="text-xs text-muted mb-2">
                            {item.warranty_coverage || 'Replacement & manufacturing guarantee.'}
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

        {/* TAB 6: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h4 className="fw-bolder text-slate-900 mb-1">In-App Notifications</h4>
                <p className="text-slate-500 text-xs mb-0">Alerts for payments, order milestones, and warranty updates</p>
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

        {/* TAB 7: MY PROFILE */}
        {activeTab === 'profile' && (
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <div className="mb-4">
              <h4 className="fw-bolder text-slate-900 mb-1">My Customer Profile</h4>
              <p className="text-slate-500 text-xs mb-0">Manage recipient credentials, phone number, and default delivery address</p>
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
        )}
      </main>
    </div>
  );
};

export default CustomerDashboardPage;
