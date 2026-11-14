import React, { Component, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, LogOut, Plus, MessageSquare, Shield, User, X, Lock, Hash, 
  CheckCircle, ArrowRight, WifiOff, Heart, MessageCircle, Share2, 
  Search, Sparkles, Send, Copy, Compass, Radio, ChevronRight, CornerDownRight,
  Bell, Bookmark, Flame, Gem, Crown, Volume2, VolumeX, Music, Play, Pause,
  Shuffle, Image as ImageIcon, CheckCircle2, Zap, Dices, Maximize2, Download,
  Edit3, Trash2, MoreVertical, Tag, Filter, Check,
  Mic, Headphones, Moon, Gamepad2, Film, Square,
  Flag, AlertTriangle, UserCheck
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
import CommunitySection from '../components/CommunitySection';
import ResonanceMatchModal from '../components/ResonanceMatchModal';
import ChallengeDeckModal from '../components/ChallengeDeckModal';

// Avatar: Ưu tiên ảnh thật người dùng tải lên. Nếu chưa có ảnh, dùng Monogram chữ cái tối giản (Tuyệt đối không dùng avatar robot hoạt hình)
export const UserAvatar = ({ avatar, name = '', size = 36, className = "" }) => {
  const initial = (name || 'U').trim().charAt(0).toUpperCase();

  const isRobot = avatar && (avatar.includes('dicebear') || avatar.includes('bottts') || avatar.includes('avataaars'));
  if (avatar && avatar.trim() && !isRobot) {
    return (
      <img 
        src={avatar} 
        alt={name || "Avatar"} 
        className={`user-avatar-img ${className}`} 
        style={{ 
          width: size, 
          height: size, 
          borderRadius: '50%', 
          objectFit: 'cover',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          background: '#18181b',
          flexShrink: 0
        }} 
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
    );
  }

  return (
    <div 
      className={`user-avatar-fallback select-none ${className}`} 
      style={{ 
        width: size, 
        height: size, 
        borderRadius: '50%', 
        background: 'linear-gradient(145deg, #27272a, #141417)',
        border: '1px solid #3f3f46',
        color: '#f4f4f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(11, size * 0.4),
        fontWeight: 600,
        flexShrink: 0
      }}
      title={name}
    >
      {initial}
    </div>
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

// Danh sách tâm trạng / Chủ đề chia sẻ (Anti-AI: KHÔNG dùng emoji hệ thống, dùng Lucide icon mảnh)
const VIBE_TAGS = [
  { id: 'Thư giãn', label: 'Thư giãn', icon: Headphones },
  { id: 'Tích cực', label: 'Tích cực', icon: Sparkles },
  { id: 'Lắng đọng', label: 'Lắng đọng', icon: Moon },
  { id: 'Tìm bạn', label: 'Tìm bạn', icon: Gamepad2 },
  { id: 'Tâm sự', label: 'Tâm sự', icon: MessageSquare },
];

// Gợi ý mở đầu kết nối ngẫu nhiên
const ICEBREAKER_PROMPTS = [
  "Nếu chỉ được chọn một bản nhạc phát lặp lại cả tuần này, bạn sẽ nghe bài nào?",
  "Điều gì gần đây làm bạn cảm thấy nhẹ nhõm và tích cực nhất?",
  "Nếu có một cánh cửa dẫn đến bất kỳ thành phố nào đêm nay, bạn muốn đến đâu?",
  "Gu âm nhạc lúc làm việc hay học tập của bạn là gì: Lo-Fi, không lời hay Acoustic?",
  "Thói quen nhỏ nào mỗi ngày giúp bạn nạp lại năng lượng nhanh nhất?"
];

// Helper phân tích dữ liệu đa phương tiện từ trường imageUrl
const parsePostMedia = (raw) => {
  if (!raw) return { mediaUrl: null, mediaType: null, audioUrl: null, audioDuration: null };
  if (typeof raw === 'string' && raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      return {
        mediaUrl: parsed.mediaUrl || null,
        mediaType: parsed.mediaType || (parsed.mediaUrl?.includes('video') ? 'video' : 'image'),
        audioUrl: parsed.audioUrl || null,
        audioDuration: parsed.audioDuration || null
      };
    } catch (e) {
      // fallback
    }
  }
  const isVideo = typeof raw === 'string' && (raw.match(/\.(mp4|webm|mov)(\?.*)?$/i) || raw.startsWith('data:video/'));
  return {
    mediaUrl: raw,
    mediaType: isVideo ? 'video' : 'image',
    audioUrl: null,
    audioDuration: null
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

const Home = () => {
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem('user_id');
  const currentUserName = localStorage.getItem('nickname') || localStorage.getItem('account') || localStorage.getItem('username') || 'Thành viên';
  const currentUserAccount = localStorage.getItem('account') || localStorage.getItem('username') || 'user';
  const currentUserAvatar = localStorage.getItem('user_avatar') || '';

  // Navigation tab chính: 'feed' | 'rooms' | 'trending' | 'saved'
  const [activeTab, setActiveTab] = useState('feed');
  const [pendingFriendsCount, setPendingFriendsCount] = useState(0);
  const [replyTargetMap, setReplyTargetMap] = useState({});
  const [isTopRefreshing, setIsTopRefreshing] = useState(false);

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
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeReactionPicker, setActiveReactionPicker] = useState(null);

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
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Radio Lo-Fi
  // Âm nhạc hệ thống (Dynamic từ API, không mock data)
  const [isPlayingRadio, setIsPlayingRadio] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
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
      const scope = (payload.scope || '') + ' ' + (payload.roles || '');
      return scope.includes('ADMIN') || scope.includes('TL_') || scope.includes('PERM_');
    } catch {
      return false;
    }
  });

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
                const mapped = parsed.map(v => ({ id: v, label: v, icon: Sparkles }));
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

  // Kiểm tra phòng đang tham gia hoặc đã từng vào
  const isUserInRoom = (room) => {
    if (!room) return false;
    const account = localStorage.getItem('account');
    if (room.userRoomDTOList && room.userRoomDTOList.some(ur => ur.userDTO && (ur.userDTO.account === account || ur.userDTO.id?.toString() === currentUserId?.toString()))) {
      return true;
    }
    try {
      const entered = JSON.parse(localStorage.getItem('talovin_entered_rooms') || '[]');
      if (entered.includes(room.id)) return true;
    } catch (e) {}
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

  // Phát Voice Note trên thẻ bài viết
  const handleTogglePlayPostVoice = (postId, audioSrc) => {
    if (!cardVoiceAudioRef.current) return;
    if (playingVoicePostId === postId) {
      cardVoiceAudioRef.current.pause();
      setPlayingVoicePostId(null);
    } else {
      cardVoiceAudioRef.current.src = audioSrc;
      cardVoiceAudioRef.current.play().then(() => {
        setPlayingVoicePostId(postId);
      }).catch(err => console.warn("Lỗi phát voice note:", err));
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
    setActiveReactionPicker(null);
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const wasLiked = p.isLikedByMe;
      const sameType = p.myReaction === reactionType;

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
          myReaction: reactionType,
          likesCount: wasLiked ? p.likesCount : (p.likesCount || 0) + 1
        };
      }
    }));

    try {
      const res = await axiosClient.post(`/posts/${postId}/like`, null, {
        params: { type: reactionType, reactionType }
      });
      if (res.data && res.data.data) {
        setPosts(prev => prev.map(p => p.id === postId ? res.data.data : p));
      }
    } catch (err) {
      console.warn("Lỗi thả cảm xúc:", err);
      fetchPosts(true);
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
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        setReplyTargetMap(prev => ({ ...prev, [postId]: null }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi gửi phản hồi!");
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

  // Tìm kiếm bài viết & phòng
  const handleSearch = (e) => {
    setSearchKeyword(e.target.value);
  };

  // Lo-Fi Radio
  const togglePlayRadio = () => {
    if (!audioRef.current) return;
    if (!tracks || tracks.length === 0) {
      toast("Chưa có bản nhạc nào trong hệ thống");
      return;
    }
    if (isPlayingRadio) {
      audioRef.current.pause();
      setIsPlayingRadio(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingRadio(true);
        toast.success(`Đang phát: ${tracks[currentTrackIndex]?.name || 'Âm nhạc'}`);
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
      audioRef.current.src = tracks[nextIdx]?.audioSrc || '';
      if (isPlayingRadio) {
        audioRef.current.play().catch(() => {});
      }
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
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchPosts]);

  const fetchTracks = useCallback(async () => {
    try {
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
              const normalizedNotif = {
                id: notif.id || Date.now(),
                text: notif.text || notif.message || notif.title || 'Thông báo mới từ hệ thống',
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

          stompClient.subscribe(`/topic/user/${currentUserId}`, (message) => {
            if (message.body === 'FRIEND_REQUEST_RECEIVED' || message.body === 'FRIEND_REQUEST_ACCEPTED') {
              fetchFriends();
              fetchPendingFriendsCount();
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
    if (!newRoomData.name.trim()) {
      toast.error("Vui lòng nhập tên phòng!");
      return;
    }

    try {
      const response = await axiosClient.post('/rooms/create-room', {
        roomName: newRoomData.name.trim(),
        password: newRoomData.password || null
      });

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
        const entered = JSON.parse(localStorage.getItem('talovin_entered_rooms') || '[]');
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
            const entered = JSON.parse(localStorage.getItem('talovin_entered_rooms') || '[]');
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

  // Ghi nhận truy vấn tìm kiếm cho Thuật toán Thịnh hành AI (Debounced 600ms)
  useEffect(() => {
    const kw = searchKeyword.trim();
    if (kw.length < 2) return;
    const timer = setTimeout(() => {
      axiosClient.post(`/posts/track-search?keyword=${encodeURIComponent(kw)}`).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  const safePosts = Array.isArray(posts) ? posts.filter(Boolean) : [];
  const safeRooms = Array.isArray(rooms) ? rooms.filter(Boolean) : [];
  const safeFriends = Array.isArray(friends) ? friends.filter(Boolean) : [];

  const displayedPosts = safePosts
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
      if (searchKeyword && searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const matchContent = (p.content || '').toLowerCase().includes(kw);
        const matchAuthor = (p.authorNickname || p.authorAccount || '').toLowerCase().includes(kw);
        const matchVibe = (p.vibe || '').toLowerCase().includes(kw);
        return matchContent || matchAuthor || matchVibe;
      }
      return true;
    })
    .sort((a, b) => {
      if (!a || !b) return 0;
      if (activeTab === 'trending') {
        // Thuật toán AI Tính điểm Thịnh hành (Search Frequency Dominance Algorithm):
        // Xếp hạng dựa trên: Lượt tìm kiếm bài viết (Search hits * 10) + Thảo luận (Comments * 3) + Cảm xúc (Likes * 1)
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

  return (
    <div className="social-app-wrapper">
      <audio 
        ref={audioRef} 
        src={currentTrack ? currentTrack.audioSrc : ""} 
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
                {currentTrack ? currentTrack.name : "Âm nhạc hệ thống"}
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
                  {currentTrack.genre || "Bản nhạc"}
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
                <span>{dynamicMenu.saved?.label || "Đã lưu"} ({savedPostIds.length})</span>
              </button>
            )}

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
                onClick={() => setSelectedProfileUserId(currentUserId)}
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
            onClick={() => setSelectedProfileUserId(currentUserId)}
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
                onClick={togglePlayRadio} 
                className={`m-radio-pill ${isPlayingRadio ? 'active' : ''}`}
              >
                <Music size={12} />
                <span>{isPlayingRadio ? 'Đang phát' : (currentTrack ? 'Phát nhạc' : 'Âm nhạc')}</span>
              </button>
              <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="btn-header-notif">
                <Bell size={16} strokeWidth={1.5} />
                {notifications.some(n => n.unread) && <span className="notif-dot"></span>}
              </button>
            </div>
          </header>

          {/* Header Sảnh Desktop */}
          <div className="stream-header">
            <div className="stream-tabs">
              <button 
                className={`stream-tab ${activeTab === 'feed' ? 'active' : ''}`}
                onClick={() => { setActiveTab('feed'); setActiveFilterTag(null); }}
              >
                Sảnh trực tuyến
              </button>
              <button 
                className={`stream-tab ${activeTab === 'groups' ? 'active' : ''}`}
                onClick={() => { setActiveTab('groups'); setActiveFilterTag(null); }}
              >
                Cộng đồng
              </button>
              <button 
                className={`stream-tab ${activeTab === 'trending' ? 'active' : ''}`}
                onClick={() => { setActiveTab('trending'); setActiveFilterTag(null); }}
              >
                Thịnh hành
              </button>
              <button 
                className={`stream-tab ${activeTab === 'saved' ? 'active' : ''}`}
                onClick={() => { setActiveTab('saved'); setActiveFilterTag(null); }}
              >
                Đã lưu
              </button>
              <button 
                className={`stream-tab ${activeTab === 'rooms' ? 'active' : ''}`}
                onClick={() => { setActiveTab('rooms'); setActiveFilterTag(null); }}
              >
                Phòng thoại ({safeRooms.length})
              </button>
            </div>

            {/* CỤM CHUÔNG THÔNG BÁO SẢNH (Anchored Dropdown trên PC & Slide Sheet trên Mobile) */}
            <div className="notif-anchor-wrap hidden sm:block" style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)} 
                className="btn-header-notif"
                title="Thông báo sảnh"
              >
                <Bell size={15} strokeWidth={1.5} />
                {notifications.some(n => n.unread) && <span className="notif-dot"></span>}
              </button>

              {/* Dropdown Card cố định ngay dưới chuông trên Desktop */}
              {isNotifOpen && (
                <>
                  <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 90 }} 
                    onClick={() => setIsNotifOpen(false)} 
                  />
                  <div 
                    className="notif-desktop-popover animate-fade-in"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: '320px',
                      background: '#151824',
                      border: '1px solid #2c3246',
                      borderRadius: '16px',
                      boxShadow: '0 16px 40px -4px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                      zIndex: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header Dropdown */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderBottom: '1px solid #23283c',
                      background: '#11131c'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bell size={14} style={{ color: '#e2e8f0' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>Thông báo sảnh</span>
                        {notifications.filter(n => n.unread).length > 0 && (
                          <span style={{
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            padding: '1px 6px',
                            borderRadius: '9999px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}>
                            {notifications.filter(n => n.unread).length}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {notifications.length > 0 && (
                          <button 
                            onClick={() => setNotifications(prev => prev.map(n => ({ ...n, unread: false })))} 
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontWeight: 500
                            }}
                          >
                            Đã đọc hết
                          </button>
                        )}
                        <button 
                          onClick={() => setIsNotifOpen(false)} 
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            padding: '2px'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Danh sách thông báo */}
                    <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '6px' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
                          <Bell size={24} style={{ margin: '0 auto 8px auto', opacity: 0.4, color: '#64748b' }} />
                          <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#e2e8f0', margin: '0 0 4px 0' }}>Chưa có thông báo nào</p>
                          <p style={{ fontSize: '11px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                            Các lượt thả cảm xúc, lời mời kết bạn và phản hồi sẽ hiển thị ở đây.
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
                                const el = document.getElementById(`post-${n.postId}`);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              background: n.unread ? 'rgba(32, 36, 54, 0.6)' : 'transparent',
                              border: n.unread ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid transparent',
                              marginBottom: '4px',
                              transition: 'all 0.15s'
                            }}
                          >
                            <div style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: '#38bdf8',
                              marginTop: '6px',
                              flexShrink: 0,
                              opacity: n.unread ? 1 : 0
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: '12px', color: '#f1f5f9', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                {n.text}
                              </p>
                              <span style={{ fontSize: '10px', color: '#64748b', marginTop: '3px', display: 'block', fontFamily: 'monospace' }}>
                                {n.time}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Thông Báo trên Mobile (Khi mở từ thanh mobile-top-bar) */}
            {isNotifOpen && (
              <div 
                className="sm:hidden fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm animate-fade-in"
                onClick={() => setIsNotifOpen(false)}
              >
                <div 
                  className="w-full max-h-[80vh] rounded-t-3xl bg-[#151824] border-t border-[#2c3246] shadow-2xl flex flex-col overflow-hidden animate-slide-up"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between p-4 border-b border-[#23283c]">
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-zinc-200" />
                      <span className="text-sm font-bold text-white">Thông báo sảnh</span>
                      {notifications.filter(n => n.unread).length > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          {notifications.filter(n => n.unread).length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && (
                        <button 
                          onClick={() => setNotifications(prev => prev.map(n => ({ ...n, unread: false })))} 
                          className="text-zinc-400 text-xs font-mono"
                        >
                          Đã đọc hết
                        </button>
                      )}
                      <button onClick={() => setIsNotifOpen(false)} className="text-zinc-400 p-1">
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 overflow-y-auto max-h-[60vh]">
                    {notifications.length === 0 ? (
                      <div className="py-12 text-center text-zinc-400">
                        <Bell size={28} className="mx-auto mb-2 opacity-40 text-zinc-500" />
                        <p className="text-sm font-semibold text-zinc-300">Chưa có thông báo nào</p>
                        <p className="text-xs text-zinc-500 mt-1">Các lượt thả cảm xúc, lời mời kết bạn và bình luận sẽ hiển thị ở đây.</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id}
                          className="p-3 rounded-xl mb-2 bg-[#1c2030] text-xs text-zinc-200 border border-[#2c3246]"
                          onClick={() => {
                            setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, unread: false } : item));
                            setIsNotifOpen(false);
                            if (n.postId) {
                              const el = document.getElementById(`post-${n.postId}`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }}
                        >
                          <p className="font-medium text-zinc-100">{n.text}</p>
                          <span className="text-[10px] text-zinc-500 font-mono block mt-1">{n.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

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
                    placeholder="Chia sẻ một khoảnh khắc, hình ảnh hoặc ghi âm ngắn với mọi người..."
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

              {/* Chọn Vibe Tags (Động từ Admin Dashboard) */}
              <div className="vibe-tags-row">
                {dynamicVibes.map(v => {
                  const IconComponent = v.icon || Sparkles;
                  const isSelected = selectedVibe === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVibe(isSelected ? null : v.id)}
                      className={`vibe-tag-pill ${isSelected ? 'active' : ''}`}
                    >
                      <IconComponent size={13} strokeWidth={1.5} className="vibe-icon" />
                      <span>{v.label}</span>
                    </button>
                  );
                })}
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
                    title="Đính kèm ảnh hoặc video ngắn"
                  >
                    <ImageIcon size={15} strokeWidth={1.5} />
                    <span>Ảnh/Video</span>
                  </button>

                  <button 
                    type="button"
                    onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                    className={`btn-subtool ${isRecordingVoice || voiceBase64 ? 'active-rose' : ''}`}
                    title="Ghi âm giọng nói 15 giây"
                  >
                    <Mic size={15} strokeWidth={1.5} />
                    <span>{isRecordingVoice ? 'Đang thu' : (voiceBase64 ? 'Đã thu' : 'Ghi âm')}</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setShowSparkInput(!showSparkInput)}
                    className={`btn-subtool ${showSparkInput || selectedTags.length > 0 ? 'active' : ''}`}
                    title="Gắn thẻ chủ đề"
                  >
                    <Tag size={15} strokeWidth={1.5} />
                    <span>Chủ đề</span>
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
              {loadingPosts ? (
                <div className="feed-status-box font-mono">
                  <div className="feed-spinner"></div>
                  <p>Đang tải bài viết...</p>
                </div>
              ) : displayedPosts.length === 0 ? (
                <div className="feed-status-box">
                  <MessageSquare size={28} className="text-zinc-600 mb-2 mx-auto" />
                  <p className="text-zinc-400 text-sm">Chưa có bài viết nào ở chế độ xem này.</p>
                </div>
              ) : (
                displayedPosts.map((post) => {
                  const currentReaction = REACTION_EMOJIS.find(e => e.type === post.myReaction);
                  const isSaved = savedPostIds.includes(post.id);
                  const isMe = currentUserId && post.authorId?.toString() === currentUserId.toString();
                  const isFounder = post.authorVipTier === 'FOUNDER' || post.authorRoles?.includes('ROLE_ADMIN') || post.authorRoles?.includes('ROLE_AMDIN') || post.authorBadge;
                  const parsedMedia = parsePostMedia(post.imageUrl);

                  return (
                    <article key={post.id} id={`post-${post.id}`} className="post-item-card">
                      {post.groupId && (
                        <div className="post-community-header-bar flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-800/80 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-emerald-400 font-semibold flex items-center gap-1 truncate">
                              <span className="text-[10px]">✦</span>
                              <span className="text-zinc-200 hover:underline cursor-pointer" onClick={() => setActiveTab('groups')}>
                                {post.groupName || 'Cộng đồng'}
                              </span>
                            </span>
                            <span className="text-zinc-600 text-[10px]">•</span>
                            <span className="text-[11px] text-zinc-400 flex-shrink-0 font-sans">Đề xuất</span>
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
                              className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold border border-emerald-500/30 transition-all flex items-center gap-1 active:scale-95 flex-shrink-0"
                            >
                              <Plus size={11} />
                              <span>Tham gia</span>
                            </button>
                          )}
                        </div>
                      )}
                      <div className="post-header-row">
                        <div 
                          className="post-avatar-click" 
                          onClick={() => setSelectedProfileUserId(post.authorId || post.userId)}
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
                              className="author-display-name"
                              onClick={() => setSelectedProfileUserId(post.authorId || post.userId)}
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

                            {activeTab === 'trending' && (post.searchHits || 0) > 0 && (
                              <span className="font-mono text-[10px] text-zinc-300 bg-zinc-800/90 px-1.5 py-0.5 rounded border border-zinc-700/60 flex items-center gap-1" title="Lượt tìm kiếm bài viết theo thuật toán AI">
                                🔥 {post.searchHits} tìm kiếm
                              </span>
                            )}

                            {post.vibe && (
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

                      {/* Nội dung bài viết */}
                      <div className="post-body-content">
                        <p>{post.content}</p>

                        {/* Hiển thị Media: Ảnh hoặc Video ngắn tự động lặp muted + Click để mở toàn màn hình (Lightbox) */}
                        {parsedMedia.mediaUrl && (
                          <div 
                            className="post-media-frame cursor-pointer group/media relative"
                            onClick={() => setLightboxMedia({
                              url: parsedMedia.mediaUrl,
                              type: parsedMedia.mediaType,
                              author: post.authorNickname || post.authorName || post.author,
                              title: post.content
                            })}
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
                          <div className="post-voice-player-pill">
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
                        
                        {/* Reaction Popover: Luôn đặt trên nút, KHÔNG che chữ */}
                        <div className="reaction-drop-wrapper">
                          <button 
                            type="button"
                            onClick={() => handleReactPost(post.id, post.myReaction || 'HEART')}
                            onMouseEnter={() => setActiveReactionPicker(post.id)}
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
                              onMouseLeave={() => setActiveReactionPicker(null)}
                            >
                              {REACTION_EMOJIS.map(item => (
                                <button
                                  key={item.type}
                                  type="button"
                                  onClick={() => handleReactPost(post.id, item.type)}
                                  className="reaction-emoji-item"
                                  title={item.label}
                                >
                                  {item.emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Nút bình luận: Mặc định ẩn, bấm vào mới mở */}
                        <button 
                          type="button"
                          onClick={() => handleToggleComments(post.id)}
                          className="action-btn"
                          title="Bình luận"
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
                                        onClick={() => setSelectedProfileUserId(cmt.authorId)}
                                        title="Xem hồ sơ cá nhân"
                                      >
                                        <UserAvatar 
                                          avatar={cmt.authorAvatar} 
                                          name={cmt.authorNickname || cmt.authorAccount} 
                                          size={isReply ? 24 : 30} 
                                        />
                                      </div>
                                      <div className={`cmt-bubble-content ${isReply ? 'reply-bubble' : 'root-bubble'}`}>
                                        <div className="cmt-name-row">
                                          <div className="cmt-author-info">
                                            <span 
                                              className={`cmt-user-name ${isReply ? 'reply-name' : ''} cursor-pointer hover:underline`}
                                              onClick={() => setSelectedProfileUserId(cmt.authorId)}
                                            >
                                              {cmt.authorNickname || cmt.authorAccount || 'Thành viên'}
                                            </span>
                                            <span className={`cmt-user-handle ${isReply ? 'reply-handle' : ''}`}>
                                              @{cmt.authorAccount || 'user'}
                                            </span>
                                            <span className="cmt-meta-dot">·</span>
                                            <span className="cmt-time-label">{cmt.formattedTime || 'Vừa xong'}</span>
                                          </div>

                                          <div className="cmt-action-btns">
                                            {/* Nút Trả lời phản hồi */}
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
                                              title="Trả lời bình luận này"
                                            >
                                              <CornerDownRight size={11} />
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
                                              </button>
                                            )}
                                            {canDeleteCmt && (
                                              <button 
                                                type="button" 
                                                onClick={() => handleDeleteComment(post.id, cmt.id)} 
                                                className="btn-cmt-act danger"
                                                title="Xóa phản hồi"
                                              >
                                                <Trash2 size={11} />
                                              </button>
                                            )}
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
                                          <p className="cmt-body-text">
                                            {cmt.replyToUser && (
                                              <span className="cmt-mention-badge font-mono">
                                                @{cmt.replyToUser}
                                              </span>
                                            )}
                                            {cmt.content}
                                          </p>
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
                onSelectUser={setSelectedProfileUserId}
                onStartPrivateCall={handleStartPrivateCall}
                onNavigateFeed={() => setActiveTab('feed')}
              />
            </SectionErrorBoundary>
          )}

          {/* ============================================================== */}
          {/* TAB: TẤT CẢ PHÒNG ĐÀM THOẠI */}
          {/* ============================================================== */}
          {activeTab === 'rooms' && (
            <div className="rooms-section-wrapper py-2">
              <div className="rooms-header-banner flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 mb-6 gap-3 sm:gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h3 className="text-zinc-100 font-bold text-base sm:text-lg tracking-tight">Phòng Trò Chuyện & Đàm Thoại Trực Tiếp</h3>
                  </div>
                  <p className="text-zinc-400 text-xs font-sans">
                    Tham gia các không gian voice call âm thanh đa chiều độ trễ cực thấp
                  </p>
                </div>
                <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs shadow-md transition-all active:scale-95 w-full sm:w-auto">
                  <Plus size={14} strokeWidth={2} /> 
                  <span>Tạo phòng mới</span>
                </button>
              </div>

              {loadingRooms ? (
                <div className="py-16 text-center text-zinc-500 text-xs font-mono">Đang nạp danh sách phòng đàm thoại...</div>
              ) : safeRooms.length === 0 ? (
                <div className="py-16 px-4 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60">
                  <Radio size={32} className="mx-auto mb-3 text-zinc-600 opacity-60" />
                  <p className="text-zinc-400 text-sm font-medium mb-1">Chưa có phòng đàm thoại nào đang mở</p>
                  <p className="text-zinc-500 text-xs mb-4">Hãy tạo một phòng riêng để trò chuyện cùng bạn bè!</p>
                  <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-all"
                  >
                    <Plus size={13} /> Tạo phòng ngay
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {safeRooms.map(room => {
                    const joined = isUserInRoom(room);
                    return (
                      <div 
                        key={room.id} 
                        className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-md"
                        onClick={() => onRoomCardClick(room)}
                      >
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            <GroupCollageAvatar 
                              avatar={room.avatar} 
                              name={room.nameroom} 
                              members={room.userRoomDTOList || []}
                              size={48}
                              className="border border-white/10"
                            />
                            <div>
                              <h4 className="font-semibold text-zinc-100 text-sm flex items-center gap-1.5 mb-0.5">
                                {room.nameroom}
                                {room.hasPassword && <Lock size={12} className="text-zinc-500" title="Phòng có mật khẩu" />}
                              </h4>
                              <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                {room.soluong || 0} người đang trò chuyện
                              </span>
                            </div>
                          </div>

                          {joined && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                              Đã tham gia
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
                          <div className="flex -space-x-2 overflow-hidden">
                            {room.userRoomDTOList?.slice(0, 4).map((ur, idx) => (
                              <UserAvatar 
                                key={ur.id || idx}
                                avatar={ur.userDTO?.avatar}
                                name={ur.userDTO?.nickname}
                                size={24}
                                className="ring-2 ring-zinc-900"
                              />
                            ))}
                            {(room.soluong || 0) > 4 && (
                              <span className="w-6 h-6 rounded-full bg-zinc-800 border border-white/10 text-[9px] font-mono text-zinc-400 flex items-center justify-center ring-2 ring-zinc-900">
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
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1 ${joined ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80'}`}
                          >
                            <span>{joined ? 'Vào lại phòng' : 'Vào trò chuyện'}</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ============================================================== */}
        {/* CỘT 3: RIGHT DOCK (280px - 300px) */}
        {/* ============================================================== */}
        <aside className="widgets-sidebar">
          
          {/* Ô Tìm Kiếm Gọn Gàng */}
          <div className="search-input-wrap">
            <Search size={14} strokeWidth={1.5} className="search-icon-muted" />
            <input 
              type="text" 
              placeholder="Tìm kiếm nội dung, chủ đề..."
              value={searchKeyword}
              onChange={handleSearch}
            />
            {searchKeyword && (
              <button onClick={() => setSearchKeyword('')} className="btn-clear-kw"><X size={12} /></button>
            )}
          </div>

          {/* Widget 1: Kết Nối Đồng Điệu 1-1 (Resonance Matchmaker) */}
          <div className="widget-box-card">
            <div className="widget-card-title">
              <Zap size={14} className="text-emerald-400" />
              <span>Ghép Đôi Đồng Điệu 1-1</span>
            </div>
            <p className="widget-card-desc">
              Thuật toán so khớp gu âm nhạc, mục đích kết nối & tự động loại trừ chính bạn.
            </p>
            <button 
              type="button" 
              onClick={() => setIsSpeedMatchOpen(true)} 
              className="btn-widget-action"
            >
              Tìm người đồng điệu
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
          onClick={() => setSelectedProfileUserId(currentUserId)}
        >
          <User size={18} strokeWidth={1.5} />
          <span>Hồ sơ</span>
        </button>
      </nav>

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
      {isCreateModalOpen && (
        <div className="modal-veil" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title-flex">
                <Radio size={16} color="#a1a1aa" />
                <h4>Tạo Không Gian Đàm Thoại</h4>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="btn-close-dialog"><X size={15} /></button>
            </div>
            <form onSubmit={handleCreateRoom} className="dialog-form">
              <div className="dialog-field">
                <label>Tên phòng</label>
                <input 
                  type="text" 
                  placeholder="VD: Không gian trò chuyện cuối tuần"
                  value={newRoomData.name}
                  onChange={(e) => setNewRoomData({ ...newRoomData, name: e.target.value })}
                  required
                />
              </div>
              <div className="dialog-field">
                <label>Mật khẩu (Tùy chọn)</label>
                <input 
                  type="password" 
                  placeholder="Để trống nếu là phòng công khai"
                  value={newRoomData.password}
                  onChange={(e) => setNewRoomData({ ...newRoomData, password: e.target.value })}
                />
              </div>
              <div className="dialog-actions-row">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn-dialog-back">Hủy</button>
                <button type="submit" className="btn-dialog-primary">Tạo phòng</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            setSelectedProfileUserId(uid);
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
      {/* CSS DARK ZINC TOÀN DIỆN - ANTI AI-GENERATED UI */}
      {/* ============================================================== */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --social-bg: #0b0c10; /* Clean, deep slate obsidian */
          --sidebar-bg: #10121a; /* Defined navigation sidebar */
          --card-bg: #151824; /* Distinct elevated surface card */
          --card-hover: #191d2c; /* Subtle highlight on hover */
          --card-border: #2c3246; /* Crisp, clearly visible hairline frame */
          --card-border-hover: #434c6a; /* Distinct hover border */
          --card-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 2px 6px -1px rgba(0, 0, 0, 0.35);
          --card-shadow-hover: 0 10px 30px -4px rgba(0, 0, 0, 0.7), 0 4px 12px -2px rgba(0, 0, 0, 0.4);
          --input-bg: #0d0f16;
          --input-border: #282e42;
          --text-main: #f8fafc; /* Crisp white for titles */
          --text-body: #e2e8f0; /* High-contrast, very readable body */
          --text-muted: #94a3b8; /* Slate 400 */
          --text-subtle: #64748b; /* Slate 500 */
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

        /* ================= CỘT 2: STREAM CHÍNH ================= */
        .main-stream {
          flex: 1;
          max-width: 780px;
          min-width: 520px;
          border-right: 1px solid var(--card-border);
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
          background: rgba(16, 18, 26, 0.95);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--card-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px;
          z-index: 30;
        }
        .stream-tabs {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .stream-tabs::-webkit-scrollbar { display: none; }
        .stream-tab {
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .stream-tab:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.05);
        }
        .stream-tab.active {
          background: #23283c;
          border: 1px solid #3b4360;
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
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

        /* KHU VỰC B: BỘ TẠO TÍN HIỆU ĐA PHƯƠNG TIỆN */
        .post-creator-box {
          margin: 16px 16px 18px;
          padding: 20px;
          border: 1px solid var(--card-border);
          border-radius: 16px;
          background: var(--card-bg);
          box-shadow: var(--card-shadow);
          transition: border-color 0.2s ease;
        }
        .post-creator-box:hover {
          border-color: var(--card-border-hover);
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
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 12px;
          padding: 12px 14px;
          color: #f8fafc;
          font-size: 13.5px;
          font-family: inherit;
          resize: none;
          outline: none;
          line-height: 1.5;
          box-sizing: border-box;
          transition: border-color 0.15s, background 0.15s;
        }
        .creator-field-wrap textarea:focus {
          border-color: #4b5568;
          background: #090a10;
        }
        .creator-field-wrap textarea::placeholder { color: #64748b; }

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
          background: #1c2030;
          border: 1px solid #2d344d;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .vibe-tag-pill:hover {
          background: #252a3f;
          color: #ffffff;
          border-color: #414b6e;
        }
        .vibe-tag-pill.active {
          background: #2b334d;
          border-color: #60a5fa;
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

        /* Nút CTA Đăng bài: Nền Emerald rực rỡ - Đầy tương phản & phân cấp rõ ràng */
        .btn-publish-submit {
          background: #10b981;
          color: #022c22;
          border: none;
          padding: 7px 18px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 3px 12px rgba(16, 185, 129, 0.28);
          white-space: nowrap;
          flex-shrink: 0;
          min-width: max-content;
        }
        .btn-publish-submit:hover:not(:disabled) {
          background: #34d399;
          transform: translateY(-1px);
          box-shadow: 0 5px 16px rgba(16, 185, 129, 0.38);
        }
        .btn-publish-submit:active:not(:disabled) {
          transform: scale(0.96);
        }
        .btn-publish-submit:disabled {
          background: #1c202d;
          color: #525a70;
          border: 1px solid #282f42;
          box-shadow: none;
          cursor: not-allowed;
          opacity: 0.7;
        }

        /* ================= THẺ BÀI VIẾT (TALOVIN HIGH-CONTRAST CARD) ================= */
        .post-item-card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          margin: 0 16px 18px 16px;
          padding: 20px 22px 18px 22px;
          box-shadow: var(--card-shadow);
          position: relative;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .post-item-card:hover {
          border-color: var(--card-border-hover);
          background: var(--card-hover);
          transform: translateY(-2px);
          box-shadow: var(--card-shadow-hover);
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
          color: #94a3b8;
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
          color: #ffffff;
          background: rgba(255, 255, 255, 0.06);
        }
        .action-btn.active-liked { color: #f87171; }

        /* REACTION POPOVER: NẰM GỌN TRÊN NÚT, KHÔNG CHE CHỮ */
        .reactions-popup-menu {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          background: #1c2030;
          border: 1px solid #3b4360;
          border-radius: 10px;
          padding: 5px 8px;
          box-shadow: 0 20px 30px -5px rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          gap: 6px;
          z-index: 50;
          animation: fadeInReaction 0.15s ease-out;
        }
        @keyframes fadeInReaction {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .reaction-emoji-item {
          background: transparent;
          border: none;
          font-size: 18px;
          cursor: pointer;
          padding: 3px 5px;
          border-radius: 6px;
          line-height: 1;
          transition: transform 0.15s ease;
        }
        .reaction-emoji-item:hover {
          transform: scale(1.3);
          background: rgba(255, 255, 255, 0.08);
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
          padding-left: 20px;
          border-left: 2px solid #282f44;
          display: flex;
          flex-direction: column;
          gap: 8px;
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
          left: -20px;
          top: 14px;
          width: 14px;
          height: 2px;
          background: #282f44;
          border-bottom-left-radius: 4px;
        }

        /* Bong bóng bình luận gốc: Rõ ràng, nổi khối */
        .cmt-bubble-content {
          border-radius: 12px;
          flex: 1;
          min-width: 0;
          transition: border-color 0.15s;
        }
        .cmt-bubble-content.root-bubble {
          background: #181c2a;
          border: 1px solid #2d354d;
          padding: 10px 14px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }
        .cmt-bubble-content.root-bubble:hover {
          border-color: #434c6a;
        }

        /* Bong bóng phản hồi con: Thon gọn, phân tầng cấp 2 */
        .cmt-bubble-content.reply-bubble {
          background: #131622;
          border: 1px solid #242a3c;
          padding: 8px 12px;
        }
        .cmt-bubble-content.reply-bubble:hover {
          border-color: #38425d;
        }

        .cmt-name-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
          gap: 8px;
        }
        .cmt-author-info {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .cmt-user-name {
          font-size: 12.5px;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: -0.01em;
        }
        .cmt-user-name.reply-name {
          font-size: 12px;
          font-weight: 600;
          color: #e2e8f0;
        }
        .cmt-user-handle {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          color: #8b9bb4;
        }
        .cmt-user-handle.reply-handle {
          font-size: 10.5px;
          color: #64748b;
        }
        .cmt-meta-dot {
          color: #475569;
          font-weight: bold;
          font-size: 11px;
          user-select: none;
        }
        .cmt-time-label {
          font-size: 10.5px;
          color: #64748b;
          font-family: ui-monospace, SFMono-Regular, monospace;
        }

        .cmt-body-text {
          margin: 0;
          font-size: 13px;
          color: #e2e8f0;
          line-height: 1.5;
          word-break: break-word;
        }
        .cmt-mention-badge {
          display: inline-flex;
          align-items: center;
          color: #38bdf8;
          font-size: 11px;
          background: rgba(56, 189, 248, 0.12);
          padding: 1px 7px;
          border-radius: 5px;
          border: 1px solid rgba(56, 189, 248, 0.28);
          margin-right: 6px;
          user-select: none;
          font-weight: 600;
        }
        .cmt-action-btns {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
        }
        .btn-cmt-act {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 3px 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          transition: all 0.15s;
        }
        .btn-cmt-act:hover { color: #f8fafc; background: rgba(255, 255, 255, 0.06); }
        .btn-cmt-act.reply:hover { color: #38bdf8; }
        .btn-cmt-act.danger:hover { color: #f87171; }

        .replying-to-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #202436;
          border: 1px solid #333a52;
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
            padding-bottom: calc(96px + env(safe-area-inset-bottom, 24px)); 
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
