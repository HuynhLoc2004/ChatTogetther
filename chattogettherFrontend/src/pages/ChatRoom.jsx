import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Users, LogOut, MessageCircle, Hash, Smile, Paperclip, MoreVertical, UserX, Shield, ChevronRight, Settings, Trash2, Crown } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import toast from 'react-hot-toast';

const ChatRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [roomInfo, setRoomInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState(null);
  const stompClient = useRef(null);
  const messagesEndRef = useRef(null);
  const currentUserId = localStorage.getItem('user_id');
  
  const messageIdsRef = useRef(new Set());

  // Tính toán quyền Admin thực tế của phòng này dựa trên dữ liệu từ Server
  const isAdminOfThisRoom = roomInfo?.userRoomDTOList?.find(
    ur => ur.userDTO?.id.toString() === currentUserId
  )?.isAdmin === true;

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const fetchRoomDetail = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const response = await axiosClient.get('/rooms/info-rooms');
      const currentRoom = response.data.data.find(r => r.id.toString() === roomId);
      if (currentRoom) {
        setRoomInfo(currentRoom);
      } else if (!isSilent) {
        toast.error("Phòng này không còn tồn tại!");
        navigate('/');
      }
    } catch (err) {
      console.error("Lỗi khi lấy thông tin phòng:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [roomId, navigate]);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await axiosClient.get('/message/history', {
        params: { room_id: roomId }
      });
      if (response.data && response.data.data) {
        const history = response.data.data.map(msg => {
          messageIdsRef.current.add(msg.id);
          return {
            id: msg.id,
            text: msg.message,
            sender: msg.nickname,
            userId: msg.userId.toString(),
            time: new Date(msg.timeSend).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawTime: msg.timeSend
          };
        });
        setMessages(history);
        setTimeout(() => scrollToBottom("auto"), 100);
      }
    } catch (err) {
      console.error("Lỗi khi lấy lịch sử tin nhắn:", err);
    }
  }, [roomId]);

  useEffect(() => {
    let isMounted = true;
    
    if (stompClient.current && stompClient.current.connected) {
      return;
    }

    const initConnection = async () => {
      messageIdsRef.current.clear();
      await fetchRoomDetail();
      await fetchHistory();
      
      if (!isMounted) return;

      const socket = new SockJS('/ws-gs-guide');
      const client = Stomp.over(socket);
      client.debug = null;

      client.connect({}, () => {
        if (!isMounted) {
          client.disconnect();
          return;
        }
        
        stompClient.current = client;

        client.subscribe(`/topic/room/${roomId}`, (payload) => {
          if (!isMounted) return;
          const receivedMsg = JSON.parse(payload.body);
          
          // Kiểm tra trùng lặp tin nhắn dựa trên ID (áp dụng cho tất cả loại tin nhắn có ID)
          if (receivedMsg.id && receivedMsg.id !== -1 && receivedMsg.id !== -2 && receivedMsg.id !== 0) {
            if (messageIdsRef.current.has(receivedMsg.id)) return;
            messageIdsRef.current.add(receivedMsg.id);
          }

          // Logic KICK (id = -1)
          if (receivedMsg.id === -1) {
             if (receivedMsg.userId.toString() === currentUserId) {
                toast.error("Bạn đã bị quản trị viên mời ra khỏi phòng!", { duration: 5000 });
                navigate('/');
                return;
             }
             toast(`${receivedMsg.message}`, { icon: '🚪' });
             fetchRoomDetail(true);
             return;
          }

          // Logic DISBAND (id = -2)
          if (receivedMsg.id === -2) {
             toast.error("Phòng chat này đã được giải tán!", { duration: 6000 });
             navigate('/');
             return;
          }

          if (receivedMsg.userId === 0) {
            // Tin nhắn hệ thống (vào/rời phòng, chuyển quyền)
            fetchRoomDetail(true);
            const sysId = receivedMsg.id || Date.now() + Math.random();
            setMessages(prev => {
              if (prev.find(m => m.text === receivedMsg.message && Math.abs(new Date() - new Date(m.rawTime)) < 1000)) return prev;
              return [...prev, {
                id: sysId,
                text: receivedMsg.message,
                sender: 'Hệ thống',
                userId: '0',
                isSystem: true,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                rawTime: new Date().toISOString()
              }];
            });
          } else {
            // Tin nhắn chat bình thường
            setMessages((prev) => {
              const msgId = receivedMsg.id || Date.now() + Math.random();
              // Kiểm tra nội dung và thời gian để tránh lặp tin nhắn vừa gửi (trong trường hợp ID chưa kịp về)
              if (prev.find(m => m.id === msgId)) return prev;
              
              const newMsg = {
                id: msgId,
                text: receivedMsg.message,
                sender: receivedMsg.nickname,
                userId: receivedMsg.userId.toString(),
                time: new Date(receivedMsg.timeSend).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                rawTime: receivedMsg.timeSend
              };
              return [...prev, newMsg].sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
            });
            setTimeout(() => scrollToBottom(), 50);
          }
        });
      }, (error) => {
        console.error('Lỗi kết nối WebSocket:', error);
      });
    };

    initConnection();

    return () => {
      isMounted = false;
      if (stompClient.current && stompClient.current.connected) {
        stompClient.current.disconnect();
        stompClient.current = null;
      }
    };
  }, [roomId, fetchRoomDetail, fetchHistory, currentUserId, navigate]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    try {
      const sendTime = new Date().toISOString();
      await axiosClient.post(`/message/send`, {
        message: newMessage,
        timeSend: sendTime
      }, {
        params: { user_room: roomId }
      });
      setNewMessage('');
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi tin nhắn!");
    }
  };

  const handleRemoveUser = async (userIdToRemove, nickname) => {
    setActiveMenu(null);
    if (!window.confirm(`Bạn có chắc muốn loại ${nickname} khỏi phòng?`)) return;
    try {
      await axiosClient.post(`/rooms/remove-user`, null, {
        params: { user_id: userIdToRemove, room_id: roomId }
      });
      toast.success(`Đã loại ${nickname} thành công!`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi thực hiện thao tác!");
    }
  };

  const handleDelegateAdmin = async (newAdminId, nickname) => {
    setActiveMenu(null);
    if (!window.confirm(`Bạn có chắc muốn chuyển quyền chủ phòng cho ${nickname}?`)) return;
    try {
      const response = await axiosClient.post(`/rooms/delegate-admin`, null, {
        params: { room_id: roomId, new_admin_id: newAdminId }
      });
      if (response.status === 200) {
        toast.success(`Đã chuyển quyền chủ phòng cho ${nickname}!`);
        // Refresh ngay lập tức để cập nhật UI FE (ẩn các nút admin của mình)
        await fetchRoomDetail(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi ủy quyền!");
    }
  };

  const handleDisbandRoom = async () => {
    if (!window.confirm("CẢNH BÁO: Bạn có chắc muốn GIẢI TÁN phòng này? Tất cả thành viên sẽ bị mời ra ngoài.")) return;
    try {
      await axiosClient.post(`/rooms/disband-room`, null, {
        params: { room_id: roomId }
      });
      toast.success("Đã giải tán phòng thành công!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi giải tán phòng!");
    }
  };

  const handleLeaveRoom = async () => {
    const activeCount = roomInfo?.userRoomDTOList?.length || 0;
    
    if (isAdminOfThisRoom && activeCount > 1) {
      toast.error("Bạn là chủ phòng. Vui lòng chuyển quyền quản trị hoặc giải tán phòng trước khi rời đi!", { duration: 4000 });
      return;
    }

    if (window.confirm("Bạn có chắc muốn thoát khỏi phòng chat này?")) {
      try {
        await axiosClient.post(`/rooms/leave-room`, null, {
          params: { room_id: roomId }
        });
        toast.success("Đã rời khỏi phòng");
        navigate('/');
      } catch (err) {
        toast.error(err.response?.data?.message || "Có lỗi xảy ra khi rời phòng!");
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (loading) return (
    <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: '#818cf8' }}>
      <div className="loader"></div>
      <p style={{ marginTop: '1rem', fontWeight: 500 }}>Đang chuẩn bị phòng chat...</p>
    </div>
  );

  return (
    <div className="chat-container">
      {/* Sidebar Left */}
      <aside className="sidebar-left">
        <div className="sidebar-header">
           <div className="brand">
              <div className="brand-icon"><MessageCircle size={20} /></div>
              <span>Chat Togetther</span>
           </div>
           <button onClick={() => navigate('/')} className="back-btn" title="Về trang chủ">
              <ChevronRight size={18} />
           </button>
        </div>

        <div className="room-profile">
           <div className="room-avatar">
              <Hash size={32} />
           </div>
           <div className="room-meta">
              <h3>{roomInfo?.nameroom}</h3>
              <p>ID: {roomId}</p>
           </div>
           {isAdminOfThisRoom && <div className="admin-badge">Chủ phòng</div>}
        </div>

        <div className="sidebar-content">
          <div className="section-title">
             <Users size={14} />
             <span>Thành viên ({roomInfo?.userRoomDTOList?.length || 0})</span>
          </div>
          
          <div className="member-list">
            {roomInfo?.userRoomDTOList?.map((ur, idx) => (
              <div key={idx} className={`member-item ${ur.userDTO?.id.toString() === currentUserId ? 'is-me' : ''}`}>
                <div className="member-avatar">
                   {ur.userDTO?.nickname?.charAt(0).toUpperCase()}
                   <span className="online-indicator"></span>
                </div>
                <div className="member-info">
                   <span className="name">{ur.userDTO?.nickname}</span>
                   {ur.isAdmin && <Crown size={14} className="crown-icon" title="Chủ phòng" />}
                </div>
                
                {isAdminOfThisRoom && ur.userDTO?.id.toString() !== currentUserId && (
                  <div className="member-actions">
                    <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === idx ? null : idx); }} className="dots-btn">
                       <MoreVertical size={14} />
                    </button>
                    {activeMenu === idx && (
                      <div className="member-dropdown">
                        <button onClick={() => handleDelegateAdmin(ur.userDTO.id, ur.userDTO.nickname)} className="action-item">
                           <Crown size={14} /> Trao quyền
                        </button>
                        <button onClick={() => handleRemoveUser(ur.userDTO.id, ur.userDTO.nickname)} className="action-item kick-item">
                           <UserX size={14} /> Kick
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
           {isAdminOfThisRoom && (
             <button onClick={handleDisbandRoom} className="disband-btn">
                <Trash2 size={18} />
                <span>Giải tán nhóm</span>
             </button>
           )}
           <button onClick={handleLeaveRoom} className="leave-btn">
              <LogOut size={18} />
              <span>{isAdminOfThisRoom ? 'Thoát' : 'Rời phòng'}</span>
           </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main">
        <header className="chat-header">
           <div className="header-info">
              <Hash size={20} className="header-hash" />
              <h2>{roomInfo?.nameroom}</h2>
           </div>
           <div className="header-actions">
              <button className="icon-btn"><Settings size={20} /></button>
           </div>
        </header>

        <div className="messages-area">
          <div className="messages-list">
            {messages.length === 0 ? (
              <div className="empty-chat">
                 <div className="empty-icon"><MessageCircle size={48} /></div>
                 <h3>Chưa có tin nhắn nào</h3>
                 <p>Hãy gửi lời chào đầu tiên!</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.userId === currentUserId;
                const isSystem = msg.userId === '0' || msg.isSystem;
                
                if (isSystem) return (
                  <div key={msg.id || index} className="system-msg">
                    <span>{msg.text}</span>
                  </div>
                );

                return (
                  <div key={msg.id || index} className={`msg-group ${isMe ? 'msg-me' : 'msg-them'}`}>
                    {!isMe && (
                      <div className="msg-avatar">
                         {msg.sender?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="msg-content-wrapper">
                      {!isMe && <span className="msg-sender">{msg.sender}</span>}
                      <div className="msg-bubble">
                        <p>{msg.text}</p>
                        <span className="msg-time">{msg.time}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="chat-input-area">
          <div className="input-container">
            <button className="tool-btn"><Smile size={20} /></button>
            <button className="tool-btn"><Paperclip size={20} /></button>
            <form onSubmit={handleSendMessage} className="msg-form">
              <input 
                type="text" 
                placeholder={`Nhắn tin cho #${roomInfo?.nameroom}`} 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" disabled={!newMessage.trim()} className="send-btn">
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --sidebar-bg: #1e1f22;
          --sidebar-hover: #35373c;
          --main-bg: #313338;
          --header-bg: #313338;
          --input-bg: #383a40;
          --text-main: #dbdee1;
          --text-muted: #949ba4;
          --primary-brand: #5865f2;
          --bubble-them: #2b2d31;
          --bubble-me: #4752c4;
          --red-accent: #f23f43;
        }

        .chat-container { display: flex; height: 100vh; width: 100vw; background: var(--main-bg); color: var(--text-main); font-family: 'Inter', sans-serif; overflow: hidden; }
        .sidebar-left { width: 280px; background: var(--sidebar-bg); display: flex; flex-direction: column; border-right: 1px solid #1a1b1e; }
        .sidebar-header { padding: 12px 16px; height: 48px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 0 rgba(0,0,0,0.2); }
        .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }
        .brand-icon { background: var(--primary-brand); padding: 4px; border-radius: 6px; display: flex; }
        .back-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; transform: rotate(180deg); }
        .room-profile { padding: 20px 16px; background: linear-gradient(180deg, rgba(88,101,242,0.1) 0%, transparent 100%); display: flex; align-items: center; gap: 12px; }
        .room-avatar { width: 48px; height: 48px; background: var(--sidebar-hover); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary-brand); }
        .room-meta h3 { margin: 0; font-size: 16px; font-weight: 600; }
        .room-meta p { margin: 2px 0 0; font-size: 12px; color: var(--text-muted); }
        .admin-badge { margin-left: auto; font-size: 10px; background: rgba(88,101,242,0.2); color: var(--primary-brand); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
        .sidebar-content { flex: 1; overflow-y: auto; padding: 16px 8px; }
        .section-title { padding: 0 8px 8px; font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
        .member-list { display: flex; flex-direction: column; gap: 2px; }
        .member-item { display: flex; align-items: center; gap: 12px; padding: 6px 8px; border-radius: 4px; position: relative; transition: background 0.1s; }
        .member-item:hover { background: var(--sidebar-hover); }
        .member-avatar { width: 32px; height: 32px; border-radius: 50%; background: #4e5058; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; position: relative; }
        .online-indicator { width: 10px; height: 10px; background: #23a55a; border: 2px solid var(--sidebar-bg); border-radius: 50%; position: absolute; bottom: 0; right: 0; }
        .member-info { display: flex; align-items: center; gap: 4px; flex: 1; }
        .crown-icon { color: #f1c40f; }
        .member-actions { position: relative; opacity: 0; }
        .member-item:hover .member-actions { opacity: 1; }
        .dots-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; }
        .member-dropdown { position: absolute; right: 0; top: 100%; background: #111214; border-radius: 4px; padding: 4px; box-shadow: 0 8px 16px rgba(0,0,0,0.3); z-index: 100; min-width: 140px; }
        .action-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: none; border: none; color: var(--text-main); font-size: 13px; cursor: pointer; width: 100%; border-radius: 2px; text-align: left; }
        .action-item:hover { background: var(--primary-brand); color: white; }
        .kick-item:hover { background: var(--red-accent) !important; }
        .sidebar-footer { padding: 12px; display: flex; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.1); }
        .leave-btn, .disband-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s; }
        .leave-btn { background: transparent; border: 1px solid rgba(242, 63, 67, 0.3); color: var(--red-accent); }
        .leave-btn:hover { background: var(--red-accent); color: white; }
        .disband-btn { background: rgba(242, 63, 67, 0.1); border: 1px solid var(--red-accent); color: var(--red-accent); }
        .disband-btn:hover { background: var(--red-accent); color: white; }
        .chat-main { flex: 1; display: flex; flex-direction: column; background: var(--main-bg); position: relative; }
        .chat-header { height: 48px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 0 rgba(0,0,0,0.2); }
        .messages-area { flex: 1; overflow-y: auto; }
        .messages-list { padding: 20px 0; display: flex; flex-direction: column; }
        .msg-group { padding: 4px 16px; display: flex; gap: 16px; margin: 4px 0; }
        .msg-content-wrapper { display: flex; flex-direction: column; max-width: 80%; }
        .msg-bubble p { margin: 0; padding: 8px 14px; font-size: 15px; line-height: 1.4; word-break: break-word; }
        .msg-me { flex-direction: row-reverse; }
        .msg-me .msg-content-wrapper { align-items: flex-end; }
        .msg-me .msg-bubble p { background: var(--bubble-me); border-radius: 18px 18px 2px 18px; color: white; }
        .msg-them .msg-bubble p { background: var(--bubble-them); border-radius: 2px 18px 18px 18px; }
        .msg-time { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
        .system-msg { text-align: center; margin: 12px 0; }
        .system-msg span { background: rgba(0,0,0,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; color: var(--text-muted); }
        .chat-input-area { padding: 0 16px 24px; }
        .input-container { background: var(--input-bg); border-radius: 8px; display: flex; align-items: center; padding: 0 12px; height: 44px; gap: 12px; }
        .msg-form { flex: 1; display: flex; align-items: center; }
        .msg-form input { flex: 1; background: none; border: none; color: var(--text-main); font-size: 15px; outline: none; }
        .send-btn { background: none; border: none; color: var(--primary-brand); cursor: pointer; }
        .loader { width: 40px; height: 40px; border: 4px solid #FFF; border-bottom-color: var(--primary-brand); border-radius: 50%; animation: rotation 1s linear infinite; }
        @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default ChatRoom;
