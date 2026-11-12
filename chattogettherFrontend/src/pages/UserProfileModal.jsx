import { useState, useEffect } from 'react';
import { 
  X, Phone, UserPlus, UserCheck, Clock, MapPin, 
  Calendar, Edit3, Save, MessageSquare, Shield, Check, UserMinus 
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

const UserProfileModal = ({ userId, onClose, onStartPrivateCall, currentUserId }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    nickname: '',
    age: '',
    location: '',
    bio: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const isMe = currentUserId?.toString() === userId?.toString();

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get('/users/profile', {
          params: { user_id: userId }
        });
        if (res.data?.data && isMounted) {
          setProfile(res.data.data);
          setEditData({
            nickname: res.data.data.nickname || '',
            age: res.data.data.age || '',
            location: res.data.data.location || '',
            bio: res.data.data.bio || ''
          });
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin cá nhân:", err);
        toast.error("Không thể tải thông tin người dùng!");
        onClose();
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (userId) {
      fetchProfile();
    }

    return () => { isMounted = false; };
  }, [userId, onClose]);

  const handleSendFriendRequest = async () => {
    try {
      setSubmitting(true);
      await axiosClient.post('/friends/request', null, {
        params: { receiver_id: userId }
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
        params: { sender_id: userId }
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
        params: { friend_id: userId }
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

  return (
    <div className="profile-backdrop" onClick={onClose}>
      <div className="profile-card" onClick={(e) => e.stopPropagation()}>
        {/* Nút đóng */}
        <button className="btn-close-profile" onClick={onClose} title="Đóng">
          <X size={20} />
        </button>

        {/* Banner Header Gradient */}
        <div className="profile-header-gradient">
          <div className="profile-avatar-circle">
            {profile?.nickname?.charAt(0).toUpperCase() || "U"}
            <span className="online-badge-dot"></span>
          </div>
        </div>

        {loading ? (
          <div className="profile-loading">
            <div className="mini-loader"></div>
            <p>Đang tải thông tin cá nhân...</p>
          </div>
        ) : (
          <div className="profile-body">
            {!isEditing ? (
              <>
                <div className="profile-names">
                  <h3 className="profile-nickname">{profile?.nickname || "Người dùng"}</h3>
                  <span className="profile-account">@{profile?.account}</span>
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
                        <Phone size={16} /> Gọi riêng
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
                          <UserCheck size={16} /> Đồng ý kết bạn
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
                    <Save size={16} /> Lưu thay đổi
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
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          animation: fadeInBackdrop 0.2s ease-out;
        }
        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .profile-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7);
          border-radius: 20px;
          width: 100%;
          max-width: 380px;
          overflow: hidden;
          position: relative;
          animation: scaleCard 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes scaleCard {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .btn-close-profile {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(0, 0, 0, 0.4);
          border: none;
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
          transition: background 0.15s;
        }
        .btn-close-profile:hover { background: rgba(239, 68, 68, 0.8); }

        .profile-header-gradient {
          height: 90px;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%);
          position: relative;
          display: flex;
          justify-content: center;
        }

        .profile-avatar-circle {
          position: absolute;
          bottom: -36px;
          width: 76px;
          height: 76px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border: 4px solid #0f172a;
          color: white;
          font-weight: 700;
          font-size: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
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
        }

        .profile-names { margin-bottom: 8px; }
        .profile-nickname {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #f8fafc;
        }
        .profile-account {
          font-size: 12.5px;
          color: #818cf8;
          font-weight: 500;
        }

        .profile-bio {
          font-size: 13.5px;
          color: #cbd5e1;
          line-height: 1.5;
          margin: 10px 0 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 8px 12px;
          border-radius: 10px;
          word-break: break-word;
        }
        .profile-bio-empty {
          font-size: 12.5px;
          color: #64748b;
          font-style: italic;
          margin: 8px 0 16px;
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
        .detail-label { font-size: 10.5px; color: #94a3b8; display: block; text-transform: uppercase; font-weight: 600; }
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
          border-radius: 10px;
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

