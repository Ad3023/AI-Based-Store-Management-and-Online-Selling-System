import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { formatETB } from '../utils/currency';

const OrdersHistoryPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const res = await api.get('orders/');
        setOrders(res.data.results || res.data || []);
      } catch (err) {
        console.error("Orders list error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return <span className="badge badge-status-pending px-3 py-1 rounded-pill">Pending Payment</span>;
      case 'PAYMENT_SUBMITTED':
        return <span className="badge badge-status-submitted px-3 py-1 rounded-pill">Under Review</span>;
      case 'PROCESSING':
        return <span className="badge badge-status-processing px-3 py-1 rounded-pill">Payment Verified</span>;
      case 'SHIPPED':
        return <span className="badge badge-status-processing px-3 py-1 rounded-pill">Shipped</span>;
      case 'DELIVERED':
        return <span className="badge badge-status-delivered px-3 py-1 rounded-pill">Delivered</span>;
      case 'CANCELLED':
        return <span className="badge badge-status-cancelled px-3 py-1 rounded-pill">Cancelled</span>;
      default:
        return <span className="badge bg-secondary px-3 py-1 rounded-pill">{status}</span>;
    }
  };

  return (
    <div className="container py-4">
      <div className="mb-4">
        <h2 className="fw-bolder mb-1">My Orders & Purchases</h2>
        <p className="text-muted small">Track your active packages, upload payment receipts, and download invoices</p>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4 p-5 text-center">
          <i className="bi bi-bag-x fs-1 text-muted mb-3"></i>
          <h4 className="fw-bold">No Orders Placed Yet</h4>
          <p className="text-muted small mb-4">You have not placed any orders yet. Start exploring our smart tech deals!</p>
          <div>
            <Link to="/shop" className="btn btn-primary-gradient rounded-pill px-4">Browse Catalog</Link>
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm rounded-4 p-4">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light text-uppercase text-muted small" style={{ fontSize: '0.75rem' }}>
                <tr>
                  <th>Order Number</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Receipt</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="small">
                {orders.map((ord) => (
                  <tr key={ord.id}>
                    <td>
                      <Link to={`/orders/${ord.id}`} className="fw-bold text-primary text-decoration-none">
                        {ord.order_number}
                      </Link>
                    </td>
                    <td className="text-muted">{new Date(ord.created_at).toLocaleDateString()}</td>
                    <td>{ord.items?.length || 0} items</td>
                    <td className="fw-bold text-dark">{formatETB(ord.total_amount)}</td>
                    <td>{getStatusBadge(ord.status)}</td>
                    <td>
                      {ord.receipt ? (
                        <Link to={`/receipts/${ord.id}`} className="badge bg-success text-decoration-none px-2 py-1 rounded-pill">
                          <i className="bi bi-receipt me-1"></i> Ready
                        </Link>
                      ) : (
                        <span className="text-muted small">Pending approval</span>
                      )}
                    </td>
                    <td className="text-end">
                      <Link to={`/orders/${ord.id}`} className="btn btn-outline-custom btn-sm rounded-pill px-3">
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersHistoryPage;
