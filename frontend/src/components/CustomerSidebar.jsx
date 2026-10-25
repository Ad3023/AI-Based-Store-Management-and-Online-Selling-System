import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import { cleanDisplayName, getUserRoleLabel } from '../utils/orderStatus';
import { getMediaUrl, getDefaultAvatar } from '../utils/imageUrl';

const CustomerSidebar = ({ mobileOpen, setMobileOpen, activeItem }) => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  const displayName = cleanDisplayName(user);
  const roleLabel = getUserRoleLabel(user?.role);
  const avatarUrl = user?.avatar ? getMediaUrl(user.avatar) : null;

  const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
  const pathname = location.pathname;

  const isNavActive = (key) => {
    if (activeItem) return activeItem === key;
    if (key === 'dashboard') return pathname === '/customer/dashboard' && currentTab === 'overview';
    if (key === 'orders') return (pathname === '/customer/dashboard' && currentTab === 'orders') || pathname === '/orders';
    if (key === 'tracking') return pathname === '/track';
    if (key === 'payments') return pathname === '/customer/dashboard' && currentTab === 'payments';
    if (key === 'receipts') return pathname === '/customer/dashboard' && currentTab === 'receipts';
    if (key === 'wishlist') return pathname === '/wishlist';
    if (key === 'reviews') return pathname === '/customer/dashboard' && currentTab === 'reviews';
    if (key === 'warranty') return pathname === '/customer/dashboard' && currentTab === 'warranty';
    if (key === 'notifications') return pathname === '/customer/dashboard' && currentTab === 'notifications';
    if (key === 'profile') return pathname === '/profile' || (pathname === '/customer/dashboard' && currentTab === 'profile');
    if (key === 'cart') return pathname === '/cart';
    if (key === 'shop') return pathname === '/shop';
    return false;
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="ethio-drawer-backdrop d-lg-none"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        ></div>
      )}

      {/* Deep Navy Fixed Sidebar */}
      <aside className={`ethio-sidebar ${mobileOpen ? 'open' : ''}`}>
        
        {/* Brand Header */}
        <div className="p-3.5 border-bottom border-secondary border-opacity-25 d-flex align-items-center justify-content-between">
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center text-white"
              style={{ width: '34px', height: '34px', backgroundColor: '#1b64da', boxShadow: '0 2px 6px rgba(27, 100, 218, 0.4)' }}
            >
              <i className="bi bi-cart3 fs-6"></i>
            </div>
            <div>
              <span className="fw-bolder fs-6 text-white tracking-tight lh-1">
                EthioTech <span style={{ color: '#60a5fa' }}>Market</span>
              </span>
            </div>
          </Link>

          {/* Mobile Close Button */}
          <button
            type="button"
            className="btn btn-sm text-white d-lg-none p-1 border-0"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar menu"
          >
            <i className="bi bi-x-lg fs-5"></i>
          </button>
        </div>

        {/* User Persona Card (Screenshot 4 & 5) */}
        <div className="ethio-persona-card">
          <Link to="/profile" className="text-decoration-none" onClick={() => setMobileOpen(false)}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="ethio-avatar-circle"
                onError={(e) => { e.target.src = getDefaultAvatar(displayName); }}
              />
            ) : (
              <div className="ethio-avatar-circle">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </Link>
          <div className="text-truncate flex-grow-1">
            <div className="fw-bold text-white text-xs text-truncate">
              {displayName}
            </div>
            <span className="badge bg-primary bg-opacity-20 text-blue-300 text-[10px] fw-semibold text-uppercase">
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Navigation Items (Screens 4 & 5) */}
        <div className="flex-grow-1 py-1" style={{ overflowY: 'auto' }}>
          
          <Link
            to="/customer/dashboard?tab=overview"
            className={`ethio-nav-item ${isNavActive('dashboard') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-grid"></i>
            <span>Dashboard</span>
          </Link>

          <Link
            to="/shop"
            className={`ethio-nav-item ${isNavActive('shop') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-shop"></i>
            <span>Browse Products</span>
          </Link>

          <Link
            to="/cart"
            className={`ethio-nav-item ${isNavActive('cart') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-cart3"></i>
            <span>My Cart</span>
            {cartCount > 0 && (
              <span className="badge rounded-pill bg-primary ms-auto" style={{ fontSize: '0.68rem' }}>
                {cartCount}
              </span>
            )}
          </Link>

          <Link
            to="/customer/dashboard?tab=orders"
            className={`ethio-nav-item ${isNavActive('orders') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-box-seam"></i>
            <span>My Orders</span>
          </Link>

          <Link
            to="/track"
            className={`ethio-nav-item ${isNavActive('tracking') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-geo-alt"></i>
            <span>Order Tracking</span>
          </Link>

          <Link
            to="/customer/dashboard?tab=payments"
            className={`ethio-nav-item ${isNavActive('payments') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-credit-card"></i>
            <span>Payment History</span>
          </Link>

          <Link
            to="/customer/dashboard?tab=receipts"
            className={`ethio-nav-item ${isNavActive('receipts') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-receipt"></i>
            <span>Receipts</span>
          </Link>

          <Link
            to="/wishlist"
            className={`ethio-nav-item ${isNavActive('wishlist') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-heart"></i>
            <span>Wishlist</span>
            {wishlistCount > 0 && (
              <span className="badge rounded-pill bg-danger ms-auto" style={{ fontSize: '0.68rem' }}>
                {wishlistCount}
              </span>
            )}
          </Link>

          <Link
            to="/customer/dashboard?tab=reviews"
            className={`ethio-nav-item ${isNavActive('reviews') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-star"></i>
            <span>Reviews</span>
          </Link>

          <Link
            to="/customer/dashboard?tab=warranty"
            className={`ethio-nav-item ${isNavActive('warranty') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-shield-check"></i>
            <span>Warranty Claims</span>
          </Link>

          <Link
            to="/customer/dashboard?tab=notifications"
            className={`ethio-nav-item ${isNavActive('notifications') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-bell"></i>
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="badge rounded-pill bg-danger ms-auto" style={{ fontSize: '0.68rem' }}>
                {unreadCount}
              </span>
            )}
          </Link>

          <Link
            to="/profile"
            className={`ethio-nav-item ${isNavActive('profile') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-person"></i>
            <span>My Profile</span>
          </Link>

        </div>

        {/* Sidebar Footer: Sign Out */}
        <div className="p-3 border-top border-secondary border-opacity-25">
          <button
            type="button"
            className="ethio-nav-item text-danger w-100 m-0"
            onClick={handleSignOut}
          >
            <i className="bi bi-box-arrow-right"></i>
            <span>Sign Out</span>
          </button>
        </div>

      </aside>
    </>
  );
};

export default CustomerSidebar;
