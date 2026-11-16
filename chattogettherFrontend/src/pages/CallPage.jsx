import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, 
  Users, Volume2, Shield, ArrowLeft, Radio, Sparkles, PhoneCall,
  Maximize, Minimize
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import { createStompClient } from '../utils/stompClient';
import UserAvatar from '../components/UserAvatar';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ],
  iceCandidatePoolSize: 10
};

const CallPage = () => {
  const { roomId, userId: pathUserId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const userId = pathUserId || searchParams.get('userId') || searchParams.get('user_id') || searchParams.get('targetId');
  const isVideoParam = searchParams.get('type') === 'video' || searchParams.get('video') === 'true';
  const isIncoming = searchParams.get('incoming') === 'true' || searchParams.get('autoAnswer') === 'true';
  const isDirectCall = Boolean(userId);
  const isRoomCall = Boolean(roomId);

  const currentUserId = (() => {
    let id = localStorage.getItem('user_id');
    if (!id) {
      try {
        const token = localStorage.getItem('accesstoken');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload?.user_id) id = String(payload.user_id);
        }
      } catch (_) {}
    }
    return id ? String(id) : null;
  })();
  const currentUserName = localStorage.getItem('nickname') || localStorage.getItem('username') || 'Tôi';
  const currentUserAvatar = localStorage.getItem('user_avatar') || localStorage.getItem('avatar') || '';

  // Call States
  const [isVideoCall, setIsVideoCall] = useState(isVideoParam);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoParam);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatusText, setCallStatusText] = useState(isIncoming ? 'Đang kết nối cuộc gọi...' : 'Đang đổ chuông...');
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stageContainerRef = useRef(null);

  const toggleFullscreen = () => {
    if (!stageContainerRef.current) return;
    if (!document.fullscreenElement) {
      stageContainerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

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
  const durationRef = useRef(0);
  const dmRoomIdRef = useRef(null);
  const audioContextRef = useRef(null);
  const ringOscillatorRef = useRef(null);
  const ringGainRef = useRef(null);
  const ringIntervalRef = useRef(null);
  const isCallEndedRef = useRef(false);
  const iceCandidateQueueRef = useRef([]);
  const localCandidatesHistoryRef = useRef([]);
  const disconnectTimerRef = useRef(null);
  const connectTimeoutRef = useRef(null);

  // Sync duration ref
  useEffect(() => {
    durationRef.current = callDuration;
  }, [callDuration]);

  // Luôn đảm bảo localVideoRef nhận srcObject ngay lập tức khi bật camera (tránh lỗi tối đen)
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.muted = true;
      localVideoRef.current.defaultMuted = true;
      localVideoRef.current.playsInline = true;
      localVideoRef.current.setAttribute('playsinline', '');
      localVideoRef.current.setAttribute('webkit-playsinline', '');

      if (isScreenSharing && screenStreamRef.current) {
        localVideoRef.current.srcObject = screenStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      } else if (isVideoEnabled && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack && videoTrack.enabled) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        } else {
          localVideoRef.current.srcObject = null;
        }
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [isVideoEnabled, isVideoCall, isScreenSharing]);

  // 1. Fetch metadata (Partner or Room) & pre-fetch direct room ID
  useEffect(() => {
    let isMounted = true;
    const fetchTargetMeta = async () => {
      try {
        if (isDirectCall && userId) {
          const [profRes, directRoomRes] = await Promise.allSettled([
            axiosClient.get('/users/profile', { params: { user_id: userId } }),
            axiosClient.get(`/message/direct/${userId}`)
          ]);

          if (profRes.status === 'fulfilled' && profRes.value.data?.data && isMounted) {
            setPartnerProfile(profRes.value.data.data);
          }
          if (directRoomRes.status === 'fulfilled' && directRoomRes.value.data?.data?.roomId) {
            dmRoomIdRef.current = directRoomRes.value.data.data.roomId;
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

  // Kiểm tra an toàn: Nếu không có người nhận hoặc phòng cuộc gọi
  useEffect(() => {
    if (!userId && !roomId) {
      toast.error("Không tìm thấy thông tin đối phương hoặc phòng gọi!");
      const t = setTimeout(() => navigate('/messages'), 1800);
      return () => clearTimeout(t);
    }
  }, [userId, roomId, navigate]);

  // 2. Format Call Duration
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${remSecs < 10 ? '0' : ''}${remSecs}`;
  };

  // 3. Ring audio sound generator (Web Audio API)
  const stopRingAudio = useCallback(() => {
    try {
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
        ringIntervalRef.current = null;
      }
      if (ringGainRef.current) {
        try { ringGainRef.current.gain.setValueAtTime(0, audioContextRef.current?.currentTime || 0); } catch (_) {}
        ringGainRef.current = null;
      }
      if (ringOscillatorRef.current) {
        try { ringOscillatorRef.current.stop(); } catch (_) {}
        try { ringOscillatorRef.current.disconnect(); } catch (_) {}
        ringOscillatorRef.current = null;
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (_) {}
        audioContextRef.current = null;
      }
    } catch (e) {}
  }, []);

  const startRingAudio = useCallback(() => {
    if (isIncoming || isConnected) return;
    try {
      // Dọn dẹp phiên âm thanh cũ nếu còn
      stopRingAudio();

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      ringGainRef.current = gain;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ringOscillatorRef.current = osc;

      // Pulse ringtone
      let beeping = true;
      ringIntervalRef.current = setInterval(() => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          if (ringIntervalRef.current) {
            clearInterval(ringIntervalRef.current);
            ringIntervalRef.current = null;
          }
          return;
        }
        beeping = !beeping;
        try {
          gain.gain.setValueAtTime(beeping ? 0.04 : 0, ctx.currentTime);
        } catch (_) {}
      }, 1400);
    } catch (e) {}
  }, [isIncoming, isConnected, stopRingAudio]);

  // 4. Cleanup Call Resources (Zero-Lag + An toàn WebSocket)
  const cleanupCall = useCallback(() => {
    stopRingAudio();
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

    // Giữ kết nối thêm 300ms trong nền để đảm bảo gói tin END đến được đối phương trước khi đóng socket
    const clientToClose = stompClient.current;
    if (clientToClose) {
      setTimeout(() => {
        try {
          if (clientToClose.connected) {
            clientToClose.disconnect();
          }
        } catch (_) {}
      }, 300);
      stompClient.current = null;
    }
  }, [stopRingAudio]);

  // 5. Send Signal Helper
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

  // 6. End Call Handler & Zero-Lag Instant Exit (0ms Delay)
  const endCall = useCallback((shouldSendSignal = true) => {
    if (isCallEndedRef.current) return;
    isCallEndedRef.current = true;

    // Ngắt chuông và giải phóng tài nguyên tức thì
    stopRingAudio();
    if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);

    const durationSecs = durationRef.current;
    const isVideo = Boolean(isVideoParam || isVideoCall);

    // Xác định đúng người gọi gốc (Side A) và người nhận (Side B)
    const trueCallerId = isIncoming ? userId : currentUserId;
    const trueTargetId = isIncoming ? currentUserId : userId;
    const resolvedRoomId = dmRoomIdRef.current || roomId;

    const callPayload = {
      type: durationSecs > 0 ? 'END' : (isIncoming ? 'DECLINE' : 'CANCEL'),
      callerId: trueCallerId,
      targetUserId: trueTargetId,
      endedBy: currentUserId,
      roomId: resolvedRoomId,
      duration: durationSecs,
      isVideo: isVideo,
      callMode: isVideo ? 'video' : 'audio',
      timestamp: Date.now()
    };

    // Ghi nhận log cuộc gọi ngay lập tức vào bộ nhớ máy (0ms latency, không chờ server/socket)
    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const logText = (durationSecs > 0)
        ? (isVideo ? `📹 Cuộc gọi video (${String(Math.floor(durationSecs / 60)).padStart(2, '0')}:${String(durationSecs % 60).padStart(2, '0')})` : `📞 Cuộc gọi thoại (${String(Math.floor(durationSecs / 60)).padStart(2, '0')}:${String(durationSecs % 60).padStart(2, '0')})`)
        : (isVideo ? '📹 Cuộc gọi video nhỡ' : '📞 Cuộc gọi thoại nhỡ');

      const optimisticMsg = {
        id: `call_${Date.now()}`,
        userId: Number(trueCallerId),
        senderId: Number(trueCallerId),
        targetUserId: Number(trueTargetId),
        message: logText,
        timeSend: now.toISOString(),
        formattedTime: timeStr,
        isRead: false,
        pending: false
      };

      const partnerKey = String(userId);
      const storageKey = `talovin_dm_msgs_${partnerKey}`;
      const existingRaw = localStorage.getItem(storageKey);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      if (!existing.some(m => m.id === optimisticMsg.id || (m.message === logText && Math.abs(new Date(m.timeSend || 0).getTime() - now.getTime()) < 3000))) {
        const updated = [...existing, optimisticMsg];
        localStorage.setItem(storageKey, JSON.stringify(updated.slice(-50)));
        if (resolvedRoomId) {
          localStorage.setItem(`talovin_dm_msgs_${resolvedRoomId}`, JSON.stringify(updated.slice(-50)));
        }
      }
      window.dispatchEvent(new CustomEvent('talovin_new_message', { detail: optimisticMsg }));
    } catch (_) {}

    if (shouldSendSignal) {
      // 1. Gửi qua WebSocket STOMP
      sendCallSignal(callPayload);

      // 2. Gửi log trực tiếp qua STOMP /app/call/log
      try {
        if (stompClient.current && stompClient.current.connected) {
          stompClient.current.send('/app/call/log', {}, JSON.stringify(callPayload));
        }
      } catch (_) {}

      // 3. Gửi qua REST API HTTP dự phòng (Bảo đảm 100% cuộc gọi được lưu và bên kia nhận lệnh tắt)
      try {
        axiosClient.post('/call/end', callPayload).catch(() => {});
      } catch (_) {}

      // 4. Fallback sendBeacon nếu tắt tab hoặc điều hướng gấp
      try {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(callPayload)], { type: 'application/json' });
          navigator.sendBeacon('/api/call/end', blob);
        }
      } catch (_) {}
    }

    cleanupCall();

    // Giữ trễ nhỏ 120ms để browser kịp flush dữ liệu socket ra ngoài trước khi chuyển route
    setTimeout(() => {
      const fromParam = searchParams.get('from');
      if (fromParam) {
        navigate(decodeURIComponent(fromParam), { replace: true });
      } else if (window.history.length > 2) {
        navigate(-1);
      } else if (isDirectCall && userId) {
        navigate(`/messages/${userId}`, { replace: true });
      } else if (isRoomCall && roomId) {
        navigate(`/room/${roomId}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }, 120);
  }, [sendCallSignal, cleanupCall, stopRingAudio, isVideoParam, isVideoCall, isDirectCall, isRoomCall, userId, roomId, searchParams, navigate, currentUserId, isIncoming]);

  // 7. Handle Signal Incoming
  const handleCallSignal = useCallback(async (msg) => {
    if (!msg || String(msg.callerId) === String(currentUserId)) return;

    if (msg.type === 'OFFER') {
      try {
        stopRingAudio();
        setCallStatusText('Đang kết nối đàm thoại...');
        if (msg.isVideo) setIsVideoCall(true);
        if (!peerConnectionRef.current) return;
        const pc = peerConnectionRef.current;
        await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));

        // Đổ toàn bộ ICE candidate đã lưu trong hàng đợi
        while (iceCandidateQueueRef.current.length > 0) {
          const cand = iceCandidateQueueRef.current.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (_) {}
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendCallSignal({ type: 'ANSWER', answer, isVideo: Boolean(isVideoParam || isVideoCall || isVideoEnabled) });
      } catch (e) {
        console.error("Lỗi xử lý OFFER:", e);
      }
    } else if (msg.type === 'ACCEPT') {
      // Đối phương đã bấm nghe máy -> Dừng ngay chuông chờ và gửi OFFER
      try {
        stopRingAudio();
        setCallStatusText('Đối phương đã nhận máy. Đang kết nối...');
        if (peerConnectionRef.current) {
          const pc = peerConnectionRef.current;
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: Boolean(isVideoParam || isVideoCall || isVideoEnabled)
          });
          await pc.setLocalDescription(offer);
          sendCallSignal({ type: 'OFFER', offer, isVideo: Boolean(isVideoParam || isVideoCall || isVideoEnabled) });
          // Gửi kèm toàn bộ candidate đã thu thập sẵn
          localCandidatesHistoryRef.current.forEach(cand => {
            sendCallSignal({ type: 'CANDIDATE', candidate: cand });
          });
        }
      } catch (e) {
        console.error("Lỗi gửi OFFER sau ACCEPT:", e);
      }
    } else if (msg.type === 'ANSWER') {
      try {
        stopRingAudio();
        setCallStatusText('Đang đàm thoại');
        setIsConnected(true);
        if (msg.isVideo) setIsVideoCall(true);
        const pc = peerConnectionRef.current;
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
          // Đổ toàn bộ ICE candidate trong hàng đợi
          while (iceCandidateQueueRef.current.length > 0) {
            const cand = iceCandidateQueueRef.current.shift();
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (_) {}
          }
        }
      } catch (e) {
        console.error("Lỗi xử lý ANSWER:", e);
      }
    } else if (msg.type === 'SCREEN_SHARE') {
      const isSharing = Boolean(msg.isSharing);
      setIsRemoteScreenSharing(isSharing);
      if (isSharing) {
        setIsVideoCall(true);
      }
    } else if (msg.type === 'CANDIDATE') {
      if (msg.candidate) {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {
            console.warn("Lỗi addIceCandidate:", e);
          }
        } else {
          // Lưu vào queue đợi remoteDescription được set
          iceCandidateQueueRef.current.push(msg.candidate);
        }
      }
    } else if (msg.type === 'BUSY' || msg.type === 'DECLINE') {
      stopRingAudio();
      setCallStatusText('Đối phương hiện đang bận hoặc từ chối');
      toast.error('Đối phương hiện đang bận hoặc không thể bắt máy!');
      setTimeout(() => endCall(false), 400);
    } else if (msg.type === 'END') {
      stopRingAudio();
      setCallStatusText('Cuộc gọi đã kết thúc');
      // Kết thúc ngay lập tức không trễ 1 mili-giây
      endCall(false);
    }
  }, [currentUserId, sendCallSignal, stopRingAudio, isVideoParam, isVideoCall, isVideoEnabled, endCall]);

  // 8. Initialize WebRTC Media & STOMP Socket
  useEffect(() => {
    let isActive = true;

    const initCall = async () => {
      try {
        setCallStatusText('Đang mở thiết bị Mic/Camera...');
        
        // Xin quyền Media an toàn (tự động fallback sang Audio-only nếu Camera không khả dụng)
        let stream;
        try {
          const constraints = {
            audio: true,
            video: isVideoParam ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (mediaErr) {
          console.warn("Lỗi mở thiết bị theo cấu hình:", mediaErr);
          if (isVideoParam) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              toast("Không thể mở Camera, tự động chuyển sang cuộc gọi thoại.", { icon: '🎙️' });
            } catch (audioErr) {
              throw audioErr;
            }
          } else {
            throw mediaErr;
          }
        }
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
            localCandidatesHistoryRef.current.push(event.candidate);
            sendCallSignal({ type: 'CANDIDATE', candidate: event.candidate });
          }
        };

        // Track nhận từ remote
        pc.ontrack = (event) => {
          const [remoteStream] = event.streams;
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(() => {});
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(() => {});
          }
          if (event.track?.kind === 'video' || remoteStream.getVideoTracks().length > 0) {
            setIsVideoCall(true);
          }
          stopRingAudio();
          setIsConnected(true);
          setCallStatusText('Đang đàm thoại');
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            stopRingAudio();
            setIsConnected(true);
            setCallStatusText('Đang đàm thoại');
            if (disconnectTimerRef.current) {
              clearTimeout(disconnectTimerRef.current);
              disconnectTimerRef.current = null;
            }
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setCallStatusText('Đối phương đã ngắt kết nối...');
            if (!disconnectTimerRef.current) {
              disconnectTimerRef.current = setTimeout(() => {
                endCall(false);
              }, 2500);
            }
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            stopRingAudio();
            setIsConnected(true);
            setCallStatusText('Đang đàm thoại');
          } else if (pc.iceConnectionState === 'failed') {
            pc.restartIce?.();
          }
        };

        // Kết nối WebSocket STOMP chuẩn native browser kèm Authorization token
        const stomp = createStompClient();
        stompClient.current = stomp;
        const authToken = localStorage.getItem('accesstoken');
        const connHeaders = {};
        if (authToken) connHeaders['Authorization'] = `Bearer ${authToken}`;
        if (currentUserId) connHeaders['userId'] = String(currentUserId);

        stomp.connect(connHeaders, async () => {
          if (!isActive) return;

          // Subscribe topic nhận tín hiệu
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

          if (isIncoming) {
            // Là người nhận máy: gửi tín hiệu ACCEPT để người gọi biết và gửi OFFER
            setCallStatusText('Đang thiết lập kênh đàm thoại...');
            sendCallSignal({ type: 'ACCEPT' });
          } else {
            // Là người khởi tạo cuộc gọi: bắt đầu đổ chuông và gửi tín hiệu RINGING
            startRingAudio();
            setCallStatusText('Đang đổ chuông...');
            sendCallSignal({ type: 'RINGING', isVideo: isVideoParam });

            // Tự động ngắt sau 45s nếu đối phương không bắt máy
            connectTimeoutRef.current = setTimeout(() => {
              toast.error('Đối phương không trả lời cuộc gọi.');
              endCall(true);
            }, 45000);
          }

          // Khởi động đồng hồ đếm thời gian cuộc gọi
          if (callTimerRef.current) clearInterval(callTimerRef.current);
          callTimerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
        }, (err) => {
          console.warn("Lỗi kết nối máy chủ tín hiệu:", err);
          setCallStatusText('Đang kết nối lại đường truyền đàm thoại...');
        });

      } catch (err) {
        console.error("Lỗi khởi tạo cuộc gọi WebRTC:", err);
        setCallStatusText('Không thể truy cập Microphone hoặc Camera.');
        toast.error('Vui lòng cấp quyền Microphone & Camera trong trình duyệt để đàm thoại!');
      }
    };

    initCall();

    return () => {
      isActive = false;
      cleanupCall();
    };
  }, [isVideoParam, isIncoming, isDirectCall, isRoomCall, currentUserId, roomId, userId, sendCallSignal, handleCallSignal, cleanupCall, startRingAudio, stopRingAudio]);

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

  // Toggle Video - Mở camera tức thì, mượt mà và không bị đen màn hình
  const toggleVideo = async () => {
    if (!localStreamRef.current) return;

    const existingTrack = localStreamRef.current.getVideoTracks()[0];
    if (existingTrack) {
      existingTrack.enabled = !existingTrack.enabled;
      setIsVideoEnabled(existingTrack.enabled);
      setIsVideoCall(true);

      if (existingTrack.enabled && localVideoRef.current) {
        localVideoRef.current.muted = true;
        localVideoRef.current.defaultMuted = true;
        localVideoRef.current.playsInline = true;
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
      return;
    }

    try {
      setCallStatusText('Đang mở camera...');
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      const newTrack = videoStream.getVideoTracks()[0];
      localStreamRef.current.addTrack(newTrack);

      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newTrack);
        } else {
          peerConnectionRef.current.addTrack(newTrack, localStreamRef.current);
        }
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        sendCallSignal({ type: 'OFFER', offer, isVideo: true });
      }

      setIsVideoCall(true);
      setIsVideoEnabled(true);

      if (localVideoRef.current) {
        localVideoRef.current.muted = true;
        localVideoRef.current.defaultMuted = true;
        localVideoRef.current.playsInline = true;
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
      setCallStatusText('Đang đàm thoại');
    } catch (err) {
      console.error("Lỗi kích hoạt camera:", err);
      toast.error("Không thể kích hoạt Camera! Vui lòng kiểm tra quyền thiết bị.");
      setCallStatusText('Đang đàm thoại');
    }
  };

  // Toggle Screen Share - Mượt mà, sắc nét, full màn hình
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      sendCallSignal({ type: 'SCREEN_SHARE', isSharing: false });

      if (peerConnectionRef.current && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender && videoTrack) {
          videoSender.replaceTrack(videoTrack);
        }
      }

      if (localStreamRef.current && localVideoRef.current && isVideoEnabled) {
        const vTrack = localStreamRef.current.getVideoTracks()[0];
        if (vTrack) {
          localVideoRef.current.srcObject = new MediaStream([vTrack]);
          localVideoRef.current.play().catch(() => {});
        }
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor',
            frameRate: { ideal: 30, max: 60 },
            width: { ideal: 1920, max: 2560 },
            height: { ideal: 1080, max: 1440 }
          },
          audio: false
        });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];
        screenTrack.contentHint = 'detail';

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          } else {
            peerConnectionRef.current.addTrack(screenTrack, stream);
          }
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          sendCallSignal({ type: 'OFFER', offer, isVideo: true });
        }

        setIsScreenSharing(true);
        setIsVideoCall(true);
        sendCallSignal({ type: 'SCREEN_SHARE', isSharing: true });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("Lỗi chia sẻ màn hình:", err);
      }
    }
  };

  const displayName = partnerProfile 
    ? (partnerProfile.nickname || partnerProfile.account || partnerProfile.username || 'Thành viên') 
    : (roomInfo?.nameroom || roomInfo?.roomName || (roomId ? `Phòng #${roomId}` : 'Cuộc gọi'));
  const displayAvatar = partnerProfile?.avatar || roomInfo?.avatar;

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* Ẩn Audio remote để phát âm thanh */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* ============================================================== */}
      {/* 1. HEADER CUỘC GỌI TOÀN MÀN HÌNH (DARK ZINC TỐI GIẢN) */}
      {/* ============================================================== */}
      <header className="h-16 px-4 sm:px-8 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
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
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-zinc-800/90 text-zinc-300 border border-zinc-700/80 flex items-center gap-1">
                <Shield size={10} className="text-emerald-400" />
                <span>{isDirectCall ? (isVideoCall ? 'Cuộc gọi video riêng tư' : 'Cuộc gọi thoại riêng tư') : 'Phòng nhóm'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
              <span>{callStatusText}</span>
            </div>
          </div>
        </div>

        {/* Đồng hồ cuộc gọi chuẩn JetBrains Mono tabular-nums */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono tabular-nums text-zinc-200">
          <Radio size={13} className={isConnected ? "text-emerald-400 animate-pulse" : "text-zinc-500"} />
          <span>{formatTime(callDuration)}</span>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. KHU VỰC LIVE CALL STAGE (GRID TẤM HÌNH / AVATAR) */}
      {/* ============================================================== */}
      <main className="flex-1 p-3 sm:p-6 overflow-hidden flex items-center justify-center relative bg-zinc-950">
        <div ref={stageContainerRef} className="w-full max-w-4xl h-full flex items-center justify-center relative">
          
          {/* Nút bật/tắt toàn màn hình sân khấu */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-30 p-2.5 rounded-xl bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-white backdrop-blur-md border border-zinc-700/50 shadow-lg transition-all active:scale-95 flex items-center gap-1.5 text-xs font-medium"
            title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình (F11)"}
          >
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
            <span className="hidden sm:inline">{isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}</span>
          </button>

          {/* Card Remote (Đối phương / Các thành viên) */}
          <div className="w-full h-full bg-zinc-900/60 border border-zinc-800 rounded-3xl overflow-hidden relative shadow-2xl backdrop-blur-sm">
            {/* Video Remote: Luôn nằm trong DOM, dùng object-contain khi chia sẻ màn hình để không bao giờ bị cắt hình */}
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className={`absolute inset-0 w-full h-full ${
                (isScreenSharing || isRemoteScreenSharing) ? 'object-contain bg-black' : 'object-cover sm:object-contain'
              } transition-opacity duration-300 ${isConnected && isVideoCall ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            />

            {/* Trạng thái nếu không có video hoặc đang đàm thoại Audio */}
            {(!isVideoCall || !isConnected) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 p-6 text-center animate-in fade-in duration-300">
                <div className="relative">
                  {/* Vòng lan tỏa âm thanh mềm mại */}
                  {!isConnected && (
                    <div className="absolute -inset-4 rounded-full border border-emerald-500/20 animate-ping pointer-events-none" />
                  )}
                  <div className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-2 border-zinc-700/80 bg-zinc-800/90 flex items-center justify-center shadow-2xl transition-all duration-300 ${isConnected ? 'ring-4 ring-emerald-500/30 ring-offset-4 ring-offset-zinc-950 scale-105' : 'scale-100'}`}>
                    <UserAvatar 
                      avatar={displayAvatar} 
                      name={displayName} 
                      username={partnerProfile?.account || displayName}
                      size={144} 
                      className="w-full h-full object-cover rounded-full" 
                    />
                  </div>
                  {isConnected && (
                    <span className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center text-zinc-950 shadow-md">
                      <Volume2 size={14} />
                    </span>
                  )}
                </div>

                <div className="text-center mt-2 space-y-1">
                  <h3 className="font-semibold text-xl sm:text-2xl text-zinc-100 tracking-tight">{displayName}</h3>
                  {partnerProfile?.account && (
                    <p className="text-xs font-mono text-zinc-500">@{partnerProfile.account}</p>
                  )}
                  <p className="text-xs sm:text-sm text-zinc-400 font-medium pt-1 flex items-center justify-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
                    <span>{callStatusText}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Khung Local Video nhỏ ở góc (Picture in Picture) */}
            <div className="absolute bottom-4 right-4 w-28 h-36 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border border-zinc-700/80 bg-zinc-950/95 shadow-2xl z-20 backdrop-blur-md transition-all">
              {/* Local video luôn hiện diện trong DOM để không bao giờ bị đen hình */}
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full ${isScreenSharing ? 'object-contain' : 'object-cover -scale-x-100'} ${!(isVideoCall && isVideoEnabled) && !isScreenSharing ? 'hidden' : 'block'}`}
              />

              {(!(isVideoCall && isVideoEnabled) && !isScreenSharing) && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2 bg-zinc-900/90 text-center">
                  <UserAvatar 
                    avatar={currentUserAvatar} 
                    name={currentUserName} 
                    username={currentUserName}
                    size={40} 
                    className="w-10 h-10 rounded-full"
                  />
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
      <footer className="h-20 px-4 sm:px-8 border-t border-zinc-800 bg-zinc-900/90 backdrop-blur-md flex items-center justify-center gap-3 sm:gap-4 shrink-0 z-20">
        {/* Nút Bật / Tắt Mic */}
        <button
          type="button"
          onClick={toggleMute}
          className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all active:scale-95 ${
            isMuted 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' 
              : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
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
              : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
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
              : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
          }`}
          title={isScreenSharing ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"}
        >
          {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
        </button>

        {/* Nút Kết thúc cuộc gọi */}
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
