import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_ICON_MAP } from '../utils/productImages';

const HomePage = () => {
  const { user } = useAuth();

  // Announcement state
  const [announcement, setAnnouncement] = useState(null);
  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem('nexus_promo_dismissed') === 'true';
  });

  // Data states
  const [categories, setCategories] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [specialOffers, setSpecialOffers] = useState([]);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isPersonalized, setIsPersonalized] = useState(false);

  // Main catalog state
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('-created_at');

  // Dismiss announcement banner
  const handleDismissAnnouncement = () => {
    sessionStorage.setItem('nexus_promo_dismissed', 'true');
    setIsDismissed(true);
  };

  // Fetch initial home data
  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async () => {
      try {
        // 1. Fetch active announcement
        try {
          const promoRes = await api.get('products/promotions/active/announcement/');
          if (isMounted && promoRes.data?.active) {
            setAnnouncement(promoRes.data.announcement || promoRes.data.promotion?.name);
          }
        } catch {
          // No active announcement
        }

        // 2. Fetch categories, new arrivals, and special offers
        const [catRes, newRes, allRes] = await Promise.all([
          api.get('products/categories/'),
          api.get('products/items/?ordering=-created_at&limit=4'),
          api.get('products/items/?limit=20'),
        ]);

        if (isMounted) {
          const catList = catRes.data.results || catRes.data || [];
          const newList = newRes.data.results || newRes.data || [];
          const allList = allRes.data.results || allRes.data || [];

          setCategories(catList);
          setNewArrivals(newList);

          // Find up to 4 products with genuine promotions or discounts
          const promoItems = allList
            .filter((p) => p.has_promotion || (p.compare_at_price && Number(p.compare_at_price) > Number(p.price)))
            .slice(0, 4);
          setSpecialOffers(promoItems.length > 0 ? promoItems : allList.slice(0, 4));
        }

        // 3. Fetch AI Recommendations
        let foundPersonalized = false;
        if (user) {
          try {
            const persRes = await api.get('recommendations/personalized/?limit=4');
            if (isMounted && persRes.data.results?.length > 0) {
              setAiRecommendations(persRes.data.results);
              setIsPersonalized(true);
              foundPersonalized = true;
            }
          } catch {
            // Fallback to trending
          }
        }

        // If not authenticated or no personalized results, fetch trending recommendations
        if (!foundPersonalized) {
          try {
            const trendRes = await api.get('recommendations/trending/?limit=4');
            if (isMounted && trendRes.data.results?.length > 0) {
              setAiRecommendations(trendRes.data.results);
              setIsPersonalized(false);
            }
          } catch {
            // Silently fallback
          }
        }
      } catch (err) {
        console.error('Error loading home data:', err);
      }
    };

    fetchHomeData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Fetch Main Product Catalog dynamically when filter/sort changes
  useEffect(() => {
    let isMounted = true;
    const fetchCatalog = async () => {
      try {
        setCatalogLoading(true);
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.append('search', searchQuery.trim());
        if (selectedCategory) params.append('category', selectedCategory);
        if (sortBy) params.append('ordering', sortBy);
        params.append('limit', '8');

        const res = await api.get(`products/items/?${params.toString()}`);
        if (isMounted) {
          setCatalogProducts(res.data.results || res.data || []);
        }
      } catch (err) {
        console.error('Error fetching catalog:', err);
      } finally {
        if (isMounted) setCatalogLoading(false);
      }
    };

    fetchCatalog();

    return () => {
      isMounted = false;
    };
  }, [searchQuery, selectedCategory, sortBy]);

  return (
    <div className="pb-5" style={{ background: '#060b17', color: '#ffffff', minHeight: '100vh' }}>
      {/* 1. DISMISSIBLE PROMOTION ANNOUNCEMENT */}
      {announcement && !isDismissed && (
        <div
          className="py-2 px-3 border-bottom d-flex align-items-center justify-content-between text-white"
          style={{
            background: 'linear-gradient(90deg, #1e1b4b 0%, #0f172a 50%, #0c4a6e 100%)',
            borderColor: 'rgba(56, 189, 248, 0.3)',
            fontSize: '0.8rem',
          }}
        >
          <div className="container d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-cyan-500 text-slate-900 rounded-pill px-2.5 py-1 text-[11px] fw-bold">
                PROMOTION
              </span>
              <span className="fw-semibold text-cyan-200">{announcement}</span>
            </div>
            <button
              type="button"
              className="btn btn-link text-slate-400 hover:text-white p-0 border-0 ms-3"
              onClick={handleDismissAnnouncement}
              title="Dismiss announcement"
              aria-label="Dismiss"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>
      )}

      {/* 2. CLEAN HERO SECTION */}
      <section className="py-4 py-lg-5">
        <div className="container">
          <div
            className="p-4 p-md-5 rounded-4 position-relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0b152d 0%, #0d1a3a 50%, #081022 100%)',
              border: '1px solid rgba(6, 182, 212, 0.28)',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.55)',
            }}
          >
            {/* Top-Right Corner of Hero Banner: Quick Sign In / Sign Up for Guests */}
            {!user && (
              <div
                className="position-absolute top-0 end-0 m-3 m-md-4 d-flex align-items-center gap-2 p-1.5 px-3 rounded-pill shadow-sm"
                style={{
                  background: 'rgba(10, 16, 32, 0.85)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  zIndex: 2,
                }}
              >
                <span className="text-slate-300 text-xs d-none d-sm-inline">New Shopper?</span>
                <Link
                  to="/login"
                  className="btn btn-sm btn-outline-light rounded-pill px-2.5 py-1 text-xs fw-bold"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn btn-sm btn-primary-gradient rounded-pill px-3 py-1 text-xs fw-bold text-white shadow-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}

            <div className="row align-items-center g-4">
              <div className="col-lg-7">
                <span className="badge rounded-pill px-3 py-1.5 text-xs font-bold uppercase tracking-wider mb-3 bg-cyan-950/80 border border-cyan-400/40 text-cyan-300">
                  <i className="bi bi-cpu-fill me-1"></i> NexusStore AI
                </span>
                <h1 className="display-5 fw-bolder mb-3 text-white tracking-tight" style={{ lineHeight: '1.2' }}>
                  Smart Store Management & <br />
                  <span
                    style={{
                      background: 'linear-gradient(135deg, #00f2fe 0%, #38bdf8 50%, #818cf8 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Online Selling System
                  </span>
                </h1>
                <p className="text-slate-300 text-sm mb-4" style={{ maxWidth: '540px', lineHeight: '1.7' }}>
                  Browse premium consumer electronics, high-end laptops, and mobile devices in Ethiopian Birr (ETB). Instant Chapa checkout and official warranty tracking.
                </p>
                <div className="d-flex flex-wrap align-items-center gap-3">
                  <a
                    href="#main-catalog"
                    className="btn btn-cyan-glow px-4 py-2.5 rounded-pill font-bold text-xs shadow-lg d-flex align-items-center gap-2"
                  >
                    Explore Products <i className="bi bi-arrow-down"></i>
                  </a>
                  <Link
                    to="/shop"
                    className="btn btn-outline-light px-4 py-2.5 rounded-pill font-semibold text-xs"
                  >
                    Full Catalog
                  </Link>
                  {!user && (
                    <div className="d-flex align-items-center gap-2 ms-sm-2 border-start border-slate-700 ps-sm-3 mt-2 mt-sm-0">
                      <Link
                        to="/login"
                        className="btn btn-sm btn-outline-info rounded-pill px-3 py-2 text-xs fw-bold d-flex align-items-center gap-1"
                      >
                        <i className="bi bi-box-arrow-in-right"></i> Sign In
                      </Link>
                      <Link
                        to="/register"
                        className="btn btn-sm btn-primary-gradient rounded-pill px-3 py-2 text-xs fw-bold text-white shadow-sm d-flex align-items-center gap-1"
                      >
                        <i className="bi bi-person-plus"></i> Sign Up
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              <div className="col-lg-5 text-center d-none d-lg-block">
                <img
                  src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80"
                  alt="Featured Electronics"
                  className="img-fluid rounded-4"
                  style={{ maxHeight: '280px', objectFit: 'contain', filter: 'drop-shadow(0 15px 25px rgba(0, 0, 0, 0.6))' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. COMPACT CATEGORIES SECTION */}
      {categories.length > 0 && (
        <section className="py-2 mb-4">
          <div className="container">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="fw-bold text-white mb-0 text-sm uppercase tracking-wider text-slate-300">
                Browse by Category
              </h5>
              <Link to="/categories" className="text-cyan-400 small text-decoration-none">
                All categories &rarr;
              </Link>
            </div>
            <div className="row g-2">
              {categories.slice(0, 6).map((cat) => {
                const iconClass = CATEGORY_ICON_MAP[cat.name] || 'bi-cpu';
                return (
                  <div key={cat.id} className="col-4 col-md-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.id.toString());
                        const el = document.getElementById('main-catalog');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`w-100 p-2.5 rounded-3 text-center border transition ${
                        selectedCategory === cat.id.toString()
                          ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300'
                          : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      <i className={`bi ${iconClass} fs-5 text-cyan-400 d-block mb-1`}></i>
                      <div className="text-xs fw-semibold text-truncate">{cat.name}</div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 4. LIMITED SPECIAL OFFERS & ACTIVE PROMOTIONS */}
      {specialOffers.length > 0 && (
        <section className="py-4 mb-4">
          <div className="container">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <span className="badge bg-danger bg-opacity-20 text-danger border border-danger border-opacity-30 rounded-pill px-3 py-1 text-xs fw-bold uppercase tracking-wider mb-1">
                  <i className="bi bi-tag-fill me-1"></i> Special Offers
                </span>
                <h3 className="fw-bolder text-white mb-0">Active Promotional Discounts</h3>
              </div>
              <Link to="/deals" className="text-cyan-400 small text-decoration-none fw-semibold">
                View all deals &rarr;
              </Link>
            </div>
            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-3">
              {specialOffers.map((p) => (
                <div key={`offer-${p.id}`} className="col">
                  <ProductCard product={p} variant="dark" aiTag="Hot Deal" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. SMALL NEW ARRIVALS SECTION */}
      {newArrivals.length > 0 && (
        <section className="py-4 mb-4">
          <div className="container">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <span className="badge bg-primary bg-opacity-20 text-cyan-300 border border-primary border-opacity-30 rounded-pill px-3 py-1 text-xs fw-bold uppercase tracking-wider mb-1">
                  <i className="bi bi-sparkles me-1"></i> Fresh Inventory
                </span>
                <h3 className="fw-bolder text-white mb-0">New Arrivals</h3>
              </div>
              <Link to="/shop?ordering=-created_at" className="text-cyan-400 small text-decoration-none fw-semibold">
                More new arrivals &rarr;
              </Link>
            </div>
            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-3">
              {newArrivals.map((p) => (
                <div key={`new-${p.id}`} className="col">
                  <ProductCard product={p} variant="dark" aiTag="New" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. AI RECOMMENDATIONS SECTION */}
      {aiRecommendations.length > 0 && (
        <section className="py-4 mb-4">
          <div className="container">
            <div
              className="p-4 rounded-4"
              style={{
                background: 'linear-gradient(135deg, rgba(14, 23, 46, 0.95) 0%, rgba(7, 13, 29, 0.98) 100%)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
              }}
            >
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 gap-2">
                <div>
                  <span className="ai-badge mb-1">
                    <i className="bi bi-stars"></i> {isPersonalized ? 'Personalized For You' : 'AI Highlights'}
                  </span>
                  <h4 className="fw-bolder text-white mb-0">
                    {isPersonalized
                      ? `Recommended for You, ${user?.first_name || user?.username}`
                      : 'Recommended by NexusStore AI'}
                  </h4>
                </div>
                {!user && (
                  <Link to="/login" className="btn btn-sm btn-outline-info rounded-pill px-3">
                    Sign in for personalized picks
                  </Link>
                )}
              </div>
              <div className="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-3">
                {aiRecommendations.map((p) => (
                  <div key={`ai-${p.id}`} className="col">
                    <ProductCard product={p} variant="dark" aiTag="AI Match" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 7. ONE MAIN PRODUCT CATALOG */}
      <section id="main-catalog" className="py-4 mb-5">
        <div className="container">
          <div className="border-top border-slate-800 pt-4 mb-4">
            <div className="row align-items-center g-3">
              <div className="col-lg-4">
                <h3 className="fw-bolder text-white mb-1">Product Catalog</h3>
                <p className="text-slate-400 small mb-0">
                  Search, filter, and view real stock with prices in ETB
                </p>
              </div>

              {/* Filters & Sorting */}
              <div className="col-lg-8">
                <div className="d-flex flex-wrap gap-2 justify-content-lg-end">
                  {/* Search Input */}
                  <div className="input-group input-group-sm" style={{ width: '220px' }}>
                    <span className="input-group-text bg-slate-900 border-slate-700 text-slate-400">
                      <i className="bi bi-search"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control bg-slate-900 border-slate-700 text-white text-xs"
                      placeholder="Search title, specs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Category Filter */}
                  <select
                    className="form-select form-select-sm bg-slate-900 border-slate-700 text-white text-xs"
                    style={{ width: '160px' }}
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Sorting */}
                  <select
                    className="form-select form-select-sm bg-slate-900 border-slate-700 text-white text-xs"
                    style={{ width: '150px' }}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="-created_at">Newest First</option>
                    <option value="price">Price: Low to High</option>
                    <option value="-price">Price: High to Low</option>
                    <option value="-rating_average">Top Customer Rated</option>
                  </select>

                  {(searchQuery || selectedCategory) && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary text-xs rounded-pill px-2.5"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('');
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Catalog Grid */}
          {catalogLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-cyan-400" role="status"></div>
              <p className="text-slate-400 text-xs mt-2">Loading products...</p>
            </div>
          ) : catalogProducts.length === 0 ? (
            <div className="text-center py-5 bg-slate-900/40 rounded-4 border border-slate-800">
              <i className="bi bi-inbox fs-2 text-slate-500 mb-2 d-block"></i>
              <h5 className="text-slate-300">No products found</h5>
              <p className="text-slate-500 text-xs mb-3">Try adjusting your search query or category filter</p>
              <button
                type="button"
                className="btn btn-sm btn-primary rounded-pill px-3"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3">
              {catalogProducts.map((p) => (
                <div key={`catalog-${p.id}`} className="col">
                  <ProductCard product={p} variant="dark" />
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-4">
            <Link to="/shop" className="btn btn-outline-light btn-sm rounded-pill px-4">
              View All Products in Full Catalog &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
