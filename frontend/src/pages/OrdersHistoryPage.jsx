import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { formatETB } from '../utils/currency';
import { getPaymentStatusInfo, getFulfillmentStatusInfo } from '../utils/orderStatus';

const OrdersHistoryPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const res = await api.get('orders/');
        setOrders(res.data.results || res.data || []);
      } catch (err) {
        console.error('Orders list error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  return (
    <div className="container py-4 min-w-0" style={{ maxWidth: '1140px' }}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h2 className="fw-bolder text-slate-900 mb-1">My Orders & Purchases</h2>
          <p className="text-muted small mb-0">Track real-time order progression, payment confirmations, and digital receipts</p>
        </div>
        <Link to="/track" className="btn btn-outline-custom btn-sm rounded-pill px-3 shadow-sm">
          <i className="bi bi-geo-alt me-1"></i> Track Order
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted text-xs mt-2">Loading your orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white border border-slate-200">
          <i className="bi bi-bag-x fs-1 text-muted mb-3"></i>
          <h4 className="fw-bold text-slate-800">No Orders Placed Yet</h4>
          <p className="text-muted small mb-4">You have not placed any orders yet. Discover our top-rated electronics!</p>
          <div>
            <Link to="/shop" className="btn btn-primary-gradient rounded-pill px-4 font-bold text-xs">Browse Catalog</Link>
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border border-slate-200">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light text-uppercase text-slate-500 text-[11px]">
                <tr>
                  <th>Order Number</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total Amount</th>
                  <th>Payment Status</th>
                  <th>Order Status</th>
                  <th>Receipt</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {orders.map((ord) => {
                  const paymentInfo = getPaymentStatusInfo(ord);
                  const fulfillmentInfo = getFulfillmentStatusInfo(ord);
                  const hasReceipt = Boolean(ord.receipt && ord.receipt.receipt_number);

                  return (
                    <tr key={ord.id}>
                      <td>
                        <Link to={`/orders/${ord.id}`} className="fw-bold text-primary text-decoration-none font-monospace">
                          {ord.order_number}
                        </Link>
                      </td>
                      <td className="text-slate-500">{new Date(ord.created_at).toLocaleDateString()}</td>
                      <td className="text-slate-700">{ord.items?.length || 0} items</td>
                      <td className="fw-bold text-slate-900">{formatETB(ord.total_amount)}</td>
                      <td>
                        <span className={`badge rounded-pill px-2.5 py-1 text-[10px] font-bold ${paymentInfo.badgeClass}`}>
                          {paymentInfo.label}
                        </span>
                      </td>
                      <td>
                        <span className={`badge rounded-pill px-2.5 py-1 text-[10px] font-bold ${fulfillmentInfo.badgeClass}`}>
                          {fulfillmentInfo.label}
                        </span>
                      </td>
                      <td>
                        {hasReceipt ? (
                          <Link to={`/receipts/${ord.id}`} className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 text-decoration-none px-2.5 py-1 rounded-pill font-bold text-[10px]">
                            <i className="bi bi-receipt me-1"></i> Ready
                          </Link>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Pending verification</span>
                        )}
                      </td>
                      <td className="text-end">
                        <Link to={`/orders/${ord.id}`} className="btn btn-outline-custom btn-sm rounded-pill px-3 py-1 text-xs">
                          Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersHistoryPage;
