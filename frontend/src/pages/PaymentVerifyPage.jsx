import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { formatETB } from '../utils/currency';

const PaymentVerifyPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orderId = searchParams.get('order_id');
  const txRef = searchParams.get('tx_ref') || searchParams.get('trx_ref');

  const [statusState, setStatusState] = useState('verifying'); // 'verifying', 'success', 'error'
  const [order, setOrder] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const verifyPayment = async () => {
    if (!orderId && !txRef) {
      setStatusState('error');
      setErrorMessage('Missing order reference or transaction reference from Chapa.');
      return;
    }

    try {
      setStatusState('verifying');
      setErrorMessage('');

      // Send verification request to backend
      const endpoint = orderId ? `orders/${orderId}/chapa/verify/` : 'orders/chapa/verify/';
      const res = await api.post(endpoint, {
        order_id: orderId,
        tx_ref: txRef,
      });

      if (res.data.status === 'success') {
        setStatusState('success');
        setOrder(res.data.order);
        setReceipt(res.data.receipt);
      } else {
        setStatusState('error');
        setErrorMessage(res.data.message || 'Payment verification could not be completed.');
      }
    } catch (err) {
      console.error('Chapa verification error:', err);
      setStatusState('error');
      setErrorMessage(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Unable to verify Chapa payment. Please check your bank transaction or contact support.'
      );
    }
  };

  useEffect(() => {
    verifyPayment();
  }, [orderId, txRef, retryCount]);

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-6 col-md-8">
          {/* VERIFYING STATE */}
          {statusState === 'verifying' && (
            <div className="card border-0 shadow-lg rounded-4 p-5 text-center bg-white border border-slate-200">
              <div className="mb-4">
                <div
                  className="spinner-border text-primary"
                  role="status"
                  style={{ width: '3.5rem', height: '3.5rem' }}
                >
                  <span className="visually-hidden">Verifying...</span>
                </div>
              </div>
              <h4 className="fw-bolder text-slate-900 mb-2">Verifying Payment with Chapa</h4>
              <p className="text-slate-500 text-xs mb-3">
                Securely authenticating transaction reference with Ethiopian banking switch and Chapa gateway...
              </p>
              {txRef && (
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 d-inline-block mx-auto mb-3">
                  <small className="text-slate-500 text-[11px] font-mono">
                    Ref: <strong>{txRef}</strong>
                  </small>
                </div>
              )}
              <div className="text-slate-400 text-[11px]">
                Please do not close this window. Your order status and digital receipt will update instantly.
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {statusState === 'success' && (
            <div className="card border-0 shadow-lg rounded-4 p-4 p-md-5 text-center bg-white border border-emerald-200">
              <div className="mb-3">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center text-white shadow-lg mx-auto"
                  style={{
                    width: '72px',
                    height: '72px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                  }}
                >
                  <i className="bi bi-check2-all fs-1"></i>
                </div>
              </div>

              <span className="badge bg-emerald-100 text-emerald-800 rounded-pill px-3 py-1.5 text-xs font-bold mb-2">
                <i className="bi bi-shield-check me-1"></i> CHAPA PAYMENT VERIFIED
              </span>

              <h3 className="fw-bolder text-slate-900 mb-1">Payment Successful!</h3>
              <p className="text-slate-500 text-xs mb-4">
                Thank you! Your transaction has been confirmed and verified on the server. Your order is now in processing.
              </p>

              {/* Order Metadata Box */}
              <div className="bg-slate-50 rounded-3xl p-4 border border-slate-200 text-start mb-4">
                <div className="d-flex justify-content-between align-items-center pb-2 border-bottom border-slate-200 mb-2">
                  <span className="text-slate-500 text-xs font-medium">Order Number</span>
                  <span className="fw-bold text-slate-900 text-xs font-mono">
                    {order?.order_number || (orderId ? `ORD-${orderId}` : 'N/A')}
                  </span>
                </div>
                <div className="d-flex justify-content-between align-items-center pb-2 border-bottom border-slate-200 mb-2">
                  <span className="text-slate-500 text-xs font-medium">Verified Amount</span>
                  <span className="fw-bolder text-primary text-sm">
                    {order ? formatETB(order.total_amount) : 'ETB'}
                  </span>
                </div>
                <div className="d-flex justify-content-between align-items-center pb-2 border-bottom border-slate-200 mb-2">
                  <span className="text-slate-500 text-xs font-medium">Payment Channel</span>
                  <span className="badge bg-blue-100 text-blue-800 text-[11px] font-semibold">
                    Chapa Instant (Test)
                  </span>
                </div>
                {receipt && (
                  <div className="d-flex justify-content-between align-items-center pb-2 border-bottom border-slate-200 mb-2">
                    <span className="text-slate-500 text-xs font-medium">Official Receipt</span>
                    <span className="fw-bold text-emerald-700 text-xs font-mono">
                      {receipt.receipt_number}
                    </span>
                  </div>
                )}
                {txRef && (
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-slate-500 text-[11px] font-medium">Transaction Reference</span>
                    <span className="text-slate-600 text-[10px] font-mono text-truncate" style={{ maxWidth: '180px' }}>
                      {txRef}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="d-flex flex-column flex-sm-row justify-content-center gap-2.5">
                {order && (
                  <Link
                    to={`/receipts/${order.id}`}
                    className="btn btn-primary-gradient rounded-full px-4 py-2.5 font-bold text-xs shadow-md d-inline-flex align-items-center justify-content-center gap-1.5"
                  >
                    <i className="bi bi-receipt"></i>
                    <span>Download Official Receipt</span>
                  </Link>
                )}
                {order && (
                  <Link
                    to={`/orders/${order.id}`}
                    className="btn btn-outline-secondary rounded-full px-4 py-2.5 font-bold text-xs d-inline-flex align-items-center justify-content-center gap-1.5"
                  >
                    <i className="bi bi-box-seam"></i>
                    <span>Track Order Progress</span>
                  </Link>
                )}
                <Link
                  to="/shop"
                  className="btn btn-light rounded-full px-4 py-2.5 font-bold text-xs text-slate-700"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          )}

          {/* ERROR / PENDING STATE */}
          {statusState === 'error' && (
            <div className="card border-0 shadow-lg rounded-4 p-4 p-md-5 text-center bg-white border border-rose-200">
              <div className="mb-3">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center text-white shadow-lg mx-auto bg-danger"
                  style={{ width: '64px', height: '64px' }}
                >
                  <i className="bi bi-exclamation-triangle fs-2"></i>
                </div>
              </div>

              <h4 className="fw-bolder text-slate-900 mb-1">Verification Unsuccessful</h4>
              <p className="text-rose-600 text-xs mb-3">{errorMessage}</p>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 text-xs mb-4 text-start">
                <p className="mb-1 fw-bold text-slate-800">What happened?</p>
                <ul className="mb-0 ps-3 small text-slate-500">
                  <li>Your payment session may still be confirming on the bank's network.</li>
                  <li>You may have cancelled or navigated away from the hosted Chapa page.</li>
                  <li>Or your account was debited but the webhook is still propagating.</li>
                </ul>
              </div>

              <div className="d-flex flex-column flex-sm-row justify-content-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary rounded-full px-4 py-2 text-xs font-bold"
                  onClick={() => setRetryCount((prev) => prev + 1)}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i> Retry Verification
                </button>
                {orderId && (
                  <Link
                    to={`/orders/${orderId}`}
                    className="btn btn-outline-secondary rounded-full px-4 py-2 text-xs font-bold"
                  >
                    <i className="bi bi-credit-card me-1"></i> Review Order & Pay with Chapa
                  </Link>
                )}
                <Link to="/orders" className="btn btn-light rounded-full px-4 py-2 text-xs text-slate-600">
                  Orders History
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentVerifyPage;
