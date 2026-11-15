import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Search, MessageSquare, Phone, PhoneOff, Video, VideoOff, 
  Mic, MicOff, Send, Image as ImageIcon, Smile, MoreVertical, User, 
  Clock, CheckCircle2, ChevronDown, Volume2, Shield, Share2, Sparkles,
  PhoneCall, PhoneMissed, Reply, CornerUpLeft, Forward, X, Play, Heart,
  ThumbsUp, Flame, Check, CheckCheck
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

export const DirectMessagePage = () => {
  const { userId: routeUserId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isUserOnline } = usePresence();

  const urlTargetUserId = routeUserId || searchParams.get('userId') || searchParams.get('user_id');
  const passedTargetUser = location.state?.targetUser || location.state?.partner;

  const currentUserId = localStorage.getItem('user_id');
  const currentUserName = localStorage.getItem('nickname') || localStorage.getItem('account') || 'Bạn';

  // Danh sách bạn bè / hội thoại
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
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

  // Cuộc gọi đến (Incoming Call)
  const [incomingCall, setIncomingCall] = useState(null);

  // Refs
  const stompClient = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

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
      axiosClient.post('/presence/heartbeat').catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 25000);
    return () => clearInterval(interval);
  }, []);

  // Tự động yêu cầu quyền thông báo hệ thống khi vào trang nhắn tin
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // 1. Tải danh sách bạn bè
  useEffect(() => {
    const fetchFriends = async () => {
      try {
        setLoadingFriends(true);
        const res = await axiosClient.get('/friends/list');
        if (res?.data?.data && Array.isArray(res.data.data)) {
          setFriends(res.data.data);
        }
      } catch (e) {
        console.error('Lỗi nạp danh sách bạn bè:', e);
      } finally {
        setLoadingFriends(false);
      }
    };
    fetchFriends();
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
      if (!prev[targetId] && (!fallbackPartner || !prev[fallbackPartner.id])) return prev;
      const next = { ...prev };
      delete next[targetId];
      if (fallbackPartner?.id) delete next[fallbackPartner.id];
      return next;
    });

    try {
      setLoadingMessages(true);
      let res = null;

      // Thử gọi lấy phòng chat 1-1 bằng targetId (ID số)
      try {
        res = await axiosClient.get(`/message/direct/${targetId}`);
      } catch (err1) {
        // Nếu thất bại và có username của đối phương, thử bằng username
        if (fallbackPartner?.account && fallbackPartner.account.toString() !== targetId.toString()) {
          try {
            res = await axiosClient.get(`/message/direct/${fallbackPartner.account}`);
          } catch (_) {}
        }
        // Fallback sang endpoint phòng
        if (!res) {
          try {
            res = await axiosClient.post(`/rooms/direct/${targetId}`);
          } catch (_) {
            if (fallbackPartner?.account) {
              try {
                res = await axiosClient.post(`/rooms/direct/${fallbackPartner.account}`);
              } catch (_) {}
            }
          }
        }
      }

      if (res?.data?.data) {
        const { roomId, targetUser } = res.data.data;
        setActiveRoomId(roomId);
        if (targetUser) {
          setActivePartner(targetUser);
        }
        setPartnerNotFound(false);

        // Nạp lịch sử tin nhắn của phòng DM này
        try {
          const histRes = await axiosClient.get(`/message/${roomId}`);
          if (histRes?.data?.data && Array.isArray(histRes.data.data)) {
            setMessages(histRes.data.data);
            setTimeout(() => scrollToBottom(false), 80);

            // Cập nhật preview tin nhắn cuối cùng cho bạn bè này
            if (histRes.data.data.length > 0) {
              const lastMsg = histRes.data.data[histRes.data.data.length - 1];
              setFriends(prev => prev.map(f => {
                if (f.id?.toString() === targetId.toString() || (targetUser && f.id?.toString() === targetUser.id?.toString())) {
                  return { 
                    ...f, 
                    lastMessage: lastMsg.message, 
                    lastMessageTime: lastMsg.timeSend || new Date().toISOString(),
                    lastMessageFormattedTime: lastMsg.formattedTime
                  };
                }
                return f;
              }));
            }
          } else {
            setMessages([]);
          }
        } catch (_) {
          setMessages([]);
        }
      } else if (!fallbackPartner) {
        setPartnerNotFound(true);
        setActiveRoomId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error('Lỗi mở chat 1-1:', e);
      if (!fallbackPartner && e.response?.status === 404) {
        setPartnerNotFound(true);
        setActiveRoomId(null);
        setMessages([]);
      }
    } finally {
      setLoadingMessages(false);
    }
  }, [currentUserId, scrollToBottom]);

  // Kích hoạt khi URL param hoặc targetUser thay đổi (Chống vòng lặp vô tận)
  const lastTargetIdRef = useRef(null);
  useEffect(() => {
    if (!urlTargetUserId) return;
    if (urlTargetUserId === lastTargetIdRef.current && activePartner) return;

    lastTargetIdRef.current = urlTargetUserId;
    const foundInFriends = friends.find(f => f.id?.toString() === urlTargetUserId?.toString() || f.account === urlTargetUserId);
    const effectivePartner = passedTargetUser || foundInFriends;

    if (effectivePartner) {
      setActivePartner(effectivePartner);
      if (!foundInFriends) {
        setFriends(prev => [effectivePartner, ...prev.filter(f => f.id?.toString() !== urlTargetUserId?.toString())]);
      }
    }
    openDirectChat(urlTargetUserId, effectivePartner);
  }, [urlTargetUserId, passedTargetUser, friends.length, openDirectChat]);

  // 3. Kết nối WebSocket STOMP
  useEffect(() => {
    let client = null;
    const token = localStorage.getItem('accesstoken');

    try {
      client = createStompClient();
      client.connect({ Authorization: `Bearer ${token}` }, () => {
        stompClient.current = client;

        // Nhận tín hiệu cuộc gọi đến cá nhân
        if (currentUserId) {
          client.subscribe(`/topic/call/user/${currentUserId}`, (message) => {
            try {
              const signal = JSON.parse(message.body);
              if (signal && (signal.type === 'OFFER' || signal.type === 'RINGING')) {
                setIncomingCall(signal);
              } else if (signal && (signal.type === 'END' || signal.type === 'DECLINE')) {
                setIncomingCall(null);
              }
            } catch (e) {}
          });

          // Nhận thông báo tin nhắn mới gửi trực tiếp cho user
          client.subscribe(`/topic/messages/${currentUserId}`, (message) => {
            try {
              const newMsg = JSON.parse(message.body);
              const isFromMe = newMsg.userId?.toString() === currentUserId?.toString();
              const isCurrentChat = activePartner?.id?.toString() === newMsg.userId?.toString() ||
                                    activePartner?.id?.toString() === newMsg.senderId?.toString();

              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                const hasPending = prev.some(m => m.pending && m.message === newMsg.message);
                if (hasPending) {
                  return prev.map(m => (m.pending && m.message === newMsg.message) ? newMsg : m);
                }

                // Phát âm thanh & thông báo khi có tin nhắn từ đối phương
                if (!isFromMe) {
                  playMessageIncoming();

                  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && (document.hidden || !isCurrentChat)) {
                    try {
                      new Notification(newMsg.nickname || newMsg.senderUsername || 'Tin nhắn mới', {
                        body: newMsg.message || (newMsg.mediaType === 'IMAGE' ? '[Hình ảnh]' : '[Tệp tin]'),
                        icon: newMsg.senderAvatar || newMsg.avatar || '/favicon.ico',
                        tag: `dm-${newMsg.userId}`
                      });
                    } catch (_) {}
                  }
                }

                return [...prev, newMsg];
              });

              // Cập nhật số lượng chưa đọc nếu không mở đúng phòng chat của họ
              if (!isFromMe && !isCurrentChat && newMsg.userId) {
                setUnreadMap(prev => ({
                  ...prev,
                  [newMsg.userId]: (prev[newMsg.userId] || 0) + 1
                }));
              }

              // Cập nhật preview tin nhắn cuối cùng và đưa bạn bè này lên đầu danh sách
              if (newMsg.userId) {
                const nowTime = newMsg.timeSend || new Date().toISOString();
                const nowFmt = newMsg.formattedTime || new Date(nowTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                
                setFriends(prev => {
                  const targetIdStr = newMsg.userId.toString();
                  const targetFriend = prev.find(f => f.id?.toString() === targetIdStr);
                  const updatedFriend = targetFriend ? {
                    ...targetFriend,
                    lastMessage: newMsg.message || (newMsg.mediaType === 'IMAGE' ? '[Hình ảnh]' : '[Video]'),
                    lastMessageTime: nowTime,
                    lastMessageFormattedTime: nowFmt
                  } : null;

                  const rest = prev.filter(f => f.id?.toString() !== targetIdStr);
                  return updatedFriend ? [updatedFriend, ...rest] : prev;
                });
              }

              setTimeout(() => scrollToBottom(true), 60);
            } catch (e) {}
          });
        }

        // Nhận tin nhắn trong phòng DM đang chọn
        if (activeRoomId) {
          client.subscribe(`/topic/room/${activeRoomId}`, (message) => {
            try {
              const newMsg = JSON.parse(message.body);
              const isFromMe = newMsg.userId?.toString() === currentUserId?.toString();

              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                const hasPending = prev.some(m => m.pending && m.message === newMsg.message);
                if (hasPending) {
                  return prev.map(m => (m.pending && m.message === newMsg.message) ? newMsg : m);
                }

                if (!isFromMe) {
                  playMessageIncoming();
                }

                return [...prev, newMsg];
              });

              setFriends(prev => {
                const targetIdStr = activePartner?.id?.toString();
                const targetFriend = prev.find(f => f.id?.toString() === targetIdStr);
                const updatedFriend = targetFriend ? {
                  ...targetFriend,
                  lastMessage: newMsg.message || (newMsg.mediaType === 'IMAGE' ? '[Hình ảnh]' : '[Video]'),
                  lastMessageTime: newMsg.timeSend || new Date().toISOString(),
                  lastMessageFormattedTime: newMsg.formattedTime || new Date(newMsg.timeSend || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                } : null;

                const rest = prev.filter(f => f.id?.toString() !== targetIdStr);
                return updatedFriend ? [updatedFriend, ...rest] : prev;
              });

              setTimeout(() => scrollToBottom(true), 60);
            } catch (e) {}
          });
        }
      });
    } catch (e) {
      console.error('Lỗi kết nối WebSocket tin nhắn riêng:', e);
    }

    return () => {
      if (client && client.connected) {
        client.disconnect();
      }
    };
  }, [currentUserId, activeRoomId, activePartner, scrollToBottom]);

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

  // 5. Gửi tin nhắn 1-1 (Hỗ trợ Reply, Media, Optimistic UI)
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
        lastMessageFormattedTime: formattedTime
      } : null;

      const rest = prev.filter(f => f.id?.toString() !== partnerIdStr);
      return updated ? [updated, ...rest] : prev;
    });

    try {
      let targetRoom = activeRoomId;
      if (!targetRoom) {
        const targetIdentifier = activePartner?.id || activePartner?.account || urlTargetUserId;
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

        if (roomRes?.data?.data?.roomId) {
          targetRoom = roomRes.data.data.roomId;
          setActiveRoomId(targetRoom);
          if (roomRes.data.data.targetUser && !activePartner) {
            setActivePartner(roomRes.data.data.targetUser);
          }
        }
      }

      if (!targetRoom) {
        throw new Error("Không thể khởi tạo cuộc trò chuyện với người dùng này");
      }

      // Xử lý upload media nếu có tệp đính kèm
      let uploadedMediaUrl = null;
      if (currentMedia?.file) {
        setMediaUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', currentMedia.file);
          formData.append('type', currentMedia.type);
          
          const uploadRes = await axiosClient.post('/posts/upload-media', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          }).catch(() => null);

          if (uploadRes?.data?.data) {
            uploadedMediaUrl = uploadRes.data.data;
          } else {
            // Chuyển sang base64 nếu endpoint upload backend chưa mở
            uploadedMediaUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(currentMedia.file);
            });
          }
        } catch (_) {} finally {
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
        params: { user_room: targetRoom }
      });

      // Đánh dấu tin nhắn gửi thành công
      setMessages(prev => prev.map(m => m.id === tempId ? { 
        ...m, 
        pending: false,
        mediaUrl: uploadedMediaUrl || m.mediaUrl
      } : m));
      setTimeout(() => scrollToBottom(true), 60);
    } catch (err) {
      console.error("Lỗi gửi tin nhắn 1-1:", err);
      const errMsg = err.response?.data?.message || err.message || 'Không thể gửi tin nhắn';
      toast.error(errMsg, { id: 'dm-send-error' });
      // Hoàn tác tin nhắn nếu gửi thất bại
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setTextInput(content);
      if (currentReply) setReplyingTo(currentReply);
      if (currentMedia) setSelectedMedia(currentMedia);
    } finally {
      setSending(false);
    }
  };

  // 6. Thả cảm xúc vào tin nhắn
  const handleToggleReaction = (msgId, emoji) => {
    playReactionPop();
    setActiveReactionPickerMsgId(null);

    setReactionsMap(prev => {
      const msgReactions = prev[msgId] || {};
      const currentCount = msgReactions[emoji] || 0;
      const nextCounts = { ...msgReactions };

      if (currentCount > 0) {
        delete nextCounts[emoji];
      } else {
        nextCounts[emoji] = 1;
      }

      return {
        ...prev,
        [msgId]: nextCounts
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
          message: cleanText,
          timeSend: new Date().toISOString()
        }, {
          params: { user_room: targetRoom }
        });
        toast.success(`Đã chuyển tiếp tin nhắn tới ${targetFriend.nickname || targetFriend.account}!`);
      }
    } catch (err) {
      toast.error("Không thể chuyển tiếp tin nhắn lúc này");
    } finally {
      setForwardingMsg(null);
    }
  };

  // Sắp xếp danh sách hội thoại: Người có tin nhắn mới nhất luôn nổi lên ĐẦU TIÊN
  const sortedConversations = useMemo(() => {
    let list = Array.isArray(friends) ? [...friends] : [];
    if (activePartner && !list.some(f => f.id?.toString() === activePartner.id?.toString())) {
      list.unshift(activePartner);
    }

    return list.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });
  }, [friends, activePartner]);

  // Lọc hội thoại theo từ khóa tìm kiếm
  const filteredConversations = sortedConversations.filter(f => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const cleanQ = q.replace(/^@+/, '');
    return (f.nickname && f.nickname.toLowerCase().includes(q)) || 
           (f.account && f.account.toLowerCase().includes(q)) ||
           (f.account && f.account.toLowerCase().includes(cleanQ));
  });

  // ID an toàn để gọi thoại / video
  const safeCallTargetId = activePartner?.id || activePartner?.userId || urlTargetUserId;

  return (
    <div className="h-screen h-[100dvh] flex flex-col bg-[#09090b] text-zinc-100 overflow-hidden font-sans">
      
      {/* HEADER TOP BREADCRUMB */}
      <header className="h-14 shrink-0 px-4 sm:px-6 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/')} 
            className="p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors flex items-center gap-1.5 text-xs font-mono"
            title="Quay lại Sảnh chính"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Sảnh</span>
          </button>
          
          <div className="h-4 w-[1px] bg-zinc-800"></div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <MessageSquare size={14} />
            </div>
            <span className="font-bold text-sm tracking-tight text-white font-sans">
              Hộp thư Tin nhắn
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-zinc-900 text-zinc-300 text-xs font-medium transition-colors"
        >
          <UserAvatar avatar={localStorage.getItem('user_avatar')} name={currentUserName} size={28} />
          <span className="hidden md:inline text-zinc-200">{currentUserName}</span>
        </button>
      </header>

      {/* BODY 2 CỘT: DANH SÁCH BẠN BÈ / KHUNG CHAT 1-1 */}
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
        
        {/* CỘT TRÁI (320px): HỘP THƯ HỘI THOẠI & BẠN BÈ */}
        <aside className={`w-full md:w-80 lg:w-96 border-r border-zinc-800/80 bg-[#0b0c10] flex flex-col h-full overflow-hidden shrink-0 ${
          activePartner ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Search box */}
          <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-950/60 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bạn bè hoặc tin nhắn..."
                className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-sans"
              />
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1 custom-scrollbar">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              Hội thoại gần đây ({filteredConversations.length})
            </div>

            {loadingFriends && filteredConversations.length === 0 ? (
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
                const unreadCount = unreadMap[partner.id] || unreadMap[partnerIdStr] || 0;
                
                // Trạng thái online: Nhanh nhạy & rõ ràng
                const isPartnerOnline = Boolean(
                  isUserOnline(partner.id) || 
                  partner.isOnline || 
                  isSelected || 
                  (partner.lastMessageTime && (Date.now() - new Date(partner.lastMessageTime).getTime()) < 15 * 60 * 1000)
                );

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
                        : unreadCount > 0
                        ? 'bg-zinc-900/90 border border-emerald-500/30 text-white shadow-sm hover:border-emerald-500/50'
                        : 'hover:bg-zinc-900/60 text-zinc-300 border border-transparent'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <UserAvatar avatarUrl={partner.avatar} username={partner.account} name={partner.nickname || partner.account} size={42} />
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-950 ${isPartnerOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-zinc-600'}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className={`text-xs truncate ${unreadCount > 0 ? 'font-bold text-white' : 'font-semibold text-zinc-200'}`}>
                          {partner.nickname || partner.account}
                        </h4>
                        
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0 ml-1">
                          {partner.lastMessageFormattedTime || (partner.lastMessageTime ? new Date(partner.lastMessageTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-[11px] truncate ${unreadCount > 0 ? 'font-medium text-zinc-100' : 'text-zinc-400'}`}>
                          {partner.lastMessage || 'Bắt đầu cuộc trò chuyện...'}
                        </p>

                        {/* Badge số lượng tin nhắn chưa đọc */}
                        {unreadCount > 0 && (
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

        {/* CỘT PHẢI: KHUNG TRÒ CHUYỆN 1-1 CHI TIẾT */}
        <main className={`flex-1 flex flex-col h-full bg-[#09090b] relative overflow-hidden ${
          !activePartner ? 'hidden md:flex' : 'flex'
        }`}>
          {!activePartner ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-300">Chưa chọn cuộc trò chuyện</h3>
                <p className="text-xs text-zinc-500 max-w-xs mt-1">
                  Chọn một người bạn ở danh sách bên trái hoặc ghé Sảnh để bắt đầu trò chuyện trực tiếp.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* THANH TIÊU ĐỀ CUỘC TRÒ CHUYỆN (HEADER PARTNER) */}
              <div className="h-14 shrink-0 px-4 sm:px-6 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between z-20">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActivePartner(null)}
                    className="p-1 -ml-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 md:hidden transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div 
                    onClick={() => navigate(`/profile/${safeCallTargetId}`)}
                    className="flex items-center gap-3 cursor-pointer group min-w-0"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar avatarUrl={activePartner.avatar} username={activePartner.account} name={activePartner.nickname || activePartner.account} size={38} />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 bg-emerald-500 ring-2 ring-emerald-500/20" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm text-zinc-100 group-hover:text-white truncate">
                        {activePartner.nickname || activePartner.account}
                      </h3>
                      <span className="text-[10px] font-mono flex items-center gap-1 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Trực tuyến • Xem hồ sơ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nút Gọi Thoại & Gọi Video 1-1 */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (!safeCallTargetId) {
                        toast.error("Không tìm thấy thông tin đối phương để gọi!");
                        return;
                      }
                      navigate(`/call/direct/${safeCallTargetId}?type=audio`);
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
                      navigate(`/call/direct/${safeCallTargetId}?type=video`);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors active:scale-[0.98]"
                    title="Bắt đầu cuộc gọi video"
                  >
                    <Video size={13} className="text-zinc-300" />
                    <span className="hidden sm:inline">Gọi Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/profile/${safeCallTargetId}`)}
                    className="h-9 w-9 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 flex items-center justify-center transition-colors active:scale-[0.98]"
                    title="Xem hồ sơ người dùng"
                  >
                    <User size={15} />
                  </button>
                </div>
              </div>

              {/* VÙNG DANH SÁCH TIN NHẮN */}
              <div 
                ref={scrollContainerRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-3 custom-scrollbar"
              >
                {partnerNotFound ? (
                  <div className="py-16 text-center text-zinc-500 space-y-2">
                    <User size={28} className="mx-auto text-rose-500 opacity-80" />
                    <p className="text-sm font-semibold text-zinc-300">Không tìm thấy người dùng này</p>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      Tài khoản người dùng có thể đã bị xóa hoặc thay đổi tên đăng nhập. Vui lòng chọn bạn bè khác để trò chuyện.
                    </p>
                  </div>
                ) : loadingMessages ? (
                  <div className="py-12 text-center text-zinc-500 text-xs font-mono">
                    Đang nạp tin nhắn hội thoại...
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
                    const isCallLog = rawText.startsWith('📞') || rawText.startsWith('📹');
                    const isMissed = isCallLog && rawText.includes('nhỡ');
                    const isVideo = isCallLog && rawText.startsWith('📹');

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

                    if (isCallLog) {
                      return (
                        <div key={msg.id || index} className="w-full flex justify-center my-1.5">
                          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-medium text-zinc-300 shadow-sm">
                            {isMissed ? (
                              <PhoneMissed size={13} className="text-rose-400 shrink-0" />
                            ) : isVideo ? (
                              <Video size={13} className="text-emerald-400 shrink-0" />
                            ) : (
                              <PhoneCall size={13} className="text-emerald-400 shrink-0" />
                            )}
                            <span>{rawText.replace(/^[📞📹]\s*/, '')}</span>
                            <span className="text-[10px] font-mono text-zinc-500 ml-1">
                              {msg.formattedTime || (msg.timeSend ? new Date(msg.timeSend).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={msg.id || index}
                        className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'} space-y-1 ${msg.pending ? 'opacity-70' : ''}`}
                      >
                        {/* Reaction Dock & Action Buttons (xuất hiện khi hover) */}
                        <div className={`hidden group-hover:flex items-center gap-1 bg-zinc-900/95 border border-zinc-800 rounded-full px-2 py-1 shadow-lg absolute -top-8 ${isMe ? 'right-0' : 'left-0'} z-10 animate-in fade-in zoom-in-95 duration-100`}>
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
                          className={`max-w-[80%] sm:max-w-[65%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                            isMe 
                              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 rounded-tr-sm' 
                              : 'bg-zinc-900 text-zinc-200 border border-zinc-800/80 rounded-tl-sm'
                          }`}
                        >
                          {/* Trích dẫn tin nhắn đang trả lời */}
                          {replyInfo && (
                            <div className="mb-2 p-2 rounded-lg bg-black/30 border-l-2 border-emerald-500 text-[11px] text-zinc-400">
                              <span className="font-bold text-zinc-300 block mb-0.5">
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

                          {/* Nội dung chữ */}
                          {displayContent && (
                            <div>{displayContent}</div>
                          )}

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

              {/* THANH XEM TRƯỚC MEDIA ĐÍNH KÈM (MEDIA PREVIEW BAR) */}
              {selectedMedia && (
                <div className="px-4 py-2.5 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-black border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {selectedMedia.type === 'VIDEO' ? (
                        <Video size={18} className="text-emerald-400" />
                      ) : (
                        <img src={selectedMedia.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate max-w-xs">{selectedMedia.name}</p>
                      <span className="text-[10px] text-zinc-400 uppercase font-mono">{selectedMedia.type}</span>
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

      {/* MODAL CHUYỂN TIẾP TIN NHẮN (FORWARD MODAL) */}
      {forwardingMsg && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
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

            {/* Tìm kiếm bạn bè */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text"
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
                placeholder="Tìm người nhận..."
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            {/* Danh sách người nhận */}
            <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
              {friends
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
                ))}
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
        <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto animate-bounce">
              {incomingCall.isVideo ? <Video size={24} /> : <Phone size={24} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {incomingCall.isVideo ? 'Cuộc gọi Video đến' : 'Cuộc gọi Thoại đến'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                <strong className="text-zinc-200">{incomingCall.callerName || 'Người dùng'}</strong> đang gọi cho bạn...
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIncomingCall(null)}
                className="h-9 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-rose-400 font-medium text-xs flex items-center gap-1.5 transition-colors"
              >
                <PhoneOff size={14} /> Từ chối
              </button>
              <button
                type="button"
                onClick={() => {
                  const isVid = Boolean(incomingCall.isVideo);
                  const callerId = incomingCall.callerId;
                  setIncomingCall(null);
                  navigate(`/call/direct/${callerId}?video=${isVid}&incoming=true&autoAnswer=true`);
                }}
                className="h-9 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center gap-1.5 transition-colors"
              >
                <Phone size={14} /> Nghe máy
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DirectMessagePage;
