import { useState, useEffect } from 'react';
import { Users, User, X, UserCheck, Phone, Clock, UserMinus, MessageSquare, Crown, Gem, CheckCircle2 } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

const FriendsModal = ({ onClose, onSelectUser, onStartPrivateCall }) => {
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'pending'
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleAccept = async (senderId, nickname) => {
    try {
      await axiosClient.post('/friends/accept', null, {
        params: { sender_id: senderId }
      });
      toast.success(`Đã đồng ý kết bạn với ${nickname}!`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi chấp nhận kết bạn!");
    }
  };

  const handleRemove = async (friendId, nickname) => {
    try {
      await axiosClient.post('/friends/remove', null, {
        params: { friend_id: friendId }
      });
      toast.success(`Đã hủy kết bạn với ${nickname}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi hủy kết bạn!");
    }
  };

  return (
    <div className="friends-backdrop" onClick={onClose}>
      <div className="friends-card" onClick={(e) => e.stopPropagation()}>
        <div className="friends-header">
          <div className="friends-title-wrap">
            <Users size={20} className="friends-icon" />
            <h3>Bạn Bè & Lời Mời</h3>
          </div>
          <button onClick={onClose} className="btn-close" title="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="friends-tabs">
          <button 
            className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            Bạn bè ({friends.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Lời mời {pending.length > 0 && <span className="badge-count">{pending.length}</span>}
          </button>
        </div>

        <div className="friends-content">
          {loading ? (
            <div className="friends-loading">Đang tải danh sách...</div>
          ) : activeTab === 'friends' ? (
            friends.length === 0 ? (
              <div className="friends-empty">
                <Users size={36} className="empty-icon" />
                <p>Chưa có bạn bè nào.</p>
                <span>Nhấp vào avatar của thành viên trong phòng chat để gửi lời mời kết bạn!</span>
              </div>
            ) : (
              <div className="friends-list">
                {friends.map((friend) => (
                  <div key={friend.id} className="friend-item" onClick={() => onSelectUser(friend.id)}>
                    <div className="friend-avatar">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <User size={18} color="#94a3b8" />
                      )}
                      <span className="dot-online"></span>
                    </div>
                    <div className="friend-meta">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <h4>{friend.nickname || friend.account}</h4>
                        {friend.isVerified && <CheckCircle2 size={13} color="#38bdf8" />}
                        {friend.vipTier === 'FOUNDER' ? (
                          <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '1px 5px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Crown size={10} /> Sáng Lập</span>
                        ) : (
                          <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '1px 5px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Gem size={10} /> VIP</span>
                        )}
                      </div>
                      <p>{friend.location ? `📍 ${friend.location}` : `@${friend.account}`}</p>
                    </div>
                    <div className="friend-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => {
                          onClose();
                          if (onStartPrivateCall) onStartPrivateCall(friend);
                        }}
                        className="btn-friend-call" 
                        title={`Gọi thoại riêng cho ${friend.nickname}`}
                      >
                        <Phone size={14} />
                      </button>
                      <button 
                        onClick={() => handleRemove(friend.id, friend.nickname)}
                        className="btn-friend-unfriend" 
                        title="Hủy kết bạn"
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            pending.length === 0 ? (
              <div className="friends-empty">
                <Clock size={36} className="empty-icon" />
                <p>Không có lời mời kết bạn nào đang chờ.</p>
              </div>
            ) : (
              <div className="friends-list">
                {pending.map((req) => (
                  <div key={req.id} className="friend-item" onClick={() => onSelectUser(req.id)}>
                    <div className="friend-avatar">
                      {req.avatar ? (
                        <img src={req.avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <User size={18} color="#94a3b8" />
                      )}
                    </div>
                    <div className="friend-meta">
                      <h4>{req.nickname || req.account}</h4>
                      <p>Đã gửi lời mời kết bạn</p>
                    </div>
                    <div className="friend-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => handleAccept(req.id, req.nickname)}
                        className="btn-accept-req"
                        title="Đồng ý kết bạn"
                      >
                        <UserCheck size={14} /> Đồng ý
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .friends-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .friends-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          width: 100%;
          max-width: 400px;
          max-height: 520px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px rgba(0,0,0,0.6);
          overflow: hidden;
        }
        .friends-header {
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .friends-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .friends-icon { color: #818cf8; }
        .friends-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: #f8fafc; }
        .btn-close {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: flex;
          border-radius: 6px;
        }
        .btn-close:hover { color: white; background: rgba(255,255,255,0.1); }
        .friends-tabs {
          display: flex;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0,0,0,0.2);
        }
        .tab-btn {
          flex: 1;
          background: none;
          border: none;
          color: #94a3b8;
          padding: 10px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-bottom: 2px solid transparent;
        }
        .tab-btn.active {
          color: #818cf8;
          border-bottom-color: #818cf8;
          background: rgba(129, 140, 248, 0.06);
        }
        .badge-count {
          background: #ef4444;
          color: white;
          font-size: 10.5px;
          padding: 1px 6px;
          border-radius: 10px;
        }
        .friends-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          min-height: 250px;
        }
        .friends-loading {
          text-align: center;
          padding: 40px;
          color: #94a3b8;
          font-size: 13px;
        }
        .friends-empty {
          text-align: center;
          padding: 30px 16px;
          color: #94a3b8;
        }
        .empty-icon { color: #334155; margin-bottom: 8px; }
        .friends-empty p { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #e2e8f0; }
        .friends-empty span { font-size: 12px; color: #64748b; line-height: 1.4; display: block; }
        .friends-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .friend-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .friend-item:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(99, 102, 241, 0.3);
        }
        .friend-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white;
          font-weight: 700;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          flex-shrink: 0;
        }
        .dot-online {
          width: 9px;
          height: 9px;
          background: #10b981;
          border: 2px solid #0f172a;
          border-radius: 50%;
          position: absolute;
          bottom: 0;
          right: 0;
        }
        .friend-meta { flex: 1; overflow: hidden; }
        .friend-meta h4 { margin: 0; font-size: 13.5px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .friend-meta p { margin: 2px 0 0; font-size: 11.5px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .friend-actions-cell {
          display: flex;
          gap: 6px;
        }
        .btn-friend-call {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-friend-call:hover { background: #10b981; color: white; }
        .btn-friend-unfriend {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #f87171;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-friend-unfriend:hover { background: #ef4444; color: white; }
        .btn-accept-req {
          background: #4f46e5;
          color: white;
          border: none;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .btn-accept-req:hover { background: #4338ca; }
      `}} />
    </div>
  );
};

export default FriendsModal;

