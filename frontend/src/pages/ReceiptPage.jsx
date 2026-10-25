import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { formatETB } from '../utils/currency';

const ReceiptPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
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
        setError(err.response?.data?.error || "Receipt not found or payment is still pending verification.");
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
          <p className="text-muted small mb-4">{error || "Payment has not yet been verified by the server."}</p>
          <div className="d-flex justify-content-center gap-2">
            <Link to={`/orders/${id}`} className="btn btn-primary rounded-pill px-4">
              View Order Status
            </Link>
            <button
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/orders'))}
              className="btn btn-outline-secondary rounded-pill px-4"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { receipt, order } = data;

  return (
    <div className="container py-5">
      {/* Top Action Bar (hidden during print) */}
      <div className="d-flex justify-content-between align-items-center mb-4 no-print" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(`/orders/${order.id}`))}
          className="btn btn-outline-secondary rounded-pill px-3 btn-sm d-flex align-items-center gap-1.5"
        >
          <i className="bi bi-arrow-left"></i> Back to Order
        </button>
        <button className="btn btn-ethio-primary px-4 btn-sm fw-bold shadow-sm d-flex align-items-center gap-2" onClick={handlePrint}>
          <i className="bi bi-printer"></i> Print / Save as PDF
        </button>
      </div>

      {/* Official Receipt Paper */}
      <div className="receipt-paper" style={{ maxWidth: '720px', margin: '0 auto', background: '#fff', padding: '2.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        {/* Store Header */}
        <div className="d-flex justify-content-between align-items-start border-bottom pb-4 mb-4">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-white"
                style={{ width: '38px', height: '38px', background: 'var(--color-primary)' }}
              >
                <i className="bi bi-cpu-fill fs-5"></i>
              </div>
              <h4 className="mb-0 fw-bold text-dark">EthioTech <span className="text-primary">Market</span></h4>
            </div>
            <div className="text-muted small">Better Tech. Brighter Future.</div>
            <div className="text-muted small">TIN: 0049281729 &bull; VAT Reg: 98217381</div>
            <div className="text-muted small">Bole Sub-City, Addis Ababa, Ethiopia</div>
          </div>

          <div className="text-end">
            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-1.5 rounded-pill fw-bold mb-2 d-inline-block">
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
              Payment & Verification:
            </h6>
            <div><strong>Order No:</strong> <code>{order.order_number}</code></div>
            <div><strong>Payment Gateway:</strong> Chapa (Verified)</div>
            <div><strong>Transaction Reference:</strong> <code>{order.chapa_tx_ref || `CHAPA-TX-${order.id}`}</code></div>
            <div><strong>Status:</strong> <span className="text-success fw-bold">PAID (CONFIRMED)</span></div>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="table-responsive mb-4">
          <table className="table align-middle">
            <thead className="table-light text-uppercase text-muted" style={{ fontSize: '0.75rem' }}>
              <tr>
                <th>Item Description</th>
                <th>Warranty</th>
                <th className="text-center">Qty</th>
                <th className="text-end">Unit Price</th>
                <th className="text-end">Total</th>
              </tr>
            </thead>
            <tbody className="small">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="fw-semibold text-dark">{item.product_name}</td>
                  <td>
                    <span className="badge bg-blue-50 text-blue-700 border text-[10px] rounded-pill">
                      {item.warranty_duration_days || 7} Days
                    </span>
                  </td>
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

        {/* Official Warranty Terms & Claim Notice */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 mb-4 text-xs text-slate-600">
          <div className="fw-bold text-slate-800 mb-1">
            <i className="bi bi-shield-check text-primary me-1"></i> Warranty Guarantee & Claim Instructions:
          </div>
          <p className="mb-1" style={{ lineHeight: '1.5' }}>
            All purchased electronics are covered under their registered manufacturer and store warranty duration from the confirmed date of delivery.
            Warranty covers hardware, electrical, and component manufacturing defects. Does not cover water submersion, accidental impact, or unauthorized opening.
          </p>
          <div>
            To submit an official claim, navigate to <strong>My Orders &gt; Order Details</strong> in your customer portal and click <strong>File Warranty Claim</strong>.
          </div>
        </div>

        {/* Verification Signoff */}
        <div className="border-top pt-4 d-flex flex-column flex-sm-row justify-content-between align-items-center text-muted small">
          <div>
            <i className="bi bi-shield-check text-success fs-5 me-1 align-middle"></i>
            <span>Digitally verified and stamped by NexusStore AI & Chapa Gateway</span>
          </div>
          <div className="mt-2 mt-sm-0 text-center text-sm-end">
            <div className="fw-bold text-dark">Authorized Electronic Seal</div>
            <div className="text-primary font-monospace" style={{ fontSize: '0.75rem' }}>NEXUS-CHAPA-OFFICIAL-VERIFIED</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPage;
