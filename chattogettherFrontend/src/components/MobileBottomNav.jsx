import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Users, Radio, MessageSquare, User } from 'lucide-react';
import UserAvatar from './UserAvatar';

export const MobileBottomNav = ({
  activeTab = 'feed', // 'feed' | 'groups' | 'rooms' | 'saved'
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
    } catch (_) {}
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
      className="mobile-bottom-nav lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[#0B0D12]/95 backdrop-blur-md border-t border-white/[0.08] flex items-center justify-around px-1 select-none"
      style={{
        paddingBottom: 'max(4px, env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* 1. Sảnh */}
      <button 
        type="button"
        className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
          activeTab === 'feed' ? 'text-[#F3F4F6] font-semibold' : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
        }`}
        onClick={handleSanhClick}
        title="Sảnh trực tuyến"
      >
        <Compass size={20} strokeWidth={activeTab === 'feed' ? 2.2 : 1.75} />
        <span className="text-[10.5px] font-medium tracking-tight">Sảnh</span>
      </button>

      {/* 2. Cộng đồng */}
      <button 
        type="button"
        className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
          activeTab === 'groups' ? 'text-[#F3F4F6] font-semibold' : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
        }`}
        onClick={handleCommunityClick}
        title="Cộng đồng"
      >
        <Users size={20} strokeWidth={activeTab === 'groups' ? 2.2 : 1.75} />
        <span className="text-[10.5px] font-medium tracking-tight">Cộng đồng</span>
      </button>

      {/* 3. Đàm thoại (Có chấm xanh khi có phòng hoạt động) */}
      <button 
        type="button"
        className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer relative ${
          activeTab === 'rooms' ? 'text-[#F3F4F6] font-semibold' : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
        }`}
        onClick={handleRoomsClick}
        title="Phòng đàm thoại"
      >
        <div className="relative flex items-center justify-center">
          <Radio size={20} strokeWidth={activeTab === 'rooms' ? 2.2 : 1.75} />
          {hasActiveRooms && (
            <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0B0D12] animate-pulse" />
          )}
        </div>
        <span className="text-[10.5px] font-medium tracking-tight">Đàm thoại</span>
      </button>

      {/* 4. Tin nhắn */}
      <button 
        type="button"
        className="flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer text-[#9CA3AF] hover:text-[#F3F4F6] relative"
        onClick={handleMessagesClick}
        title="Tin nhắn"
      >
        <div className="relative flex items-center justify-center">
          <MessageSquare size={20} strokeWidth={1.75} />
          {effectiveUnreadMessages > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-white text-zinc-950 text-[9px] font-mono font-bold flex items-center justify-center shadow-sm">
              {effectiveUnreadMessages > 99 ? '99+' : effectiveUnreadMessages}
            </span>
          )}
        </div>
        <span className="text-[10.5px] font-medium tracking-tight">Tin nhắn</span>
      </button>

      {/* 5. Cá nhân */}
      <button 
        type="button"
        className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
          activeTab === 'saved' ? 'text-[#F3F4F6] font-semibold' : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
        }`}
        onClick={handleProfileClick}
        title="Hồ sơ cá nhân & Đã lưu"
      >
        {currentUser ? (
          <div className="w-5 h-5 rounded-full overflow-hidden border border-white/20">
            <UserAvatar user={currentUser} size={20} />
          </div>
        ) : (
          <User size={20} strokeWidth={1.75} />
        )}
        <span className="text-[10.5px] font-medium tracking-tight">Cá nhân</span>
      </button>
    </nav>
  );
};

export default MobileBottomNav;
