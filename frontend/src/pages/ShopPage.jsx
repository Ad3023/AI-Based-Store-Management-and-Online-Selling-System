import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import ProductCard from '../components/ProductCard';
import { CATEGORY_ICON_MAP } from '../utils/productImages';

const ShopPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state from URL query parameters
  const selectedCategory = searchParams.get('category') || '';
  const searchQuery = searchParams.get('search') || '';
  const inStockOnly = searchParams.get('in_stock') === 'true';
  const ordering = searchParams.get('ordering') || '-created_at';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';
  const selectedBrand = searchParams.get('brand') || '';

  // Local inputs
  const [priceMinInput, setPriceMinInput] = useState(minPrice);
  const [priceMaxInput, setPriceMaxInput] = useState(maxPrice);
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Popular Brands List for Filter (TECHMART screenshot)
  const BRANDS = [
    { name: 'Apple', count: 4 },
    { name: 'Samsung', count: 2 },
    { name: 'Sony', count: 1 },
    { name: 'Dell', count: 1 },
    { name: 'Anker', count: 1 },
    { name: 'Logitech', count: 1 },
    { name: 'Keychron', count: 1 },
  ];

  useEffect(() => {
    // Load categories
    api.get('products/categories/').then((res) => {
      setCategories(res.data.results || res.data || []);
    });
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams(searchParams);
        const res = await api.get(`products/items/?${params.toString()}`);
        let items = res.data.results || res.data || [];

        // Client-side brand filter if backend search doesn't filter brand explicitly
        if (selectedBrand) {
          items = items.filter((p) => p.name.toLowerCase().includes(selectedBrand.toLowerCase()));
        }

        setProducts(items);
      } catch (err) {
        console.error("Shop fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [searchParams, selectedBrand]);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateFilter('search', searchInput.trim());
  };

  const handlePriceApply = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (priceMinInput) next.set('min_price', priceMinInput);
    else next.delete('min_price');

    if (priceMaxInput) next.set('max_price', priceMaxInput);
    else next.delete('max_price');

    setSearchParams(next);
  };

  const clearAllFilters = () => {
    setPriceMinInput('');
    setPriceMaxInput('');
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  const activeCategoryObj = categories.find((c) =>
    String(c.id) === selectedCategory ||
    (c.slug && c.slug.toLowerCase() === selectedCategory.toLowerCase()) ||
    (c.name && c.name.toLowerCase() === selectedCategory.toLowerCase()) ||
    (c.name && c.name.toLowerCase().includes(selectedCategory.toLowerCase())) ||
    (c.slug && selectedCategory.toLowerCase().includes(c.slug.toLowerCase()))
  );
  const hasActiveFilters = Boolean(selectedCategory || searchQuery || inStockOnly || minPrice || maxPrice || selectedBrand);

  return (
    <div className="container py-4">
      {/* =========================================================================
          TOP CATEGORY ICON RIBBON (Screenshot 2: TECHMART Header Ribbon)
          ========================================================================= */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-2 overflow-auto pb-2 scrollbar-none">
          {/* "All" Ribbon Item */}
          <button
            type="button"
            className={`btn p-3 rounded-3xl d-flex flex-column align-items-center justify-content-center transition text-nowrap shrink-0 ${
              !selectedCategory ? 'bg-primary text-white shadow-md' : 'bg-white text-slate-700 border border-slate-200 hover:border-primary'
            }`}
            style={{ width: '105px', height: '90px' }}
            onClick={() => updateFilter('category', '')}
          >
            <i className="bi bi-grid-3x3-gap fs-4 mb-1"></i>
            <span className="text-xs font-bold">All</span>
          </button>

          {/* Individual Category Ribbon Items with Outlined Icons */}
          {categories.map((cat) => {
            const isSelected = Boolean(
              (activeCategoryObj && activeCategoryObj.id === cat.id) ||
              selectedCategory === String(cat.id) ||
              (cat.slug && selectedCategory.toLowerCase() === cat.slug.toLowerCase()) ||
              (cat.name && cat.name.toLowerCase().includes(selectedCategory.toLowerCase()))
            );
            const iconClass = CATEGORY_ICON_MAP[cat.name] || 'bi-cpu';
            return (
              <button
                key={cat.id}
                type="button"
                className={`btn p-3 rounded-3xl d-flex flex-column align-items-center justify-content-center transition text-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-primary'
                }`}
                style={{ width: '115px', height: '90px' }}
                onClick={() => updateFilter('category', isSelected ? '' : (cat.slug || String(cat.id)))}
              >
                <i className={`bi ${iconClass} fs-4 mb-1`}></i>
                <span className="text-[11px] font-bold text-truncate w-100 px-1 text-center" title={cat.name}>
                  {cat.name.split('&')[0].trim()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          MAIN SHOP BODY: Left Filter Sidebar + Right Products Grid
          ========================================================================= */}
      <div className="row g-4">
        {/* Left Filter Sidebar (TECHMART style) */}
        <div className="col-lg-3">
          <div className="card border-0 shadow-sm rounded-3xl p-4 bg-white sticky-top border border-slate-200" style={{ top: '80px', zIndex: 10 }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bolder mb-0 text-slate-900">Filter</h5>
              {hasActiveFilters && (
                <button className="btn btn-link btn-sm text-danger p-0 text-decoration-none text-xs font-bold" onClick={clearAllFilters}>
                  Reset
                </button>
              )}
            </div>

            {/* Price Filter (From / To inputs) */}
            <div className="mb-4">
              <label className="fw-bold text-slate-800 text-xs mb-2 d-block">Price (ETB)</label>
              <form onSubmit={handlePriceApply}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-slate-50 border-slate-200 text-slate-500 text-[10px]">From</span>
                    <input
                      type="number"
                      className="form-control form-control-sm text-xs"
                      placeholder="0"
                      value={priceMinInput}
                      onChange={(e) => setPriceMinInput(e.target.value)}
                    />
                  </div>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-slate-50 border-slate-200 text-slate-500 text-[10px]">To</span>
                    <input
                      type="number"
                      className="form-control form-control-sm text-xs"
                      placeholder="2000"
                      value={priceMaxInput}
                      onChange={(e) => setPriceMaxInput(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-outline-custom btn-sm w-100 rounded-full text-xs font-semibold py-1">
                  Apply Price Range
                </button>
              </form>
            </div>

            {/* Brands Checklist (TECHMART screenshot) */}
            <div className="mb-4 pt-3 border-top border-slate-100">
              <label className="fw-bold text-slate-800 text-xs mb-2 d-flex justify-content-between align-items-center">
                <span>Brands</span>
                <span className="text-slate-400 text-[10px] uppercase font-normal">{BRANDS.length} available</span>
              </label>

              <div className="d-flex flex-column gap-2 text-xs">
                {BRANDS.map((b) => (
                  <div key={b.name} className="form-check d-flex align-items-center justify-content-between ps-0">
                    <div className="d-flex align-items-center gap-2">
                      <input
                        className="form-check-input cursor-pointer"
                        type="radio"
                        name="brandFilter"
                        id={`brand_${b.name}`}
                        checked={selectedBrand === b.name}
                        onChange={() => updateFilter('brand', selectedBrand === b.name ? '' : b.name)}
                      />
                      <label className="form-check-label text-slate-700 cursor-pointer" htmlFor={`brand_${b.name}`}>
                        {b.name}
                      </label>
                    </div>
                    <span className="badge bg-slate-100 text-slate-500 text-[10px]">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* In Stock & Condition */}
            <div className="pt-3 border-top border-slate-100">
              <label className="fw-bold text-slate-800 text-xs mb-2 d-block">Availability & Condition</label>
              <div className="form-check form-switch small mb-2">
                <input
                  className="form-check-input cursor-pointer"
                  type="checkbox"
                  id="inStockCheck"
                  checked={inStockOnly}
                  onChange={(e) => updateFilter('in_stock', e.target.checked ? 'true' : '')}
                />
                <label className="form-check-label text-slate-700 text-xs font-semibold cursor-pointer" htmlFor="inStockCheck">
                  In Stock Only
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Products Catalog Grid */}
        <div className="col-lg-9">
          {/* Breadcrumbs & Top Sort Bar (TECHMART style) */}
          <div className="card border-0 shadow-sm rounded-3xl p-3 mb-4 bg-white border border-slate-200">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
              <nav aria-label="breadcrumb" className="text-xs">
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
                  <li className="breadcrumb-item"><Link to="/shop" className="text-decoration-none">Electronics</Link></li>
                  <li className="breadcrumb-item active text-dark fw-bold">
                    {activeCategoryObj ? activeCategoryObj.name : 'All Products'}
                  </li>
                </ol>
              </nav>

              <div className="d-flex align-items-center gap-2">
                <label className="text-slate-500 text-nowrap mb-0 text-xs font-semibold">Sort By:</label>
                <select
                  className="form-select form-select-sm border border-slate-200 rounded-full text-xs font-semibold py-1.5"
                  style={{ width: '185px' }}
                  value={ordering}
                  onChange={(e) => updateFilter('ordering', e.target.value)}
                >
                  <option value="-rating_average">Best Selling & Top Rated</option>
                  <option value="-created_at">Newest Arrivals</option>
                  <option value="price">Price: Low to High</option>
                  <option value="-price">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Tags */}
          {hasActiveFilters && (
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3 text-xs">
              <span className="text-slate-500 font-semibold">Filtering by:</span>
              {selectedBrand && (
                <span className="badge bg-blue-50 text-primary border border-blue-200 rounded-full px-2.5 py-1 d-flex align-items-center gap-1">
                  Brand: {selectedBrand}
                  <i className="bi bi-x cursor-pointer fs-6" onClick={() => updateFilter('brand', '')}></i>
                </span>
              )}
              {selectedCategory && (
                <span className="badge bg-blue-50 text-primary border border-blue-200 rounded-full px-2.5 py-1 d-flex align-items-center gap-1">
                  Category: {activeCategoryObj?.name || selectedCategory}
                  <i className="bi bi-x cursor-pointer fs-6" onClick={() => updateFilter('category', '')}></i>
                </span>
              )}
              {inStockOnly && (
                <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1 d-flex align-items-center gap-1">
                  In Stock Only
                  <i className="bi bi-x cursor-pointer fs-6" onClick={() => updateFilter('in_stock', '')}></i>
                </span>
              )}
              <button className="btn btn-link btn-sm text-danger p-0 text-decoration-none text-xs" onClick={clearAllFilters}>
                Reset
              </button>
            </div>
          )}

          {/* Products Grid */}
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="text-muted small mt-2">Loading products from PostgreSQL catalog...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white border border-slate-200">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <i className="bi bi-search fs-2"></i>
              </div>
              <h5 className="fw-bold text-slate-900">No Electronics Found</h5>
              <p className="text-muted small mb-4" style={{ maxWidth: '420px', margin: '0 auto' }}>
                We couldn't find any products matching your active filters. Try adjusting your search query or reset your filters.
              </p>
              <div>
                <button className="btn btn-primary-gradient rounded-full px-4 text-xs font-semibold" onClick={clearAllFilters}>
                  Reset All Filters
                </button>
              </div>
            </div>
          ) : (
            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-4">
              {products.map((p) => (
                <div key={p.id} className="col">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopPage;
