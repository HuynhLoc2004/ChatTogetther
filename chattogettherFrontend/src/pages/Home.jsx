import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, LogOut, Plus, MessageSquare, Shield, User } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';

import axios from 'axios';

const Home = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  const [newRoomData, setNewRoomData] = useState({ name: '', password: '', nickname: '' });
  const [joinData, setJoinData] = useState({ nickname: '', password: '' });

  // Lấy danh sách phòng từ Backend (Dùng axios trực tiếp để không dính Interceptor token)
  const fetchRooms = async (isSilent = false, retries = 2) => {
    try {
      if (!isSilent) setLoading(true);
      
      const response = await axios.get('http://localhost:8080/api/rooms/info-rooms');
      
      if (response.data && response.data.data) {
        setRooms(response.data.data);
        setError(null);
      }
    } catch (err) {
      console.error("Lỗi khi lấy danh sách phòng:", err);
      if (retries > 0) {
        console.log(`Đang thử lại... còn ${retries} lần thử`);
        setTimeout(() => fetchRooms(isSilent, retries - 1), 2000);
      } else {
        if (!isSilent) setError("Không thể tải danh sách phòng. Hệ thống đang bận, vui lòng đợi giây lát!");
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    
    // Thiết lập kết nối WebSocket
    const socket = new SockJS('http://localhost:8080/ws-gs-guide');
    const stompClient = Stomp.over(socket);
    stompClient.debug = null; // Tắt log debug để console sạch hơn

    stompClient.connect({}, () => {
      // Đăng ký chủ đề /topic/rooms
      stompClient.subscribe('/topic/rooms', (message) => {
        // Ngay khi nhận được bất kỳ tin nhắn nào (NEW_ROOM_CREATED hoặc ROOM_UPDATED)
        // Chúng ta gọi API fetchRooms() ngay lập tức
        fetchRooms(true); 
      });
    });

    // Gọi API dự phòng mỗi 60 giây (vẫn giữ để đảm bảo dữ liệu luôn đồng bộ)
    const intervalId = setInterval(() => {
      fetchRooms(true);
    }, 60000);

    return () => {
      clearInterval(intervalId);
      if (stompClient.connected) {
        stompClient.disconnect();
      }
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accesstoken');
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
        // Lưu token mới chứa quyền AD_ROOM
        if (accessToken) {
          localStorage.setItem('accesstoken', accessToken);
        }
        setIsCreateModalOpen(false);
        setNewRoomData({ name: '', password: '', nickname: '' });
        navigate(`/room/${roomId}`); // Chuyển sang phòng chat ngay lập tức
      }
    } catch (err) {
      console.error("Lỗi khi tạo phòng:", err);
      alert(err.response?.data?.message || "Đã có lỗi xảy ra khi tạo phòng!");
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    try {
      const response = await axiosClient.post(`/rooms/join-room`, 
        { 
          nickname: joinData.nickname, 
          password: joinData.password 
        },
        { 
          params: { room_id: selectedRoom.id } 
        }
      );

      if (response.status === 200) {
        const roomId = response.data.data;
        setSelectedRoom(null);
        setJoinData({ nickname: '', password: '' });
        navigate(`/room/${roomId}`); // Chuyển sang phòng chat ngay lập tức
      }
    } catch (err) {
      console.error("Lỗi khi tham gia phòng:", err);
      alert(err.response?.data?.message || "Không thể tham gia phòng!");
    }
  };

  return (
    <div className="home-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header className="home-header" style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'var(--primary)', padding: '0.5rem', borderRadius: '0.75rem' }}>
             <MessageSquare color="white" size={24} />
          </div>
          <h1 className="logo-text" style={{ margin: 0 }}>Chat Togetther</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreateModalOpen(true)}
            className="auth-button" 
            style={{ marginTop: 0, width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem' }}
          >
            <Plus size={20} /> Tạo Phòng
          </motion.button>
          
          <button onClick={handleLogout} className="join-btn" style={{ width: 'auto', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogOut size={18} /> Đăng xuất
          </button>
        </div>
      </header>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Phòng Đang Hoạt Động</h2>
        <p style={{ color: 'var(--text-muted)' }}>Chọn một phòng để bắt đầu trò chuyện cùng mọi người.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Đang tải danh sách phòng...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'red' }}>{error}</div>
      ) : (
        <motion.div layout className="rooms-grid">
          {rooms.length > 0 ? (
            rooms.map((room) => (
              <motion.div 
                key={room.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -5, borderColor: 'var(--primary)' }}
                className="room-card"
                style={{ position: 'relative', overflow: 'hidden' }}
              >
                {/* Giả định backend trả về nameroom như trong DTO */}
                <div className="room-info" style={{ marginBottom: '1rem' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <h3 className="room-name" style={{ margin: 0 }}>{room.nameroom}</h3>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.4rem', 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        padding: '0.2rem 0.6rem', 
                        borderRadius: '100px',
                        border: '1px solid rgba(16, 185, 129, 0.2)'
                      }}>
                        <motion.span 
                          animate={{ opacity: [1, 0.5, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}
                        ></motion.span>
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>Active</span>
                      </div>
                    </div>
                    <span className="user-count" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Users size={14} /> <strong>{room.soluong || 0}</strong> người đang trực tuyến
                    </span>
                  </div>
                </div>

                {room.userRoomDTOList && room.userRoomDTOList.length > 0 && (
                  <div style={{ marginBottom: '1.5rem', minHeight: '1.5rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {room.userRoomDTOList.slice(0, 3).map((ur, index) => (
                        <span key={index} style={{ 
                          fontSize: '0.7rem', 
                          background: 'rgba(79, 70, 229, 0.1)', 
                          color: 'var(--primary)', 
                          padding: '0.15rem 0.5rem', 
                          borderRadius: '4px',
                          border: '1px solid rgba(79, 70, 229, 0.2)'
                        }}>
                          {ur.userDTO?.nickname || "User"}
                        </span>
                      ))}
                      {room.userRoomDTOList.length > 3 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                          +{room.userRoomDTOList.length - 3} khác
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <button 
                  className="join-btn"
                  onClick={() => setSelectedRoom(room)}
                  style={{ width: '100%', borderRadius: '0.75rem' }}
                >
                  Tham Gia
                </button>
              </motion.div>
            ))
          ) : (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Chưa có phòng nào hoạt động. Hãy là người đầu tiên tạo phòng!
            </div>
          )}
        </motion.div>
      )}

      {/* Modal Tạo Phòng */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="modal-overlay">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="modal-content"
            >
              <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Tạo Phòng Mới</h2>
              <form onSubmit={handleCreateRoom}>
                <div className="form-group">
                  <label>Nickname của bạn</label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="form-input"
                      style={{ paddingLeft: '2.8rem' }}
                      placeholder="VD: Loc Dep Trai"
                      required
                      value={newRoomData.nickname}
                      onChange={(e) => setNewRoomData({...newRoomData, nickname: e.target.value})}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Tên phòng chat</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="VD: Nhóm Học Tập..."
                    required
                    value={newRoomData.name}
                    onChange={(e) => setNewRoomData({...newRoomData, name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Mật khẩu phòng (tùy chọn)</label>
                  <input 
                    type="password" 
                    className="form-input"
                    placeholder="Để trống nếu muốn phòng công khai"
                    value={newRoomData.password}
                    onChange={(e) => setNewRoomData({...newRoomData, password: e.target.value})}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <button type="button" className="join-btn" onClick={() => setIsCreateModalOpen(false)} style={{ flex: 1 }}>Hủy</button>
                  <button type="submit" className="auth-button" style={{ marginTop: 0, flex: 1 }}>Tạo Ngay</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Tham Gia Phòng */}
      <AnimatePresence>
        {selectedRoom && (
          <div className="modal-overlay">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-content"
            >
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                 <h2 style={{ margin: 0 }}>Tham gia: {selectedRoom.nameroom}</h2>
                 <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                   Vui lòng nhập thông tin để vào phòng
                 </p>
              </div>

              <form onSubmit={handleJoinRoom}>
                <div className="form-group">
                  <label>Nickname của bạn</label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="form-input"
                      style={{ paddingLeft: '2.8rem' }}
                      placeholder="VD: Loc Dep Trai"
                      required
                      value={joinData.nickname}
                      onChange={(e) => setJoinData({...joinData, nickname: e.target.value})}
                    />
                  </div>
                </div>
                
                {/* Logic password check sẽ được xử lý ở backend sau */}
                <div className="form-group">
                  <label>Mật khẩu phòng (nếu có)</label>
                  <div style={{ position: 'relative' }}>
                    <Shield size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="password" 
                      className="form-input"
                      style={{ paddingLeft: '2.8rem' }}
                      placeholder="Nhập mật khẩu nếu phòng yêu cầu"
                      value={joinData.password}
                      onChange={(e) => setJoinData({...joinData, password: e.target.value})}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <button type="button" className="join-btn" onClick={() => setSelectedRoom(null)} style={{ flex: 1 }}>Quay lại</button>
                  <button type="submit" className="auth-button" style={{ marginTop: 0, flex: 1 }}>Vào Phòng</button>
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
