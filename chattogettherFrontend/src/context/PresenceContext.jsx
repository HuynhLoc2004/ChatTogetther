import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { createStompClient } from '../utils/stompClient';

const PresenceContext = createContext({
  onlineUserIds: new Set(),
  isUserOnline: () => false,
  getUserStatusText: () => 'Ngoại tuyến',
  markUserActive: () => {},
  pingUserPresence: () => {},
  refreshPresence: () => {}
});

export const PresenceProvider = ({ children }) => {
  // Khởi tạo ngay lập tức từ cache để 0ms chờ khi tải trang
  const [onlineUserIds, setOnlineUserIds] = useState(() => {
    try {
      const saved = localStorage.getItem('talovin_online_users_cache');
      return saved ? new Set(JSON.parse(saved).map(String)) : new Set();
    } catch (_) {
      return new Set();
    }
  });

  const stompClientRef = useRef(null);
  const lastSeenMapRef = useRef(new Map());

  // Helper lấy userId hiện tại an toàn
  const getCurrentUserId = useCallback(() => {
    let id = localStorage.getItem('user_id');
    if (!id) {
      try {
        const token = localStorage.getItem('accesstoken');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload?.user_id) {
            id = String(payload.user_id);
            localStorage.setItem('user_id', id);
          }
        }
      } catch (_) {}
    }
    return id ? String(id) : null;
  }, []);

  // Đánh dấu một user đang hoạt động (vừa gửi tin nhắn hoặc tương tác)
  const markUserActive = useCallback((userId) => {
    if (!userId) return;
    const uid = String(userId);
    lastSeenMapRef.current.set(uid, Date.now());
    setOnlineUserIds(prev => {
      if (prev.has(uid)) return prev;
      const next = new Set(prev);
      next.add(uid);
      return next;
    });
  }, []);

  // Ping chủ động một user cụ thể qua WebSocket STOMP để lấy phản hồi online tức thì (0ms)
  const pingUserPresence = useCallback((targetUserId) => {
    if (!targetUserId || !stompClientRef.current || !stompClientRef.current.connected) return;
    const currentUserId = getCurrentUserId();
    try {
      stompClientRef.current.send('/topic/presence', {}, JSON.stringify({
        type: 'PRESENCE_PING',
        targetUserId: Number(targetUserId),
        requesterId: Number(currentUserId),
        timestamp: Date.now()
      }));
    } catch (_) {}
  }, [getCurrentUserId]);

  // 1. Nạp danh sách trực tuyến từ server REST API (Đồng bộ triệt để cả người online và offline)
  const fetchOnlineUsers = useCallback(async () => {
    const currentUserId = getCurrentUserId();
    try {
      const res = await axiosClient.get('/users/online-ids');
      if (res.data?.data && Array.isArray(res.data.data)) {
        const serverIds = res.data.data.map(String);
        const serverSet = new Set(serverIds);
        if (currentUserId) serverSet.add(String(currentUserId));

        const now = Date.now();
        serverIds.forEach(id => lastSeenMapRef.current.set(id, now));

        // Loại bỏ ngay lập tức những user không còn trong danh sách online của server
        lastSeenMapRef.current.forEach((ts, uid) => {
          if (uid !== String(currentUserId) && !serverSet.has(uid)) {
            lastSeenMapRef.current.delete(uid);
          }
        });

        setOnlineUserIds(serverSet);
        try {
          localStorage.setItem('talovin_online_users_cache', JSON.stringify(Array.from(serverSet)));
        } catch (_) {}
        return;
      }
    } catch (_) {}

    try {
      const fallbackRes = await axiosClient.get('/public/online-users');
      if (fallbackRes.data?.data && Array.isArray(fallbackRes.data.data)) {
        const serverIds = fallbackRes.data.data.map(String);
        const serverSet = new Set(serverIds);
        if (currentUserId) serverSet.add(String(currentUserId));

        const now = Date.now();
        serverIds.forEach(id => lastSeenMapRef.current.set(id, now));

        lastSeenMapRef.current.forEach((ts, uid) => {
          if (uid !== String(currentUserId) && !serverSet.has(uid)) {
            lastSeenMapRef.current.delete(uid);
          }
        });

        setOnlineUserIds(serverSet);
        try {
          localStorage.setItem('talovin_online_users_cache', JSON.stringify(Array.from(serverSet)));
        } catch (_) {}
      }
    } catch (_) {}
  }, [getCurrentUserId]);

  // 2. Gửi heartbeat và kết nối WebSocket STOMP
  useEffect(() => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    let isMounted = true;
    const client = createStompClient();
    stompClientRef.current = client;

    const token = localStorage.getItem('accesstoken');
    const connectHeaders = { userId: String(currentUserId) };
    if (token) connectHeaders['Authorization'] = `Bearer ${token}`;

    const broadcastMyPresence = (isOnline = true) => {
      try {
        if (client && client.connected && client.ws && client.ws.readyState === WebSocket.OPEN) {
          const payload = JSON.stringify({
            userId: Number(currentUserId),
            isOnline,
            timestamp: Date.now()
          });
          client.send('/topic/presence', {}, payload);
          client.send('/app/presence/heartbeat', {}, payload);
        }
      } catch (_) {}

      // Gửi tín hiệu REST API
      if (isOnline) {
        axiosClient.post('/presence/heartbeat', { userId: Number(currentUserId) }).catch(() => {});
      } else {
        // Rời trang: gửi beacon báo offline lập tức
        try {
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/presence/offline', new Blob([JSON.stringify({ userId: Number(currentUserId) })], { type: 'application/json' }));
          } else {
            axiosClient.post('/presence/offline', { userId: Number(currentUserId) }).catch(() => {});
          }
        } catch (_) {}
      }
    };

    client.connect(connectHeaders, () => {
      if (!isMounted) return;

      // Bản thân luôn trực tuyến
      markUserActive(currentUserId);

      // Đăng ký nhận tín hiệu presence toàn cục
      client.subscribe('/topic/presence', (frame) => {
        try {
          const data = JSON.parse(frame.body);
          if (!data) return;

          // Phản hồi lập tức yêu cầu khám phá trực tuyến từ peer khác (P2P Discovery tức thì)
          if (data.type === 'PRESENCE_REQUEST' && data.requesterId && String(data.requesterId) !== String(currentUserId)) {
            client.send('/topic/presence', {}, JSON.stringify({
              type: 'PRESENCE_REPORT',
              userId: Number(currentUserId),
              targetUserId: Number(data.requesterId),
              isOnline: true,
              timestamp: Date.now()
            }));
          } else if (data.type === 'PRESENCE_PING' && data.targetUserId && String(data.targetUserId) === String(currentUserId)) {
            client.send('/topic/presence', {}, JSON.stringify({
              type: 'PRESENCE_PONG',
              userId: Number(currentUserId),
              targetUserId: Number(data.requesterId),
              isOnline: true,
              timestamp: Date.now()
            }));
          }

          if (data.userId) {
            const uid = String(data.userId);
            if (data.isOnline !== false && data.type !== 'PRESENCE_OFFLINE') {
              lastSeenMapRef.current.set(uid, data.timestamp || Date.now());
              setOnlineUserIds(prev => {
                if (prev.has(uid)) return prev;
                const next = new Set(prev);
                next.add(uid);
                return next;
              });
            } else {
              // Đối phương đã ngoại tuyến: gỡ bỏ tức khắc
              lastSeenMapRef.current.delete(uid);
              setOnlineUserIds(prev => {
                if (!prev.has(uid)) return prev;
                const next = new Set(prev);
                next.delete(uid);
                return next;
              });
            }
          }
        } catch (e) {}
      });

      // Phát tín hiệu ngay khi kết nối thành công và yêu cầu peer phản hồi
      broadcastMyPresence(true);
      try {
        client.send('/topic/presence', {}, JSON.stringify({
          type: 'PRESENCE_REQUEST',
          requesterId: Number(currentUserId),
          userId: Number(currentUserId),
          isOnline: true,
          timestamp: Date.now()
        }));
      } catch (_) {}
    }, () => {});

    // Định kỳ gửi nhịp tim mỗi 8 giây
    const heartbeatInterval = setInterval(() => {
      broadcastMyPresence(true);
    }, 8000);

    // Quét loại bỏ người dùng quá hạn tín hiệu (> 15s) mỗi 4 giây
    const pruneInterval = setInterval(() => {
      const now = Date.now();
      const expired = [];
      lastSeenMapRef.current.forEach((ts, uid) => {
        if (uid !== String(currentUserId) && now - ts > 15000) {
          expired.push(uid);
        }
      });
      if (expired.length > 0) {
        expired.forEach(uid => lastSeenMapRef.current.delete(uid));
        setOnlineUserIds(prev => {
          const next = new Set(prev);
          expired.forEach(uid => next.delete(uid));
          return next;
        });
      }
    }, 4000);

    // Nạp danh sách ban đầu từ server ngay lập tức
    fetchOnlineUsers();

    // Định kỳ đồng bộ danh sách online từ server mỗi 4 giây
    const pollInterval = setInterval(() => {
      fetchOnlineUsers();
    }, 4000);

    // Bắt sự kiện khi tab được mở lại để đồng bộ tức thì
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        broadcastMyPresence(true);
        fetchOnlineUsers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Bắt sự kiện tắt tab / rời trang để cập nhật ngoại tuyến
    const handlePageHide = () => {
      broadcastMyPresence(false);
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    // Lắng nghe sự kiện đăng xuất chủ động
    const handleExplicitOffline = (e) => {
      const offUid = String(e.detail?.userId || currentUserId);
      broadcastMyPresence(false);
      lastSeenMapRef.current.delete(offUid);
      setOnlineUserIds(prev => {
        const next = new Set(prev);
        next.delete(offUid);
        return next;
      });
    };
    window.addEventListener('talovin_presence_offline', handleExplicitOffline);

    return () => {
      isMounted = false;
      clearInterval(heartbeatInterval);
      clearInterval(pruneInterval);
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      window.removeEventListener('talovin_presence_offline', handleExplicitOffline);
      broadcastMyPresence(false);
      if (stompClientRef.current) {
        try {
          stompClientRef.current.disconnect();
        } catch (_) {}
      }
    };
  }, [getCurrentUserId, fetchOnlineUsers, markUserActive]);

  // Helper kiểm tra một user có online không với hỗ trợ fallback ban đầu khi vừa render
  const isUserOnline = useCallback((userId, fallbackIsOnline = undefined) => {
    if (!userId) return false;
    const uid = String(userId);
    const myId = getCurrentUserId();
    if (myId && uid === String(myId)) return true; // Bản thân luôn trực tuyến

    // 1. Kiểm tra timestamp gần nhất từ peer broadcast hoặc tương tác (15 giây)
    const lastSeen = lastSeenMapRef.current.get(uid);
    if (lastSeen && (Date.now() - lastSeen < 15000)) {
      return true;
    }

    // 2. Nếu đã có dữ liệu online từ socket/REST API
    if (onlineUserIds.has(uid)) {
      return true;
    }

    // 3. Fallback giá trị ban đầu từ API hội thoại khi trang vừa tải xong
    if (fallbackIsOnline !== undefined && fallbackIsOnline !== null) {
      return Boolean(fallbackIsOnline);
    }

    return false;
  }, [onlineUserIds, getCurrentUserId]);

  // Helper định dạng chữ trạng thái hoạt động
  const getUserStatusText = useCallback((userId, lastActiveAt, fallbackIsOnline = undefined) => {
    if (isUserOnline(userId, fallbackIsOnline)) {
      return 'Trực tuyến';
    }
    if (!lastActiveAt) {
      return 'Ngoại tuyến';
    }
    try {
      const d = new Date(lastActiveAt);
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Vừa mới truy cập';
      if (diffMins < 60) return `Hoạt động ${diffMins} phút trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`;
      const diffDays = Math.floor(diffHours / 24);
      return `Hoạt động ${diffDays} ngày trước`;
    } catch (_) {
      return 'Ngoại tuyến';
    }
  }, [isUserOnline]);

  return (
    <PresenceContext.Provider value={{
      onlineUserIds,
      isUserOnline,
      getUserStatusText,
      markUserActive,
      pingUserPresence,
      refreshPresence: fetchOnlineUsers
    }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => useContext(PresenceContext);
export default PresenceContext;
