import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { formatETB } from '../utils/currency';
import { getProductImage } from '../utils/productImages';

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initiatingChapa, setInitiatingChapa] = useState(false);
  const [actionMessage, setActionMessage] = useState({ text: '', type: '' });

  // Warranty Claim Modal / Form state
  const [selectedItemForClaim, setSelectedItemForClaim] = useState(null);
  const [claimDescription, setClaimDescription] = useState('');
  const [claimEvidence, setClaimEvidence] = useState(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await api.get(`orders/${id}/`);
      setOrder(res.data);
    } catch (err) {
      console.error("Order load error", err);
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
        text: err.response?.data?.message || err.response?.data?.error || 'Failed to connect to Chapa payment gateway.',
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
        text: `Warranty claim submitted successfully for ${selectedItemForClaim.product_name}! Store staff will review your claim shortly.`,
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
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading order details...</span>
        </div>
        <p className="mt-3 text-muted text-sm">Fetching verified order records...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container py-5 text-center">
        <h4 className="fw-bold">Order Not Found</h4>
        <p className="text-muted">The requested order does not exist or you do not have permission to view it.</p>
        <Link to="/orders" className="btn btn-primary rounded-pill px-4">View My Orders</Link>
      </div>
    );
  }

  // 6 real operational milestones
  const steps = [
    { title: 'Payment Pending', icon: 'bi-hourglass-split', active: true },
    {
      title: 'Payment Confirmed',
      icon: 'bi-patch-check-fill',
      active: ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status),
    },
    {
      title: 'Processing',
      icon: 'bi-box-seam-fill',
      active: ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status),
    },
    {
      title: 'Dispatched',
      icon: 'bi-truck',
      active: ['SHIPPED', 'DELIVERED'].includes(order.status),
    },
    {
      title: 'Delivered',
      icon: 'bi-check-circle-fill',
      active: order.status === 'DELIVERED',
    },
  ];

  return (
    <div className="container py-4">
      {/* Navigation Breadcrumb and Safe Back Button */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0 text-xs">
            <li className="breadcrumb-item"><Link to="/" className="text-decoration-none text-slate-500">Home</Link></li>
            <li className="breadcrumb-item"><Link to="/orders" className="text-decoration-none text-slate-500">My Orders</Link></li>
            <li className="breadcrumb-item active fw-bold text-slate-900" aria-current="page">{order.order_number}</li>
          </ol>
        </nav>
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/orders'))}
          className="btn btn-outline-secondary btn-sm rounded-full text-xs px-3 d-flex align-items-center gap-1.5"
        >
          <i className="bi bi-arrow-left"></i> Back
        </button>
      </div>

      {actionMessage.text && (
        <div className={`alert alert-${actionMessage.type} rounded-3 mb-4 d-flex align-items-center gap-2`}>
          <i className="bi bi-info-circle-fill fs-5"></i>
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Header Summary Card */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border border-slate-200">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="row g-3 flex-grow-1">
            <div className="col-sm-3 col-6 border-end-sm border-slate-100">
              <small className="text-slate-400 text-[11px] uppercase font-bold tracking-wider d-block mb-1">
                Order Number
              </small>
              <span className="fw-bolder fs-6 text-slate-900">{order.order_number}</span>
            </div>

            <div className="col-sm-3 col-6 border-end-sm border-slate-100">
              <small className="text-slate-400 text-[11px] uppercase font-bold tracking-wider d-block mb-1">
                Order Date
              </small>
              <span className="fw-bold fs-6 text-slate-900">
                {new Date(order.created_at).toLocaleDateString()}
              </span>
            </div>

            <div className="col-sm-3 col-6 border-end-sm border-slate-100">
              <small className="text-slate-400 text-[11px] uppercase font-bold tracking-wider d-block mb-1">
                Total Amount
              </small>
              <span className="fw-bold fs-6 text-primary">{formatETB(order.total_amount)}</span>
            </div>

            <div className="col-sm-3 col-6">
              <small className="text-slate-400 text-[11px] uppercase font-bold tracking-wider d-block mb-1">
                Status
              </small>
              <span className={`badge rounded-full px-3 py-1.5 font-bold text-xs ${
                order.status === 'DELIVERED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : order.status === 'PROCESSING' || order.status === 'SHIPPED'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {order.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="shrink-0 d-flex align-items-center gap-2">
            {order.receipt && (
              <Link
                to={`/receipts/${order.id}`}
                className="btn btn-success rounded-full px-4 py-2 text-xs font-bold shadow-sm d-flex align-items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none' }}
              >
                <i className="bi bi-file-earmark-pdf-fill fs-6"></i> Official Digital Receipt
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Order Tracking Milestone */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border border-slate-200">
        <h6 className="fw-bold text-slate-900 mb-4 text-xs uppercase tracking-wider">
          <i className="bi bi-geo-alt-fill text-primary me-1"></i> Order Tracking Milestone
        </h6>

        <div className="d-flex justify-content-between position-relative">
          <div
            className="position-absolute start-0 end-0 top-50 translate-middle-y z-0"
            style={{ height: '3px', background: '#e2e8f0', margin: '0 40px' }}
          ></div>

          {steps.map((st, i) => (
            <div key={i} className="text-center position-relative z-1 flex-fill">
              <div
                className={`mx-auto rounded-circle d-flex align-items-center justify-content-center mb-2 shadow-sm transition ${
                  st.active ? 'text-white' : 'bg-white text-slate-400 border border-slate-300'
                }`}
                style={{
                  width: '42px',
                  height: '42px',
                  background: st.active ? 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' : '#ffffff',
                }}
              >
                <i className={`bi ${st.icon} fs-5`}></i>
              </div>
              <div className={`small font-bold text-xs ${st.active ? 'text-primary' : 'text-slate-400'}`}>
                {st.title}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column: Ordered Items & Warranty Guarantees */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border border-slate-200">
            <h5 className="fw-bolder mb-3 text-slate-900 d-flex align-items-center justify-content-between">
              <span>Items in this Order</span>
              <span className="text-slate-500 text-xs fw-normal">{order.items.length} items</span>
            </h5>

            <div className="d-flex flex-column gap-3">
              {order.items.map((item) => (
                <div key={item.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-3">
                      <img
                        src={getProductImage(item.product)}
                        alt={item.product_name}
                        className="rounded-xl object-contain bg-white p-1 border"
                        style={{ width: '56px', height: '56px' }}
                      />
                      <div>
                        <div className="fw-bold text-xs text-slate-900">{item.product_name}</div>
                        <small className="text-slate-500 text-[11px]">
                          Qty: <strong>{item.quantity}</strong> &bull; {formatETB(item.unit_price)} each
                        </small>
                      </div>
                    </div>
                    <div className="fw-bold text-slate-900 text-sm">
                      {formatETB(item.total_price)}
                    </div>
                  </div>

                  {/* Warranty Snapshot & Claims Card for Item */}
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 mt-2">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1.5">
                      <div className="d-flex align-items-center gap-1.5">
                        <span className="badge bg-blue-50 text-blue-700 border border-blue-200 text-[10px] rounded-pill font-semibold">
                          <i className="bi bi-shield-check me-1"></i> {item.warranty_duration_days}-Day Warranty
                        </span>
                        {item.warranty_start_date && (
                          <span className="text-[10px] text-slate-500">
                            Valid until: <strong>{new Date(item.warranty_end_date).toLocaleDateString()}</strong>
                          </span>
                        )}
                      </div>

                      {/* Claim Button */}
                      {['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status) && (
                        <button
                          type="button"
                          onClick={() => setSelectedItemForClaim(item)}
                          className="btn btn-outline-primary btn-sm rounded-full text-[10px] px-2.5 py-0.5"
                        >
                          <i className="bi bi-tools me-1"></i> File Warranty Claim
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600 mb-1">
                      <strong>Coverage:</strong> {item.warranty_coverage || 'Standard hardware and component defects.'}
                    </div>

                    {/* Existing Claims on this item */}
                    {item.warranty_claims && item.warranty_claims.length > 0 && (
                      <div className="mt-2 pt-2 border-top border-slate-100">
                        {item.warranty_claims.map((claim) => (
                          <div key={claim.id} className="p-2 rounded-lg bg-slate-50 border text-[11px] mb-1">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="fw-bold text-slate-800">Claim #{claim.claim_number}</span>
                              <span className={`badge rounded-pill text-[10px] ${
                                claim.status === 'APPROVED' ? 'bg-success' : claim.status === 'REJECTED' ? 'bg-danger' : 'bg-warning text-dark'
                              }`}>
                                {claim.status}
                              </span>
                            </div>
                            <div className="text-slate-600 mb-0.5"><strong>Issue:</strong> {claim.issue_description}</div>
                            {claim.admin_notes && (
                              <div className="text-primary"><strong>Staff Note:</strong> {claim.admin_notes}</div>
                            )}
                            {claim.resolution_details && (
                              <div className="text-success"><strong>Resolution:</strong> {claim.resolution_details}</div>
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

          {/* Warranty Claim Submission Form (When item selected) */}
          {selectedItemForClaim && (
            <div className="card border-primary shadow-sm rounded-4 p-4 mb-4 bg-white border">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-slate-900 mb-0">
                  <i className="bi bi-tools text-primary me-1"></i> Submit Warranty Claim for: {selectedItemForClaim.product_name}
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
                    className="form-control rounded-xl text-xs"
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
                    className="form-control rounded-xl text-xs"
                    accept="image/*"
                    onChange={(e) => setClaimEvidence(e.target.files[0])}
                  />
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItemForClaim(null)}
                    className="btn btn-outline-secondary btn-sm rounded-full px-3 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary-gradient btn-sm rounded-full px-4 text-xs font-bold"
                    disabled={submittingClaim}
                  >
                    {submittingClaim ? 'Submitting Claim...' : 'Submit Official Claim'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Chapa Payment Verification & Delivery Summary */}
        <div className="col-lg-5">
          {/* Chapa Payment Verification Card */}
          <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border border-slate-200">
            <h5 className="fw-bolder mb-2 text-slate-900 d-flex align-items-center gap-2">
              <i className="bi bi-credit-card-2-front text-primary"></i> Payment Status
            </h5>

            {order.status === 'PENDING_PAYMENT' ? (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                <p className="text-amber-800 text-xs font-semibold mb-3">
                  Payment for this order has not been completed yet.
                </p>
                <button
                  type="button"
                  onClick={handlePayWithChapa}
                  disabled={initiatingChapa}
                  className="btn btn-primary-gradient w-100 rounded-full font-bold text-xs py-2.5 shadow-sm d-flex align-items-center justify-content-center gap-2"
                >
                  {initiatingChapa ? (
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                  ) : (
                    <>
                      <i className="bi bi-lock-fill"></i> Pay {formatETB(order.total_amount)} with Chapa
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-xs text-slate-600 font-semibold">Payment Gateway:</span>
                  <span className="badge rounded-full px-3 py-1 font-bold text-xs bg-emerald-100 text-emerald-800">
                    Chapa Verified
                  </span>
                </div>
                <div className="text-xs text-slate-700 mb-1">
                  <strong>Reference ID:</strong> <code>{order.chapa_tx_ref || `ORD-${order.id}`}</code>
                </div>
                <div className="text-xs text-slate-700 mb-2">
                  <strong>Payment Method:</strong> {order.payment_method}
                </div>
                {order.receipt && (
                  <Link
                    to={`/receipts/${order.id}`}
                    className="btn btn-sm btn-outline-success rounded-full w-100 text-xs font-bold"
                  >
                    <i className="bi bi-receipt me-1"></i> View Receipt #{order.receipt.receipt_number}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Delivery & Shipping Address Details */}
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border border-slate-200">
            <h6 className="fw-bolder mb-3 text-slate-900">
              <i className="bi bi-geo-alt text-primary me-1"></i> Delivery Details
            </h6>
            <div className="text-xs text-slate-700 mb-2">
              <strong>Recipient:</strong> {order.shipping_name}
            </div>
            <div className="text-xs text-slate-700 mb-2">
              <strong>Phone:</strong> {order.shipping_phone}
            </div>
            <div className="text-xs text-slate-700 mb-2">
              <strong>Address:</strong> {order.shipping_address}, {order.shipping_city}
            </div>
            {order.notes && (
              <div className="text-xs text-slate-500 mt-2 p-2 rounded-xl bg-slate-50 border">
                <strong>Notes:</strong> {order.notes}
              </div>
            )}

            <div className="pt-3 mt-3 border-top border-slate-100">
              <div className="d-flex justify-content-between text-xs text-slate-600 mb-1">
                <span>Subtotal</span>
                <span>{formatETB(order.subtotal)}</span>
              </div>
              <div className="d-flex justify-content-between text-xs text-slate-600 mb-1">
                <span>Delivery Fee</span>
                <span>{formatETB(order.shipping_fee)}</span>
              </div>
              <div className="d-flex justify-content-between text-xs text-slate-600 mb-2">
                <span>Tax (15% VAT)</span>
                <span>{formatETB(order.tax)}</span>
              </div>
              <div className="d-flex justify-content-between text-sm font-bold text-slate-900 pt-2 border-top">
                <span>Total Amount</span>
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
