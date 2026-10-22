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
  const [firstName, lastName] = fullName.split(' ');

  const [formData, setFormData] = useState({
    first_name: firstName || '',
    last_name: lastName || '',
    shipping_phone: user?.phone_number || '',
    shipping_address: user?.address || '',
    shipping_city: user?.city || 'Addis Ababa',
    shipping_zip: '1000',
    country: 'Ethiopia',
    notes: '',
  });

  const [deliveryMethod, setDeliveryMethod] = useState('standard');
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '480px' }}>
          <i className="bi bi-cart-x fs-1 text-muted mb-3"></i>
          <h4 className="fw-bold">Your cart is empty</h4>
          <p className="text-muted small mb-4">Add products to your cart before proceeding to checkout.</p>
          <Link to="/shop" className="btn btn-primary-gradient rounded-pill px-4">Browse Products</Link>
        </div>
      </div>
    );
  }

  const subtotal = Number(cart.total_price || 0);

  // Delivery methods and rates
  const DELIVERY_OPTIONS = {
    standard: { name: 'Standard City Delivery', cost: 50.0, timeframe: '1-2 Days' },
    express: { name: 'Addis Ababa Express (Same-Day)', cost: 100.0, timeframe: 'Today' },
    regional: { name: 'Regional Courier (Hawassa, Adama, Bahir Dar)', cost: 150.0, timeframe: '2-3 Days' },
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

    if (!user) {
      navigate('/login?redirect=/checkout');
      return;
    }

    if (!formData.first_name.trim() || !formData.shipping_phone.trim() || !formData.shipping_address.trim()) {
      setError("Please fill in recipient name, phone number, and delivery address.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        shipping_name: `${formData.first_name} ${formData.last_name}`.trim(),
        shipping_phone: formData.shipping_phone,
        shipping_address: formData.shipping_address,
        shipping_city: formData.shipping_city,
        notes: `Delivery Method: ${selectedDelivery.name}. Payment: Chapa Gateway. ${formData.notes || ''}`.trim(),
        delivery_method: deliveryMethod,
        payment_method: 'CHAPA',
        return_url: `${window.location.origin}/checkout/payment-verify`,
      };

      const res = await api.post('orders/checkout/', payload);
      await fetchCart(); // Refresh cart to 0

      if (res.data.checkout_url) {
        setRedirecting(true);
        // Redirect browser to Chapa hosted checkout session
        window.location.href = res.data.checkout_url;
      } else if (res.data.chapa_error) {
        setError(`Chapa initialization: ${res.data.chapa_error}`);
        navigate(`/orders/${res.data.id}`);
      } else {
        navigate(`/orders/${res.data.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Order creation failed. Please check stock and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-4">
      {/* Navigation Breadcrumb and Back Button */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0 text-xs">
            <li className="breadcrumb-item"><Link to="/" className="text-decoration-none text-slate-500">Home</Link></li>
            <li className="breadcrumb-item"><Link to="/cart" className="text-decoration-none text-slate-500">Cart</Link></li>
            <li className="breadcrumb-item active fw-bold text-slate-900" aria-current="page">Chapa Checkout</li>
          </ol>
        </nav>
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/cart'))}
          className="btn btn-outline-secondary btn-sm rounded-full text-xs px-3 d-flex align-items-center gap-1.5"
        >
          <i className="bi bi-arrow-left"></i> Back
        </button>
      </div>

      {error && (
        <div className="alert alert-danger rounded-3 mb-4 d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-triangle-fill fs-5"></i>
          <span>{error}</span>
        </div>
      )}

      <div className="row g-4">
        {/* Left Column: Delivery Form & Chapa Payment Information */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border border-slate-200">
            <h5 className="fw-bolder mb-3 text-slate-900 d-flex align-items-center gap-2">
              <i className="bi bi-geo-alt-fill text-primary"></i> 1. Delivery Information
            </h5>

            <form onSubmit={handlePlaceOrder}>
              <div className="row g-3 mb-3">
                <div className="col-sm-6">
                  <label className="form-label small fw-bold text-slate-700">First Name *</label>
                  <input
                    type="text"
                    name="first_name"
                    className="form-control rounded-xl text-xs py-2"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-bold text-slate-700">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    className="form-control rounded-xl text-xs py-2"
                    value={formData.last_name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-sm-8">
                  <label className="form-label small fw-bold text-slate-700">Delivery Address *</label>
                  <input
                    type="text"
                    name="shipping_address"
                    className="form-control rounded-xl text-xs py-2"
                    placeholder="Sub-city, Woreda, Building or Landmark"
                    value={formData.shipping_address}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-sm-4">
                  <label className="form-label small fw-bold text-slate-700">City / Region *</label>
                  <select
                    name="shipping_city"
                    className="form-select rounded-xl text-xs py-2"
                    value={formData.shipping_city}
                    onChange={handleChange}
                  >
                    <option value="Addis Ababa">Addis Ababa</option>
                    <option value="Hawassa">Hawassa</option>
                    <option value="Adama">Adama (Nazret)</option>
                    <option value="Bahir Dar">Bahir Dar</option>
                    <option value="Dire Dawa">Dire Dawa</option>
                    <option value="Bishoftu">Bishoftu</option>
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold text-slate-700">Phone Number *</label>
                <input
                  type="tel"
                  name="shipping_phone"
                  className="form-control rounded-xl text-xs py-2"
                  placeholder="+251 9XX XXX XXX"
                  value={formData.shipping_phone}
                  onChange={handleChange}
                  required
                />
                <small className="text-muted text-[10px]">Required by courier driver for delivery dispatch.</small>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-bold text-slate-700">Optional Delivery Instructions</label>
                <textarea
                  name="notes"
                  className="form-control rounded-xl text-xs py-2"
                  rows="2"
                  placeholder="Gate code, landmark, or preferred delivery timing..."
                  value={formData.notes}
                  onChange={handleChange}
                ></textarea>
              </div>

              {/* Delivery Speed / Option */}
              <div className="mb-4 pt-3 border-top border-slate-100">
                <label className="form-label small fw-bold text-slate-900 mb-2">Delivery Service</label>
                <div className="row g-2.5">
                  {Object.entries(DELIVERY_OPTIONS).map(([key, opt]) => (
                    <div key={key} className="col-md-4">
                      <div
                        className={`p-3 rounded-2xl border cursor-pointer transition ${
                          deliveryMethod === key ? 'border-primary bg-blue-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                        onClick={() => setDeliveryMethod(key)}
                      >
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-bold text-xs text-slate-900">{opt.name.split('(')[0]}</span>
                          <input
                            type="radio"
                            name="delivery_option"
                            checked={deliveryMethod === key}
                            onChange={() => setDeliveryMethod(key)}
                            className="form-check-input"
                          />
                        </div>
                        <div className="fw-bolder text-primary text-sm mb-1">{formatETB(opt.cost)}</div>
                        <small className="text-slate-500 text-[10px]">Arrives: {opt.timeframe}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exclusive Payment Gateway: Chapa */}
              <div className="mb-4 pt-3 border-top border-slate-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label small fw-bold text-slate-900 mb-0">Payment Method</label>
                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] rounded-pill px-2.5 py-1">
                    <i className="bi bi-shield-check me-1"></i> Chapa Verified Gateway
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl border border-primary bg-blue-50/60 shadow-sm ring-1 ring-primary/30">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="d-flex align-items-center gap-2.5">
                      <div
                        className="rounded-xl d-flex align-items-center justify-content-center text-white shadow-sm"
                        style={{
                          width: '40px',
                          height: '40px',
                          background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                        }}
                      >
                        <i className="bi bi-credit-card-2-front-fill fs-5"></i>
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bolder text-xs text-slate-900">Pay securely with Chapa</span>
                          <span className="badge rounded-pill bg-primary text-white text-[9px] px-2 py-0.5">
                            OFFICIAL GATEWAY
                          </span>
                        </div>
                        <small className="text-slate-500 text-[11px]">
                          Accepts Telebirr, CBE Birr, Awash, Bank of Abyssinia, and Visa / Mastercard
                        </small>
                      </div>
                    </div>
                    <span className="badge bg-white text-emerald-700 border border-emerald-200 text-[10px] fw-bold">
                      Instant Receipt
                    </span>
                  </div>

                  {/* Channel Badges */}
                  <div className="d-flex flex-wrap align-items-center gap-1.5 pt-2 border-top border-slate-200/60 ps-1">
                    <span className="badge bg-white text-slate-800 border text-[10px] font-semibold">
                      <i className="bi bi-phone text-primary me-1"></i> Telebirr
                    </span>
                    <span className="badge bg-white text-slate-800 border text-[10px] font-semibold">
                      <i className="bi bi-bank text-purple-600 me-1"></i> CBE Birr
                    </span>
                    <span className="badge bg-white text-slate-800 border text-[10px] font-semibold">
                      <i className="bi bi-bank2 text-amber-600 me-1"></i> Awash Wallet
                    </span>
                    <span className="badge bg-white text-slate-800 border text-[10px] font-semibold">
                      <i className="bi bi-credit-card text-emerald-600 me-1"></i> Debit & Credit Cards
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Back & Place Order */}
              <div className="d-flex justify-content-between align-items-center pt-3 border-top border-slate-100">
                <Link to="/cart" className="btn btn-outline-secondary btn-sm rounded-full px-4 text-xs font-semibold">
                  &larr; Back to Cart
                </Link>
                <button
                  type="submit"
                  id="pay-with-chapa-btn"
                  className="btn btn-primary-gradient px-4 py-2.5 rounded-full font-bold text-xs shadow-md d-flex align-items-center gap-2"
                  disabled={submitting || redirecting}
                >
                  {redirecting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Redirecting to Chapa Gateway...</span>
                    </>
                  ) : submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Creating Order...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-lock-fill"></i>
                      <span>Pay {formatETB(total)} securely with Chapa</span>
                      <i className="bi bi-arrow-right"></i>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Authoritative Order Summary */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border border-slate-200 sticky-top" style={{ top: '100px' }}>
            <h5 className="fw-bolder mb-3 text-slate-900 d-flex align-items-center justify-content-between">
              <span>Order Summary</span>
              <span className="badge bg-slate-100 text-slate-700 text-xs rounded-pill">
                {cart.total_items} {cart.total_items === 1 ? 'item' : 'items'}
              </span>
            </h5>

            {/* Line Items List */}
            <div className="d-flex flex-column gap-2.5 mb-3" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {cart.items.map((item) => (
                <div key={item.id} className="d-flex align-items-center justify-content-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="d-flex align-items-center gap-2.5">
                    <img
                      src={getProductImage(item.product)}
                      alt={item.product?.name}
                      className="rounded-lg object-contain bg-white p-1 border"
                      style={{ width: '42px', height: '42px' }}
                    />
                    <div>
                      <div className="fw-semibold text-xs text-slate-900 text-truncate" style={{ maxWidth: '170px' }}>
                        {item.product?.name}
                      </div>
                      <small className="text-slate-500 text-[10px]">
                        Qty: {item.quantity} &bull; {formatETB(item.product?.current_price || item.product?.price)}
                      </small>
                    </div>
                  </div>
                  <div className="fw-bold text-slate-900 text-xs">
                    {formatETB(item.subtotal)}
                  </div>
                </div>
              ))}
            </div>

            {/* Cost Breakdown */}
            <div className="pt-2 border-top border-slate-200">
              <div className="d-flex justify-content-between text-xs text-slate-600 mb-1.5">
                <span>Subtotal (Authoritative)</span>
                <span className="fw-semibold">{formatETB(subtotal)}</span>
              </div>
              <div className="d-flex justify-content-between text-xs text-slate-600 mb-1.5">
                <span>Delivery ({selectedDelivery.name.split('(')[0]})</span>
                <span className="fw-semibold">{formatETB(shippingFee)}</span>
              </div>
              <div className="d-flex justify-content-between text-xs text-slate-600 mb-2">
                <span>Applicable VAT (15%)</span>
                <span className="fw-semibold">{formatETB(tax)}</span>
              </div>
              <div className="d-flex justify-content-between text-sm font-bold text-slate-900 pt-2 border-top border-slate-200 mb-3">
                <span>Final Total (ETB)</span>
                <span className="text-primary fs-5">{formatETB(total)}</span>
              </div>
            </div>

            {/* Security Guarantee Notice */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
              <div className="text-[11px] text-slate-600 mb-1">
                <i className="bi bi-shield-check text-emerald-600 me-1"></i>
                Official Chapa payment verification ensures genuine transaction validation.
              </div>
              <small className="text-[10px] text-slate-400">
                Digital receipts with warranty claim eligibility are issued automatically upon confirmation.
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
