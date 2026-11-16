import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, UserCheck, Search, MessageSquare, Phone, Video, 
  UserMinus, UserPlus, Check, X, Shield, Clock, Sparkles, 
  Loader2, ExternalLink, ArrowRight, User, AlertCircle
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import UserAvatar from './UserAvatar';
import { usePresence } from '../context/PresenceContext';

export const FriendsSection = ({
  currentUserId,
  currentUserName,
  currentUserAvatar,
  navigate: propNavigate,
  onStartPrivateCall
}) => {
  const localNavigate = useNavigate();
  const navigate = propNavigate || localNavigate;
  const location = useLocation();
  const { isUserOnline } = usePresence();

  // Tab con trong Bạn bè: 'friends' (Danh sách bạn bè) | 'pending' (Lời mời chờ duyệt) | 'explore' (Tìm kiếm & Khám phá mới)
  const [subTab, setSubTab] = useState('friends');
  const [friends, setFriends] = useState(() => {
    try {
      const cached = localStorage.getItem('talovin_dm_friends_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });
  const [pending, setPending] = useState(() => {
    try {
      const cached = localStorage.getItem('talovin_pending_friends_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('talovin_dm_friends_cache');
      const parsed = cached ? JSON.parse(cached) : [];
      return !(parsed && parsed.length > 0);
    } catch (_) {
      return true;
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [actionInProgress, setActionInProgress] = useState({});
  const [confirmUnfriendId, setConfirmUnfriendId] = useState(null);

  // Tìm kiếm toàn hệ thống
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

  // Nạp dữ liệu Bạn bè & Lời mời
  const fetchData = async () => {
    try {
      // Chỉ bật spinner nếu chưa có dữ liệu trong bộ nhớ đệm
      if (friends.length === 0) {
        setLoading(true);
      }
      const [friendsRes, pendingRes] = await Promise.all([
        axiosClient.get('/friends/list').catch(() => ({ data: { data: [] } })),
        axiosClient.get('/friends/pending').catch(() => ({ data: { data: [] } }))
      ]);
      const friendList = friendsRes.data?.data || [];
      const pendingList = pendingRes.data?.data || [];
      setFriends(friendList);
      setPending(pendingList);

      // Lưu cache cục bộ để các trang khác nạp tức thì
      try {
        localStorage.setItem('talovin_dm_friends_cache', JSON.stringify(friendList));
        localStorage.setItem('talovin_pending_friends_cache', JSON.stringify(pendingList));
      } catch (_) {}
    } catch (err) {
      console.error("Lỗi lấy danh sách bạn bè:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Debounced search toàn hệ thống khi gõ từ khóa
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
        console.error("Lỗi tìm kiếm thành viên:", err);
      } finally {
        setIsSearchingGlobal(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Gửi lời mời kết bạn mới
  const handleSendFriendRequest = async (targetUser) => {
    const targetUserId = targetUser?.id;
    if (!targetUserId) return;
    try {
      setActionInProgress(prev => ({ ...prev, [targetUserId]: true }));
      const res = await axiosClient.post(`/friends/request/${targetUserId}`, null, {
        params: { receiver_id: targetUserId, user_id: targetUserId }
      });
      toast.success(res.data?.message || `Đã gửi lời mời kết bạn đến ${targetUser.nickname || targetUser.account}!`);
      setGlobalSearchResults(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, friendshipStatus: 'PENDING_SENT' } : u
      ));
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi lời mời kết bạn");
    } finally {
      setActionInProgress(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  // Đồng ý lời mời kết bạn
  const handleAccept = async (sender) => {
    const senderId = sender?.id;
    if (!senderId) return;
    try {
      setActionInProgress(prev => ({ ...prev, [senderId]: true }));
      await axiosClient.post(`/friends/accept/${senderId}`, null, {
        params: { sender_id: senderId }
      });
      toast.success(`Đã trở thành bạn bè với ${sender.nickname || sender.account}!`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi chấp nhận kết bạn!");
    } finally {
      setActionInProgress(prev => ({ ...prev, [senderId]: false }));
    }
  };

  // Từ chối lời mời kết bạn
  const handleDecline = async (sender) => {
    const senderId = sender?.id;
    if (!senderId) return;
    try {
      setActionInProgress(prev => ({ ...prev, [senderId]: true }));
      await axiosClient.post(`/friends/decline/${senderId}`, null, {
        params: { sender_id: senderId }
      });
      toast.success(`Đã từ chối lời mời từ ${sender.nickname || sender.account}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi từ chối lời mời!");
    } finally {
      setActionInProgress(prev => ({ ...prev, [senderId]: false }));
    }
  };

  // Hủy kết bạn (Unfriend)
  const handleRemoveFriend = async (friendId, nickname) => {
    setConfirmUnfriendId(null);
    try {
      await axiosClient.post(`/friends/remove/${friendId}`, null, {
        params: { friend_id: friendId }
      });
      toast.success(`Đã hủy kết bạn với ${nickname || 'thành viên'}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi hủy kết bạn!");
    }
  };

  // Mở Direct Messages 1-1
  const handleOpenDirectChat = (friend) => {
    if (!friend?.id) return;
    const fromPath = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/friends';
    navigate(`/messages?userId=${friend.id}&from=${encodeURIComponent(fromPath)}`, {
      state: {
        targetUser: {
          id: friend.id,
          account: friend.account,
          nickname: friend.nickname || friend.account,
          avatar: friend.avatar
        }
      }
    });
  };

  // Khởi động cuộc gọi thoại 1-1
  const handleAudioCall = (friend) => {
    if (!friend?.id) return;
    if (onStartPrivateCall) {
      onStartPrivateCall(friend);
      return;
    }
    const fromPath = typeof window !== 'undefined' ? window.location.pathname : '/friends';
    navigate(`/call/direct/${friend.id}?type=audio&from=${encodeURIComponent(fromPath)}`);
  };

  // Khởi động cuộc gọi video 1-1
  const handleVideoCall = (friend) => {
    if (!friend?.id) return;
    const fromPath = typeof window !== 'undefined' ? window.location.pathname : '/friends';
    navigate(`/call/direct/${friend.id}?type=video&from=${encodeURIComponent(fromPath)}`);
  };

  // Xem trang cá nhân
  const handleViewProfile = (userId) => {
    if (!userId) return;
    const fromPath = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/friends';
    navigate(`/profile/${userId}?from=${encodeURIComponent(fromPath)}`);
  };

  // Lọc danh sách bạn bè theo từ khóa tìm kiếm
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const q = searchQuery.toLowerCase().trim().replace(/^@+/, '');
    return friends.filter(f => {
      const name = (f.nickname || '').toLowerCase();
      const acc = (f.account || '').toLowerCase();
      return name.includes(q) || acc.includes(q);
    });
  }, [friends, searchQuery]);

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 animate-in fade-in duration-200">
      
      {/* 1. Header Khối Bạn Bè & Thống Kê */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white m-0">
              Bạn Bè & Kết Nối
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Kết nối, trò chuyện trực tiếp và mở rộng mạng lưới bạn bè trên Talovin
          </p>
        </div>

        {/* 3 Nút Tab chuyển đổi phân loại (Segmented Controls) */}
        <div className="flex items-center bg-zinc-900/90 border border-zinc-800 p-1 rounded-2xl shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('friends')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'friends'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UserCheck size={14} />
            <span>Bạn bè</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              subTab === 'friends' ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {friends.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('pending')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 relative ${
              subTab === 'pending'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock size={14} />
            <span>Lời mời</span>
            {pending.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold animate-pulse">
                {pending.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('explore')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'explore'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles size={14} className={subTab === 'explore' ? 'text-amber-500' : ''} />
            <span>Tìm kiếm mới</span>
          </button>
        </div>
      </div>

      {/* 2. Thanh Tìm Kiếm Trực Quan */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            subTab === 'explore'
              ? "Nhập tên hoặc @account để tìm thành viên mới..."
              : "Tìm trong danh sách bạn bè..."
          }
          className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:border-zinc-500 transition-colors shadow-inner"
        />
        {searchQuery && (
          <button 
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-xs"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* 3. Khung Nội Dung Chính Theo Từng Tab */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
          <Loader2 size={24} className="animate-spin text-zinc-400" />
          <span className="text-xs">Đang tải danh sách kết nối...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: DANH SÁCH BẠN BÈ */}
          {subTab === 'friends' && (
            <div>
              {filteredFriends.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-zinc-900/30 rounded-3xl border border-zinc-800/60 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
                    <Users size={24} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-200 mb-1">
                    {searchQuery ? "Không tìm thấy bạn bè phù hợp" : "Chưa có bạn bè nào trong danh sách"}
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm mb-4">
                    {searchQuery 
                      ? `Thử tìm kiếm với từ khóa khác hoặc chuyển sang tab "Tìm kiếm mới".`
                      : `Hãy khám phá cộng đồng và gửi lời mời kết bạn để cùng trò chuyện, gọi điện trực tiếp.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubTab('explore')}
                    className="px-4 py-2 rounded-xl bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <UserPlus size={14} />
                    <span>Tìm kiếm bạn bè mới</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredFriends.map((f) => {
                    const online = isUserOnline(f.id) || Boolean(f.isOnline);
                    const displayName = f.nickname || f.account || 'Bạn bè';
                    const isConfirming = confirmUnfriendId === f.id;

                    return (
                      <div
                        key={f.id}
                        className="group p-3 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 transition-all flex items-center justify-between gap-3 shadow-sm"
                      >
                        {/* Avatar & Thông tin */}
                        <div 
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                          onClick={() => handleViewProfile(f.id)}
                          title={`Xem trang cá nhân của ${displayName}`}
                        >
                          <div className="relative shrink-0">
                            <UserAvatar
                              avatarUrl={f.avatar}
                              username={f.account}
                              name={displayName}
                              size={44}
                              className="w-11 h-11 rounded-full border border-zinc-800"
                            />
                            <span 
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                                online ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
                              }`} 
                              title={online ? "Đang trực tuyến" : "Ngoại tuyến"}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs sm:text-sm font-bold text-zinc-100 truncate group-hover:text-emerald-400 transition-colors">
                                {displayName}
                              </h4>
                              {f.isVerified && (
                                <Shield size={12} className="text-emerald-400 shrink-0 fill-emerald-400/20" />
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 font-mono truncate mt-0.5">
                              @{f.account}
                            </p>
                            <span className={`text-[10px] font-medium ${online ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}`}>
                              {online ? 'Trực tuyến' : 'Ngoại tuyến'}
                            </span>
                          </div>
                        </div>

                        {/* Nút hành động nhanh: Nhắn tin | Gọi điện | Menu */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isConfirming ? (
                            <div className="flex items-center gap-1 animate-in fade-in duration-150">
                              <button
                                type="button"
                                onClick={() => handleRemoveFriend(f.id, displayName)}
                                className="px-2 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold transition-all active:scale-95"
                                title="Xác nhận hủy kết bạn"
                              >
                                Xóa
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmUnfriendId(null)}
                                className="px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] transition-all"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenDirectChat(f)}
                                className="w-8 h-8 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 flex items-center justify-center transition-all active:scale-95 shadow-sm"
                                title="Nhắn tin"
                              >
                                <MessageSquare size={14} className="fill-zinc-950" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAudioCall(f)}
                                className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white flex items-center justify-center transition-all active:scale-95 border border-zinc-700/60"
                                title="Gọi thoại"
                              >
                                <Phone size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleVideoCall(f)}
                                className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white flex items-center justify-center transition-all active:scale-95 border border-zinc-700/60 hidden sm:flex"
                                title="Gọi video"
                              >
                                <Video size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setConfirmUnfriendId(f.id)}
                                className="w-7 h-8 rounded-xl bg-transparent hover:bg-zinc-800/80 text-zinc-500 hover:text-rose-400 flex items-center justify-center transition-colors"
                                title="Hủy kết bạn"
                              >
                                <UserMinus size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LỜI MỜI KẾT BẠN ĐANG CHỜ DUYỆT */}
          {subTab === 'pending' && (
            <div>
              {pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-zinc-900/30 rounded-3xl border border-zinc-800/60 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
                    <Check size={24} className="text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-200 mb-1">
                    Không có lời mời kết bạn nào
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    Tất cả các lời mời đã được xử lý. Khi có người gửi yêu cầu kết bạn, thông báo sẽ hiển thị tại đây.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pending.map((req) => {
                    const sender = req;
                    const displayName = sender.nickname || sender.account || 'Người dùng';
                    const isBusy = actionInProgress[sender.id];

                    return (
                      <div
                        key={sender.id}
                        className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div 
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                          onClick={() => handleViewProfile(sender.id)}
                          title="Xem trang cá nhân"
                        >
                          <UserAvatar
                            avatarUrl={sender.avatar}
                            username={sender.account}
                            name={displayName}
                            size={44}
                            className="w-11 h-11 rounded-full border border-zinc-800 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-bold text-zinc-100 truncate">
                              {displayName}
                            </h4>
                            <p className="text-[11px] text-zinc-400 font-mono truncate mt-0.5">
                              @{sender.account}
                            </p>
                            <span className="text-[10px] text-emerald-400 font-medium">
                              Đã gửi lời mời kết bạn
                            </span>
                          </div>
                        </div>

                        {/* 2 Nút Đồng ý / Từ chối */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleAccept(sender)}
                            className="h-8 px-3 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-all active:scale-95 shadow-sm disabled:opacity-50 flex items-center gap-1"
                          >
                            <Check size={13} strokeWidth={2.5} />
                            <span>Đồng ý</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDecline(sender)}
                            className="h-8 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs transition-all active:scale-95 border border-zinc-700/60 disabled:opacity-50 flex items-center justify-center"
                            title="Từ chối"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TÌM KIẾM & KHÁM PHÁ THÀNH VIÊN TOÀN HỆ THỐNG */}
          {subTab === 'explore' && (
            <div>
              {!searchQuery.trim() ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-zinc-900/30 rounded-3xl border border-zinc-800/60 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
                    <Search size={22} className="text-amber-400" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-200 mb-1">
                    Tìm kiếm thành viên trên Talovin
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    Gõ tên, biệt danh hoặc tài khoản @account vào ô tìm kiếm bên trên để tìm và kết bạn với người khác.
                  </p>
                </div>
              ) : isSearchingGlobal ? (
                <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
                  <Loader2 size={18} className="animate-spin text-zinc-400" />
                  <span className="text-xs">Đang tìm kiếm...</span>
                </div>
              ) : globalSearchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-zinc-900/30 rounded-3xl border border-zinc-800/60 text-center">
                  <AlertCircle size={22} className="text-zinc-500 mb-2" />
                  <p className="text-xs text-zinc-400">
                    Không tìm thấy thành viên nào khớp với từ khóa "{searchQuery}".
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {globalSearchResults.map((u) => {
                    const isMe = String(u.id) === String(currentUserId);
                    const isFriend = friends.some(f => String(f.id) === String(u.id)) || u.friendshipStatus === 'ACCEPTED';
                    const isPendingSent = u.friendshipStatus === 'PENDING_SENT';
                    const isBusy = actionInProgress[u.id];
                    const displayName = u.nickname || u.account || 'Thành viên';

                    return (
                      <div
                        key={u.id}
                        className="p-3 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900/90 border border-zinc-800/80 transition-all flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div 
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                          onClick={() => handleViewProfile(u.id)}
                          title="Xem trang cá nhân"
                        >
                          <UserAvatar
                            avatarUrl={u.avatar}
                            username={u.account}
                            name={displayName}
                            size={44}
                            className="w-11 h-11 rounded-full border border-zinc-800 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-bold text-zinc-100 truncate">
                              {displayName}
                            </h4>
                            <p className="text-[11px] text-zinc-400 font-mono truncate mt-0.5">
                              @{u.account}
                            </p>
                            {u.bio && (
                              <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                                {u.bio}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isMe ? (
                            <span className="text-[11px] text-zinc-500 font-medium px-2 py-1 rounded-lg bg-zinc-800">
                              Chính bạn
                            </span>
                          ) : isFriend ? (
                            <button
                              type="button"
                              onClick={() => handleOpenDirectChat(u)}
                              className="h-8 px-3 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
                            >
                              <MessageSquare size={13} className="fill-zinc-950" />
                              <span>Nhắn tin</span>
                            </button>
                          ) : isPendingSent ? (
                            <span className="text-[11px] text-zinc-400 font-medium px-2.5 py-1.5 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center gap-1">
                              <Clock size={12} />
                              <span>Đã gửi</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleSendFriendRequest(u)}
                              className="h-8 px-3 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-all active:scale-95 shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <UserPlus size={13} />
                              <span>{isBusy ? '...' : 'Kết bạn'}</span>
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
        </>
      )}

      {/* Khoảng đệm đáy an toàn (Bottom Spacer) để thanh điều hướng di động không che khuất */}
      <div className="h-24 w-full pointer-events-none" />
    </div>
  );
};

export default FriendsSection;
