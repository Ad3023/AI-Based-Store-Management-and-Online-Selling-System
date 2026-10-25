import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { formatETB } from '../utils/currency';
import { getProductImage } from '../utils/productImages';

const ProductCard = ({ product, aiTag }) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { isInWishlist, toggleWishlist: toggleWishlistCtx } = useWishlist();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const isWishlisted = isInWishlist(product.id);
  const isAdmin = user?.role === 'admin';

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}&action=add_to_cart&productId=${product.id}`);
      return;
    }
    if (isAdmin) {
      alert("Administrators are restricted from personal shopping and adding products to the cart.");
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
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to add item.");
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
      className="card h-100 border bg-white ethio-card d-flex flex-column justify-content-between position-relative overflow-hidden"
      style={{
        borderRadius: '1rem',
        borderColor: '#e2e8f0',
        transition: 'all 0.25s ease',
      }}
    >
      <Link to={`/product/${product.id}`} className="text-decoration-none text-dark d-flex flex-column h-100">
        
        {/* Card Header: Badges & Wishlist */}
        <div className="position-relative p-3 pb-0">
          <div className="d-flex justify-content-between align-items-center w-100 position-absolute top-0 start-0 p-3" style={{ zIndex: 2 }}>
            <div>
              {discountPercent && (
                <span className="badge bg-danger rounded-pill px-2.5 py-1 text-white fw-bold" style={{ fontSize: '0.72rem' }}>
                  -{discountPercent}%
                </span>
              )}
              {aiTag && !discountPercent && (
                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-2 py-1 text-[11px] fw-bold">
                  {aiTag}
                </span>
              )}
            </div>

            {!isAdmin && (
              <button
                type="button"
                onClick={toggleWishlist}
                className="btn btn-sm rounded-circle p-1 d-flex align-items-center justify-content-center shadow-sm"
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid #e2e8f0',
                  color: isWishlisted ? '#ef4444' : '#94a3b8',
                }}
                title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
              >
                <i className={`bi ${isWishlisted ? 'bi-heart-fill' : 'bi-heart'} fs-6`}></i>
              </button>
            )}
          </div>

          {/* Product Image */}
          <div
            className="d-flex align-items-center justify-content-center p-3 rounded-3"
            style={{ height: '180px', backgroundColor: '#f8fafc' }}
          >
            <img
              src={imageUrl}
              alt={product.name}
              className="img-fluid"
              style={{
                maxHeight: '150px',
                maxWidth: '90%',
                objectFit: 'contain',
                transition: 'transform 0.3s ease',
              }}
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80';
              }}
            />
          </div>
        </div>

        {/* Product Details */}
        <div className="p-3 d-flex flex-column flex-grow-1 justify-content-between">
          <div>
            {/* Category */}
            <div className="text-muted text-uppercase fw-semibold mb-1" style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}>
              {product.category_name || (typeof product.category === 'object' ? product.category?.name : 'Electronics')}
            </div>

            {/* Product Title */}
            <h6 className="fw-bold text-slate-900 mb-1 text-truncate-2" style={{ fontSize: '0.92rem', minHeight: '2.5rem', lineHeight: '1.3' }}>
              {product.name}
            </h6>

            {/* Rating Stars */}
            <div className="d-flex align-items-center gap-1.5 mb-2">
              <div className="d-flex text-warning text-xs">
                {[1, 2, 3, 4, 5].map((star) => (
                  <i
                    key={star}
                    className={`bi ${
                      (product.rating_average || 4.5) >= star
                        ? 'bi-star-fill'
                        : (product.rating_average || 4.5) >= star - 0.5
                        ? 'bi-star-half'
                        : 'bi-star'
                    }`}
                  ></i>
                ))}
              </div>
              <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                ({product.rating_average ? Number(product.rating_average).toFixed(1) : '4.5'})
              </span>
            </div>
          </div>

          {/* Price & Action */}
          <div>
            <div className="d-flex align-items-baseline gap-2 mb-2.5">
              <span className="fw-bolder text-slate-900" style={{ fontSize: '1.05rem' }}>
                {formatETB(product.price)}
              </span>
              {product.compare_at_price && Number(product.compare_at_price) > Number(product.price) && (
                <span className="text-muted text-decoration-line-through text-xs">
                  {formatETB(product.compare_at_price)}
                </span>
              )}
            </div>

            {/* Stock status indicator */}
            <div className="mb-2.5">
              {isOutOfStock ? (
                <span className="badge bg-danger bg-opacity-10 text-danger text-[10px] fw-bold">Out of Stock</span>
              ) : (
                <span className="badge bg-success bg-opacity-10 text-success text-[10px] fw-bold">
                  In Stock ({product.stock} units)
                </span>
              )}
            </div>

            {/* Add to Cart Button or Admin View Badge */}
            {isAdmin ? (
              <div
                className="btn btn-sm w-100 fw-semibold d-flex align-items-center justify-content-center gap-1.5 py-2 text-slate-500"
                style={{
                  backgroundColor: '#f1f5f9',
                  borderRadius: '0.5rem',
                  fontSize: '0.78rem',
                  border: '1px solid #e2e8f0',
                  cursor: 'default',
                }}
                title="Personal shopping is disabled for administrator accounts"
              >
                <i className="bi bi-shield-lock text-primary"></i> Admin View
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock || adding}
                className="btn btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-2 py-2"
                style={{
                  backgroundColor: added ? '#10b981' : '#1b64da',
                  color: '#ffffff',
                  borderRadius: '0.5rem',
                  border: 'none',
                  fontSize: '0.82rem',
                  transition: 'all 0.2s ease',
                }}
              >
                {adding ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Adding...
                  </>
                ) : added ? (
                  <>
                    <i className="bi bi-check-circle-fill"></i> Added!
                  </>
                ) : isOutOfStock ? (
                  'Out of Stock'
                ) : (
                  <>
                    <i className="bi bi-cart-plus"></i> Add to Cart
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </Link>
    </div>
  );
};

export default ProductCard;
