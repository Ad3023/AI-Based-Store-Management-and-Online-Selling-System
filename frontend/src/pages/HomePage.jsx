import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';

const CATEGORY_ITEMS = [
  { name: 'Laptops', icon: 'bi-laptop', filter: 'laptop' },
  { name: 'Smartphones', icon: 'bi-phone', filter: 'smartphone' },
  { name: 'Accessories', icon: 'bi-mouse', filter: 'accessory' },
  { name: 'Audio', icon: 'bi-headphones', filter: 'audio' },
  { name: 'Wearables', icon: 'bi-smartwatch', filter: 'wearable' },
  { name: 'Tablets', icon: 'bi-tablet', filter: 'tablet' },
];

const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [specialOffers, setSpecialOffers] = useState([]);
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);

  // Active Category Filter
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async () => {
      try {
        setLoading(true);

        // Fetch announcement
        try {
          const promoRes = await api.get('products/promotions/active/announcement/');
          if (isMounted && promoRes.data?.banner_announcement) {
            setAnnouncement(promoRes.data.banner_announcement);
          }
        } catch {
          // No active promo announcement
        }

        // Fetch categories & products
        const [catRes, prodRes] = await Promise.all([
          api.get('products/categories/'),
          api.get('products/items/?limit=24'),
        ]);

        if (isMounted) {
          const catList = catRes.data.results || catRes.data || [];
          const allList = prodRes.data.results || prodRes.data || [];
          setCategories(catList);
          setFeaturedProducts(allList);

          // Find items with compare_at_price > price
          const offers = allList.filter(
            (p) => p.compare_at_price && Number(p.compare_at_price) > Number(p.price)
          );
          setSpecialOffers(offers.length > 0 ? offers : allList.slice(0, 4));
        }

        // Fetch AI recommendations
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
        return catName.includes(activeCategory.toLowerCase());
      });

  return (
    <div style={{ backgroundColor: '#f4f6fa', minHeight: '100%', width: '100%' }}>
      
      {/* 1. Dismissible Announcement Banner */}
      {announcement && (
        <div
          className="py-2 px-3 text-white text-center text-xs fw-semibold border-bottom"
          style={{ backgroundColor: '#0c1e33', borderColor: 'rgba(255, 255, 255, 0.1)' }}
        >
          <div className="container-fluid max-w-7xl d-flex align-items-center justify-content-between">
            <div className="mx-auto d-flex align-items-center gap-2">
              <span className="badge rounded-pill px-2.5 py-0.5 text-white fw-bold" style={{ backgroundColor: '#1b64da' }}>
                SPECIAL OFFER
              </span>
              <span>{announcement}</span>
            </div>
            <button
              type="button"
              className="btn btn-sm text-white p-0 border-0"
              onClick={() => setAnnouncement(null)}
              aria-label="Dismiss announcement"
            >
              <i className="bi bi-x"></i>
            </button>
          </div>
        </div>
      )}

      {/* 2. Hero Section (Screenshot 1 Visuals) */}
      <section className="py-4 py-lg-4 px-3 px-lg-4">
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
              <div className="col-lg-7">
                <span
                  className="badge rounded-pill px-3 py-1.5 text-xs fw-bold text-uppercase mb-3 d-inline-flex align-items-center gap-1.5"
                  style={{ backgroundColor: 'rgba(27, 100, 218, 0.25)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)' }}
                >
                  <i className="bi bi-shield-check"></i> Genuine Warranty & Fast Delivery
                </span>
                
                <h1 className="display-5 fw-bolder mb-3 text-white tracking-tight" style={{ lineHeight: '1.2' }}>
                  Discover the Latest Tech <br />
                  <span style={{ color: '#60a5fa' }}>for a Smarter You</span>
                </h1>
                
                <p className="text-slate-300 text-sm mb-4" style={{ maxWidth: '520px', lineHeight: '1.7' }}>
                  High-quality electronics, great prices, and fast delivery across Ethiopia. Powered by AI personalized recommendations and secure Chapa checkout.
                </p>

                <div className="d-flex flex-wrap align-items-center gap-3">
                  <a
                    href="#featured-catalog"
                    className="btn btn-ethio-primary px-4 py-2.5 rounded-2 font-bold text-sm shadow-md"
                    style={{ backgroundColor: '#1b64da', color: '#ffffff' }}
                  >
                    Shop Now <i className="bi bi-arrow-down"></i>
                  </a>
                  <Link
                    to="/shop"
                    className="btn btn-outline-light px-4 py-2.5 rounded-2 font-semibold text-sm"
                  >
                    View All Products
                  </Link>
                </div>
              </div>

              {/* Right Hero Visuals: Electronics display */}
              <div className="col-lg-5 text-center d-none d-lg-block position-relative">
                <div
                  className="p-3 rounded-4 d-inline-block"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(27, 100, 218, 0.2) 0%, rgba(11, 26, 45, 0) 70%)',
                  }}
                >
                  <img
                    src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80"
                    alt="High Tech Devices"
                    className="img-fluid rounded-4 shadow-lg"
                    style={{
                      maxHeight: '270px',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 15px 25px rgba(0, 0, 0, 0.4))',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Category Icons Row (Screenshot 1) */}
      <section className="py-2 px-3 px-lg-4 mb-3">
        <div className="container-fluid max-w-7xl">
          <div className="row g-2 g-md-3">
            {CATEGORY_ITEMS.map((cat) => {
              const isSelected = activeCategory.toLowerCase() === cat.name.toLowerCase();
              return (
                <div key={cat.name} className="col-4 col-sm-4 col-md-2">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(isSelected ? 'All' : cat.name)}
                    className="w-100 p-2.5 p-md-3 rounded-3 text-center border transition d-flex flex-column align-items-center justify-content-center"
                    style={{
                      backgroundColor: isSelected ? '#1b64da' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#0f172a',
                      borderColor: isSelected ? '#1b64da' : '#e2e8f0',
                      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
                      cursor: 'pointer',
                      minHeight: '85px',
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

      {/* 4. Featured Products (Screenshot 1) */}
      <section id="featured-catalog" className="py-3 px-3 px-lg-4 mb-5">
        <div className="container-fluid max-w-7xl">
          
          {/* Section Header */}
          <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
            <div>
              <h4 className="fw-bolder text-slate-900 mb-0" style={{ letterSpacing: '-0.02em' }}>
                Featured Products
              </h4>
              <p className="text-muted text-xs mb-0">
                {activeCategory !== 'All' ? `Filtered by ${activeCategory}` : 'Top picks from genuine brands across Ethiopia'}
              </p>
            </div>

            <div className="d-flex align-items-center gap-2">
              {activeCategory !== 'All' && (
                <button
                  className="btn btn-sm btn-link text-primary p-0 text-decoration-none text-xs fw-semibold"
                  onClick={() => setActiveCategory('All')}
                >
                  Clear filter
                </button>
              )}
              <Link to="/shop" className="text-primary text-xs fw-bold text-decoration-none d-flex align-items-center gap-1">
                View All <i className="bi bi-arrow-right"></i>
              </Link>
            </div>
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="text-muted text-xs mt-2">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="card ethio-card text-center p-5">
              <i className="bi bi-box-seam fs-1 text-muted mb-2"></i>
              <h6 className="fw-bold text-slate-800">No products found in this category</h6>
              <p className="text-muted text-xs">Try selecting a different category or browsing our full shop catalog.</p>
              <div>
                <button className="btn btn-sm btn-ethio-primary" onClick={() => setActiveCategory('All')}>
                  Show All Products
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

      {/* 5. Special Promotional Discounts */}
      {specialOffers.length > 0 && (
        <section className="py-3 px-3 px-lg-4 mb-5">
          <div className="container-fluid max-w-7xl">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div>
                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-20 rounded-pill px-3 py-1 text-xs fw-bold uppercase tracking-wider mb-1">
                  <i className="bi bi-tag-fill me-1"></i> Special Offers
                </span>
                <h4 className="fw-bolder text-slate-900 mb-0">Discounts & Promotions</h4>
              </div>
              <Link to="/deals" className="text-primary text-xs fw-bold text-decoration-none">
                All Deals &rarr;
              </Link>
            </div>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-3">
              {specialOffers.slice(0, 4).map((p) => (
                <div key={`offer-${p.id}`} className="col">
                  <ProductCard product={p} aiTag="Special Deal" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. AI Recommended Picks */}
      {aiRecommendations.length > 0 && (
        <section className="py-3 px-3 px-lg-4 mb-5">
          <div className="container-fluid max-w-7xl">
            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
              <div>
                <span className="badge rounded-pill px-2.5 py-1 text-xs fw-bold mb-1" style={{ backgroundColor: '#eff6ff', color: '#1b64da', border: '1px solid #bfdbfe' }}>
                  <i className="bi bi-stars me-1"></i> AI Powered Recommendations
                </span>
                <h4 className="fw-bolder text-slate-900 mb-0">Recommended for You</h4>
              </div>
              <Link to="/recommendations" className="text-primary text-xs fw-bold text-decoration-none">
                More AI Picks &rarr;
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

      {/* 7. Value Props Footer Banner */}
      <section className="py-4 px-3 px-lg-4 pb-5">
        <div className="container-fluid max-w-7xl">
          <div className="row g-3">
            <div className="col-md-4">
              <div className="ethio-card p-3.5 d-flex align-items-center gap-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                  style={{ width: '44px', height: '44px', backgroundColor: '#1b64da' }}
                >
                  <i className="bi bi-shield-check fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold text-slate-900 mb-0 text-sm">Official Warranty Protection</h6>
                  <p className="text-muted text-xs mb-0">1 to 2 years genuine hardware guarantee with in-app claim tracking.</p>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="ethio-card p-3.5 d-flex align-items-center gap-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                  style={{ width: '44px', height: '44px', backgroundColor: '#10b981' }}
                >
                  <i className="bi bi-credit-card-2-front fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold text-slate-900 mb-0 text-sm">Chapa Verified Payments</h6>
                  <p className="text-muted text-xs mb-0">Instant checkout via Telebirr, CBE Birr, and Visa/Mastercard cards in ETB.</p>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="ethio-card p-3.5 d-flex align-items-center gap-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                  style={{ width: '44px', height: '44px', backgroundColor: '#f59e0b' }}
                >
                  <i className="bi bi-truck fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold text-slate-900 mb-0 text-sm">Nationwide Dispatch</h6>
                  <p className="text-muted text-xs mb-0">Same-day Addis Ababa delivery and regional courier hubs.</p>
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
