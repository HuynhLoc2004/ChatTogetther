import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, PhoneOff, Video, Volume2 } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { createStompClient } from '../utils/stompClient';
import { UserAvatar } from '../pages/Home';

const GlobalCallBanner = () => {
  const [incomingCall, setIncomingCall] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const stompClient = useRef(null);
  const ringAudioCtx = useRef(null);
  const ringOscillator = useRef(null);
  const autoDismissTimer = useRef(null);

  const [effectiveUserId, setEffectiveUserId] = useState(() => localStorage.getItem('user_id'));
  const [incomingMessageNotice, setIncomingMessageNotice] = useState(null);
  const msgDismissTimer = useRef(null);

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
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ringAudioCtx.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ringOscillator.current = osc;

      // Pulse ringtone pattern
      let toggle = true;
      const interval = setInterval(() => {
        if (!ringAudioCtx.current) {
          clearInterval(interval);
          return;
        }
        toggle = !toggle;
        gain.gain.setValueAtTime(toggle ? 0.06 : 0, ctx.currentTime);
      }, 1000);

      return () => clearInterval(interval);
    } catch (e) {}
  }, []);

  const stopRingingSound = useCallback(() => {
    try {
      if (ringOscillator.current) {
        ringOscillator.current.stop();
        ringOscillator.current.disconnect();
        ringOscillator.current = null;
      }
      if (ringAudioCtx.current) {
        ringAudioCtx.current.close();
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

      // Lắng nghe thông báo tin nhắn đến để trượt thanh thông báo
      client.subscribe(`/topic/user/${effectiveUserId}/notifications`, (frame) => {
        try {
          const notif = JSON.parse(frame.body);
          if (!notif || window.location.pathname.startsWith('/messages') || window.location.pathname.startsWith('/call')) return;
          if (notif.type === 'MESSAGE' || notif.title?.includes('tin nhắn')) {
            setIncomingMessageNotice(notif);
            if (msgDismissTimer.current) clearTimeout(msgDismissTimer.current);
            msgDismissTimer.current = setTimeout(() => {
              setIncomingMessageNotice(null);
            }, 6000);
          }
        } catch (_) {}
      });
    }, () => {});

    return () => {
      isMounted = false;
      stopRingingSound();
      clearDismissTimer();
      if (msgDismissTimer.current) clearTimeout(msgDismissTimer.current);
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
    if (location.pathname.startsWith('/messages')) {
      setIncomingMessageNotice(null);
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

    if (roomId) {
      navigate(`/call/room/${roomId}?type=${isVid ? 'video' : 'audio'}&autoAnswer=true`);
    } else if (callerId) {
      navigate(`/call/direct/${callerId}?type=${isVid ? 'video' : 'audio'}&autoAnswer=true`);
    }
  };

  // 5. Decline Call
  const handleDecline = () => {
    if (!incomingCall) return;
    const callerId = incomingCall.callerId;
    const roomId = incomingCall.roomId;

    try {
      if (stompClient.current && stompClient.current.connected) {
        const declinePayload = {
          type: 'DECLINE',
          callerId: effectiveUserId,
          reason: 'declined'
        };
        if (roomId) {
          stompClient.current.send(`/app/call/${roomId}`, {}, JSON.stringify(declinePayload));
        } else if (callerId) {
          stompClient.current.send(`/app/call/user/${callerId}`, {}, JSON.stringify(declinePayload));
        }
      }
    } catch (e) {}

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

  // Nếu có tin nhắn mới đến, render thanh thông báo trượt xuống
  if (incomingMessageNotice) {
    return (
      <div 
        onClick={() => {
          const senderId = incomingMessageNotice.senderId || incomingMessageNotice.targetId;
          setIncomingMessageNotice(null);
          if (senderId) {
            navigate(`/messages/${senderId}`);
          } else {
            navigate('/messages');
          }
        }}
        className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-[999999] w-[92vw] max-w-md bg-zinc-900/95 border border-zinc-700/80 rounded-2xl p-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-6 duration-300 cursor-pointer hover:bg-zinc-800/90 transition-all flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <UserAvatar 
            avatar={incomingMessageNotice.senderAvatar} 
            name={incomingMessageNotice.senderName || incomingMessageNotice.title || 'Tin nhắn mới'} 
            size={36} 
            className="w-9 h-9 rounded-full ring-1 ring-zinc-700 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h5 className="font-semibold text-xs text-zinc-200 truncate">
              {incomingMessageNotice.senderName || incomingMessageNotice.title || 'Tin nhắn riêng mới'}
            </h5>
            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
              {incomingMessageNotice.content || 'Đã gửi một tin nhắn cho bạn. Bấm để xem.'}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-medium text-zinc-400 bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-700/60 shrink-0">
          Xem ngay
        </span>
      </div>
    );
  }

  return null;
};

export default GlobalCallBanner;
