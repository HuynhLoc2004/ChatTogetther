import { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, Upload, Trash2, User, Mail, Phone, 
  MapPin, Calendar, Lock, ShieldCheck, Check, Edit3, 
  Loader2, UserCheck, Clock, UserPlus, PhoneCall, KeyRound, Sparkles
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import TalovinLogo from '../components/TalovinLogo';

export const UserProfileModal = ({ userId, onClose, onStartPrivateCall, currentUserId }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'account' | 'security'
  const [submitting, setSubmitting] = useState(false);

  // Dữ liệu hồ sơ
  const [editData, setEditData] = useState({
    nickname: '',
    age: '',
    location: '',
    bio: '',
    email: '',
    phone: '',
    avatar: ''
  });

  // Dữ liệu đổi mật khẩu
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);

  const fileInputRef = useRef(null);
  const effectiveUserId = userId || currentUserId || localStorage.getItem('user_id');
  const isMe = currentUserId?.toString() === effectiveUserId?.toString() || (!userId && currentUserId);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const params = effectiveUserId ? { user_id: effectiveUserId } : {};
        const res = await axiosClient.get('/users/profile', { params });
        if (res.data?.data && isMounted) {
          const data = res.data.data;
          setProfile(data);
          setEditData({
            nickname: data.nickname || '',
            age: data.age || '',
            location: data.location || '',
            bio: data.bio || '',
            email: data.email || '',
            phone: data.phone || '',
            avatar: data.avatar || ''
          });
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin cá nhân:", err);
        if (isMounted) {
          const localNickname = localStorage.getItem('nickname') || 'Người dùng';
          const localAvatar = localStorage.getItem('user_avatar') || '';
          setProfile({
            id: effectiveUserId,
            nickname: localNickname,
            account: localStorage.getItem('account') || 'user',
            avatar: localAvatar,
            bio: '',
            vipTier: 'MEMBER',
            customTitle: 'Thành viên'
          });
          setEditData(prev => ({
            ...prev,
            nickname: localNickname,
            avatar: localAvatar
          }));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => { isMounted = false; };
  }, [effectiveUserId]);

  // Xử lý nén ảnh từ thiết bị (400x400 WebP)
  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Vui lòng chọn tệp hình ảnh hợp lệ");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Dung lượng ảnh tối đa 8MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        canvas.width = MAX_SIZE;
        canvas.height = MAX_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, MAX_SIZE, MAX_SIZE);

        const compressedDataUrl = canvas.toDataURL('image/webp', 0.85);
        setEditData(prev => ({ ...prev, avatar: compressedDataUrl }));
        toast.success("Đã chọn ảnh đại diện mới. Bấm 'Lưu hồ sơ' để áp dụng!");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setEditData(prev => ({ ...prev, avatar: '' }));
    toast("Đã bỏ ảnh đại diện");
  };

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        nickname: editData.nickname?.trim() || undefined,
        age: editData.age ? parseInt(editData.age) : undefined,
        location: editData.location?.trim() || undefined,
        bio: editData.bio?.trim() || undefined,
        email: editData.email?.trim() || undefined,
        phone: editData.phone?.trim() || undefined,
        avatar: editData.avatar ? editData.avatar.trim() : ""
      };

      const res = await axiosClient.put('/users/profile', payload);
      if (res.data?.data) {
        setProfile(res.data.data);
        if (editData.nickname) {
          localStorage.setItem('nickname', editData.nickname.trim());
        }
        if (editData.avatar) {
          localStorage.setItem('user_avatar', editData.avatar.trim());
        } else {
          localStorage.removeItem('user_avatar');
        }
        toast.success("Đã lưu thông tin hồ sơ thành công!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật hồ sơ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }

    try {
      setChangingPassword(true);
      await axiosClient.put('/users/change-password', {
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });
      toast.success("Đã đổi mật khẩu thành công!");
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || "Đổi mật khẩu thất bại");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSendFriendRequest = async () => {
    try {
      setSubmitting(true);
      await axiosClient.post('/friends/request', null, {
        params: { receiver_id: effectiveUserId }
      });
      toast.success("Đã gửi lời mời kết bạn!");
      setProfile(prev => ({ ...prev, friendshipStatus: 'PENDING_SENT' }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi gửi lời mời kết bạn");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    try {
      setSubmitting(true);
      await axiosClient.post('/friends/accept', null, {
        params: { sender_id: effectiveUserId }
      });
      toast.success("Đã đồng ý kết bạn!");
      setProfile(prev => ({ ...prev, friendshipStatus: 'ACCEPTED' }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi đồng ý kết bạn");
    } finally {
      setSubmitting(false);
    }
  };

  const getInitial = (name) => {
    if (!name) return 'T';
    return name.trim().charAt(0).toUpperCase();
  };

  // Lọc sạch Robot Dicebear: Tuyệt đối không render robot
  const isRobotAvatar = (url) => {
    if (!url || typeof url !== 'string') return true;
    return url.includes('dicebear.com') || url.includes('bottts') || url.includes('avataaars');
  };

  const currentRawAvatar = editData.avatar || profile?.avatar;
  const validAvatar = currentRawAvatar && !isRobotAvatar(currentRawAvatar) ? currentRawAvatar : null;
  const displayName = editData.nickname || profile?.nickname || profile?.account || "Người dùng";
  const isAdmin = profile?.roles?.includes('ROLE_ADMIN') || profile?.roles?.includes('ROLE_AMDIN');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div 
        className="relative w-full sm:max-w-xl h-[92vh] sm:h-auto sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag pill */}
        <div className="w-10 h-1 rounded-full bg-zinc-700/80 mx-auto mt-2.5 sm:hidden flex-shrink-0"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/80 flex-shrink-0 bg-zinc-900">
          <div className="flex items-center gap-2">
            <TalovinLogo size={18} showText={false} />
            <h2 className="text-zinc-100 font-bold text-sm tracking-tight">
              {isMe ? "Quản Lý Tài Khoản & Hồ Sơ" : "Hồ Sơ Người Dùng"}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="w-7 h-7 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400 text-xs font-mono">
            <Loader2 size={24} className="animate-spin text-zinc-300" />
            <span>Đang đồng bộ hồ sơ người dùng...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            
            {/* HERO PROFILE SECTION */}
            <div className="relative bg-gradient-to-b from-zinc-800/60 to-zinc-900/40 p-5 border-b border-zinc-800/80 flex-shrink-0">
              <div className="flex items-center gap-4">
                {/* Avatar Area */}
                <div className="relative group flex-shrink-0">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-zinc-800 border-2 border-zinc-700 overflow-hidden shadow-lg flex items-center justify-center relative">
                    {validAvatar ? (
                      <img src={validAvatar} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-white font-bold text-2xl select-none">
                        {getInitial(displayName)}
                      </div>
                    )}

                    {/* Camera click overlay for current user */}
                    {isMe && (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                        title="Đổi ảnh đại diện"
                      >
                        <Camera size={18} />
                        <span className="text-[9px] font-mono mt-0.5">Đổi ảnh</span>
                      </div>
                    )}
                  </div>

                  {isMe && (
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md transition-all active:scale-90"
                      title="Tải ảnh mới từ máy"
                    >
                      <Camera size={13} />
                    </button>
                  )}

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleAvatarFileSelect} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>

                {/* Identity Meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-zinc-100 font-bold text-base tracking-tight truncate">{displayName}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${isAdmin ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'}`}>
                      {isAdmin ? "Quản trị viên" : "Thành viên"}
                    </span>
                  </div>
                  <span className="text-zinc-500 font-mono text-xs block mb-2">@{profile?.account}</span>

                  {isMe ? (
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-all"
                      >
                        <Upload size={12} />
                        <span>Tải ảnh từ máy</span>
                      </button>
                      {validAvatar && (
                        <button 
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="p-1.5 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition-colors"
                          title="Gỡ ảnh về chữ cái"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {profile?.friendshipStatus === 'ACCEPTED' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium">
                          <UserCheck size={13} /> Bạn bè
                        </span>
                      ) : profile?.friendshipStatus === 'PENDING_SENT' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-medium">
                          <Clock size={13} /> Đã gửi lời mời
                        </span>
                      ) : profile?.friendshipStatus === 'PENDING_RECEIVED' ? (
                        <button 
                          onClick={handleAcceptFriendRequest}
                          disabled={submitting}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md transition-all"
                        >
                          <UserPlus size={13} /> Đồng ý kết bạn
                        </button>
                      ) : (
                        <button 
                          onClick={handleSendFriendRequest}
                          disabled={submitting}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium shadow-md transition-all"
                        >
                          <UserPlus size={13} /> Kết bạn
                        </button>
                      )}

                      {onStartPrivateCall && (
                        <button 
                          onClick={() => { onClose(); onStartPrivateCall(profile); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md transition-all"
                        >
                          <PhoneCall size={13} /> Đàm thoại 1-1
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RESPONSIVE SEGMENTED CONTROL TABS (Chia 3 đều nhau 100% không bao giờ tràn lề) */}
            {isMe && (
              <div className="px-5 pt-3 flex-shrink-0">
                <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-950/80 rounded-2xl border border-zinc-800/80">
                  <button 
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-medium transition-all ${activeTab === 'profile' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <User size={13} />
                    <span>Hồ sơ</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setActiveTab('account')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-medium transition-all ${activeTab === 'account' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <Mail size={13} />
                    <span>Liên hệ</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setActiveTab('security')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-medium transition-all ${activeTab === 'security' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <Lock size={13} />
                    <span>Bảo mật</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENTS */}
            <div className="p-5 flex-1">
              
              {/* TAB 1: THÔNG TIN HỒ SƠ */}
              {activeTab === 'profile' && (
                <div>
                  {isMe ? (
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      <div>
                        <label className="block text-zinc-300 text-xs font-medium mb-1">Tên hiển thị (Biệt danh)</label>
                        <input 
                          type="text" 
                          value={editData.nickname}
                          onChange={(e) => setEditData(prev => ({ ...prev, nickname: e.target.value }))}
                          placeholder="Nhập biệt danh của bạn..."
                          maxLength={40}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-zinc-300 text-xs font-medium mb-1 flex items-center gap-1">
                            <Calendar size={12} className="text-zinc-500" /> Tuổi
                          </label>
                          <input 
                            type="number" 
                            value={editData.age}
                            onChange={(e) => setEditData(prev => ({ ...prev, age: e.target.value }))}
                            placeholder="VD: 22"
                            min={1}
                            max={120}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                          />
                        </div>

                        <div>
                          <label className="block text-zinc-300 text-xs font-medium mb-1 flex items-center gap-1">
                            <MapPin size={12} className="text-zinc-500" /> Nơi sinh sống
                          </label>
                          <input 
                            type="text" 
                            value={editData.location}
                            onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="VD: TP. Hồ Chí Minh"
                            maxLength={80}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-zinc-300 text-xs font-medium mb-1">Tiểu sử / Lời giới thiệu</label>
                        <textarea 
                          rows="3"
                          value={editData.bio}
                          onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                          placeholder="Chia sẻ đôi dòng về công việc, sở thích âm nhạc hoặc tâm sự..."
                          maxLength={300}
                          className="w-full p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                        />
                      </div>

                      <div className="pt-2">
                        <button 
                          type="submit" 
                          disabled={submitting}
                          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md transition-all disabled:opacity-50 active:scale-[0.98]"
                        >
                          {submitting ? "Đang lưu thay đổi..." : "Lưu thay đổi hồ sơ"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Chế độ xem người khác */
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80">
                        <span className="text-[10px] font-mono text-zinc-500 block mb-1">Tiểu sử</span>
                        <p className="text-xs text-zinc-200 font-sans leading-relaxed">
                          {profile?.bio || "Người dùng này chưa cập nhật tiểu sử."}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/80">
                          <span className="text-[10px] font-mono text-zinc-500 block mb-1 flex items-center gap-1">
                            <Calendar size={11} /> Tuổi
                          </span>
                          <span className="text-xs text-zinc-200 font-medium">
                            {profile?.age ? `${profile.age} tuổi` : "Chưa cập nhật"}
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/80">
                          <span className="text-[10px] font-mono text-zinc-500 block mb-1 flex items-center gap-1">
                            <MapPin size={11} /> Nơi sinh sống
                          </span>
                          <span className="text-xs text-zinc-200 font-medium">
                            {profile?.location || "Chưa cập nhật"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TÀI KHOẢN & LIÊN HỆ */}
              {activeTab === 'account' && isMe && (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-zinc-300 text-xs font-medium mb-1">Tài khoản đăng nhập</label>
                    <input 
                      type="text" 
                      value={profile?.account || ''}
                      disabled
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 text-zinc-400 font-mono text-xs cursor-not-allowed"
                    />
                    <span className="text-[10px] text-zinc-500 font-mono mt-1 block">Tên tài khoản là định danh duy nhất và không thể thay đổi.</span>
                  </div>

                  <div>
                    <label className="block text-zinc-300 text-xs font-medium mb-1">Email liên hệ</label>
                    <input 
                      type="email" 
                      value={editData.email}
                      onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                      maxLength={80}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 text-xs font-medium mb-1">Số điện thoại</label>
                    <input 
                      type="tel" 
                      value={editData.phone}
                      onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="0912 345 678"
                      maxLength={20}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit" 
                      disabled={submitting}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                      {submitting ? "Đang lưu..." : "Cập nhật thông tin liên hệ"}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: BẢO MẬT & MẬT KHẨU */}
              {activeTab === 'security' && isMe && (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex items-start gap-2.5">
                    <KeyRound size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Để bảo vệ tài khoản, mật khẩu mới cần có độ dài tối thiểu 6 ký tự. Vui lòng không chia sẻ mật khẩu cho người khác.
                    </p>
                  </div>

                  <div>
                    <label className="block text-zinc-300 text-xs font-medium mb-1">Mật khẩu hiện tại *</label>
                    <input 
                      type="password" 
                      required
                      value={passwordData.oldPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, oldPassword: e.target.value }))}
                      placeholder="Nhập mật khẩu đang dùng..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 text-xs font-medium mb-1">Mật khẩu mới *</label>
                    <input 
                      type="password" 
                      required
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Tối thiểu 6 ký tự..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 text-xs font-medium mb-1">Xác nhận mật khẩu mới *</label>
                    <input 
                      type="password" 
                      required
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Nhập lại mật khẩu mới..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit" 
                      disabled={changingPassword}
                      className="w-full py-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs shadow-md transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                      {changingPassword ? "Đang cập nhật..." : "Cập nhật mật khẩu mới"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;
