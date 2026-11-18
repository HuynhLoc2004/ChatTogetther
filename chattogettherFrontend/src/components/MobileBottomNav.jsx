import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Users, Radio, MessageSquare, User } from 'lucide-react';
import UserAvatar from './UserAvatar';

export const MobileBottomNav = ({
  activeTab = 'feed', // 'feed' | 'groups' | 'rooms' | 'saved' | 'messages' | 'profile' | 'friends' | 'trending'
  unreadMessagesCount = 0,
  hasActiveRooms = false,
  currentUser = null,
  onSwitchTab = null
}) => {
  const navigate = useNavigate();

  const [localUnreadCount, setLocalUnreadCount] = useState(() => {
    try {
      const saved = localStorage.getItem('talovin_dm_unread');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Object.values(parsed).reduce((a, b) => a + (Number(b) || 0), 0);
      }
    } catch (_) { }
    return 0;
  });

  useEffect(() => {
    const handleUnread = (e) => {
      if (e.detail && typeof e.detail === 'object') {
        const total = Object.values(e.detail).reduce((a, b) => a + (Number(b) || 0), 0);
        setLocalUnreadCount(total);
      }
    };
    window.addEventListener('talovin_unread_change', handleUnread);
    return () => window.removeEventListener('talovin_unread_change', handleUnread);
  }, []);

  const effectiveUnreadMessages = Math.max(unreadMessagesCount, localUnreadCount);

  // Nhận diện tab đang active chuẩn xác toàn hệ thống
  const isFeed = activeTab === 'feed' || activeTab === 'trending';
  const isGroups = activeTab === 'groups' || activeTab === 'communities';
  const isRooms = activeTab === 'rooms';
  const isMessages = activeTab === 'messages' || activeTab === 'chat' || activeTab === 'dm';
  const isProfile = activeTab === 'profile' || activeTab === 'saved' || activeTab === 'friends';

  const handleSanhClick = () => {
    if (onSwitchTab) {
      if (activeTab === 'feed') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        onSwitchTab('feed');
      }
    } else {
      navigate('/');
    }
  };

  const handleCommunityClick = () => {
    if (onSwitchTab) {
      onSwitchTab('groups');
    } else {
      navigate('/communities');
    }
  };

  const handleRoomsClick = () => {
    if (onSwitchTab) {
      onSwitchTab('rooms');
    } else {
      navigate('/?tab=rooms');
    }
  };

  const handleMessagesClick = () => {
    navigate('/messages');
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-[95] bg-[#0A0C10]/95 backdrop-blur-2xl border-t border-white/[0.08] flex items-center justify-around px-2 select-none shadow-[0_-10px_35px_rgba(0,0,0,0.85)]"
      style={{
        height: 'calc(62px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'max(4px, env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* 1. Sảnh */}
      <button
        type="button"
        className="relative flex-1 py-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-90 cursor-pointer"
        onClick={handleSanhClick}
        title="Sảnh trực tuyến"
      >
        {isFeed && (
          <span className="absolute top-0 w-8 h-[2px] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
        )}
        <div className={`w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ${isFeed ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <Compass size={20} strokeWidth={isFeed ? 2.2 : 1.75} className={isFeed ? 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]' : ''} />
        </div>
        <span className={`text-[10px] tracking-tight transition-colors duration-200 ${isFeed ? 'font-semibold text-white' : 'font-medium text-zinc-500'}`}>
          Sảnh
        </span>
      </button>

      {/* 2. Cộng đồng */}
      <button
        type="button"
        className="relative flex-1 py-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-90 cursor-pointer"
        onClick={handleCommunityClick}
        title="Cộng đồng"
      >
        {isGroups && (
          <span className="absolute top-0 w-8 h-[2px] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
        )}
        <div className={`w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ${isGroups ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <Users size={20} strokeWidth={isGroups ? 2.2 : 1.75} className={isGroups ? 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]' : ''} />
        </div>
        <span className={`text-[10px] tracking-tight transition-colors duration-200 ${isGroups ? 'font-semibold text-white' : 'font-medium text-zinc-500'}`}>
          Cộng đồng
        </span>
      </button>

      {/* 3. Đàm thoại (Có chấm xanh khi có phòng hoạt động) */}
      <button
        type="button"
        className="relative flex-1 py-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-90 cursor-pointer"
        onClick={handleRoomsClick}
        title="Phòng đàm thoại"
      >
        {isRooms && (
          <span className="absolute top-0 w-8 h-[2px] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
        )}
        <div className="relative">
          <div className={`w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ${isRooms ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <Radio size={20} strokeWidth={isRooms ? 2.2 : 1.75} className={isRooms ? 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]' : ''} />
          </div>
          {hasActiveRooms && (
            <span className="absolute top-1 right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </div>
        <span className={`text-[10px] tracking-tight transition-colors duration-200 ${isRooms ? 'font-semibold text-white' : 'font-medium text-zinc-500'}`}>
          Đàm thoại
        </span>
      </button>

      {/* 4. Tin nhắn */}
      <button
        type="button"
        className="relative flex-1 py-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-90 cursor-pointer"
        onClick={handleMessagesClick}
        title="Tin nhắn"
      >
        {isMessages && (
          <span className="absolute top-0 w-8 h-[2px] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
        )}
        <div className="relative">
          <div className={`w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ${isMessages ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <MessageSquare size={20} strokeWidth={isMessages ? 2.2 : 1.75} className={isMessages ? 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]' : ''} />
          </div>
          {effectiveUnreadMessages > 0 && (
            <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-[0_2px_8px_rgba(244,63,94,0.6)] ring-2 ring-[#0A0C10]">
              {effectiveUnreadMessages > 99 ? '99+' : effectiveUnreadMessages}
            </span>
          )}
        </div>
        <span className={`text-[10px] tracking-tight transition-colors duration-200 ${isMessages ? 'font-semibold text-white' : 'font-medium text-zinc-500'}`}>
          Tin nhắn
        </span>
      </button>

      {/* 5. Cá nhân */}
      <button
        type="button"
        className="relative flex-1 py-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-90 cursor-pointer"
        onClick={handleProfileClick}
        title="Trang cá nhân & Cài đặt"
      >
        {isProfile && (
          <span className="absolute top-0 w-8 h-[2px] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
        )}
        <div className={`w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ${isProfile ? 'bg-white/[0.08]' : ''}`}>
          <div className={`w-6 h-6 rounded-full overflow-hidden transition-all duration-200 ${isProfile ? 'ring-2 ring-white shadow-sm scale-105' : 'border border-white/20 opacity-75'}`}>
            <UserAvatar user={currentUser} size={24} />
          </div>
        </div>
        <span className={`text-[10px] tracking-tight transition-colors duration-200 ${isProfile ? 'font-semibold text-white' : 'font-medium text-zinc-500'}`}>
          Cá nhân
        </span>
      </button>
    </nav>
  );
};

export default MobileBottomNav;