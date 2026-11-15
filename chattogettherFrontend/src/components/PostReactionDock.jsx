import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Heart } from 'lucide-react';
import { formatCompactCount } from '../utils/numberFormat';
import { playReactionPop, playRemoveTick } from '../utils/soundEffects';

export const REACTION_DEFINITIONS = [
  { type: 'HEART', emoji: '❤️', label: 'Yêu thích' },
  { type: 'FIRE', emoji: '🔥', label: 'Bùng nổ' },
  { type: 'HAHA', emoji: '😂', label: 'Haha' },
  { type: 'WOW', emoji: '😮', label: 'Wow' },
  { type: 'LIKE', emoji: '👍', label: 'Thích' },
  { type: 'CROWN', emoji: '👑', label: 'Đỉnh cao' },
  { type: 'CLAP', emoji: '👏', label: 'Vỗ tay' },
];

export const getReactionMeta = (type) => {
  return REACTION_DEFINITIONS.find(r => r.type === type) || { type, emoji: '❤️', label: 'Yêu thích' };
};

const PostReactionDock = ({
  post,
  onReact,
  activePickerId,
  setActivePickerId,
}) => {
  const [highlightedType, setHighlightedType] = useState(null);
  const containerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const touchStartTimeRef = useRef(0);
  const isLongPressRef = useRef(false);
  const isScrollingRef = useRef(false);
  const handledTouchRef = useRef(false);
  const touchStartTimerRef = useRef(null);
  const hoverOpenTimerRef = useRef(null);
  const hoverCloseTimerRef = useRef(null);

  const isPickerOpen = activePickerId === post.id;

  const currentReaction = useMemo(() => {
    if (!post?.myReaction) return null;
    return getReactionMeta(post.myReaction);
  }, [post?.myReaction]);

  // Tooltip tóm tắt
  const reactionTooltip = useMemo(() => {
    const list = post?.topReactions || post?.reactionStats?.topReactions;
    if (Array.isArray(list) && list.length > 0) {
      return list.map(r => `${r.emoji} ${r.count}`).join(' · ');
    }
    return `${post?.likesCount || 0} lượt thích`;
  }, [post?.topReactions, post?.reactionStats, post?.likesCount]);

  const commitReaction = (type) => {
    if (post.isLikedByMe && (post.myReaction === type || (!post.myReaction && type === 'HEART'))) {
      playRemoveTick();
    } else {
      playReactionPop();
    }
    if (setActivePickerId) setActivePickerId(null);
    if (onReact) onReact(post.id, type);
  };

  // ================== DESKTOP HOVER HANDLING (CHỈ TRÊN MÀN HÌNH CÓ CON TRỎ CHUỘT) ==================
  const handleMouseEnter = () => {
    if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(hover: hover)').matches) {
      return; // Không mở bằng hover trên điện thoại/màn hình cảm ứng
    }
    if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    hoverOpenTimerRef.current = setTimeout(() => {
      if (setActivePickerId) setActivePickerId(post.id);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
    hoverCloseTimerRef.current = setTimeout(() => {
      if (setActivePickerId && activePickerId === post.id) {
        setActivePickerId(null);
      }
    }, 260);
  };

  // ================== MOBILE TOUCH / LONG-PRESS HANDLING ==================
  const handleTouchStart = (e) => {
    e.stopPropagation();
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    touchStartTimeRef.current = Date.now();
    isLongPressRef.current = false;
    isScrollingRef.current = false;
    handledTouchRef.current = false;
    setHighlightedType(null);

    if (touchStartTimerRef.current) clearTimeout(touchStartTimerRef.current);
    touchStartTimerRef.current = setTimeout(() => {
      if (isScrollingRef.current) return;
      isLongPressRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(25); } catch (_) {}
      }
      if (setActivePickerId) setActivePickerId(post.id);
    }, 260);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    if (!isLongPressRef.current) {
      if (dx > 8 || dy > 8) {
        isScrollingRef.current = true;
        if (touchStartTimerRef.current) clearTimeout(touchStartTimerRef.current);
      }
      return;
    }

    // Khi đang đè mở dock: Chặn cuộn trang web để vuốt chọn mượt mà
    if (e.cancelable) {
      e.preventDefault();
    }

    // Nhận diện emoji ngón tay đang trỏ tới chính xác bằng toạ độ hình học
    if (containerRef.current) {
      const items = containerRef.current.querySelectorAll('[data-reaction-type]');
      let foundType = null;
      let minDistance = Infinity;

      items.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const inX = touch.clientX >= rect.left - 6 && touch.clientX <= rect.right + 6;
        const inY = touch.clientY >= rect.top - 25 && touch.clientY <= rect.bottom + 30;
        if (inX && inY) {
          const centerX = rect.left + rect.width / 2;
          const dist = Math.abs(touch.clientX - centerX);
          if (dist < minDistance) {
            minDistance = dist;
            foundType = el.getAttribute('data-reaction-type');
          }
        }
      });

      if (foundType !== highlightedType) {
        if (foundType && typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(10); } catch (_) {}
        }
        setHighlightedType(foundType);
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartTimerRef.current) clearTimeout(touchStartTimerRef.current);

    if (isScrollingRef.current) {
      return;
    }

    handledTouchRef.current = true;
    setTimeout(() => {
      handledTouchRef.current = false;
    }, 450);

    if (!isLongPressRef.current) {
      // Tap nhanh trên điện thoại: Toggle thả tim ngay lập tức
      e.stopPropagation();
      if (setActivePickerId) setActivePickerId(null);
      commitReaction(post.isLikedByMe ? (post.myReaction || 'HEART') : 'HEART');
    } else {
      // Nhấn giữ và trượt tay thả ngón tay trên điện thoại
      e.stopPropagation();
      if (highlightedType) {
        commitReaction(highlightedType);
      }
      setHighlightedType(null);
      if (setActivePickerId) setActivePickerId(null);
    }
  };

  const handleTouchCancel = () => {
    if (touchStartTimerRef.current) clearTimeout(touchStartTimerRef.current);
    isScrollingRef.current = true;
    setHighlightedType(null);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (handledTouchRef.current) return;
    if (setActivePickerId) setActivePickerId(null);
    commitReaction(post.isLikedByMe ? (post.myReaction || 'HEART') : 'HEART');
  };

  useEffect(() => {
    return () => {
      if (touchStartTimerRef.current) clearTimeout(touchStartTimerRef.current);
      if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
      if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="reaction-drop-wrapper relative group inline-flex items-center"
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Nút Reaction chính - Kích thước ổn định tuyệt đối, không nhảy layout */}
      <button
        type="button"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onClick={handleClick}
        className={`action-btn select-none touch-manipulation min-w-[48px] h-8 px-2 flex items-center justify-center rounded-lg transition-colors duration-150 ${
          post.isLikedByMe ? 'text-rose-500 font-semibold active-liked' : 'text-zinc-400 hover:text-white'
        }`}
        title={reactionTooltip}
      >
        {post.isLikedByMe && currentReaction && currentReaction.type !== 'HEART' ? (
          <span className="text-sm select-none leading-none inline-block transform scale-110">
            {currentReaction.emoji}
          </span>
        ) : (
          <Heart
            size={16}
            strokeWidth={1.5}
            fill={post.isLikedByMe ? "#f43f5e" : "none"}
            className={post.isLikedByMe ? "text-rose-500 scale-105 transition-transform" : "text-zinc-400 group-hover:text-rose-400 transition-colors"}
          />
        )}

        <span className={`font-mono text-xs tabular-nums ml-1.5 transition-colors ${post.isLikedByMe ? 'text-rose-500 font-semibold' : 'text-zinc-400'}`}>
          {formatCompactCount(post.likesCount || 0)}
        </span>
      </button>

      {/* Dock Chọn Biểu Tượng Cảm Xúc (Desktop Hover / Mobile Long-Press) */}
      {isPickerOpen && (
        <div
          className="reactions-popup-menu absolute bottom-[calc(100%+10px)] left-0 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/80 rounded-full px-2 sm:px-2.5 py-1.5 shadow-2xl flex items-center gap-1 sm:gap-1.5 z-50 select-none"
          style={{ touchAction: 'none', overflow: 'visible', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
          }}
          onMouseLeave={handleMouseLeave}
        >
          {REACTION_DEFINITIONS.map((item) => {
            const isHovered = highlightedType === item.type;
            const isSelected = post.isLikedByMe && post.myReaction === item.type;
            return (
              <button
                key={item.type}
                type="button"
                data-reaction-type={item.type}
                onMouseEnter={() => setHighlightedType(item.type)}
                onMouseLeave={() => setHighlightedType(null)}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  handledTouchRef.current = true;
                  setTimeout(() => {
                    handledTouchRef.current = false;
                  }, 450);
                  commitReaction(item.type);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (handledTouchRef.current) return;
                  commitReaction(item.type);
                }}
                className={`reaction-emoji-item relative p-1.5 sm:p-2 rounded-full transition-all duration-150 select-none cursor-pointer flex items-center justify-center shrink-0 ${
                  isHovered ? 'is-hovered' : ''
                } ${isSelected ? 'bg-zinc-800 ring-1 ring-zinc-500' : ''}`}
                title={item.label}
              >
                {/* Tooltip hiển thị nhãn cảm xúc nảy lên phía trên */}
                {isHovered && (
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-950/95 text-zinc-100 border border-zinc-700/90 font-medium text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap shadow-xl pointer-events-none animate-in fade-in zoom-in-75 duration-100 z-30">
                    {item.label}
                  </span>
                )}
                <span className="pointer-events-none text-2xl sm:text-[26px] leading-none block">
                  {item.emoji}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default React.memo(PostReactionDock);
