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
    <footer className="text-white pt-5 pb-4 mt-auto border-top border-slate-800" style={{ background: '#040814' }}>
      <div className="container">
        {/* Top Badges Bar: Verified Payment & Delivery (Screenshot 3 Inspiration) */}
        <div className="p-4 rounded-3xl mb-5 border border-slate-800/80" style={{ background: '#080f24' }}>
          <div className="row g-4 align-items-center">
            {/* Payment Partners */}
            <div className="col-lg-7">
              <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2.5">
                <i className="bi bi-shield-check text-cyan-400 me-1"></i> Verified Ethiopian Payment Partners
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <span className="badge bg-slate-900 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold">
                  Commercial Bank of Ethiopia (CBE)
                </span>
                <span className="badge bg-slate-900 text-cyan-300 border border-cyan-500/40 px-3 py-2 rounded-xl text-xs font-semibold">
                  Telebirr SuperApp
                </span>
                <span className="badge bg-slate-900 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold">
                  Awash Bank
                </span>
                <span className="badge bg-slate-900 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold">
                  Bank of Abyssinia
                </span>
                <span className="badge bg-slate-900 text-slate-400 border border-slate-800 px-2.5 py-2 rounded-xl text-xs font-mono">
                  VISA / MC
                </span>
              </div>
            </div>

            {/* Regional Delivery */}
            <div className="col-lg-5">
              <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2.5">
                <i className="bi bi-truck text-cyan-400 me-1"></i> Regional Express Delivery
              </div>
              <p className="text-slate-400 text-xs mb-0" style={{ lineHeight: '1.6' }}>
                Fast dispatch across Addis Ababa (same-day/next-day) & insured shipping to Hawassa, Adama, Bahir Dar, and regional hubs.
              </p>
            </div>
          </div>
        </div>

        {/* 5 Main Columns */}
        <div className="row g-4 mb-4">
          {/* Brand & Mission */}
          <div className="col-lg-3 col-md-6">
            <div className="d-flex align-items-center gap-2 mb-3">
              <div
                className="rounded-xl d-flex align-items-center justify-content-center text-white shadow-sm"
                style={{ width: '40px', height: '40px', background: 'var(--gradient-primary)' }}
              >
                <i className="bi bi-cpu-fill fs-5"></i>
              </div>
              <div className="d-flex align-items-center">
                <span className="fw-bolder fs-4 text-white tracking-tight">Nexus</span>
                <span className="text-primary fw-bolder fs-4 tracking-tight">Store</span>
                <span className="badge bg-slate-800 text-cyan-400 ms-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border border-cyan-500/30">
                  AI
                </span>
              </div>
            </div>
            <p className="text-slate-400 text-xs mb-3" style={{ lineHeight: '1.7' }}>
              Enterprise-grade electronics store powered by Scikit-learn TF-IDF content similarity, order item co-occurrence, and K-Means customer RFM segmentation with verified bank receipt workflows.
            </p>
            <div className="d-flex flex-wrap gap-1.5 mb-3">
              <span className="badge bg-slate-900 text-slate-300 border border-slate-800 text-[10px]">Django REST 5.2</span>
              <span className="badge bg-slate-900 text-slate-300 border border-slate-800 text-[10px]">React 19 + Vite</span>
              <span className="badge bg-slate-900 text-slate-300 border border-slate-800 text-[10px]">PostgreSQL 18</span>
              <span className="badge bg-slate-900 text-cyan-400 border border-cyan-500/30 text-[10px]">Scikit-learn AI</span>
            </div>
          </div>

          {/* Catalog Categories */}
          <div className="col-lg-2 col-md-3 col-6">
            <h6 className="text-white fw-bold mb-3 text-xs uppercase tracking-wider text-slate-300">Explore Catalog</h6>
            <ul className="list-unstyled text-xs text-slate-400 d-flex flex-column gap-2">
              <li><Link to="/shop" className="hover:text-cyan-400 transition text-slate-400">All Products</Link></li>
              <li><Link to="/categories" className="hover:text-cyan-400 transition text-slate-400">Categories Directory</Link></li>
              <li><Link to="/deals" className="hover:text-cyan-400 transition text-emerald-400 font-semibold"><i className="bi bi-tag-fill me-1"></i> Special Deals & Offers</Link></li>
              <li><Link to="/shop?category=1" className="hover:text-cyan-400 transition text-slate-400">Smartphones & Tablets</Link></li>
              <li><Link to="/shop?category=2" className="hover:text-cyan-400 transition text-slate-400">Laptops & Computers</Link></li>
              <li><Link to="/shop?category=3" className="hover:text-cyan-400 transition text-slate-400">Audio & Headphones</Link></li>
            </ul>
          </div>

          {/* Company & Support */}
          <div className="col-lg-2 col-md-3 col-6">
            <h6 className="text-white fw-bold mb-3 text-xs uppercase tracking-wider text-slate-300">About & Support</h6>
            <ul className="list-unstyled text-xs text-slate-400 d-flex flex-column gap-2">
              <li><Link to="/about" className="hover:text-cyan-400 transition text-slate-400">About NexusStore AI</Link></li>
              <li><Link to="/contact" className="hover:text-cyan-400 transition text-slate-400">Contact & Support</Link></li>
              <li><Link to="/faq" className="hover:text-cyan-400 transition text-slate-400">Help & FAQs</Link></li>
              <li><Link to="/shipping" className="hover:text-cyan-400 transition text-slate-400">Shipping Policy & Fees</Link></li>
              <li><Link to="/returns" className="hover:text-cyan-400 transition text-slate-400">Returns & Warranty</Link></li>
              <li><Link to="/privacy" className="hover:text-cyan-400 transition text-slate-400">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-cyan-400 transition text-slate-400">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Quick Links & Portals */}
          <div className="col-lg-2 col-md-4 col-6">
            <h6 className="text-white fw-bold mb-3 text-xs uppercase tracking-wider text-slate-300">System Portals</h6>
            <ul className="list-unstyled text-xs text-slate-400 d-flex flex-column gap-2">
              <li>
                <Link to="/recommendations" className="hover:text-cyan-400 transition text-cyan-300 d-flex align-items-center gap-1.5 font-medium">
                  <i className="bi bi-stars text-cyan-400"></i> AI Recommendations
                </Link>
              </li>
              <li>
                <Link to="/track" className="hover:text-cyan-400 transition text-slate-400 d-flex align-items-center gap-1.5">
                  <i className="bi bi-truck text-slate-500"></i> Track Active Order
                </Link>
              </li>
              <li>
                <Link to="/wishlist" className="hover:text-cyan-400 transition text-slate-400 d-flex align-items-center gap-1.5">
                  <i className="bi bi-heart text-slate-500"></i> Saved Wishlist
                </Link>
              </li>
              <li>
                <Link to="/manager" className="hover:text-cyan-400 transition text-slate-300 d-flex align-items-center gap-1.5 font-semibold">
                  <i className="bi bi-speedometer2 text-cyan-400"></i> Store Manager Portal
                </Link>
              </li>
              <li>
                <Link to="/manager/segmentation" className="hover:text-cyan-400 transition text-slate-400 d-flex align-items-center gap-1.5">
                  <i className="bi bi-pie-chart text-slate-500"></i> Customer Segments
                </Link>
              </li>
              <li>
                <Link to="/manager/admin/users" className="hover:text-cyan-400 transition text-slate-400 d-flex align-items-center gap-1.5">
                  <i className="bi bi-shield-lock text-slate-500"></i> Security & Audit Ledger
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Signup (Screenshot 3 Inspiration) */}
          <div className="col-lg-3 col-md-8">
            <h6 className="text-white fw-bold mb-3 text-xs uppercase tracking-wider text-slate-300">Stay Updated</h6>
            <p className="text-slate-400 text-xs mb-3" style={{ lineHeight: '1.6' }}>
              Subscribe to receive weekly AI tech drops, new arrivals, and special member discounts in Addis Ababa.
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
                <button className="btn btn-cyan-glow btn-sm rounded-end-xl text-xs px-3 font-bold" type="submit">
                  Subscribe
                </button>
              </div>
              {subscribed && (
                <div className="text-cyan-400 text-[11px] mt-1.5 font-semibold">
                  <i className="bi bi-check-circle me-1"></i> Thank you for subscribing to NexusStore AI!
                </div>
              )}
            </form>

            <div className="d-flex gap-3 text-slate-400 fs-6">
              <a href="https://t.me" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition" title="Telegram">
                <i className="bi bi-telegram"></i>
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" className="hover:text-rose-500 transition" title="YouTube">
                <i className="bi bi-youtube"></i>
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

        {/* Bottom Copyright & Accreditation */}
        <hr className="border-slate-800 my-4" />

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center text-slate-500 text-xs">
          <div>
            &copy; {new Date().getFullYear()} <strong className="text-slate-300">NexusStore AI</strong> &bull; AI-Based Store Management & Online Selling System. All prices in Ethiopian Birr (ETB).
          </div>
          <div className="d-flex gap-3 mt-2 mt-md-0 text-slate-400">
            <span>Information Systems Senior Capstone</span>
            <span>&bull;</span>
            <span className="text-cyan-400">PostgreSQL & Scikit-learn Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
