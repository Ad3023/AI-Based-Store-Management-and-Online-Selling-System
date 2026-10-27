import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useCompare } from '../context/CompareContext';
import { useCart } from '../context/CartContext';
import { formatETB } from '../utils/currency';
import { getProductImage } from '../utils/productImages';

const ComparePage = () => {
  const { compareList, removeFromCompare, clearCompare, addToCompare } = useCompare();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [selectedToAdd, setSelectedToAdd] = useState('');
  const [addedNotice, setAddedNotice] = useState('');

  // Fetch AI comparison analysis when compareList changes (min 2 items)
  useEffect(() => {
    let isMounted = true;
    if (compareList.length >= 2) {
      setLoadingAi(true);
      const productIds = compareList.map((p) => p.id);
      api.post('recommendations/compare/', { product_ids: productIds })
        .then((res) => {
          if (isMounted && res.data.ai_synthesis) {
            setAiAnalysis(res.data.ai_synthesis);
          }
        })
        .catch((err) => {
          console.error('Comparison AI analysis load error:', err);
        })
        .finally(() => {
          if (isMounted) setLoadingAi(false);
        });
    } else {
      setAiAnalysis(null);
    }

    return () => {
      isMounted = false;
    };
  }, [compareList]);

  // Load catalog for quick-add dropdown
  useEffect(() => {
    api.get('products/items/?limit=30')
      .then((res) => {
        const list = res.data.results || res.data || [];
        setAllProducts(list);
      })
      .catch((err) => console.error(err));
  }, []);

  const handleQuickAdd = (e) => {
    e.preventDefault();
    if (!selectedToAdd) return;
    const found = allProducts.find((p) => String(p.id) === String(selectedToAdd));
    if (found) {
      addToCompare(found);
      setSelectedToAdd('');
    }
  };

  const handleAddToCart = async (product) => {
    try {
      await addToCart(product, 1);
      setAddedNotice(`Added ${product.name} to your cart!`);
      setTimeout(() => setAddedNotice(''), 3500);
    } catch (err) {
      console.error(err);
    }
  };

  if (compareList.length === 0) {
    return (
      <div className="container py-5 text-center">
        <div className="card ethio-card border-0 shadow-sm rounded-4 p-5 mx-auto max-w-xl">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center text-primary mx-auto mb-3"
            style={{ width: '70px', height: '70px', backgroundColor: '#eff6ff' }}
          >
            <i className="bi bi-arrow-left-right fs-1"></i>
          </div>
          <h4 className="fw-bolder text-slate-900 mb-2">No Products in Comparison</h4>
          <p className="text-slate-500 text-xs mb-4">
            Select up to 4 products across the catalog to analyze technical specifications, warranty coverage, pricing in ETB, and grounded AI recommendations side-by-side.
          </p>

          <div className="d-flex flex-wrap justify-content-center gap-2 mb-4">
            {allProducts.slice(0, 3).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCompare(p)}
                className="btn btn-outline-primary btn-sm rounded-pill text-xs px-3"
              >
                + Compare {p.name.split(' ').slice(0, 3).join(' ')}
              </button>
            ))}
          </div>

          <Link to="/shop" className="btn btn-ethio-primary rounded-pill px-4 text-xs font-bold">
            <i className="bi bi-grid-fill me-1"></i> Browse Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      {/* Breadcrumb & Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4 pb-2 border-bottom">
        <div>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-1 text-xs">
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none text-slate-500">Home</Link></li>
              <li className="breadcrumb-item"><Link to="/shop" className="text-decoration-none text-slate-500">Shop</Link></li>
              <li className="breadcrumb-item active fw-bold text-slate-900" aria-current="page">Product Comparison</li>
            </ol>
          </nav>
          <div className="d-flex align-items-center gap-2">
            <h1 className="h4 fw-bolder text-slate-900 mb-0">Smart Product Comparison</h1>
            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-20 rounded-pill px-2.5 py-1 text-[11px] fw-bold">
              {compareList.length}/4 Selected
            </span>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          {compareList.length < 4 && (
            <form onSubmit={handleQuickAdd} className="d-flex align-items-center gap-1.5">
              <select
                className="form-select form-select-sm text-xs rounded-xl"
                style={{ maxWidth: '240px' }}
                value={selectedToAdd}
                onChange={(e) => setSelectedToAdd(e.target.value)}
                aria-label="Add product to compare"
              >
                <option value="">+ Add another product...</option>
                {allProducts
                  .filter((p) => !compareList.some((cp) => cp.id === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatETB(p.price)})
                    </option>
                  ))}
              </select>
              <button type="submit" disabled={!selectedToAdd} className="btn btn-outline-primary btn-sm rounded-xl text-xs font-semibold">
                Add
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={clearCompare}
            className="btn btn-outline-danger btn-sm rounded-xl text-xs px-3"
          >
            Clear All
          </button>
        </div>
      </div>

      {addedNotice && (
        <div className="alert alert-success rounded-3 mb-3 text-xs py-2 px-3 d-flex align-items-center justify-content-between shadow-sm animate-fadeIn">
          <span><i className="bi bi-check-circle-fill me-1"></i> {addedNotice}</span>
          <Link to="/cart" className="fw-bold text-success text-decoration-underline ms-3">View Cart &rarr;</Link>
        </div>
      )}

      {/* AI Grounded Synthesis Card (if >= 2 products) */}
      {compareList.length >= 2 && (
        <div
          className="card border-0 shadow-sm rounded-4 p-4 mb-4 text-white"
          style={{
            background: 'linear-gradient(135deg, #0c1e33 0%, #152e4d 60%, #0c1e33 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="d-flex align-items-center gap-2 mb-2">
            <span
              className="badge rounded-pill px-2.5 py-1 text-xs fw-bold"
              style={{ backgroundColor: 'rgba(0, 168, 255, 0.25)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}
            >
              <i className="bi bi-cpu-fill me-1"></i> Grounded AI Comparison Synthesis
            </span>
          </div>

          {loadingAi ? (
            <div className="d-flex align-items-center gap-2 text-slate-300 text-xs py-2">
              <div className="spinner-border spinner-border-sm text-cyan-400" role="status"></div>
              <span>Synthesizing technical tradeoffs and market value in ETB...</span>
            </div>
          ) : aiAnalysis ? (
            <div>
              <p className="text-slate-200 text-xs mb-3" style={{ lineHeight: '1.7' }}>
                {aiAnalysis.verdict_summary}
              </p>

              <div className="row g-3">
                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div className="text-cyan-400 text-xs fw-bold mb-1 d-flex align-items-center gap-1.5">
                      <i className="bi bi-trophy-fill text-warning"></i> Best Overall Performance
                    </div>
                    <div className="fw-bold text-sm text-white">{aiAnalysis.best_overall.name}</div>
                    <small className="text-slate-300 text-[11px]">{aiAnalysis.best_overall.reason}</small>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div className="text-emerald-400 text-xs fw-bold mb-1 d-flex align-items-center gap-1.5">
                      <i className="bi bi-cash-coin"></i> Best Value for Money
                    </div>
                    <div className="fw-bold text-sm text-white">{aiAnalysis.best_value.name}</div>
                    <small className="text-slate-300 text-[11px]">{aiAnalysis.best_value.reason}</small>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Side-by-Side Comparison Matrix Table */}
      <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden mb-5">
        <div className="table-responsive">
          <table className="table table-bordered mb-0 align-middle">
            <thead style={{ backgroundColor: '#f8fafc' }}>
              <tr>
                <th style={{ width: '200px', minWidth: '160px' }} className="p-3 text-slate-500 text-xs fw-bold text-uppercase tracking-wider">
                  Specifications
                </th>
                {compareList.map((product) => (
                  <th key={product.id} style={{ minWidth: '240px' }} className="p-3 text-center position-relative">
                    <button
                      type="button"
                      onClick={() => removeFromCompare(product.id)}
                      className="btn position-absolute top-2 end-2 p-1 text-slate-400 hover:text-danger border-0"
                      title="Remove from comparison"
                      aria-label="Remove product"
                    >
                      <i className="bi bi-x-circle fs-6"></i>
                    </button>

                    <Link to={`/products/${product.slug || product.id}`} className="text-decoration-none">
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className="rounded-3 mb-2 object-fit-contain shadow-sm border"
                        style={{ width: '120px', height: '120px', backgroundColor: '#ffffff' }}
                      />
                      <h6 className="fw-bolder text-slate-900 text-xs line-clamp-2 mb-1 hover:text-primary">
                        {product.name}
                      </h6>
                    </Link>

                    <div className="fw-bolder text-primary fs-6 mb-2">
                      {formatETB(product.current_price || product.price)}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock === 0}
                      className="btn btn-ethio-primary btn-sm rounded-pill px-3 py-1 text-xs fw-bold w-100 shadow-sm"
                    >
                      {product.stock > 0 ? (
                        <><i className="bi bi-cart-plus me-1"></i> Add to Cart</>
                      ) : (
                        'Out of Stock'
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Category */}
              <tr>
                <td className="fw-bold text-slate-700 text-xs p-3">Category</td>
                {compareList.map((p) => (
                  <td key={`cat-${p.id}`} className="text-center text-xs p-3 text-slate-600">
                    {p.category_name || p.category?.name || 'Electronics'}
                  </td>
                ))}
              </tr>

              {/* Price & Savings */}
              <tr>
                <td className="fw-bold text-slate-700 text-xs p-3">Pricing in ETB</td>
                {compareList.map((p) => (
                  <td key={`price-${p.id}`} className="text-center text-xs p-3">
                    <div className="fw-bold text-slate-900">{formatETB(p.current_price || p.price)}</div>
                    {p.compare_at_price && Number(p.compare_at_price) > Number(p.price) && (
                      <div className="text-muted text-[11px] text-decoration-line-through">
                        {formatETB(p.compare_at_price)} (Save {formatETB(p.compare_at_price - p.price)})
                      </div>
                    )}
                  </td>
                ))}
              </tr>

              {/* Availability & Stock */}
              <tr>
                <td className="fw-bold text-slate-700 text-xs p-3">Availability</td>
                {compareList.map((p) => (
                  <td key={`stock-${p.id}`} className="text-center text-xs p-3">
                    {p.stock > 0 ? (
                      <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-pill px-2.5 py-1">
                        <i className="bi bi-check-circle-fill me-1"></i> In Stock ({p.stock} units)
                      </span>
                    ) : (
                      <span className="badge bg-rose-50 text-rose-700 border border-rose-200 rounded-pill px-2.5 py-1">
                        <i className="bi bi-x-circle-fill me-1"></i> Out of Stock
                      </span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Customer Rating */}
              <tr>
                <td className="fw-bold text-slate-700 text-xs p-3">Customer Rating</td>
                {compareList.map((p) => (
                  <td key={`rating-${p.id}`} className="text-center text-xs p-3">
                    <div className="d-flex align-items-center justify-content-center gap-1 text-warning fw-bold">
                      <i className="bi bi-star-fill text-xs"></i>
                      <span className="text-slate-900">{p.rating_average || '4.8'}</span>
                      <small className="text-slate-400">({p.rating_count || 12} reviews)</small>
                    </div>
                  </td>
                ))}
              </tr>

              {/* Warranty Coverage */}
              <tr>
                <td className="fw-bold text-slate-700 text-xs p-3">Warranty Protection</td>
                {compareList.map((p) => (
                  <td key={`war-${p.id}`} className="text-center text-xs p-3 text-slate-600">
                    <div className="fw-semibold text-slate-800">
                      <i className="bi bi-shield-check text-success me-1"></i>
                      {p.warranty_policy?.duration_days || 7} Days Official Guarantee
                    </div>
                    <small className="text-slate-400 text-[11px]">
                      {p.warranty_policy?.coverage_summary || 'Standard hardware replacement & repair.'}
                    </small>
                  </td>
                ))}
              </tr>

              {/* Product Description & Highlights */}
              <tr>
                <td className="fw-bold text-slate-700 text-xs p-3">Product Description</td>
                {compareList.map((p) => (
                  <td key={`desc-${p.id}`} className="text-xs p-3 text-slate-600" style={{ lineHeight: '1.6' }}>
                    <p className="mb-0 line-clamp-4">{p.description}</p>
                  </td>
                ))}
              </tr>

              {/* Actions Footer */}
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <td className="fw-bold text-slate-700 text-xs p-3">Action</td>
                {compareList.map((p) => (
                  <td key={`act-${p.id}`} className="text-center p-3">
                    <button
                      type="button"
                      onClick={() => handleAddToCart(p)}
                      disabled={p.stock === 0}
                      className="btn btn-ethio-primary btn-sm rounded-pill px-3 py-1.5 text-xs fw-bold w-100 shadow-sm"
                    >
                      <i className="bi bi-cart3 me-1"></i> Buy Now
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ComparePage;
