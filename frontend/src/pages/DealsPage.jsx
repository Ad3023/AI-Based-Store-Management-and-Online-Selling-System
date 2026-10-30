import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ProductCard from '../components/ProductCard';
import { cleanPromoText } from '../utils/textUtils';

const DealsPage = () => {
  const [dealProducts, setDealProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePromo, setActivePromo] = useState(null);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        setLoading(true);
        // Fetch active promotion from backend
        try {
          const promoRes = await api.get('products/promotions/active/announcement/');
          if (promoRes.data?.active) {
            setActivePromo(promoRes.data);
          } else {
            setActivePromo(null);
          }
        } catch {
          setActivePromo(null);
        }

        // Fetch catalog items to find products with genuine discounts
        const res = await api.get('products/items/');
        const allItems = res.data.results || res.data || [];
        // Genuine discounts only: authorized active admin promotions verified server-side
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

  // Promotion is active only when activePromo is truthy AND there are eligible discounted products
  const isPromoActive = Boolean(activePromo && activePromo.active && dealProducts.length > 0);

  // Authoritative promotion display strings, cleaned of any HTML entities or stray formatting
  const displayHeading = isPromoActive
    ? cleanPromoText(activePromo.title) || 'Tech Mobile Sale — Save 10%'
    : 'Authentic Tech Discounts & Genuine Store Offers';

  const displayDescription = isPromoActive
    ? cleanPromoText(activePromo.description) ||
      'Discover great deals on eligible mobile products at Ethio Tech Market. Enjoy transparent ETB pricing, secure Chapa payments, and convenient delivery from Debre Birhan.'
    : 'All discounts on Ethio Tech Market are strictly administrator-managed and verified server-side. Transparent Ethiopian Birr pricing with applicable warranty coverage and receipts.';

  const displayStatus = isPromoActive
    ? (cleanPromoText(activePromo.status_label) || 'Active Promotion')
    : 'Ethio Tech Market';

  const displayDiscountLabel = isPromoActive
    ? (cleanPromoText(activePromo.discount_label) ||
       (activePromo.discount_type === 'PERCENTAGE'
         ? `${Math.round(activePromo.discount_value)}% OFF`
         : `ETB ${activePromo.discount_value} OFF`))
    : 'DEALS';

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
            {isPromoActive ? (
              <span
                className="badge rounded-pill px-3 py-1.5 text-xs fw-bold text-uppercase d-inline-flex align-items-center gap-1.5 mb-3 shadow-sm"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  letterSpacing: '0.05em',
                }}
              >
                <i className="bi bi-patch-check-fill text-danger"></i>
                ADMIN-VERIFIED PROMOTION
              </span>
            ) : (
              <span
                className="badge rounded-pill px-3 py-1.5 text-xs fw-bold text-uppercase d-inline-flex align-items-center gap-1.5 mb-3 shadow-sm"
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  letterSpacing: '0.05em',
                }}
              >
                <i className="bi bi-tag-fill text-info"></i>
                FEATURED DEALS
              </span>
            )}

            <h1 className="display-5 fw-bolder mb-2 tracking-tight" style={{ letterSpacing: '-0.02em', lineHeight: '1.2' }}>
              {displayHeading}
            </h1>

            <p className="text-slate-300 text-sm mb-0" style={{ maxWidth: '640px', lineHeight: '1.65' }}>
              {displayDescription}
            </p>
          </div>

          <div className="col-lg-4 text-center mt-4 mt-lg-0">
            <div
              className="p-4 rounded-3xl border d-inline-block text-center shadow-xl w-100"
              style={{
                maxWidth: '280px',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                borderColor: 'rgba(244, 63, 94, 0.35)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span className="text-rose-400 text-xs fw-bold uppercase tracking-widest d-block mb-1">
                {displayStatus}
              </span>
              <div className="display-4 fw-bolder text-white font-mono mb-1">
                {displayDiscountLabel}
              </div>
              <small className="text-slate-400 text-xs d-block">
                {isPromoActive ? 'Server-Verified Discount' : 'Transparent ETB Pricing'}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Deals Grid Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bolder text-slate-900 mb-0">Active Promotional Offers</h3>
          <p className="text-slate-500 text-xs mb-0">
            {dealProducts.length} {dealProducts.length === 1 ? 'eligible product' : 'eligible products'} with server-verified discounts
          </p>
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
