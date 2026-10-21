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
  const [paymentMethod, setPaymentMethod] = useState('CHAPA'); // 'CHAPA' or 'MANUAL_BANK'
  const [paymentChannel, setPaymentChannel] = useState('Commercial Bank of Ethiopia (CBE)');
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '480px' }}>
          <i className="bi bi-cart-x fs-1 text-muted mb-3"></i>
          <h4 className="fw-bold">Your cart is empty</h4>
          <p className="text-muted small mb-4">Add high-performance electronics to your cart before proceeding to checkout.</p>
          <Link to="/shop" className="btn btn-primary-gradient rounded-pill px-4">Browse Electronics</Link>
        </div>
      </div>
    );
  }

  const subtotal = Number(cart.total_price || 0);

  // Delivery methods and rates
  const DELIVERY_OPTIONS = {
    standard: { name: 'Standard City Dispatch', cost: 50.0, timeframe: '1-2 Days' },
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
        notes: `Delivery Method: ${selectedDelivery.name}. Payment: ${paymentMethod === 'CHAPA' ? 'Chapa Gateway' : paymentChannel}. ${formData.notes || ''}`.trim(),
        delivery_method: deliveryMethod,
        payment_method: paymentMethod,
        return_url: `${window.location.origin}/checkout/payment-verify`,
      };

      const res = await api.post('orders/checkout/', payload);
      await fetchCart(); // Refresh cart to 0

      if (paymentMethod === 'CHAPA') {
        if (res.data.checkout_url) {
          setRedirecting(true);
          // Redirect browser to Chapa hosted payment checkout session
          window.location.href = res.data.checkout_url;
          return;
        } else if (res.data.chapa_error) {
          setError(`Chapa initialization notice: ${res.data.chapa_error}. Order created.`);
          navigate(`/orders/${res.data.id}`);
          return;
        }
      }

      // Manual bank transfer fallback
      navigate(`/orders/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || "Order creation failed. Please check stock and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-4">
      {/* =========================================================================
          MULTI-STEP CHECKOUT PROGRESS BAR (Screenshot 3 Stepper)
          ========================================================================= */}
      <div className="mb-5">
        <div className="d-flex align-items-center justify-content-between position-relative max-w-3xl mx-auto px-4">
          {/* Connector Line */}
          <div
            className="position-absolute start-0 end-0 top-50 translate-middle-y z-0"
            style={{ height: '2px', background: '#e2e8f0', margin: '0 40px' }}
          ></div>
          <div
            className="position-absolute start-0 top-50 translate-middle-y z-0"
            style={{ height: '2px', background: 'var(--color-primary)', width: '50%', margin: '0 40px' }}
          ></div>

          {/* Step 1: Sign In (Completed) */}
          <div className="text-center position-relative z-1 bg-white px-2">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-white mx-auto mb-1 bg-primary shadow-sm"
              style={{ width: '36px', height: '36px' }}
            >
              <i className="bi bi-check-lg fs-5"></i>
            </div>
            <span className="text-xs fw-bold text-primary">Sign In</span>
          </div>

          {/* Step 2: Address Details (Active) */}
          <div className="text-center position-relative z-1 bg-white px-2">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-white mx-auto mb-1 shadow-sm"
              style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #06b6d4, #2563eb)' }}
            >
              <span className="fw-bold text-xs">2</span>
            </div>
            <span className="text-xs fw-bolder text-slate-900">Address Details</span>
          </div>

          {/* Step 3: Payment Method */}
          <div className="text-center position-relative z-1 bg-white px-2">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-slate-500 mx-auto mb-1 bg-slate-100 border border-slate-300"
              style={{ width: '36px', height: '36px' }}
            >
              <span className="fw-bold text-xs">3</span>
            </div>
            <span className="text-xs text-slate-500">Payment Evidence</span>
          </div>

          {/* Step 4: Preview & Confirm */}
          <div className="text-center position-relative z-1 bg-white px-2">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-slate-400 mx-auto mb-1 bg-slate-100 border border-slate-300"
              style={{ width: '36px', height: '36px' }}
            >
              <span className="fw-bold text-xs">4</span>
            </div>
            <span className="text-xs text-slate-400">Digital Receipt</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger rounded-3 mb-4 d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-octagon-fill fs-5"></i>
          <span>{error}</span>
        </div>
      )}

      {!user && (
        <div className="alert alert-info border-0 shadow-sm rounded-4 p-3 mb-4 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <i className="bi bi-person-circle fs-2 text-primary"></i>
            <div>
              <div className="fw-bold text-slate-900">Checking out as a Guest</div>
              <div className="small text-muted">Sign in to save your order to your personal history and access real-time courier tracking.</div>
            </div>
          </div>
          <Link to="/login?redirect=/checkout" className="btn btn-primary rounded-pill btn-sm px-4 fw-bold text-nowrap">
            Sign In Now
          </Link>
        </div>
      )}

      {/* =========================================================================
          CHECKOUT MAIN: Address & Options (Left) + Order Summary (Right)
          ========================================================================= */}
      <div className="row g-4">
        {/* Left Column: Delivery Address & Method */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white border border-slate-200">
            <h4 className="fw-bolder mb-1 text-slate-900">Address Details</h4>
            <p className="text-slate-500 text-xs mb-4">Please provide your destination information for verified courier dispatch.</p>

            <form onSubmit={handlePlaceOrder}>
              {/* First & Last Name */}
              <div className="row g-3 mb-3">
                <div className="col-sm-6">
                  <label className="form-label small fw-bold text-slate-700">First Name *</label>
                  <input
                    type="text"
                    name="first_name"
                    className="form-control rounded-xl text-xs py-2"
                    placeholder="e.g. Abebe"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-bold text-slate-700">Second Name / Surname</label>
                  <input
                    type="text"
                    name="last_name"
                    className="form-control rounded-xl text-xs py-2"
                    placeholder="e.g. Bikila"
                    value={formData.last_name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Address */}
              <div className="mb-3">
                <label className="form-label small fw-bold text-slate-700">Delivery Address *</label>
                <input
                  type="text"
                  name="shipping_address"
                  className="form-control rounded-xl text-xs py-2"
                  placeholder="House number, Street, Subcity (e.g. Bole Subcity, House 241)"
                  value={formData.shipping_address}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* City, Zip, Country */}
              <div className="row g-3 mb-3">
                <div className="col-sm-5">
                  <label className="form-label small fw-bold text-slate-700">City / Region *</label>
                  <select
                    name="shipping_city"
                    className="form-select rounded-xl text-xs py-2"
                    value={formData.shipping_city}
                    onChange={handleChange}
                    required
                  >
                    <option value="Addis Ababa">Addis Ababa</option>
                    <option value="Hawassa">Hawassa</option>
                    <option value="Adama">Adama</option>
                    <option value="Bahir Dar">Bahir Dar</option>
                    <option value="Dire Dawa">Dire Dawa</option>
                    <option value="Mekelle">Mekelle</option>
                    <option value="Jimma">Jimma</option>
                  </select>
                </div>
                <div className="col-sm-3">
                  <label className="form-label small fw-bold text-slate-700">Postal Code</label>
                  <input
                    type="text"
                    name="shipping_zip"
                    className="form-control rounded-xl text-xs py-2"
                    value={formData.shipping_zip}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-sm-4">
                  <label className="form-label small fw-bold text-slate-700">Country</label>
                  <input
                    type="text"
                    name="country"
                    className="form-control rounded-xl text-xs py-2 bg-slate-50"
                    value={formData.country}
                    readOnly
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="mb-4">
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
                <small className="text-muted text-[10px]">Used by the courier driver upon arrival.</small>
              </div>

              {/* Delivery Method Radio Cards (Screenshot 3 Visuals) */}
              <div className="mb-4 pt-3 border-top border-slate-100">
                <label className="form-label small fw-bold text-slate-900 mb-2">Delivery Method</label>
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

              {/* Payment Method Selection Card */}
              <div className="mb-4 pt-3 border-top border-slate-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label small fw-bold text-slate-900 mb-0">Select Payment Method</label>
                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] rounded-pill px-2.5 py-1">
                    <i className="bi bi-shield-check me-1"></i> 100% Encrypted & Safe
                  </span>
                </div>

                {/* Option 1: Chapa Instant Checkout (Recommended) */}
                <div
                  className={`p-3.5 rounded-2xl border mb-3 cursor-pointer transition position-relative ${
                    paymentMethod === 'CHAPA'
                      ? 'border-primary bg-blue-50/60 shadow-sm ring-1 ring-primary/30'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  onClick={() => setPaymentMethod('CHAPA')}
                >
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
                        <i className="bi bi-lightning-charge-fill fs-5"></i>
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bolder text-xs text-slate-900">Pay with Chapa (Instant Payment)</span>
                          <span className="badge rounded-pill bg-primary text-white text-[9px] px-2 py-0.5">
                            RECOMMENDED
                          </span>
                        </div>
                        <small className="text-slate-500 text-[11px]">
                          Instant verification via Telebirr, CBE Birr, Awash, or Visa / Mastercard
                        </small>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="payment_method_choice"
                      checked={paymentMethod === 'CHAPA'}
                      onChange={() => setPaymentMethod('CHAPA')}
                      className="form-check-input mt-1"
                    />
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
                      <i className="bi bi-credit-card text-emerald-600 me-1"></i> Debit / Credit Cards
                    </span>
                    <span className="ms-auto text-[10px] text-emerald-700 fw-bold">
                      <i className="bi bi-receipt me-1"></i> Instant Receipt
                    </span>
                  </div>
                </div>

                {/* Option 2: Manual Bank Transfer (Offline) */}
                <div
                  className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                    paymentMethod === 'MANUAL_BANK'
                      ? 'border-primary bg-blue-50/40 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  onClick={() => setPaymentMethod('MANUAL_BANK')}
                >
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <div className="d-flex align-items-center gap-2.5">
                      <div
                        className="rounded-xl d-flex align-items-center justify-content-center text-slate-600 bg-slate-100 border"
                        style={{ width: '40px', height: '40px' }}
                      >
                        <i className="bi bi-building fs-5"></i>
                      </div>
                      <div>
                        <span className="fw-bolder text-xs text-slate-900">Manual Bank Transfer / Deposit</span>
                        <div className="text-slate-500 text-[11px]">
                          Transfer directly to our corporate bank account and upload deposit slip / SMS screenshot
                        </div>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="payment_method_choice"
                      checked={paymentMethod === 'MANUAL_BANK'}
                      onChange={() => setPaymentMethod('MANUAL_BANK')}
                      className="form-check-input mt-1"
                    />
                  </div>

                  {paymentMethod === 'MANUAL_BANK' && (
                    <div className="mt-3 pt-3 border-top border-slate-200">
                      <small className="text-slate-600 text-[11px] fw-bold d-block mb-2">
                        Select account to view transfer details:
                      </small>
                      <div className="row g-2">
                        {[
                          { name: 'Commercial Bank of Ethiopia (CBE)', icon: 'bi-bank', desc: 'Account: 1000 2345 6789 0' },
                          { name: 'Telebirr Merchant', icon: 'bi-phone', desc: 'Merchant ID: 0911 002233' },
                          { name: 'Awash Bank', icon: 'bi-bank2', desc: 'Account: 0132 0987 6543 21' },
                          { name: 'Bank of Abyssinia', icon: 'bi-cash-coin', desc: 'Account: 8892 1102 4431' },
                        ].map((pm) => (
                          <div key={pm.name} className="col-sm-6">
                            <div
                              className={`p-2.5 rounded-xl border cursor-pointer text-xs ${
                                paymentChannel === pm.name
                                  ? 'border-primary bg-white shadow-xs font-semibold'
                                  : 'border-slate-200 bg-slate-50/70 hover:bg-white'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentChannel(pm.name);
                              }}
                            >
                              <div className="d-flex align-items-center gap-1.5 mb-0.5">
                                <i className={`bi ${pm.icon} text-primary`}></i>
                                <span className="text-slate-900 text-[11px] text-truncate">{pm.name}</span>
                              </div>
                              <small className="text-slate-500 text-[10px]">{pm.desc}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Back & Place Order */}
              <div className="d-flex justify-content-between align-items-center pt-3 border-top border-slate-100">
                <Link to="/cart" className="btn btn-outline-secondary btn-sm rounded-full px-4 text-xs font-semibold">
                  &larr; Back to Cart
                </Link>
                <button
                  type="submit"
                  className="btn btn-primary-gradient px-4 py-2.5 rounded-full font-bold text-xs shadow-md d-flex align-items-center gap-2"
                  disabled={submitting || redirecting}
                >
                  {redirecting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Connecting to Chapa...</span>
                    </>
                  ) : submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Processing Order...</span>
                    </>
                  ) : paymentMethod === 'CHAPA' ? (
                    <>
                      <i className="bi bi-shield-lock-fill"></i>
                      <span>Pay {formatETB(total)} with Chapa</span>
                      <i className="bi bi-arrow-right"></i>
                    </>
                  ) : (
                    <>
                      <span>Generate Order & Upload Proof</span>
                      <i className="bi bi-arrow-right"></i>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Order Summary (Screenshot 3 Summary Box) */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border border-slate-200 mb-4 sticky-top" style={{ top: '80px' }}>
            <h5 className="fw-bolder mb-3 text-slate-900">Order Summary</h5>

            {/* Itemized List */}
            <div className="d-flex flex-column gap-3 mb-4 max-h-64 overflow-auto scrollbar-none pe-1">
              {cart.items.map((item) => (
                <div key={item.id} className="d-flex align-items-center justify-content-between pb-2 border-bottom border-slate-100">
                  <div className="d-flex align-items-center gap-2.5">
                    <img
                      src={getProductImage(item.product)}
                      alt={item.product?.name}
                      className="rounded-xl object-contain bg-slate-50 p-1 border"
                      style={{ width: '48px', height: '48px' }}
                    />
                    <div>
                      <div className="fw-bold text-xs text-slate-900 text-truncate" style={{ maxWidth: '170px' }} title={item.product?.name}>
                        {item.product?.name}
                      </div>
                      <small className="text-slate-400 text-[11px]">Qty: {item.quantity}</small>
                    </div>
                  </div>
                  <div className="fw-bold text-xs text-slate-900">{formatETB(item.subtotal)}</div>
                </div>
              ))}
            </div>

            {/* Calculations Breakdown */}
            <div className="d-flex justify-content-between mb-1.5 text-xs text-slate-600">
              <span>Subtotal ({cart.total_items} items):</span>
              <span className="fw-bold text-slate-900">{formatETB(subtotal)}</span>
            </div>
            <div className="d-flex justify-content-between mb-1.5 text-xs text-slate-600">
              <span>Delivery Cost ({selectedDelivery.name.split('(')[0]}):</span>
              <span className="fw-bold text-slate-900">{formatETB(shippingFee)}</span>
            </div>
            <div className="d-flex justify-content-between mb-2 text-xs text-slate-600">
              <span>VAT (15% Ethiopian Tax):</span>
              <span className="fw-bold text-slate-900">{formatETB(tax)}</span>
            </div>

            <hr className="my-2 border-slate-200" />

            <div className="d-flex justify-content-between align-items-baseline mb-4">
              <span className="fw-bolder fs-6 text-slate-900">Total:</span>
              <span className="fw-bolder fs-4 text-primary">{formatETB(total)}</span>
            </div>

            {/* Need Help? Contact Box (Screenshot 3 Help Box) */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div className="fw-bold text-slate-800 mb-1">
                <i className="bi bi-headset text-primary me-1"></i> Need help? Contact Us!
              </div>
              <div className="text-slate-600 mb-1">Phone: <code>+251 911 002233</code></div>
              <div className="text-slate-400 text-[11px] mb-2">Mon - Sat: 8:00 AM - 7:00 PM (EAT)</div>
              <div className="d-flex align-items-center gap-1.5 text-[10px] text-slate-500">
                <span className="badge bg-white text-dark border">DHL</span>
                <span className="badge bg-white text-dark border">EMS Regional</span>
                <span className="badge bg-white text-dark border">Telebirr</span>
                <span className="badge bg-white text-dark border">CBE Birr</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Service Guarantees (Screenshot 3 Trust Bar) */}
      <div className="mt-5 pt-4 border-top border-slate-200">
        <div className="row g-4 text-center">
          <div className="col-md-4">
            <div className="d-flex align-items-center justify-content-center gap-2 text-xs text-slate-600">
              <i className="bi bi-shield-lock-fill text-primary fs-5"></i>
              <div className="text-start">
                <strong className="d-block text-slate-900">Secure Shopping</strong>
                <span>Bank-level encrypted transaction logs</span>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="d-flex align-items-center justify-content-center gap-2 text-xs text-slate-600">
              <i className="bi bi-arrow-repeat text-cyan-600 fs-5"></i>
              <div className="text-start">
                <strong className="d-block text-slate-900">Free and Easy Return</strong>
                <span>Hassle-free 7-day electronics warranty</span>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="d-flex align-items-center justify-content-center gap-2 text-xs text-slate-600">
              <i className="bi bi-receipt text-purple-600 fs-5"></i>
              <div className="text-start">
                <strong className="d-block text-slate-900">Official Digital Receipts</strong>
                <span>Authorized TIN & VAT certified invoices</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
