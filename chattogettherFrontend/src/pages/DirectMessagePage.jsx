import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, MessageSquare, Phone, PhoneOff, Video, VideoOff, 
  Mic, MicOff, Send, Image as ImageIcon, Smile, MoreVertical, User, 
  Clock, CheckCircle2, ChevronDown, Volume2, Shield, Share2, Sparkles
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import { UserAvatar } from './Home';
import TalovinLogo from '../components/TalovinLogo';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export const DirectMessagePage = () => {
  const { userId: urlTargetUserId } = useParams();
  const navigate = useNavigate();

  const currentUserId = localStorage.getItem('user_id');
  const currentUserName = localStorage.getItem('nickname') || localStorage.getItem('account') || 'Bạn';

  // Danh sách bạn bè / hội thoại
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Hội thoại đang chọn
  const [activePartner, setActivePartner] = useState(null);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);

  // Cuộc gọi thoại / video WebRTC 1-1
  const [isCallActive, setIsCallActive] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallScreenOpen, setIsCallScreenOpen] = useState(false);
  const [callStatusText, setCallStatusText] = useState('Đang kết nối...');
  const [incomingCall, setIncomingCall] = useState(null);

  // Refs
  const stompClient = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimerRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollContainerRef.current) {
      if (smooth) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }
  }, []);

  // 1. Tải danh sách bạn bè
  useEffect(() => {
    const fetchFriends = async () => {
      try {
        setLoadingFriends(true);
        const res = await axiosClient.get('/friends/list');
        if (res?.data?.data) {
          setFriends(res.data.data);
        }
      } catch (e) {
        console.error('Lỗi nạp danh sách bạn bè:', e);
      } finally {
        setLoadingFriends(false);
      }
    };
    fetchFriends();
  }, []);

  // 2. Mở hoặc tạo đoạn chat khi có urlTargetUserId
  const openDirectChat = useCallback(async (targetId, fallbackPartner = null) => {
    if (!targetId || targetId.toString() === currentUserId?.toString()) return;
    try {
      setLoadingMessages(true);
      const res = await axiosClient.get(`/message/direct/${targetId}`);
      if (res?.data?.data) {
        const { roomId, targetUser } = res.data.data;
        setActiveRoomId(roomId);
        setActivePartner(targetUser || fallbackPartner);

        // Nạp lịch sử tin nhắn của phòng DM này
        const histRes = await axiosClient.get(`/message/${roomId}`);
        if (histRes?.data?.data) {
          setMessages(histRes.data.data);
          setTimeout(() => scrollToBottom(false), 80);
        }
      }
    } catch (e) {
      console.error('Lỗi mở chat 1-1:', e);
      toast.error('Không thể kết nối cuộc trò chuyện riêng tư');
    } finally {
      setLoadingMessages(false);
    }
  }, [currentUserId, scrollToBottom]);

  // Kích hoạt khi URL param thay đổi
  useEffect(() => {
    if (urlTargetUserId) {
      const foundInFriends = friends.find(f => f.id?.toString() === urlTargetUserId?.toString());
      openDirectChat(urlTargetUserId, foundInFriends);
    }
  }, [urlTargetUserId, friends, openDirectChat]);

  // 3. Kết nối WebSocket
  useEffect(() => {
    let client = null;
    const token = localStorage.getItem('accesstoken');

    try {
      const socket = new SockJS('https://backend-936647963286.asia-southeast1.run.app/ws-gs-guide');
      client = Stomp.over(socket);
      client.debug = () => {};

      client.connect({ Authorization: `Bearer ${token}` }, () => {
        stompClient.current = client;

        // Nhận tín hiệu cuộc gọi đến cá nhân
        if (currentUserId) {
          client.subscribe(`/topic/call/user/${currentUserId}`, (message) => {
            try {
              handleCallSignal(JSON.parse(message.body));
            } catch (e) {}
          });
        }

        // Nhận tin nhắn trong phòng DM đang chọn
        if (activeRoomId) {
          client.subscribe(`/topic/room/${activeRoomId}`, (message) => {
            try {
              const newMsg = JSON.parse(message.body);
              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              setTimeout(() => scrollToBottom(true), 60);
            } catch (e) {}
          });
        }
      });
    } catch (e) {
      console.error('Lỗi kết nối WebSocket tin nhắn riêng:', e);
    }

    return () => {
      if (client && client.connected) {
        client.disconnect();
      }
    };
  }, [currentUserId, activeRoomId, scrollToBottom]);

  // 4. Gửi tin nhắn 1-1
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || !activeRoomId || sending) return;

    const content = textInput.trim();
    setTextInput('');
    setSending(true);

    try {
      await axiosClient.post('/message/send', {
        message: content,
        timeSend: new Date().toISOString()
      }, {
        params: { user_room: activeRoomId }
      });
      setTimeout(() => scrollToBottom(true), 60);
    } catch (err) {
      toast.error('Không thể gửi tin nhắn');
      setTextInput(content);
    } finally {
      setSending(false);
    }
  };

  // 5. WebRTC Call Signals
  const sendCallSignal = useCallback((data) => {
    if (stompClient.current && stompClient.current.connected && activePartner?.id) {
      stompClient.current.send(`/app/call/user/${activePartner.id}`, {}, JSON.stringify({
        ...data,
        callerId: currentUserId,
        callerName: currentUserName,
        roomId: activeRoomId,
        isVideo: isVideoCall
      }));
    }
  }, [activePartner, currentUserId, currentUserName, activeRoomId, isVideoCall]);

  const cleanupCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    setIsCallActive(false);
    setIsCallScreenOpen(false);
  }, []);

  const endCall = useCallback((reason = 'normal') => {
    sendCallSignal({ type: 'END', reason });
    cleanupCall();
    setCallDuration(0);
    setCallStatusText('Đã kết thúc');
    toast('Cuộc gọi đã kết thúc');
  }, [sendCallSignal, cleanupCall]);

  const handleCallSignal = useCallback(async (msg) => {
    if (msg.callerId === currentUserId) return;

    if (msg.type === 'OFFER') {
      if (!isCallActive) {
        setIncomingCall(msg);
      } else {
        sendCallSignal({ type: 'BUSY', targetUserId: msg.callerId });
      }
    } else if (msg.type === 'ANSWER') {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      setCallStatusText('Đang đàm thoại');
      if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'stable') {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
      }
    } else if (msg.type === 'BUSY') {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      toast.error('Đối phương đang bận cuộc gọi khác!');
      cleanupCall();
    } else if (msg.type === 'CANDIDATE') {
      if (peerConnectionRef.current && msg.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (e) {}
      }
    } else if (msg.type === 'END') {
      cleanupCall();
      toast('Đối phương đã kết thúc cuộc gọi');
    }
  }, [currentUserId, isCallActive, sendCallSignal, cleanupCall]);

  // Khởi động cuộc gọi thoại 1-1
  const startVoiceCall = async () => {
    if (!activePartner) return;
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
      sendCallSignal({ type: 'OFFER', offer, isVideo: false });

      setIsCallActive(true);
      setIsCallScreenOpen(true);
      setCallStatusText(`Đang đổ chuông tới ${activePartner.nickname || 'người nhận'}...`);

      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      callTimeoutRef.current = setTimeout(() => {
        toast('Người nhận không trả lời (45s)');
        endCall('missed');
      }, 45000);
    } catch (err) {
      toast.error('Không thể truy cập Microphone!');
    }
  };

  // Khởi động cuộc gọi Video 1-1
  const startVideoCall = async () => {
    if (!activePartner) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      localStreamRef.current = stream;
      setIsVideoCall(true);
      setIsVideoEnabled(true);

      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendCallSignal({ type: 'CANDIDATE', candidate: e.candidate, isVideo: true });
        }
      };

      pc.ontrack = (e) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendCallSignal({ type: 'OFFER', offer, isVideo: true });

      setIsCallActive(true);
      setIsCallScreenOpen(true);
      setCallStatusText(`Đang gọi video tới ${activePartner.nickname || 'người nhận'}...`);

      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      callTimeoutRef.current = setTimeout(() => {
        toast('Người nhận không trả lời (45s)');
        endCall('missed');
      }, 45000);
    } catch (err) {
      toast.error('Không thể truy cập Camera & Microphone!');
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

  // Trả lời cuộc gọi đến
  const answerIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      const isVid = incomingCall.isVideo;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVid ? { width: { ideal: 640 }, height: { ideal: 480 } } : false
      });
      localStreamRef.current = stream;
      setIsVideoCall(isVid);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendCallSignal({ type: 'CANDIDATE', candidate: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        if (isVid && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
        } else if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
          remoteAudioRef.current.srcObject = e.streams[0];
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendCallSignal({ type: 'ANSWER', answer });
      setIncomingCall(null);
      setIsCallActive(true);
      setIsCallScreenOpen(true);
      setCallStatusText('Đang đàm thoại');

      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } catch (e) {
      toast.error('Lỗi nhận cuộc gọi!');
    }
  };

  // Lọc bạn bè
  const filteredFriends = friends.filter(f => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (f.nickname && f.nickname.toLowerCase().includes(q)) || (f.account && f.account.toLowerCase().includes(q));
  });

  return (
    <div className="h-screen h-[100dvh] flex flex-col bg-[#09090b] text-zinc-100 overflow-hidden font-sans">
      
      {/* HEADER TOP BREADCRUMB */}
      <header className="h-14 shrink-0 px-4 sm:px-6 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/')} 
            className="p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors flex items-center gap-1.5 text-xs font-mono"
            title="Quay lại Sảnh chính"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Sảnh</span>
          </button>
          
          <div className="h-4 w-[1px] bg-zinc-800"></div>

          <TalovinLogo size={22} />
          <span className="font-semibold text-sm tracking-tight text-zinc-100 font-sans">
            Tin nhắn
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800 hidden sm:inline">
            Mã hóa E2E
          </span>
        </div>

        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-zinc-900 text-zinc-300 text-xs font-medium transition-colors"
        >
          <UserAvatar avatar={localStorage.getItem('user_avatar')} name={currentUserName} size={28} />
          <span className="hidden md:inline text-zinc-200">{currentUserName}</span>
        </button>
      </header>

      {/* BODY 2 CỘT: DANH SÁCH BẠN BÈ / KHUNG CHAT 1-1 */}
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
        
        {/* CỘT TRÁI (320px): HỘP THƯ HỘI THOẠI & BẠN BÈ */}
        <aside className={`w-full md:w-80 lg:w-96 border-r border-zinc-800/80 bg-[#0b0c10] flex flex-col h-full overflow-hidden shrink-0 ${
          activePartner ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Search box */}
          <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-950/60 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bạn bè hoặc tin nhắn..."
                className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-sans"
              />
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1 custom-scrollbar">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              Danh bạ trò chuyện ({filteredFriends.length})
            </div>

            {loadingFriends ? (
              <div className="py-12 text-center text-zinc-500 text-xs font-mono">
                Đang nạp danh bạ bạn bè...
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="py-12 px-4 text-center text-zinc-500 text-xs">
                Chưa có bạn bè nào. Hãy vào Sảnh hoặc Phòng đàm thoại để kết nối thêm bạn mới!
              </div>
            ) : (
              filteredFriends.map((friend) => {
                const isSelected = activePartner?.id?.toString() === friend.id?.toString();
                return (
                  <div
                    key={friend.id}
                    onClick={() => {
                      navigate(`/messages/${friend.id}`);
                      openDirectChat(friend.id, friend);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-zinc-800/90 border border-zinc-700/80 text-white shadow-sm'
                        : 'hover:bg-zinc-900/80 text-zinc-300 border border-transparent'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <UserAvatar avatar={friend.avatar} name={friend.nickname || friend.account} size={42} />
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="font-semibold text-xs truncate text-zinc-100">
                          {friend.nickname || friend.account}
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-500">Trực tuyến</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">
                        @{friend.account} • Nhấp để mở trò chuyện
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* CỘT PHẢI: KHUNG CHAT 1-1 CHUYÊN BIỆT */}
        <main className={`flex-1 flex flex-col h-full bg-[#09090b] overflow-hidden ${
          !activePartner ? 'hidden md:flex' : 'flex'
        }`}>
          {!activePartner ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                <MessageSquare size={26} />
              </div>
              <h3 className="font-semibold text-base text-zinc-200 font-sans">Hộp thư tin nhắn</h3>
              <p className="text-xs max-w-sm text-zinc-400 leading-relaxed font-sans">
                Chọn một người bạn từ danh sách bên trái để bắt đầu nhắn tin, gọi thoại hoặc gọi video trực tiếp.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Header 1-1 */}
              <div className="h-16 shrink-0 px-4 sm:px-6 border-b border-zinc-800/80 bg-zinc-950/90 flex items-center justify-between z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <button 
                    type="button"
                    onClick={() => setActivePartner(null)}
                    className="md:hidden p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div 
                    onClick={() => navigate(`/profile/${activePartner.id}`)}
                    className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                    title="Xem trang cá nhân"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar avatar={activePartner.avatar} name={activePartner.nickname || activePartner.account} size={38} />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm text-zinc-100 group-hover:text-white truncate">
                        {activePartner.nickname || activePartner.account}
                      </h3>
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Đang hoạt động • Xem hồ sơ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nút Gọi Thoại & Gọi Video 1-1 -> Chuyển sang Full-screen Call Page */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/call/direct/${activePartner.id}?type=audio`)}
                    className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors duration-150 active:scale-[0.98]"
                    title="Bắt đầu cuộc gọi thoại"
                  >
                    <Phone size={13} className="text-zinc-300" />
                    <span className="hidden sm:inline">Gọi thoại</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/call/direct/${activePartner.id}?type=video`)}
                    className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors duration-150 active:scale-[0.98]"
                    title="Bắt đầu cuộc gọi video"
                  >
                    <Video size={13} className="text-zinc-300" />
                    <span className="hidden sm:inline">Gọi Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/profile/${activePartner.id}`)}
                    className="h-9 w-9 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 flex items-center justify-center transition-colors active:scale-[0.98]"
                    title="Xem hồ sơ người dùng"
                  >
                    <User size={15} />
                  </button>
                </div>
              </div>

              {/* VÙNG DANH SÁCH TIN NHẮN (KHÓA CHIỀU CAO FLEX-1 OVERFLOW-Y-AUTO) */}
              <div 
                ref={scrollContainerRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-3 custom-scrollbar"
              >
                {loadingMessages ? (
                  <div className="py-12 text-center text-zinc-500 text-xs font-mono">
                    Đang nạp tin nhắn hội thoại...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center text-zinc-500 space-y-2">
                    <Sparkles size={24} className="mx-auto text-zinc-600 opacity-60" />
                    <p className="text-xs font-medium text-zinc-400">Chưa có tin nhắn nào trong cuộc trò chuyện này</p>
                    <p className="text-[11px] text-zinc-500">Gửi lời chào đầu tiên để bắt đầu kết nối!</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isMe = msg.userId?.toString() === currentUserId?.toString();
                    return (
                      <div 
                        key={msg.id || index}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div 
                          className={`max-w-[78%] sm:max-w-[65%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                            isMe 
                              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 rounded-tr-sm' 
                              : 'bg-zinc-900 text-zinc-200 border border-zinc-800/80 rounded-tl-sm'
                          }`}
                        >
                          {msg.message}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 px-1">
                          {msg.formattedTime || (msg.timeSend ? new Date(msg.timeSend).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* KHUNG NHẬP LIỆU DƯỚI ĐÁY */}
              <form 
                onSubmit={handleSendMessage}
                className="shrink-0 p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center gap-2.5"
              >
                <input 
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={`Nhắn tin cho ${activePartner.nickname || activePartner.account}...`}
                  className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-sans"
                />

                <button
                  type="submit"
                  disabled={!textInput.trim() || sending}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 shrink-0"
                >
                  <Send size={13} />
                  <span className="hidden sm:inline">Gửi</span>
                </button>
              </form>

            </div>
          )}
        </main>
      </div>

      {/* MODAL CUỘC GỌI ĐẾN (INCOMING CALL) */}
      {incomingCall && !isCallActive && (
        <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto animate-bounce">
              {incomingCall.isVideo ? <Video size={24} /> : <Phone size={24} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {incomingCall.isVideo ? 'Cuộc gọi Video đến' : 'Cuộc gọi Thoại đến'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                <strong className="text-zinc-200">{incomingCall.callerName || 'Người dùng'}</strong> đang gọi cho bạn...
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIncomingCall(null)}
                className="h-9 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-rose-400 font-medium text-xs flex items-center gap-1.5 transition-colors"
              >
                <PhoneOff size={14} /> Từ chối
              </button>
              <button
                type="button"
                onClick={() => {
                  const isVid = Boolean(incomingCall.isVideo);
                  const callerId = incomingCall.callerId;
                  setIncomingCall(null);
                  navigate(`/call/direct/${callerId}?video=${isVid}`);
                }}
                className="h-9 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center gap-1.5 transition-colors"
              >
                <Phone size={14} /> Nghe máy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MÀN HÌNH CUỘC GỌI TOÀN DIỆN CHUYÊN BIỆT (CALL SCREEN OVERLAY Z-INDEX 99999) */}
      {isCallActive && isCallScreenOpen && (
        <div className="fixed inset-0 z-[99999] bg-gradient-to-b from-[#09090b] via-[#0c0d14] to-[#09090b] flex flex-col justify-between p-4 sm:p-6 backdrop-blur-2xl animate-fade-in">
          
          {/* Top Bar Call */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <button
              type="button"
              onClick={() => setIsCallScreenOpen(false)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ChevronDown size={16} />
              <span>Thu nhỏ về chat</span>
            </button>

            <div className="text-center">
              <h4 className="font-bold text-sm text-zinc-100">
                {activePartner ? (activePartner.nickname || activePartner.account) : 'Cuộc trò chuyện'}
              </h4>
              <span className="text-xs font-mono text-emerald-400 flex items-center justify-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {callStatusText} • {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-800">
              {isVideoCall ? 'WebRTC HD Video' : 'Audio P2P Direct'}
            </span>
          </div>

          {/* Center Call Visual */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            {isVideoCall ? (
              <div className="relative w-full max-w-3xl h-[65vh] bg-black rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-xs font-semibold text-white">
                  {activePartner?.nickname || 'Đối phương'}
                </div>

                {/* Local Video PiP */}
                <div className="absolute bottom-4 right-4 w-36 h-28 sm:w-44 sm:h-32 bg-zinc-900 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl">
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 text-[10px] font-semibold bg-black/60 px-2 py-0.5 rounded text-white">
                    Bạn
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-36 h-36 rounded-full bg-emerald-500/10 animate-ping"></span>
                  <span className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-pulse"></span>
                  <UserAvatar 
                    avatar={activePartner?.avatar} 
                    name={activePartner?.nickname || activePartner?.account} 
                    size={88} 
                    className="ring-4 ring-emerald-500 shadow-2xl relative z-10"
                  />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-lg text-white">
                    {activePartner?.nickname || activePartner?.account}
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono mt-1">Đang mã hóa tín hiệu âm thanh hai chiều</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Call Controls */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={toggleMute}
              className={`p-3.5 rounded-full border transition-all ${
                isMuted 
                  ? 'bg-rose-500/20 border-rose-500 text-rose-400' 
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white'
              }`}
              title={isMuted ? "Bật micro" : "Tắt micro"}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {isVideoCall && (
              <button
                type="button"
                onClick={toggleVideo}
                className={`p-3.5 rounded-full border transition-all ${
                  !isVideoEnabled 
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400' 
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white'
                }`}
                title={isVideoEnabled ? "Tắt camera" : "Bật camera"}
              >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
            )}

            <button
              type="button"
              onClick={() => endCall('normal')}
              className="px-6 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 transition-transform active:scale-95 shadow-xl shadow-rose-950"
              title="Kết thúc cuộc gọi"
            >
              <PhoneOff size={18} />
              <span>Kết thúc</span>
            </button>
          </div>

        </div>
      )}

      {/* Floating mini call bar khi thu nhỏ */}
      {isCallActive && !isCallScreenOpen && (
        <div 
          onClick={() => setIsCallScreenOpen(true)}
          className="fixed bottom-4 right-4 z-50 p-3 rounded-2xl bg-zinc-900/95 border border-zinc-800 shadow-2xl backdrop-blur-xl flex items-center gap-3 cursor-pointer hover:border-emerald-500/60 transition-all"
        >
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <span className="text-xs font-bold text-white block">
              Đang gọi: {activePartner?.nickname || 'Cuộc trò chuyện'}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')} • Nhấp để mở lại
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); endCall('normal'); }}
            className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white"
          >
            <PhoneOff size={14} />
          </button>
        </div>
      )}

    </div>
  );
};

export default DirectMessagePage;
