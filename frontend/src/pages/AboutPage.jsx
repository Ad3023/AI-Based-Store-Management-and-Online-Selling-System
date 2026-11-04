import React from 'react';
import { Link } from 'react-router-dom';

const AboutPage = () => {
  return (
    <div className="container py-5">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-5 pb-3">
        <span className="badge bg-primary bg-opacity-10 text-primary rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider mb-3">
          <i className="bi bi-cpu-fill me-1"></i> About Ethio Tech Market
        </span>
        <h1 className="display-5 fw-bolder text-slate-900 mb-3 tracking-tight">
          Next-Generation Store Management & Online Commerce in Ethiopia
        </h1>
        <p className="text-slate-600 text-sm md:text-base" style={{ lineHeight: '1.8' }}>
          Ethio Tech Market is an enterprise-grade full-stack electronic commerce platform. It integrates Machine Learning recommendation algorithms, role-based store management, automated digital receipt generation, and verified Chapa payments to modernize online tech shopping across Ethiopia.
        </p>
      </div>

      {/* 3 Core Pillars */}
      <div className="row g-4 mb-5">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white border border-slate-100">
            <div
              className="rounded-2xl p-3 d-inline-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
              style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #0052cc, #00f2fe)' }}
            >
              <i className="bi bi-stars fs-4"></i>
            </div>
            <h5 className="fw-bolder text-slate-900 mb-2">Smart Product Discovery</h5>
            <p className="text-slate-500 text-xs mb-0" style={{ lineHeight: '1.7' }}>
              Personalized product recommendations powered by intelligent algorithms to help you discover authentic tech products, compatible accessories, and matching bundles tailored to your lifestyle.
            </p>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white border border-slate-100">
            <div
              className="rounded-2xl p-3 d-inline-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
              style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #059669, #10b981)' }}
            >
              <i className="bi bi-shield-check fs-4"></i>
            </div>
            <h5 className="fw-bolder text-slate-900 mb-2">Secure Ethiopian Payments</h5>
            <p className="text-slate-500 text-xs mb-0" style={{ lineHeight: '1.7' }}>
              Shop with total confidence using verified Chapa digital checkout, Telebirr, and direct bank transfers with instant digital receipts and payment verification.
            </p>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white border border-slate-100">
            <div
              className="rounded-2xl p-3 d-inline-flex align-items-center justify-content-center text-white mb-3 shadow-sm"
              style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              <i className="bi bi-truck fs-4"></i>
            </div>
            <h5 className="fw-bolder text-slate-900 mb-2">Nationwide Tracked Delivery</h5>
            <p className="text-slate-500 text-xs mb-0" style={{ lineHeight: '1.7' }}>
              End-to-end delivery tracking from our fulfillment center directly to your doorstep with trusted couriers, SMS and email milestones, and verified delivery.
            </p>
          </div>
        </div>
      </div>

      {/* Customer Commitment Grid */}
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 mb-5 bg-slate-900 text-white">
        <h4 className="fw-bolder mb-4 text-center">Our Commitment to Quality & Service</h4>
        <div className="row g-4 text-center">
          <div className="col-6 col-md-3">
            <div className="p-3 bg-slate-800 rounded-3xl border border-slate-700">
              <i className="bi bi-patch-check-fill text-cyan-400 fs-3 d-block mb-2"></i>
              <div className="fw-bold text-white fs-6 mb-1">100% Genuine</div>
              <small className="text-slate-400">Authentic tech from vetted suppliers</small>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-3 bg-slate-800 rounded-3xl border border-slate-700">
              <i className="bi bi-shield-lock-fill text-cyan-400 fs-3 d-block mb-2"></i>
              <div className="fw-bold text-white fs-6 mb-1">Official Warranty</div>
              <small className="text-slate-400">Full manufacturer warranty protection</small>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-3 bg-slate-800 rounded-3xl border border-slate-700">
              <i className="bi bi-lightning-charge-fill text-cyan-400 fs-3 d-block mb-2"></i>
              <div className="fw-bold text-white fs-6 mb-1">Express Dispatch</div>
              <small className="text-slate-400">Same-day and next-day processing</small>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-3 bg-slate-800 rounded-3xl border border-slate-700">
              <i className="bi bi-headset text-cyan-400 fs-3 d-block mb-2"></i>
              <div className="fw-bold text-white fs-6 mb-1">Dedicated Support</div>
              <small className="text-slate-400">Expert customer assistance 6 days a week</small>
            </div>
          </div>
        </div>
      </div>

      {/* Call to action */}
      <div className="text-center">
        <Link to="/shop" className="btn btn-primary-gradient rounded-full px-5 py-2.5 font-bold text-xs shadow-md me-2">
          Start Shopping
        </Link>
        <Link to="/contact" className="btn btn-outline-secondary rounded-full px-4 py-2.5 font-bold text-xs">
          Contact Our Team
        </Link>
      </div>
    </div>
  );
};

export default AboutPage;
