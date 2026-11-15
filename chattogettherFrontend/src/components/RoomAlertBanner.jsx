import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, MessageSquare } from 'lucide-react';
import { createStompClient } from '../utils/stompClient';
import UserAvatar from './UserAvatar';
import { playMessageIncoming } from '../utils/soundEffects';

export const RoomAlertBanner = () => {
  const [currentAlert, setCurrentAlert] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const stompClientRef = useRef(null);

  // Lấy currentUserId an toàn
  const getCurrentUserId = () => {
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
  };

  useEffect(() => {
    const userId = getCurrentUserId();
    const token = localStorage.getItem('accesstoken');
    if (!userId || !token) return;

    let isMounted = true;
    const client = createStompClient();
    stompClientRef.current = client;

    client.connect({ Authorization: `Bearer ${token}` }, () => {
      if (!isMounted) return;

      const handleAlert = (body) => {
        try {
          const alert = typeof body === 'string' ? JSON.parse(body) : body;
          if (!alert || !alert.roomId) return;

          // Kiểm tra: nếu user đang mở đúng phòng chat này và tab đang focus thì không làm phiền
          const currentPath = window.location.pathname;
          const searchParams = new URLSearchParams(window.location.search);
          const currentUserIdParam = searchParams.get('userId') || searchParams.get('user_id');

          let isViewingThisChat = false;
          if (alert.isDirect) {
            isViewingThisChat = currentPath === `/messages/${alert.senderId}` || 
                                currentPath === `/messages/${alert.senderUsername}` ||
                                (currentPath.startsWith('/messages') && String(currentUserIdParam) === String(alert.senderId));
          } else {
            isViewingThisChat = currentPath === `/room/${alert.roomId}` || currentPath === `/room/${alert.roomId}/`;
          }

          if (isViewingThisChat && !document.hidden) {
            return;
          }

          // 1. Phát âm thanh nốt ding-dong nhẹ nhàng 660Hz -> 990Hz
          playMessageIncoming();

          // 2. Kích hoạt System / OS Notification trên Điện thoại hoặc Laptop (nếu user cấp quyền)
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const notifTitle = alert.isDirect 
                ? (alert.senderDisplayName || alert.senderUsername || 'Tin nhắn mới') 
                : (alert.roomName || 'Tin nhắn nhóm mới');
              const notifBody = alert.isDirect
                ? (alert.contentPreview || 'Đã gửi cho bạn một tin nhắn mới')
                : `${alert.senderDisplayName || alert.senderUsername || 'Thành viên'}: ${alert.contentPreview || ''}`;

              const notif = new Notification(notifTitle, {
                body: notifBody,
                icon: alert.senderAvatar || '/favicon.ico',
                tag: alert.isDirect ? `dm-${alert.senderId}` : `room-${alert.roomId}`
              });
              notif.onclick = () => {
                window.focus();
                if (alert.isDirect) {
                  navigate(`/messages/${alert.senderId}`);
                } else {
                  navigate(`/room/${alert.roomId}`);
                }
                notif.close();
              };
            } catch (_) {}
          }

          // 3. Hiển thị In-App Floating Banner nếu đang ở tab web hoặc tab khác
          if (!isViewingThisChat) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setCurrentAlert(alert);

            // Tự động biến mất sau 4.5 giây
            timeoutRef.current = setTimeout(() => {
              setCurrentAlert(null);
            }, 4500);
          }
        } catch (e) {
          console.error('Lỗi nhận room alert:', e);
        }
      };

      // Đăng ký cả /user/queue/room-alerts và /topic/room-alerts/{userId}
      client.subscribe('/user/queue/room-alerts', (msg) => handleAlert(msg.body));
      client.subscribe(`/topic/room-alerts/${userId}`, (msg) => handleAlert(msg.body));
    });

    return () => {
      isMounted = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (client && client.connected) {
        client.disconnect();
      }
    };
  }, [navigate]);

  if (!currentAlert) return null;

  return (
    <div 
      className="fixed top-3 inset-x-3 sm:inset-x-auto sm:top-4 sm:right-4 z-[99999] max-w-sm w-auto sm:w-96 animate-in slide-in-from-top-3 fade-in duration-200 select-none"
      onClick={() => {
        const isDirect = Boolean(currentAlert.isDirect);
        const targetId = isDirect ? currentAlert.senderId : currentAlert.roomId;
        setCurrentAlert(null);
        if (isDirect) {
          navigate(`/messages/${targetId}`);
        } else {
          navigate(`/room/${targetId}`);
        }
      }}
    >
      <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-800 shadow-2xl rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:border-zinc-700/90 transition-all duration-150 active:scale-[0.98]">
        {/* Bên trái: UserAvatar + huy hiệu phòng */}
        <div className="relative shrink-0">
          <UserAvatar 
            avatarUrl={currentAlert.senderAvatar} 
            username={currentAlert.senderUsername} 
            name={currentAlert.senderDisplayName} 
            size={38} 
          />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
            <MessageSquare size={9} />
          </div>
        </div>

        {/* Ở giữa: Tiêu đề {senderDisplayName} • {roomName} và preview nội dung */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-xs font-semibold text-white truncate">
              {currentAlert.senderDisplayName || currentAlert.senderUsername}
            </span>
            <span className="text-[10px] text-zinc-500">•</span>
            <span className="text-[11px] font-medium text-emerald-400 truncate">
              {currentAlert.isDirect ? 'Tin nhắn riêng' : currentAlert.roomName}
            </span>
          </div>
          <p className="text-xs text-zinc-400 truncate mt-0.5 leading-tight font-sans">
            {currentAlert.contentPreview}
          </p>
        </div>

        {/* Bên phải: Nút đóng X */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCurrentAlert(null);
          }}
          className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 shrink-0 transition-colors"
          title="Đóng thông báo"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default RoomAlertBanner;
