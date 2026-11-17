import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Search, MessageSquare, Phone, PhoneOff, Video, VideoOff,
  Mic, MicOff, Send, Image as ImageIcon, Smile, MoreVertical, User,
  Clock, CheckCircle2, ChevronDown, Volume2, Shield, Share2, Sparkles,
  PhoneCall, PhoneMissed, Reply, CornerUpLeft, Forward, X, Play, Heart,
  ThumbsUp, Flame, Check, CheckCheck, Users, ExternalLink, Eye, EyeOff,
  Lock, Unlock, KeyRound, ShieldCheck, ShieldAlert
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import toast from 'react-hot-toast';
import { createStompClient } from '../utils/stompClient';
import UserAvatar from '../components/UserAvatar';
import TalovinLogo from '../components/TalovinLogo';
import MobileBottomNav from '../components/MobileBottomNav';
import { usePresence } from '../context/PresenceContext';
import { playMessageIncoming, playReactionPop } from '../utils/soundEffects';

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

// Chuẩn hóa URL tệp đa phương tiện (Ảnh / Video) với BACKEND_URL để tương thích Vercel & Production
export const resolveMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  // Nếu URL trỏ vào domain .r2.dev cũ hoặc bị chặn truy cập công khai -> Chuyển sang proxy an toàn của máy chủ
  if (url.includes('.r2.dev/')) {
    const key = url.split('.r2.dev/')[1];
    if (key) {
      return `${BACKEND_URL || ''}/api/message/files/${key}`;
    }
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${BACKEND_URL || ''}${cleanPath}`;
};

// Nén ảnh sang định dạng WebP chất lượng cao (giảm 85-95% dung lượng Cloud R2, sắc nét chuẩn HD, render tức thì)
const compressImageToFile = (file, maxWidth = 1600, quality = 0.82) => {
  return new Promise((resolve) => {
    // Không nén nếu là ảnh động GIF hoặc vector SVG
    if (!file || !file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
      return resolve(file);
    }
    // Nếu ảnh vốn đã rất nhẹ (< 120KB), không cần nén thêm
    if (file.size <= 120 * 1024) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
              const optimizedFile = new File([blob], newFileName, { type: 'image/webp' });
              resolve(optimizedFile);
            } else {
              resolve(file);
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
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
        try { unescaped = JSON.parse(unescaped); } catch (_) { }
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

// Hàm sắp xếp danh sách hội thoại chuẩn xác: Ai có tin nhắn mới nhất luôn đứng ĐẦU DANH SÁCH
export const sortConversationsList = (list) => {
  if (!Array.isArray(list)) return [];
  const copy = [...list];
  return copy.sort((a, b) => {
    const parseTime = (val) => {
      if (!val) return 0;
      const t = new Date(val).getTime();
      return isNaN(t) ? 0 : t;
    };
    const timeA = parseTime(a.lastMessageTime);
    const timeB = parseTime(b.lastMessageTime);
    if (timeA > 0 && timeB > 0) return timeB - timeA; // Mới nhất lên đầu
    if (timeA > 0) return -1;
    if (timeB > 0) return 1;
    return (a.nickname || a.account || '').localeCompare(b.nickname || b.account || '');
  });
};

// Hàm khử trùng lặp tin nhắn cuộc gọi (chỉ giữ duy nhất 1 thông báo cho mỗi phiên gọi trong vòng 10 giây)
export const deduplicateCallMessages = (msgList = []) => {
  if (!Array.isArray(msgList) || msgList.length === 0) return [];
  const isCall = (txt = '') => typeof txt === 'string' && (txt.includes('Cuộc gọi') || txt.startsWith('📞') || txt.startsWith('📹'));
  const result = [];
  for (const m of msgList) {
    if (!m) continue;
    if (isCall(m.message)) {
      const mTime = new Date(m.timeSend || 0).getTime();
      const duplicateIdx = result.findIndex(r => 
        isCall(r.message) && Math.abs(new Date(r.timeSend || 0).getTime() - mTime) < 10000
      );
      if (duplicateIdx !== -1) {
        // Ưu tiên giữ tin nhắn có ID số từ server hoặc có thời lượng thực tế
        const existing = result[duplicateIdx];
        if (typeof m.id === 'number' && typeof existing.id !== 'number') {
          result[duplicateIdx] = m;
        } else if (!existing.message?.includes('(') && m.message?.includes('(')) {
          result[duplicateIdx] = m;
        }
        continue;
      }
    }
    result.push(m);
  }
  return result;
};

export const DirectMessagePage = () => {
  const { userId: routeUserId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isUserOnline, getUserStatusText, markUserActive, pingUserPresence } = usePresence();

  const urlTargetUserId = routeUserId || searchParams.get('userId') || searchParams.get('user_id');
  const passedTargetUser = location.state?.targetUser || location.state?.partner;

  const currentUserId = localStorage.getItem('user_id');
  const currentUserName = localStorage.getItem('nickname') || localStorage.getItem('account') || 'Bạn';

  // Điều hướng 1-click quay lại đúng màn hình trước (Screen A) mà không bị kẹt lịch sử
  const handleBack = () => {
    // 1. Chuẩn mực: Sử dụng lịch sử duyệt web để quay lại đúng màn hình trước đó
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }

    // 2. Nếu có location.state?.from từ router điều hướng nội bộ
    if (location.state?.from && location.state.from !== location.pathname) {
      navigate(location.state.from);
      return;
    }

    // 3. Nếu có query param ?from=... hợp lệ từ router
    const fromParam = searchParams.get('from');
    if (fromParam) {
      try {
        const decoded = decodeURIComponent(fromParam);
        if (decoded && !decoded.startsWith('/messages') && decoded !== location.pathname) {
          navigate(decoded);
          return;
        }
      } catch (_) { }
    }

    // 4. Màn hình gốc được lưu trong session (nếu có và không phải trang hiện tại)
    const originScreenA = sessionStorage.getItem('talovin_origin_screen_a');
    if (originScreenA && !originScreenA.startsWith('/messages') && !originScreenA.startsWith('/call') && originScreenA !== location.pathname) {
      navigate(originScreenA);
      return;
    }

    // 5. Mặc định về trang chủ nếu không có bất kỳ nguồn nào
    navigate('/');
  };

  // Danh sách bạn bè / hội thoại (Nạp tức thì từ cache, tự động hydrate từ tin nhắn cục bộ và sắp xếp mới nhất từ 0ms)
  const userPrefix = currentUserId ? `${currentUserId}_` : '';
  const [friends, setFriends] = useState(() => {
    try {
      const cached = localStorage.getItem(`talovin_dm_conversations_cache_${userPrefix}`) ||
                     localStorage.getItem('talovin_dm_conversations_cache') ||
                     localStorage.getItem(`talovin_dm_friends_cache_${userPrefix}`) ||
                     localStorage.getItem('talovin_dm_friends_cache');
      const list = cached ? JSON.parse(cached) : [];
      if (!Array.isArray(list) || list.length === 0) return [];

      const hydrated = list.map(rf => {
        let lastMsg = rf.lastMessage;
        let lastTime = rf.lastMessageTime;
        let lastFmt = rf.lastMessageFormattedTime;

        try {
          const localRaw = localStorage.getItem(`talovin_dm_msgs_${userPrefix}${rf.id}`) ||
                           localStorage.getItem(`talovin_dm_msgs_${rf.id}`) ||
                           (rf.directRoomId ? (localStorage.getItem(`talovin_dm_msgs_${userPrefix}${rf.directRoomId}`) || localStorage.getItem(`talovin_dm_msgs_${rf.directRoomId}`)) : null);
          if (localRaw) {
            const parsed = JSON.parse(localRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const lm = parsed[parsed.length - 1];
              const parseTime = (val) => {
                if (!val) return 0;
                const t = new Date(val).getTime();
                return isNaN(t) ? 0 : t;
              };
              const localTimeMs = parseTime(lm.timeSend);
              const currentTimeMs = parseTime(lastTime);
              if (localTimeMs >= currentTimeMs) {
                lastMsg = lm.message || (lm.mediaType === 'IMAGE' ? '[Hình ảnh]' : '[Video]');
                lastTime = lm.timeSend || lastTime;
                lastFmt = lm.formattedTime || (lastTime ? new Date(lastTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
              }
            }
          }
        } catch (_) {}

        return {
          ...rf,
          lastMessage: lastMsg,
          lastMessageTime: lastTime,
          lastMessageFormattedTime: lastFmt
        };
      });

      return sortConversationsList(hydrated);
    } catch (_) {
      return [];
    }
  });

  // Chỉ bật skeleton loading khi chưa có bất kỳ dữ liệu nào trong cache
  const [loadingFriends, setLoadingFriends] = useState(() => friends.length === 0);
  const [searchQuery, setSearchQuery] = useState('');

  // Quản lý số lượng tin nhắn chưa đọc { [partnerId]: count }
  const [unreadMap, setUnreadMap] = useState(() => {
    try {
      const saved = localStorage.getItem(`talovin_dm_unread_${userPrefix}`) || localStorage.getItem('talovin_dm_unread');
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

  // Quản lý Đoạn Chat Ẩn (Hidden Chat) bảo mật bằng mã PIN 6 số (Server Hashed BCrypt)
  const [hiddenPartnerIds, setHiddenPartnerIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('talovin_hidden_partner_ids') || '[]').map(String));
    } catch (_) {
      return new Set();
    }
  });
  const [hasServerPin, setHasServerPin] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false); // Mở khóa xem các đoạn chat bị ẩn
  const [activeMenuPartnerId, setActiveMenuPartnerId] = useState(null); // Menu 3 chấm trên thẻ hội thoại
  const [pinModal, setPinModal] = useState({
    open: false,
    mode: 'verify', // 'setup' | 'verify' | 'hide' | 'unhide'
    targetPartner: null
  });
  const [pinStep, setPinStep] = useState(1); // 1: nhập PIN mới, 2: xác nhận lại PIN (dành cho setup)
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Refs
  const stompClient = useRef(null);
  const roomSubRef = useRef(null);
  const handleIncomingDirectMsgRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const messagesCacheRef = useRef(new Map()); // Cache tin nhắn in-memory để chuyển đổi hội thoại 0ms tức thì
  const seenMsgIdsRef = useRef(new Set()); // Bộ lọc chống trùng lặp tin nhắn tuyệt đối

  // Lưu unreadMap vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem('talovin_dm_unread', JSON.stringify(unreadMap));
    } catch (_) { }
  }, [unreadMap]);

  // Lưu reactionsMap vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem('talovin_dm_reactions', JSON.stringify(reactionsMap));
    } catch (_) { }
  }, [reactionsMap]);

  // Cuộn xuống tin nhắn mới nhất (khai báo sớm để các useEffect bên dưới gọi an toàn)
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

  // Lắng nghe sự kiện tin nhắn/call log mới tức thì từ các trang khác (ví dụ: CallPage, GlobalCallBanner)
  useEffect(() => {
    const handleLocalNewMessage = (e) => {
      const newMsg = e.detail;
      if (!newMsg) return;
      const targetIdStr = String(urlTargetUserId || activePartnerRef.current?.id || '');
      const msgSenderStr = String(newMsg.senderId || newMsg.userId || '');
      const msgTargetStr = String(newMsg.targetUserId || '');
      const currentIdStr = String(currentUserId || '');

      const isRelated = (targetIdStr && (msgSenderStr === targetIdStr || msgTargetStr === targetIdStr)) ||
                        (msgSenderStr === currentIdStr && msgTargetStr === targetIdStr);
      if (isRelated) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id || (m.message === newMsg.message && Math.abs(new Date(m.timeSend || 0).getTime() - new Date(newMsg.timeSend || 0).getTime()) < 3000))) {
            return prev;
          }
          const next = deduplicateCallMessages([...prev, newMsg]);
          if (activePartnerRef.current?.id) messagesCacheRef.current.set(String(activePartnerRef.current.id), next);
          return next;
        });
        setTimeout(() => scrollToBottom(true), 40);
      }
    };

    window.addEventListener('talovin_new_message', handleLocalNewMessage);
    return () => window.removeEventListener('talovin_new_message', handleLocalNewMessage);
  }, [urlTargetUserId, currentUserId, scrollToBottom]);

  // Heartbeat định kỳ gửi lên server để duy trì trạng thái online
  useEffect(() => {
    const sendHeartbeat = () => {
      axiosClient.post('/presence/heartbeat', { userId: Number(currentUserId) }).catch(() => { });
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 20000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  // Tự động yêu cầu quyền thông báo hệ thống khi vào trang nhắn tin
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { });
    }
  }, []);

  // 1. Tải danh sách hội thoại & tin nhắn gần nhất (Siêu tốc 1 API duy nhất, không lag, không giật nhảy vị trí)
  useEffect(() => {
    let isMounted = true;
    const fetchFriendsAndPreviews = async () => {
      try {
        let convList = [];
        try {
          // Endpoint chuyên dụng: Lấy tất cả hội thoại, tin nhắn mới nhất và trạng thái online trong 1 request duy nhất
          const res = await axiosClient.get('/message/conversations');
          if (res?.data?.data && Array.isArray(res.data.data)) {
            convList = res.data.data;
          }
        } catch (_) {
          // Fallback an toàn nếu backend chưa cập nhật kịp
          const res = await axiosClient.get('/friends/list');
          if (res?.data?.data && Array.isArray(res.data.data)) {
            convList = res.data.data;
          }
        }

        if (!isMounted) return;

        if (convList && convList.length > 0) {
          let currentList = [];
          const freshUnreadMap = {};
          const hiddenIds = [];

          currentList = convList.map(rf => {
            const prevFriend = friends.find(f => String(f.id) === String(rf.id));
            let lastMsg = rf.lastMessage || prevFriend?.lastMessage;
            let lastTime = rf.lastMessageTime || prevFriend?.lastMessageTime;
            let lastFmt = rf.lastMessageFormattedTime || prevFriend?.lastMessageFormattedTime;

            // Nạp thêm từ bộ nhớ tin nhắn cục bộ nếu có tin nhắn mới hơn (kiểm tra cả id người nhận và id phòng)
            try {
              const localRaw = localStorage.getItem(`talovin_dm_msgs_${userPrefix}${rf.id}`) ||
                               localStorage.getItem(`talovin_dm_msgs_${rf.id}`) ||
                               (rf.directRoomId ? (localStorage.getItem(`talovin_dm_msgs_${userPrefix}${rf.directRoomId}`) || localStorage.getItem(`talovin_dm_msgs_${rf.directRoomId}`)) : null);
              if (localRaw) {
                const parsed = JSON.parse(localRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const lm = parsed[parsed.length - 1];
                  const parseTime = (val) => {
                    if (!val) return 0;
                    const t = new Date(val).getTime();
                    return isNaN(t) ? 0 : t;
                  };
                  const localTimeMs = parseTime(lm.timeSend);
                  const serverTimeMs = parseTime(lastTime);
                  if (localTimeMs >= serverTimeMs) {
                    lastMsg = lm.message || (lm.mediaType === 'IMAGE' ? '[Hình ảnh]' : '[Tệp tin]');
                    lastTime = lm.timeSend || lastTime;
                    lastFmt = lm.formattedTime || (lastTime ? new Date(lastTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
                  }
                }
              }
            } catch (_) { }

            // Lấy chính xác số tin nhắn chưa đọc từ Backend (tuyệt đối không bị reset khi login lại)
            const srvUnread = Number(rf.unreadCount) || 0;
            if (srvUnread > 0) {
              freshUnreadMap[String(rf.id)] = srvUnread;
            }
            if (rf.isHidden) {
              hiddenIds.push(String(rf.id));
            }

            return {
              ...rf,
              lastMessage: lastMsg,
              lastMessageTime: lastTime,
              lastMessageFormattedTime: lastFmt,
              unreadCount: srvUnread,
              hasUnread: srvUnread > 0
            };
          });

          // Đồng bộ tức thì bản đồ tin nhắn chưa đọc vào State & LocalStorage
          setUnreadMap(freshUnreadMap);
          try {
            localStorage.setItem(`talovin_dm_unread_${userPrefix}`, JSON.stringify(freshUnreadMap));
            localStorage.setItem('talovin_dm_unread', JSON.stringify(freshUnreadMap));
            if (hiddenIds.length > 0) {
              localStorage.setItem('talovin_hidden_partner_ids', JSON.stringify(hiddenIds));
            }
            window.dispatchEvent(new CustomEvent('talovin_unread_change', { detail: freshUnreadMap }));
          } catch (_) {}

          // Sắp xếp CHUẨN XÁC: Người có tin nhắn/cuộc gọi mới nhất luôn lên TRÊN CÙNG
          const sortedList = sortConversationsList(currentList);

          try {
            localStorage.setItem(`talovin_dm_conversations_cache_${userPrefix}`, JSON.stringify(sortedList));
            localStorage.setItem('talovin_dm_conversations_cache', JSON.stringify(sortedList));
            localStorage.setItem(`talovin_dm_friends_cache_${userPrefix}`, JSON.stringify(sortedList));
            localStorage.setItem('talovin_dm_friends_cache', JSON.stringify(sortedList));
          } catch (_) { }

          setFriends(sortedList);
        }
      } catch (e) {
        console.error('Lỗi nạp danh sách hội thoại:', e);
      } finally {
        if (isMounted) setLoadingFriends(false);
      }
    };

    fetchFriendsAndPreviews();
    return () => { isMounted = false; };
  }, []);

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
      } catch (_) { }
    };
    fetchRooms();
  }, []);

  // 2. Mở hoặc tạo đoạn chat khi có targetId
  const openDirectChat = useCallback(async (targetId, fallbackPartner = null) => {
    if (!targetId || targetId.toString() === currentUserId?.toString()) return;

    // Kích hoạt ping trạng thái trực tuyến tức thì qua STOMP cho người nhận
    if (pingUserPresence) {
      pingUserPresence(targetId);
    }

    // Nếu có thông tin người bạn từ danh sách hoặc state chuyển qua, luôn giữ thông tin hiển thị
    if (fallbackPartner) {
      setActivePartner(fallbackPartner);
      setPartnerNotFound(false);
    }

    // Đánh dấu đã đọc cho người bạn này ngay lập tức (cả phía server và bộ nhớ cục bộ)
    axiosClient.post('/message/read', {
      targetUserId: targetId,
      roomId: fallbackPartner?.directRoomId || undefined
    }).catch(() => {});

    setUnreadMap(prev => {
      const next = { ...prev };
      delete next[targetId];
      delete next[String(targetId)];
      if (fallbackPartner?.id) {
        delete next[fallbackPartner.id];
        delete next[String(fallbackPartner.id)];
      }
      try {
        localStorage.setItem(`talovin_dm_unread_${userPrefix}`, JSON.stringify(next));
        localStorage.setItem('talovin_dm_unread', JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('talovin_unread_change', { detail: next }));
      } catch (_) { }
      return next;
    });

    setFriends(prev => {
      const nextList = prev.map(f => {
        if (f.id?.toString() === targetId?.toString() || (fallbackPartner && f.id === fallbackPartner.id)) {
          return { ...f, hasUnread: false, unreadCount: 0 };
        }
        return f;
      });
      const sorted = sortConversationsList(nextList);
      try {
        localStorage.setItem(`talovin_dm_conversations_cache_${userPrefix}`, JSON.stringify(sorted));
        localStorage.setItem('talovin_dm_conversations_cache', JSON.stringify(sorted));
        localStorage.setItem(`talovin_dm_friends_cache_${userPrefix}`, JSON.stringify(sorted));
        localStorage.setItem('talovin_dm_friends_cache', JSON.stringify(sorted));
      } catch (_) { }
      return sorted;
    });

    // Kiểm tra thông tin partner dự phòng từ props, friends state hoặc cache localStorage
    let effectivePartner = (fallbackPartner && (fallbackPartner.nickname || fallbackPartner.account)) ? fallbackPartner : null;
    if (!effectivePartner) {
      const foundInState = friends.find(f => (String(f.id) === String(targetId) || f.account === targetId) && (f.nickname || f.account));
      if (foundInState) effectivePartner = foundInState;
    }
    if (!effectivePartner) {
      try {
        const cached = JSON.parse(localStorage.getItem(`talovin_dm_friends_cache_${userPrefix}`) || localStorage.getItem('talovin_dm_friends_cache') || '[]');
        const foundInCache = cached.find(f => (String(f.id) === String(targetId) || f.account === targetId) && (f.nickname || f.account));
        if (foundInCache) effectivePartner = foundInCache;
      } catch (_) { }
    }
    if (!effectivePartner && activePartnerRef.current && (String(activePartnerRef.current.id) === String(targetId) || activePartnerRef.current.account === targetId) && (activePartnerRef.current.nickname || activePartnerRef.current.account)) {
      effectivePartner = activePartnerRef.current;
    }

    if (effectivePartner) {
      setActivePartner(effectivePartner);
      setPartnerNotFound(false);
    } else if (targetId) {
      // Tải tức thì thông tin user từ profile để không bao giờ bị hiện "undefined"
      axiosClient.get('/users/profile', { params: { user_id: targetId } }).then(uRes => {
        if (uRes.data?.data) {
          const u = uRes.data.data;
          const freshPartner = {
            id: u.id,
            account: u.account,
            nickname: u.nickname || u.account,
            avatar: u.avatar || ''
          };
          setActivePartner(freshPartner);
          setPartnerNotFound(false);
        }
      }).catch(() => {});
    }

    let knownRoomId = effectivePartner?.directRoomId;
    if (!knownRoomId) {
      const found = friends.find(f => String(f.id) === String(targetId));
      if (found?.directRoomId) knownRoomId = found.directRoomId;
    }

    // Hiển thị ngay tin nhắn từ bộ nhớ đệm nếu đã từng mở (0ms tức thì, không lag, không chờ đợi)
    let cachedMessages = messagesCacheRef.current.get(String(targetId)) || (knownRoomId ? messagesCacheRef.current.get(String(knownRoomId)) : null);
    if (!cachedMessages) {
      try {
        const raw = localStorage.getItem(`talovin_dm_msgs_${userPrefix}${targetId}`) ||
                    localStorage.getItem(`talovin_dm_msgs_${targetId}`) ||
                    (knownRoomId ? (localStorage.getItem(`talovin_dm_msgs_${userPrefix}${knownRoomId}`) || localStorage.getItem(`talovin_dm_msgs_${knownRoomId}`)) : null);
        if (raw) {
          cachedMessages = JSON.parse(raw);
          if (Array.isArray(cachedMessages) && cachedMessages.length > 0) {
            messagesCacheRef.current.set(String(targetId), cachedMessages);
          }
        }
      } catch (_) { }
    }

    if (cachedMessages && Array.isArray(cachedMessages) && cachedMessages.length > 0) {
      setMessages(deduplicateCallMessages(cachedMessages));
      setLoadingMessages(false);
      setTimeout(() => scrollToBottom(false), 20);
    } else {
      setLoadingMessages(true);
    }

    try {
      let roomId = knownRoomId;
      let fetchedMsgs = null;

      if (!roomId) {
        let res = null;
        try {
          res = await axiosClient.get(`/message/direct/${targetId}`);
        } catch (_) {
          if (effectivePartner?.account && effectivePartner.account.toString() !== targetId.toString()) {
            try {
              res = await axiosClient.get(`/message/direct/${effectivePartner.account}`);
            } catch (_) { }
          }
          if (!res) {
            try {
              res = await axiosClient.post(`/rooms/direct/${targetId}`);
            } catch (_) {
              if (effectivePartner?.account) {
                try {
                  res = await axiosClient.post(`/rooms/direct/${effectivePartner.account}`);
                } catch (_) { }
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
          if (Array.isArray(res.data.data.messages) && res.data.data.messages.length > 0) {
            fetchedMsgs = res.data.data.messages;
          }
        }

        if (!effectivePartner && targetId) {
          try {
            const userProfileRes = await axiosClient.get('/users/profile', { params: { user_id: targetId } });
            if (userProfileRes.data?.data) {
              const u = userProfileRes.data.data;
              effectivePartner = {
                id: u.id,
                account: u.account,
                nickname: u.nickname || u.account,
                avatar: u.avatar || ''
              };
              setActivePartner(effectivePartner);
              setPartnerNotFound(false);
            }
          } catch (_) { }
        }
      }

      if (effectivePartner) {
        setFriends(prev => {
          const exists = prev.some(f => String(f.id) === String(effectivePartner.id) || f.account === effectivePartner.account);
          if (!exists) {
            return [{
              ...effectivePartner,
              directRoomId: roomId || undefined,
              hasUnread: false,
              unreadCount: 0
            }, ...prev];
          }
          return prev.map(f => (String(f.id) === String(effectivePartner.id) || f.account === effectivePartner.account) ? { ...f, directRoomId: roomId || f.directRoomId } : f);
        });
      }

      if (roomId) {
        setActiveRoomId(roomId);
        setPartnerNotFound(false);

        // Nếu chưa có tin nhắn từ request direct: Nạp lịch sử tin nhắn của phòng
        if (!fetchedMsgs) {
          const histRes = await axiosClient.get(`/message/${roomId}`).catch(() => null);
          if (histRes?.data?.data && Array.isArray(histRes.data.data)) {
            fetchedMsgs = histRes.data.data;
          }
        }

        if (fetchedMsgs && Array.isArray(fetchedMsgs)) {
          let mergedList = [...fetchedMsgs];
          setMessages(prev => {
            // Giữ lại các tin nhắn optimistic call log nếu server chưa kịp commit
            prev.forEach(p => {
              if (p.pending || (String(p.id).startsWith('call_') && !fetchedMsgs.some(fm => fm.message === p.message))) {
                mergedList.push(p);
              }
            });
            return deduplicateCallMessages(mergedList);
          });
          const cleanMerged = deduplicateCallMessages(mergedList);
          messagesCacheRef.current.set(String(targetId), cleanMerged);
          messagesCacheRef.current.set(String(roomId), cleanMerged);
          try {
            localStorage.setItem(`talovin_dm_msgs_${userPrefix}${targetId}`, JSON.stringify(cleanMerged.slice(-50)));
            localStorage.setItem(`talovin_dm_msgs_${targetId}`, JSON.stringify(cleanMerged.slice(-50)));
            if (roomId) {
              localStorage.setItem(`talovin_dm_msgs_${userPrefix}${roomId}`, JSON.stringify(cleanMerged.slice(-50)));
              localStorage.setItem(`talovin_dm_msgs_${roomId}`, JSON.stringify(cleanMerged.slice(-50)));
            }
          } catch (_) { }
          setTimeout(() => scrollToBottom(false), 30);

          // Cập nhật preview tin nhắn cuối cùng và đánh dấu hoạt động nếu tin nhắn mới
          if (fetchedMsgs.length > 0) {
            const lastMsg = fetchedMsgs[fetchedMsgs.length - 1];
            if (lastMsg.userId?.toString() === targetId.toString()) {
              markUserActive(targetId);
            }
            setFriends(prev => {
              const nextList = prev.map(f => {
                if (f.id?.toString() === targetId.toString() || (effectivePartner && f.id?.toString() === effectivePartner.id?.toString())) {
                  return {
                    ...f,
                    directRoomId: roomId,
                    lastMessage: lastMsg.message,
                    lastMessageTime: lastMsg.timeSend || f.lastMessageTime || new Date().toISOString(),
                    lastMessageFormattedTime: lastMsg.formattedTime || f.lastMessageFormattedTime,
                    hasUnread: false,
                    unreadCount: 0
                  };
                }
                return f;
              });
              const sorted = sortConversationsList(nextList);
              try {
                localStorage.setItem('talovin_dm_conversations_cache', JSON.stringify(sorted));
                localStorage.setItem('talovin_dm_friends_cache', JSON.stringify(sorted));
              } catch (_) { }
              return sorted;
            });
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
    if (String(urlTargetUserId) === String(lastTargetIdRef.current) && activePartnerRef.current && String(activePartnerRef.current.id) === String(urlTargetUserId)) return;

    lastTargetIdRef.current = String(urlTargetUserId);

    // Tìm kiếm bạn bè từ cache hoặc state (phải có nickname hoặc account hợp lệ)
    let partnerToUse = friends.find(f => (f.id?.toString() === urlTargetUserId?.toString() || f.account === urlTargetUserId) && (f.nickname || f.account));
    if (!partnerToUse && passedTargetUser && (passedTargetUser.id?.toString() === urlTargetUserId.toString() || passedTargetUser.account === urlTargetUserId) && (passedTargetUser.nickname || passedTargetUser.account)) {
      partnerToUse = passedTargetUser;
    }
    if (!partnerToUse) {
      try {
        const cached = JSON.parse(localStorage.getItem('talovin_dm_friends_cache') || '[]');
        partnerToUse = cached.find(f => (f.id?.toString() === urlTargetUserId?.toString() || f.account === urlTargetUserId) && (f.nickname || f.account));
      } catch (_) { }
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

      // Xử lý thống nhất mọi tin nhắn 1-1 realtime (Loại bỏ triệt để tin nhắn trùng lặp)
      const handleIncomingDirectMsg = (rawPayload) => {
        try {
          const newMsg = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
          if (!newMsg) return;

          // Xử lý tín hiệu đối phương đã đọc tin nhắn realtime (Cyber Read Receipt)
          if (newMsg.type === 'MESSAGES_READ' || newMsg.type === 'READ_RECEIPT') {
            const upToId = newMsg.upToMessageId;
            setMessages(prev => prev.map(m => {
              const isMyMsg = String(m.senderId || m.userId) === String(currentUserId);
              if (isMyMsg && (!upToId || m.id <= upToId)) {
                return {
                  ...m,
                  isRead: true,
                  timeRead: newMsg.timeRead || new Date().toISOString(),
                  formattedTimeRead: newMsg.formattedTimeRead || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                };
              }
              return m;
            }));
            return;
          }

          // Chống trùng lặp sớm: Nếu ID tin nhắn này đã được render rồi thì bỏ qua ngay lập tức
          if (newMsg.id) {
            const msgIdStr = String(newMsg.id);
            if (seenMsgIdsRef.current.has(msgIdStr)) return;
            seenMsgIdsRef.current.add(msgIdStr);
            if (seenMsgIdsRef.current.size > 500) {
              const firstVal = seenMsgIdsRef.current.values().next().value;
              seenMsgIdsRef.current.delete(firstVal);
            }
          }

          const senderId = newMsg.senderId || newMsg.userId;
          const isFromMe = String(senderId) === String(currentUserId);
          const currentActivePartnerId = activePartnerRef.current?.id?.toString();
          const isCurrentChat = !isFromMe && currentActivePartnerId && (String(currentActivePartnerId) === String(senderId));

          // Ghi nhận sender đang online tức thì
          if (senderId && markUserActive) {
            markUserActive(senderId);
          }

          // Nếu đang mở cuộc trò chuyện này và đối phương nhắn tới -> Tự động báo đã đọc ngay
          if (isCurrentChat && !isFromMe) {
            axiosClient.post('/message/read', {
              roomId: activeRoomIdRef.current || undefined,
              targetUserId: senderId,
              upToMessageId: newMsg.id
            }).catch(() => {});
          }

          // 1. Nếu đang mở đúng hội thoại này hoặc là tin nhắn do chính mình gửi
          if (isCurrentChat || isFromMe) {
            setMessages(prev => {
              // Chống trùng lặp 1: Trùng ID hệ thống
              if (newMsg.id && prev.some(m => String(m.id) === String(newMsg.id))) {
                return prev;
              }

              // Đồng bộ và thay thế tin nhắn đang gửi (Optimistic Message)
              const pendingIdx = prev.findIndex(m => m.pending && (
                (newMsg.clientTempId && (String(m.clientTempId) === String(newMsg.clientTempId) || String(m.id) === String(newMsg.clientTempId))) ||
                (m.message && newMsg.message && m.message === newMsg.message) ||
                (m.mediaType && newMsg.message && newMsg.message.includes(`[MEDIA:${m.mediaType}`))
              ));

              let nextList;
              if (pendingIdx !== -1) {
                nextList = [...prev];
                nextList[pendingIdx] = { ...newMsg, pending: false };
              } else {
                // Chống trùng lặp nội dung từ cùng người gửi trong vòng 5 giây
                const isDuplicate = prev.some(m =>
                  !m.pending &&
                  String(m.senderId || m.userId) === String(senderId) &&
                  m.message === newMsg.message &&
                  Math.abs(new Date(m.timeSend || 0).getTime() - new Date(newMsg.timeSend || 0).getTime()) < 5000
                );
                if (isDuplicate) return prev;
                nextList = deduplicateCallMessages([...prev, newMsg]);
              }

              if (activeRoomIdRef.current) messagesCacheRef.current.set(String(activeRoomIdRef.current), nextList);
              if (activePartnerRef.current?.id) messagesCacheRef.current.set(String(activePartnerRef.current.id), nextList);
              try {
                if (activePartnerRef.current?.id) {
                  localStorage.setItem(`talovin_dm_msgs_${userPrefix}${activePartnerRef.current.id}`, JSON.stringify(nextList.slice(-50)));
                  localStorage.setItem(`talovin_dm_msgs_${activePartnerRef.current.id}`, JSON.stringify(nextList.slice(-50)));
                }
                if (activeRoomIdRef.current) {
                  localStorage.setItem(`talovin_dm_msgs_${userPrefix}${activeRoomIdRef.current}`, JSON.stringify(nextList.slice(-50)));
                  localStorage.setItem(`talovin_dm_msgs_${activeRoomIdRef.current}`, JSON.stringify(nextList.slice(-50)));
                }
              } catch (_) { }
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
                localStorage.setItem(`talovin_dm_unread_${userPrefix}`, JSON.stringify(next));
                localStorage.setItem('talovin_dm_unread', JSON.stringify(next));
                window.dispatchEvent(new CustomEvent('talovin_unread_change', { detail: next }));
              } catch (_) { }
              return next;
            });

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && (document.hidden || !isCurrentChat)) {
              try {
                new Notification(newMsg.nickname || newMsg.senderUsername || 'Tin nhắn mới', {
                  body: newMsg.message || (newMsg.mediaType === 'IMAGE' ? '[Hình ảnh]' : '[Tệp tin]'),
                  icon: newMsg.senderAvatar || newMsg.avatar || '/favicon.ico',
                  tag: `dm-${senderId}`
                });
              } catch (_) { }
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
              const nextList = updatedFriend ? [updatedFriend, ...rest] : prev;
              const sorted = sortConversationsList(nextList);
              try {
                localStorage.setItem(`talovin_dm_conversations_cache_${userPrefix}`, JSON.stringify(sorted));
                localStorage.setItem('talovin_dm_conversations_cache', JSON.stringify(sorted));
                localStorage.setItem(`talovin_dm_friends_cache_${userPrefix}`, JSON.stringify(sorted));
                localStorage.setItem('talovin_dm_friends_cache', JSON.stringify(sorted));
              } catch (_) { }
              return sorted;
            });
          }
        } catch (e) {
          console.error('Lỗi nhận tin nhắn 1-1 realtime:', e);
        }
      };

      handleIncomingDirectMsgRef.current = handleIncomingDirectMsg;

      client.connect(connectHeaders, () => {
        // 1. Nhận tin nhắn 1-1 trực tiếp qua /topic/messages/{currentUserId}
        client.subscribe(`/topic/messages/${currentUserId}`, (frame) => {
          handleIncomingDirectMsg(frame.body);
        });

        // 2. Nhận alert tin nhắn /topic/room-alerts/{currentUserId} (Chỉ cập nhật badge unread ngoài lề, TUYỆT ĐỐI không chèn vào messages)
        client.subscribe(`/topic/room-alerts/${currentUserId}`, (frame) => {
          try {
            const alert = JSON.parse(frame.body);
            if (alert.isDirect && alert.senderId) {
              const sid = String(alert.senderId);
              const currentActivePartnerId = activePartnerRef.current?.id?.toString();
              const isCurrent = currentActivePartnerId && String(currentActivePartnerId) === sid;
              if (!isCurrent) {
                setUnreadMap(prev => {
                  const next = { ...prev, [sid]: (Number(prev[sid]) || 0) + 1 };
                  try {
                    localStorage.setItem('talovin_dm_unread', JSON.stringify(next));
                    window.dispatchEvent(new CustomEvent('talovin_unread_change', { detail: next }));
                  } catch (_) { }
                  return next;
                });
              }
            }
          } catch (_) { }
        });

        // 3. Nhận tin nhắn riêng tư toàn cục fallback
        client.subscribe(`/user/queue/direct-messages`, (message) => {
          handleIncomingDirectMsg(message.body);
        });

        // 4. Đăng ký phòng DM đang mở nếu có (Duy nhất 1 subscription)
        if (activeRoomIdRef.current) {
          try {
            if (roomSubRef.current) {
              try { roomSubRef.current.unsubscribe(); } catch (_) { }
            }
            roomSubRef.current = client.subscribe(`/topic/room/${activeRoomIdRef.current}`, (message) => {
              handleIncomingDirectMsg(message.body);
            });
          } catch (_) { }
        }
      });
    } catch (e) {
      console.error('Lỗi kết nối WebSocket tin nhắn riêng:', e);
    }

    return () => {
      if (roomSubRef.current) {
        try { roomSubRef.current.unsubscribe(); } catch (_) { }
        roomSubRef.current = null;
      }
      if (client && client.connected) {
        client.disconnect();
      }
    };
  }, [currentUserId, scrollToBottom, markUserActive]);

  // Đăng ký lại topic room khi chuyển sang phòng khác (Đảm bảo duy nhất 1 subscription qua roomSubRef)
  useEffect(() => {
    if (!activeRoomId || !stompClient.current || !stompClient.current.connected) return;
    try {
      if (roomSubRef.current) {
        try { roomSubRef.current.unsubscribe(); } catch (_) { }
        roomSubRef.current = null;
      }
      roomSubRef.current = stompClient.current.subscribe(`/topic/room/${activeRoomId}`, (message) => {
        handleIncomingDirectMsgRef.current?.(message.body);
      });
    } catch (_) { }

    return () => {
      if (roomSubRef.current) {
        try { roomSubRef.current.unsubscribe(); } catch (_) { }
        roomSubRef.current = null;
      }
    };
  }, [activeRoomId]);

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

  // 5. Gửi tin nhắn 1-1 Realtime phi đồng bộ (Non-blocking: Cho phép gửi liên tục không nghẽn)
  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!textInput.trim() && !selectedMedia) return;

    const content = textInput.trim();
    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    // Đính kèm dữ liệu reply và media
    const currentReply = replyingTo ? { ...replyingTo } : null;
    const currentMedia = selectedMedia ? { ...selectedMedia } : null;

    // Optimistic UI - Hiển thị ngay lập tức (0ms chờ)
    const optimisticMsg = {
      id: tempId,
      clientTempId: tempId,
      userId: Number(currentUserId),
      senderId: Number(currentUserId),
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
      const nextList = updated ? [updated, ...rest] : prev;
      const sorted = sortConversationsList(nextList);
      try {
        localStorage.setItem(`talovin_dm_conversations_cache_${userPrefix}`, JSON.stringify(sorted));
        localStorage.setItem('talovin_dm_conversations_cache', JSON.stringify(sorted));
        localStorage.setItem(`talovin_dm_friends_cache_${userPrefix}`, JSON.stringify(sorted));
        localStorage.setItem('talovin_dm_friends_cache', JSON.stringify(sorted));
      } catch (_) { }
      return sorted;
    });

    // Thực thi gửi trong luồng ngầm độc lập (Worker / Concurrent Background Task)
    (async () => {
      try {
        let targetRoom = activeRoomId || activePartner?.directRoomId;
        const targetIdentifier = activePartner?.id || activePartner?.account || urlTargetUserId;

        if (!targetRoom && targetIdentifier) {
          try {
            const roomRes = await axiosClient.get(`/message/direct/${targetIdentifier}`);
            targetRoom = roomRes?.data?.data?.roomId || roomRes?.data?.data?.id;
            if (targetRoom) setActiveRoomId(targetRoom);
          } catch (_) { }
        }

        // Tải lên tệp đa phương tiện (Ảnh / Video) qua endpoint chuyên biệt với tối ưu nén
        let uploadedMediaUrl = null;
        if (currentMedia?.file) {
          try {
            let fileToUpload = currentMedia.file;
            if (currentMedia.type === 'IMAGE') {
              try {
                fileToUpload = await compressImageToFile(currentMedia.file);
              } catch (_) {}
            }

            const formData = new FormData();
            formData.append('file', fileToUpload);
            const uploadRes = await axiosClient.post('/message/upload', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: 120000 // Chờ đến 120 giây cho video tải lên ổn định
            });
            uploadedMediaUrl = uploadRes.data?.data?.url || uploadRes.data?.url;
          } catch (uploadErr) {
            console.warn("Lỗi tải tệp lên server:", uploadErr);
          }

          if (!uploadedMediaUrl) {
            toast.error("Không thể tải hình ảnh/video lên máy chủ. Vui lòng kiểm tra dung lượng hoặc kết nối mạng!");
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, failed: true, pending: false } : m));
            return;
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
          user_room: targetRoom || undefined,
          roomId: targetRoom || undefined,
          targetUserId: targetIdentifier,
          clientTempId: tempId
        }, {
          params: {
            user_room: targetRoom || undefined,
            targetUserId: targetIdentifier
          }
        });

        // Đánh dấu tin nhắn gửi thành công và lưu ngay vào cache localStorage
        setMessages(prev => {
          const nextList = prev.map(m => m.id === tempId ? {
            ...m,
            pending: false,
            mediaUrl: uploadedMediaUrl || m.mediaUrl
          } : m);
          if (targetIdentifier) {
            messagesCacheRef.current.set(String(targetIdentifier), nextList);
            try {
              localStorage.setItem(`talovin_dm_msgs_${targetIdentifier}`, JSON.stringify(nextList.slice(-50)));
            } catch (_) {}
          }
          if (targetRoom) {
            messagesCacheRef.current.set(String(targetRoom), nextList);
            try {
              localStorage.setItem(`talovin_dm_msgs_${targetRoom}`, JSON.stringify(nextList.slice(-50)));
            } catch (_) {}
          }
          return nextList;
        });

      } catch (e) {
        console.error('Lỗi gửi tin nhắn 1-1:', e);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, failed: true, pending: false } : m));
        toast.error('Không thể gửi tin nhắn. Vui lòng thử lại!', { id: tempId });
      }
    })();
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

  // Lấy trạng thái PIN từ server khi khởi tạo
  useEffect(() => {
    axiosClient.get('/message/hidden/status').then(res => {
      if (res?.data?.data) {
        setHasServerPin(Boolean(res.data.data.hasPin));
        if (Array.isArray(res.data.data.hiddenPartnerIds)) {
          const ids = new Set(res.data.data.hiddenPartnerIds.map(String));
          setHiddenPartnerIds(ids);
          try {
            localStorage.setItem('talovin_hidden_partner_ids', JSON.stringify(Array.from(ids)));
          } catch (_) {}
        }
      }
    }).catch(() => {});
  }, []);

  // Đóng menu tùy chọn cuộc trò chuyện khi click ra ngoài
  useEffect(() => {
    const handleDocClick = () => setActiveMenuPartnerId(null);
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  // Tự động kiểm tra mã PIN 6 số khi người dùng nhập vào ô tìm kiếm (chuẩn Zalo)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (/^\d{6}$/.test(trimmed)) {
      axiosClient.post('/message/hidden/verify-pin', { pin: trimmed })
        .then(res => {
          if (res?.data?.data?.verified) {
            setIsUnlocked(true);
            setSearchQuery('');
            if (Array.isArray(res.data.data.hiddenPartnerIds)) {
              const ids = new Set(res.data.data.hiddenPartnerIds.map(String));
              setHiddenPartnerIds(ids);
              try {
                localStorage.setItem('talovin_hidden_partner_ids', JSON.stringify(Array.from(ids)));
              } catch (_) {}
            }
            toast.success("🔓 Đã mở khóa các cuộc trò chuyện ẩn!");
          }
        })
        .catch(() => {});
    }
  }, [searchQuery]);

  const handleInitiateHide = (partner) => {
    setActiveMenuPartnerId(null);
    setPinError('');
    setPinInput('');
    setPinConfirmInput('');
    if (!hasServerPin) {
      setPinStep(1);
      setPinModal({ open: true, mode: 'setup', targetPartner: partner });
    } else {
      setPinModal({ open: true, mode: 'hide', targetPartner: partner });
    }
  };

  const handleInitiateUnhide = (partner) => {
    setActiveMenuPartnerId(null);
    setPinError('');
    setPinInput('');
    setPinModal({ open: true, mode: 'unhide', targetPartner: partner });
  };

  const handleOpenUnlockModal = () => {
    setPinError('');
    setPinInput('');
    setPinConfirmInput('');
    if (!hasServerPin) {
      setPinStep(1);
      setPinModal({ open: true, mode: 'setup', targetPartner: null });
    } else {
      setPinModal({ open: true, mode: 'verify', targetPartner: null });
    }
  };

  const handlePinSubmit = async (e) => {
    if (e) e.preventDefault();
    setPinError('');

    if (pinModal.mode === 'setup') {
      if (pinStep === 1) {
        if (!/^\d{6}$/.test(pinInput)) {
          setPinError('Mã PIN phải bao gồm đúng 6 chữ số (0-9)');
          return;
        }
        setPinStep(2);
        return;
      } else {
        if (pinConfirmInput !== pinInput) {
          setPinError('Mã PIN xác thực không khớp! Vui lòng nhập lại.');
          return;
        }
        setPinLoading(true);
        try {
          await axiosClient.post('/message/hidden/setup-pin', { pin: pinInput });
          setHasServerPin(true);
          if (pinModal.targetPartner) {
            await axiosClient.post('/message/hidden/hide', { partnerId: pinModal.targetPartner.id, pin: pinInput });
            const newHidden = new Set(hiddenPartnerIds);
            newHidden.add(String(pinModal.targetPartner.id));
            setHiddenPartnerIds(newHidden);
            setFriends(prev => prev.map(f => f.id === pinModal.targetPartner.id ? { ...f, isHidden: true } : f));
            localStorage.setItem('talovin_hidden_partner_ids', JSON.stringify(Array.from(newHidden)));
            toast.success(`🛡️ Đã cài PIN và ẩn cuộc trò chuyện với ${pinModal.targetPartner.nickname || pinModal.targetPartner.account}!`);
            if (activePartner?.id === pinModal.targetPartner.id && !isUnlocked) {
              navigate('/messages', { replace: true });
              setActivePartner(null);
            }
          } else {
            toast.success('🛡️ Đã thiết lập mã PIN 6 số bảo mật thành công!');
          }
          setPinModal({ open: false, mode: 'verify', targetPartner: null });
        } catch (err) {
          setPinError(err?.response?.data?.message || 'Có lỗi xảy ra khi cài đặt mã PIN');
        } finally {
          setPinLoading(false);
        }
      }
    } else if (pinModal.mode === 'hide') {
      if (!/^\d{6}$/.test(pinInput)) {
        setPinError('Vui lòng nhập đúng 6 chữ số mã PIN');
        return;
      }
      setPinLoading(true);
      try {
        await axiosClient.post('/message/hidden/hide', { partnerId: pinModal.targetPartner?.id, pin: pinInput });
        const newHidden = new Set(hiddenPartnerIds);
        newHidden.add(String(pinModal.targetPartner?.id));
        setHiddenPartnerIds(newHidden);
        setFriends(prev => prev.map(f => f.id === pinModal.targetPartner?.id ? { ...f, isHidden: true } : f));
        localStorage.setItem('talovin_hidden_partner_ids', JSON.stringify(Array.from(newHidden)));
        toast.success(`🔒 Đã ẩn cuộc trò chuyện thành công!`);
        if (activePartner?.id === pinModal.targetPartner?.id && !isUnlocked) {
          navigate('/messages', { replace: true });
          setActivePartner(null);
        }
        setPinModal({ open: false, mode: 'verify', targetPartner: null });
      } catch (err) {
        setPinError(err?.response?.data?.message || 'Mã PIN không chính xác!');
      } finally {
        setPinLoading(false);
      }
    } else if (pinModal.mode === 'verify') {
      if (!/^\d{6}$/.test(pinInput)) {
        setPinError('Vui lòng nhập đúng 6 chữ số mã PIN');
        return;
      }
      setPinLoading(true);
      try {
        const res = await axiosClient.post('/message/hidden/verify-pin', { pin: pinInput });
        if (res?.data?.data?.verified) {
          setIsUnlocked(true);
          if (Array.isArray(res.data.data.hiddenPartnerIds)) {
            const ids = new Set(res.data.data.hiddenPartnerIds.map(String));
            setHiddenPartnerIds(ids);
            localStorage.setItem('talovin_hidden_partner_ids', JSON.stringify(Array.from(ids)));
          }
          toast.success('🔓 Đã mở khóa các cuộc trò chuyện ẩn!');
          setPinModal({ open: false, mode: 'verify', targetPartner: null });
        }
      } catch (err) {
        setPinError(err?.response?.data?.message || 'Mã PIN không chính xác! Vui lòng thử lại.');
      } finally {
        setPinLoading(false);
      }
    } else if (pinModal.mode === 'unhide') {
      setPinLoading(true);
      try {
        await axiosClient.post('/message/hidden/unhide', { partnerId: pinModal.targetPartner?.id, pin: pinInput });
        const newHidden = new Set(hiddenPartnerIds);
        newHidden.delete(String(pinModal.targetPartner?.id));
        setHiddenPartnerIds(newHidden);
        setFriends(prev => prev.map(f => f.id === pinModal.targetPartner?.id ? { ...f, isHidden: false } : f));
        localStorage.setItem('talovin_hidden_partner_ids', JSON.stringify(Array.from(newHidden)));
        toast.success(`Đã bỏ ẩn cuộc trò chuyện!`);
        setPinModal({ open: false, mode: 'verify', targetPartner: null });
      } catch (err) {
        setPinError(err?.response?.data?.message || 'Có lỗi xảy ra khi bỏ ẩn cuộc trò chuyện');
      } finally {
        setPinLoading(false);
      }
    }
  };

  // Lọc danh sách hội thoại theo ô tìm kiếm và sắp xếp chuẩn
  const filteredConversations = useMemo(() => {
    let list = [...friends];
    // Nếu chưa mở khóa: Loại bỏ hoàn toàn các cuộc trò chuyện bị ẩn khỏi danh sách
    if (!isUnlocked) {
      list = list.filter(f => !hiddenPartnerIds.has(String(f.id)) && !f.isHidden);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f =>
        (f.nickname && f.nickname.toLowerCase().includes(q)) ||
        (f.account && f.account.toLowerCase().includes(q))
      );
    }

    return sortConversationsList(list);
  }, [friends, searchQuery, isUnlocked, hiddenPartnerIds]);

  // ID an toàn cho cuộc gọi WebRTC
  const safeCallTargetId = activePartner?.id || activePartner?.userId || (urlTargetUserId && !isNaN(Number(urlTargetUserId)) ? urlTargetUserId : null);

  // Tìm ID tin nhắn cuối cùng do mình gửi mà đối phương đã xem
  const lastReadMyMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const isMyMsg = String(m.senderId || m.userId) === String(currentUserId);
      if (isMyMsg && (m.isRead || m.timeRead)) {
        return m.id;
      }
    }
    return null;
  }, [messages, currentUserId]);

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 select-none overflow-hidden font-sans animate-in fade-in duration-200">

      {/* HEADER TOÀN TRANG (Topbar) - Ẩn trên mobile khi đang mở khung chat chi tiết để tránh trùng lặp 2 thanh Header */}
      <header className={`h-14 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur px-4 items-center justify-between shrink-0 z-20 ${urlTargetUserId ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 -ml-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer active:scale-95"
            title="Quay lại"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Quay lại</span>
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
        <aside className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-zinc-800/80 bg-zinc-950 shrink-0 transition-all duration-200 ${urlTargetUserId ? 'hidden md:flex' : 'flex animate-in fade-in duration-150'}`}>
          {/* Ô tìm kiếm bạn bè & Nút mở khóa đoạn chat ẩn */}
          <div className="p-3 border-b border-zinc-800/60 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm hoặc gõ PIN 6 số..."
                className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors font-sans"
              />
            </div>

            {/* Nút Khóa / Mở khóa đoạn chat ẩn */}
            {!isUnlocked ? (
              <button
                type="button"
                onClick={handleOpenUnlockModal}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-amber-400 hover:border-amber-500/40 transition-all flex items-center gap-1 shrink-0"
                title={hasServerPin ? "Mở khóa đoạn chat ẩn (Mã PIN 6 số)" : "Cài đặt mã PIN 6 số cho đoạn chat ẩn"}
              >
                <Lock size={15} />
                {hiddenPartnerIds.size > 0 && (
                  <span className="text-[10px] font-mono px-1 rounded-full bg-zinc-800 text-amber-400 font-bold">
                    {hiddenPartnerIds.size}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsUnlocked(false);
                  toast("🔒 Đã khóa lại các cuộc trò chuyện ẩn");
                }}
                className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/80 transition-all flex items-center gap-1 shrink-0"
                title="Đang hiện cuộc trò chuyện ẩn - Bấm để khóa lại"
              >
                <Unlock size={15} />
                <span className="text-[10px] font-semibold hidden sm:inline">Khóa</span>
              </button>
            )}
          </div>

          <div className="px-3 pt-3 pb-1 text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
            <span>Cuộc trò chuyện gần đây ({filteredConversations.length})</span>
            {isUnlocked && (
              <span className="text-[10px] text-emerald-400 font-mono font-medium lowercase">
                chế độ đã mở khóa
              </span>
            )}
          </div>

          {/* Danh sách người dùng */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {loadingFriends && friends.length === 0 ? (
              <div className="p-1 space-y-2 animate-pulse">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/40 border border-zinc-850/50">
                    <div className="w-10.5 h-10.5 rounded-full bg-zinc-800/80 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-28 bg-zinc-800/80 rounded" />
                        <div className="h-2 w-10 bg-zinc-800/50 rounded" />
                      </div>
                      <div className="h-2.5 w-36 bg-zinc-800/50 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-12 px-4 text-center text-zinc-500 text-xs">
                Chưa có cuộc trò chuyện nào. Hãy chọn bạn bè để bắt đầu nhắn tin!
              </div>
            ) : (
              filteredConversations.map((partner) => {
                const partnerIdStr = partner.id?.toString();
                const isSelected = activePartner?.id?.toString() === partnerIdStr;
                const unreadCount = Number(unreadMap[partner.id]) || Number(unreadMap[partnerIdStr]) || (Number(partner.unreadCount) && !isSelected ? Number(partner.unreadCount) : 0);
                const isUnread = !isSelected && unreadCount > 0;
                const isThisHidden = hiddenPartnerIds.has(String(partner.id)) || partner.isHidden;

                // Trạng thái online: Nhanh nhạy & chuẩn xác theo thời gian thực
                const isPartnerOnline = isUserOnline(partner.id);

                return (
                  <div
                    key={partner.id}
                    onClick={() => {
                      lastTargetIdRef.current = String(partner.id);
                      navigate(`/messages/${partner.id}${location.search}`, { replace: true, state: location.state });
                      openDirectChat(partner.id, partner);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 ease-out active:scale-[0.98] relative group ${isSelected
                      ? 'bg-zinc-800/90 border border-zinc-700/90 text-white shadow-sm'
                      : isUnread
                        ? 'bg-zinc-900/95 border border-emerald-500/50 text-white shadow-md'
                        : 'hover:bg-zinc-900/60 text-zinc-300 border border-transparent'
                      }`}
                  >
                    <div className="relative shrink-0">
                      <UserAvatar avatarUrl={partner.avatar} username={partner.account} name={partner.nickname || partner.account || 'Người dùng'} size={42} />
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-950 ${isPartnerOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-zinc-600'
                        }`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                          <h4 className={`text-xs truncate ${isUnread ? 'font-bold text-white' : 'font-semibold text-zinc-200'}`}>
                            {partner.nickname || partner.account || 'Người dùng'}
                          </h4>
                          {isThisHidden && (
                            <span className="shrink-0 text-amber-400" title="Đoạn chat đã ẩn">
                              <Lock size={11} />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <span className={`text-[10px] font-mono ${isUnread ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}`}>
                            {partner.lastMessageFormattedTime || (partner.lastMessageTime ? new Date(partner.lastMessageTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')}
                          </span>

                          {/* Menu 3 chấm trên từng cuộc trò chuyện */}
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuPartnerId(activeMenuPartnerId === partner.id ? null : partner.id);
                              }}
                              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors opacity-70 group-hover:opacity-100"
                              title="Tùy chọn cuộc trò chuyện"
                            >
                              <MoreVertical size={13} />
                            </button>

                            {activeMenuPartnerId === partner.id && (
                              <div className="absolute right-0 top-6 w-44 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                                {!isThisHidden ? (
                                  <button
                                    type="button"
                                    onClick={() => handleInitiateHide(partner)}
                                    className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-rose-400 hover:bg-zinc-800/80 flex items-center gap-2 transition-colors"
                                  >
                                    <EyeOff size={13} className="text-zinc-400" />
                                    <span>Ẩn cuộc trò chuyện</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleInitiateUnhide(partner)}
                                    className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-emerald-400 hover:bg-zinc-800/80 flex items-center gap-2 transition-colors"
                                  >
                                    <Eye size={13} className="text-zinc-400" />
                                    <span>Bỏ ẩn cuộc trò chuyện</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
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
        <main className={`flex-1 flex flex-col bg-zinc-950 overflow-hidden transition-all duration-200 ${!urlTargetUserId ? 'hidden md:flex' : 'flex animate-in fade-in duration-200'}`}>
          {!urlTargetUserId || !activePartner ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 shadow-sm">
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
              <div className="h-14 px-3 sm:px-4 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/messages', { replace: true });
                      setActivePartner(null);
                    }}
                    className="md:hidden p-2 -ml-1 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-900 transition-colors cursor-pointer active:scale-95 shrink-0"
                    title="Trở về Hộp thư tin nhắn"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div 
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      if (activePartner?.id) {
                        navigate(`/profile/${activePartner.id}`);
                      }
                    }}
                    title="Xem trang cá nhân"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar avatarUrl={activePartner?.avatar} username={activePartner?.account} name={activePartner?.nickname || activePartner?.account || 'Người dùng'} size={36} />
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${isUserOnline(activePartner?.id) ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-zinc-600'
                        }`} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                        {activePartner?.nickname || activePartner?.account || 'Người dùng'}
                      </h3>
                      {isUserOnline(activePartner.id) ? (
                        <span className="font-sans text-xs text-zinc-400 flex items-center gap-1.5 font-normal">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                          Trực tuyến
                        </span>
                      ) : (
                        <span className="font-sans text-xs text-zinc-400 flex items-center gap-1.5 font-normal">
                          <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0"></span>
                          {getUserStatusText(activePartner.id)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nút hành động Gọi thoại & Gọi video */}
                <div className="flex items-center gap-1.5 sm:gap-2">
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
                    className="h-8.5 sm:h-9 px-2.5 sm:px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                    title="Gọi thoại"
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
                    className="h-8.5 sm:h-9 px-2.5 sm:px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                    title="Gọi video"
                  >
                    <Video size={13} className="text-zinc-300" />
                    <span className="hidden sm:inline">Gọi Video</span>
                  </button>

                  {/* Menu tùy chọn trong Header đoạn chat */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setActiveMenuPartnerId(activeMenuPartnerId === 'header' ? null : 'header')}
                      className="h-8.5 sm:h-9 w-8.5 sm:w-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 flex items-center justify-center transition-all cursor-pointer"
                      title="Tùy chọn cuộc trò chuyện"
                    >
                      <MoreVertical size={14} />
                    </button>

                    {activeMenuPartnerId === 'header' && (
                      <div className="absolute right-0 top-10 w-48 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                        {!(hiddenPartnerIds.has(String(activePartner?.id)) || activePartner?.isHidden) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuPartnerId(null);
                              handleInitiateHide(activePartner);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-rose-400 hover:bg-zinc-800/80 flex items-center gap-2 transition-colors"
                          >
                            <EyeOff size={13} className="text-zinc-400" />
                            <span>Ẩn cuộc trò chuyện</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuPartnerId(null);
                              handleInitiateUnhide(activePartner);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-emerald-400 hover:bg-zinc-800/80 flex items-center gap-2 transition-colors"
                          >
                            <Eye size={13} className="text-zinc-400" />
                            <span>Bỏ ẩn cuộc trò chuyện</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* VÙNG HIỂN THỊ NỘI DUNG TIN NHẮN */}
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
              >
                {loadingMessages && messages.length === 0 ? (
                  <div className="py-6 space-y-5 animate-pulse max-w-2xl mx-auto">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-zinc-800/80 shrink-0" />
                      <div className="space-y-1.5 max-w-[65%]">
                        <div className="h-10 w-52 bg-zinc-800/80 rounded-2xl rounded-tl-sm border border-zinc-700/20" />
                        <div className="h-2 w-12 bg-zinc-800/40 rounded" />
                      </div>
                    </div>
                    <div className="flex items-start justify-end gap-2.5">
                      <div className="space-y-1.5 max-w-[65%] flex flex-col items-end">
                        <div className="h-11 w-60 bg-zinc-800/70 rounded-2xl rounded-tr-sm border border-zinc-700/30" />
                        <div className="h-2 w-12 bg-zinc-800/40 rounded" />
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-zinc-800/80 shrink-0" />
                      <div className="space-y-1.5 max-w-[65%]">
                        <div className="h-12 w-48 bg-zinc-800/80 rounded-2xl rounded-tl-sm border border-zinc-700/20" />
                        <div className="h-2 w-12 bg-zinc-800/40 rounded" />
                      </div>
                    </div>
                    <div className="flex items-start justify-end gap-2.5">
                      <div className="space-y-1.5 max-w-[65%] flex flex-col items-end">
                        <div className="h-9 w-40 bg-zinc-800/70 rounded-2xl rounded-tr-sm border border-zinc-700/30" />
                        <div className="h-2 w-12 bg-zinc-800/40 rounded" />
                      </div>
                    </div>
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
                    const isMe = (msg.userId ?? msg.senderId)?.toString() === currentUserId?.toString();
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
                          try { unescaped = JSON.parse(unescaped); } catch (_) { }
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
                      } catch (_) { }
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
                          className={`w-full flex ${isMe ? 'justify-end' : 'justify-start'} my-2`}
                        >
                          <div
                            className={`w-72 rounded-2xl p-3.5 shadow-sm border bg-zinc-900 border-zinc-800 ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                          >
                            {/* Tiêu đề & Icon loại cuộc gọi */}
                            <div className="flex items-center justify-between gap-2 mb-2.5 pb-2.5 border-b border-zinc-800/80">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-zinc-800">
                                  {isMissed ? (
                                    <PhoneMissed size={15} className="text-rose-400" />
                                  ) : isVideo ? (
                                    <Video size={15} className="text-emerald-400" />
                                  ) : (
                                    <PhoneCall size={15} className="text-emerald-400" />
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-xs text-zinc-100 font-sans">
                                    {isVideo ? 'Cuộc gọi video' : 'Cuộc gọi thoại'}
                                  </span>
                                  <span className={`text-[11px] font-sans ${isMissed ? 'text-rose-400 font-medium' : 'text-zinc-400'}`}>
                                    {isMissed
                                      ? (isMe ? 'Đối phương nhỡ' : 'Cuộc gọi nhỡ')
                                      : (isMe ? 'Cuộc gọi đi' : 'Cuộc gọi đến')}
                                  </span>
                                </div>
                              </div>
                              {timeStr && (
                                <span className="text-[10px] text-zinc-500 font-sans shrink-0">
                                  {timeStr}
                                </span>
                              )}
                            </div>

                            {/* Thời lượng đàm thoại & Nút gọi lại */}
                            <div className="flex items-center justify-between pt-0.5">
                              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-sans">
                                <Clock size={12} className="text-zinc-500" />
                                <span className="text-[11px]">Thời lượng:</span>
                                <span className="font-mono text-[11px] text-zinc-300">
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
                                className="bg-zinc-800 hover:bg-zinc-700 text-white font-sans text-xs font-medium px-3 h-8 rounded-lg flex items-center gap-1.5 transition-colors border border-zinc-700/60"
                              >
                                {isVideo ? <Video size={12} /> : <PhoneCall size={12} />}
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
                          className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words relative shadow-sm ${isMe
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
                            <div className="mb-2 rounded-xl overflow-hidden border border-zinc-800/80 max-w-sm aspect-video bg-black flex items-center justify-center">
                              {mediaObj.type === 'VIDEO' ? (
                                <video
                                  src={resolveMediaUrl(mediaObj.url)}
                                  controls
                                  preload="metadata"
                                  playsInline
                                  className="w-full h-full max-h-72 object-cover rounded-xl bg-black"
                                />
                              ) : (
                                <img
                                  src={resolveMediaUrl(mediaObj.url)}
                                  alt="Đính kèm"
                                  loading="lazy"
                                  decoding="async"
                                  onClick={() => setLightboxMedia(resolveMediaUrl(mediaObj.url))}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    const orig = mediaObj.url;
                                    if (orig && orig.includes('.r2.dev/')) {
                                      const key = orig.split('.r2.dev/')[1];
                                      if (key) e.currentTarget.src = `${BACKEND_URL || ''}/api/message/files/${key}`;
                                    }
                                  }}
                                  className="w-full h-full max-h-72 object-cover cursor-pointer hover:opacity-95 transition-opacity rounded-xl"
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

                        {/* Trạng thái gửi & Đã đọc công nghệ cao (Cyber Seen Radar) */}
                        <div className={`flex items-center gap-1.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {msg.formattedTime || (msg.timeSend ? new Date(msg.timeSend).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')}
                          </span>

                          {isMe && (
                            msg.pending ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-mono animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                <span>Đang gửi...</span>
                              </span>
                            ) : (msg.isRead || msg.timeRead) ? (
                              <div
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono shadow-[0_0_8px_rgba(16,185,129,0.25)] select-none transition-all hover:scale-105"
                                title={`Đã đọc lúc ${msg.formattedTimeRead || msg.formattedTime || ''}`}
                              >
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                                </span>
                                <span>Đã xem</span>
                                {msg.formattedTimeRead && <span className="opacity-80">• {msg.formattedTimeRead}</span>}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-400 font-mono" title="Đã chuyển đến máy chủ">
                                <CheckCheck size={12} className="text-zinc-400" />
                                <span>Đã gửi</span>
                              </span>
                            )
                          )}
                        </div>

                        {/* Cyber Seen Stamp cho tin nhắn đọc sau cùng */}
                        {isMe && msg.id === lastReadMyMsgId && (
                          <div className="flex items-center gap-1.5 pt-1 text-[10px] text-emerald-400 select-none animate-in fade-in zoom-in-95 duration-200">
                            <div className="relative flex items-center justify-center">
                              <UserAvatar
                                avatarUrl={activePartner?.avatar}
                                username={activePartner?.account}
                                name={activePartner?.nickname || activePartner?.account}
                                size={16}
                                className="ring-1 ring-emerald-400/60"
                              />
                              <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-zinc-950 animate-pulse" />
                            </div>
                            <span className="font-mono text-[10px] text-emerald-400/90 font-medium">
                              {activePartner?.nickname || activePartner?.account || 'Đối phương'} đã xem {msg.formattedTimeRead ? `lúc ${msg.formattedTimeRead}` : ''}
                            </span>
                          </div>
                        )}
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
                  placeholder={partnerNotFound ? "Không thể nhắn tin cho người dùng này..." : `Nhắn tin cho ${activePartner?.nickname || activePartner?.account || 'đối phương'}...`}
                  className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-sans disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={(!textInput.trim() && !selectedMedia) || partnerNotFound}
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
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${forwardTab === 'friends' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                <User size={12} />
                Bạn bè ({friends.length})
              </button>
              <button
                type="button"
                onClick={() => setForwardTab('rooms')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${forwardTab === 'rooms' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
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

      {/* ============================================================== */}
      {/* MODAL MÃ PIN 6 SỐ BẢO MẬT CUỘC TRÒ CHUYỆN ẨN (SERVER BCRYPT) */}
      {/* ============================================================== */}
      {pinModal.open && (
        <div className="fixed inset-0 z-[999999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#12151d] border border-zinc-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setPinModal({ open: false, mode: 'verify', targetPartner: null })}
              className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                {pinModal.mode === 'setup' ? <KeyRound size={22} /> : <Lock size={22} />}
              </div>

              <h3 className="text-sm font-bold text-white tracking-tight">
                {pinModal.mode === 'setup'
                  ? (pinStep === 1 ? 'Cài đặt mã PIN 6 số' : 'Xác thực lại mã PIN')
                  : pinModal.mode === 'hide'
                    ? 'Ẩn cuộc trò chuyện'
                    : pinModal.mode === 'unhide'
                      ? 'Bỏ ẩn cuộc trò chuyện'
                      : 'Mở khóa cuộc trò chuyện ẩn'}
              </h3>

              <p className="text-xs text-zinc-400 leading-relaxed">
                {pinModal.mode === 'setup'
                  ? (pinStep === 1
                    ? 'Nhập mã PIN 6 số bí mật để bảo vệ các cuộc trò chuyện riêng tư của bạn (Mã hoá bảo mật phía server).'
                    : 'Vui lòng nhập lại chính xác 6 số bạn vừa đặt để hoàn tất xác thực.')
                  : pinModal.mode === 'hide'
                    ? `Nhập mã PIN 6 số để ẩn cuộc trò chuyện với ${pinModal.targetPartner?.nickname || pinModal.targetPartner?.account}.`
                    : pinModal.mode === 'unhide'
                      ? 'Nhập mã PIN 6 số để hiển thị lại cuộc trò chuyện này trong hộp thư.'
                      : 'Nhập mã PIN 6 số của bạn để xem và nhắn tin trong các cuộc trò chuyện đã ẩn.'}
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4 pt-1">
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinModal.mode === 'setup' && pinStep === 2 ? pinConfirmInput : pinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    if (pinModal.mode === 'setup' && pinStep === 2) {
                      setPinConfirmInput(val);
                    } else {
                      setPinInput(val);
                    }
                    if (pinError) setPinError('');
                  }}
                  placeholder="••••••"
                  autoFocus
                  className="w-full text-center text-2xl tracking-[0.6em] font-mono py-3 px-4 rounded-2xl bg-zinc-900 border border-zinc-700/80 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              {pinError && (
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center font-medium">
                  {pinError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (pinModal.mode === 'setup' && pinStep === 2) {
                      setPinStep(1);
                      setPinConfirmInput('');
                      setPinError('');
                    } else {
                      setPinModal({ open: false, mode: 'verify', targetPartner: null });
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
                >
                  {pinModal.mode === 'setup' && pinStep === 2 ? 'Quay lại' : 'Hủy'}
                </button>

                <button
                  type="submit"
                  disabled={pinLoading || ((pinModal.mode === 'setup' && pinStep === 2 ? pinConfirmInput : pinInput).length !== 6)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {pinLoading
                    ? 'Đang xử lý...'
                    : pinModal.mode === 'setup' && pinStep === 1
                      ? 'Tiếp tục'
                      : pinModal.mode === 'hide'
                        ? 'Ẩn ngay'
                        : pinModal.mode === 'unhide'
                          ? 'Bỏ ẩn'
                          : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default DirectMessagePage;
