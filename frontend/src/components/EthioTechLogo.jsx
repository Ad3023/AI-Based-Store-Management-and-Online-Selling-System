import React from 'react';
import { Link } from 'react-router-dom';

export const EthioTechIcon = ({ size = 36, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ minWidth: size, minHeight: size }}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="etmGradIcon" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1b64da" />
        <stop offset="50%" stopColor="#00a8ff" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
      <linearGradient id="etmGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
    </defs>
    {/* Base Rounded Container */}
    <rect x="2" y="2" width="60" height="60" rx="14" fill="#0c1e33" />
    <rect x="2" y="2" width="60" height="60" rx="14" fill="none" stroke="url(#etmGradIcon)" strokeWidth="2" strokeOpacity="0.4" />
    
    {/* Circuit Lines */}
    <path d="M12 20 L24 20 L30 14 M40 14 L46 20 L52 20 M12 44 L22 44 L28 50 M42 50 L48 44 L52 44" 
          stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <circle cx="12" cy="20" r="2.5" fill="#00d2ff" />
    <circle cx="52" cy="20" r="2.5" fill="#00d2ff" />
    <circle cx="12" cy="44" r="2.5" fill="#00d2ff" />
    <circle cx="52" cy="44" r="2.5" fill="#00d2ff" />

    {/* Faceted Isometric Market Gem / Cart */}
    <path d="M32 13 L48 22 L48 41 L32 50 L16 41 L16 22 Z" fill="url(#etmGradIcon)" />
    <path d="M32 13 L48 22 L32 31 L16 22 Z" fill="#ffffff" fillOpacity="0.25" />
    <path d="M32 31 L48 22 L48 41 L32 50 Z" fill="#000000" fillOpacity="0.2" />

    {/* Shopping Handle Cutout */}
    <path d="M26 22 C26 18.5 28.5 16 32 16 C35.5 16 38 18.5 38 22" 
          stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none" />

    {/* Center AI/Tech Gold Core */}
    <circle cx="32" cy="34" r="5" fill="url(#etmGold)" stroke="#ffffff" strokeWidth="1.5"/>
    <line x1="32" y1="29" x2="32" y2="25" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="28" y1="37" x2="24" y2="40" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="36" y1="37" x2="40" y2="40" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const EthioTechLogo = ({ 
  variant = 'horizontal', 
  size = 38,
  showTagline = true,
  linkTo = '/',
  isDark = true,
  className = ''
}) => {
  const content = (
    <div className={`d-flex align-items-center gap-2.5 text-decoration-none ${className}`}>
      <EthioTechIcon size={size} />
      {variant !== 'icon-only' && (
        <div className="d-flex flex-column justify-content-center">
          <div className="d-flex align-items-baseline gap-1 lh-1">
            <span 
              className={`fw-bolder fs-5 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`} 
              style={{ letterSpacing: '-0.025em', fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              Ethio<span style={{ color: '#00a8ff' }}>Tech</span>
            </span>
            <span 
              className="fw-bold fs-6" 
              style={{ color: '#fbbf24', letterSpacing: '-0.01em' }}
            >
              Market
            </span>
          </div>
          {showTagline && (
            <span 
              className={`d-none d-sm-inline ${isDark ? 'text-slate-400' : 'text-slate-500'}`} 
              style={{ fontSize: '0.68rem', letterSpacing: '0.04em', marginTop: '2px' }}
            >
              Smart Electronics • AI Store
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="text-decoration-none flex-shrink-0" aria-label="Ethio Tech Market Home">
        {content}
      </Link>
    );
  }

  return content;
};

export default EthioTechLogo;
