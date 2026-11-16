import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, PhoneOff, Video, Volume2 } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { createStompClient } from '../utils/stompClient';
import UserAvatar from './UserAvatar';

const GlobalCallBanner = () => {
  const [incomingCall, setIncomingCall] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const stompClient = useRef(null);
  const ringAudioCtx = useRef(null);
  const ringOscillator = useRef(null);
  const ringGain = useRef(null);
  const ringInterval = useRef(null);
  const autoDismissTimer = useRef(null);

  const [effectiveUserId, setEffectiveUserId] = useState(() => localStorage.getItem('user_id'));

  // Đồng bộ reactive user_id khi đăng nhập hoặc thay đổi tài khoản
  useEffect(() => {
    const checkUserId = () => {
      const uid = localStorage.getItem('user_id');
      if (uid && uid !== effectiveUserId) {
        setEffectiveUserId(uid);
      }
    };
    checkUserId();
    window.addEventListener('storage', checkUserId);
    const interval = setInterval(checkUserId, 1500);
    return () => {
      window.removeEventListener('storage', checkUserId);
      clearInterval(interval);
    };
  }, [effectiveUserId]);

  // 1. Play Synthesized Ringtone
  const startRingingSound = useCallback(() => {
    try {
      if (ringInterval.current) {
        clearInterval(ringInterval.current);
        ringInterval.current = null;
      }
      if (ringOscillator.current) {
        try { ringOscillator.current.stop(); ringOscillator.current.disconnect(); } catch (_) {}
        ringOscillator.current = null;
      }
      if (ringAudioCtx.current) {
        try { ringAudioCtx.current.close(); } catch (_) {}
        ringAudioCtx.current = null;
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ringAudioCtx.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      ringGain.current = gain;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ringOscillator.current = osc;

      // Pulse ringtone pattern
      let toggle = true;
      ringInterval.current = setInterval(() => {
        if (!ringAudioCtx.current || ringAudioCtx.current.state === 'closed') {
          if (ringInterval.current) {
            clearInterval(ringInterval.current);
            ringInterval.current = null;
          }
          return;
        }
        toggle = !toggle;
        try {
          gain.gain.setValueAtTime(toggle ? 0.06 : 0, ctx.currentTime);
        } catch (_) {}
      }, 1000);
    } catch (e) {}
  }, []);

  const stopRingingSound = useCallback(() => {
    try {
      if (ringInterval.current) {
        clearInterval(ringInterval.current);
        ringInterval.current = null;
      }
      if (ringGain.current) {
        try { ringGain.current.gain.setValueAtTime(0, ringAudioCtx.current?.currentTime || 0); } catch (_) {}
        ringGain.current = null;
      }
      if (ringOscillator.current) {
        try { ringOscillator.current.stop(); } catch (_) {}
        try { ringOscillator.current.disconnect(); } catch (_) {}
        ringOscillator.current = null;
      }
      if (ringAudioCtx.current) {
        try { ringAudioCtx.current.close(); } catch (_) {}
        ringAudioCtx.current = null;
      }
    } catch (e) {}
  }, []);

  // 2. Clear auto-dismiss timer
  const clearDismissTimer = useCallback(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
  }, []);

  // 3. Connect to WebSocket & listen for calls
  useEffect(() => {
    if (!effectiveUserId) return;

    let isMounted = true;
    const client = createStompClient();
    stompClient.current = client;

    client.connect({}, () => {
      if (!isMounted) return;

      // Subscribe direct call signal for this user
      client.subscribe(`/topic/call/user/${effectiveUserId}`, (frame) => {
        try {
          const msg = JSON.parse(frame.body);
          if (!msg || String(msg.callerId) === String(effectiveUserId)) return;

          // Don't show banner if already inside /call
          if (window.location.pathname.startsWith('/call')) return;

          if (msg.type === 'OFFER' || msg.type === 'RINGING') {
            setIncomingCall(msg);
            startRingingSound();

            clearDismissTimer();
            // Auto dismiss after 30s
            autoDismissTimer.current = setTimeout(() => {
              setIncomingCall(null);
              stopRingingSound();
            }, 30000);
          } else if (msg.type === 'END' || msg.type === 'CANCEL' || msg.type === 'BUSY' || msg.type === 'DECLINE') {
            setIncomingCall(null);
            stopRingingSound();
            clearDismissTimer();
          }
        } catch (e) {}
      });

    }, () => {});

    return () => {
      isMounted = false;
      stopRingingSound();
      clearDismissTimer();
      if (client && client.connected) {
        client.disconnect();
      }
    };
  }, [effectiveUserId, startRingingSound, stopRingingSound, clearDismissTimer]);

  // Dismiss on route change to /call
  useEffect(() => {
    if (location.pathname.startsWith('/call')) {
      setIncomingCall(null);
      stopRingingSound();
      clearDismissTimer();
    }
  }, [location.pathname, stopRingingSound, clearDismissTimer]);

  // 4. Accept Call
  const handleAccept = () => {
    if (!incomingCall) return;
    const isVid = Boolean(incomingCall.isVideo);
    const callerId = incomingCall.callerId;
    const roomId = incomingCall.roomId;

    stopRingingSound();
    clearDismissTimer();
    setIncomingCall(null);

    const currentFrom = encodeURIComponent((location.pathname + (location.search || '')) || '/');
    if (roomId) {
      navigate(`/call/room/${roomId}?type=${isVid ? 'video' : 'audio'}&autoAnswer=true&from=${currentFrom}`);
    } else if (callerId) {
      navigate(`/call/direct/${callerId}?type=${isVid ? 'video' : 'audio'}&autoAnswer=true&from=${currentFrom}`);
    }
  };

  // 5. Decline Call
  const handleDecline = () => {
    if (!incomingCall) return;
    const callerId = incomingCall.callerId;
    const roomId = incomingCall.roomId;
    const isVid = Boolean(incomingCall.isVideo);

    const logPayload = {
      type: 'DECLINE',
      callerId: callerId, // Người gọi gốc Side A
      targetUserId: effectiveUserId, // Người nhận Side B
      endedBy: effectiveUserId,
      roomId: roomId,
      duration: 0,
      isVideo: isVid,
      callMode: isVid ? 'video' : 'audio',
      timestamp: Date.now()
    };

    try {
      if (stompClient.current && stompClient.current.connected) {
        const signal = {
          type: 'DECLINE',
          callerId: effectiveUserId,
          reason: 'declined',
          isVideo: isVid
        };
        if (roomId) {
          stompClient.current.send(`/app/call/${roomId}`, {}, JSON.stringify(signal));
        } else if (callerId) {
          stompClient.current.send(`/app/call/user/${callerId}`, {}, JSON.stringify(signal));
        }
        // Ghi nhận log từ chối cuộc gọi vào lịch sử chat
        stompClient.current.send('/app/call/log', {}, JSON.stringify(logPayload));
      }
    } catch (e) {}

    // Gửi REST API HTTP dự phòng (bảo đảm 100% không bị sót)
    try {
      axiosClient.post('/call/end', logPayload).catch(() => {});
    } catch (_) {}

    // Ghi nhận log cuộc gọi nhỡ ngay lập tức vào bộ nhớ máy (0ms latency)
    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const logText = isVid ? '📹 Cuộc gọi video nhỡ' : '📞 Cuộc gọi thoại nhỡ';
      const optimisticMsg = {
        id: `call_${Date.now()}`,
        userId: Number(callerId),
        senderId: Number(callerId),
        targetUserId: Number(effectiveUserId),
        message: logText,
        timeSend: now.toISOString(),
        formattedTime: timeStr,
        isRead: false,
        pending: false
      };

      const partnerKey = String(callerId);
      const storageKey = `talovin_dm_msgs_${partnerKey}`;
      const existingRaw = localStorage.getItem(storageKey);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      if (!existing.some(m => m.id === optimisticMsg.id || (m.message === logText && Math.abs(new Date(m.timeSend || 0).getTime() - now.getTime()) < 3000))) {
        const updated = [...existing, optimisticMsg];
        localStorage.setItem(storageKey, JSON.stringify(updated.slice(-50)));
      }
      window.dispatchEvent(new CustomEvent('talovin_new_message', { detail: optimisticMsg }));
    } catch (_) {}

    stopRingingSound();
    clearDismissTimer();
    setIncomingCall(null);
  };

  // Nếu có cuộc gọi đến, render thanh trượt cuộc gọi
  if (incomingCall) {
    const isVideo = Boolean(incomingCall.isVideo);
    return (
      <div 
        className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-[999999] w-[92vw] max-w-md bg-zinc-900/95 border border-zinc-700/80 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-6 duration-300"
        style={{
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)'
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Avatar & Info */}
          <div 
            onClick={handleAccept}
            className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 hover:opacity-90 transition-opacity"
            title="Bấm để nhận cuộc gọi ngay"
          >
            <div className="relative shrink-0">
              <UserAvatar 
                avatar={incomingCall.callerAvatar} 
                name={incomingCall.callerName || 'Người gọi'} 
                size={44} 
                className="w-11 h-11 rounded-full ring-2 ring-emerald-500/50"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center text-zinc-950 animate-pulse">
                {isVideo ? <Video size={10} /> : <Phone size={10} />}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-xs sm:text-sm text-zinc-100 truncate">
                {incomingCall.callerName || 'Người dùng Talovin'}
              </h4>
              <p className="text-[11px] text-zinc-400 truncate flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>{isVideo ? 'Cuộc gọi Video đến...' : 'Cuộc gọi thoại đến...'}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDecline}
              className="h-9 px-3 sm:px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-400 border border-zinc-700/80 font-medium text-xs flex items-center gap-1.5 transition-all active:scale-95"
              title="Từ chối"
            >
              <PhoneOff size={14} />
              <span className="hidden xs:inline sm:inline">Từ chối</span>
            </button>

            <button
              type="button"
              onClick={handleAccept}
              className="h-9 px-3.5 sm:px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-white/10"
              title="Nghe máy"
            >
              <Phone size={14} className="fill-current" />
              <span>Nghe máy</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default GlobalCallBanner;
