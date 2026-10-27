import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatETB } from '../utils/currency';
import { getProductPricing } from '../utils/pricing';

const CartPage = () => {
  const { cart, updateQuantity, removeFromCart, clearCart, loading } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '500px' }}>
          <i className="bi bi-person-lock fs-1 text-primary mb-3"></i>
          <h4 className="fw-bold">Sign In Required</h4>
          <p className="text-muted small mb-4">Please log in to view and manage your shopping cart.</p>
          <Link to="/login" className="btn btn-primary-gradient rounded-pill px-4">Log In to Continue</Link>
        </div>
      </div>
    );
  }

  if (user?.role === 'admin') {
    return (
      <div className="container py-5 text-center">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '520px' }}>
          <div className="mx-auto rounded-circle d-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px', background: '#eff6ff' }}>
            <i className="bi bi-shield-lock-fill fs-1 text-primary"></i>
          </div>
          <h4 className="fw-bold text-slate-900">Administrator Cart Restriction</h4>
          <p className="text-muted small mb-4">
            Personal shopping carts and checkout are disabled for administrator accounts. You can review customer orders, inventory levels, and system settings in the admin portal.
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

  const subtotal = Number(cart.total_price || 0);
  const shippingFee = subtotal > 0 ? 50.0 : 0.0;
  const tax = subtotal > 0 ? Math.round(subtotal * 0.15 * 100) / 100 : 0.0;
  const grandTotal = subtotal + shippingFee + tax;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bolder mb-1">Your Shopping Cart</h2>
          <p className="text-muted small mb-0">{cart.total_items} items in your order</p>
        </div>
        {cart.items && cart.items.length > 0 && (
          <button className="btn btn-outline-danger btn-sm rounded-pill px-3" onClick={clearCart}>
            <i className="bi bi-trash3 me-1"></i> Clear Cart
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border text-primary spinner-border-sm" role="status"></div>
        </div>
      )}

      {cart.items && cart.items.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4 p-5 text-center my-4">
          <div className="mx-auto rounded-circle d-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px', background: '#f1f5f9' }}>
            <i className="bi bi-cart-x fs-1 text-muted"></i>
          </div>
          <h4 className="fw-bold">Your cart is currently empty</h4>
          <p className="text-muted small mb-4">Explore our catalog and find the latest tech gadgets to fill your cart.</p>
          <div>
            <Link to="/shop" className="btn btn-primary-gradient rounded-pill px-4 py-2 fw-bold">
              <i className="bi bi-arrow-left me-2"></i> Start Shopping
            </Link>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {/* Items List */}
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4">
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light text-muted small text-uppercase">
                    <tr>
                      <th>Product</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <div
                              className="rounded-3 p-1 d-flex align-items-center justify-content-center"
                              style={{ width: '64px', height: '64px', background: '#f8fafc', border: '1px solid #e2e8f0' }}
                            >
                              {item.product.image ? (
                                <img src={item.product.image} alt={item.product.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                              ) : (
                                <i className="bi bi-laptop text-muted fs-4"></i>
                              )}
                            </div>
                            <div>
                              <Link to={`/product/${item.product.id}`} className="text-dark fw-bold text-decoration-none small text-truncate-2" style={{ maxWidth: '220px' }}>
                                {item.product.name}
                              </Link>
                              <div className="text-muted" style={{ fontSize: '0.72rem' }}>{item.product.category_name}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {(() => {
                            const pricing = getProductPricing(item.product);
                            return (
                              <div>
                                <span className="fw-semibold small">{formatETB(pricing.price)}</span>
                                {pricing.hasDiscount && pricing.originalPrice && (
                                  <span className="text-muted text-decoration-line-through text-[11px] d-block">
                                    {formatETB(pricing.originalPrice)}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          <div className="input-group input-group-sm" style={{ width: '105px' }}>
                            <button
                              className="btn btn-outline-secondary"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              -
                            </button>
                            <input
                              type="text"
                              className="form-control text-center fw-bold"
                              value={item.quantity}
                              readOnly
                            />
                            <button
                              className="btn btn-outline-secondary"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={item.quantity >= item.product.stock}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="fw-bold text-primary">{formatETB(item.subtotal)}</td>
                        <td>
                          <button
                            className="btn btn-link text-danger p-0"
                            title="Remove item"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Order Summary Column matching Panel 3 */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm rounded-3xl p-4 sticky-top bg-white" style={{ top: '80px' }}>
              <h5 className="fw-bolder mb-3 text-slate-900">Order Summary</h5>

              {/* Promo Code Input matching Panel 3 */}
              <div className="mb-4 pb-3 border-bottom border-slate-100">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control form-control-sm bg-slate-50 border-0 rounded-start-full py-2 text-xs ps-3"
                    placeholder="Have a promo code?"
                  />
                  <button className="btn btn-primary-gradient btn-sm rounded-end-full px-3 text-xs font-bold" type="button">
                    Apply
                  </button>
                </div>
              </div>

              <div className="d-flex justify-content-between mb-2 small text-secondary">
                <span>Subtotal ({cart.total_items} items)</span>
                <span className="fw-bold text-dark">{formatETB(subtotal)}</span>
              </div>

              <div className="d-flex justify-content-between mb-2 small text-secondary">
                <span>Estimated VAT (15%)</span>
                <span className="fw-bold text-dark">{formatETB(tax)}</span>
              </div>

              <div className="d-flex justify-content-between mb-3 small text-secondary">
                <span>Shipping Fee</span>
                <span className="fw-bold text-dark">{formatETB(shippingFee)}</span>
              </div>

              <hr className="my-3 border-slate-100" />

              <div className="d-flex justify-content-between mb-4">
                <span className="fw-bolder fs-5 text-slate-900">Total</span>
                <span className="fw-bolder fs-4 text-primary">{formatETB(grandTotal)}</span>
              </div>

              <button
                className="btn btn-primary-gradient w-100 rounded-full py-3 fw-bold shadow-sm mb-3"
                onClick={() => navigate('/checkout')}
              >
                Proceed to Checkout
              </button>

              <div className="small text-muted text-center text-xs flex items-center justify-center gap-1.5">
                <i className="bi bi-lock-fill text-slate-400"></i>
                <span>Secure Checkout &bull; Your information is safe and secure</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
