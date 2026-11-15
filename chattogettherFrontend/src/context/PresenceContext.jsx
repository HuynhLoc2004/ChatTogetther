import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { createStompClient } from '../utils/stompClient';

const PresenceContext = createContext({
  onlineUserIds: new Set(),
  isUserOnline: () => false,
  getUserStatusText: () => 'Ngoại tuyến',
  refreshPresence: () => {}
});

export const PresenceProvider = ({ children }) => {
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const stompClientRef = useRef(null);

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

  // 1. Nạp danh sách trực tuyến ban đầu từ server
  const fetchOnlineUsers = useCallback(async () => {
    try {
      const res = await axiosClient.get('/users/online-ids');
      if (res.data?.data && Array.isArray(res.data.data)) {
        setOnlineUserIds(new Set(res.data.data.map(String)));
      }
    } catch (_) {
      try {
        const fallbackRes = await axiosClient.get('/public/online-users');
        if (fallbackRes.data?.data && Array.isArray(fallbackRes.data.data)) {
          setOnlineUserIds(new Set(fallbackRes.data.data.map(String)));
        }
      } catch (_) {}
    }
  }, []);

  // 2. Định kỳ gửi heartbeat mỗi 25s khi tab đang mở (Mobile & Desktop)
  useEffect(() => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    const sendHeartbeat = () => {
      // 1. Gửi qua REST với body userId
      axiosClient.post('/presence/heartbeat', { userId: Number(currentUserId) }).catch(() => {});
      // 2. Gửi qua WebSocket nếu đang connected
      if (stompClientRef.current && stompClientRef.current.connected) {
        try {
          stompClientRef.current.send('/app/presence/heartbeat', {}, JSON.stringify({ userId: Number(currentUserId) }));
        } catch (_) {}
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 20000);
    return () => clearInterval(interval);
  }, [getCurrentUserId]);

  // 3. Lắng nghe sự kiện /topic/presence qua STOMP WebSocket & định kỳ đồng bộ
  useEffect(() => {
    fetchOnlineUsers();
    const syncInterval = setInterval(fetchOnlineUsers, 30000);

    let isMounted = true;
    const client = createStompClient();
    stompClientRef.current = client;

    const currentUserId = getCurrentUserId();
    const token = localStorage.getItem('accesstoken');
    const connectHeaders = {};
    if (currentUserId) connectHeaders['userId'] = String(currentUserId);
    if (token) connectHeaders['Authorization'] = `Bearer ${token}`;

    client.connect(connectHeaders, () => {
      if (!isMounted) return;

      client.subscribe('/topic/presence', (frame) => {
        try {
          const data = JSON.parse(frame.body);
          if (data && data.userId) {
            const uid = String(data.userId);
            setOnlineUserIds(prev => {
              const next = new Set(prev);
              if (data.isOnline) {
                next.add(uid);
              } else {
                next.delete(uid);
              }
              return next;
            });
          }
        } catch (e) {
          console.warn("Lỗi nhận dữ liệu presence:", e);
        }
      });
    }, () => {});

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
      if (stompClientRef.current) {
        try {
          stompClientRef.current.disconnect();
        } catch (_) {}
      }
    };
  }, [fetchOnlineUsers]);

  // Helper kiểm tra một user có online không
  const isUserOnline = useCallback((userId) => {
    if (!userId) return false;
    return onlineUserIds.has(String(userId));
  }, [onlineUserIds]);

  // Helper định dạng chữ trạng thái hoạt động
  const getUserStatusText = useCallback((userId, lastActiveAt) => {
    if (isUserOnline(userId)) {
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
      refreshPresence: fetchOnlineUsers
    }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => useContext(PresenceContext);
export default PresenceContext;
