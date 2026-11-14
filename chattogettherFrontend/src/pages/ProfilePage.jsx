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

  // Dữ liệu bài viết, đăng lại, đã lưu, bạn bè
  const [userPosts, setUserPosts] = useState([]);
  const [userReposts, setUserReposts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [userFriends, setUserFriends] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingReposts, setLoadingReposts] = useState(false);
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

  // 3. Nạp danh sách bài đăng lại (Reposts)
  const fetchUserReposts = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      setLoadingReposts(true);
      const res = await axiosClient.get(`/posts/user/${effectiveUserId}/reposts`);
      if (res.data?.data) {
        setUserReposts(res.data.data);
      } else {
        setUserReposts([]);
      }
    } catch (e) {
      setUserReposts([]);
    } finally {
      setLoadingReposts(false);
    }
  }, [effectiveUserId]);

  // 4. Nạp bài viết đã lưu (nếu là chính mình)
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
    fetchUserReposts();
    if (isMe) fetchSavedPosts();
    fetchUserFriends();
  }, [fetchProfile, fetchUserPosts, fetchUserReposts, fetchSavedPosts, fetchUserFriends, isMe]);

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

  // Đăng lại bài viết (Repost)
  const handleToggleRepost = async (postId) => {
    try {
      const res = await axiosClient.post(`/posts/${postId}/repost`);
      toast.success(res.data?.message || "Thao tác đăng lại thành công!");
      fetchUserPosts();
      fetchUserReposts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể đăng lại bài viết!");
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

  return (
    <div className="profile-page-root min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans pb-24">
      {/* 1. TOP STICKY BAR */}
      <header className="sticky top-0 z-40 bg-[#101010]/95 backdrop-blur-md border-b border-[#1e1e1e] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={() => navigate('/')}
            className="p-2 rounded-xl bg-[#18181b] hover:bg-[#242424] text-zinc-300 hover:text-white border border-[#262626] transition-all active:scale-95"
            title="Quay lại sảnh bài viết"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
              <span>{profile?.nickname || profile?.account || 'Hồ sơ người dùng'}</span>
              {isAdmin && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ADMIN
                </span>
              )}
            </h1>
            <p className="text-[11px] font-mono text-zinc-500 truncate">
              @{profile?.account || 'user'} • {userPosts.length} bài viết
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isMe && (
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. HERO PROFILE CONTAINER */}
      <div className="max-w-4xl mx-auto px-4 pt-4 sm:pt-6">
        <div className="relative rounded-3xl bg-[#141414] border border-[#222222] p-5 sm:p-7 shadow-lg overflow-hidden">
          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
            {/* Avatar lớn */}
            <div className="relative flex-shrink-0 group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-[#2c2c2c] shadow-md bg-[#18181b] flex items-center justify-center">
                <UserAvatar avatar={profile?.avatar} name={profile?.nickname || profile?.account} size={112} className="w-full h-full" />
              </div>
              {isMe && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 p-2 rounded-xl bg-[#27272a] hover:bg-[#333336] text-white border border-[#3f3f46] shadow-md active:scale-90 transition-all cursor-pointer"
                  title="Thay đổi ảnh đại diện"
                >
                  <Camera size={14} strokeWidth={2.5} />
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

            {/* Thông tin chữ */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center justify-center sm:justify-start gap-2">
                    <span>{profile?.nickname || profile?.account || 'Người dùng Talovin'}</span>
                    {isFounder && (
                      <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Đặc quyền Nhà sáng lập">
                        <Sparkles size={14} />
                      </span>
                    )}
                  </h2>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">
                    @{profile?.account || 'user'}
                  </p>
                </div>

                {/* Nút hành động Chính chủ hoặc Người khác */}
                <div className="flex items-center justify-center sm:justify-end gap-2 pt-2 sm:pt-0">
                  {isMe ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(!isEditing)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 active:scale-95 border ${
                        isEditing 
                          ? 'bg-[#1e1e1e] text-zinc-200 border-[#2a2a2a]' 
                          : 'bg-[#f4f4f5] hover:bg-white text-[#101010] border-transparent font-bold'
                      }`}
                    >
                      <Edit3 size={14} />
                      <span>{isEditing ? 'Đóng chỉnh sửa' : 'Cập nhật hồ sơ'}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {friendStatus === 'ACCEPTED' ? (
                        <div className="px-3.5 py-1.5 rounded-xl bg-zinc-800 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
                          <UserCheck size={14} />
                          <span>Bạn bè</span>
                        </div>
                      ) : friendStatus === 'PENDING_SENT' ? (
                        <div className="px-3.5 py-1.5 rounded-xl bg-zinc-800 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5">
                          <Clock size={14} />
                          <span>Đã gửi lời mời</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendFriendRequest}
                          disabled={processingFriend}
                          className="px-3.5 py-1.5 rounded-xl bg-[#f4f4f5] hover:bg-white text-[#101010] text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          <UserPlus size={14} />
                          <span>Kết bạn</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toast("Tính năng đàm thoại 1-1 sẽ kết nối qua phòng chat")}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/30 text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <PhoneCall size={14} />
                        <span>Đàm thoại 1-1</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tiểu sử (Bio) */}
              <p className="text-xs sm:text-sm text-zinc-300 mt-3 leading-relaxed max-w-2xl font-normal">
                {profile?.bio || (isMe ? 'Chưa cập nhật tiểu sử. Bấm nút cập nhật để giới thiệu về bản thân bạn!' : 'Người dùng này chưa cập nhật tiểu sử.')}
              </p>

              {/* Thông tin phụ: Nơi ở, Tuổi, Ngày tham gia */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-zinc-400">
                {profile?.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-zinc-500" />
                    <span>{profile.location}</span>
                  </span>
                )}
                {profile?.age && (
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-zinc-500" />
                    <span>{profile.age} tuổi</span>
                  </span>
                )}
                <span className="text-zinc-600 font-mono text-[11px]">
                  ID: #{profile?.id || effectiveUserId}
                </span>
              </div>

              {/* Stats Counters Bar */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-4 mt-4 border-t border-zinc-800/80 text-center sm:text-left">
                <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-base sm:text-lg font-extrabold text-white font-mono">{userPosts.length}</div>
                  <div className="text-[11px] text-zinc-400">Bài viết</div>
                </div>
                <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono">{userReposts.length}</div>
                  <div className="text-[11px] text-zinc-400">Đăng lại</div>
                </div>
                <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-base sm:text-lg font-extrabold text-sky-400 font-mono">{userFriends.length}</div>
                  <div className="text-[11px] text-zinc-400">Bạn bè</div>
                </div>
                {isMe && (
                  <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <div className="text-base sm:text-lg font-extrabold text-purple-400 font-mono">{savedPosts.length}</div>
                    <div className="text-[11px] text-zinc-400">Đã lưu</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. KHU VỰC CHỈNH SỬA HỒ SƠ RIÊNG BIỆT (CHỈ MỞ KHI BẤM NÚT) */}
        {isEditing && isMe && (
          <div className="mt-4 p-5 sm:p-6 rounded-3xl bg-[#141414] border border-[#222222] shadow-xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#222222]">
              <div className="flex items-center gap-2">
                <Edit3 size={16} className="text-zinc-300" />
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#27272a] text-[#f4f4f5] text-xs focus:outline-none focus:border-[#444444] transition-colors"
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
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#27272a] text-[#f4f4f5] text-xs focus:outline-none focus:border-[#444444] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Nơi sinh sống</label>
                  <input
                    type="text"
                    value={editData.location}
                    onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                    placeholder="VD: TP. Hồ Chí Minh"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#27272a] text-[#f4f4f5] text-xs focus:outline-none focus:border-[#444444] transition-colors"
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#27272a] text-[#f4f4f5] text-xs focus:outline-none focus:border-[#444444] transition-colors"
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
                    className="px-4 py-2 rounded-xl bg-[#1e1e1e] hover:bg-[#282828] text-zinc-300 text-xs font-semibold transition-all border border-[#2e2e2e]"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-[#f4f4f5] hover:bg-white text-[#101010] text-xs font-semibold transition-all shadow-sm active:scale-95"
                  >
                    {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </form>

            {/* Khung đổi mật khẩu */}
            {showPasswordSection && (
              <form onSubmit={handleChangePassword} className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="password"
                    placeholder="Mật khẩu hiện tại"
                    value={passwordData.oldPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-750 text-white text-xs focus:border-emerald-500"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Mật khẩu mới (>= 6 ký tự)"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-750 text-white text-xs focus:border-emerald-500"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Xác nhận mật khẩu mới"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-750 text-white text-xs focus:border-emerald-500"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold transition-all"
                  >
                    {changingPassword ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 4. PHÂN MỤC TABS RÕ RÀNG: BÀI VIẾT | ĐĂNG LẠI | ĐÃ LƯU | BẠN BÈ */}
        <div className="mt-6 border-b border-zinc-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'posts' 
                ? 'border-emerald-400 text-emerald-400' 
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText size={15} />
            <span>Bài viết ({userPosts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reposts')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'reposts' 
                ? 'border-emerald-400 text-emerald-400' 
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Repeat size={15} />
            <span>Đăng lại ({userReposts.length})</span>
          </button>

          {isMe && (
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'saved' 
                  ? 'border-emerald-400 text-emerald-400' 
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Bookmark size={15} />
              <span>Đã lưu ({savedPosts.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('friends')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'friends' 
                ? 'border-emerald-400 text-emerald-400' 
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users size={15} />
            <span>Bạn bè ({userFriends.length})</span>
          </button>
        </div>

        {/* 5. NỘI DUNG TỪNG TAB */}
        <div className="mt-4 space-y-3">
          {/* TAB 1: BÀI VIẾT DO USER ĐĂNG */}
          {activeTab === 'posts' && (
            loadingPosts ? (
              <div className="py-12 text-center text-zinc-500 font-mono text-xs">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-emerald-400" />
                <span>Đang tải danh sách bài viết...</span>
              </div>
            ) : userPosts.length === 0 ? (
              <div className="py-16 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-3xl">
                <FileText size={32} className="mx-auto mb-2 text-zinc-600 opacity-60" />
                <p className="text-sm font-semibold text-zinc-400">Chưa có bài viết nào</p>
                <p className="text-xs text-zinc-600 mt-1">Người dùng này chưa xuất bản bài đăng nào trên hệ thống.</p>
              </div>
            ) : (
              userPosts.map(post => (
                <article key={post.id} className="p-4 sm:p-5 rounded-2xl bg-[#141414] border border-[#1e1e1e] hover:border-[#2a2a2a] transition-all">
                  <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-zinc-800/60">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar avatar={post.authorAvatar} name={post.authorNickname || post.authorAccount} size={34} />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{post.authorNickname || post.authorAccount}</span>
                          {post.authorBadge && (
                            <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {post.authorBadge}
                            </span>
                          )}
                        </div>
                        <span className="text-[10.5px] font-mono text-zinc-500">
                          {post.formattedTime || TIME_FORMATTER(post.createdAt)}
                        </span>
                      </div>
                    </div>
                    {post.vibe && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-850 text-zinc-400 border border-zinc-750">
                        {post.vibe}
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>

                  {/* Hành động */}
                  <div className="flex items-center gap-4 pt-3 mt-3 border-t border-zinc-800/60 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Heart size={14} className={post.isLikedByMe ? "fill-rose-500 text-rose-500" : ""} />
                      <span>{post.likesCount || 0}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare size={14} />
                      <span>{post.commentsCount || 0}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleRepost(post.id)}
                      className={`flex items-center gap-1 transition-colors ${post.isRepostedByMe ? "text-emerald-400 font-bold" : "hover:text-white"}`}
                      title="Đăng lại bài viết"
                    >
                      <Repeat size={14} />
                      <span>{post.repostsCount || 0}</span>
                    </button>
                  </div>
                </article>
              ))
            )
          )}

          {/* TAB 2: BÀI ĐĂNG LẠI (REPOSTS) */}
          {activeTab === 'reposts' && (
            loadingReposts ? (
              <div className="py-12 text-center text-zinc-500 font-mono text-xs">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-emerald-400" />
                <span>Đang tải các bài đăng lại...</span>
              </div>
            ) : userReposts.length === 0 ? (
              <div className="py-16 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-3xl">
                <Repeat size={32} className="mx-auto mb-2 text-zinc-600 opacity-60" />
                <p className="text-sm font-semibold text-zinc-400">Chưa có bài đăng lại nào</p>
                <p className="text-xs text-zinc-600 mt-1">Các bài viết được chia sẻ lại sẽ hiển thị ở đây.</p>
              </div>
            ) : (
              userReposts.map(post => (
                <article key={`repost-${post.id}`} className="p-4 sm:p-5 rounded-2xl bg-[#141414] border border-[#1e1e1e]">
                  {/* Badge Người đăng lại */}
                  <div className="flex items-center gap-1.5 pb-2.5 mb-2.5 border-b border-zinc-800/60 text-xs text-emerald-400 font-medium">
                    <Repeat size={13} />
                    <span>{post.repostedByNickname || profile?.nickname || 'Người dùng'} đã đăng lại</span>
                    {post.repostedAt && (
                      <span className="text-zinc-500 font-mono text-[10px] ml-auto">
                        {post.repostedAt}
                      </span>
                    )}
                  </div>

                  {/* Bài viết gốc */}
                  <div className="flex items-center gap-2.5 mb-2">
                    <UserAvatar avatar={post.authorAvatar} name={post.authorNickname || post.authorAccount} size={30} />
                    <div>
                      <div className="text-xs font-bold text-white">{post.authorNickname || post.authorAccount}</div>
                      <span className="text-[10px] font-mono text-zinc-500">{post.formattedTime || TIME_FORMATTER(post.createdAt)}</span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>

                  <div className="flex items-center gap-4 pt-3 mt-3 border-t border-zinc-800/60 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Heart size={14} className={post.isLikedByMe ? "fill-rose-500 text-rose-500" : ""} />
                      <span>{post.likesCount || 0}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare size={14} />
                      <span>{post.commentsCount || 0}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleRepost(post.id)}
                      className="flex items-center gap-1 text-emerald-400 font-bold"
                      title="Hủy đăng lại"
                    >
                      <Repeat size={14} />
                      <span>{post.repostsCount || 0}</span>
                    </button>
                  </div>
                </article>
              ))
            )
          )}

          {/* TAB 3: BÀI VIẾT ĐÃ LƯU (CHỈ CHÍNH CHỦ) */}
          {activeTab === 'saved' && isMe && (
            savedPosts.length === 0 ? (
              <div className="py-16 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-3xl">
                <Bookmark size={32} className="mx-auto mb-2 text-zinc-600 opacity-60" />
                <p className="text-sm font-semibold text-zinc-400">Chưa có bài viết đã lưu</p>
                <p className="text-xs text-zinc-600 mt-1">Khi bạn bấm biểu tượng Bookmark ở các bài viết trên sảnh, chúng sẽ lưu tại đây.</p>
              </div>
            ) : (
              savedPosts.map(post => (
                <article key={`saved-${post.id}`} className="p-4 sm:p-5 rounded-2xl bg-[#141414] border border-[#1e1e1e]">
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-800/60">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar avatar={post.authorAvatar} name={post.authorNickname || post.authorAccount} size={30} />
                      <div>
                        <div className="text-xs font-bold text-white">{post.authorNickname || post.authorAccount}</div>
                        <span className="text-[10px] font-mono text-zinc-500">{post.formattedTime || TIME_FORMATTER(post.createdAt)}</span>
                      </div>
                    </div>
                    <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      Đã lưu
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>
                </article>
              ))
            )
          )}

          {/* TAB 4: DANH SÁCH BẠN BÈ */}
          {activeTab === 'friends' && (
            loadingFriends ? (
              <div className="py-12 text-center text-zinc-500 font-mono text-xs">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-emerald-400" />
                <span>Đang tải danh sách bạn bè...</span>
              </div>
            ) : userFriends.length === 0 ? (
              <div className="py-16 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-3xl">
                <Users size={32} className="mx-auto mb-2 text-zinc-600 opacity-60" />
                <p className="text-sm font-semibold text-zinc-400">Chưa có bạn bè nào</p>
                <p className="text-xs text-zinc-600 mt-1">Hãy kết nối với các thành viên khác tại sảnh trực tuyến hoặc phòng thoại!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {userFriends.map(friend => (
                  <div 
                    key={friend.id}
                    onClick={() => navigate(`/profile/${friend.id}`)}
                    className="p-3.5 rounded-2xl bg-[#141414] border border-[#1e1e1e] hover:border-[#2a2a2a] transition-all flex items-center justify-between cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar avatar={friend.avatar} name={friend.nickname || friend.account} size={38} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{friend.nickname || friend.account}</div>
                        <div className="text-[10.5px] font-mono text-zinc-500 truncate">@{friend.account || 'user'}</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Xem hồ sơ
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

