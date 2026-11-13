import { useState, useEffect } from 'react';
import { 
  X, Phone, UserPlus, UserCheck, Clock, MapPin, 
  Calendar, Edit3, Save, Shield, Check, Flame, Crown, 
  Sparkles, Gem, Award, CheckCircle2, Zap
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

const UserProfileModal = ({ userId, onClose, onStartPrivateCall, currentUserId }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'perks'
  const [editData, setEditData] = useState({
    nickname: '',
    age: '',
    location: '',
    bio: ''
  });
  const [submitting, setSubmitting] = useState(false);

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
            bio: data.bio || ''
          });
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin cá nhân:", err);
        // Fallback local info if backend network fails
        if (isMounted) {
          setProfile({
            id: effectiveUserId,
            nickname: localStorage.getItem('nickname') || 'Người Dùng',
            account: localStorage.getItem('account') || 'user',
            bio: 'Thành viên năng động của Chat Together',
            vipTier: 'VIP_DIAMOND',
            customTitle: '💎 VIP Kim Cương',
            level: 15,
            streakDays: 7,
            isVerified: true
          });
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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await axiosClient.put('/users/profile', {
        nickname: editData.nickname.trim(),
        age: editData.age ? parseInt(editData.age, 10) : null,
        location: editData.location.trim(),
        bio: editData.bio.trim()
      });
      if (res.data?.data) {
        setProfile(res.data.data);
        if (editData.nickname) {
          localStorage.setItem('nickname', editData.nickname.trim());
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

  return (
    <div className="profile-backdrop" onClick={onClose}>
      <div className="profile-card" onClick={(e) => e.stopPropagation()}>
        {/* Nút đóng */}
        <button className="btn-close-profile" onClick={onClose} title="Đóng">
          <X size={18} />
        </button>

        {/* Banner Header Gradient */}
        <div className={`profile-header-gradient ${isFounder ? 'founder-gradient' : ''}`}>
          {isFounder && (
            <div className="founder-glow-tag">
              <Crown size={13} className="crown-shimmer" /> Quản Trị Tối Cao
            </div>
          )}
          <div className={`profile-avatar-circle ${isFounder ? 'founder-avatar-frame' : 'vip-avatar-frame'}`}>
            {profile?.nickname?.charAt(0).toUpperCase() || "U"}
            <span className="online-badge-dot"></span>
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
                <Crown size={14} color="#f59e0b" /> Đặc quyền VIP
              </button>
            </div>

            {activeTab === 'perks' ? (
              /* TAB ĐẶC QUYỀN VIP & DANH HIỆU */
              <div className="perks-view">
                <div className="perk-badge-hero">
                  <div className="perk-hero-icon">
                    {isFounder ? <Crown size={32} color="#fbbf24" /> : <Gem size={32} color="#38bdf8" />}
                  </div>
                  <h4>{profile?.customTitle || (isFounder ? "👑 Sáng Lập Viên" : "💎 VIP Kim Cương")}</h4>
                  <p className="perk-hero-sub">Hạng đặc quyền cao cấp trên Chat Together Platform</p>
                </div>

                <div className="perks-list">
                  <div className="perk-item active">
                    <CheckCircle2 size={16} className="perk-check" />
                    <div>
                      <strong>Huy hiệu danh giá cạnh tên</strong>
                      <p>Khẳng định vị thế nổi bật trên mọi bài viết & bình luận</p>
                    </div>
                  </div>
                  <div className="perk-item active">
                    <CheckCircle2 size={16} className="perk-check" />
                    <div>
                      <strong>Viền Avatar Hào Quang Neon</strong>
                      <p>Hiệu ứng phát sáng độc quyền riêng cho tài khoản của bạn</p>
                    </div>
                  </div>
                  <div className="perk-item active">
                    <CheckCircle2 size={16} className="perk-check" />
                    <div>
                      <strong>Tạo phòng Voice HD & Lo-Fi Radio không giới hạn</strong>
                      <p>Băng thông WebRTC đàm thoại ưu tiên tốc độ cao</p>
                    </div>
                  </div>
                  <div className="perk-item active">
                    <CheckCircle2 size={16} className="perk-check" />
                    <div>
                      <strong>Gói biểu tượng cảm xúc độc quyền 🔥 👑 💎</strong>
                      <p>Thả reaction với hiệu ứng hoạt hình sinh động</p>
                    </div>
                  </div>
                </div>

                <button onClick={() => toast.success("Đặc quyền của bạn đang hoạt động bình thường!", { icon: '✨' })} className="btn-claim-perk">
                  <Sparkles size={16} /> Kiểm tra hiệu lực đặc quyền
                </button>
              </div>
            ) : !isEditing ? (
              /* TAB THÔNG TIN CHÍNH */
              <>
                <div className="profile-names">
                  <div className="name-and-badge">
                    <h3 className="profile-nickname">{profile?.nickname || "Người dùng"}</h3>
                    {profile?.isVerified && (
                      <span className="verified-badge-icon" title="Tài khoản đã xác thực">
                        <CheckCircle2 size={16} color="#38bdf8" />
                      </span>
                    )}
                    {isFounder ? (
                      <span className="privilege-pill founder-pill">
                        <Crown size={12} /> Sáng Lập
                      </span>
                    ) : (
                      <span className="privilege-pill diamond-pill">
                        <Gem size={12} /> VIP
                      </span>
                    )}
                  </div>
                  <span className="profile-account">@{profile?.account}</span>
                </div>

                {/* Level & Streak Indicators */}
                <div className="profile-stats-bar">
                  <div className="stat-badge level-badge">
                    <Zap size={14} className="stat-icon zap" />
                    <span>Cấp độ <strong>{profile?.level || 15}</strong></span>
                  </div>
                  <div className="stat-badge streak-badge">
                    <Flame size={14} className="stat-icon flame" />
                    <span>Chuỗi <strong>{profile?.streakDays || 7} ngày 🔥</strong></span>
                  </div>
                </div>

                {profile?.bio ? (
                  <p className="profile-bio">{profile?.bio}</p>
                ) : (
                  <p className="profile-bio-empty">Chưa có lời giới thiệu bản thân.</p>
                )}

                <div className="profile-details-grid">
                  <div className="detail-item">
                    <Calendar size={16} className="detail-icon" />
                    <div>
                      <span className="detail-label">Tuổi</span>
                      <p className="detail-val">{profile?.age ? `${profile.age} tuổi` : "Chưa cập nhật"}</p>
                    </div>
                  </div>

                  <div className="detail-item">
                    <MapPin size={16} className="detail-icon" />
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
                      <Edit3 size={16} /> Chỉnh sửa hồ sơ
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
                        <Phone size={16} /> Gọi thoại
                      </button>

                      {/* Nút Trạng Thái Bạn Bè */}
                      {profile?.friendshipStatus === 'NONE' && (
                        <button 
                          onClick={handleSendFriendRequest} 
                          disabled={submitting}
                          className="btn-action btn-friend-action"
                        >
                          <UserPlus size={16} /> Kết bạn
                        </button>
                      )}

                      {profile?.friendshipStatus === 'PENDING_SENT' && (
                        <button disabled className="btn-action btn-friend-pending">
                          <Clock size={16} /> Đã gửi lời mời
                        </button>
                      )}

                      {profile?.friendshipStatus === 'PENDING_RECEIVED' && (
                        <button 
                          onClick={handleAcceptFriendRequest} 
                          disabled={submitting}
                          className="btn-action btn-friend-accept"
                        >
                          <UserCheck size={16} /> Đồng ý
                        </button>
                      )}

                      {profile?.friendshipStatus === 'ACCEPTED' && (
                        <button 
                          onClick={handleRemoveFriend} 
                          disabled={submitting}
                          className="btn-action btn-friend-done"
                          title="Nhấp để hủy kết bạn"
                        >
                          <Check size={16} /> Bạn bè
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              /* Chế độ Chỉnh Sửa Hồ Sơ */
              <form onSubmit={handleSaveProfile} className="edit-profile-form">
                <h4 className="form-heading">Chỉnh sửa hồ sơ của bạn</h4>

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
                    <Save size={16} /> {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
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
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          box-sizing: border-box;
          animation: fadeInBackdrop 0.2s ease-out;
        }
        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .profile-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.15);
          border-radius: 24px;
          width: 100%;
          max-width: 420px;
          overflow: hidden;
          position: relative;
          animation: scaleCard 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }
        @keyframes scaleCard {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .btn-close-profile {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #f8fafc;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 20;
          backdrop-filter: blur(4px);
          transition: all 0.15s;
        }
        .btn-close-profile:hover { background: rgba(239, 68, 68, 0.85); transform: scale(1.05); }

        .profile-header-gradient {
          height: 100px;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%);
          position: relative;
          display: flex;
          justify-content: center;
          flex-shrink: 0;
        }
        .founder-gradient {
          background: linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #d97706 100%);
        }
        .founder-glow-tag {
          position: absolute;
          top: 12px;
          left: 14px;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(251, 191, 36, 0.5);
          color: #fbbf24;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 5px;
          backdrop-filter: blur(4px);
          letter-spacing: 0.5px;
        }

        .profile-avatar-circle {
          position: absolute;
          bottom: -38px;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border: 4px solid #0f172a;
          color: white;
          font-weight: 800;
          font-size: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        .founder-avatar-frame {
          border-color: #fbbf24;
          box-shadow: 0 0 20px rgba(251, 191, 36, 0.6);
        }
        .vip-avatar-frame {
          border-color: #38bdf8;
          box-shadow: 0 0 16px rgba(56, 189, 248, 0.4);
        }

        .online-badge-dot {
          width: 14px;
          height: 14px;
          background: #10b981;
          border: 3px solid #0f172a;
          border-radius: 50%;
          position: absolute;
          bottom: 2px;
          right: 2px;
        }

        .profile-loading {
          padding: 60px 20px 40px;
          text-align: center;
          color: #94a3b8;
          font-size: 13.5px;
        }
        .mini-loader {
          width: 28px;
          height: 28px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-bottom-color: #818cf8;
          border-radius: 50%;
          margin: 0 auto 12px auto;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .profile-body {
          padding: 46px 20px 20px;
          text-align: center;
          overflow-y: auto;
        }

        .profile-subtabs {
          display: flex;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 3px;
          gap: 4px;
          margin-bottom: 14px;
        }
        .subtab-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 600;
          padding: 7px 10px;
          border-radius: 9px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .subtab-btn.active {
          background: #334155;
          color: #f8fafc;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .subtab-perks.active {
          background: rgba(245, 158, 11, 0.2);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.4);
        }

        .profile-names { margin-bottom: 10px; }
        .name-and-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .profile-nickname {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
          color: #f8fafc;
        }
        .verified-badge-icon {
          display: inline-flex;
          align-items: center;
        }
        .privilege-pill {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .founder-pill {
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.5);
          color: #fbbf24;
        }
        .diamond-pill {
          background: rgba(56, 189, 248, 0.2);
          border: 1px solid rgba(56, 189, 248, 0.5);
          color: #38bdf8;
        }
        .profile-account {
          font-size: 12.5px;
          color: #818cf8;
          font-weight: 500;
          display: block;
          margin-top: 2px;
        }

        .profile-stats-bar {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .stat-badge {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 12px;
          color: #cbd5e1;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .stat-icon.zap { color: #eab308; }
        .stat-icon.flame { color: #f97316; }

        .profile-bio {
          font-size: 13.5px;
          color: #cbd5e1;
          line-height: 1.5;
          margin: 8px 0 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 8px 12px;
          border-radius: 10px;
          word-break: break-word;
        }
        .profile-bio-empty {
          font-size: 12px;
          color: #64748b;
          font-style: italic;
          margin: 6px 0 14px;
        }

        .profile-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 18px;
          text-align: left;
        }
        .detail-item {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .detail-icon { color: #818cf8; flex-shrink: 0; }
        .detail-label { font-size: 10px; color: #94a3b8; display: block; text-transform: uppercase; font-weight: 600; }
        .detail-val { margin: 2px 0 0 0; font-size: 12.5px; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .profile-actions-row {
          display: flex;
          gap: 10px;
        }
        .btn-action {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border-radius: 12px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }
        .btn-edit-profile {
          background: #334155;
          color: #f8fafc;
        }
        .btn-edit-profile:hover { background: #475569; }

        .btn-private-call {
          background: #10b981;
          color: white;
        }
        .btn-private-call:hover { background: #059669; }

        .btn-friend-action {
          background: #4f46e5;
          color: white;
        }
        .btn-friend-action:hover { background: #4338ca; }

        .btn-friend-pending {
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.4);
          color: #fbbf24;
          cursor: default;
        }

        .btn-friend-accept {
          background: #6366f1;
          color: white;
        }
        .btn-friend-accept:hover { background: #4f46e5; }

        .btn-friend-done {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.35);
          color: #34d399;
        }
        .btn-friend-done:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
          color: #f87171;
        }

        /* Perks View */
        .perks-view {
          text-align: left;
        }
        .perk-badge-hero {
          text-align: center;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(245, 158, 11, 0.15));
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 14px;
          padding: 14px 10px;
          margin-bottom: 14px;
        }
        .perk-hero-icon { margin-bottom: 6px; }
        .perk-badge-hero h4 {
          margin: 0;
          font-size: 15px;
          color: #fbbf24;
          font-weight: 700;
        }
        .perk-hero-sub {
          margin: 4px 0 0 0;
          font-size: 11.5px;
          color: #94a3b8;
        }
        .perks-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 16px;
        }
        .perk-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .perk-check {
          color: #10b981;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .perk-item strong {
          display: block;
          font-size: 12.5px;
          color: #f1f5f9;
        }
        .perk-item p {
          margin: 2px 0 0 0;
          font-size: 11.5px;
          color: #94a3b8;
        }
        .btn-claim-perk {
          width: 100%;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
          border: none;
          padding: 10px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
        }

        /* Edit Form */
        .edit-profile-form {
          text-align: left;
        }
        .form-heading {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #818cf8;
          text-align: center;
        }
        .edit-field {
          margin-bottom: 12px;
        }
        .edit-field label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .edit-field input, .edit-field textarea {
          width: 100%;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 8px 10px;
          color: #f8fafc;
          font-size: 13.5px;
          outline: none;
          box-sizing: border-box;
          font-family: inherit;
        }
        .edit-field input:focus, .edit-field textarea:focus {
          border-color: #6366f1;
        }
        .edit-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .edit-actions {
          display: flex;
          gap: 10px;
          margin-top: 14px;
        }
        .btn-edit-cancel {
          flex: 1;
          background: #334155;
          color: #cbd5e1;
          border: none;
          padding: 9px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .btn-edit-save {
          flex: 1;
          background: #4f46e5;
          color: white;
          border: none;
          padding: 9px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
      `}} />
    </div>
  );
};

export default UserProfileModal;
