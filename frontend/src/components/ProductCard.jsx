import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { formatETB } from '../utils/currency';
import { getProductImage } from '../utils/productImages';

const ProductCard = ({ product, aiTag, variant = 'light' }) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { isInWishlist, toggleWishlist: toggleWishlistCtx } = useWishlist();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const isDark = variant === 'dark';
  const isWishlisted = isInWishlist(product.id);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}&action=add_to_cart&productId=${product.id}`);
      return;
    }
    if (product.stock === 0) {
      alert("This item is currently out of stock.");
      return;
    }
    try {
      setAdding(true);
      await addToCart(product.id, 1, product);
      setAdded(true);
      setTimeout(() => setAdded(false), 2200);
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to add item.");
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate(`/login?redirect=/checkout&action=add_to_cart&productId=${product.id}`);
      return;
    }
    if (product.stock === 0) {
      alert("This item is currently out of stock.");
      return;
    }
    try {
      setAdding(true);
      await addToCart(product.id, 1, product);
      navigate('/cart');
    } catch (err) {
      alert(err.response?.data?.error || "Unable to proceed to checkout.");
    } finally {
      setAdding(false);
    }
  };

  const toggleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlistCtx(product);
  };

  const discountPercent =
    product.compare_at_price && Number(product.compare_at_price) > Number(product.price)
      ? Math.round(((Number(product.compare_at_price) - Number(product.price)) / Number(product.compare_at_price)) * 100)
      : null;

  const imageUrl = getProductImage(product);
  const isOutOfStock = product.stock === 0;

  return (
    <div
      className={`card h-100 flex flex-col justify-between overflow-hidden group transition-all duration-300 ${
        isDark
          ? 'nexus-card-dark'
          : 'border border-slate-200/90 rounded-3xl bg-white shadow-sm hover:shadow-xl hover:border-cyan-400/50'
      }`}
      style={{
        borderRadius: '24px',
        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="relative">
        {/* Wishlist Heart Toggle */}
        <button
          type="button"
          onClick={toggleWishlist}
          className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full shadow-sm flex items-center justify-center transition-all ${
            isDark
              ? 'bg-slate-900/80 text-slate-300 hover:text-rose-400 hover:bg-slate-800'
              : 'bg-white/90 hover:bg-white text-slate-400 hover:text-rose-500'
          }`}
          title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
        >
          <i className={`bi ${isWishlisted ? 'bi-heart-fill text-rose-500' : 'bi-heart'}`}></i>
        </button>

        {/* AI Recommendation Tag */}
        {aiTag && (
          <div className="absolute top-3 left-3 z-10">
            <span
              className="badge px-2.5 py-1.5 rounded-full font-bold text-[11px] d-flex align-items-center gap-1 shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              <i className="bi bi-stars text-cyan-300"></i> {aiTag}
            </span>
          </div>
        )}

        {/* Discount Badge */}
        {discountPercent && !aiTag && (
          <div className="absolute top-3 left-3 z-10">
            <span className="badge bg-danger rounded-full fw-bold px-2 py-1 text-[11px]">
              -{discountPercent}%
            </span>
          </div>
        )}

        {/* Product Image Wrapper with Glowing Podium (Screenshot 1 Visuals) */}
        <Link
          to={`/product/${product.id}`}
          className={`block w-full h-56 p-4 overflow-hidden relative flex items-center justify-center ${
            isDark ? 'product-podium-glow' : 'bg-slate-50'
          }`}
          style={{ borderTopLeftRadius: '24px', borderTopRightRadius: '24px' }}
        >
          {/* Subtle neon ring under product image */}
          <div className="product-podium-ring"></div>

          <img
            src={imageUrl}
            alt={product.name}
            className="max-h-full max-w-full object-contain relative z-2 group-hover:scale-108 transition-transform duration-400"
            loading="lazy"
          />

          {isOutOfStock && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center z-10">
              <span className="badge bg-slate-800 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-wider">
                Out of Stock
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Details Body */}
      <div className={`p-4 flex flex-col flex-grow justify-between ${isDark ? 'text-white' : ''}`}>
        <div>
          {/* Category & Star Ratings */}
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-cyan-400' : 'text-slate-400'}`}>
              {product.category_name || 'Electronics'}
            </span>
            {Number(product.rating_count) > 0 ? (
              <div className="flex items-center text-amber-400 text-xs gap-1" title={`${product.rating_count} verified reviews`}>
                <i className="bi bi-star-fill"></i>
                <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {Number(product.rating_average).toFixed(1)}
                </span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                  ({product.rating_count})
                </span>
              </div>
            ) : (
              <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                No reviews yet
              </span>
            )}
          </div>

          {/* Title */}
          <Link to={`/product/${product.id}`} className="text-decoration-none">
            <h6
              className={`font-bold text-sm line-clamp-2 transition-colors mb-2 leading-snug ${
                isDark ? 'text-slate-100 hover:text-cyan-400' : 'text-slate-900 hover:text-blue-600'
              }`}
              style={{ minHeight: '38px' }}
              title={product.name}
            >
              {product.name}
            </h6>
          </Link>

          {/* Stock Availability indicator */}
          <div className="mb-3">
            {isOutOfStock ? (
              <span className="text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                <i className="bi bi-x-circle-fill"></i> Out of Stock
              </span>
            ) : product.stock <= 5 ? (
              <span className="text-[11px] text-amber-500 font-semibold flex items-center gap-1">
                <i className="bi bi-exclamation-triangle-fill"></i> Only {product.stock} units left!
              </span>
            ) : (
              <span className={`text-[11px] font-semibold flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                <i className="bi bi-check-circle-fill"></i> In Stock ({product.stock} units)
              </span>
            )}
          </div>
        </div>

        {/* Price & Action Buttons */}
        <div className={`pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-baseline justify-between mb-3">
            <div>
              {product.has_promotion || (product.current_price && Number(product.current_price) < Number(product.price)) ? (
                <div>
                  <div className={`text-base font-extrabold ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>
                    {formatETB(product.current_price)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-slate-400 line-through">
                      {formatETB(product.price)}
                    </span>
                    <span className="badge bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                      {product.discount_label || 'SALE'}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className={`text-base font-extrabold ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>
                    {formatETB(product.price)}
                  </div>
                  {product.compare_at_price && (
                    <div className="text-xs text-slate-400 line-through">
                      {formatETB(product.compare_at_price)}
                    </div>
                  )}
                </div>
              )}
            </div>
            {product.warranty_info && (
              <span className="badge bg-slate-100 text-slate-600 border text-[9px] rounded-pill font-medium">
                <i className="bi bi-shield-check me-0.5 text-primary"></i>
                {product.warranty_info.duration_days}D Warranty
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* BUY NOW Button (Screenshot 1 Glowing Button) */}
            <button
              type="button"
              className={`btn btn-sm rounded-full font-bold py-1.5 px-2 text-xs flex items-center justify-center gap-1 transition-all ${
                isDark
                  ? 'btn-cyan-glow'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
              }`}
              onClick={handleBuyNow}
              disabled={isOutOfStock || adding}
            >
              <i className="bi bi-lightning-charge-fill text-[11px]"></i> Buy Now
            </button>

            {/* Add to Cart Button */}
            <button
              type="button"
              className={`btn btn-sm rounded-full font-semibold py-1.5 px-2 text-xs flex items-center justify-center gap-1 transition-all ${
                added
                  ? 'btn-success text-white'
                  : isDark
                  ? 'btn-dark-outline hover:border-cyan-400'
                  : 'btn-outline-custom hover:btn-primary-gradient hover:text-white'
              }`}
              onClick={handleAddToCart}
              disabled={isOutOfStock || adding}
            >
              {adding ? (
                <span className="spinner-border spinner-border-sm" role="status" style={{ width: '12px', height: '12px' }}></span>
              ) : added ? (
                <>
                  <i className="bi bi-check2"></i> Added
                </>
              ) : (
                <>
                  <i className="bi bi-cart-plus"></i> Add
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
