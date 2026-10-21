import React from 'react';

const PrivacyPage = () => {
  return (
    <div className="container py-5 max-w-4xl">
      <div className="mb-4 pb-3 border-bottom">
        <span className="badge bg-primary bg-opacity-10 text-primary rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider mb-2">
          <i className="bi bi-shield-lock-fill me-1"></i> Data Protection
        </span>
        <h1 className="display-6 fw-bolder text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm">
          How NexusStore AI collects, processes, and safeguards your personal information and transaction records.
        </p>
      </div>

      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white mb-4">
        <h5 className="fw-bolder text-slate-900 mb-2">1. Information We Collect</h5>
        <p className="text-slate-600 text-xs mb-4" style={{ lineHeight: '1.8' }}>
          When you browse NexusStore AI as an anonymous guest, we do not require account creation. We only capture anonymous browsing signals (product view counts) to power non-personalized trending recommendations. When you register or place an order, we collect your name, email address, phone number, delivery address, and bank transfer reference.
        </p>

        <h5 className="fw-bolder text-slate-900 mb-2">2. Payment Confidentiality</h5>
        <p className="text-slate-600 text-xs mb-4" style={{ lineHeight: '1.8' }}>
          We never store credit card numbers or banking PINs. For online payments, transaction processing is handled directly by Chapa under PCI-DSS standards. For manual transfers, receipt screenshots are stored securely in encrypted storage accessible only to authorized Store Managers for verification purposes.
        </p>

        <h5 className="fw-bolder text-slate-900 mb-2">3. Machine Learning Usage</h5>
        <p className="text-slate-600 text-xs mb-4" style={{ lineHeight: '1.8' }}>
          Our AI recommendation engine computes item similarities using natural language metadata (TF-IDF) and aggregated order co-occurrences. We never sell, lease, or monetize your purchase history with external data brokers.
        </p>

        <h5 className="fw-bolder text-slate-900 mb-2">4. Your Data Rights</h5>
        <p className="text-slate-600 text-xs mb-0" style={{ lineHeight: '1.8' }}>
          You can inspect, update, or remove your personal profile information at any time from your account settings. For permanent account deletion or audit history queries, contact our privacy officer at <code>privacy@nexusstore.ai</code>.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPage;
