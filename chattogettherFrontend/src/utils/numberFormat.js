/**
 * Định dạng số gọn nhẹ chuẩn UI:
 * < 1000: hiển thị số nguyên
 * >= 1000: hiển thị 1K+, 1.5K+, 12.4K+
 * Hover / click mở danh sách: hiển thị đầy đủ
 */
export const formatCompactCount = (count, showFull = false) => {
  const num = Number(count) || 0;
  if (showFull || num < 1000) return num.toLocaleString('en-US');
  if (num < 1000000) {
    const formatted = (num / 1000).toFixed(1).replace(/\.0$/, '');
    return `${formatted}K+`;
  }
  const formatted = (num / 1000000).toFixed(1).replace(/\.0$/, '');
  return `${formatted}M+`;
};
