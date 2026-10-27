import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useCompare } from '../context/CompareContext';
import ProductCard from '../components/ProductCard';
import { formatETB } from '../utils/currency';
import { getProductImage } from '../utils/productImages';

const ProductDetailPage = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isInCompare, toggleCompare } = useCompare();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [boughtTogether, setBoughtTogether] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [selectedImage, setSelectedImage] = useState(null);
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
        setSelectedImage(getProductImage(pRes.data));

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
    if (user?.role === 'admin') {
      alert("Administrators cannot add products to a shopping cart.");
      return;
    }
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
    if (user?.role === 'admin') {
      alert("Administrators cannot make personal shopping purchases.");
      return;
    }
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
        <p className="text-muted small mt-2">Loading EthioTech product specifications...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-5 text-center">
        <div className="card ethio-card p-5 mx-auto" style={{ maxWidth: '480px' }}>
          <i className="bi bi-box-seam fs-1 text-slate-400 mb-3"></i>
          <h4 className="fw-bolder text-slate-800">Product Not Found</h4>
          <p className="text-slate-500 text-sm mb-4">The item you are looking for may have been retired or moved.</p>
          <Link to="/shop" className="btn btn-ethio-primary px-4">Browse Catalog</Link>
        </div>
      </div>
    );
  }

  const mainImg = selectedImage || getProductImage(product);

  return (
    <div style={{ background: '#f4f6fa', minHeight: '100vh' }}>
      <div className="container py-4">
        {/* Navigation Breadcrumb (Screen 8) */}
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
            <ol className="breadcrumb mb-0 text-xs">
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none text-slate-500">Home</Link></li>
              <li className="breadcrumb-item"><Link to="/shop" className="text-decoration-none text-slate-500">Shop</Link></li>
              <li className="breadcrumb-item"><span className="text-slate-500">{product.category_name}</span></li>
              <li className="breadcrumb-item active text-truncate fw-bold text-slate-800" style={{ maxWidth: '250px' }}>{product.name}</li>
            </ol>
          </nav>
        </div>

        {/* Main Showcase Card (Screen 8) */}
        <div className="card ethio-card p-4 p-md-5 mb-5">
          <div className="row g-5">
            {/* Image Column */}
            <div className="col-lg-5">
              <div
                className="rounded-4 p-4 d-flex align-items-center justify-content-center bg-white border border-slate-200 position-relative mb-3 shadow-sm"
                style={{ minHeight: '360px' }}
              >
                <img
                  src={mainImg}
                  alt={product.name}
                  className="img-fluid"
                  style={{ maxHeight: '320px', objectFit: 'contain' }}
                />
              </div>

              {/* Thumbnail Strip */}
              <div className="d-flex gap-2">
                {[getProductImage(product)].map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`btn p-1 rounded-3 border bg-white ${selectedImage === imgUrl ? 'border-primary shadow-sm' : 'border-slate-200'}`}
                    onClick={() => setSelectedImage(imgUrl)}
                    style={{ width: '64px', height: '64px' }}
                  >
                    <img src={imgUrl} alt="Thumbnail" className="w-100 h-100 object-fit-contain" />
                  </button>
                ))}
              </div>
            </div>

            {/* Details Column */}
            <div className="col-lg-7">
              <span className="badge bg-primary bg-opacity-10 text-primary text-uppercase mb-2 px-3 py-1.5 rounded-pill fw-semibold text-xs">
                {product.category_name}
              </span>

              <h2 className="fw-bolder mb-2 text-slate-900 tracking-tight">{product.name}</h2>
              <div className="text-slate-400 text-xs mb-3">SKU: <code className="text-slate-700">{product.sku}</code></div>

              {/* Rating Stars & Customer Count */}
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="text-amber-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <i
                      key={star}
                      className={`bi ${
                        star <= Math.round(Number(product.rating_average || 5)) ? 'bi-star-fill' : 'bi-star'
                      } me-1`}
                    ></i>
                  ))}
                </div>
                <span className="fw-bold text-slate-800 small">{Number(product.rating_average || 5.0).toFixed(1)}</span>
                <span className="text-slate-400 text-xs">
                  ({product.rating_count || 12} Verified Customer Reviews)
                </span>
              </div>

              {/* Price Area with Discount Strikethrough (Screen 8) */}
              <div className="d-flex flex-wrap align-items-baseline gap-3 mb-4 p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span className="display-6 fw-bolder text-primary">
                  {formatETB(product.current_price || product.price)}
                </span>
                {product.has_promotion && product.current_price && Number(product.current_price) < Number(product.price) && (
                  <>
                    <span className="text-slate-400 text-decoration-line-through fs-5">
                      {formatETB(product.price)}
                    </span>
                    <span className="badge bg-danger rounded-pill px-2.5 py-1 text-xs">
                      {product.discount_label || `Save ${formatETB(Number(product.price) - Number(product.current_price))}`}
                    </span>
                  </>
                )}
                {!product.has_promotion && product.compare_at_price && Number(product.compare_at_price) > Number(product.price) && (
                  <>
                    <span className="text-slate-400 text-decoration-line-through fs-5">
                      {formatETB(product.compare_at_price)}
                    </span>
                    <span className="badge bg-danger rounded-pill px-2.5 py-1 text-xs">
                      Save {formatETB(product.compare_at_price - product.price)}
                    </span>
                  </>
                )}
              </div>

              {/* Stock Status Badge */}
              <div className="mb-4">
                {product.stock === 0 ? (
                  <span className="badge bg-danger bg-opacity-10 text-danger p-2 px-3 fs-6 rounded-pill border border-danger border-opacity-25">
                    <i className="bi bi-x-circle me-1"></i> Out of Stock
                  </span>
                ) : product.is_low_stock ? (
                  <span className="badge bg-warning bg-opacity-20 text-warning-emphasis p-2 px-3 fs-6 rounded-pill border border-warning">
                    <i className="bi bi-exclamation-triangle-fill me-1"></i> Low Stock ({product.stock} available)
                  </span>
                ) : (
                  <span className="badge bg-success bg-opacity-10 text-success p-2 px-3 fs-6 rounded-pill border border-success border-opacity-25">
                    <i className="bi bi-check-circle-fill me-1"></i> In Stock ({product.stock} available)
                  </span>
                )}
              </div>

              {/* Quantity Stepper & Action Buttons (Screen 8) */}
              {user?.role === 'admin' ? (
                <div className="p-3.5 rounded-3 bg-slate-50 border border-slate-300 w-100 mt-2">
                  <div className="d-flex align-items-center gap-2 text-slate-800 fw-bold mb-1">
                    <i className="bi bi-shield-lock-fill text-primary fs-5"></i>
                    <span>Administrator Catalog Preview</span>
                  </div>
                  <p className="text-slate-600 small mb-3">
                    Personal shopping buttons (Add to Cart, Buy Now, Wishlist) are disabled for administrator accounts. You can edit this item’s price, stock, and descriptions via the Manager / Admin catalog.
                  </p>
                  <div className="d-flex flex-wrap gap-2">
                    <Link
                      to={`/manager/products?search=${encodeURIComponent(product.name)}`}
                      className="btn btn-sm btn-outline-primary fw-semibold d-inline-flex align-items-center gap-1"
                    >
                      <i className="bi bi-pencil-square"></i> Manage in Admin Console
                    </Link>
                    <Link
                      to="/admin/dashboard"
                      className="btn btn-sm btn-outline-secondary fw-semibold d-inline-flex align-items-center gap-1"
                    >
                      <i className="bi bi-speedometer2"></i> Admin Dashboard
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="d-flex flex-wrap align-items-center gap-3 pt-3 border-top border-slate-200">
                  {/* Stepper */}
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

                  {/* Add to Cart */}
                  <button
                    className={`btn btn-lg btn-ethio-primary px-4 fw-bold d-flex align-items-center gap-2 ${
                      added ? 'btn-success' : ''
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

                  {/* Buy Now */}
                  <button
                    className="btn btn-lg btn-outline-primary px-4 fw-bold"
                    onClick={handleBuyNow}
                    disabled={adding || product.stock === 0}
                  >
                    Buy Now
                  </button>

                  {/* Add to Wishlist */}
                  <button
                    type="button"
                    className={`btn btn-lg rounded-3 px-3 d-flex align-items-center gap-2 ${
                      isInWishlist(product.id) ? 'btn-danger text-white' : 'btn-outline-danger'
                    }`}
                    onClick={() => toggleWishlist(product)}
                    title={isInWishlist(product.id) ? "Remove from Wishlist" : "Save to Wishlist"}
                  >
                    <i className={`bi ${isInWishlist(product.id) ? 'bi-heart-fill' : 'bi-heart'}`}></i>
                    <span className="small fw-semibold">{isInWishlist(product.id) ? 'Wishlisted' : 'Wishlist'}</span>
                  </button>

                  {/* Add to Compare */}
                  <button
                    type="button"
                    className={`btn btn-lg rounded-3 px-3 d-flex align-items-center gap-2 ${
                      isInCompare(product.id) ? 'btn-primary text-white' : 'btn-outline-secondary'
                    }`}
                    onClick={() => toggleCompare(product)}
                    title={isInCompare(product.id) ? "Remove from Comparison" : "Add to Comparison"}
                  >
                    <i className="bi bi-arrow-left-right"></i>
                    <span className="small fw-semibold">{isInCompare(product.id) ? 'Comparing' : 'Compare'}</span>
                  </button>
                </div>
              )}

              {/* 3 Trust Badges (Screen 8) */}
              <div className="mt-4 pt-3 border-top border-slate-200">
                <div className="row g-3">
                  {/* Badge 1: 1 Year Warranty */}
                  <div className="col-12 col-sm-4">
                    <div className="p-3 rounded-3 bg-white border border-slate-200 h-100 text-center">
                      <i className="bi bi-shield-check text-primary fs-3 d-block mb-1"></i>
                      <div className="fw-bold text-slate-800 text-xs">1 Year Warranty</div>
                      <small className="text-slate-400 text-[11px]">Official Tech Coverage</small>
                    </div>
                  </div>

                  {/* Badge 2: Free Delivery Addis Ababa */}
                  <div className="col-12 col-sm-4">
                    <div className="p-3 rounded-3 bg-white border border-slate-200 h-100 text-center">
                      <i className="bi bi-truck text-emerald-600 fs-3 d-block mb-1"></i>
                      <div className="fw-bold text-slate-800 text-xs">Free Delivery</div>
                      <small className="text-slate-400 text-[11px]">Addis Ababa Orders</small>
                    </div>
                  </div>

                  {/* Badge 3: Chapa Payment */}
                  <div className="col-12 col-sm-4">
                    <div className="p-3 rounded-3 bg-white border border-slate-200 h-100 text-center">
                      <i className="bi bi-credit-card-2-front text-cyan-600 fs-3 d-block mb-1"></i>
                      <div className="fw-bold text-slate-800 text-xs">Chapa Payment</div>
                      <small className="text-slate-400 text-[11px]">Telebirr, CBE & Cards</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs for Specifications, Description, Reviews (Screen 8) */}
        <div className="card ethio-card mb-5 overflow-hidden">
          <div className="border-bottom border-slate-200 bg-slate-50 px-4 pt-3 d-flex gap-3">
            <button
              className={`btn pb-3 text-sm fw-bold border-0 rounded-0 ${
                activeTab === 'description'
                  ? 'text-primary border-bottom border-primary border-2'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setActiveTab('description')}
            >
              Description
            </button>
            <button
              className={`btn pb-3 text-sm fw-bold border-0 rounded-0 ${
                activeTab === 'specifications'
                  ? 'text-primary border-bottom border-primary border-2'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setActiveTab('specifications')}
            >
              Specifications
            </button>
            <button
              className={`btn pb-3 text-sm fw-bold border-0 rounded-0 ${
                activeTab === 'reviews'
                  ? 'text-primary border-bottom border-primary border-2'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setActiveTab('reviews')}
            >
              Reviews ({product.reviews?.length || product.rating_count || 0})
            </button>
          </div>

          <div className="p-4 p-md-5">
            {activeTab === 'description' && (
              <div>
                <h5 className="fw-bolder text-slate-900 mb-3">Product Overview</h5>
                <p className="text-slate-600 mb-4" style={{ lineHeight: '1.8' }}>
                  {product.description || 'High-performance electronics crafted for reliability, productivity, and modern lifestyle.'}
                </p>
                {product.warranty_info && (
                  <div className="p-3 rounded-3 bg-blue-50 border border-blue-200 text-xs">
                    <strong>Warranty Coverage:</strong> {product.warranty_info.coverage_summary}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'specifications' && (
              <div>
                <h5 className="fw-bolder text-slate-900 mb-3">Technical Specifications</h5>
                <table className="table table-bordered text-sm">
                  <tbody>
                    <tr>
                      <td className="fw-bold bg-slate-50" style={{ width: '220px' }}>Category</td>
                      <td>{product.category_name}</td>
                    </tr>
                    <tr>
                      <td className="fw-bold bg-slate-50">SKU</td>
                      <td><code>{product.sku}</code></td>
                    </tr>
                    <tr>
                      <td className="fw-bold bg-slate-50">Warranty Policy</td>
                      <td>{product.warranty_info?.name || '1 Year Standard Warranty'}</td>
                    </tr>
                    <tr>
                      <td className="fw-bold bg-slate-50">Stock Availability</td>
                      <td>{product.stock} units available in Addis Ababa warehouse</td>
                    </tr>
                    <tr>
                      <td className="fw-bold bg-slate-50">Payment Channels</td>
                      <td>Telebirr, CBE Birr, Chapa Gateway, Bank Card</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="fw-bolder text-slate-900 mb-0">Customer Ratings & Reviews</h5>
                </div>

                <div className="row g-4">
                  <div className="col-lg-7">
                    {product.reviews && product.reviews.length > 0 ? (
                      <div className="d-flex flex-column gap-3">
                        {product.reviews.map((rev) => (
                          <div key={rev.id} className="p-3 rounded-3 bg-slate-50 border border-slate-200">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="fw-bold text-slate-900">{rev.username}</span>
                              <div className="text-amber-500 small">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <i key={s} className={`bi ${s <= rev.rating ? 'bi-star-fill' : 'bi-star'} me-1`}></i>
                                ))}
                              </div>
                            </div>
                            <p className="mb-1 text-slate-600 small">{rev.comment || 'Verified purchase'}</p>
                            <small className="text-slate-400 text-[11px]">
                              {new Date(rev.created_at).toLocaleDateString()}
                            </small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-400 text-xs bg-slate-50 rounded-3 border">
                        No customer reviews posted yet. Be the first to share your experience!
                      </div>
                    )}
                  </div>

                  <div className="col-lg-5">
                    <div className="p-4 rounded-3 bg-slate-50 border border-slate-200">
                      <h6 className="fw-bold mb-3">Leave a Review</h6>
                      {user ? (
                        <form onSubmit={handleReviewSubmit}>
                          <div className="mb-3">
                            <label className="form-label text-xs fw-bold">Star Rating</label>
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
                            <label className="form-label text-xs fw-bold">Comments</label>
                            <textarea
                              className="form-control text-xs"
                              rows="3"
                              placeholder="Describe your experience with this tech product..."
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value)}
                            ></textarea>
                          </div>
                          <button
                            type="submit"
                            className="btn btn-ethio-primary w-100 text-xs fw-bold"
                            disabled={submittingReview}
                          >
                            {submittingReview ? 'Submitting...' : 'Submit Review'}
                          </button>
                        </form>
                      ) : (
                        <div className="text-center py-3">
                          <p className="text-slate-400 text-xs mb-3">Please sign in to write a customer review.</p>
                          <Link to="/login" className="btn btn-sm btn-outline-primary px-3">Sign In</Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Frequently Bought Together (AI Co-occurrence) */}
        {boughtTogether.length > 0 && (
          <section className="mb-5">
            <div className="mb-3">
              <span className="badge bg-primary bg-opacity-10 text-primary text-xs mb-1 px-2.5 py-1 rounded-pill">
                <i className="bi bi-stars me-1"></i> AI Bundle Recommendation
              </span>
              <h4 className="fw-bolder mb-0 text-slate-900 tracking-tight">Frequently Bought Together</h4>
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

        {/* AI Similar Alternatives */}
        {similarProducts.length > 0 && (
          <section className="mb-5">
            <div className="mb-3">
              <span className="badge bg-info bg-opacity-10 text-info text-xs mb-1 px-2.5 py-1 rounded-pill">
                <i className="bi bi-cpu me-1"></i> Content Matching
              </span>
              <h4 className="fw-bolder mb-0 text-slate-900 tracking-tight">Similar Alternatives</h4>
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
      </div>
    </div>
  );
};

export default ProductDetailPage;
