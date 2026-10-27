import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ProductCard from '../components/ProductCard';

const DealsPage = () => {
  const [dealProducts, setDealProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activePromo, setActivePromo] = useState(null);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        setLoading(true);
        // Fetch active promo
        try {
          const promoRes = await api.get('products/promotions/active/announcement/');
          if (promoRes.data?.active) {
            setActivePromo(promoRes.data);
          }
        } catch {
          // No active promo
        }

        const res = await api.get('products/items/');
        const allItems = res.data.results || res.data || [];
        // Genuine discounts only: authorized active admin promotions
        const discounted = allItems.filter(
          (p) => p.has_promotion && Number(p.current_price) < Number(p.price)
        );
        setDealProducts(discounted);
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
              <i className="bi bi-fire me-1"></i> {activePromo ? 'Admin Verified Promotion' : 'Store Promotions & Deals'}
            </span>
            <h1 className="display-5 fw-bolder mb-2 tracking-tight">
              {activePromo ? activePromo.title : 'Authentic Tech Discounts & Genuine Store Offers'}
            </h1>
            <p className="text-slate-300 text-sm mb-4" style={{ maxWidth: '640px' }}>
              {activePromo && activePromo.description
                ? activePromo.description
                : 'All discounts on EthioTech Market are strictly administrator-managed and verified server-side. Transparent Ethiopian Birr pricing with official local warranty and receipts.'}
            </p>
            <div className="d-flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
              <span className="bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-700">
                <i className="bi bi-shield-check text-cyan-400 me-1"></i> Authentic Hardware
              </span>
              <span className="bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-700">
                <i className="bi bi-truck text-emerald-400 me-1"></i> Same-Day Addis Dispatch
              </span>
              <span className="bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-700">
                <i className="bi bi-receipt text-yellow-400 me-1"></i> Verified Server-Side Pricing
              </span>
            </div>
          </div>
          <div className="col-lg-4 text-center mt-4 mt-lg-0">
            <div className="p-4 bg-slate-900/80 rounded-3xl border border-rose-500/30 d-inline-block text-center shadow-xl">
              <span className="text-rose-400 text-xs font-bold uppercase tracking-widest d-block mb-1">
                {activePromo ? 'Active Promotion' : 'EthioTech Market'}
              </span>
              <div className="display-4 fw-bolder text-white font-mono mb-1">
                {activePromo && activePromo.discount_type === 'PERCENTAGE'
                  ? `-${Math.round(activePromo.discount_value)}%`
                  : activePromo && activePromo.discount_type === 'FIXED_AMOUNT'
                  ? `-${Number(activePromo.discount_value).toLocaleString()} ETB`
                  : 'DEALS'}
              </div>
              <small className="text-slate-400 text-[11px]">
                {activePromo?.banner_announcement || 'Prices automatically calculated in ETB'}
              </small>
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
      ) : dealProducts.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white border border-slate-200">
          <i className="bi bi-tag text-slate-400 fs-1 mb-2"></i>
          <h5 className="fw-bold text-slate-800">No Active Promotional Discounts</h5>
          <p className="text-muted text-xs mb-3" style={{ maxWidth: '480px', margin: '0 auto' }}>
            All products are currently listed at authentic everyday Ethiopian Birr prices. When store administrators configure seasonal promotions or flash sales, they will be listed here.
          </p>
          <div>
            <Link to="/shop" className="btn btn-primary-gradient rounded-pill px-4 text-xs font-bold">
              Browse Full Catalog
            </Link>
          </div>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
          {dealProducts.map((product) => (
            <div key={product.id} className="col">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DealsPage;
