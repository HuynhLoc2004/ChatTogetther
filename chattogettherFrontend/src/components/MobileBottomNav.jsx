import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Users, Radio, MessageSquare } from 'lucide-react';

export const MobileBottomNav = ({
  activeTab = 'feed', // 'feed' | 'groups' | 'fm' | 'messages'
  unreadMessagesCount = 0,
  onOpenFm = null,
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

  const handleFmClick = () => {
    if (onOpenFm) {
      onOpenFm();
    } else {
      navigate('/', { state: { openFm: true } });
    }
  };

  const handleMessagesClick = () => {
    navigate('/messages');
  };

  return (
    <nav
      className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 bg-[#111319]/95 backdrop-blur-md border-t border-white/[0.08] grid grid-cols-4 items-center justify-items-center z-50 px-2 select-none"
      style={{
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        height: 'calc(58px + env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* 1. Sảnh */}
      <button 
        type="button"
        className={`w-full min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
          activeTab === 'feed' ? 'text-[#F3F4F6] font-semibold' : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
        }`}
        onClick={handleSanhClick}
        title="Sảnh trực tuyến"
      >
        <Compass size={20} strokeWidth={1.75} />
        <span className="text-[11px] font-medium tracking-tight">Sảnh</span>
      </button>

      {/* 2. Cộng đồng */}
      <button 
        type="button"
        className={`w-full min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
          activeTab === 'groups' ? 'text-[#F3F4F6] font-semibold' : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
        }`}
        onClick={handleCommunityClick}
        title="Cộng đồng"
      >
        <Users size={20} strokeWidth={1.75} />
        <span className="text-[11px] font-medium tracking-tight">Cộng đồng</span>
      </button>

      {/* 3. Sóng FM */}
      <button 
        type="button"
        className={`w-full min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
          activeTab === 'fm' ? 'text-[#F3F4F6] font-semibold' : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
        }`}
        onClick={handleFmClick}
        title="Sóng FM"
      >
        <Radio size={20} strokeWidth={1.75} />
        <span className="text-[11px] font-medium tracking-tight">Sóng FM</span>
      </button>

      {/* 4. Tin nhắn */}
      <button 
        type="button"
        className="w-full min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer text-[#9CA3AF] hover:text-[#F3F4F6] relative"
        onClick={handleMessagesClick}
        title="Tin nhắn"
      >
        <div className="relative">
          <MessageSquare size={20} strokeWidth={1.75} />
          {effectiveUnreadMessages > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-white text-zinc-950 text-[9px] font-mono font-bold flex items-center justify-center shadow-sm">
              {effectiveUnreadMessages > 9 ? '9+' : effectiveUnreadMessages}
            </span>
          )}
        </div>
        <span className="text-[11px] font-medium tracking-tight">Tin nhắn</span>
      </button>
    </nav>
  );
};

export default MobileBottomNav;
