import React from 'react';
import { Link } from 'react-router-dom';

const ReturnsPage = () => {
  return (
    <div className="container py-5 max-w-4xl">
      <div className="mb-4 pb-3 border-bottom">
        <span className="badge bg-primary bg-opacity-10 text-primary rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider mb-2">
          <i className="bi bi-arrow-counterclockwise me-1"></i> Customer Protection
        </span>
        <h1 className="display-6 fw-bolder text-slate-900 mb-2">Returns & Warranty Policy</h1>
        <p className="text-slate-500 text-sm">
          Clear, transparent warranty terms, return requirements, and refund processes for Ethio Tech Market shoppers.
        </p>
      </div>

      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white mb-4">
        <div className="alert alert-info rounded-3 p-3 text-xs mb-4 d-flex align-items-center gap-2">
          <i className="bi bi-shield-check fs-5"></i>
          <div>
            <strong>7-Day Defect Replacement Guarantee:</strong> All electronics purchased from Ethio Tech Market include 7-day hassle-free replacement for factory hardware issues.
          </div>
        </div>

        <h5 className="fw-bolder text-slate-900 mb-2">1. Eligibility Criteria for Returns</h5>
        <ul className="text-slate-600 text-xs mb-4" style={{ lineHeight: '1.8' }}>
          <li>Item must be reported within 7 calendar days from the delivery date shown on your official receipt.</li>
          <li>Product must include all original packaging, manuals, accessories, power adapters, and untouched manufacturer serial tags.</li>
          <li>Physical damage, water damage, or unauthorized third-party tampering are strictly excluded from warranty coverage.</li>
        </ul>

        <h5 className="fw-bolder text-slate-900 mb-2">2. Official Digital Receipt Requirement</h5>
        <p className="text-slate-600 text-xs mb-4" style={{ lineHeight: '1.8' }}>
          To initiate a return or warranty claim, you must present your official digital receipt code (e.g. <code>RCP-XXXXXXXX-XXXX</code>). Digital receipts can be downloaded or printed anytime directly from your <Link to="/orders" className="text-primary fw-bold text-decoration-none">Orders History</Link>.
        </p>

        <h5 className="fw-bolder text-slate-900 mb-2">3. Return Inspection & Refund Process</h5>
        <p className="text-slate-600 text-xs mb-0" style={{ lineHeight: '1.8' }}>
          Once the returned item arrives at our Bole inspection facility, our technicians verify the hardware condition within 24–48 hours. Approved claims are processed via an instant replacement or direct bank refund back to your Telebirr or CBE account.
        </p>
      </div>

      <div className="text-center">
        <Link to="/contact" className="btn btn-primary rounded-full px-5 py-2.5 font-bold text-xs shadow-md">
          Initiate a Return / Contact Support
        </Link>
      </div>
    </div>
  );
};

export default ReturnsPage;
