import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 4000);
    }
  };

  return (
    <footer className="text-white pt-5 pb-4 mt-auto border-top border-slate-800" style={{ background: '#0b1a2d' }}>
      <div className="container-fluid max-w-7xl px-3 px-lg-4">
        {/* 4 Clean Columns */}
        <div className="row g-4 mb-4">
          {/* Brand & Mission */}
          <div className="col-lg-4 col-md-6">
            <div className="d-flex align-items-center gap-2 mb-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-white shadow-sm"
                style={{ width: '40px', height: '40px', background: 'var(--color-primary)' }}
              >
                <i className="bi bi-cpu-fill fs-5"></i>
              </div>
              <div className="d-flex align-items-center">
                <span className="fw-bolder fs-4 text-white tracking-tight">EthioTech</span>
                <span className="text-info fw-bolder fs-4 tracking-tight ms-1">Market</span>
              </div>
            </div>
            <p className="text-slate-300 text-xs mb-3" style={{ lineHeight: '1.7' }}>
              Better Tech. Brighter Future. Premium consumer electronics, laptops, wearables, and audio gear delivered across Ethiopia with verified Chapa checkout and official warranty coverage.
            </p>
            <div className="text-slate-400 text-xs">
              <i className="bi bi-geo-alt text-info me-1"></i> Addis Ababa, Ethiopia &bull; ETB Currency
            </div>
          </div>

          {/* Catalog Categories */}
          <div className="col-lg-2 col-md-3 col-6">
            <h6 className="text-white fw-bold mb-3 text-xs uppercase tracking-wider text-slate-300">Catalog</h6>
            <ul className="list-unstyled text-xs text-slate-400 d-flex flex-column gap-2">
              <li><Link to="/shop" className="hover:text-cyan-400 transition text-slate-400">All Products</Link></li>
              <li><Link to="/categories" className="hover:text-cyan-400 transition text-slate-400">Categories</Link></li>
              <li><Link to="/deals" className="hover:text-cyan-400 transition text-emerald-400 font-semibold"><i className="bi bi-tag-fill me-1"></i> Active Promotions</Link></li>
              <li><Link to="/shop?ordering=-created_at" className="hover:text-cyan-400 transition text-slate-400">New Arrivals</Link></li>
            </ul>
          </div>

          {/* Customer Care & Policies */}
          <div className="col-lg-3 col-md-3 col-6">
            <h6 className="text-white fw-bold mb-3 text-xs uppercase tracking-wider text-slate-300">Customer Care</h6>
            <ul className="list-unstyled text-xs text-slate-400 d-flex flex-column gap-2">
              <li><Link to="/track" className="hover:text-cyan-400 transition text-slate-400">Order Tracking</Link></li>
              <li><Link to="/returns" className="hover:text-cyan-400 transition text-slate-400">Warranty & Returns Policy</Link></li>
              <li><Link to="/shipping" className="hover:text-cyan-400 transition text-slate-400">Delivery Information</Link></li>
              <li><Link to="/faq" className="hover:text-cyan-400 transition text-slate-400">Help & FAQs</Link></li>
              <li><Link to="/contact" className="hover:text-cyan-400 transition text-slate-400">Contact Support</Link></li>
            </ul>
          </div>

          {/* Newsletter / Updates */}
          <div className="col-lg-3 col-md-6">
            <h6 className="text-white fw-bold mb-3 text-xs uppercase tracking-wider text-slate-300">Stay Updated</h6>
            <p className="text-slate-400 text-xs mb-3" style={{ lineHeight: '1.6' }}>
              Subscribe for new product launches, verified discounts, and promotional offers.
            </p>

            <form onSubmit={handleSubscribe} className="mb-3">
              <div className="input-group">
                <input
                  type="email"
                  className="form-control form-control-sm bg-slate-900 border-slate-700 text-white rounded-start-xl text-xs py-2 px-3"
                  placeholder="Your email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button className="btn btn-ethio-primary btn-sm rounded-end-3 text-xs px-3 font-bold" type="submit">
                  Subscribe
                </button>
              </div>
              {subscribed && (
                <div className="text-info text-[11px] mt-1.5 font-semibold">
                  <i className="bi bi-check-circle me-1"></i> Subscribed successfully!
                </div>
              )}
            </form>

            <div className="d-flex gap-3 text-slate-400 fs-6">
              <a href="https://t.me" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition" title="Telegram">
                <i className="bi bi-telegram"></i>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition" title="Twitter / X">
                <i className="bi bi-twitter-x"></i>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:text-pink-400 transition" title="Instagram">
                <i className="bi bi-instagram"></i>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Copyright */}
        <hr className="border-slate-800 my-4" />

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center text-slate-500 text-xs">
          <div>
            &copy; {new Date().getFullYear()} <strong className="text-slate-300">EthioTech Market</strong> &bull; All prices in Ethiopian Birr (ETB). Payments processed securely via Chapa.
          </div>
          <div className="d-flex gap-3 mt-2 mt-md-0 text-slate-400">
            <Link to="/privacy" className="hover:text-slate-300 text-decoration-none">Privacy</Link>
            <span>&bull;</span>
            <Link to="/terms" className="hover:text-slate-300 text-decoration-none">Terms</Link>
            <span>&bull;</span>
            <Link to="/about" className="hover:text-slate-300 text-decoration-none">About</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
