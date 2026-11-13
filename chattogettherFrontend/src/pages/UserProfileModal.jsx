import { useState, useEffect } from 'react';
import { 
  X, Phone, UserPlus, UserCheck, Clock, MapPin, 
  Calendar, Edit3, Save, Shield, Check, Crown, 
  Sparkles, Gem, Award, CheckCircle2, Zap, User, Camera, RefreshCw, Dices
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import TalovinLogo from '../components/TalovinLogo';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Talovin-Alpha',
  'https://api.dicebear.com/7.x/bottts/svg?seed=VibeWave',
  'https://api.dicebear.com/7.x/bottts/svg?seed=NeonCyber',
  'https://api.dicebear.com/7.x/bottts/svg?seed=AuraSpace',
  'https://api.dicebear.com/7.x/bottts/svg?seed=PulseCraft',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Starlight'
];

export const UserProfileModal = ({ userId, onClose, onStartPrivateCall, currentUserId }) => {
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
    toast.success(next ? "Đã bật hiển thị huy hiệu cạnh tên!" : "Đã ẩn huy hiệu cạnh tên!");
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
        if (isMounted) {
          const fallbackAvatar = localStorage.getItem('user_avatar') || `https://api.dicebear.com/7.x/bottts/svg?seed=${localStorage.getItem('nickname') || 'Talovin'}`;
          setProfile({
            id: effectiveUserId,
            nickname: localStorage.getItem('nickname') || 'Thành Viên',
            account: localStorage.getItem('account') || 'user',
            bio: 'Thành viên kết nối của không gian Talovin',
            avatar: fallbackAvatar,
            vipTier: 'VIP_DIAMOND',
            customTitle: 'Thành Viên Pro',
            level: 28,
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

  const handleRandomAvatar = () => {
    const seed = 'talovin-' + Math.random().toString(36).substring(2, 8);
    const newAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    setEditData(prev => ({ ...prev, avatar: newAvatar }));
    toast.success("Đã đổi avatar ngẫu nhiên mới!");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        nickname: editData.nickname.trim() || undefined,
        age: editData.age ? parseInt(editData.age) : undefined,
        location: editData.location.trim() || undefined,
        bio: editData.bio.trim() || undefined,
        avatar: editData.avatar.trim() || undefined
      };

      const res = await axiosClient.put('/users/profile', payload);
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
  const displayAvatar = profile?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile?.nickname || 'talovin-user'}`;

  return (
    <div className="profile-backdrop" onClick={onClose}>
      <div className="profile-studio-pass-card" onClick={(e) => e.stopPropagation()}>
        
        {/* THANH TOP META ĐỊNH DANH TALOVIN */}
        <div className="pass-top-meta">
          <div className="pass-meta-left">
            <TalovinLogo size={16} showText={false} />
            <span className="font-mono text-[10.5px] text-zinc-400 tracking-widest uppercase">
              TALOVIN STUDIO PASS #{effectiveUserId ? String(effectiveUserId).padStart(5, '0') : '00001'}
            </span>
          </div>
          <button className="btn-close-pass" onClick={onClose} title="Đóng">
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <div className="pass-loading-state font-mono">
            <div className="mini-pulse-dot"></div>
            <span>Đang xác thực thông tin định danh...</span>
          </div>
        ) : (
          <div className="pass-content-wrapper">
            
            {/* KHỐI HERO ĐỒNG BỘ: AVATAR + THÔNG TIN TÊN + NÚT THAO TÁC */}
            <div className="pass-hero-row">
              <div className="pass-avatar-box">
                <img 
                  src={isEditing ? (editData.avatar || displayAvatar) : displayAvatar} 
                  alt="Avatar" 
                  className="pass-avatar-img"
                />
                <span className="pass-online-dot" title="Đang trực tuyến"></span>
              </div>

              <div className="pass-identity-col">
                <div className="pass-name-line">
                  <h3 className="pass-user-name">{profile?.nickname || "Thành viên"}</h3>
                  {showBadge && (
                    <span className="pass-badge-pro font-mono">
                      {isFounder ? "ADMIN" : "PRO"}
                    </span>
                  )}
                </div>
                <div className="pass-handle-line font-mono">
                  <span>@{profile?.account}</span>
                </div>

                <div className="pass-action-buttons">
                  {isMe ? (
                    <button 
                      type="button"
                      className={`btn-pass-action ${isEditing ? 'active' : ''}`}
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      <Edit3 size={12} /> {isEditing ? "Đóng chỉnh sửa" : "Chỉnh sửa hồ sơ"}
                    </button>
                  ) : (
                    <>
                      {profile?.friendshipStatus === 'ACCEPTED' ? (
                        <span className="pass-status-pill friend font-mono">
                          <UserCheck size={12} /> Bạn bè
                        </span>
                      ) : profile?.friendshipStatus === 'PENDING_SENT' ? (
                        <span className="pass-status-pill pending font-mono">
                          <Clock size={12} /> Đã gửi lời mời
                        </span>
                      ) : profile?.friendshipStatus === 'PENDING_RECEIVED' ? (
                        <button 
                          className="btn-pass-action primary" 
                          onClick={handleAcceptFriendRequest}
                          disabled={submitting}
                        >
                          <UserPlus size={12} /> Đồng ý kết bạn
                        </button>
                      ) : (
                        <button 
                          className="btn-pass-action primary" 
                          onClick={handleSendFriendRequest}
                          disabled={submitting}
                        >
                          <UserPlus size={12} /> Kết bạn
                        </button>
                      )}

                      {onStartPrivateCall && (
                        <button 
                          className="btn-pass-action call"
                          onClick={() => { onClose(); onStartPrivateCall(profile); }}
                          title="Bắt đầu đàm thoại 1-1"
                        >
                          <Phone size={12} /> Đàm thoại
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* FORM CHỈNH SỬA HỒ SƠ & ĐỔI AVATAR (NẾU ĐANG MỞ) */}
            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="pass-edit-form">
                <div className="edit-form-heading font-mono">
                  <span>CHỈNH SỬA HỒ SƠ & AVATAR</span>
                </div>

                {/* Chọn hoặc đổi avatar DiceBear */}
                <div className="avatar-pick-section">
                  <div className="avatar-pick-top">
                    <span className="font-mono text-xs text-zinc-400">Chọn ảnh diện mạo:</span>
                    <button 
                      type="button" 
                      onClick={handleRandomAvatar} 
                      className="btn-seed-random font-mono"
                    >
                      <Dices size={12} /> Đổi ngẫu nhiên
                    </button>
                  </div>
                  <div className="avatar-presets-grid">
                    {PRESET_AVATARS.map((av, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditData(prev => ({ ...prev, avatar: av }))}
                        className={`preset-thumb-btn ${editData.avatar === av ? 'selected' : ''}`}
                      >
                        <img src={av} alt="Preset" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pass-fields-grid">
                  <div className="pass-field-group">
                    <label className="font-mono">Tên hiển thị</label>
                    <input 
                      type="text" 
                      value={editData.nickname} 
                      onChange={(e) => setEditData(prev => ({ ...prev, nickname: e.target.value }))}
                      placeholder="Nhập tên hiển thị..."
                      maxLength={32}
                    />
                  </div>

                  <div className="pass-field-group">
                    <label className="font-mono">Tuổi</label>
                    <input 
                      type="number" 
                      value={editData.age} 
                      onChange={(e) => setEditData(prev => ({ ...prev, age: e.target.value }))}
                      placeholder="24"
                      min={1}
                      max={120}
                    />
                  </div>

                  <div className="pass-field-group full">
                    <label className="font-mono">Không gian sống / Thành phố</label>
                    <input 
                      type="text" 
                      value={editData.location} 
                      onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="TP. Hồ Chí Minh, Việt Nam"
                      maxLength={64}
                    />
                  </div>

                  <div className="pass-field-group full">
                    <label className="font-mono">Giới thiệu ngắn (Bio)</label>
                    <textarea 
                      rows="2"
                      value={editData.bio} 
                      onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="Chia sẻ đôi dòng về bạn hoặc gu âm nhạc..."
                      maxLength={200}
                    />
                  </div>
                </div>

                <div className="pass-edit-actions">
                  <button 
                    type="button" 
                    className="btn-cancel-edit" 
                    onClick={() => setIsEditing(false)}
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="btn-save-pass"
                    disabled={submitting}
                  >
                    {submitting ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* THƯỚC ĐO THỐNG KÊ ĐỒNG BỘ 3 CỘT (METRIC RIBBON) */}
                <div className="pass-metrics-ribbon">
                  <div className="metric-cell">
                    <span className="metric-label font-mono">CẤP ĐỘ</span>
                    <span className="metric-val font-mono">{profile?.level || 28}</span>
                  </div>
                  <div className="metric-cell-divider"></div>
                  <div className="metric-cell">
                    <span className="metric-label font-mono">CHUỖI TƯƠNG TÁC</span>
                    <span className="metric-val font-mono">{profile?.streakDays || 7} Ngày</span>
                  </div>
                  <div className="metric-cell-divider"></div>
                  <div className="metric-cell">
                    <span className="metric-label font-mono">ĐẶC QUYỀN</span>
                    <span className="metric-val font-mono">{isFounder ? "ADMIN" : "PRO"}</span>
                  </div>
                </div>

                {/* THÔNG TIN BIO & VỊ TRÍ */}
                <div className="pass-details-card">
                  <p className="pass-bio-quote">
                    "{profile?.bio || "Thành viên tích cực cùng lắng nghe âm nhạc và kết nối tại Talovin Lounge."}"
                  </p>
                  
                  <div className="pass-details-footer font-mono">
                    <div className="detail-item">
                      <MapPin size={11} className="text-zinc-400" />
                      <span>{profile?.location || "Chưa cập nhật vị trí"}</span>
                    </div>
                    <div className="detail-item">
                      <Calendar size={11} className="text-zinc-400" />
                      <span>{profile?.age ? `${profile.age} tuổi` : "Chưa cập nhật tuổi"}</span>
                    </div>
                  </div>
                </div>

                {/* TABS ĐẶC QUYỀN TALOVIN */}
                <div className="pass-tabs-strip">
                  <button 
                    className={`pass-tab-item ${activeTab === 'info' ? 'active' : ''}`}
                    onClick={() => setActiveTab('info')}
                  >
                    Tổng quan hồ sơ
                  </button>
                  <button 
                    className={`pass-tab-item ${activeTab === 'perks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('perks')}
                  >
                    <Award size={13} /> Đặc quyền Talovin Pro
                  </button>
                </div>

                {activeTab === 'perks' && (
                  /* TAB ĐẶC QUYỀN TITANIUM MEMBER */
                  <div className="pass-perks-box">
                    <div className="perk-titanium-card">
                      <div className="titanium-card-header">
                        <div className="titanium-icon-box">
                          <Shield size={20} className="text-zinc-200" />
                        </div>
                        <div>
                          <h4 className="titanium-title">TITANIUM PRO MEMBERSHIP</h4>
                          <p className="titanium-sub font-mono">Xác thực quyền hạn kết nối không giới hạn</p>
                        </div>
                      </div>

                      <div className="titanium-perks-list font-mono text-xs">
                        <div className="titanium-perk-row">
                          <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                          <span>Huy hiệu PRO bạc định danh nổi bật cạnh tên trong sảnh</span>
                        </div>
                        <div className="titanium-perk-row">
                          <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                          <span>Mở phòng đàm thoại âm thanh WebRTC riêng không giới hạn</span>
                        </div>
                        <div className="titanium-perk-row">
                          <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                          <span>Tự do phát tín hiệu đa phương tiện và gắn dấu ấn chủ đề</span>
                        </div>
                      </div>

                      {isMe && (
                        <button 
                          type="button"
                          onClick={toggleBadgeDisplay} 
                          className="btn-toggle-badge-switch"
                        >
                          <span className={`switch-indicator ${showBadge ? 'on' : 'off'}`}></span>
                          <span>{showBadge ? "Đang hiển thị huy hiệu cạnh tên (Bấm để ẩn)" : "Đang ẩn huy hiệu cạnh tên (Bấm để bật)"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        .profile-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
          animation: fadeIn 0.15s ease-out;
        }

        .profile-studio-pass-card {
          width: 100%;
          max-width: 440px;
          background: #0d0e12;
          border: 1px solid #27272a;
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
          overflow: hidden;
          position: relative;
        }

        .pass-top-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #09090b;
          border-bottom: 1px solid #1f2024;
        }

        .pass-meta-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-close-pass {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          border: 1px solid #27272a;
          background: #14151a;
          color: #a1a1aa;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-close-pass:hover {
          color: white;
          background: #27272a;
        }

        .pass-loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 40px 16px;
          color: #a1a1aa;
          font-size: 12px;
        }

        .pass-content-wrapper {
          padding: 18px 20px 20px;
        }

        /* Hero Row */
        .pass-hero-row {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 18px;
        }

        .pass-avatar-box {
          position: relative;
          width: 68px;
          height: 68px;
          border-radius: 14px;
          border: 1.5px solid #3f3f46;
          background: #18181b;
          overflow: visible;
          flex-shrink: 0;
        }

        .pass-avatar-img {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          object-fit: cover;
        }

        .pass-online-dot {
          position: absolute;
          top: -3px;
          right: -3px;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid #0d0e12;
        }

        .pass-identity-col {
          flex: 1;
          min-width: 0;
        }

        .pass-name-line {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 2px;
        }

        .pass-user-name {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #f4f4f5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pass-badge-pro {
          font-size: 9px;
          padding: 1px 5px;
          border-radius: 4px;
          background: #27272a;
          color: #e4e4e7;
          border: 1px solid #3f3f46;
          letter-spacing: 0.05em;
        }

        .pass-handle-line {
          font-size: 12px;
          color: #71717a;
          margin-bottom: 8px;
        }

        .pass-action-buttons {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-pass-action {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 500;
          background: #1f2026;
          border: 1px solid #2f3037;
          color: #d4d4d8;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-pass-action:hover {
          background: #27272a;
          color: #f4f4f5;
          border-color: #3f3f46;
        }
        .btn-pass-action.active {
          background: #27272a;
          border-color: #52525b;
          color: white;
        }
        .btn-pass-action.primary {
          background: #f4f4f5;
          color: #09090b;
          border-color: #f4f4f5;
        }
        .btn-pass-action.primary:hover {
          background: white;
        }
        .btn-pass-action.call {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          border-color: rgba(16, 185, 129, 0.3);
        }

        .pass-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 4px;
          background: #18181b;
          border: 1px solid #27272a;
          color: #a1a1aa;
        }
        .pass-status-pill.friend {
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.3);
          background: rgba(16, 185, 129, 0.08);
        }

        /* Metric Ribbon 3 Columns */
        .pass-metrics-ribbon {
          display: flex;
          align-items: center;
          background: #09090b;
          border: 1px solid #1f2026;
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 14px;
        }

        .metric-cell {
          flex: 1;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .metric-label {
          font-size: 9.5px;
          color: #71717a;
          letter-spacing: 0.05em;
        }

        .metric-val {
          font-size: 12.5px;
          font-weight: 600;
          color: #f4f4f5;
        }

        .metric-cell-divider {
          width: 1px;
          height: 24px;
          background: #1f2026;
        }

        /* Bio & Details */
        .pass-details-card {
          background: rgba(24, 24, 27, 0.3);
          border: 1px solid #1f2026;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 14px;
        }

        .pass-bio-quote {
          margin: 0 0 10px;
          font-size: 12.5px;
          color: #d4d4d8;
          line-height: 1.5;
          font-style: italic;
        }

        .pass-details-footer {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 11px;
          color: #71717a;
          border-top: 1px solid #1f2026;
          padding-top: 8px;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        /* Tabs Strip */
        .pass-tabs-strip {
          display: flex;
          border-bottom: 1px solid #1f2026;
          margin-bottom: 12px;
          gap: 16px;
        }

        .pass-tab-item {
          background: transparent;
          border: none;
          padding: 8px 0;
          font-size: 12px;
          font-weight: 500;
          color: #71717a;
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: color 0.15s;
        }
        .pass-tab-item:hover {
          color: #d4d4d8;
        }
        .pass-tab-item.active {
          color: #f4f4f5;
        }
        .pass-tab-item.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: #f4f4f5;
          border-radius: 1px;
        }

        /* Perks Titanium Card */
        .pass-perks-box {
          animation: fadeIn 0.15s ease-out;
        }

        .perk-titanium-card {
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 14px;
        }

        .titanium-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #1f2026;
        }

        .titanium-icon-box {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #18181b;
          border: 1px solid #3f3f46;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .titanium-title {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: #f4f4f5;
          letter-spacing: 0.04em;
        }

        .titanium-sub {
          margin: 2px 0 0;
          font-size: 10.5px;
          color: #71717a;
        }

        .titanium-perks-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }

        .titanium-perk-row {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #d4d4d8;
          font-size: 11.5px;
        }

        .btn-toggle-badge-switch {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 6px;
          padding: 8px 12px;
          color: #d4d4d8;
          font-size: 11.5px;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-toggle-badge-switch:hover {
          background: #27272a;
          color: #f4f4f5;
          border-color: #3f3f46;
        }

        .switch-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .switch-indicator.on {
          background: #10b981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
        }
        .switch-indicator.off {
          background: #71717a;
        }

        /* Edit Form */
        .pass-edit-form {
          animation: fadeIn 0.15s ease-out;
        }

        .edit-form-heading {
          font-size: 11px;
          color: #a1a1aa;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 1px solid #1f2026;
        }

        .avatar-pick-section {
          background: #09090b;
          border: 1px solid #1f2026;
          border-radius: 8px;
          padding: 10px;
          margin-bottom: 14px;
        }

        .avatar-pick-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .btn-seed-random {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10.5px;
          color: #a1a1aa;
          background: #18181b;
          border: 1px solid #27272a;
          padding: 3px 8px;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-seed-random:hover {
          color: white;
          background: #27272a;
        }

        .avatar-presets-grid {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .preset-thumb-btn {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          border: 1.5px solid #27272a;
          background: #18181b;
          padding: 2px;
          cursor: pointer;
          flex-shrink: 0;
          transition: border-color 0.15s;
        }
        .preset-thumb-btn:hover {
          border-color: #52525b;
        }
        .preset-thumb-btn.selected {
          border-color: #10b981;
        }
        .preset-thumb-btn img {
          width: 100%;
          height: 100%;
          border-radius: 6px;
        }

        .pass-fields-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 14px;
        }

        .pass-field-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .pass-field-group.full {
          grid-column: span 2;
        }

        .pass-field-group label {
          font-size: 10.5px;
          color: #71717a;
          letter-spacing: 0.04em;
        }

        .pass-field-group input, .pass-field-group textarea {
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 6px;
          padding: 6px 10px;
          color: #f4f4f5;
          font-size: 12.5px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
        }
        .pass-field-group input:focus, .pass-field-group textarea:focus {
          border-color: #52525b;
        }

        .pass-edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .btn-cancel-edit {
          padding: 6px 12px;
          border-radius: 6px;
          background: transparent;
          border: 1px solid #27272a;
          color: #a1a1aa;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-cancel-edit:hover {
          color: white;
          background: #18181b;
        }

        .btn-save-pass {
          padding: 6px 14px;
          border-radius: 6px;
          background: #f4f4f5;
          border: 1px solid #f4f4f5;
          color: #09090b;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-save-pass:hover {
          background: white;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default UserProfileModal;
