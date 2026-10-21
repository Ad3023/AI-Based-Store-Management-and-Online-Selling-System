import React from 'react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import { formatETB } from '../utils/currency';

const WishlistPage = () => {
  const { wishlist, clearWishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  const handleMoveAllToCart = async () => {
    for (const item of wishlist) {
      if (item.stock > 0) {
        await addToCart(item.id, 1, item);
      }
    }
  };

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
              className="btn btn-primary-gradient rounded-full px-4 text-xs font-bold shadow-sm d-flex align-items-center gap-1.5"
              onClick={handleMoveAllToCart}
            >
              <i className="bi bi-bag-plus-fill"></i>
              <span>Add All to Cart</span>
            </button>
            <button
              type="button"
              className="btn btn-outline-danger rounded-full px-3 text-xs font-bold"
              onClick={clearWishlist}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Wishlist Grid or Empty State */}
      {wishlist.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white my-4 mx-auto" style={{ maxWidth: '520px' }}>
          <div
            className="rounded-circle d-inline-flex align-items-center justify-content-center text-rose-500 mx-auto mb-3"
            style={{ width: '70px', height: '70px', background: '#ffe4e6' }}
          >
            <i className="bi bi-heart fs-1"></i>
          </div>
          <h4 className="fw-bolder text-slate-900 mb-2">Your Wishlist is Empty</h4>
          <p className="text-slate-500 text-xs mb-4">
            Explore our curated AI electronics catalog and click the heart icon on any product card to save your top picks.
          </p>
          <Link
            to="/shop"
            className="btn btn-primary-gradient rounded-full px-5 py-2.5 font-bold text-xs shadow-sm mx-auto"
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
