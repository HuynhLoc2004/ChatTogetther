import React from 'react';

/**
 * TALOVIN BRAND MONOGRAM & VECTOR LOGO
 * Thiết kế biểu tượng kiến trúc hình học:
 * - Chữ 'T' cách điệu kết hợp các dải sóng tần số âm thanh (Audio Wave Resonance)
 * - Tông màu Titanium Silver, Deep Obsidian và điểm nhấn Emerald / Ultraviolet
 */
export const TalovinLogo = ({ size = 28, showText = true, textClassName = "", className = "", style = {} }) => {
  return (
    <div
      className={`talovin-brand-lockup flex items-center gap-2.5 select-none cursor-pointer ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', ...style }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="talovin-emblem"
        style={{ flexShrink: 0, transition: 'transform 0.2s ease' }}
      >
        <defs>
          {/* Nền Gradient Titanium Deep Obsidian */}
          <linearGradient id="taloBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>

          {/* Dải Gradient Trụ Cột T */}
          <linearGradient id="taloAccent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#e4e4e7" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </linearGradient>

          {/* Dải Gradient Tần số Sóng Âm (Wave Pulse) */}
          <linearGradient id="taloWave" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Khung viền Squircle tối giản */}
        <rect width="64" height="64" rx="16" fill="url(#taloBg)" stroke="#3f3f46" strokeWidth="1.5" />

        {/* Thanh ngang của chữ T (Thước đo âm thanh trên cùng) */}
        <rect x="14" y="16" width="36" height="6.5" rx="3.25" fill="url(#taloAccent)" />

        {/* Trụ đứng của chữ T */}
        <rect x="29" y="22" width="6" height="26" rx="3" fill="url(#taloAccent)" />

        {/* 2 Cột sóng âm thanh đối xứng (Acoustic Resonance Bars) */}
        {/* Cột trái */}
        <rect x="18" y="28" width="4.5" height="14" rx="2.25" fill="url(#taloAccent)" opacity="0.65" />
        <circle cx="20.25" cy="46.5" r="2.25" fill="url(#taloWave)" />

        {/* Cột phải */}
        <rect x="41.5" y="26" width="4.5" height="17" rx="2.25" fill="url(#taloAccent)" opacity="0.85" />
        <circle cx="43.75" cy="47.5" r="2.25" fill="url(#taloWave)" />
      </svg>

      {showText && (
        <div className="talovin-brand-text flex flex-col justify-center leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`talovin-brand-title font-sans font-semibold tracking-wider text-zinc-100 ${textClassName}`}
              style={{ fontSize: Math.max(14, size * 0.58), letterSpacing: '0.04em' }}
            >
              Talovin
            </span>
            <span className="talovin-tag-pro font-mono text-[9px] uppercase px-1 py-0.2 rounded bg-zinc-800 text-emerald-400 border border-zinc-700">
              LIVE
            </span>
          </div>
          <span
            className="talovin-brand-subtitle font-mono text-zinc-400 tracking-wider uppercase mt-0.5"
            style={{ fontSize: Math.max(8.5, size * 0.3) }}
          >
            Social Lounge & Waves
          </span>
        </div>
      )}
    </div>
  );
};

export default TalovinLogo;

