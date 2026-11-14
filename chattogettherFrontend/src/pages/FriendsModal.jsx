import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, User, X, UserCheck, Phone, Clock, UserMinus, 
  MessageSquare, Shield, CheckCircle2, MapPin, Search, 
  ArrowLeft, PhoneCall, Send, Sparkles, UserPlus, AlertCircle,
  Compass
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

export const FriendsModal = ({ onClose, onSelectUser, onStartPrivateCall, navigate: propNavigate }) => {
  const localNavigate = useNavigate();
  const navigate = propNavigate || localNavigate;

  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'pending' | 'search'
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionInProgress, setActionInProgress] = useState({});
  const [confirmUnfriend, setConfirmUnfriend] = useState(null);

  // Global search state
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [friendsRes, pendingRes] = await Promise.all([
        axiosClient.get('/friends/list'),
        axiosClient.get('/friends/pending')
      ]);
      setFriends(friendsRes.data?.data || []);
      setPending(pendingRes.data?.data || []);
    } catch (err) {
      console.error("Lỗi lấy danh sách bạn bè:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Tìm kiếm toàn bộ thành viên trên server
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 1) {
      setGlobalSearchResults([]);
      setIsSearchingGlobal(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingGlobal(true);
        const cleanQ = q.replace(/^@+/, '').trim();
        const res = await axiosClient.get('/users/search', {
          params: { q: cleanQ || q }
        });
        setGlobalSearchResults(res.data?.data || []);
      } catch (err) {
        console.error("Lỗi tìm kiếm người dùng:", err);
      } finally {
        setIsSearchingGlobal(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Gửi lời mời kết bạn mới
  const handleSendFriendRequest = async (targetUserId, nickname) => {
    if (!targetUserId) return;
    try {
      setActionInProgress(prev => ({ ...prev, [targetUserId]: true }));
      await axiosClient.post('/friends/request', null, {
        params: { receiver_id: targetUserId }
      });
      toast.success(`Đã gửi lời mời kết bạn đến ${nickname || 'thành viên'}!`);
      // Update local status in search results
      setGlobalSearchResults(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, friendshipStatus: 'PENDING_SENT' } : u
      ));
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi lời mời kết bạn");
    } finally {
      setActionInProgress(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  // Đồng ý kết bạn
  const handleAccept = async (senderId, nickname) => {
    if (!senderId) return;
    try {
      setActionInProgress(prev => ({ ...prev, [senderId]: true }));
      await axiosClient.post('/friends/accept', null, {
        params: { sender_id: senderId }
      });
      toast.success(`Đã trở thành bạn bè với ${nickname || 'thành viên'}!`, { id: 'friend-act' });
      fetchData();
      setGlobalSearchResults(prev => prev.map(u => 
        u.id === senderId ? { ...u, friendshipStatus: 'ACCEPTED' } : u
      ));
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi chấp nhận kết bạn!", { id: 'friend-act' });
    } finally {
      setActionInProgress(prev => ({ ...prev, [senderId]: false }));
    }
  };

  // Từ chối kết bạn
  const handleDecline = async (senderId, nickname) => {
    if (!senderId) return;
    try {
      setActionInProgress(prev => ({ ...prev, [senderId]: true }));
      await axiosClient.post('/friends/decline', null, {
        params: { sender_id: senderId }
      });
      toast.success(`Đã từ chối lời mời từ ${nickname || 'thành viên'}`, { id: 'friend-act' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi từ chối lời mời!", { id: 'friend-act' });
    } finally {
      setActionInProgress(prev => ({ ...prev, [senderId]: false }));
    }
  };

  // Hủy kết bạn
  const handleRemoveFriend = async (friendId, nickname) => {
    setConfirmUnfriend(null);
    try {
      await axiosClient.post('/friends/remove', null, {
        params: { friend_id: friendId }
      });
      toast.success(`Đã hủy kết bạn với ${nickname || 'thành viên'}`, { id: 'friend-act' });
      fetchData();
      setGlobalSearchResults(prev => prev.map(u => 
        u.id === friendId ? { ...u, friendshipStatus: 'NONE' } : u
      ));
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi hủy kết bạn!", { id: 'friend-act' });
    }
  };

  // Mở đoạn chat 1-1 ngay lập tức
  const handleOpenDirectChat = async (friend) => {
    try {
      const myName = localStorage.getItem('nickname') || 'Tôi';
      const friendName = friend.nickname || friend.account || 'Bạn bè';
      const roomName = `Chat: ${myName} & ${friendName}`;
      
      const res = await axiosClient.post('/rooms/create-room', {
        roomName: roomName,
        password: null
      });

      if (res.data && res.data.data) {
        toast.success(`Đang mở đoạn chat cùng ${friendName}!`);
        onClose();
        navigate(`/room/${res.data.data.id}`);
      }
    } catch (err) {
      if (onSelectUser) {
        onSelectUser(friend.id);
      }
    }
  };

  // Gọi thoại 1-1
  const handleStartCall = async (friend) => {
    if (onStartPrivateCall) {
      onClose();
      onStartPrivateCall(friend);
      return;
    }

    try {
      const myName = localStorage.getItem('nickname') || 'Tôi';
      const friendName = friend.nickname || friend.account || 'Bạn bè';
      const roomName = `Cuộc gọi: ${myName} & ${friendName}`;
      
      const res = await axiosClient.post('/rooms/create-room', {
        roomName: roomName,
        password: null
      });

      if (res.data && res.data.data) {
        onClose();
        navigate(`/room/${res.data.data.id}?autoCall=true`);
      }
    } catch (err) {
      toast.error("Không thể kết nối cuộc gọi lúc này!");
    }
  };

  // Lọc bạn bè hiện có theo ô tìm kiếm
  const filteredFriends = friends.filter(f => {
    if (!searchQuery.trim()) return true;
    const cleanQ = searchQuery.trim().replace(/^@+/, '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const name = (f.nickname || '').toLowerCase();
    const acc = (f.account || '').toLowerCase();
    return name.includes(q) || acc.includes(q) || acc.includes(cleanQ) || name.includes(cleanQ);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div 
        className="relative w-full sm:max-w-xl h-[92dvh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl bg-zinc-950 border-0 sm:border border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800 bg-zinc-900/98 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <button 
              type="button"
              onClick={onClose} 
              className="px-2.5 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white flex items-center gap-1.5 text-xs font-semibold transition-all active:scale-95 border border-zinc-700/60"
              title="Quay lại"
            >
              <ArrowLeft size={16} />
              <span>Quay lại</span>
            </button>
            <div className="h-4 w-[1px] bg-zinc-800"></div>
            <div className="flex items-center gap-2">
              <Users size={17} className="text-zinc-300" />
              <h2 className="text-zinc-100 font-bold text-sm tracking-tight">Bạn Bè & Kết Nối</h2>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
            title="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* SEARCH BOX */}
        <div className="p-3.5 sm:p-4 border-b border-zinc-800/70 bg-zinc-900/40 flex-shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Tìm kiếm thành viên, biệt danh hoặc @account..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim().length > 0 && activeTab === 'pending') {
                  setActiveTab('friends');
                }
              }}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 placeholder-zinc-500 transition-colors"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 3-COLUMN TAB SWITCHER */}
        <div className="px-3.5 sm:px-4 py-2 border-b border-zinc-800/50 bg-zinc-900/20 flex-shrink-0">
          <div className="grid grid-cols-3 gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800/80">
            <button 
              type="button"
              onClick={() => setActiveTab('friends')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'friends' 
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm font-bold' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users size={13} />
              <span>Bạn bè ({friends.length})</span>
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all relative ${
                activeTab === 'pending' 
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm font-bold' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clock size={13} />
              <span>Lời mời</span>
              {pending.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-zinc-950 font-mono text-[9px] font-bold">
                  {pending.length}
                </span>
              )}
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('search')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'search' 
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm font-bold' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles size={13} />
              <span>Khám phá mới</span>
            </button>
          </div>
        </div>

        {/* LIST CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5 overscroll-contain">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs font-mono">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin"></div>
              <span>Đang tải danh sách kết nối...</span>
            </div>
          ) : activeTab === 'friends' ? (
            /* TAB: BẠN BÈ HIỆN TẠI */
            filteredFriends.length === 0 ? (
              <div className="py-8 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-2.5">
                  <Users size={22} />
                </div>
                <h4 className="text-zinc-200 font-bold text-xs sm:text-sm">
                  {searchQuery ? "Không có bạn bè khớp từ khóa" : "Chưa có người bạn nào"}
                </h4>
                <p className="text-zinc-500 text-xs mt-1 max-w-xs leading-relaxed">
                  {searchQuery 
                    ? "Người dùng này chưa có trong danh sách bạn bè của bạn."
                    : "Tham gia các phòng đàm thoại hoặc tìm kiếm thành viên mới để mở rộng kết nối!"}
                </p>
                {searchQuery ? (
                  <button 
                    type="button" 
                    onClick={() => setActiveTab('search')}
                    className="mt-3 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    <span>Mở mục Khám phá toàn Talovin</span>
                    <ArrowRight size={13} />
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={() => setActiveTab('search')}
                    className="mt-3 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-all shadow-md active:scale-95"
                  >
                    Khám phá thành viên mới
                  </button>
                )}

                {/* HIỂN THỊ TRỰC TIẾP KẾT QUẢ TÌM THẤY TRÊN HỆ THỐNG NẾU CÓ */}
                {searchQuery && globalSearchResults.length > 0 && (
                  <div className="w-full mt-6 text-left border-t border-zinc-800/80 pt-4">
                    <div className="flex items-center justify-between mb-2.5 px-1">
                      <span className="text-zinc-300 text-xs font-semibold">Tìm thấy trên Talovin ({globalSearchResults.length})</span>
                      <button 
                        type="button" 
                        onClick={() => setActiveTab('search')}
                        className="text-[11px] text-zinc-400 hover:text-white transition-colors"
                      >
                        Xem tất cả →
                      </button>
                    </div>
                    <div className="space-y-2">
                      {globalSearchResults.slice(0, 5).map((user) => {
                        const hasPhotoAvatar = user.avatar && !user.avatar.includes('dicebear') && !user.avatar.includes('bottts');
                        const uName = user.nickname || user.account || 'Thành viên';
                        const isBusy = actionInProgress[user.id];
                        return (
                          <div 
                            key={`search-preview-${user.id}`}
                            className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-2.5 shadow-sm"
                          >
                            <div 
                              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                              onClick={() => {
                                if (onSelectUser) onSelectUser(user.id);
                              }}
                            >
                              <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                                {hasPhotoAvatar ? (
                                  <img src={user.avatar} alt={uName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-white font-bold text-xs">
                                    {uName.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-zinc-100 font-bold text-xs truncate">{uName}</span>
                                <span className="text-zinc-500 font-mono text-[11px] truncate">@{user.account}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {user.friendshipStatus === 'ACCEPTED' ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDirectChat(user)}
                                  className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700"
                                >
                                  Nhắn tin
                                </button>
                              ) : user.friendshipStatus === 'PENDING_SENT' ? (
                                <span className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs font-medium font-mono">
                                  Đã gửi lời mời
                                </span>
                              ) : user.friendshipStatus === 'PENDING_RECEIVED' ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleAccept(user.id, uName)}
                                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold"
                                >
                                  Đồng ý
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleSendFriendRequest(user.id, uName)}
                                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold flex items-center gap-1 shadow-sm active:scale-95"
                                >
                                  <UserPlus size={13} />
                                  <span>Kết bạn</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFriends.map((friend) => {
                  const hasPhotoAvatar = friend.avatar && !friend.avatar.includes('dicebear') && !friend.avatar.includes('bottts');
                  const friendName = friend.nickname || friend.account || 'Thành viên';
                  
                  return (
                    <div 
                      key={friend.id} 
                      className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/90 hover:border-zinc-700/80 transition-all flex items-center justify-between gap-2.5 shadow-sm"
                    >
                      {/* Left: Avatar & Info */}
                      <div 
                        className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                        onClick={() => {
                          if (onSelectUser) onSelectUser(friend.id);
                        }}
                        title="Xem hồ sơ chi tiết"
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shadow-sm">
                            {hasPhotoAvatar ? (
                              <img src={friend.avatar} alt={friendName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-white font-bold text-sm">
                                {friendName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-zinc-950"></span>
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-zinc-100 font-bold text-xs truncate">{friendName}</span>
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono text-[9px] font-bold uppercase border border-zinc-700/60">
                              PRO
                            </span>
                          </div>
                          <span className="text-zinc-500 font-mono text-[11px] truncate">
                            @{friend.account}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions Row */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Nút Nhắn tin */}
                        <button
                          type="button"
                          onClick={() => handleOpenDirectChat(friend)}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-all active:scale-95"
                          title="Nhắn tin 1-1"
                        >
                          <MessageSquare size={12} />
                          <span className="hidden sm:inline">Nhắn tin</span>
                        </button>

                        {/* Nút Gọi thoại */}
                        <button
                          type="button"
                          onClick={() => handleStartCall(friend)}
                          className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 transition-all border border-zinc-700/60"
                          title="Gọi thoại 1-1"
                        >
                          <Phone size={13} />
                        </button>

                        {/* Nút Xem Hồ sơ */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectUser) onSelectUser(friend.id);
                          }}
                          className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all border border-zinc-700/60"
                          title="Xem hồ sơ"
                        >
                          <User size={13} />
                        </button>

                        {/* Nút Hủy kết bạn */}
                        <button
                          type="button"
                          onClick={() => setConfirmUnfriend(friend)}
                          className="p-1.5 rounded-xl bg-zinc-900 hover:bg-red-950/60 text-zinc-500 hover:text-red-400 transition-all border border-zinc-800"
                          title="Hủy kết bạn"
                        >
                          <UserMinus size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : activeTab === 'pending' ? (
            /* TAB: LỜI MỜI KẾT BẠN */
            pending.length === 0 ? (
              <div className="py-14 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-2.5">
                  <Clock size={22} />
                </div>
                <h4 className="text-zinc-200 font-bold text-xs sm:text-sm">Không có lời mời nào</h4>
                <p className="text-zinc-500 text-xs mt-1">Khi có người gửi lời mời kết nối, yêu cầu sẽ xuất hiện tại đây.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((req) => {
                  const senderId = req.senderDTO?.id || req.id;
                  const senderName = req.senderDTO?.nickname || req.nickname || req.senderDTO?.account || req.account || 'Thành viên';
                  const senderAccount = req.senderDTO?.account || req.account || 'user';
                  const senderAvatar = req.senderDTO?.avatar || req.avatar;
                  const hasPhotoAvatar = senderAvatar && !senderAvatar.includes('dicebear') && !senderAvatar.includes('bottts');
                  const isBusy = actionInProgress[senderId];

                  return (
                    <div 
                      key={senderId} 
                      className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-2.5 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                          {hasPhotoAvatar ? (
                            <img src={senderAvatar} alt={senderName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-white font-bold text-sm">
                              {senderName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-zinc-100 font-bold text-xs truncate">{senderName}</span>
                          <span className="text-zinc-500 font-mono text-[11px] truncate">@{senderAccount}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAccept(senderId, senderName)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        >
                          Đồng ý
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDecline(senderId, senderName)}
                          className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all border border-zinc-700/60 active:scale-95 disabled:opacity-50"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* TAB: KHÁM PHÁ / TÌM KIẾM THÀNH VIÊN TOÀN HỆ THỐNG */
            <div className="space-y-3">
              <div className="text-zinc-400 text-xs px-1 flex items-center justify-between">
                <span>Kết quả tìm kiếm thành viên trên Talovin</span>
                {isSearchingGlobal && <span className="text-emerald-400 animate-pulse text-[11px]">Đang tìm...</span>}
              </div>

              {globalSearchResults.length === 0 ? (
                <div className="py-14 px-4 text-center">
                  <Compass size={24} className="mx-auto mb-2 text-zinc-600 opacity-60" />
                  <p className="text-zinc-300 text-xs font-semibold mb-1">
                    {searchQuery ? "Không tìm thấy thành viên nào khớp từ khóa" : "Nhập tên hoặc @account để tìm thành viên"}
                  </p>
                  <p className="text-zinc-500 text-[11px] max-w-xs mx-auto">
                    Bạn có thể tìm bạn bè theo tên hiển thị hoặc tài khoản đã đăng ký trên Talovin.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {globalSearchResults.map((user) => {
                    const hasPhotoAvatar = user.avatar && !user.avatar.includes('dicebear') && !user.avatar.includes('bottts');
                    const uName = user.nickname || user.account || 'Thành viên';
                    const isBusy = actionInProgress[user.id];

                    return (
                      <div 
                        key={user.id}
                        className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-2.5 shadow-sm"
                      >
                        <div 
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                          onClick={() => {
                            if (onSelectUser) onSelectUser(user.id);
                          }}
                        >
                          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                            {hasPhotoAvatar ? (
                              <img src={user.avatar} alt={uName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-white font-bold text-sm">
                                {uName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-zinc-100 font-bold text-xs truncate">{uName}</span>
                            <span className="text-zinc-500 font-mono text-[11px] truncate">@{user.account}</span>
                          </div>
                        </div>

                        {/* Action based on friendshipStatus */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {user.friendshipStatus === 'ACCEPTED' ? (
                            <span className="px-2.5 py-1 rounded-xl bg-zinc-800 text-emerald-400 text-[11px] font-semibold border border-zinc-700 flex items-center gap-1">
                              <CheckCircle2 size={12} /> Bạn bè
                            </span>
                          ) : user.friendshipStatus === 'PENDING_SENT' ? (
                            <span className="px-2.5 py-1 rounded-xl bg-zinc-900 text-amber-400 text-[11px] font-medium border border-zinc-800">
                              Đã gửi lời mời
                            </span>
                          ) : user.friendshipStatus === 'PENDING_RECEIVED' ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAccept(user.id, uName)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              Đồng ý
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleSendFriendRequest(user.id, uName)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                            >
                              <UserPlus size={12} />
                              <span>Kết bạn</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* DIALOG XÁC NHẬN HỦY KẾT BẠN */}
        {confirmUnfriend && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setConfirmUnfriend(null)}>
            <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-2xl text-center space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-zinc-100 font-bold text-sm">Hủy Kết Bạn</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Bạn có chắc chắn muốn hủy kết bạn với <strong>{confirmUnfriend.nickname || confirmUnfriend.account}</strong> không?
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmUnfriend(null)}
                  className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all"
                >
                  Giữ lại
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveFriend(confirmUnfriend.id, confirmUnfriend.nickname)}
                  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Xác nhận Hủy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsModal;
