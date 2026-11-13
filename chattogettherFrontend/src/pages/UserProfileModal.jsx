import { useState, useEffect } from 'react';
import { 
  X, Phone, UserPlus, UserCheck, Clock, MapPin, 
  Calendar, Edit3, Save, Shield, Check, Flame, Crown, 
  Sparkles, Gem, Award, CheckCircle2, Zap, User, Camera, RefreshCw
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Klyvix-Alpha',
  'https://api.dicebear.com/7.x/bottts/svg?seed=VibeWave',
  'https://api.dicebear.com/7.x/bottts/svg?seed=NeonCyber',
  'https://api.dicebear.com/7.x/bottts/svg?seed=AuraSpace',
  'https://api.dicebear.com/7.x/bottts/svg?seed=PulseCraft'
];

const UserProfileModal = ({ userId, onClose, onStartPrivateCall, currentUserId }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'perks'
  const [editData, setEditData] = useState({
    nickname: '',
    age: '',
    location: '',
    bio: '',
    avatar: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Toggle hiển thị huy hiệu VIP cạnh tên
  const [showBadge, setShowBadge] = useState(() => {
    return localStorage.getItem('show_vip_badge') !== 'false';
  });

  const toggleBadgeDisplay = () => {
    const next = !showBadge;
    setShowBadge(next);
    localStorage.setItem('show_vip_badge', next ? 'true' : 'false');
    toast.success(next ? "Đã bật hiển thị huy hiệu cạnh tên!" : "Đã ẩn huy hiệu cạnh tên!", { icon: '✨' });
  };

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
            avatar: data.avatar || ''
          });
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin cá nhân:", err);
        // Fallback local info if backend network fails
        if (isMounted) {
          const fallbackAvatar = localStorage.getItem('user_avatar') || `https://api.dicebear.com/7.x/bottts/svg?seed=${localStorage.getItem('nickname') || 'Klyvix'}`;
          setProfile({
            id: effectiveUserId,
            nickname: localStorage.getItem('nickname') || 'Thành Viên',
            account: localStorage.getItem('account') || 'user',
            bio: 'Thành viên kết nối của Klyvix',
            avatar: fallbackAvatar,
            vipTier: 'VIP_DIAMOND',
            customTitle: 'Huy Hiệu Bạc Thành Viên',
            level: 15,
            streakDays: 7,
            isVerified: true
          });
          setEditData(prev => ({
            ...prev,
            avatar: fallbackAvatar
          }));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => { isMounted = false; };
  }, [effectiveUserId]);

  const handleSendFriendRequest = async () => {
    try {
      setSubmitting(true);
      await axiosClient.post('/friends/request', null, {
        params: { receiver_id: effectiveUserId }
      });
      toast.success("Đã gửi lời mời kết bạn!");
      setProfile(prev => ({ ...prev, friendshipStatus: 'PENDING_SENT' }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi gửi lời mời kết bạn!");
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
      toast.error(err.response?.data?.message || "Lỗi khi đồng ý kết bạn!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveFriend = async () => {
    try {
      setSubmitting(true);
      await axiosClient.post('/friends/remove', null, {
        params: { friend_id: effectiveUserId }
      });
      toast.success("Đã hủy kết bạn");
      setProfile(prev => ({ ...prev, friendshipStatus: 'NONE' }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi hủy kết bạn!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateRandomAvatar = () => {
    const seed = 'klyvix-' + Math.random().toString(36).substring(2, 8);
    const newAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    setEditData(prev => ({ ...prev, avatar: newAvatar }));
    toast.success("Đã tạo mẫu avatar mới!", { icon: '🎨' });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await axiosClient.put('/users/profile', {
        nickname: editData.nickname.trim(),
        age: editData.age ? parseInt(editData.age, 10) : null,
        location: editData.location.trim(),
        bio: editData.bio.trim(),
        avatar: editData.avatar?.trim() || null
      });
      if (res.data?.data) {
        setProfile(res.data.data);
        if (editData.nickname) {
          localStorage.setItem('nickname', editData.nickname.trim());
        }
        if (editData.avatar) {
          localStorage.setItem('user_avatar', editData.avatar.trim());
        }
        toast.success("Cập nhật thông tin cá nhân thành công!");
        setIsEditing(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật hồ sơ!");
    } finally {
      setSubmitting(false);
    }
  };

  const isFounder = profile?.vipTier === 'FOUNDER' || profile?.roles?.includes('ROLE_AMDIN') || profile?.roles?.includes('ROLE_ADMIN');

  // Avatar hiển thị: Ưu tiên avatar thật, nếu chưa có thì dùng DiceBear ẩn danh thay vì icon rỗng
  const displayAvatar = profile?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile?.nickname || 'klyvix-user'}`;

  return (
    <div className="profile-backdrop" onClick={onClose}>
      <div className="profile-card" onClick={(e) => e.stopPropagation()}>
        {/* Nút đóng */}
        <button className="btn-close-profile" onClick={onClose} title="Đóng">
          <X size={18} />
        </button>

        {/* Header tối giản nền Dark Zinc với họa tiết lưới mờ sang trọng */}
        <div className="profile-header-minimal">
          {isFounder && (
            <div className="founder-tag-minimal">
              <Shield size={12} /> Quản Trị Hệ Thống
            </div>
          )}
          
          <div className="profile-avatar-frame-wrap">
            <div className="profile-avatar-circle">
              <img 
                src={isEditing ? (editData.avatar || displayAvatar) : displayAvatar} 
                alt="Avatar" 
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
              />
              <span className="online-badge-dot"></span>
            </div>

            {isMe && !isEditing && (
              <button 
                className="btn-quick-avatar-trigger"
                onClick={() => setIsEditing(true)}
                title="Thay đổi ảnh đại diện"
              >
                <Camera size={13} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="profile-loading">
            <div className="mini-loader"></div>
            <p>Đang chuẩn bị hồ sơ...</p>
          </div>
        ) : (
          <div className="profile-body">
            {/* Tabs chuyển đổi: Thông tin | Đặc quyền VIP */}
            <div className="profile-subtabs">
              <button 
                className={`subtab-btn ${activeTab === 'info' ? 'active' : ''}`}
                onClick={() => { setActiveTab('info'); setIsEditing(false); }}
              >
                Hồ sơ cá nhân
              </button>
              <button 
                className={`subtab-btn subtab-perks ${activeTab === 'perks' ? 'active' : ''}`}
                onClick={() => { setActiveTab('perks'); setIsEditing(false); }}
              >
                <Award size={14} /> Huy hiệu thành viên
              </button>
            </div>

            {activeTab === 'perks' ? (
              /* TAB HUY HIỆU THÀNH VIÊN - TÔNG MÀU BẠC/ZINC TỐI GIẢN */
              <div className="perks-view">
                <div className="perk-badge-hero-zinc">
                  <div className="perk-hero-icon-silver">
                    <Shield size={28} />
                  </div>
                  <h4>{profile?.customTitle || (isFounder ? "Huy Hiệu Sáng Lập" : "Huy Hiệu Thành Viên Klyvix")}</h4>
                  <p className="perk-hero-sub-zinc">Huy hiệu xác thực danh tính trên nền tảng Klyvix</p>
                </div>

                <div className="perks-list">
                  <div className="perk-item-zinc">
                    <CheckCircle2 size={15} className="perk-check-silver" />
                    <div>
                      <strong>Huy hiệu biểu tượng cạnh tên người dùng</strong>
                      <p>Khẳng định hồ sơ đã kích hoạt danh tính trong các bài viết và bình luận</p>
                    </div>
                  </div>
                  <div className="perk-item-zinc">
                    <CheckCircle2 size={15} className="perk-check-silver" />
                    <div>
                      <strong>Tạo phòng đàm thoại & chia sẻ kênh âm thanh</strong>
                      <p>Băng thông trực tiếp WebRTC không giới hạn thời lượng trò chuyện</p>
                    </div>
                  </div>
                  <div className="perk-item-zinc">
                    <CheckCircle2 size={15} className="perk-check-silver" />
                    <div>
                      <strong>Tùy biến nhãn chủ đề & cộng đồng</strong>
                      <p>Gắn thẻ chủ đề độc lập và phân loại bài viết theo cảm xúc riêng</p>
                    </div>
                  </div>
                </div>

                {/* Nút hành động thực tế: Bật/tắt hiển thị huy hiệu */}
                <button onClick={toggleBadgeDisplay} className="btn-toggle-badge-zinc">
                  {showBadge ? '✓ Đang hiển thị huy hiệu cạnh tên (Bấm để ẩn)' : '○ Đang ẩn huy hiệu cạnh tên (Bấm để bật)'}
                </button>
              </div>
            ) : !isEditing ? (
              /* TAB THÔNG TIN CHÍNH */
              <>
                <div className="profile-names">
                  <div className="name-and-badge">
                    <h3 className="profile-nickname">{profile?.nickname || "Thành viên"}</h3>
                    {profile?.isVerified && (
                      <span className="verified-badge-icon" title="Tài khoản đã xác thực">
                        <CheckCircle2 size={15} color="#cbd5e1" />
                      </span>
                    )}
                    {showBadge && (
                      <span className="privilege-pill-silver">
                        <Shield size={11} /> {isFounder ? "Quản trị" : "Thành viên"}
                      </span>
                    )}
                  </div>
                  <span className="profile-account">@{profile?.account}</span>
                </div>

                {/* Level & Streak Indicators */}
                <div className="profile-stats-bar">
                  <div className="stat-badge">
                    <Zap size={13} className="stat-icon-silver" />
                    <span>Cấp độ <strong>{profile?.level || 15}</strong></span>
                  </div>
                  <div className="stat-badge">
                    <Flame size={13} className="stat-icon-silver" />
                    <span>Chuỗi <strong>{profile?.streakDays || 7} ngày</strong></span>
                  </div>
                </div>

                {profile?.bio ? (
                  <p className="profile-bio">{profile?.bio}</p>
                ) : (
                  <p className="profile-bio-empty">Chưa có lời giới thiệu bản thân.</p>
                )}

                <div className="profile-details-grid">
                  <div className="detail-item">
                    <Calendar size={15} className="detail-icon" />
                    <div>
                      <span className="detail-label">Tuổi</span>
                      <p className="detail-val">{profile?.age ? `${profile.age} tuổi` : "Chưa cập nhật"}</p>
                    </div>
                  </div>

                  <div className="detail-item">
                    <MapPin size={15} className="detail-icon" />
                    <div>
                      <span className="detail-label">Nơi sinh sống</span>
                      <p className="detail-val">{profile?.location || "Chưa cập nhật"}</p>
                    </div>
                  </div>
                </div>

                {/* Các nút hành động */}
                <div className="profile-actions-row">
                  {isMe ? (
                    <button 
                      onClick={() => setIsEditing(true)} 
                      className="btn-action btn-edit-profile"
                    >
                      <Edit3 size={15} /> Chỉnh sửa hồ sơ & Avatar
                    </button>
                  ) : (
                    <>
                      {/* Nút Gọi Riêng 1-1 */}
                      <button 
                        onClick={() => {
                          onClose();
                          if (onStartPrivateCall) onStartPrivateCall(profile);
                        }} 
                        className="btn-action btn-private-call"
                        title={`Gọi riêng 1-1 cho ${profile?.nickname}`}
                      >
                        <Phone size={15} /> Gọi thoại
                      </button>

                      {/* Nút Trạng Thái Bạn Bè */}
                      {profile?.friendshipStatus === 'NONE' && (
                        <button 
                          onClick={handleSendFriendRequest} 
                          disabled={submitting}
                          className="btn-action btn-friend-action"
                        >
                          <UserPlus size={15} /> Kết bạn
                        </button>
                      )}

                      {profile?.friendshipStatus === 'PENDING_SENT' && (
                        <button disabled className="btn-action btn-friend-pending">
                          <Clock size={15} /> Đã gửi lời mời
                        </button>
                      )}

                      {profile?.friendshipStatus === 'PENDING_RECEIVED' && (
                        <button 
                          onClick={handleAcceptFriendRequest} 
                          disabled={submitting}
                          className="btn-action btn-friend-accept"
                        >
                          <UserCheck size={15} /> Đồng ý
                        </button>
                      )}

                      {profile?.friendshipStatus === 'ACCEPTED' && (
                        <button 
                          onClick={handleRemoveFriend} 
                          disabled={submitting}
                          className="btn-action btn-friend-done"
                          title="Nhấp để hủy kết bạn"
                        >
                          <Check size={15} /> Bạn bè
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              /* Chế độ Chỉnh Sửa Hồ Sơ & Đổi Avatar */
              <form onSubmit={handleSaveProfile} className="edit-profile-form">
                <h4 className="form-heading">Chỉnh sửa thông tin</h4>

                {/* CHỌN / ĐỔI AVATAR TRỰC TIẾP */}
                <div className="edit-field">
                  <div className="avatar-edit-label-row">
                    <label>Ảnh đại diện (Avatar)</label>
                    <button 
                      type="button" 
                      onClick={handleGenerateRandomAvatar} 
                      className="btn-dicebear-random"
                      title="Tạo hình đại diện DiceBear ngẫu nhiên"
                    >
                      <RefreshCw size={12} /> Đổi mẫu ngẫu nhiên
                    </button>
                  </div>

                  <input 
                    type="url" 
                    value={editData.avatar || ''}
                    onChange={(e) => setEditData({ ...editData, avatar: e.target.value })}
                    placeholder="Dán link ảnh hoặc dùng nút ngẫu nhiên phía trên..."
                  />

                  {/* Preset Avatar Thao Tác 1-Click */}
                  <div className="avatar-presets-strip">
                    <span className="preset-hint">Gợi ý mẫu:</span>
                    {PRESET_AVATARS.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`preset-thumb-btn ${editData.avatar === url ? 'active' : ''}`}
                        onClick={() => setEditData({ ...editData, avatar: url })}
                      >
                        <img src={url} alt={`Preset ${i}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="edit-field">
                  <label>Biệt danh hiển thị</label>
                  <input 
                    type="text" 
                    value={editData.nickname}
                    onChange={(e) => setEditData({ ...editData, nickname: e.target.value })}
                    placeholder="Nhập tên hiển thị..."
                    required
                  />
                </div>

                <div className="edit-row-2">
                  <div className="edit-field">
                    <label>Tuổi</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="120"
                      value={editData.age}
                      onChange={(e) => setEditData({ ...editData, age: e.target.value })}
                      placeholder="VD: 22"
                    />
                  </div>
                  <div className="edit-field">
                    <label>Nơi sinh sống</label>
                    <input 
                      type="text" 
                      value={editData.location}
                      onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                      placeholder="VD: TP. Hồ Chí Minh"
                    />
                  </div>
                </div>

                <div className="edit-field">
                  <label>Tiểu sử / Giới thiệu</label>
                  <textarea 
                    rows="3"
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    placeholder="Viết đôi dòng về bản thân..."
                  />
                </div>

                <div className="edit-actions">
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(false)} 
                    className="btn-edit-cancel"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting} 
                    className="btn-edit-save"
                  >
                    <Save size={15} /> {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .profile-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          box-sizing: border-box;
          animation: fadeInBackdrop 0.18s ease-out;
        }
        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .profile-card {
          background: #18181b; /* Dark Zinc 900 */
          border: 1px solid #27272a; /* Zinc 800 */
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85);
          border-radius: 18px;
          width: 100%;
          max-width: 440px;
          overflow: hidden;
          position: relative;
          animation: scaleCard 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }
        @keyframes scaleCard {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .btn-close-profile {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid #3f3f46;
          color: #d4d4d8;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 20;
          backdrop-filter: blur(4px);
          transition: all 0.15s;
        }
        .btn-close-profile:hover { background: #27272a; color: #ffffff; }

        /* Minimalist Dark Zinc Header with Subtle Grid */
        .profile-header-minimal {
          height: 85px;
          background: #09090b; /* Zinc 950 */
          border-bottom: 1px solid #27272a; /* Zinc 800 */
          position: relative;
          display: flex;
          justify-content: center;
          flex-shrink: 0;
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 16px 16px;
        }
        .founder-tag-minimal {
          position: absolute;
          top: 12px;
          left: 14px;
          background: #18181b;
          border: 1px solid #3f3f46;
          color: #e4e4e7;
          font-size: 10.5px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 5px;
          letter-spacing: 0.3px;
        }

        .profile-avatar-frame-wrap {
          position: absolute;
          bottom: -36px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .profile-avatar-circle {
          width: 76px;
          height: 76px;
          border-radius: 50%;
          background: #27272a;
          border: 3px solid #18181b;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
          position: relative;
          overflow: visible;
        }

        .btn-quick-avatar-trigger {
          position: absolute;
          bottom: 0;
          right: -4px;
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #f4f4f5;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
          transition: background 0.15s;
        }
        .btn-quick-avatar-trigger:hover {
          background: #3f3f46;
        }

        .online-badge-dot {
          width: 13px;
          height: 13px;
          background: #10b981;
          border: 2px solid #18181b;
          border-radius: 50%;
          position: absolute;
          bottom: 2px;
          right: 2px;
        }

        .profile-loading {
          padding: 60px 20px 40px;
          text-align: center;
          color: #a1a1aa;
          font-size: 13px;
        }
        .mini-loader {
          width: 26px;
          height: 26px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-bottom-color: #a1a1aa;
          border-radius: 50%;
          margin: 0 auto 12px auto;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .profile-body {
          padding: 44px 20px 20px;
          text-align: center;
          overflow-y: auto;
        }

        .profile-subtabs {
          display: flex;
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 10px;
          padding: 3px;
          gap: 4px;
          margin-bottom: 14px;
        }
        .subtab-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 600;
          padding: 7px 10px;
          border-radius: 7px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.15s;
        }
        .subtab-btn.active {
          background: #27272a;
          color: #f4f4f5;
        }

        .profile-names { margin-bottom: 8px; }
        .name-and-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .profile-nickname {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #f4f4f5;
        }
        .verified-badge-icon {
          display: inline-flex;
          align-items: center;
        }
        .privilege-pill-silver {
          font-size: 10.5px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #e4e4e7;
        }
        .profile-account {
          font-size: 12px;
          color: #71717a;
          font-weight: 500;
          display: block;
          margin-top: 2px;
        }

        .profile-stats-bar {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .stat-badge {
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 16px;
          padding: 3px 10px;
          font-size: 11.5px;
          color: #d4d4d8;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .stat-icon-silver { color: #a1a1aa; }

        .profile-bio {
          font-size: 13px;
          color: #d4d4d8;
          line-height: 1.5;
          margin: 6px 0 12px;
          background: #09090b;
          border: 1px solid #27272a;
          padding: 8px 12px;
          border-radius: 8px;
          word-break: break-word;
        }
        .profile-bio-empty {
          font-size: 11.5px;
          color: #71717a;
          font-style: italic;
          margin: 6px 0 12px;
        }

        .profile-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 16px;
          text-align: left;
        }
        .detail-item {
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .detail-icon { color: #a1a1aa; flex-shrink: 0; }
        .detail-label { font-size: 9.5px; color: #71717a; display: block; text-transform: uppercase; font-weight: 600; }
        .detail-val { margin: 2px 0 0 0; font-size: 12px; font-weight: 600; color: #f4f4f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .profile-actions-row {
          display: flex;
          gap: 8px;
        }
        .btn-action {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
        }
        .btn-edit-profile {
          background: #27272a;
          color: #f4f4f5;
          border: 1px solid #3f3f46;
        }
        .btn-edit-profile:hover { background: #3f3f46; color: white; }

        .btn-private-call {
          background: #10b981;
          color: white;
        }
        .btn-private-call:hover { background: #059669; }

        .btn-friend-action {
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #f4f4f5;
        }
        .btn-friend-action:hover { background: #3f3f46; }

        .btn-friend-pending {
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #a1a1aa;
          cursor: default;
        }

        .btn-friend-accept {
          background: #27272a;
          border: 1px solid #52525b;
          color: #ffffff;
        }
        .btn-friend-accept:hover { background: #3f3f46; }

        .btn-friend-done {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
        }

        /* Huy Hiệu Thành Viên Silver / Zinc Styles */
        .perks-view {
          text-align: left;
        }
        .perk-badge-hero-zinc {
          text-align: center;
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 12px;
          padding: 14px 10px;
          margin-bottom: 12px;
        }
        .perk-hero-icon-silver {
          color: #e4e4e7;
          display: flex;
          justify-content: center;
          margin-bottom: 6px;
        }
        .perk-badge-hero-zinc h4 {
          margin: 0;
          font-size: 14.5px;
          color: #f4f4f5;
          font-weight: 700;
        }
        .perk-hero-sub-zinc {
          margin: 4px 0 0 0;
          font-size: 11px;
          color: #71717a;
        }
        .perks-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }
        .perk-item-zinc {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 8px 10px;
        }
        .perk-check-silver {
          color: #a1a1aa;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .perk-item-zinc strong {
          display: block;
          font-size: 12px;
          color: #f4f4f5;
        }
        .perk-item-zinc p {
          margin: 2px 0 0 0;
          font-size: 11px;
          color: #71717a;
        }

        .btn-toggle-badge-zinc {
          width: 100%;
          background: #27272a;
          color: #f4f4f5;
          border: 1px solid #3f3f46;
          padding: 9px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .btn-toggle-badge-zinc:hover {
          background: #3f3f46;
          color: #ffffff;
        }

        /* Form Chỉnh sửa */
        .edit-profile-form {
          text-align: left;
        }
        .form-heading {
          margin: 0 0 10px 0;
          font-size: 13.5px;
          font-weight: 600;
          color: #f4f4f5;
          text-align: center;
        }
        .avatar-edit-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .avatar-edit-label-row label {
          margin-bottom: 0 !important;
        }
        .btn-dicebear-random {
          background: transparent;
          border: none;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 4px;
        }
        .btn-dicebear-random:hover { color: #f4f4f5; }

        .avatar-presets-strip {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
        }
        .preset-hint {
          font-size: 10px;
          color: #71717a;
        }
        .preset-thumb-btn {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1px solid #3f3f46;
          background: #09090b;
          padding: 1px;
          cursor: pointer;
          overflow: hidden;
        }
        .preset-thumb-btn img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }
        .preset-thumb-btn.active {
          border-color: #f4f4f5;
        }

        .edit-field {
          margin-bottom: 10px;
        }
        .edit-field label {
          display: block;
          font-size: 10.5px;
          font-weight: 600;
          color: #a1a1aa;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .edit-field input, .edit-field textarea {
          width: 100%;
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 6px;
          padding: 7px 9px;
          color: #f4f4f5;
          font-size: 12.5px;
          outline: none;
          box-sizing: border-box;
          font-family: inherit;
        }
        .edit-field input:focus, .edit-field textarea:focus {
          border-color: #52525b;
        }
        .edit-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .edit-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .btn-edit-cancel {
          flex: 1;
          background: #27272a;
          color: #d4d4d8;
          border: 1px solid #3f3f46;
          padding: 8px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-edit-save {
          flex: 1;
          background: #f4f4f5;
          color: #18181b;
          border: none;
          padding: 8px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .btn-edit-save:hover {
          background: #e4e4e7;
        }
      `}} />
    </div>
  );
};

export default UserProfileModal;
