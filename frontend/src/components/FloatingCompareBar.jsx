import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCompare } from '../context/CompareContext';
import { getProductImage } from '../utils/productImages';

const FloatingCompareBar = () => {
  const { compareList, compareCount, removeFromCompare, clearCompare } = useCompare();
  const location = useLocation();

  if (compareCount === 0 || location.pathname === '/compare') {
    return null;
  }

  return (
    <div
      className="position-fixed bottom-0 start-50 translate-middle-x mb-4 shadow-2xl rounded-4 px-3 py-2.5 z-3 border border-dark border-opacity-25 animate-fadeIn"
      style={{
        backgroundColor: '#0c1e33',
        color: '#ffffff',
        maxWidth: '92vw',
        width: 'auto',
        boxShadow: '0 12px 35px rgba(11, 26, 45, 0.45)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="d-flex align-items-center gap-2 gap-md-3">
        <div className="d-flex align-items-center gap-2">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center text-white"
            style={{ width: '32px', height: '32px', backgroundColor: '#1b64da' }}
          >
            <i className="bi bi-arrow-left-right text-xs"></i>
          </div>
          <div className="d-none d-sm-block">
            <div className="fw-bold text-xs lh-1">Compare Products</div>
            <small className="text-slate-400 text-[10px]">{compareCount}/4 selected</small>
          </div>
        </div>

        {/* Thumbnail Avatars */}
        <div className="d-flex align-items-center gap-1.5">
          {compareList.map((prod) => (
            <div key={prod.id} className="position-relative">
              <img
                src={getProductImage(prod)}
                alt={prod.name}
                className="rounded-3 border border-white border-opacity-20 object-fit-cover"
                style={{ width: '38px', height: '38px', backgroundColor: '#ffffff' }}
                title={prod.name}
              />
              <button
                type="button"
                onClick={() => removeFromCompare(prod.id)}
                className="btn position-absolute top-0 end-0 translate-middle p-0 rounded-circle text-white d-flex align-items-center justify-content-center"
                style={{ width: '16px', height: '16px', backgroundColor: '#ef4444', fontSize: '9px' }}
                title="Remove"
                aria-label={`Remove ${prod.name}`}
              >
                <i className="bi bi-x"></i>
              </button>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="d-flex align-items-center gap-2 ms-2">
          <Link
            to="/compare"
            className="btn btn-primary btn-sm rounded-pill px-3 py-1 text-xs fw-bold text-nowrap d-flex align-items-center gap-1.5 shadow-sm"
            style={{ backgroundColor: '#1b64da', borderColor: '#1b64da' }}
          >
            Compare Now <i className="bi bi-arrow-right"></i>
          </Link>
          <button
            type="button"
            onClick={clearCompare}
            className="btn btn-outline-light btn-sm rounded-pill px-2.5 py-1 text-[11px] text-nowrap text-slate-300"
            title="Clear comparison list"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingCompareBar;
