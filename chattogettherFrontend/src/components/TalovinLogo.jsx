import React from 'react';

/**
 * TALOVIN ARTISTIC WORDMARK & MONOGRAM
 * - Thiết kế Wordmark thuần túy, loại bỏ hoàn toàn hộp vuông chữ T đóng khung.
 * - Chữ cái T đầu tiên cách điệu với nét gạch ngang vát nhịp lướt mượt mà nối tự nhiên sang "alovin".
 * - Typography: Modern Sans-Serif font-bold text-[21px] tracking-[-0.04em] text-[#F4F4F5].
 */
export const TalovinLogo = ({
  size = 21,
  showText = true,
  brandName = 'Talovin',
  textClassName = "",
  className = "",
  style = {}
}) => {
  const fontSize = typeof size === 'number' ? size : 21;

  // Nếu showText = false: chỉ render biểu tượng Monogram chữ T cách điệu nghệ thuật (không hộp viền)
  if (!showText) {
    return (
      <svg
        viewBox="0 0 20 22"
        fill="currentColor"
        className={`talovin-t-monogram inline-block shrink-0 select-none text-[#F4F4F5] ${className}`}
        style={{
          height: `${fontSize}px`,
          width: 'auto',
          ...style
        }}
      >
        <path
          d="M2 3.2H18.2C19.3 3.2 19.8 4.4 19.1 5.2L17.2 7.6C16.8 8.1 16.2 8.4 15.6 8.4H12.4V20.5C12.4 21.3 11.7 22 10.9 22H9.3C8.5 22 7.8 21.3 7.8 20.5V8.4H2C1.2 8.4 0.5 7.7 0.5 6.9V4.7C0.5 3.9 1.2 3.2 2 3.2Z"
        />
      </svg>
    );
  }

  // Wordmark Talovin đầy đủ không hộp vuông
  return (
    <span
      className={`talovin-wordmark inline-flex items-center font-sans font-bold select-none text-[#F4F4F5] tracking-[-0.04em] ${className}`}
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: 1,
        letterSpacing: '-0.04em',
        ...style
      }}
    >
      {/* Chữ T cách điệu đặc trưng thương hiệu */}
      <svg
        viewBox="0 0 20 22"
        fill="currentColor"
        className="talovin-t-mark inline-block shrink-0"
        style={{
          height: '0.9em',
          width: 'auto',
          marginRight: '-0.03em',
          transform: 'translateY(-0.04em)'
        }}
        aria-hidden="true"
      >
        <path
          d="M2 3.2H18.2C19.3 3.2 19.8 4.4 19.1 5.2L17.2 7.6C16.8 8.1 16.2 8.4 15.6 8.4H12.4V20.5C12.4 21.3 11.7 22 10.9 22H9.3C8.5 22 7.8 21.3 7.8 20.5V8.4H2C1.2 8.4 0.5 7.7 0.5 6.9V4.7C0.5 3.9 1.2 3.2 2 3.2Z"
        />
      </svg>
      <span className={`tracking-[-0.04em] ${textClassName}`}>
        {brandName.startsWith('T') || brandName.startsWith('t') ? brandName.slice(1) : brandName}
      </span>
    </span>
  );
};

export default TalovinLogo;
