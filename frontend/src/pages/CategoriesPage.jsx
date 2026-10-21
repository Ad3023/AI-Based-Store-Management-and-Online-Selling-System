import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { CATEGORY_IMAGE_MAP, CATEGORY_ICON_MAP } from '../utils/productImages';

const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const res = await api.get('products/categories/');
        setCategories(res.data.results || res.data || []);
      } catch (err) {
        console.error('Failed to load categories', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  return (
    <div className="container py-5">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-5">
        <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-full mb-3 bg-cyan-50 text-cyan-700 text-xs font-bold uppercase tracking-wider border border-cyan-200">
          <i className="bi bi-grid-3x3-gap-fill text-primary"></i> Catalog Directory
        </div>
        <h1 className="display-6 fw-bolder text-slate-900 mb-2">Explore Product Categories</h1>
        <p className="text-slate-500 text-sm">
          Browse verified electronics across specialized categories optimized with AI recommendation tags.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted small mt-2">Loading catalog categories...</p>
        </div>
      ) : (
        <div className="row g-4">
          {categories.map((cat) => {
            const iconClass = CATEGORY_ICON_MAP[cat.name] || 'bi-laptop';
            const catImg = CATEGORY_IMAGE_MAP[cat.name] || 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=500&auto=format&fit=crop&q=80';

            return (
              <div key={cat.id} className="col-md-6 col-lg-4">
                <Link
                  to={`/shop?category=${cat.id}`}
                  className="card border-0 shadow-sm rounded-4 overflow-hidden h-100 text-decoration-none group hover:shadow-xl transition-all duration-300"
                  style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
                >
                  <div className="position-relative overflow-hidden" style={{ height: '180px', background: '#0a1226' }}>
                    <img
                      src={catImg}
                      alt={cat.name}
                      className="w-100 h-100 object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                    />
                    <div
                      className="position-absolute top-3 left-3 rounded-xl p-2.5 d-flex align-items-center justify-content-center text-white shadow-md"
                      style={{ background: 'var(--gradient-primary)', width: '42px', height: '42px' }}
                    >
                      <i className={`bi ${iconClass} fs-5`}></i>
                    </div>
                    <span className="position-absolute bottom-3 right-3 badge bg-slate-950/80 backdrop-blur text-cyan-300 rounded-full px-3 py-1.5 text-xs font-mono border border-cyan-500/30">
                      {cat.product_count || 0} Products
                    </span>
                  </div>

                  <div className="p-4 d-flex flex-column justify-content-between flex-grow-1">
                    <div>
                      <h4 className="fw-bolder text-slate-900 group-hover:text-primary transition mb-2">
                        {cat.name}
                      </h4>
                      <p className="text-slate-500 text-xs mb-3 line-clamp-2" style={{ lineHeight: '1.6' }}>
                        {cat.description || 'Premium high-performance electronics with verified Ethiopian supplier authenticity and digital warranty receipts.'}
                      </p>
                    </div>

                    <div className="d-flex align-items-center justify-content-between pt-3 border-top border-slate-100">
                      <span className="text-primary text-xs font-bold d-flex align-items-center gap-1 group-hover:translate-x-1 transition-transform">
                        <span>Browse Catalog</span>
                        <i className="bi bi-arrow-right"></i>
                      </span>
                      <span className="text-slate-400 text-[11px]">Free Addis Dispatch</span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;
