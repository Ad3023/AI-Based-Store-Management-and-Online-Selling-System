import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';

const Navbar = () => {
  const { user, logout, isManagerOrAdmin } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchTerm.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  const displayName = user?.first_name ? user.first_name : user?.username || 'Shopper';

  return (
    <>
      {/* Announcement Bar */}
      <div className="announcement-bar py-1.5 px-3">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <span className="announcement-badge">
              <i className="bi bi-cpu-fill me-1"></i> AI POWERED
            </span>
            <span className="d-none d-md-inline text-slate-300">
              Verified Ethiopian Bank Transfer (CBE, Telebirr, Awash) & Chapa Gateway with Instant Digital Receipts
            </span>
            <span className="d-inline d-md-none text-slate-300">
              Chapa, Telebirr & CBE Verified Payments
            </span>
          </div>

          <div className="d-flex align-items-center gap-3 text-slate-400">
            <span className="d-none d-sm-inline">
              <i className="bi bi-truck me-1 text-cyan-400"></i> Express Addis & Regional Delivery
            </span>
            <span>&bull;</span>
            <Link to="/track" className="text-cyan-400 hover:text-white transition">
              Track Order
            </Link>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <nav className="navbar navbar-expand-lg navbar-light bg-white sticky-top border-bottom border-slate-100 shadow-sm py-2.5">
        <div className="container">
          {/* Unified Brand: NexusStore AI */}
          <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
            <div
              className="rounded-xl d-flex align-items-center justify-content-center text-white shadow-sm"
              style={{ width: '40px', height: '40px', background: 'var(--gradient-primary)' }}
            >
              <i className="bi bi-cpu-fill fs-5"></i>
            </div>
            <div className="d-flex align-items-center">
              <span className="fw-bolder fs-4 text-slate-900 tracking-tight">Nexus</span>
              <span className="text-primary fw-bolder fs-4 tracking-tight">Store</span>
              <span
                className="badge ms-1.5 rounded-full font-bold text-[10px] uppercase tracking-wider"
                style={{
                  background: 'linear-gradient(135deg, #0b1329 0%, #1e1b4b 100%)',
                  color: '#00f2fe',
                  border: '1px solid rgba(0, 242, 254, 0.3)',
                  padding: '4px 8px'
                }}
              >
                AI
              </span>
            </div>
          </Link>

          {/* Mobile menu toggle */}
          <button
            className="navbar-toggler border-0 shadow-none p-1"
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'} fs-3 text-slate-800`}></i>
          </button>

          {/* Nav Links & Controls */}
          <div className={`collapse navbar-collapse ${mobileMenuOpen ? 'show' : ''}`} id="navbarMain">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-2 gap-0.5 text-xs">
              <li className="nav-item">
                <Link
                  className="nav-link fw-semibold px-2.5 text-slate-700 hover:text-blue-600"
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  className="nav-link fw-semibold px-2.5 text-slate-700 hover:text-blue-600"
                  to="/shop"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Shop
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  className="nav-link fw-semibold px-2.5 text-slate-700 hover:text-blue-600"
                  to="/categories"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Categories
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  className="nav-link fw-semibold px-2.5 text-slate-700 hover:text-rose-600 d-flex align-items-center gap-1"
                  to="/deals"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <i className="bi bi-fire text-danger"></i> Deals
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  className="nav-link fw-semibold px-2.5 text-slate-700 hover:text-blue-600 d-flex align-items-center gap-1"
                  to="/recommendations"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <i className="bi bi-stars text-primary"></i> AI
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  className="nav-link fw-semibold px-2.5 text-slate-700 hover:text-blue-600"
                  to="/about"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  About Us
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  className="nav-link fw-semibold px-2.5 text-slate-700 hover:text-blue-600"
                  to="/contact"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contact
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  className="nav-link fw-semibold px-2.5 text-slate-700 hover:text-blue-600"
                  to="/faq"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Help
                </Link>
              </li>
              {isManagerOrAdmin && (
                <li className="nav-item">
                  <Link
                    className="nav-link fw-semibold px-2.5 text-primary d-flex align-items-center gap-1"
                    to="/manager"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <i className="bi bi-speedometer2"></i> Portal
                  </Link>
                </li>
              )}
            </ul>

            {/* Search Input */}
            <form className="d-flex me-lg-3 my-2 my-lg-0" onSubmit={handleSearch} style={{ maxWidth: '280px', width: '100%' }}>
              <div className="input-group">
                <span className="input-group-text bg-slate-100 border-0 text-slate-400 ps-3 rounded-start-pill">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control form-control-sm bg-slate-100 border-0 rounded-end-pill py-2 text-sm"
                  placeholder="Search electronics..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </form>

            {/* Right Action Icons */}
            <div className="d-flex align-items-center gap-2.5 mt-2 mt-lg-0">
              {/* Notifications Icon (for logged-in user) */}
              {user && (
                <div className="position-relative">
                  <button
                    className="btn btn-light rounded-circle p-2 position-relative text-slate-600 border-0 hover:bg-slate-100"
                    onClick={() => setShowNotifications(!showNotifications)}
                    title="Notifications"
                    type="button"
                  >
                    <i className="bi bi-bell fs-5"></i>
                    {unreadCount > 0 && (
                      <span className="position-absolute top-0 start-100 translate-middle badge rounded-full bg-danger">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div
                      className="card shadow-xl border-0 rounded-3xl p-3 position-absolute end-0 mt-2 bg-white"
                      style={{ width: '320px', zIndex: 1050 }}
                    >
                      <div className="d-flex justify-content-between align-items-center px-1 pb-2 border-bottom">
                        <span className="fw-bold text-sm">Notifications</span>
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
                              className={`p-2.5 rounded-2xl mb-1.5 transition ${
                                n.is_read ? 'bg-white hover:bg-slate-50' : 'bg-blue-50'
                              }`}
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
                                <small className="text-muted text-[10px]">
                                  {new Date(n.created_at).toLocaleDateString()}
                                </small>
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

              {/* Wishlist Button */}
              <Link
                to="/wishlist"
                className="btn btn-light rounded-full p-2 text-slate-700 position-relative border border-slate-200 hover:border-rose-400 shadow-sm transition"
                title="My Wishlist"
                onClick={() => setMobileMenuOpen(false)}
              >
                <i className="bi bi-heart text-rose-500 fs-5"></i>
                {wishlistCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-full bg-danger text-white text-[10px] px-1.5">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* Shopping Cart Button */}
              <Link
                to="/cart"
                className="btn btn-light rounded-full px-3 py-1.5 text-slate-800 d-flex align-items-center gap-2 border border-slate-200 hover:border-blue-500 shadow-sm transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <i className="bi bi-cart3 fs-5 text-primary"></i>
                <span className="fw-bold text-xs d-none d-sm-inline">Cart</span>
                <span className="badge rounded-full bg-primary text-white text-[11px] px-2">{cartCount}</span>
              </Link>

              {/* User Account / Profile */}
              {user ? (
                <div className="dropdown">
                  <button
                    className="btn btn-outline-light text-slate-800 border-0 p-1 d-flex align-items-center gap-2 rounded-full hover:bg-slate-50"
                    data-bs-toggle="dropdown"
                    type="button"
                  >
                    <div
                      className="rounded-full text-white d-flex align-items-center justify-content-center fw-bold shadow-sm"
                      style={{ width: '36px', height: '36px', background: 'var(--gradient-primary)' }}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-start d-none d-md-block pe-1">
                      <div className="fw-bold text-xs text-slate-900 text-truncate" style={{ maxWidth: '95px' }}>
                        {displayName}
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        {user.role}
                      </span>
                    </div>
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end shadow-xl border-0 rounded-2xl p-2 mt-2">
                    <li className="px-3 py-2 border-bottom mb-1">
                      <div className="fw-bold text-sm text-slate-900">{displayName}</div>
                      <small className="text-muted text-xs">{user.email}</small>
                    </li>
                    <li>
                      <Link className="dropdown-item py-2 rounded-xl text-xs d-flex align-items-center gap-2" to="/profile">
                        <i className="bi bi-grid text-primary"></i> Customer Dashboard
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item py-2 rounded-xl text-xs d-flex align-items-center gap-2" to="/orders">
                        <i className="bi bi-bag-check text-primary"></i> My Orders & Receipts
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item py-2 rounded-xl text-xs d-flex align-items-center gap-2" to="/wishlist">
                        <i className="bi bi-heart text-danger"></i> My Wishlist ({wishlistCount})
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item py-2 rounded-xl text-xs d-flex align-items-center gap-2" to="/recommendations">
                        <i className="bi bi-stars text-primary"></i> AI Recommendations
                      </Link>
                    </li>
                    {isManagerOrAdmin && (
                      <>
                        <li><hr className="dropdown-divider my-1" /></li>
                        <li>
                          <Link className="dropdown-item py-2 rounded-xl text-xs text-primary fw-semibold d-flex align-items-center gap-2" to="/manager">
                            <i className="bi bi-speedometer2"></i> Manager Portal
                          </Link>
                        </li>
                      </>
                    )}
                    <li><hr className="dropdown-divider my-1" /></li>
                    <li>
                      <button className="dropdown-item py-2 rounded-xl text-xs text-danger d-flex align-items-center gap-2" onClick={logout}>
                        <i className="bi bi-box-arrow-right"></i> Log Out
                      </button>
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="d-flex align-items-center gap-2">
                  <Link
                    to="/login"
                    className="btn btn-outline-custom btn-sm rounded-full text-xs px-3"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    className="btn btn-primary-gradient btn-sm rounded-full text-xs px-3.5 shadow-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
