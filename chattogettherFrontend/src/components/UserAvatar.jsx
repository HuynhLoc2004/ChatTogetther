import React, { useState, useEffect } from 'react';

/**
 * Component UserAvatar chuẩn duy nhất toàn hệ thống Talovin.
 * - Ưu tiên ảnh thật nếu có (object-cover).
 * - Nếu không có ảnh thật: sinh avatar fallback theo công thức cố định duy nhất dựa trên username / account (lowercase).
 * - Fallback dự phòng là String(userId).
 * - Tuyệt đối không dùng displayName hay postId để tránh sinh 2 hình khác nhau cho cùng 1 user.
 * - Nếu user đang tải (undefined hoặc chưa có bất kỳ thông tin nào): render skeleton pulse.
 */
const UserAvatar = ({
  user,
  avatar,
  name,
  username,
  account,
  userId,
  size = 36,
  className = '',
  style = {},
  onClick,
  title,
  alt
}) => {
  // 1. Bóc tách dữ liệu avatar thật
  const rawAvatar = user?.avatarUrl || user?.avatar || user?.authorAvatar || avatar;
  const rawId = user?.id || user?.userId || user?.authorId || userId;

  // 2. Khóa cứng seed fallback theo DUY NHẤT username / account (lowercase).
  // Tuyệt đối không dùng displayName hay nickname có khoảng trắng gây lệch màu giữa các trang!
  const candidateUsername = (
    user?.account ||
    user?.username ||
    user?.authorAccount ||
    username ||
    account ||
    (typeof name === 'string' && !name.includes(' ') && name.length <= 32 ? name : null)
  );

  let effectiveSeed = '';
  if (candidateUsername && typeof candidateUsername === 'string') {
    effectiveSeed = candidateUsername.trim().toLowerCase();
  } else if (rawId) {
    effectiveSeed = String(rawId).trim();
  } else if (name && typeof name === 'string') {
    effectiveSeed = name.trim().toLowerCase();
  }

  // Kiểm tra trạng thái đang tải
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

  // Skeleton tròn chuẩn Dark Zinc khi đang tải
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

  // Quyết định nguồn ảnh
  const imgSrc = (!hasError && rawAvatar && rawAvatar.trim())
    ? rawAvatar.trim()
    : fallbackUrl;

  return (
    <img
      src={imgSrc}
      alt={alt || candidateUsername || name || 'Avatar'}
      title={title || candidateUsername || name || ''}
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
