import React, { useState, useEffect } from 'react';

/**
 * Component UserAvatar duy nhất toàn hệ thống Talovin.
 * - Ưu tiên ảnh thật nếu có (object-cover).
 * - Nếu không có ảnh thật: sinh avatar fallback theo công thức cố định duy nhất dựa trên username / account / id.
 * - Tuyệt đối không fallback sang 'user' hay 'guest' gây lệch seed màu.
 * - Nếu user đang tải (undefined hoặc chưa có bất kỳ thông tin nào): render skeleton pulse.
 */
const UserAvatar = ({
  user,
  avatar,
  name,
  userId,
  size = 36,
  className = '',
  style = {},
  onClick,
  title,
  alt
}) => {
  // Bóc tách dữ liệu linh hoạt từ prop `user` hoặc các props độc lập
  const rawAvatar = user?.avatarUrl || user?.avatar || avatar;
  const rawId = user?.id || user?.userId || userId;
  const rawName = user?.username || user?.account || user?.nickname || user?.displayName || name;

  // Tính toán seed cố định: Ưu tiên username/account hoặc id cụ thể
  const effectiveSeed = (rawName || (rawId ? String(rawId) : '')).trim();

  // Kiểm tra trạng thái đang tải (chưa có bất kỳ thông tin nào về user)
  const isLoading = !rawAvatar && !effectiveSeed;

  // URL fallback Dicebear cố định theo seed duy nhất
  const fallbackUrl = effectiveSeed
    ? `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(effectiveSeed)}`
    : '';

  const [hasError, setHasError] = useState(false);

  // Reset error khi avatar hoặc seed thay đổi
  useEffect(() => {
    setHasError(false);
  }, [rawAvatar, effectiveSeed]);

  // Nếu hoàn toàn chưa có thông tin user -> Render skeleton tròn chuẩn Dark Zinc
  if (isLoading) {
    return (
      <div
        className={`rounded-full bg-zinc-800/90 border border-zinc-700/60 animate-pulse flex-shrink-0 select-none ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          ...style
        }}
        aria-hidden="true"
      />
    );
  }

  // Quyết định nguồn ảnh: nếu có ảnh thật và chưa lỗi -> dùng ảnh thật; ngược lại dùng Dicebear
  const imgSrc = (!hasError && rawAvatar && rawAvatar.trim())
    ? rawAvatar.trim()
    : fallbackUrl;

  return (
    <img
      src={imgSrc}
      alt={alt || rawName || 'Avatar'}
      title={title || rawName || ''}
      onClick={onClick}
      loading="lazy"
      className={`user-avatar-img select-none ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: '#18181b',
        flexShrink: 0,
        ...style
      }}
      onError={() => {
        if (!hasError && rawAvatar) {
          setHasError(true);
        }
      }}
    />
  );
};

export default UserAvatar;
