import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const ManagerPaymentsPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [verifyingId, setVerifyingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.get('orders/');
      setOrders(res.data.results || res.data || []);
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleVerifyChapa = async (order) => {
    if (!order.chapa_reference) {
      alert('This order does not have an active Chapa transaction reference.');
      return;
    }
    try {
      setVerifyingId(order.id);
      const res = await api.post('orders/verify-chapa/', {
        tx_ref: order.chapa_reference,
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          text: `Payment verified successfully for Order #${order.id}! Status is now PAID.`,
        });
        fetchPayments();
      } else {
        setFeedback({
          type: 'warning',
          text: res.data?.message || 'Chapa reported payment is still pending or not completed.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.error || err.response?.data?.message || 'Chapa verification call failed.',
      });
    } finally {
      setVerifyingId(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filterStatus === 'PAID') return o.payment_status === 'PAID' || ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status);
    if (filterStatus === 'PENDING') return o.payment_status === 'PENDING' && o.status !== 'CANCELLED';
    if (filterStatus === 'CANCELLED') return o.status === 'CANCELLED';
    return true;
  });

  // Totals
  const totalVerifiedVolume = orders
    .filter((o) => o.payment_status === 'PAID' || ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const paidCount = orders.filter((o) => o.payment_status === 'PAID' || ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status)).length;
  const pendingCount = orders.filter((o) => o.payment_status === 'PENDING' && o.status !== 'CANCELLED').length;

  return (
    <div className="container-fluid py-4 px-lg-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h3 className="fw-bolder mb-1 text-slate-900">Chapa Payments & Transaction Ledger</h3>
          <p className="text-muted small mb-0">
            Authoritative payment verification logs, transaction references, and digital receipt reconciliation.
          </p>
        </div>
        <button onClick={fetchPayments} className="btn btn-outline-secondary rounded-pill px-3.5 btn-sm shadow-sm">
          <i className="bi bi-arrow-clockwise me-1"></i> Refresh Ledger
        </button>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 small`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.68rem' }}>
                  Verified Chapa Revenue
                </small>
                <h3 className="fw-bolder text-emerald-600 mb-0">{formatETB(totalVerifiedVolume)}</h3>
                <small className="text-muted">{paidCount} confirmed transactions</small>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '48px', height: '48px', background: '#ecfdf5', color: '#10b981' }}
              >
                <i className="bi bi-wallet2 fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.68rem' }}>
                  Pending Verifications
                </small>
                <h3 className="fw-bolder text-amber-500 mb-0">{pendingCount}</h3>
                <small className="text-muted">Awaiting customer payment completion</small>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '48px', height: '48px', background: '#fffbeb', color: '#f59e0b' }}
              >
                <i className="bi bi-hourglass-split fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.68rem' }}>
                  Configured Gateway
                </small>
                <h3 className="fw-bolder text-slate-900 mb-0">Chapa Only</h3>
                <small className="text-emerald-600 fw-semibold">
                  <i className="bi bi-shield-check me-1"></i> Official API Verification
                </small>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '48px', height: '48px', background: '#eff6ff', color: '#3b82f6' }}
              >
                <i className="bi bi-cpu fs-4"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        <div className="p-3 border-bottom bg-slate-50 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="btn-group btn-group-sm" role="group">
            <button
              type="button"
              className={`btn ${filterStatus === 'ALL' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilterStatus('ALL')}
            >
              All Orders ({orders.length})
            </button>
            <button
              type="button"
              className={`btn ${filterStatus === 'PAID' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilterStatus('PAID')}
            >
              Verified Paid ({paidCount})
            </button>
            <button
              type="button"
              className={`btn ${filterStatus === 'PENDING' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilterStatus('PENDING')}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              className={`btn ${filterStatus === 'CANCELLED' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilterStatus('CANCELLED')}
            >
              Cancelled
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted small mt-2">Loading transactions...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-5 text-muted small">No payments match the selected criteria.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-sm">
              <thead className="table-light text-slate-600 text-xs">
                <tr>
                  <th className="ps-4">Order Ref</th>
                  <th>Customer</th>
                  <th>Chapa Tx Ref</th>
                  <th>Amount (ETB)</th>
                  <th>Gateway Status</th>
                  <th>Date</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => {
                  const isPaid =
                    o.payment_status === 'PAID' || ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status);

                  return (
                    <tr key={o.id}>
                      <td className="ps-4">
                        <Link to={`/orders/${o.id}`} className="fw-bold text-decoration-none">
                          #{o.order_number || o.id}
                        </Link>
                      </td>
                      <td>
                        <div className="fw-semibold text-slate-900">{o.customer_name || 'Customer'}</div>
                        <small className="text-muted">{o.customer_email}</small>
                      </td>
                      <td>
                        {o.chapa_reference ? (
                          <code className="text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded">
                            {o.chapa_reference}
                          </code>
                        ) : (
                          <span className="text-muted text-xs">Not initiated</span>
                        )}
                      </td>
                      <td>
                        <strong className="text-slate-900">{formatETB(o.total_amount)}</strong>
                      </td>
                      <td>
                        {isPaid ? (
                          <span className="badge bg-success rounded-pill px-2.5 py-1 text-xs">
                            <i className="bi bi-check-circle-fill me-1"></i> Verified Paid
                          </span>
                        ) : o.status === 'CANCELLED' ? (
                          <span className="badge bg-danger rounded-pill px-2.5 py-1 text-xs">Cancelled</span>
                        ) : (
                          <span className="badge bg-warning text-dark rounded-pill px-2.5 py-1 text-xs">
                            Pending Payment
                          </span>
                        )}
                      </td>
                      <td>
                        <small className="text-muted">{new Date(o.created_at).toLocaleDateString()}</small>
                      </td>
                      <td className="text-end pe-4">
                        <div className="d-flex justify-content-end gap-1">
                          {!isPaid && o.chapa_reference && o.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleVerifyChapa(o)}
                              className="btn btn-sm btn-outline-primary rounded-pill px-2.5 text-xs"
                              disabled={verifyingId === o.id}
                              title="Verify payment with Chapa API"
                            >
                              {verifyingId === o.id ? 'Checking...' : 'Check Status'}
                            </button>
                          )}
                          {isPaid && (
                            <Link
                              to={`/receipts/${o.id}`}
                              className="btn btn-sm btn-outline-success rounded-pill px-2.5 text-xs"
                              title="View Digital Receipt"
                            >
                              <i className="bi bi-receipt"></i> Receipt
                            </Link>
                          )}
                          <Link
                            to={`/orders/${o.id}`}
                            className="btn btn-sm btn-light rounded-pill px-2 text-xs border"
                            title="Order Details"
                          >
                            <i className="bi bi-eye"></i>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerPaymentsPage;
