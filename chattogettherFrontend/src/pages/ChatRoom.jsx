import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Users, LogOut, MessageCircle, Hash, Smile, Paperclip, UserX } from 'lucide-react';
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
  const stompClient = useRef(null);
  const messagesEndRef = useRef(null);
  const currentUserId = localStorage.getItem('user_id');

  // Kiểm tra quyền AD_ROOM từ token
  const hasAdRoomPermission = () => {
    const token = localStorage.getItem('accesstoken');
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const scope = payload.scope || "";
      return scope.includes("AD_ROOM");
    } catch (e) {
      return false;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchRoomDetail = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const response = await axiosClient.get('/rooms/info-rooms');
      const currentRoom = response.data.data.find(r => r.id.toString() === roomId);
      if (currentRoom) {
        setRoomInfo(currentRoom);
      }
    } catch (err) {
      console.error("Lỗi khi lấy thông tin phòng:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomDetail();

    const socket = new SockJS('http://localhost:8080/ws-gs-guide');
    const client = Stomp.over(socket);
    client.debug = null;

    client.connect({}, () => {
      console.log('Đã kết nối WebSocket');
      if (client.connected) {
        client.subscribe(`/topic/room/${roomId}`, (payload) => {
          const receivedMsg = JSON.parse(payload.body);
          
          if (receivedMsg.userId === 0 || receivedMsg.userId === -1) {
            fetchRoomDetail(true);
            toast.success(receivedMsg.message, {
              duration: 3000,
              style: { background: '#333', color: '#fff', fontSize: '14px', borderRadius: '10px' },
            });

            // Nếu userId là -1 (KICK) và ID bị kick là chính mình
            if (receivedMsg.userId === -1 && receivedMsg.message.includes("đã bị mời ra khỏi phòng")) {
               // Một cách đơn giản để check có phải mình bị kick không là check nickname trong msg hoặc fetch lại check active
               // Ở đây mình fetch lại rồi, nếu UserRoom của mình active = false thì đá ra
            }
          } else {
            setMessages((prev) => {
              if (prev.find(m => m.id === receivedMsg.id)) return prev;
              return [...prev, {
                id: receivedMsg.id || Date.now() + Math.random(),
                text: receivedMsg.message,
                sender: receivedMsg.nickname,
                userId: receivedMsg.userId.toString(),
                time: new Date(receivedMsg.timeSend).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                rawTime: receivedMsg.timeSend
              }].sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
            });
          }
        });
      }
    }, (error) => {
      console.error('Lỗi kết nối WebSocket:', error);
    });

    stompClient.current = client;

    return () => {
      if (stompClient.current && stompClient.current.connected) {
        stompClient.current.disconnect();
      }
    };
  }, [roomId]);

  // Kiểm tra xem mình có bị mời ra khỏi phòng không sau khi list update
  useEffect(() => {
    if (roomInfo && currentUserId) {
       const myStatus = roomInfo.userRoomDTOList?.find(ur => ur.userDTO?.id.toString() === currentUserId);
       if (myStatus && !myStatus.active) {
          toast.error("Bạn đã bị mời ra khỏi phòng!");
          navigate('/');
       }
    }
  }, [roomInfo, currentUserId]);

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
      if (err.response && err.response.status === 403) {
        toast.error(err.response.data.message || "Bạn không có quyền gửi tin nhắn!");
      } else {
        toast.error("Không thể gửi tin nhắn. Vui lòng thử lại!");
      }
    }
  };

  const handleRemoveUser = async (userIdToRemove, nickname) => {
    if (window.confirm(`Bạn có chắc muốn mời ${nickname} ra khỏi phòng?`)) {
      try {
        await axiosClient.post(`/rooms/remove-user`, null, {
          params: { user_id: userIdToRemove, room_id: roomId }
        });
        toast.success(`Đã mời ${nickname} ra khỏi phòng`);
      } catch (err) {
        if (err.response && err.response.status === 403) {
          toast.error("Bạn không có quyền đuổi người khác!");
        } else {
          toast.error("Lỗi khi thực hiện thao tác!");
        }
      }
    }
  };

  const handleLeaveRoom = async () => {
    if (window.confirm("Bạn có chắc muốn rời phòng?")) {
      try {
        await axiosClient.post(`/rooms/leave-room`, null, { params: { room_id: roomId } });
        navigate('/');
      } catch (err) {
        console.error("Lỗi khi rời phòng:", err);
        navigate('/');
      }
    }
  };

  if (loading) return <div className="loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2rem', color: 'var(--primary)' }}>Đang vào phòng...</div>;

  return (
    <div className="chat-room-container" style={{ display: 'flex', height: '100vh', background: '#f0f2f5' }}>
      {/* Sidebar */}
      <div className="chat-sidebar" style={{ width: '300px', background: '#ffffff', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 5px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #f0f0f0', background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '12px' }}>
              <Hash size={24} />
            </div>
            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roomInfo?.nameroom}</h2>
          </div>
          <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: 0 }}>ID Phòng: {roomId}</p>
          {hasAdRoomPermission() && <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.3)', padding: '2px 8px', borderRadius: '4px', marginTop: '5px', display: 'inline-block' }}>Quyền: Quản trị viên</span>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#64748b', padding: '0 0.5rem' }}>
            <Users size={18} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Thành viên ({roomInfo?.userRoomDTOList?.length || 0})</span>
          </div>
          <div className="user-list">
            {roomInfo?.userRoomDTOList?.map((ur, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '12px', marginBottom: '0.5rem', background: ur.userDTO?.id.toString() === currentUserId ? 'rgba(79, 70, 229, 0.05)' : 'transparent', transition: 'all 0.2s' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 700 }}>
                    {ur.userDTO?.nickname?.charAt(0).toUpperCase()}
                  </div>
                  {ur.active && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', position: 'absolute', bottom: '-2px', right: '-2px', border: '2px solid white' }}></div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#1e293b' }}>
                    {ur.userDTO?.nickname} {ur.userDTO?.id.toString() === currentUserId && "(Bạn)"}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{ur.active ? "Đang trực tuyến" : "Ngoại tuyến"}</span>
                </div>
                
                {/* Nút đuổi người - chỉ hiện nếu mình là Admin và không phải tự đuổi mình */}
                {hasAdRoomPermission() && ur.userDTO?.id.toString() !== currentUserId && ur.active && (
                  <button 
                    onClick={() => handleRemoveUser(ur.userDTO.id, ur.userDTO.nickname)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '5px', borderRadius: '8px' }}
                    title="Mời ra khỏi phòng"
                    className="kick-btn"
                  >
                    <UserX size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '1rem' }}>
          <button onClick={handleLeaveRoom} style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: 'none', color: '#ef4444', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>
            <LogOut size={18} /> Rời khỏi phòng
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <header style={{ padding: '1rem 2rem', background: 'white', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--primary)', color: 'white', padding: '0.6rem', borderRadius: '14px', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }}>
              <MessageCircle size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{roomInfo?.nameroom}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Phòng chat trực tuyến</span>
              </div>
            </div>
          </div>
        </header>

        <div className="messages-container" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', scrollBehavior: 'smooth' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '5rem', color: '#94a3b8' }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: '20px', display: 'inline-block', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <MessageCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#475569' }}>Chưa có tin nhắn nào</h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Hãy gửi lời chào đến mọi người trong phòng!</p>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isOwnMessage = msg.userId === currentUserId;
              return (
                <div key={index} style={{ alignSelf: isOwnMessage ? 'flex-end' : 'flex-start', maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isOwnMessage ? 'flex-end' : 'flex-start' }}>
                  {!isOwnMessage && (
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', marginLeft: '0.5rem' }}>
                      {msg.sender}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', flexDirection: isOwnMessage ? 'row-reverse' : 'row' }}>
                    <div style={{ 
                      padding: '0.85rem 1.15rem', 
                      borderRadius: isOwnMessage ? '20px 20px 4px 20px' : '20px 20px 20px 4px', 
                      background: isOwnMessage ? 'var(--primary)' : 'white', 
                      color: isOwnMessage ? 'white' : '#1e293b', 
                      boxShadow: isOwnMessage ? '0 4px 15px rgba(79, 70, 229, 0.2)' : '0 2px 5px rgba(0,0,0,0.05)',
                      wordBreak: 'break-word',
                      fontSize: '0.95rem',
                      lineHeight: 1.5,
                      border: isOwnMessage ? 'none' : '1px solid #eef2f6'
                    }}>
                      {msg.text}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: 500 }}>
                      {msg.time}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '1.5rem 2rem', background: 'transparent' }}>
          <form onSubmit={handleSendMessage} style={{ 
            display: 'flex', 
            gap: '0.75rem', 
            background: 'white', 
            padding: '0.6rem', 
            borderRadius: '18px', 
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            transition: 'all 0.3s ease',
            alignItems: 'center'
          }}
          className="chat-input-wrapper"
          >
            <button type="button" style={{ background: 'transparent', border: 'none', color: '#64748b', padding: '0.5rem', cursor: 'pointer', borderRadius: '10px' }}>
              <Smile size={22} />
            </button>
            <button type="button" style={{ background: 'transparent', border: 'none', color: '#64748b', padding: '0.5rem', cursor: 'pointer', borderRadius: '10px' }}>
              <Paperclip size={22} />
            </button>
            <input 
              type="text" 
              placeholder="Nhập tin nhắn của bạn..." 
              style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem 0.5rem', outline: 'none', fontSize: '1rem', color: '#1e293b' }}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button type="submit" style={{ 
              background: 'var(--primary)', 
              color: 'white', 
              border: 'none', 
              width: '45px',
              height: '45px',
              borderRadius: '14px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
            disabled={!newMessage.trim()}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .chat-input-wrapper:focus-within {
          border-color: var(--primary) !important;
          box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.2) !important;
          transform: translateY(-2px);
        }
        .messages-container::-webkit-scrollbar {
          width: 6px;
        }
        .messages-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .messages-container::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .messages-container::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .kick-btn:hover {
          background: #fee2e2 !important;
          color: #ef4444 !important;
        }
      `}} />
    </div>
  );
};

export default ChatRoom;
