import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_IMAGE_MAP, CATEGORY_ICON_MAP } from '../utils/productImages';

const HomePage = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [personalizedProducts, setPersonalizedProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Categories
        const catRes = await api.get('products/categories/');
        setCategories(catRes.data.results || catRes.data || []);

        // Featured products
        const featRes = await api.get('products/items/?is_featured=true');
        setFeaturedProducts(featRes.data.results || featRes.data || []);

        // Trending AI
        const trendRes = await api.get('recommendations/trending/?limit=6');
        setTrendingProducts(trendRes.data.results || []);

        // Personalized AI recommendations
        const persRes = await api.get('recommendations/personalized/?limit=4');
        setPersonalizedProducts(persRes.data.results || []);
      } catch (err) {
        console.error("Home data error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Featured flagship item for hero
  const heroMainProduct = featuredProducts.find((p) => p.name.includes('Watch') || p.name.includes('Apple')) || featuredProducts[0];
  const heroAudioProduct = featuredProducts.find((p) => p.name.includes('AirPods') || p.name.includes('Sony') || p.name.includes('Headphone')) || featuredProducts[1];
  const heroLaptopProduct = featuredProducts.find((p) => p.name.includes('MacBook') || p.name.includes('XPS') || p.name.includes('Laptop')) || featuredProducts[2];

  return (
    <div className="pb-5" style={{ background: '#060b17', color: '#ffffff', minHeight: '100vh' }}>
      {/* =========================================================================
          HERO BENTO SHOWCASE (Inspired by Screenshot 1: SURUCHI Dark UI)
          ========================================================================= */}
      <section className="py-4 py-lg-5">
        <div className="container">
          <div className="row g-4">
            {/* Left Big Hero Card: "Watch Wearable Device" / "Discover Smarter Shopping with AI" */}
            <div className="col-lg-8">
              <div
                className="p-4 p-md-5 rounded-3xl h-100 position-relative overflow-hidden d-flex flex-column justify-content-between"
                style={{
                  background: 'linear-gradient(135deg, #0b152d 0%, #0d1a3a 50%, #081022 100%)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  minHeight: '440px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), inset 0 0 40px rgba(6, 182, 212, 0.05)',
                }}
              >
                {/* Floating ambient glow in hero */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: '320px',
                    height: '320px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0, 242, 254, 0.25) 0%, transparent 70%)',
                    filter: 'blur(50px)',
                    pointerEvents: 'none',
                  }}
                ></div>

                {/* Content Area */}
                <div className="position-relative z-2" style={{ maxWidth: '58%' }}>
                  <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-full mb-3 bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 text-xs font-bold uppercase tracking-wider">
                    <i className="bi bi-cpu-fill"></i> NexusStore AI Flagship
                  </div>
                  <h1 className="display-5 fw-bolder mb-3 text-white tracking-tight" style={{ lineHeight: '1.15' }}>
                    Discover Smarter <br />
                    <span
                      style={{
                        background: 'linear-gradient(135deg, #00f2fe 0%, #38bdf8 50%, #818cf8 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      Shopping with AI
                    </span>
                  </h1>
                  <p className="text-slate-300 text-xs md:text-sm mb-4" style={{ lineHeight: '1.7' }}>
                    Explore premium electronics, discover products tailored to your interests, and enjoy a smarter shopping experience powered by personalized recommendations.
                  </p>
                  <div className="d-flex flex-wrap gap-2.5">
                    <Link to="/shop" className="btn btn-cyan-glow px-4 py-2 rounded-full font-bold text-xs shadow-lg d-flex align-items-center gap-1.5">
                      Explore Products <i className="bi bi-arrow-right"></i>
                    </Link>
                    <Link to="/recommendations" className="btn btn-dark-outline px-4 py-2 rounded-full font-semibold text-xs d-flex align-items-center gap-1.5">
                      <i className="bi bi-stars text-cyan-300"></i> AI Recommendations
                    </Link>
                  </div>
                </div>

                {/* Hero Showcase Product Image with Glowing Podium (Screenshot 1 Visual) */}
                <div
                  className="position-absolute end-0 top-50 translate-middle-y me-2 me-md-4 d-none d-sm-flex align-items-center justify-content-center"
                  style={{ width: '40%', height: '80%' }}
                >
                  <div className="product-podium-ring" style={{ width: '85%', height: '30px', bottom: '25px' }}></div>
                  <img
                    src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80"
                    alt="Hero Gadget"
                    className="img-fluid relative z-2"
                    style={{ maxHeight: '320px', objectFit: 'contain', filter: 'drop-shadow(0 20px 30px rgba(0, 0, 0, 0.7))' }}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: 2 Stacked Promotion Banners (Screenshot 1 Right Tiles) */}
            <div className="col-lg-4 d-flex flex-column gap-4">
              {/* Tile 1: Special Discount on Gaming & Audio */}
              <div
                className="p-4 rounded-3xl flex-grow-1 position-relative overflow-hidden d-flex flex-column justify-content-between"
                style={{
                  background: 'linear-gradient(135deg, #131b36 0%, #0d1428 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  minHeight: '205px',
                }}
              >
                <div className="position-relative z-2" style={{ maxWidth: '60%' }}>
                  <span className="badge rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider mb-2" style={{ background: 'rgba(124, 58, 237, 0.25)', color: '#c084fc', border: '1px solid rgba(124, 58, 237, 0.4)' }}>
                    Special Discount
                  </span>
                  <h5 className="fw-bold text-white mb-1">Up to 25% Off Audio Flagships</h5>
                  <p className="text-slate-400 text-xs mb-3">AirPods Pro & Sony WH-1000XM5</p>
                  <Link to="/shop?category=3" className="text-cyan-400 fw-bold text-xs text-decoration-none d-flex align-items-center gap-1">
                    Shop Now <i className="bi bi-chevron-right"></i>
                  </Link>
                </div>
                <img
                  src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&auto=format&fit=crop&q=80"
                  alt="Headphones"
                  className="position-absolute end-0 bottom-0 me-2 mb-1"
                  style={{ maxHeight: '130px', objectFit: 'contain', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.6))' }}
                />
              </div>

              {/* Tile 2: Hot Deals on Computing */}
              <div
                className="p-4 rounded-3xl flex-grow-1 position-relative overflow-hidden d-flex flex-column justify-content-between"
                style={{
                  background: 'linear-gradient(135deg, #0e203c 0%, #09152b 100%)',
                  border: '1px solid rgba(6, 182, 212, 0.2)',
                  minHeight: '205px',
                }}
              >
                <div className="position-relative z-2" style={{ maxWidth: '60%' }}>
                  <span className="badge rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider mb-2" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.35)' }}>
                    Hot Deals
                  </span>
                  <h5 className="fw-bold text-white mb-1">M3 Pro & RTX 4060 Laptops</h5>
                  <p className="text-slate-400 text-xs mb-3">MacBook Pro & Dell XPS OLED</p>
                  <Link to="/shop?category=2" className="text-cyan-400 fw-bold text-xs text-decoration-none d-flex align-items-center gap-1">
                    Explore Deals <i className="bi bi-chevron-right"></i>
                  </Link>
                </div>
                <img
                  src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&auto=format&fit=crop&q=80"
                  alt="Laptop"
                  className="position-absolute end-0 bottom-0 me-2 mb-1"
                  style={{ maxHeight: '120px', objectFit: 'contain', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.6))' }}
                />
              </div>
            </div>
          </div>

          {/* Bottom 3 Category Strip Cards (Screenshot 1 Mid Banners) */}
          <div className="row g-3 mt-2">
            <div className="col-md-4">
              <Link
                to="/shop?category=2"
                className="p-3 rounded-2xl d-flex align-items-center justify-content-between text-decoration-none group"
                style={{ background: '#0e1833', border: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                <div>
                  <div className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider">High-Performance</div>
                  <div className="text-white fw-bold">Computers & Laptops</div>
                  <span className="text-xs text-slate-400 group-hover:text-cyan-300">Shop Now &rarr;</span>
                </div>
                <i className="bi bi-laptop text-3xl text-cyan-400 opacity-80"></i>
              </Link>
            </div>

            <div className="col-md-4">
              <Link
                to="/shop?category=1"
                className="p-3 rounded-2xl d-flex align-items-center justify-content-between text-decoration-none group"
                style={{ background: '#0e1833', border: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                <div>
                  <div className="text-[11px] text-purple-400 font-bold uppercase tracking-wider">Titanium Edition</div>
                  <div className="text-white fw-bold">Smartphones & Tablets</div>
                  <span className="text-xs text-slate-400 group-hover:text-purple-300">Shop Now &rarr;</span>
                </div>
                <i className="bi bi-phone text-3xl text-purple-400 opacity-80"></i>
              </Link>
            </div>

            <div className="col-md-4">
              <Link
                to="/shop?category=4"
                className="p-3 rounded-2xl d-flex align-items-center justify-content-between text-decoration-none group"
                style={{ background: '#0e1833', border: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                <div>
                  <div className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">Smart Health</div>
                  <div className="text-white fw-bold">Titanium Wearables</div>
                  <span className="text-xs text-slate-400 group-hover:text-emerald-300">Shop Now &rarr;</span>
                </div>
                <i className="bi bi-smartwatch text-3xl text-emerald-400 opacity-80"></i>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          TRUST BADGES BAR (Compact Service Benefits)
          ========================================================================= */}
      <div className="container my-3">
        <div
          className="p-3.5 rounded-3xl"
          style={{ background: '#0a1226', border: '1px solid rgba(255, 255, 255, 0.08)' }}
        >
          <div className="row g-3 text-center text-md-start">
            <div className="col-6 col-md-3 border-end-md border-slate-800">
              <div className="d-flex align-items-center gap-3 px-2">
                <div
                  className="rounded-2xl d-flex align-items-center justify-content-center shrink-0"
                  style={{ width: '42px', height: '42px', background: 'rgba(5, 150, 105, 0.15)', color: '#34d399' }}
                >
                  <i className="bi bi-shield-check fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-white text-xs md:text-sm">Secure Checkout</h6>
                  <small className="text-slate-400 text-[11px]">CBE, Telebirr & Awash</small>
                </div>
              </div>
            </div>

            <div className="col-6 col-md-3 border-end-md border-slate-800">
              <div className="d-flex align-items-center gap-3 px-2">
                <div
                  className="rounded-2xl d-flex align-items-center justify-content-center shrink-0"
                  style={{ width: '42px', height: '42px', background: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa' }}
                >
                  <i className="bi bi-truck fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-white text-xs md:text-sm">Reliable Tracking</h6>
                  <small className="text-slate-400 text-[11px]">Real-time parcel milestones</small>
                </div>
              </div>
            </div>

            <div className="col-6 col-md-3 border-end-md border-slate-800">
              <div className="d-flex align-items-center gap-3 px-2">
                <div
                  className="rounded-2xl d-flex align-items-center justify-content-center shrink-0"
                  style={{ width: '42px', height: '42px', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}
                >
                  <i className="bi bi-headset fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-white text-xs md:text-sm">Responsive Support</h6>
                  <small className="text-slate-400 text-[11px]">In-app status updates</small>
                </div>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="d-flex align-items-center gap-3 px-2">
                <div
                  className="rounded-2xl d-flex align-items-center justify-content-center shrink-0"
                  style={{ width: '42px', height: '42px', background: 'rgba(124, 58, 237, 0.15)', color: '#c084fc' }}
                >
                  <i className="bi bi-receipt-cutoff fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-white text-xs md:text-sm">Official Receipts</h6>
                  <small className="text-slate-400 text-[11px]">Tax-compliant digital PDF</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mt-5">
        {/* =========================================================================
            BEST SELLING PRODUCTS SHELF (Screenshot 1: "Best Selling Products")
            ========================================================================= */}
        <section className="mb-5">
          <div className="d-flex justify-content-between align-items-end mb-4">
            <div>
              <span className="badge rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-1" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#00f2fe', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                <i className="bi bi-star-fill me-1"></i> Certified Flagships
              </span>
              <h3 className="fw-bolder mb-1 text-white">Best Selling Products</h3>
              <p className="text-slate-400 small mb-0">Customer favorites backed by genuine verified purchase reviews</p>
            </div>
            <Link to="/shop" className="text-cyan-400 fw-semibold small text-decoration-none d-flex align-items-center gap-1">
              View All <i className="bi bi-arrow-right"></i>
            </Link>
          </div>

          <div className="row g-4">
            {/* Promo Card: "Hot Collection" (Screenshot 1 Left Promo Card) */}
            <div className="col-lg-3 col-md-6">
              <div
                className="p-4 rounded-3xl h-100 position-relative overflow-hidden d-flex flex-column justify-content-between"
                style={{
                  background: 'linear-gradient(135deg, #091329 0%, #152248 100%)',
                  border: '1px solid rgba(0, 242, 254, 0.3)',
                  minHeight: '360px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                }}
              >
                <div>
                  <span className="badge bg-danger rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider mb-2">
                    Hot Collection
                  </span>
                  <h4 className="fw-bolder text-white mb-2">Galaxy AI & Titanium Pro</h4>
                  <p className="text-slate-300 text-xs mb-3" style={{ lineHeight: '1.6' }}>
                    Pair next-generation smartphones with studio-grade noise-canceling earphones.
                  </p>
                </div>

                <div className="text-center my-3">
                  <img
                    src="https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&auto=format&fit=crop&q=80"
                    alt="Hot Collection"
                    className="img-fluid"
                    style={{ maxHeight: '160px', objectFit: 'contain', filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.6))' }}
                  />
                </div>

                <div>
                  <Link to="/shop?category=1" className="btn btn-cyan-glow btn-sm w-100 rounded-full font-bold">
                    Shop Collection &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* 3 Featured Products in Dark Luxury Cards */}
            {featuredProducts.slice(0, 3).map((p) => (
              <div key={p.id} className="col-lg-3 col-md-6">
                <ProductCard product={p} variant="dark" />
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================================
            PERSONALIZED AI RECOMMENDATIONS (Signature Feature)
            ========================================================================= */}
        {personalizedProducts.length > 0 && (
          <section
            className="mb-5 p-4 p-lg-5 rounded-3xl position-relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(14, 23, 46, 0.95) 0%, rgba(7, 13, 29, 0.98) 100%)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(6, 182, 212, 0.1)',
            }}
          >
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
              <div>
                <span className="ai-badge mb-2">
                  <i className="bi bi-stars"></i> Intelligent Match Engine
                </span>
                <h3 className="fw-bolder mb-1 text-white">Recommended for You</h3>
                <p className="text-slate-400 small mb-0">
                  Computed using Scikit-Learn TF-IDF feature vectors, browsing signals, and basket co-occurrences
                </p>
              </div>

              <Link to="/recommendations" className="btn btn-cyan-glow btn-sm px-4 rounded-full text-xs font-bold">
                See More Recommendations &rarr;
              </Link>
            </div>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
              {personalizedProducts.map((p, idx) => (
                <div key={p.id} className="col">
                  <ProductCard product={p} variant="dark" aiTag={idx === 0 ? "Top Affinity Match" : "Frequently Bought"} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* =========================================================================
            TRENDING THIS WEEK (Screenshot 1: "Trending This Week")
            ========================================================================= */}
        {trendingProducts.length > 0 && (
          <section className="mb-5">
            <div className="d-flex justify-content-between align-items-end mb-4">
              <div>
                <span className="badge rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-1" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <i className="bi bi-fire me-1"></i> Sales Velocity
                </span>
                <h3 className="fw-bold mb-1 text-white">Trending This Week</h3>
                <p className="text-slate-400 small mb-0">Fastest-selling devices based on completed order transactions</p>
              </div>
              <Link to="/shop?ordering=-rating_average" className="text-cyan-400 fw-semibold small text-decoration-none">
                View All Trends <i className="bi bi-arrow-right"></i>
              </Link>
            </div>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
              {trendingProducts.slice(0, 4).map((p) => (
                <div key={p.id} className="col">
                  <ProductCard product={p} variant="dark" aiTag="Trending Choice" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* =========================================================================
            BROWSE CATEGORIES (Compact Bento Grid from Screenshot 2)
            ========================================================================= */}
        <section className="mb-5">
          <div className="d-flex justify-content-between align-items-end mb-4">
            <div>
              <span className="badge bg-slate-800 text-slate-300 border border-slate-700 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-1">
                Engineering Categories
              </span>
              <h3 className="fw-bold mb-1 text-white">Browse By Category</h3>
              <p className="text-slate-400 small mb-0">Select a hardware category to filter specifications</p>
            </div>
            <Link to="/shop" className="text-cyan-400 fw-semibold small text-decoration-none">
              All Categories &rarr;
            </Link>
          </div>

          <div className="row g-3">
            {categories.map((cat) => {
              const iconClass = CATEGORY_ICON_MAP[cat.name] || 'bi-cpu';
              return (
                <div key={cat.id} className="col-6 col-md-4 col-lg-2-4">
                  <Link
                    to={`/shop?category=${cat.id}`}
                    className="p-3.5 rounded-2xl d-block text-center text-decoration-none transition group h-100"
                    style={{
                      background: '#0a1226',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div
                      className="rounded-2xl d-flex align-items-center justify-content-center text-cyan-400 mx-auto mb-2 shadow-sm"
                      style={{ width: '48px', height: '48px', background: 'rgba(6, 182, 212, 0.15)' }}
                    >
                      <i className={`bi ${iconClass} fs-4`}></i>
                    </div>
                    <div className="fw-bold text-white text-xs mb-1 text-truncate" title={cat.name}>
                      {cat.name}
                    </div>
                    <small className="text-slate-400 text-[11px]">{cat.product_count || 0} Products</small>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* =========================================================================
            HOW OUR AI RECOMMANDATION ENGINE WORKS (Academic Defense Section)
            ========================================================================= */}
        <section className="my-5 py-5 border-top border-slate-800">
          <div className="text-center max-w-2xl mx-auto mb-5">
            <span className="ai-badge mb-2">
              <i className="bi bi-cpu-fill"></i> Algorithmic Architecture
            </span>
            <h3 className="fw-bolder mb-2 text-white">How NexusStore AI Computes Recommendations</h3>
            <p className="text-slate-400 small">
              Our intelligent system merges text feature vectors with historical order co-occurrences.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-md-4">
              <div
                className="p-4 rounded-3xl h-100"
                style={{ background: '#0a1226', border: '1px solid rgba(255, 255, 255, 0.08)' }}
              >
                <div
                  className="rounded-2xl d-flex align-items-center justify-content-center text-primary mb-3"
                  style={{ width: '50px', height: '50px', background: 'rgba(37, 99, 235, 0.15)' }}
                >
                  <i className="bi bi-file-earmark-code fs-4"></i>
                </div>
                <h5 className="fw-bold text-white mb-2">1. TF-IDF & Cosine Distance</h5>
                <p className="text-slate-400 text-xs mb-0" style={{ lineHeight: '1.6' }}>
                  Analyzes product titles, specifications, and descriptions to compute contextual cosine distance for similar products.
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div
                className="p-4 rounded-3xl h-100"
                style={{ background: '#0a1226', border: '1px solid rgba(255, 255, 255, 0.08)' }}
              >
                <div
                  className="rounded-2xl d-flex align-items-center justify-content-center text-cyan-400 mb-3"
                  style={{ width: '50px', height: '50px', background: 'rgba(6, 182, 212, 0.15)' }}
                >
                  <i className="bi bi-diagram-3 fs-4"></i>
                </div>
                <h5 className="fw-bold text-white mb-2">2. Co-Occurrence Graph</h5>
                <p className="text-slate-400 text-xs mb-0" style={{ lineHeight: '1.6' }}>
                  Aggregates basket associations across past customer orders to power the "Frequently Bought Together" engine.
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div
                className="p-4 rounded-3xl h-100"
                style={{ background: '#0a1226', border: '1px solid rgba(255, 255, 255, 0.08)' }}
              >
                <div
                  className="rounded-2xl d-flex align-items-center justify-content-center text-purple-400 mb-3"
                  style={{ width: '50px', height: '50px', background: 'rgba(124, 58, 237, 0.15)' }}
                >
                  <i className="bi bi-pie-chart fs-4"></i>
                </div>
                <h5 className="fw-bold text-white mb-2">3. RFM K-Means (k=4)</h5>
                <p className="text-slate-400 text-xs mb-0" style={{ lineHeight: '1.6' }}>
                  Standardizes Recency, Frequency, and Monetary scores to classify shoppers into 4 actionable customer tiers for store managers.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
