import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Search, MessageSquare, Phone, PhoneOff, Video, VideoOff, 
  Mic, MicOff, Send, Image as ImageIcon, Smile, MoreVertical, User, 
  Clock, CheckCircle2, ChevronDown, Volume2, Shield, Share2, Sparkles,
  PhoneCall, PhoneMissed, Reply, CornerUpLeft, Forward, X, Play, Heart,
  ThumbsUp, Flame, Check, CheckCheck, Users, ExternalLink
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import { createStompClient } from '../utils/stompClient';
import { UserAvatar } from './Home';
import TalovinLogo from '../components/TalovinLogo';
import MobileBottomNav from '../components/MobileBottomNav';
import { usePresence } from '../context/PresenceContext';
import { playMessageIncoming, playReactionPop } from '../utils/soundEffects';

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

// Nén hình ảnh trên Canvas để gửi siêu nhẹ (tránh lỗi 413 Payload Too Large)
const compressImage = (file, maxWidth = 1280, quality = 0.82) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

// Helper chuẩn hóa hiển thị đoạn trích tin nhắn cuối cùng (gọn gàng, sạch đẹp, không lộ JSON)
const formatPreviewText = (text) => {
  if (!text || typeof text !== 'string') return '';
  if (text.includes('shared_post') || text.includes('"type":"shared_post"')) {
    try {
      let unescaped = text.trim();
      if (unescaped.startsWith('"') && unescaped.endsWith('"')) {
        try { unescaped = JSON.parse(unescaped); } catch (_) {}
      }
      const jsonMatch = typeof unescaped === 'string' ? unescaped.match(/\{[\s\S]*"type"\s*:\s*"shared_post"[\s\S]*\}/) : null;
      const targetStr = jsonMatch ? jsonMatch[0] : unescaped;
      const parsed = typeof targetStr === 'string' ? JSON.parse(targetStr) : targetStr;
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

export const DirectMessagePage = () => {
  const { userId: routeUserId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isUserOnline, getUserStatusText, markUserActive } = usePresence();

  const urlTargetUserId = routeUserId || searchParams.get('userId') || searchParams.get('user_id');
  const passedTargetUser = location.state?.targetUser || location.state?.partner;

  const currentUserId = localStorage.getItem('user_id');
  const currentUserName = localStorage.getItem('nickname') || localStorage.getItem('account') || 'Bạn';

  // Danh sách bạn bè / hội thoại (Nạp tức thì từ cache localStorage nếu có, 0ms chờ)
  const [friends, setFriends] = useState(() => {
    try {
      const cached = localStorage.getItem('talovin_dm_friends_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });
  const [loadingFriends, setLoadingFriends] = useState(() => {
    try {
      const cached = localStorage.getItem('talovin_dm_friends_cache');
      const parsed = cached ? JSON.parse(cached) : [];
      return !(parsed && parsed.length > 0);
    } catch (_) {
      return true;
    }
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Quản lý số lượng tin nhắn chưa đọc { [partnerId]: count }
  const [unreadMap, setUnreadMap] = useState(() => {
    try {
      const saved = localStorage.getItem('talovin_dm_unread');
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });

  // Hội thoại đang chọn
  const [activePartner, setActivePartner] = useState(null);
  const [activeRoomId, setActiveRoomId] = useState(null);

  // Refs giữ state mới nhất để tránh stale closures trong WebSocket callbacks
  const activePartnerRef = useRef(activePartner);
  useEffect(() => {
    activePartnerRef.current = activePartner;
  }, [activePartner]);

  const activeRoomIdRef = useRef(activeRoomId);
  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);
  const [partnerNotFound, setPartnerNotFound] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);

  // Tính năng Trả lời (Reply)
  const [replyingTo, setReplyingTo] = useState(null);

  // Tính năng Đính kèm Media (Hình ảnh / Video)
  const [selectedMedia, setSelectedMedia] = useState(null); // { file, previewUrl, type: 'IMAGE'|'VIDEO', name }
  const [mediaUploading, setMediaUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [lightboxMedia, setLightboxMedia] = useState(null);

  // Tính năng Thả cảm xúc (Reactions)
  const [reactionsMap, setReactionsMap] = useState(() => {
    try {
      const saved = localStorage.getItem('talovin_dm_reactions');
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState(null);

  // Tính năng Chuyển tiếp (Forward)
  const [forwardingMsg, setForwardingMsg] = useState(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardTab, setForwardTab] = useState('friends'); // 'friends' | 'rooms'
  const [communityRooms, setCommunityRooms] = useState([]);

  // Cuộc gọi đến (Incoming Call)
  const [incomingCall, setIncomingCall] = useState(null);

  // Refs
  const stompClient = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const messagesCacheRef = useRef(new Map()); // Cache tin nhắn in-memory để chuyển đổi hội thoại 0ms tức thì

  // Lưu unreadMap vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem('talovin_dm_unread', JSON.stringify(unreadMap));
    } catch (_) {}
  }, [unreadMap]);

  // Lưu reactionsMap vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem('talovin_dm_reactions', JSON.stringify(reactionsMap));
    } catch (_) {}
  }, [reactionsMap]);

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

  // Heartbeat định kỳ gửi lên server để duy trì trạng thái online
  useEffect(() => {
    const sendHeartbeat = () => {
      axiosClient.post('/presence/heartbeat', { userId: Number(currentUserId) }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 20000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  // Tự động yêu cầu quyền thông báo hệ thống khi vào trang nhắn tin
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // 1. Tải danh sách bạn bè & nạp xem trước tin nhắn gần nhất (Siêu tốc & Non-blocking)
  useEffect(() => {
    let isMounted = true;
    const fetchFriendsAndPreviews = async () => {
      try {
        const res = await axiosClient.get('/friends/list');
        if (res?.data?.data && Array.isArray(res.data.data)) {
          const rawFriends = res.data.data;

          // Hợp nhất tức thì với cache để giao diện hiển thị ngay lập tức (0ms chờ)
          let currentList = [];
          setFriends(prev => {
            const cacheMap = new Map(prev.map(f => [String(f.id), f]));
            currentList = rawFriends.map(rf => {
              const cached = cacheMap.get(String(rf.id));
              return cached ? { ...rf, ...cached, ...rf } : rf;
            });
            return currentList;
          });
          setLoadingFriends(false);

          // Tự động chọn cuộc trò chuyện đầu tiên nếu chưa chọn ai VÀ cuộc trò chuyện đó thực sự có tin nhắn
          if (!urlTargetUserId && currentList.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
            const hasRecentChat = currentList.find(c => c.lastMessageTime);
            if (hasRecentChat) {
              navigate(`/messages/${hasRecentChat.id}`, { replace: true });
            }
          }

          // Nạp ngầm xem trước tin nhắn mà không làm gián đoạn hoặc chặn UI
          for (const friend of rawFriends) {
            if (!isMounted) break;
            try {
              let directRoomId = friend.directRoomId;
              if (!directRoomId) {
                const roomRes = await axiosClient.get(`/message/direct/${friend.id}`).catch(() => null);
                directRoomId = roomRes?.data?.data?.roomId;
              }

              if (directRoomId) {
                const histRes = await axiosClient.get(`/message/${directRoomId}?size=1`).catch(() => null);
                const msgs = histRes?.data?.data || [];
                if (msgs.length > 0) {
                  const lastMsg = msgs[msgs.length - 1];

                  if (!isMounted) break;
                  setFriends(prev => {
                    const nextList = prev.map(f => {
                      if (String(f.id) === String(friend.id)) {
                        return {
                          ...f,
                          directRoomId,
                          lastMessage: lastMsg.message || (lastMsg.mediaType === 'IMAGE' ? '[Hình ảnh]' : '[Tệp tin]'),
                          lastMessageTime: lastMsg.timeSend || null,
                          lastMessageFormattedTime: lastMsg.formattedTime || (lastMsg.timeSend ? new Date(lastMsg.timeSend).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''),
                          lastMessageSenderId: lastMsg.userId
                        };
                      }
                      return f;
                    });

                    // Sắp xếp: người nhắn tin gần nhất nhảy lên đầu
                    nextList.sort((a, b) => {
                      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                      return timeB - timeA;
                    });

                    try {
                      localStorage.setItem('talovin_dm_friends_cache', JSON.stringify(nextList));
                    } catch (_) {}

                    return nextList;
                  });
                }
              }
            } catch (_) {}
          }
        }
      } catch (e) {
        console.error('Lỗi nạp danh sách bạn bè:', e);
      } finally {
        if (isMounted) setLoadingFriends(false);
      }
    };

    fetchFriendsAndPreviews();
    return () => { isMounted = false; };
  }, [urlTargetUserId, navigate]);

  // Nạp danh sách phòng nhóm công khai cho tính năng chuyển tiếp
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await axiosClient.get('/rooms/info-rooms');
        if (res?.data?.data && Array.isArray(res.data.data)) {
          // Lọc các phòng nhóm không phải là phòng DM 1-1
          const publicRooms = res.data.data.filter(r => !r.nameroom?.startsWith('DIRECT_') && !r.nameroom?.includes('&'));
          setCommunityRooms(publicRooms);
        }
      } catch (_) {}
    };
    fetchRooms();
  }, []);

  // 2. Mở hoặc tạo đoạn chat khi có targetId
  const openDirectChat = useCallback(async (targetId, fallbackPartner = null) => {
    if (!targetId || targetId.toString() === currentUserId?.toString()) return;
    
    // Nếu có thông tin người bạn từ danh sách hoặc state chuyển qua, luôn giữ thông tin hiển thị
    if (fallbackPartner) {
      setActivePartner(fallbackPartner);
      setPartnerNotFound(false);
    }

    // Đánh dấu đã đọc cho người bạn này ngay lập tức
    setUnreadMap(prev => {
      const next = { ...prev };
      delete next[targetId];
      if (fallbackPartner?.id) delete next[fallbackPartner.id];
      try {
        localStorage.setItem('talovin_dm_unread', JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('talovin_unread_change', { detail: next }));
      } catch (_) {}
      return next;
    });

    setFriends(prev => prev.map(f => {
      if (f.id?.toString() === targetId?.toString() || (fallbackPartner && f.id === fallbackPartner.id)) {
        return { ...f, hasUnread: false, unreadCount: 0 };
      }
      return f;
    }));

    // Kiểm tra thông tin partner dự phòng từ props, friends state hoặc cache localStorage
    let effectivePartner = fallbackPartner;
    if (!effectivePartner) {
      const foundInState = friends.find(f => String(f.id) === String(targetId) || f.account === targetId);
      if (foundInState) effectivePartner = foundInState;
    }
    if (!effectivePartner) {
      try {
        const cached = JSON.parse(localStorage.getItem('talovin_dm_friends_cache') || '[]');
        const foundInCache = cached.find(f => String(f.id) === String(targetId) || f.account === targetId);
        if (foundInCache) effectivePartner = foundInCache;
      } catch (_) {}
    }
    if (!effectivePartner && activePartnerRef.current && (String(activePartnerRef.current.id) === String(targetId) || activePartnerRef.current.account === targetId)) {
      effectivePartner = activePartnerRef.current;
    }

    if (effectivePartner) {
      setActivePartner(effectivePartner);
      setPartnerNotFound(false);
    }

    let knownRoomId = effectivePartner?.directRoomId;
    if (!knownRoomId) {
      const found = friends.find(f => String(f.id) === String(targetId));
      if (found?.directRoomId) knownRoomId = found.directRoomId;
    }

    // Hiển thị ngay tin nhắn từ bộ nhớ đệm nếu đã từng mở (0ms, không lag, không giật màn hình)
    const cachedMessages = messagesCacheRef.current.get(String(targetId)) || (knownRoomId ? messagesCacheRef.current.get(String(knownRoomId)) : null);
    if (cachedMessages && Array.isArray(cachedMessages) && cachedMessages.length > 0) {
      setMessages(cachedMessages);
      setLoadingMessages(false);
      setTimeout(() => scrollToBottom(false), 20);
    } else {
      setLoadingMessages(true);
    }

    try {
      let roomId = knownRoomId;

      if (!roomId) {
        let res = null;
        try {
          res = await axiosClient.get(`/message/direct/${targetId}`);
        } catch (_) {
          if (effectivePartner?.account && effectivePartner.account.toString() !== targetId.toString()) {
            try {
              res = await axiosClient.get(`/message/direct/${effectivePartner.account}`);
            } catch (_) {}
          }
          if (!res) {
            try {
              res = await axiosClient.post(`/rooms/direct/${targetId}`);
            } catch (_) {
              if (effectivePartner?.account) {
                try {
                  res = await axiosClient.post(`/rooms/direct/${effectivePartner.account}`);
                } catch (_) {}
              }
            }
          }
        }

        if (res?.data?.data) {
          roomId = res.data.data.roomId || res.data.data.id;
          if (res.data.data.targetUser) {
            setActivePartner(res.data.data.targetUser);
            effectivePartner = res.data.data.targetUser;
            setPartnerNotFound(false);
          }
        }
      }

      if (roomId) {
        setActiveRoomId(roomId);
        setPartnerNotFound(false);

        // Nạp lịch sử tin nhắn của phòng DM này
        const histRes = await axiosClient.get(`/message/${roomId}`).catch(() => null);
        if (histRes?.data?.data && Array.isArray(histRes.data.data)) {
          const fetchedMsgs = histRes.data.data;
          setMessages(fetchedMsgs);
          messagesCacheRef.current.set(String(targetId), fetchedMsgs);
          messagesCacheRef.current.set(String(roomId), fetchedMsgs);
          setTimeout(() => scrollToBottom(false), 50);

          // Cập nhật preview tin nhắn cuối cùng và đánh dấu hoạt động nếu tin nhắn mới
          if (fetchedMsgs.length > 0) {
            const lastMsg = fetchedMsgs[fetchedMsgs.length - 1];
            if (lastMsg.userId?.toString() === targetId.toString()) {
              markUserActive(targetId);
            }
            setFriends(prev => prev.map(f => {
              if (f.id?.toString() === targetId.toString() || (effectivePartner && f.id?.toString() === effectivePartner.id?.toString())) {
                return { 
                  ...f, 
                  directRoomId: roomId,
                  lastMessage: lastMsg.message, 
                  lastMessageTime: lastMsg.timeSend || new Date().toISOString(),
                  lastMessageFormattedTime: lastMsg.formattedTime,
                  hasUnread: false
                };
              }
              return f;
            }));
          }
        }
      } else if (!effectivePartner) {
        setPartnerNotFound(true);
        setActiveRoomId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error('Lỗi mở chat 1-1:', e);
      if (!effectivePartner && e.response?.status === 404) {
        setPartnerNotFound(true);
        setActiveRoomId(null);
        setMessages([]);
      }
    } finally {
      setLoadingMessages(false);
    }
  }, [currentUserId, scrollToBottom, friends, markUserActive]);

  // Kích hoạt khi URL param thay đổi (Chống vòng lặp vô tận)
  const lastTargetIdRef = useRef(null);
  useEffect(() => {
    if (!urlTargetUserId) return;
    if (urlTargetUserId === lastTargetIdRef.current && activePartnerRef.current) return;

    lastTargetIdRef.current = urlTargetUserId;
    
    // Tìm kiếm bạn bè từ cache hoặc state
    let partnerToUse = friends.find(f => f.id?.toString() === urlTargetUserId?.toString() || f.account === urlTargetUserId);
    if (!partnerToUse && passedTargetUser && (passedTargetUser.id?.toString() === urlTargetUserId.toString() || passedTargetUser.account === urlTargetUserId)) {
      partnerToUse = passedTargetUser;
    }
    if (!partnerToUse) {
      try {
        const cached = JSON.parse(localStorage.getItem('talovin_dm_friends_cache') || '[]');
        partnerToUse = cached.find(f => f.id?.toString() === urlTargetUserId?.toString() || f.account === urlTargetUserId);
      } catch (_) {}
    }

    openDirectChat(urlTargetUserId, partnerToUse);
  }, [urlTargetUserId, openDirectChat]);

  // 3. Kết nối WebSocket STOMP chuẩn native browser kèm Authorization header
  useEffect(() => {
    if (!currentUserId) return;

    let client = null;
    let roomSub = null;

    try {
      client = createStompClient();
      stompClient.current = client;
      const token = localStorage.getItem('accesstoken');

      const connectHeaders = { userId: String(currentUserId) };
      if (token) connectHeaders['Authorization'] = `Bearer ${token}`;

      // Xử lý thống nhất mọi tin nhắn 1-1 realtime
      const handleIncomingDirectMsg = (rawPayload) => {
        try {
          const newMsg = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
          if (!newMsg) return;

          const senderId = newMsg.senderId || newMsg.userId;
          const isFromMe = String(senderId) === String(currentUserId);
          const currentActivePartnerId = activePartnerRef.current?.id?.toString();
          const isCurrentChat = !isFromMe && currentActivePartnerId && (String(currentActivePartnerId) === String(senderId));

          // Ghi nhận sender đang online tức thì
          if (senderId && markUserActive) {
            markUserActive(senderId);
          }

          // Đánh dấu người gửi đang hoạt động ngay lập tức
          if (senderId) {
            markUserActive(senderId);
          }

          // 1. Nếu đang mở đúng hội thoại này hoặc là tin nhắn do chính mình gửi
          if (isCurrentChat || isFromMe) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              const hasPending = prev.some(m => m.pending && m.message === newMsg.message);
              let nextList;
              if (hasPending) {
                nextList = prev.map(m => (m.pending && m.message === newMsg.message) ? newMsg : m);
              } else {
                nextList = [...prev, newMsg];
              }
              if (activeRoomIdRef.current) messagesCacheRef.current.set(String(activeRoomIdRef.current), nextList);
              if (activePartnerRef.current?.id) messagesCacheRef.current.set(String(activePartnerRef.current.id), nextList);
              return nextList;
            });

            if (!isFromMe) {
              playMessageIncoming();
            }

            setTimeout(() => scrollToBottom(true), 60);
          }

          // 2. Nếu là tin nhắn từ bạn bè khác (hoặc tab đang ẩn)
          if (!isFromMe && !isCurrentChat && senderId) {
            playMessageIncoming();

            setUnreadMap(prev => {
              const sid = String(senderId);
              const next = { ...prev, [sid]: (Number(prev[sid]) || 0) + 1 };
              try {
                localStorage.setItem('talovin_dm_unread', JSON.stringify(next));
                window.dispatchEvent(new CustomEvent('talovin_unread_change', { detail: next }));
              } catch (_) {}
              return next;
            });

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && (document.hidden || !isCurrentChat)) {
              try {
                new Notification(newMsg.nickname || newMsg.senderUsername || 'Tin nhắn mới', {
                  body: newMsg.message || (newMsg.mediaType === 'IMAGE' ? '[Hình ảnh]' : '[Tệp tin]'),
                  icon: newMsg.senderAvatar || newMsg.avatar || '/favicon.ico',
                  tag: `dm-${senderId}`
                });
              } catch (_) {}
            }
          }

          // 3. Cập nhật preview tin nhắn cuối cùng & đưa bạn bè này lên ĐẦU DANH SÁCH tức thì
          const targetFriendIdStr = (isFromMe ? (activePartnerRef.current?.id || newMsg.partnerId) : senderId)?.toString();
          if (targetFriendIdStr) {
            const nowTime = newMsg.timeSend || new Date().toISOString();
            const nowFmt = newMsg.formattedTime || new Date(nowTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

            setFriends(prev => {
              const targetFriend = prev.find(f => f.id?.toString() === targetFriendIdStr);
              const updatedFriend = targetFriend ? {
                ...targetFriend,
                lastMessage: newMsg.message || (newMsg.mediaType === 'IMAGE' ? '[Hình ảnh]' : '[Video]'),
                lastMessageTime: nowTime,
                lastMessageFormattedTime: nowFmt,
                hasUnread: !isFromMe && !isCurrentChat
              } : null;

              const rest = prev.filter(f => f.id?.toString() !== targetFriendIdStr);
              return updatedFriend ? [updatedFriend, ...rest] : prev;
            });
          }
        } catch (e) {
          console.error('Lỗi nhận tin nhắn 1-1 realtime:', e);
        }
      };

      client.connect(connectHeaders, () => {
        // Lắng nghe tín hiệu cuộc gọi đến WebRTC
        client.subscribe(`/topic/call/user/${currentUserId}`, (message) => {
          try {
            const data = JSON.parse(message.body);
            if (data.type === 'OFFER' || data.type === 'RINGING') {
              setIncomingCall(data);
            } else if (data.type === 'END' || data.type === 'DECLINE') {
              setIncomingCall(null);
            }
          } catch (e) {}
        });

        // 1. Nhận tin nhắn 1-1 trực tiếp qua /topic/messages/{currentUserId}
        client.subscribe(`/topic/messages/${currentUserId}`, (frame) => {
          handleIncomingDirectMsg(frame.body);
        });

        // 2. Nhận alert tin nhắn /topic/room-alerts/{currentUserId}
        client.subscribe(`/topic/room-alerts/${currentUserId}`, (frame) => {
          try {
            const alert = JSON.parse(frame.body);
            if (alert.isDirect && alert.senderId) {
              handleIncomingDirectMsg({
                id: alert.messageId || Date.now(),
                message: alert.contentPreview,
                senderId: alert.senderId,
                userId: alert.senderId,
                nickname: alert.senderDisplayName || alert.senderUsername,
                senderUsername: alert.senderUsername,
                senderAvatar: alert.senderAvatar,
                timeSend: alert.createdAt || new Date().toISOString()
              });
            }
          } catch (_) {}
        });

        // 3. Nhận tin nhắn riêng tư toàn cục fallback
        client.subscribe(`/user/queue/direct-messages`, (message) => {
          handleIncomingDirectMsg(message.body);
        });

        // 4. Đăng ký phòng DM đang mở nếu có
        if (activeRoomIdRef.current) {
          try {
            roomSub = client.subscribe(`/topic/room/${activeRoomIdRef.current}`, (message) => {
              handleIncomingDirectMsg(message.body);
            });
          } catch (_) {}
        }
      });
    } catch (e) {
      console.error('Lỗi kết nối WebSocket tin nhắn riêng:', e);
    }

    return () => {
      if (roomSub) {
        try { roomSub.unsubscribe(); } catch (_) {}
      }
      if (client && client.connected) {
        client.disconnect();
      }
    };
  }, [currentUserId, scrollToBottom, markUserActive]);

  // Đăng ký lại topic room khi chuyển sang phòng khác
  useEffect(() => {
    if (!activeRoomId || !stompClient.current || !stompClient.current.connected) return;
    let sub = null;
    try {
      sub = stompClient.current.subscribe(`/topic/room/${activeRoomId}`, (message) => {
        try {
          const newMsg = JSON.parse(message.body);
          const isFromMe = newMsg.userId?.toString() === currentUserId?.toString();
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            const hasPending = prev.some(m => m.pending && m.message === newMsg.message);
            if (hasPending) {
              return prev.map(m => (m.pending && m.message === newMsg.message) ? newMsg : m);
            }
            return [...prev, newMsg];
          });
          if (!isFromMe) {
            playMessageIncoming();
          }
          setTimeout(() => scrollToBottom(true), 60);
        } catch (_) {}
      });
    } catch (_) {}

    return () => {
      if (sub) {
        try { sub.unsubscribe(); } catch (_) {}
      }
    };
  }, [activeRoomId, currentUserId, scrollToBottom]);

  // 4. Chọn file hình ảnh / video
  const handleSelectMedia = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Kích thước tệp tối đa 25MB!");
      return;
    }

    const isVid = file.type.startsWith('video/');
    const previewUrl = URL.createObjectURL(file);

    setSelectedMedia({
      file,
      previewUrl,
      type: isVid ? 'VIDEO' : 'IMAGE',
      name: file.name
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Hủy file đính kèm
  const handleRemoveMedia = () => {
    if (selectedMedia?.previewUrl) {
      URL.revokeObjectURL(selectedMedia.previewUrl);
    }
    setSelectedMedia(null);
  };

  // 5. Gửi tin nhắn 1-1 (Hỗ trợ Reply, Media, Nén ảnh tự động, Optimistic UI)
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if ((!textInput.trim() && !selectedMedia) || sending) return;

    const content = textInput.trim();
    const tempId = 'temp-' + Date.now();
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    // Đính kèm dữ liệu reply và media
    const currentReply = replyingTo ? { ...replyingTo } : null;
    const currentMedia = selectedMedia ? { ...selectedMedia } : null;

    // Optimistic UI
    const optimisticMsg = {
      id: tempId,
      userId: Number(currentUserId),
      message: content,
      timeSend: now.toISOString(),
      formattedTime: formattedTime,
      replyTo: currentReply,
      mediaUrl: currentMedia?.previewUrl || null,
      mediaType: currentMedia?.type || null,
      pending: true
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setTextInput('');
    setReplyingTo(null);
    setSelectedMedia(null);
    setSending(true);
    setTimeout(() => scrollToBottom(true), 40);

    // Cập nhật preview tin nhắn cuối cùng và đưa lên đầu danh sách hội thoại
    const partnerIdStr = activePartner?.id?.toString();
    setFriends(prev => {
      const targetFriend = prev.find(f => f.id?.toString() === partnerIdStr);
      const updated = targetFriend ? {
        ...targetFriend,
        lastMessage: content || (currentMedia?.type === 'IMAGE' ? '[Hình ảnh]' : '[Video]'),
        lastMessageTime: now.toISOString(),
        lastMessageFormattedTime: formattedTime,
        hasUnread: false
      } : null;

      const rest = prev.filter(f => f.id?.toString() !== partnerIdStr);
      return updated ? [updated, ...rest] : prev;
    });

    try {
      let targetRoom = activeRoomId || activePartner?.directRoomId;
      const targetIdentifier = activePartner?.id || activePartner?.account || urlTargetUserId;

      if (!targetRoom) {
        if (!targetIdentifier) {
          throw new Error("Không thể xác định người nhận");
        }
        let roomRes = null;
        try {
          roomRes = await axiosClient.get(`/message/direct/${targetIdentifier}`);
        } catch (_) {
          if (activePartner?.account && activePartner.account.toString() !== targetIdentifier.toString()) {
            try {
              roomRes = await axiosClient.get(`/message/direct/${activePartner.account}`);
            } catch (_) {}
          }
          if (!roomRes) {
            try {
              roomRes = await axiosClient.post(`/rooms/direct/${targetIdentifier}`);
            } catch (_) {
              if (activePartner?.account) {
                try {
                  roomRes = await axiosClient.post(`/rooms/direct/${activePartner.account}`);
                } catch (_) {}
              }
            }
          }
        }

        if (roomRes?.data?.data) {
          targetRoom = roomRes.data.data.roomId || roomRes.data.data.id;
          if (targetRoom) {
            setActiveRoomId(targetRoom);
          }
          if (roomRes.data.data.targetUser && !activePartner) {
            setActivePartner(roomRes.data.data.targetUser);
          }
        }
      }

      // Xử lý tệp đính kèm: Nén ảnh hoặc đọc Base64
      let uploadedMediaUrl = null;
      if (currentMedia?.file) {
        setMediaUploading(true);
        try {
          uploadedMediaUrl = await compressImage(currentMedia.file);
        } catch (_) {
          uploadedMediaUrl = currentMedia.previewUrl;
        } finally {
          setMediaUploading(false);
        }
      }

      // Soạn payload tin nhắn
      let finalMessage = content;
      if (currentReply) {
        finalMessage = `[REPLY:${currentReply.id}|${currentReply.senderName}]: ${content}`;
      }
      if (uploadedMediaUrl) {
        finalMessage = finalMessage 
          ? `${finalMessage} [MEDIA:${currentMedia.type}|${uploadedMediaUrl}]` 
          : `[MEDIA:${currentMedia.type}|${uploadedMediaUrl}]`;
      }

      await axiosClient.post('/message/send', {
        message: finalMessage || content || '[Tệp tin]',
        timeSend: now.toISOString()
      }, {
        params: { 
          user_room: targetRoom || undefined,
          targetUserId: targetIdentifier
        }
      });

      // Đánh dấu tin nhắn gửi thành công
      setMessages(prev => prev.map(m => m.id === tempId ? { 
        ...m, 
        pending: false,
        mediaUrl: uploadedMediaUrl || m.mediaUrl
      } : m));

    } catch (e) {
      console.error('Lỗi gửi tin nhắn 1-1:', e);
      toast.error('Không thể gửi tin nhắn. Vui lòng thử lại!');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // 6. Thả cảm xúc Emoji (Reactions)
  const handleToggleReaction = (msgId, emoji) => {
    playReactionPop();
    setActiveReactionPickerMsgId(null);

    setReactionsMap(prev => {
      const msgReactions = { ...(prev[msgId] || {}) };
      const currentCount = msgReactions[emoji] || 0;
      
      if (currentCount > 0) {
        msgReactions[emoji] = currentCount - 1;
        if (msgReactions[emoji] <= 0) delete msgReactions[emoji];
      } else {
        msgReactions[emoji] = 1;
      }

      return {
        ...prev,
        [msgId]: msgReactions
      };
    });
  };

  // 7. Chuyển tiếp tin nhắn sang bạn bè
  const handleForwardMessage = async (targetFriend) => {
    if (!forwardingMsg || !targetFriend?.id) return;
    try {
      const rawText = forwardingMsg.message || '';
      const cleanText = rawText.replace(/\[REPLY:[^\]]+\]:\s*/, '');

      // Lấy room DM với bạn đích
      let targetRoom = null;
      try {
        const rRes = await axiosClient.get(`/message/direct/${targetFriend.id}`);
        targetRoom = rRes?.data?.data?.roomId;
      } catch (_) {
        const rRes2 = await axiosClient.post(`/rooms/direct/${targetFriend.id}`);
        targetRoom = rRes2?.data?.data?.roomId;
      }

      if (targetRoom) {
        await axiosClient.post('/message/send', {
          message: cleanText || '[Tệp tin]',
          timeSend: new Date().toISOString()
        }, {
          params: { user_room: targetRoom }
        });
        toast.success(`Đã chuyển tiếp tới ${targetFriend.nickname || targetFriend.account}!`);
      } else {
        throw new Error("Không tìm thấy phòng");
      }
    } catch (e) {
      toast.error("Không thể chuyển tiếp tin nhắn");
    } finally {
      setForwardingMsg(null);
    }
  };

  // Chuyển tiếp tin nhắn sang nhóm chat (Community Room)
  const handleForwardToRoom = async (room) => {
    if (!forwardingMsg || !room?.id) return;
    try {
      const rawText = forwardingMsg.message || '';
      const cleanText = rawText.replace(/\[REPLY:[^\]]+\]:\s*/, '');

      await axiosClient.post('/message/send', {
        message: cleanText || '[Tệp tin]',
        timeSend: new Date().toISOString()
      }, {
        params: { user_room: room.id }
      });
      toast.success(`Đã chuyển tiếp tới nhóm "${room.nameroom || 'Nhóm chat'}"!`);
    } catch (e) {
      toast.error("Không thể chuyển tiếp tới nhóm chat này");
    } finally {
      setForwardingMsg(null);
    }
  };

  // Lọc danh sách hội thoại theo ô tìm kiếm và sắp xếp chuẩn
  const filteredConversations = useMemo(() => {
    let list = [...friends];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f => 
        (f.nickname && f.nickname.toLowerCase().includes(q)) ||
        (f.account && f.account.toLowerCase().includes(q))
      );
    }

    // Sắp xếp danh sách cuộc trò chuyện:
    // 1. Những người ĐÃ CÓ tin nhắn hoặc cuộc gọi (lastMessageTime) sẽ được đưa lên đầu theo thời gian mới nhất
    // 2. Những người CHƯA CÓ tin nhắn nào sẽ ở phía dưới, KHÔNG bao giờ bị nhảy lên đầu khi chưa có tin nhắn
    list.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      if (timeA > 0 && timeB > 0) return timeB - timeA;
      if (timeA > 0) return -1;
      if (timeB > 0) return 1;
      return 0;
    });

    return list;
  }, [friends, searchQuery]);

  // ID an toàn cho cuộc gọi WebRTC
  const safeCallTargetId = activePartner?.id || activePartner?.userId || (urlTargetUserId && !isNaN(Number(urlTargetUserId)) ? urlTargetUserId : null);

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 select-none overflow-hidden font-sans">
      
      {/* HEADER TOÀN TRANG (Topbar) */}
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/home')}
            className="p-2 -ml-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Quay lại Trang chủ"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Sảnh</span>
          </button>
          
          <div className="h-4 w-[1px] bg-zinc-800" />
          
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-emerald-400" />
            <span className="font-bold text-sm tracking-wide text-zinc-100">Hộp thư Tin nhắn</span>
          </div>
        </div>

        {/* User profile góc phải */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 hidden sm:inline">{currentUserName}</span>
          <UserAvatar username={currentUserName} size={28} />
        </div>
      </header>

      {/* BODY CHÍNH */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* CỘT TRÁI: DANH SÁCH BẠN BÈ / CUỘC TRÒ CHUYỆN */}
        <aside className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-zinc-800/80 bg-zinc-950 shrink-0 ${urlTargetUserId ? 'hidden md:flex' : 'flex'}`}>
          {/* Ô tìm kiếm bạn bè */}
          <div className="p-3 border-b border-zinc-800/60">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bạn bè hoặc tin nhắn..."
                className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors font-sans"
              />
            </div>
          </div>

          <div className="px-3 pt-3 pb-1 text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
            <span>Cuộc trò chuyện gần đây ({filteredConversations.length})</span>
          </div>

          {/* Danh sách người dùng */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {loadingFriends ? (
              <div className="py-12 text-center text-zinc-500 text-xs font-mono">
                Đang nạp danh sách trò chuyện...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-12 px-4 text-center text-zinc-500 text-xs">
                Chưa có cuộc trò chuyện nào. Hãy chọn bạn bè để bắt đầu nhắn tin!
              </div>
            ) : (
              filteredConversations.map((partner) => {
                const partnerIdStr = partner.id?.toString();
                const isSelected = activePartner?.id?.toString() === partnerIdStr;
                const unreadCount = unreadMap[partner.id] || unreadMap[partnerIdStr] || (partner.hasUnread && !isSelected ? 1 : 0);
                const isUnread = unreadCount > 0;
                
                // Trạng thái online: Nhanh nhạy & chuẩn xác theo thời gian thực
                const isPartnerOnline = isUserOnline(partner.id);

                return (
                  <div
                    key={partner.id}
                    onClick={() => {
                      navigate(`/messages/${partner.id}`);
                      openDirectChat(partner.id, partner);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-150 relative ${
                      isSelected
                        ? 'bg-zinc-800/90 border border-zinc-700/90 text-white shadow-sm'
                        : isUnread
                        ? 'bg-zinc-900/95 border border-emerald-500/50 text-white shadow-md'
                        : 'hover:bg-zinc-900/60 text-zinc-300 border border-transparent'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <UserAvatar avatarUrl={partner.avatar} username={partner.account} name={partner.nickname || partner.account} size={42} />
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                        isPartnerOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-zinc-600'
                      }`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className={`text-xs truncate ${isUnread ? 'font-bold text-white' : 'font-semibold text-zinc-200'}`}>
                          {partner.nickname || partner.account}
                        </h4>
                        
                        <span className={`text-[10px] font-mono shrink-0 ml-1 ${isUnread ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}`}>
                          {partner.lastMessageFormattedTime || (partner.lastMessageTime ? new Date(partner.lastMessageTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-[11px] truncate ${isUnread ? 'font-medium text-emerald-400' : 'text-zinc-400'}`}>
                          {formatPreviewText(partner.lastMessage) || (isPartnerOnline ? 'Đang trực tuyến' : 'Ngoại tuyến')}
                        </p>

                        {/* Badge số lượng tin nhắn chưa đọc */}
                        {isUnread && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-rose-500 text-white font-bold text-[10px] rounded-full min-w-[18px] text-center leading-none shadow-sm animate-pulse">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Dưới cùng mobile nav */}
          <div className="block md:hidden border-t border-zinc-800/80">
            <MobileBottomNav activeTab="messages" />
          </div>
        </aside>

        {/* CỘT PHẢI: KHUNG CHAT 1-1 CHI TIẾT */}
        <main className={`flex-1 flex flex-col bg-zinc-950 overflow-hidden ${!urlTargetUserId ? 'hidden md:flex' : 'flex'}`}>
          {!urlTargetUserId || !activePartner ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500">
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                <MessageSquare size={28} className="text-zinc-600" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-1">Chưa chọn cuộc trò chuyện</h3>
              <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                Chọn một người bạn ở danh sách bên trái hoặc ghé Sảnh để bắt đầu trò chuyện trực tiếp.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* TOPBAR CỦA KHUNG CHAT */}
              <div className="h-14 px-4 border-b border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button 
                    type="button"
                    onClick={() => {
                      navigate('/messages');
                      setActivePartner(null);
                    }}
                    className="md:hidden p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div className="relative shrink-0">
                    <UserAvatar avatarUrl={activePartner.avatar} username={activePartner.account} name={activePartner.nickname || activePartner.account} size={36} />
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${
                      isUserOnline(activePartner.id) ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-zinc-600'
                    }`} />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white truncate">
                      {activePartner.nickname || activePartner.account}
                    </h3>
                    {isUserOnline(activePartner.id) ? (
                      <span className="text-[10px] font-mono flex items-center gap-1.5 text-emerald-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Trực tuyến • Xem hồ sơ
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono flex items-center gap-1.5 text-zinc-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-zinc-600"></span>
                        {getUserStatusText(activePartner.id)} • Xem hồ sơ
                      </span>
                    )}
                  </div>
                </div>

                {/* Nút hành động Gọi thoại & Gọi video */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!safeCallTargetId) {
                        toast.error("Không tìm thấy thông tin đối phương để gọi!");
                        return;
                      }
                      const currentFrom = encodeURIComponent(location.pathname + (location.search || ''));
                      navigate(`/call/direct/${safeCallTargetId}?type=audio&from=${currentFrom}`);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors active:scale-[0.98]"
                    title="Bắt đầu cuộc gọi thoại"
                  >
                    <Phone size={13} className="text-zinc-300" />
                    <span className="hidden sm:inline">Gọi thoại</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!safeCallTargetId) {
                        toast.error("Không tìm thấy thông tin đối phương để gọi!");
                        return;
                      }
                      const currentFrom = encodeURIComponent(location.pathname + (location.search || ''));
                      navigate(`/call/direct/${safeCallTargetId}?type=video&from=${currentFrom}`);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors active:scale-[0.98]"
                    title="Bắt đầu cuộc gọi video"
                  >
                    <Video size={13} className="text-zinc-300" />
                    <span className="hidden sm:inline">Gọi Video</span>
                  </button>
                </div>
              </div>

              {/* VÙNG HIỂN THỊ NỘI DUNG TIN NHẮN */}
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
              >
                {loadingMessages ? (
                  <div className="py-20 text-center text-zinc-500 text-xs font-mono">
                    Đang nạp tin nhắn...
                  </div>
                ) : partnerNotFound ? (
                  <div className="py-16 text-center text-zinc-500 space-y-2">
                    <p className="text-xs font-semibold text-rose-400">Không tìm thấy người dùng này</p>
                    <p className="text-[11px] text-zinc-500">Tài khoản này có thể chưa tồn tại hoặc đã bị khóa.</p>
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
                    const rawText = msg.message || '';
                    const isCallLog = rawText.includes('Cuộc gọi') || rawText.startsWith('📞') || rawText.startsWith('📹');
                    const isMissed = isCallLog && (rawText.includes('nhỡ') || rawText.includes('từ chối'));
                    const isVideo = isCallLog && (rawText.includes('video') || rawText.startsWith('📹'));

                    // Tách thông tin Reply nếu có format [REPLY:id|sender]: content
                    let replyInfo = msg.replyTo;
                    let displayContent = rawText;
                    const replyMatch = rawText.match(/^\[REPLY:(\d+)\|([^\]]+)\]:\s*([\s\S]*)$/);
                    if (replyMatch) {
                      replyInfo = { id: replyMatch[1], senderName: replyMatch[2] };
                      displayContent = replyMatch[3];
                    }

                    // Tách thông tin Media nếu có format [MEDIA:TYPE|URL]
                    let mediaObj = null;
                    if (msg.mediaUrl) {
                      mediaObj = { url: msg.mediaUrl, type: msg.mediaType || 'IMAGE' };
                    } else {
                      const mediaMatch = displayContent.match(/\[MEDIA:(IMAGE|VIDEO)\|([^\]]+)\]/);
                      if (mediaMatch) {
                        mediaObj = { type: mediaMatch[1], url: mediaMatch[2] };
                        displayContent = displayContent.replace(/\[MEDIA:[^\]]+\]/, '').trim();
                      }
                    }

                    // Cảm xúc của tin nhắn này
                    const msgReactions = reactionsMap[msg.id] || {};
                    const reactionEntries = Object.entries(msgReactions).filter(([_, count]) => count > 0);

                    // Phân tích nếu là Tin nhắn Chia sẻ Bài viết JSON
                    let sharedPostObj = null;
                    if (typeof displayContent === 'string' && (displayContent.includes('shared_post') || displayContent.includes('"type":"shared_post"'))) {
                      try {
                        let unescaped = displayContent.trim();
                        if (unescaped.startsWith('"') && unescaped.endsWith('"')) {
                          try { unescaped = JSON.parse(unescaped); } catch (_) {}
                        }
                        if (typeof unescaped === 'string' && unescaped.includes('&quot;')) {
                          unescaped = unescaped.replace(/&quot;/g, '"');
                        }
                        const jsonMatch = typeof unescaped === 'string' ? unescaped.match(/\{[\s\S]*"type"\s*:\s*"shared_post"[\s\S]*\}/) : null;
                        const targetStr = jsonMatch ? jsonMatch[0] : unescaped;
                        const parsed = typeof targetStr === 'string' ? JSON.parse(targetStr) : targetStr;
                        if (parsed && (parsed.type === 'shared_post' || parsed.postId)) {
                          sharedPostObj = parsed;
                        }
                      } catch (_) {}
                    }

                    if (isCallLog) {
                      const cleanCallText = rawText
                        .replace(/^[📞📹\uFFFD\?🔹⯁\s]+/g, '')
                        .trim() || (isVideo ? 'Cuộc gọi video' : 'Cuộc gọi thoại');
                      const durationMatch = rawText.match(/\((\d{2}:\d{2}(?::\d{2})?)\)/);
                      const durationStr = durationMatch ? durationMatch[1] : (isMissed ? '00:00' : null);
                      const timeStr = msg.formattedTime || (msg.timeSend ? new Date(msg.timeSend).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');

                      return (
                        <div 
                          key={msg.id || index} 
                          className={`w-full flex ${isMe ? 'justify-end' : 'justify-start'} my-2.5`}
                        >
                          <div 
                            className={`w-64 sm:w-72 rounded-2xl p-3.5 shadow-md border transition-all ${
                              isMe 
                                ? 'bg-zinc-800/90 text-zinc-100 rounded-tr-sm border-zinc-700/70' 
                                : 'bg-zinc-900/90 text-zinc-200 rounded-tl-sm border-zinc-800'
                            }`}
                          >
                            {/* Tiêu đề & Icon loại cuộc gọi */}
                            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-700/50">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                  isMissed 
                                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' 
                                    : isVideo 
                                      ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' 
                                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                }`}>
                                  {isMissed ? (
                                    <PhoneMissed size={16} />
                                  ) : isVideo ? (
                                    <Video size={16} />
                                  ) : (
                                    <PhoneCall size={16} />
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-xs text-zinc-100">
                                    {isVideo ? 'Cuộc gọi video' : 'Cuộc gọi thoại'}
                                  </span>
                                  <span className={`text-[10px] font-medium ${isMissed ? 'text-rose-400' : 'text-zinc-400'}`}>
                                    {isMissed 
                                      ? (isMe ? 'Đối phương nhỡ' : 'Cuộc gọi nhỡ') 
                                      : (isMe ? 'Cuộc gọi đi' : 'Cuộc gọi đến')}
                                  </span>
                                </div>
                              </div>
                              {timeStr && (
                                <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                                  {timeStr}
                                </span>
                              )}
                            </div>

                            {/* Thời lượng đàm thoại & Nút gọi lại */}
                            <div className="flex items-center justify-between pt-0.5">
                              <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                                <Clock size={12} className="text-zinc-400" />
                                <span className="text-[11px] text-zinc-400">Thời lượng:</span>
                                <span className="font-mono font-medium text-[11px] text-zinc-200">
                                  {durationStr || (isMissed ? '00:00' : 'Đã kết thúc')}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const safeTargetId = activePartner?.id || urlTargetUserId;
                                  if (safeTargetId) {
                                    const currentFrom = encodeURIComponent(location.pathname + (location.search || ''));
                                    navigate(`/call/direct/${safeTargetId}?type=${isVideo ? 'video' : 'audio'}&from=${currentFrom}`);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors ${
                                  isMissed 
                                    ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30' 
                                    : 'bg-zinc-700/60 hover:bg-zinc-700 text-zinc-200 border border-zinc-600/50'
                                }`}
                              >
                                {isVideo ? <Video size={11} /> : <PhoneCall size={11} />}
                                <span>Gọi lại</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={msg.id || index}
                        className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'} space-y-1 ${msg.pending ? 'opacity-70' : ''}`}
                      >
                        {/* Reaction Dock & Action Buttons (xuất hiện khi hover hoặc click) */}
                        <div className={`opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 bg-zinc-900/95 border border-zinc-800 rounded-full px-2 py-1 shadow-lg absolute -top-8 ${isMe ? 'right-0' : 'left-0'} z-10 transition-opacity duration-150`}>
                          {QUICK_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(msg.id, emoji)}
                              className="w-6 h-6 flex items-center justify-center hover:scale-125 transition-transform text-xs"
                            >
                              {emoji}
                            </button>
                          ))}
                          <div className="w-[1px] h-3.5 bg-zinc-800 mx-0.5" />
                          <button
                            type="button"
                            onClick={() => setReplyingTo({
                              id: msg.id,
                              senderName: isMe ? 'Bạn' : (activePartner.nickname || activePartner.account),
                              message: displayContent || (mediaObj ? '[Tệp đính kèm]' : '')
                            })}
                            className="p-1 hover:text-white text-zinc-400 rounded-md transition-colors"
                            title="Trả lời tin nhắn"
                          >
                            <Reply size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setForwardingMsg(msg)}
                            className="p-1 hover:text-white text-zinc-400 rounded-md transition-colors"
                            title="Chuyển tiếp tin nhắn"
                          >
                            <Forward size={12} />
                          </button>
                        </div>

                        {/* Bubble Chat */}
                        <div 
                          className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words relative shadow-sm ${
                            isMe 
                              ? 'bg-zinc-800 text-zinc-100 rounded-tr-sm border border-zinc-700/60' 
                              : 'bg-zinc-900 text-zinc-200 rounded-tl-sm border border-zinc-800/80'
                          }`}
                        >
                          {/* Trích dẫn nội dung Reply nếu có */}
                          {replyInfo && (
                            <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-zinc-950/70 border-l-2 border-emerald-400 text-[11px] text-zinc-300">
                              <span className="font-bold text-emerald-400 block mb-0.5">
                                ↳ {replyInfo.senderName || 'Người dùng'}
                              </span>
                              <p className="truncate line-clamp-1 italic text-zinc-400">
                                {replyInfo.message || 'Tin nhắn gốc'}
                              </p>
                            </div>
                          )}

                          {/* Media: Hình ảnh / Video */}
                          {mediaObj && (
                            <div className="mb-2 rounded-xl overflow-hidden border border-zinc-800/80 max-w-sm">
                              {mediaObj.type === 'VIDEO' ? (
                                <video 
                                  src={mediaObj.url} 
                                  controls 
                                  className="w-full max-h-64 object-cover rounded-lg bg-black"
                                />
                              ) : (
                                <img 
                                  src={mediaObj.url} 
                                  alt="Đính kèm" 
                                  onClick={() => setLightboxMedia(mediaObj.url)}
                                  className="w-full max-h-64 object-cover cursor-pointer hover:opacity-95 transition-opacity rounded-lg"
                                />
                              )}
                            </div>
                          )}

                          {/* Nội dung tin nhắn: Bài viết chia sẻ hoặc Văn bản thông thường */}
                          {sharedPostObj ? (
                            <div 
                              onClick={() => {
                                if (sharedPostObj.postId) {
                                  navigate(`/#post-${sharedPostObj.postId}`);
                                }
                              }}
                              className="rounded-xl overflow-hidden border border-zinc-700/60 bg-zinc-950/80 hover:border-emerald-500/50 transition-all cursor-pointer p-3 space-y-2.5 max-w-sm group text-left"
                            >
                              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                                    {sharedPostObj.authorAvatar ? (
                                      <img src={sharedPostObj.authorAvatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-300">
                                        {(sharedPostObj.author || 'U').charAt(0).toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs font-semibold text-zinc-200">
                                    {sharedPostObj.author || 'Thành viên'}
                                  </span>
                                </div>
                                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                                  <Share2 size={11} /> Bài viết chia sẻ
                                </span>
                              </div>

                              {sharedPostObj.imageUrl && (
                                <div className="rounded-lg overflow-hidden border border-zinc-800/80 max-h-52 bg-black">
                                  <img 
                                    src={sharedPostObj.imageUrl} 
                                    alt="Ảnh bài viết" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                </div>
                              )}

                              {sharedPostObj.content && (
                                <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                                  {sharedPostObj.content}
                                </p>
                              )}

                              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 group-hover:text-emerald-400 transition-colors">
                                <span>Xem chi tiết trên Sảnh</span>
                                <ExternalLink size={12} />
                              </div>
                            </div>
                          ) : displayContent ? (
                            <div className="whitespace-pre-wrap">{displayContent}</div>
                          ) : null}

                          {/* Badge hiển thị cảm xúc đã thả */}
                          {reactionEntries.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {reactionEntries.map(([emoji, count]) => (
                                <span 
                                  key={emoji}
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                  className="px-1.5 py-0.5 bg-black/40 border border-zinc-700/60 rounded-full text-[10px] cursor-pointer hover:bg-black/60 transition-colors"
                                >
                                  {emoji} {count > 1 ? count : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Thời gian gửi */}
                        <span className="text-[10px] font-mono text-zinc-500 px-1 flex items-center gap-1">
                          {msg.pending ? (
                            <span className="italic text-zinc-400">Đang gửi...</span>
                          ) : (
                            <>
                              {msg.formattedTime || (msg.timeSend ? new Date(msg.timeSend).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')}
                              {isMe && <Check size={11} className="text-zinc-500" />}
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* THANH XEM TRƯỚC TRẢ LỜI TIN NHẮN (REPLY BAR) */}
              {replyingTo && (
                <div className="px-4 py-2 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-2 truncate">
                    <CornerUpLeft size={14} className="text-emerald-400 shrink-0" />
                    <span className="text-zinc-400">Đang trả lời <strong className="text-zinc-200">{replyingTo.senderName}</strong>:</span>
                    <span className="truncate italic text-zinc-300 max-w-xs">{replyingTo.message}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="p-1 hover:text-white text-zinc-400 rounded-md transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* THANH XEM TRƯỚC MEDIA TRƯỚC KHI GỬI */}
              {selectedMedia && (
                <div className="px-4 py-2.5 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-3">
                    {selectedMedia.type === 'VIDEO' ? (
                      <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center text-white border border-zinc-700">
                        <Play size={18} />
                      </div>
                    ) : (
                      <img 
                        src={selectedMedia.previewUrl} 
                        alt="Preview" 
                        className="w-12 h-12 object-cover rounded-lg border border-zinc-700"
                      />
                    )}
                    <div className="text-xs">
                      <p className="font-medium text-white truncate max-w-xs">{selectedMedia.name}</p>
                      <span className="text-[10px] text-zinc-400 uppercase font-mono">
                        {selectedMedia.type === 'VIDEO' ? 'Tệp Video' : 'Hình ảnh'}
                      </span>
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={handleRemoveMedia}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* KHUNG NHẬP LIỆU DƯỚI ĐÁY */}
              <form 
                onSubmit={handleSendMessage}
                className="shrink-0 p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center gap-2"
              >
                {/* Input chọn file ẩn */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleSelectMedia}
                  accept="image/*,video/*" 
                  className="hidden" 
                />

                {/* Nút icon Tải ảnh / Video */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors shrink-0"
                  title="Gửi hình ảnh hoặc video"
                >
                  <ImageIcon size={16} />
                </button>

                <input 
                  type="text"
                  value={textInput}
                  disabled={partnerNotFound}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder={partnerNotFound ? "Không thể nhắn tin cho người dùng này..." : `Nhắn tin cho ${activePartner.nickname || activePartner.account}...`}
                  className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-sans disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={(!textInput.trim() && !selectedMedia) || sending || partnerNotFound}
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

      {/* MODAL CHUYỂN TIẾP TIN NHẮN (FORWARD MODAL: BẠN BÈ & NHÓM CHAT) */}
      {forwardingMsg && (
        <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Forward size={16} className="text-emerald-400" />
                Chuyển tiếp tin nhắn
              </h3>
              <button 
                type="button" 
                onClick={() => setForwardingMsg(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Xem trước nội dung tin nhắn cần chuyển tiếp */}
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 text-xs text-zinc-300 italic line-clamp-2">
              "{forwardingMsg.message || '[Tệp đính kèm]'}"
            </div>

            {/* Chuyển tab: Bạn bè / Nhóm chat */}
            <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setForwardTab('friends')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  forwardTab === 'friends' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <User size={12} />
                Bạn bè ({friends.length})
              </button>
              <button
                type="button"
                onClick={() => setForwardTab('rooms')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  forwardTab === 'rooms' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Users size={12} />
                Nhóm chat ({communityRooms.length})
              </button>
            </div>

            {/* Tìm kiếm */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text"
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
                placeholder={forwardTab === 'friends' ? "Tìm bạn bè..." : "Tìm nhóm chat..."}
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            {/* Danh sách người nhận / nhóm nhận */}
            <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
              {forwardTab === 'friends' ? (
                friends
                  .filter(f => !forwardSearch || (f.nickname || f.account).toLowerCase().includes(forwardSearch.toLowerCase()))
                  .map(friend => (
                    <div 
                      key={friend.id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar avatarUrl={friend.avatar} username={friend.account} name={friend.nickname || friend.account} size={30} />
                        <span className="text-xs font-medium text-zinc-200 truncate">{friend.nickname || friend.account}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleForwardMessage(friend)}
                        className="px-3 py-1 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold rounded-lg transition-colors active:scale-95"
                      >
                        Gửi
                      </button>
                    </div>
                  ))
              ) : (
                communityRooms
                  .filter(r => !forwardSearch || (r.nameroom && r.nameroom.toLowerCase().includes(forwardSearch.toLowerCase())))
                  .map(room => (
                    <div 
                      key={room.id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                          #
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-medium text-zinc-200 truncate block">{room.nameroom}</span>
                          <span className="text-[10px] text-zinc-500">{room.soluong || 0} thành viên</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleForwardToRoom(room)}
                        className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold rounded-lg transition-colors active:scale-95"
                      >
                        Gửi
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX XEM ẢNH PHÓNG TO */}
      {lightboxMedia && (
        <div 
          onClick={() => setLightboxMedia(null)}
          className="fixed inset-0 z-[999999] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer"
        >
          <button 
            type="button"
            onClick={() => setLightboxMedia(null)}
            className="absolute top-4 right-4 p-2 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          <img 
            src={lightboxMedia} 
            alt="Phóng to" 
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" 
          />
        </div>
      )}

      {/* MODAL CUỘC GỌI ĐẾN (INCOMING CALL) */}
      {incomingCall && (
        <div className="fixed bottom-6 right-6 z-[99999] bg-zinc-900 border border-zinc-700 rounded-2xl p-4 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-200 max-w-sm">
          <div className="relative">
            <UserAvatar avatarUrl={incomingCall.callerAvatar} username={incomingCall.callerName} size={44} />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-900 animate-ping" />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-white truncate">{incomingCall.callerName || 'Người dùng'}</h4>
            <p className="text-[11px] text-zinc-400 truncate">
              {incomingCall.isVideo ? 'Cuộc gọi video đến...' : 'Cuộc gọi thoại đến...'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (stompClient.current && stompClient.current.connected) {
                  stompClient.current.send(`/app/call/user/${incomingCall.callerId}`, {}, JSON.stringify({ type: 'DECLINE' }));
                }
                setIncomingCall(null);
              }}
              className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition-colors"
              title="Từ chối"
            >
              <PhoneOff size={15} />
            </button>

            <button
              type="button"
              onClick={() => {
                const isVid = Boolean(incomingCall.isVideo);
                const callerId = incomingCall.callerId;
                setIncomingCall(null);
                const currentFrom = encodeURIComponent(location.pathname + (location.search || ''));
                navigate(`/call/direct/${callerId}?video=${isVid}&incoming=true&autoAnswer=true&from=${currentFrom}`);
              }}
              className="h-9 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center gap-1.5 transition-colors"
            >
              <Phone size={14} /> Nghe máy
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default DirectMessagePage;
