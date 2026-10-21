import React from 'react';
import { API_BASE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';

const ManagerReportsPage = () => {
  const { token } = useAuth();

  const handleDownload = (endpoint, filename) => {
    fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Token ${token}`,
      },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => alert("Download failed: " + err.message));
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="fw-bolder mb-1 text-dark">Exportable Sales & Inventory Reports</h2>
        <p className="text-muted small">Generate and download official CSV spreadsheets for administrative accounting and auditing</p>
      </div>

      <div className="row g-4">
        {/* Sales Report Card */}
        <div className="col-md-6">
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white h-100 d-flex flex-column justify-content-between">
            <div>
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-primary mb-3"
                style={{ width: '56px', height: '56px', background: 'var(--color-primary-light)' }}
              >
                <i className="bi bi-file-earmark-spreadsheet fs-2"></i>
              </div>
              <h4 className="fw-bold mb-2">Detailed Sales & Orders Report</h4>
              <p className="text-secondary small mb-4" style={{ lineHeight: '1.6' }}>
                Exports complete order histories, customer identifiers, item counts, subtotal, 15% VAT, delivery charges,
                and total revenue figures formatted for Microsoft Excel or Google Sheets.
              </p>
            </div>

            <div>
              <button
                className="btn btn-primary-gradient rounded-pill px-4 py-3 fw-bold w-100 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                onClick={() => handleDownload('orders/analytics/export-sales/', `sales_report_${new Date().toISOString().slice(0,10)}.csv`)}
              >
                <i className="bi bi-download"></i> Download Sales CSV Report
              </button>
            </div>
          </div>
        </div>

        {/* Inventory Report Card */}
        <div className="col-md-6">
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white h-100 d-flex flex-column justify-content-between">
            <div>
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-info mb-3"
                style={{ width: '56px', height: '56px', background: '#e0f2fe' }}
              >
                <i className="bi bi-boxes fs-2"></i>
              </div>
              <h4 className="fw-bold mb-2">Inventory Valuation Report</h4>
              <p className="text-secondary small mb-4" style={{ lineHeight: '1.6' }}>
                Exports stock quantities per SKU, cost prices, retail selling prices, total valuation per product, and
                stock alert flags (In Stock, Low Stock, Out of Stock) across all categories.
              </p>
            </div>

            <div>
              <button
                className="btn btn-outline-custom rounded-pill px-4 py-3 fw-bold w-100 d-flex align-items-center justify-content-center gap-2"
                onClick={() => handleDownload('orders/analytics/export-inventory/', `inventory_report_${new Date().toISOString().slice(0,10)}.csv`)}
              >
                <i className="bi bi-download"></i> Download Inventory Valuation CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerReportsPage;
