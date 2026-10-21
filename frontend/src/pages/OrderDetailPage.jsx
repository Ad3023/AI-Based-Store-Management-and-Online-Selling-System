import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { formatETB } from '../utils/currency';
import { getProductImage } from '../utils/productImages';

const OrderDetailPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Evidence upload form
  const [paymentMethod, setPaymentMethod] = useState('Commercial Bank of Ethiopia (CBE)');
  const [transactionRef, setTransactionRef] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [initiatingChapa, setInitiatingChapa] = useState(false);
  const [uploadMessage, setUploadMessage] = useState({ text: '', type: '' });

  const handlePayWithChapa = async () => {
    try {
      setInitiatingChapa(true);
      setUploadMessage({ text: '', type: '' });
      const res = await api.post(`orders/${id}/chapa/initialize/`, {
        return_url: `${window.location.origin}/checkout/payment-verify`,
      });
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        setUploadMessage({
          text: res.data.message || 'Failed to initialize Chapa payment.',
          type: 'danger',
        });
      }
    } catch (err) {
      setUploadMessage({
        text: err.response?.data?.message || err.response?.data?.error || 'Failed to connect to Chapa payment gateway.',
        type: 'danger',
      });
    } finally {
      setInitiatingChapa(false);
    }
  };

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await api.get(`orders/${id}/`);
      setOrder(res.data);
      if (res.data.payment_evidence) {
        setPaymentMethod(res.data.payment_evidence.payment_method);
        setTransactionRef(res.data.payment_evidence.transaction_reference);
      }
    } catch (err) {
      console.error("Order load error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEvidenceFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleEvidenceSubmit = async (e) => {
    e.preventDefault();
    setUploadMessage({ text: '', type: '' });

    if (!transactionRef.trim()) {
      setUploadMessage({ text: 'Please enter your bank transfer reference ID or SMS code.', type: 'danger' });
      return;
    }

    try {
      setUploading(true);
      const formPayload = new FormData();
      formPayload.append('payment_method', paymentMethod);
      formPayload.append('transaction_reference', transactionRef);
      if (evidenceFile) {
        formPayload.append('evidence_image', evidenceFile);
      }

      await api.post(`orders/${id}/payment-evidence/`, formPayload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadMessage({ text: 'Payment evidence submitted successfully! Store Manager is reviewing it.', type: 'success' });
      fetchOrder(); // Reload updated order status
    } catch (err) {
      setUploadMessage({
        text: err.response?.data?.error || 'Failed to submit payment evidence. Please try again.',
        type: 'danger'
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container py-5 text-center">
        <h4>Order Not Found</h4>
        <Link to="/orders" className="btn btn-primary rounded-pill px-4 mt-3">Back to Orders</Link>
      </div>
    );
  }

  // Stepper milestones (Screenshot 4: POP-COUCH Style)
  const steps = [
    { title: 'Order Placed', active: true, icon: 'bi-bag-check-fill' },
    {
      title: 'Payment Submitted',
      active: order.status !== 'PENDING_PAYMENT',
      current: order.status === 'PAYMENT_SUBMITTED',
      icon: 'bi-receipt'
    },
    {
      title: 'Verified & Processing',
      active: ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status),
      current: order.status === 'PROCESSING',
      icon: 'bi-patch-check-fill'
    },
    {
      title: 'In Transit',
      active: ['SHIPPED', 'DELIVERED'].includes(order.status),
      current: order.status === 'SHIPPED',
      icon: 'bi-truck'
    },
    {
      title: 'Delivered',
      active: order.status === 'DELIVERED',
      current: order.status === 'DELIVERED',
      icon: 'bi-house-check-fill'
    },
  ];

  return (
    <div className="container py-4">
      {/* Back Link */}
      <div className="mb-3">
        <Link to="/orders" className="text-slate-500 hover:text-primary text-xs fw-semibold text-decoration-none d-inline-flex align-items-center gap-1">
          <i className="bi bi-arrow-left"></i> Back to Orders History
        </Link>
      </div>

      {/* =========================================================================
          TOP ORDER HEADER CARD (Screenshot 4: POP-COUCH Header with Download Button)
          ========================================================================= */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border border-slate-200">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
          <div className="row g-4 flex-grow-1 align-items-center">
            <div className="col-sm-3 col-6 border-end-sm border-slate-100">
              <small className="text-slate-400 text-[11px] uppercase font-bold tracking-wider d-block mb-1">
                Order Number
              </small>
              <span className="fw-bolder fs-6 text-slate-900">{order.order_number}</span>
            </div>

            <div className="col-sm-3 col-6 border-end-sm border-slate-100">
              <small className="text-slate-400 text-[11px] uppercase font-bold tracking-wider d-block mb-1">
                Order Placed
              </small>
              <span className="fw-bold fs-6 text-slate-900">
                {new Date(order.created_at).toLocaleDateString()}
              </span>
            </div>

            <div className="col-sm-3 col-6 border-end-sm border-slate-100">
              <small className="text-slate-400 text-[11px] uppercase font-bold tracking-wider d-block mb-1">
                Items Count
              </small>
              <span className="fw-bold fs-6 text-slate-900">{order.items?.length || 0} Products</span>
            </div>

            <div className="col-sm-3 col-6">
              <small className="text-slate-400 text-[11px] uppercase font-bold tracking-wider d-block mb-1">
                Status
              </small>
              <span className={`badge rounded-full px-3 py-1.5 font-bold text-xs ${
                order.status === 'DELIVERED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : order.status === 'PROCESSING'
                  ? 'bg-blue-100 text-blue-800'
                  : order.status === 'PAYMENT_SUBMITTED'
                  ? 'bg-cyan-100 text-cyan-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {order.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Prominent Download Invoice / Receipt Button (Screenshot 4) */}
          <div className="shrink-0">
            {order.receipt ? (
              <Link
                to={`/receipts/${order.id}`}
                className="btn btn-success rounded-full px-4 py-2 text-xs font-bold shadow-sm d-flex align-items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none' }}
              >
                <i className="bi bi-file-earmark-pdf-fill fs-6"></i> Download Official Invoice
              </Link>
            ) : (
              <Link
                to={`/receipts/${order.id}`}
                className="btn btn-outline-custom rounded-full px-4 py-2 text-xs font-semibold d-flex align-items-center gap-1.5"
                title="Receipt available upon Store Manager payment approval"
              >
                <i className="bi bi-receipt"></i> View Receipt Status
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          ORDER TRACKING PIPELINE (Screenshot 4 Visual Stepper)
          ========================================================================= */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border border-slate-200">
        <h6 className="fw-bold text-slate-900 mb-4 text-xs uppercase tracking-wider">
          <i className="bi bi-geo-alt-fill text-primary me-1"></i> Order Tracking Milestone
        </h6>

        <div className="d-flex justify-content-between position-relative">
          {/* Connector Track Line */}
          <div
            className="position-absolute start-0 end-0 top-50 translate-middle-y z-0"
            style={{ height: '3px', background: '#e2e8f0', margin: '0 40px' }}
          ></div>

          {steps.map((st, i) => (
            <div key={i} className="text-center position-relative z-1 flex-fill">
              <div
                className={`mx-auto rounded-circle d-flex align-items-center justify-content-center mb-2 shadow-sm transition ${
                  st.active
                    ? 'text-white'
                    : 'bg-white text-slate-400 border border-slate-300'
                }`}
                style={{
                  width: '44px',
                  height: '44px',
                  background: st.active
                    ? 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)'
                    : '#ffffff',
                }}
              >
                <i className={`bi ${st.icon} fs-5`}></i>
              </div>
              <div
                className={`small font-bold text-xs ${st.active ? 'text-primary' : 'text-slate-400'}`}
                style={{ fontSize: '0.75rem' }}
              >
                {st.title}
              </div>
            </div>
          ))}
        </div>
      </div>

      {uploadMessage.text && (
        <div className={`alert alert-${uploadMessage.type} rounded-3 mb-4 d-flex align-items-center gap-2`}>
          <i className="bi bi-info-circle-fill fs-5"></i>
          <span>{uploadMessage.text}</span>
        </div>
      )}

      {/* =========================================================================
          MAIN ORDER GRID: Ordered Items & Proof (Left) + Floating Summary (Right)
          ========================================================================= */}
      <div className="row g-4">
        {/* Left Column: Items and Payment Proof Form */}
        <div className="col-lg-7">
          {/* Items From The Order Table (Screenshot 4 Table) */}
          <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border border-slate-200">
            <h5 className="fw-bolder mb-3 text-slate-900">Items from the Order</h5>

            <div className="d-flex flex-column gap-3 mb-2">
              {order.items.map((item) => (
                <div key={item.id} className="d-flex align-items-center justify-content-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
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
              ))}
            </div>
          </div>

          {/* Payment Evidence Submission Card */}
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border border-slate-200">
            <h5 className="fw-bolder mb-2 text-slate-900 d-flex align-items-center gap-2">
              <i className="bi bi-credit-card-2-front text-primary"></i> Payment Verification Status
            </h5>
            <p className="text-slate-500 text-xs mb-3">
              Upload your bank transaction screenshot to receive verified store manager approval and digital receipts.
            </p>

            {order.payment_evidence ? (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-xs text-slate-500 font-semibold">Verification Status:</span>
                  <span className={`badge rounded-full px-3 py-1 font-bold text-xs ${
                    order.payment_evidence.verification_status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : order.payment_evidence.verification_status === 'REJECTED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-cyan-100 text-cyan-800'
                  }`}>
                    {order.payment_evidence.verification_status}
                  </span>
                </div>
                <div className="text-xs text-slate-700 mb-1">
                  <strong>Channel:</strong> {order.payment_evidence.payment_method}
                </div>
                <div className="text-xs text-slate-700 mb-1">
                  <strong>Reference ID:</strong> <code>{order.payment_evidence.transaction_reference}</code>
                </div>
                <small className="text-slate-400 text-[10px]">
                  Submitted on: {new Date(order.payment_evidence.submitted_at).toLocaleString()}
                </small>

                {order.payment_evidence.evidence_image && (
                  <div className="mt-3 text-center">
                    <img
                      src={order.payment_evidence.evidence_image}
                      alt="Uploaded transfer screenshot"
                      className="img-fluid rounded-2xl border shadow-sm"
                      style={{ maxHeight: '180px', objectFit: 'contain' }}
                    />
                  </div>
                )}
              </div>
            ) : null}

            {/* If pending or rejected, show the upload form */}
            {['PENDING_PAYMENT', 'PAYMENT_SUBMITTED'].includes(order.status) && (
              <form onSubmit={handleEvidenceSubmit} className="pt-2">
                <div className="mb-3">
                  <label className="form-label text-xs fw-bold text-slate-700">Select Bank Channel *</label>
                  <select
                    className="form-select rounded-xl text-xs"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Commercial Bank of Ethiopia (CBE)">Commercial Bank of Ethiopia (CBE)</option>
                    <option value="Telebirr SuperApp">Telebirr SuperApp</option>
                    <option value="Awash Bank">Awash Bank</option>
                    <option value="Bank of Abyssinia">Bank of Abyssinia</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label text-xs fw-bold text-slate-700">Transaction Reference / SMS Code *</label>
                  <input
                    type="text"
                    className="form-control rounded-xl text-xs"
                    placeholder="e.g. CBE-TX-99881122"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label text-xs fw-bold text-slate-700">Upload Transfer Screenshot *</label>
                  <input
                    type="file"
                    className="form-control rounded-xl text-xs"
                    accept="image/*"
                    onChange={handleFileChange}
                    required={!order.payment_evidence}
                  />
                  {previewUrl && (
                    <div className="mt-2 text-center">
                      <img src={previewUrl} alt="Preview" className="img-thumbnail rounded-xl" style={{ maxHeight: '120px' }} />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary-gradient w-100 rounded-full font-bold text-xs py-2 shadow-sm"
                  disabled={uploading}
                >
                  {uploading ? (
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                  ) : order.payment_evidence ? (
                    'Re-upload Payment Proof'
                  ) : (
                    'Submit Payment Evidence'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Floating Summary Card (Screenshot 4 Floating Box) */}
        <div className="col-lg-5">
          <div
            className="card border-0 shadow-xl rounded-4 p-4 text-white sticky-top"
            style={{
              top: '80px',
              background: 'linear-gradient(135deg, #091329 0%, #101c3d 100%)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
            }}
          >
            <h5 className="fw-bolder mb-3 text-white">Summary</h5>

            <div className="d-flex justify-content-between mb-2 text-xs text-slate-300">
              <span>Subtotal:</span>
              <span className="fw-bold text-white">{formatETB(order.subtotal)}</span>
            </div>

            <div className="d-flex justify-content-between mb-2 text-xs text-slate-300">
              <span>Delivery Fee:</span>
              <span className="fw-bold text-white">{formatETB(order.shipping_fee)}</span>
            </div>

            <div className="d-flex justify-content-between mb-3 text-xs text-slate-300">
              <span>VAT (15% Tax):</span>
              <span className="fw-bold text-white">{formatETB(order.tax)}</span>
            </div>

            <hr className="border-slate-700 my-2" />

            <div className="d-flex justify-content-between align-items-baseline mb-4">
              <span className="fw-bold text-xs uppercase tracking-wider text-slate-300">Total:</span>
              <span className="fw-bolder fs-4 text-cyan-400">{formatETB(order.total_amount)}</span>
            </div>

            {/* Destination Info inside Summary */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300 mb-3">
              <div className="fw-bold text-white mb-1">
                <i className="bi bi-geo-alt text-cyan-400 me-1"></i> Delivery Destination
              </div>
              <div>{order.shipping_name}</div>
              <div>{order.shipping_phone}</div>
              <div className="text-slate-400">{order.shipping_address}, {order.shipping_city}</div>
            </div>

            {order.receipt && (
              <Link
                to={`/receipts/${order.id}`}
                className="btn btn-cyan-glow w-100 rounded-full font-bold text-xs py-2 shadow-md d-flex align-items-center justify-content-center gap-1.5"
              >
                <i className="bi bi-printer-fill"></i> Print Official Receipt
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
