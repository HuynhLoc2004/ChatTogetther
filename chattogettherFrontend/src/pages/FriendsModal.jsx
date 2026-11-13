import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, User, X, UserCheck, Phone, Clock, UserMinus, 
  MessageSquare, Shield, CheckCircle2, MapPin, Search, 
  ArrowLeft, PhoneCall, Send, Sparkles, UserPlus, AlertCircle
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

export const FriendsModal = ({ onClose, onSelectUser, onStartPrivateCall, navigate: propNavigate }) => {
  const localNavigate = useNavigate();
  const navigate = propNavigate || localNavigate;

  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'pending'
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionInProgress, setActionInProgress] = useState({});
  const [confirmUnfriend, setConfirmUnfriend] = useState(null);

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

  // Lọc bạn bè theo ô tìm kiếm
  const filteredFriends = friends.filter(f => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const name = (f.nickname || '').toLowerCase();
    const acc = (f.account || '').toLowerCase();
    return name.includes(q) || acc.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div 
        className="relative w-full sm:max-w-xl h-[100dvh] sm:h-auto sm:max-h-[88vh] rounded-none sm:rounded-3xl bg-zinc-950 border-0 sm:border border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* STICKY TOP HEADER */}
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
        <div className="p-4 border-b border-zinc-800/70 bg-zinc-900/40 flex-shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Tìm kiếm bạn bè theo tên, biệt danh, @account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 placeholder-zinc-500 transition-colors"
            />
          </div>
        </div>

        {/* SEGMENTED TAB SWITCHER */}
        <div className="px-4 py-2.5 border-b border-zinc-800/50 bg-zinc-900/20 flex-shrink-0">
          <div className="grid grid-cols-2 gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800/80">
            <button 
              type="button"
              onClick={() => setActiveTab('friends')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'friends' 
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm font-bold' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users size={14} />
              <span>Bạn bè ({friends.length})</span>
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all relative ${
                activeTab === 'pending' 
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm font-bold' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clock size={14} />
              <span>Lời mời kết bạn</span>
              {pending.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-zinc-950 font-mono text-[10px] font-bold">
                  {pending.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* LIST CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs font-mono">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin"></div>
              <span>Đang tải danh sách kết nối...</span>
            </div>
          ) : activeTab === 'friends' ? (
            filteredFriends.length === 0 ? (
              <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-3 shadow-inner">
                  <Users size={26} />
                </div>
                <h4 className="text-zinc-200 font-bold text-sm">
                  {searchQuery ? "Không tìm thấy người bạn nào phù hợp" : "Chưa có người bạn nào"}
                </h4>
                <p className="text-zinc-500 text-xs mt-1 max-w-xs leading-relaxed">
                  {searchQuery 
                    ? "Hãy thử tìm kiếm với tên hoặc ký tự khác."
                    : "Tham gia các phòng đàm thoại hoặc nhấp vào avatar của thành viên trên Sảnh để gửi lời mời kết bạn nhé!"}
                </p>
                {!searchQuery && (
                  <button 
                    type="button" 
                    onClick={() => { onClose(); navigate('/'); }}
                    className="mt-4 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold transition-all shadow-md active:scale-95"
                  >
                    Khám phá sảnh trò chuyện
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredFriends.map((friend) => {
                  const hasPhotoAvatar = friend.avatar && !friend.avatar.includes('dicebear') && !friend.avatar.includes('bottts');
                  const friendName = friend.nickname || friend.account || 'Thành viên';
                  
                  return (
                    <div 
                      key={friend.id} 
                      className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm group"
                    >
                      {/* Left: Avatar & Info */}
                      <div 
                        className="flex items-center gap-3 min-w-0 cursor-pointer"
                        onClick={() => {
                          if (onSelectUser) onSelectUser(friend.id);
                        }}
                        title="Xem hồ sơ chi tiết"
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shadow-md">
                            {hasPhotoAvatar ? (
                              <img src={friend.avatar} alt={friendName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-white font-bold text-base">
                                {friendName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-950"></span>
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-zinc-100 font-bold text-sm truncate">{friendName}</span>
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono text-[9px] font-bold uppercase border border-zinc-700/60">
                              PRO
                            </span>
                          </div>
                          <span className="text-zinc-500 font-mono text-xs truncate">
                            {friend.location ? friend.location : `@${friend.account}`}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions Row (Nhắn tin, Gọi thoại, Xem hồ sơ, Hủy kết bạn) */}
                      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60 w-full sm:w-auto justify-end">
                        {/* Nút Nhắn tin 1-1 */}
                        <button
                          type="button"
                          onClick={() => handleOpenDirectChat(friend)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-900/20 transition-all active:scale-95"
                          title="Nhắn tin 1-1"
                        >
                          <MessageSquare size={13} />
                          <span>Nhắn tin</span>
                        </button>

                        {/* Nút Gọi thoại 1-1 */}
                        <button
                          type="button"
                          onClick={() => handleStartCall(friend)}
                          className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-emerald-300 transition-all active:scale-95 border border-zinc-700/60"
                          title="Gọi thoại 1-1"
                        >
                          <Phone size={14} />
                        </button>

                        {/* Nút Xem Hồ sơ */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectUser) onSelectUser(friend.id);
                          }}
                          className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all active:scale-95 border border-zinc-700/60"
                          title="Xem thông tin cá nhân"
                        >
                          <User size={14} />
                        </button>

                        {/* Nút Hủy kết bạn */}
                        <button
                          type="button"
                          onClick={() => setConfirmUnfriend(friend)}
                          className="p-2 rounded-xl bg-zinc-900 hover:bg-red-950/60 text-zinc-500 hover:text-red-400 transition-all active:scale-95 border border-zinc-800"
                          title="Hủy kết bạn"
                        >
                          <UserMinus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* TAB: LỜI MỜI KẾT BẠN */
            pending.length === 0 ? (
              <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-3 shadow-inner">
                  <Clock size={26} />
                </div>
                <h4 className="text-zinc-200 font-bold text-sm">Không có lời mời nào</h4>
                <p className="text-zinc-500 text-xs mt-1">Khi có người gửi lời mời kết nối, yêu cầu sẽ xuất hiện tại đây.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
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
                      className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-md">
                          {hasPhotoAvatar ? (
                            <img src={senderAvatar} alt={senderName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-white font-bold text-base">
                              {senderName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-zinc-100 font-bold text-sm truncate">{senderName}</span>
                          <span className="text-zinc-500 font-mono text-xs truncate">@{senderAccount} muốn kết bạn</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0 w-full sm:w-auto justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAccept(senderId, senderName)}
                          className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                        >
                          Đồng ý
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDecline(senderId, senderName)}
                          className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-all border border-zinc-700/60 active:scale-95 disabled:opacity-50"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
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
