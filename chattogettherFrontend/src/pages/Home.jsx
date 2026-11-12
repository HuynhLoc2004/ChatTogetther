import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, LogOut, Plus, MessageSquare, Shield, User, X, Lock, Hash, CheckCircle, ArrowRight, WifiOff } from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import { saveRoomsOffline, getRoomsOffline } from '../utils/offlineDB';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import toast from 'react-hot-toast';

import UserProfileModal from './UserProfileModal';
import FriendsModal from './FriendsModal';

const Home = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const navigate = useNavigate();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  const [newRoomData, setNewRoomData] = useState({ name: '', password: '', nickname: '' });
  const [joinData, setJoinData] = useState({ nickname: '', password: '' });
  const [isWakingUp, setIsWakingUp] = useState(false);

  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => setIsWakingUp(true), 2500);
    } else {
      setIsWakingUp(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const currentUserId = localStorage.getItem('user_id');

  // Kiểm tra xem user có phải là thành viên của phòng này không
  const isUserInRoom = (room) => {
    if (!currentUserId || !room?.userRoomDTOList) return false;
    return room.userRoomDTOList.some(ur => ur.userDTO?.id?.toString() === currentUserId.toString());
  };

  // Kiểm tra xem user có đang ở trong phòng nào không
  const checkActiveRoom = async () => {
    if (sessionStorage.getItem('hasCheckedActiveRoom')) {
      return false;
    }

    try {
      const response = await axiosClient.get('/users/active-room');
      if (response.data && response.data.data) {
        sessionStorage.setItem('hasCheckedActiveRoom', 'true');
        navigate(`/room/${response.data.data}`);
        return true;
      }
    } catch (err) {
      console.error("Lỗi khi kiểm tra phòng hoạt động:", err);
    }
    
    sessionStorage.setItem('hasCheckedActiveRoom', 'true');
    return false;
  };

  // Lấy danh sách phòng từ Backend (kèm sao lưu ngoại tuyến)
  const fetchRooms = async (isSilent = false, retries = 2) => {
    try {
      if (!isSilent) setLoading(true);
      const response = await axiosClient.get('/rooms/info-rooms'); 
      if (response.data && response.data.data) {
        setRooms(response.data.data);
        setError(null);
        saveRoomsOffline(response.data.data);
      }
    } catch (err) {
      console.error("Lỗi khi lấy danh sách phòng:", err);
      // Nạp danh sách từ bộ nhớ ngoại tuyến nếu mất mạng
      const cached = await getRoomsOffline();
      if (cached && cached.length > 0) {
        setRooms(cached);
        setError(null);
      } else if (retries > 0) {
        setTimeout(() => fetchRooms(isSilent, retries - 1), 2000);
      } else {
        if (!isSilent) setError("Hệ thống đang bận hoặc ngoại tuyến, vui lòng thử lại sau!");
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchRooms(true);
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast("Đang hoạt động ở chế độ ngoại tuyến", { icon: '📶' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      // Đọc bộ nhớ đệm trước để hiển thị siêu tốc < 50ms
      const cached = await getRoomsOffline();
      if (cached && cached.length > 0 && isMounted) {
        setRooms(cached);
        setLoading(false);
      }
      
      // Đồng bộ từ máy chủ
      fetchRooms();
      checkActiveRoom();
    };

    init();
    
    const socketUrl = BACKEND_URL ? `${BACKEND_URL}/ws-gs-guide` : '/ws-gs-guide';
    const socket = new SockJS(socketUrl);
    const stompClient = Stomp.over(socket);
    stompClient.debug = null;

    stompClient.connect({}, () => {
      if (!isMounted) return;
      stompClient.subscribe('/topic/rooms', (message) => {
        fetchRooms(true);
      });
    }, (err) => {
      console.warn("WebSocket kết nối lại sau...", err);
    });

    return () => {
      isMounted = false;
      if (stompClient.connected) {
        stompClient.disconnect();
      }
    };
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    toast.success("Đã đăng xuất tài khoản!");
    navigate('/login');
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomData.name.trim()) {
      toast.error("Vui lòng nhập tên phòng chat!");
      return;
    }

    try {
      const response = await axiosClient.post('/rooms/create', {
        nameRoom: newRoomData.name.trim(),
        password: newRoomData.password || "",
        nickname: newRoomData.nickname.trim()
      });

      if (response.status === 200) {
        const { roomId, accessToken } = response.data.data;
        if (accessToken) {
          localStorage.setItem('accesstoken', accessToken);
        }
        toast.success("Tạo phòng thành công!");
        sessionStorage.setItem('hasCheckedActiveRoom', 'true');
        setIsCreateModalOpen(false);
        setNewRoomData({ name: '', password: '', nickname: '' });
        navigate(`/room/${roomId}`);
      }
    } catch (err) {
      console.error("Lỗi khi tạo phòng:", err);
      toast.error(err.response?.data?.message || "Không thể tạo phòng, vui lòng thử lại!");
    }
  };

  const handleRoomClick = (room) => {
    // Nếu user đã là thành viên trong phòng này thì vào thẳng, không cần nhập mật khẩu
    if (isUserInRoom(room)) {
      sessionStorage.setItem('hasCheckedActiveRoom', 'true');
      navigate(`/room/${room.id}`);
      return;
    }
    setJoinData({ nickname: '', password: '' });
    setSelectedRoom(room);
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    try {
      const response = await axiosClient.post(`/rooms/join-room`, 
        { nickname: joinData.nickname.trim(), password: joinData.password.trim() },
        { params: { room_id: selectedRoom.id } }
      );

      if (response.status === 200) {
        const roomId = response.data.data;
        toast.success("Tham gia phòng thành công!");
        setSelectedRoom(null);
        setJoinData({ nickname: '', password: '' });
        sessionStorage.setItem('hasCheckedActiveRoom', 'true');
        navigate(`/room/${roomId}`);
      }
    } catch (err) {
      console.error("Lỗi khi tham gia phòng:", err);
      toast.error(err.response?.data?.message || "Mật khẩu không chính xác hoặc không thể vào phòng!");
    }
  };

  return (
    <div className="home-wrapper">
      <div className="home-container">
        {isOffline && (
          <div className="offline-banner">
            <WifiOff size={16} />
            <span>Bạn đang ở chế độ Ngoại tuyến. Đang hiển thị danh sách phòng đã lưu trong máy.</span>
          </div>
        )}
        <header className="home-header">
          <div className="header-brand">
            <div className="brand-logo-badge">
              <MessageSquare color="white" size={24} />
            </div>
            <div>
              <h1 className="logo-text">Chat Togetther</h1>
              <span className="app-subtitle">Nền tảng chat thời gian thực</span>
            </div>
          </div>
          
          <div className="header-actions">
            <button 
              onClick={() => setIsFriendsOpen(true)}
              className="btn-header-secondary"
              title="Danh sách bạn bè & Lời mời"
            >
              <Users size={16} />
              <span className="hide-on-mobile">Bạn bè</span>
            </button>

            <button 
              onClick={() => setIsProfileOpen(true)}
              className="btn-header-secondary"
              title="Hồ sơ cá nhân của bạn"
            >
              <User size={16} />
              <span className="hide-on-mobile">Hồ sơ</span>
            </button>

            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-create-room" 
            >
              <Plus size={18} />
              <span>Tạo Phòng</span>
            </button>
            
            <button onClick={handleLogout} className="btn-logout" title="Đăng xuất">
              <LogOut size={18} />
              <span className="hide-on-mobile">Đăng xuất</span>
            </button>
          </div>
        </header>

        <section className="section-title-area">
          <h2 className="section-heading">Phòng Đang Hoạt Động</h2>
          <p className="section-desc">Chọn một phòng để trò chuyện hoặc tự tạo phòng cho riêng bạn.</p>
        </section>

        {loading ? (
          <div className="status-box">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <Hash size={40} className="spinner-icon" />
            </motion.div>
            <p>Đang tải danh sách phòng...</p>
            {isWakingUp && (
              <p style={{ fontSize: '0.85rem', color: '#818cf8', marginTop: '0.5rem', maxWidth: '400px', marginInline: 'auto', lineHeight: '1.4' }}>
                🚀 Đang đánh thức máy chủ Render... Quá trình này mất khoảng 20-30 giây cho lần truy cập đầu tiên sau khi nghỉ.
              </p>
            )}
          </div>
        ) : error ? (
          <div className="status-box error-box">
            <p className="error-text">{error}</p>
            <button onClick={() => fetchRooms()} className="btn-retry">Thử lại</button>
          </div>
        ) : (
          <div className="rooms-grid">
            {rooms.length > 0 ? (
              rooms.map((room) => {
                const alreadyIn = isUserInRoom(room);
                return (
                  <motion.div 
                    key={room.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -6 }}
                    className={`room-card ${alreadyIn ? 'is-my-room' : ''}`}
                  >
                    <div className="room-card-header">
                      <div className="room-title-group">
                        <h3 className="room-name">{room.nameroom}</h3>
                        <div className="badge-row">
                          {room.hasPassword && (
                            <span className="badge badge-locked" title="Phòng có mật khẩu bảo vệ">
                              <Lock size={12} /> Khóa
                            </span>
                          )}
                          {alreadyIn && (
                            <span className="badge badge-joined" title="Bạn đã là thành viên trong phòng này">
                              <CheckCircle size={12} /> Phòng của bạn
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="online-pill">
                        <span className="online-dot"></span>
                        <span>{room.soluong || 0} online</span>
                      </div>
                    </div>

                    <div className="members-preview">
                      {room.userRoomDTOList && room.userRoomDTOList.slice(0, 4).map((ur, index) => (
                        <span key={index} className="member-tag">
                          {ur.userDTO?.nickname || "User"}
                        </span>
                      ))}
                      {room.userRoomDTOList?.length > 4 && (
                        <span className="more-members">+{room.userRoomDTOList.length - 4}</span>
                      )}
                    </div>

                    <button 
                      className={`btn-action-room ${alreadyIn ? 'btn-rejoin' : 'btn-join'}`}
                      onClick={() => handleRoomClick(room)}
                    >
                      <span>{alreadyIn ? 'Vào Lại Phòng' : 'Tham Gia Ngay'}</span>
                      <ArrowRight size={16} />
                    </button>
                  </motion.div>
                );
              })
            ) : (
              <div className="empty-rooms">
                <MessageSquare size={48} className="empty-icon" />
                <h3>Chưa có phòng nào hoạt động</h3>
                <p>Hãy tạo phòng đầu tiên để bắt đầu trò chuyện cùng mọi người!</p>
                <button onClick={() => setIsCreateModalOpen(true)} className="btn-create-first">
                  <Plus size={18} /> Tạo phòng mới
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal Tạo Phòng */}
        <AnimatePresence>
          {isCreateModalOpen && (
            <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 15 }} 
                className="modal-box" 
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2 className="modal-title">Tạo Phòng Mới</h2>
                  <button onClick={() => setIsCreateModalOpen(false)} className="btn-close-modal">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateRoom} className="modal-form">
                  <div className="form-item">
                    <label>
                      <User size={15} /> Nickname của bạn
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder="VD: Lộc Đẹp Trai" 
                      value={newRoomData.nickname} 
                      onChange={(e) => setNewRoomData({...newRoomData, nickname: e.target.value})} 
                    />
                  </div>

                  <div className="form-item">
                    <label>
                      <MessageSquare size={15} /> Tên phòng chat
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder="VD: Nhóm Công Việc..." 
                      value={newRoomData.name} 
                      onChange={(e) => setNewRoomData({...newRoomData, name: e.target.value})} 
                    />
                  </div>

                  <div className="form-item">
                    <label>
                      <Lock size={15} /> Mật khẩu phòng (tùy chọn)
                    </label>
                    <input 
                      type="password" 
                      placeholder="Để trống nếu muốn phòng công khai" 
                      value={newRoomData.password} 
                      onChange={(e) => setNewRoomData({...newRoomData, password: e.target.value})} 
                    />
                  </div>
                  
                  <div className="modal-actions">
                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn-cancel">
                      Hủy
                    </button>
                    <button type="submit" className="btn-submit">
                      Tạo Phòng Ngay
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Tham Gia Phòng */}
        <AnimatePresence>
          {selectedRoom && (
            <div className="modal-backdrop" onClick={() => setSelectedRoom(null)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 15 }} 
                className="modal-box" 
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <div>
                    <h2 className="modal-title">Tham Gia Phòng</h2>
                    <p className="modal-subtitle">Phòng: <strong>{selectedRoom.nameroom}</strong></p>
                  </div>
                  <button onClick={() => setSelectedRoom(null)} className="btn-close-modal">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleJoinRoom} className="modal-form">
                  <div className="form-item">
                    <label>
                      <User size={15} /> Nickname hiển thị
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Nhập tên hiển thị của bạn" 
                      value={joinData.nickname} 
                      onChange={(e) => setJoinData({...joinData, nickname: e.target.value})} 
                    />
                  </div>

                  {selectedRoom.hasPassword ? (
                    <div className="form-item">
                      <label className="label-warning">
                        <Lock size={15} /> Mật khẩu phòng (Bắt buộc)
                      </label>
                      <input 
                        type="password" 
                        required 
                        placeholder="Nhập mật khẩu để vào phòng" 
                        value={joinData.password} 
                        onChange={(e) => setJoinData({...joinData, password: e.target.value})} 
                        className="input-password"
                      />
                    </div>
                  ) : (
                    <div className="info-banner">
                      <Shield size={16} />
                      <span>Phòng công khai — Bạn có thể vào trực tiếp</span>
                    </div>
                  )}
                  
                  <div className="modal-actions">
                    <button type="button" onClick={() => setSelectedRoom(null)} className="btn-cancel">
                      Hủy
                    </button>
                    <button type="submit" className="btn-submit btn-submit-join">
                      Vào Phòng Chat
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Hồ Sơ Cá Nhân */}
        {isProfileOpen && (
          <UserProfileModal 
            userId={currentUserId}
            currentUserId={currentUserId}
            onClose={() => setIsProfileOpen(false)}
          />
        )}

        {/* Modal Bạn Bè */}
        {isFriendsOpen && (
          <FriendsModal 
            onClose={() => setIsFriendsOpen(false)}
            onSelectUser={(uid) => {
              setIsFriendsOpen(false);
              setIsProfileOpen(true);
            }}
          />
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .btn-header-secondary {
          background: #1e293b;
          color: #cbd5e1;
          border: 1px solid #334155;
          padding: 0.65rem 1rem;
          border-radius: 0.85rem;
          font-weight: 500;
          font-size: 0.9rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.15s;
        }
        .btn-header-secondary:hover {
          background: #334155;
          color: white;
          border-color: #475569;
        }
        .offline-banner {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.35);
          color: #fbbf24;
          padding: 8px 16px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 1.5rem;
        }
        .home-wrapper {
          min-height: 100vh;
          background: #0f172a;
          color: #f8fafc;
          padding: 1.5rem 1rem;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .home-container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .home-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2.5rem;
          flex-wrap: wrap;
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .brand-logo-badge {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          padding: 0.6rem;
          border-radius: 1rem;
          box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .logo-text {
          margin: 0;
          font-size: 1.8rem;
          font-weight: 800;
          background: linear-gradient(to right, #ffffff, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .app-subtitle {
          font-size: 0.85rem;
          color: #64748b;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .btn-create-room {
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          color: white;
          border: none;
          padding: 0.65rem 1.25rem;
          border-radius: 0.85rem;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .btn-create-room:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(79, 70, 229, 0.45);
        }
        .btn-logout {
          background: #1e293b;
          color: #94a3b8;
          border: 1px solid #334155;
          padding: 0.65rem 1rem;
          border-radius: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: background 0.15s, color 0.15s;
        }
        .btn-logout:hover {
          background: #334155;
          color: #f1f5f9;
        }
        .section-title-area {
          margin-bottom: 2rem;
        }
        .section-heading {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 0.35rem 0;
        }
        .section-desc {
          color: #94a3b8;
          font-size: 0.95rem;
          margin: 0;
        }
        .rooms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .room-card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 1.25rem;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .room-card:hover {
          border-color: #4f46e5;
          box-shadow: 0 12px 24px -10px rgba(0, 0, 0, 0.4);
        }
        .room-card.is-my-room {
          border-color: rgba(16, 185, 129, 0.4);
          background: linear-gradient(180deg, rgba(16, 185, 129, 0.05) 0%, #1e293b 100%);
        }
        .room-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .room-name {
          font-size: 1.2rem;
          font-weight: 700;
          margin: 0 0 0.4rem 0;
          color: #f8fafc;
          word-break: break-word;
        }
        .badge-row {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          padding: 0.2rem 0.5rem;
          border-radius: 0.5rem;
          font-weight: 600;
        }
        .badge-locked {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .badge-joined {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .online-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          color: #34d399;
          font-size: 0.75rem;
          padding: 0.25rem 0.6rem;
          border-radius: 1rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .online-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }
        .members-preview {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          min-height: 2rem;
          margin-bottom: 1.5rem;
        }
        .member-tag {
          font-size: 0.75rem;
          background: rgba(79, 70, 229, 0.15);
          color: #a5b4fc;
          padding: 0.2rem 0.6rem;
          border-radius: 0.5rem;
          border: 1px solid rgba(79, 70, 229, 0.25);
        }
        .more-members {
          font-size: 0.75rem;
          color: #64748b;
          align-self: center;
        }
        .btn-action-room {
          width: 100%;
          border: none;
          padding: 0.75rem 1rem;
          border-radius: 0.85rem;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: transform 0.15s, opacity 0.15s;
        }
        .btn-action-room:hover {
          transform: translateY(-1px);
          opacity: 0.95;
        }
        .btn-join {
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          color: white;
        }
        .btn-rejoin {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          color: white;
        }
        .empty-rooms {
          grid-column: 1 / -1;
          text-align: center;
          padding: 4rem 1.5rem;
          background: rgba(30, 41, 59, 0.4);
          border: 2px dashed #334155;
          border-radius: 1.5rem;
        }
        .empty-icon {
          color: #475569;
          margin-bottom: 0.75rem;
        }
        .empty-rooms h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
        }
        .empty-rooms p {
          color: #94a3b8;
          margin: 0 0 1.5rem 0;
          font-size: 0.95rem;
        }
        .btn-create-first {
          background: #4f46e5;
          color: white;
          border: none;
          padding: 0.7rem 1.5rem;
          border-radius: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        .status-box {
          text-align: center;
          padding: 4rem 1rem;
          color: #94a3b8;
        }
        .spinner-icon {
          color: #6366f1;
          margin-bottom: 0.75rem;
        }
        .error-box {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 1rem;
        }
        .error-text {
          color: #f87171;
          font-weight: 600;
          margin-bottom: 1rem;
        }
        .btn-retry {
          background: transparent;
          border: 1px solid #ef4444;
          color: #ef4444;
          padding: 0.5rem 1.2rem;
          border-radius: 0.6rem;
          cursor: pointer;
        }
        /* Modal Styles */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .modal-box {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 1.5rem;
          padding: 2rem;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }
        .modal-title {
          margin: 0;
          font-size: 1.4rem;
          font-weight: 800;
        }
        .modal-subtitle {
          margin: 0.35rem 0 0 0;
          color: #94a3b8;
          font-size: 0.9rem;
        }
        .btn-close-modal {
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: #94a3b8;
          padding: 0.4rem;
          border-radius: 0.6rem;
          cursor: pointer;
          display: flex;
        }
        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .form-item label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          color: #94a3b8;
          font-weight: 600;
          margin-bottom: 0.45rem;
        }
        .label-warning {
          color: #f87171 !important;
        }
        .form-item input {
          width: 100%;
          padding: 0.8rem 1rem;
          border-radius: 0.85rem;
          border: 1px solid #334155;
          background: #0f172a;
          color: white;
          outline: none;
          font-size: 0.95rem;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .form-item input:focus {
          border-color: #6366f1;
        }
        .input-password:focus {
          border-color: #f87171 !important;
        }
        .info-banner {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          color: #34d399;
          font-size: 0.85rem;
          padding: 0.75rem 1rem;
          border-radius: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .modal-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }
        .btn-cancel {
          flex: 1;
          background: #334155;
          color: #cbd5e1;
          border: none;
          padding: 0.85rem;
          border-radius: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-submit {
          flex: 2;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          color: white;
          border: none;
          padding: 0.85rem;
          border-radius: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
        }
        .btn-submit-join {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
        }
        @media (max-width: 640px) {
          .home-wrapper { padding: 1rem 0.75rem; }
          .logo-text { font-size: 1.5rem; }
          .hide-on-mobile { display: none; }
          .rooms-grid { grid-template-columns: 1fr; }
          .modal-box { padding: 1.5rem; border-radius: 1.25rem; }
        }
      `}} />
    </div>
  );
};

export default Home;
