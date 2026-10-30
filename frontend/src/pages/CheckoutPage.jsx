import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatETB } from '../utils/currency';
import { getProductImage } from '../utils/productImages';

const CheckoutPage = () => {
  const { cart, fetchCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Split name if present
  const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : '';
  const [firstName, ...restName] = fullName.split(' ');
  const lastName = restName.join(' ');

  const [formData, setFormData] = useState({
    first_name: firstName || '',
    last_name: lastName || '',
    shipping_phone: user?.phone_number || '',
    shipping_address: user?.address || '',
    shipping_city: user?.city || 'Addis Ababa',
    notes: '',
  });

  const [deliveryMethod, setDeliveryMethod] = useState('standard');
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  if (user?.role === 'admin') {
    return (
      <div className="container py-5 text-center">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '520px' }}>
          <div className="mx-auto rounded-circle d-flex align-items-center justify-content-center mb-3" style={{ width: '70px', height: '70px', background: '#eff6ff' }}>
            <i className="bi bi-shield-lock-fill fs-2 text-primary"></i>
          </div>
          <h4 className="fw-bold text-slate-900">Administrator Checkout Restricted</h4>
          <p className="text-muted small mb-4">
            Personal shopping checkout is disabled for administrator accounts. Administrators can monitor orders, manage fulfillment, and view financial reports in the Admin Dashboard.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/admin/dashboard" className="btn btn-ethio-primary rounded-pill px-4 text-xs font-semibold">
              <i className="bi bi-speedometer2 me-1"></i> Admin Dashboard
            </Link>
            <Link to="/shop" className="btn btn-outline-secondary rounded-pill px-4 text-xs font-semibold">
              Browse Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto bg-white border border-slate-200" style={{ maxWidth: '460px' }}>
          <i className="bi bi-cart-x fs-1 text-muted mb-3"></i>
          <h4 className="fw-bold text-slate-900">Your cart is empty</h4>
          <p className="text-muted small mb-4">Add products to your cart before proceeding to checkout.</p>
          <Link to="/shop" className="btn btn-primary-gradient rounded-pill px-4 text-xs font-bold">
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = Number(cart.total_price || 0);

  // Delivery methods, rates and estimates dispatched from Debre Birhan, Amhara, Ethiopia
  const DELIVERY_OPTIONS = {
    standard: {
      name: 'Debre Birhan Local Hub Dispatch',
      cost: 50.0,
      estimate: 'Same-day / 1 business day',
    },
    express: {
      name: 'Addis Ababa & Express Dispatch',
      cost: 100.0,
      estimate: '1–2 business days',
    },
    regional: {
      name: 'Nationwide Ethiopian Courier',
      cost: 150.0,
      estimate: '2–3 business days',
    },
  };

  const selectedDelivery = DELIVERY_OPTIONS[deliveryMethod];
  const shippingFee = selectedDelivery.cost;
  const tax = Math.round(subtotal * 0.15 * 100) / 100;
  const total = subtotal + shippingFee + tax;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setError('');

    if (user?.role === 'admin') {
      setError('Administrators cannot place personal shopping orders.');
      return;
    }

    if (!user) {
      navigate('/login?redirect=/checkout');
      return;
    }

    if (
      !formData.first_name.trim() ||
      !formData.last_name.trim() ||
      !formData.shipping_phone.trim() ||
      !formData.shipping_address.trim() ||
      !formData.shipping_city.trim()
    ) {
      setError('Please fill in all required delivery fields (first name, last name, phone, address, and city).');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        shipping_name: `${formData.first_name} ${formData.last_name}`.trim(),
        shipping_phone: formData.shipping_phone.trim(),
        shipping_address: formData.shipping_address.trim(),
        shipping_city: formData.shipping_city.trim(),
        notes: formData.notes?.trim() || '',
        delivery_method: deliveryMethod,
        payment_method: 'CHAPA',
        return_url: `${window.location.origin}/checkout/payment-verify`,
      };

      const res = await api.post('orders/checkout/', payload);
      await fetchCart();

      if (res.data.checkout_url) {
        setRedirecting(true);
        window.location.href = res.data.checkout_url;
      } else if (res.data.chapa_error) {
        setError(`Chapa initialization: ${res.data.chapa_error}`);
        navigate(`/orders/${res.data.id}`);
      } else {
        navigate(`/orders/${res.data.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Order creation failed. Please check stock and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: '1120px' }}>
      {/* Navigation Breadcrumb and Back Button */}
      <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-slate-200">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0 text-xs">
            <li className="breadcrumb-item"><Link to="/" className="text-decoration-none text-slate-500">Home</Link></li>
            <li className="breadcrumb-item"><Link to="/cart" className="text-decoration-none text-slate-500">Cart</Link></li>
            <li className="breadcrumb-item active fw-bold text-slate-900" aria-current="page">Checkout</li>
          </ol>
        </nav>
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/cart'))}
          className="btn btn-outline-secondary btn-sm rounded-pill text-xs px-3 d-flex align-items-center gap-1.5"
        >
          <i className="bi bi-arrow-left"></i> Back to Cart
        </button>
      </div>

      {error && (
        <div className="alert alert-danger rounded-3 mb-4 d-flex align-items-center gap-2 text-xs py-2.5">
          <i className="bi bi-exclamation-triangle-fill fs-6 shrink-0"></i>
          <span>{error}</span>
        </div>
      )}

      <div className="row g-4">
        {/* Left Column: Delivery Information & Payment */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-4 p-3.5 p-md-4 mb-4 bg-white border border-slate-200">
            <h6 className="fw-bold mb-3 text-slate-900 d-flex align-items-center gap-2">
              <i className="bi bi-geo-alt-fill text-primary"></i> 1. Delivery Information
            </h6>

            <form onSubmit={handlePlaceOrder}>
              <div className="row g-2.5 mb-2.5">
                <div className="col-sm-6">
                  <label htmlFor="first_name" className="form-label text-xs fw-bold text-slate-700 mb-1">
                    First Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    className="form-control rounded-2 text-xs py-2"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-sm-6">
                  <label htmlFor="last_name" className="form-label text-xs fw-bold text-slate-700 mb-1">
                    Last Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    className="form-control rounded-2 text-xs py-2"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="row g-2.5 mb-2.5">
                <div className="col-sm-8">
                  <label htmlFor="shipping_address" className="form-label text-xs fw-bold text-slate-700 mb-1">
                    Delivery Address <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    id="shipping_address"
                    name="shipping_address"
                    className="form-control rounded-2 text-xs py-2"
                    placeholder="Sub-city, Woreda, Building or Landmark"
                    value={formData.shipping_address}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-sm-4">
                  <label htmlFor="shipping_city" className="form-label text-xs fw-bold text-slate-700 mb-1">
                    City / Region <span className="text-danger">*</span>
                  </label>
                  <select
                    id="shipping_city"
                    name="shipping_city"
                    className="form-select rounded-2 text-xs py-2"
                    value={formData.shipping_city}
                    onChange={handleChange}
                    required
                  >
                    <option value="Debre Birhan">Debre Birhan (Central Hub)</option>
                    <option value="Addis Ababa">Addis Ababa</option>
                    <option value="Hawassa">Hawassa</option>
                    <option value="Adama">Adama (Nazret)</option>
                    <option value="Bahir Dar">Bahir Dar</option>
                    <option value="Dire Dawa">Dire Dawa</option>
                    <option value="Mekelle">Mekelle</option>
                    <option value="Jimma">Jimma</option>
                    <option value="Bishoftu">Bishoftu</option>
                  </select>
                </div>
              </div>
              <div className="mb-2.5 p-2 rounded-2 bg-blue-50/60 border border-blue-200/50 text-[11px] text-blue-900 d-flex align-items-center gap-1.5">
                <i className="bi bi-geo-fill text-primary"></i>
                <span>Dispatched directly from Ethio Tech Market Central Warehouse in <strong>Debre Birhan, Amhara, Ethiopia</strong>.</span>
              </div>

              <div className="mb-2.5">
                <label htmlFor="shipping_phone" className="form-label text-xs fw-bold text-slate-700 mb-1">
                  Phone Number <span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  id="shipping_phone"
                  name="shipping_phone"
                  className="form-control rounded-2 text-xs py-2"
                  placeholder="+251 9XX XXX XXX"
                  value={formData.shipping_phone}
                  onChange={handleChange}
                  required
                />
                <small className="text-muted text-[10px]">Used by dispatch courier to coordinate delivery.</small>
              </div>

              <div className="mb-3">
                <label htmlFor="delivery_notes" className="form-label text-xs fw-bold text-slate-700 mb-1">
                  Delivery Instructions <span className="text-muted fw-normal">(Optional)</span>
                </label>
                <textarea
                  id="delivery_notes"
                  name="notes"
                  className="form-control rounded-2 text-xs py-2"
                  rows="2"
                  placeholder="Gate code, specific landmark, or preferred delivery timing..."
                  value={formData.notes}
                  onChange={handleChange}
                ></textarea>
              </div>

              {/* Delivery Service Selection: Consistent-height cards */}
              <div className="mb-3.5 pt-3 border-top border-slate-100">
                <label className="form-label text-xs fw-bold text-slate-900 mb-2">2. Delivery Service</label>
                <div className="row g-2.5 align-items-stretch">
                  {Object.entries(DELIVERY_OPTIONS).map(([key, opt]) => {
                    const isSelected = deliveryMethod === key;
                    return (
                      <div key={key} className="col-12 col-md-4 d-flex">
                        <label
                          htmlFor={`delivery-${key}`}
                          className={`w-100 p-3 rounded-3 border cursor-pointer d-flex flex-column justify-content-between transition mb-0 ${
                            isSelected
                              ? 'border-primary bg-blue-50/60 shadow-sm ring-1 ring-primary/30'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                          style={{ minHeight: '100px' }}
                        >
                          <div>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="fw-bold text-xs text-slate-900">{opt.name}</span>
                              <input
                                type="radio"
                                id={`delivery-${key}`}
                                name="delivery_option"
                                checked={isSelected}
                                onChange={() => setDeliveryMethod(key)}
                                className="form-check-input mt-0"
                              />
                            </div>
                            <div className="fw-bold text-primary text-sm mb-1">
                              {formatETB(opt.cost)}
                            </div>
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            {opt.estimate}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Gateway: Clean Chapa Panel */}
              <div className="mb-4 pt-3 border-top border-slate-100">
                <label className="form-label text-xs fw-bold text-slate-900 mb-2">3. Payment Method</label>
                <div className="p-3 rounded-3 border border-slate-200 bg-slate-50">
                  <div className="d-flex align-items-center justify-content-between mb-1.5">
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-credit-card-2-front-fill text-primary fs-5"></i>
                      <span className="fw-bold text-xs text-slate-900">Chapa Online Payment</span>
                    </div>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle text-[10px] px-2 py-0.5 rounded-pill font-medium">
                      Hosted Gateway
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs mb-0 leading-relaxed">
                    When you place this order, you will be redirected to Chapa's official hosted page to pay securely. Supports Telebirr, CBE Birr, Awash, Bank of Abyssinia, and cards.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Back & Place Order */}
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 pt-3 border-top border-slate-100">
                <Link to="/cart" className="btn btn-outline-secondary btn-sm rounded-pill px-3.5 text-xs font-semibold w-100 w-sm-auto text-center">
                  &larr; Back to Cart
                </Link>
                <button
                  type="submit"
                  id="pay-with-chapa-btn"
                  className="btn btn-primary-gradient px-4 py-2.5 rounded-pill font-bold text-xs shadow-sm d-flex align-items-center justify-content-center gap-2 w-100 w-sm-auto"
                  disabled={submitting || redirecting}
                >
                  {redirecting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Redirecting to Chapa...</span>
                    </>
                  ) : submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Creating Order...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-lock-fill"></i>
                      <span>Pay {formatETB(total)} with Chapa</span>
                      <i className="bi bi-arrow-right"></i>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Compact Authoritative Order Summary */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 p-3.5 p-md-4 bg-white border border-slate-200 sticky-top" style={{ top: '90px' }}>
            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-slate-100">
              <h6 className="fw-bold mb-0 text-slate-900">Order Summary</h6>
              <span className="badge bg-slate-100 text-slate-700 text-xs rounded-pill px-2.5 py-1">
                {cart.total_items} {cart.total_items === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Line Items List */}
            <div className="d-flex flex-column gap-2 mb-3" style={{ maxHeight: '220px', overflowY: 'auto' }}>
              {cart.items.map((item) => (
                <div key={item.id} className="d-flex align-items-center justify-content-between p-2 rounded-2 bg-slate-50 border border-slate-100">
                  <div className="d-flex align-items-center gap-2.5 min-w-0">
                    <img
                      src={getProductImage(item.product)}
                      alt={item.product?.name}
                      className="rounded-2 object-contain bg-white p-1 border shrink-0"
                      style={{ width: '40px', height: '40px' }}
                    />
                    <div className="min-w-0">
                      <div className="fw-semibold text-xs text-slate-900 text-truncate" style={{ maxWidth: '170px' }}>
                        {item.product?.name}
                      </div>
                      <small className="text-slate-500 text-[10px]">
                        Qty: {item.quantity} &bull; {formatETB(item.product?.current_price || item.product?.price)}
                      </small>
                    </div>
                  </div>
                  <div className="fw-bold text-slate-900 text-xs shrink-0 ms-2">
                    {formatETB(item.subtotal)}
                  </div>
                </div>
              ))}
            </div>

            {/* Cost Breakdown */}
            <div className="pt-2 border-top border-slate-200">
              <div className="d-flex justify-content-between text-xs text-slate-600 mb-1.5">
                <span>Subtotal</span>
                <span className="fw-semibold text-slate-800">{formatETB(subtotal)}</span>
              </div>
              <div className="d-flex justify-content-between text-xs text-slate-600 mb-1.5">
                <span>Delivery ({selectedDelivery.name})</span>
                <span className="fw-semibold text-slate-800">{formatETB(shippingFee)}</span>
              </div>
              <div className="d-flex justify-content-between text-xs text-slate-600 mb-2">
                <span>Applicable VAT (15%)</span>
                <span className="fw-semibold text-slate-800">{formatETB(tax)}</span>
              </div>
              <div className="d-flex justify-content-between text-sm font-bold text-slate-900 pt-2.5 border-top border-slate-200 mb-3">
                <span>Final Total</span>
                <span className="text-primary fs-5 fw-bolder">{formatETB(total)}</span>
              </div>
            </div>

            {/* Note on server verification */}
            <div className="p-2.5 rounded-3 bg-slate-50 border border-slate-100 text-center text-slate-500 text-[11px]">
              <i className="bi bi-shield-check text-primary me-1"></i>
              All order amounts are verified by the server before checkout. Official digital receipts are issued upon verified payment.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
