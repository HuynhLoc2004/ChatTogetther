import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, 
  Users, Volume2, Shield, ArrowLeft, Radio, Sparkles
} from 'lucide-react';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

const CallPage = () => {
  const { roomId, userId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isVideoParam = searchParams.get('type') === 'video' || searchParams.get('video') === 'true';
  const isDirectCall = Boolean(userId);
  const isRoomCall = Boolean(roomId);

  const currentUserId = localStorage.getItem('user_id');
  const currentUserName = localStorage.getItem('nickname') || localStorage.getItem('username') || 'Tôi';
  const currentUserAvatar = localStorage.getItem('avatar');

  // Call States
  const [isVideoCall, setIsVideoCall] = useState(isVideoParam);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoParam);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatusText, setCallStatusText] = useState('Đang khởi tạo kết nối WebRTC...');
  const [isConnected, setIsConnected] = useState(false);

  // Target Information (Partner in 1-1 or Room info in Group)
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);

  // Refs
  const stompClient = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimerRef = useRef(null);

  // 1. Fetch metadata (Partner or Room)
  useEffect(() => {
    let isMounted = true;
    const fetchTargetMeta = async () => {
      try {
        if (isDirectCall && userId) {
          const res = await axiosClient.get('/users/profile', { params: { user_id: userId } });
          if (res.data?.data && isMounted) {
            setPartnerProfile(res.data.data);
          }
        } else if (isRoomCall && roomId) {
          const res = await axiosClient.get(`/rooms/${roomId}`);
          if (res.data?.data && isMounted) {
            setRoomInfo(res.data.data);
          }
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin cuộc gọi:", err);
      }
    };
    fetchTargetMeta();
    return () => { isMounted = false; };
  }, [isDirectCall, isRoomCall, userId, roomId]);

  // 2. Format Call Duration
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${remSecs < 10 ? '0' : ''}${remSecs}`;
  };

  // 3. Cleanup Call Resources
  const cleanupCall = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (stompClient.current && stompClient.current.connected) {
      stompClient.current.disconnect();
      stompClient.current = null;
    }
  }, []);

  // 4. Send Signal Helper
  const sendCallSignal = useCallback((payload) => {
    if (!stompClient.current || !stompClient.current.connected) return;

    const baseData = {
      ...payload,
      callerId: currentUserId,
      callerName: currentUserName,
      callerAvatar: currentUserAvatar,
      timestamp: Date.now()
    };

    if (isDirectCall && userId) {
      stompClient.current.send(`/app/call/user/${userId}`, {}, JSON.stringify(baseData));
    } else if (isRoomCall && roomId) {
      stompClient.current.send(`/app/call/${roomId}`, {}, JSON.stringify(baseData));
    }
  }, [currentUserId, currentUserName, currentUserAvatar, isDirectCall, isRoomCall, userId, roomId]);

  // 5. Handle Signal Incoming
  const handleCallSignal = useCallback(async (msg) => {
    if (!msg || String(msg.callerId) === String(currentUserId)) return;

    if (msg.type === 'OFFER') {
      try {
        setCallStatusText('Đang kết nối tín hiệu...');
        if (!peerConnectionRef.current) return;
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        sendCallSignal({ type: 'ANSWER', answer });
      } catch (e) {
        console.error("Lỗi xử lý OFFER:", e);
      }
    } else if (msg.type === 'ANSWER') {
      try {
        setCallStatusText('Đang đàm thoại');
        setIsConnected(true);
        if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'stable') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
        }
      } catch (e) {
        console.error("Lỗi xử lý ANSWER:", e);
      }
    } else if (msg.type === 'CANDIDATE') {
      if (peerConnectionRef.current && msg.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (e) {
          console.error("Lỗi thêm ICE Candidate:", e);
        }
      }
    } else if (msg.type === 'BUSY') {
      setCallStatusText('Người nhận đang bận!');
      toast.error('Đối phương hiện đang bận cuộc gọi khác!');
      setTimeout(() => endCall(false), 2000);
    } else if (msg.type === 'END') {
      setCallStatusText('Cuộc gọi đã kết thúc');
      toast('Đối phương đã kết thúc cuộc gọi.');
      setTimeout(() => endCall(false), 1200);
    }
  }, [currentUserId, sendCallSignal]);

  // 6. End Call Handler
  const endCall = useCallback((notify = true) => {
    if (notify) {
      sendCallSignal({ type: 'END' });
    }
    cleanupCall();
    // Quay lại màn hình trước đó
    if (isDirectCall && userId) {
      navigate(`/messages/${userId}`, { replace: true });
    } else if (isRoomCall && roomId) {
      navigate(`/room/${roomId}`, { replace: true });
    } else {
      navigate(-1);
    }
  }, [sendCallSignal, cleanupCall, isDirectCall, isRoomCall, userId, roomId, navigate]);

  // 7. Initialize WebRTC Media & STOMP Socket
  useEffect(() => {
    let isActive = true;

    const initCall = async () => {
      try {
        setCallStatusText('Đang mở thiết bị Mic/Camera...');
        
        // Xin quyền Media
        const constraints = {
          audio: true,
          video: isVideoParam ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isActive) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && isVideoParam) {
          localVideoRef.current.srcObject = stream;
        }

        // Tạo PeerConnection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        // Thêm tracks vào PC
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // ICE Candidate
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendCallSignal({ type: 'CANDIDATE', candidate: event.candidate });
          }
        };

        // Track nhận từ remote
        pc.ontrack = (event) => {
          const [remoteStream] = event.streams;
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
          setIsConnected(true);
          setCallStatusText('Đang đàm thoại');
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            setIsConnected(true);
            setCallStatusText('Đang đàm thoại');
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setCallStatusText('Mất kết nối hoặc tín hiệu yếu...');
          }
        };

        // Kết nối WebSocket STOMP
        const socketUrl = `${axiosClient.defaults.baseURL || ''}/ws-gs-guide`;
        const socket = new SockJS(socketUrl);
        const stomp = Stomp.over(socket);
        stomp.debug = null; // Tắt log console rác
        stompClient.current = stomp;

        stomp.connect({}, async () => {
          if (!isActive) return;

          // Subscribe topic
          if (isDirectCall && currentUserId) {
            stomp.subscribe(`/topic/call/user/${currentUserId}`, (frame) => {
              try {
                const msg = JSON.parse(frame.body);
                handleCallSignal(msg);
              } catch (e) {}
            });
          } else if (isRoomCall && roomId) {
            stomp.subscribe(`/topic/call/${roomId}`, (frame) => {
              try {
                const msg = JSON.parse(frame.body);
                handleCallSignal(msg);
              } catch (e) {}
            });
          }

          // Gửi OFFER khởi động cuộc gọi
          setCallStatusText('Đang đổ chuông...');
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendCallSignal({ type: 'OFFER', offer, isVideo: isVideoParam });

          // Khởi động đồng hồ cuộc gọi
          if (callTimerRef.current) clearInterval(callTimerRef.current);
          callTimerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
        }, (err) => {
          console.error("Lỗi kết nối STOMP cuộc gọi:", err);
          setCallStatusText('Lỗi kết nối máy chủ tín hiệu.');
        });

      } catch (err) {
        console.error("Lỗi khởi tạo cuộc gọi WebRTC:", err);
        setCallStatusText('Không thể truy cập Mic hoặc Camera.');
        toast.error('Vui lòng cấp quyền Microphone & Camera trong trình duyệt để đàm thoại!');
      }
    };

    initCall();

    return () => {
      isActive = false;
      cleanupCall();
    };
  }, [isVideoParam, isDirectCall, isRoomCall, currentUserId, roomId, userId, sendCallSignal, handleCallSignal, cleanupCall]);

  // Toggle Mic
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Video
  const toggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      } else {
        // Xin quyền bật camera nếu ban đầu là audio-only
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newTrack);
          if (peerConnectionRef.current) {
            peerConnectionRef.current.addTrack(newTrack, localStreamRef.current);
            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);
            sendCallSignal({ type: 'OFFER', offer, isVideo: true });
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          setIsVideoCall(true);
          setIsVideoEnabled(true);
        } catch (err) {
          toast.error("Không thể kích hoạt Camera!");
        }
      }
    }
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      // Khôi phục video camera gốc
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          if (localStreamRef.current && localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        };

        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          } else {
            peerConnectionRef.current.addTrack(screenTrack, stream);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setIsScreenSharing(true);
      } catch (err) {
        console.error("Lỗi chia sẻ màn hình:", err);
      }
    }
  };

  const displayName = partnerProfile ? (partnerProfile.nickname || partnerProfile.account) : (roomInfo?.roomName || `Phòng #${roomId || 'Hội thoại'}`);
  const displayAvatar = partnerProfile?.avatar;

  return (
    <div className="h-screen w-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* Ẩn Audio remote để phát âm thanh */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* ============================================================== */}
      {/* 1. HEADER CUỘC GỌI TOÀN MÀN HÌNH */}
      {/* ============================================================== */}
      <header className="h-16 px-4 sm:px-8 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => endCall(true)}
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors active:scale-95"
            title="Quay lại"
          >
            <ArrowLeft size={16} />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm sm:text-base text-zinc-100 line-clamp-1">
                {displayName}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                {isDirectCall ? '1-1 Call' : 'Group Call'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{callStatusText}</span>
            </div>
          </div>
        </div>

        {/* Đồng hồ cuộc gọi chuẩn font-mono tabular-nums */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono tabular-nums text-zinc-200">
          <Radio size={13} className={isConnected ? "text-emerald-400 animate-pulse" : "text-zinc-500"} />
          <span>{formatTime(callDuration)}</span>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. KHU VỰC LIVE CALL STAGE (GRID TẤM HÌNH / AVATAR) */}
      {/* ============================================================== */}
      <main className="flex-1 p-4 sm:p-6 overflow-hidden flex items-center justify-center relative">
        <div className="w-full max-w-5xl h-full flex flex-col sm:flex-row items-center justify-center gap-4 relative">
          
          {/* Card Remote (Đối phương / Các thành viên) */}
          <div className="w-full h-full flex-1 bg-zinc-900 border border-zinc-800/80 rounded-2xl sm:rounded-3xl overflow-hidden relative flex items-center justify-center shadow-2xl">
            {isVideoCall ? (
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
            ) : null}

            {/* Trạng thái nếu không có video hoặc đang đàm thoại Audio */}
            {(!isVideoCall || !isConnected) && (
              <div className="flex flex-col items-center gap-4 z-10">
                <div className="relative">
                  <div className={`w-24 h-24 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border border-zinc-700 bg-zinc-800 flex items-center justify-center shadow-2xl ${isConnected ? 'ring-4 ring-emerald-500/40 animate-pulse' : ''}`}>
                    {displayAvatar ? (
                      <img src={displayAvatar} alt="Partner" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl sm:text-4xl font-bold text-zinc-300">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {isConnected && (
                    <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center text-zinc-950">
                      <Volume2 size={13} />
                    </span>
                  )}
                </div>

                <div className="text-center">
                  <h3 className="font-semibold text-base sm:text-lg text-zinc-100">{displayName}</h3>
                  <p className="text-xs text-zinc-400 font-mono mt-1">{callStatusText}</p>
                </div>
              </div>
            )}

            {/* Khung Local Video nhỏ ở góc (Picture in Picture) */}
            <div className="absolute bottom-4 right-4 w-28 h-40 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border border-zinc-700/80 bg-zinc-950 shadow-2xl z-20">
              {isVideoCall && isVideoEnabled ? (
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover -scale-x-100"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2 bg-zinc-900/90 text-center">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-800 flex items-center justify-center">
                    {currentUserAvatar ? (
                      <img src={currentUserAvatar} alt="Me" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-zinc-300">{currentUserName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 font-medium">Bạn</span>
                </div>
              )}

              {/* Tag trạng thái Mic của mình */}
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-zinc-300 flex items-center gap-1 font-mono">
                {isMuted ? <MicOff size={10} className="text-rose-400" /> : <Mic size={10} className="text-emerald-400" />}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ============================================================== */}
      {/* 3. THANH ĐIỀU KHIỂN DƯỚI ĐÁY (ACTION CONTROLS BAR) */}
      {/* ============================================================== */}
      <footer className="h-20 px-4 sm:px-8 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md flex items-center justify-center gap-3 sm:gap-4 shrink-0 z-20">
        {/* Nút Bật / Tắt Mic */}
        <button
          type="button"
          onClick={toggleMute}
          className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all active:scale-95 ${
            isMuted 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
          }`}
          title={isMuted ? "Bật Microphone" : "Tắt Microphone"}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Nút Bật / Tắt Camera */}
        <button
          type="button"
          onClick={toggleVideo}
          className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all active:scale-95 ${
            !isVideoEnabled 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
          }`}
          title={isVideoEnabled ? "Tắt Camera" : "Bật Camera"}
        >
          {isVideoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
        </button>

        {/* Nút Chia sẻ màn hình */}
        <button
          type="button"
          onClick={toggleScreenShare}
          className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all active:scale-95 ${
            isScreenSharing 
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
          }`}
          title={isScreenSharing ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"}
        >
          {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
        </button>

        {/* Nút Kết thúc cuộc gọi (Màu đỏ duy nhất theo chuẩn thiết kế) */}
        <button
          type="button"
          onClick={() => endCall(true)}
          className="h-11 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-rose-950/40 transition-all active:scale-95"
          title="Kết thúc cuộc gọi"
        >
          <PhoneOff size={16} />
          <span>Kết thúc</span>
        </button>
      </footer>
    </div>
  );
};

export default CallPage;
