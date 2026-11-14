import React, { Component, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, LogOut, Plus, MessageSquare, Shield, User, X, Lock, Hash, 
  CheckCircle, ArrowRight, WifiOff, Heart, MessageCircle, Share2, 
  Search, Sparkles, Send, Copy, Compass, Radio, ChevronRight, CornerDownRight,
  Bell, Bookmark, Flame, Gem, Crown, Volume2, VolumeX, Music, Play, Pause,
  Shuffle, Image as ImageIcon, CheckCircle2, Zap, Dices, Maximize2, Download,
  Edit3, Trash2, MoreVertical, Tag, Filter, Check, Disc,
  Mic, Headphones, Moon, Gamepad2, Film, Square,
  Flag, AlertTriangle, UserCheck,
  ChevronDown, Menu, Globe, Layers, SlidersHorizontal, Repeat, Sun, Smile,
  ArrowLeft, RefreshCw, Clock, Loader2, SkipBack, SkipForward, ChevronLeft
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import { saveRoomsOffline, getRoomsOffline } from '../utils/offlineDB';
import UserProfileModal from './UserProfileModal';
import FriendsModal from './FriendsModal';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import toast from 'react-hot-toast';
import TalovinLogo from '../components/TalovinLogo';
import GroupCollageAvatar from '../components/GroupCollageAvatar';
import IncomingCallModal from '../components/IncomingCallModal';
import CommunitySection, { validateInputSafe } from '../components/CommunitySection';
import ResonanceMatchModal from '../components/ResonanceMatchModal';
import ChallengeDeckModal from '../components/ChallengeDeckModal';

// ==========================================
// TALOVIN WEB AUDIO SOUND EFFECTS (Độ trễ 0ms, không tốn băng thông)
// ==========================================
const getAudioCtx = () => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!window._talovinAudioCtx) {
    window._talovinAudioCtx = new AudioCtx();
  }
  if (window._talovinAudioCtx.state === 'suspended') {
    window._talovinAudioCtx.resume().catch(() => {});
  }
  return window._talovinAudioCtx;
};

// Âm thanh khi thả Tim / Bày tỏ cảm xúc (Pop bubble nảy êm tai, âm lượng rõ nét)
export const playHeartSound = () => {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;

    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch (_) {}
};

// Âm thanh khi gửi Phản hồi / Bình luận thành công (Chime đôi thánh thót)
export const playCommentSuccessSound = () => {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    [587.33, 880.00].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      const startAt = now + idx * 0.08;
      osc.frequency.setValueAtTime(freq, startAt);

      gain.gain.setValueAtTime(0.30, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startAt);
      osc.stop(startAt + 0.25);
    });
  } catch (_) {}
};

// Avatar: Ưu tiên ảnh thật người dùng tải lên. Nếu chưa có ảnh hoặc lỗi tải, dùng DiceBear Avatar
export const UserAvatar = ({ avatar, name = '', size = 36, className = "" }) => {
  const seed = encodeURIComponent((name || 'user').trim() || 'user');
  const fallbackDicebear = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${seed}`;
  const hasCustomAvatar = Boolean(avatar && avatar.trim());
  const [imgSrc, setImgSrc] = useState(hasCustomAvatar ? avatar : fallbackDicebear);

  useEffect(() => {
    if (avatar && avatar.trim()) {
      setImgSrc(avatar);
    } else {
      setImgSrc(fallbackDicebear);
    }
  }, [avatar, fallbackDicebear]);

  return (
    <img 
      src={imgSrc} 
      alt={name || "Avatar"} 
      className={`user-avatar-img select-none ${className}`} 
      style={{ 
        width: size, 
        height: size, 
        borderRadius: '50%', 
        objectFit: 'cover',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: '#18181b',
        flexShrink: 0
      }} 
      onError={() => {
        if (imgSrc !== fallbackDicebear) {
          setImgSrc(fallbackDicebear);
        }
      }}
    />
  );
};

class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Section error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center rounded-2xl bg-zinc-900/60 border border-zinc-800 my-4 text-zinc-300">
          <p className="text-sm font-semibold mb-2">Đang làm mới dữ liệu khu vực này...</p>
          <button 
            type="button" 
            onClick={() => this.setState({ hasError: false })} 
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium border border-zinc-700"
          >
            Tải lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Danh sách các biểu tượng cảm xúc (Reactions)
const REACTION_EMOJIS = [
  { type: 'HEART', emoji: '❤️', label: 'Yêu thích' },
  { type: 'FIRE', emoji: '🔥', label: 'Cháy' },
  { type: 'HAHA', emoji: '😂', label: 'Haha' },
  { type: 'WOW', emoji: '😮', label: 'Wow' },
  { type: 'LIKE', emoji: '👍', label: 'Thích' },
  { type: 'CROWN', emoji: '👑', label: 'Đỉnh' },
];

// Ánh xạ icon thực tế và màu sắc dịu mắt cho từng chủ đề (Không dùng icon AI Sparkles hay màu chói)
const getVibeIcon = (label) => {
  const l = (label || '').toLowerCase();
  if (l.includes('thư giãn') || l.includes('chill') || l.includes('nhạc')) return { icon: Headphones, color: 'text-sky-400' };
  if (l.includes('tích cực') || l.includes('vui') || l.includes('năng lượng')) return { icon: Sun, color: 'text-amber-400' };
  if (l.includes('lắng đọng') || l.includes('đêm') || l.includes('buồn')) return { icon: Moon, color: 'text-indigo-400' };
  if (l.includes('tìm bạn') || l.includes('kết nối') || l.includes('game')) return { icon: Gamepad2, color: 'text-emerald-400' };
  if (l.includes('tâm sự') || l.includes('chia sẻ') || l.includes('nói chuyện')) return { icon: MessageSquare, color: 'text-purple-400' };
  return { icon: Tag, color: 'text-zinc-400' };
};

const VIBE_TAGS = [
  { id: 'Thư giãn', label: 'Thư giãn', icon: Headphones, color: 'text-sky-400' },
  { id: 'Tích cực', label: 'Tích cực', icon: Sun, color: 'text-amber-400' },
  { id: 'Lắng đọng', label: 'Lắng đọng', icon: Moon, color: 'text-indigo-400' },
  { id: 'Tìm bạn', label: 'Tìm bạn', icon: Gamepad2, color: 'text-emerald-400' },
  { id: 'Tâm sự', label: 'Tâm sự', icon: MessageSquare, color: 'text-purple-400' },
];

// Gợi ý mở đầu kết nối ngẫu nhiên
const ICEBREAKER_PROMPTS = [
  "Nếu chỉ được chọn một bản nhạc phát lặp lại cả tuần này, bạn sẽ nghe bài nào?",
  "Điều gì gần đây làm bạn cảm thấy nhẹ nhõm và tích cực nhất?",
  "Nếu có một cánh cửa dẫn đến bất kỳ thành phố nào đêm nay, bạn muốn đến đâu?",
  "Gu âm nhạc lúc làm việc hay học tập của bạn là gì: Lo-Fi, không lời hay Acoustic?",
  "Thói quen nhỏ nào mỗi ngày giúp bạn nạp lại năng lượng nhanh nhất?"
];

// Helper phân tích dữ liệu đa phương tiện từ trường imageUrl hoặc fallbackPost
const parsePostMedia = (raw, fallbackPost = null) => {
  const directAudio = fallbackPost?.audioUrl || fallbackPost?.voiceUrl || fallbackPost?.audio || null;
  const directDuration = fallbackPost?.audioDuration || null;

  if (!raw && !directAudio) return { mediaUrl: null, mediaType: null, audioUrl: null, audioDuration: null };

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('{\\"') && trimmed.endsWith('\\"}'))) {
      try {
        let jsonStr = trimmed;
        if (jsonStr.startsWith('{\\"')) {
          jsonStr = JSON.parse(`"${jsonStr}"`);
        }
        const parsed = JSON.parse(jsonStr);
        return {
          mediaUrl: parsed.mediaUrl || null,
          mediaType: parsed.mediaType || (parsed.mediaUrl?.includes('video') ? 'video' : 'image'),
          audioUrl: parsed.audioUrl || directAudio || null,
          audioDuration: parsed.audioDuration || directDuration || null
        };
      } catch (e) {
        // fallback
      }
    }
    const isVideo = trimmed.match(/\.(mp4|webm|mov)(\?.*)?$/i) || trimmed.startsWith('data:video/');
    const isAudio = trimmed.match(/\.(mp3|wav|ogg|m4a|aac|webm)(\?.*)?$/i) || trimmed.startsWith('data:audio/');
    if (isAudio) {
      return {
        mediaUrl: null,
        mediaType: 'audio',
        audioUrl: trimmed,
        audioDuration: directDuration || null
      };
    }
    return {
      mediaUrl: trimmed,
      mediaType: isVideo ? 'video' : 'image',
      audioUrl: directAudio || null,
      audioDuration: directDuration || null
    };
  }

  return {
    mediaUrl: null,
    mediaType: null,
    audioUrl: directAudio || null,
    audioDuration: directDuration || null
  };
};

// Helper tổ chức cây phân cấp bình luận chuẩn mực (Threaded Comments)
const buildCommentThreads = (comments) => {
  if (!Array.isArray(comments) || comments.length === 0) return [];
  
  const rootComments = [];
  const repliesMap = new Map();

  // 1. Phân loại root comments và replies
  comments.forEach(c => {
    if (!c.parentId) {
      rootComments.push({ ...c, replies: [] });
    } else {
      if (!repliesMap.has(c.parentId)) {
        repliesMap.set(c.parentId, []);
      }
      repliesMap.get(c.parentId).push(c);
    }
  });

  // 2. Map nhanh id của comment về root thread ID
  const commentIdToRootId = new Map();
  rootComments.forEach(r => {
    commentIdToRootId.set(r.id, r.id);
  });

  // Đăng ký các direct replies của root
  rootComments.forEach(root => {
    const directReplies = repliesMap.get(root.id) || [];
    directReplies.forEach(dr => {
      commentIdToRootId.set(dr.id, root.id);
    });
  });

  // 3. Ghép replies vào root thread tương ứng
  comments.forEach(c => {
    if (c.parentId) {
      const targetRootId = commentIdToRootId.get(c.parentId) || c.parentId;
      const root = rootComments.find(r => r.id === targetRootId);
      if (root) {
        if (!root.replies.some(existing => existing.id === c.id)) {
          root.replies.push(c);
        }
      } else {
        // Fallback: nếu không tìm thấy root, coi như 1 root comment mới
        rootComments.push({ ...c, replies: [] });
        commentIdToRootId.set(c.id, c.id);
      }
    }
  });

  return rootComments;
};

const Home = ({ initialTab }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUserId = localStorage.getItem('user_id');
  const currentUserName = localStorage.getItem('nickname') || localStorage.getItem('account') || localStorage.getItem('username') || 'Thành viên';
  const currentUserAccount = localStorage.getItem('account') || localStorage.getItem('username') || 'user';
  const currentUserAvatar = localStorage.getItem('user_avatar') || '';

  // Navigation tab chính: 'feed' | 'rooms' | 'trending' | 'saved' | 'groups'
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab) return initialTab;
    if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/communities') || window.location.pathname.startsWith('/groups'))) {
      return 'groups';
    }
    return 'feed';
  });

  useEffect(() => {
    if (location.pathname.startsWith('/communities') || location.pathname.startsWith('/groups')) {
      setActiveTab('groups');
    }
  }, [location.pathname]);
  const [isSpaceDrawerOpen, setIsSpaceDrawerOpen] = useState(false);
  const [isVibesExpanded, setIsVibesExpanded] = useState(false);
  const [isTabSwitching, setIsTabSwitching] = useState(false);
  const [pendingFriendsCount, setPendingFriendsCount] = useState(0);
  const [replyTargetMap, setReplyTargetMap] = useState({});
  const [isTopRefreshing, setIsTopRefreshing] = useState(false);

  // Chuyển không gian mượt mà kèm hiệu ứng tải nhẹ (Soft transition)
  const handleSwitchTab = (tabId) => {
    if (tabId === activeTab) {
      setIsSpaceDrawerOpen(false);
      return;
    }
    setIsTabSwitching(true);
    setIsSpaceDrawerOpen(false);
    setActiveFilterTag(null);
    setActiveTab(tabId);
    setTimeout(() => {
      setIsTabSwitching(false);
    }, 280);
  };

  // Khởi tạo cuộc gọi / đàm thoại riêng 1-1 từ Sảnh hoặc Cộng đồng
  const handleStartPrivateCall = async (targetUser) => {
    if (!targetUser) return;
    const targetUserId = targetUser.id || targetUser.userId;
    if (!targetUserId) return;
    if (targetUserId.toString() === currentUserId?.toString()) {
      toast.error("Bạn không thể tự gọi cho chính mình!");
      return;
    }
    const targetName = targetUser.nickname || targetUser.account || targetUser.name || 'Thành viên';
    try {
      const roomName = `1-1: ${currentUserName} & ${targetName}`;
      const response = await axiosClient.post('/rooms/create-room', {
        roomName: roomName.slice(0, 35),
        password: null
      });
      if (response.data && response.data.data) {
        const roomId = response.data.data.id;
        toast.success(`Đang mở phòng đàm thoại với ${targetName}...`);
        navigate(`/room/${roomId}?targetUserId=${targetUserId}&autoCall=true`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể khởi tạo cuộc gọi 1-1!");
    }
  };

  // State Phòng Chat
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [newRoomData, setNewRoomData] = useState({ name: '', password: '' });
  const [joinData, setJoinData] = useState({ nickname: '', password: '' });
  const [globalIncomingCall, setGlobalIncomingCall] = useState(null);

  // State Bài Viết (Tối ưu SWR Cache-First: Mở app là có ngay nội dung tức thì)
  const [posts, setPosts] = useState(() => {
    try {
      const cached = localStorage.getItem('talovin_cached_posts');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [loadingPosts, setLoadingPosts] = useState(() => {
    try {
      const cached = localStorage.getItem('talovin_cached_posts');
      return !cached || JSON.parse(cached).length === 0;
    } catch (e) {
      return true;
    }
  });
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedVibe, setSelectedVibe] = useState(null);
  const [postImageUrl, setPostImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [showMobileSearchBar, setShowMobileSearchBar] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const raw = localStorage.getItem('talovin_recent_searches') || '[]';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [hotSearches, setHotSearches] = useState([]);
  const [activeReactionPicker, setActiveReactionPicker] = useState(null);
  const reactionTimeoutRef = useRef(null);

  // Lắng nghe click bên ngoài, di chuột ra ngoài và cuộn trang để đóng ngay reactions popup
  useEffect(() => {
    if (!activeReactionPicker) return;

    const handleGlobalClick = (e) => {
      if (!e.target.closest('.reaction-drop-wrapper') && !e.target.closest('.reactions-popup-menu')) {
        setActiveReactionPicker(null);
      }
    };
    const handleGlobalPointerMove = (e) => {
      if (!e.target.closest('.reaction-drop-wrapper') && !e.target.closest('.reactions-popup-menu')) {
        if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
        reactionTimeoutRef.current = setTimeout(() => {
          setActiveReactionPicker(null);
        }, 120);
      } else {
        if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
      }
    };
    const handleGlobalScroll = () => {
      setActiveReactionPicker(null);
    };

    document.addEventListener('pointerdown', handleGlobalClick);
    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('scroll', handleGlobalScroll, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', handleGlobalClick);
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('scroll', handleGlobalScroll);
    };
  }, [activeReactionPicker]);

  // Multimedia Signals State (Ảnh/Film webp + Ghi âm giọng nói 15s)
  const [attachedMedia, setAttachedMedia] = useState(null); // { url, type, name }
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceBase64, setVoiceBase64] = useState(null);
  const [isPlayingVoicePreview, setIsPlayingVoicePreview] = useState(false);
  const [playingVoicePostId, setPlayingVoicePostId] = useState(null);
  const [showSparkInput, setShowSparkInput] = useState(false);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const previewAudioRef = useRef(null);
  const cardVoiceAudioRef = useRef(null);

  // Bình luận
  const [expandedComments, setExpandedComments] = useState({});
  const [commentsMap, setCommentsMap] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [selectedThreadPost, setSelectedThreadPost] = useState(null);

  // Khóa cuộn trang nền khi mở Modal Chi tiết bài viết trên Mobile để không bị bóp / nhảy màn hình
  useEffect(() => {
    if (selectedThreadPost) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [selectedThreadPost]);

  // Thẻ chủ đề / Dấu ấn cộng đồng riêng (Sparks)
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [activeFilterTag, setActiveFilterTag] = useState(null);

  // Menu quản trị bài viết (Chỉnh sửa / Xóa)
  const [postMenuOpenId, setPostMenuOpenId] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [editPostContent, setEditPostContent] = useState('');
  const [editPostImageUrl, setEditPostImageUrl] = useState('');
  const [editPostTags, setEditPostTags] = useState([]);
  const [isSavingEditPost, setIsSavingEditPost] = useState(false);

  // Bookmark / Lưu bài viết
  const [savedPostIds, setSavedPostIds] = useState(() => {
    try {
      const saved = localStorage.getItem('saved_post_ids');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  // Radio Lo-Fi
  // Âm nhạc hệ thống (Dynamic từ API, không mock data)
  const [isPlayingRadio, setIsPlayingRadio] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [showMobileMusicSheet, setShowMobileMusicSheet] = useState(false);
  const audioRef = useRef(null);
  const newPostInputRef = useRef(null);

  // Speed Vibe Match
  const [isSpeedMatchOpen, setIsSpeedMatchOpen] = useState(false);
  const [matchingStatus, setMatchingStatus] = useState('idle');
  const [matchedPartner, setMatchedPartner] = useState(null);

  // Modal Thẻ Bài Thử Thách & Tương Tác
  const [isPartyWheelOpen, setIsPartyWheelOpen] = useState(false);

  // Modals & Menu
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [sharePost, setSharePost] = useState(null);
  const [lightboxMedia, setLightboxMedia] = useState(null); // { url, type, author, title }

  // Báo cáo vi phạm bài viết (Report Post - Động từ CSDL)
  const [reportingPostId, setReportingPostId] = useState(null);
  const [reportReasons, setReportReasons] = useState([
    { id: 'HARASSMENT', label: 'Quấy rối / Đả kích cá nhân' },
    { id: 'SPAM', label: 'Spam / Quảng cáo / Tin rác' },
    { id: 'HATE_SPEECH', label: 'Ngôn từ thù địch / Phản cảm' },
    { id: 'NSFW', label: 'Nội dung 18+ / Bạo lực' },
    { id: 'MISINFORMATION', label: 'Thông tin sai lệch / Lừa đảo' },
    { id: 'COPYRIGHT', label: 'Vi phạm bản quyền sở hữu' }
  ]);
  const [selectedReportReason, setSelectedReportReason] = useState('HARASSMENT');
  const [customReportDetails, setCustomReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Thanh thông báo nổi thời gian thực (Floating Notification Banner)
  const [floatingNotif, setFloatingNotif] = useState(null);

  // Lắng nghe phím Esc để đóng Lightbox xem đa phương tiện
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && lightboxMedia) {
        setLightboxMedia(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxMedia]);

  const [systemConfig, setSystemConfig] = useState({
    brand_name: 'Talovin',
    brand_slogan: 'Social Lounge'
  });
  const [dynamicVibes, setDynamicVibes] = useState(VIBE_TAGS);
  const [dynamicMenu, setDynamicMenu] = useState({});
  const [isAdminUser, setIsAdminUser] = useState(() => {
    try {
      const token = localStorage.getItem('accesstoken');
      if (!token) return false;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const scope = ((payload.scope || '') + ' ' + (payload.roles || '')).toUpperCase();
      return scope.includes('ADMIN') || scope.includes('AMDIN') || scope.includes('TL_') || scope.includes('PERM_');
    } catch {
      return false;
    }
  });

  // Đồng bộ kiểm tra quyền Admin thời gian thực từ API Profile
  useEffect(() => {
    const verifyAdmin = async () => {
      try {
        const res = await axiosClient.get('/users/profile');
        const u = res?.data?.data;
        if (u) {
          const uRoles = Array.isArray(u.roles) ? u.roles : [];
          const isAdmin = u.vipTier === 'ADMIN' || u.isVerified || uRoles.some(r => {
            const up = String(r).toUpperCase();
            return up.includes('ADMIN') || up.includes('AMDIN') || up.startsWith('TL_') || up.startsWith('PERM_');
          });
          setIsAdminUser(isAdmin);
        }
      } catch (_) {}
    };
    verifyAdmin();
  }, []);

  // Đồng bộ cấu hình động từ Admin Dashboard
  useEffect(() => {
    const fetchSystemConfig = async () => {
      try {
        const res = await axiosClient.get('/system/config');
        if (res.data && res.data.data) {
          const cfg = res.data.data;
          setSystemConfig(cfg);
          if (cfg.vibe_options) {
            try {
              const parsed = JSON.parse(cfg.vibe_options);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const mapped = parsed.map(v => {
                  const meta = getVibeIcon(v);
                  return { id: v, label: v, icon: meta.icon, color: meta.color };
                });
                setDynamicVibes(mapped);
              }
            } catch {}
          }
          if (cfg.menu_items) {
            try {
              const parsed = JSON.parse(cfg.menu_items);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const menuMap = {};
                parsed.forEach(m => { menuMap[m.id] = m; });
                setDynamicMenu(menuMap);
              }
            } catch {}
          }
          if (cfg.report_reasons) {
            try {
              const parsed = JSON.parse(cfg.report_reasons);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setReportReasons(parsed);
              }
            } catch {}
          }
        }
      } catch (err) {
        // Fallback to defaults
      }
    };
    fetchSystemConfig();
  }, []);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const recentNotifKeysRef = useRef(new Map());
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem('talovin_notifs_cache') || (currentUserId ? localStorage.getItem(`talovin_notifs_${currentUserId}`) : null);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Đồng bộ nạp thông báo khi currentUserId sẵn sàng
  useEffect(() => {
    if (currentUserId) {
      try {
        const stored = localStorage.getItem(`talovin_notifs_${currentUserId}`) || localStorage.getItem('talovin_notifs_cache');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setNotifications(prev => prev.length === 0 ? parsed : prev);
          }
        }
      } catch {}
    }
  }, [currentUserId]);

  // Lưu trữ lịch sử thông báo (tránh ghi đè mảng rỗng khi vừa mount)
  useEffect(() => {
    if (notifications.length > 0) {
      try {
        const serialized = JSON.stringify(notifications.slice(0, 50));
        localStorage.setItem('talovin_notifs_cache', serialized);
        if (currentUserId) {
          localStorage.setItem(`talovin_notifs_${currentUserId}`, serialized);
        }
      } catch {}
    }
  }, [notifications, currentUserId]);

  // Tự động ẩn thanh thông báo nổi sau 5.5 giây
  useEffect(() => {
    if (floatingNotif) {
      const timer = setTimeout(() => {
        setFloatingNotif(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [floatingNotif]);

  // Xử lý báo cáo bài viết vi phạm
  const handleOpenReportModal = (postId) => {
    setPostMenuOpenId(null);
    setReportingPostId(postId);
    setSelectedReportReason(reportReasons[0]?.id || 'HARASSMENT');
    setCustomReportDetails('');
  };

  const handleSubmitReport = async (e) => {
    if (e) e.preventDefault();
    if (!reportingPostId) return;
    setIsSubmittingReport(true);
    try {
      await axiosClient.post(`/posts/${reportingPostId}/report`, {
        reason: selectedReportReason,
        details: customReportDetails
      });
      toast.success("Báo cáo đã được gửi. Ban quản trị sẽ sớm xem xét xử lý!");
      setReportingPostId(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi báo cáo lúc này");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Hộp thoại xác nhận tùy biến (thay thế hoàn toàn window.confirm & window.alert)
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Xác nhận',
    isDanger: true,
    onConfirm: null
  });

  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false, onConfirm: null }));
  };

  // Kiểm tra tài khoản hiện tại có thực sự là thành viên trong phòng đàm thoại
  const isUserInRoom = (room) => {
    if (!room) return false;
    const account = localStorage.getItem('account');
    const uid = currentUserId?.toString() || localStorage.getItem('user_id')?.toString();
    if (room.userRoomDTOList && room.userRoomDTOList.some(ur => {
      const u = ur.userDTO || ur;
      return u && (
        (account && u.account === account) || 
        (uid && u.id?.toString() === uid)
      );
    })) {
      return true;
    }
    return false;
  };

  const checkActiveRoom = async () => {
    if (sessionStorage.getItem('hasCheckedActiveRoom')) return false;
    try {
      const res = await axiosClient.get('/rooms/my-active-room');
      if (res.data?.data) {
        const room = res.data.data;
        toast((t) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Bạn đang trong phòng: <strong>#{room.nameroom}</strong></span>
            <button 
              onClick={() => { toast.dismiss(t.id); navigate(`/room/${room.id}`); }}
              style={{ background: '#f4f4f5', color: '#18181b', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
            >
              Quay lại
            </button>
          </div>
        ), { duration: 6000 });
        sessionStorage.setItem('hasCheckedActiveRoom', 'true');
        return true;
      }
    } catch (e) {
      console.warn("Lỗi kiểm tra phòng:", e);
    }
    sessionStorage.setItem('hasCheckedActiveRoom', 'true');
    return false;
  };

  const fetchRooms = async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingRooms(true);
      const response = await axiosClient.get('/rooms/info-rooms'); 
      if (response.data && response.data.data) {
        setRooms(response.data.data);
        saveRoomsOffline(response.data.data);
      }
    } catch (err) {
      console.error("Lỗi khi lấy danh sách phòng:", err);
      const cached = await getRoomsOffline();
      if (cached && cached.length > 0) setRooms(cached);
    } finally {
      if (!isSilent) setLoadingRooms(false);
    }
  };

  // ====================== BẢNG TIN / POSTS ======================
  const fetchPosts = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent && posts.length === 0) setLoadingPosts(true);
      const response = await axiosClient.get('/posts', {
        params: { page: 0, size: 25 }
      });
      if (response.data && response.data.data) {
        setPosts(response.data.data);
        try {
          localStorage.setItem('talovin_cached_posts', JSON.stringify(response.data.data.slice(0, 20)));
        } catch (e) {}
      }
    } catch (err) {
      console.error("Lỗi khi nạp bài viết:", err);
    } finally {
      setLoadingPosts(false);
    }
  }, [posts.length]);

  // Xử lý nén file ảnh bằng Canvas sang WebP nhẹ, hoặc video ngắn
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX = 1200;
          if (width > height && width > MAX) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else if (height > MAX) {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const webpData = canvas.toDataURL('image/webp', 0.82);
          setAttachedMedia({
            url: webpData,
            type: 'image',
            name: file.name
          });
          toast.success("Đã tối ưu & đính kèm hình ảnh!");
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error("Video ngắn tối đa 15MB!");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedMedia({
          url: event.target.result,
          type: 'video',
          name: file.name
        });
        toast.success("Đã đính kèm video ngắn!");
      };
      reader.readAsDataURL(file);
    }
  };

  // Thu âm giọng nói 15s (MediaRecorder API)
  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Trình duyệt không hỗ trợ ghi âm trực tiếp!");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = {};
        }
      }
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setVoiceBlob(blob);
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          setVoiceBase64(reader.result);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecordingVoice(true);
      setVoiceDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setVoiceDuration(prev => {
          if (prev >= 14) {
            stopVoiceRecording();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      toast.error("Vui lòng cấp quyền Microphone để ghi âm!");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecordingVoice(false);
  };

  const clearVoiceRecording = () => {
    stopVoiceRecording();
    setVoiceBlob(null);
    setVoiceBase64(null);
    setVoiceDuration(0);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPlayingVoicePreview(false);
  };

  const togglePlayVoicePreview = () => {
    if (!previewAudioRef.current && voiceBase64) {
      previewAudioRef.current = new Audio(voiceBase64);
      previewAudioRef.current.onended = () => setIsPlayingVoicePreview(false);
    }
    if (!previewAudioRef.current) return;

    if (isPlayingVoicePreview) {
      previewAudioRef.current.pause();
      setIsPlayingVoicePreview(false);
    } else {
      previewAudioRef.current.play().then(() => {
        setIsPlayingVoicePreview(true);
      }).catch(err => console.warn("Lỗi phát preview:", err));
    }
  };

  // Phát Voice Note trên thẻ bài viết hoặc modal chi tiết
  const handleTogglePlayPostVoice = (postId, audioSrc) => {
    if (!cardVoiceAudioRef.current) return;
    if (playingVoicePostId === postId) {
      cardVoiceAudioRef.current.pause();
      setPlayingVoicePostId(null);
    } else {
      // Tạm dừng nhạc nền hệ thống nếu đang phát để nghe rõ giọng nói
      if (audioRef.current && isPlayingRadio) {
        audioRef.current.pause();
        setIsPlayingRadio(false);
      }
      cardVoiceAudioRef.current.src = audioSrc;
      cardVoiceAudioRef.current.play().then(() => {
        setPlayingVoicePostId(postId);
      }).catch(err => {
        console.warn("Lỗi phát voice note:", err);
        setPlayingVoicePostId(null);
      });
    }
  };

  // Đăng tín hiệu / khoảnh khắc
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim() && !attachedMedia && !voiceBase64) {
      toast.error("Vui lòng nhập nội dung, đính kèm ảnh hoặc ghi âm giọng nói!");
      return;
    }

    try {
      setIsPosting(true);
      // Ghép nối các thẻ cộng đồng đã chọn vào vibe hoặc content
      let combinedVibe = selectedVibe || '';
      if (selectedTags.length > 0) {
        const tagsString = selectedTags.join(' ');
        combinedVibe = combinedVibe ? `${combinedVibe} | ${tagsString}` : tagsString;
      }

      // Đóng gói dữ liệu đa phương tiện vào trường imageUrl một cách an toàn
      let payloadMedia = null;
      if (attachedMedia?.url || voiceBase64) {
        payloadMedia = JSON.stringify({
          mediaUrl: attachedMedia?.url || null,
          mediaType: attachedMedia?.type || 'image',
          audioUrl: voiceBase64 || null,
          audioDuration: voiceDuration || null
        });
      } else if (postImageUrl.trim()) {
        payloadMedia = postImageUrl.trim();
      }

      const res = await axiosClient.post('/posts', {
        content: newPostContent.trim() || (voiceBase64 ? "Ghi âm giọng nói" : attachedMedia?.type === 'video' ? "Video ngắn" : "Khoảnh khắc hình ảnh"),
        imageUrl: payloadMedia,
        vibe: combinedVibe || null
      });

      if (res.data && res.data.data) {
        setPosts(prev => [res.data.data, ...prev]);
        setNewPostContent('');
        setSelectedVibe(null);
        setPostImageUrl('');
        setShowImageInput(false);
        setAttachedMedia(null);
        clearVoiceRecording();
        setSelectedTags([]);
        setShowSparkInput(false);
        toast.success("Đã đăng bài viết thành công!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Không thể đăng bài viết lúc này!");
    } finally {
      setIsPosting(false);
    }
  };

  const handleAddCustomTag = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();
      const clean = customTagInput.trim().replace(/^[#/]+/, '').toLowerCase();
      if (clean && !selectedTags.includes(clean)) {
        setSelectedTags(prev => [...prev, clean]);
        setCustomTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleTogglePopularTag = (tag) => {
    if (selectedTags.includes(tag)) {
      handleRemoveTag(tag);
    } else {
      setSelectedTags(prev => [...prev, tag]);
    }
  };

  // Quản trị bài viết (Xóa / Chỉnh sửa)
  const handleDeletePost = (postId) => {
    setPostMenuOpenId(null);
    setConfirmDialog({
      isOpen: true,
      title: "Xóa bài viết",
      message: "Bạn có chắc chắn muốn xóa bài viết này không? Bài viết và các bình luận liên quan sẽ được gỡ bỏ vĩnh viễn.",
      confirmText: "Xóa bài viết",
      isDanger: true,
      onConfirm: async () => {
        try {
          await axiosClient.delete(`/posts/${postId}`);
          setPosts(prev => prev.filter(p => p.id !== postId));
          toast.success("Đã xóa bài viết thành công");
        } catch (err) {
          toast.error(err.response?.data?.message || "Không thể xóa bài viết");
        } finally {
          closeConfirmDialog();
        }
      }
    });
  };

  const handleOpenEditPost = (post) => {
    setEditingPost(post);
    setEditPostContent(post.content || '');
    setEditPostImageUrl(post.imageUrl || '');
    
    // Tách các thẻ tag nếu có
    const tags = [];
    if (post.vibe) {
      const parts = post.vibe.split(' ');
      parts.forEach(p => {
        if (p.startsWith('#')) tags.push(p);
      });
    }
    setEditPostTags(tags);
    setPostMenuOpenId(null);
  };

  const handleSaveEditPost = async (e) => {
    e.preventDefault();
    if (!editPostContent.trim()) {
      toast.error("Nội dung bài viết không được để trống!");
      return;
    }
    try {
      setIsSavingEditPost(true);
      let combinedVibe = editingPost.vibe || '';
      if (editPostTags.length > 0) {
        combinedVibe = editPostTags.join(' ');
      }

      const res = await axiosClient.put(`/posts/${editingPost.id}`, {
        content: editPostContent.trim(),
        imageUrl: editPostImageUrl.trim() || null,
        vibe: combinedVibe || null
      });

      if (res.data && res.data.data) {
        setPosts(prev => prev.map(p => p.id === editingPost.id ? res.data.data : p));
        setEditingPost(null);
        toast.success("Cập nhật bài viết thành công!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi cập nhật bài viết!");
    } finally {
      setIsSavingEditPost(false);
    }
  };

  // Thả cảm xúc
  const handleReactPost = async (postId, reactionType) => {
    if (!postId) return;
    playHeartSound();
    setActiveReactionPicker(null);
    const targetType = reactionType || 'HEART';

    // 1. Cập nhật Optimistic cho danh sách bài viết ngoài feed (hỗ trợ String và Number id)
    setPosts(prev => prev.map(p => {
      if (String(p.id) !== String(postId)) return p;
      const wasLiked = p.isLikedByMe;
      const sameType = p.myReaction === targetType;

      if (wasLiked && sameType) {
        return {
          ...p,
          isLikedByMe: false,
          myReaction: null,
          likesCount: Math.max(0, (p.likesCount || 1) - 1)
        };
      } else {
        return {
          ...p,
          isLikedByMe: true,
          myReaction: targetType,
          likesCount: wasLiked ? p.likesCount : (p.likesCount || 0) + 1
        };
      }
    }));

    // 2. Đồng bộ tức thì cả selectedThreadPost (nếu đang mở trong Modal chi tiết)
    setSelectedThreadPost(prev => {
      if (!prev || String(prev.id) !== String(postId)) return prev;
      const wasLiked = prev.isLikedByMe || (prev.myReaction != null);
      const sameType = prev.myReaction === targetType;

      if (wasLiked && sameType) {
        return {
          ...prev,
          isLikedByMe: false,
          myReaction: null,
          likesCount: Math.max(0, (prev.likesCount || 1) - 1)
        };
      } else {
        return {
          ...prev,
          isLikedByMe: true,
          myReaction: targetType,
          likesCount: wasLiked ? prev.likesCount : (prev.likesCount || 0) + 1
        };
      }
    });

    try {
      const res = await axiosClient.post(`/posts/${postId}/like`, null, {
        params: { type: targetType, reactionType: targetType }
      });
      if (res.data && res.data.data) {
        const updatedPost = res.data.data;
        setPosts(prev => prev.map(p => String(p.id) === String(postId) ? updatedPost : p));
        setSelectedThreadPost(prev => (prev && String(prev.id) === String(postId)) ? updatedPost : prev);
      }
    } catch (err) {
      console.warn("Lỗi thả cảm xúc:", err);
      if (err.response?.status === 404) {
        setPosts(prev => prev.filter(p => String(p.id) !== String(postId)));
        setSelectedThreadPost(prev => (prev && String(prev.id) === String(postId)) ? null : prev);
      } else {
        fetchPosts(true);
      }
    }
  };

  // Bình luận
  const handleToggleComments = (postId) => {
    setExpandedComments(prev => {
      const next = !prev[postId];
      if (next && !commentsMap[postId]) {
        fetchComments(postId);
      }
      return { ...prev, [postId]: next };
    });
  };

  const fetchComments = async (postId) => {
    try {
      const res = await axiosClient.get(`/posts/${postId}/comments`);
      if (res.data && res.data.data) {
        setCommentsMap(prev => ({ ...prev, [postId]: res.data.data }));
      }
    } catch (err) {
      console.warn("Lỗi lấy bình luận:", err);
      if (err.response?.status === 404) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        setSelectedThreadPost(prev => prev?.id === postId ? null : prev);
      }
    }
  };

  // Thả cảm xúc / Tim cho phản hồi (Bình luận)
  const handleToggleLikeComment = async (postId, commentId) => {
    if (!postId || !commentId) return;
    playHeartSound();
    // Cập nhật Optimistic ngay lập tức để tạo phản hồi tức thì
    setCommentsMap(prev => {
      const currentList = prev[postId] || [];
      const updated = currentList.map(c => {
        if (String(c.id) === String(commentId)) {
          const wasLiked = Boolean(c.isLiked);
          const currentCount = Number(c.likesCount || 0);
          return {
            ...c,
            isLiked: !wasLiked,
            likesCount: wasLiked ? Math.max(0, currentCount - 1) : currentCount + 1
          };
        }
        return c;
      });
      return { ...prev, [postId]: updated };
    });

    try {
      // Gọi cả 2 endpoint tương thích: có postId hoặc standalone
      const res = await axiosClient.post(`/posts/${postId}/comments/${commentId}/like`).catch(() => 
        axiosClient.post(`/posts/comments/${commentId}/like`)
      );
      if (res.data?.data) {
        const updatedCmt = res.data.data;
        setCommentsMap(prev => {
          const currentList = prev[postId] || [];
          return {
            ...prev,
            [postId]: currentList.map(c => String(c.id) === String(commentId) ? {
              ...c,
              isLiked: updatedCmt.isLiked,
              likesCount: updatedCmt.likesCount
            } : c)
          };
        });
      }
    } catch (err) {
      fetchComments(postId);
    }
  };

  // Đăng lại bài viết (Repost)
  const handleToggleRepost = async (postId) => {
    // Optimistic UI Update cho feed
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const wasReposted = Boolean(p.isRepostedByMe);
        const currentCount = Number(p.repostsCount || 0);
        return {
          ...p,
          isRepostedByMe: !wasReposted,
          repostsCount: wasReposted ? Math.max(0, currentCount - 1) : currentCount + 1
        };
      }
      return p;
    }));

    // Optimistic UI Update cho selectedThreadPost (nếu đang mở Modal chi tiết)
    setSelectedThreadPost(prev => {
      if (!prev || prev.id !== postId) return prev;
      const wasReposted = Boolean(prev.isRepostedByMe);
      const currentCount = Number(prev.repostsCount || 0);
      return {
        ...prev,
        isRepostedByMe: !wasReposted,
        repostsCount: wasReposted ? Math.max(0, currentCount - 1) : currentCount + 1
      };
    });

    try {
      const res = await axiosClient.post(`/posts/${postId}/repost`);
      if (res.data?.data) {
        const updated = res.data.data;
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          repostsCount: updated.repostsCount,
          isRepostedByMe: updated.isRepostedByMe
        } : p));
        setSelectedThreadPost(prev => prev && prev.id === postId ? {
          ...prev,
          repostsCount: updated.repostsCount,
          isRepostedByMe: updated.isRepostedByMe
        } : prev);
      }
      toast.success(res.data?.message || "Đã cập nhật đăng lại bài viết!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể đăng lại bài viết!", { id: 'repost-err' });
      fetchPosts(true);
    }
  };

  const fetchPendingFriendsCount = async () => {
    if (!currentUserId) return;
    try {
      const res = await axiosClient.get('/friends/pending');
      if (res.data?.data) {
        setPendingFriendsCount(Array.isArray(res.data.data) ? res.data.data.length : 0);
      }
    } catch {}
  };

  const fetchFriends = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await axiosClient.get('/friends/list');
      if (res.data?.data && Array.isArray(res.data.data)) {
        setFriends(res.data.data);
      }
    } catch (e) {
      console.warn("Lỗi tải danh sách bạn bè:", e);
    }
  }, [currentUserId]);

  // Làm mới ứng dụng khi ấn vào Logo (Cuộn lên đầu trang & chạy loading từ top center xuống)
  const handleLogoRefresh = async () => {
    setActiveTab('feed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsTopRefreshing(true);
    try {
      await Promise.allSettled([
        fetchPosts(true),
        fetchRooms(true),
        fetchFriends()
      ]);
    } catch (e) {
      console.warn("Lỗi làm mới ứng dụng:", e);
    } finally {
      setTimeout(() => {
        setIsTopRefreshing(false);
      }, 700);
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const replyTarget = replyTargetMap[postId];
    const payload = {
      content: text,
      parentId: replyTarget?.commentId || null,
      replyToUser: replyTarget?.authorAccount || null
    };

    try {
      setSubmittingComment(prev => ({ ...prev, [postId]: true }));
      const res = await axiosClient.post(`/posts/${postId}/comments`, payload);
      if (res.data && res.data.data) {
        setCommentsMap(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), res.data.data]
        }));
        playCommentSuccessSound();
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        setReplyTargetMap(prev => ({ ...prev, [postId]: null }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        setSelectedThreadPost(prev => prev?.id === postId ? null : prev);
      }
      toast.error(err.response?.data?.message || "Lỗi gửi phản hồi!", { id: 'comment-err' });
    } finally {
      setSubmittingComment(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteComment = (postId, commentId) => {
    setConfirmDialog({
      isOpen: true,
      title: "Xóa bình luận",
      message: "Bạn có chắc chắn muốn gỡ bình luận này không?",
      confirmText: "Gỡ bình luận",
      isDanger: true,
      onConfirm: async () => {
        try {
          await axiosClient.delete(`/posts/${postId}/comments/${commentId}`);
          setCommentsMap(prev => ({
            ...prev,
            [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
          }));
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 1) - 1) } : p));
          toast.success("Đã gỡ bình luận");
        } catch (err) {
          toast.error(err.response?.data?.message || "Không thể xóa bình luận");
        } finally {
          closeConfirmDialog();
        }
      }
    });
  };

  const handleStartEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content || '');
  };

  const handleSaveEditComment = async (postId, commentId) => {
    if (!editingCommentText.trim()) return;
    try {
      setIsSavingComment(true);
      let res;
      try {
        res = await axiosClient.put(`/posts/${postId}/comments/${commentId}`, {
          content: editingCommentText.trim()
        });
      } catch (putErr) {
        // Fallback to POST update
        res = await axiosClient.post(`/posts/${postId}/comments/${commentId}/update`, {
          content: editingCommentText.trim()
        });
      }
      if (res.data && res.data.data) {
        setCommentsMap(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).map(c => c.id === commentId ? res.data.data : c)
        }));
        setEditingCommentId(null);
        toast.success("Đã cập nhật bình luận");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi cập nhật bình luận!");
    } finally {
      setIsSavingComment(false);
    }
  };

  // Lưu bài viết
  const handleToggleSavePost = (postId) => {
    setSavedPostIds(prev => {
      let updated;
      if (prev.includes(postId)) {
        updated = prev.filter(id => id !== postId);
        toast("Đã bỏ lưu bài viết");
      } else {
        updated = [...prev, postId];
        toast.success("Đã lưu bài viết vào mục cá nhân!");
      }
      localStorage.setItem('saved_post_ids', JSON.stringify(updated));
      return updated;
    });
  };

  // Tải danh sách các từ khóa tìm kiếm hot từ cache backend
  const fetchHotSearches = async () => {
    try {
      const res = await axiosClient.get('/posts/hot-searches');
      if (res.data?.data) {
        setHotSearches(res.data.data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchHotSearches();
  }, []);

  // Thực thi tìm kiếm thông minh (Elastic-style) - CHỈ KÍCH HOẠT KHI ENTER / BẤM ICON / MOBILE GO
  const executeSearch = async (rawKw) => {
    const kw = (rawKw || '').trim();
    setIsSearchDropdownOpen(false);
    setShowMobileSearchBar(false);

    if (!kw) {
      setActiveSearchQuery('');
      setSearchResults(null);
      return;
    }

    setActiveSearchQuery(kw);
    setSearchInput(kw);
    setIsSearching(true);

    // Lưu từ khóa vào lịch sử tìm kiếm gần đây trong LocalStorage
    try {
      const raw = localStorage.getItem('talovin_recent_searches') || '[]';
      const parsed = JSON.parse(raw);
      const current = Array.isArray(parsed) ? parsed : [];
      const updated = [kw, ...current.filter(item => typeof item === 'string' && item.toLowerCase() !== kw.toLowerCase())].slice(0, 8);
      localStorage.setItem('talovin_recent_searches', JSON.stringify(updated));
      setRecentSearches(updated);
    } catch {}

    try {
      const res = await axiosClient.get('/posts/search', { params: { keyword: kw } });
      setSearchResults(res.data?.data || []);
      // Tải lại danh sách hot searches để cập nhật thứ hạng từ khóa
      fetchHotSearches();
    } catch (err) {
      toast.error("Không thể kết nối tìm kiếm lúc này");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setActiveSearchQuery('');
    setSearchResults(null);
    setIsSearchDropdownOpen(false);
  };

  const handleRemoveRecentSearch = (termToRemove) => {
    try {
      const raw = localStorage.getItem('talovin_recent_searches') || '[]';
      const parsed = JSON.parse(raw);
      const current = Array.isArray(parsed) ? parsed : [];
      const updated = current.filter(t => typeof t === 'string' && t.toLowerCase() !== termToRemove.toLowerCase());
      localStorage.setItem('talovin_recent_searches', JSON.stringify(updated));
      setRecentSearches(updated);
    } catch {}
  };

  const handleClearAllRecentSearches = () => {
    localStorage.removeItem('talovin_recent_searches');
    setRecentSearches([]);
  };

  // Lo-Fi Radio
  const togglePlayRadio = () => {
    if (!audioRef.current) return;
    if (!tracks || tracks.length === 0) {
      toast("Chưa có bản nhạc nào trong hệ thống");
      return;
    }
    const track = tracks[currentTrackIndex];
    const trackSrc = track?.audioUrl || track?.audioSrc || track?.streamUrl || '';
    if (!audioRef.current.src && trackSrc) {
      audioRef.current.src = trackSrc;
    }
    if (isPlayingRadio) {
      audioRef.current.pause();
      setIsPlayingRadio(false);
    } else {
      if (audioRef.current.src !== trackSrc) {
        audioRef.current.src = trackSrc;
      }
      audioRef.current.play().then(() => {
        setIsPlayingRadio(true);
        toast.success(`Đang phát: ${track?.title || track?.name || 'Âm nhạc hệ thống'}`);
      }).catch(err => {
        console.warn("Lỗi phát audio:", err);
      });
    }
  };

  const playNextRadio = () => {
    if (!tracks || tracks.length === 0) return;
    const nextIdx = (currentTrackIndex + 1) % tracks.length;
    setCurrentTrackIndex(nextIdx);
    if (audioRef.current) {
      const nextTrack = tracks[nextIdx];
      const nextSrc = nextTrack?.audioUrl || nextTrack?.audioSrc || nextTrack?.streamUrl || '';
      audioRef.current.src = nextSrc;
      if (isPlayingRadio) {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const playPrevRadio = () => {
    if (!tracks || tracks.length === 0) return;
    const prevIdx = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    setCurrentTrackIndex(prevIdx);
    if (audioRef.current) {
      const prevTrack = tracks[prevIdx];
      const prevSrc = prevTrack?.audioUrl || prevTrack?.audioSrc || prevTrack?.streamUrl || '';
      audioRef.current.src = prevSrc;
      if (isPlayingRadio) {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const handleSelectRadioTrack = (index) => {
    if (!tracks || !tracks[index]) return;
    setCurrentTrackIndex(index);
    if (audioRef.current) {
      const selectedTrack = tracks[index];
      const src = selectedTrack?.audioUrl || selectedTrack?.audioSrc || selectedTrack?.streamUrl || '';
      audioRef.current.src = src;
      audioRef.current.play().then(() => {
        setIsPlayingRadio(true);
        toast.success(`Đang phát: ${selectedTrack?.title || selectedTrack?.name || 'Bản nhạc'}`);
      }).catch(err => console.warn("Lỗi phát audio:", err));
    }
  };

  // Bộ ghép đôi đồng điệu 1-1 (Resonance Matchmaker)
  const handleStartSpeedMatch = () => {
    setIsSpeedMatchOpen(true);
  };

  const handleCopyPostLink = (post) => {
    const url = `${window.location.origin}/#post-${post.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Đã sao chép liên kết!");
    setSharePost(null);
  };

  const handleSharePostToRoom = async (post, room) => {
    try {
      // Đảm bảo đã tham gia phòng trước khi gửi tin nhắn bài viết chia sẻ
      if (!isUserInRoom(room) && !room.hasPassword) {
        await axiosClient.post('/rooms/join-room', { roomId: room.id, password: null }, { params: { room_id: room.id, idRoom: room.id } });
      }

      const payload = JSON.stringify({
        type: 'shared_post',
        postId: post.id,
        author: post.authorNickname || post.authorAccount || 'Thành viên',
        authorAvatar: post.authorAvatar || null,
        content: post.content,
        imageUrl: post.imageUrl || null
      });

      await axiosClient.post('/message/send', {
        message: payload,
        timeSend: new Date().toISOString()
      }, {
        params: { user_room: room.id }
      });

      toast.success(`Đã chia sẻ bài viết vào phòng #${room.nameroom || room.id}!`);
      setSharePost(null);
    } catch (err) {
      if (room.hasPassword && !isUserInRoom(room)) {
        toast.error("Phòng có mật khẩu. Bạn cần tham gia phòng trước khi chia sẻ!");
      } else {
        toast.error(err.response?.data?.message || "Không thể chia sẻ bài viết vào phòng lúc này!");
      }
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchRooms(true);
      fetchPosts(true);
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast("Đang ngoại tuyến. Dữ liệu đọc từ bộ nhớ máy.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Keep-alive ping định kỳ 8 phút để giữ máy chủ Render luôn thức khi người dùng đang mở web
    const keepAliveInterval = setInterval(() => {
      axiosClient.get('/tracks').catch(() => {});
    }, 8 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(keepAliveInterval);
    };
  }, [fetchPosts]);

  const fetchTracks = useCallback(async () => {
    try {
      // 1. Ưu tiên nạp bản nhạc từ API công khai /api/public/lobby-config
      const lobbyRes = await axiosClient.get('/public/lobby-config').catch(() => null);
      const serverTracks = lobbyRes?.data?.data?.tracks;
      if (serverTracks && Array.isArray(serverTracks) && serverTracks.length > 0) {
        setTracks(serverTracks.map(t => ({
          id: t.id,
          name: t.title,
          title: t.title,
          artist: t.artist || 'Talovin Lo-Fi Station',
          genre: t.genreTag || 'Lofi / Relax',
          genreTag: t.genreTag,
          audioSrc: t.audioUrl,
          audioUrl: t.audioUrl,
          streamUrl: t.audioUrl,
          coverUrl: t.coverUrl
        })));
        return;
      }

      // 2. Fallback nạp từ /match/config
      const configRes = await axiosClient.get('/match/config').catch(() => null);
      if (configRes?.data?.channels && Array.isArray(configRes.data.channels) && configRes.data.channels.length > 0) {
        const mappedChannels = configRes.data.channels.map(c => ({
          id: c.id,
          name: c.name,
          title: c.name,
          artist: 'Talovin Radio',
          genre: c.genreTag,
          genreTag: c.genreTag,
          audioSrc: c.streamUrl,
          audioUrl: c.streamUrl,
          streamUrl: c.streamUrl
        }));
        setTracks(mappedChannels);
        return;
      }

      // 3. Fallback /tracks
      const res = await axiosClient.get('/tracks');
      if (res.data?.data && Array.isArray(res.data.data)) {
        setTracks(res.data.data);
      }
    } catch (e) {
      console.warn("Lỗi tải bản nhạc:", e);
    }
  }, []);

  // Khởi tạo & Websocket
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const cached = await getRoomsOffline();
      if (cached && cached.length > 0 && isMounted) {
        setRooms(cached);
        setLoadingRooms(false);
      }
      fetchRooms();
      fetchPosts();
      fetchTracks();
      checkActiveRoom();
      fetchFriends();
      fetchPendingFriendsCount();
    };

    init();

    let stompClient = null;
    try {
      const socketUrl = BACKEND_URL ? `${BACKEND_URL}/ws-gs-guide` : '/ws-gs-guide';
      const socket = new SockJS(socketUrl);
      stompClient = Stomp.over(socket);
      stompClient.debug = () => {};
      stompClient.connect({}, () => {
        if (!isMounted) return;
        stompClient.subscribe('/topic/rooms', () => fetchRooms(true));
        stompClient.subscribe('/topic/posts', () => fetchPosts(true));

        if (currentUserId) {
          // Kênh thông báo cá nhân hóa thời gian thực (Cảm xúc, Bình luận, Tố cáo & Gỡ bài)
          stompClient.subscribe(`/topic/user/${currentUserId}/notifications`, (message) => {
            try {
              const notif = JSON.parse(message.body);
              const textContent = notif.text || notif.message || notif.title || 'Thông báo mới từ hệ thống';
              const dedupKey = `${notif.type || 'SYS'}_${textContent}_${notif.postId || ''}`;
              const now = Date.now();

              // Chống spam & lọc trùng lặp thông báo trong 10 giây
              if (recentNotifKeysRef.current.has(dedupKey)) {
                const prevTime = recentNotifKeysRef.current.get(dedupKey);
                if (now - prevTime < 10000) {
                  return; // Đã nhận thông báo tương tự cách đây ít giây, bỏ qua để tránh duplicate
                }
              }
              recentNotifKeysRef.current.set(dedupKey, now);

              // Dọn dẹp key cũ quá 30 giây để tránh phình bộ nhớ
              for (const [k, t] of recentNotifKeysRef.current.entries()) {
                if (now - t > 30000) recentNotifKeysRef.current.delete(k);
              }

              const normalizedNotif = {
                id: notif.id || Date.now(),
                text: textContent,
                title: notif.title || (notif.type === 'POST_TAKEDOWN' ? 'Kiểm duyệt nội dung' : 'Thông báo hệ thống'),
                type: notif.type || 'SYSTEM',
                time: notif.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                unread: true,
                postId: notif.postId,
                reason: notif.reason,
                adminNote: notif.adminNote || notif.note
              };
              setNotifications(prev => [normalizedNotif, ...prev.filter(n => n.id !== normalizedNotif.id)]);
              setFloatingNotif(normalizedNotif);

              if (notif.type === 'POST_TAKEDOWN') {
                fetchPosts(true);
              }
            } catch (e) {
              console.warn("Parse notif error:", e);
            }
          });

          // Kênh thông báo raw event người dùng (chỉ cập nhật danh sách bạn bè, tránh spam duplicate thông báo)
          stompClient.subscribe(`/topic/user/${currentUserId}`, (message) => {
            if (message.body === 'FRIEND_REQUEST_RECEIVED' || message.body === 'FRIEND_REQUEST_ACCEPTED') {
              fetchFriends();
              fetchPendingFriendsCount();
              // Lưu ý: Backend đã gửi notification có cấu trúc chi tiết vào /topic/user/${id}/notifications.
              // Chỉ tạo thêm notification dự phòng nếu chưa từng nhận notification này trong 10 giây qua.
              const dedupKey = `FRIEND_${message.body}`;
              const now = Date.now();
              if (!recentNotifKeysRef.current.has(dedupKey) || (now - recentNotifKeysRef.current.get(dedupKey) >= 10000)) {
                recentNotifKeysRef.current.set(dedupKey, now);
                const notifItem = {
                  id: Date.now(),
                  title: 'Kết nối bạn bè',
                  text: message.body === 'FRIEND_REQUEST_RECEIVED' 
                    ? 'Bạn có một lời mời kết bạn mới!' 
                    : 'Lời mời kết bạn của bạn đã được chấp nhận!',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  unread: true,
                  type: 'FRIEND'
                };
                setNotifications(prev => [notifItem, ...prev]);
                setFloatingNotif(notifItem);
              }
            }
          });

          // Lắng nghe cuộc gọi trực tiếp gửi đến người dùng
          stompClient.subscribe(`/topic/call/user/${currentUserId}`, (message) => {
            try {
              const call = JSON.parse(message.body);
              if (call && call.callerId?.toString() !== currentUserId?.toString()) {
                setGlobalIncomingCall(call);
              }
            } catch (e) {}
          });

          // Lắng nghe cuộc gọi nhóm trong hệ thống
          stompClient.subscribe('/topic/calls', (message) => {
            try {
              const call = JSON.parse(message.body);
              if (call && call.callerId?.toString() !== currentUserId?.toString()) {
                setGlobalIncomingCall(call);
              }
            } catch (e) {}
          });
        }
      }, (err) => {
        console.warn("WebSocket notice:", err);
      });
    } catch (wsErr) {
      console.warn("WebSocket init error:", wsErr);
    }

    return () => {
      isMounted = false;
      if (stompClient && stompClient.connected) {
        stompClient.disconnect();
      }
    };
  }, [fetchPosts]);

  // Đăng xuất
  const handleLogout = () => {
    localStorage.clear();
    toast.success("Đã đăng xuất!");
    navigate('/login');
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    const nameErr = validateInputSafe(newRoomData.name, "Tên phòng", 3, 60);
    if (nameErr) {
      toast.error(nameErr);
      return;
    }
    if (newRoomData.password && newRoomData.password.trim()) {
      const passErr = validateInputSafe(newRoomData.password, "Mật khẩu phòng", 0, 30);
      if (passErr) {
        toast.error(passErr);
        return;
      }
    }

    try {
      const payload = {
        nameRoom: newRoomData.name.trim(),
        roomName: newRoomData.name.trim(),
        nameroom: newRoomData.name.trim(),
        password: newRoomData.password ? newRoomData.password.trim() : null
      };
      const response = await axiosClient.post('/rooms/create', payload);

      if (response.data && response.data.data) {
        toast.success("Tạo phòng thành công!");
        setIsCreateModalOpen(false);
        setNewRoomData({ name: '', password: '' });
        fetchRooms();
        navigate(`/room/${response.data.data.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Tạo phòng thất bại!");
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!selectedRoom) return;

    if (selectedRoom.hasPassword && !joinData.password) {
      toast.error("Vui lòng nhập mật khẩu phòng!");
      return;
    }

    try {
      const response = await axiosClient.post('/rooms/join-room', {
        roomId: selectedRoom.id,
        password: joinData.password || null
      }, {
        params: { room_id: selectedRoom.id, idRoom: selectedRoom.id }
      });

      if (response.data && response.data.data) {
        toast.success("Tham gia phòng thành công!");
        setSelectedRoom(null);
        setJoinData({ nickname: '', password: '' });
        navigate(`/room/${selectedRoom.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Mật khẩu phòng không chính xác!");
    }
  };

  const onRoomCardClick = (room) => {
    // Nếu người dùng đã là thành viên hoặc đã từng tham gia phòng này -> vào thẳng không cần hỏi mật khẩu!
    if (isUserInRoom(room)) {
      try {
        const raw = localStorage.getItem('talovin_entered_rooms') || '[]';
        const parsed = JSON.parse(raw);
        const entered = Array.isArray(parsed) ? parsed : [];
        if (!entered.includes(room.id)) {
          entered.push(room.id);
          localStorage.setItem('talovin_entered_rooms', JSON.stringify(entered));
        }
      } catch (e) {}
      navigate(`/room/${room.id}`);
      return;
    }

    if (room.hasPassword) {
      setSelectedRoom(room);
    } else {
      axiosClient.post('/rooms/join-room', { roomId: room.id, password: null }, { params: { room_id: room.id, idRoom: room.id } })
        .then(() => {
          try {
            const raw = localStorage.getItem('talovin_entered_rooms') || '[]';
            const parsed = JSON.parse(raw);
            const entered = Array.isArray(parsed) ? parsed : [];
            if (!entered.includes(room.id)) {
              entered.push(room.id);
              localStorage.setItem('talovin_entered_rooms', JSON.stringify(entered));
            }
          } catch (e) {}
          navigate(`/room/${room.id}`);
        })
        .catch(() => {
          setSelectedRoom(room);
        });
    }
  };

  const safePosts = Array.isArray(posts) ? posts.filter(Boolean) : [];
  const safeRooms = Array.isArray(rooms) ? rooms.filter(Boolean) : [];
  const safeFriends = Array.isArray(friends) ? friends.filter(Boolean) : [];
  // Các phòng đàm thoại người dùng có quyền nhìn thấy: Phòng đã tham gia HOẶC phòng công khai
  const userAccessibleRooms = safeRooms.filter(r => isUserInRoom(r) || (!r.hasPassword && !r.isPrivate));

  // Nguồn cấp bài viết: Nếu người dùng đã Enter tìm kiếm thì nạp kết quả server (Elastic-like), ngược lại dùng feed bình thường
  const basePostsList = (activeSearchQuery && Array.isArray(searchResults)) 
    ? searchResults 
    : safePosts;

  const displayedPosts = basePostsList
    .filter(p => {
      if (!p) return false;
      if (activeFilterTag) {
        const pVibe = (p.vibe || '').toLowerCase();
        const pContent = (p.content || '').toLowerCase();
        const tagLower = activeFilterTag.toLowerCase();
        if (!pVibe.includes(tagLower) && !pContent.includes(tagLower)) return false;
      }

      if (activeTab === 'saved') {
        return Array.isArray(savedPostIds) && savedPostIds.includes(p.id);
      }
      return true;
    })
    .sort((a, b) => {
      if (!a || !b) return 0;
      // Khi đang xem kết quả tìm kiếm đã xếp hạng độ tương đồng từ server: Giữ nguyên thứ tự Elastic Relevance Score
      if (activeSearchQuery && Array.isArray(searchResults)) {
        return 0;
      }
      if (activeTab === 'trending') {
        const scoreA = (typeof a.trendingScore === 'number') 
          ? a.trendingScore 
          : (((a.searchHits || 0) * 10.0) + ((a.commentsCount || 0) * 3.0) + ((a.likesCount || 0) * 1.0));
        const scoreB = (typeof b.trendingScore === 'number') 
          ? b.trendingScore 
          : (((b.searchHits || 0) * 10.0) + ((b.commentsCount || 0) * 3.0) + ((b.likesCount || 0) * 1.0));
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

  const allCommunitySparks = Array.from(new Set(
    safePosts.flatMap(p => {
      if (!p) return [];
      const tags = [];
      if (p.vibe && typeof p.vibe === 'string') {
        p.vibe.split(/[|\s]+/).forEach(token => {
          const clean = token.replace(/^[#/]+/, '').trim().toLowerCase();
          if (clean && clean.length > 1) tags.push(clean);
        });
      }
      return tags;
    })
  )).slice(0, 10);

  const currentTrack = tracks && tracks.length > 0 ? tracks[currentTrackIndex] : null;

  // Render một bubble bình luận (dùng chung cho cả Mobile Single Feed và Desktop Dual-view)
  const renderCommentBubble = (cmt, isReply = false, targetPostId) => {
    const isCmtMe = currentUserId && cmt.authorId?.toString() === currentUserId.toString();
    const targetPost = safePosts.find(p => p.id === targetPostId) || selectedThreadPost;
    const canDeleteCmt = isCmtMe || (currentUserId && targetPost?.authorId?.toString() === currentUserId.toString());
    const isEditingThisCmt = editingCommentId === cmt.id;

    return (
      <div key={cmt.id} className={isReply ? "cmt-reply-item" : "cmt-row cmt-root-row"}>
        <div 
          className="cursor-pointer flex-shrink-0"
          onClick={() => navigate(`/profile/${cmt.authorId}`)}
          title="Xem hồ sơ cá nhân"
        >
          <UserAvatar 
            avatar={cmt.authorAvatar} 
            name={cmt.authorNickname || cmt.authorAccount} 
            size={isReply ? 26 : 32} 
          />
        </div>

        <div className="cmt-bubble-content flex-1 min-w-0">
          <div className="cmt-header-row flex items-center justify-between">
            <div className="cmt-author-info flex items-center gap-1.5 min-w-0">
              <span 
                className="cmt-user-name font-semibold text-xs text-[#f1f5f9] cursor-pointer hover:underline truncate"
                onClick={() => navigate(`/profile/${cmt.authorId}`)}
              >
                {cmt.authorNickname || cmt.authorAccount || 'Thành viên'}
              </span>
              <span className="cmt-user-handle text-[11px] text-zinc-400 font-mono truncate">
                @{cmt.authorAccount || 'user'}
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-[11px] text-zinc-400">{cmt.formattedTime || 'Vừa xong'}</span>
            </div>
          </div>

          {isEditingThisCmt ? (
            <div className="cmt-inline-edit-box my-1">
              <input 
                type="text" 
                value={editingCommentText}
                onChange={(e) => setEditingCommentText(e.target.value)}
                className="w-full bg-[#181a24] border border-zinc-700 rounded-lg p-2 text-xs text-[#f1f5f9] focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEditComment(targetPostId, cmt.id);
                  if (e.key === 'Escape') setEditingCommentId(null);
                }}
              />
              <div className="flex gap-2 justify-end mt-1">
                <button type="button" onClick={() => setEditingCommentId(null)} className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white">Hủy</button>
                <button type="button" onClick={() => handleSaveEditComment(targetPostId, cmt.id)} className="px-3 py-1 bg-white text-zinc-900 text-xs font-semibold rounded-md">Lưu</button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs sm:text-[13px] text-[#cbd5e1] leading-relaxed my-1">
                {cmt.replyToUser && (
                  <span className="text-sky-400 font-mono mr-1">@{cmt.replyToUser}</span>
                )}
                {cmt.content}
              </p>

              <div className="flex items-center gap-3 pt-1 text-zinc-400">
                <button
                  type="button"
                  onClick={() => handleToggleLikeComment(targetPostId, cmt.id)}
                  className={`flex items-center gap-1 text-[11px] hover:text-[#f1f5f9] transition-colors ${cmt.isLiked ? 'text-rose-500 font-bold' : ''}`}
                >
                  <Heart size={12} className={cmt.isLiked ? "fill-rose-500 text-rose-500" : ""} />
                  {Number(cmt.likesCount || 0) > 0 && <span>{cmt.likesCount}</span>}
                </button>

                <button 
                  type="button" 
                  onClick={() => {
                    setReplyTargetMap(prev => ({
                      ...prev,
                      [targetPostId]: {
                        commentId: cmt.id,
                        authorAccount: cmt.authorAccount || 'user',
                        authorNickname: cmt.authorNickname || cmt.authorAccount || 'Thành viên'
                      }
                    }));
                    const input = document.getElementById('thread-modal-reply-input') || document.getElementById('thread-mobile-reply-input');
                    if (input) input.focus();
                  }} 
                  className="flex items-center gap-1 text-[11px] hover:text-[#f1f5f9] transition-colors"
                >
                  <CornerDownRight size={12} />
                  <span>Trả lời</span>
                </button>

                {isCmtMe && !isEditingThisCmt && (
                  <button 
                    type="button" 
                    onClick={() => handleStartEditComment(cmt)} 
                    className="text-[11px] hover:text-[#f1f5f9] transition-colors"
                  >
                    Sửa
                  </button>
                )}
                {canDeleteCmt && (
                  <button 
                    type="button" 
                    onClick={() => handleDeleteComment(targetPostId, cmt.id)} 
                    className="text-[11px] hover:text-rose-400 transition-colors"
                  >
                    Xóa
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Render cây phân cấp thảo luận
  const renderCommentThreadsTree = (targetPostId) => {
    const list = commentsMap[targetPostId] || [];
    if (list.length === 0) {
      return (
        <div className="py-12 text-center text-zinc-500">
          <MessageSquare size={24} className="mx-auto mb-2 opacity-30 text-zinc-400" />
          <p className="text-xs text-zinc-400">Chưa có phản hồi nào. Hãy là người đầu tiên chia sẻ góc nhìn!</p>
        </div>
      );
    }
    const threads = buildCommentThreads(list);
    return threads.map((thread) => (
      <div key={thread.id} className="cmt-thread-group border-b border-zinc-800/60 pb-3">
        {renderCommentBubble(thread, false, targetPostId)}
        {thread.replies && thread.replies.length > 0 && (
          <div className="cmt-replies-branch-thread">
            {thread.replies.map(reply => renderCommentBubble(reply, true, targetPostId))}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="social-app-wrapper">
      <audio 
        ref={audioRef} 
        src={currentTrack ? (currentTrack.audioUrl || currentTrack.audioSrc || currentTrack.streamUrl) : ""} 
        preload="none"
      />
      {/* Audio element ẩn để phát voice note của các bài viết */}
      <audio 
        ref={cardVoiceAudioRef} 
        onEnded={() => setPlayingVoicePostId(null)}
      />

      {/* NÚT LOADING CHẠY TỪ TOP CENTER XUỐNG KHI ẤN VÀO LOGO */}
      {isTopRefreshing && (
        <div className="top-center-refresh-indicator">
          <div className="refresh-pill">
            <RefreshCw size={13} className="animate-spin text-emerald-400" />
            <span>Đang làm mới bài viết mới nhất...</span>
          </div>
        </div>
      )}

      {/* KHUNG CĂN GIỮA TOÀN BỘ ỨNG DỤNG - DARK ZINC MATTE */}
      <div className="app-main-layout">

        {/* ============================================================== */}
        {/* CỘT 1: THANH ĐIỀU HƯỚNG TRÁI (220px - 240px) */}
        {/* ============================================================== */}
        <aside className="nav-sidebar">
          <div className="nav-brand" onClick={handleLogoRefresh} title="Bấm để cuộn lên đầu & làm mới dữ liệu">
            <TalovinLogo size={30} brandName={systemConfig.brand_name || 'Talovin'} />
          </div>

          {/* Live Music Deck */}
          <div className="ambient-radio-widget">
            <div className="radio-top-row">
              <Music size={13} className="text-zinc-400" />
              <span className="radio-name-text">
                {currentTrack ? (currentTrack.title || currentTrack.name) : "Âm nhạc hệ thống"}
              </span>
              {currentTrack && (
                <div className="equalizer-bars-group">
                  <span className={`eq-bar ${isPlayingRadio ? 'animating' : ''}`}></span>
                  <span className={`eq-bar ${isPlayingRadio ? 'animating' : ''}`}></span>
                  <span className={`eq-bar ${isPlayingRadio ? 'animating' : ''}`}></span>
                  <span className={`eq-bar ${isPlayingRadio ? 'animating' : ''}`}></span>
                </div>
              )}
            </div>
            {currentTrack ? (
              <div className="radio-btns-row">
                <button 
                  type="button"
                  onClick={togglePlayRadio} 
                  className="btn-radio-toggle"
                  title={isPlayingRadio ? "Tạm dừng" : "Phát nhạc"}
                >
                  {isPlayingRadio ? <Pause size={12} /> : <Play size={12} />}
                </button>
                <button 
                  type="button"
                  onClick={playNextRadio} 
                  className="btn-radio-next"
                  title="Chuyển bài"
                >
                  <Shuffle size={12} />
                </button>
                <span className="radio-genre-label font-mono">
                  {currentTrack.genreTag || currentTrack.genre || "Bản nhạc"}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 mt-1">Chưa có bản nhạc nào</p>
            )}
          </div>

          {/* Menu Điều Hướng (Động từ Admin Dashboard) */}
          <div className="nav-menu">
            {dynamicMenu.lobby?.visible !== false && (
              <button 
                className={`nav-item ${activeTab === 'feed' ? 'active' : ''}`}
                onClick={() => { setActiveTab('feed'); setActiveFilterTag(null); }}
              >
                <Compass size={15} strokeWidth={1.5} />
                <span>{dynamicMenu.lobby?.label || "Sảnh trực tuyến"}</span>
              </button>
            )}

            {dynamicMenu.groups?.visible !== false && (
              <button 
                className={`nav-item ${activeTab === 'groups' ? 'active' : ''}`}
                onClick={() => { setActiveTab('groups'); setActiveFilterTag(null); }}
              >
                <Users size={15} strokeWidth={1.5} />
                <span>{dynamicMenu.groups?.label || "Cộng đồng"}</span>
              </button>
            )}

            {dynamicMenu.rooms?.visible !== false && (
              <button 
                className={`nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
                onClick={() => { setActiveTab('rooms'); setActiveFilterTag(null); }}
              >
                <Radio size={15} strokeWidth={1.5} />
                <span>{dynamicMenu.rooms?.label || "Phòng đàm thoại"}</span>
              </button>
            )}

            {dynamicMenu.trending?.visible !== false && (
              <button 
                className={`nav-item ${activeTab === 'trending' ? 'active' : ''}`}
                onClick={() => setActiveTab('trending')}
              >
                <Flame size={15} strokeWidth={1.5} />
                <span>{dynamicMenu.trending?.label || "Thịnh hành"}</span>
              </button>
            )}

            {dynamicMenu.saved?.visible !== false && (
              <button 
                className={`nav-item ${activeTab === 'saved' ? 'active' : ''}`}
                onClick={() => setActiveTab('saved')}
              >
                <Bookmark size={15} strokeWidth={1.5} />
                <span>{dynamicMenu.saved?.label || "Đã lưu"} ({Array.isArray(savedPostIds) ? savedPostIds.length : 0})</span>
              </button>
            )}

            <button 
              type="button"
              className="nav-item"
              onClick={() => navigate('/messages')}
              title="Hộp thư tin nhắn"
            >
              <MessageSquare size={15} strokeWidth={1.5} />
              <span>Tin nhắn</span>
            </button>

            {dynamicMenu.friends?.visible !== false && (
              <button 
                className="nav-item flex items-center justify-between"
                onClick={() => setIsFriendsOpen(true)}
              >
                <div className="flex items-center gap-2.5">
                  <Users size={15} strokeWidth={1.5} />
                  <span>{dynamicMenu.friends?.label || "Bạn bè"}</span>
                </div>
                {pendingFriendsCount > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {pendingFriendsCount}
                  </span>
                )}
              </button>
            )}

            {dynamicMenu.profile?.visible !== false && (
              <button 
                className="nav-item"
                onClick={() => navigate('/profile')}
              >
                <User size={15} strokeWidth={1.5} />
                <span>{dynamicMenu.profile?.label || "Hồ sơ & Huy hiệu"}</span>
              </button>
            )}

            {/* Nút vào Bảng Quản Trị Hệ Thống (Dành riêng cho Quản trị viên) */}
            {isAdminUser && (
              <button 
                type="button"
                className="nav-item border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all font-semibold"
                onClick={() => navigate('/admin')}
                title="Mở Bảng Quản Trị Hệ Thống"
              >
                <Shield size={15} strokeWidth={2} />
                <span>Bảng Quản Trị</span>
              </button>
            )}
          </div>

          {/* User Profile & Account Dock Card (Chân Sidebar chuẩn phong cách Linear / Discord) */}
          <div 
            className="nav-user-dock cursor-pointer" 
            onClick={() => navigate('/profile')}
            title="Quản lý tài khoản, hồ sơ & đăng xuất"
          >
            <div className="dock-user-profile">
              <UserAvatar avatar={localStorage.getItem('user_avatar')} name={currentUserName} size={32} />
              <div className="dock-user-meta">
                <span className="dock-user-name">{currentUserName}</span>
                <span className="dock-user-handle font-mono">@{currentUserAccount}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ============================================================== */}
        {/* CỘT 2: MAIN WORKSPACE (Sảnh trực tuyến & Tín hiệu đa phương tiện) */}
        {/* ============================================================== */}
        <main className="main-stream">
          
          {/* Header Mobile */}
          <header className="mobile-top-bar">
            <div className="m-brand" onClick={handleLogoRefresh} title="Bấm để cuộn lên đầu & làm mới bài viết">
              <TalovinLogo size={26} />
            </div>
            <div className="m-actions">
              <button 
                type="button"
                onClick={() => setShowMobileSearchBar(!showMobileSearchBar)}
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${showMobileSearchBar || activeSearchQuery ? 'bg-white text-black' : 'bg-[#181818] text-zinc-300'}`}
                title="Tìm kiếm bài viết, chủ đề"
              >
                <Search size={14} />
              </button>
              <button 
                type="button"
                onClick={() => setShowMobileMusicSheet(true)} 
                className={`m-radio-pill max-w-[145px] ${isPlayingRadio ? 'active !border-emerald-500/50 !bg-zinc-800 text-white' : ''}`}
                title={currentTrack ? `Nhạc nền: ${currentTrack.title || currentTrack.name} (Chạm để mở trình phát)` : 'Mở trình phát nhạc'}
              >
                {isPlayingRadio ? (
                  <span className="flex items-center gap-0.5 h-3 flex-shrink-0">
                    <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce"></span>
                    <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                    <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                  </span>
                ) : (
                  <Music size={12} className="flex-shrink-0 text-zinc-400" />
                )}
                <span className="truncate font-medium text-[11px] text-zinc-200">
                  {currentTrack ? (currentTrack.title || currentTrack.name) : 'Âm nhạc'}
                </span>
              </button>
              {isAdminUser && (
                <button 
                  type="button"
                  onClick={() => navigate('/admin')} 
                  className="w-7 h-7 rounded-xl flex items-center justify-center bg-zinc-900 border border-zinc-700 text-zinc-200 transition-all hover:bg-zinc-800"
                  title="Mở Bảng Quản Trị Hệ Thống"
                >
                  <Shield size={14} />
                </button>
              )}
              <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="btn-header-notif">
                <Bell size={16} strokeWidth={1.5} />
                {notifications.some(n => n.unread) && <span className="notif-dot"></span>}
              </button>
            </div>
          </header>

          {/* Thanh Search di động mở rộng (khi bấm kính lúp trên Mobile) */}
          {showMobileSearchBar && (
            <div className="sm:hidden px-3 py-2 bg-[#13151b] border-b border-[#232838] animate-slide-up">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  executeSearch(searchInput);
                }}
                className="flex items-center gap-2 p-1.5 rounded-xl bg-[#171a23] border border-[#242b3b]"
              >
                <Search size={14} className="text-zinc-500 ml-1.5 flex-shrink-0" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm nội dung, chủ đề..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="bg-transparent text-xs text-white placeholder-zinc-500 w-full focus:outline-none"
                  enterKeyHint="search"
                  autoFocus
                />
                {searchInput && (
                  <button type="button" onClick={clearSearch} className="text-zinc-500 hover:text-white p-1">
                    <X size={13} />
                  </button>
                )}
                <button 
                  type="submit"
                  className="px-3 py-1 rounded-lg bg-white text-black text-xs font-semibold flex-shrink-0"
                >
                  Tìm
                </button>
              </form>
            </div>
          )}

          {/* Thanh Tab điều hướng Sảnh (Đồng bộ, tối giản cho cả PC & Mobile - Bảng màu Slate Graphite sang trọng) */}
          <div className="stream-header">
            {/* 1. MÀN HÌNH LỚN (PC / TABLET): Hiện đầy đủ các tab ngang thanh lịch, không dùng màu neon AI chói mắt */}
            <div className="stream-tabs hidden sm:flex">
              <button 
                type="button"
                className={`stream-tab ${activeTab === 'feed' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('feed')}
              >
                <Globe size={14} className="tab-icon flex-shrink-0" />
                <span>Sảnh trực tuyến</span>
              </button>
              <button 
                type="button"
                className={`stream-tab ${activeTab === 'groups' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('groups')}
              >
                <Users size={14} className="tab-icon flex-shrink-0" />
                <span>Cộng đồng</span>
              </button>
              <button 
                type="button"
                className={`stream-tab ${activeTab === 'trending' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('trending')}
              >
                <Flame size={14} className="tab-icon flex-shrink-0" />
                <span>Thịnh hành</span>
              </button>
              <button 
                type="button"
                className={`stream-tab ${activeTab === 'saved' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('saved')}
              >
                <Bookmark size={14} className="tab-icon flex-shrink-0" />
                <span>Đã lưu</span>
              </button>
              <button 
                type="button"
                className={`stream-tab ${activeTab === 'rooms' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('rooms')}
              >
                <Radio size={14} className="tab-icon flex-shrink-0" />
                <span>Phòng thoại ({userAccessibleRooms.length})</span>
              </button>
            </div>

            {/* 2. MÀN HÌNH NHỎ (MOBILE): Nút chọn không gian hiện tại + Hamburger mở drawer chuyển không gian mượt mà */}
            <div className="flex sm:hidden items-center justify-between w-full gap-2">
              <button
                type="button"
                onClick={() => setIsSpaceDrawerOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#171a25] hover:bg-[#1f2434] border border-[#252c3c] text-slate-100 text-xs font-semibold shadow-sm active:scale-98 transition-all flex-1 min-w-0"
              >
                {activeTab === 'feed' && <Globe size={13} className="text-slate-300 flex-shrink-0" />}
                {activeTab === 'groups' && <Users size={13} className="text-slate-300 flex-shrink-0" />}
                {activeTab === 'trending' && <Flame size={13} className="text-slate-300 flex-shrink-0" />}
                {activeTab === 'saved' && <Bookmark size={13} className="text-slate-300 flex-shrink-0" />}
                {activeTab === 'rooms' && <Radio size={13} className="text-slate-300 flex-shrink-0" />}
                <span className="truncate">
                  {activeTab === 'feed' ? 'Sảnh trực tuyến' :
                   activeTab === 'groups' ? 'Cộng đồng' :
                   activeTab === 'trending' ? 'Thịnh hành' :
                   activeTab === 'saved' ? 'Đã lưu' :
                   `Phòng thoại (${userAccessibleRooms.length})`}
                </span>
                <ChevronDown size={13} className="text-slate-400 ml-auto flex-shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setIsSpaceDrawerOpen(true)}
                className="w-8 h-8 rounded-xl bg-[#171a25] hover:bg-[#1f2434] border border-[#252c3c] text-slate-300 hover:text-white flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
                title="Mở menu chuyển không gian"
              >
                <Menu size={16} strokeWidth={1.8} />
              </button>
            </div>

            {/* NÚT CHUÔNG THÔNG BÁO SẢNH (Mở Slide-over Drawer sang trọng) */}
            <button 
              type="button"
              onClick={() => setIsNotifOpen(!isNotifOpen)} 
              className="btn-header-notif hidden sm:flex"
              title="Thông báo sảnh (Mở ngăn kéo)"
            >
              <Bell size={15} strokeWidth={1.5} />
              {notifications.some(n => n.unread) && <span className="notif-dot"></span>}
            </button>
          </div>

          {/* ============================================================== */}
          {/* SIDE DRAWER CHUYỂN KHÔNG GIAN CHO MOBILE (TRƯỢT MƯỢT MÀ 60/120FPS) */}
          {/* ============================================================== */}
          <AnimatePresence>
            {isSpaceDrawerOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-md"
                onClick={() => setIsSpaceDrawerOpen(false)}
              >
                <motion.div 
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 32, stiffness: 380, mass: 0.7 }}
                  drag="x"
                  dragConstraints={{ left: 0 }}
                  dragElastic={{ right: 0.5 }}
                  onDragEnd={(e, { offset, velocity }) => {
                    if (offset.x > 80 || velocity.x > 300) {
                      setIsSpaceDrawerOpen(false);
                    }
                  }}
                  className="w-[300px] max-w-[85vw] h-full bg-[#161923] border-l border-[#242b3b] p-5 shadow-2xl flex flex-col space-y-4 will-change-transform touch-pan-y"
                  onClick={(e) => e.stopPropagation()}
                >
                <div className="flex items-center justify-between pb-3 border-b border-[#222838]">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">Không gian trải nghiệm</h3>
                    <p className="text-[11px] text-slate-400">Chuyển đổi khu vực hoạt động</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsSpaceDrawerOpen(false)}
                    className="w-8 h-8 rounded-full bg-[#1e2332] hover:bg-[#282f42] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto custom-dark-scrollbar">
                  {[
                    { id: 'feed', label: 'Sảnh trực tuyến', desc: 'Bảng tin chia sẻ khoảnh khắc & bài viết tự do', icon: Globe },
                    { id: 'groups', label: 'Cộng đồng', desc: 'Khám phá các hội nhóm & chủ đề chuyên biệt', icon: Users },
                    { id: 'trending', label: 'Thịnh hành', desc: 'Bài viết nhiều tương tác & chủ đề sôi nổi nhất', icon: Flame },
                    { id: 'saved', label: 'Đã lưu', desc: 'Xem lại bài viết bạn đã bookmark đánh dấu', icon: Bookmark },
                    { id: 'rooms', label: `Phòng thoại (${userAccessibleRooms.length})`, desc: 'Đàm thoại âm thanh trực tiếp độ trễ cực thấp', icon: Radio }
                  ].map(item => {
                    const isActive = activeTab === item.id;
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          handleSwitchTab(item.id);
                          setIsSpaceDrawerOpen(false);
                        }}
                        className={`w-full flex items-center gap-3.5 p-3 rounded-2xl border transition-all text-left active:scale-[0.99] ${
                          isActive 
                            ? 'bg-[#202636] border-[#2f3950] shadow-sm text-white' 
                            : 'bg-[#181b25] border-transparent hover:bg-[#1e2332] text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[#283044] text-white' : 'bg-[#151720] text-slate-400'}`}>
                          <IconComponent size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>{item.label}</div>
                          <div className="text-[11px] text-slate-400 truncate">{item.desc}</div>
                        </div>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-slate-200 flex-shrink-0"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

          {/* THANH BÁO HIỆU SOFT TRANSITION KHI CHUYỂN TAB */}
          {isTabSwitching && (
            <div className="tab-switching-indicator flex items-center justify-center gap-2 py-2 px-3 mb-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 animate-pulse">
              <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Đang chuyển không gian...</span>
            </div>
          )}

          {/* Banner lọc chủ đề đang chọn */}
          {activeFilterTag && (
            <div className="active-tag-filter-banner">
              <span>Đang lọc bài viết theo: <strong className="font-mono">{activeFilterTag}</strong></span>
              <button onClick={() => setActiveFilterTag(null)} className="btn-clear-tag-filter">
                <X size={12} /> Bỏ lọc
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* KHU VỰC A+: PHÒNG ĐÀM THOẠI TRỰC TIẾP (LIVE AUDIO LOUNGE ROOMS) */}
          {/* ============================================================== */}
          {/* KHU VỰC B: BỘ TẠO TÍN HIỆU ĐA PHƯƠNG TIỆN (Multimedia Composer) */}
          {/* ============================================================== */}
          {activeTab === 'feed' && (
            <div className="post-creator-box">
              <div className="creator-input-row">
                <UserAvatar avatar={localStorage.getItem('user_avatar')} size={36} />
                <div className="creator-field-wrap">
                  <textarea 
                    ref={newPostInputRef}
                    rows="2" 
                    placeholder="Bạn đang nghĩ gì? Chia sẻ câu chuyện, cảm xúc hoặc một khoảnh khắc cùng cộng đồng..."
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                  />
                </div>
              </div>

              {/* Preview Ảnh / Video ngắn đã nén */}
              {attachedMedia && (
                <div className="composer-attached-preview">
                  {attachedMedia.type === 'video' ? (
                    <video 
                      src={attachedMedia.url} 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="preview-media-element" 
                    />
                  ) : (
                    <img 
                      src={attachedMedia.url} 
                      alt="Đính kèm" 
                      className="preview-media-element" 
                    />
                  )}
                  <button 
                    type="button" 
                    onClick={() => setAttachedMedia(null)} 
                    className="btn-remove-attached"
                    title="Xóa tệp đính kèm"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Preview Ghi âm 15s */}
              {isRecordingVoice ? (
                <div className="voice-recording-indicator">
                  <span className="rec-dot-pulsing"></span>
                  <span className="font-mono text-xs text-rose-400">
                    Đang thu âm: 00:{voiceDuration < 10 ? `0${voiceDuration}` : voiceDuration} / 00:15
                  </span>
                  <button 
                    type="button" 
                    onClick={stopVoiceRecording} 
                    className="btn-stop-rec"
                  >
                    <Square size={11} fill="currentColor" /> Dừng
                  </button>
                </div>
              ) : voiceBase64 ? (
                <div className="voice-preview-deck">
                  <button 
                    type="button" 
                    onClick={togglePlayVoicePreview} 
                    className="btn-play-voice-preview"
                    title={isPlayingVoicePreview ? "Tạm dừng" : "Nghe thử"}
                  >
                    {isPlayingVoicePreview ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <div className="voice-waveform-preview">
                    <span className={`wave-bar ${isPlayingVoicePreview ? 'playing' : ''}`}></span>
                    <span className={`wave-bar ${isPlayingVoicePreview ? 'playing' : ''}`}></span>
                    <span className={`wave-bar ${isPlayingVoicePreview ? 'playing' : ''}`}></span>
                    <span className={`wave-bar ${isPlayingVoicePreview ? 'playing' : ''}`}></span>
                    <span className={`wave-bar ${isPlayingVoicePreview ? 'playing' : ''}`}></span>
                  </div>
                  <span className="font-mono text-xs text-zinc-300">
                    00:{voiceDuration < 10 ? `0${voiceDuration}` : voiceDuration}
                  </span>
                  <button 
                    type="button" 
                    onClick={clearVoiceRecording} 
                    className="btn-delete-voice" 
                    title="Hủy ghi âm"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : null}

              {/* Chọn Vibe Tags: Icon thật có màu sắc trang nhã, không màu mè AI bóng bẩy */}
              <div className="composer-vibes-wrapper my-2">
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <span className="text-[11.5px] font-medium text-zinc-400 flex items-center gap-1.5 flex-wrap">
                    <Smile size={13} className="text-zinc-400 flex-shrink-0" />
                    <span>Chủ đề & Cảm xúc ({dynamicVibes.length})</span>
                    {selectedVibe && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700">
                        Đang chọn: {dynamicVibes.find(v => v.id === selectedVibe)?.label}
                      </span>
                    )}
                  </span>
                  {dynamicVibes.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setIsVibesExpanded(!isVibesExpanded)}
                      className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors flex-shrink-0"
                    >
                      <span>{isVibesExpanded ? 'Thu gọn' : 'Xem tất cả'}</span>
                      <ChevronDown size={13} className={`transition-transform duration-200 ${isVibesExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>

                {isVibesExpanded ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 pt-0.5 pb-1 animate-fade-in">
                    {dynamicVibes.map(v => {
                      const IconComponent = v.icon || Tag;
                      const isSelected = selectedVibe === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVibe(isSelected ? null : v.id)}
                          className={`vibe-tag-pill w-full justify-center ${isSelected ? 'active' : ''}`}
                        >
                          <IconComponent size={13} strokeWidth={1.75} className={`vibe-icon flex-shrink-0 ${v.color || 'text-zinc-400'}`} />
                          <span className="truncate">{v.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="vibe-tags-row flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                    {dynamicVibes.map(v => {
                      const IconComponent = v.icon || Tag;
                      const isSelected = selectedVibe === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVibe(isSelected ? null : v.id)}
                          className={`vibe-tag-pill flex-shrink-0 ${isSelected ? 'active' : ''}`}
                        >
                          <IconComponent size={13} strokeWidth={1.75} className={`vibe-icon flex-shrink-0 ${v.color || 'text-zinc-400'}`} />
                          <span>{v.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Nhập Sparks / Chủ đề cộng đồng nếu mở */}
              {showSparkInput && (
                <div className="community-sparks-section animate-fade-in">
                  <div className="custom-spark-input-row">
                    <Hash size={14} className="spark-input-icon text-emerald-400" />
                    <input 
                      type="text" 
                      placeholder="Gắn thẻ góc nhìn, #chủ đề quan tâm..."
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={handleAddCustomTag}
                    />
                    <button 
                      type="button" 
                      onClick={handleAddCustomTag}
                      disabled={!customTagInput.trim()}
                      className="btn-add-spark-action"
                    >
                      <Plus size={12} /> <span>Thêm</span>
                    </button>
                  </div>

                  {/* Gợi ý chủ đề nhanh để người dùng không cần gõ thủ công */}
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-2 pb-0.5">
                    <span className="text-[10px] text-zinc-500 font-mono flex-shrink-0">Gợi ý nhanh:</span>
                    {['#tam_su', '#am_nhac', '#cong_nghe', '#doi_song', '#goc_nhin'].map(suggested => (
                      <button
                        key={suggested}
                        type="button"
                        onClick={() => {
                          if (!selectedTags.includes(suggested)) {
                            setSelectedTags(prev => [...prev, suggested]);
                          }
                        }}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 border border-zinc-700/60 flex-shrink-0 transition-colors active:scale-95"
                      >
                        {suggested}
                      </button>
                    ))}
                  </div>

                  {selectedTags.length > 0 && (
                    <div className="selected-sparks-wrap pt-1">
                      {selectedTags.map(tag => (
                        <span key={tag} className="active-spark-chip font-mono">
                          {tag}
                          <button type="button" onClick={() => handleRemoveTag(tag)} className="btn-remove-spark"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Toolbar đính kèm & Đăng bài */}
              <div className="creator-bottom-row">
                <div className="creator-left-tools">
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept="image/*,video/mp4,video/webm" 
                    style={{ display: 'none' }} 
                    onChange={handleFileSelect} 
                  />

                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`btn-subtool ${attachedMedia ? 'active' : ''}`}
                    title="Đính kèm hình ảnh hoặc video clip ngắn"
                  >
                    <ImageIcon size={15} strokeWidth={1.5} className="text-sky-400 flex-shrink-0" />
                    <span>Ảnh<span className="hidden sm:inline"> / Video</span></span>
                  </button>

                  <button 
                    type="button"
                    onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                    className={`btn-subtool ${isRecordingVoice || voiceBase64 ? 'active-rose' : ''}`}
                    title="Ghi âm giọng nói 15 giây"
                  >
                    <Mic size={15} strokeWidth={1.5} className="text-rose-400 flex-shrink-0" />
                    <span>{isRecordingVoice ? 'Thu âm...' : (voiceBase64 ? 'Đã thu' : 'Ghi âm')}</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setShowSparkInput(!showSparkInput)}
                    className={`btn-subtool ${showSparkInput || selectedTags.length > 0 ? 'active' : ''}`}
                    title="Gắn thẻ chủ đề bài viết"
                  >
                    <Tag size={15} strokeWidth={1.5} className="text-amber-400 flex-shrink-0" />
                    <span><span className="hidden sm:inline">Gắn </span>chủ đề</span>
                  </button>
                </div>

                <button 
                  type="button"
                  onClick={handleCreatePost}
                  disabled={isPosting || (!newPostContent.trim() && !attachedMedia && !voiceBase64)}
                  className="btn-publish-submit"
                >
                  {isPosting ? 'Đang gửi...' : 'Đăng bài'}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB: DANH SÁCH BÀI VIẾT (Chỉ ở Sảnh trực tuyến, Thịnh hành hoặc Đã lưu) */}
          {/* ============================================================== */}
          {(activeTab === 'feed' || activeTab === 'trending' || activeTab === 'saved') && (
            <div className="posts-stream-container">
              {/* BANNER KẾT QUẢ TÌM KIẾM THÔNG MINH */}
              {activeSearchQuery && (
                <div className="search-status-banner flex items-center justify-between p-3.5 mb-3 rounded-2xl bg-[#141414] border border-[#222222] shadow-sm animate-fade-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <Search size={14} className="text-sky-400 flex-shrink-0" />
                    <span className="text-xs text-zinc-300 truncate">
                      Kết quả tìm kiếm: <strong className="text-white">"{activeSearchQuery}"</strong>
                      <span className="text-zinc-500 font-mono text-[11px] ml-1.5">
                        ({isSearching ? 'Đang phân tích...' : `${searchResults?.length || 0} bài viết`})
                      </span>
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={clearSearch}
                    className="flex-shrink-0 text-xs text-zinc-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] transition-all"
                  >
                    <X size={12} />
                    <span>Đặt lại</span>
                  </button>
                </div>
              )}

              {/* TRẠNG THÁI ĐANG TÌM KIẾM */}
              {isSearching ? (
                <div className="py-14 text-center text-zinc-400 font-mono">
                  <Loader2 size={24} className="animate-spin text-sky-400 mx-auto mb-2.5" />
                  <p className="text-xs text-zinc-300">Đang tìm kiếm & phân tích chủ đề liên quan...</p>
                  <p className="text-[11px] text-zinc-600 mt-1">Áp dụng thuật toán đối soát ngữ nghĩa & xếp hạng tương tác</p>
                </div>
              ) : loadingPosts ? (
                <div className="feed-status-box font-mono">
                  <div className="feed-spinner"></div>
                  <p>Đang tải bài viết...</p>
                </div>
              ) : displayedPosts.length === 0 ? (
                <div className="feed-status-box">
                  <MessageSquare size={28} className="text-zinc-600 mb-2 mx-auto" />
                  <p className="text-zinc-400 text-sm">{activeSearchQuery ? `Không tìm thấy bài viết nào cho "${activeSearchQuery}".` : 'Chưa có bài viết nào ở chế độ xem này.'}</p>
                  {activeSearchQuery && (
                    <button 
                      type="button" 
                      onClick={clearSearch} 
                      className="mt-3 px-3.5 py-1.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] text-xs text-zinc-300 border border-[#2e2e2e] hover:text-white transition-colors"
                    >
                      Quay lại dòng thời gian
                    </button>
                  )}
                </div>
              ) : (
                displayedPosts.map((post) => {
                  const currentReaction = REACTION_EMOJIS.find(e => e.type === post.myReaction);
                  const isSaved = Array.isArray(savedPostIds) && savedPostIds.includes(post.id);
                  const isMe = currentUserId && post.authorId?.toString() === currentUserId.toString();
                  const isFounder = post.authorVipTier === 'FOUNDER' || post.authorRoles?.includes('ROLE_ADMIN') || post.authorRoles?.includes('ROLE_AMDIN') || post.authorBadge;
                  const parsedMedia = parsePostMedia(post.imageUrl, post);

                  return (
                    <article key={post.id} id={`post-${post.id}`} className="post-item-card">
                      {post.groupId && (
                        <div className="post-community-header-bar flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-800/80 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-zinc-400 font-mono text-[11px] shrink-0">Tần số từ •</span>
                            <span 
                              className="text-zinc-100 font-semibold hover:underline cursor-pointer truncate" 
                              onClick={() => {
                                if (post.groupId) navigate(`/communities/${post.groupId}`);
                                else setActiveTab('groups');
                              }}
                            >
                              {post.groupName || 'Cộng đồng'}
                            </span>
                            {post.recommendationReason && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
                                {post.recommendationReason}
                              </span>
                            )}
                          </div>

                          {!post.isMemberOfGroup && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await axiosClient.post(`/groups/${post.groupId}/join`);
                                  toast.success(`Đã gia nhập ${post.groupName || 'cộng đồng'}!`);
                                  setPosts(prev => prev.map(p => p.groupId === post.groupId ? { ...p, isMemberOfGroup: true } : p));
                                } catch (err) {
                                  toast.error(err.response?.data?.message || 'Không thể gia nhập');
                                }
                              }}
                              className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium border border-zinc-700 transition-all flex items-center gap-1 active:scale-95 flex-shrink-0"
                            >
                              <Plus size={11} />
                              <span>Tham gia</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Tín hiệu Đề xuất Xã hội Thông minh (Smart Social Discovery Signals) */}
                      {post.recommendationReason && !post.groupId && !post.repostedByUsername && (
                        <div className="flex items-center gap-1.5 pb-2 mb-2 text-[11px] text-zinc-400 font-medium border-b border-zinc-800">
                          {post.isFriendInteraction ? (
                            <Users size={12} className="text-zinc-400 flex-shrink-0" />
                          ) : (
                            <Sparkles size={12} className="text-zinc-400 flex-shrink-0" />
                          )}
                          <span>{post.recommendationReason}</span>
                        </div>
                      )}

                      <div className="post-header-row">
                        <div 
                          className="post-avatar-click cursor-pointer" 
                          onClick={() => navigate(`/profile/${post.authorId || post.userId}`)}
                        >
                          <UserAvatar 
                            avatar={post.authorAvatar} 
                            name={post.authorNickname || post.authorAccount} 
                            size={36} 
                          />
                        </div>

                        <div className="post-header-info">
                          <div className="post-name-line">
                            <span 
                              className="author-display-name cursor-pointer hover:underline"
                              onClick={() => navigate(`/profile/${post.authorId || post.userId}`)}
                            >
                              {post.authorNickname || post.authorAccount || "Thành viên"}
                            </span>

                            {/* Badge PRO chuẩn Dark Zinc Minimalist */}
                            {isFounder && (
                              <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                                PRO
                              </span>
                            )}

                            <span className="author-handle font-mono">@{post.authorAccount || "user"}</span>
                            <span className="text-zinc-600">·</span>
                            <span className="post-time-meta font-mono">{post.formattedTime || "Vừa xong"}</span>

                            {post.groupId && post.groupName && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab('groups');
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#181818] border border-[#242424] text-[10px] text-zinc-300 hover:text-white cursor-pointer transition-colors"
                                title={`Bài viết thuộc cộng đồng ${post.groupName}`}
                              >
                                <span>✦ {post.groupName}</span>
                                {post.isMemberOfGroup ? (
                                  <span className="text-emerald-400 font-mono text-[9px]">✓ Đã tham gia</span>
                                ) : (
                                  <span className="text-zinc-500 font-mono text-[9px]">• Đề xuất</span>
                                )}
                              </span>
                            )}

                            {activeTab === 'trending' && (post.searchHits || 0) > 0 && (
                              <span className="font-mono text-[10px] text-zinc-300 bg-zinc-800/90 px-1.5 py-0.5 rounded border border-zinc-700/60 flex items-center gap-1" title="Lượt tìm kiếm bài viết theo thuật toán AI">
                                🔥 {post.searchHits} tìm kiếm
                              </span>
                            )}

                            {post.vibe && typeof post.vibe === 'string' && (
                              <div className="post-topics-bar">
                                {post.vibe.split(/[|\s]+/).filter(Boolean).map((token, idx) => {
                                  const clean = token.replace(/^[#/]+/, '').trim();
                                  if (!clean) return null;
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setActiveFilterTag(activeFilterTag === clean ? null : clean)}
                                      className={`post-topic-chip ${activeFilterTag === clean ? 'active' : ''}`}
                                      title={`Lọc theo chủ đề: ${clean}`}
                                    >
                                      <span className="topic-dot"></span>
                                      {clean}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Nút lưu & menu thao tác */}
                        <div className="post-header-actions">
                          <button 
                            type="button"
                            onClick={() => handleToggleSavePost(post.id)}
                            className={`btn-save-post ${isSaved ? 'saved' : ''}`}
                            title={isSaved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
                          >
                            <Bookmark size={15} strokeWidth={1.5} fill={isSaved ? "currentColor" : "none"} />
                          </button>

                          <div className="post-menu-container">
                            <button 
                              type="button"
                              onClick={() => setPostMenuOpenId(postMenuOpenId === post.id ? null : post.id)}
                              className="post-menu-btn"
                              title="Tùy chọn bài viết"
                            >
                              <MoreVertical size={15} strokeWidth={1.5} />
                            </button>

                            {postMenuOpenId === post.id && (
                              <div className="post-menu-dropdown animate-fade-in">
                                {isMe ? (
                                  <>
                                    <button 
                                      type="button" 
                                      onClick={() => handleOpenEditPost(post)} 
                                      className="post-menu-item"
                                    >
                                      <Edit3 size={13} /> Sửa bài viết
                                    </button>
                                    <button 
                                      type="button" 
                                      onClick={() => handleDeletePost(post.id)} 
                                      className="post-menu-item danger"
                                    >
                                      <Trash2 size={13} /> Xóa bài viết
                                    </button>
                                  </>
                                ) : (
                                  <button 
                                    type="button" 
                                    onClick={() => handleOpenReportModal(post.id)} 
                                    className="post-menu-item text-amber-400 hover:text-amber-300"
                                  >
                                    <Flag size={13} /> Báo cáo vi phạm
                                  </button>
                                )}

                                {isAdminUser && !isMe && (
                                  <button 
                                    type="button" 
                                    onClick={() => handleDeletePost(post.id)} 
                                    className="post-menu-item danger"
                                  >
                                    <Trash2 size={13} /> Xóa bài (Admin)
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Nội dung bài viết: Bấm vào để mở Thread Detail View (giống Threads) */}
                      <div 
                        className="post-body-content cursor-pointer"
                        onClick={() => {
                          setSelectedThreadPost(post);
                          fetchComments(post.id);
                        }}
                      >
                        {/* Chỉ hiển thị chữ nếu không phải là nhãn fallback 'Ghi âm giọng nói' khi đã có audioUrl */}
                        {post.content && (post.content.trim() !== 'Ghi âm giọng nói' || !parsedMedia.audioUrl) && (
                          <p>{post.content}</p>
                        )}

                        {/* Hiển thị Media: Ảnh hoặc Video ngắn tự động lặp muted + Click để mở toàn màn hình (Lightbox) */}
                        {parsedMedia.mediaUrl && (
                          <div 
                            className="post-media-frame cursor-pointer group/media relative"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxMedia({
                                url: parsedMedia.mediaUrl,
                                type: parsedMedia.mediaType,
                                author: post.authorNickname || post.authorName || post.author,
                                title: post.content
                              });
                            }}
                            title="Bấm để xem chi tiết / phóng to toàn màn hình"
                          >
                            {parsedMedia.mediaType === 'video' ? (
                              <div className="relative w-full overflow-hidden rounded-xl">
                                <video 
                                  src={parsedMedia.mediaUrl} 
                                  autoPlay 
                                  loop 
                                  muted 
                                  playsInline 
                                  className="post-media-video group-hover/media:brightness-95 transition-all" 
                                />
                                <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[11px] font-mono text-white/95 flex items-center gap-1.5 shadow-lg opacity-85 group-hover/media:opacity-100 transition-opacity">
                                  <Maximize2 size={12} />
                                  <span>Phóng to</span>
                                </div>
                              </div>
                            ) : (
                              <div className="relative w-full overflow-hidden rounded-xl">
                                <img 
                                  src={parsedMedia.mediaUrl} 
                                  alt="Khoảnh khắc" 
                                  loading="lazy" 
                                  className="post-media-image group-hover/media:scale-[1.01] transition-transform duration-300" 
                                />
                                <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[11px] font-mono text-white/95 flex items-center gap-1.5 shadow-lg opacity-0 group-hover/media:opacity-100 transition-opacity">
                                  <Maximize2 size={12} />
                                  <span>Xem lớn</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Trình phát Voice Note ngắn trên thẻ */}
                        {parsedMedia.audioUrl && (
                          <div 
                            className="post-voice-player-pill"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              type="button"
                              onClick={() => handleTogglePlayPostVoice(post.id, parsedMedia.audioUrl)}
                              className="btn-play-card-voice"
                              title={playingVoicePostId === post.id ? "Tạm dừng" : "Nghe ghi âm"}
                            >
                              {playingVoicePostId === post.id ? <Pause size={13} /> : <Play size={13} />}
                            </button>
                            <div className="card-voice-waveform">
                              <span className={`card-wave-bar ${playingVoicePostId === post.id ? 'active' : ''}`}></span>
                              <span className={`card-wave-bar ${playingVoicePostId === post.id ? 'active' : ''}`}></span>
                              <span className={`card-wave-bar ${playingVoicePostId === post.id ? 'active' : ''}`}></span>
                              <span className={`card-wave-bar ${playingVoicePostId === post.id ? 'active' : ''}`}></span>
                              <span className={`card-wave-bar ${playingVoicePostId === post.id ? 'active' : ''}`}></span>
                              <span className={`card-wave-bar ${playingVoicePostId === post.id ? 'active' : ''}`}></span>
                            </div>
                            <span className="font-mono text-xs text-zinc-300">
                              {parsedMedia.audioDuration ? `00:${parsedMedia.audioDuration < 10 ? `0${parsedMedia.audioDuration}` : parsedMedia.audioDuration}` : '00:15'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Thanh tương tác (Phẳng, không viền pill quanh từng nút) */}
                      <div className="post-actions-toolbar">
                        
                        {/* Reaction Popover: Luôn đặt trên nút, KHÔNG che chữ, tự động biến mất khi rời chuột */}
                        <div 
                          className="reaction-drop-wrapper relative group"
                          onMouseEnter={() => {
                            if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
                            setActiveReactionPicker(post.id);
                          }}
                          onMouseLeave={() => {
                            if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
                            reactionTimeoutRef.current = setTimeout(() => {
                              setActiveReactionPicker(null);
                            }, 180);
                          }}
                        >
                          <button 
                            type="button"
                            onClick={() => handleReactPost(post.id, post.myReaction || 'HEART')}
                            className={`action-btn ${post.isLikedByMe ? 'active-liked' : ''}`}
                            title={currentReaction ? currentReaction.label : "Thả cảm xúc"}
                          >
                            {post.isLikedByMe && currentReaction ? (
                              <span className="reaction-active-emoji text-sm select-none leading-none inline-block transform hover:scale-110 transition-transform">
                                {currentReaction.emoji}
                              </span>
                            ) : (
                              <Heart 
                                size={15} 
                                strokeWidth={1.5} 
                                fill={post.isLikedByMe ? "#ef4444" : "none"} 
                                color={post.isLikedByMe ? "#ef4444" : "currentColor"} 
                              />
                            )}
                            <span className="font-mono text-xs">{post.likesCount || 0}</span>
                          </button>

                          {activeReactionPicker === post.id && (
                            <div 
                              className="reactions-popup-menu"
                              onMouseEnter={() => {
                                if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
                              }}
                              onMouseLeave={() => {
                                if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
                                setActiveReactionPicker(null);
                              }}
                            >
                              {REACTION_EMOJIS.map(item => (
                                <button
                                  key={item.type}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReactPost(post.id, item.type);
                                    setActiveReactionPicker(null);
                                  }}
                                  className="reaction-emoji-item"
                                  title={item.label}
                                >
                                  {item.emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Nút bình luận: Bật/tắt xem thảo luận trực tiếp */}
                        <button 
                          type="button"
                          onClick={() => handleToggleComments(post.id)}
                          className={`action-btn ${expandedComments[post.id] ? 'text-sky-400 font-semibold' : ''}`}
                          title="Bình luận & Thảo luận"
                        >
                          <MessageSquare size={15} strokeWidth={1.5} />
                          <span className="font-mono text-xs">{post.commentsCount || 0}</span>
                        </button>

                        <button 
                          type="button"
                          onClick={() => setSharePost(post)}
                          className="action-btn"
                          title="Chia sẻ bài viết"
                        >
                          <Share2 size={15} strokeWidth={1.5} />
                          <span className="text-xs">Chia sẻ</span>
                        </button>
                      </div>

                      {/* Khu vực bình luận: Chỉ mở khi người dùng click */}
                      {expandedComments[post.id] && (
                        <div className="post-comments-container">
                          <div className="comments-stack">
                            {(!commentsMap[post.id] || commentsMap[post.id].length === 0) ? (
                              <p className="empty-cmt-notice">Chưa có phản hồi nào. Hãy là người đầu tiên chia sẻ góc nhìn!</p>
                            ) : (
                              buildCommentThreads(commentsMap[post.id]).map((thread) => {
                                const renderCommentBubble = (cmt, isReply = false) => {
                                  const isCmtMe = currentUserId && cmt.authorId?.toString() === currentUserId.toString();
                                  const canDeleteCmt = isCmtMe || (currentUserId && post.authorId?.toString() === currentUserId.toString());
                                  const isEditingThisCmt = editingCommentId === cmt.id;

                                  return (
                                    <div key={cmt.id} className={isReply ? "cmt-reply-item" : "cmt-row cmt-root-row"}>
                                      <div 
                                        className="cursor-pointer flex-shrink-0"
                                        onClick={() => navigate(`/profile/${cmt.authorId}`)}
                                        title="Xem hồ sơ cá nhân"
                                      >
                                        <UserAvatar 
                                          avatar={cmt.authorAvatar} 
                                          name={cmt.authorNickname || cmt.authorAccount} 
                                          size={isReply ? 24 : 30} 
                                        />
                                      </div>
                                      <div className={`cmt-bubble-content ${isReply ? 'reply-bubble' : 'root-bubble'}`}>
                                        <div className="cmt-header-row">
                                          <div className="cmt-author-info min-w-0">
                                            <span 
                                              className={`cmt-user-name ${isReply ? 'reply-name' : ''} cursor-pointer hover:underline truncate`}
                                              onClick={() => navigate(`/profile/${cmt.authorId}`)}
                                            >
                                              {cmt.authorNickname || cmt.authorAccount || 'Thành viên'}
                                            </span>
                                            <span className={`cmt-user-handle ${isReply ? 'reply-handle' : ''} truncate`}>
                                              @{cmt.authorAccount || 'user'}
                                            </span>
                                            <span className="cmt-meta-dot flex-shrink-0">·</span>
                                            <span className="cmt-time-label flex-shrink-0">{cmt.formattedTime || 'Vừa xong'}</span>
                                          </div>
                                        </div>

                                        {isEditingThisCmt ? (
                                          <div className="cmt-inline-edit-box">
                                            <input 
                                              type="text" 
                                              value={editingCommentText}
                                              onChange={(e) => setEditingCommentText(e.target.value)}
                                              className="cmt-inline-edit-input"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveEditComment(post.id, cmt.id);
                                                if (e.key === 'Escape') setEditingCommentId(null);
                                              }}
                                            />
                                            <div className="cmt-inline-edit-actions">
                                              <button 
                                                type="button" 
                                                onClick={() => setEditingCommentId(null)} 
                                                className="btn-cancel-inline-cmt"
                                              >
                                                Hủy
                                              </button>
                                              <button 
                                                type="button" 
                                                onClick={() => handleSaveEditComment(post.id, cmt.id)} 
                                                disabled={isSavingComment}
                                                className="btn-save-inline-cmt"
                                              >
                                                {isSavingComment ? 'Đang lưu...' : 'Lưu'}
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <p className="cmt-body-text">
                                              {cmt.replyToUser && (
                                                <span className="cmt-mention-badge font-mono">
                                                  @{cmt.replyToUser}{' '}
                                                </span>
                                              )}
                                              {cmt.content}
                                            </p>

                                            {/* Footer thao tác bình luận: Like, Trả lời, Sửa, Xóa */}
                                            <div className="cmt-footer-row">
                                              {/* Nút Thả tim / Cảm xúc */}
                                              <button
                                                type="button"
                                                onClick={() => handleToggleLikeComment(post.id, cmt.id)}
                                                className={`btn-cmt-act reaction ${cmt.isLiked ? 'liked text-rose-500 font-bold' : ''}`}
                                                title={cmt.isLiked ? 'Bỏ thích phản hồi' : 'Thích phản hồi'}
                                              >
                                                <Heart 
                                                  size={11.5} 
                                                  className={cmt.isLiked ? "fill-rose-500 text-rose-500 transition-all scale-105" : "transition-all"} 
                                                />
                                                {Number(cmt.likesCount || 0) > 0 && (
                                                  <span className="cmt-like-count font-mono text-[10.5px]">{cmt.likesCount}</span>
                                                )}
                                              </button>

                                              {/* Nút Trả lời */}
                                              <button 
                                                type="button" 
                                                onClick={() => {
                                                  setReplyTargetMap(prev => ({
                                                    ...prev,
                                                    [post.id]: {
                                                      commentId: cmt.id,
                                                      authorAccount: cmt.authorAccount || 'user',
                                                      authorNickname: cmt.authorNickname || cmt.authorAccount || 'Thành viên'
                                                    }
                                                  }));
                                                  const inputEl = document.getElementById(`comment-input-${post.id}`);
                                                  if (inputEl) inputEl.focus();
                                                }} 
                                                className="btn-cmt-act reply"
                                                title="Trả lời phản hồi này"
                                              >
                                                <CornerDownRight size={11.5} className="flex-shrink-0" />
                                                <span>Trả lời</span>
                                              </button>

                                              {isCmtMe && !isEditingThisCmt && (
                                                <button 
                                                  type="button" 
                                                  onClick={() => handleStartEditComment(cmt)} 
                                                  className="btn-cmt-act"
                                                  title="Sửa phản hồi"
                                                >
                                                  <Edit3 size={11} />
                                                  <span>Sửa</span>
                                                </button>
                                              )}
                                              {canDeleteCmt && (
                                                <button 
                                                  type="button" 
                                                  onClick={() => handleDeleteComment(post.id, cmt.id)} 
                                                  className="btn-cmt-act danger text-zinc-500 hover:text-rose-400"
                                                  title="Xóa phản hồi"
                                                >
                                                  <Trash2 size={11} />
                                                  <span>Xóa</span>
                                                </button>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                };

                                return (
                                  <div key={thread.id} className="cmt-thread-group">
                                    {/* 1. Bình luận gốc cấp 1 */}
                                    {renderCommentBubble(thread, false)}

                                    {/* 2. Nhánh các phản hồi con có đường kẻ dọc phân cấp rõ rệt */}
                                    {thread.replies && thread.replies.length > 0 && (
                                      <div className="cmt-replies-branch-thread">
                                        {thread.replies.map((replyCmt) => renderCommentBubble(replyCmt, true))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Thanh thông báo mục tiêu đang trả lời */}
                          {replyTargetMap[post.id] && (
                            <div className="replying-to-banner">
                              <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                                <CornerDownRight size={12} className="text-sky-400" />
                                <span>Đang trả lời <strong>@{replyTargetMap[post.id].authorAccount}</strong></span>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => setReplyTargetMap(prev => ({ ...prev, [post.id]: null }))}
                                className="btn-cancel-reply"
                                title="Hủy trả lời"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}

                          {/* Khung nhập phản hồi */}
                          <div className="cmt-input-form">
                            <input 
                              id={`comment-input-${post.id}`}
                              type="text" 
                              placeholder={replyTargetMap[post.id] ? `Trả lời @${replyTargetMap[post.id].authorAccount}...` : "Viết phản hồi ngắn..."} 
                              value={commentInputs[post.id] || ''}
                              onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddComment(post.id);
                                }
                              }}
                            />
                            <button 
                              type="button" 
                              onClick={() => handleAddComment(post.id)}
                              disabled={submittingComment[post.id] || !commentInputs[post.id]?.trim()}
                              className="btn-submit-cmt"
                              title="Gửi phản hồi"
                            >
                              <Send size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
              {/* Khoảng đệm đáy an toàn (Bottom Spacer) để thanh Navigation không che khuất bài viết cuối cùng */}
              <div className="h-24 w-full pointer-events-none" />
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB: CỘNG ĐỒNG & NHÓM THẢO LUẬN */}
          {/* ============================================================== */}
          {activeTab === 'groups' && (
            <SectionErrorBoundary>
              <CommunitySection 
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserAvatar={currentUserAvatar}
                posts={safePosts}
                setPosts={setPosts}
                rooms={safeRooms}
                friends={safeFriends}
                navigate={navigate}
                onSelectUser={(uid) => navigate(`/profile/${uid}`)}
                onStartPrivateCall={handleStartPrivateCall}
                onNavigateFeed={() => setActiveTab('feed')}
              />
            </SectionErrorBoundary>
          )}

          {/* ============================================================== */}
          {/* TAB: TẤT CẢ PHÒNG ĐÀM THOẠI */}
          {/* ============================================================== */}
          {/* TAB 2: DANH SÁCH PHÒNG ĐÀM THOẠI TRỰC TIẾP                    */}
          {/* ============================================================== */}
          {activeTab === 'rooms' && (() => {
            // Phòng đàm thoại của bạn: Chỉ những phòng mà tài khoản hiện tại THỰC SỰ là thành viên / đã tham gia
            const myRooms = safeRooms.filter(r => isUserInRoom(r));
            // Phòng công khai đang mở: Phòng không có mật khẩu, không riêng tư, và bạn chưa tham gia
            const publicRooms = safeRooms.filter(r => !isUserInRoom(r) && !r.hasPassword && !r.isPrivate);

            const renderRoomCard = (room, isJoined) => (
              <div 
                key={room.id} 
                className="p-4 sm:p-5 rounded-2xl bg-[#141414] border border-[#1e1e1e] hover:border-[#2a2a2a] transition-all flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-md"
                onClick={() => onRoomCardClick(room)}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <GroupCollageAvatar 
                      avatar={room.avatar} 
                      name={room.nameroom} 
                      members={room.userRoomDTOList || []}
                      size={46}
                      className="border border-[#222222]"
                    />
                    <div>
                      <h4 className="font-semibold text-zinc-100 text-sm flex items-center gap-1.5 mb-0.5">
                        {room.nameroom}
                        {room.hasPassword && <Lock size={12} className="text-zinc-500" title="Phòng có mật khẩu" />}
                      </h4>
                      <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                        {room.soluong || 0} người đang trò chuyện
                      </span>
                    </div>
                  </div>

                  {isJoined ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#1c1c1c] border border-[#2e2e2e] text-zinc-300 text-[10px] font-mono">
                      Đã tham gia
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-[#1c1c1c] border border-[#2e2e2e] text-zinc-400 text-[10px] font-mono">
                      ✦ Đề xuất
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#1e1e1e]">
                  <div className="flex -space-x-2 overflow-hidden">
                    {room.userRoomDTOList?.slice(0, 4).map((ur, idx) => (
                      <UserAvatar 
                        key={ur.id || idx}
                        avatar={ur.userDTO?.avatar}
                        name={ur.userDTO?.nickname}
                        size={24}
                        className="ring-2 ring-[#141414]"
                      />
                    ))}
                    {(room.soluong || 0) > 4 && (
                      <span className="w-6 h-6 rounded-full bg-[#1e1e1e] border border-white/10 text-[9px] font-mono text-zinc-400 flex items-center justify-center ring-2 ring-[#141414]">
                        +{(room.soluong || 0) - 4}
                      </span>
                    )}
                  </div>

                  <button 
                    type="button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onRoomCardClick(room);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1 ${isJoined ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700' : 'bg-white hover:bg-zinc-200 text-black font-semibold'}`}
                  >
                    <span>{isJoined ? 'Vào lại phòng' : 'Tham gia'}</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            );

            return (
              <div className="rooms-section-wrapper py-2 space-y-6">
                <div className="rooms-header-banner flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 rounded-2xl bg-[#141414] border border-[#1e1e1e] gap-3 sm:gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
                      <h3 className="text-zinc-100 font-bold text-base sm:text-lg tracking-tight">Phòng Trò Chuyện & Đàm Thoại Trực Tiếp</h3>
                    </div>
                    <p className="text-zinc-400 text-xs font-sans">
                      Tham gia các không gian voice call âm thanh đa chiều độ trễ cực thấp
                    </p>
                  </div>
                  <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs shadow-md transition-all active:scale-95 w-full sm:w-auto">
                    <Plus size={14} strokeWidth={2} /> 
                    <span>Tạo phòng mới</span>
                  </button>
                </div>

                {loadingRooms ? (
                  <div className="py-16 text-center text-zinc-500 text-xs font-mono">Đang nạp danh sách phòng đàm thoại...</div>
                ) : safeRooms.length === 0 ? (
                  <div className="py-16 px-4 text-center rounded-2xl bg-[#141414] border border-[#1e1e1e]">
                    <Radio size={32} className="mx-auto mb-3 text-zinc-600 opacity-60" />
                    <p className="text-zinc-400 text-sm font-medium mb-1">Chưa có phòng đàm thoại nào đang mở</p>
                    <p className="text-zinc-500 text-xs mb-4">Hãy tạo một phòng riêng để trò chuyện cùng bạn bè!</p>
                    <button 
                      onClick={() => setIsCreateModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] text-zinc-200 text-xs font-medium border border-[#333333] transition-all"
                    >
                      <Plus size={13} /> Tạo phòng ngay
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* 1. PHÒNG ĐÀM THOẠI CỦA BẠN (ĐÃ THAM GIA) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 tracking-wide font-mono">
                          <Users size={14} className="text-emerald-400" />
                          <span>Phòng đàm thoại của bạn</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono font-semibold">
                            {myRooms.length}
                          </span>
                        </div>
                      </div>

                      {myRooms.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-[#141414]/60 border border-dashed border-[#222222] text-center text-zinc-500 text-xs">
                          Bạn chưa tham gia phòng đàm thoại nào. Hãy bấm "Tạo phòng mới" để tạo nhóm cùng bạn bè, hoặc chọn phòng công khai bên dưới!
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {myRooms.map(room => renderRoomCard(room, true))}
                        </div>
                      )}
                    </div>

                    {/* 2. PHÒNG CÔNG KHAI ĐANG MỞ */}
                    <div className="space-y-3 pt-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 tracking-wide font-mono">
                          <Radio size={14} className="text-zinc-400" />
                          <span>Phòng công khai đang mở</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono font-semibold">
                            {publicRooms.length}
                          </span>
                        </div>
                      </div>

                      {publicRooms.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-[#141414]/60 border border-dashed border-[#222222] text-center text-zinc-500 text-xs">
                          Hiện chưa có phòng công khai nào. Hãy tạo một phòng mở để mọi người cùng vào trò chuyện!
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {publicRooms.map(room => renderRoomCard(room, false))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </main>

        {/* ============================================================== */}
        {/* CỘT 3: RIGHT DOCK (280px - 300px) */}
        {/* ============================================================== */}
        <aside className="widgets-sidebar">
          
          {/* Ô Tìm Kiếm Gọn Gàng (Chỉ tìm khi Enter / Bấm Icon / Mobile Go - Có Dropdown Lịch Sử & Xu Hướng Hot) */}
          <div className="search-section-container relative">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                executeSearch(searchInput);
              }}
              className="search-input-wrap relative flex items-center"
            >
              <button 
                type="submit" 
                className="search-icon-btn p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                title="Bấm để tìm kiếm"
              >
                <Search size={14} strokeWidth={1.5} className={isSearching ? "animate-spin text-sky-400" : "search-icon-muted"} />
              </button>
              <input 
                type="text" 
                placeholder="Tìm kiếm nội dung, chủ đề..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => setIsSearchDropdownOpen(true)}
                enterKeyHint="search"
              />
              {searchInput && (
                <button 
                  type="button" 
                  onClick={clearSearch} 
                  className="btn-clear-kw"
                  title="Xóa tìm kiếm"
                >
                  <X size={12} />
                </button>
              )}
            </form>

            {/* POPUP GỢI Ý: TÌM KIẾM GẦN ĐÂY & XU HƯỚNG TÌM KIẾM HOT */}
            {isSearchDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsSearchDropdownOpen(false)} 
                />
                <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 p-3.5 rounded-2xl bg-[#141414] border border-[#222222] shadow-2xl space-y-3 animate-fade-in">
                  {/* Mục 1: Tìm kiếm gần đây */}
                  {recentSearches.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#1e1e1e]">
                        <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                          <Clock size={12} className="text-zinc-500" /> Tìm kiếm gần đây
                        </span>
                        <button 
                          type="button" 
                          onClick={handleClearAllRecentSearches}
                          className="text-[10px] text-zinc-500 hover:text-rose-400 transition-colors font-mono"
                        >
                          Xóa hết
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recentSearches.map((term, idx) => (
                          <div 
                            key={`recent-${idx}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#1a1a1a] hover:bg-[#222222] text-zinc-300 text-xs border border-[#262626] transition-all cursor-pointer group"
                            onClick={() => executeSearch(term)}
                          >
                            <span className="truncate max-w-[130px]">{term}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveRecentSearch(term);
                              }}
                              className="text-zinc-600 hover:text-rose-400 p-0.5 rounded transition-colors"
                              title="Xóa mục này"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mục 2: Xu hướng tìm kiếm Hot */}
                  <div>
                    <div className="flex items-center gap-1.5 pb-1.5 mb-1.5 border-b border-[#1e1e1e]">
                      <Flame size={12} className="text-amber-400" />
                      <span className="text-[11px] font-semibold text-zinc-400">Xu hướng tìm kiếm (Hot)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {hotSearches.slice(0, 8).map((hotItem, idx) => {
                        const termStr = typeof hotItem === 'string' ? hotItem : (hotItem.term || hotItem.keyword);
                        const countStr = typeof hotItem === 'object' && hotItem.count ? `${hotItem.count}` : null;
                        return (
                          <button
                            key={`hot-${idx}`}
                            type="button"
                            onClick={() => executeSearch(termStr)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#181818] hover:bg-[#222222] text-zinc-200 text-xs border border-[#2a2a2a] hover:border-[#383838] transition-all active:scale-95"
                          >
                            <span className="text-amber-400 text-[10px]">#{idx + 1}</span>
                            <span>{termStr}</span>
                            {countStr && (
                              <span className="text-[9.5px] font-mono text-zinc-500 ml-0.5">({countStr})</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Widget 1: Kết Nối Đồng Điệu 1-1 (Resonance Matchmaker) */}
          <div className="widget-box-card">
            {/* Widget 1: Trạm Dò Sóng FM Thời Gian Thực (FM Frequency Tuner) */}
            <div className="widget-card-title">
              <Radio size={14} className="text-zinc-300" />
              <span>Trạm Dò Sóng FM Thời Gian Thực</span>
            </div>
            <p className="widget-card-desc">
              Dò tìm sóng radio người lạ theo dải tần MHz hoặc tự thu âm 5 giây để phát thanh kết nối đàm thoại 1-1.
            </p>
            <button 
              type="button" 
              onClick={() => setIsSpeedMatchOpen(true)} 
              className="btn-widget-action"
            >
              Dò sóng & Phát thanh
            </button>
          </div>

          {/* Widget 2: Bốc Thăm Câu Hỏi (Party Deck) */}
          <div className="widget-box-card">
            <div className="widget-card-title">
              <Dices size={14} className="text-zinc-300" />
              <span>Thẻ Bài Thử Thách</span>
            </div>
            <p className="widget-card-desc">
              Bốc ngẫu nhiên câu hỏi kích hoạt đối thoại hoặc thử thách vui cùng sảnh.
            </p>
            <button 
              type="button" 
              onClick={() => setIsPartyWheelOpen(true)} 
              className="btn-widget-action secondary"
            >
              Bốc câu hỏi ngẫu nhiên
            </button>
          </div>

          {/* Widget 3: Thẻ Chủ Đề Nổi Bật (Sparks Cloud) */}
          <div className="widget-box-card">
            <div className="widget-card-title">
              <Hash size={14} className="text-zinc-300" />
              <span>Chủ Đề & Dấu Ấn</span>
            </div>
            <div className="widget-sparks-cloud">
              {allCommunitySparks.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`widget-spark-pill font-mono ${activeFilterTag === tag ? 'active' : ''}`}
                  onClick={() => setActiveFilterTag(activeFilterTag === tag ? null : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </aside>

      </div>

      {/* THANH ĐIỀU HƯỚNG DÀNH CHO MOBILE - CÂN ĐỐI 5 CỘT CHUẨN XÁC (+ NẰM CHÍNH GIỮA) */}
      <nav className="mobile-bottom-nav">
        <button 
          type="button"
          className={`b-nav-item ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          <Compass size={18} strokeWidth={1.5} />
          <span>Sảnh</span>
        </button>

        <button 
          type="button"
          className={`b-nav-item ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          <Users size={18} strokeWidth={1.5} />
          <span>Cộng đồng</span>
        </button>

        <div className="b-nav-cell flex items-center justify-center w-full h-full">
          <button 
            type="button"
            className="b-nav-create-center"
            onClick={() => {
              setActiveTab('feed');
              setTimeout(() => newPostInputRef.current?.focus(), 100);
            }}
            title="Đăng bài mới"
          >
            <Plus size={20} />
          </button>
        </div>

        <button 
          type="button"
          className={`b-nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
          onClick={() => setActiveTab('rooms')}
        >
          <Radio size={18} strokeWidth={1.5} />
          <span>Phòng</span>
        </button>

        <button 
          type="button"
          className="b-nav-item"
          onClick={() => navigate('/profile')}
        >
          <User size={18} strokeWidth={1.5} />
          <span>Hồ sơ</span>
        </button>
      </nav>

      {/* ============================================================== */}
      {/* FLOATING MOBILE MUSIC MINI-PLAYER (Hiện diện ghim trên điện thoại) */}
      {/* ============================================================== */}
      {currentTrack && isPlayingRadio && (
        <div 
          className="fixed bottom-[68px] left-3 right-3 sm:hidden z-[75] bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-2.5 flex items-center justify-between shadow-2xl animate-fade-in"
          onClick={() => setShowMobileMusicSheet(true)}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700/80 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
              <Disc size={18} className="text-zinc-300 animate-spin [animation-duration:4s]" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {currentTrack.title || currentTrack.name}
              </p>
              <p className="text-[10px] text-zinc-400 font-mono truncate leading-tight mt-0.5">
                {currentTrack.genreTag || currentTrack.genre || 'Âm nhạc không gian'} • Chạm để mở
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={togglePlayRadio}
              className="w-8 h-8 rounded-full bg-white text-zinc-950 flex items-center justify-center hover:bg-zinc-200 active:scale-95 transition-all shadow"
              title={isPlayingRadio ? "Tạm dừng" : "Phát"}
            >
              {isPlayingRadio ? <Pause size={13} className="fill-zinc-950" /> : <Play size={13} className="fill-zinc-950 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={playNextRadio}
              className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center border border-zinc-700 active:scale-95 transition-all"
              title="Chuyển bài tiếp theo"
            >
              <Shuffle size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MOBILE MUSIC DRAWER / SHEET MODAL (Dark Zinc Chuẩn Mực) */}
      {/* ============================================================== */}
      <AnimatePresence>
        {showMobileMusicSheet && (
          <div 
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
            onClick={() => setShowMobileMusicSheet(false)}
          >
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full sm:w-[440px] bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Thanh gạt trên Mobile */}
              <div className="w-12 h-1 rounded-full bg-zinc-700/80 mx-auto mb-3 sm:hidden" />

              {/* Header Drawer */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <Music size={16} className="text-emerald-400" />
                  <span className="text-sm font-bold text-white tracking-wide">Nhạc Nền Không Gian</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowMobileMusicSheet(false)}
                  className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Nội dung Trình phát trung tâm */}
              <div className="py-5 flex flex-col items-center">
                {/* Đĩa than Vinyl phong cách Audio-First */}
                <div className="relative w-36 h-36 rounded-full bg-zinc-900 border-4 border-zinc-800 flex items-center justify-center shadow-2xl my-2">
                  <div className={`w-32 h-32 rounded-full border border-zinc-700/60 flex items-center justify-center ${isPlayingRadio ? 'animate-spin [animation-duration:8s]' : ''}`}>
                    <div className="w-20 h-20 rounded-full border border-zinc-700/40 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-emerald-500/40 flex items-center justify-center">
                        <Disc size={20} className={isPlayingRadio ? "text-emerald-400" : "text-zinc-500"} />
                      </div>
                    </div>
                  </div>
                  {isPlayingRadio && (
                    <span className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-emerald-400 border-2 border-zinc-900 animate-pulse"></span>
                  )}
                </div>

                {/* Thông tin bản nhạc đang phát */}
                <h3 className="text-base font-bold text-white text-center px-4 mt-3 truncate max-w-full">
                  {currentTrack ? (currentTrack.title || currentTrack.name) : "Chưa chọn bản nhạc"}
                </h3>
                <p className="text-xs font-mono text-zinc-400 text-center mt-1">
                  {currentTrack ? (currentTrack.genreTag || currentTrack.genre || "Bản nhạc thư giãn") : "Hệ thống Talovin"}
                </p>

                {/* Equalizer Visualizer */}
                <div className="flex items-center gap-1.5 h-6 mt-4">
                  {[40, 75, 55, 90, 65, 80, 45, 95, 70, 85, 50, 100, 60, 80].map((h, i) => (
                    <span
                      key={i}
                      className={`w-1 rounded-full transition-all duration-200 ${
                        isPlayingRadio ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-800'
                      }`}
                      style={{
                        height: isPlayingRadio ? `${Math.max(25, (h * ((i % 3) + 1)) % 100)}%` : '20%',
                        animationDelay: `${i * 70}ms`
                      }}
                    />
                  ))}
                </div>

                {/* Cụm nút điều khiển phát nhạc */}
                <div className="flex items-center justify-center gap-5 mt-6">
                  <button
                    type="button"
                    onClick={playPrevRadio}
                    disabled={!tracks || tracks.length === 0}
                    className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
                    title="Bản nhạc trước"
                  >
                    <SkipBack size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={togglePlayRadio}
                    disabled={!tracks || tracks.length === 0}
                    className="w-14 h-14 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 flex items-center justify-center shadow-xl transition-all disabled:opacity-40"
                    title={isPlayingRadio ? "Tạm dừng" : "Phát nhạc"}
                  >
                    {isPlayingRadio ? <Pause size={22} className="fill-zinc-950" /> : <Play size={22} className="fill-zinc-950 ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={playNextRadio}
                    disabled={!tracks || tracks.length === 0}
                    className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
                    title="Bản nhạc kế tiếp"
                  >
                    <SkipForward size={18} />
                  </button>
                </div>
              </div>

              {/* Danh sách các bản nhạc (Playlist Selector) */}
              <div className="flex-1 min-h-0 flex flex-col pt-3 border-t border-zinc-800/80">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-zinc-400">Danh sách ({tracks?.length || 0})</span>
                  <span className="text-[11px] font-mono text-zinc-500">Chạm để đổi bài</span>
                </div>
                <div className="overflow-y-auto space-y-1 max-h-40 custom-dark-scrollbar pr-1">
                  {tracks && tracks.length > 0 ? (
                    tracks.map((tr, idx) => {
                      const isCurrent = idx === currentTrackIndex;
                      return (
                        <div
                          key={tr.id || idx}
                          onClick={() => handleSelectRadioTrack(idx)}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                            isCurrent 
                              ? 'bg-zinc-900 border border-emerald-500/40 text-white' 
                              : 'hover:bg-zinc-900/60 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {isCurrent && isPlayingRadio ? (
                              <span className="flex items-center gap-0.5 h-3 flex-shrink-0">
                                <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce"></span>
                                <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                                <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-mono text-zinc-500 w-4 text-center shrink-0">
                                {idx + 1}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-medium truncate ${isCurrent ? 'text-emerald-400 font-semibold' : 'text-zinc-200'}`}>
                                {tr.title || tr.name}
                              </p>
                              <p className="text-[10px] text-zinc-500 font-mono truncate">
                                {tr.genreTag || tr.genre || "Bản nhạc"}
                              </p>
                            </div>
                          </div>
                          {isCurrent && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {isPlayingRadio ? 'Đang phát' : 'Đã chọn'}
                            </span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-zinc-500 text-center py-4">Chưa có bản nhạc nào trong hệ thống</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL LIGHTBOX XEM ĐA PHƯƠNG TIỆN TOÀN MÀN HÌNH (ẢNH & VIDEO) */}
      {lightboxMedia && (
        <div 
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-6 animate-fade-in select-none"
          onClick={() => setLightboxMedia(null)}
        >
          {/* Top Bar: Title/Author and Actions */}
          <div 
            className="w-full max-w-5xl flex items-center justify-between px-3 py-2 sm:py-3 text-white mb-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 truncate">
              <span className="font-semibold text-sm tracking-tight text-zinc-100 truncate">
                {lightboxMedia.author ? `Khoảnh khắc của ${lightboxMedia.author}` : "Xem đa phương tiện"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                {lightboxMedia.type === 'video' ? 'Video' : 'Hình ảnh'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a 
                href={lightboxMedia.url} 
                download={lightboxMedia.type === 'video' ? 'video-talovin.mp4' : 'image-talovin.webp'}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all border border-zinc-700/60"
                title="Tải về máy / Mở tab mới"
              >
                <Download size={16} />
              </a>
              <button 
                type="button"
                onClick={() => setLightboxMedia(null)}
                className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all border border-zinc-700/60"
                title="Đóng (Esc)"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Media Center Content */}
          <div 
            className="relative flex items-center justify-center max-w-5xl max-h-[82vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxMedia.type === 'video' ? (
              <video 
                src={lightboxMedia.url} 
                controls 
                autoPlay 
                playsInline 
                className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain bg-black border border-zinc-800"
              />
            ) : (
              <img 
                src={lightboxMedia.url} 
                alt="Xem ảnh lớn" 
                className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain bg-black/40 border border-zinc-800" 
              />
            )}
          </div>

          {/* Caption if exists */}
          {lightboxMedia.title && (
            <div 
              className="mt-3 max-w-2xl px-4 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-zinc-300 text-xs text-center truncate backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {lightboxMedia.title}
            </div>
          )}
        </div>
      )}

      {/* MODAL BỘ GHÉP ĐÔI ĐỒNG ĐIỆU (RESONANCE MATCHMAKER 1-1) */}
      <ResonanceMatchModal 
        isOpen={isSpeedMatchOpen}
        onClose={() => setIsSpeedMatchOpen(false)}
        currentUserId={currentUserId}
        currentUserAccount={currentUserAccount}
        currentUserName={currentUserName}
        currentTrack={currentTrack}
        posts={safePosts}
        rooms={safeRooms}
        friends={safeFriends}
        navigate={navigate}
      />

      {/* MODAL THẺ BÀI THỬ THÁCH (DATA THẬT, NHIỀU THỂ LOẠI, KHÔNG MOCK) */}
      <ChallengeDeckModal
        isOpen={isPartyWheelOpen}
        onClose={() => setIsPartyWheelOpen(false)}
        onShareToFeed={(challenge) => {
          setNewPostContent(`[Thử thách]: "${challenge.question}"\n\nBạn nghĩ sao về câu hỏi này? Cùng chia sẻ góc nhìn nhé!`);
          if (!selectedTags.includes('✦ Thử thách')) {
            setSelectedTags(prev => [...prev, '✦ Thử thách']);
          }
          setActiveTab('feed');
          setTimeout(() => newPostInputRef.current?.focus(), 150);
          toast.success("Đã đưa câu hỏi vào khung đăng bài!", { id: 'challenge-share' });
        }}
      />

      {/* MODAL CHIA SẺ BÀI VIẾT VÀO PHÒNG CHAT HOẶC SAO CHÉP LIÊN KẾT */}
      {sharePost && (
        <div className="modal-veil" onClick={() => setSharePost(null)}>
          <div className="modal-dialog-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title-flex">
                <Share2 size={16} color="#818cf8" />
                <h4>Chia Sẻ Bài Viết</h4>
              </div>
              <button onClick={() => setSharePost(null)} className="btn-close-dialog"><X size={15} /></button>
            </div>
            
            <div style={{ padding: '16px' }} className="space-y-4">
              {/* Nút Sao chép liên kết */}
              <button
                type="button"
                onClick={() => handleCopyPostLink(sharePost)}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-100 flex items-center justify-between text-xs font-semibold transition-all border border-zinc-700/60"
              >
                <div className="flex items-center gap-2">
                  <Copy size={15} className="text-zinc-400" />
                  <span>Sao chép liên kết bài viết</span>
                </div>
                <ArrowRight size={13} className="text-zinc-500" />
              </button>

              {/* Danh sách phòng đàm thoại để chia sẻ trực tiếp */}
              <div className="pt-2 border-t border-zinc-800">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                  Gửi vào phòng đàm thoại:
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 no-scrollbar">
                  {safeRooms.length === 0 ? (
                    <p className="text-zinc-500 text-xs italic py-2">Chưa có phòng đàm thoại nào đang mở.</p>
                  ) : (
                    safeRooms.map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => handleSharePostToRoom(sharePost, room)}
                        className="w-full py-2 px-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 flex items-center justify-between text-xs transition-all border border-zinc-800"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MessageCircle size={14} className="text-emerald-400 flex-shrink-0" />
                          <span className="truncate font-medium">{room.nameroom || `Phòng #${room.id}`}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono flex-shrink-0 px-2 py-0.5 rounded bg-zinc-800">Gửi</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TẠO PHÒNG */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" onClick={() => setIsCreateModalOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-5 sm:p-6 shadow-2xl flex flex-col space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Radio size={18} className="text-zinc-300" />
                  <h4 className="text-zinc-100 font-bold text-sm tracking-tight">Tạo Không Gian Đàm Thoại</h4>
                </div>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-zinc-300 text-xs font-semibold">Tên phòng *</label>
                    <span className="text-[10px] text-zinc-500 font-mono">{newRoomData.name.length}/60</span>
                  </div>
                  <input 
                    type="text" 
                    placeholder="VD: Không gian trò chuyện cuối tuần"
                    value={newRoomData.name}
                    onChange={(e) => setNewRoomData({ ...newRoomData, name: e.target.value })}
                    maxLength={60}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 placeholder-zinc-500 transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-zinc-300 text-xs font-semibold">Mật khẩu phòng (Tùy chọn)</label>
                    <span className="text-[10px] text-zinc-500 font-mono">Tối đa 30 ký tự</span>
                  </div>
                  <input 
                    type="password" 
                    placeholder="Để trống nếu là phòng công khai"
                    value={newRoomData.password}
                    onChange={(e) => setNewRoomData({ ...newRoomData, password: e.target.value })}
                    maxLength={30}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 placeholder-zinc-500 transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="h-10 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all">
                    Hủy
                  </button>
                  <button type="submit" className="h-10 px-5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs shadow-sm transition-all active:scale-95">
                    Tạo phòng
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL THAM GIA PHÒNG CÓ MẬT KHẨU */}
      {selectedRoom && (
        <div className="modal-veil" onClick={() => setSelectedRoom(null)}>
          <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title-flex">
                <Lock size={16} color="#a1a1aa" />
                <h4>Phòng #{selectedRoom.nameroom}</h4>
              </div>
              <button onClick={() => setSelectedRoom(null)} className="btn-close-dialog"><X size={15} /></button>
            </div>
            <form onSubmit={handleJoinRoom} className="dialog-form">
              {selectedRoom.hasPassword ? (
                <div className="dialog-field">
                  <label>Mật khẩu phòng</label>
                  <input 
                    type="password" 
                    placeholder="Nhập mật khẩu phòng..."
                    value={joinData.password}
                    onChange={(e) => setJoinData({ ...joinData, password: e.target.value })}
                    autoFocus
                    required
                  />
                </div>
              ) : (
                <p className="text-xs text-zinc-400">Bạn sắp tham gia vào không gian đàm thoại trực tiếp này.</p>
              )}
              <div className="dialog-actions-row">
                <button type="button" onClick={() => setSelectedRoom(null)} className="btn-dialog-back">Hủy</button>
                <button type="submit" className="btn-dialog-primary">Vào phòng</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHỈNH SỬA BÀI VIẾT */}
      {editingPost && (
        <div className="modal-veil" onClick={() => setEditingPost(null)}>
          <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title-flex">
                <Edit3 size={16} color="#a1a1aa" />
                <h4>Chỉnh Sửa Bài Viết</h4>
              </div>
              <button onClick={() => setEditingPost(null)} className="btn-close-dialog"><X size={15} /></button>
            </div>
            <form onSubmit={handleSaveEditPost} className="dialog-form">
              <div className="dialog-field">
                <label>Nội dung</label>
                <textarea 
                  rows="4"
                  value={editPostContent}
                  onChange={(e) => setEditPostContent(e.target.value)}
                  style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', borderRadius: '6px', padding: '8px', color: '#f4f4f5', resize: 'none', outline: 'none' }}
                  required
                />
              </div>
              <div className="dialog-actions-row">
                <button type="button" onClick={() => setEditingPost(null)} className="btn-dialog-back">Hủy</button>
                <button type="submit" disabled={isSavingEditPost} className="btn-dialog-primary">
                  {isSavingEditPost ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HỒ SƠ */}
      {selectedProfileUserId && (
        <UserProfileModal 
          userId={selectedProfileUserId}
          onClose={() => setSelectedProfileUserId(null)}
          currentUserId={currentUserId}
        />
      )}

      {/* MODAL BẠN BÈ */}
      {isFriendsOpen && (
        <FriendsModal 
          isOpen={isFriendsOpen}
          onClose={() => setIsFriendsOpen(false)}
          currentUserId={currentUserId}
          onSelectUser={(uid) => {
            setIsFriendsOpen(false);
            navigate(`/profile/${uid}`);
          }}
          navigate={navigate}
        />
      )}

      {/* MODAL XÁC NHẬN TÙY BIẾN (THAY THẾ HOÀN TOÀN WINDOW.CONFIRM & WINDOW.ALERT) */}
      {confirmDialog.isOpen && (
        <div className="custom-confirm-backdrop" onClick={closeConfirmDialog}>
          <div className="custom-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon-row">
              <div className="confirm-icon-badge">
                <Trash2 size={18} className="text-rose-400" />
              </div>
              <h3 className="confirm-title">{confirmDialog.title}</h3>
            </div>
            <p className="confirm-message">{confirmDialog.message}</p>
            <div className="confirm-actions-row">
              <button 
                type="button" 
                onClick={closeConfirmDialog}
                className="btn-confirm-cancel"
              >
                Hủy
              </button>
              <button 
                type="button" 
                onClick={() => confirmDialog.onConfirm && confirmDialog.onConfirm()}
                className={`btn-confirm-submit ${confirmDialog.isDanger ? 'danger' : ''}`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CUỘC GỌI ĐẾN THỜI GIAN THỰC (INCOMING CALL POPUP) */}
      {globalIncomingCall && (
        <IncomingCallModal 
          call={globalIncomingCall}
          onAccept={(call) => {
            const rId = call.roomId;
            setGlobalIncomingCall(null);
            navigate(`/room/${rId}?autoCall=true`);
          }}
          onDecline={() => setGlobalIncomingCall(null)}
        />
      )}

      {/* THANH THÔNG BÁO NỔI HỆ THỐNG THỜI GIAN THỰC (REALTIME FLOATING PILL) */}
      {floatingNotif && (
        <div 
          className="fixed top-14 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[92vw] sm:w-[420px] bg-zinc-900/98 border border-zinc-700/80 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl flex items-start gap-3 animate-fade-in"
          style={{ boxShadow: '0 20px 40px -8px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08)' }}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
            floatingNotif.type === 'POST_TAKEDOWN' 
              ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
              : floatingNotif.type === 'FRIEND'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400'
          }`}>
            {floatingNotif.type === 'POST_TAKEDOWN' ? (
              <AlertTriangle size={16} />
            ) : floatingNotif.type === 'FRIEND' ? (
              <UserCheck size={16} />
            ) : (
              <Bell size={16} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-zinc-100 flex items-center justify-between">
              <span>{floatingNotif.title}</span>
              <span className="text-[10px] text-zinc-500 font-mono">{floatingNotif.time}</span>
            </div>
            <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed break-words font-sans">
              {floatingNotif.text}
            </p>
          </div>
          <button 
            type="button" 
            onClick={() => setFloatingNotif(null)} 
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* MODAL BÁO CÁO BÀI VIẾT VI PHẠM (REPORT POST MODAL - DYNAMIC REASONS) */}
      {reportingPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setReportingPostId(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Flag size={14} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Báo Cáo Bài Viết</h3>
                  <p className="text-[11px] text-zinc-400">Chọn lý do vi phạm để gửi tới ban quản trị kiểm duyệt</p>
                </div>
              </div>
              <button onClick={() => setReportingPostId(null)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-300 font-medium mb-2 block">
                  Lý do gắn cờ vi phạm:
                </label>
                <div className="space-y-2">
                  {reportReasons.map((r) => (
                    <label 
                      key={r.id} 
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        selectedReportReason === r.id 
                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' 
                          : 'bg-zinc-950/70 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="reportReason" 
                        value={r.id}
                        checked={selectedReportReason === r.id}
                        onChange={() => setSelectedReportReason(r.id)}
                        className="text-rose-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-medium">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-300 font-medium mb-1 block">
                  Mô tả chi tiết vi phạm (Không bắt buộc):
                </label>
                <textarea 
                  rows={3}
                  value={customReportDetails}
                  onChange={(e) => setCustomReportDetails(e.target.value)}
                  placeholder="Nhập thêm bằng chứng, thời điểm hoặc ngữ cảnh vi phạm..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 resize-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button 
                  type="button" 
                  onClick={() => setReportingPostId(null)} 
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingReport} 
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Flag size={13} />
                  <span>{isSubmittingReport ? 'Đang gửi...' : 'Gửi báo cáo vi phạm'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SLIDE-OVER NOTIFICATION DRAWER (Trượt mượt mà 60/120fps chuẩn Native App) */}
      {/* ============================================================== */}
      <AnimatePresence>
        {isNotifOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[120] flex justify-end bg-black/70 sm:backdrop-blur-sm"
            onClick={() => setIsNotifOpen(false)}
          >
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.x > 70 || velocity.x > 250) {
                  setIsNotifOpen(false);
                }
              }}
              className="w-full sm:w-[420px] max-w-full h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col will-change-transform transform-gpu touch-pan-y"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header Drawer */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200">
                  <Bell size={16} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white tracking-tight">Thông báo sảnh</span>
                    {notifications.filter(n => n.unread).length > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-200 border border-zinc-700">
                        {notifications.filter(n => n.unread).length} mới
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 m-0">Tương tác và cập nhật theo thời gian thực</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setNotifications(prev => prev.map(n => ({ ...n, unread: false })))} 
                    className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg hover:bg-zinc-800/50 transition-colors"
                  >
                    Đã đọc hết
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setIsNotifOpen(false)} 
                  className="w-8 h-8 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body: Danh sách thông báo (Mới nhất ở trên xuống dưới) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-dark-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-24 text-center px-4 text-zinc-400">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-500">
                    <Bell size={22} className="opacity-60" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-200">Chưa có thông báo nào</p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    Các lượt thả cảm xúc, phản hồi bài viết và kết nối âm thanh sẽ hiển thị ở đây.
                  </p>
                </div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id}
                    onClick={() => {
                      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, unread: false } : item));
                      setIsNotifOpen(false);
                      if (n.postId) {
                        const targetPost = safePosts.find(p => p.id === n.postId);
                        if (targetPost) {
                          setSelectedThreadPost(targetPost);
                          fetchComments(targetPost.id);
                        } else {
                          const el = document.getElementById(`post-${n.postId}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      n.unread 
                        ? 'bg-zinc-900/90 border-zinc-700/80 shadow-md hover:border-zinc-500' 
                        : 'bg-zinc-950/60 border-zinc-800/60 hover:bg-zinc-900/40 text-zinc-300'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm">
                        {n.icon || (n.text?.includes('thích') || n.text?.includes('tim') ? '❤️' : n.text?.includes('bình luận') ? '💬' : '🔔')}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-100 leading-relaxed font-sans m-0">
                        {n.text}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {n.time || 'Vừa xong'}
                        </span>
                        {n.unread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Drawer */}
            <div className="p-3 border-t border-zinc-800/80 bg-[#09090b] flex items-center justify-between text-xs text-zinc-400 flex-shrink-0">
              <span className="font-mono text-[11px]">Talovin Notification Drawer</span>
              <button 
                type="button"
                onClick={() => setNotifications([])}
                className="text-zinc-400 hover:text-rose-400 transition-colors text-xs"
              >
                Xóa toàn bộ
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* ============================================================== */}
      {/* MODAL CHI TIẾT BÀI VIẾT & DÒNG THẢO LUẬN (TALOVIN DUAL-VIEW) */}
      {/* ============================================================== */}
      {selectedThreadPost && (
        <div 
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-5 bg-black/80 backdrop-blur-md modal-backdrop-smooth"
          onClick={() => setSelectedThreadPost(null)}
        >
          {/* Khung Modal Container: Trên mobile là full màn hình cố định, trên PC là Dual-View 2 cột */}
          <div 
            className="relative w-full sm:w-[940px] lg:w-[1040px] h-[100dvh] sm:h-[82vh] sm:max-h-[740px] sm:min-h-[580px] bg-[#0c0d12] border-0 sm:border border-zinc-800 sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl modal-card-smooth"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal View chung */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800/80 bg-[#12131a] flex-shrink-0">
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setSelectedThreadPost(null)}
                  className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all active:scale-95 flex items-center gap-2 text-xs font-semibold"
                  title="Quay lại sảnh"
                >
                  <ArrowLeft size={18} />
                  <span>Chi tiết bài viết</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setSelectedThreadPost(null)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ============================================================== */}
            {/* GIAO DIỆN TRÊN MOBILE: 1 KHUNG CUỘN DUY NHẤT (Không bị bóp chiều cao khi gõ phím) */}
            {/* ============================================================== */}
            <div className="sm:hidden flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0c0d12]">
              {/* Vùng cuộn liền mạch từ bài viết xuống bình luận */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 custom-dark-scrollbar">
                {/* Tác giả bài viết */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="cursor-pointer flex-shrink-0"
                      onClick={() => navigate(`/profile/${selectedThreadPost.authorId || selectedThreadPost.userId}`)}
                    >
                      <UserAvatar 
                        avatar={selectedThreadPost.authorAvatar} 
                        name={selectedThreadPost.authorNickname || selectedThreadPost.authorAccount} 
                        size={40} 
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="font-bold text-sm text-[#f1f5f9] hover:underline cursor-pointer"
                          onClick={() => navigate(`/profile/${selectedThreadPost.authorId || selectedThreadPost.userId}`)}
                        >
                          {selectedThreadPost.authorNickname || selectedThreadPost.authorAccount || 'Thành viên'}
                        </span>
                        {selectedThreadPost.authorBadge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {selectedThreadPost.authorBadge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                        <span>@{selectedThreadPost.authorAccount || 'user'}</span>
                        <span>•</span>
                        <span>{selectedThreadPost.formattedTime || TIME_FORMATTER(selectedThreadPost.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {selectedThreadPost.vibe && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700">
                      {selectedThreadPost.vibe}
                    </span>
                  )}
                </div>

                {/* Nội dung bài viết */}
                {selectedThreadPost.content && (selectedThreadPost.content.trim() !== 'Ghi âm giọng nói' || !parsePostMedia(selectedThreadPost.imageUrl, selectedThreadPost).audioUrl) && (
                  <p className="text-[15px] text-[#f1f5f9] leading-relaxed whitespace-pre-wrap font-sans">
                    {selectedThreadPost.content}
                  </p>
                )}

                {/* Media bài viết (Ảnh / Video / Voice Note) */}
                {(() => {
                  const media = parsePostMedia(selectedThreadPost.imageUrl, selectedThreadPost);
                  if (!media.mediaUrl && !media.audioUrl) return null;
                  return (
                    <div className="space-y-3 my-2">
                      {media.mediaUrl && (
                        <div className="rounded-xl overflow-hidden border border-zinc-800">
                          {media.mediaType === 'video' ? (
                            <video src={media.mediaUrl} controls autoPlay loop muted playsInline className="w-full max-h-[340px] object-cover" />
                          ) : (
                            <img src={media.mediaUrl} alt="Media" className="w-full max-h-[340px] object-cover" />
                          )}
                        </div>
                      )}

                      {/* Tín hiệu giọng nói (Voice Note Player) */}
                      {media.audioUrl && (
                        <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-lg flex items-center gap-3.5 group hover:border-zinc-700 transition-all">
                          <button
                            type="button"
                            onClick={() => handleTogglePlayPostVoice(selectedThreadPost.id, media.audioUrl)}
                            className="w-11 h-11 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md transition-all"
                            title={playingVoicePostId === selectedThreadPost.id ? "Tạm dừng" : "Nghe ghi âm"}
                          >
                            {playingVoicePostId === selectedThreadPost.id ? (
                              <Pause size={18} className="fill-zinc-950" />
                            ) : (
                              <Play size={18} className="fill-zinc-950 ml-0.5" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <Mic size={13} className="text-emerald-400" />
                                <span className="text-xs font-semibold text-zinc-200">
                                  {playingVoicePostId === selectedThreadPost.id ? "Đang phát giọng nói..." : "Tín hiệu giọng nói"}
                                </span>
                              </div>
                              <span className="text-xs font-mono tabular-nums text-zinc-400">
                                {media.audioDuration ? `00:${media.audioDuration < 10 ? `0${media.audioDuration}` : media.audioDuration}` : '00:15'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 h-5 overflow-hidden">
                              {[35, 70, 50, 90, 60, 85, 45, 100, 75, 80, 55, 95, 65, 80, 40, 70, 50, 65].map((h, idx) => (
                                <span
                                  key={idx}
                                  className={`w-1 rounded-full transition-all duration-200 ${
                                    playingVoicePostId === selectedThreadPost.id
                                      ? 'bg-emerald-400 animate-pulse'
                                      : 'bg-zinc-700'
                                  }`}
                                  style={{
                                    height: playingVoicePostId === selectedThreadPost.id ? `${Math.max(25, (h * ((idx % 3) + 1)) % 100)}%` : `${h * 0.4}%`,
                                    animationDelay: `${idx * 50}ms`
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Hàng chỉ số tương tác */}
                <div className="flex items-center gap-4 py-2.5 text-xs text-zinc-400 border-y border-zinc-800/80">
                  <span><strong className="text-white">{selectedThreadPost.likesCount || 0}</strong> lượt thích</span>
                  <span>•</span>
                  <span><strong className="text-white">{selectedThreadPost.commentsCount || (commentsMap[selectedThreadPost.id]?.length || 0)}</strong> phản hồi</span>
                </div>

                {/* Nút hành động nhanh trên mobile (KHÔNG CÓ NÚT ĐĂNG LẠI) */}
                <div className="flex items-center justify-around py-1 border-b border-zinc-800/80 text-zinc-400 relative">
                  <button 
                    type="button"
                    onClick={() => handleReactPost(selectedThreadPost.id, selectedThreadPost.myReaction || 'HEART')}
                    className={`flex items-center gap-1.5 p-2 rounded-lg transition-all active:scale-95 ${
                      selectedThreadPost.isLikedByMe || selectedThreadPost.myReaction ? 'text-rose-500 font-semibold' : 'hover:text-white'
                    }`}
                  >
                    <Heart 
                      size={18} 
                      className={selectedThreadPost.isLikedByMe || selectedThreadPost.myReaction ? 'fill-rose-500 text-rose-500' : ''} 
                    />
                    <span className="text-xs">
                      {selectedThreadPost.myReaction && REACTION_EMOJIS.find(r => r.type === selectedThreadPost.myReaction)
                        ? REACTION_EMOJIS.find(r => r.type === selectedThreadPost.myReaction).label
                        : 'Thích'}
                    </span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('thread-mobile-reply-input');
                      if (input) input.focus();
                    }}
                    className="flex items-center gap-1.5 p-2 rounded-lg hover:text-white transition-colors active:scale-95"
                  >
                    <MessageSquare size={18} />
                    <span className="text-xs">Phản hồi</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setSharePost(selectedThreadPost)}
                    className="flex items-center gap-1.5 p-2 rounded-lg hover:text-white transition-colors active:scale-95"
                  >
                    <Share2 size={18} />
                    <span className="text-xs">Chia sẻ</span>
                  </button>
                </div>

                {/* Tiêu đề Dòng thảo luận trên mobile */}
                <div className="pt-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={14} className="text-zinc-400" />
                    <span>Dòng thảo luận ({selectedThreadPost.commentsCount || (commentsMap[selectedThreadPost.id]?.length || 0)})</span>
                  </h4>
                  <span className="text-[11px] text-zinc-500 font-mono">Phản hồi phân cấp</span>
                </div>

                {/* Danh sách bình luận dạng cây */}
                <div className="space-y-3 pt-1">
                  {renderCommentThreadsTree(selectedThreadPost.id)}
                </div>
              </div>

              {/* Ô nhập bình luận cố định ở đáy mobile view */}
              <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#12131a] border-t border-zinc-800 flex items-center gap-2.5 flex-shrink-0">
                <UserAvatar avatar={currentUserAvatar} name={currentUserName} size={32} />
                <div className="flex-1 min-w-0">
                  {replyTargetMap[selectedThreadPost.id] && (
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-1 mb-1 border-b border-zinc-800">
                      <span>Đang trả lời <strong>@{replyTargetMap[selectedThreadPost.id].authorAccount}</strong></span>
                      <button 
                        type="button" 
                        onClick={() => setReplyTargetMap(prev => ({ ...prev, [selectedThreadPost.id]: null }))}
                        className="text-zinc-400 hover:text-white"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <input 
                    id="thread-mobile-reply-input"
                    type="text"
                    value={commentInputs[selectedThreadPost.id] || ''}
                    onChange={(e) => setCommentInputs(prev => ({ ...prev, [selectedThreadPost.id]: e.target.value }))}
                    placeholder={`Trả lời @${selectedThreadPost.authorAccount || 'user'}...`}
                    className="w-full bg-transparent border-none text-xs text-white focus:outline-none placeholder-zinc-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddComment(selectedThreadPost.id);
                    }}
                  />
                </div>
                <button 
                  type="button"
                  onClick={() => handleAddComment(selectedThreadPost.id)}
                  disabled={submittingComment[selectedThreadPost.id] || !commentInputs[selectedThreadPost.id]?.trim()}
                  className="px-4 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-all disabled:opacity-40 disabled:hover:bg-white active:scale-95 flex-shrink-0"
                >
                  {submittingComment[selectedThreadPost.id] ? 'Gửi...' : 'Đăng'}
                </button>
              </div>
            </div>

            {/* ============================================================== */}
            {/* GIAO DIỆN TRÊN DESKTOP: DUAL-VIEW 2 CỘT SONG SONG CỐ ĐỊNH */}
            {/* ============================================================== */}
            <div className="hidden sm:flex flex-1 flex-row overflow-hidden min-h-0 bg-[#0c0d12]">
              {/* CỘT TRÁI: BÀI VIẾT CHÍNH (46%) */}
              <div className="w-[46%] flex flex-col border-r border-zinc-800/80 bg-[#101118] p-5 overflow-y-auto custom-dark-scrollbar space-y-4">
                {/* Header tác giả */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="cursor-pointer flex-shrink-0"
                      onClick={() => navigate(`/profile/${selectedThreadPost.authorId || selectedThreadPost.userId}`)}
                    >
                      <UserAvatar 
                        avatar={selectedThreadPost.authorAvatar} 
                        name={selectedThreadPost.authorNickname || selectedThreadPost.authorAccount} 
                        size={42} 
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="font-bold text-sm text-[#f1f5f9] hover:underline cursor-pointer"
                          onClick={() => navigate(`/profile/${selectedThreadPost.authorId || selectedThreadPost.userId}`)}
                        >
                          {selectedThreadPost.authorNickname || selectedThreadPost.authorAccount || 'Thành viên'}
                        </span>
                        {selectedThreadPost.authorBadge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {selectedThreadPost.authorBadge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                        <span>@{selectedThreadPost.authorAccount || 'user'}</span>
                        <span>•</span>
                        <span>{selectedThreadPost.formattedTime || TIME_FORMATTER(selectedThreadPost.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {selectedThreadPost.vibe && (
                    <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {selectedThreadPost.vibe}
                    </span>
                  )}
                </div>

                {/* Nội dung bài viết chính */}
                {selectedThreadPost.content && (selectedThreadPost.content.trim() !== 'Ghi âm giọng nói' || !parsePostMedia(selectedThreadPost.imageUrl, selectedThreadPost).audioUrl) && (
                  <p className="text-[15px] text-[#f1f5f9] leading-relaxed whitespace-pre-wrap font-sans">
                    {selectedThreadPost.content}
                  </p>
                )}

                {/* Media bài viết (Ảnh / Video / Voice Note) */}
                {(() => {
                  const media = parsePostMedia(selectedThreadPost.imageUrl, selectedThreadPost);
                  if (!media.mediaUrl && !media.audioUrl) return null;
                  return (
                    <div className="space-y-3 my-2">
                      {media.mediaUrl && (
                        <div className="rounded-2xl overflow-hidden border border-zinc-800">
                          {media.mediaType === 'video' ? (
                            <video src={media.mediaUrl} controls autoPlay loop muted playsInline className="w-full max-h-[380px] object-cover" />
                          ) : (
                            <img src={media.mediaUrl} alt="Media" className="w-full max-h-[380px] object-cover" />
                          )}
                        </div>
                      )}

                      {/* Tín hiệu giọng nói (Voice Note Player) */}
                      {media.audioUrl && (
                        <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-lg flex items-center gap-3.5 group hover:border-zinc-700 transition-all">
                          <button
                            type="button"
                            onClick={() => handleTogglePlayPostVoice(selectedThreadPost.id, media.audioUrl)}
                            className="w-11 h-11 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md transition-all"
                            title={playingVoicePostId === selectedThreadPost.id ? "Tạm dừng" : "Nghe ghi âm"}
                          >
                            {playingVoicePostId === selectedThreadPost.id ? (
                              <Pause size={18} className="fill-zinc-950" />
                            ) : (
                              <Play size={18} className="fill-zinc-950 ml-0.5" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <Mic size={13} className="text-emerald-400" />
                                <span className="text-xs font-semibold text-zinc-200">
                                  {playingVoicePostId === selectedThreadPost.id ? "Đang phát giọng nói..." : "Tín hiệu giọng nói"}
                                </span>
                              </div>
                              <span className="text-xs font-mono tabular-nums text-zinc-400">
                                {media.audioDuration ? `00:${media.audioDuration < 10 ? `0${media.audioDuration}` : media.audioDuration}` : '00:15'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 h-5 overflow-hidden">
                              {[35, 70, 50, 90, 60, 85, 45, 100, 75, 80, 55, 95, 65, 80, 40, 70, 50, 65].map((h, idx) => (
                                <span
                                  key={idx}
                                  className={`w-1 rounded-full transition-all duration-200 ${
                                    playingVoicePostId === selectedThreadPost.id
                                      ? 'bg-emerald-400 animate-pulse'
                                      : 'bg-zinc-700'
                                  }`}
                                  style={{
                                    height: playingVoicePostId === selectedThreadPost.id ? `${Math.max(25, (h * ((idx % 3) + 1)) % 100)}%` : `${h * 0.4}%`,
                                    animationDelay: `${idx * 50}ms`
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Hàng chỉ số tương tác */}
                <div className="flex items-center gap-4 py-2.5 text-xs text-zinc-400 border-y border-zinc-800/80">
                  <span><strong className="text-white">{selectedThreadPost.likesCount || 0}</strong> lượt thích</span>
                  <span>•</span>
                  <span><strong className="text-white">{selectedThreadPost.commentsCount || (commentsMap[selectedThreadPost.id]?.length || 0)}</strong> phản hồi</span>
                </div>

                {/* Hàng nút hành động nhanh với Reaction Popover đầy đủ emoji (KHÔNG CÓ NÚT ĐĂNG LẠI) */}
                <div className="flex items-center justify-around py-1 border-b border-zinc-800/80 text-zinc-400 relative">
                  {/* Cụm Thả Cảm Xúc / Emoji Popover */}
                  <div 
                    className="relative group reaction-drop-wrapper"
                    onMouseEnter={() => {
                      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
                      setActiveReactionPicker(`modal_${selectedThreadPost.id}`);
                    }}
                    onMouseLeave={() => {
                      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
                      reactionTimeoutRef.current = setTimeout(() => {
                        setActiveReactionPicker(null);
                      }, 180);
                    }}
                  >
                    <button 
                      type="button"
                      onClick={() => handleReactPost(selectedThreadPost.id, selectedThreadPost.myReaction || 'HEART')}
                      className={`flex items-center gap-1.5 p-2 rounded-xl hover:text-white transition-all active:scale-95 ${
                        selectedThreadPost.isLikedByMe || selectedThreadPost.myReaction ? 'text-rose-500 font-semibold' : ''
                      }`}
                    >
                      {selectedThreadPost.myReaction && REACTION_EMOJIS.find(r => r.type === selectedThreadPost.myReaction) ? (
                        <span className="text-base select-none leading-none inline-block transform hover:scale-110 transition-transform">
                          {REACTION_EMOJIS.find(r => r.type === selectedThreadPost.myReaction).emoji}
                        </span>
                      ) : (
                        <Heart 
                          size={17} 
                          className={selectedThreadPost.isLikedByMe || selectedThreadPost.myReaction ? 'fill-rose-500 text-rose-500' : ''} 
                        />
                      )}
                      <span className="text-xs">
                        {selectedThreadPost.myReaction && REACTION_EMOJIS.find(r => r.type === selectedThreadPost.myReaction)
                          ? REACTION_EMOJIS.find(r => r.type === selectedThreadPost.myReaction).label
                          : 'Thích'}
                      </span>
                    </button>

                    {/* Popover Emoji Menu */}
                    {activeReactionPicker === `modal_${selectedThreadPost.id}` && (
                      <div 
                        className="reactions-popup-menu"
                        style={{ bottom: '100%', left: '0', marginBottom: '8px', zIndex: 60 }}
                        onMouseLeave={() => setActiveReactionPicker(null)}
                      >
                        {REACTION_EMOJIS.map(item => (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => {
                              handleReactPost(selectedThreadPost.id, item.type);
                              setActiveReactionPicker(null);
                            }}
                            className="reaction-emoji-item"
                            title={item.label}
                          >
                            {item.emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button 
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('thread-modal-reply-input');
                      if (input) input.focus();
                    }}
                    className="flex items-center gap-1.5 p-2 rounded-xl hover:text-white transition-colors active:scale-95"
                  >
                    <MessageSquare size={17} />
                    <span className="text-xs">Phản hồi</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setSharePost(selectedThreadPost)}
                    className="flex items-center gap-1.5 p-2 rounded-xl hover:text-white transition-colors active:scale-95"
                  >
                    <Share2 size={17} />
                    <span className="text-xs">Chia sẻ</span>
                  </button>
                </div>
              </div>

              {/* CỘT PHẢI: DÒNG THẢO LUẬN (54%) */}
              <div className="w-[54%] flex flex-col bg-[#0c0d12] overflow-hidden">
                {/* Header danh sách thảo luận */}
                <div className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between bg-[#12131a] flex-shrink-0">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={14} className="text-zinc-400" />
                    <span>Dòng thảo luận ({selectedThreadPost.commentsCount || (commentsMap[selectedThreadPost.id]?.length || 0)})</span>
                  </h4>
                  <span className="text-[11px] text-zinc-500 font-mono">Phản hồi phân cấp</span>
                </div>

                {/* Danh sách bình luận dạng cây */}
                <div className="flex-1 overflow-y-auto custom-dark-scrollbar p-5 space-y-4">
                  {renderCommentThreadsTree(selectedThreadPost.id)}
                </div>

                {/* Ô NHẬP PHẢN HỒI (Cố định ở đáy cột phải) */}
                <div className="p-3.5 bg-[#12131a] border-t border-zinc-800/80 flex items-center gap-3 flex-shrink-0">
                  <UserAvatar avatar={currentUserAvatar} name={currentUserName} size={32} />
                  <div className="flex-1 min-w-0">
                    {replyTargetMap[selectedThreadPost.id] && (
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-1 mb-1 border-b border-zinc-800">
                        <span>Đang trả lời <strong>@{replyTargetMap[selectedThreadPost.id].authorAccount}</strong></span>
                        <button 
                          type="button" 
                          onClick={() => setReplyTargetMap(prev => ({ ...prev, [selectedThreadPost.id]: null }))}
                          className="text-zinc-400 hover:text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    <input 
                      id="thread-modal-reply-input"
                      type="text"
                      value={commentInputs[selectedThreadPost.id] || ''}
                      onChange={(e) => setCommentInputs(prev => ({ ...prev, [selectedThreadPost.id]: e.target.value }))}
                      placeholder={`Trả lời @${selectedThreadPost.authorAccount || 'user'}...`}
                      className="w-full bg-transparent border-none text-xs sm:text-sm text-[#f1f5f9] focus:outline-none placeholder-zinc-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddComment(selectedThreadPost.id);
                      }}
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleAddComment(selectedThreadPost.id)}
                    disabled={submittingComment[selectedThreadPost.id] || !commentInputs[selectedThreadPost.id]?.trim()}
                    className="px-4 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-all disabled:opacity-40 disabled:hover:bg-white active:scale-95 flex-shrink-0"
                  >
                    {submittingComment[selectedThreadPost.id] ? 'Gửi...' : 'Đăng'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CSS DARK GRAPHITE TOÀN DIỆN - THIẾT KẾ ĐỘC BẢN TALOVIN */}
      {/* ============================================================== */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --social-bg: #13151b; /* Dark Graphite Slate sang trọng, không dùng đen kịt #101010 */
          --sidebar-bg: #101217;
          --card-bg: #171a23; /* Khung bài viết màu chì nhẹ, phân biệt rõ khối */
          --card-hover: #1c202c;
          --card-border: #232838;
          --card-border-hover: #31384e;
          --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          --card-shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.3);
          --input-bg: #13151c;
          --input-border: #262c3e;
          --text-main: #f1f5f9;
          --text-body: #cbd5e1;
          --text-muted: #808ea3;
          --text-subtle: #596579;
        }

        /* Hiệu ứng trượt Drawer từ PHẢI sang TRÁI */
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .drawer-slide-right {
          animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Custom Scrollbar tối màu, mảnh dẻ, không lộ thanh cuộn trắng Windows */
        .custom-dark-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #2b3346 transparent;
        }
        .custom-dark-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-dark-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-dark-scrollbar::-webkit-scrollbar-thumb {
          background: #283044;
          border-radius: 9999px;
        }
        .custom-dark-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3b4662;
        }

        /* Hiệu ứng Pop-up có chiều sâu, đàn hồi mượt mà cho Modal Chi tiết bài viết */
        @keyframes modalBackdropFadeIn {
          from {
            opacity: 0;
            backdrop-filter: blur(0px);
          }
          to {
            opacity: 1;
            backdrop-filter: blur(10px);
          }
        }
        @keyframes modalCardPopIn {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(18px);
          }
          65% {
            opacity: 1;
            transform: scale(1.01) translateY(-2px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .modal-backdrop-smooth {
          animation: modalBackdropFadeIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .modal-card-smooth {
          animation: modalCardPopIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          box-shadow: 0 25px 70px -10px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08);
        }

        .social-app-wrapper {
          min-height: 100vh;
          width: 100%;
          background: var(--social-bg);
          color: var(--text-main);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          justify-content: center;
          overflow-x: hidden;
        }

        /* KHUNG CHÍNH CĂN GIỮA - 3 CỘT KHÔNG BỊ TRỐNG RỖNG TRÊN MÀN HÌNH RỘNG */
        .app-main-layout {
          display: flex;
          width: 100%;
          max-width: 1480px;
          margin: 0 auto;
          justify-content: center;
        }

        /* ================= CỘT 1: THANH ĐIỀU HƯỚNG TRÁI ================= */
        .nav-sidebar {
          width: 240px;
          min-width: 220px;
          height: 100vh;
          position: sticky;
          top: 0;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--card-border);
          display: flex;
          flex-direction: column;
          padding: 18px 14px;
          box-sizing: border-box;
          flex-shrink: 0;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          margin-bottom: 16px;
          padding: 0 4px;
        }

        /* Live Music Deck (Giai điệu Lo-Fi) */
        .ambient-radio-widget {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .radio-top-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }
        .radio-name-text {
          font-size: 11.5px;
          font-weight: 600;
          color: #f1f5f9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .equalizer-bars-group {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 12px;
          margin-left: auto;
        }
        .eq-bar {
          width: 2px;
          height: 3px;
          background: #71717a;
          border-radius: 1px;
          transition: height 0.2s;
        }
        .eq-bar.animating:nth-child(1) { animation: eqBounce 0.8s ease-in-out infinite alternate; background: #a1a1aa; }
        .eq-bar.animating:nth-child(2) { animation: eqBounce 1.1s ease-in-out infinite alternate 0.2s; background: #e4e4e7; }
        .eq-bar.animating:nth-child(3) { animation: eqBounce 0.6s ease-in-out infinite alternate 0.4s; background: #a1a1aa; }
        .eq-bar.animating:nth-child(4) { animation: eqBounce 0.9s ease-in-out infinite alternate 0.1s; background: #d4d4d8; }
        @keyframes eqBounce {
          0% { height: 3px; }
          100% { height: 12px; }
        }

        .radio-btns-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .btn-radio-toggle, .btn-radio-next {
          background: #202436;
          border: 1px solid #333a52;
          color: #e2e8f0;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-radio-toggle:hover, .btn-radio-next:hover { background: #2d354d; color: white; border-color: #454f73; }
        .radio-genre-label {
          font-size: 9.5px;
          color: #94a3b8;
          margin-left: auto;
        }

        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
        }
        /* Hiệu ứng loading trượt từ top center màn hình xuống khi bấm logo */
        .top-center-refresh-indicator {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          animation: slideDownTop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          pointer-events: none;
        }
        .refresh-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          background: rgba(18, 18, 24, 0.94);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 9999px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(16, 185, 129, 0.25);
          color: #f4f4f5;
          font-size: 12px;
          font-weight: 600;
        }
        @keyframes slideDownTop {
          0% {
            opacity: 0;
            transform: translate(-50%, -24px) scale(0.92);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }

        .nav-item.active {
          background: #202436;
          border: 1px solid #333a52;
          color: #ffffff;
          font-weight: 600;
        }

        /* User Profile & Account Dock Card (Chân Sidebar chuẩn phong cách Linear / Discord) */
        .nav-user-dock {
          margin-top: auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 9px 12px;
          gap: 8px;
          transition: all 0.15s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .nav-user-dock:hover {
          background: var(--card-hover);
          border-color: var(--card-border-hover);
        }
        .dock-user-profile {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          cursor: pointer;
          flex: 1;
        }
        .dock-user-meta {
          display: flex;
          flex-direction: column;
          min-width: 0;
          line-height: 1.2;
        }
        .dock-user-name {
          font-size: 12px;
          font-weight: 600;
          color: #f4f4f5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dock-user-handle {
          font-size: 10px;
          color: #71717a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .btn-dock-logout {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .btn-dock-logout:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        /* ================= CỘT 2: STREAM CHÍNH (THREADS FLAT STREAM) ================= */
        .main-stream {
          flex: 1;
          max-width: 680px;
          min-width: 0;
          border-left: 1px solid var(--card-border);
          border-right: 1px solid var(--card-border);
          background: var(--social-bg);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .mobile-top-bar {
          display: none;
          padding: 10px 14px;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--card-border);
          background: var(--sidebar-bg);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .m-brand { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .m-actions { display: flex; align-items: center; gap: 8px; }
        .m-radio-pill {
          background: #27272a;
          border: 1px solid var(--card-border);
          color: #d4d4d8;
          border-radius: 14px;
          padding: 3px 8px;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .m-radio-pill.active { background: #3f3f46; color: white; }

        .stream-header {
          position: sticky;
          top: 0;
          background: rgba(19, 21, 27, 0.95);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--card-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          z-index: 30;
        }
        .stream-tabs {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          flex: 1;
          min-width: 0;
        }
        .stream-tabs::-webkit-scrollbar { display: none; }
        .stream-tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: 1px solid transparent;
          color: #8896ab;
          font-size: 13px;
          font-weight: 500;
          padding: 6px 12px;
          border-radius: 9px;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }
        .stream-tab:hover {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.05);
        }
        .stream-tab.active {
          background: #202636;
          border: 1px solid #313a4e;
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        .stream-tab .tab-icon {
          color: #8896ab;
          transition: color 0.15s ease;
        }
        .stream-tab:hover .tab-icon {
          color: #cbd5e1;
        }
        .stream-tab.active .tab-icon {
          color: #ffffff;
        }
        .btn-header-notif {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--card-border);
          color: #d4d4d8;
          width: 30px;
          height: 30px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
        }
        .notif-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ef4444;
          position: absolute;
          top: 5px;
          right: 5px;
        }

        .notif-dropdown-card {
          position: absolute;
          top: 48px;
          right: 16px;
          width: 290px;
          background: #18181b;
          border: 1px solid var(--card-border);
          box-shadow: 0 10px 30px rgba(0,0,0,0.6);
          border-radius: 8px;
          padding: 10px;
          z-index: 100;
        }
        .notif-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--card-border);
          padding-bottom: 6px;
          margin-bottom: 6px;
        }
        .notif-header h4 { margin: 0; font-size: 12px; color: #f4f4f5; }
        .btn-read-all { background: transparent; border: none; color: #a1a1aa; font-size: 10.5px; cursor: pointer; }
        .notif-counter-pill {
          font-size: 10px;
          color: #a1a1aa;
          background: #27272a;
          padding: 1px 6px;
          border-radius: 9999px;
          border: 1px solid #3f3f46;
        }
        .notif-unread-indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #38bdf8;
          flex-shrink: 0;
          margin-top: 5px;
        }
        .notif-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 12px;
        }
        .notif-list { display: flex; flex-direction: column; gap: 4px; max-height: 340px; overflow-y: auto; }
        .notif-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          padding: 8px;
          border-radius: 6px;
          font-size: 11.5px;
          background: rgba(255, 255, 255, 0.02);
          cursor: pointer;
          transition: background 0.15s;
        }
        .notif-item:hover { background: #27272a; }
        .notif-item.unread { background: #202024; border-left: 2px solid #38bdf8; }
        .notif-text-wrap p { margin: 0; color: #f4f4f5; line-height: 1.4; }
        .notif-text-wrap span { font-size: 9.5px; color: #71717a; margin-top: 2px; display: block; }

        /* Filter Banner */
        .active-tag-filter-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #18181b;
          border-bottom: 1px solid var(--card-border);
          padding: 8px 16px;
          font-size: 11.5px;
          color: #e4e4e7;
        }
        .btn-clear-tag-filter {
          background: transparent;
          border: none;
          color: #a1a1aa;
          cursor: pointer;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .btn-clear-tag-filter:hover { color: white; }

        /* KHU VỰC A: KHÔNG GIAN ĐANG MỞ (Live Active Rooms) */
        .live-rooms-showcase-section {
          margin: 16px 16px 16px;
          padding: 16px 18px;
          border: 1px solid var(--card-border);
          border-radius: 16px;
          background: var(--card-bg);
          box-shadow: var(--card-shadow);
        }
        .rooms-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .rooms-header-title-flex {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .section-heading-title {
          margin: 0;
          font-size: 13.5px;
          font-weight: 600;
          color: #f8fafc;
        }
        .rooms-count-pill {
          font-size: 10.5px;
          color: #94a3b8;
          background: #202436;
          border: 1px solid #333a52;
          padding: 1px 7px;
          border-radius: 6px;
        }
        .btn-create-room-cta {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #f8fafc;
          color: #0b0d14;
          border: none;
          font-size: 11.5px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        .btn-create-room-cta:hover { background: #ffffff; }

        .rooms-active-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .room-card-matte {
          background: #1c2030;
          border: 1px solid #2d344d;
          border-radius: 12px;
          padding: 12px 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .room-card-matte:hover {
          border-color: #454f73;
          background: #23283c;
          transform: translateY(-1px);
        }
        .room-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .room-name-line {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .room-code-tag {
          font-size: 13px;
          font-weight: 600;
          color: #f4f4f5;
        }
        .room-status-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .room-card-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .room-avatar-stack {
          display: flex;
          align-items: center;
        }
        .stacked-avatar {
          margin-left: -5px;
          border: 1.5px solid #121214 !important;
        }
        .stacked-avatar:first-child { margin-left: 0; }
        .stacked-avatar-more {
          font-size: 9.5px;
          color: #a1a1aa;
          background: #27272a;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: -4px;
          border: 1.5px solid #121214;
        }
        .btn-join-room-compact {
          display: flex;
          align-items: center;
          gap: 2px;
          background: rgba(39, 39, 42, 0.7);
          border: 1px solid rgba(63, 63, 70, 0.6);
          color: #d4d4d8;
          font-size: 11px;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 6px; /* rounded-md */
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-join-room-compact:hover {
          background: #27272a;
          color: #ffffff;
        }
        .rooms-empty-card {
          background: #121214;
          border: 1px dashed var(--card-border);
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          color: #71717a;
          font-size: 12px;
        }

        /* ================= TAB TẤT CẢ PHÒNG ĐÀM THOẠI ================= */
        .rooms-section-wrapper {
          padding: 18px 20px 40px;
        }
        .rooms-header-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 18px 22px;
          margin-bottom: 20px;
          gap: 16px;
          box-shadow: var(--card-shadow);
        }
        .btn-add-room-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          border: none;
          color: #0b0d14;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        .btn-add-room-action:hover {
          background: #ffffff;
          transform: translateY(-1px);
        }
        .rooms-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }
        .room-simple-card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: var(--card-shadow);
        }
        .room-simple-card:hover {
          border-color: var(--card-border-hover);
          background: var(--card-hover);
          transform: translateY(-2px);
          box-shadow: var(--card-shadow-hover);
        }
        .room-top-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .room-top-info h4 {
          margin: 0;
          font-size: 13.5px;
          font-weight: 600;
          color: #f4f4f5;
        }
        .room-online-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #a1a1aa;
        }
        .green-circle {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
        }
        .room-chips-list {
          display: flex;
          align-items: center;
          gap: 6px;
          min-height: 22px;
        }
        .room-flag {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .room-flag.locked {
          background: rgba(39, 39, 42, 0.6);
          border: 1px solid #3f3f46;
          color: #a1a1aa;
        }
        .room-flag.joined {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
        }
        .btn-join-room {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f4f4f5;
          border: 1px solid #f4f4f5;
          color: #09090b;
          font-size: 12px;
          font-weight: 500;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-join-room:hover {
          background: #ffffff;
        }
        .btn-join-room.btn-rejoin {
          background: #18181b;
          border: 1px solid #3f3f46;
          color: #f4f4f5;
        }
        .btn-join-room.btn-rejoin:hover {
          background: #27272a;
        }

        /* KHU VỰC B: BỘ TẠO BÀI VIẾT (THREADS SEAMLESS COMPOSER) */
        .post-creator-box {
          margin: 0;
          padding: 18px 20px 14px 20px;
          border-bottom: 1px solid var(--card-border);
          border-top: none;
          border-left: none;
          border-right: none;
          border-radius: 0;
          background: var(--social-bg);
          box-shadow: none;
        }
        .creator-input-row {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .creator-field-wrap {
          flex: 1;
        }
        .creator-field-wrap textarea {
          width: 100%;
          background: transparent;
          border: none;
          padding: 4px 0 8px 0;
          color: var(--text-main);
          font-size: 14.5px;
          font-family: inherit;
          resize: none;
          outline: none;
          line-height: 1.5;
          box-sizing: border-box;
        }
        .creator-field-wrap textarea:focus {
          outline: none;
          background: transparent;
        }
        .creator-field-wrap textarea::placeholder { color: var(--text-muted); }

        /* Preview Ảnh/Video trong Composer - Tối ưu 100% Responsive */
        .composer-attached-preview {
          margin: 10px 0 10px 48px;
          position: relative;
          display: block;
          max-width: 100%;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--card-border);
          background: #090a10;
        }
        .preview-media-element {
          width: 100%;
          max-width: 100%;
          max-height: 240px;
          display: block;
          border-radius: 10px;
          object-fit: cover;
        }
        .btn-remove-attached {
          position: absolute;
          top: 6px;
          right: 6px;
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid #3f3f46;
          color: #ffffff;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        /* Ghi âm trạng thái (Rose-500) */
        .voice-recording-indicator {
          margin: 6px 0 10px 48px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 6px;
          padding: 5px 10px;
        }
        .rec-dot-pulsing {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #f43f5e;
          animation: pulseRose 1s infinite;
        }
        @keyframes pulseRose {
          0% { transform: scale(0.9); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
          100% { transform: scale(0.9); opacity: 1; }
        }
        .btn-stop-rec {
          background: rgba(244, 63, 94, 0.2);
          border: 1px solid rgba(244, 63, 94, 0.4);
          color: #fecdd3;
          font-size: 11px;
          padding: 2px 7px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 3px;
        }

        /* Voice Preview Pill */
        .voice-preview-deck {
          margin: 6px 0 10px 48px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #1c2030;
          border: 1px solid var(--card-border);
          border-radius: 8px;
          padding: 6px 12px;
        }
        .btn-play-voice-preview {
          background: #23283c;
          border: 1px solid #3b4360;
          color: #f4f4f5;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .voice-waveform-preview {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 12px;
        }
        .wave-bar {
          width: 2px;
          height: 4px;
          background: #71717a;
          border-radius: 1px;
        }
        .wave-bar.playing:nth-child(odd) { animation: eqBounce 0.6s infinite alternate; background: #e4e4e7; }
        .wave-bar.playing:nth-child(even) { animation: eqBounce 0.9s infinite alternate; background: #a1a1aa; }
        .btn-delete-voice {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 2px;
        }
        .btn-delete-voice:hover { color: #f87171; }

        /* Vibe Tags Row */
        .vibe-tags-row {
          display: flex;
          gap: 6px;
          margin: 12px 0 12px 48px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .vibe-tags-row::-webkit-scrollbar { display: none; }
        .vibe-tag-pill {
          background: #18181b;
          border: 1px solid #27272a;
          color: #a1a1aa;
          font-size: 11.5px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .vibe-tag-pill:hover {
          background: #27272a;
          color: #ffffff;
          border-color: #3f3f46;
        }
        .vibe-tag-pill.active {
          background: #27272a;
          border-color: #52525b;
          color: #ffffff;
          font-weight: 600;
        }

        /* Sparks Custom Tag */
        .community-sparks-section {
          margin: 6px 0 10px 48px;
        }
        .custom-spark-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #11141e;
          border: 1px solid #282f45;
          border-radius: 12px;
          padding: 6px 12px;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
          transition: all 0.15s ease;
        }
        .custom-spark-input-row:focus-within {
          border-color: #10b981;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 0 0 2px rgba(16, 185, 129, 0.15);
        }
        .spark-input-icon { color: #10b981; }
        .custom-spark-input-row input {
          flex: 1;
          background: transparent;
          border: none;
          color: #f4f4f5;
          font-size: 12px;
          outline: none;
        }
        .custom-spark-input-row input::placeholder {
          color: #64748b;
          font-style: normal;
        }
        .btn-add-spark-action {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.35);
          color: #34d399;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 3px;
          transition: all 0.15s ease;
        }
        .btn-add-spark-action:hover:not(:disabled) {
          background: rgba(16, 185, 129, 0.25);
          color: #6ee7b7;
        }
        .btn-add-spark-action:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .selected-sparks-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 6px;
        }
        .active-spark-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #1c2234;
          border: 1px solid #333d5c;
          color: #38bdf8;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 6px;
        }
        .btn-remove-spark {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0;
        }

        .creator-bottom-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-left: 48px;
          margin-top: 6px;
        }
        .creator-left-tools {
          display: flex;
          gap: 6px;
        }
        .btn-subtool {
          background: transparent;
          border: 1px solid transparent;
          color: #94a3b8;
          font-size: 11.5px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          padding: 5px 9px;
          border-radius: 8px;
          transition: all 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
          user-select: none;
        }
        .btn-subtool:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #f4f4f5;
        }
        .btn-subtool.active {
          background: #23283c;
          border-color: #3b4360;
          color: #ffffff;
        }
        .btn-subtool.active-rose {
          background: rgba(244, 63, 94, 0.15);
          border-color: rgba(244, 63, 94, 0.3);
          color: #fb7185;
        }

        /* Nút CTA Đăng bài: Tối giản, tương phản cao chuẩn dark mode (Không dùng màu neon bóng chói mắt) */
        .btn-publish-submit {
          background: #f4f4f5;
          color: #09090b;
          border: none;
          padding: 7px 18px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          flex-shrink: 0;
          min-width: max-content;
        }
        .btn-publish-submit:hover:not(:disabled) {
          background: #ffffff;
          transform: translateY(-1px);
        }
        .btn-publish-submit:active:not(:disabled) {
          transform: scale(0.97);
        }
        .btn-publish-submit:disabled {
          background: #18181b;
          color: #71717a;
          border: 1px solid #27272a;
          box-shadow: none;
          cursor: not-allowed;
          opacity: 0.6;
        }

        /* ================= BÀI VIẾT PHẲNG (THREADS FEED STREAM ROW) ================= */
        .post-item-card {
          background: var(--card-bg);
          border-bottom: 1px solid var(--card-border);
          border-top: none;
          border-left: none;
          border-right: none;
          border-radius: 0;
          margin: 0;
          padding: 16px 20px 14px 20px;
          box-shadow: none;
          position: relative;
          transition: background-color 0.15s ease;
        }
        .post-item-card:hover {
          background: var(--card-hover);
        }
        .post-header-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .post-avatar-click { cursor: pointer; flex-shrink: 0; }
        .post-header-info { flex: 1; }
        .post-name-line {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }
        .author-display-name {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          cursor: pointer;
          letter-spacing: -0.01em;
        }
        .author-display-name:hover {
          text-decoration: underline;
        }
        .author-handle { font-size: 11.5px; color: #94a3b8; }
        .post-time-meta { font-size: 11.5px; color: #94a3b8; }
        .vibe-tag-badge {
          font-size: 10px;
          font-weight: 500;
          color: #94a3b8;
          background: #1c2030;
          border: 1px solid #2d344d;
          border-radius: 6px;
          padding: 2px 6px;
          display: inline-flex;
          align-items: center;
        }
        .post-topics-bar {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
        }
        .post-topic-chip {
          background: #1c2030;
          border: 1px solid #2d344d;
          color: #94a3b8;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          padding: 2px 7px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4.5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .post-topic-chip:hover {
          color: #ffffff;
          border-color: #454f73;
          background: #252a3f;
        }
        .post-topic-chip.active {
          color: #ffffff;
          border-color: #60a5fa;
          background: #2b334d;
          font-weight: 600;
        }
        .topic-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #10b981;
        }
        .post-header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .btn-save-post {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          transition: all 0.15s;
        }
        .btn-save-post:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.06);
        }
        .btn-save-post.saved { color: #f59e0b; }

        .post-body-content {
          margin: 12px 0 14px 0;
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-body);
        }
        .post-body-content p {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          color: #f1f5f9;
        }

        /* Frame Đa phương tiện */
        .post-media-frame {
          margin-top: 10px;
          border-radius: 12px;
          overflow: hidden;
          max-height: 420px;
          border: 1px solid var(--card-border);
          background: #090a10;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .post-media-frame:hover {
          border-color: #3b4260;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }
        .post-media-image, .post-media-video {
          width: 100%;
          max-height: 420px;
          object-fit: cover;
          display: block;
        }

        /* Voice Pill Player trên thẻ bài viết */
        .post-voice-player-pill {
          margin-top: 10px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #1c2030;
          border: 1px solid var(--card-border);
          border-radius: 8px;
          padding: 6px 12px;
        }
        .btn-play-card-voice {
          background: #23283c;
          border: 1px solid #3b4360;
          color: #f4f4f5;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-play-card-voice:hover {
          background: #2e354f;
          color: #ffffff;
        }
        .card-voice-waveform {
          display: flex;
          align-items: center;
          gap: 2.5px;
          height: 14px;
        }
        .card-wave-bar {
          width: 2px;
          height: 4px;
          background: #71717a;
          border-radius: 1px;
        }
        .card-wave-bar.active:nth-child(odd) { animation: eqBounce 0.5s infinite alternate; background: #e4e4e7; }
        .card-wave-bar.active:nth-child(even) { animation: eqBounce 0.8s infinite alternate; background: #a1a1aa; }

        /* Vùng tương tác bài viết (Thanh phân cách rõ ràng, dễ nhìn) */
        .post-actions-toolbar {
          margin-left: 0;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          gap: 22px;
          align-items: center;
          position: relative;
        }
        .reaction-drop-wrapper { position: relative; }
        .action-btn {
          background: transparent;
          border: none;
          color: #777777;
          font-size: 12px;
          font-weight: 500;
          padding: 5px 8px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }
        .action-btn:hover {
          color: #f3f5f7;
          background: rgba(255, 255, 255, 0.04);
        }
        .action-btn.active-liked { color: #f87171; }

        /* REACTION POPOVER: NẰM GỌN TRÊN NÚT, TỰ BIẾN MẤT MƯỢT MÀ KHI RỜI CHUỘT */
        .reactions-popup-menu {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 0;
          background: #181922;
          border: 1px solid #2e3446;
          border-radius: 14px;
          padding: 6px 10px;
          box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          gap: 7px;
          z-index: 70;
          animation: slideUpReaction 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          pointer-events: auto;
        }
        .reactions-popup-menu::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          height: 14px;
        }
        @keyframes slideUpReaction {
          from { opacity: 0; transform: translateY(8px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .reaction-emoji-item {
          background: transparent;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
          line-height: 1;
          transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .reaction-emoji-item:hover {
          transform: scale(1.35) translateY(-3px);
          background: rgba(255, 255, 255, 0.12);
        }

        /* Post Dropdown Menu */
        .post-menu-container { position: relative; }
        .post-menu-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 5px;
          border-radius: 6px;
          transition: all 0.15s;
        }
        .post-menu-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.06);
        }
        .post-menu-dropdown {
          position: absolute;
          top: 28px;
          right: 0;
          background: #1c2030;
          border: 1px solid #3b4360;
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          z-index: 50;
          min-width: 130px;
        }
        .post-menu-item {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: #d4d4d8;
          font-size: 11.5px;
          padding: 5px 8px;
          border-radius: 4px;
          cursor: pointer;
          text-align: left;
        }
        .post-menu-item:hover { background: #27272a; color: white; }
        .post-menu-item.danger { color: #f87171; }
        .post-menu-item.danger:hover { background: rgba(239, 68, 68, 0.15); color: #f87171; }

        /* Comments Container */
        .post-comments-container {
          margin-top: 12px;
          border-top: 1px solid var(--card-border);
          padding-top: 12px;
        }
        .comments-stack {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 12px;
        }
        .empty-cmt-notice {
          margin: 0;
          font-size: 12px;
          color: #71717a;
          padding: 8px 4px;
        }
        /* CẤU TRÚC PHÂN CẤP BÌNH LUẬN (Threaded Comments Hierarchy) */
        .cmt-thread-group {
          display: flex;
          flex-direction: column;
          position: relative;
          margin-bottom: 12px;
        }

        .cmt-root-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          position: relative;
          z-index: 2;
        }

        /* Nhánh phản hồi con: Thụt lề và có đường kẻ dọc nối từ avatar cha */
        .cmt-replies-branch-thread {
          margin-left: 15px;
          padding-left: 18px;
          border-left: 1.5px solid #262626;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
          position: relative;
        }

        .cmt-reply-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          position: relative;
        }

        /* Đường nhánh rẽ ngang nối từ thanh dọc sang từng reply */
        .cmt-reply-item::before {
          content: '';
          position: absolute;
          left: -18px;
          top: 14px;
          width: 12px;
          height: 1.5px;
          background: #262626;
          border-bottom-left-radius: 3px;
        }

        /* BÌNH LUẬN PHẲNG THREADS (NO BOX BUBBLE, FLAT TRANSPARENT) */
        .cmt-bubble-content {
          border-radius: 0;
          flex: 1;
          min-width: 0;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 0 4px 0 !important;
        }
        .cmt-bubble-content.root-bubble,
        .cmt-bubble-content.reply-bubble {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 0 4px 0 !important;
        }
        .cmt-bubble-content.root-bubble:hover,
        .cmt-bubble-content.reply-bubble:hover {
          border-color: transparent !important;
        }

        .cmt-header-row,
        .cmt-name-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
          gap: 8px;
          min-width: 0;
        }
        .cmt-footer-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 6px;
          padding-top: 2px;
        }
        .cmt-author-info {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: nowrap;
          overflow: hidden;
          min-width: 0;
          flex: 1;
        }
        .cmt-user-name {
          font-size: 12px;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 130px;
        }
        .cmt-user-name.reply-name {
          font-size: 11.5px;
          font-weight: 600;
          color: #e2e8f0;
          max-width: 110px;
        }
        .cmt-user-handle {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10.5px;
          color: #8b9bb4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 90px;
        }
        .cmt-user-handle.reply-handle {
          font-size: 10px;
          color: #64748b;
          max-width: 75px;
        }
        .cmt-meta-dot {
          color: #475569;
          font-weight: bold;
          font-size: 11px;
          user-select: none;
          flex-shrink: 0;
        }
        .cmt-time-label {
          font-size: 10.5px;
          color: #64748b;
          font-family: ui-monospace, SFMono-Regular, monospace;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .cmt-body-text {
          margin: 0;
          font-size: 13px;
          color: #e2e8f0;
          line-height: 1.5;
          word-break: break-word;
        }
        .cmt-mention-badge {
          display: inline;
          color: #38bdf8;
          font-size: 12px;
          background: transparent;
          padding: 0;
          border: none;
          margin-right: 4px;
          user-select: none;
          font-weight: 600;
        }
        .cmt-action-btns {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: auto;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .btn-cmt-act {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 3px 5px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          transition: all 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .btn-cmt-act span {
          white-space: nowrap;
          display: inline-block;
        }
        .btn-cmt-act:hover { color: #f8fafc; background: rgba(255, 255, 255, 0.06); }
        .btn-cmt-act.reply:hover { color: #38bdf8; }
        .btn-cmt-act.danger:hover { color: #f87171; }
        .btn-cmt-act.reaction {
          color: #71717a;
        }
        .btn-cmt-act.reaction:hover {
          color: #f43f5e;
          background: rgba(244, 63, 94, 0.08);
        }
        .btn-cmt-act.reaction.liked {
          color: #f43f5e;
        }
        .cmt-like-count {
          font-size: 10px;
          font-weight: 600;
          line-height: 1;
        }

        .replying-to-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 6px 12px;
          margin-bottom: 8px;
          font-size: 11.5px;
        }
        .btn-cancel-reply {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .btn-cancel-reply:hover { color: white; }

        .cmt-inline-edit-box {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 6px;
        }
        .cmt-inline-edit-input {
          width: 100%;
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 8px;
          padding: 8px 12px;
          color: white;
          font-size: 12.5px;
          outline: none;
          box-sizing: border-box;
        }
        .cmt-inline-edit-input:focus { border-color: #475569; }
        .cmt-inline-edit-actions { display: flex; gap: 6px; justify-content: flex-end; }
        .btn-save-inline-cmt {
          background: #f8fafc;
          color: #0b0d14;
          border: none;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-save-inline-cmt:hover { background: white; }
        .btn-cancel-inline-cmt {
          background: transparent;
          color: #94a3b8;
          border: 1px solid var(--card-border);
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 11.5px;
          cursor: pointer;
        }
        .btn-cancel-inline-cmt:hover { background: #202436; color: white; }

        .cmt-input-form {
          display: flex;
          gap: 8px;
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 12px;
          padding: 6px 8px;
          align-items: center;
        }
        .cmt-input-form:focus-within {
          border-color: #475569;
        }
        .cmt-input-form input {
          flex: 1;
          background: transparent;
          border: none;
          padding: 6px 8px;
          color: white;
          font-size: 13px;
          outline: none;
        }
        .btn-submit-cmt {
          background: #f8fafc;
          color: #0b0d14;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        .btn-submit-cmt:hover:not(:disabled) {
          background: white;
          transform: translateY(-1px);
        }
        .btn-submit-cmt:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        /* ================= CỘT 3: RIGHT DOCK (280px - 300px) ================= */
        .widgets-sidebar {
          width: 300px;
          min-width: 280px;
          padding: 18px 16px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex-shrink: 0;
          background: var(--sidebar-bg);
          border-left: 1px solid var(--card-border);
        }
        .search-input-wrap {
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 10px;
          display: flex;
          align-items: center;
          padding: 8px 12px;
          gap: 8px;
          transition: border-color 0.15s;
        }
        .search-input-wrap:focus-within {
          border-color: #475569;
        }
        .search-icon-muted { color: #64748b; }
        .search-icon-btn {
          background: transparent;
          border: none;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .search-input-wrap input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 12.5px;
          outline: none;
        }
        .search-input-wrap input::placeholder { color: #64748b; }
        .btn-clear-kw { background: transparent; border: none; color: #94a3b8; cursor: pointer; }

        .widget-box-card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 16px 18px;
          box-shadow: var(--card-shadow);
          transition: all 0.2s ease;
        }
        .widget-box-card:hover {
          border-color: var(--card-border-hover);
        }
        .widget-card-title {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          font-weight: 600;
          color: #f8fafc;
          margin-bottom: 6px;
        }
        .widget-card-desc {
          font-size: 11.5px;
          color: #94a3b8;
          margin: 0 0 12px 0;
          line-height: 1.5;
        }
        .btn-widget-action {
          width: 100%;
          background: #f8fafc;
          color: #0b0d14;
          border: none;
          padding: 8px 12px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        .btn-widget-action:hover { background: #ffffff; transform: translateY(-1px); }
        .btn-widget-action.secondary {
          background: #202436;
          color: #e2e8f0;
          border: 1px solid #333a52;
          box-shadow: none;
        }
        .btn-widget-action.secondary:hover {
          background: #282e44;
          color: #ffffff;
          border-color: #454f73;
        }

        .widget-sparks-cloud {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 6px;
        }
        .widget-spark-pill {
          background: #1c2030;
          border: 1px solid #2d344d;
          color: #94a3b8;
          font-size: 11px;
          padding: 4px 9px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .widget-spark-pill:hover {
          background: #252a3f;
          color: #ffffff;
          border-color: #414b6e;
        }
        .widget-spark-pill.active {
          background: #2b334d;
          color: #ffffff;
          border-color: #60a5fa;
          font-weight: 600;
        }
        .btn-widget-action.secondary:hover {
          background: #27272a;
          color: #ffffff;
        }

        .widget-sparks-cloud {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 4px;
        }
        .widget-spark-pill {
          background: #09090b;
          border: 1px solid var(--card-border);
          color: #a1a1aa;
          font-size: 10.5px;
          padding: 3px 7px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .widget-spark-pill:hover {
          background: #27272a;
          color: #f4f4f5;
        }
        .widget-spark-pill.active {
          background: #f4f4f5;
          color: #09090b;
          border-color: #f4f4f5;
          font-weight: 600;
        }

        /* ================= MOBILE BOTTOM NAV ================= */
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: rgba(9, 9, 11, 0.96);
          backdrop-filter: blur(16px);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          grid-template-columns: repeat(5, 1fr);
          align-items: center;
          justify-items: center;
          z-index: 80;
          padding: 0 4px;
        }
        .b-nav-item {
          width: 100%;
          height: 100%;
          background: transparent;
          border: none;
          color: #71717a;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          font-size: 10px;
          font-weight: 500;
          cursor: pointer;
          padding: 4px 0;
          transition: color 0.15s ease;
          user-select: none;
        }
        .b-nav-item.active { 
          color: #f4f4f5; 
          font-weight: 600;
        }
        .b-nav-item span {
          display: block;
          max-width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.1;
        }
        .b-nav-cell {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .b-nav-create-center {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #f4f4f5;
          color: #09090b;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
          margin: 0 auto;
          cursor: pointer;
          transition: transform 0.15s ease;
          border: none;
        }
        .b-nav-create-center:active {
          transform: scale(0.92);
        }

        /* ================= MODALS COMMON ================= */
        .custom-confirm-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .custom-confirm-card {
          width: 100%;
          max-width: 380px;
          background: #121214;
          border: 1px solid #27272a;
          border-radius: 14px;
          padding: 20px 22px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
          animation: modalFadeIn 0.15s ease-out;
        }
        .confirm-icon-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .confirm-icon-badge {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: rgba(244, 63, 94, 0.12);
          border: 1px solid rgba(244, 63, 94, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .confirm-title {
          font-size: 15px;
          font-weight: 600;
          color: #f4f4f5;
          margin: 0;
        }
        .confirm-message {
          font-size: 12.5px;
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0 0 18px 0;
        }
        .confirm-actions-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }
        .btn-confirm-cancel {
          padding: 7px 14px;
          border-radius: 8px;
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #d4d4d8;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-confirm-cancel:hover {
          background: #3f3f46;
          color: #ffffff;
        }
        .btn-confirm-submit {
          padding: 7px 16px;
          border-radius: 8px;
          background: #f43f5e;
          border: 1px solid #f43f5e;
          color: #ffffff;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }
        .btn-confirm-submit:hover {
          opacity: 0.9;
        }

        .modal-veil {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .modal-dialog-box {
          background: #121214;
          border: 1px solid var(--card-border);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
          border-radius: 8px; /* rounded-lg */
          width: 100%;
          max-width: 390px;
          padding: 16px;
        }
        .dialog-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .dialog-title-flex { display: flex; align-items: center; gap: 6px; }
        .dialog-header h4 { margin: 0; font-size: 13.5px; color: #f4f4f5; }
        .btn-close-dialog { background: transparent; border: none; color: #71717a; cursor: pointer; }
        .dialog-form { display: flex; flex-direction: column; gap: 10px; }
        .dialog-field { display: flex; flex-direction: column; gap: 4px; }
        .dialog-field label { font-size: 10.5px; font-weight: 500; color: #a1a1aa; }
        .dialog-field input {
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 6px;
          padding: 7px 9px;
          color: white;
          font-size: 12px;
          outline: none;
        }
        .dialog-actions-row { display: flex; gap: 8px; margin-top: 8px; }
        .btn-dialog-back {
          flex: 1;
          background: rgba(39, 39, 42, 0.7);
          color: #d4d4d8;
          border: 1px solid rgba(63, 63, 70, 0.6);
          padding: 7px;
          border-radius: 6px;
          font-size: 11.5px;
          cursor: pointer;
        }
        .btn-dialog-primary {
          flex: 1;
          background: #f4f4f5;
          color: #09090b;
          border: none;
          padding: 7px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
        }

        /* Speed match dialog */
        .dialog-searching-body { text-align: center; padding: 20px 10px; }
        .radar-circle-zinc {
          width: 48px;
          height: 48px;
          margin: 0 auto 10px;
          border-radius: 50%;
          border: 2px solid #52525b;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulseZinc 1.2s infinite;
        }
        @keyframes pulseZinc {
          0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.2); }
          70% { box-shadow: 0 0 0 12px rgba(255, 255, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }
        .radar-status-text { font-size: 11.5px; color: #a1a1aa; margin: 0; }
        .partner-matched-card-zinc {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #09090b;
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 10px;
        }
        .partner-matched-card-zinc strong { display: block; font-size: 13px; color: #f4f4f5; }
        .partner-matched-card-zinc p { margin: 2px 0 0 0; font-size: 10.5px; color: #a1a1aa; }

        .icebreaker-quote-interactive {
          background: #09090b;
          border: 1px dashed #3f3f46;
          border-radius: 6px;
          padding: 8px 10px;
          margin-bottom: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .icebreaker-quote-interactive:hover {
          border-color: #71717a;
          background: rgba(255, 255, 255, 0.02);
        }
        .icebreaker-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3px;
        }
        .icebreaker-top-row span { font-size: 10px; font-weight: 600; color: #a1a1aa; }
        .copy-icon-subtle { color: #71717a; }
        .icebreaker-quote-interactive p {
          margin: 0;
          font-size: 12px;
          color: #f4f4f5;
          line-height: 1.4;
        }

        /* Wheel dialog - Lá bài thử thách (bg-zinc-950 border border-zinc-800 p-5 rounded-lg) */
        .wheel-dialog-body { text-align: center; }
        .clean-wheel-dial {
          width: 58px;
          height: 58px;
          margin: 4px auto 12px;
          border-radius: 50%;
          border: 2px solid #3f3f46;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .clean-wheel-dial.spinning { animation: spinWheel 1.2s cubic-bezier(0.15, 0.9, 0.3, 1.2) forwards; }
        @keyframes spinWheel { 100% { transform: rotate(1080deg); } }

        .party-challenge-card-zinc {
          background: #09090b; /* bg-zinc-950 */
          border: 1px solid var(--card-border); /* border-zinc-800 */
          border-radius: 8px; /* rounded-lg */
          padding: 16px; /* p-5 style */
          margin-bottom: 12px;
          text-align: left;
        }
        .challenge-card-badge {
          font-size: 10px;
          font-weight: 600;
          color: #a1a1aa;
          letter-spacing: 0.04em;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 6px;
        }
        .challenge-card-question {
          font-size: 13px;
          line-height: 1.5;
          color: #f4f4f5;
          margin: 0 0 10px 0;
        }
        .btn-share-challenge-feed {
          width: 100%;
          background: #18181b;
          border: 1px solid #3f3f46;
          color: #f4f4f5;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          transition: background 0.15s;
        }
        .btn-share-challenge-feed:hover { background: #27272a; }

        .btn-spin-action-zinc {
          width: 100%;
          background: #f4f4f5;
          color: #09090b;
          border: none;
          padding: 8px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-spin-action-zinc:disabled { opacity: 0.4; cursor: not-allowed; }

        .feed-status-box { padding: 40px 20px; text-align: center; color: #71717a; }
        .feed-spinner {
          width: 22px;
          height: 22px;
          border: 2px solid rgba(255,255,255,0.1);
          border-bottom-color: #a1a1aa;
          border-radius: 50%;
          margin: 0 auto 10px;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        /* Phân tầng màn hình rộng */
        @media (min-width: 1600px) {
          .app-main-layout { max-width: 1560px; }
          .main-stream { max-width: 820px; }
          .widgets-sidebar { width: 310px; }
        }

        /* RESPONSIVE */
        @media (max-width: 1080px) {
          .widgets-sidebar { display: none; }
        }

        @media (max-width: 768px) {
          .nav-sidebar { display: none; }
          .mobile-top-bar { display: flex; }
          .mobile-bottom-nav { 
            display: grid; 
            grid-template-columns: repeat(5, 1fr);
            align-items: center;
            justify-items: center;
            transition: transform 0.2s ease, opacity 0.2s ease;
          }
          /* Tự động trượt ẩn thanh điều hướng dưới khi bàn phím mở hoặc đang gõ để tránh cấn input */
          body:has(textarea:focus) .mobile-bottom-nav,
          body:has(input:focus) .mobile-bottom-nav {
            transform: translateY(100%);
            opacity: 0;
            pointer-events: none;
          }
          .main-stream { 
            max-width: 100%; 
            min-width: 0; 
            padding-bottom: calc(120px + env(safe-area-inset-bottom, 24px)); 
          }
          .stream-header {
            padding: 6px 10px;
          }
          .stream-tabs {
            gap: 4px;
            padding-bottom: 2px;
          }
          .stream-tab {
            padding: 5px 9px;
            font-size: 11.5px;
            gap: 4px;
          }
          .rooms-active-grid { grid-template-columns: 1fr; }
          .vibe-tags-row {
            margin: 8px 0;
            padding-left: 0;
            padding-right: 20px;
            gap: 6px;
            overflow-x: auto;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            display: flex;
            flex-wrap: nowrap;
          }
          .vibe-tag-pill {
            flex-shrink: 0;
            white-space: nowrap;
          }
          .creator-bottom-row { 
            padding-left: 0; 
            margin-top: 8px;
            gap: 6px;
            flex-wrap: nowrap;
            align-items: center;
            justify-content: space-between;
          }
          .creator-left-tools {
            display: flex;
            gap: 4px;
            align-items: center;
            min-width: 0;
            flex-shrink: 1;
            overflow-x: auto;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }
          .btn-subtool {
            padding: 5px 8px;
            font-size: 11px;
            gap: 3px;
            white-space: nowrap;
            flex-shrink: 0;
          }
          .btn-publish-submit {
            padding: 6px 15px;
            font-size: 12px;
            flex-shrink: 0;
            white-space: nowrap;
            font-weight: 700;
            border-radius: 9px;
          }
          .composer-attached-preview { 
            margin: 8px 0; 
            width: 100%;
            max-width: 100%;
          }
          .voice-recording-indicator { margin-left: 0; }
          .voice-preview-deck { margin-left: 0; }
          .community-sparks-section { margin-left: 0; }
        }
      `}} />
    </div>
  );
};

export default Home;
