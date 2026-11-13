import { useState, useEffect } from 'react';
import { Users, User, X, UserCheck, Phone, Clock, UserMinus, MessageSquare, Shield, CheckCircle2, MapPin } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

export const FriendsModal = ({ onClose, onSelectUser, onStartPrivateCall }) => {
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
      <div className="friends-card-zinc" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="friends-header-zinc">
          <div className="friends-title-wrap">
            <Users size={16} className="text-zinc-300" />
            <h3 className="font-semibold text-zinc-100 text-sm">Bạn Bè & Lời Mời Kết Nối</h3>
          </div>
          <button onClick={onClose} className="btn-close-zinc" title="Đóng">
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="friends-tabs-zinc font-mono text-xs">
          <button 
            className={`tab-btn-zinc ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            Bạn bè ({friends.length})
          </button>
          <button 
            className={`tab-btn-zinc ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Lời mời {pending.length > 0 && <span className="badge-count-zinc font-mono">{pending.length}</span>}
          </button>
        </div>

        {/* Body */}
        <div className="friends-content-zinc">
          {loading ? (
            <div className="friends-loading-zinc font-mono text-xs">Đang tải danh sách kết nối...</div>
          ) : activeTab === 'friends' ? (
            friends.length === 0 ? (
              <div className="friends-empty-zinc">
                <Users size={32} className="text-zinc-600 mb-2" />
                <p className="text-zinc-300 text-xs font-medium">Chưa có người bạn nào trong danh sách.</p>
                <span className="text-zinc-500 text-[11.5px] mt-1 block">
                  Nhấp vào avatar của thành viên trong sảnh hoặc phòng đàm thoại để gửi lời mời!
                </span>
              </div>
            ) : (
              <div className="friends-list-zinc">
                {friends.map((friend) => (
                  <div key={friend.id} className="friend-item-zinc" onClick={() => onSelectUser(friend.id)}>
                    <div className="friend-avatar-wrap">
                      <img 
                        src={friend.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.nickname || 'user'}`} 
                        alt="Avatar" 
                        className="friend-avatar-img" 
                      />
                      <span className="dot-online-zinc"></span>
                    </div>
                    
                    <div className="friend-meta-zinc">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs text-zinc-100">{friend.nickname || friend.account}</span>
                        {friend.isVerified && <CheckCircle2 size={12} className="text-zinc-400" />}
                        <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          PRO
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-zinc-500 mt-0.5">
                        {friend.location ? friend.location : `@${friend.account}`}
                      </p>
                    </div>

                    <div className="friend-actions-cell" onClick={(e) => e.stopPropagation()}>
                      {onStartPrivateCall && (
                        <button 
                          onClick={() => { onClose(); onStartPrivateCall(friend); }}
                          className="btn-friend-action call"
                          title="Đàm thoại 1-1"
                        >
                          <Phone size={12} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleRemove(friend.id, friend.nickname)}
                        className="btn-friend-action danger"
                        title="Hủy kết bạn"
                      >
                        <UserMinus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            pending.length === 0 ? (
              <div className="friends-empty-zinc">
                <Clock size={32} className="text-zinc-600 mb-2" />
                <p className="text-zinc-300 text-xs font-medium">Không có lời mời kết bạn nào đang chờ.</p>
              </div>
            ) : (
              <div className="friends-list-zinc">
                {pending.map((req) => (
                  <div key={req.id} className="friend-item-zinc">
                    <div className="friend-avatar-wrap">
                      <img 
                        src={req.senderDTO?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.senderDTO?.nickname || 'req'}`} 
                        alt="Avatar" 
                        className="friend-avatar-img" 
                      />
                    </div>
                    <div className="friend-meta-zinc">
                      <span className="font-medium text-xs text-zinc-100">
                        {req.senderDTO?.nickname || req.senderDTO?.account}
                      </span>
                      <p className="font-mono text-[11px] text-zinc-500">@{req.senderDTO?.account}</p>
                    </div>
                    <div className="friend-actions-cell">
                      <button 
                        onClick={() => handleAccept(req.senderDTO?.id, req.senderDTO?.nickname)}
                        className="btn-accept-req font-mono"
                      >
                        Đồng ý
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <style>{`
        .friends-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
        }

        .friends-card-zinc {
          width: 100%;
          max-width: 420px;
          background: #0d0e12;
          border: 1px solid #27272a;
          border-radius: 12px;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.8);
          overflow: hidden;
        }

        .friends-header-zinc {
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #1f2026;
          background: #09090b;
        }

        .friends-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-close-zinc {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 1px solid #27272a;
          background: #14151a;
          color: #a1a1aa;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .btn-close-zinc:hover {
          color: white;
          background: #27272a;
        }

        .friends-tabs-zinc {
          display: flex;
          background: #09090b;
          border-bottom: 1px solid #1f2026;
        }

        .tab-btn-zinc {
          flex: 1;
          background: transparent;
          border: none;
          color: #71717a;
          padding: 9px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.15s;
        }
        .tab-btn-zinc:hover {
          color: #d4d4d8;
        }
        .tab-btn-zinc.active {
          color: #f4f4f5;
          border-bottom-color: #f4f4f5;
          background: rgba(255, 255, 255, 0.02);
        }

        .badge-count-zinc {
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #f4f4f5;
          font-size: 9.5px;
          padding: 0.5px 5px;
          border-radius: 4px;
        }

        .friends-content-zinc {
          padding: 12px;
          min-height: 220px;
          max-height: 380px;
          overflow-y: auto;
        }

        .friends-loading-zinc, .friends-empty-zinc {
          text-align: center;
          padding: 36px 16px;
          color: #71717a;
        }

        .friends-list-zinc {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .friend-item-zinc {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 10px;
          background: rgba(24, 24, 27, 0.4);
          border: 1px solid #1f2026;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .friend-item-zinc:hover {
          background: rgba(24, 24, 27, 0.8);
          border-color: #3f3f46;
        }

        .friend-avatar-wrap {
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #18181b;
          border: 1px solid #27272a;
          flex-shrink: 0;
        }
        .friend-avatar-img {
          width: 100%;
          height: 100%;
          border-radius: 8px;
          object-fit: cover;
        }

        .dot-online-zinc {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          border: 1.5px solid #0d0e12;
        }

        .friend-meta-zinc {
          flex: 1;
          min-width: 0;
        }

        .friend-actions-cell {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-friend-action {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          border: 1px solid #27272a;
          background: #18181b;
          color: #a1a1aa;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .btn-friend-action:hover {
          color: white;
          background: #27272a;
        }
        .btn-friend-action.call {
          color: #34d399;
          border-color: rgba(16, 185, 129, 0.3);
        }
        .btn-friend-action.danger:hover {
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
        }

        .btn-accept-req {
          background: #f4f4f5;
          border: none;
          color: #09090b;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-accept-req:hover {
          background: white;
        }
      `}</style>
    </div>
  );
};

export default FriendsModal;
