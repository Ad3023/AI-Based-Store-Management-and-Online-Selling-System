import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ProductCard from '../components/ProductCard';

const DealsPage = () => {
  const [dealProducts, setDealProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        setLoading(true);
        const res = await api.get('products/items/');
        const allItems = res.data.results || res.data || [];
        // Filter items with compare_at_price > price, or featured
        const discounted = allItems.filter(
          (p) => (p.compare_at_price && Number(p.compare_at_price) > Number(p.price)) || p.is_featured
        );
        setDealProducts(discounted.length > 0 ? discounted : allItems.slice(0, 8));
      } catch (err) {
        console.error('Failed to load deals', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
  }, []);

  return (
    <div className="container py-5">
      {/* Deals Hero Banner */}
      <div
        className="rounded-4 p-4 p-md-5 mb-5 text-white position-relative overflow-hidden shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #31104b 100%)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
        }}
      >
        <div className="row align-items-center position-relative z-2">
          <div className="col-lg-8">
            <span className="badge bg-danger rounded-pill px-3 py-1.5 text-xs font-bold uppercase tracking-wider mb-3">
              <i className="bi bi-fire me-1"></i> Flash Tech Deals & Special Offers
            </span>
            <h1 className="display-5 fw-bolder mb-2 tracking-tight">
              Exclusive Electronics Discounts & Price Drops
            </h1>
            <p className="text-slate-300 text-sm mb-4" style={{ maxWidth: '640px' }}>
              Save up to 25% on cutting-edge laptops, noise-canceling audio gear, smart wearables, and wireless accessories. All items come with full local warranty and verifiable bank transfer receipts.
            </p>
            <div className="d-flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
              <span className="bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-700">
                <i className="bi bi-shield-check text-cyan-400 me-1"></i> Authentic Hardware
              </span>
              <span className="bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-700">
                <i className="bi bi-truck text-emerald-400 me-1"></i> Same-Day Addis Dispatch
              </span>
              <span className="bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-700">
                <i className="bi bi-receipt text-yellow-400 me-1"></i> Official Digital Receipt
              </span>
            </div>
          </div>
          <div className="col-lg-4 text-center mt-4 mt-lg-0">
            <div className="p-4 bg-slate-900/80 rounded-3xl border border-rose-500/30 d-inline-block text-center shadow-xl">
              <span className="text-rose-400 text-xs font-bold uppercase tracking-widest d-block mb-1">Limited Stock Available</span>
              <div className="display-4 fw-bolder text-white font-mono mb-1">SALE</div>
              <small className="text-slate-400 text-[11px]">Calculated with live Ethiopian Birr exchange</small>
            </div>
          </div>
        </div>
      </div>

      {/* Deals Grid */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bolder text-slate-900 mb-0">Active Promotional Offers</h3>
          <p className="text-slate-500 text-xs mb-0">Discounts automatically applied in Ethiopian Birr (ETB)</p>
        </div>
        <Link to="/shop" className="btn btn-outline-secondary rounded-full px-4 text-xs font-bold">
          View All Products
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted small mt-2">Loading active discounts...</p>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
          {dealProducts.map((product) => (
            <div key={product.id} className="col">
              <ProductCard product={product} aiTag={product.compare_at_price ? "Special Offer" : "Trending Deal"} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DealsPage;
