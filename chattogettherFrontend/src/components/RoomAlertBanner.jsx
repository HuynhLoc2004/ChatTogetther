import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { createStompClient } from '../utils/stompClient';
import UserAvatar from './UserAvatar';
import { playMessageIncoming } from '../utils/soundEffects';
import { usePresence } from '../context/PresenceContext';

// Helper chuẩn hóa hiển thị nội dung thông báo
const formatPreviewText = (text) => {
  if (!text || typeof text !== 'string') return '';
  if (text.includes('"type":"shared_post"')) {
    try {
      const parsed = JSON.parse(text);
      return `[Bài viết: ${parsed.content ? (parsed.content.slice(0, 24) + '...') : 'Được chia sẻ'}]`;
    } catch (_) {
      return '[Bài viết được chia sẻ]';
    }
  }
  if (text.startsWith('📞') || text.includes('Cuộc gọi thoại')) {
    return text.includes('nhỡ') ? '[Cuộc gọi thoại nhỡ]' : '[Cuộc gọi thoại]';
  }
  if (text.startsWith('📹') || text.includes('Cuộc gọi video')) {
    return text.includes('nhỡ') ? '[Cuộc gọi video nhỡ]' : '[Cuộc gọi video]';
  }
  if (text.includes('[MEDIA:IMAGE') || text === '[Hình ảnh]') {
    return '[Hình ảnh]';
  }
  if (text.includes('[MEDIA:VIDEO') || text === '[Video]') {
    return '[Video]';
  }
  return text;
};

export const RoomAlertBanner = () => {
  const [currentAlert, setCurrentAlert] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const stompClientRef = useRef(null);
  const recentAlertsRef = useRef(new Map()); // Cache chống nhận trùng thông báo trong 5s
  const { markUserActive } = usePresence();

  // Yêu cầu quyền Notification trình duyệt (Laptop & Phone) khi người dùng tương tác
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      const askPermission = () => {
        try {
          Notification.requestPermission();
        } catch (_) { }
        window.removeEventListener('click', askPermission);
      };
      window.addEventListener('click', askPermission, { once: true });
      return () => window.removeEventListener('click', askPermission);
    }
  }, []);

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
      } catch (_) { }
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

    const connectHeaders = {
      userId: String(userId),
      Authorization: `Bearer ${token}`
    };

    client.connect(connectHeaders, () => {
      if (!isMounted) return;

      const handleAlert = (body) => {
        try {
          const raw = typeof body === 'string' ? JSON.parse(body) : body;
          if (!raw) return;

          // Chuẩn hóa dữ liệu nhận được từ cả 2 dạng: RoomAlertDTO hoặc SendMessageDTO (/topic/messages/{userId})
          let alert = null;
          if (raw.isDirect || raw.roomId) {
            alert = {
              roomId: raw.roomId,
              roomName: raw.roomName,
              isDirect: Boolean(raw.isDirect),
              senderId: raw.senderId || raw.userId,
              senderUsername: raw.senderUsername || raw.account,
              senderDisplayName: raw.senderDisplayName || raw.nickname || raw.senderUsername || 'Người dùng',
              senderAvatar: raw.senderAvatar || raw.avatar,
              contentPreview: raw.contentPreview || raw.message || 'Đã gửi tin nhắn'
            };
          } else if (raw.message && (raw.userId || raw.senderId)) {
            const senderId = raw.senderId || raw.userId;
            if (String(senderId) === String(userId)) {
              // Bỏ qua tin nhắn do chính mình gửi từ thiết bị khác
              return;
            }
            alert = {
              roomId: raw.roomId || null,
              roomName: raw.nickname || raw.senderUsername || 'Tin nhắn mới',
              isDirect: true,
              senderId: senderId,
              senderUsername: raw.senderUsername || raw.account,
              senderDisplayName: raw.nickname || raw.senderUsername || 'Người dùng',
              senderAvatar: raw.senderAvatar || raw.avatar,
              contentPreview: raw.message
            };
          }

          if (!alert || !alert.senderId) return;

          // Chống trùng lặp thông báo trong 5 giây (Anti-duplicate / Single notification)
          const alertKey = `${alert.senderId}_${alert.contentPreview || alert.message || ''}`;
          const lastAlertTime = recentAlertsRef.current.get(alertKey);
          if (lastAlertTime && (Date.now() - lastAlertTime < 5000)) {
            return;
          }
          recentAlertsRef.current.set(alertKey, Date.now());

          // Đánh dấu người gửi đang online tức thì
          if (markUserActive && alert.senderId) {
            markUserActive(alert.senderId);
          }

          // Kiểm tra: nếu user đang mở đúng phòng chat này thì tuyệt đối KHÔNG hiển thị banner
          const currentPath = window.location.pathname.toLowerCase();
          const searchParams = new URLSearchParams(window.location.search);
          const currentUserIdParam = (searchParams.get('userId') || searchParams.get('user_id') || '').toLowerCase();
          const senderIdStr = String(alert.senderId || '').toLowerCase();
          const senderUsernameStr = String(alert.senderUsername || '').toLowerCase();

          let isViewingThisChat = false;
          if (alert.isDirect) {
            isViewingThisChat = currentPath.startsWith('/messages') && (
              currentPath.includes(senderIdStr) ||
              (senderUsernameStr && currentPath.includes(senderUsernameStr)) ||
              currentUserIdParam === senderIdStr ||
              (senderUsernameStr && currentUserIdParam === senderUsernameStr)
            );
          } else if (alert.roomId) {
            isViewingThisChat = currentPath.includes(`/room/${alert.roomId}`);
          }

          if (isViewingThisChat) {
            return;
          }

          // Cập nhật số lượng tin nhắn chưa đọc toàn cục (sẽ đẩy số lượng 4 -> 5, 6, 7... ngay tức thì)
          if (alert.isDirect && alert.senderId) {
            try {
              const currentUnread = JSON.parse(localStorage.getItem('talovin_dm_unread') || '{}');
              const sid = String(alert.senderId);
              currentUnread[sid] = (Number(currentUnread[sid]) || 0) + 1;
              localStorage.setItem('talovin_dm_unread', JSON.stringify(currentUnread));
              window.dispatchEvent(new CustomEvent('talovin_unread_change', { detail: currentUnread }));
            } catch (_) { }
          }

          // 1. Phát âm thanh nốt ding-dong rõ ràng & nhẹ nhàng
          playMessageIncoming();

          // 2. Kích hoạt System / OS Notification trên Điện thoại hoặc Laptop (nếu user cấp quyền)
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const notifTitle = alert.isDirect
                ? (alert.senderDisplayName || alert.senderUsername || 'Tin nhắn mới')
                : (alert.roomName || 'Tin nhắn nhóm mới');
              const cleanPreview = formatPreviewText(alert.contentPreview || 'Đã gửi cho bạn một tin nhắn mới');
              const notifBody = alert.isDirect
                ? cleanPreview
                : `${alert.senderDisplayName || alert.senderUsername || 'Thành viên'}: ${cleanPreview}`;

              const notif = new Notification(notifTitle, {
                body: notifBody,
                icon: alert.senderAvatar || '/favicon.ico',
                tag: alert.isDirect ? `dm-${alert.senderId}` : `room-${alert.roomId || 'alert'}`
              });
              notif.onclick = () => {
                window.focus();
                if (alert.isDirect) {
                  navigate(`/messages/${alert.senderId}`);
                } else if (alert.roomId) {
                  navigate(`/room/${alert.roomId}`);
                }
                notif.close();
              };
            } catch (_) { }
          }

          // 3. Hiển thị DUY NHẤT một In-App Floating Banner ở góc phải màn hình
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setCurrentAlert(alert);

          // Tự động biến mất sau 4.5 giây
          timeoutRef.current = setTimeout(() => {
            setCurrentAlert(null);
          }, 4500);
        } catch (e) {
          console.error('Lỗi nhận room alert:', e);
        }
      };

      // Đăng ký nhận thông báo realtime qua kênh alert chính thức (loại trừ kênh messages để không bị nhân đôi)
      client.subscribe(`/topic/room-alerts/${userId}`, (msg) => handleAlert(msg.body));
      client.subscribe('/user/queue/room-alerts', (msg) => handleAlert(msg.body));
    });

    return () => {
      isMounted = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (client && client.connected) {
        client.disconnect();
      }
    };
  }, [navigate, markUserActive]);

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
