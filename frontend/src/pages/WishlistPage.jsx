import React from 'react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';
import { formatETB } from '../utils/currency';

const WishlistPage = () => {
  const { wishlist, clearWishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { user } = useAuth();

  const handleMoveAllToCart = async () => {
    if (user?.role === 'admin') return;
    for (const item of wishlist) {
      if (item.stock > 0) {
        await addToCart(item.id, 1, item);
      }
    }
  };

  if (user?.role === 'admin') {
    return (
      <div className="container py-5 text-center">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '520px' }}>
          <div className="mx-auto rounded-circle d-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px', background: '#eff6ff' }}>
            <i className="bi bi-shield-lock-fill fs-1 text-primary"></i>
          </div>
          <h4 className="fw-bold text-slate-900">Administrator Wishlist Restricted</h4>
          <p className="text-muted small mb-4">
            Personal wishlists and shopping carts are disabled for administrator accounts. You can manage products, view stock, and monitor orders in the admin dashboard.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/admin/dashboard" className="btn btn-ethio-primary rounded-pill px-4">
              <i className="bi bi-speedometer2 me-1"></i> Admin Dashboard
            </Link>
            <Link to="/shop" className="btn btn-outline-secondary rounded-pill px-4">
              Browse Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5">
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-full mb-2 bg-rose-50 text-rose-600 text-xs font-bold uppercase tracking-wider border border-rose-200">
            <i className="bi bi-heart-fill"></i> Saved Favorites
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900">My Wishlist</h2>
          <p className="text-slate-500 text-sm mb-0">
            {wishlist.length} item{wishlist.length === 1 ? '' : 's'} saved for later purchase or price tracking
          </p>
        </div>

        {wishlist.length > 0 && (
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-ethio-primary px-4 text-xs font-bold shadow-sm d-flex align-items-center gap-1.5"
              onClick={handleMoveAllToCart}
            >
              <i className="bi bi-bag-plus-fill"></i>
              <span>Add All to Cart</span>
            </button>
            <button
              type="button"
              className="btn btn-outline-danger px-3 text-xs font-bold"
              onClick={clearWishlist}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Wishlist Grid or Empty State */}
      {wishlist.length === 0 ? (
        <div className="card ethio-card p-5 text-center my-4 mx-auto" style={{ maxWidth: '520px' }}>
          <div
            className="rounded-circle d-inline-flex align-items-center justify-content-center text-rose-500 mx-auto mb-3"
            style={{ width: '70px', height: '70px', background: '#ffe4e6' }}
          >
            <i className="bi bi-heart fs-1"></i>
          </div>
          <h4 className="fw-bolder text-slate-900 mb-2">Your Wishlist is Empty</h4>
          <p className="text-slate-500 text-xs mb-4">
            Explore our curated electronics catalog and click the heart icon on any product card to save your top picks.
          </p>
          <Link
            to="/shop"
            className="btn btn-ethio-primary px-5 py-2.5 font-bold text-xs shadow-sm mx-auto"
          >
            Explore Electronics Catalog
          </Link>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
          {wishlist.map((product) => (
            <div key={product.id} className="col">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
