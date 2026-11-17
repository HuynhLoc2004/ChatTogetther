import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Users, Radio, UserCheck, User } from 'lucide-react';

export const MobileBottomNav = ({
  activeTab = 'feed', // 'feed' | 'groups' | 'friends' | 'profile'
  unreadMessagesCount = 0,
  pendingFriendsCount = 0,
  onOpenFm = null,
  onOpenFriends = null,
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

  const handleFriendsClick = () => {
    if (onSwitchTab) {
      onSwitchTab('friends');
    } else if (onOpenFriends) {
      onOpenFriends();
    } else {
      navigate('/friends');
    }
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  return (
    <nav
      className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 bg-[#161922]/95 backdrop-blur-md border-t border-white/10 grid grid-cols-5 items-center justify-items-center z-50 px-1 select-none"
      style={{
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        height: 'calc(62px + env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* 1. Sảnh */}
      <button 
        type="button"
        className={`b-nav-item w-full min-h-[44px] flex flex-col items-center justify-center gap-1 transition-all active:scale-90 cursor-pointer ${
          activeTab === 'feed' ? 'text-white font-semibold' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
        }`}
        onClick={handleSanhClick}
        title="Sảnh trực tuyến"
      >
        <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'feed' ? 'bg-white/10 shadow-sm' : ''}`}>
          <Compass size={22} strokeWidth={1.75} />
        </div>
        <span className="text-[10px] tracking-tight font-medium">Sảnh</span>
      </button>

      {/* 2. Cộng đồng */}
      <button 
        type="button"
        className={`b-nav-item w-full min-h-[44px] flex flex-col items-center justify-center gap-1 transition-all active:scale-90 cursor-pointer ${
          activeTab === 'groups' ? 'text-white font-semibold' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
        }`}
        onClick={handleCommunityClick}
        title="Cộng đồng"
      >
        <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'groups' ? 'bg-white/10 shadow-sm' : ''}`}>
          <Users size={22} strokeWidth={1.75} />
        </div>
        <span className="text-[10px] tracking-tight font-medium">Cộng đồng</span>
      </button>

      {/* 3. Dò FM (Gradient Indigo -> Violet phát sáng nhẹ shadow-indigo-500/30) */}
      <div className="b-nav-cell flex items-center justify-center w-full min-h-[44px]">
        <button 
          type="button"
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center hover:opacity-95 active:scale-90 transition-all border border-white/20 cursor-pointer"
          onClick={handleFmClick}
          title="Mở Trạm Dò Sóng FM"
        >
          <Radio size={22} strokeWidth={1.75} className="text-white" />
        </button>
      </div>

      {/* 4. Bạn bè & Kết nối */}
      <button 
        type="button"
        className={`b-nav-item w-full min-h-[44px] flex flex-col items-center justify-center gap-1 transition-all active:scale-90 cursor-pointer ${
          activeTab === 'friends' ? 'text-white font-semibold' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
        }`}
        onClick={handleFriendsClick}
        title="Bạn bè"
      >
        <div className={`relative p-1.5 rounded-xl transition-all ${activeTab === 'friends' ? 'bg-white/10 shadow-sm' : ''}`}>
          <UserCheck size={22} strokeWidth={1.75} />
          {pendingFriendsCount > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#10B981] text-zinc-950 text-[9px] font-mono font-bold flex items-center justify-center border-2 border-[#161922] shadow-md animate-pulse">
              {pendingFriendsCount > 9 ? '9+' : pendingFriendsCount}
            </span>
          )}
        </div>
        <span className="text-[10px] tracking-tight font-medium">Bạn bè</span>
      </button>

      {/* 5. Hồ sơ */}
      <button 
        type="button"
        className={`b-nav-item w-full min-h-[44px] flex flex-col items-center justify-center gap-1 transition-all active:scale-90 cursor-pointer ${
          activeTab === 'profile' ? 'text-white font-semibold' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
        }`}
        onClick={handleProfileClick}
        title="Hồ sơ cá nhân"
      >
        <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-white/10 shadow-sm' : ''}`}>
          <User size={22} strokeWidth={1.75} />
        </div>
        <span className="text-[10px] tracking-tight font-medium">Hồ sơ</span>
      </button>
    </nav>
  );
};

export default MobileBottomNav;
