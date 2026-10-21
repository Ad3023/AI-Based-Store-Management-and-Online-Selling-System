import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';

const AIRecommendationsPage = () => {
  const { user } = useAuth();
  const [personalized, setPersonalized] = useState([]);
  const [frequentlyBought, setFrequentlyBought] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        // Personalized
        const pRes = await api.get('recommendations/personalized/?limit=8');
        setPersonalized(pRes.data.results || []);

        // Trending
        const tRes = await api.get('recommendations/trending/?limit=4');
        setTrending(tRes.data.results || []);
      } catch (err) {
        console.error("Error loading recommendations", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecommendations();
  }, [user]);

  return (
    <div className="container py-4 pb-5">
      {/* AI Recommendation Hero Banner matching Panel 5 Concept */}
      <div
        className="rounded-3xl p-5 mb-5 text-white position-relative overflow-hidden shadow-xl"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 50%, #06b6d4 100%)',
        }}
      >
        {/* Glow ambient circle */}
        <div
          className="position-absolute"
          style={{
            top: '-60px',
            right: '-60px',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.15)',
            filter: 'blur(30px)',
          }}
        ></div>

        <div className="row align-items-center g-4 position-relative z-2">
          <div className="col-lg-8">
            <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-full mb-3 bg-white/10 backdrop-blur-md border border-white/20">
              <i className="bi bi-cpu text-info"></i>
              <span className="small font-semibold">Real-Time Machine Learning Engine</span>
            </div>
            <h2 className="display-6 fw-bolder mb-2 text-white">
              AI Product Recommendations
            </h2>
            <h4 className="text-info fw-bold mb-3">Just for You</h4>
            <p className="lead text-white/90 text-sm md:text-base max-w-xl mb-4" style={{ lineHeight: '1.6' }}>
              Based on your interests, purchase history, and real-time browsing behavior. Our Scikit-learn
              TF-IDF vector space matches catalog specifications precisely to your persona.
            </p>
            <div className="d-flex flex-wrap gap-3">
              <Link to="/shop" className="btn btn-light rounded-full px-4 py-2 font-bold text-blue-600 shadow-md">
                Browse All Deals
              </Link>
              <Link to="/orders" className="btn btn-outline-light rounded-full px-4 py-2 font-semibold">
                My Purchase History
              </Link>
            </div>
          </div>

          <div className="col-lg-4 text-center d-none d-lg-block">
            {/* Glowing Brain / Neural Graphic matching Mockup */}
            <div
              className="mx-auto rounded-3xl p-4 flex flex-col items-center justify-center text-white backdrop-blur-lg border border-white/20 shadow-2xl"
              style={{
                width: '180px',
                height: '180px',
                background: 'rgba(255, 255, 255, 0.12)',
              }}
            >
              <i className="bi bi-cpu-fill text-6xl text-cyan-300 mb-2 animate-pulse"></i>
              <span className="font-extrabold text-xs uppercase tracking-widest text-white">
                Personalized
              </span>
              <span className="text-[10px] text-cyan-200">Just for You</span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted small mt-2">Computing similarity vectors...</p>
        </div>
      ) : (
        <>
          {/* Main Personalized Grid */}
          <section className="mb-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h4 className="fw-bolder mb-1 text-slate-900">Recommended For You</h4>
                <p className="text-muted small mb-0">High-affinity products with top content-matching confidence</p>
              </div>
              <Link to="/shop" className="text-primary fw-semibold small text-decoration-none">
                View All <i className="bi bi-arrow-right"></i>
              </Link>
            </div>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
              {personalized.length > 0 ? (
                personalized.map((p) => (
                  <div key={p.id} className="col">
                    <ProductCard product={p} aiTag="98% Match" />
                  </div>
                ))
              ) : (
                <div className="col-12 text-center py-5 text-muted">
                  <p>Browse our catalog to help the AI learn your preferences!</p>
                  <Link to="/shop" className="btn btn-primary-gradient rounded-full px-4">
                    Explore Products
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* "Because you viewed these" Section matching Concept */}
          <section className="mb-5 pt-4 border-top border-slate-100">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h4 className="fw-bolder mb-1 text-slate-900">Because You Viewed These</h4>
                <p className="text-muted small mb-0">Frequently co-purchased accessories and similar models</p>
              </div>
              <Link to="/shop" className="text-primary fw-semibold small text-decoration-none">
                See More <i className="bi bi-arrow-right"></i>
              </Link>
            </div>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
              {trending.map((p) => (
                <div key={p.id} className="col">
                  <ProductCard product={p} aiTag="Top Pick" />
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AIRecommendationsPage;
