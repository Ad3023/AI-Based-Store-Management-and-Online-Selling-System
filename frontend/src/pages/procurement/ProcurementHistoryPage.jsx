import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const ProcurementHistoryPage = () => {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'invoices', 'receipts'
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const [poRes, invRes] = await Promise.all([
          api.get('products/purchase-requests/'),
          api.get('products/supplier-invoices/'),
        ]);
        setOrders(poRes.data.results || poRes.data || []);
        setInvoices(invRes.data.results || invRes.data || []);
      } catch (err) {
        console.error('Failed to load procurement history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      !q ||
      o.request_number?.toLowerCase().includes(q) ||
      o.supplier_name?.toLowerCase().includes(q) ||
      o.product_name?.toLowerCase().includes(q)
    );
  });

  const filteredInvoices = invoices.filter((i) => {
    const q = search.toLowerCase();
    return (
      !q ||
      i.invoice_number?.toLowerCase().includes(q) ||
      i.supplier_name?.toLowerCase().includes(q) ||
      i.purchase_order_number?.toLowerCase().includes(q)
    );
  });

  const receivedOrders = orders.filter((o) => o.received_quantity > 0);

  return (
    <div className="pb-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border border-info border-opacity-25 bg-info bg-opacity-10">
            <i className="bi bi-clock-history text-info"></i>
            <span className="small fw-bold text-slate-800">Procurement Audit Trail</span>
          </div>
          <h2 className="fw-bolder mb-1 text-slate-900 tracking-tight">Procurement History</h2>
          <p className="text-slate-500 text-xs mb-0">
            Complete audit trail of store replenishment orders, physical goods receipts, and submitted supplier invoices.
          </p>
        </div>

        <Link
          to="/manager/procurement/purchase-orders/create"
          className="btn btn-ethio-primary rounded-pill px-4 py-2 font-bold text-xs d-flex align-items-center gap-2 shadow-sm"
          style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
        >
          <i className="bi bi-plus-lg"></i>
          <span>Create Purchase Order</span>
        </Link>
      </div>

      {/* Tabs & Search */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <input
              type="text"
              className="form-control text-xs"
              placeholder="Search history by reference, supplier, product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-7 d-flex justify-content-md-end gap-1">
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 text-xs ${activeTab === 'orders' ? 'btn-primary font-bold' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('orders')}
            >
              <i className="bi bi-cart-check me-1"></i> Purchase Orders ({orders.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 text-xs ${activeTab === 'receipts' ? 'btn-primary font-bold' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('receipts')}
            >
              <i className="bi bi-box-arrow-in-down me-1"></i> Goods Receipts ({receivedOrders.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 text-xs ${activeTab === 'invoices' ? 'btn-primary font-bold' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('invoices')}
            >
              <i className="bi bi-receipt me-1"></i> Supplier Invoices ({invoices.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content Table */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted small mt-2">Loading procurement history...</p>
          </div>
        ) : activeTab === 'orders' ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="ps-4">PO Number &amp; Date</th>
                  <th>Supplier</th>
                  <th>Replenishment Items</th>
                  <th>Total Cost</th>
                  <th>Received / Ordered</th>
                  <th>Status</th>
                  <th>Approved By</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">No purchase orders found.</td>
                  </tr>
                ) : (
                  filteredOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="ps-4">
                        <strong className="text-primary">{po.request_number}</strong>
                        <small className="text-slate-400 text-[10px] d-block">{new Date(po.created_at).toLocaleDateString()}</small>
                      </td>
                      <td>
                        <strong className="text-slate-800">{po.supplier_name}</strong>
                      </td>
                      <td>
                        {po.items?.length > 1
                          ? `${po.items.length} product lines (${po.quantity} units)`
                          : `${po.product_name || 'Product'} (${po.quantity} units)`}
                      </td>
                      <td className="fw-bolder text-slate-900">{formatETB(po.total_estimated_cost)}</td>
                      <td>
                        <span className={`fw-semibold ${po.received_quantity >= po.quantity ? 'text-success' : 'text-slate-700'}`}>
                          {po.received_quantity} / {po.quantity} pcs
                        </span>
                        {po.damaged_quantity > 0 && (
                          <small className="text-danger d-block text-[10px]">({po.damaged_quantity} damaged)</small>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-secondary">{po.status}</span>
                      </td>
                      <td className="text-slate-600">{po.approved_by_username || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'receipts' ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="ps-4">PO Reference</th>
                  <th>Supplier</th>
                  <th>Units Ordered</th>
                  <th>Units Received in Stock</th>
                  <th>Damaged Units Logged</th>
                  <th>Outstanding Remaining</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {receivedOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">No goods receipts recorded yet.</td>
                  </tr>
                ) : (
                  receivedOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="ps-4">
                        <strong className="text-primary">{po.request_number}</strong>
                      </td>
                      <td>
                        <strong className="text-slate-800">{po.supplier_name}</strong>
                      </td>
                      <td>{po.quantity} units</td>
                      <td className="fw-bold text-success">+{po.received_quantity} units added to stock</td>
                      <td className="text-danger">{po.damaged_quantity} units</td>
                      <td>
                        <span className={`badge ${po.outstanding_quantity > 0 ? 'bg-warning text-dark' : 'bg-success'}`}>
                          {po.outstanding_quantity} left
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-secondary">{po.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs">
              <thead className="table-light text-slate-500 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="ps-4">Invoice # &amp; Date</th>
                  <th>Supplier</th>
                  <th>Related PO</th>
                  <th>Total Amount</th>
                  <th>Paid Amount</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Submitted By</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4 text-muted">No invoices found.</td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="ps-4">
                        <strong className="text-slate-900">#{inv.invoice_number}</strong>
                        <small className="text-slate-400 text-[10px] d-block">{inv.invoice_date}</small>
                      </td>
                      <td>
                        <strong className="text-slate-800">{inv.supplier_name}</strong>
                      </td>
                      <td>{inv.purchase_order_number || <span className="text-slate-400">—</span>}</td>
                      <td className="fw-bold text-slate-900">{formatETB(inv.total_amount)}</td>
                      <td className="text-success">{formatETB(inv.paid_amount || 0)}</td>
                      <td>
                        <strong className={Number(inv.outstanding_amount || 0) > 0 ? 'text-danger' : 'text-success'}>
                          {formatETB(inv.outstanding_amount || 0)}
                        </strong>
                      </td>
                      <td>
                        <span className="badge bg-secondary">{inv.status_display || inv.status}</span>
                      </td>
                      <td className="text-slate-600">{inv.submitted_by_username || 'Staff'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcurementHistoryPage;
