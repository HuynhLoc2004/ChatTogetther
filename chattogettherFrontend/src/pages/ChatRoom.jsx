import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Send, Users, LogOut, MessageCircle, Hash, Smile, Paperclip, 
  MoreVertical, UserX, Shield, ChevronRight, Settings, Trash2, Crown, X, Menu, AlertTriangle
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const stompClient = useRef(null);
  const messagesEndRef = useRef(null);
  
  // Hàm lấy user_id an toàn (kết hợp localStorage và giải mã JWT token)
  const getUserId = () => {
    let id = localStorage.getItem('user_id');
    if (!id) {
      try {
        const token = localStorage.getItem('accesstoken');
        if (token) {
          const payloadBase64 = token.split('.')[1];
          const decoded = JSON.parse(atob(payloadBase64));
          if (decoded && decoded.user_id) {
            id = decoded.user_id.toString();
            localStorage.setItem('user_id', id);
          }
        }
      } catch (e) {
        console.error("Lỗi parse user_id từ token:", e);
      }
    }
    return id ? id.toString() : '';
  };

  const currentUserId = getUserId();
  const messageIdsRef = useRef(new Set());

  // Tính toán quyền Admin thực tế của phòng này dựa trên dữ liệu từ Server
  const isAdminOfThisRoom = roomInfo?.userRoomDTOList?.find(
    ur => ur.userDTO?.id?.toString() === currentUserId
  )?.isAdmin === true;

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const fetchRoomDetail = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const response = await axiosClient.get('/rooms/detail', {
        params: { room_id: roomId }
      });
      if (response.data && response.data.data) {
        setRoomInfo(response.data.data);
      } else if (!isSilent) {
        toast.error("Phòng này không còn tồn tại hoặc đã bị giải tán!");
        navigate('/');
      }
    } catch (err) {
      console.error("Lỗi khi lấy thông tin phòng:", err);
      if (!isSilent && err.response?.status === 404) {
        toast.error("Phòng này không còn tồn tại hoặc đã bị giải tán!");
        navigate('/');
      }
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
            userId: msg.userId ? msg.userId.toString() : '0',
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

      const socketUrl = BACKEND_URL ? `${BACKEND_URL}/ws-gs-guide` : '/ws-gs-guide';
      const socket = new SockJS(socketUrl);
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
          
          // Kiểm tra trùng lặp tin nhắn dựa trên ID
          if (receivedMsg.id && receivedMsg.id !== -1 && receivedMsg.id !== -2 && receivedMsg.id !== 0) {
            if (messageIdsRef.current.has(receivedMsg.id)) return;
            messageIdsRef.current.add(receivedMsg.id);
          }

          // Logic KICK (id = -1)
          if (receivedMsg.id === -1) {
             if (receivedMsg.userId?.toString() === currentUserId) {
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

          if (receivedMsg.userId === 0 || receivedMsg.userId === '0') {
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
              if (prev.find(m => m.id === msgId)) return prev;
              
              const newMsg = {
                id: msgId,
                text: receivedMsg.message,
                sender: receivedMsg.nickname,
                userId: receivedMsg.userId ? receivedMsg.userId.toString() : '',
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
    const trimmed = newMessage.trim();
    if (!trimmed) return;
    
    try {
      setNewMessage('');
      await axiosClient.post(`/message/send`, {
        message: trimmed,
        timeSend: new Date().toISOString()
      }, {
        params: { user_room: roomId }
      });
      setTimeout(() => scrollToBottom("smooth"), 50);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi tin nhắn!");
    }
  };

  const handleRemoveUser = (userIdToRemove, nickname) => {
    setActiveMenu(null);
    setConfirmDialog({
      title: "Loại thành viên",
      message: `Bạn có chắc chắn muốn mời ${nickname} ra khỏi phòng không?`,
      confirmLabel: "Xác nhận Kick",
      danger: true,
      onConfirm: async () => {
        try {
          await axiosClient.post(`/rooms/remove-user`, null, {
            params: { user_id: userIdToRemove, room_id: roomId }
          });
          toast.success(`Đã loại ${nickname} khỏi phòng!`);
        } catch (err) {
          toast.error(err.response?.data?.message || "Lỗi khi kick thành viên!");
        }
      }
    });
  };

  const handleDelegateAdmin = (newAdminId, nickname) => {
    setActiveMenu(null);
    setConfirmDialog({
      title: "Trao quyền Quản trị viên",
      message: `Bạn có chắc muốn trao toàn quyền Chủ phòng cho ${nickname}? Sau khi trao, bạn sẽ trở thành thành viên thường.`,
      confirmLabel: "Trao Quyền",
      danger: false,
      onConfirm: async () => {
        try {
          const response = await axiosClient.post(`/rooms/delegate-admin`, null, {
            params: { room_id: roomId, new_admin_id: newAdminId }
          });
          if (response.status === 200) {
            toast.success(`Đã chuyển quyền chủ phòng cho ${nickname}!`);
            await fetchRoomDetail(true);
          }
        } catch (err) {
          toast.error(err.response?.data?.message || "Lỗi khi chuyển quyền!");
        }
      }
    });
  };

  const handleDisbandRoom = () => {
    setConfirmDialog({
      title: "Giải tán phòng chat",
      message: "CẢNH BÁO: Tất cả thành viên sẽ bị mời ra ngoài và phòng sẽ ngừng hoạt động. Bạn có chắc chắn muốn giải tán?",
      confirmLabel: "Giải Tán Ngay",
      danger: true,
      onConfirm: async () => {
        try {
          await axiosClient.post(`/rooms/disband-room`, null, {
            params: { room_id: roomId }
          });
          toast.success("Đã giải tán phòng thành công!");
          navigate('/');
        } catch (err) {
          toast.error(err.response?.data?.message || "Lỗi khi giải tán phòng!");
        }
      }
    });
  };

  const handleLeaveRoom = () => {
    const activeCount = roomInfo?.userRoomDTOList?.length || 0;
    
    if (isAdminOfThisRoom && activeCount > 1) {
      toast.error("Bạn là chủ phòng. Vui lòng chuyển quyền hoặc giải tán nhóm trước khi rời phòng!", { duration: 4500 });
      return;
    }

    setConfirmDialog({
      title: "Rời phòng chat",
      message: "Bạn có chắc chắn muốn rời khỏi phòng trò chuyện này không?",
      confirmLabel: "Rời Phòng",
      danger: true,
      onConfirm: async () => {
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
    });
  };

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (loading) return (
    <div className="loading-screen">
      <div className="loader"></div>
      <p>Đang chuẩn bị phòng chat...</p>
    </div>
  );

  return (
    <div className="chat-container">
      {/* Backdrop for Mobile Sidebar */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar Left */}
      <aside className={`sidebar-left ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
           <div className="brand" onClick={() => navigate('/')}>
              <div className="brand-icon"><MessageCircle size={20} /></div>
              <span>Chat Togetther</span>
           </div>
           <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button onClick={() => navigate('/')} className="back-btn" title="Về trang chủ">
                 <ChevronRight size={18} />
              </button>
              <button onClick={() => setIsSidebarOpen(false)} className="close-sidebar-mobile" title="Đóng danh sách">
                 <X size={18} />
              </button>
           </div>
        </div>

        <div className="room-profile">
           <div className="room-avatar">
              <Hash size={28} />
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
              <div key={idx} className={`member-item ${ur.userDTO?.id?.toString() === currentUserId ? 'is-me' : ''}`}>
                <div className="member-avatar">
                   {ur.userDTO?.nickname?.charAt(0).toUpperCase() || "U"}
                   <span className="online-indicator"></span>
                </div>
                <div className="member-info">
                   <span className="name">{ur.userDTO?.nickname || "User"}</span>
                   {ur.isAdmin && <Crown size={14} className="crown-icon" title="Chủ phòng" />}
                </div>
                
                {isAdminOfThisRoom && ur.userDTO?.id?.toString() !== currentUserId && (
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
                <Trash2 size={16} />
                <span>Giải tán nhóm</span>
             </button>
           )}
           <button onClick={handleLeaveRoom} className="leave-btn">
              <LogOut size={16} />
              <span>{isAdminOfThisRoom ? 'Thoát' : 'Rời phòng'}</span>
           </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main">
        <header className="chat-header">
           <div className="header-left">
              <button onClick={() => setIsSidebarOpen(true)} className="mobile-toggle-btn" title="Mở danh sách thành viên">
                 <Menu size={20} />
              </button>
              <div className="header-info">
                 <Hash size={20} className="header-hash" />
                 <h2>{roomInfo?.nameroom}</h2>
              </div>
           </div>
           
           <div className="header-actions">
              <button onClick={() => setIsSidebarOpen(true)} className="members-indicator-btn" title="Xem danh sách thành viên">
                 <Users size={16} />
                 <span>{roomInfo?.userRoomDTOList?.length || 0}</span>
              </button>
              <button onClick={() => navigate('/')} className="exit-top-btn" title="Trở về trang chủ">
                 <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
              </button>
           </div>
        </header>

        <div className="messages-area">
          <div className="messages-list">
            {messages.length === 0 ? (
              <div className="empty-chat">
                 <div className="empty-icon"><MessageCircle size={44} /></div>
                 <h3>Chưa có tin nhắn nào</h3>
                 <p>Hãy là người đầu tiên gửi lời chào trong #{roomInfo?.nameroom}!</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.userId?.toString() === currentUserId;
                const isSystem = msg.userId === '0' || msg.userId === 0 || msg.isSystem;
                
                if (isSystem) return (
                  <div key={msg.id || index} className="system-msg">
                    <span>{msg.text}</span>
                  </div>
                );

                return (
                  <div key={msg.id || index} className={`msg-group ${isMe ? 'msg-me' : 'msg-them'}`}>
                    {!isMe && (
                      <div className="msg-avatar">
                         {msg.sender?.charAt(0).toUpperCase() || "U"}
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
            <form onSubmit={handleSendMessage} className="msg-form">
              <input 
                type="text" 
                placeholder={`Nhắn tin trong #${roomInfo?.nameroom || 'phòng'}...`} 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" disabled={!newMessage.trim()} className="send-btn" title="Gửi tin nhắn">
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="confirm-backdrop" onClick={() => setConfirmDialog(null)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon-badge" style={{ background: confirmDialog.danger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(79, 70, 229, 0.15)', color: confirmDialog.danger ? '#f87171' : '#818cf8' }}>
              <AlertTriangle size={24} />
            </div>
            <h3 className="confirm-title">{confirmDialog.title}</h3>
            <p className="confirm-message">{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button onClick={() => setConfirmDialog(null)} className="btn-confirm-cancel">
                Hủy bỏ
              </button>
              <button 
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  action();
                }} 
                className={`btn-confirm-ok ${confirmDialog.danger ? 'btn-danger' : 'btn-primary'}`}
              >
                {confirmDialog.confirmLabel || "Đồng ý"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --sidebar-bg: #1e1f22;
          --sidebar-hover: #35373c;
          --main-bg: #313338;
          --header-bg: #2b2d31;
          --input-bg: #383a40;
          --text-main: #dbdee1;
          --text-muted: #949ba4;
          --primary-brand: #5865f2;
          --bubble-them: #2b2d31;
          --bubble-me: #4752c4;
          --red-accent: #f23f43;
        }

        .chat-container { display: flex; height: 100vh; width: 100vw; background: var(--main-bg); color: var(--text-main); font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden; position: relative; }
        .sidebar-left { width: 280px; background: var(--sidebar-bg); display: flex; flex-direction: column; border-right: 1px solid #1a1b1e; z-index: 50; transition: transform 0.25s ease; }
        .sidebar-header { padding: 10px 14px; height: 48px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 0 rgba(0,0,0,0.2); }
        .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; cursor: pointer; }
        .brand-icon { background: var(--primary-brand); padding: 4px; border-radius: 6px; display: flex; }
        .back-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; transform: rotate(180deg); display: flex; padding: 4px; border-radius: 4px; }
        .back-btn:hover { background: var(--sidebar-hover); color: white; }
        .close-sidebar-mobile { display: none; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; }
        .room-profile { padding: 16px 14px; background: linear-gradient(180deg, rgba(88,101,242,0.12) 0%, transparent 100%); display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .room-avatar { width: 44px; height: 44px; background: var(--sidebar-hover); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary-brand); flex-shrink: 0; }
        .room-meta { overflow: hidden; }
        .room-meta h3 { margin: 0; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .room-meta p { margin: 2px 0 0; font-size: 11px; color: var(--text-muted); }
        .admin-badge { margin-left: auto; font-size: 10px; background: rgba(88,101,242,0.25); color: #818cf8; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
        .sidebar-content { flex: 1; overflow-y: auto; padding: 14px 8px; }
        .section-title { padding: 0 8px 8px; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
        .member-list { display: flex; flex-direction: column; gap: 2px; }
        .member-item { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 6px; position: relative; transition: background 0.1s; }
        .member-item:hover { background: var(--sidebar-hover); }
        .member-avatar { width: 32px; height: 32px; border-radius: 50%; background: #4e5058; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; position: relative; flex-shrink: 0; }
        .online-indicator { width: 9px; height: 9px; background: #23a55a; border: 2px solid var(--sidebar-bg); border-radius: 50%; position: absolute; bottom: 0; right: 0; }
        .member-info { display: flex; align-items: center; gap: 4px; flex: 1; overflow: hidden; }
        .member-info .name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .crown-icon { color: #f1c40f; flex-shrink: 0; }
        .member-actions { position: relative; }
        .dots-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex; border-radius: 4px; }
        .dots-btn:hover { color: white; background: rgba(255,255,255,0.1); }
        .member-dropdown { position: absolute; right: 0; top: 100%; background: #111214; border-radius: 6px; padding: 4px; box-shadow: 0 8px 20px rgba(0,0,0,0.4); z-index: 100; min-width: 135px; border: 1px solid #334155; }
        .action-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; background: none; border: none; color: var(--text-main); font-size: 12px; cursor: pointer; width: 100%; border-radius: 4px; text-align: left; }
        .action-item:hover { background: var(--primary-brand); color: white; }
        .kick-item:hover { background: var(--red-accent) !important; }
        .sidebar-footer { padding: 12px; display: flex; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.15); border-top: 1px solid rgba(255,255,255,0.03); }
        .leave-btn, .disband-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; }
        .leave-btn { background: transparent; border: 1px solid rgba(242, 63, 67, 0.3); color: var(--red-accent); }
        .leave-btn:hover { background: var(--red-accent); color: white; }
        .disband-btn { background: rgba(242, 63, 67, 0.12); border: 1px solid var(--red-accent); color: var(--red-accent); }
        .disband-btn:hover { background: var(--red-accent); color: white; }
        
        .chat-main { flex: 1; display: flex; flex-direction: column; background: var(--main-bg); position: relative; overflow: hidden; }
        .chat-header { height: 48px; padding: 0 14px; display: flex; align-items: center; justify-content: space-between; background: var(--header-bg); box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        .header-left { display: flex; align-items: center; gap: 10px; overflow: hidden; }
        .header-info { display: flex; align-items: center; gap: 6px; overflow: hidden; }
        .header-hash { color: var(--text-muted); flex-shrink: 0; }
        .header-info h2 { margin: 0; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mobile-toggle-btn { display: none; background: none; border: none; color: var(--text-main); cursor: pointer; padding: 4px; border-radius: 4px; }
        .header-actions { display: flex; align-items: center; gap: 8px; }
        .members-indicator-btn { display: flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color: var(--text-main); font-size: 12px; font-weight: 600; padding: 5px 9px; border-radius: 6px; cursor: pointer; }
        .exit-top-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex; }
        .exit-top-btn:hover { color: white; }
        
        .messages-area { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
        .messages-list { padding: 16px 0; display: flex; flex-direction: column; margin-top: auto; }
        .empty-chat { text-align: center; margin: auto; padding: 2rem 1rem; color: var(--text-muted); }
        .empty-icon { color: #4e5058; margin-bottom: 0.5rem; }
        .empty-chat h3 { margin: 0 0 0.3rem 0; color: #f2f3f5; font-size: 1.1rem; }
        .empty-chat p { margin: 0; font-size: 0.85rem; }
        
        .msg-group { padding: 3px 14px; display: flex; gap: 12px; margin: 3px 0; }
        .msg-avatar { width: 34px; height: 34px; border-radius: 50%; background: #4e5058; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; flex-shrink: 0; }
        .msg-content-wrapper { display: flex; flex-direction: column; max-width: 80%; }
        .msg-sender { font-size: 11px; font-weight: 600; color: #949ba4; margin-bottom: 2px; }
        .msg-bubble { position: relative; }
        .msg-bubble p { margin: 0; padding: 8px 12px; font-size: 14px; line-height: 1.4; word-break: break-word; }
        .msg-me { flex-direction: row-reverse; }
        .msg-me .msg-content-wrapper { align-items: flex-end; }
        .msg-me .msg-bubble p { background: var(--bubble-me); border-radius: 16px 16px 2px 16px; color: white; }
        .msg-them .msg-bubble p { background: var(--bubble-them); border-radius: 2px 16px 16px 16px; color: var(--text-main); }
        .msg-time { font-size: 10px; color: rgba(255,255,255,0.45); margin-top: 3px; display: block; }
        .system-msg { text-align: center; margin: 10px 0; }
        .system-msg span { background: rgba(0,0,0,0.25); padding: 3px 10px; border-radius: 12px; font-size: 11px; color: var(--text-muted); }

        .chat-input-area { padding: 10px 14px 16px; background: var(--main-bg); }
        .input-container { background: var(--input-bg); border-radius: 8px; display: flex; align-items: center; padding: 0 10px; height: 44px; }
        .msg-form { flex: 1; display: flex; align-items: center; gap: 8px; }
        .msg-form input { flex: 1; background: none; border: none; color: var(--text-main); font-size: 14px; outline: none; }
        .send-btn { background: none; border: none; color: var(--primary-brand); cursor: pointer; display: flex; padding: 6px; border-radius: 4px; transition: opacity 0.15s; }
        .send-btn:disabled { color: #5c5e66; cursor: not-allowed; }

        .confirm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .confirm-box { background: #1e293b; border: 1px solid #334155; border-radius: 1.25rem; padding: 1.5rem; width: 100%; max-width: 380px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
        .confirm-icon-badge { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem auto; }
        .confirm-title { margin: 0 0 0.5rem 0; font-size: 1.15rem; font-weight: 700; color: #f8fafc; }
        .confirm-message { margin: 0 0 1.25rem 0; font-size: 0.9rem; color: #94a3b8; line-height: 1.4; }
        .confirm-actions { display: flex; gap: 0.5rem; }
        .btn-confirm-cancel { flex: 1; background: #334155; color: #cbd5e1; border: none; padding: 0.7rem; border-radius: 0.6rem; font-weight: 600; cursor: pointer; }
        .btn-confirm-ok { flex: 1; border: none; padding: 0.7rem; border-radius: 0.6rem; font-weight: 600; cursor: pointer; color: white; }
        .btn-danger { background: #ef4444; }
        .btn-primary { background: #4f46e5; }

        .loading-screen { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background: #0f172a; color: #818cf8; }
        .loader { width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.15); border-bottom-color: #818cf8; border-radius: 50%; animation: rotation 1s linear infinite; }
        @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Responsive on Tablet & Mobile */
        @media (max-width: 768px) {
          .sidebar-left {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            transform: translateX(-100%);
            box-shadow: 2px 0 10px rgba(0,0,0,0.5);
          }
          .sidebar-left.sidebar-open {
            transform: translateX(0);
          }
          .sidebar-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            z-index: 40;
          }
          .close-sidebar-mobile { display: flex; }
          .mobile-toggle-btn { display: flex; }
          .msg-content-wrapper { max-width: 88%; }
          .chat-input-area { padding: 8px 10px 12px; }
        }
      `}} />
    </div>
  );
};

export default ChatRoom;
