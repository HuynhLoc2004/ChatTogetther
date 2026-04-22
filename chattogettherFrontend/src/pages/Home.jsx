import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, LogOut, Plus, Search, MessageSquare, Shield, User } from 'lucide-react';

const Home = () => {
  const [rooms, setRooms] = useState([
    { id: 1, name: 'Lập Trình Viên Việt', users: 24, hasPassword: true },
    { id: 2, name: 'Góc Tâm Sự Đêm Khuya', users: 15, hasPassword: false },
    { id: 3, name: 'Học ReactJS & Spring Boot', users: 42, hasPassword: true },
    { id: 4, name: 'Chém Gió Xuyên Lục Địa', users: 8, hasPassword: false },
  ]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  const [newRoomData, setNewRoomData] = useState({ name: '', password: '' });
  const [joinData, setJoinData] = useState({ nickname: '', password: '' });

  const handleLogout = () => {
    localStorage.removeItem('accesstoken');
    window.location.href = '/login';
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    const newRoom = {
      id: rooms.length + 1,
      name: newRoomData.name,
      users: 1,
      hasPassword: !!newRoomData.password
    };
    setRooms([newRoom, ...rooms]);
    setIsCreateModalOpen(false);
    setNewRoomData({ name: '', password: '' });
    alert(`Đã tạo phòng: ${newRoom.name}`);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    alert(`Đang tham gia phòng ${selectedRoom.name} với Nickname: ${joinData.nickname}`);
    setSelectedRoom(null);
    setJoinData({ nickname: '', password: '' });
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

      <motion.div 
        layout
        className="rooms-grid"
      >
        {rooms.map((room) => (
          <motion.div 
            key={room.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -5, borderColor: 'var(--primary)' }}
            className="room-card"
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            {room.hasPassword && (
              <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', color: 'var(--text-muted)' }}>
                <Shield size={16} title="Phòng có mật khẩu" />
              </div>
            )}
            
            <div className="room-info" style={{ marginBottom: '1.5rem' }}>
              <div>
                <h3 className="room-name" style={{ margin: '0 0 0.25rem 0' }}>{room.name}</h3>
                <span className="user-count">
                  <Users size={14} /> {room.users} thành viên
                </span>
              </div>
            </div>

            <button 
              className="join-btn"
              onClick={() => setSelectedRoom(room)}
              style={{ width: '100%', borderRadius: '0.75rem' }}
            >
              Tham Gia
            </button>
          </motion.div>
        ))}
      </motion.div>

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
                 <h2 style={{ margin: 0 }}>Tham gia: {selectedRoom.name}</h2>
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
                
                {selectedRoom.hasPassword && (
                  <div className="form-group">
                    <label>Mật khẩu phòng</label>
                    <div style={{ position: 'relative' }}>
                      <Shield size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="password" 
                        className="form-input"
                        style={{ paddingLeft: '2.8rem' }}
                        placeholder="Nhập mật khẩu để vào phòng"
                        required
                        value={joinData.password}
                        onChange={(e) => setJoinData({...joinData, password: e.target.value})}
                      />
                    </div>
                  </div>
                )}

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
