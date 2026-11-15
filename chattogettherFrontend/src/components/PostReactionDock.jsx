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

  // Danh sách top 5 biểu tượng cảm xúc nhiều lượt nhất
  const topReactions = useMemo(() => {
    if (post?.topReactions && Array.isArray(post.topReactions) && post.topReactions.length > 0) {
      return post.topReactions.slice(0, 5);
    }
    if (post?.reactionStats?.topReactions && Array.isArray(post.reactionStats.topReactions)) {
      return post.reactionStats.topReactions.slice(0, 5);
    }
    return [];
  }, [post?.topReactions, post?.reactionStats]);

  // Tooltip tóm tắt số lượng từng cảm xúc
  const reactionTooltip = useMemo(() => {
    if (topReactions.length === 0) return `${post?.likesCount || 0} lượt thích`;
    const parts = topReactions.map(r => `${r.emoji} ${r.count}`);
    return parts.join(' · ');
  }, [topReactions, post?.likesCount]);

  const commitReaction = (type) => {
    if (post.isLikedByMe && post.myReaction === type) {
      playRemoveTick();
    } else {
      playReactionPop();
    }
    if (setActivePickerId) setActivePickerId(null);
    if (onReact) onReact(post.id, type);
  };

  // ================== DESKTOP HOVER HANDLING ==================
  const handleMouseEnter = () => {
    if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    hoverOpenTimerRef.current = setTimeout(() => {
      if (setActivePickerId) setActivePickerId(post.id);
    }, 180);
  };

  const handleMouseLeave = () => {
    if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
    hoverCloseTimerRef.current = setTimeout(() => {
      if (setActivePickerId && activePickerId === post.id) {
        setActivePickerId(null);
      }
    }, 350);
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
    }, 280);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    if (!isLongPressRef.current) {
      if (dx > 10 || dy > 10) {
        // Người dùng đang cuộn feed: hủy timer long-press
        isScrollingRef.current = true;
        if (touchStartTimerRef.current) clearTimeout(touchStartTimerRef.current);
      }
      return;
    }

    // Đang trong chế độ long-press: kiểm tra vuốt qua emoji trong dock
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const itemEl = targetEl?.closest('[data-reaction-type]');
    if (itemEl) {
      const type = itemEl.getAttribute('data-reaction-type');
      setHighlightedType(type);
    } else {
      setHighlightedType(null);
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartTimerRef.current) clearTimeout(touchStartTimerRef.current);

    // Nếu người dùng đang cuộn lướt bài viết, không kích hoạt thả reaction
    if (isScrollingRef.current) {
      return;
    }

    handledTouchRef.current = true;
    setTimeout(() => {
      handledTouchRef.current = false;
    }, 400);

    const pressDuration = Date.now() - touchStartTimeRef.current;

    if (!isLongPressRef.current) {
      // Tap nhanh (< 280ms)
      e.stopPropagation();
      if (isPickerOpen) {
        // Nếu dock đang mở, tap lại sẽ đóng dock
        if (setActivePickerId) setActivePickerId(null);
      } else {
        commitReaction(post.myReaction || 'HEART');
      }
    } else {
      // Đã mở menu qua long-press
      e.stopPropagation();
      if (highlightedType) {
        // Người dùng trượt ngón tay trực tiếp lên emoji rồi nhả tay
        commitReaction(highlightedType);
        setHighlightedType(null);
      } else {
        // Người dùng chỉ nhấn giữ để mở menu rồi nhấc ngón tay lên:
        // GIỮ MENU MỞ để người dùng chạm chọn emoji mong muốn!
      }
    }
  };

  const handleTouchCancel = () => {
    if (touchStartTimerRef.current) clearTimeout(touchStartTimerRef.current);
    isScrollingRef.current = true;
    setHighlightedType(null);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    // Bỏ qua nếu vừa được xử lý bằng TouchEnd (tránh duplicate trigger trên mobile)
    if (handledTouchRef.current) return;
    if (isPickerOpen) {
      if (setActivePickerId) setActivePickerId(null);
      return;
    }
    commitReaction(post.myReaction || 'HEART');
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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Nút Reaction chính */}
      <button
        type="button"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onClick={handleClick}
        className={`action-btn select-none touch-manipulation ${post.isLikedByMe ? 'active-liked text-rose-500' : 'text-zinc-400 hover:text-white'}`}
        title={currentReaction ? currentReaction.label : "Thả cảm xúc"}
      >
        {post.isLikedByMe && currentReaction ? (
          <span className="reaction-active-emoji text-sm select-none leading-none inline-block transform hover:scale-110 transition-transform">
            {currentReaction.emoji}
          </span>
        ) : (
          <Heart
            size={15}
            strokeWidth={1.5}
            fill={post.isLikedByMe ? "#f43f5e" : "none"}
            color={post.isLikedByMe ? "#f43f5e" : "currentColor"}
          />
        )}

        {/* Hiển thị Top 5 Biểu tượng cảm xúc (nếu có) + Số lượng đếm gọn formatCompactCount */}
        {topReactions.length > 0 ? (
          <div className="flex items-center gap-1 ml-1" title={reactionTooltip}>
            <div className="flex items-center -space-x-1.5 overflow-hidden">
              {topReactions.map(r => (
                <span
                  key={r.type}
                  className="text-xs inline-block transform hover:scale-125 transition-transform"
                >
                  {r.emoji}
                </span>
              ))}
            </div>
            <span className="font-mono text-xs ml-0.5 tabular-nums">
              {formatCompactCount(post.likesCount || 0)}
            </span>
          </div>
        ) : (
          <span className="font-mono text-xs tabular-nums ml-1">
            {formatCompactCount(post.likesCount || 0)}
          </span>
        )}
      </button>

      {/* Dock Chọn Biểu Tượng Cảm Xúc (Desktop Hover / Mobile Long-Press) */}
      {isPickerOpen && (
        <div
          className="reactions-popup-menu absolute bottom-[calc(100%+8px)] left-0 bg-zinc-900 border border-zinc-700/80 rounded-full px-2.5 py-1.5 shadow-2xl flex items-center gap-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 select-none max-w-[calc(100vw-24px)] overflow-x-auto"
          style={{ touchAction: 'manipulation' }}
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
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  commitReaction(item.type);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  commitReaction(item.type);
                }}
                className={`reaction-emoji-item p-1.5 text-xl sm:text-2xl rounded-full transition-all duration-150 transform hover:scale-130 hover:-translate-y-1 active:scale-95 flex items-center justify-center shrink-0 cursor-pointer ${
                  isHovered ? 'scale-130 -translate-y-1 bg-zinc-800' : ''
                } ${isSelected ? 'bg-zinc-800/80 ring-1 ring-zinc-600' : ''}`}
                title={item.label}
              >
                <span className="pointer-events-none">{item.emoji}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default React.memo(PostReactionDock);
