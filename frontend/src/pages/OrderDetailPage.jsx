import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { formatETB } from '../utils/currency';
import { getProductImage } from '../utils/productImages';
import {
  getPaymentStatusInfo,
  getFulfillmentStatusInfo,
  getOrderMilestones,
} from '../utils/orderStatus';

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initiatingChapa, setInitiatingChapa] = useState(false);
  const [actionMessage, setActionMessage] = useState({ text: '', type: '' });

  // Warranty Claim Form state
  const [selectedItemForClaim, setSelectedItemForClaim] = useState(null);
  const [claimDescription, setClaimDescription] = useState('');
  const [claimEvidence, setClaimEvidence] = useState(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`orders/${id}/`);
      setOrder(res.data);
    } catch (err) {
      console.error('Order load error', err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'The requested order could not be loaded or you do not have permission to view it.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handlePayWithChapa = async () => {
    try {
      setInitiatingChapa(true);
      setActionMessage({ text: '', type: '' });
      const res = await api.post(`orders/${id}/chapa/initialize/`, {
        return_url: `${window.location.origin}/checkout/payment-verify`,
      });
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        setActionMessage({
          text: res.data.message || 'Failed to initialize Chapa payment.',
          type: 'danger',
        });
      }
    } catch (err) {
      setActionMessage({
        text:
          err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to connect to Chapa payment gateway.',
        type: 'danger',
      });
    } finally {
      setInitiatingChapa(false);
    }
  };

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItemForClaim || !claimDescription.trim()) return;

    try {
      setSubmittingClaim(true);
      setActionMessage({ text: '', type: '' });
      const formPayload = new FormData();
      formPayload.append('order_item_id', selectedItemForClaim.id);
      formPayload.append('issue_description', claimDescription);
      if (claimEvidence) {
        formPayload.append('evidence_image', claimEvidence);
      }

      await api.post('orders/warranty-claims/', formPayload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setActionMessage({
        text: `Warranty claim submitted successfully for ${selectedItemForClaim.product_name}! Our support team will review your claim shortly.`,
        type: 'success',
      });
      setSelectedItemForClaim(null);
      setClaimDescription('');
      setClaimEvidence(null);
      fetchOrder();
    } catch (err) {
      setActionMessage({
        text: err.response?.data?.error || 'Failed to submit warranty claim.',
        type: 'danger',
      });
    } finally {
      setSubmittingClaim(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center min-w-0" style={{ maxWidth: '1140px' }}>
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto bg-white border border-slate-200" style={{ maxWidth: '480px' }}>
          <div className="spinner-border text-primary mx-auto mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading order details...</span>
          </div>
          <h5 className="fw-bold text-slate-800 mb-1">Retrieving Order Details</h5>
          <p className="text-muted text-xs mb-0">Fetching verified records and payment status from server...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container py-5 text-center min-w-0" style={{ maxWidth: '1140px' }}>
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto bg-white border border-slate-200" style={{ maxWidth: '520px' }}>
          <div className="rounded-circle bg-amber-50 text-amber-600 d-inline-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '64px', height: '64px' }}>
            <i className="bi bi-shield-exclamation fs-2"></i>
          </div>
          <h4 className="fw-bolder text-slate-900 mb-2">Order Not Available</h4>
          <p className="text-slate-600 text-xs mb-4">
            {error || 'The requested order could not be located. It may belong to another user or does not exist.'}
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/orders" className="btn btn-primary rounded-pill px-4 text-xs font-bold">
              <i className="bi bi-bag-check me-1"></i> Back to My Orders
            </Link>
            <Link to="/" className="btn btn-outline-secondary rounded-pill px-4 text-xs font-bold">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Derive authoritative statuses and milestones
  const paymentInfo = getPaymentStatusInfo(order);
  const fulfillmentInfo = getFulfillmentStatusInfo(order);
  const milestones = getOrderMilestones(order);
  const hasVerifiedReceipt = Boolean(order.receipt && order.receipt.receipt_number);

  return (
    <div className="container py-3 py-md-4 min-w-0" style={{ maxWidth: '1140px' }}>
      {/* 1. Breadcrumbs & Return Navigation */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0 text-xs">
            <li className="breadcrumb-item">
              <Link to="/" className="text-decoration-none text-slate-500 hover:text-primary">
                Home
              </Link>
            </li>
            <li className="breadcrumb-item">
              <Link to="/orders" className="text-decoration-none text-slate-500 hover:text-primary">
                My Orders
              </Link>
            </li>
            <li className="breadcrumb-item active fw-bold text-slate-800 text-truncate" style={{ maxWidth: '220px' }} aria-current="page">
              {order.order_number}
            </li>
          </ol>
        </nav>

        <div className="d-flex align-items-center gap-2">
          <Link
            to="/orders"
            className="btn btn-outline-secondary btn-sm rounded-pill text-xs px-3 d-inline-flex align-items-center gap-1.5 shadow-sm"
          >
            <i className="bi bi-arrow-left"></i> Back to Orders
          </Link>
        </div>
      </div>

      {actionMessage.text && (
        <div className={`alert alert-${actionMessage.type} rounded-3 mb-4 d-flex align-items-center gap-2 text-xs shadow-sm`}>
          <i className="bi bi-info-circle-fill fs-6 shrink-0"></i>
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* 2. Top Order Summary Header Card (Reflows cleanly on narrow screens) */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4 bg-white border border-slate-200">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <div className="w-100 min-w-0">
            <div className="row g-2 g-md-3">
              <div className="col-6 col-md-3 min-w-0">
                <small className="text-slate-400 text-[10px] uppercase font-bold tracking-wider d-block mb-1">
                  Order Number
                </small>
                <div className="fw-bolder fs-6 text-slate-900 text-break font-monospace">
                  {order.order_number}
                </div>
              </div>

              <div className="col-6 col-md-3 min-w-0">
                <small className="text-slate-400 text-[10px] uppercase font-bold tracking-wider d-block mb-1">
                  Order Date
                </small>
                <div className="fw-bold fs-6 text-slate-800">
                  {new Date(order.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="col-6 col-md-3 min-w-0">
                <small className="text-slate-400 text-[10px] uppercase font-bold tracking-wider d-block mb-1">
                  Total Amount (ETB)
                </small>
                <div className="fw-bolder fs-6 text-primary">
                  {formatETB(order.total_amount)}
                </div>
              </div>

              <div className="col-6 col-md-3 min-w-0">
                <small className="text-slate-400 text-[10px] uppercase font-bold tracking-wider d-block mb-1">
                  Statuses
                </small>
                <div className="d-flex flex-wrap gap-1 align-items-center">
                  <span className={`badge rounded-pill px-2.5 py-1 text-[10px] font-bold ${fulfillmentInfo.badgeClass}`}>
                    {fulfillmentInfo.label}
                  </span>
                  <span className={`badge rounded-pill px-2.5 py-1 text-[10px] font-bold ${paymentInfo.badgeClass}`}>
                    {paymentInfo.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Receipt Action Button: rendered ONLY when verified receipt genuinely exists */}
          {hasVerifiedReceipt && (
            <div className="shrink-0 w-100 w-md-auto text-end mt-2 mt-md-0">
              <Link
                to={`/receipts/${order.id}`}
                className="btn btn-success btn-sm rounded-pill px-3 py-2 text-xs font-bold shadow-sm d-inline-flex align-items-center justify-content-center gap-1.5 w-100 w-md-auto text-white"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none' }}
              >
                <i className="bi bi-file-earmark-check-fill fs-6"></i> Official Digital Receipt
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 3. Order Tracking Timeline (Horizontal Scroll Container on mobile, no page overflow) */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4 bg-white border border-slate-200">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="fw-bold text-slate-900 mb-0 text-xs uppercase tracking-wider d-flex align-items-center gap-1.5">
            <i className="bi bi-geo-alt-fill text-primary"></i> Order Tracking Timeline
          </h6>
          <span className="text-slate-400 text-[11px]">
            {order.status === 'CANCELLED'
              ? 'Status: Cancelled'
              : paymentInfo.isFailed
              ? 'Status: Payment Verification Failed'
              : 'Real-time Milestone Progression'}
          </span>
        </div>

        {/* Scrollable Container for Narrow Screens */}
        <div className="tracking-timeline-scroll">
          <div className="tracking-timeline-track">
            {milestones.map((m, idx) => {
              const isLast = idx === milestones.length - 1;
              return (
                <div key={m.id} className="text-center position-relative flex-fill px-2 min-w-0" style={{ maxWidth: `${100 / milestones.length}%` }}>
                  {/* Connecting Line between milestones */}
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

                  {/* Milestone Icon Node */}
                  <div
                    className={`mx-auto rounded-circle d-flex align-items-center justify-content-center mb-2 shadow-sm position-relative z-1 transition ${
                      m.isCancelled
                        ? 'bg-danger text-white'
                        : m.isFailed
                        ? 'bg-danger text-white'
                        : m.isCompleted
                        ? 'text-white'
                        : m.isCurrent
                        ? 'text-white milestone-current-pulse'
                        : 'bg-white text-slate-400 border border-slate-300'
                    }`}
                    style={{
                      width: '42px',
                      height: '42px',
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

                  {/* Title & Description */}
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

      {/* 4. Balanced Two-Column Layout (Desktop: 7/5 columns, Mobile/Tablet: stacked vertically) */}
      <div className="row g-3 g-md-4">
        {/* Left Column: Ordered Items & Warranty Guarantees */}
        <div className="col-12 col-lg-7 min-w-0">
          <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4 bg-white border border-slate-200">
            <h5 className="fw-bolder mb-3 text-slate-900 d-flex align-items-center justify-content-between">
              <span>Ordered Products</span>
              <span className="badge bg-slate-100 text-slate-700 rounded-pill font-normal text-xs px-2.5 py-1">
                {order.items?.length || 0} items
              </span>
            </h5>

            <div className="d-flex flex-column gap-3">
              {order.items && order.items.map((item) => (
                <div key={item.id} className="p-3 rounded-3 bg-slate-50 border border-slate-100">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                    <div className="d-flex align-items-center gap-3 min-w-0">
                      <img
                        src={getProductImage(item.product)}
                        alt={item.product_name}
                        className="rounded-3 object-contain bg-white p-1 border shrink-0"
                        style={{ width: '56px', height: '56px' }}
                      />
                      <div className="min-w-0">
                        <div className="fw-bold text-xs text-slate-900 text-truncate">{item.product_name}</div>
                        <small className="text-slate-500 text-[11px] d-block">
                          Quantity: <strong>{item.quantity}</strong> &bull; {formatETB(item.unit_price)} each
                        </small>
                      </div>
                    </div>
                    <div className="fw-bold text-slate-900 text-sm shrink-0">
                      {formatETB(item.total_price)}
                    </div>
                  </div>

                  {/* Warranty Snapshot & Policy for Item */}
                  <div className="p-2.5 rounded-3 bg-white border border-slate-200 mt-2">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
                      <div className="d-flex align-items-center gap-1.5 flex-wrap">
                        <span className="badge bg-blue-50 text-blue-700 border border-blue-200 text-[10px] rounded-pill font-semibold">
                          <i className="bi bi-shield-check me-1"></i> {item.warranty_duration_days}-Day Warranty
                        </span>
                        {item.warranty_start_date && (
                          <span className="text-[10px] text-slate-500">
                            Valid until: <strong>{new Date(item.warranty_end_date).toLocaleDateString()}</strong>
                          </span>
                        )}
                      </div>

                      {/* File claim button when payment verified */}
                      {paymentInfo.isPaid && (
                        <button
                          type="button"
                          onClick={() => setSelectedItemForClaim(item)}
                          className="btn btn-outline-primary btn-sm rounded-pill text-[10px] px-2.5 py-0.5"
                        >
                          <i className="bi bi-tools me-1"></i> File Claim
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600">
                      <strong>Coverage:</strong> {item.warranty_coverage || 'Standard replacement or repair for hardware defects.'}
                    </div>

                    {/* Existing Claims on this item */}
                    {item.warranty_claims && item.warranty_claims.length > 0 && (
                      <div className="mt-2 pt-2 border-top border-slate-100">
                        {item.warranty_claims.map((claim) => (
                          <div key={claim.id} className="p-2 rounded-2 bg-slate-50 border text-[11px] mb-1">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="fw-bold text-slate-800">Claim #{claim.claim_number}</span>
                              <span className={`badge rounded-pill text-[9px] ${
                                claim.status === 'APPROVED' ? 'bg-success' : claim.status === 'REJECTED' ? 'bg-danger' : 'bg-warning text-dark'
                              }`}>
                                {claim.status}
                              </span>
                            </div>
                            <div className="text-slate-600"><strong>Issue:</strong> {claim.issue_description}</div>
                            {claim.admin_notes && (
                              <div className="text-primary mt-0.5"><strong>Staff Response:</strong> {claim.admin_notes}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warranty Claim Modal / Submission Form */}
          {selectedItemForClaim && (
            <div className="card border-primary shadow-sm rounded-4 p-3 p-md-4 mb-4 bg-white border">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-slate-900 mb-0 text-xs text-truncate">
                  <i className="bi bi-tools text-primary me-1"></i> Submit Warranty Claim: {selectedItemForClaim.product_name}
                </h6>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedItemForClaim(null)}
                  aria-label="Close"
                ></button>
              </div>

              <form onSubmit={handleClaimSubmit}>
                <div className="mb-3">
                  <label className="form-label text-xs fw-bold text-slate-700">Detailed Description of Defect / Issue *</label>
                  <textarea
                    className="form-control rounded-3 text-xs"
                    rows="3"
                    placeholder="Describe what occurred, any error codes, or physical defects..."
                    value={claimDescription}
                    onChange={(e) => setClaimDescription(e.target.value)}
                    required
                  ></textarea>
                </div>

                <div className="mb-3">
                  <label className="form-label text-xs fw-bold text-slate-700">Upload Photo / Evidence (Optional)</label>
                  <input
                    type="file"
                    className="form-control rounded-3 text-xs"
                    accept="image/*"
                    onChange={(e) => setClaimEvidence(e.target.files[0])}
                  />
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItemForClaim(null)}
                    className="btn btn-outline-secondary btn-sm rounded-pill px-3 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary-gradient btn-sm rounded-pill px-4 text-xs font-bold"
                    disabled={submittingClaim}
                  >
                    {submittingClaim ? 'Submitting...' : 'Submit Claim'}
                  </button>
                </div>
              </form>
            </div>
          )}
          {/* Order Status History Timeline */}
          {order.status_history && order.status_history.length > 0 && (
            <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4 bg-white border border-slate-200">
              <h6 className="fw-bolder mb-3 text-slate-900 d-flex align-items-center gap-2">
                <i className="bi bi-clock-history text-primary"></i> Timeline of Order Updates
              </h6>
              <div className="position-relative ps-2" style={{ borderLeft: '2px solid #e2e8f0', marginLeft: '8px' }}>
                {order.status_history.map((hist, idx) => (
                  <div key={hist.id || idx} className="position-relative mb-3 ps-3">
                    <div
                      className="position-absolute rounded-circle bg-primary"
                      style={{ width: '10px', height: '10px', left: '-15px', top: '4px', border: '2px solid #fff' }}
                    ></div>
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-1 mb-1">
                      <span className="badge bg-slate-100 text-slate-800 text-[10px] font-bold border border-slate-200">
                        {hist.previous_status ? `${hist.previous_status} → ${hist.new_status}` : hist.new_status}
                      </span>
                      <small className="text-slate-400 text-[11px]">
                        {new Date(hist.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </small>
                    </div>
                    {hist.comment && (
                      <p className="text-secondary text-xs mb-0" style={{ lineHeight: '1.4' }}>
                        {hist.comment}
                      </p>
                    )}
                    {hist.changed_by_name && (
                      <small className="text-slate-400 text-[10px] d-block mt-0.5">
                        Recorded by: {hist.changed_by_name}
                      </small>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Payment Verification Panel & Delivery Summary */}
        <div className="col-12 col-lg-5 min-w-0">
          {/* Payment Status Panel */}
          <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4 bg-white border border-slate-200">
            <h5 className="fw-bolder mb-3 text-slate-900 d-flex align-items-center justify-content-between">
              <span className="d-flex align-items-center gap-2">
                <i className="bi bi-credit-card-2-front text-primary"></i> Payment Verification
              </span>
              <span className={`badge rounded-pill px-2.5 py-1 text-[10px] font-bold ${paymentInfo.badgeClass}`}>
                {paymentInfo.label}
              </span>
            </h5>

            {/* When payment is still pending */}
            {paymentInfo.isPending && order.status !== 'CANCELLED' ? (
              <div className="p-3 rounded-3 bg-amber-50 border border-amber-200">
                <div className="d-flex align-items-start gap-2 mb-3">
                  <i className="bi bi-hourglass-split text-amber-600 fs-5 shrink-0 mt-0.5"></i>
                  <div className="text-xs text-amber-900">
                    <strong className="d-block mb-1">Payment Verification Pending:</strong>
                    Your payment is currently being verified. We do not mark orders as paid until the transaction is confirmed by Chapa's official gateway.
                    <span className="d-block text-slate-600 mt-1">
                      If you already submitted payment on Chapa, our server verifies transactions automatically upon webhook/callback arrival. If you have not paid yet, please complete payment below.
                    </span>
                  </div>
                </div>

                {order.chapa_tx_ref && (
                  <div className="mb-3 p-2 bg-white rounded border border-amber-200 text-xs text-slate-700">
                    <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Transaction Reference</span>
                    <code className="font-monospace text-slate-800">{order.chapa_tx_ref}</code>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePayWithChapa}
                  disabled={initiatingChapa}
                  className="btn btn-primary-gradient w-100 rounded-pill font-bold text-xs py-2.5 shadow-sm d-flex align-items-center justify-content-center gap-2"
                >
                  {initiatingChapa ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Connecting to Chapa...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-shield-lock-fill"></i> Pay {formatETB(order.total_amount)} with Chapa
                    </>
                  )}
                </button>
              </div>
            ) : paymentInfo.isPaid ? (
              <div className="p-3 rounded-3 bg-emerald-50 border border-emerald-200">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="text-xs text-slate-600 font-semibold">Verification Status:</span>
                  <span className="badge rounded-pill px-2.5 py-1 font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <i className="bi bi-check-circle-fill me-1"></i>Verified Paid
                  </span>
                </div>

                <div className="text-xs text-slate-700 mb-2">
                  <span className="text-slate-500 d-block mb-0.5 font-semibold">Chapa Transaction Reference:</span>
                  <code className="break-anywhere text-xs p-1.5 bg-white rounded border d-block text-slate-800 font-monospace">
                    {order.chapa_tx_ref || `ORD-REF-${order.id}`}
                  </code>
                </div>

                <div className="text-xs text-slate-700 mb-2">
                  <span className="text-slate-500">Verified Amount:</span>{' '}
                  <strong className="text-emerald-700 font-monospace">
                    {order.verified_amount ? formatETB(order.verified_amount) : formatETB(order.total_amount)}
                  </strong>
                </div>

                {order.payment_verified_at && (
                  <div className="text-xs text-slate-500 mb-3">
                    <span>Verified At:</span> {new Date(order.payment_verified_at).toLocaleString()}
                  </div>
                )}

                {hasVerifiedReceipt && (
                  <Link
                    to={`/receipts/${order.id}`}
                    className="btn btn-sm btn-outline-success rounded-pill w-100 text-xs font-bold d-flex align-items-center justify-content-center gap-1.5 bg-white shadow-sm"
                  >
                    <i className="bi bi-receipt"></i> View Official Receipt #{order.receipt.receipt_number}
                  </Link>
                )}
              </div>
            ) : paymentInfo.isFailed ? (
              <div className="p-3 rounded-3 bg-rose-50 border border-rose-200">
                <div className="d-flex align-items-start gap-2 mb-2">
                  <i className="bi bi-x-circle-fill text-rose-600 fs-5 shrink-0 mt-0.5"></i>
                  <div className="text-xs text-rose-900">
                    <strong className="d-block mb-1">Payment Verification Failed:</strong>
                    {order.verification_mismatch_message || 'Payment could not be verified by Chapa. Your card was not charged.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePayWithChapa}
                  disabled={initiatingChapa}
                  className="btn btn-outline-danger w-100 rounded-pill font-bold text-xs py-2 mt-2"
                >
                  <i className="bi bi-arrow-repeat me-1"></i> Retry Payment with Chapa
                </button>
              </div>
            ) : order.payment_status === 'REFUNDED' ? (
              <div className="p-3 rounded-3 bg-purple-50 border border-purple-200 text-xs text-purple-900">
                <i className="bi bi-arrow-counterclockwise fs-5 text-purple-600 me-2 align-middle"></i>
                <strong>Payment Refunded:</strong> This order payment has been refunded in full.
              </div>
            ) : (
              <div className="p-3 rounded-3 bg-slate-50 border border-slate-200 text-xs text-slate-600 text-center">
                This order was cancelled. No payment was charged.
              </div>
            )}
          </div>

          {/* Delivery & Shipping Address Details */}
          <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border border-slate-200">
            <h6 className="fw-bolder mb-3 text-slate-900 d-flex align-items-center gap-1.5">
              <i className="bi bi-geo-alt text-primary"></i> Delivery Information
            </h6>

            <div className="text-xs text-slate-700 mb-2">
              <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Recipient</span>
              <strong className="text-slate-900">{order.shipping_name || 'Valued Customer'}</strong>
            </div>

            <div className="text-xs text-slate-700 mb-2">
              <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Phone Number</span>
              <span className="text-slate-800">{order.shipping_phone || 'Not specified'}</span>
            </div>

            <div className="text-xs text-slate-700 mb-2">
              <span className="text-slate-400 d-block text-[10px] uppercase font-bold">Delivery Address</span>
              <span className="text-slate-800">{order.shipping_address}, {order.shipping_city}</span>
            </div>

            {order.notes && (
              <div className="text-xs text-slate-600 mt-2 p-2 rounded-2 bg-slate-50 border">
                <strong>Delivery Notes:</strong> {order.notes}
              </div>
            )}

            <div className="pt-3 mt-3 border-top border-slate-100">
              <div className="d-flex justify-content-between text-xs text-slate-600 mb-1.5">
                <span>Items Subtotal</span>
                <span>{formatETB(order.subtotal)}</span>
              </div>
              <div className="d-flex justify-content-between text-xs text-slate-600 mb-1.5">
                <span>Delivery / Shipping Fee</span>
                <span>{formatETB(order.shipping_fee)}</span>
              </div>
              <div className="d-flex justify-content-between text-xs text-slate-600 mb-2">
                <span>Tax (15% VAT)</span>
                <span>{formatETB(order.tax)}</span>
              </div>
              <div className="d-flex justify-content-between text-sm font-bold text-slate-900 pt-2 border-top border-slate-200">
                <span>Total Payable</span>
                <span className="text-primary fs-6">{formatETB(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
