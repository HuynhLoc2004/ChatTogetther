import React from 'react';

/**
 * Klyvix Brand Monogram & Vector Logo
 * Sleek modern Dark Zinc aesthetic with geometric 'K' monogram and audio frequency pulse.
 */
export const KlyvixLogo = ({ size = 28, showText = true, textClassName = "", className = "" }) => {
  return (
    <div 
      className={`klyvix-brand-lockup ${className}`} 
      style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 64 64" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, filter: 'drop-shadow(0 4px 12px rgba(99, 102, 241, 0.28))' }}
      >
        <defs>
          {/* Base Dark Zinc Squircle */}
          <linearGradient id="klyvixBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#18181b"/>
            <stop offset="100%" stopColor="#09090b"/>
          </linearGradient>
          
          {/* Vibrant Accent Gradient for Monogram K */}
          <linearGradient id="klyvixAccentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8"/>
            <stop offset="50%" stopColor="#6366f1"/>
            <stop offset="100%" stopColor="#38bdf8"/>
          </linearGradient>

          {/* Audio Node Subtle Glow */}
          <radialGradient id="klyvixNodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8"/>
            <stop offset="100%" stopColor="#6366f1"/>
          </radialGradient>
        </defs>

        {/* Squircle container with hairline border */}
        <rect width="64" height="64" rx="16" fill="url(#klyvixBgGrad)"/>
        <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="15.25" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none"/>

        {/* Monogram 'K' intertwined with sound wave frequencies */}
        <g strokeLinecap="round" strokeLinejoin="round">
          {/* Left Vertical Spine / Audio Beacon */}
          <rect x="18" y="15" width="6" height="34" rx="3" fill="url(#klyvixAccentGrad)"/>

          {/* Upper Diagonal Arm with Pulse Node */}
          <path 
            d="M24 30L38 18" 
            stroke="url(#klyvixAccentGrad)" 
            strokeWidth="5.5"
          />
          <circle cx="39.5" cy="16.5" r="3.5" fill="url(#klyvixNodeGlow)"/>

          {/* Lower Diagonal Arm with Echo Pulse Node */}
          <path 
            d="M24 34L39 47" 
            stroke="url(#klyvixAccentGrad)" 
            strokeWidth="5.5"
          />
          <circle cx="40.5" cy="48" r="3.5" fill="url(#klyvixNodeGlow)"/>

          {/* Connecting Resonance Wave */}
          <path 
            d="M45 27C47 29.5 47 34.5 45 37" 
            stroke="#94a3b8" 
            strokeWidth="2.5" 
            strokeOpacity="0.8"
          />
          <path 
            d="M49 23C52.5 27 52.5 37 49 41" 
            stroke="#6366f1" 
            strokeWidth="2" 
            strokeOpacity="0.5"
          />
        </g>
      </svg>

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span 
            className={`klyvix-brand-title ${textClassName}`} 
            style={{ 
              fontSize: `${Math.round(size * 0.58)}px`, 
              fontWeight: 750, 
              letterSpacing: '-0.03em', 
              color: '#f8fafc' 
            }}
          >
            Klyvix
          </span>
          <span 
            style={{ 
              fontSize: `${Math.max(9, Math.round(size * 0.33))}px`, 
              color: '#94a3b8', 
              fontWeight: 500, 
              letterSpacing: '0.01em' 
            }}
          >
            Không Gian Trò Chuyện & Âm Nhạc
          </span>
        </div>
      )}
    </div>
  );
};

export default KlyvixLogo;
