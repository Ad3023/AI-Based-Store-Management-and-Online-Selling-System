import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { formatETB } from '../utils/currency';

const ReceiptPage = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const res = await api.get(`orders/${id}/receipt/`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || "Receipt not found or not yet approved.");
      } finally {
        setLoading(false);
      }
    };
    fetchReceipt();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Retrieving official receipt record...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '500px' }}>
          <i className="bi bi-receipt fs-1 text-warning mb-3"></i>
          <h4 className="fw-bold">Receipt Unavailable</h4>
          <p className="text-muted small mb-4">{error || "Payment has not yet been verified by the Store Manager."}</p>
          <Link to={`/orders/${id}`} className="btn btn-primary rounded-pill px-4">
            View Order Status
          </Link>
        </div>
      </div>
    );
  }

  const { receipt, order } = data;

  return (
    <div className="container py-5">
      {/* Top Action Bar (hidden during print) */}
      <div className="d-flex justify-content-between align-items-center mb-4 no-print" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <Link to={`/orders/${order.id}`} className="btn btn-outline-secondary rounded-pill px-3 btn-sm">
          <i className="bi bi-arrow-left me-1"></i> Back to Order
        </Link>
        <button className="btn btn-primary-gradient rounded-pill px-4 btn-sm fw-bold shadow-sm" onClick={handlePrint}>
          <i className="bi bi-printer me-2"></i> Print / Save as PDF
        </button>
      </div>

      {/* Official Receipt Paper */}
      <div className="receipt-paper">
        {/* Watermark */}
        <div className="receipt-watermark">PAYMENT VERIFIED</div>

        {/* Store Header */}
        <div className="d-flex justify-content-between align-items-start border-bottom pb-4 mb-4">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-white"
                style={{ width: '38px', height: '38px', background: 'var(--gradient-primary)' }}
              >
                <i className="bi bi-cpu-fill fs-5"></i>
              </div>
              <h4 className="mb-0 fw-bold text-dark">Nexus<span className="text-primary">Store</span></h4>
            </div>
            <div className="text-muted small">AI-Powered Store Management System</div>
            <div className="text-muted small">TIN: 0049281729 &bull; VAT Reg: 98217381</div>
            <div className="text-muted small">Addis Ababa, Ethiopia</div>
          </div>

          <div className="text-end">
            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill fw-bold mb-2 d-inline-block">
              <i className="bi bi-check-circle-fill me-1"></i> VERIFIED RECEIPT
            </span>
            <div className="fw-bolder fs-5 text-dark">{receipt.receipt_number}</div>
            <div className="text-muted small">Issued: {new Date(receipt.issued_at).toLocaleString()}</div>
          </div>
        </div>

        {/* Order & Customer Metadata */}
        <div className="row g-3 mb-4 small">
          <div className="col-sm-6">
            <h6 className="fw-bold text-dark mb-2 text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
              Customer Details:
            </h6>
            <div className="fw-bold text-dark">{order.shipping_name}</div>
            <div className="text-muted">{order.shipping_phone}</div>
            <div className="text-muted">{order.shipping_address}, {order.shipping_city}</div>
            <div className="text-muted">{order.customer_email}</div>
          </div>

          <div className="col-sm-6 text-sm-end">
            <h6 className="fw-bold text-dark mb-2 text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
              Order Reference:
            </h6>
            <div><strong>Order No:</strong> <code>{order.order_number}</code></div>
            <div><strong>Verification Officer:</strong> {receipt.verified_by_name || 'Store Manager'}</div>
            {order.payment_evidence && (
              <>
                <div><strong>Channel:</strong> {order.payment_evidence.payment_method}</div>
                <div><strong>Txn Ref:</strong> <code>{order.payment_evidence.transaction_reference}</code></div>
              </>
            )}
          </div>
        </div>

        {/* Itemized Table */}
        <div className="table-responsive mb-4">
          <table className="table align-middle">
            <thead className="table-light text-uppercase text-muted" style={{ fontSize: '0.75rem' }}>
              <tr>
                <th>Item Description</th>
                <th className="text-center">Qty</th>
                <th className="text-end">Unit Price</th>
                <th className="text-end">Total</th>
              </tr>
            </thead>
            <tbody className="small">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="fw-semibold text-dark">{item.product_name}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-end">{formatETB(item.unit_price)}</td>
                  <td className="text-end fw-bold text-dark">{formatETB(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="row justify-content-end mb-4">
          <div className="col-sm-6 col-md-5">
            <div className="d-flex justify-content-between mb-1 small text-secondary">
              <span>Subtotal:</span>
              <span className="fw-bold text-dark">{formatETB(order.subtotal)}</span>
            </div>
            <div className="d-flex justify-content-between mb-1 small text-secondary">
              <span>VAT (15%):</span>
              <span className="fw-bold text-dark">{formatETB(order.tax)}</span>
            </div>
            <div className="d-flex justify-content-between mb-2 small text-secondary">
              <span>Delivery Fee:</span>
              <span className="fw-bold text-dark">{formatETB(order.shipping_fee)}</span>
            </div>
            <hr className="my-2" />
            <div className="d-flex justify-content-between">
              <span className="fw-bolder fs-5 text-dark">Total Paid:</span>
              <span className="fw-bolder fs-4 text-primary">{formatETB(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Verification Signoff */}
        <div className="border-top pt-4 mt-4 d-flex flex-column flex-sm-row justify-content-between align-items-center text-muted small">
          <div>
            <i className="bi bi-shield-check text-success fs-5 me-1 align-middle"></i>
            <span>Digitally verified and stamped through AI Online Selling System</span>
          </div>
          <div className="mt-2 mt-sm-0 text-center text-sm-end">
            <div className="fw-bold text-dark">Authorized Signature</div>
            <div className="text-primary font-monospace" style={{ fontSize: '0.8rem' }}>NexusStore-Verified-Electronic-Seal</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPage;
