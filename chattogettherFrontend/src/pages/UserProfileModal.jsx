import { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, Upload, Trash2, User, Mail, Phone, 
  MapPin, Calendar, Lock, ShieldCheck, Check, Edit3, 
  Loader2, UserCheck, Clock, UserPlus, PhoneCall, KeyRound
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import TalovinLogo from '../components/TalovinLogo';

export const UserProfileModal = ({ userId, onClose, onStartPrivateCall, currentUserId }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'account' | 'security'
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dữ liệu chỉnh sửa hồ sơ
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

  // Xử lý nén ảnh từ máy sang WebP kích thước nhỏ gọn (400x400)
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

        // Cắt vuông từ tâm
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        canvas.width = MAX_SIZE;
        canvas.height = MAX_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, MAX_SIZE, MAX_SIZE);

        const compressedDataUrl = canvas.toDataURL('image/webp', 0.85);
        setEditData(prev => ({ ...prev, avatar: compressedDataUrl }));
        toast.success("Đã chọn ảnh đại diện mới");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setEditData(prev => ({ ...prev, avatar: '' }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
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
        toast.success("Đã lưu thông tin hồ sơ");
        setIsEditing(false);
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
      toast.success("Đã đổi mật khẩu thành công");
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
      toast.success("Đã gửi lời mời kết bạn");
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
      toast.success("Đã đồng ý kết bạn");
      setProfile(prev => ({ ...prev, friendshipStatus: 'ACCEPTED' }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi đồng ý kết bạn");
    } finally {
      setSubmitting(false);
    }
  };

  const getInitial = (name) => {
    if (!name) return 'U';
    return name.trim().charAt(0).toUpperCase();
  };

  const currentDisplayAvatar = isEditing ? editData.avatar : profile?.avatar;
  const displayName = profile?.nickname || profile?.account || "Người dùng";
  const isAdmin = profile?.roles?.includes('ROLE_ADMIN') || profile?.roles?.includes('ROLE_AMDIN');

  return (
    <div className="personal-mgr-backdrop" onClick={onClose}>
      <div className="personal-mgr-card" onClick={(e) => e.stopPropagation()}>
        
        {/* HEADER MODAL */}
        <div className="personal-mgr-header">
          <div className="header-title-box">
            <TalovinLogo size={18} showText={false} />
            <h2 className="header-title-text">
              {isMe ? "Quản lý Tài khoản & Hồ sơ" : "Hồ sơ Người dùng"}
            </h2>
          </div>
          <button onClick={onClose} className="btn-close-mgr" title="Đóng">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="personal-mgr-loading">
            <Loader2 size={24} className="animate-spin text-zinc-400" />
            <span>Đang tải thông tin...</span>
          </div>
        ) : (
          <div className="personal-mgr-body">
            
            {/* HERO PROFILE ROW */}
            <div className="mgr-hero-section">
              <div className="mgr-avatar-wrapper">
                {currentDisplayAvatar ? (
                  <img 
                    src={currentDisplayAvatar} 
                    alt="Avatar" 
                    className="mgr-avatar-image" 
                  />
                ) : (
                  <div className="mgr-avatar-fallback">
                    <span>{getInitial(displayName)}</span>
                  </div>
                )}

                {isMe && (
                  <div 
                    className="mgr-avatar-overlay" 
                    onClick={() => {
                      setIsEditing(true);
                      fileInputRef.current?.click();
                    }} 
                    title="Tải ảnh đại diện từ thiết bị"
                  >
                    <Camera size={18} />
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleAvatarFileSelect} 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                />
              </div>

              <div className="mgr-info-summary">
                <div className="mgr-name-row">
                  <h3 className="mgr-nickname-text">{displayName}</h3>
                  <span className={`mgr-role-badge ${isAdmin ? 'admin' : 'member'}`}>
                    {isAdmin ? "Quản trị viên" : "Thành viên"}
                  </span>
                </div>
                <span className="mgr-account-text font-mono">@{profile?.account}</span>

                {profile?.bio && !isEditing && (
                  <p className="mgr-bio-preview">{profile.bio}</p>
                )}

                {/* HÀNH ĐỘNG HỒ SƠ */}
                <div className="mgr-hero-actions">
                  {isMe ? (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        type="button" 
                        onClick={() => setIsEditing(!isEditing)}
                        className={`btn-mgr-action ${isEditing ? 'active' : ''}`}
                      >
                        <Edit3 size={14} />
                        <span>{isEditing ? "Hủy chỉnh sửa" : "Chỉnh sửa thông tin"}</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsEditing(true);
                          setActiveTab('profile');
                          setTimeout(() => fileInputRef.current?.click(), 50);
                        }}
                        className="btn-mgr-action"
                        title="Tải ảnh đại diện từ máy tính hoặc điện thoại"
                      >
                        <Upload size={14} />
                        <span>Tải ảnh đại diện</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {profile?.friendshipStatus === 'ACCEPTED' ? (
                        <span className="mgr-status-pill friend">
                          <UserCheck size={14} /> Bạn bè
                        </span>
                      ) : profile?.friendshipStatus === 'PENDING_SENT' ? (
                        <span className="mgr-status-pill pending">
                          <Clock size={14} /> Đã gửi lời mời
                        </span>
                      ) : profile?.friendshipStatus === 'PENDING_RECEIVED' ? (
                        <button 
                          className="btn-mgr-action primary" 
                          onClick={handleAcceptFriendRequest}
                          disabled={submitting}
                        >
                          <UserPlus size={14} /> Đồng ý kết bạn
                        </button>
                      ) : (
                        <button 
                          className="btn-mgr-action primary" 
                          onClick={handleSendFriendRequest}
                          disabled={submitting}
                        >
                          <UserPlus size={14} /> Kết bạn
                        </button>
                      )}

                      {onStartPrivateCall && (
                        <button 
                          className="btn-mgr-action call"
                          onClick={() => { onClose(); onStartPrivateCall(profile); }}
                        >
                          <PhoneCall size={14} /> Đàm thoại 1-1
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* TABS ĐIỀU HƯỚNG */}
            {isMe && (
              <div className="mgr-tabs-header">
                <button 
                  className={`mgr-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  <User size={14} />
                  <span>Hồ sơ công khai</span>
                </button>
                <button 
                  className={`mgr-tab-btn ${activeTab === 'account' ? 'active' : ''}`}
                  onClick={() => setActiveTab('account')}
                >
                  <Mail size={14} />
                  <span>Tài khoản & Liên hệ</span>
                </button>
                <button 
                  className={`mgr-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                  onClick={() => setActiveTab('security')}
                >
                  <Lock size={14} />
                  <span>Bảo mật & Mật khẩu</span>
                </button>
              </div>
            )}

            {/* NỘI DUNG TỪNG TAB */}
            <div className="mgr-tab-content">
              
              {/* TAB 1: HỒ SƠ CÔNG KHAI */}
              {activeTab === 'profile' && (
                <div className="mgr-tab-panel">
                  {isEditing ? (
                    <form onSubmit={handleSaveProfile} className="mgr-form-grid">
                      {/* Tùy chọn Avatar */}
                      <div className="mgr-input-group full">
                        <label className="mgr-label">Ảnh đại diện</label>
                        <div className="avatar-edit-controls">
                          <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            className="btn-upload-avatar"
                          >
                            <Upload size={14} />
                            <span>Tải ảnh từ máy</span>
                          </button>
                          {editData.avatar && (
                            <button 
                              type="button" 
                              onClick={handleRemoveAvatar}
                              className="btn-remove-avatar"
                              title="Xóa ảnh"
                            >
                              <Trash2 size={14} />
                              <span>Gỡ ảnh</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mgr-input-group">
                        <label className="mgr-label">Tên hiển thị</label>
                        <input 
                          type="text" 
                          value={editData.nickname} 
                          onChange={(e) => setEditData(prev => ({ ...prev, nickname: e.target.value }))}
                          placeholder="Nhập tên hiển thị..."
                          className="mgr-input"
                          maxLength={40}
                        />
                      </div>

                      <div className="mgr-input-group">
                        <label className="mgr-label">Tuổi</label>
                        <input 
                          type="number" 
                          value={editData.age} 
                          onChange={(e) => setEditData(prev => ({ ...prev, age: e.target.value }))}
                          placeholder="Ví dụ: 24"
                          className="mgr-input"
                          min={1}
                          max={120}
                        />
                      </div>

                      <div className="mgr-input-group full">
                        <label className="mgr-label">Nơi sinh sống / Khu vực</label>
                        <input 
                          type="text" 
                          value={editData.location} 
                          onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                          placeholder="Ví dụ: TP. Hồ Chí Minh"
                          className="mgr-input"
                          maxLength={80}
                        />
                      </div>

                      <div className="mgr-input-group full">
                        <label className="mgr-label">Tiểu sử / Giới thiệu</label>
                        <textarea 
                          rows="3"
                          value={editData.bio} 
                          onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                          placeholder="Viết đôi dòng chia sẻ về bản thân..."
                          className="mgr-textarea"
                          maxLength={300}
                        />
                      </div>

                      <div className="mgr-form-actions">
                        <button 
                          type="button" 
                          onClick={() => setIsEditing(false)} 
                          className="btn-cancel"
                        >
                          Hủy
                        </button>
                        <button 
                          type="submit" 
                          disabled={submitting} 
                          className="btn-save"
                        >
                          {submitting ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="mgr-read-details">
                      <div className="read-item">
                        <span className="read-item-label">Tên hiển thị</span>
                        <span className="read-item-val">{displayName}</span>
                      </div>
                      <div className="read-item">
                        <span className="read-item-label">Tuổi</span>
                        <span className="read-item-val">{profile?.age ? `${profile.age} tuổi` : "Chưa cập nhật"}</span>
                      </div>
                      <div className="read-item full">
                        <span className="read-item-label">Nơi sinh sống</span>
                        <span className="read-item-val">{profile?.location || "Chưa cập nhật"}</span>
                      </div>
                      <div className="read-item full">
                        <span className="read-item-label">Tiểu sử</span>
                        <span className="read-item-val bio-text">{profile?.bio || "Chưa có lời giới thiệu bản thân."}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TÀI KHOẢN & LIÊN HỆ */}
              {activeTab === 'account' && (
                <div className="mgr-tab-panel">
                  {isEditing ? (
                    <form onSubmit={handleSaveProfile} className="mgr-form-grid">
                      <div className="mgr-input-group full">
                        <label className="mgr-label">Địa chỉ Email</label>
                        <input 
                          type="email" 
                          value={editData.email} 
                          onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="email@example.com"
                          className="mgr-input"
                          maxLength={80}
                        />
                      </div>
                      <div className="mgr-input-group full">
                        <label className="mgr-label">Số điện thoại</label>
                        <input 
                          type="tel" 
                          value={editData.phone} 
                          onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="0912 345 678"
                          className="mgr-input"
                          maxLength={20}
                        />
                      </div>

                      <div className="mgr-form-actions">
                        <button 
                          type="button" 
                          onClick={() => setIsEditing(false)} 
                          className="btn-cancel"
                        >
                          Hủy
                        </button>
                        <button 
                          type="submit" 
                          disabled={submitting} 
                          className="btn-save"
                        >
                          {submitting ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="mgr-read-details">
                      <div className="read-item">
                        <span className="read-item-label">Tài khoản đăng nhập</span>
                        <span className="read-item-val font-mono">@{profile?.account}</span>
                      </div>
                      <div className="read-item">
                        <span className="read-item-label">Trạng thái</span>
                        <span className="read-item-val text-emerald-400 font-medium">Hoạt động bình thường</span>
                      </div>
                      <div className="read-item">
                        <span className="read-item-label">Email liên hệ</span>
                        <span className="read-item-val">{profile?.email || "Chưa liên kết"}</span>
                      </div>
                      <div className="read-item">
                        <span className="read-item-label">Số điện thoại</span>
                        <span className="read-item-val">{profile?.phone || "Chưa cập nhật"}</span>
                      </div>
                      <div className="read-item full">
                        <span className="read-item-label">Vai trò hệ thống</span>
                        <span className="read-item-val">{isAdmin ? "Quản trị viên toàn quyền" : "Thành viên chính thức"}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: BẢO MẬT & MẬT KHẨU */}
              {activeTab === 'security' && (
                <div className="mgr-tab-panel">
                  <form onSubmit={handleChangePassword} className="mgr-form-grid">
                    <div className="security-notice-box">
                      <KeyRound size={16} className="text-zinc-400 shrink-0" />
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Để bảo vệ tài khoản, mật khẩu mới cần có độ dài tối thiểu 6 ký tự. Vui lòng không chia sẻ mật khẩu cho người khác.
                      </p>
                    </div>

                    <div className="mgr-input-group full">
                      <label className="mgr-label">Mật khẩu hiện tại</label>
                      <input 
                        type="password" 
                        value={passwordData.oldPassword} 
                        onChange={(e) => setPasswordData(prev => ({ ...prev, oldPassword: e.target.value }))}
                        placeholder="Nhập mật khẩu hiện tại..."
                        className="mgr-input"
                        required
                      />
                    </div>

                    <div className="mgr-input-group">
                      <label className="mgr-label">Mật khẩu mới</label>
                      <input 
                        type="password" 
                        value={passwordData.newPassword} 
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Tối thiểu 6 ký tự..."
                        className="mgr-input"
                        required
                      />
                    </div>

                    <div className="mgr-input-group">
                      <label className="mgr-label">Xác nhận mật khẩu mới</label>
                      <input 
                        type="password" 
                        value={passwordData.confirmPassword} 
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Nhập lại mật khẩu mới..."
                        className="mgr-input"
                        required
                      />
                    </div>

                    <div className="mgr-form-actions">
                      <button 
                        type="submit" 
                        disabled={changingPassword} 
                        className="btn-save"
                      >
                        {changingPassword ? "Đang xử lý..." : "Cập nhật mật khẩu"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      <style>{`
        .personal-mgr-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .personal-mgr-card {
          width: 100%;
          max-width: 580px;
          background: #121214;
          border: 1px solid #27272a;
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          max-height: 90vh;
          animation: modalFadeIn 0.2s ease-out;
        }

        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }

        .personal-mgr-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-bottom: 1px solid #27272a;
          background: #18181b;
        }

        .header-title-box {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-title-text {
          font-size: 14.5px;
          font-weight: 600;
          color: #f4f4f5;
          letter-spacing: -0.01em;
        }

        .btn-close-mgr {
          background: transparent;
          border: none;
          color: #a1a1aa;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .btn-close-mgr:hover {
          color: #f4f4f5;
          background: #27272a;
        }

        .personal-mgr-loading {
          padding: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #a1a1aa;
          font-size: 13px;
        }

        .personal-mgr-body {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        /* HERO ROW */
        .mgr-hero-section {
          display: flex;
          align-items: flex-start;
          gap: 18px;
          padding: 20px 24px;
          border-bottom: 1px solid #27272a;
          background: rgba(24, 24, 27, 0.5);
        }

        .mgr-avatar-wrapper {
          position: relative;
          width: 76px;
          height: 76px;
          border-radius: 16px;
          background: #18181b;
          border: 1.5px solid #3f3f46;
          overflow: hidden;
          flex-shrink: 0;
        }

        .mgr-avatar-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mgr-avatar-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #27272a 0%, #18181b 100%);
          color: #f4f4f5;
          font-size: 28px;
          font-weight: 700;
        }

        .mgr-avatar-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f4f4f5;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .mgr-avatar-overlay:hover {
          background: rgba(0, 0, 0, 0.75);
        }

        .mgr-info-summary {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mgr-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .mgr-nickname-text {
          font-size: 16px;
          font-weight: 600;
          color: #f4f4f5;
          margin: 0;
        }

        .mgr-role-badge {
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 2px 7px;
          border-radius: 4px;
        }

        .mgr-role-badge.admin {
          background: rgba(244, 63, 94, 0.15);
          color: #fb7185;
          border: 1px solid rgba(244, 63, 94, 0.3);
        }

        .mgr-role-badge.member {
          background: #27272a;
          color: #a1a1aa;
          border: 1px solid #3f3f46;
        }

        .mgr-account-text {
          font-size: 12px;
          color: #71717a;
        }

        .mgr-bio-preview {
          font-size: 12.5px;
          color: #a1a1aa;
          line-height: 1.45;
          margin: 4px 0 0 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .mgr-hero-actions {
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn-mgr-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          background: #27272a;
          color: #f4f4f5;
          border: 1px solid #3f3f46;
          transition: all 0.15s ease;
        }

        .btn-mgr-action:hover {
          background: #3f3f46;
        }

        .btn-mgr-action.active {
          background: #3f3f46;
          border-color: #52525b;
        }

        .btn-mgr-action.primary {
          background: #f4f4f5;
          color: #09090b;
          border-color: #f4f4f5;
        }

        .btn-mgr-action.call {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .mgr-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          padding: 5px 10px;
          border-radius: 6px;
          background: #27272a;
          color: #a1a1aa;
        }

        .mgr-status-pill.friend {
          color: #34d399;
          background: rgba(16, 185, 129, 0.1);
        }

        /* TABS STRIP */
        .mgr-tabs-header {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 20px 0 20px;
          background: #18181b;
          border-bottom: 1px solid #27272a;
        }

        .mgr-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 13px;
          font-size: 12.5px;
          font-weight: 500;
          color: #a1a1aa;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mgr-tab-btn:hover {
          color: #f4f4f5;
        }

        .mgr-tab-btn.active {
          color: #f4f4f5;
          border-bottom-color: #f43f5e;
        }

        /* TAB PANEL & FORMS */
        .mgr-tab-content {
          padding: 20px 24px;
        }

        .mgr-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .mgr-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .mgr-input-group.full {
          grid-column: 1 / -1;
        }

        .mgr-label {
          font-size: 11.5px;
          font-weight: 500;
          color: #a1a1aa;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .mgr-input, .mgr-textarea {
          width: 100%;
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          color: #f4f4f5;
          outline: none;
          transition: border-color 0.15s ease;
          box-sizing: border-box;
        }

        .mgr-input:focus, .mgr-textarea:focus {
          border-color: #52525b;
        }

        .avatar-edit-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-upload-avatar {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          background: #27272a;
          border: 1px solid #3f3f46;
          border-radius: 6px;
          color: #f4f4f5;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .btn-upload-avatar:hover {
          background: #3f3f46;
        }

        .btn-remove-avatar {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 7px 10px;
          background: transparent;
          border: 1px solid #ef4444;
          border-radius: 6px;
          color: #ef4444;
          font-size: 12px;
          cursor: pointer;
        }

        .mgr-form-actions {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 10px;
        }

        .btn-cancel {
          padding: 7px 14px;
          background: transparent;
          border: 1px solid #3f3f46;
          color: #a1a1aa;
          border-radius: 8px;
          font-size: 12.5px;
          cursor: pointer;
        }

        .btn-save {
          padding: 7px 16px;
          background: #f4f4f5;
          border: 1px solid #f4f4f5;
          color: #09090b;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }

        .btn-save:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* READONLY DETAILS */
        .mgr-read-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .read-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 10px 14px;
        }

        .read-item.full {
          grid-column: 1 / -1;
        }

        .read-item-label {
          font-size: 11px;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .read-item-val {
          font-size: 13px;
          color: #e4e4e7;
        }

        .read-item-val.bio-text {
          line-height: 1.5;
        }

        .security-notice-box {
          grid-column: 1 / -1;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: rgba(39, 39, 42, 0.4);
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 10px 14px;
        }

        /* MOBILE RESPONSIVENESS */
        @media (max-width: 640px) {
          .personal-mgr-backdrop {
            align-items: flex-end;
            padding: 0;
          }
          .personal-mgr-card {
            max-width: 100%;
            height: 88vh;
            max-height: 88vh;
            border-radius: 20px 20px 0 0;
          }
          .mgr-hero-section {
            padding: 16px;
          }
          .mgr-form-grid, .mgr-read-details {
            grid-template-columns: 1fr;
          }
          .mgr-input-group.full, .read-item.full {
            grid-column: auto;
          }
          .mgr-tab-content {
            padding: 16px;
          }
          .mgr-tabs-header {
            padding: 4px 14px 0 14px;
            overflow-x: auto;
          }
          .mgr-tab-btn {
            white-space: nowrap;
            padding: 8px 10px;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default UserProfileModal;
