import React from 'react';

export const SyncoraLogo = ({ size = 28, showText = true, textClassName = "", className = "" }) => {
  return (
    <div className={`syncora-brand-lockup ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', userSelect: 'none' }}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 64 64" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 8px rgba(99, 102, 241, 0.35))' }}
      >
        <defs>
          <linearGradient id="syncoraBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5"/>
            <stop offset="50%" stopColor="#7c3aed"/>
            <stop offset="100%" stopColor="#06b6d4"/>
          </linearGradient>
          <linearGradient id="syncoraWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="100%" stopColor="#e0e7ff"/>
          </linearGradient>
        </defs>

        <rect width="64" height="64" rx="16" fill="url(#syncoraBgGrad)"/>
        <rect x="1" y="1" width="62" height="62" rx="15" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" fill="none"/>

        <g>
          <path 
            d="M42 22C42 16.5 37.5 13 32 13C25 13 20 18 20 25C20 33 44 31 44 39C44 46 39 51 32 51C26.5 51 22 47.5 22 42" 
            stroke="url(#syncoraWaveGrad)" 
            strokeWidth="5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          <circle cx="21" cy="25" r="3.2" fill="#38bdf8"/>
          <circle cx="43" cy="39" r="3.2" fill="#a78bfa"/>
          <circle cx="32" cy="32" r="2.5" fill="#ffffff"/>
        </g>
      </svg>

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span className={`syncora-brand-title ${textClassName}`} style={{ fontSize: `${Math.round(size * 0.58)}px`, fontWeight: 700, letterSpacing: '-0.02em', color: '#f8fafc' }}>
            Syncora
          </span>
          <span style={{ fontSize: `${Math.max(9, Math.round(size * 0.34))}px`, color: '#94a3b8', fontWeight: 500, letterSpacing: '0.01em' }}>
            Không Gian Kết Nối
          </span>
        </div>
      )}
    </div>
  );
};

export default SyncoraLogo;
