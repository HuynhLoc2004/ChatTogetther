import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Send, Users, LogOut, MessageCircle, Hash, Radio,
  MoreVertical, UserX, ChevronRight, Trash2, Crown, X, Menu, AlertTriangle,
  Phone, PhoneOff, Mic, MicOff, WifiOff, User, UserCheck
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import { saveMessagesOffline, getMessagesOffline, getRoomsOffline } from '../utils/offlineDB';
import UserProfileModal from './UserProfileModal';
import FriendsModal from './FriendsModal';
import TalovinLogo from '../components/TalovinLogo';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import toast from 'react-hot-toast';

// Cấu hình Google STUN servers miễn phí cho WebRTC P2P Voice Call
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Helper format thời gian chuẩn Việt Nam
const formatMsgTime = (msg) => {
  if (msg?.formattedTime) return msg.formattedTime;
  const timeSource = msg?.timeSend || msg?.rawTime;
  if (!timeSource) return '';
  try {
    const d = new Date(timeSource);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  } catch (e) {
    console.error(e);
  }
  return '';
};

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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Modal Hồ Sơ Người Dùng & Bạn Bè
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);

  // Trạng thái cuộc gọi thoại WebRTC (Hỗ trợ cả Gọi Nhóm & Gọi Riêng 1-1)
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCall, setIncomingCall] = useState(null);
  const [privateCallTarget, setPrivateCallTarget] = useState(null);

  const stompClient = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimerRef = useRef(null);

  // Phân trang lịch sử tin nhắn cuộn lên
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  
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

  // Lấy nickname hiện tại của user trong phòng
  const myUserRoom = roomInfo?.userRoomDTOList?.find(
    ur => ur.userDTO?.id?.toString() === currentUserId
  );
  const currentNickname = myUserRoom?.userDTO?.nickname || localStorage.getItem('nickname') || 'Người dùng';

  // Tính toán quyền Admin thực tế của phòng này dựa trên dữ liệu từ Server
  const isAdminOfThisRoom = myUserRoom?.isAdmin === true;

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Lắng nghe sự kiện Online / Offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Đã khôi phục kết nối mạng!");
      fetchRoomDetail(true);
      fetchHistory();
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast("Đang ngoại tuyến. Bạn có thể xem tin nhắn đã lưu.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchRoomDetail = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const response = await axiosClient.get('/rooms/detail', {
        params: { room_id: roomId }
      });
      if (response.data && response.data.data) {
        setRoomInfo(response.data.data);
      } else {
        const cached = await getRoomsOffline();
        const found = cached?.find(r => r.id?.toString() === roomId?.toString());
        if (found) setRoomInfo(found);
      }
    } catch (err) {
      console.error("Lỗi khi lấy thông tin phòng:", err);
      if (err?.response?.status === 403) {
        toast.error("Bạn chưa tham gia phòng này hoặc không có quyền truy cập!");
        navigate('/');
        return;
      }
      const cached = await getRoomsOffline();
      const found = cached?.find(r => r.id?.toString() === roomId?.toString());
      if (found) setRoomInfo(found);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [roomId, navigate]);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await axiosClient.get('/message/history', {
        params: { room_id: roomId, size: 30 }
      });
      if (response.data && response.data.data) {
        const rawList = response.data.data;
        if (rawList.length < 30) {
          setHasMoreHistory(false);
        } else {
          setHasMoreHistory(true);
        }
        messageIdsRef.current.clear();
        const history = rawList.map(msg => {
          messageIdsRef.current.add(msg.id);
          return {
            id: msg.id,
            text: msg.message,
            sender: msg.nickname,
            userId: msg.userId ? msg.userId.toString() : '0',
            time: msg.formattedTime || formatMsgTime(msg),
            rawTime: msg.timeSend
          };
        });
        setMessages(history);
        saveMessagesOffline(roomId, history); // Lưu bộ nhớ máy ngoại tuyến
        setTimeout(() => scrollToBottom("auto"), 100);
      }
    } catch (err) {
      console.error("Lỗi khi lấy lịch sử tin nhắn:", err);
      if (err?.response?.status === 403) {
        toast.error("Bạn chưa tham gia phòng này hoặc không có quyền truy cập!");
        navigate('/');
        return;
      }
      // Nạp tin nhắn ngoại tuyến từ IndexedDB nếu API thất bại
      const cached = await getMessagesOffline(roomId);
      if (cached && cached.length > 0) {
        setMessages(cached);
        setTimeout(() => scrollToBottom("auto"), 100);
      }
    }
  }, [roomId, navigate]);

  // Cuộn lên đỉnh để tải lịch sử tin nhắn cũ hơn (Cursor pagination mượt mà)
  const handleScrollMessages = useCallback(async (e) => {
    const container = e.currentTarget;
    if (container.scrollTop < 40 && !isLoadingOlder && hasMoreHistory && messages.length > 0) {
      const validMsgs = messages.filter(m => m.id && typeof m.id === 'number');
      if (validMsgs.length === 0) return;
      const oldestId = Math.min(...validMsgs.map(m => m.id));

      setIsLoadingOlder(true);
      const prevScrollHeight = container.scrollHeight;
      const prevScrollTop = container.scrollTop;

      try {
        const response = await axiosClient.get('/message/history', {
          params: {
            room_id: roomId,
            before_id: oldestId,
            size: 30
          }
        });

        if (response.data && response.data.data) {
          const rawOlder = response.data.data;
          if (rawOlder.length < 30) {
            setHasMoreHistory(false);
          }
          const older = rawOlder
            .filter(m => !messageIdsRef.current.has(m.id))
            .map(msg => {
              messageIdsRef.current.add(msg.id);
              return {
                id: msg.id,
                text: msg.message,
                sender: msg.nickname,
                userId: msg.userId ? msg.userId.toString() : '0',
                time: msg.formattedTime || formatMsgTime(msg),
                rawTime: msg.timeSend
              };
            });

          if (older.length > 0) {
            setMessages(prev => [...older, ...prev]);
            // Giữ nguyên vị trí cuộn mượt mà không bị giật nảy
            requestAnimationFrame(() => {
              if (messagesContainerRef.current) {
                const newScrollHeight = messagesContainerRef.current.scrollHeight;
                messagesContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
              }
            });
          }
        } else {
          setHasMoreHistory(false);
        }
      } catch (err) {
        console.error("Lỗi khi tải thêm tin nhắn cũ:", err);
      } finally {
        setIsLoadingOlder(false);
      }
    }
  }, [roomId, isLoadingOlder, hasMoreHistory, messages]);

  // ====================== WEBRTC VOICE CALL LOGIC ======================
  const formatCallDuration = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const cleanupCall = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setIsCallActive(false);
    setIsMuted(false);
    setCallDuration(0);
    setIncomingCall(null);
    setPrivateCallTarget(null);
  }, []);

  const sendCallSignal = (payload) => {
    if (stompClient.current && stompClient.current.connected) {
      stompClient.current.send(`/topic/room/${roomId}`, {}, JSON.stringify({
        isVoiceSignal: true,
        roomId,
        senderId: currentUserId,
        senderName: currentNickname,
        ...payload
      }));
    }
  };

  // Khởi động cuộc gọi nhóm
  const startGroupVoiceCall = async () => {
    if (!navigator.onLine) {
      toast.error("Yêu cầu kết nối Internet để thực hiện cuộc gọi!");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendCallSignal({ type: 'CANDIDATE', candidate: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        remoteAudioRef.current.srcObject = e.streams[0];
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendCallSignal({ type: 'OFFER', offer, isPrivate: false });

      setIsCallActive(true);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      toast.success("Đang bắt đầu cuộc gọi nhóm...");
    } catch (err) {
      console.error("Lỗi khởi tạo cuộc gọi:", err);
      toast.error("Không thể truy cập microphone. Vui lòng cấp quyền!");
    }
  };

  // Khởi động cuộc gọi riêng 1-1
  const startPrivateVoiceCall = async (targetUser) => {
    if (!navigator.onLine) {
      toast.error("Yêu cầu kết nối Internet để gọi riêng!");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendCallSignal({ 
            type: 'CANDIDATE', 
            candidate: e.candidate,
            isPrivate: true,
            targetUserId: targetUser.id 
          });
        }
      };

      pc.ontrack = (e) => {
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        remoteAudioRef.current.srcObject = e.streams[0];
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendCallSignal({ 
        type: 'OFFER', 
        offer,
        isPrivate: true,
        targetUserId: targetUser.id,
        targetUserName: targetUser.nickname || targetUser.account
      });

      setPrivateCallTarget(targetUser);
      setIsCallActive(true);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      toast.success(`Đang gọi riêng cho ${targetUser.nickname || targetUser.account}...`);
    } catch (err) {
      console.error("Lỗi gọi riêng:", err);
      toast.error("Không thể truy cập microphone!");
    }
  };

  const joinIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendCallSignal({ 
            type: 'CANDIDATE', 
            candidate: e.candidate,
            isPrivate: incomingCall.isPrivate,
            targetUserId: incomingCall.callerId
          });
        }
      };

      pc.ontrack = (e) => {
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        remoteAudioRef.current.srcObject = e.streams[0];
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendCallSignal({ 
        type: 'ANSWER', 
        answer,
        isPrivate: incomingCall.isPrivate,
        targetUserId: incomingCall.callerId
      });

      if (incomingCall.isPrivate) {
        setPrivateCallTarget({ id: incomingCall.callerId, nickname: incomingCall.callerName });
      }

      setIncomingCall(null);
      setIsCallActive(true);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      toast.success("Đã kết nối cuộc gọi thoại!");
    } catch (err) {
      console.error("Lỗi tham gia cuộc gọi:", err);
      toast.error("Không thể tham gia cuộc gọi!");
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const endCall = () => {
    sendCallSignal({ 
      type: 'END',
      isPrivate: !!privateCallTarget,
      targetUserId: privateCallTarget?.id
    });
    cleanupCall();
    toast("Đã kết thúc cuộc gọi");
  };

  const handleCallSignal = useCallback(async (msg) => {
    if (msg.senderId?.toString() === currentUserId) return; // Bỏ qua tín hiệu từ chính mình

    // Nếu là cuộc gọi riêng, kiểm tra xem có gửi đích danh cho mình không
    if (msg.isPrivate) {
      if (msg.targetUserId?.toString() !== currentUserId) {
        return; // Không phải gửi cho mình -> bỏ qua
      }
    }

    if (msg.type === 'OFFER') {
      setIncomingCall({
        callerName: msg.senderName,
        callerId: msg.senderId,
        offer: msg.offer,
        isPrivate: msg.isPrivate
      });
    } else if (msg.type === 'ANSWER') {
      if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'stable') {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
      }
    } else if (msg.type === 'CANDIDATE') {
      if (peerConnectionRef.current && msg.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (e) {
          console.error("Lỗi thêm ICE candidate:", e);
        }
      }
    } else if (msg.type === 'END') {
      cleanupCall();
      toast("Cuộc gọi đã kết thúc");
    }
  }, [currentUserId, cleanupCall]);

  // ====================== WEBSOCKET & INITIALIZATION ======================
  useEffect(() => {
    let isMounted = true;
    
    if (stompClient.current && stompClient.current.connected) {
      return;
    }

    const initConnection = async () => {
      messageIdsRef.current.clear();
      
      // Nạp tin nhắn ngoại tuyến từ IndexedDB trước để hiển thị tức thì (< 50ms)
      const offlineCache = await getMessagesOffline(roomId);
      if (offlineCache && offlineCache.length > 0 && isMounted) {
        setMessages(offlineCache);
        setLoading(false);
      }

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

          // Xử lý tín hiệu cuộc gọi thoại WebRTC
          if (receivedMsg.isVoiceSignal) {
            handleCallSignal(receivedMsg);
            return;
          }
          
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
             toast(`${receivedMsg.message}`);
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
              const nextMsgs = [...prev, {
                id: sysId,
                text: receivedMsg.message,
                sender: 'Hệ thống',
                userId: '0',
                isSystem: true,
                time: receivedMsg.formattedTime || formatMsgTime(receivedMsg) || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                rawTime: new Date().toISOString()
              }];
              saveMessagesOffline(roomId, nextMsgs);
              return nextMsgs;
            });
            setTimeout(() => scrollToBottom(), 50);
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
                time: receivedMsg.formattedTime || formatMsgTime(receivedMsg),
                rawTime: receivedMsg.timeSend
              };
              const next = [...prev, newMsg].sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
              saveMessagesOffline(roomId, next);
              return next;
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
      cleanupCall();
      if (stompClient.current && stompClient.current.connected) {
        stompClient.current.disconnect();
        stompClient.current = null;
      }
    };
  }, [roomId, fetchRoomDetail, fetchHistory, currentUserId, navigate, handleCallSignal, cleanupCall]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    if (!navigator.onLine) {
      toast.error("Bạn đang ngoại tuyến. Vui lòng kết nối Internet để gửi tin nhắn!");
      return;
    }
    
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

  if (loading && !roomInfo) return (
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
              <TalovinLogo size={24} />
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
              <Radio size={22} color="#818cf8" />
           </div>
           <div className="room-meta">
              <h3>{roomInfo?.nameroom || `Phòng ${roomId}`}</h3>
              <p>Mã phòng: {roomId}</p>
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
              <div 
                key={idx} 
                className={`member-item ${ur.userDTO?.id?.toString() === currentUserId ? 'is-me' : ''}`}
                onClick={() => setSelectedProfileUserId(ur.userDTO?.id)}
                title="Nhấp để xem thông tin cá nhân & kết bạn"
              >
                <div className="member-avatar">
                   {ur.userDTO?.nickname?.charAt(0).toUpperCase() || "U"}
                   <span className="online-indicator"></span>
                </div>
                <div className="member-info">
                   <span className="name">{ur.userDTO?.nickname || "User"}</span>
                   {ur.isAdmin && <Crown size={14} className="crown-icon" title="Chủ phòng" />}
                </div>
                
                {isAdminOfThisRoom && ur.userDTO?.id?.toString() !== currentUserId && (
                  <div className="member-actions" onClick={(e) => e.stopPropagation()}>
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
           <button 
             onClick={() => setSelectedProfileUserId(currentUserId)} 
             className="my-profile-btn"
             title="Xem và chỉnh sửa hồ sơ của bạn"
           >
              <User size={16} />
              <span>Hồ sơ của tôi</span>
           </button>

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
        {/* Banner Offline Thông Minh */}
        {isOffline && (
          <div className="offline-top-banner">
            <WifiOff size={15} />
            <span>Chế độ Ngoại tuyến: Đang xem các tin nhắn đã lưu trong thiết bị</span>
          </div>
        )}

        {/* Thanh Điều Khiển Cuộc Gọi Thoại Đang Hoạt Động */}
        {isCallActive && (
          <div className="active-call-bar">
            <div className="call-info">
              <div className="pulse-indicator" />
              <span className="call-title">
                {privateCallTarget ? `Đang gọi riêng với ${privateCallTarget.nickname || 'bạn'}` : 'Cuộc gọi nhóm đang kết nối'}
              </span>
              <span className="call-timer">{formatCallDuration(callDuration)}</span>
            </div>
            <div className="call-controls">
              <button 
                onClick={toggleMute} 
                className={`call-ctrl-btn ${isMuted ? 'muted' : ''}`}
                title={isMuted ? "Bật micro" : "Tắt micro"}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button 
                onClick={endCall} 
                className="call-ctrl-btn end-call"
                title="Kết thúc cuộc gọi"
              >
                <PhoneOff size={16} />
              </button>
            </div>
          </div>
        )}

        <header className="chat-header">
           <div className="header-left">
              <button onClick={() => setIsSidebarOpen(true)} className="mobile-toggle-btn" title="Mở danh sách thành viên">
                 <Menu size={20} />
              </button>
              <div className="header-info">
                 <Radio size={18} color="#818cf8" className="header-hash" />
                 <h2>{roomInfo?.nameroom || `Phòng ${roomId}`}</h2>
                 <span className="header-room-id">Phòng {roomId}</span>
              </div>
           </div>
           
           <div className="header-actions">
              {/* Nút Bạn Bè */}
              <button 
                onClick={() => setIsFriendsModalOpen(true)}
                className="header-friends-btn"
                title="Xem danh sách bạn bè & lời mời"
              >
                <Users size={15} />
                <span>Bạn bè</span>
              </button>

              {/* Nút Gọi Thoại Nhóm */}
              <button 
                onClick={startGroupVoiceCall} 
                disabled={isCallActive}
                className={`header-call-btn ${isCallActive && !privateCallTarget ? 'in-call' : ''}`} 
                title="Gọi thoại nhóm với mọi người trong phòng"
              >
                 <Phone size={15} />
                 <span>{isCallActive && !privateCallTarget ? 'Đang gọi' : 'Gọi nhóm'}</span>
              </button>

              <button onClick={() => setIsSidebarOpen(true)} className="members-indicator-btn" title="Xem danh sách thành viên">
                 <Users size={15} />
                 <span>{roomInfo?.userRoomDTOList?.length || 0}</span>
              </button>
              <button onClick={() => navigate('/')} className="exit-top-btn" title="Trở về trang chủ">
                 <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
              </button>
           </div>
        </header>

        <div className="messages-area" ref={messagesContainerRef} onScroll={handleScrollMessages}>
          <div className="messages-list">
            {/* Hiệu ứng loading mượt mà khi cuộn lên nạp tin nhắn cũ */}
            {isLoadingOlder && (
              <div className="history-loader-badge">
                <span className="history-loader-spinner" />
                <span>Đang tải các tin nhắn cũ hơn...</span>
              </div>
            )}

            {/* Banner chào mừng khởi đầu kênh chỉ hiển thị khi đã cuộn tới đầu lịch sử */}
            {!hasMoreHistory && (
              <div className="channel-welcome-banner">
                <div className="welcome-hash-circle">
                  <Radio size={28} color="#818cf8" />
                </div>
                <h2 className="welcome-title">Chào mừng đến với không gian {roomInfo?.nameroom || `Phòng ${roomId}`}!</h2>
                <p className="welcome-subtitle">
                  Đây là điểm khởi đầu của cuộc trò chuyện trong không gian {roomInfo?.nameroom || `phòng ${roomId}`}. Nhấp vào avatar để xem thông tin cá nhân và kết bạn!
                </p>
                <div className="welcome-divider" />
              </div>
            )}

            {messages.map((msg, index) => {
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
                    <div 
                      className="msg-avatar"
                      onClick={() => setSelectedProfileUserId(msg.userId)}
                      title={`Xem thông tin của ${msg.sender}`}
                    >
                       {msg.sender?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                  <div className="msg-content-wrapper">
                    {!isMe && (
                      <span 
                        className="msg-sender"
                        onClick={() => setSelectedProfileUserId(msg.userId)}
                        title={`Xem thông tin của ${msg.sender}`}
                      >
                        {msg.sender}
                      </span>
                    )}
                    <div className="msg-bubble">
                      <p className="msg-text">{msg.text}</p>
                      <span className="msg-time">{msg.time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="chat-input-area">
          <div className="input-container">
            <form onSubmit={handleSendMessage} className="msg-form">
              <input 
                type="text" 
                placeholder={isOffline ? "Đang ngoại tuyến, chỉ có thể xem lịch sử..." : `Nhắn tin trong #${roomInfo?.nameroom || 'phòng'}...`}
                value={newMessage}
                disabled={isOffline}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" disabled={!newMessage.trim() || isOffline} className="send-btn" title="Gửi tin nhắn">
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Modal Xem Hồ Sơ Người Dùng */}
      {selectedProfileUserId && (
        <UserProfileModal 
          userId={selectedProfileUserId}
          currentUserId={currentUserId}
          onClose={() => setSelectedProfileUserId(null)}
          onStartPrivateCall={startPrivateVoiceCall}
        />
      )}

      {/* Modal Bạn Bè & Lời Mời Kết Bạn */}
      {isFriendsModalOpen && (
        <FriendsModal 
          onClose={() => setIsFriendsModalOpen(false)}
          onSelectUser={(uid) => {
            setIsFriendsModalOpen(false);
            setSelectedProfileUserId(uid);
          }}
          onStartPrivateCall={startPrivateVoiceCall}
        />
      )}

      {/* Modal Cuộc Gọi Đến (Incoming Call Alert - Hỗ trợ cả Nhóm và Riêng 1-1) */}
      {incomingCall && !isCallActive && (
        <div className="incoming-call-overlay">
          <div className="incoming-call-card">
            <div className="incoming-phone-pulse">
              <Phone size={24} className="ring-animate" />
            </div>
            <h3>{incomingCall.isPrivate ? "Cuộc gọi riêng 1-1" : "Cuộc gọi thoại nhóm"}</h3>
            <p>
              <strong>{incomingCall.callerName}</strong> {incomingCall.isPrivate ? "đang gọi riêng cho bạn" : `đang bắt đầu cuộc gọi thoại trong phòng #${roomInfo?.nameroom || roomId}`}
            </p>
            <div className="incoming-call-btns">
              <button onClick={joinIncomingCall} className="btn-join-call">
                <Phone size={16} /> Trả lời
              </button>
              <button onClick={() => setIncomingCall(null)} className="btn-dismiss-call">
                Từ chối
              </button>
            </div>
          </div>
        </div>
      )}

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
          --chat-bg: #090d16;
          --sidebar-bg: #060911;
          --header-bg: #0f172a;
          --input-bg: #141c2e;
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --primary-brand: #6366f1;
          --primary-brand-hover: #4f46e5;
          --bubble-them: #131c2e;
          --bubble-them-border: rgba(255, 255, 255, 0.08);
          --bubble-me: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          --red-accent: #ef4444;
        }

        .chat-container {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          display: flex;
          background: var(--chat-bg);
          color: var(--text-main);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          overflow: hidden;
          z-index: 10;
        }

        /* Top Offline Banner */
        .offline-top-banner {
          background: rgba(245, 158, 11, 0.18);
          border-bottom: 1px solid rgba(245, 158, 11, 0.4);
          color: #fbbf24;
          padding: 6px 16px;
          font-size: 12.5px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 500;
          z-index: 40;
        }

        /* Active Call Bar */
        .active-call-bar {
          background: linear-gradient(90deg, rgba(16, 185, 129, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%);
          border-bottom: 1px solid rgba(16, 185, 129, 0.4);
          padding: 8px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 40;
          backdrop-filter: blur(8px);
        }
        .call-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pulse-indicator {
          width: 10px;
          height: 10px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          animation: pulseGreen 1.5s infinite;
        }
        @keyframes pulseGreen {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .call-title {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
        }
        .call-timer {
          font-size: 12px;
          background: rgba(0, 0, 0, 0.4);
          color: #34d399;
          padding: 2px 8px;
          border-radius: 10px;
          font-family: monospace;
          font-weight: 700;
        }
        .call-controls {
          display: flex;
          gap: 8px;
        }
        .call-ctrl-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .call-ctrl-btn:hover { background: rgba(255, 255, 255, 0.2); }
        .call-ctrl-btn.muted { background: #ef4444; color: white; }
        .call-ctrl-btn.end-call { background: #ef4444; color: white; }
        .call-ctrl-btn.end-call:hover { background: #dc2626; transform: scale(1.05); }

        /* Incoming Call Modal */
        .incoming-call-overlay {
          position: fixed;
          top: 70px;
          right: 20px;
          z-index: 1000;
          animation: slideDown 0.3s ease-out;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .incoming-call-card {
          background: #1e293b;
          border: 1px solid #10b981;
          box-shadow: 0 10px 30px rgba(0,0,0,0.6);
          border-radius: 16px;
          padding: 16px 20px;
          width: 320px;
          text-align: center;
        }
        .incoming-phone-pulse {
          width: 48px;
          height: 48px;
          background: rgba(16, 185, 129, 0.2);
          border-radius: 50%;
          color: #10b981;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 10px auto;
        }
        .ring-animate { animation: ring 1.5s infinite; }
        @keyframes ring {
          0%, 100% { transform: rotate(0deg); }
          20%, 60% { transform: rotate(-15deg); }
          40%, 80% { transform: rotate(15deg); }
        }
        .incoming-call-card h3 { margin: 0 0 6px 0; font-size: 16px; color: #f8fafc; }
        .incoming-call-card p { margin: 0 0 14px 0; font-size: 13px; color: #94a3b8; }
        .incoming-call-btns { display: flex; gap: 10px; }
        .btn-join-call {
          flex: 1;
          background: #10b981;
          color: white;
          border: none;
          padding: 8px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .btn-dismiss-call {
          flex: 1;
          background: #334155;
          color: #cbd5e1;
          border: none;
          padding: 8px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }

        /* Sidebar */
        .sidebar-left {
          width: 280px;
          background: var(--sidebar-bg);
          display: flex;
          flex-direction: column;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          z-index: 50;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sidebar-header {
          padding: 12px 16px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          box-sizing: border-box;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          color: #f8fafc;
        }
        .brand-icon {
          background: var(--primary-brand);
          padding: 6px;
          border-radius: 8px;
          display: flex;
          color: white;
        }
        .back-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transform: rotate(180deg);
          display: flex;
          padding: 6px;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .back-btn:hover { background: #1e293b; color: white; }
        .close-sidebar-mobile {
          display: none;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
        }
        .room-profile {
          padding: 16px;
          background: linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%);
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .room-avatar {
          width: 42px;
          height: 42px;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #818cf8;
          flex-shrink: 0;
        }
        .room-meta { overflow: hidden; }
        .room-meta h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .room-meta p {
          margin: 2px 0 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .admin-badge {
          margin-left: auto;
          font-size: 10px;
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.35);
          color: #a5b4fc;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 700;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px 10px;
        }
        .section-title {
          padding: 0 10px 10px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .member-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .member-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 10px;
          border-radius: 8px;
          position: relative;
          cursor: pointer;
          transition: background 0.15s;
        }
        .member-item:hover { background: #131c2e; }
        .member-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 13px;
          position: relative;
          flex-shrink: 0;
        }
        .online-indicator {
          width: 10px;
          height: 10px;
          background: #10b981;
          border: 2px solid var(--sidebar-bg);
          border-radius: 50%;
          position: absolute;
          bottom: -1px;
          right: -1px;
        }
        .member-info {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          overflow: hidden;
        }
        .member-info .name {
          font-size: 13.5px;
          font-weight: 500;
          color: #f1f5f9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .crown-icon { color: #f59e0b; flex-shrink: 0; }
        .member-actions { position: relative; }
        .dots-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          display: flex;
          border-radius: 6px;
        }
        .dots-btn:hover { color: white; background: #334155; }
        .member-dropdown {
          position: absolute;
          right: 0;
          top: 100%;
          background: #0f172a;
          border-radius: 8px;
          padding: 6px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          z-index: 100;
          min-width: 145px;
          border: 1px solid #334155;
        }
        .action-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: none;
          border: none;
          color: #cbd5e1;
          font-size: 13px;
          cursor: pointer;
          width: 100%;
          border-radius: 6px;
          text-align: left;
          transition: background 0.15s;
        }
        .action-item:hover { background: var(--primary-brand); color: white; }
        .kick-item:hover { background: var(--red-accent) !important; color: white; }

        .sidebar-footer {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(0,0,0,0.25);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .my-profile-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 9px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #a5b4fc;
          transition: all 0.2s;
        }
        .my-profile-btn:hover { background: #4f46e5; color: white; }

        .leave-btn, .disband-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 9px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s;
        }
        .leave-btn {
          background: transparent;
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #f87171;
        }
        .leave-btn:hover { background: #ef4444; color: white; border-color: #ef4444; }
        .disband-btn {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid #ef4444;
          color: #f87171;
        }
        .disband-btn:hover { background: #ef4444; color: white; }
        
        /* Main Chat Area */
        .chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--chat-bg);
          position: relative;
          overflow: hidden;
          height: 100%;
        }
        .chat-header {
          height: 56px;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--header-bg);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          box-sizing: border-box;
          flex-shrink: 0;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          overflow: hidden;
        }
        .header-info {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
        }
        .header-hash { color: #818cf8; flex-shrink: 0; }
        .header-info h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .header-room-id {
          font-size: 12px;
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .mobile-toggle-btn {
          display: none;
          background: none;
          border: none;
          color: var(--text-main);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
        }
        .mobile-toggle-btn:hover { background: #334155; }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .header-friends-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #a5b4fc;
          font-size: 12.5px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .header-friends-btn:hover { background: #4f46e5; color: white; }

        .header-call-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.35);
          color: #34d399;
          font-size: 12.5px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .header-call-btn:hover:not(:disabled) {
          background: #10b981;
          color: white;
          transform: translateY(-1px);
        }
        .header-call-btn.in-call {
          background: #10b981;
          color: white;
        }
        .members-indicator-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #e2e8f0;
          font-size: 12.5px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .members-indicator-btn:hover { background: #1e293b; }
        .exit-top-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          display: flex;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .exit-top-btn:hover { color: white; background: #1e293b; }
        
        /* Message Area */
        .messages-area {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          padding: 20px 24px;
          scroll-behavior: smooth;
        }
        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          width: 100%;
        }

        /* History Loader */
        .history-loader-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 6px 14px;
          margin: 4px auto 14px auto;
          background: rgba(24, 24, 27, 0.85);
          border: 1px solid rgba(63, 63, 70, 0.4);
          backdrop-filter: blur(8px);
          border-radius: 9999px;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.02em;
          width: fit-content;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          animation: fadeIn 0.2s ease-in-out;
        }
        .history-loader-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(161, 161, 170, 0.25);
          border-top-color: #f43f5e;
          border-radius: 50%;
          animation: spinHistory 0.7s linear infinite;
        }
        @keyframes spinHistory {
          to { transform: rotate(360deg); }
        }

        /* Channel Welcome Banner */
        .channel-welcome-banner {
          margin-bottom: 24px;
          padding: 20px 0 10px 0;
        }
        .welcome-hash-circle {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #818cf8;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }
        .welcome-title {
          margin: 0 0 6px 0;
          font-size: 24px;
          font-weight: 700;
          color: #f8fafc;
        }
        .welcome-subtitle {
          margin: 0 0 16px 0;
          font-size: 14px;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .welcome-divider {
          height: 1px;
          background: linear-gradient(to right, rgba(255, 255, 255, 0.1), transparent);
          width: 100%;
        }

        /* Message Group & Bubbles */
        .msg-group {
          display: flex;
          gap: 12px;
          width: 100%;
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .msg-avatar {
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
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
          cursor: pointer;
          transition: transform 0.15s;
        }
        .msg-avatar:hover { transform: scale(1.08); }

        .msg-content-wrapper {
          display: flex;
          flex-direction: column;
          max-width: 72%;
        }
        .msg-sender {
          font-size: 12px;
          font-weight: 600;
          color: #818cf8;
          margin-bottom: 4px;
          padding-left: 2px;
          cursor: pointer;
        }
        .msg-sender:hover { text-decoration: underline; color: #a5b4fc; }

        .msg-bubble {
          position: relative;
          padding: 10px 14px;
          border-radius: 4px 18px 18px 18px;
          background: var(--bubble-them);
          border: 1px solid var(--bubble-them-border);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          word-break: break-word;
        }
        .msg-text {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          color: #f1f5f9;
        }
        .msg-time {
          font-size: 10.5px;
          color: #94a3b8;
          margin-top: 4px;
          display: block;
          text-align: right;
        }

        /* Current User Message */
        .msg-me {
          justify-content: flex-end;
        }
        .msg-me .msg-content-wrapper {
          align-items: flex-end;
          max-width: 72%;
        }
        .msg-me .msg-bubble {
          background: var(--bubble-me);
          border: none;
          border-radius: 18px 18px 4px 18px;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
        }
        .msg-me .msg-text {
          color: #ffffff;
        }
        .msg-me .msg-time {
          color: rgba(255, 255, 255, 0.75);
        }

        /* System Messages */
        .system-msg {
          text-align: center;
          margin: 8px 0;
          width: 100%;
        }
        .system-msg span {
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(51, 65, 85, 0.6);
          padding: 4px 14px;
          border-radius: 16px;
          font-size: 11.5px;
          color: #94a3b8;
          display: inline-block;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        }

        /* Input Area */
        .chat-input-area {
          padding: 12px 20px 16px;
          background: var(--chat-bg);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
        }
        .input-container {
          background: var(--input-bg);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          padding: 4px 6px 4px 16px;
          height: 48px;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-container:focus-within {
          border-color: var(--primary-brand);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
        }
        .msg-form {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          height: 100%;
        }
        .msg-form input {
          flex: 1;
          background: none;
          border: none;
          color: var(--text-main);
          font-size: 14.5px;
          outline: none;
        }
        .msg-form input::placeholder {
          color: #64748b;
        }
        .send-btn {
          background: var(--primary-brand);
          border: none;
          color: white;
          cursor: pointer;
          width: 38px;
          height: 38px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, transform 0.1s;
          flex-shrink: 0;
        }
        .send-btn:hover:not(:disabled) {
          background: var(--primary-brand-hover);
          transform: scale(1.04);
        }
        .send-btn:active:not(:disabled) {
          transform: scale(0.96);
        }
        .send-btn:disabled {
          background: #1e293b;
          color: #64748b;
          cursor: not-allowed;
        }

        /* Modal Dialog */
        .confirm-backdrop {
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
        .confirm-box {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 1.25rem;
          padding: 1.75rem;
          width: 100%;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6);
        }
        .confirm-icon-badge {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem auto;
        }
        .confirm-title {
          margin: 0 0 0.5rem 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: #f8fafc;
        }
        .confirm-message {
          margin: 0 0 1.5rem 0;
          font-size: 0.95rem;
          color: #94a3b8;
          line-height: 1.5;
        }
        .confirm-actions {
          display: flex;
          gap: 0.75rem;
        }
        .btn-confirm-cancel {
          flex: 1;
          background: #334155;
          color: #cbd5e1;
          border: none;
          padding: 0.75rem;
          border-radius: 0.6rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-confirm-cancel:hover { background: #475569; }
        .btn-confirm-ok {
          flex: 1;
          border: none;
          padding: 0.75rem;
          border-radius: 0.6rem;
          font-weight: 600;
          cursor: pointer;
          color: white;
          transition: opacity 0.15s;
        }
        .btn-confirm-ok:hover { opacity: 0.92; }
        .btn-danger { background: #ef4444; }
        .btn-primary { background: #4f46e5; }

        .loading-screen {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background: #090d16;
          color: #818cf8;
          gap: 12px;
        }
        .loader {
          width: 38px;
          height: 38px;
          border: 3px solid rgba(255,255,255,0.12);
          border-bottom-color: #818cf8;
          border-radius: 50%;
          animation: rotation 1s linear infinite;
        }
        @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Responsive on Tablet & Mobile */
        @media (max-width: 768px) {
          .sidebar-left {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            width: min(290px, 85vw);
            transform: translateX(-100%);
            box-shadow: 4px 0 20px rgba(0,0,0,0.6);
          }
          .sidebar-left.sidebar-open {
            transform: translateX(0);
          }
          .sidebar-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.65);
            backdrop-filter: blur(4px);
            z-index: 40;
          }
          .close-sidebar-mobile { display: flex; }
          .mobile-toggle-btn { display: flex; }
          .chat-header { padding: 0 14px; }
          .messages-area { padding: 14px 14px; }
          .msg-content-wrapper { max-width: 85%; }
          .msg-me .msg-content-wrapper { max-width: 85%; }
          .chat-input-area {
            padding: 8px 12px max(12px, env(safe-area-inset-bottom));
          }
          .welcome-title { font-size: 20px; }
          .incoming-call-overlay {
            top: auto;
            bottom: 80px;
            left: 14px;
            right: 14px;
          }
          .incoming-call-card { width: auto; }
        }
      `}} />
    </div>
  );
};

export default ChatRoom;
