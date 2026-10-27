import React from 'react';

const TermsPage = () => {
  return (
    <div className="container py-5 max-w-4xl">
      <div className="mb-4 pb-3 border-bottom">
        <span className="badge bg-primary bg-opacity-10 text-primary rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider mb-2">
          <i className="bi bi-file-earmark-text-fill me-1"></i> Legal Agreements
        </span>
        <h1 className="display-6 fw-bolder text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm">
          Please read these terms carefully before placing orders or using services on Ethio Tech Market.
        </p>
      </div>

      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white mb-4">
        <h5 className="fw-bolder text-slate-900 mb-2">1. Acceptance of Terms</h5>
        <p className="text-slate-600 text-xs mb-4" style={{ lineHeight: '1.8' }}>
          By accessing Ethio Tech Market, browsing our catalog, or purchasing items, you agree to be bound by these Terms of Service. If you do not agree to any part of these terms, you should discontinue use of the platform.
        </p>

        <h5 className="fw-bolder text-slate-900 mb-2">2. Pricing & Currency</h5>
        <p className="text-slate-600 text-xs mb-4" style={{ lineHeight: '1.8' }}>
          All prices displayed across the storefront are denominated in <strong>Ethiopian Birr (ETB)</strong> and include applicable 15% Value-Added Tax (VAT). Prices are calculated and enforced server-side by Django to protect against client-side tampering.
        </p>

        <h5 className="fw-bolder text-slate-900 mb-2">3. Payment Verification & Order Fulfillment</h5>
        <p className="text-slate-600 text-xs mb-4" style={{ lineHeight: '1.8' }}>
          An order is considered confirmed only when payment is verified (either via automated Chapa server response or manual Store Manager verification). Submitting false, forged, or altered bank receipts is strictly prohibited and results in immediate account termination.
        </p>

        <h5 className="fw-bolder text-slate-900 mb-2">4. Digital Receipts as Official Invoices</h5>
        <p className="text-slate-600 text-xs mb-0" style={{ lineHeight: '1.8' }}>
          Every successfully verified order triggers an official verifiable digital receipt bearing a unique cryptographic receipt code. This receipt serves as your official proof of purchase for warranty, corporate reimbursement, and tax documentation.
        </p>
      </div>
    </div>
  );
};

export default TermsPage;
