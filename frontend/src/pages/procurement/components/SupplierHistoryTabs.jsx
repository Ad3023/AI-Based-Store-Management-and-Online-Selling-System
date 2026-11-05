import React from 'react';
import { formatETB } from '../../../utils/currency';

const SupplierHistoryTabs = ({ activeTab, data }) => {
  if (activeTab === 'products') {
    return (
      <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 text-xs">
            <thead className="table-light">
              <tr>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Warehouse Stock</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
              </tr>
            </thead>
            <tbody>
              {(!data?.products || data.products.length === 0) ? (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-muted">No products assigned to this supplier yet.</td>
                </tr>
              ) : (
                data.products.map((p) => (
                  <tr key={p.id}>
                    <td className="fw-semibold text-slate-900">{p.name}</td>
                    <td className="text-muted">{p.sku || '—'}</td>
                    <td>
                      <span className={`badge ${p.stock <= 5 ? 'bg-danger' : 'bg-success'}`}>
                        {p.stock} in stock
                      </span>
                    </td>
                    <td>{formatETB(p.cost_price)}</td>
                    <td className="fw-bold text-slate-800">{formatETB(p.price)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (activeTab === 'pos') {
    return (
      <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 text-xs">
            <thead className="table-light">
              <tr>
                <th>PO Number</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(!data?.purchase_orders || data.purchase_orders.length === 0) ? (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-muted">No purchase orders recorded for this supplier.</td>
                </tr>
              ) : (
                data.purchase_orders.map((po) => (
                  <tr key={po.id}>
                    <td className="fw-bold text-primary">{po.request_number}</td>
                    <td className="text-muted">{new Date(po.created_at).toLocaleDateString()}</td>
                    <td>{po.items?.length || 1} item(s) ({po.quantity} pcs)</td>
                    <td className="fw-bold text-slate-900">{formatETB(po.total_estimated_cost)}</td>
                    <td><span className="badge bg-secondary">{po.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (activeTab === 'invoices') {
    return (
      <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 text-xs">
            <thead className="table-light">
              <tr>
                <th>Invoice Number</th>
                <th>Date</th>
                <th>Total Amount</th>
                <th>Paid Amount</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(!data?.invoices || data.invoices.length === 0) ? (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-muted">No invoices submitted for this supplier.</td>
                </tr>
              ) : (
                data.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="fw-bold text-slate-900">#{inv.invoice_number}</td>
                    <td className="text-muted">{inv.invoice_date}</td>
                    <td className="fw-bold text-slate-800">{formatETB(inv.total_amount)}</td>
                    <td className="text-success">{formatETB(inv.paid_amount)}</td>
                    <td className="text-danger fw-bold">{formatETB(inv.outstanding_amount)}</td>
                    <td><span className="badge bg-info">{inv.status_display || inv.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 text-xs">
          <thead className="table-light">
            <tr>
              <th>Reference</th>
              <th>Payment Date</th>
              <th>Method</th>
              <th>Amount Paid</th>
              <th>Authorized By</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(!data?.payments || data.payments.length === 0) ? (
              <tr>
                <td colSpan="6" className="text-center py-4 text-muted">No disbursement records found.</td>
              </tr>
            ) : (
              data.payments.map((pay) => (
                <tr key={pay.id}>
                  <td className="fw-bold text-slate-900">{pay.transaction_reference}</td>
                  <td className="text-muted">{new Date(pay.payment_date).toLocaleDateString()}</td>
                  <td><span className="badge bg-light text-dark border">{pay.payment_method}</span></td>
                  <td className="fw-bold text-success">{formatETB(pay.amount_paid)}</td>
                  <td className="text-muted">{pay.authorized_by_username || 'Admin'}</td>
                  <td><span className="badge bg-success">{pay.payment_status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupplierHistoryTabs;

