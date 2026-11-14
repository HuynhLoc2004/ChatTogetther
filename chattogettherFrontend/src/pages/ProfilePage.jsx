import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit3, LogOut, UserPlus, UserCheck, Clock, 
  MapPin, Calendar, Mail, Phone, Lock, Check, X, 
  Camera, Upload, Trash2, Heart, MessageSquare, Repeat, Share2, 
  Bookmark, Shield, Sparkles, PhoneCall, Loader2, Users, FileText
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import toast from 'react-hot-toast';
import TalovinLogo from '../components/TalovinLogo';
import { UserAvatar } from './Home';

const TIME_FORMATTER = (dateStr) => {
  if (!dateStr) return 'Vừa xong';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
           d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  } catch (e) {
    return dateStr;
  }
};

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const currentUserId = localStorage.getItem('user_id');
  const effectiveUserId = userId || currentUserId;
  const isMe = Boolean(currentUserId && String(effectiveUserId) === String(currentUserId));

  // States
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'reposts' | 'saved' | 'friends'
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dữ liệu bài viết, đã lưu, bạn bè
  const [userPosts, setUserPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [userFriends, setUserFriends] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Trạng thái kết bạn (nếu xem người khác)
  const [friendStatus, setFriendStatus] = useState('NONE'); // 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'ACCEPTED'
  const [processingFriend, setProcessingFriend] = useState(false);

  // Form chỉnh sửa hồ sơ
  const [editData, setEditData] = useState({
    nickname: '',
    age: '',
    location: '',
    bio: '',
    email: '',
    phone: '',
    avatar: ''
  });

  // Đổi mật khẩu
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);

  const fileInputRef = useRef(null);

  // 1. Nạp thông tin hồ sơ
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const params = effectiveUserId ? { user_id: effectiveUserId } : {};
      const res = await axiosClient.get('/users/profile', { params });
      if (res.data?.data) {
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
      console.warn("Lỗi tải thông tin cá nhân:", err);
      // Fallback local info nếu chính mình
      if (isMe) {
        setProfile({
          id: currentUserId,
          nickname: localStorage.getItem('nickname') || 'Người dùng',
          account: localStorage.getItem('account') || 'user',
          avatar: localStorage.getItem('user_avatar') || '',
          bio: '',
          roles: ['ROLE_USER'],
          vipTier: 'MEMBER'
        });
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, isMe, currentUserId]);

  // 2. Nạp bài viết của người dùng
  const fetchUserPosts = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      setLoadingPosts(true);
      const res = await axiosClient.get(`/posts/user/${effectiveUserId}`);
      if (res.data?.data) {
        setUserPosts(res.data.data);
      } else {
        setUserPosts([]);
      }
    } catch (e) {
      setUserPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [effectiveUserId]);

  // 3. Nạp bài viết đã lưu (nếu là chính mình)
  const fetchSavedPosts = useCallback(async () => {
    if (!isMe) return;
    try {
      const savedIdsRaw = localStorage.getItem('saved_post_ids');
      const savedIds = savedIdsRaw ? JSON.parse(savedIdsRaw) : [];
      if (savedIds.length === 0) {
        setSavedPosts([]);
        return;
      }
      const res = await axiosClient.get('/posts');
      if (res.data?.data) {
        const filtered = res.data.data.filter(p => savedIds.includes(p.id));
        setSavedPosts(filtered);
      }
    } catch (e) {
      console.warn("Lỗi tải bài đã lưu:", e);
    }
  }, [isMe]);

  // 5. Nạp danh sách bạn bè
  const fetchUserFriends = useCallback(async () => {
    try {
      setLoadingFriends(true);
      const res = await axiosClient.get('/friends/list');
      if (res.data?.data) {
        setUserFriends(res.data.data);
        if (!isMe && effectiveUserId) {
          const isFriend = res.data.data.some(f => String(f.id) === String(effectiveUserId));
          if (isFriend) setFriendStatus('ACCEPTED');
        }
      }
    } catch (e) {
      console.warn("Lỗi tải danh sách bạn bè:", e);
    } finally {
      setLoadingFriends(false);
    }
  }, [isMe, effectiveUserId]);

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
    if (isMe) fetchSavedPosts();
    fetchUserFriends();
  }, [fetchProfile, fetchUserPosts, fetchSavedPosts, fetchUserFriends, isMe]);

  // Xử lý nén ảnh đại diện
  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Vui lòng chọn tệp hình ảnh hợp lệ");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 400;
        canvas.width = size;
        canvas.height = size;

        let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;
        if (img.width > img.height) {
          srcX = (img.width - img.height) / 2;
          srcW = img.height;
        } else {
          srcY = (img.height - img.width) / 2;
          srcH = img.width;
        }

        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, size, size);
        const webpData = canvas.toDataURL('image/webp', 0.85);
        setEditData(prev => ({ ...prev, avatar: webpData }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Lưu thông tin hồ sơ
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        nickname: editData.nickname?.trim(),
        age: editData.age ? parseInt(editData.age, 10) : null,
        location: editData.location?.trim() || null,
        bio: editData.bio?.trim() || null,
        email: editData.email?.trim() || null,
        phone: editData.phone?.trim() || null,
        avatar: editData.avatar || null
      };

      const res = await axiosClient.put('/users/profile', payload);
      if (res.data?.data) {
        setProfile(res.data.data);
        if (payload.nickname) localStorage.setItem('nickname', payload.nickname);
        if (payload.avatar) localStorage.setItem('user_avatar', payload.avatar);
      }
      toast.success("Cập nhật hồ sơ thành công!");
      setIsEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Cập nhật thất bại!");
    } finally {
      setSubmitting(false);
    }
  };

  // Đổi mật khẩu
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự!");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return;
    }

    setChangingPassword(true);
    try {
      await axiosClient.put('/users/change-password', {
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });
      toast.success("Đổi mật khẩu thành công!");
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Đổi mật khẩu thất bại!");
    } finally {
      setChangingPassword(false);
    }
  };

  // Kết bạn
  const handleSendFriendRequest = async () => {
    if (!effectiveUserId) return;
    setProcessingFriend(true);
    try {
      await axiosClient.post('/friends/request', null, { params: { friend_id: effectiveUserId } });
      toast.success("Đã gửi lời mời kết bạn!");
      setFriendStatus('PENDING_SENT');
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi lời mời kết bạn");
    } finally {
      setProcessingFriend(false);
    }
  };

  // Đăng xuất
  const handleLogout = () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất tài khoản?")) {
      localStorage.clear();
      sessionStorage.clear();
      toast.success("Đã đăng xuất");
      navigate('/login');
    }
  };

  const isAdmin = profile?.roles?.includes('ROLE_ADMIN') || profile?.roles?.includes('ROLE_AMDIN');
  const isFounder = profile?.vipTier === 'FOUNDER' || isAdmin;

  // Dialog xác nhận đăng xuất
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <div className="profile-page-root min-h-screen bg-[#13151b] text-[#f1f5f9] font-sans pb-28">
      {/* 1. TOP STICKY BAR */}
      <header className="sticky top-0 z-40 bg-[#13151b]/90 backdrop-blur-md border-b border-[#232838] px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-[#1a1a1a] text-zinc-400 hover:text-white transition-all active:scale-95"
            title="Quay lại sảnh"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
              <span>{profile?.nickname || profile?.account || 'Hồ sơ người dùng'}</span>
              {isAdmin && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#222222] text-zinc-300 border border-[#333333]">
                  ADMIN
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isMe && (
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="px-3 py-1.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] text-zinc-300 hover:text-rose-400 border border-[#2a2a2a] text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
            >
              <LogOut size={13} />
              <span>Đăng xuất</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. HERO PROFILE CONTAINER (CHUẨN BỐ CỤC THREADS PHẲNG, RỘNG RÃI) */}
      <div className="max-w-2xl mx-auto px-4 pt-4 sm:pt-6">
        <div className="border-b border-[#1e1e1e] pb-6">
          <div className="flex items-start justify-between gap-4">
            {/* Cột thông tin tên & Bio */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>{profile?.nickname || profile?.account || 'Người dùng Talovin'}</span>
                {isFounder && (
                  <span className="p-0.5 rounded text-zinc-400" title="Nhà sáng lập">
                    <Sparkles size={14} />
                  </span>
                )}
              </h2>
              <p className="text-xs font-mono text-[#777777] mt-0.5">
                @{profile?.account || 'user'}
              </p>

              {/* Tiểu sử (Bio) */}
              <p className="text-xs sm:text-sm text-zinc-200 mt-3 leading-relaxed font-normal whitespace-pre-wrap">
                {profile?.bio || (isMe ? 'Chưa cập nhật tiểu sử. Bấm nút bên dưới để giới thiệu về bản thân bạn.' : 'Người dùng này chưa cập nhật tiểu sử.')}
              </p>

              {/* Thông tin phụ: Nơi ở, Tuổi */}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[#777777]">
                {profile?.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} />
                    <span>{profile.location}</span>
                  </span>
                )}
                {profile?.age && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>{profile.age} tuổi</span>
                  </span>
                )}
              </div>

              {/* Stats Counters */}
              <div className="flex items-center gap-3 mt-3 text-xs text-[#777777]">
                <span><strong className="text-white">{userPosts.length}</strong> bài viết</span>
                <span>•</span>
                <span><strong className="text-white">{userFriends.length}</strong> bạn bè</span>
                {isMe && (
                  <>
                    <span>•</span>
                    <span><strong className="text-white">{savedPosts.length}</strong> đã lưu</span>
                  </>
                )}
              </div>
            </div>

            {/* Avatar lớn bên phải */}
            <div className="relative flex-shrink-0 group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border border-[#2a2a2a] bg-[#181818] flex items-center justify-center">
                <UserAvatar avatar={profile?.avatar} name={profile?.nickname || profile?.account} size={96} className="w-full h-full" />
              </div>
              {isMe && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#222222] hover:bg-[#333333] text-white border border-[#3f3f46] shadow-md active:scale-90 transition-all cursor-pointer"
                  title="Thay đổi ảnh đại diện"
                >
                  <Camera size={12} strokeWidth={2.5} />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Hàng nút hành động rộng toàn chiều ngang */}
          <div className="mt-4 flex items-center gap-2">
            {isMe ? (
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-98 border ${
                  isEditing 
                    ? 'bg-[#1e1e1e] text-zinc-200 border-[#2a2a2a]' 
                    : 'bg-[#181818] hover:bg-[#202020] text-white border-[#2a2a2a]'
                }`}
              >
                <Edit3 size={13} />
                <span>{isEditing ? 'Đóng chỉnh sửa' : 'Cập nhật hồ sơ'}</span>
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-2">
                {friendStatus === 'ACCEPTED' ? (
                  <div className="flex-1 py-2 rounded-xl bg-[#1c1c1c] text-zinc-200 border border-[#2e2e2e] text-xs font-medium flex items-center justify-center gap-1.5">
                    <UserCheck size={14} />
                    <span>Bạn bè</span>
                  </div>
                ) : friendStatus === 'PENDING_SENT' ? (
                  <div className="flex-1 py-2 rounded-xl bg-[#1c1c1c] text-zinc-300 border border-[#2e2e2e] text-xs font-medium flex items-center justify-center gap-1.5">
                    <Clock size={14} />
                    <span>Đã gửi lời mời</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendFriendRequest}
                    disabled={processingFriend}
                    className="flex-1 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <UserPlus size={14} />
                    <span>Kết bạn</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => toast("Tính năng đàm thoại sẽ kết nối qua phòng trò chuyện")}
                  className="px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#242424] text-zinc-300 border border-[#2a2a2a] text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <PhoneCall size={14} />
                  <span>Trò chuyện</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3. KHU VỰC CHỈNH SỬA HỒ SƠ RIÊNG BIỆT (CHỈ MỞ KHI BẤM NÚT) */}
        {isEditing && isMe && (
          <div className="my-4 p-5 rounded-2xl bg-[#141414] border border-[#222222] shadow-xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#222222]">
              <div className="flex items-center gap-2">
                <Edit3 size={15} className="text-zinc-300" />
                <h3 className="text-sm font-bold text-white">Chỉnh sửa thông tin hồ sơ</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsEditing(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Tên hiển thị (Biệt danh)</label>
                <input
                  type="text"
                  value={editData.nickname}
                  onChange={(e) => setEditData({ ...editData, nickname: e.target.value })}
                  placeholder="Nhập biệt danh của bạn..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#171a23] border border-[#242b3b] text-[#f1f5f9] text-xs focus:outline-none focus:border-[#44526d] transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Tuổi</label>
                  <input
                    type="number"
                    value={editData.age}
                    onChange={(e) => setEditData({ ...editData, age: e.target.value })}
                    placeholder="VD: 22"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#171a23] border border-[#242b3b] text-[#f1f5f9] text-xs focus:outline-none focus:border-[#44526d] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Nơi sinh sống</label>
                  <input
                    type="text"
                    value={editData.location}
                    onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                    placeholder="VD: TP. Hồ Chí Minh"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#171a23] border border-[#242b3b] text-[#f1f5f9] text-xs focus:outline-none focus:border-[#44526d] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Tiểu sử / Lời giới thiệu</label>
                <textarea
                  rows="3"
                  value={editData.bio}
                  onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                  placeholder="Chia sẻ đôi dòng về công việc, sở thích âm nhạc hoặc tâm sự..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#171a23] border border-[#242b3b] text-[#f1f5f9] text-xs focus:outline-none focus:border-[#44526d] transition-colors"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  <Lock size={12} />
                  <span>{showPasswordSection ? 'Ẩn đổi mật khẩu' : 'Đổi mật khẩu tài khoản'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-xl bg-[#1e2332] hover:bg-[#282f42] text-zinc-300 text-xs font-semibold transition-all border border-[#2e374c]"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-all shadow-sm active:scale-95"
                  >
                    {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </form>

            {/* Khung đổi mật khẩu */}
            {showPasswordSection && (
              <form onSubmit={handleChangePassword} className="mt-4 pt-4 border-t border-[#242b3b] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="password"
                    placeholder="Mật khẩu hiện tại"
                    value={passwordData.oldPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#171a23] border border-[#242b3b] text-white text-xs focus:border-[#44526d] focus:outline-none"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Mật khẩu mới (>= 6 ký tự)"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#171a23] border border-[#242b3b] text-white text-xs focus:border-[#44526d] focus:outline-none"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Xác nhận mật khẩu mới"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#171a23] border border-[#242b3b] text-white text-xs focus:border-[#44526d] focus:outline-none"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="px-4 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-all"
                  >
                    {changingPassword ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 4. TABS BÀI VIẾT | ĐÃ LƯU | BẠN BÈ */}
        <div className="flex items-center justify-around border-b border-[#1e1e1e] text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={`py-3.5 text-xs font-semibold transition-all border-b-2 flex-1 text-center ${
              activeTab === 'posts' 
                ? 'border-white text-white' 
                : 'border-transparent text-[#777777] hover:text-zinc-300'
            }`}
          >
            Bài viết ({userPosts.length})
          </button>

          {isMe && (
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`py-3.5 text-xs font-semibold transition-all border-b-2 flex-1 text-center ${
                activeTab === 'saved' 
                  ? 'border-white text-white' 
                  : 'border-transparent text-[#777777] hover:text-zinc-300'
              }`}
            >
              Đã lưu ({savedPosts.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('friends')}
            className={`py-3.5 text-xs font-semibold transition-all border-b-2 flex-1 text-center ${
              activeTab === 'friends' 
                ? 'border-white text-white' 
                : 'border-transparent text-[#777777] hover:text-zinc-300'
            }`}
          >
            Bạn bè ({userFriends.length})
          </button>
        </div>

        {/* 5. NỘI DUNG TỪNG TAB */}
        <div className="divide-y divide-[#1e1e1e]">
          {/* TAB 1: BÀI VIẾT DO USER ĐĂNG */}
          {activeTab === 'posts' && (
            loadingPosts ? (
              <div className="py-12 text-center text-zinc-500 font-mono text-xs">
                <Loader2 size={20} className="animate-spin mx-auto mb-2 text-zinc-400" />
                <span>Đang tải danh sách bài viết...</span>
              </div>
            ) : userPosts.length === 0 ? (
              <div className="py-16 text-center text-zinc-500">
                <FileText size={28} className="mx-auto mb-2 text-zinc-600 opacity-60" />
                <p className="text-sm font-semibold text-zinc-400">Chưa có bài viết nào</p>
                <p className="text-xs text-zinc-600 mt-1">Người dùng này chưa xuất bản bài đăng nào trên hệ thống.</p>
              </div>
            ) : (
              userPosts.map(post => (
                <article key={post.id} className="py-4 hover:bg-[#141414]/40 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar avatar={post.authorAvatar} name={post.authorNickname || post.authorAccount} size={34} />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{post.authorNickname || post.authorAccount}</span>
                        </div>
                        <span className="text-[10.5px] font-mono text-zinc-500">
                          {post.formattedTime || TIME_FORMATTER(post.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap my-2">
                    {post.content}
                  </p>

                  {/* Hành động */}
                  <div className="flex items-center gap-5 pt-2 text-xs text-[#777777]">
                    <span className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors">
                      <Heart size={15} className={post.isLikedByMe ? "fill-rose-500 text-rose-500" : ""} />
                      <span>{post.likesCount || 0}</span>
                    </span>
                    <span className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors">
                      <MessageSquare size={15} />
                      <span>{post.commentsCount || 0}</span>
                    </span>
                  </div>
                </article>
              ))
            )
          )}

          {/* TAB 2: BÀI VIẾT ĐÃ LƯU (CHỈ CHÍNH CHỦ) */}
          {activeTab === 'saved' && isMe && (
            savedPosts.length === 0 ? (
              <div className="py-16 text-center text-zinc-500">
                <Bookmark size={28} className="mx-auto mb-2 text-zinc-600 opacity-60" />
                <p className="text-sm font-semibold text-zinc-400">Chưa có bài viết đã lưu</p>
                <p className="text-xs text-zinc-600 mt-1">Lưu các bài viết yêu thích tại Sảnh để xem lại bất cứ lúc nào.</p>
              </div>
            ) : (
              savedPosts.map(post => (
                <article key={`saved-${post.id}`} className="py-4 hover:bg-[#141414]/40 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar avatar={post.authorAvatar} name={post.authorNickname || post.authorAccount} size={34} />
                      <div>
                        <div className="text-xs font-bold text-white">{post.authorNickname || post.authorAccount}</div>
                        <span className="text-[10.5px] font-mono text-zinc-500">{post.formattedTime || TIME_FORMATTER(post.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap my-2">
                    {post.content}
                  </p>
                </article>
              ))
            )
          )}

          {/* TAB 4: BẠN BÈ */}
          {activeTab === 'friends' && (
            userFriends.length === 0 ? (
              <div className="py-16 text-center text-zinc-500">
                <Users size={28} className="mx-auto mb-2 text-zinc-600 opacity-60" />
                <p className="text-sm font-semibold text-zinc-400">Chưa có bạn bè nào</p>
                <p className="text-xs text-zinc-600 mt-1">Kết nối thêm nhiều bạn bè từ Sảnh và các phòng thoại để giao lưu!</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1e1e1e]">
                {userFriends.map(friend => {
                  const friendUser = friend.friend?.id?.toString() === effectiveUserId?.toString() ? friend.user : friend.friend;
                  const fNickname = friendUser?.nickname || friendUser?.account || 'Người dùng';
                  const fAccount = friendUser?.account || 'user';
                  const fAvatar = friendUser?.avatar;

                  return (
                    <div 
                      key={friend.id} 
                      className="py-3 flex items-center justify-between hover:bg-[#141414]/40 transition-colors cursor-pointer"
                      onClick={() => navigate(`/profile/${friendUser?.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar avatar={fAvatar} name={fNickname} size={40} />
                        <div>
                          <div className="text-xs font-bold text-white hover:underline">{fNickname}</div>
                          <div className="text-[11px] font-mono text-zinc-500">@{fAccount}</div>
                        </div>
                      </div>

                      <span className="text-xs text-zinc-400 font-medium px-3 py-1 rounded-xl bg-[#181818] border border-[#262626]">
                        Bạn bè
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* MODAL XÁC NHẬN ĐĂNG XUẤT NỘI BỘ (KHÔNG DÙNG WINDOW.CONFIRM XẤU XÍ) */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-[#141414] border border-[#222222] rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Xác nhận đăng xuất</h3>
            <p className="text-xs text-zinc-400">Bạn có chắc chắn muốn đăng xuất khỏi tài khoản trên thiết bị này không?</p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e1e1e]">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl bg-[#1e1e1e] hover:bg-[#282828] text-zinc-300 text-xs font-semibold border border-[#2e2e2e]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  toast.success("Đã đăng xuất");
                  navigate('/login');
                }}
                className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;


