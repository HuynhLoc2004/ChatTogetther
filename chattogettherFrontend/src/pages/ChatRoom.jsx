import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Send, Users, LogOut, MessageCircle, Hash, Radio,
  MoreVertical, UserX, ChevronRight, Trash2, Crown, X, Menu, AlertTriangle,
  Phone, PhoneOff, Mic, MicOff, WifiOff, User, UserCheck, ArrowLeft,
  Video, VideoOff, Image as ImageIcon, Smile, Palette, Play, Pause,
  ExternalLink, Square, Camera, RefreshCw
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import { saveMessagesOffline, getMessagesOffline, getRoomsOffline } from '../utils/offlineDB';
import UserProfileModal from './UserProfileModal';
import FriendsModal from './FriendsModal';
import TalovinLogo from '../components/TalovinLogo';
import GroupCollageAvatar from '../components/GroupCollageAvatar';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import toast from 'react-hot-toast';
import { CHAT_THEMES, getThemeById } from '../utils/chatThemes';

// Cấu hình Google STUN servers miễn phí cho WebRTC P2P Voice & Video Call
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

// Helper parse nội dung tin nhắn đa phương tiện (JSON payload)
const parseMessagePayload = (rawText) => {
  if (typeof rawText === 'string' && rawText.trim().startsWith('{') && rawText.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(rawText.trim());
      if (parsed.type) return parsed;
    } catch (e) {}
  }
  return { type: 'text', text: rawText };
};

const COMMON_EMOJIS = ['😊', '❤️', '🔥', '😂', '👍', '🎉', '🙏', '✨', '🥺', '💯', '👀', '👏', '👋', '😎', '☕', '⚡', '💬', '🏆'];

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

  // Theme giao diện phòng chat
  const [currentThemeId, setCurrentThemeId] = useState(() => {
    return localStorage.getItem(`talovin_room_theme_${roomId}`) || 'obsidian';
  });
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const activeTheme = getThemeById(currentThemeId);

  // Modal Hồ Sơ Người Dùng & Bạn Bè
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);

  // Quản lý trạng thái trực tuyến thực tế (Real-time Presence)
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const presenceIntervalRef = useRef(null);

  // Trạng thái cuộc gọi thoại & Video WebRTC
  const [isCallActive, setIsCallActive] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCall, setIncomingCall] = useState(null);
  const [privateCallTarget, setPrivateCallTarget] = useState(null);

  // Nhắn tin đa phương tiện
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState(null);

  const stompClient = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callTimerRef = useRef(null);
  const fileImageRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const currentAudioElemRef = useRef(null);

  // Phân trang lịch sử tin nhắn cuộn lên (mặc định false để không bị loop giật lag)
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
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

  // Lọc và phân loại thành viên trực tuyến / ngoại tuyến chuẩn xác theo thời gian thực
  const { onlineMembers, offlineMembers } = useMemo(() => {
    const list = roomInfo?.userRoomDTOList || [];
    const online = [];
    const offline = [];
    list.forEach(ur => {
      const uId = ur.userDTO?.id?.toString();
      const isOnline = (currentUserId && uId === currentUserId) || (uId && onlineUserIds.has(uId));
      if (isOnline) {
        online.push(ur);
      } else {
        offline.push(ur);
      }
    });
    return { onlineMembers: online, offlineMembers: offline };
  }, [roomInfo?.userRoomDTOList, onlineUserIds, currentUserId]);

  const scrollToBottom = (behavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleSelectTheme = (themeId) => {
    setCurrentThemeId(themeId);
    localStorage.setItem(`talovin_room_theme_${roomId}`, themeId);
    setIsThemeModalOpen(false);
    toast.success("Đã áp dụng chủ đề màu sắc mới!");
  };

  // Cuộn lên tải thêm lịch sử tin nhắn
  const handleScrollMessages = (e) => {
    if (hasMoreHistory && !isLoadingOlder && e.target.scrollTop < 5) {
      const container = e.target;
      const previousScrollHeight = container.scrollHeight;

      setIsLoadingOlder(true);
      fetchHistory(true).then(() => {
        setTimeout(() => {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - previousScrollHeight;
          setIsLoadingOlder(false);
        }, 50);
      }).catch(() => {
        setIsLoadingOlder(false);
      });
    }
  };

  // Lấy chi tiết phòng
  const fetchRoomDetail = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const response = await axiosClient.get('/rooms/detail', {
        params: { room_id: roomId }
      });
      if (response.data && response.data.data) {
        setRoomInfo(response.data.data);
      }
    } catch (err) {
      if (err.response && (err.response.status === 404 || err.response.status === 400)) {
        toast.error("Phòng trò chuyện không tồn tại hoặc đã bị giải tán!");
        navigate('/');
      } else if (!isOffline) {
        toast.error("Không thể tải thông tin phòng!");
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [roomId, navigate, isOffline]);

  // Lấy lịch sử tin nhắn
  const fetchHistory = useCallback(async (isLoadMore = false) => {
    try {
      const response = await axiosClient.get(`/message/${roomId}`);
      if (response.data && response.data.data) {
        const rawHistory = response.data.data;
        const formatted = rawHistory.map((m) => ({
          id: m.id,
          text: m.message,
          sender: m.nickname,
          userId: m.userId ? m.userId.toString() : '',
          time: m.formattedTime || formatMsgTime(m),
          rawTime: m.timeSend
        })).sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));

        setMessages((prev) => {
          if (!isLoadMore) {
            saveMessagesOffline(roomId, formatted);
            return formatted;
          }
          const existingIds = new Set(prev.map(item => item.id));
          const newUniqueMsgs = formatted.filter(item => !existingIds.has(item.id));
          const combined = [...newUniqueMsgs, ...prev].sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
          saveMessagesOffline(roomId, combined);
          return combined;
        });

        if (isLoadMore && rawHistory.length === 0) {
          setHasMoreHistory(false);
        }
      }
    } catch (err) {
      console.warn("Không thể tải tin nhắn trực tuyến:", err);
    }
  }, [roomId]);

  // Dọn dẹp WebRTC Call
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
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setIsCallActive(false);
    setIsVideoCall(false);
    setIsVideoEnabled(true);
    setIsMuted(false);
    setIncomingCall(null);
    setPrivateCallTarget(null);
  }, []);

  // Kết thúc cuộc gọi & ghi nhận thông báo thời lượng
  const endCall = () => {
    if (callDuration > 0) {
      const mins = Math.floor(callDuration / 60);
      const secs = callDuration % 60;
      const formattedDuration = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
      
      try {
        const payload = JSON.stringify({
          type: 'call_ended',
          duration: formattedDuration,
          isVideo: isVideoCall,
          endedBy: localStorage.getItem('nickname') || 'Thành viên'
        });
        axiosClient.post('/message/send', {
          message: payload,
          timeSend: new Date().toISOString()
        }, { params: { user_room: roomId } }).catch(() => {});
      } catch (e) {}
    }

    sendCallSignal({ 
      type: 'END',
      isPrivate: !!privateCallTarget,
      targetUserId: privateCallTarget ? privateCallTarget.id.toString() : null
    });
    cleanupCall();
    setCallDuration(0);
    toast("Đã kết thúc cuộc gọi");
  };

  const sendCallSignal = (data) => {
    if (stompClient.current && stompClient.current.connected) {
      const destination = data.isPrivate && data.targetUserId
        ? `/app/call/user/${data.targetUserId}`
        : `/app/call/${roomId}`;

      stompClient.current.send(destination, {}, JSON.stringify({
        ...data,
        callerId: currentUserId,
        callerName: localStorage.getItem('nickname') || 'Thành viên',
        roomId: roomId,
        isVideo: isVideoCall
      }));
    }
  };

  // Khởi động cuộc gọi thoại nhóm
  const startGroupVoiceCall = async () => {
    if (!navigator.onLine) {
      toast.error("Yêu cầu kết nối Internet để thực hiện cuộc gọi!");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setIsVideoCall(false);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendCallSignal({ type: 'CANDIDATE', candidate: e.candidate, isVideo: false });
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

      sendCallSignal({ type: 'OFFER', offer, isPrivate: false, isVideo: false });

      setIsCallActive(true);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      toast.success("Đang phát cuộc gọi thoại nhóm...");
    } catch (err) {
      console.error("Lỗi khởi tạo cuộc gọi:", err);
      toast.error("Không thể truy cập Microphone thiết bị!");
    }
  };

  // Khởi động cuộc gọi Video nhóm
  const startGroupVideoCall = async () => {
    if (!navigator.onLine) {
      toast.error("Yêu cầu kết nối Internet để gọi video!");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      localStreamRef.current = stream;
      setIsVideoCall(true);
      setIsVideoEnabled(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendCallSignal({ type: 'CANDIDATE', candidate: e.candidate, isVideo: true });
        }
      };

      pc.ontrack = (e) => {
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        remoteAudioRef.current.srcObject = e.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendCallSignal({ type: 'OFFER', offer, isPrivate: false, isVideo: true });

      setIsCallActive(true);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      toast.success("Đang phát cuộc gọi Video nhóm...");
    } catch (err) {
      console.error("Lỗi mở camera:", err);
      toast.error("Không thể truy cập Camera hoặc Micro!");
    }
  };

  // Bắt đầu cuộc gọi riêng 1-1
  const startPrivateVoiceCall = async (targetUser) => {
    if (!targetUser || !targetUser.id) return;
    if (targetUser.id.toString() === currentUserId) {
      toast.error("Bạn không thể tự gọi cho chính mình!");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setPrivateCallTarget(targetUser);
      setIsVideoCall(false);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendCallSignal({ 
            type: 'CANDIDATE', 
            candidate: e.candidate, 
            isPrivate: true,
            targetUserId: targetUser.id.toString(),
            isVideo: false
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
        targetUserId: targetUser.id.toString(),
        isVideo: false
      });

      setIsCallActive(true);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      toast.success(`Đang gọi riêng cho ${targetUser.nickname || 'người dùng'}...`);
    } catch (err) {
      console.error("Lỗi gọi riêng:", err);
      toast.error("Không thể truy cập Microphone!");
    }
  };

  // Trả lời cuộc gọi đến
  const answerCall = async () => {
    if (!incomingCall) return;
    try {
      const isVideo = !!incomingCall.isVideo;
      setIsVideoCall(isVideo);
      setIsVideoEnabled(isVideo);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: isVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false 
      });
      localStreamRef.current = stream;

      if (isVideo && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendCallSignal({ 
            type: 'CANDIDATE', 
            candidate: e.candidate,
            isPrivate: incomingCall.isPrivate,
            targetUserId: incomingCall.callerId,
            isVideo: isVideo
          });
        }
      };

      pc.ontrack = (e) => {
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        remoteAudioRef.current.srcObject = e.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendCallSignal({ 
        type: 'ANSWER', 
        answer,
        isPrivate: incomingCall.isPrivate,
        targetUserId: incomingCall.callerId,
        isVideo: isVideo
      });

      setIsCallActive(true);
      setIncomingCall(null);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Lỗi nghe máy:", err);
      toast.error("Không thể kích hoạt thiết bị nghe gọi!");
      setIncomingCall(null);
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      sendCallSignal({ 
        type: 'END',
        isPrivate: incomingCall.isPrivate,
        targetUserId: incomingCall.callerId
      });
      setIncomingCall(null);
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

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Xử lý tín hiệu cuộc gọi
  const handleCallSignal = useCallback(async (msg) => {
    if (msg.callerId === currentUserId) return;

    if (msg.type === 'OFFER') {
      if (!isCallActive) {
        setIncomingCall(msg);
      } else {
        sendCallSignal({ 
          type: 'BUSY', 
          targetUserId: msg.callerId,
          isPrivate: msg.isPrivate
        });
      }
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
  }, [currentUserId, isCallActive, cleanupCall]);

  // Kết nối WebSocket & Khởi tạo dữ liệu
  useEffect(() => {
    let isMounted = true;

    const initConnection = async () => {
      // 1. Nạp cache tin nhắn offline
      const cachedMsgs = await getMessagesOffline(roomId);
      if (cachedMsgs && cachedMsgs.length > 0 && isMounted) {
        setMessages(cachedMsgs);
      }

      await fetchRoomDetail();
      await fetchHistory();

      // Nạp danh sách trực tuyến ban đầu từ server
      try {
        const presRes = await axiosClient.get(`/rooms/${roomId}/online-users`);
        if (presRes?.data?.data && Array.isArray(presRes.data.data) && isMounted) {
          setOnlineUserIds(new Set(presRes.data.data.map(String)));
        }
      } catch (err) {
        console.warn("Không thể tải online users ban đầu:", err);
      }

      // 2. Kết nối STOMP
      const socket = new SockJS(`${BACKEND_URL}/ws-gs-guide`);
      const client = Stomp.over(socket);
      client.debug = null;
      stompClient.current = client;

      client.connect({}, () => {
        if (!isMounted) return;

        // Sub kênh hiện diện thực tế (Real-time Presence) của phòng
        client.subscribe(`/topic/room/${roomId}/presence`, (message) => {
          try {
            const list = JSON.parse(message.body);
            if (Array.isArray(list)) {
              setOnlineUserIds(new Set(list.map(String)));
            }
          } catch (e) {
            console.error("Lỗi cập nhật presence:", e);
          }
        });

        // Báo hiệu đã vào phòng và bắt đầu gửi heartbeat
        if (currentUserId) {
          client.send(`/app/room/${roomId}/presence/join`, {}, JSON.stringify({ userId: currentUserId }));
          
          if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
          presenceIntervalRef.current = setInterval(() => {
            if (stompClient.current && stompClient.current.connected) {
              stompClient.current.send(`/app/room/${roomId}/presence/heartbeat`, {}, JSON.stringify({ userId: currentUserId }));
            }
          }, 15000);
        }

        // Sub kênh tín hiệu cuộc gọi
        client.subscribe(`/topic/call/${roomId}`, (message) => {
          try {
            handleCallSignal(JSON.parse(message.body));
          } catch (e) {}
        });

        // Sub kênh tín hiệu cuộc gọi riêng
        if (currentUserId) {
          client.subscribe(`/topic/call/user/${currentUserId}`, (message) => {
            try {
              handleCallSignal(JSON.parse(message.body));
            } catch (e) {}
          });
        }

        // Handler chung cho tin nhắn phòng từ WebSocket
        const handleRoomIncomingMessage = (message) => {
          try {
            const receivedMsg = JSON.parse(message.body);

            // Logic KICK
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

            // Logic DISBAND
            if (receivedMsg.id === -2) {
               toast.error("Phòng chat này đã được giải tán!", { duration: 6000 });
               navigate('/');
               return;
            }

            if (receivedMsg.userId === 0 || receivedMsg.userId === '0') {
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
              setMessages((prev) => {
                const msgId = receivedMsg.id || Date.now() + Math.random();
                if (prev.find(m => m.id === msgId)) return prev;
                
                // Lọc bỏ tin nhắn tạm thời (optimistic) nếu có
                const filtered = prev.filter(m => !(typeof m.id === 'string' && m.id.startsWith('temp-') && m.text === receivedMsg.message));

                const newMsg = {
                  id: msgId,
                  text: receivedMsg.message,
                  sender: receivedMsg.nickname,
                  userId: receivedMsg.userId ? receivedMsg.userId.toString() : '',
                  time: receivedMsg.formattedTime || formatMsgTime(receivedMsg),
                  rawTime: receivedMsg.timeSend || new Date().toISOString()
                };
                const next = [...filtered, newMsg].sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
                saveMessagesOffline(roomId, next);
                return next;
              });
              setTimeout(() => scrollToBottom(), 50);
            }
          } catch (e) {
            console.error("Lỗi xử lý tin nhắn socket:", e);
          }
        };

        // Sub cả 2 topic /topic/room/${roomId} và /topic/${roomId} để đảm bảo 100% không sót tin
        client.subscribe(`/topic/room/${roomId}`, handleRoomIncomingMessage);
        client.subscribe(`/topic/${roomId}`, handleRoomIncomingMessage);
      }, (error) => {
        console.error('Lỗi kết nối WebSocket:', error);
      });
    };

    initConnection();

    return () => {
      isMounted = false;
      cleanupCall();
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
      if (stompClient.current && stompClient.current.connected) {
        if (currentUserId) {
          try {
            stompClient.current.send(`/app/room/${roomId}/presence/leave`, {}, JSON.stringify({ userId: currentUserId }));
          } catch (e) {}
        }
        stompClient.current.disconnect();
        stompClient.current = null;
      }
    };
  }, [roomId, fetchRoomDetail, fetchHistory, currentUserId, navigate, handleCallSignal, cleanupCall]);

  // Gửi tin nhắn văn bản
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    if (!navigator.onLine) {
      toast.error("Bạn đang ngoại tuyến. Vui lòng kết nối Internet để gửi tin nhắn!");
      return;
    }

    const myNickname = localStorage.getItem('nickname') || 'Tôi';
    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      id: tempId,
      text: trimmed,
      sender: myNickname,
      userId: (currentUserId || '').toString(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      rawTime: new Date().toISOString()
    };
    
    try {
      setNewMessage('');
      setShowEmojiPicker(false);
      setMessages(prev => [...prev, optimisticMsg]);
      setTimeout(() => scrollToBottom("smooth"), 50);

      await axiosClient.post(`/message/send`, {
        message: trimmed,
        timeSend: new Date().toISOString()
      }, {
        params: { user_room: roomId }
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi tin nhắn!");
    }
  };

  // Gửi hình ảnh
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Vui lòng chọn tệp hình ảnh hợp lệ!");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Ảnh quá lớn (tối đa 8MB)!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 900;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/webp', 0.82);
        const payload = JSON.stringify({
          type: 'image',
          url: compressedDataUrl,
          caption: newMessage.trim() || undefined
        });

        const myNickname = localStorage.getItem('nickname') || 'Tôi';
        const tempId = 'temp-' + Date.now();
        const optimisticMsg = {
          id: tempId,
          text: payload,
          sender: myNickname,
          userId: (currentUserId || '').toString(),
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }),
          rawTime: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage('');
        setTimeout(() => scrollToBottom("smooth"), 60);

        axiosClient.post('/message/send', {
          message: payload,
          timeSend: new Date().toISOString()
        }, { params: { user_room: roomId } })
        .then(() => {
          toast.success("Đã gửi hình ảnh!");
          setTimeout(() => scrollToBottom("smooth"), 60);
        })
        .catch(() => {
          toast.error("Không thể gửi ảnh!");
        });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Ghi âm Voice Note trong đoạn chat (tối đa 15s)
  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Trình duyệt không hỗ trợ ghi âm!");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = {};
        }
      }
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64Audio = reader.result;
          const payload = JSON.stringify({
            type: 'voice',
            audioUrl: base64Audio,
            duration: voiceDuration || 1
          });
          axiosClient.post('/message/send', {
            message: payload,
            timeSend: new Date().toISOString()
          }, { params: { user_room: roomId } })
          .then(() => {
            toast.success("Đã gửi đoạn ghi âm!");
            setTimeout(() => scrollToBottom("smooth"), 60);
          })
          .catch(() => {
            toast.error("Không thể gửi đoạn ghi âm!");
          });
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecordingVoice(true);
      setVoiceDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setVoiceDuration(prev => {
          if (prev >= 14) {
            stopVoiceRecording();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Lỗi ghi âm:", err);
      toast.error("Vui lòng cấp quyền Microphone để ghi âm!");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecordingVoice(false);
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecordingVoice(false);
    setVoiceDuration(0);
    toast("Đã hủy ghi âm");
  };

  // Phát Voice Note trong tin nhắn
  const togglePlayAudio = (msgId, audioUrl) => {
    if (playingAudioId === msgId) {
      if (currentAudioElemRef.current) {
        currentAudioElemRef.current.pause();
        currentAudioElemRef.current = null;
      }
      setPlayingAudioId(null);
      return;
    }

    if (currentAudioElemRef.current) {
      currentAudioElemRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    currentAudioElemRef.current = audio;
    setPlayingAudioId(msgId);

    audio.onended = () => {
      setPlayingAudioId(null);
      currentAudioElemRef.current = null;
    };
    audio.play().catch(e => {
      console.error("Lỗi phát audio:", e);
      setPlayingAudioId(null);
    });
  };

  // Quản lý thành viên (Admin)
  const handleRemoveUser = async (targetUserId, nickname) => {
    setActiveMenu(null);
    setConfirmDialog({
      title: "Mời thành viên ra ngoài",
      message: `Bạn có chắc chắn muốn mời ${nickname} ra khỏi phòng không?`,
      confirmLabel: "Xác nhận Kick",
      danger: true,
      onConfirm: async () => {
        try {
          await axiosClient.post('/rooms/remove-user', null, {
            params: { room_id: roomId, user_id: targetUserId }
          });
          toast.success(`Đã mời ${nickname} ra khỏi phòng`);
          fetchRoomDetail(true);
        } catch (err) {
          toast.error(err.response?.data?.message || "Lỗi khi kick thành viên!");
        }
      }
    });
  };

  const handleDelegateAdmin = async (targetUserId, nickname) => {
    setActiveMenu(null);
    setConfirmDialog({
      title: "Trao quyền quản trị",
      message: `Bạn có chắc chắn muốn trao quyền Chủ Phòng cho ${nickname}? Sau thao tác này bạn sẽ trở thành thành viên thường.`,
      confirmLabel: "Trao Quyền",
      danger: false,
      onConfirm: async () => {
        try {
          await axiosClient.post('/rooms/delegate-admin', null, {
            params: { room_id: roomId, new_admin_id: targetUserId }
          });
          toast.success(`Đã trao quyền chủ phòng cho ${nickname}`);
          fetchRoomDetail(true);
        } catch (err) {
          toast.error(err.response?.data?.message || "Lỗi khi trao quyền!");
        }
      }
    });
  };

  const handleDisbandRoom = () => {
    setConfirmDialog({
      title: "Giải tán phòng trò chuyện",
      message: "CẢNH BÁO: Tất cả thành viên sẽ bị mời ra ngoài và phòng sẽ ngừng hoạt động vĩnh viễn. Bạn có chắc chắn muốn giải tán?",
      confirmLabel: "Giải Tán Ngay",
      danger: true,
      onConfirm: async () => {
        try {
          await axiosClient.delete(`/rooms/disband/${roomId}`);
          toast.success("Đã giải tán phòng chat thành công");
          navigate('/');
        } catch (err) {
          toast.error(err.response?.data?.message || "Lỗi khi giải tán phòng!");
        }
      }
    });
  };

  // Rời phòng (Out nhóm vĩnh viễn)
  const handleLeaveRoom = () => {
    const activeCount = roomInfo?.userRoomDTOList?.length || 0;
    if (isAdminOfThisRoom && activeCount > 1) {
      toast.error("Bạn là chủ phòng. Vui lòng chuyển quyền hoặc giải tán nhóm trước khi rời phòng!", { duration: 4500 });
      return;
    }

    setConfirmDialog({
      title: "Rời khỏi phòng chat",
      message: "Bạn có chắc chắn muốn rời nhóm trò chuyện này không? Bạn sẽ được gỡ khỏi danh sách thành viên.",
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
          toast.error(err.response?.data?.message || "Lỗi khi rời phòng!");
        }
      }
    });
  };

  const currentMember = roomInfo?.userRoomDTOList?.find(
    ur => ur.userDTO?.id?.toString() === currentUserId
  );
  const isAdminOfThisRoom = currentMember?.isAdmin || false;

  return (
    <div 
      className="chat-room-container"
      style={{
        '--chat-bg': activeTheme.bg,
        '--header-bg': activeTheme.headerBg,
        '--sidebar-bg': activeTheme.sidebarBg,
        '--chat-border': activeTheme.border,
        '--my-bubble-bg': activeTheme.myBubbleBg,
        '--my-bubble-text': activeTheme.myBubbleText,
        '--their-bubble-bg': activeTheme.theirBubbleBg,
        '--their-bubble-text': activeTheme.theirBubbleText,
        '--sender-color': activeTheme.senderColor,
        '--theme-accent': activeTheme.accent,
        '--input-bg': activeTheme.inputBg,
      }}
    >
      {/* SIDEBAR DANH SÁCH THÀNH VIÊN */}
      <aside className={`chat-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
           <div className="flex items-center gap-2">
              <TalovinLogo size={24} />
           </div>
           <button onClick={() => setIsSidebarOpen(false)} className="close-sidebar-mobile" title="Đóng">
              <X size={18} />
           </button>
        </div>

        <div className="room-profile-card">
           <GroupCollageAvatar 
             avatar={roomInfo?.avatar} 
             name={roomInfo?.nameroom} 
             members={roomInfo?.userRoomDTOList || []}
             size={52}
           />
           <div className="room-meta">
              <h3>{roomInfo?.nameroom || `Phòng ${roomId}`}</h3>
              <p className="font-mono text-xs text-zinc-400">Mã phòng: {roomId}</p>
           </div>
           {isAdminOfThisRoom && <div className="admin-badge">Chủ phòng</div>}
        </div>

        <div className="sidebar-content">
          <div className="section-title">
             <Users size={14} />
             <span>Thành viên ({roomInfo?.userRoomDTOList?.length || 0})</span>
             {onlineMembers.length > 0 && (
               <span className="online-badge-count">{onlineMembers.length} online</span>
             )}
          </div>
          
          <div className="member-list">
            {onlineMembers.length > 0 && (
              <div className="member-subgroup">
                <div className="member-subgroup-title">Trực tuyến — {onlineMembers.length}</div>
                {onlineMembers.map((ur, idx) => {
                  const memberId = ur.userDTO?.id?.toString();
                  const isMe = memberId === currentUserId;
                  const menuKey = `on-${ur.userDTO?.id || idx}`;
                  return (
                    <div 
                      key={menuKey} 
                      className={`member-item ${isMe ? 'is-me' : ''}`}
                      onClick={() => setSelectedProfileUserId(ur.userDTO?.id)}
                      title="Đang trực tuyến - Nhấp để xem hồ sơ & kết bạn"
                    >
                      <div className="member-avatar">
                         {ur.userDTO?.nickname?.charAt(0).toUpperCase() || "U"}
                         <span className="online-indicator" title="Đang trực tuyến"></span>
                      </div>
                      <div className="member-info">
                         <span className="name">{ur.userDTO?.nickname || "User"}{isMe ? " (Bạn)" : ""}</span>
                         {ur.isAdmin && <Crown size={14} className="crown-icon" title="Chủ phòng" />}
                      </div>
                      
                      {isAdminOfThisRoom && !isMe && (
                        <div className="member-actions" onClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === menuKey ? null : menuKey); }} className="dots-btn">
                             <MoreVertical size={14} />
                          </button>
                          {activeMenu === menuKey && (
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
                  );
                })}
              </div>
            )}

            {offlineMembers.length > 0 && (
              <div className="member-subgroup">
                <div className="member-subgroup-title">Ngoại tuyến — {offlineMembers.length}</div>
                {offlineMembers.map((ur, idx) => {
                  const memberId = ur.userDTO?.id?.toString();
                  const isMe = memberId === currentUserId;
                  const menuKey = `off-${ur.userDTO?.id || idx}`;
                  return (
                    <div 
                      key={menuKey} 
                      className={`member-item is-offline ${isMe ? 'is-me' : ''}`}
                      onClick={() => setSelectedProfileUserId(ur.userDTO?.id)}
                      title="Ngoại tuyến - Nhấp để xem hồ sơ & kết bạn"
                    >
                      <div className="member-avatar">
                         {ur.userDTO?.nickname?.charAt(0).toUpperCase() || "U"}
                         <span className="offline-indicator" title="Ngoại tuyến"></span>
                      </div>
                      <div className="member-info">
                         <span className="name">{ur.userDTO?.nickname || "User"}{isMe ? " (Bạn)" : ""}</span>
                         {ur.isAdmin && <Crown size={14} className="crown-icon" title="Chủ phòng" />}
                      </div>
                      
                      {isAdminOfThisRoom && !isMe && (
                        <div className="member-actions" onClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === menuKey ? null : menuKey); }} className="dots-btn">
                             <MoreVertical size={14} />
                          </button>
                          {activeMenu === menuKey && (
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
                  );
                })}
              </div>
            )}
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

           <button 
             onClick={() => navigate('/')} 
             className="back-home-footer-btn"
             title="Tạm thời quay về Trang chủ / Sảnh (Vẫn giữ tư cách thành viên)"
           >
              <ArrowLeft size={16} />
              <span>Quay về Sảnh</span>
           </button>

           {isAdminOfThisRoom && (
             <button onClick={handleDisbandRoom} className="disband-btn">
                <Trash2 size={16} />
                <span>Giải tán nhóm</span>
             </button>
           )}
           <button onClick={handleLeaveRoom} className="leave-btn" title="Rời khỏi phòng trò chuyện này">
              <LogOut size={16} />
              <span>Rời phòng</span>
           </button>
        </div>
      </aside>

      {/* KHU VỰC CHAT CHÍNH (MAIN CHAT AREA) */}
      <main className="chat-main">
        {isOffline && (
          <div className="offline-top-banner">
            <WifiOff size={15} />
            <span>Chế độ Ngoại tuyến: Đang xem các tin nhắn đã lưu trên thiết bị</span>
          </div>
        )}

        {/* THANH ĐIỀU KHIỂN CUỘC GỌI ĐANG HOẠT ĐỘNG */}
        {isCallActive && (
          <div className="active-call-bar">
            <div className="call-info">
              <div className="pulsing-mic">
                {isVideoCall ? <Video size={16} /> : <Phone size={16} />}
              </div>
              <div className="call-text">
                <span className="call-title">
                  {privateCallTarget 
                    ? `Đang đàm thoại với ${privateCallTarget.nickname || 'người dùng'}` 
                    : (isVideoCall ? "Cuộc gọi Video nhóm đang phát" : "Cuộc gọi thoại nhóm đang phát")}
                </span>
                <span className="call-timer font-mono">
                  {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            <div className="call-controls">
              <button 
                onClick={toggleMute} 
                className={`btn-call-action ${isMuted ? 'muted' : ''}`}
                title={isMuted ? "Bật micro" : "Tắt micro"}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              {isVideoCall && (
                <button 
                  onClick={toggleVideo} 
                  className={`btn-call-action ${!isVideoEnabled ? 'muted' : ''}`}
                  title={isVideoEnabled ? "Tắt camera" : "Bật camera"}
                >
                  {isVideoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                </button>
              )}

              <button onClick={endCall} className="btn-call-action btn-end-call" title="Kết thúc cuộc gọi">
                <PhoneOff size={16} />
              </button>
            </div>
          </div>
        )}

        {/* HEADER PHÒNG CHAT - TỐI ƯU CỰC MẠNH CHO MOBILE */}
        <header className="chat-header">
           <div className="header-left">
              {/* Nút Quay về Sảnh / Trang chủ rõ ràng cho cả Mobile & Desktop */}
              <button 
                onClick={() => navigate('/')} 
                className="header-back-home-btn" 
                title="Quay lại Trang chủ / Sảnh"
              >
                 <ArrowLeft size={18} />
                 <span className="back-text">Sảnh</span>
              </button>

              <button onClick={() => setIsSidebarOpen(true)} className="mobile-toggle-btn" title="Mở danh sách thành viên">
                 <Menu size={18} />
              </button>

              <div className="header-info">
                 <GroupCollageAvatar 
                   avatar={roomInfo?.avatar} 
                   name={roomInfo?.nameroom} 
                   members={roomInfo?.userRoomDTOList || []}
                   size={32}
                 />
                 <div className="flex flex-col leading-tight min-w-0">
                   <h2 className="room-title-text">{roomInfo?.nameroom || `Phòng ${roomId}`}</h2>
                   <span className="header-room-id font-mono">#{roomId} • {onlineMembers.length} trực tuyến</span>
                 </div>
              </div>
           </div>
           
           <div className="header-actions">
              {/* Nút Đổi Chủ Đề Màu Sắc */}
              <button 
                onClick={() => setIsThemeModalOpen(true)}
                className="header-icon-btn"
                title="Đổi chủ đề màu sắc phòng chat"
              >
                <Palette size={16} />
              </button>

              {/* Nút Bạn Bè */}
              <button 
                onClick={() => setIsFriendsModalOpen(true)}
                className="header-friends-btn"
                title="Xem danh sách bạn bè & lời mời"
              >
                <Users size={16} />
                <span className="btn-label">Bạn bè</span>
              </button>

              {/* Nút Gọi Thoại Nhóm */}
              <button 
                onClick={startGroupVoiceCall} 
                disabled={isCallActive}
                className={`header-call-btn ${isCallActive && !isVideoCall ? 'in-call' : ''}`} 
                title="Gọi thoại nhóm"
              >
                 <Phone size={15} />
                 <span className="btn-label">{isCallActive && !isVideoCall ? 'Đang gọi' : 'Gọi thoại'}</span>
              </button>

              {/* Nút Gọi Video Nhóm */}
              <button 
                onClick={startGroupVideoCall} 
                disabled={isCallActive}
                className={`header-videocall-btn ${isCallActive && isVideoCall ? 'in-call' : ''}`} 
                title="Gọi Video nhóm"
              >
                 <Video size={15} />
                 <span className="btn-label">{isCallActive && isVideoCall ? 'Đang gọi' : 'Video'}</span>
              </button>

              {/* Nút Xem Thành Viên */}
              <button onClick={() => setIsSidebarOpen(true)} className="members-indicator-btn" title="Danh sách thành viên">
                 <Users size={14} />
                 <span className="members-count-pill">{roomInfo?.userRoomDTOList?.length || 0}</span>
              </button>
           </div>
        </header>

        {/* VIDEO CALL FLOATING OVERLAY GRID */}
        {isCallActive && isVideoCall && (
          <div className="video-call-overlay-card">
            <div className="video-streams-grid">
              <div className="remote-video-frame">
                <video ref={remoteVideoRef} autoPlay playsInline className="video-player-elem" />
                <div className="video-user-tag">Đối phương / Nhóm</div>
              </div>

              <div className="local-video-pip">
                <video ref={localVideoRef} autoPlay playsInline muted className="video-player-elem mirror" />
                <div className="video-user-tag">Bạn</div>
              </div>
            </div>
          </div>
        )}

        {/* KHU VỰC TIN NHẮN (MESSAGES AREA) */}
        <div className="messages-area" ref={messagesContainerRef} onScroll={handleScrollMessages}>
          <div className="messages-list">
            {isLoadingOlder && (
              <div className="py-2 flex items-center justify-center gap-2 text-zinc-400 text-xs font-mono">
                <RefreshCw size={13} className="animate-spin" />
                <span>Đang tải tin nhắn cũ hơn...</span>
              </div>
            )}

            {messages.length === 0 && !loading && (
              <div className="welcome-banner">
                <div className="welcome-icon">
                  <MessageCircle size={28} />
                </div>
                <h3>Chào mừng đến với {roomInfo?.nameroom || 'phòng trò chuyện'}</h3>
                <p>
                  Đây là điểm khởi đầu của cuộc trò chuyện trong không gian {roomInfo?.nameroom || `phòng ${roomId}`}. Nhấp vào avatar để xem thông tin cá nhân và kết bạn!
                </p>
                <div className="welcome-divider" />
              </div>
            )}

            {messages.map((msg, index) => {
              const isMe = msg.userId?.toString() === currentUserId;
              const isSystem = msg.userId === '0' || msg.userId === 0 || msg.isSystem;
              const payload = parseMessagePayload(msg.text);

              // 1. Render Tin nhắn kết thúc cuộc gọi
              if (payload.type === 'call_ended') {
                return (
                  <div key={msg.id || index} className="call-ended-system-row">
                    <div className="call-ended-pill">
                      <PhoneOff size={13} className="text-zinc-400" />
                      <span>Cuộc gọi {payload.isVideo ? 'Video' : 'thoại'} đã kết thúc • Thời lượng <strong>{payload.duration}</strong></span>
                    </div>
                  </div>
                );
              }

              // 2. Render Tin nhắn hệ thống thông thường
              if (isSystem) {
                return (
                  <div key={msg.id || index} className="system-msg">
                    <span>{payload.text || msg.text}</span>
                  </div>
                );
              }

              // 3. Render Tin nhắn người dùng
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
                      {/* 3.1: Tin nhắn Hình ảnh */}
                      {payload.type === 'image' && (
                        <div className="msg-media-block">
                          <img 
                            src={payload.url} 
                            alt="Ảnh đính kèm" 
                            className="msg-img-preview" 
                            onClick={() => setPreviewImageModal(payload.url)}
                          />
                          {payload.caption && <p className="msg-media-caption">{payload.caption}</p>}
                        </div>
                      )}

                      {/* 3.2: Tin nhắn Ghi âm Voice Note */}
                      {payload.type === 'voice' && (
                        <div className="msg-voice-note-block">
                          <button 
                            type="button" 
                            onClick={() => togglePlayAudio(msg.id, payload.audioUrl)}
                            className="btn-play-voice-note"
                          >
                            {playingAudioId === msg.id ? <Pause size={15} /> : <Play size={15} />}
                          </button>
                          <div className="voice-wave-bars">
                            <span className="wave-bar"></span>
                            <span className="wave-bar h-3"></span>
                            <span className="wave-bar h-5"></span>
                            <span className="wave-bar h-2"></span>
                            <span className="wave-bar h-4"></span>
                          </div>
                          <span className="voice-duration font-mono text-[11px]">
                            {payload.duration ? `${payload.duration}s` : 'Voice'}
                          </span>
                        </div>
                      )}

                      {/* 3.3: Tin nhắn Chia sẻ Bài Viết từ Sảnh */}
                      {payload.type === 'shared_post' && (
                        <div className="msg-shared-post-block" onClick={() => navigate(`/#post-${payload.postId}`)}>
                          <div className="shared-post-header">
                            <Share2 size={12} className="text-indigo-400" />
                            <span>Bài viết được chia sẻ bởi <strong>{payload.author}</strong></span>
                          </div>
                          {payload.imageUrl && (
                            <img src={payload.imageUrl} alt="Post media" className="shared-post-thumbnail" />
                          )}
                          <p className="shared-post-text">{payload.content}</p>
                          <div className="shared-post-footer">
                            <span>Nhấp để xem bài viết trên Sảnh</span>
                            <ExternalLink size={11} />
                          </div>
                        </div>
                      )}

                      {/* 3.4: Tin nhắn Văn bản bình thường */}
                      {payload.type === 'text' && (
                        <p className="msg-text">{payload.text}</p>
                      )}

                      <span className="msg-time">{msg.time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* EMOJI BAR NHANH */}
          {showEmojiPicker && (
            <div className="chat-emoji-drawer animate-fade-in">
              <div className="emoji-list-row">
                {COMMON_EMOJIS.map((emoji) => (
                  <button 
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setNewMessage(prev => prev + emoji);
                    }}
                    className="btn-emoji-item"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* KHUNG SOẠN TIN NHẮN TÍCH HỢP ĐA PHƯƠNG TIỆN */}
          <div className="input-container">
            {/* Input file hình ảnh ẩn */}
            <input 
              type="file" 
              ref={fileImageRef} 
              accept="image/*" 
              onChange={handleImageSelect} 
              style={{ display: 'none' }} 
            />

            {/* Trạng thái đang thu âm trực tiếp */}
            {isRecordingVoice ? (
              <div className="voice-recording-active-bar animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="voice-recording-pulse"></span>
                  <span className="text-xs font-mono font-bold text-red-400">
                    Đang ghi âm: {voiceDuration}s / 15s
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={cancelVoiceRecording} 
                    className="btn-cancel-recording"
                    title="Hủy ghi âm"
                  >
                    <X size={15} />
                    <span>Hủy</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={stopVoiceRecording} 
                    className="btn-finish-recording"
                    title="Gửi đoạn ghi âm"
                  >
                    <Send size={14} />
                    <span>Gửi</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="msg-form">
                <div className="chat-input-actions-left">
                  {/* Nút gửi ảnh */}
                  <button 
                    type="button" 
                    onClick={() => fileImageRef.current?.click()} 
                    className="btn-input-addon"
                    title="Gửi hình ảnh"
                  >
                    <ImageIcon size={18} />
                  </button>

                  {/* Nút ghi âm giọng nói */}
                  <button 
                    type="button" 
                    onClick={startVoiceRecording} 
                    className="btn-input-addon"
                    title="Ghi âm giọng nói 15s"
                  >
                    <Mic size={18} />
                  </button>

                  {/* Nút emoji */}
                  <button 
                    type="button" 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                    className={`btn-input-addon ${showEmojiPicker ? 'active' : ''}`}
                    title="Biểu tượng cảm xúc"
                  >
                    <Smile size={18} />
                  </button>
                </div>

                <input 
                  type="text" 
                  placeholder={isOffline ? "Đang ngoại tuyến, chỉ xem lịch sử..." : `Nhắn tin trong #${roomInfo?.nameroom || 'phòng'}...`}
                  value={newMessage}
                  disabled={isOffline}
                  onChange={(e) => setNewMessage(e.target.value)}
                />

                <button 
                  type="submit" 
                  disabled={!newMessage.trim() || isOffline} 
                  className="send-btn" 
                  title="Gửi tin nhắn"
                >
                  <Send size={18} />
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* MODAL ĐỔI CHỦ ĐỀ MÀU SẮC PHÒNG CHAT */}
      {isThemeModalOpen && (
        <div className="modal-backdrop-theme" onClick={() => setIsThemeModalOpen(false)}>
          <div className="modal-card-theme" onClick={(e) => e.stopPropagation()}>
            <div className="theme-modal-header">
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-zinc-300" />
                <h3 className="text-sm font-bold text-zinc-100">Chủ Đề Giao Diện Đoạn Chat</h3>
              </div>
              <button onClick={() => setIsThemeModalOpen(false)} className="btn-close-theme"><X size={16} /></button>
            </div>
            <p className="text-xs text-zinc-400 px-5 pt-1">
              Chọn phong cách hiển thị màu sắc phòng chat theo sở thích của bạn:
            </p>
            <div className="theme-grid px-5 py-4">
              {CHAT_THEMES.map((theme) => {
                const isSelected = theme.id === currentThemeId;
                return (
                  <div 
                    key={theme.id}
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`theme-card-option ${isSelected ? 'selected' : ''}`}
                    style={{ borderColor: isSelected ? theme.accent : undefined }}
                  >
                    <div className="theme-preview-palette" style={{ background: theme.bg }}>
                      <div className="palette-bubble my-b" style={{ background: theme.myBubbleBg }}></div>
                      <div className="palette-bubble their-b" style={{ background: theme.theirBubbleBg }}></div>
                    </div>
                    <div className="theme-meta-text">
                      <span className="theme-title">{theme.name}</span>
                      <span className="theme-tag font-mono">{theme.tag}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM HÌNH ẢNH FULL SIZE */}
      {previewImageModal && (
        <div className="image-lightbox-overlay" onClick={() => setPreviewImageModal(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImageModal(null)} className="btn-close-lightbox"><X size={20} /></button>
            <img src={previewImageModal} alt="Phóng to" className="lightbox-img" />
          </div>
        </div>
      )}

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

      {/* Modal Cuộc Gọi Đến (Incoming Call Alert) */}
      {incomingCall && !isCallActive && (
        <div className="incoming-call-overlay">
          <div className="incoming-call-card">
            <div className="incoming-phone-pulse">
              {incomingCall.isVideo ? <Video size={24} className="ring-animate" /> : <Phone size={24} className="ring-animate" />}
            </div>
            <h3>{incomingCall.isPrivate ? "Cuộc gọi riêng 1-1" : (incomingCall.isVideo ? "Cuộc gọi Video nhóm" : "Cuộc gọi thoại nhóm")}</h3>
            <p>
              <strong>{incomingCall.callerName}</strong> {incomingCall.isPrivate ? "đang gọi riêng cho bạn" : `đang bắt đầu cuộc gọi trong phòng #${roomInfo?.nameroom || roomId}`}
            </p>
            <div className="incoming-actions">
              <button onClick={rejectCall} className="btn-reject-call">
                <PhoneOff size={18} />
                <span>Từ chối</span>
              </button>
              <button onClick={answerCall} className="btn-answer-call">
                {incomingCall.isVideo ? <Video size={18} /> : <Phone size={18} />}
                <span>{incomingCall.isVideo ? "Mở Video" : "Nghe máy"}</span>
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
                  if (action) action();
                }} 
                className={`btn-confirm-ok ${confirmDialog.danger ? 'btn-danger' : 'btn-primary'}`}
              >
                {confirmDialog.confirmLabel || "Đồng ý"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOÀN BỘ CSS STYLING CHUẨN ĐỒNG BỘ DARK ZINC OBSIDIAN & MOBILE FIRST */}
      <style>{`
        .chat-room-container {
          display: flex;
          height: 100vh;
          height: 100dvh;
          width: 100%;
          background: var(--chat-bg);
          color: #f4f4f5;
          overflow: hidden;
          position: relative;
          font-family: inherit;
        }

        /* Sidebar */
        .chat-sidebar {
          width: 270px;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--chat-border);
          display: flex;
          flex-direction: column;
          z-index: 40;
          transition: transform 0.25s ease-in-out;
        }
        .sidebar-header {
          height: 56px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--chat-border);
        }
        .close-sidebar-mobile {
          display: none;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        }
        .room-profile-card {
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          border-bottom: 1px solid var(--chat-border);
          background: rgba(255, 255, 255, 0.02);
        }
        .room-meta h3 {
          margin: 8px 0 2px 0;
          font-size: 15px;
          font-weight: 700;
          color: #f8fafc;
        }
        .admin-badge {
          margin-top: 6px;
          padding: 2px 8px;
          border-radius: 12px;
          background: rgba(234, 179, 8, 0.15);
          color: #eab308;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px 14px;
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 10px;
          letter-spacing: 0.05em;
        }
        .member-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .member-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 10px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s;
          position: relative;
        }
        .member-item:hover { background: rgba(255, 255, 255, 0.05); }
        .member-item.is-me { background: rgba(255, 255, 255, 0.03); }
        .member-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #3f3f46;
          color: #fff;
          font-weight: 700;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .online-indicator {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          border: 1.5px solid #18181b;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
        }
        .offline-indicator {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #52525b;
          border: 1.5px solid #18181b;
        }
        .member-item.is-offline {
          opacity: 0.6;
        }
        .member-item.is-offline:hover {
          opacity: 0.95;
        }
        .member-subgroup {
          margin-bottom: 12px;
        }
        .member-subgroup-title {
          font-size: 10px;
          font-weight: 700;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 6px 10px 4px 10px;
        }
        .online-badge-count {
          margin-left: auto;
          font-size: 11px;
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          padding: 1px 7px;
          border-radius: 9999px;
          font-weight: 600;
        }
        .member-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 6px;
          overflow: hidden;
        }
        .member-info .name {
          font-size: 13px;
          font-weight: 500;
          color: #e2e8f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .crown-icon { color: #f59e0b; flex-shrink: 0; }
        .dots-btn {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }
        .dots-btn:hover { color: #f8fafc; background: rgba(255, 255, 255, 0.08); }
        .member-dropdown {
          position: absolute;
          top: 36px;
          right: 10px;
          background: #1e293b;
          border: 1px solid var(--chat-border);
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          z-index: 50;
          min-width: 140px;
        }
        .action-item {
          display: flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: none;
          color: #cbd5e1;
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
        }
        .action-item:hover { background: rgba(255, 255, 255, 0.08); color: white; }
        .action-item.kick-item { color: #f87171; }
        .action-item.kick-item:hover { background: rgba(239, 68, 68, 0.15); color: #f87171; }

        .sidebar-footer {
          padding: 12px 14px;
          border-top: 1px solid var(--chat-border);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .my-profile-btn, .back-home-footer-btn, .disband-btn, .leave-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
        }
        .my-profile-btn {
          background: rgba(255, 255, 255, 0.04);
          color: #cbd5e1;
          border: 1px solid var(--chat-border);
        }
        .my-profile-btn:hover { background: rgba(255, 255, 255, 0.08); color: white; }
        
        .back-home-footer-btn {
          background: rgba(99, 102, 241, 0.1);
          color: #818cf8;
          border: 1px solid rgba(99, 102, 241, 0.25);
        }
        .back-home-footer-btn:hover { background: #6366f1; color: white; }

        .disband-btn {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid #ef4444;
          color: #f87171;
        }
        .disband-btn:hover { background: #ef4444; color: white; }
        
        .leave-btn {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--chat-border);
          color: #94a3b8;
        }
        .leave-btn:hover { background: #ef4444; color: white; border-color: #ef4444; }

        /* Main Chat Area */
        .chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--chat-bg);
          position: relative;
          overflow: hidden;
          height: 100%;
          min-width: 0;
        }

        /* HEADER PHÒNG CHAT */
        .chat-header {
          height: 56px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--header-bg);
          border-bottom: 1px solid var(--chat-border);
          box-sizing: border-box;
          flex-shrink: 0;
          gap: 8px;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
          min-width: 0;
        }
        .header-back-home-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--chat-border);
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .header-back-home-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }
        .mobile-toggle-btn {
          display: none;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--chat-border);
          color: #94a3b8;
          padding: 6px;
          border-radius: 8px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .header-info {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
          min-width: 0;
        }
        .room-title-text {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .header-room-id {
          font-size: 10px;
          color: #a1a1aa;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .header-icon-btn, .header-friends-btn, .header-call-btn, .header-videocall-btn, .members-indicator-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border: 1px solid var(--chat-border);
          background: rgba(255, 255, 255, 0.04);
          color: #cbd5e1;
        }
        .header-icon-btn:hover, .header-friends-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }
        .header-call-btn {
          background: rgba(16, 185, 129, 0.12);
          border-color: rgba(16, 185, 129, 0.3);
          color: #34d399;
        }
        .header-call-btn:hover { background: #10b981; color: white; }
        .header-call-btn.in-call { background: #10b981; color: white; }

        .header-videocall-btn {
          background: rgba(99, 102, 241, 0.12);
          border-color: rgba(99, 102, 241, 0.3);
          color: #818cf8;
        }
        .header-videocall-btn:hover { background: #6366f1; color: white; }
        .header-videocall-btn.in-call { background: #6366f1; color: white; }

        .members-count-pill {
          padding: 1px 6px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.08);
          font-size: 11px;
        }

        /* Banner Active Call */
        .active-call-bar {
          background: linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(99, 102, 241, 0.15));
          border-bottom: 1px solid rgba(16, 185, 129, 0.3);
          padding: 8px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .call-info { display: flex; align-items: center; gap: 10px; }
        .pulsing-mic {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #10b981;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .call-text { display: flex; flex-direction: column; }
        .call-title { font-size: 12px; font-weight: 600; color: #f8fafc; }
        .call-timer { font-size: 11px; color: #34d399; }
        .call-controls { display: flex; gap: 8px; }
        .btn-call-action {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .btn-call-action.muted { background: #eab308; }
        .btn-end-call { background: #ef4444 !important; }

        /* Video Call Overlay */
        .video-call-overlay-card {
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.4);
          border-bottom: 1px solid var(--chat-border);
        }
        .video-streams-grid {
          display: flex;
          gap: 10px;
          position: relative;
          max-height: 220px;
        }
        .remote-video-frame {
          flex: 1;
          height: 200px;
          background: #18181b;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          border: 1px solid var(--chat-border);
        }
        .local-video-pip {
          width: 140px;
          height: 105px;
          background: #27272a;
          border-radius: 10px;
          overflow: hidden;
          position: absolute;
          bottom: 10px;
          right: 10px;
          border: 2px solid #3f3f46;
          box-shadow: 0 8px 20px rgba(0,0,0,0.6);
        }
        .video-player-elem {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .video-player-elem.mirror {
          transform: scaleX(-1);
        }
        .video-user-tag {
          position: absolute;
          bottom: 4px;
          left: 6px;
          background: rgba(0,0,0,0.6);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          color: white;
          font-weight: 600;
        }

        /* Khu vực hiển thị tin nhắn */
        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overscroll-behavior-y: contain;
          -webkit-overflow-scrolling: touch;
        }
        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: auto;
        }

        /* Call Ended Pill */
        .call-ended-system-row {
          display: flex;
          justify-content: center;
          margin: 6px 0;
        }
        .call-ended-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--chat-border);
          color: #a1a1aa;
          font-size: 11px;
        }

        .system-msg {
          align-self: center;
          background: rgba(255, 255, 255, 0.04);
          color: #94a3b8;
          font-size: 11px;
          padding: 4px 12px;
          border-radius: 12px;
          max-width: 80%;
          text-align: center;
        }

        .msg-group {
          display: flex;
          gap: 8px;
          max-width: 80%;
        }
        .msg-me {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        .msg-them {
          align-self: flex-start;
        }

        .msg-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--theme-accent);
          color: white;
          font-weight: 700;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          cursor: pointer;
        }

        .msg-content-wrapper {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .msg-sender {
          font-size: 11px;
          font-weight: 600;
          color: var(--sender-color);
          margin-bottom: 2px;
          cursor: pointer;
        }
        .msg-sender:hover { text-decoration: underline; }

        .msg-bubble {
          padding: 8px 12px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.45;
          word-break: break-word;
          position: relative;
        }
        .msg-me .msg-bubble {
          background: var(--my-bubble-bg);
          color: var(--my-bubble-text);
          border-bottom-right-radius: 3px;
        }
        .msg-them .msg-bubble {
          background: var(--their-bubble-bg);
          color: var(--their-bubble-text);
          border-bottom-left-radius: 3px;
          border: 1px solid var(--chat-border);
        }

        .msg-time {
          display: block;
          font-size: 9px;
          color: #71717a;
          text-align: right;
          margin-top: 3px;
          font-family: monospace;
        }

        /* Đa phương tiện trong bong bóng chat */
        .msg-img-preview {
          max-width: 240px;
          max-height: 220px;
          border-radius: 10px;
          object-fit: cover;
          cursor: pointer;
          transition: transform 0.15s;
        }
        .msg-img-preview:hover { transform: scale(1.02); }
        .msg-media-caption {
          margin-top: 4px;
          font-size: 12px;
        }

        .msg-voice-note-block {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 140px;
        }
        .btn-play-voice-note {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #ffffff;
          color: #000000;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .voice-wave-bars {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .wave-bar {
          width: 3px;
          height: 10px;
          border-radius: 2px;
          background: #a1a1aa;
        }

        .msg-shared-post-block {
          padding: 8px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.08);
          cursor: pointer;
          max-width: 280px;
        }
        .shared-post-header {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10.5px;
          color: #a1a1aa;
          margin-bottom: 4px;
        }
        .shared-post-thumbnail {
          width: 100%;
          max-height: 120px;
          object-fit: cover;
          border-radius: 6px;
          margin-bottom: 4px;
        }
        .shared-post-text {
          font-size: 11.5px;
          color: #e4e4e7;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .shared-post-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 9.5px;
          color: #818cf8;
          margin-top: 4px;
        }

        /* Emoji Drawer */
        .chat-emoji-drawer {
          padding: 6px 12px;
          background: var(--input-bg);
          border-top: 1px solid var(--chat-border);
        }
        .emoji-list-row {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
        }
        .btn-emoji-item {
          font-size: 18px;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: transform 0.1s;
        }
        .btn-emoji-item:hover { transform: scale(1.2); }

        /* Khung soạn tin nhắn */
        .input-container {
          padding: 10px 14px max(10px, env(safe-area-inset-bottom));
          background: var(--input-bg);
          border-top: 1px solid var(--chat-border);
        }
        .msg-form {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--chat-border);
          border-radius: 12px;
          padding: 4px 6px 4px 10px;
        }
        .chat-input-actions-left {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .btn-input-addon {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          padding: 6px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s;
        }
        .btn-input-addon:hover { color: #f4f4f5; }
        .btn-input-addon.active { color: #818cf8; }

        .msg-form input {
          flex: 1;
          background: transparent;
          border: none;
          color: #f8fafc;
          font-size: 13px;
          outline: none;
          padding: 6px 4px;
        }
        .send-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #ffffff;
          border: none;
          color: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .send-btn:hover:not(:disabled) { background: #e4e4e7; transform: scale(1.05); }
        .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        /* Voice Recording Active Bar */
        .voice-recording-active-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .voice-recording-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          animation: pulse 1s infinite;
        }
        .btn-cancel-recording, .btn-finish-recording {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }
        .btn-cancel-recording { background: #27272a; color: #a1a1aa; }
        .btn-finish-recording { background: #ef4444; color: white; }

        /* Modal Themes */
        .modal-backdrop-theme {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 16px;
        }
        .modal-card-theme {
          width: 100%;
          max-width: 440px;
          background: #121215;
          border: 1px solid #27272a;
          border-radius: 20px;
          overflow: hidden;
        }
        .theme-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #27272a;
        }
        .btn-close-theme {
          background: transparent;
          border: none;
          color: #a1a1aa;
          cursor: pointer;
        }
        .theme-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .theme-card-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid #27272a;
          cursor: pointer;
          transition: all 0.15s;
        }
        .theme-card-option:hover { background: rgba(255, 255, 255, 0.06); }
        .theme-card-option.selected {
          border-width: 1.5px;
          background: rgba(255, 255, 255, 0.08);
        }
        .theme-preview-palette {
          width: 48px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .palette-bubble { width: 14px; height: 14px; border-radius: 4px; }
        .theme-meta-text { display: flex; flex-direction: column; }
        .theme-title { font-size: 12.5px; font-weight: 700; color: #f4f4f5; }
        .theme-tag { font-size: 10px; color: #a1a1aa; }

        /* Lightbox Image */
        .image-lightbox-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 120;
          padding: 16px;
        }
        .lightbox-content { position: relative; max-width: 90vw; max-height: 90vh; }
        .lightbox-img { max-width: 100%; max-height: 85vh; border-radius: 12px; object-fit: contain; }
        .btn-close-lightbox {
          position: absolute;
          top: -36px;
          right: 0;
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
        }

        /* Confirmation Modal */
        .confirm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }
        .confirm-box {
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 16px;
          padding: 24px;
          max-width: 380px;
          width: 100%;
          text-align: center;
        }
        .confirm-icon-badge {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px auto;
        }
        .confirm-title { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 6px; }
        .confirm-message { font-size: 12px; color: #a1a1aa; line-height: 1.45; margin-bottom: 18px; }
        .confirm-actions { display: flex; gap: 8px; justify-content: center; }
        .btn-confirm-cancel, .btn-confirm-ok {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }
        .btn-confirm-cancel { background: #27272a; color: #a1a1aa; }
        .btn-confirm-ok.btn-primary { background: #ffffff; color: #000000; }
        .btn-confirm-ok.btn-danger { background: #ef4444; color: #ffffff; }

        /* Incoming Call */
        .incoming-call-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          padding: 16px;
        }
        .incoming-call-card {
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 20px;
          padding: 28px 24px;
          max-width: 360px;
          width: 100%;
          text-align: center;
        }
        .incoming-phone-pulse {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: #10b981;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px auto;
          animation: pulse 1.5s infinite;
        }
        .ring-animate { animation: ring 0.5s infinite alternate; }
        @keyframes ring {
          0% { transform: rotate(-15deg); }
          100% { transform: rotate(15deg); }
        }
        .incoming-actions { display: flex; gap: 12px; justify-content: center; margin-top: 18px; }
        .btn-reject-call, .btn-answer-call {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: none;
        }
        .btn-reject-call { background: #ef4444; color: white; }
        .btn-answer-call { background: #10b981; color: white; }

        /* ================= TỐI ƯU HÓA MOBILE TOÀN DIỆN (< 768px) ================= */
        @media (max-width: 768px) {
          .chat-sidebar {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 85%;
            max-width: 320px;
            box-shadow: 10px 0 30px rgba(0,0,0,0.7);
            transform: translateX(-100%);
          }
          .chat-sidebar.open {
            transform: translateX(0);
          }
          .close-sidebar-mobile { display: flex; }
          .mobile-toggle-btn { display: flex; }

          /* Header gọn gàng tuyệt đối trên Mobile */
          .chat-header {
            padding: 0 10px;
            height: 52px;
          }
          .header-back-home-btn .back-text {
            display: none;
          }
          .header-back-home-btn {
            padding: 6px;
          }
          .header-left {
            gap: 6px;
            max-width: 50%;
          }
          .room-title-text {
            font-size: 13px;
            max-width: 90px;
          }
          
          /* Ẩn chữ trong các nút hành động, chỉ giữ lại icon */
          .header-actions {
            gap: 4px;
          }
          .header-friends-btn .btn-label,
          .header-call-btn .btn-label,
          .header-videocall-btn .btn-label {
            display: none !important;
          }
          .header-icon-btn, .header-friends-btn, .header-call-btn, .header-videocall-btn {
            padding: 6px 8px;
          }
          .members-indicator-btn {
            padding: 6px 8px;
          }

          .messages-area {
            padding: 10px 10px;
          }
          .msg-group {
            max-width: 90%;
          }
          .chat-input-actions-left {
            gap: 0px;
          }
          .btn-input-addon {
            padding: 4px;
          }
        }
      `}</style>
    </div>
  );
};

export default ChatRoom;
