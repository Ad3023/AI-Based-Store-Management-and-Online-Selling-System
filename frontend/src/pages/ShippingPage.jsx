import React from 'react';
import { Link } from 'react-router-dom';

const ShippingPage = () => {
  return (
    <div className="container py-5 max-w-4xl">
      <div className="mb-4 pb-3 border-bottom">
        <span className="badge bg-primary bg-opacity-10 text-primary rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider mb-2">
          <i className="bi bi-truck me-1"></i> Logistics & Delivery
        </span>
        <h1 className="display-6 fw-bolder text-slate-900 mb-2">Shipping & Delivery Policy</h1>
        <p className="text-slate-500 text-sm">
          Comprehensive shipping guidelines, delivery zones across Ethiopia, packaging standards, and tracking.
        </p>
      </div>

      <div className="row g-4 mb-5">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white border border-slate-100">
            <div className="d-flex align-items-center gap-2 mb-2 text-primary">
              <i className="bi bi-geo-alt-fill fs-5"></i>
              <h6 className="fw-bold mb-0">Addis Ababa Standard</h6>
            </div>
            <div className="display-6 fw-bolder text-slate-900 mb-1">50 <span className="text-sm font-normal text-slate-500">ETB</span></div>
            <p className="text-slate-500 text-xs mb-2">Delivery within 1-2 business days across all subcities.</p>
            <small className="text-emerald-600 font-semibold text-[11px]">&bull; Insured dispatch</small>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white border border-cyan-300 shadow-md">
            <div className="d-flex align-items-center gap-2 mb-2 text-cyan-600">
              <i className="bi bi-lightning-charge-fill fs-5"></i>
              <h6 className="fw-bold mb-0">Addis Ababa Express</h6>
            </div>
            <div className="display-6 fw-bolder text-cyan-600 mb-1">100 <span className="text-sm font-normal text-slate-500">ETB</span></div>
            <p className="text-slate-500 text-xs mb-2">Same-day delivery for orders placed and verified before 2:00 PM.</p>
            <small className="text-cyan-700 font-semibold text-[11px]">&bull; Priority courier routing</small>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white border border-slate-100">
            <div className="d-flex align-items-center gap-2 mb-2 text-purple-600">
              <i className="bi bi-signpost-2-fill fs-5"></i>
              <h6 className="fw-bold mb-0">Regional Hubs</h6>
            </div>
            <div className="display-6 fw-bolder text-slate-900 mb-1">150 <span className="text-sm font-normal text-slate-500">ETB</span></div>
            <p className="text-slate-500 text-xs mb-2">Hawassa, Adama, Bahir Dar, Dire Dawa, and regional centers (2-3 days).</p>
            <small className="text-purple-600 font-semibold text-[11px]">&bull; Regional tracking ID</small>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white mb-4">
        <h5 className="fw-bolder text-slate-900 mb-3">1. Order Processing & Verification</h5>
        <p className="text-slate-600 text-xs mb-4" style={{ lineHeight: '1.8' }}>
          Orders are prepared immediately once payment verification is approved. For payments completed via Chapa, status updates to <strong>Processing</strong> within seconds. For manual CBE or Telebirr transfers, our Store Managers verify evidence within 30–60 minutes during standard operating hours.
        </p>

        <h5 className="fw-bolder text-slate-900 mb-3">2. Packaging & Product Protection</h5>
        <p className="text-slate-600 text-xs mb-4" style={{ lineHeight: '1.8' }}>
          All high-value electronics (laptops, phones, headphones) are secured with tamper-evident security tape, anti-static bubble wrapping, and rigid protective outer cartons to ensure flawless delivery condition.
        </p>

        <h5 className="fw-bolder text-slate-900 mb-3">3. Delivery Milestone Tracking</h5>
        <p className="text-slate-600 text-xs mb-0" style={{ lineHeight: '1.8' }}>
          Each order generates an active tracking ledger accessible from our <Link to="/track" className="text-primary fw-bold text-decoration-none">Track Order</Link> page. As the courier moves through dispatch milestones (Processing &rarr; Shipped &rarr; Delivered), notifications are delivered in-app.
        </p>
      </div>
    </div>
  );
};

export default ShippingPage;
