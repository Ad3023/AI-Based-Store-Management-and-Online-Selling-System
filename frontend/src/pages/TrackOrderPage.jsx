import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import { formatETB } from '../utils/currency';
import {
  getPaymentStatusInfo,
  getFulfillmentStatusInfo,
  getOrderMilestones,
} from '../utils/orderStatus';

const TrackOrderPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryInput, setQueryInput] = useState(searchParams.get('order') || '');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const executeTrack = async (orderNumber) => {
    if (!orderNumber || !orderNumber.trim()) return;
    try {
      setLoading(true);
      setError('');
      setSearched(true);
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
        setOrder(null);
        setError(`No verified order found with reference "${cleanNum}". Please verify your order number and try again.`);
      }
    } catch (err) {
      console.error('Track order error', err);
      setOrder(null);
      setError('Unable to retrieve tracking details. Please ensure you are signed in to view your orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = searchParams.get('order');
    if (initial) {
      executeTrack(initial);
    }
  }, []);

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    if (queryInput.trim()) {
      setSearchParams({ order: queryInput.trim() });
      executeTrack(queryInput.trim());
    }
  };

  const paymentInfo = order ? getPaymentStatusInfo(order) : null;
  const fulfillmentInfo = order ? getFulfillmentStatusInfo(order) : null;
  const milestones = order ? getOrderMilestones(order) : [];
  const hasVerifiedReceipt = Boolean(order?.receipt && order.receipt.receipt_number);

  return (
    <div className="container py-4 pb-5 min-w-0" style={{ maxWidth: '960px' }}>
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="fw-bolder mb-1 text-slate-900">Track Your Order</h2>
        <p className="text-muted small">Enter your order number to check real-time payment verification and delivery milestone status</p>
      </div>

      {/* Input Search Form */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4 bg-white border border-slate-200">
        <form onSubmit={handleTrackSubmit} className="row g-2 align-items-center">
          <div className="col-12 col-md-9">
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border text-slate-400 ps-3 rounded-start-pill">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control bg-slate-50 border rounded-end-pill py-2.5 text-sm"
                placeholder="Enter order number (e.g. ORD-20261025-XXXXXX)"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="col-12 col-md-3">
            <button
              type="submit"
              className="btn btn-primary-gradient w-100 rounded-pill py-2.5 font-bold text-xs shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  Searching...
                </>
              ) : (
                'Track Order'
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="alert alert-warning rounded-3 mb-4 text-xs d-flex align-items-center gap-2 border border-warning">
          <i className="bi bi-exclamation-triangle-fill text-warning fs-5 shrink-0"></i>
          <span>{error}</span>
        </div>
      )}

      {/* Empty Initial State when no search performed yet */}
      {!searched && !order && !loading && (
        <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white border border-slate-200">
          <div className="rounded-circle bg-blue-50 text-primary d-inline-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '60px', height: '60px' }}>
            <i className="bi bi-geo-alt fs-2"></i>
          </div>
          <h5 className="fw-bolder text-slate-800 mb-1">Live Order Status Tracking</h5>
          <p className="text-muted text-xs mb-3" style={{ maxWidth: '420px', margin: '0 auto' }}>
            Check payment confirmation, warehouse processing, and express delivery milestones for your electronics order.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/orders" className="btn btn-outline-primary btn-sm rounded-pill px-4 text-xs font-bold">
              View My Order History
            </Link>
          </div>
        </div>
      )}

      {/* Order Details and Responsive Timeline */}
      {order && (
        <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border border-slate-200 mb-4 min-w-0">
          {/* Summary Row */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center pb-3 mb-3 border-bottom border-slate-100 gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <h4 className="fw-bolder text-slate-900 mb-0 font-monospace">{order.order_number}</h4>
                <span className={`badge rounded-pill px-2.5 py-1 text-[10px] font-bold ${fulfillmentInfo.badgeClass}`}>
                  {fulfillmentInfo.label}
                </span>
                <span className={`badge rounded-pill px-2.5 py-1 text-[10px] font-bold ${paymentInfo.badgeClass}`}>
                  {paymentInfo.label}
                </span>
              </div>
              <small className="text-slate-500 text-xs d-block">
                Placed on: <strong>{new Date(order.created_at).toLocaleDateString()}</strong> &bull; Total Amount: <strong className="text-primary">{formatETB(order.total_amount)}</strong>
              </small>
            </div>

            <div className="d-flex align-items-center gap-2">
              <Link to={`/orders/${order.id}`} className="btn btn-outline-primary btn-sm rounded-pill px-3 py-1 text-xs font-bold">
                View Full Details
              </Link>
              {hasVerifiedReceipt && (
                <Link to={`/receipts/${order.id}`} className="btn btn-success btn-sm rounded-pill px-3 py-1 text-xs font-bold text-white shadow-sm">
                  <i className="bi bi-receipt me-1"></i> Receipt
                </Link>
              )}
            </div>
          </div>

          {/* Responsive Tracking Timeline */}
          <div className="my-3">
            <h6 className="fw-bold text-slate-900 mb-3 text-xs uppercase tracking-wider">
              <i className="bi bi-geo-alt-fill text-primary me-1"></i> Delivery Milestones
            </h6>

            <div className="tracking-timeline-scroll">
              <div className="tracking-timeline-track">
                {milestones.map((m, idx) => {
                  const isLast = idx === milestones.length - 1;
                  return (
                    <div key={m.id} className="text-center position-relative flex-fill px-2 min-w-0" style={{ maxWidth: `${100 / milestones.length}%` }}>
                      {!isLast && (
                        <div
                          className="position-absolute top-50 translate-middle-y z-0"
                          style={{
                            height: '3px',
                            left: '50%',
                            right: '-50%',
                            background: m.isCompleted
                              ? 'linear-gradient(90deg, #2563eb, #06b6d4)'
                              : '#e2e8f0',
                            marginTop: '-16px',
                          }}
                        ></div>
                      )}

                      <div
                        className={`mx-auto rounded-circle d-flex align-items-center justify-content-center mb-2 shadow-sm position-relative z-1 transition ${
                          m.isCancelled || m.isFailed
                            ? 'bg-danger text-white'
                            : m.isCompleted
                            ? 'text-white'
                            : m.isCurrent
                            ? 'text-white milestone-current-pulse'
                            : 'bg-white text-slate-400 border border-slate-300'
                        }`}
                        style={{
                          width: '40px',
                          height: '40px',
                          background: m.isCancelled || m.isFailed
                            ? '#dc2626'
                            : m.isCompleted
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : m.isCurrent
                            ? 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)'
                            : '#ffffff',
                        }}
                      >
                        <i className={`bi ${m.icon} fs-5`}></i>
                      </div>

                      <div className={`font-bold text-xs mb-0.5 text-truncate ${
                        m.isCancelled || m.isFailed
                          ? 'text-danger'
                          : m.isCurrent
                          ? 'text-primary fw-bolder'
                          : m.isCompleted
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}>
                        {m.title}
                      </div>
                      <div className="text-slate-500 text-[10px] text-truncate">
                        {m.description}
                      </div>

                      {m.isCurrent && (
                        <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-0.5 text-[9px] uppercase font-bold mt-1">
                          Current Stage
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Delivery Details Card */}
          <div className="p-3 rounded-3 bg-slate-50 border border-slate-100 mt-2">
            <div className="row g-2 text-xs">
              <div className="col-12 col-sm-4">
                <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Delivery Recipient</span>
                <strong className="text-slate-800">{order.shipping_name || 'Valued Customer'}</strong>
              </div>
              <div className="col-12 col-sm-4">
                <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Destination</span>
                <span className="text-slate-800">{order.shipping_address}, {order.shipping_city}</span>
              </div>
              <div className="col-12 col-sm-4">
                <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Payment Gateway</span>
                <span className="text-slate-800">{order.payment_method || 'Chapa'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackOrderPage;
