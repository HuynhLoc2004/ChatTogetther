import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, LogOut, Plus, MessageSquare, Shield, User, X, Lock, Hash } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';

const Home = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  const [newRoomData, setNewRoomData] = useState({ name: '', password: '', nickname: '' });
  const [joinData, setJoinData] = useState({ nickname: '', password: '' });

  // Kiểm tra xem user có đang ở trong phòng nào không
  const checkActiveRoom = async () => {
    // Nếu trong session này đã kiểm tra/redirect một lần rồi thì không tự động làm lại
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
    
    // Đánh dấu là đã kiểm tra xong (dù có phòng hay không)
    sessionStorage.setItem('hasCheckedActiveRoom', 'true');
    return false;
  };

  // Lấy danh sách phòng từ Backend
  const fetchRooms = async (isSilent = false, retries = 2) => {
    try {
      if (!isSilent) setLoading(true);
      const response = await axiosClient.get('/rooms/info-rooms'); 
      if (response.data && response.data.data) {
        setRooms(response.data.data);
        setError(null);
      }
    } catch (err) {
      console.error("Lỗi khi lấy danh sách phòng:", err);
      if (retries > 0) {
        setTimeout(() => fetchRooms(isSilent, retries - 1), 2000);
      } else {
        if (!isSilent) setError("Hệ thống đang bận, vui lòng thử lại sau!");
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      // Logic: Kiểm tra phòng hoạt động trước, nếu không có mới tải danh sách phòng
      const isInRoom = await checkActiveRoom();
      if (!isInRoom && isMounted) {
        fetchRooms();
      }
    };

    init();
    
    const socket = new SockJS('/ws-gs-guide');
    const stompClient = Stomp.over(socket);
    stompClient.debug = null;

    stompClient.connect({}, () => {
      if (!isMounted) return;
      // Lắng nghe mọi cập nhật về phòng (tạo mới, cập nhật, xóa, giải tán)
      stompClient.subscribe('/topic/rooms', (message) => {
        console.log("Nhận thông báo cập nhật phòng:", message.body);
        fetchRooms(true); // Tải lại danh sách phòng mà không hiện loading screen
      });
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
    window.location.href = '/login';
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    try {
      const response = await axiosClient.post('/rooms/create', {
        nameRoom: newRoomData.name,
        password: newRoomData.password || "",
        nickname: newRoomData.nickname
      });

      if (response.status === 200) {
        const { roomId, accessToken } = response.data.data;
        if (accessToken) {
          localStorage.setItem('accesstoken', accessToken);
        }
        // Đánh dấu đã vào phòng để không bị redirect ngược lại Home khi mount
        sessionStorage.setItem('hasCheckedActiveRoom', 'true');
        setIsCreateModalOpen(false);
        setNewRoomData({ name: '', password: '', nickname: '' });
        navigate(`/room/${roomId}`);
      }
    } catch (err) {
      console.error("Lỗi khi tạo phòng:", err);
      alert(err.response?.data?.message || "Đã có lỗi xảy ra!");
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    try {
      const response = await axiosClient.post(`/rooms/join-room`, 
        { nickname: joinData.nickname, password: joinData.password },
        { params: { room_id: selectedRoom.id } }
      );

      if (response.status === 200) {
        const roomId = response.data.data;
        setSelectedRoom(null);
        setJoinData({ nickname: '', password: '' });
        sessionStorage.setItem('hasCheckedActiveRoom', 'true');
        navigate(`/room/${roomId}`);
      }
    } catch (err) {
      console.error("Lỗi khi tham gia phòng:", err);
      alert(err.response?.data?.message || "Không thể tham gia phòng!");
    }
  };

  return (
    <div className="home-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: '#f8fafc' }}>
      <header className="home-header" style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', padding: '0.6rem', borderRadius: '1rem', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
             <MessageSquare color="white" size={28} />
          </div>
          <h1 className="logo-text" style={{ margin: 0, fontSize: '2.2rem', fontWeight: 800 }}>Chat Togetther</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <motion.button 
            whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(79, 70, 229, 0.4)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreateModalOpen(true)}
            className="auth-button" 
            style={{ marginTop: 0, width: 'auto', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1.5rem', borderRadius: '1rem' }}
          >
            <Plus size={20} /> Tạo Phòng
          </motion.button>
          
          <button onClick={handleLogout} className="join-btn" style={{ width: 'auto', padding: '0.7rem 1.2rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', border: '1px solid #334155', color: '#94a3b8' }}>
            <LogOut size={18} /> Đăng xuất
          </button>
        </div>
      </header>

      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', fontWeight: 700 }}>Phòng Đang Hoạt Động</h2>
        <p style={{ color: '#94a3b8', fontSize: '1rem' }}>Tham gia một cộng đồng và bắt đầu trò chuyện ngay bây giờ.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: '#94a3b8' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-block', marginBottom: '1rem' }}>
             <Hash size={40} />
          </motion.div>
          <p>Đang tải danh sách phòng...</p>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <p style={{ color: '#ef4444', fontWeight: 600 }}>{error}</p>
          <button onClick={() => fetchRooms()} style={{ marginTop: '1rem', background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem 1.5rem', borderRadius: '0.75rem', cursor: 'pointer' }}>Thử lại</button>
        </div>
      ) : (
        <motion.div layout className="rooms-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
          {rooms.length > 0 ? (
            rooms.map((room) => (
              <motion.div 
                key={room.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -8, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}
                className="room-card"
                style={{ position: 'relative', overflow: 'hidden', padding: '2rem', border: '1px solid #334155', borderRadius: '1.5rem', background: '#1e293b' }}
              >
                <div className="room-info" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h3 className="room-name" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc' }}>{room.nameroom}</h3>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        background: 'rgba(16, 185, 129, 0.15)', 
                        padding: '0.3rem 0.8rem', 
                        borderRadius: '2rem',
                        border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
                        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>Online</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Users size={16} /> <strong>{room.soluong || 0}</strong> thành viên trực tuyến
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', minHeight: '1.8rem' }}>
                  {room.userRoomDTOList && room.userRoomDTOList.slice(0, 4).map((ur, index) => (
                    <span key={index} style={{ fontSize: '0.75rem', background: 'rgba(79, 70, 229, 0.15)', color: '#818cf8', padding: '0.2rem 0.7rem', borderRadius: '0.5rem', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                      {ur.userDTO?.nickname || "User"}
                    </span>
                  ))}
                  {room.userRoomDTOList?.length > 4 && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center' }}>+{room.userRoomDTOList.length - 4}</span>
                  )}
                </div>

                <button 
                  className="auth-button"
                  onClick={() => setSelectedRoom(room)}
                  style={{ width: '100%', borderRadius: '1rem', marginTop: 0, padding: '0.8rem', background: 'linear-gradient(to right, #4f46e5, #6366f1)' }}
                >
                  Tham Gia Ngay
                </button>
              </motion.div>
            ))
          ) : (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', color: '#94a3b8', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '2rem', border: '2px dashed #334155' }}>
              <MessageSquare size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>Chưa có phòng nào hoạt động. Hãy tạo phòng đầu tiên để bắt đầu!</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Modal Tạo Phòng */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="modal-content" 
              style={{ background: '#1e293b', padding: '2.5rem', borderRadius: '2rem', width: '100%', maxWidth: '450px', border: '1px solid #334155', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tạo Phòng Mới</h2>
                <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.75rem' }}><X size={20} /></button>
              </div>

              <form onSubmit={handleCreateRoom}>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem', fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>
                    <User size={16} /> Nickname của bạn
                  </label>
                  <input type="text" className="form-input" required placeholder="VD: Lộc Đẹp Trai" value={newRoomData.nickname} onChange={(e) => setNewRoomData({...newRoomData, nickname: e.target.value})} style={{ width: '100%', padding: '0.9rem 1.2rem', borderRadius: '1rem', border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }} />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem', fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>
                    <MessageSquare size={16} /> Tên phòng chat
                  </label>
                  <input type="text" className="form-input" required placeholder="VD: Nhóm Học Tập..." value={newRoomData.name} onChange={(e) => setNewRoomData({...newRoomData, name: e.target.value})} style={{ width: '100%', padding: '0.9rem 1.2rem', borderRadius: '1rem', border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }} />
                </div>
                <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem', fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>
                    <Lock size={16} /> Mật khẩu (tùy chọn)
                  </label>
                  <input type="password" className="form-input" placeholder="Để trống nếu muốn phòng công khai" value={newRoomData.password} onChange={(e) => setNewRoomData({...newRoomData, password: e.target.value})} style={{ width: '100%', padding: '0.9rem 1.2rem', borderRadius: '1rem', border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }} />
                </div>
                
                <div style={{ display: 'flex', gap: '1.2rem' }}>
                  <button type="submit" className="auth-button" style={{ flex: 1, marginTop: 0, padding: '1rem', borderRadius: '1.2rem', background: 'linear-gradient(to right, #4f46e5, #7c3aed)', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)' }}>Tạo Phòng Ngay</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Tham Gia Phòng */}
      <AnimatePresence>
        {selectedRoom && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="modal-content" style={{ background: '#1e293b', padding: '2.5rem', borderRadius: '2rem', width: '100%', maxWidth: '450px', border: '1px solid #334155', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                 <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Tham gia</h2>
                 <button onClick={() => setSelectedRoom(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.75rem' }}><X size={20} /></button>
              </div>
              <p style={{ color: '#94a3b8', marginBottom: '2rem', fontSize: '1rem' }}>Vào phòng: <strong style={{ color: '#f8fafc' }}>{selectedRoom.nameroom}</strong></p>

              <form onSubmit={handleJoinRoom}>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem', fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>
                    <User size={16} /> Nickname của bạn
                  </label>
                  <input type="text" className="form-input" required placeholder="VD: Lộc Đẹp Trai" value={joinData.nickname} onChange={(e) => setJoinData({...joinData, nickname: e.target.value})} style={{ width: '100%', padding: '0.9rem 1.2rem', borderRadius: '1rem', border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }} />
                </div>
                <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem', fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>
                    <Shield size={16} /> Mật khẩu phòng
                  </label>
                  <input type="password" className="form-input" placeholder="Nhập mật khẩu nếu phòng yêu cầu" value={joinData.password} onChange={(e) => setJoinData({...joinData, password: e.target.value})} style={{ width: '100%', padding: '0.9rem 1.2rem', borderRadius: '1rem', border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }} />
                </div>
                
                <div style={{ display: 'flex', gap: '1.2rem' }}>
                  <button type="submit" className="auth-button" style={{ flex: 1, marginTop: 0, padding: '1rem', borderRadius: '1.2rem', background: 'linear-gradient(to right, #10b981, #059669)', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.4)' }}>Vào Phòng Chat</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
