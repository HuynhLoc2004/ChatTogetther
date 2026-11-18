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
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

const CallPage = () => {
  const { roomId, userId: pathUserId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawUserId = pathUserId || searchParams.get('callerId') || searchParams.get('userId') || searchParams.get('user_id') || searchParams.get('targetId') || searchParams.get('senderId') || searchParams.get('partnerId');
  const [partnerId, setPartnerId] = useState(rawUserId ? String(rawUserId).trim() : null);
  const partnerIdRef = useRef(partnerId);
  partnerIdRef.current = partnerId;

  const urlPartnerName = searchParams.get('name') || searchParams.get('callerName') || searchParams.get('partnerName');
  const urlPartnerAvatar = searchParams.get('avatar') || searchParams.get('callerAvatar') || searchParams.get('partnerAvatar');

  const isVideoParam = searchParams.get('type') === 'video' || searchParams.get('video') === 'true';
  const isIncoming = searchParams.get('incoming') === 'true' || searchParams.get('autoAnswer') === 'true';
  const isRoomCall = Boolean(roomId);
  const isDirectCall = Boolean(partnerId || !roomId);

  const currentUserId = (() => {
    let id = localStorage.getItem('user_id');
    if (id) return String(id);
    try {
      const prof = JSON.parse(localStorage.getItem('user_profile') || '{}');
      if (prof?.id || prof?.userId) return String(prof.id || prof.userId);
    } catch (_) { }
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (u?.id || u?.userId) return String(u.id || u.userId);
    } catch (_) { }
    try {
      const token = localStorage.getItem('accesstoken');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload?.user_id) return String(payload.user_id);
        if (payload?.userId) return String(payload.userId);
        if (payload?.id) return String(payload.id);
      }
    } catch (_) { }
    return null;
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
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isRemoteVideoEnabled, setIsRemoteVideoEnabled] = useState(isVideoParam);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stageContainerRef = useRef(null);

  // Mở khóa âm thanh tức thì và tự động kích hoạt AudioContext đàm thoại trong nền (0ms, không cần banner phiền toái)
  useEffect(() => {
    const silentUnlock = () => {
      if (remoteAudioCtxRef.current && remoteAudioCtxRef.current.state === 'suspended') {
        remoteAudioCtxRef.current.resume().catch(() => { });
      }
      if (remoteAudioRef.current && remoteAudioRef.current.paused) {
        remoteAudioRef.current.play().catch(() => { });
      }
    };
    window.addEventListener('touchstart', silentUnlock, { passive: true });
    window.addEventListener('click', silentUnlock, { passive: true });
    window.addEventListener('keydown', silentUnlock, { passive: true });
    return () => {
      window.removeEventListener('touchstart', silentUnlock);
      window.removeEventListener('click', silentUnlock);
      window.removeEventListener('keydown', silentUnlock);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!stageContainerRef.current) return;
    if (!document.fullscreenElement) {
      stageContainerRef.current.requestFullscreen?.().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => { });
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
  const [partnerProfile, setPartnerProfile] = useState(() => {
    if (urlPartnerName || urlPartnerAvatar) {
      return {
        id: rawUserId,
        nickname: urlPartnerName,
        account: urlPartnerName,
        avatar: urlPartnerAvatar || ''
      };
    }
    return null;
  });
  const [roomInfo, setRoomInfo] = useState(null);

  // Refs
  const stompClient = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteAudioCtxRef = useRef(null);
  const webAudioSourceRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const durationRef = useRef(0);
  const dmRoomIdRef = useRef(null);
  const audioContextRef = useRef(null);
  const ringOscillatorRef = useRef(null);
  const ringGainRef = useRef(null);
  const ringIntervalRef = useRef(null);
  const isCallEndedRef = useRef(false);
  const isCallConnectedRef = useRef(false);
  const iceCandidateQueueRef = useRef([]);
  const localCandidatesHistoryRef = useRef([]);
  const lastOfferRef = useRef(null);
  const lastOfferSdpRef = useRef(null);
  const lastAnswerRef = useRef(null);
  const isProcessingOfferRef = useRef(false);
  const hasHandledDeclineRef = useRef(false);
  const disconnectTimerRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const acceptRetryTimerRef = useRef(null);
  const callIdRef = useRef(searchParams.get('callId') || (`call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`));

  // Mutable refs to prevent useEffect from re-triggering and tearing down WebRTC
  const isIncomingRef = useRef(isIncoming);
  isIncomingRef.current = isIncoming;
  const isVideoParamRef = useRef(isVideoParam);
  isVideoParamRef.current = isVideoParam;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  const handleCallSignalRef = useRef(null);
  const sendCallSignalRef = useRef(null);
  const endCallRef = useRef(null);
  const startRingAudioRef = useRef(null);
  const stopRingAudioRef = useRef(null);
  const cleanupCallRef = useRef(null);

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
        localVideoRef.current.play().catch(() => { });
      } else if (isVideoEnabled && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack && videoTrack.enabled) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => { });
        } else {
          localVideoRef.current.srcObject = null;
        }
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [isVideoEnabled, isVideoCall, isScreenSharing]);

  // Luôn đảm bảo remoteVideoRef nhận đúng thuộc tính autoplay/playsinline trên iOS WebKit và render tức thì
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = true;
      remoteVideoRef.current.defaultMuted = true;
      remoteVideoRef.current.playsInline = true;
      remoteVideoRef.current.setAttribute('playsinline', '');
      remoteVideoRef.current.setAttribute('webkit-playsinline', '');

      if (isConnected && hasRemoteVideo && isRemoteVideoEnabled && remoteStreamRef.current) {
        if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
        remoteVideoRef.current.play().catch(() => { });
      }
    }
  }, [isConnected, hasRemoteVideo, isRemoteVideoEnabled]);

  // 1. Fetch metadata (Partner or Room) & pre-fetch direct room ID
  useEffect(() => {
    let isMounted = true;
    const fetchTargetMeta = async () => {
      try {
        const currentTargetId = partnerId || rawUserId;
        if (currentTargetId) {
          const [profRes, directRoomRes] = await Promise.allSettled([
            axiosClient.get('/users/profile', { params: { user_id: currentTargetId } }),
            axiosClient.get(`/message/direct/${currentTargetId}`)
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
  }, [partnerId, isRoomCall, roomId, rawUserId]);

  // Kiểm tra an toàn: Nếu không có người nhận hoặc phòng cuộc gọi sau 6 giây
  useEffect(() => {
    if (!partnerId && !roomId) {
      const t = setTimeout(() => {
        if (!partnerIdRef.current && !roomId) {
          toast.error("Không tìm thấy thông tin đối phương hoặc phòng gọi!");
          navigate('/messages');
        }
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [partnerId, roomId, navigate]);

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
        try { ringGainRef.current.gain.setValueAtTime(0, audioContextRef.current?.currentTime || 0); } catch (_) { }
        ringGainRef.current = null;
      }
      if (ringOscillatorRef.current) {
        try { ringOscillatorRef.current.stop(); } catch (_) { }
        try { ringOscillatorRef.current.disconnect(); } catch (_) { }
        ringOscillatorRef.current = null;
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (_) { }
        audioContextRef.current = null;
      }
      // Dập tắt bất kỳ chuông nào còn sót lại từ banner toàn cục hoặc component khác
      window.dispatchEvent(new CustomEvent('talovin_stop_all_ring_audio'));
    } catch (e) { }
  }, []);

  const startRingAudio = useCallback(() => {
    if (isIncomingRef.current || isConnected || isCallConnectedRef.current) return;
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
        if (!audioContextRef.current || audioContextRef.current.state === 'closed' || !ringGainRef.current) {
          if (ringIntervalRef.current) {
            clearInterval(ringIntervalRef.current);
            ringIntervalRef.current = null;
          }
          return;
        }
        beeping = !beeping;
        try {
          if (ringGainRef.current && audioContextRef.current) {
            ringGainRef.current.gain.setValueAtTime(beeping ? 0.04 : 0, audioContextRef.current.currentTime);
          }
        } catch (_) { }
      }, 1400);
    } catch (e) { }
  }, [isConnected, stopRingAudio]);

  // 4. Cleanup Call Resources (Zero-Lag + An toàn WebSocket)
  const cleanupCall = useCallback(() => {
    stopRingAudio();
    if (acceptRetryTimerRef.current) {
      clearInterval(acceptRetryTimerRef.current);
      acceptRetryTimerRef.current = null;
    }
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
      try {
        peerConnectionRef.current.close();
      } catch (_) { }
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (webAudioSourceRef.current) {
      try { webAudioSourceRef.current.disconnect(); } catch (_) { }
      webAudioSourceRef.current = null;
    }
    if (remoteAudioCtxRef.current) {
      try { remoteAudioCtxRef.current.close(); } catch (_) { }
      remoteAudioCtxRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => track.stop());
      remoteStreamRef.current = null;
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
        } catch (_) { }
      }, 300);
      stompClient.current = null;
    }
  }, [stopRingAudio]);

  // 5. Send Signal Helper
  const sendCallSignal = useCallback((payload) => {
    if (!stompClient.current || !stompClient.current.connected) return;

    const baseData = {
      ...payload,
      callId: callIdRef.current,
      callerId: currentUserId,
      senderId: currentUserId,
      callerName: currentUserName,
      callerAvatar: currentUserAvatar,
      timestamp: Date.now()
    };

    const targetPartner = partnerIdRef.current || partnerId;
    if (targetPartner) {
      stompClient.current.send(`/app/call/user/${targetPartner}`, {}, JSON.stringify(baseData));
    } else if (isRoomCall && roomId) {
      stompClient.current.send(`/app/call/${roomId}`, {}, JSON.stringify(baseData));
    }
  }, [currentUserId, currentUserName, currentUserAvatar, partnerId, isRoomCall, roomId]);

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
    const effectivePartner = partnerIdRef.current || partnerId;
    const trueCallerId = isIncoming ? effectivePartner : currentUserId;
    const trueTargetId = isIncoming ? currentUserId : effectivePartner;
    const resolvedRoomId = dmRoomIdRef.current || roomId;

    const callPayload = {
      callId: callIdRef.current,
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
        id: callIdRef.current,
        callId: callIdRef.current,
        userId: Number(trueCallerId),
        senderId: Number(trueCallerId),
        targetUserId: Number(trueTargetId),
        message: logText,
        timeSend: now.toISOString(),
        formattedTime: timeStr,
        isRead: false,
        pending: false
      };

      const partnerKey = String(effectivePartner || '');
      const userPrefix = currentUserId ? `${currentUserId}_` : '';
      const storageKey = `talovin_dm_msgs_${userPrefix}${partnerKey}`;
      const existingRaw = localStorage.getItem(storageKey);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      if (!existing.some(m => m.id === optimisticMsg.id || (m.message === logText && Math.abs(new Date(m.timeSend || 0).getTime() - now.getTime()) < 3000))) {
        const updated = [...existing, optimisticMsg];
        localStorage.setItem(storageKey, JSON.stringify(updated.slice(-50)));
        if (resolvedRoomId) {
          localStorage.setItem(`talovin_dm_msgs_${userPrefix}${resolvedRoomId}`, JSON.stringify(updated.slice(-50)));
        }
      }
      window.dispatchEvent(new CustomEvent('talovin_new_message', { detail: optimisticMsg }));
    } catch (_) { }

    if (shouldSendSignal) {
      // 1. Gửi tín hiệu END cho đối phương qua WebSocket (để đối phương lập tức thoát cuộc gọi)
      sendCallSignal(callPayload);

      // 2. Gửi duy nhất 1 request lưu log cuộc gọi qua REST API đáng tin cậy
      try {
        axiosClient.post('/call/end', callPayload).catch(() => { });
      } catch (_) { }
    }

    cleanupCall();

    // Giữ trễ nhỏ 100ms để browser kịp flush dữ liệu socket ra ngoài trước khi chuyển route
    setTimeout(() => {
      // 1. Ưu tiên tuyệt đối fromParam để quay về đúng màn hình ban đầu và THAY THẾ (replace) route /call khỏi lịch sử
      const fromParam = searchParams.get('from');
      if (fromParam) {
        try {
          const decoded = decodeURIComponent(fromParam);
          if (decoded && decoded !== window.location.pathname) {
            navigate(decoded, { replace: true });
            return;
          }
        } catch (_) { }
      }

      // 2. Nếu có lịch sử router trước đó
      if (window.history.state && window.history.state.idx > 0) {
        navigate(-1);
        return;
      }

      // 3. Fallback an toàn
      if (effectivePartner) {
        navigate(`/messages/${effectivePartner}`, { replace: true });
      } else if (isRoomCall && roomId) {
        navigate(`/room/${roomId}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }, 100);
  }, [sendCallSignal, cleanupCall, stopRingAudio, isVideoParam, isVideoCall, partnerId, isRoomCall, roomId, searchParams, navigate, currentUserId]);

  // 7. Handle Signal Incoming
  const handleCallSignal = useCallback(async (msg) => {
    if (!msg) return;
    const actualSender = msg.endedBy || msg.senderId;
    // Bỏ qua nếu chính mình là người gửi đi
    if (actualSender && String(actualSender) === String(currentUserId)) return;
    if (!actualSender && msg.type !== 'DECLINE' && msg.type !== 'CANCEL' && msg.type !== 'END' && String(msg.callerId) === String(currentUserId)) return;

    // Bắt và cập nhật partnerId động từ gói tin nhận được nếu chưa có
    const partnerCandidate = msg.callerId || msg.senderId || msg.endedBy || msg.userId;
    if (partnerCandidate && String(partnerCandidate) !== String(currentUserId)) {
      const candStr = String(partnerCandidate).trim();
      if (!partnerIdRef.current || partnerIdRef.current !== candStr) {
        setPartnerId(candStr);
        partnerIdRef.current = candStr;
      }
    }

    if (msg.type === 'RINGING') {
      if (isIncoming) {
        // Đối phương đang đổ chuông, gửi ngay ACCEPT để bắt đầu đàm thoại
        sendCallSignal({ type: 'ACCEPT' });
      }
    } else if (msg.type === 'OFFER') {
      try {
        stopRingAudio();
        if (acceptRetryTimerRef.current) {
          clearInterval(acceptRetryTimerRef.current);
          acceptRetryTimerRef.current = null;
        }
        setCallStatusText('Đang thiết lập kênh đàm thoại...');
        if (typeof msg.isVideoEnabled === 'boolean') {
          setIsRemoteVideoEnabled(msg.isVideoEnabled);
          if (!msg.isVideoEnabled) setHasRemoteVideo(false);
        } else if (typeof msg.isVideo === 'boolean') {
          setIsRemoteVideoEnabled(msg.isVideo);
          if (!msg.isVideo) setHasRemoteVideo(false);
        }
        if (msg.isVideo) setIsVideoCall(true);
        if (!peerConnectionRef.current) return;
        const pc = peerConnectionRef.current;

        // 1. Chống race condition nếu đang xử lý một gói tin OFFER khác
        if (isProcessingOfferRef.current) {
          return;
        }

        // 2. Nếu OFFER này trùng lặp với OFFER đã nhận và đã có ANSWER sẵn, gửi lại ANSWER cũ ngay lập tức
        if (lastOfferSdpRef.current === msg.offer?.sdp && lastAnswerRef.current) {
          sendCallSignal({
            type: 'ANSWER',
            answer: lastAnswerRef.current,
            isVideo: Boolean(isVideoParam || isVideoCall || isVideoEnabled),
            isVideoEnabled: Boolean(isVideoEnabled)
          });
          return;
        }

        isProcessingOfferRef.current = true;
        lastOfferSdpRef.current = msg.offer?.sdp;

        // 3. Xử lý Glare: Nếu cả 2 bên cùng tạo Offer (have-local-offer), rollback để nhận Offer của đối phương
        if (pc.signalingState === 'have-local-offer') {
          try {
            await pc.setLocalDescription({ type: 'rollback' });
          } catch (_) { }
        }

        if (pc.signalingState !== 'stable') {
          isProcessingOfferRef.current = false;
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));

        // Đổ toàn bộ ICE candidate đã lưu trong hàng đợi
        while (iceCandidateQueueRef.current.length > 0) {
          const cand = iceCandidateQueueRef.current.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (_) { }
        }

        // 4. Chỉ tạo và gán Answer nếu pc đang ở đúng trạng thái have-remote-offer
        if (pc.signalingState === 'have-remote-offer') {
          const answer = await pc.createAnswer();
          if (pc.signalingState === 'have-remote-offer') {
            await pc.setLocalDescription(answer);
            const answerPayload = { type: answer.type, sdp: answer.sdp };
            lastAnswerRef.current = answerPayload;
            sendCallSignal({
              type: 'ANSWER',
              answer: answerPayload,
              isVideo: Boolean(isVideoParam || isVideoCall || isVideoEnabled),
              isVideoEnabled: Boolean(isVideoEnabled)
            });
          }
        }
      } catch (e) {
        console.error("Lỗi xử lý OFFER:", e);
      } finally {
        isProcessingOfferRef.current = false;
      }
    } else if (msg.type === 'ACCEPT') {
      // Đối phương đã bấm nghe máy -> Dừng ngay chuông chờ và gửi OFFER
      try {
        stopRingAudio();
        const pc = peerConnectionRef.current;
        if (!pc) return;

        // Nếu cuộc gọi đã kết nối thành công (đã có remoteDescription), tuyệt đối không tạo lại OFFER để tránh lỗi InvalidAccessError m-lines
        if (pc.remoteDescription) {
          return;
        }

        setCallStatusText('Đối phương đã nhận máy. Đang kết nối...');

        if (pc.signalingState === 'have-local-offer' && lastOfferRef.current) {
          // Bên nhận thử gửi lại ACCEPT (retry packet), gửi lại ngay bản OFFER đã tạo
          sendCallSignal({
            type: 'OFFER',
            offer: lastOfferRef.current,
            isVideo: Boolean(isVideoParam || isVideoCall || isVideoEnabled),
            isVideoEnabled: Boolean(isVideoEnabled)
          });
          return;
        }

        if (pc.signalingState === 'stable') {
          const offer = await pc.createOffer();
          if (pc.signalingState === 'stable') {
            await pc.setLocalDescription(offer);
            const offerPayload = { type: offer.type, sdp: offer.sdp };
            lastOfferRef.current = offerPayload;
            sendCallSignal({
              type: 'OFFER',
              offer: offerPayload,
              isVideo: Boolean(isVideoParam || isVideoCall || isVideoEnabled),
              isVideoEnabled: Boolean(isVideoEnabled)
            });
          }
        }
      } catch (e) {
        console.error("Lỗi gửi OFFER sau ACCEPT:", e);
      }
    } else if (msg.type === 'ANSWER') {
      try {
        stopRingAudio();
        setCallStatusText('Đối phương đã trả lời. Đang kết nối đường truyền...');
        if (typeof msg.isVideoEnabled === 'boolean') {
          setIsRemoteVideoEnabled(msg.isVideoEnabled);
          if (!msg.isVideoEnabled) setHasRemoteVideo(false);
        } else if (typeof msg.isVideo === 'boolean') {
          setIsRemoteVideoEnabled(msg.isVideo);
          if (!msg.isVideo) setHasRemoteVideo(false);
        }
        if (msg.isVideo) setIsVideoCall(true);
        const pc = peerConnectionRef.current;
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
          // Đổ toàn bộ ICE candidate trong hàng đợi
          while (iceCandidateQueueRef.current.length > 0) {
            const cand = iceCandidateQueueRef.current.shift();
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (_) { }
          }
        }
      } catch (e) {
        console.error("Lỗi xử lý ANSWER:", e);
      }
    } else if (msg.type === 'MEDIA_STATE') {
      if (typeof msg.isVideoEnabled === 'boolean') {
        setIsRemoteVideoEnabled(msg.isVideoEnabled);
        if (!msg.isVideoEnabled) {
          setHasRemoteVideo(false);
        }
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
      if (hasHandledDeclineRef.current) return;
      hasHandledDeclineRef.current = true;
      stopRingAudio();
      setCallStatusText('Đối phương hiện đang bận hoặc từ chối');
      const now = Date.now();
      if (!window._lastBusyToastTime || now - window._lastBusyToastTime > 2500) {
        window._lastBusyToastTime = now;
        toast.dismiss('call_busy_toast');
        toast.error('Đối phương hiện đang bận hoặc không thể bắt máy!', { id: 'call_busy_toast', duration: 3000 });
      }
      setTimeout(() => endCall(false), 300);
    } else if (msg.type === 'END' || msg.type === 'CANCEL') {
      stopRingAudio();
      setCallStatusText('Cuộc gọi đã kết thúc');
      // Kết thúc ngay lập tức không trễ 1 mili-giây
      endCall(false);
    }
  }, [currentUserId, sendCallSignal, stopRingAudio, isVideoParam, isVideoCall, isVideoEnabled, endCall]);

  // Đồng bộ mutable refs mỗi render để không làm re-run effect WebRTC
  useEffect(() => {
    handleCallSignalRef.current = handleCallSignal;
    sendCallSignalRef.current = sendCallSignal;
    endCallRef.current = endCall;
    startRingAudioRef.current = startRingAudio;
    stopRingAudioRef.current = stopRingAudio;
    cleanupCallRef.current = cleanupCall;
  });

  // 8. Initialize WebRTC Media & STOMP Socket (Chỉ mount 1 lần duy nhất)
  useEffect(() => {
    let isActive = true;

    // Ngay khi mount CallPage, dập tắt toàn bộ chuông reo từ banner hoặc component khác
    window.dispatchEvent(new CustomEvent('talovin_stop_all_ring_audio'));
    if (isIncomingRef.current) {
      stopRingAudioRef.current?.();
    }

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

        // Chuẩn bị sẵn video transceiver để đàm thoại video 2 chiều không bị chậm trễ
        if (stream.getVideoTracks().length === 0) {
          try {
            pc.addTransceiver('video', { direction: 'recvonly' });
          } catch (_) { }
        }

        // ICE Candidate
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            localCandidatesHistoryRef.current.push(event.candidate);
            sendCallSignalRef.current?.({ type: 'CANDIDATE', candidate: event.candidate });
          }
        };

        // Track nhận từ remote
        pc.ontrack = (event) => {
          if (event.track) {
            if (event.track.kind === 'video') {
              const vTrack = event.track;
              const inboundStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([vTrack]);
              remoteStreamRef.current = inboundStream;

              // Chỉ bật hasRemoteVideo nếu track thật sự đang truyền dữ liệu (không bị mute / rỗng)
              const isLive = !vTrack.muted && vTrack.readyState === 'live';
              setHasRemoteVideo(isLive);
              setIsRemoteVideoEnabled(true);
              setIsVideoCall(true);

              vTrack.onmute = () => {
                setHasRemoteVideo(false);
              };
              vTrack.onunmute = () => {
                setHasRemoteVideo(true);
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.play().catch(() => { });
                }
              };
              vTrack.onended = () => {
                setHasRemoteVideo(false);
              };

              if (remoteVideoRef.current) {
                remoteVideoRef.current.muted = true;
                remoteVideoRef.current.defaultMuted = true;
                remoteVideoRef.current.playsInline = true;
                remoteVideoRef.current.setAttribute('playsinline', '');
                remoteVideoRef.current.setAttribute('webkit-playsinline', '');
                remoteVideoRef.current.srcObject = inboundStream;
                remoteVideoRef.current.play().catch(() => { });
              }
            }

            if (event.track.kind === 'audio') {
              const aTrack = event.track;
              const streamToPlay = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([aTrack]);

              // Kênh 1: HTML5 Audio Tag
              if (remoteAudioRef.current) {
                remoteAudioRef.current.muted = false;
                remoteAudioRef.current.volume = 1.0;
                remoteAudioRef.current.playsInline = true;
                remoteAudioRef.current.setAttribute('playsinline', '');
                remoteAudioRef.current.setAttribute('webkit-playsinline', '');
                remoteAudioRef.current.srcObject = streamToPlay;
                remoteAudioRef.current.play().catch(() => { });
              }

              // Kênh 2: Web Audio API (Bypass 100% rào cản Autoplay trên Mobile Safari/Chrome, phát tiếng ngay lập tức)
              try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                  if (!remoteAudioCtxRef.current || remoteAudioCtxRef.current.state === 'closed') {
                    remoteAudioCtxRef.current = new AudioCtx();
                  }
                  const ctx = remoteAudioCtxRef.current;
                  if (ctx.state === 'suspended') {
                    ctx.resume().catch(() => { });
                  }
                  if (!webAudioSourceRef.current) {
                    const src = ctx.createMediaStreamSource(streamToPlay);
                    src.connect(ctx.destination);
                    webAudioSourceRef.current = src;
                  }
                }
              } catch (_) { }
            }
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
          } else if (pc.connectionState === 'connecting') {
            setCallStatusText('Đang thiết lập kết nối đàm thoại...');
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setCallStatusText('Đang thử kết nối lại...');
            if (!disconnectTimerRef.current) {
              disconnectTimerRef.current = setTimeout(() => {
                if (peerConnectionRef.current && (peerConnectionRef.current.connectionState === 'disconnected' || peerConnectionRef.current.connectionState === 'failed')) {
                  endCallRef.current?.(false);
                }
              }, 15000);
            }
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            stopRingAudio();
            setIsConnected(true);
            setCallStatusText('Đang đàm thoại');
            if (disconnectTimerRef.current) {
              clearTimeout(disconnectTimerRef.current);
              disconnectTimerRef.current = null;
            }
          } else if (pc.iceConnectionState === 'checking') {
            setCallStatusText('Đang tìm đường truyền tốt nhất...');
          } else if (pc.iceConnectionState === 'failed') {
            pc.restartIce?.();
          }
        };

        // Kết nối WebSocket STOMP chuẩn native browser kèm Authorization token (Tự động kết nối lại khi có gián đoạn)
        let isStompMounted = true;
        let stompRetryTimer = null;

        const connectStomp = () => {
          if (!isActive || !isStompMounted || isCallEndedRef.current) return;
          try {
            if (stompClient.current && stompClient.current.connected) {
              try { stompClient.current.disconnect(); } catch (_) { }
            }
          } catch (_) { }

          const stomp = createStompClient();
          stompClient.current = stomp;
          const authToken = localStorage.getItem('accesstoken');
          const connHeaders = {};
          if (authToken) connHeaders['Authorization'] = `Bearer ${authToken}`;
          if (currentUserId) connHeaders['userId'] = String(currentUserId);

          stomp.connect(connHeaders, async () => {
            if (!isActive || !isStompMounted || isCallEndedRef.current) return;

            // Subscribe topic nhận tín hiệu cá nhân (Direct call)
            if (currentUserId) {
              stomp.subscribe(`/topic/call/user/${currentUserId}`, (frame) => {
                try {
                  const msg = JSON.parse(frame.body);
                  handleCallSignalRef.current?.(msg);
                } catch (e) { }
              });
            }
            if (roomId) {
              stomp.subscribe(`/topic/call/${roomId}`, (frame) => {
                try {
                  const msg = JSON.parse(frame.body);
                  handleCallSignalRef.current?.(msg);
                } catch (e) { }
              });
            }

            if (isIncomingRef.current) {
              // Là người nhận máy: gửi tín hiệu ACCEPT để người gọi biết và gửi OFFER
              setCallStatusText('Đang thiết lập kênh đàm thoại...');
              sendCallSignalRef.current?.({ type: 'ACCEPT' });

              // Gửi lặp lại ACCEPT sau mỗi 1.2s (tối đa 6 lần) phòng ngừa trường hợp gói tin đầu bị lỡ khi bên gọi đang mount
              let acceptTries = 0;
              if (acceptRetryTimerRef.current) clearInterval(acceptRetryTimerRef.current);
              acceptRetryTimerRef.current = setInterval(() => {
                acceptTries++;
                const pc = peerConnectionRef.current;
                if (acceptTries > 6 || (pc && pc.remoteDescription) || (pc && pc.signalingState !== 'stable')) {
                  if (acceptRetryTimerRef.current) {
                    clearInterval(acceptRetryTimerRef.current);
                    acceptRetryTimerRef.current = null;
                  }
                  return;
                }
                sendCallSignalRef.current?.({ type: 'ACCEPT' });
              }, 1200);
            } else {
              // Là người khởi tạo cuộc gọi: bắt đầu đổ chuông và gửi tín hiệu RINGING
              startRingAudioRef.current?.();
              setCallStatusText('Đang đổ chuông...');
              sendCallSignalRef.current?.({ type: 'RINGING', isVideo: isVideoParamRef.current });

              // Tự động ngắt sau 45s nếu đối phương không bắt máy
              if (!connectTimeoutRef.current) {
                connectTimeoutRef.current = setTimeout(() => {
                  toast.error('Đối phương không trả lời cuộc gọi.');
                  endCallRef.current?.(true);
                }, 45000);
              }
            }
          }, (err) => {
            console.warn("Lỗi kết nối máy chủ tín hiệu, tự động kết nối lại sau 1.5s...", err);
            setCallStatusText('Đang kết nối lại đường truyền đàm thoại...');
            if (isActive && isStompMounted && !isCallEndedRef.current) {
              stompRetryTimer = setTimeout(connectStomp, 1500);
            }
          });
        };

        connectStomp();

      } catch (err) {
        console.error("Lỗi khởi tạo cuộc gọi WebRTC:", err);
        setCallStatusText('Không thể truy cập Microphone hoặc Camera.');
        toast.error('Vui lòng cấp quyền Microphone & Camera trong trình duyệt để đàm thoại!');
      }
    };

    initCall();

    return () => {
      isActive = false;
      cleanupCallRef.current?.();
    };
  }, []); // Chỉ mount 1 lần duy nhất, tuyệt đối không re-run WebRTC khiến đổ chuông ngược lại

  // Khởi động đồng hồ đếm thời gian CHỈ KHI cuộc gọi đã thực sự kết nối (đối phương đã nhấc máy)
  useEffect(() => {
    if (isConnected) {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [isConnected]);

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
      const nextState = !existingTrack.enabled;
      existingTrack.enabled = nextState;
      setIsVideoEnabled(nextState);
      setIsVideoCall(true);
      sendCallSignal({ type: 'MEDIA_STATE', isVideoEnabled: nextState });

      if (localVideoRef.current) {
        if (nextState) {
          localVideoRef.current.muted = true;
          localVideoRef.current.defaultMuted = true;
          localVideoRef.current.playsInline = true;
          localVideoRef.current.setAttribute('playsinline', '');
          localVideoRef.current.setAttribute('webkit-playsinline', '');
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => { });
        } else {
          localVideoRef.current.srcObject = null;
        }
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
        const transceivers = peerConnectionRef.current.getTransceivers();
        const videoTransceiver = transceivers.find(t => (t.sender && t.sender.track && t.sender.track.kind === 'video') || (t.receiver && t.receiver.track && t.receiver.track.kind === 'video'));
        if (videoTransceiver && videoTransceiver.sender) {
          videoTransceiver.direction = 'sendrecv';
          await videoTransceiver.sender.replaceTrack(newTrack);
        } else {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(newTrack);
          } else {
            peerConnectionRef.current.addTrack(newTrack, localStreamRef.current);
          }
        }
        if (peerConnectionRef.current.signalingState === 'stable') {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          sendCallSignal({
            type: 'OFFER',
            offer: { type: offer.type, sdp: offer.sdp },
            isVideo: true,
            isVideoEnabled: true
          });
        }
      }

      setIsVideoCall(true);
      setIsVideoEnabled(true);
      sendCallSignal({ type: 'MEDIA_STATE', isVideoEnabled: true });

      if (localVideoRef.current) {
        localVideoRef.current.muted = true;
        localVideoRef.current.defaultMuted = true;
        localVideoRef.current.playsInline = true;
        localVideoRef.current.setAttribute('playsinline', '');
        localVideoRef.current.setAttribute('webkit-playsinline', '');
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => { });
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
          localVideoRef.current.play().catch(() => { });
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
          const transceivers = peerConnectionRef.current.getTransceivers();
          const videoTransceiver = transceivers.find(t => (t.sender && t.sender.track && t.sender.track.kind === 'video') || (t.receiver && t.receiver.track && t.receiver.track.kind === 'video'));
          if (videoTransceiver && videoTransceiver.sender) {
            videoTransceiver.direction = 'sendrecv';
            videoTransceiver.sender.replaceTrack(screenTrack);
          } else {
            const senders = peerConnectionRef.current.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            if (videoSender) {
              videoSender.replaceTrack(screenTrack);
            } else {
              peerConnectionRef.current.addTrack(screenTrack, stream);
            }
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
          localVideoRef.current.play().catch(() => { });
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
    <div
      className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between overflow-hidden select-none font-sans"
      onClick={() => {
        if (remoteAudioRef.current && remoteAudioRef.current.paused) {
          remoteAudioRef.current.play().catch(() => { });
        }
      }}
    >
      {/* Thẻ audio remote phát âm thanh đàm thoại */}
      <audio ref={remoteAudioRef} autoPlay playsInline controls={false} />

      {/* ============================================================== */}
      {/* 1. HEADER CUỘC GỌI TOÀN MÀN HÌNH (DARK ZINC TỐI GIẢN & SAFE AREA) */}
      {/* ============================================================== */}
      <header 
        style={{ paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))', paddingBottom: '10px' }}
        className="min-h-16 px-4 sm:px-8 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md flex items-center justify-between shrink-0 z-20"
      >
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
              muted
              onPlaying={() => setHasRemoteVideo(true)}
              onLoadedMetadata={(e) => {
                try { e.target.play().catch(() => {}); } catch (_) { }
              }}
              className={`absolute inset-0 w-full h-full ${(isScreenSharing || isRemoteScreenSharing) ? 'object-contain bg-black' : 'object-cover sm:object-contain'
                } transition-opacity duration-300 ${isConnected && hasRemoteVideo && isRemoteVideoEnabled ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}`}
            />

            {/* Trạng thái nếu không có video hoặc đối phương chưa bật video hoặc đang đàm thoại Audio */}
            {(!isConnected || !hasRemoteVideo || !isRemoteVideoEnabled) && (
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
                    <span>
                      {!isConnected
                        ? callStatusText
                        : ((isVideoCall || isVideoParam) && (!hasRemoteVideo || !isRemoteVideoEnabled) ? 'Đối phương chưa bật camera' : 'Đang đàm thoại')}
                    </span>
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
      {/* 3. THANH ĐIỀU KHIỂN DƯỚI ĐÁY (ACTION CONTROLS BAR & SAFE AREA) */}
      {/* ============================================================== */}
      <footer 
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', paddingTop: '14px' }}
        className="min-h-20 px-4 sm:px-8 border-t border-zinc-800 bg-zinc-900/90 backdrop-blur-md flex items-center justify-center gap-3 sm:gap-4 shrink-0 z-20"
      >
        {/* Nút Bật / Tắt Mic */}
        <button
          type="button"
          onClick={toggleMute}
          className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all active:scale-95 ${isMuted
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
          className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all active:scale-95 ${!isVideoEnabled
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
          className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all active:scale-95 ${isScreenSharing
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
