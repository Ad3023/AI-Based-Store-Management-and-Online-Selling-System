import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import { cleanDisplayName, getUserRoleLabel, getUserRoleBadgeClass } from '../utils/orderStatus';
import { getMediaUrl, getDefaultAvatar } from '../utils/imageUrl';

const Navbar = () => {
  const { user, logout, isManagerOrAdmin } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    api.get('products/categories/')
      .then((res) => {
        if (!isMounted) return;
        const data = res.data.results || res.data || [];
        setCategories(data);
      })
      .catch((err) => {
        console.error('Navbar categories load error:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync category & search input with URL search params when on /shop
  useEffect(() => {
    if (location.pathname === '/shop') {
      const params = new URLSearchParams(location.search);
      const catParam = params.get('category');
      const searchParam = params.get('search');
      setSelectedCategory(catParam || 'All');
      if (searchParam !== null) {
        setSearchTerm(searchParam);
      }
    }
  }, [location.pathname, location.search]);

  // Match selectedCategory to an available category object or slug
  const matchedCategory = categories.find(
    (c) =>
      String(c.id) === selectedCategory ||
      c.slug?.toLowerCase() === selectedCategory.toLowerCase() ||
      c.name?.toLowerCase() === selectedCategory.toLowerCase() ||
      c.name?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      (c.slug && selectedCategory.toLowerCase().includes(c.slug.toLowerCase()))
  );
  const currentSelectValue = matchedCategory
    ? (matchedCategory.slug || String(matchedCategory.id))
    : selectedCategory;

  const handleCategoryChange = (e) => {
    const val = e.target.value;
    setSelectedCategory(val);
    const params = new URLSearchParams();
    if (val && val !== 'All') {
      params.set('category', val);
    }
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    }
    navigate(`/shop${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (selectedCategory && selectedCategory !== 'All') {
      params.set('category', selectedCategory);
    }
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    }
    navigate(`/shop${params.toString() ? `?${params.toString()}` : ''}`);
    setMobileMenuOpen(false);
  };

  const handleSignOut = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const displayName = cleanDisplayName(user);
  const roleLabel = getUserRoleLabel(user);
  const roleBadgeClass = getUserRoleBadgeClass(user);
  const avatarUrl = user?.avatar ? getMediaUrl(user.avatar) : null;

  return (
    <header
      className="sticky-top z-3"
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1030,
        backgroundColor: '#0c1e33',
        boxShadow: '0 2px 10px rgba(11, 26, 45, 0.12)',
      }}
    >
      {/* Top Navbar Header - Deep Navy Blue (Screenshot 1) */}
      <div style={{ backgroundColor: '#0c1e33', color: '#ffffff' }} className="py-2.5 px-3 px-lg-4 border-bottom border-dark border-opacity-25">
        <div className="container-fluid max-w-7xl d-flex align-items-center justify-content-between gap-2 gap-md-4">
          
          {/* Logo & Brand */}
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none flex-shrink-0">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center text-white"
              style={{ width: '38px', height: '38px', backgroundColor: '#1b64da', boxShadow: '0 2px 8px rgba(27, 100, 218, 0.4)' }}
            >
              <i className="bi bi-cart3 fs-5"></i>
            </div>
            <div className="d-flex flex-column">
              <span className="fw-bolder fs-5 text-white tracking-tight lh-1" style={{ letterSpacing: '-0.02em' }}>
                EthioTech <span style={{ color: '#60a5fa' }}>Market</span>
              </span>
              <span className="text-slate-400 d-none d-sm-inline" style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>
                Better Tech. Brighter Future.
              </span>
            </div>
          </Link>

          {/* Search Bar with Category Dropdown (Screenshot 1) */}
          <form className="d-none d-md-flex align-items-center flex-grow-1 mx-2 mx-xl-4" onSubmit={handleSearch} style={{ maxWidth: '620px' }}>
            <div className="input-group shadow-sm" style={{ borderRadius: '0.5rem', overflow: 'hidden' }}>
              <select
                className="form-select border-0 bg-slate-100 text-slate-700 text-xs fw-semibold px-2.5"
                style={{ maxWidth: '160px', cursor: 'pointer', backgroundColor: '#e2e8f0' }}
                value={currentSelectValue}
                onChange={handleCategoryChange}
                aria-label="Filter by category"
              >
                <option value="All">All Categories</option>
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.slug || cat.id}>
                      {cat.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="smartphones-tablets">Smartphones & Tablets</option>
                    <option value="laptops-computers">Laptops & Computers</option>
                    <option value="audio-headphones">Audio & Headphones</option>
                    <option value="smart-wearables">Smart Wearables</option>
                    <option value="accessories-gadgets">Accessories & Gadgets</option>
                  </>
                )}
                {currentSelectValue !== 'All' &&
                  !categories.some((c) => (c.slug || String(c.id)) === currentSelectValue) && (
                    <option value={currentSelectValue}>{currentSelectValue}</option>
                  )}
              </select>
              <input
                type="text"
                className="form-control border-0 py-2 text-sm bg-white"
                placeholder="Search products, brands, and categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button
                className="btn text-white px-3.5 d-flex align-items-center justify-content-center"
                style={{ backgroundColor: '#1b64da' }}
                type="submit"
                aria-label="Search"
              >
                <i className="bi bi-search fs-6"></i>
              </button>
            </div>
          </form>

          {/* Right Header Navigation Controls */}
          <div className="d-flex align-items-center gap-2 gap-sm-3 flex-shrink-0">
            
            {/* Wishlist Icon (hidden for admins) */}
            {user?.role !== 'admin' && (
              <Link
                to="/wishlist"
                className="text-white text-decoration-none position-relative p-2 rounded-circle hover-bg-navy d-flex align-items-center justify-content-center"
                style={{ width: '38px', height: '38px', background: 'rgba(255, 255, 255, 0.08)' }}
                title="My Wishlist"
              >
                <i className="bi bi-heart fs-5"></i>
                {wishlistCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.65rem' }}>
                    {wishlistCount}
                  </span>
                )}
              </Link>
            )}

            {/* Shopping Cart Icon with Counter (hidden for admins) */}
            {user?.role !== 'admin' && (
              <Link
                to="/cart"
                className="text-white text-decoration-none position-relative px-2.5 py-1.5 rounded-3 d-flex align-items-center gap-1.5"
                style={{ background: 'rgba(255, 255, 255, 0.08)' }}
                title="Shopping Cart"
              >
                <i className="bi bi-cart3 fs-5" style={{ color: '#60a5fa' }}></i>
                <span className="fw-semibold text-xs d-none d-sm-inline">Cart</span>
                {cartCount > 0 && (
                  <span className="badge rounded-pill text-white" style={{ backgroundColor: '#1b64da', fontSize: '0.7rem' }}>
                    {cartCount}
                  </span>
                )}
              </Link>
            )}

            {/* Notifications Dropdown (If signed in) */}
            {user && (
              <div className="position-relative">
                <button
                  className="btn text-white p-0 position-relative border-0 d-flex align-items-center justify-content-center rounded-circle"
                  style={{ width: '38px', height: '38px', background: 'rgba(255, 255, 255, 0.08)' }}
                  onClick={() => setShowNotifications(!showNotifications)}
                  type="button"
                  title="Notifications"
                >
                  <i className="bi bi-bell fs-5"></i>
                  {unreadCount > 0 && (
                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.65rem' }}>
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div
                    className="card shadow-lg border-0 rounded-3 p-3 position-absolute end-0 mt-2 bg-white text-dark"
                    style={{ width: '320px', zIndex: 1060 }}
                  >
                    <div className="d-flex justify-content-between align-items-center pb-2 border-bottom">
                      <span className="fw-bold text-sm text-slate-900">Notifications</span>
                      {unreadCount > 0 && (
                        <button className="btn btn-link btn-sm text-primary p-0 text-decoration-none text-xs" onClick={markAllAsRead}>
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div style={{ maxHeight: '260px', overflowY: 'auto' }} className="py-2">
                      {notifications.length === 0 ? (
                        <div className="text-center py-4 text-muted small">No notifications yet</div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-2.5 rounded-2 mb-1.5 transition ${n.is_read ? 'bg-white hover:bg-slate-50' : 'bg-blue-50'}`}
                            onClick={() => {
                              markAsRead(n.id);
                              if (n.link) {
                                setShowNotifications(false);
                                navigate(n.link);
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="d-flex align-items-center justify-content-between mb-1">
                              <span className="fw-semibold text-xs text-dark">{n.title}</span>
                              <small className="text-muted text-[10px]">{new Date(n.created_at).toLocaleDateString()}</small>
                            </div>
                            <p className="text-muted text-xs mb-0" style={{ lineHeight: '1.3' }}>
                              {n.message}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Account / Profile Dropdown */}
            {user ? (
              <div className="dropdown">
                <button
                  className="btn text-white border-0 p-1 d-flex align-items-center gap-2 rounded-pill"
                  style={{ background: 'rgba(255, 255, 255, 0.08)' }}
                  data-bs-toggle="dropdown"
                  type="button"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="rounded-circle object-fit-cover"
                      style={{ width: '32px', height: '32px' }}
                      onError={(e) => { e.target.src = getDefaultAvatar(displayName); }}
                    />
                  ) : (
                    <div
                      className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold small"
                      style={{ width: '32px', height: '32px', backgroundColor: '#1b64da' }}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="fw-semibold text-xs d-none d-md-inline pe-1 text-white">
                    {displayName.split(' ')[0]}
                  </span>
                  <i className="bi bi-chevron-down text-slate-400 d-none d-md-inline" style={{ fontSize: '0.65rem' }}></i>
                </button>

                <ul className="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-3 p-2 mt-2" style={{ minWidth: '220px' }}>
                  <li className="px-3 py-2 border-bottom mb-1">
                    <div className="fw-bold text-sm text-slate-900">{displayName}</div>
                    <small className="text-muted text-xs">{user.email}</small>
                    <div className="mt-1">
                      <span className={`badge ${roleBadgeClass} text-[10px] fw-bold text-uppercase`}>
                        {roleLabel}
                      </span>
                    </div>
                  </li>

                  <li>
                    <Link
                      className="dropdown-item py-2 rounded-2 text-xs d-flex align-items-center gap-2 fw-semibold"
                      to={
                        user.role === 'admin' || user.is_superuser
                          ? '/admin/dashboard'
                          : user.role === 'store_manager'
                          ? '/manager/dashboard'
                          : '/customer/dashboard'
                      }
                    >
                      <i className="bi bi-speedometer2 text-primary"></i> Dashboard
                    </Link>
                  </li>

                  <li>
                    <Link
                      className="dropdown-item py-2 rounded-2 text-xs d-flex align-items-center gap-2 fw-semibold"
                      to="/profile"
                    >
                      <i className="bi bi-person text-secondary"></i> My Profile & Photo
                    </Link>
                  </li>

                  {user.role === 'customer' && !user.is_superuser && (
                    <>
                      <li>
                        <Link className="dropdown-item py-2 rounded-2 text-xs d-flex align-items-center gap-2 fw-semibold" to="/customer/dashboard?tab=orders">
                          <i className="bi bi-box-seam text-secondary"></i> My Orders
                        </Link>
                      </li>
                      <li>
                        <Link className="dropdown-item py-2 rounded-2 text-xs d-flex align-items-center gap-2 fw-semibold" to="/track">
                          <i className="bi bi-geo-alt text-secondary"></i> Order Tracking
                        </Link>
                      </li>
                    </>
                  )}

                  <li><hr className="dropdown-divider my-1" /></li>

                  <li>
                    <button
                      className="dropdown-item py-2 rounded-2 text-xs d-flex align-items-center gap-2 text-danger fw-semibold"
                      onClick={handleSignOut}
                    >
                      <i className="bi bi-box-arrow-right"></i> Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            ) : (
              <div className="d-flex align-items-center gap-2">
                <Link
                  to="/login"
                  className="btn btn-sm text-white px-3 py-1.5 rounded-2 fw-semibold text-xs text-decoration-none"
                  style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn btn-sm text-white px-3 py-1.5 rounded-2 fw-bold text-xs text-decoration-none"
                  style={{ backgroundColor: '#1b64da' }}
                >
                  Create Account
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button
              className="btn text-white p-1 d-md-none border-0"
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'} fs-3`}></i>
            </button>

          </div>
        </div>
      </div>

      {/* Subheader Navigation Links (Desktop & Mobile Drawer) */}
      <nav className={`bg-white border-bottom py-2 px-3 px-lg-4 shadow-sm ${mobileMenuOpen ? 'd-block' : 'd-none d-md-block'}`}>
        <div className="container-fluid max-w-7xl d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
          
          {/* Quick Category / Page Links */}
          <div className="d-flex flex-wrap align-items-center gap-1 gap-md-3 text-xs fw-semibold">
            <Link to="/" className="text-slate-700 hover-text-blue px-2 py-1 rounded text-decoration-none" onClick={() => setMobileMenuOpen(false)}>
              Home
            </Link>
            <Link to="/shop" className="text-slate-700 hover-text-blue px-2 py-1 rounded text-decoration-none" onClick={() => setMobileMenuOpen(false)}>
              All Products
            </Link>
            <Link to="/categories" className="text-slate-700 hover-text-blue px-2 py-1 rounded text-decoration-none" onClick={() => setMobileMenuOpen(false)}>
              Categories
            </Link>
            <Link to="/deals" className="text-rose-600 hover-text-blue px-2 py-1 rounded text-decoration-none d-flex align-items-center gap-1" onClick={() => setMobileMenuOpen(false)}>
              <i className="bi bi-lightning-charge-fill text-danger"></i> Featured Deals
            </Link>
            <Link to="/recommendations" className="text-slate-700 hover-text-blue px-2 py-1 rounded text-decoration-none d-flex align-items-center gap-1" onClick={() => setMobileMenuOpen(false)}>
              <i className="bi bi-stars text-primary"></i> AI Picks
            </Link>
            <Link to="/track" className="text-slate-700 hover-text-blue px-2 py-1 rounded text-decoration-none" onClick={() => setMobileMenuOpen(false)}>
              Order Tracking
            </Link>
            <Link to="/contact" className="text-slate-700 hover-text-blue px-2 py-1 rounded text-decoration-none" onClick={() => setMobileMenuOpen(false)}>
              Help & Support
            </Link>
          </div>

          {/* Manager / Admin Direct Portal Link if authenticated staff */}
          {isManagerOrAdmin && (
            <div className="d-flex align-items-center">
              <Link
                to={user?.role === 'admin' ? '/admin/dashboard' : '/manager/dashboard'}
                className="btn btn-sm text-white px-2.5 py-1 rounded-2 text-xs fw-bold d-flex align-items-center gap-1"
                style={{ backgroundColor: '#0c1e33' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <i className="bi bi-shield-lock-fill text-warning"></i>
                {user?.role === 'admin' ? 'Admin Console' : 'Manager Console'}
              </Link>
            </div>
          )}

          {/* Mobile Search Bar (Only shown on mobile when menu opens) */}
          <div className="d-md-none mt-2">
            <form onSubmit={handleSearch}>
              <div className="input-group">
                <select
                  className="form-select border-0 bg-slate-100 text-slate-700 text-xs fw-semibold px-2"
                  style={{ maxWidth: '125px', cursor: 'pointer', backgroundColor: '#e2e8f0' }}
                  value={currentSelectValue}
                  onChange={handleCategoryChange}
                  aria-label="Filter by category mobile"
                >
                  <option value="All">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug || cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button className="btn btn-sm text-white" style={{ backgroundColor: '#1b64da' }} type="submit">
                  <i className="bi bi-search"></i>
                </button>
              </div>
            </form>
          </div>

        </div>
      </nav>
    </header>
  );
};

export default Navbar;
