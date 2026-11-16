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
    if (onOpenFriends) {
      onOpenFriends();
    } else {
      navigate('/', { state: { openFriends: true } });
    }
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  return (
    <nav className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 grid grid-cols-5 items-center justify-items-center z-50 px-1">
      {/* 1. Sảnh */}
      <button 
        type="button"
        className={`b-nav-item w-full h-full flex flex-col items-center justify-center gap-1 transition-colors ${
          activeTab === 'feed' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
        onClick={handleSanhClick}
        title="Bảng tin trực tuyến"
      >
        <Compass size={18} strokeWidth={activeTab === 'feed' ? 2 : 1.5} />
        <span className="text-[10px] tracking-tight">Sảnh</span>
      </button>

      {/* 2. Cộng đồng */}
      <button 
        type="button"
        className={`b-nav-item w-full h-full flex flex-col items-center justify-center gap-1 transition-colors ${
          activeTab === 'groups' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
        onClick={handleCommunityClick}
        title="Cộng đồng & Thảo luận"
      >
        <Users size={18} strokeWidth={activeTab === 'groups' ? 2 : 1.5} />
        <span className="text-[10px] tracking-tight">Cộng đồng</span>
      </button>

      {/* 3. Dò FM (Nút tròn trắng nổi bật chính giữa w-11 h-11) */}
      <div className="b-nav-cell flex items-center justify-center w-full h-full">
        <button 
          type="button"
          className="w-11 h-11 rounded-full bg-white text-zinc-950 shadow-md flex items-center justify-center hover:bg-zinc-200 active:scale-95 transition-all"
          onClick={handleFmClick}
          title="Mở Trạm Dò Sóng FM"
        >
          <Radio size={20} className="text-zinc-950" />
        </button>
      </div>

      {/* 4. Bạn bè & Kết nối (Thay thế Tin nhắn vì trên Header đã có icon tin nhắn) */}
      <button 
        type="button"
        className={`b-nav-item w-full h-full flex flex-col items-center justify-center gap-1 transition-colors ${
          activeTab === 'friends' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
        onClick={handleFriendsClick}
        title="Bạn bè & Tìm kiếm kết bạn"
      >
        <div className="relative flex items-center justify-center">
          <UserCheck size={18} strokeWidth={activeTab === 'friends' ? 2 : 1.5} />
          {pendingFriendsCount > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-500 text-zinc-950 text-[9px] font-mono font-bold flex items-center justify-center border-2 border-zinc-950 shadow-md animate-pulse">
              {pendingFriendsCount > 9 ? '9+' : pendingFriendsCount}
            </span>
          )}
        </div>
        <span className="text-[10px] tracking-tight">Bạn bè</span>
      </button>

      {/* 5. Hồ sơ */}
      <button 
        type="button"
        className={`b-nav-item w-full h-full flex flex-col items-center justify-center gap-1 transition-colors ${
          activeTab === 'profile' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
        onClick={handleProfileClick}
        title="Hồ sơ cá nhân"
      >
        <div className="relative flex items-center justify-center">
          <User size={18} strokeWidth={activeTab === 'profile' ? 2 : 1.5} />
        </div>
        <span className="text-[10px] tracking-tight">Hồ sơ</span>
      </button>
    </nav>
  );
};

export default MobileBottomNav;
