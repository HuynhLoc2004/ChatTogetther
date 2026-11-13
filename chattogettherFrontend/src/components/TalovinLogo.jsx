import React from 'react';

/**
 * TALOVIN BRAND LOGO & MONOGRAM
 * Ngôn ngữ thiết kế: High-End Industrial Minimalist (Tương tự Linear, Vercel, Apple)
 * - Monogram khối chữ T tỷ lệ vàng cân đối hoàn hảo
 * - Bảng màu Titanium Silver nguyên bản trên nền Deep Obsidian
 * - Tuyệt đối không gắn nhãn phụ "LIVE" hay dải màu lòe loẹt
 */
export const TalovinLogo = ({ size = 28, showText = true, brandName = 'Talovin', textClassName = "", className = "", style = {} }) => {
  return (
    <div
      className={`talovin-brand-lockup flex items-center gap-2.5 select-none cursor-pointer ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', ...style }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="talovin-emblem"
        style={{ flexShrink: 0, transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <defs>
          <linearGradient id="taloObsidianPlate" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1c1c20" />
            <stop offset="100%" stopColor="#0a0a0c" />
          </linearGradient>

          <linearGradient id="taloTitaniumT" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#e4e4e7" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </linearGradient>

          <linearGradient id="taloBorderGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3f3f46" />
            <stop offset="100%" stopColor="#27272a" />
          </linearGradient>
        </defs>

        {/* Khung Squircle Deep Obsidian */}
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="12"
          fill="url(#taloObsidianPlate)"
          stroke="url(#taloBorderGlow)"
          strokeWidth="1.2"
        />

        {/* Monogram T Titanium nguyên khối cân xứng chuẩn mực */}
        <path
          d="M13 13.5C13 12.67 13.67 12 14.5 12H33.5C34.33 12 35 12.67 35 13.5V17C35 17.83 34.33 18.5 33.5 18.5H27V33.5C27 34.6 26.1 35.5 25 35.5H23C21.9 35.5 21 34.6 21 33.5V18.5H14.5C13.67 18.5 13 17.83 13 17V13.5Z"
          fill="url(#taloTitaniumT)"
        />
      </svg>

      {showText && (
        <span
          className={`talovin-brand-title font-sans font-bold tracking-tight text-zinc-100 ${textClassName}`}
          style={{ fontSize: Math.max(16, size * 0.65), letterSpacing: '-0.025em' }}
        >
          {brandName || 'Talovin'}
        </span>
      )}
    </div>
  );
};

export default TalovinLogo;
