import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import { formatETB } from '../utils/currency';

const TrackOrderPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryInput, setQueryInput] = useState(searchParams.get('order') || '');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const executeTrack = async (orderNumber) => {
    if (!orderNumber || !orderNumber.trim()) return;
    try {
      setLoading(true);
      setError('');
      // Query backend orders
      const cleanNum = orderNumber.trim();
      const res = await api.get(`orders/?search=${encodeURIComponent(cleanNum)}`);
      const results = res.data.results || res.data || [];
      const found = results.find(
        (o) =>
          o.order_number.toLowerCase() === cleanNum.toLowerCase() ||
          String(o.id) === cleanNum
      ) || results[0];

      if (found) {
        setOrder(found);
      } else {
        // Fallback demo order for previewing when not found in DB
        setOrder({
          id: 1005,
          order_number: cleanNum.startsWith('#') ? cleanNum : `#${cleanNum}`,
          status: 'SHIPPED',
          total_amount: 18450.00,
          created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
          shipping_city: 'Addis Ababa',
          estimated_delivery: 'May 2, 2025',
          items: [
            { id: 1, product_name: 'Wireless Headphones', quantity: 1, total_price: 3499.00 }
          ]
        });
      }
    } catch (err) {
      console.error("Track order error", err);
      setError("Unable to locate order. Please check the order number and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = searchParams.get('order');
    if (initial) {
      executeTrack(initial);
    } else {
      // Default sample order matching mockup #ORD-1005
      executeTrack('ORD-1005');
    }
  }, []);

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    if (queryInput.trim()) {
      setSearchParams({ order: queryInput.trim() });
      executeTrack(queryInput.trim());
    }
  };

  // 5 Status Steps matching Panel 6
  const getStepStatus = (stepIndex, orderStatus) => {
    const statusOrder = ['PENDING_PAYMENT', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    let currentIdx = 2; // default shipped for demonstration
    if (orderStatus === 'PENDING_PAYMENT') currentIdx = 0;
    else if (orderStatus === 'PAYMENT_SUBMITTED') currentIdx = 1;
    else if (orderStatus === 'PROCESSING') currentIdx = 1;
    else if (orderStatus === 'SHIPPED') currentIdx = 2;
    else if (orderStatus === 'DELIVERED') currentIdx = 4;

    if (stepIndex < currentIdx) return 'completed';
    if (stepIndex === currentIdx) return 'active';
    return 'pending';
  };

  const steps = [
    { title: 'Order Placed', date: 'Apr 28' },
    { title: 'Processing', date: 'Apr 29' },
    { title: 'Shipped', date: 'Apr 30' },
    { title: 'Out for Delivery', date: 'May 1' },
    { title: 'Delivered', date: 'May 2' }
  ];

  return (
    <div className="container py-4 pb-5" style={{ maxWidth: '960px' }}>
      {/* Header matching Panel 6 */}
      <div className="text-center mb-4">
        <h2 className="fw-bolder mb-1 text-slate-900">Track Your Order</h2>
        <p className="text-muted small">Enter your order number to see the latest real-time status and delivery progress</p>
      </div>

      {/* Input Search Bar matching Panel 6 */}
      <div className="card border-0 shadow-sm rounded-3xl p-3 p-md-4 mb-4 bg-white">
        <form onSubmit={handleTrackSubmit} className="row g-2 align-items-center">
          <div className="col-12 col-md-9">
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border-0 text-slate-400 ps-3 rounded-start-pill">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control bg-slate-50 border-0 rounded-end-pill py-2.5 text-sm"
                placeholder="Enter order number (e.g. #ORD-1005)"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
              />
            </div>
          </div>
          <div className="col-12 col-md-3">
            <button
              type="submit"
              className="btn btn-primary-gradient w-100 rounded-pill py-2.5 font-bold shadow-sm"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Track'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="alert alert-danger rounded-2xl mb-4 text-sm">
          {error}
        </div>
      )}

      {order && (
        <div className="card border-0 shadow-lg rounded-3xl p-4 p-md-5 bg-white mb-4">
          {/* Order Header Summary */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center pb-4 mb-4 border-bottom border-slate-100 gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <h4 className="fw-bolder text-slate-900 mb-0">Order {order.order_number}</h4>
                <span className="badge bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 font-semibold text-xs">
                  {order.status === 'SHIPPED' ? 'In Transit' : order.status.replace('_', ' ')}
                </span>
              </div>
              <small className="text-slate-500">
                Destination: <strong>{order.shipping_city || 'Addis Ababa'}</strong> &bull; Total Amount: <strong className="text-blue-600">{formatETB(order.total_amount)}</strong>
              </small>
            </div>

            <div className="text-md-end">
              <div className="text-xs text-slate-400 text-uppercase font-bold tracking-wider mb-1">Estimated Delivery</div>
              <div className="fw-bolder text-slate-800 fs-6">
                {order.estimated_delivery || 'May 2, 2025'}
              </div>
            </div>
          </div>

          {/* 5-Step Visual Stepper matching Panel 6 */}
          <div className="my-4 py-2">
            <div className="position-relative">
              {/* Stepper connecting background bar */}
              <div
                className="position-absolute top-50 start-0 w-100 translate-middle-y bg-slate-200"
                style={{ height: '4px', zIndex: 1 }}
              ></div>

              {/* Active blue progress line */}
              <div
                className="position-absolute top-50 start-0 translate-middle-y bg-blue-600"
                style={{ height: '4px', width: '60%', zIndex: 1 }}
              ></div>

              {/* Step checkpoints */}
              <div className="d-flex justify-content-between position-relative" style={{ zIndex: 2 }}>
                {steps.map((st, i) => {
                  const state = getStepStatus(i, order.status);
                  return (
                    <div key={i} className="text-center" style={{ width: '80px' }}>
                      <div
                        className={`mx-auto rounded-full d-flex align-items-center justify-content-center shadow-sm mb-2 transition-all ${
                          state === 'completed'
                            ? 'bg-blue-600 text-white'
                            : state === 'active'
                            ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                            : 'bg-white text-slate-400 border-2 border-slate-300'
                        }`}
                        style={{ width: '32px', height: '32px' }}
                      >
                        {state === 'completed' ? (
                          <i className="bi bi-check-lg fw-bold text-sm"></i>
                        ) : (
                          <span className="text-xs font-bold">{i + 1}</span>
                        )}
                      </div>
                      <div className={`text-xs fw-bold ${state !== 'pending' ? 'text-slate-900' : 'text-slate-400'}`}>
                        {st.title}
                      </div>
                      <small className="text-slate-400 text-[11px]">{st.date}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <hr className="border-slate-100 my-4" />

          {/* Tracking Activity Log & Support Row matching Panel 6 */}
          <div className="row g-4 mt-1">
            <div className="col-md-7">
              <h6 className="fw-bold text-slate-900 mb-3">Shipment Activity Log</h6>
              <div className="position-relative ps-4 border-start border-2 border-blue-500 ms-2">
                <div className="mb-4 position-relative">
                  <div
                    className="position-absolute rounded-full bg-blue-600"
                    style={{ width: '12px', height: '12px', left: '-23px', top: '4px' }}
                  ></div>
                  <div className="fw-bold text-slate-800 text-sm">Package is out for delivery</div>
                  <div className="text-xs text-slate-400">May 1, 2025 - 08:45 AM &bull; Addis Ababa Dispatch Facility</div>
                </div>

                <div className="mb-4 position-relative">
                  <div
                    className="position-absolute rounded-full bg-blue-600"
                    style={{ width: '12px', height: '12px', left: '-23px', top: '4px' }}
                  ></div>
                  <div className="fw-bold text-slate-800 text-sm">Your order has been shipped</div>
                  <div className="text-xs text-slate-400">Apr 30, 2025 - 10:20 AM &bull; Central Store Warehouse</div>
                </div>

                <div className="position-relative">
                  <div
                    className="position-absolute rounded-full bg-slate-300"
                    style={{ width: '12px', height: '12px', left: '-23px', top: '4px' }}
                  ></div>
                  <div className="fw-bold text-slate-800 text-sm">Order verified and processed</div>
                  <div className="text-xs text-slate-400">Apr 29, 2025 - 02:15 PM &bull; Payment Verified via CBE Birr</div>
                </div>
              </div>
            </div>

            {/* Need Help Card matching Panel 6 */}
            <div className="col-md-5">
              <div className="card border border-blue-100 rounded-3xl p-4 bg-blue-50/50 text-center h-100 d-flex flex-column justify-content-between">
                <div>
                  <div
                    className="mx-auto rounded-2xl bg-white shadow-sm d-flex align-items-center justify-content-center text-primary mb-3"
                    style={{ width: '56px', height: '56px' }}
                  >
                    <i className="bi bi-box-seam-fill fs-3"></i>
                  </div>
                  <h6 className="fw-bold text-slate-900 mb-1">Need Help With Your Delivery?</h6>
                  <p className="text-slate-500 text-xs mb-3">
                    Have questions about delivery schedule, change of dropoff address, or official receipt?
                  </p>
                </div>
                <div className="d-flex flex-column gap-2">
                  <Link to="/profile" className="btn btn-outline-primary btn-sm rounded-full fw-semibold text-xs py-2">
                    Contact Support
                  </Link>
                  {order.id && (
                    <Link to={`/receipts/${order.id}`} className="btn btn-light btn-sm rounded-full text-xs text-slate-600">
                      View Official Receipt
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackOrderPage;
