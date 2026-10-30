import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const HomePage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Data states
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [specialOffers, setSpecialOffers] = useState([]);
  const [activePromotion, setActivePromotion] = useState(null);
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);

  // Active Category Filter
  const [activeCategory, setActiveCategory] = useState('All');

  const CATEGORY_ITEMS = [
    { key: 'catLaptops', name: t('catLaptops', 'Laptops'), icon: 'bi-laptop', filter: 'laptop' },
    { key: 'catSmartphones', name: t('catSmartphones', 'Smartphones'), icon: 'bi-phone', filter: 'smartphone' },
    { key: 'catAccessories', name: t('catAccessories', 'Accessories'), icon: 'bi-mouse', filter: 'accessory' },
    { key: 'catAudio', name: t('catAudio', 'Audio'), icon: 'bi-headphones', filter: 'audio' },
    { key: 'catWearables', name: t('catWearables', 'Wearables'), icon: 'bi-smartwatch', filter: 'wearable' },
    { key: 'catTablets', name: t('catTablets', 'Tablets'), icon: 'bi-tablet', filter: 'tablet' },
  ];

  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async () => {
      try {
        setLoading(true);

        // Fetch promo announcement if configured on backend
        try {
          const promoRes = await api.get('products/promotions/active/announcement/');
          if (isMounted && promoRes.data?.active) {
            setActivePromotion(promoRes.data);
            if (promoRes.data.banner_announcement) {
              setAnnouncement(promoRes.data.banner_announcement);
            }
          }
        } catch {
          // No active promo announcement
        }

        // Fetch catalog products
        const prodRes = await api.get('products/items/?limit=24');

        if (isMounted) {
          const allList = prodRes.data.results || prodRes.data || [];
          setFeaturedProducts(allList);

          // Find items with genuine discount (authorized active admin promotion only)
          const offers = allList.filter(
            (p) => p.has_promotion && Number(p.current_price) < Number(p.price)
          );
          setSpecialOffers(offers);
        }

        // Fetch AI recommendations (Personalized for logged in users, Trending for guests)
        if (user) {
          try {
            const recRes = await api.get('recommendations/personalized/?limit=4');
            if (isMounted && recRes.data.results?.length > 0) {
              setAiRecommendations(recRes.data.results);
            }
          } catch {
            // fallback
          }
        } else {
          try {
            const trendRes = await api.get('recommendations/trending/?limit=4');
            if (isMounted && trendRes.data.results?.length > 0) {
              setAiRecommendations(trendRes.data.results);
            }
          } catch {
            // fallback
          }
        }
      } catch (err) {
        console.error('Error fetching home data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHomeData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Filter products by selected category pill
  const filteredProducts = activeCategory === 'All'
    ? featuredProducts
    : featuredProducts.filter((p) => {
        const catName = (p.category_name || p.category?.name || '').toLowerCase();
        const prodName = (p.name || '').toLowerCase();
        const target = activeCategory.toLowerCase();
        return catName.includes(target) || prodName.includes(target);
      });

  // Server-verified promotion checks: strictly validated on Django backend
  const isMobile10PercentPromo = Boolean(
    activePromotion?.active &&
    (Number(activePromotion.discount_value) === 10 ||
      activePromotion.title?.toLowerCase().includes('10%'))
  );

  const eligibleMobileOffers = specialOffers.filter((p) => {
    const cat = (p.category_name || p.category?.name || '').toLowerCase();
    return cat.includes('smartphone') || cat.includes('mobile') || cat.includes('tablet');
  });

  const displayOffers = isMobile10PercentPromo && eligibleMobileOffers.length > 0
    ? eligibleMobileOffers
    : specialOffers;

  return (
    <div style={{ backgroundColor: '#f4f6fa', minHeight: '100%', width: '100%' }}>
      
      {/* 1. Dismissible Promotional Announcement Banner */}
      {announcement && (
        <div
          className="py-2 px-3 text-white text-center text-xs fw-semibold border-bottom"
          style={{ backgroundColor: '#0c1e33', borderColor: 'rgba(255, 255, 255, 0.12)' }}
        >
          <div className="container-fluid max-w-7xl d-flex align-items-center justify-content-between">
            <div className="mx-auto d-flex align-items-center gap-2">
              <span className="badge rounded-pill px-2.5 py-0.5 text-white fw-bold" style={{ backgroundColor: '#1b64da' }}>
                {t('specialOffers', 'SPECIAL OFFER')}
              </span>
              <span>{announcement}</span>
            </div>
            <button
              type="button"
              className="btn btn-sm text-white p-0 border-0 d-flex align-items-center justify-content-center"
              style={{ width: '22px', height: '22px', opacity: 0.8 }}
              onClick={() => setAnnouncement(null)}
              aria-label="Dismiss announcement"
            >
              <i className="bi bi-x-lg" style={{ fontSize: '0.75rem' }}></i>
            </button>
          </div>
        </div>
      )}

      {/* 2. Responsive Hero Section (Optimized for all screen sizes) */}
      <section className="py-3 py-md-4 px-3 px-lg-4">
        <div className="container-fluid max-w-7xl">
          <div
            className="p-4 p-md-5 rounded-4 position-relative overflow-hidden text-white"
            style={{
              background: 'linear-gradient(135deg, #0b1a2d 0%, #0d2847 60%, #081525 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 12px 30px rgba(11, 26, 45, 0.25)',
            }}
          >
            <div className="row align-items-center g-4">
              {/* Hero Left Content */}
              <div className="col-lg-7 text-center text-lg-start">
                <span
                  className="badge rounded-pill px-3 py-1.5 text-xs fw-bold text-uppercase mb-3 d-inline-flex align-items-center gap-1.5"
                  style={{ backgroundColor: 'rgba(27, 100, 218, 0.25)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)' }}
                >
                  <i className="bi bi-shield-check"></i> {t('heroBadge', 'Genuine Electronics & Verified Delivery')}
                </span>
                
                <h1 className="display-6 display-md-5 fw-bolder mb-3 text-white tracking-tight" style={{ lineHeight: '1.25' }}>
                  {t('heroTitle1', 'Discover the Latest Tech')} <br />
                  <span style={{ color: '#60a5fa' }}>{t('heroTitle2', 'for a Smarter You')}</span>
                </h1>
                
                <p className="text-slate-300 text-xs text-md-sm mb-4 mx-auto mx-lg-0" style={{ maxWidth: '520px', lineHeight: '1.7' }}>
                  {t('heroDesc', 'High-quality electronics, competitive ETB prices, and prompt delivery across Ethiopia. Powered by AI recommendations and secure Chapa checkout.')}
                </p>

                <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start gap-2.5">
                  <a
                    href="#featured-catalog"
                    className="btn btn-ethio-primary px-4 py-2.5 rounded-pill font-bold text-xs text-md-sm shadow-md d-inline-flex align-items-center gap-1.5"
                    style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
                  >
                    <span>{t('shopNow', 'Shop Now')}</span>
                    <i className="bi bi-arrow-down"></i>
                  </a>
                  <Link
                    to="/shop"
                    className="btn btn-outline-light px-4 py-2.5 rounded-pill font-semibold text-xs text-md-sm"
                  >
                    {t('viewAllProducts', 'View All Products')}
                  </Link>
                </div>
              </div>

              {/* Hero Right Visual: Responsive Electronics Display */}
              <div className="col-lg-5 text-center position-relative">
                <div
                  className="p-2 p-md-3 rounded-4 d-inline-block position-relative"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(27, 100, 218, 0.3) 0%, rgba(11, 26, 45, 0) 70%)',
                  }}
                >
                  <img
                    src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80"
                    alt="Ethio Tech Electronics"
                    className="img-fluid rounded-4 shadow-lg"
                    style={{
                      maxHeight: '260px',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 15px 25px rgba(0, 0, 0, 0.45))',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Category Navigation Row (Responsive Grid with Consistent Sizing) */}
      <section className="py-2 px-3 px-lg-4 mb-3">
        <div className="container-fluid max-w-7xl">
          <div className="row g-2 g-md-2.5">
            {CATEGORY_ITEMS.map((cat) => {
              const isSelected = activeCategory.toLowerCase() === cat.filter.toLowerCase();
              return (
                <div key={cat.key} className="col-4 col-sm-4 col-md-2">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(isSelected ? 'All' : cat.filter)}
                    className="w-100 p-2.5 p-md-3 rounded-3 text-center border transition d-flex flex-column align-items-center justify-content-center"
                    style={{
                      backgroundColor: isSelected ? '#1b64da' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#0f172a',
                      borderColor: isSelected ? '#1b64da' : '#e2e8f0',
                      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
                      cursor: 'pointer',
                      minHeight: '82px',
                    }}
                  >
                    <i className={`bi ${cat.icon} fs-4 mb-1 ${isSelected ? 'text-white' : 'text-primary'}`}></i>
                    <span className="text-xs fw-bold text-truncate w-100">{cat.name}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Featured Products Catalog */}
      <section id="featured-catalog" className="py-3 px-3 px-lg-4 mb-4">
        <div className="container-fluid max-w-7xl">
          
          {/* Section Header */}
          <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
            <div>
              <h4 className="fw-bolder text-slate-900 mb-0" style={{ letterSpacing: '-0.02em' }}>
                {t('featuredProducts', 'Featured Products')}
              </h4>
              <p className="text-muted text-xs mb-0">
                {activeCategory !== 'All'
                  ? `${t('categories', 'Category')}: ${activeCategory}`
                  : t('featuredSubtitle', 'Top picks from genuine brands across Ethiopia')}
              </p>
            </div>

            <div className="d-flex align-items-center gap-2">
              {activeCategory !== 'All' && (
                <button
                  className="btn btn-sm btn-link text-primary p-0 text-decoration-none text-xs fw-semibold"
                  onClick={() => setActiveCategory('All')}
                >
                  {t('clearFilter', 'Clear filter')}
                </button>
              )}
              <Link to="/shop" className="text-primary text-xs fw-bold text-decoration-none d-flex align-items-center gap-1">
                {t('allProducts', 'View All')} <i className="bi bi-arrow-right"></i>
              </Link>
            </div>
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="text-muted text-xs mt-2">Loading catalog products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="card ethio-card text-center p-5 bg-white border border-slate-200 rounded-4">
              <i className="bi bi-box-seam fs-1 text-muted mb-2"></i>
              <h6 className="fw-bold text-slate-800">No products found in this category</h6>
              <p className="text-muted text-xs">Try selecting a different category or browsing our full shop catalog.</p>
              <div>
                <button className="btn btn-sm btn-ethio-primary rounded-pill px-4" onClick={() => setActiveCategory('All')}>
                  {t('allProducts', 'Show All Products')}
                </button>
              </div>
            </div>
          ) : (
            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3 g-md-4">
              {filteredProducts.map((product) => (
                <div key={product.id} className="col">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* 5. Special Promotional Discounts: Tech Mobile Sale */}
      {displayOffers.length > 0 && (
        <section className="py-3 py-md-4 px-3 px-lg-4 mb-4">
          <div className="container-fluid max-w-7xl">
            {isMobile10PercentPromo && eligibleMobileOffers.length > 0 ? (
              /* Polished modern e-commerce promotional banner */
              <div
                className="card ethio-card border-0 rounded-4 overflow-hidden mb-4 text-white position-relative"
                style={{
                  background: 'linear-gradient(135deg, #0b1a2d 0%, #0d2745 55%, #133963 100%)',
                  boxShadow: '0 12px 28px -6px rgba(11, 26, 45, 0.28)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                {/* Subtle decorative background circle */}
                <div
                  className="position-absolute end-0 top-0 w-50 h-100 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle at 80% 30%, rgba(56, 189, 248, 0.12) 0%, transparent 60%)',
                  }}
                />

                <div className="card-body p-4 p-md-5 position-relative z-1">
                  <div className="row align-items-center g-4">
                    <div className="col-lg-8">
                      {/* Badge: ADMIN-VERIFIED OFFER */}
                      <div className="mb-2.5">
                        <span
                          className="badge rounded-pill px-3 py-1.5 text-xs fw-bold text-uppercase d-inline-flex align-items-center gap-1.5 shadow-sm"
                          style={{
                            backgroundColor: 'rgba(56, 189, 248, 0.18)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            letterSpacing: '0.05em',
                          }}
                        >
                          <i className="bi bi-patch-check-fill text-info"></i>
                          ADMIN-VERIFIED OFFER
                        </span>
                      </div>

                      {/* Heading: Tech Mobile Sale — Save 10% */}
                      <h2
                        className="display-6 fw-bolder mb-2.5 text-white tracking-tight"
                        style={{ letterSpacing: '-0.02em', lineHeight: '1.25' }}
                      >
                        Tech Mobile Sale — <span style={{ color: '#60a5fa' }}>Save 10%</span>
                      </h2>

                      {/* Description */}
                      <p
                        className="text-slate-300 text-xs text-md-sm mb-3.5"
                        style={{ maxWidth: '640px', lineHeight: '1.65' }}
                      >
                        Discover great deals on eligible mobile products at Ethio Tech Market. Enjoy transparent Ethiopian Birr (ETB) pricing, secure Chapa payments, and convenient delivery from Debre Birhan.
                      </p>

                      {/* Supporting text: Trusted Shopping · Smart Savings · Secure Checkout */}
                      <div className="d-flex flex-wrap align-items-center gap-2 text-xs fw-semibold text-slate-300 pt-1">
                        <span className="d-inline-flex align-items-center gap-1.5 bg-white bg-opacity-10 px-2.5 py-1 rounded-pill">
                          <i className="bi bi-shield-check text-success"></i>
                          Trusted Shopping
                        </span>
                        <span className="text-slate-400 opacity-60">·</span>
                        <span className="d-inline-flex align-items-center gap-1.5 bg-white bg-opacity-10 px-2.5 py-1 rounded-pill">
                          <i className="bi bi-tag-fill" style={{ color: '#93c5fd' }}></i>
                          Smart Savings
                        </span>
                        <span className="text-slate-400 opacity-60">·</span>
                        <span className="d-inline-flex align-items-center gap-1.5 bg-white bg-opacity-10 px-2.5 py-1 rounded-pill">
                          <i className="bi bi-credit-card-2-front text-info"></i>
                          Secure Checkout
                        </span>
                      </div>
                    </div>

                    {/* Right Callout / Discount Pill */}
                    <div className="col-lg-4 text-start text-lg-end d-flex flex-column align-items-start align-items-lg-end justify-content-center">
                      <div
                        className="p-3.5 px-4 rounded-4 text-center d-inline-block shadow-sm"
                        style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.65)',
                          border: '1px solid rgba(96, 165, 250, 0.28)',
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        <span className="text-xs fw-bold text-uppercase tracking-wider d-block text-slate-300 mb-1">
                          Server-Verified Discount
                        </span>
                        <span className="display-5 fw-black text-white font-monospace d-block lh-1 mb-1">
                          -10%
                        </span>
                        <small className="text-slate-400 text-xs">
                          Validated in Ethiopian Birr
                        </small>
                      </div>

                      <div className="mt-3">
                        <Link
                          to="/deals"
                          className="btn btn-sm btn-outline-light rounded-pill px-3.5 py-1.5 text-xs fw-semibold d-inline-flex align-items-center gap-1.5"
                        >
                          <span>Explore All Deals</span>
                          <i className="bi bi-arrow-right"></i>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                <div>
                  <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-20 rounded-pill px-3 py-1 text-xs fw-bold uppercase tracking-wider mb-1">
                    <i className="bi bi-tag-fill me-1"></i> {t('specialOffers', 'Special Offers')}
                  </span>
                  <h4 className="fw-bolder text-slate-900 mb-0">{t('discountsPromotions', 'Discounts & Promotions')}</h4>
                </div>
                <Link to="/deals" className="text-primary text-xs fw-bold text-decoration-none">
                  {t('allDeals', 'All Deals')} &rarr;
                </Link>
              </div>
            )}

            {/* Products Grid */}
            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3 g-md-4">
              {displayOffers.slice(0, 4).map((p) => (
                <div key={`offer-${p.id}`} className="col">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. AI Recommended Picks */}
      {aiRecommendations.length > 0 && (
        <section className="py-3 px-3 px-lg-4 mb-4">
          <div className="container-fluid max-w-7xl">
            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
              <div>
                <span className="badge rounded-pill px-2.5 py-1 text-xs fw-bold mb-1" style={{ backgroundColor: '#eff6ff', color: '#1b64da', border: '1px solid #bfdbfe' }}>
                  <i className="bi bi-stars me-1"></i> {t('aiPoweredRecommendations', 'AI Powered Recommendations')}
                </span>
                <h4 className="fw-bolder text-slate-900 mb-0">{t('recommendedForYou', 'Recommended for You')}</h4>
              </div>
              <Link to="/recommendations" className="text-primary text-xs fw-bold text-decoration-none">
                {t('moreAiPicks', 'More AI Picks')} &rarr;
              </Link>
            </div>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-3">
              {aiRecommendations.slice(0, 4).map((p) => (
                <div key={`rec-${p.id}`} className="col">
                  <ProductCard product={p} aiTag="AI Pick" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 7. Value Propositions: Accurate, Verified Store Features */}
      <section className="py-4 px-3 px-lg-4 pb-5">
        <div className="container-fluid max-w-7xl">
          <div className="row g-3">
            <div className="col-md-4">
              <div className="card ethio-card border-0 shadow-sm rounded-4 p-3.5 d-flex flex-row align-items-center gap-3 bg-white border border-slate-200 h-100">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                  style={{ width: '44px', height: '44px', backgroundColor: '#1b64da' }}
                >
                  <i className="bi bi-shield-check fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold text-slate-900 mb-0 text-sm">{t('warrantyProtection', 'Store Warranty Protection')}</h6>
                  <p className="text-muted text-xs mb-0 mt-0.5">{t('warrantyDesc', 'Hardware warranty coverage with digital claim submissions on verified orders.')}</p>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card ethio-card border-0 shadow-sm rounded-4 p-3.5 d-flex flex-row align-items-center gap-3 bg-white border border-slate-200 h-100">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                  style={{ width: '44px', height: '44px', backgroundColor: '#10b981' }}
                >
                  <i className="bi bi-credit-card-2-front fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold text-slate-900 mb-0 text-sm">{t('chapaPayments', 'Chapa Verified Payments')}</h6>
                  <p className="text-muted text-xs mb-0 mt-0.5">{t('chapaDesc', 'Instant checkout via Telebirr, CBE Birr, Awash, and debit cards in ETB.')}</p>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card ethio-card border-0 shadow-sm rounded-4 p-3.5 d-flex flex-row align-items-center gap-3 bg-white border border-slate-200 h-100">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                  style={{ width: '44px', height: '44px', backgroundColor: '#f59e0b' }}
                >
                  <i className="bi bi-truck fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold text-slate-900 mb-0 text-sm">{t('nationwideDispatch', 'Nationwide Delivery')}</h6>
                  <p className="text-muted text-xs mb-0 mt-0.5">{t('nationwideDesc', 'Next-day express delivery to Addis Ababa, local Debre Birhan pickup, and reliable regional courier options across Ethiopia.')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default HomePage;
