import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import CustomerSidebar from '../components/CustomerSidebar';
import api from '../api';
import { formatETB } from '../utils/currency';
import ProductCard from '../components/ProductCard';
import {
  cleanDisplayName,
  getUserRoleLabel,
  getUserRoleBadgeClass,
  getPaymentStatusInfo,
  getFulfillmentStatusInfo,
} from '../utils/orderStatus';

const CustomerDashboardPage = () => {
  const { user, loading: authLoading, updateProfile, logout, isAdmin, isStoreManager } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Active Tab from query param or default 'overview'
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Authoritative Backend Summary
  const [summaryData, setSummaryData] = useState({
    total_orders: 0,
    total_spent: 0,
    verified_receipts_count: 0,
    recent_orders: [],
  });
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Orders list and claims
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

  // Sync formData when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone_number: user.phone_number || '',
        address: user.address || '',
        city: user.city || '',
      });
    }
  }, [user]);

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

      // 1. Fetch Authoritative Customer Summary Metrics
      try {
        setLoadingSummary(true);
        const summaryRes = await api.get('orders/customer-summary/');
        if (isMounted && summaryRes.data) {
          setSummaryData(summaryRes.data);
        }
      } catch (err) {
        console.error('Customer summary fetch error', err);
      } finally {
        if (isMounted) setLoadingSummary(false);
      }

      // 2. Fetch Customer Orders List
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

      // 3. Warranty claims
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

      // 4. Feedback
      try {
        const fRes = await api.get('products/feedback/').catch(() => ({ data: [] }));
        if (isMounted) {
          setFeedbackList(fRes.data.results || fRes.data || []);
        }
      } catch {
        // Silently handle
      }

      // 5. Recommendations
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

  // Loading state while checking authentication
  if (authLoading) {
    return (
      <div className="container py-5 text-center" style={{ minHeight: '60vh' }}>
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto bg-white border" style={{ maxWidth: '420px' }}>
          <div className="spinner-border text-primary mx-auto mb-3" role="status" style={{ width: '2.5rem', height: '2.5rem' }}></div>
          <h5 className="fw-bold text-slate-800 mb-1">Authenticating...</h5>
          <p className="text-muted text-xs mb-0">Verifying session credentials with server</p>
        </div>
      </div>
    );
  }

  // If user profile fails or not authenticated
  if (!user) {
    return (
      <div className="container py-5 text-center" style={{ minHeight: '60vh' }}>
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto bg-white border" style={{ maxWidth: '480px' }}>
          <div className="rounded-circle bg-amber-50 text-amber-600 d-inline-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '60px', height: '60px' }}>
            <i className="bi bi-person-lock fs-2"></i>
          </div>
          <h4 className="fw-bolder text-slate-900 mb-1">Authentication Required</h4>
          <p className="text-muted text-xs mb-4">Please sign in to your verified account to access this dashboard.</p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/login?redirect=/customer/dashboard" className="btn btn-primary rounded-pill px-4 text-xs font-bold">
              Sign In
            </Link>
            <Link to="/" className="btn btn-outline-secondary rounded-pill px-4 text-xs font-bold">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Authoritative identity derivation without appending role labels
  const displayName = cleanDisplayName(user);
  const roleLabel = getUserRoleLabel(user);
  const roleBadgeClass = getUserRoleBadgeClass(user);

  // Filter verified receipts (only orders that genuinely possess an issued receipt)
  const verifiedReceipts = orders.filter((o) => Boolean(o.receipt && o.receipt.receipt_number));

  return (
    <div className="ethio-dashboard-layout">
      {/* Reusable Fixed Sidebar (Screenshot 4) */}
      <CustomerSidebar
        mobileOpen={mobileDrawerOpen}
        setMobileOpen={setMobileDrawerOpen}
        activeItem={activeTab === 'overview' ? 'dashboard' : activeTab}
      />

      {/* Main Content Area */}
      <div className="ethio-dashboard-content">
        {/* Mobile Header Toggle */}
        <div className="bg-white border-bottom py-2.5 px-3 px-md-4 d-flex align-items-center justify-content-between sticky-top z-2">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-lg-none p-1.5"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open sidebar menu"
            >
              <i className="bi bi-list fs-5"></i>
            </button>
            <h5 className="fw-bolder text-slate-900 mb-0">Customer Dashboard</h5>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Link to="/shop" className="btn btn-sm btn-ethio-primary text-xs py-1.5 px-3">
              <i className="bi bi-bag-plus me-1"></i> Browse Products
            </Link>
          </div>
        </div>

        {/* Main Content Area (Natural fluid scrolling without trapped inner overflow) */}
        <main className="flex-grow-1 p-3 p-md-4 min-w-0" style={{ maxWidth: '1280px' }}>
        {/* Navigation Breadcrumb */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 text-xs">
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none text-slate-500">Storefront</Link></li>
              <li className="breadcrumb-item active fw-bold text-slate-800" aria-current="page">
                {roleLabel === 'CUSTOMER' ? 'Customer Dashboard' : `${roleLabel} Account Dashboard`}
              </li>
            </ol>
          </nav>
        </div>

        {/* Privileged Role Navigation Notice */}
        {(isAdmin || isStoreManager) && (
          <div className="alert alert-info rounded-3 p-3 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2 text-xs shadow-sm border border-cyan-200">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-shield-check fs-5 text-cyan-700"></i>
              <span>
                You are currently signed in as <strong className="text-uppercase">{roleLabel}</strong>. To manage products, review orders, or adjust configurations, visit your dedicated console.
              </span>
            </div>
            <Link
              to={isAdmin ? '/admin/dashboard' : '/manager/dashboard'}
              className="btn btn-sm btn-primary rounded-pill px-3 py-1 font-bold text-xs shrink-0 shadow-sm"
            >
              Open {isAdmin ? 'Admin Console' : 'Store Manager Portal'} &rarr;
            </Link>
          </div>
        )}

        {message.text && (
          <div className={`alert alert-${message.type} alert-dismissible fade show rounded-3 text-xs mb-3 shadow-sm`} role="alert">
            {message.text}
            <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })}></button>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            <div className="mb-3">
              <h4 className="fw-bolder text-slate-900 tracking-tight mb-1">
                {roleLabel === 'CUSTOMER' ? 'Customer Dashboard' : `${roleLabel} Shopping Summary`}
              </h4>
              <p className="text-slate-500 text-xs mb-0">
                Welcome back, {displayName}! Verified purchase records, receipts, and order statuses.
              </p>
            </div>

            {/* Authoritative Metric Cards (Screen 4) */}
            <div className="row g-3 mb-4">
              {/* Total Orders Card */}
              <div className="col-6 col-lg-3">
                <div className="card ethio-card p-3 p-md-4 h-100">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-xs fw-bold uppercase text-slate-500">Total Orders</span>
                    <div className="rounded-3 p-2 bg-blue-50 text-blue-600">
                      <i className="bi bi-bag-check fs-5"></i>
                    </div>
                  </div>
                  <h3 className="fw-bolder text-slate-900 mb-0">
                    {loadingSummary ? (
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                    ) : (
                      summaryData.total_orders
                    )}
                  </h3>
                  <small className="text-slate-400 text-xs mt-1 d-block">Lifetime placed</small>
                </div>
              </div>

              {/* Total Spent Card */}
              <div className="col-6 col-lg-3">
                <div className="card ethio-card p-3 p-md-4 h-100">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-xs fw-bold uppercase text-slate-500">Total Spent</span>
                    <div className="rounded-3 p-2 bg-emerald-50 text-emerald-600">
                      <i className="bi bi-cash-stack fs-5"></i>
                    </div>
                  </div>
                  <h3 className="fw-bolder text-slate-900 mb-0">
                    {loadingSummary ? (
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                    ) : (
                      formatETB(summaryData.total_spent)
                    )}
                  </h3>
                  <small className="text-slate-400 text-xs mt-1 d-block">Verified purchases</small>
                </div>
              </div>

              {/* Verified Receipts Card */}
              <div className="col-6 col-lg-3">
                <div className="card ethio-card p-3 p-md-4 h-100">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-xs fw-bold uppercase text-slate-500">Digital Receipts</span>
                    <div className="rounded-3 p-2 bg-purple-50 text-purple-600">
                      <i className="bi bi-receipt fs-5"></i>
                    </div>
                  </div>
                  <h3 className="fw-bolder text-slate-900 mb-0">
                    {loadingSummary ? (
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                    ) : (
                      summaryData.verified_receipts_count
                    )}
                  </h3>
                  <small className="text-slate-400 text-xs mt-1 d-block">Official tax receipts</small>
                </div>
              </div>

              {/* Wishlist Items Card */}
              <div className="col-6 col-lg-3">
                <div className="card ethio-card p-3 p-md-4 h-100">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-xs fw-bold uppercase text-slate-500">Wishlist</span>
                    <div className="rounded-3 p-2 bg-rose-50 text-rose-600">
                      <i className="bi bi-heart fs-5"></i>
                    </div>
                  </div>
                  <h3 className="fw-bolder text-slate-900 mb-0">
                    {wishlistCount}
                  </h3>
                  <small className="text-slate-400 text-xs mt-1 d-block">Saved favorites</small>
                </div>
              </div>
            </div>

            {/* Recent Orders Shelf */}
            <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border border-slate-200 mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-slate-900 mb-0 text-sm">Recent Orders</h5>
                <button
                  type="button"
                  className="btn btn-link btn-sm text-primary p-0 text-xs fw-bold text-decoration-none"
                  onClick={() => setActiveTab('orders')}
                >
                  View All Orders &rarr;
                </button>
              </div>

              {loadingSummary ? (
                <div className="text-center py-4 text-muted small">
                  <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                  Loading order history...
                </div>
              ) : summaryData.recent_orders.length === 0 ? (
                <div className="text-center py-5 bg-slate-50 rounded-3">
                  <i className="bi bi-bag-x fs-1 text-slate-400 mb-2 d-block"></i>
                  <h6 className="fw-bold text-slate-700">No orders placed yet</h6>
                  <p className="text-slate-400 text-xs mb-3">Explore our high-performance electronics and add items to your cart.</p>
                  <Link to="/shop" className="btn btn-primary rounded-pill px-4 btn-sm text-xs font-bold">
                    Browse Storefront
                  </Link>
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
                      {summaryData.recent_orders.map((o) => {
                        const paymentInfo = getPaymentStatusInfo(o);
                        const fulfillmentInfo = getFulfillmentStatusInfo(o);
                        return (
                          <tr key={o.id}>
                            <td className="fw-bold">
                              <Link to={`/orders/${o.id}`} className="text-primary text-decoration-none">
                                {o.order_number}
                              </Link>
                            </td>
                            <td className="text-slate-500">{new Date(o.created_at).toLocaleDateString()}</td>
                            <td className="fw-bold text-slate-900">{formatETB(o.total_amount)}</td>
                            <td>
                              <span className={`badge rounded-pill px-2.5 py-1 text-[10px] font-bold ${paymentInfo.badgeClass}`}>
                                {paymentInfo.label}
                              </span>
                            </td>
                            <td>
                              <span className={`badge rounded-pill px-2.5 py-1 text-[10px] font-bold ${fulfillmentInfo.badgeClass}`}>
                                {fulfillmentInfo.label}
                              </span>
                            </td>
                            <td className="text-end">
                              <div className="d-flex justify-content-end gap-1.5">
                                <Link to={`/orders/${o.id}`} className="btn btn-outline-primary btn-sm rounded-pill px-3 py-1 text-xs">
                                  Details
                                </Link>
                                {o.receipt && o.receipt.receipt_number && (
                                  <Link to={`/receipts/${o.id}`} className="btn btn-outline-success btn-sm rounded-pill px-2.5 py-1 text-xs">
                                    <i className="bi bi-receipt"></i> Receipt
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* AI Recommendations */}
            {recommendations.length > 0 && (
              <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border border-slate-200">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold text-slate-900 mb-0 text-sm">Personalized AI Recommendations</h6>
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
          <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border border-slate-200">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h5 className="fw-bolder text-slate-900 mb-0.5">My Orders & Purchases</h5>
                <p className="text-slate-500 text-xs mb-0">Genuine order records with real-time payment and milestone status</p>
              </div>
              <Link to="/track" className="btn btn-outline-custom btn-sm rounded-pill px-3 text-xs">
                <i className="bi bi-geo-alt me-1"></i> Track Order
              </Link>
            </div>

            {loadingOrders ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="text-muted text-xs mt-2">Loading orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-5 bg-slate-50 rounded-3">
                <i className="bi bi-bag-x fs-1 text-slate-400 mb-2 d-block"></i>
                <p className="text-slate-600 text-xs mb-3">You have not placed any orders yet.</p>
                <Link to="/shop" className="btn btn-primary rounded-pill px-4 btn-sm text-xs font-bold">
                  Browse Catalog
                </Link>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light text-uppercase text-[11px] text-slate-500">
                    <tr>
                      <th>Order #</th>
                      <th>Date Placed</th>
                      <th>Items Count</th>
                      <th>Total Amount</th>
                      <th>Payment Status</th>
                      <th>Order Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {orders.map((o) => {
                      const paymentInfo = getPaymentStatusInfo(o);
                      const fulfillmentInfo = getFulfillmentStatusInfo(o);
                      return (
                        <tr key={o.id}>
                          <td className="fw-bold">
                            <Link to={`/orders/${o.id}`} className="text-primary text-decoration-none font-monospace">
                              {o.order_number}
                            </Link>
                          </td>
                          <td className="text-slate-500">{new Date(o.created_at).toLocaleDateString()}</td>
                          <td className="text-slate-700">{o.items?.length || 1} items</td>
                          <td className="fw-bold text-slate-900">{formatETB(o.total_amount)}</td>
                          <td>
                            <span className={`badge rounded-pill px-2.5 py-1 text-[10px] font-bold ${paymentInfo.badgeClass}`}>
                              {paymentInfo.label}
                            </span>
                          </td>
                          <td>
                            <span className={`badge rounded-pill px-2.5 py-1 text-[10px] font-bold ${fulfillmentInfo.badgeClass}`}>
                              {fulfillmentInfo.label}
                            </span>
                          </td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end gap-1.5">
                              <Link to={`/orders/${o.id}`} className="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-1">
                                View
                              </Link>
                              {o.receipt && o.receipt.receipt_number && (
                                <Link to={`/receipts/${o.id}`} className="btn btn-sm btn-outline-success rounded-pill px-2.5 py-1">
                                  Receipt
                                </Link>
                              )}
                            </div>
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

        {/* TAB 3: PAYMENT HISTORY */}
        {activeTab === 'payments' && (
          <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border border-slate-200">
            <div className="mb-3">
              <h5 className="fw-bolder text-slate-900 mb-0.5">Payment History & Ledger</h5>
              <p className="text-slate-500 text-xs mb-0">
                Authoritative transaction ledger for payments initiated and settled through Chapa
              </p>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-5 bg-slate-50 rounded-3 text-muted text-xs">No payments recorded.</div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light text-slate-600 text-[11px] text-uppercase">
                    <tr>
                      <th>Order #</th>
                      <th>Gateway</th>
                      <th>Transaction Reference</th>
                      <th>Amount (ETB)</th>
                      <th>Date</th>
                      <th>Payment Status</th>
                      <th className="text-end">Digital Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {orders.map((o) => {
                      const paymentInfo = getPaymentStatusInfo(o);
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
                            {o.chapa_tx_ref ? (
                              <code className="text-xs bg-light px-2 py-0.5 rounded text-dark break-anywhere">
                                {o.chapa_tx_ref}
                              </code>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                          <td><strong>{formatETB(o.total_amount)}</strong></td>
                          <td>{new Date(o.created_at).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge rounded-pill px-2.5 py-1 text-[10px] font-bold ${paymentInfo.badgeClass}`}>
                              {paymentInfo.label}
                            </span>
                          </td>
                          <td className="text-end">
                            {o.receipt && o.receipt.receipt_number ? (
                              <Link to={`/receipts/${o.id}`} className="btn btn-sm btn-outline-success rounded-pill px-2.5 py-1 text-xs">
                                <i className="bi bi-receipt me-1"></i> Receipt
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

        {/* TAB 4: OFFICIAL RECEIPTS (Strictly verified receipts only) */}
        {activeTab === 'receipts' && (
          <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border border-slate-200">
            <div className="mb-3">
              <h5 className="fw-bolder text-slate-900 mb-0.5">Verified Digital Receipts</h5>
              <p className="text-slate-500 text-xs mb-0">
                Official receipts issued upon successful server-side Chapa payment verification
              </p>
            </div>

            {verifiedReceipts.length === 0 ? (
              <div className="text-center py-5 bg-slate-50 rounded-3">
                <i className="bi bi-receipt-cutoff fs-1 text-slate-400 mb-2 d-block"></i>
                <h6 className="fw-bold text-slate-700">No verified receipts yet</h6>
                <p className="text-slate-400 text-xs mb-0">
                  Digital receipts are generated automatically upon successful Chapa payment verification.
                </p>
              </div>
            ) : (
              <div className="row g-3">
                {verifiedReceipts.map((o) => (
                  <div key={o.id} className="col-12 col-md-6">
                    <div className="p-3 p-md-4 rounded-3 border border-slate-200 bg-slate-50 h-100 d-flex flex-column justify-content-between">
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="badge bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-pill px-2.5 py-1 text-[10px] font-bold">
                            VERIFIED PAID
                          </span>
                          <small className="text-slate-400 text-[11px]">
                            {new Date(o.created_at).toLocaleDateString()}
                          </small>
                        </div>
                        <h6 className="fw-bold text-slate-900 mb-1">Receipt #{o.receipt.receipt_number}</h6>
                        <div className="text-slate-600 text-xs mb-1">Order #{o.order_number}</div>
                        <div className="text-slate-700 text-xs mb-2">
                          Amount Paid: <strong className="text-primary">{formatETB(o.total_amount)}</strong>
                        </div>
                        {o.chapa_tx_ref && (
                          <div className="text-[10px] text-muted mb-2">
                            Ref: <code className="break-anywhere">{o.chapa_tx_ref}</code>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-top border-slate-200 mt-2">
                        <Link to={`/receipts/${o.id}`} className="btn btn-primary-gradient btn-sm rounded-pill px-3 py-1.5 w-100 fw-bold text-xs shadow-sm">
                          <i className="bi bi-printer me-1"></i> View Official Receipt
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
          <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border border-slate-200">
            <div className="mb-3">
              <h5 className="fw-bolder text-slate-900 mb-0.5">Warranty Protection & Claims</h5>
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
                <h6 className="fw-bold text-slate-800 mb-3 text-xs uppercase tracking-wider">
                  Submitted Claims ({warrantyClaims.length})
                </h6>
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

                <h6 className="fw-bold text-slate-800 mb-2 text-xs uppercase tracking-wider">
                  Purchased Products with Active Warranty
                </h6>
                <div className="row g-3">
                  {orders
                    .filter((o) => ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status))
                    .flatMap((o) => o.items || [])
                    .map((item, idx) => (
                      <div key={`w-item-${idx}`} className="col-12 col-md-6">
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
          <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border border-slate-200">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="fw-bolder text-slate-900 mb-0.5">In-App Notifications</h5>
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

        {/* TAB 7: PROFILE SETTINGS */}
        {activeTab === 'profile' && (
          <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border border-slate-200">
            <div className="mb-3">
              <h5 className="fw-bolder text-slate-900 mb-0.5">Account Profile Details</h5>
              <p className="text-slate-500 text-xs mb-0">Authoritative account credentials and default delivery address</p>
            </div>

            <form onSubmit={handleProfileSubmit}>
              <div className="row g-3 mb-3">
                <div className="col-12 col-md-6">
                  <label className="form-label text-xs fw-bold text-slate-700">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    className="form-control text-sm py-2 rounded-3"
                    value={formData.first_name}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label text-xs fw-bold text-slate-700">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    className="form-control text-sm py-2 rounded-3"
                    value={formData.last_name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-12 col-md-6">
                  <label className="form-label text-xs fw-bold text-slate-700">Email Address (Authoritative)</label>
                  <input
                    type="email"
                    className="form-control text-sm py-2 bg-slate-50 rounded-3"
                    value={user.email}
                    disabled
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label text-xs fw-bold text-slate-700">Phone Number</label>
                  <input
                    type="tel"
                    name="phone_number"
                    className="form-control text-sm py-2 rounded-3"
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
                  className="form-control text-sm py-2 rounded-3"
                  rows="2"
                  placeholder="Street, Subcity, House No."
                  value={formData.address}
                  onChange={handleChange}
                ></textarea>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-12 col-md-6">
                  <label className="form-label text-xs fw-bold text-slate-700">City / Region</label>
                  <input
                    type="text"
                    name="city"
                    className="form-control text-sm py-2 rounded-3"
                    placeholder="e.g. Addis Ababa"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label text-xs fw-bold text-slate-700">Account Role (Backend Authorization)</label>
                  <input
                    type="text"
                    className="form-control text-sm py-2 bg-slate-50 rounded-3 text-uppercase fw-bold text-primary"
                    value={roleLabel}
                    disabled
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary-gradient rounded-pill px-4 py-2 fw-bold text-xs shadow-sm"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  </div>
);
};

export default CustomerDashboardPage;
