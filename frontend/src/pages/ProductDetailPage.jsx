import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import ProductCard from '../components/ProductCard';
import { formatETB } from '../utils/currency';
import { getProductImage } from '../utils/productImages';

const ProductDetailPage = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [boughtTogether, setBoughtTogether] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    const fetchProductDetails = async () => {
      try {
        setLoading(true);
        // Product Detail
        const pRes = await api.get(`products/items/${id}/`);
        setProduct(pRes.data);

        // Similar products (Content-based AI)
        const simRes = await api.get(`recommendations/similar/${id}/?limit=4`);
        setSimilarProducts(simRes.data.results || []);

        // Frequently bought together (Co-occurrence AI)
        const fbtRes = await api.get(`recommendations/bought-together/${id}/?limit=4`);
        setBoughtTogether(fbtRes.data.results || []);
      } catch (err) {
        console.error("Error fetching product details", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProductDetails();
    window.scrollTo(0, 0);
  }, [id]);

  const handleAddToCart = async () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}&action=add_to_cart&productId=${product.id}&quantity=${quantity}`);
      return;
    }
    if (product.stock === 0) {
      alert("This item is currently out of stock.");
      return;
    }
    try {
      setAdding(true);
      await addToCart(product.id, quantity, product);
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to add to cart.");
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}&action=add_to_cart&productId=${product.id}&quantity=${quantity}`);
      return;
    }
    if (product.stock === 0) {
      alert("This item is currently out of stock.");
      return;
    }
    try {
      setAdding(true);
      await addToCart(product.id, quantity, product);
      navigate('/cart');
    } catch (err) {
      alert(err.response?.data?.error || "Failed to proceed to checkout.");
    } finally {
      setAdding(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Please log in to leave a review.");
      return;
    }
    try {
      setSubmittingReview(true);
      await api.post(`products/items/${id}/reviews/`, {
        rating: reviewRating,
        comment: reviewComment
      });
      // Refresh product to show updated rating and reviews
      const updated = await api.get(`products/items/${id}/`);
      setProduct(updated.data);
      setReviewComment('');
      alert("Review submitted successfully!");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Loading product specs & AI recommendations...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-5 text-center">
        <h4>Product Not Found</h4>
        <Link to="/shop" className="btn btn-primary rounded-pill px-4 mt-3">Return to Shop</Link>
      </div>
    );
  }

  return (
    <div className="container py-4">
      {/* Navigation Breadcrumb with Safe Back Button */}
      <div className="d-flex align-items-center mb-4">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/shop');
            }
          }}
          className="btn btn-sm btn-outline-secondary rounded-pill me-3 d-inline-flex align-items-center gap-1 shadow-sm px-3"
          aria-label="Go back"
        >
          <i className="bi bi-arrow-left"></i> Back
        </button>
        <nav aria-label="breadcrumb" className="small flex-grow-1">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
            <li className="breadcrumb-item"><Link to="/shop" className="text-decoration-none">Shop</Link></li>
            <li className="breadcrumb-item active text-truncate" style={{ maxWidth: '250px' }}>{product.name}</li>
          </ol>
        </nav>
      </div>

      {/* Main Showcase */}
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 mb-5">
        <div className="row g-5 align-items-center">
          {/* Image Column */}
          <div className="col-md-5">
            <div
              className="rounded-4 p-4 d-flex align-items-center justify-content-center position-relative product-podium-glow overflow-hidden"
              style={{ background: '#0a1226', minHeight: '380px', border: '1px solid rgba(6, 182, 212, 0.25)' }}
            >
              <div className="product-podium-ring" style={{ width: '85%', height: '22px' }}></div>
              <img
                src={getProductImage(product)}
                alt={product.name}
                className="img-fluid rounded-3 relative z-2"
                style={{ maxHeight: '340px', objectFit: 'contain' }}
              />
            </div>
          </div>

          {/* Details Column */}
          <div className="col-md-7">
            <span className="badge bg-primary bg-opacity-10 text-primary text-uppercase mb-2 px-3 py-2 rounded-pill fw-semibold">
              {product.category_name}
            </span>

            <h2 className="fw-bolder mb-2 text-dark">{product.name}</h2>
            <div className="text-muted small mb-3">SKU: <code className="text-dark">{product.sku}</code></div>

            {/* Rating Stars - Only when real data exists */}
            <div className="d-flex align-items-center gap-2 mb-3">
              {Number(product.rating_count) > 0 ? (
                <>
                  <div className="text-warning">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <i
                        key={star}
                        className={`bi ${
                          star <= Math.round(Number(product.rating_average)) ? 'bi-star-fill' : 'bi-star'
                        } me-1`}
                      ></i>
                    ))}
                  </div>
                  <span className="fw-bold text-dark">{Number(product.rating_average).toFixed(1)}</span>
                  <span className="text-muted small">({product.rating_count} Verified Customer Reviews)</span>
                </>
              ) : (
                <span className="badge bg-slate-100 text-slate-600 rounded-pill px-3 py-1.5 text-xs font-semibold">
                  <i className="bi bi-star me-1"></i> No reviews yet
                </span>
              )}
            </div>

            {/* Price Area with Authoritative Promo Calculation */}
            <div className="d-flex flex-wrap align-items-baseline gap-3 mb-4 p-3 rounded-3" style={{ background: '#f1f5f9' }}>
              <span className="display-6 fw-bolder text-primary">
                {formatETB(product.current_price || product.price)}
              </span>
              {product.has_promotion && product.current_price && Number(product.current_price) < Number(product.price) && (
                <>
                  <span className="text-muted text-decoration-line-through fs-5">
                    {formatETB(product.price)}
                  </span>
                  <span className="badge bg-danger rounded-pill px-3 py-2">
                    {product.discount_label || `Save ${formatETB(Number(product.price) - Number(product.current_price))}`}
                  </span>
                </>
              )}
              {!product.has_promotion && product.compare_at_price && Number(product.compare_at_price) > Number(product.price) && (
                <>
                  <span className="text-muted text-decoration-line-through fs-5">
                    {formatETB(product.compare_at_price)}
                  </span>
                  <span className="badge bg-danger rounded-pill">
                    Save {formatETB(product.compare_at_price - product.price)}
                  </span>
                </>
              )}
            </div>

            {/* Real Warranty Policy Information */}
            {product.warranty_info && (
              <div className="mb-4 p-3 rounded-3 bg-cyan-50 border border-cyan-200">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <div className="d-flex align-items-center gap-2 text-cyan-900 fw-bold small">
                    <i className="bi bi-shield-check text-cyan-600 fs-5"></i>
                    <span>{product.warranty_info.name}</span>
                  </div>
                  <span className="badge bg-cyan-600 text-white rounded-pill px-2.5 py-1 text-xs">
                    {product.warranty_info.duration_days} Days Official Coverage
                  </span>
                </div>
                <p className="text-xs text-slate-700 mb-1" style={{ lineHeight: '1.5' }}>
                  {product.warranty_info.coverage_summary}
                </p>
                {product.warranty_info.claim_instructions && (
                  <div className="text-xs text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    <strong>Claim process:</strong> {product.warranty_info.claim_instructions}
                  </div>
                )}
              </div>
            )}

            {/* Stock Level Alert */}
            <div className="mb-4">
              {product.stock === 0 ? (
                <span className="badge bg-danger p-2 px-3 fs-6 rounded-pill">Out of Stock</span>
              ) : product.is_low_stock ? (
                <div className="alert alert-warning py-2 px-3 rounded-3 d-inline-flex align-items-center gap-2 mb-0">
                  <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                  <span>Hurry! Only <strong>{product.stock} units</strong> remaining in inventory.</span>
                </div>
              ) : (
                <span className="badge bg-success bg-opacity-10 text-success p-2 px-3 fs-6 rounded-pill border border-success border-opacity-25">
                  <i className="bi bi-check-circle-fill me-1"></i> In Stock & Ready to Ship ({product.stock} available)
                </span>
              )}
            </div>

            <p className="text-secondary mb-4" style={{ lineHeight: '1.7' }}>
              {product.description}
            </p>

            {/* Quantity Selector & Add to Cart */}
            <div className="d-flex flex-wrap align-items-center gap-3 pt-3 border-top">
              <div className="input-group" style={{ width: '130px' }}>
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1 || product.stock === 0}
                >
                  -
                </button>
                <input
                  type="number"
                  className="form-control text-center fw-bold"
                  value={quantity}
                  min="1"
                  max={product.stock}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, Number(e.target.value))))}
                  disabled={product.stock === 0}
                />
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock || product.stock === 0}
                >
                  +
                </button>
              </div>

              <button
                className="btn btn-lg btn-cyan-glow rounded-pill px-4 fw-bold d-flex align-items-center gap-2 shadow-sm"
                onClick={handleBuyNow}
                disabled={adding || product.stock === 0}
              >
                <i className="bi bi-lightning-charge-fill"></i> Buy Now
              </button>

              <button
                className={`btn btn-lg rounded-pill px-4 fw-bold d-flex align-items-center gap-2 ${
                  added ? 'btn-success' : 'btn-primary-gradient'
                }`}
                onClick={handleAddToCart}
                disabled={adding || product.stock === 0}
              >
                {adding ? (
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                ) : added ? (
                  <>
                    <i className="bi bi-check2-circle"></i> Added to Cart!
                  </>
                ) : (
                  <>
                    <i className="bi bi-bag-plus-fill"></i> Add to Cart
                  </>
                )}
              </button>

              <Link to="/cart" className="btn btn-lg btn-outline-custom rounded-pill px-4 fw-bold">
                Go to Cart
              </Link>

              <button
                type="button"
                className={`btn btn-lg rounded-pill px-3.5 d-flex align-items-center gap-2 ${
                  isInWishlist(product.id) ? 'btn-danger text-white' : 'btn-outline-danger'
                }`}
                onClick={() => toggleWishlist(product)}
                title={isInWishlist(product.id) ? "Remove from Wishlist" : "Save to Wishlist"}
              >
                <i className={`bi ${isInWishlist(product.id) ? 'bi-heart-fill' : 'bi-heart'}`}></i>
                <span className="small fw-semibold">{isInWishlist(product.id) ? 'Wishlisted' : 'Wishlist'}</span>
              </button>
            </div>

            {/* Delivery & Service Information Highlights */}
            <div className="mt-4 pt-3 border-top">
              <div className="row g-2">
                <div className="col-sm-6">
                  <div className="p-3 rounded-3 bg-slate-50 border border-slate-200 h-100">
                    <div className="d-flex align-items-center gap-2 mb-1 text-slate-800 fw-bold small">
                      <i className="bi bi-truck text-primary fs-5"></i>
                      <span>Ethiopian Express Delivery</span>
                    </div>
                    <ul className="list-unstyled text-xs text-muted mb-0 ps-1" style={{ lineHeight: '1.6' }}>
                      <li>• <strong>Addis Ababa:</strong> Same-day or 1-2 days (ETB 50-100)</li>
                      <li>• <strong>Regional:</strong> 2-3 business days (ETB 150)</li>
                      <li>• Real-time milestone tracking on your dashboard</li>
                    </ul>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="p-3 rounded-3 bg-slate-50 border border-slate-200 h-100">
                    <div className="d-flex align-items-center gap-2 mb-1 text-slate-800 fw-bold small">
                      <i className="bi bi-shield-check text-emerald-600 fs-5"></i>
                      <span>Chapa Verified Checkout</span>
                    </div>
                    <ul className="list-unstyled text-xs text-muted mb-0 ps-1" style={{ lineHeight: '1.6' }}>
                      <li>• Instant online payment via Telebirr, CBEBirr & Cards</li>
                      <li>• Authoritative price calculation and digital receipt</li>
                      <li>• Official warranty snapshot recorded with purchase</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Frequently Bought Together (AI Co-occurrence) */}
      {boughtTogether.length > 0 && (
        <section className="mb-5 p-4 rounded-4 bg-white shadow-sm border border-light">
          <div className="mb-3">
            <span className="ai-badge mb-1">
              <i className="bi bi-bag-check-fill"></i> Smart Co-Purchase
            </span>
            <h4 className="fw-bold mb-1">Frequently Bought Together</h4>
            <p className="text-muted small mb-0">Customers who purchased this product also ordered these items</p>
          </div>

          <div className="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-3">
            {boughtTogether.map((item) => (
              <div key={item.id} className="col">
                <ProductCard product={item} aiTag="Bundle Fit" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Similar Products (Content-Based TF-IDF) */}
      {similarProducts.length > 0 && (
        <section className="mb-5 p-4 rounded-4 bg-white shadow-sm border border-light">
          <div className="mb-3">
            <span className="ai-badge mb-1">
              <i className="bi bi-stars"></i> Content Similarity
            </span>
            <h4 className="fw-bold mb-1">Similar Alternatives</h4>
            <p className="text-muted small mb-0">Products with matching features, technical specifications, and category attributes</p>
          </div>

          <div className="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-3">
            {similarProducts.map((item) => (
              <div key={item.id} className="col">
                <ProductCard product={item} aiTag="Spec Match" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Customer Reviews Section */}
      <section className="card border-0 shadow-sm rounded-4 p-4 p-md-5 mb-5">
        <h4 className="fw-bold mb-4">Customer Reviews & Ratings</h4>

        <div className="row g-5">
          {/* Reviews List */}
          <div className="col-lg-7">
            {product.reviews && product.reviews.length > 0 ? (
              <div className="d-flex flex-column gap-3">
                {product.reviews.map((rev) => (
                  <div key={rev.id} className="p-3 rounded-3 bg-light">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold small"
                          style={{ width: '32px', height: '32px' }}
                        >
                          {rev.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="fw-bold text-dark">{rev.username}</span>
                      </div>
                      <div className="text-warning small">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <i
                            key={s}
                            className={`bi ${s <= rev.rating ? 'bi-star-fill' : 'bi-star'} me-1`}
                          ></i>
                        ))}
                      </div>
                    </div>
                    <p className="mb-1 text-secondary small">{rev.comment || 'Verified purchase'}</p>
                    <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {new Date(rev.created_at).toLocaleDateString()}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted small bg-light rounded-3">
                No reviews yet. Be the first to review this product!
              </div>
            )}
          </div>

          {/* Leave a Review Form */}
          <div className="col-lg-5">
            <div className="p-4 rounded-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <h5 className="fw-bold mb-3">Leave a Rating</h5>
              {user ? (
                <form onSubmit={handleReviewSubmit}>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Your Rating (1 to 5 Stars)</label>
                    <div className="d-flex gap-2">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          className={`btn btn-sm ${
                            reviewRating >= num ? 'btn-warning text-dark' : 'btn-outline-secondary'
                          } rounded-pill px-3`}
                          onClick={() => setReviewRating(num)}
                        >
                          {num} <i className="bi bi-star-fill"></i>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Feedback / Comments</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Share your experience with this device..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary-gradient w-100 rounded-pill fw-bold"
                    disabled={submittingReview}
                  >
                    {submittingReview ? 'Submitting...' : 'Post Customer Review'}
                  </button>
                </form>
              ) : (
                <div className="text-center py-3">
                  <p className="text-muted small mb-3">Please sign in to your customer account to rate and review.</p>
                  <Link to="/login" className="btn btn-outline-primary btn-sm rounded-pill px-4">
                    Sign In
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProductDetailPage;
