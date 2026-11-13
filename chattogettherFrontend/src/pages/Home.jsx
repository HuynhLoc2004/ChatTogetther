import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, LogOut, Plus, MessageSquare, Shield, User, X, Lock, Hash, 
  CheckCircle, ArrowRight, WifiOff, Heart, MessageCircle, Share2, 
  Search, Sparkles, Send, Copy, Compass, Radio, ChevronRight, CornerDownRight,
  Bell, Bookmark, Flame, Gem, Crown, Volume2, VolumeX, Music, Play, Pause,
  Shuffle, Wand2, Smile, Image as ImageIcon, Filter, CheckCircle2, Zap,
  TrendingUp, Dices, Gift, ExternalLink
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import { saveRoomsOffline, getRoomsOffline } from '../utils/offlineDB';
import UserProfileModal from './UserProfileModal';
import FriendsModal from './FriendsModal';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import toast from 'react-hot-toast';

// Danh sách các biểu tượng cảm xúc (Emoji Reactions phong cách mạng xã hội)
const REACTION_EMOJIS = [
  { type: 'HEART', emoji: '❤️', label: 'Yêu thích', color: '#ef4444' },
  { type: 'FIRE', emoji: '🔥', label: 'Siêu cháy', color: '#f97316' },
  { type: 'HAHA', emoji: '😂', label: 'Haha', color: '#eab308' },
  { type: 'WOW', emoji: '😮', label: 'Wow', color: '#06b6d4' },
  { type: 'LIKE', emoji: '👍', label: 'Thích', color: '#3b82f6' },
  { type: 'CROWN', emoji: '👑', label: 'Đỉnh chóp', color: '#fbbf24' },
];

// Danh sách tâm trạng / Vibe bài viết
const VIBE_TAGS = [
  { id: 'lofi', label: '🎧 Đang chill Lo-Fi', bg: 'rgba(99, 102, 241, 0.2)', text: '#818cf8' },
  { id: 'energy', label: '🔥 Hào hứng', bg: 'rgba(249, 115, 22, 0.2)', text: '#fb923c' },
  { id: 'night', label: '🌙 Chill đêm muộn', bg: 'rgba(168, 85, 247, 0.2)', text: '#c084fc' },
  { id: 'gaming', label: '🎮 Tìm đồng đội game', bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399' },
  { id: 'deep', label: '💭 Góc tâm sự', bg: 'rgba(236, 72, 153, 0.2)', text: '#f472b6' },
];

// Danh sách kênh Radio Lo-Fi trực tiếp
const RADIO_CHANNELS = [
  { name: 'Lo-Fi Chill Cafe', genre: 'Chill Beats', audioSrc: 'https://stream.zeno.fm/f3wvbbqmdg8uv' },
  { name: 'Cyber Synthwave 80s', genre: 'Retro Neon', audioSrc: 'https://stream.zeno.fm/0r0xa792kwzuv' },
  { name: 'Acoustic Rain Study', genre: 'Ambient Calm', audioSrc: 'https://stream.zeno.fm/e0r45u72kwzuv' },
];

// Danh sách Story mẫu phong cách Instagram / Facebook
const INITIAL_STORIES = [
  { id: 'my-story', isSelf: true, author: 'Bạn', avatar: 'T', time: 'Mới xong', seen: false },
  { id: 1, author: 'Minh Thư ✨', avatar: 'M', time: '15p trước', tag: '☕ Cafe chill', seen: false, content: 'Cuối tuần rồi, có ai muốn làm cốc trà chiều không?', bg: 'linear-gradient(135deg, #ec4899, #8b5cf6)' },
  { id: 2, author: 'Hoàng Nam 🎮', avatar: 'H', time: '1h trước', tag: '🔥 Valorant', seen: false, content: 'Đang thiếu 1 slot rank Kim Cương, ai vào gánh với!', bg: 'linear-gradient(135deg, #3b82f6, #06b6d4)' },
  { id: 3, author: 'Admin Vũ 👑', avatar: 'V', time: '3h trước', tag: '💎 Bản cập nhật', seen: false, content: 'Hệ thống đã nâng cấp toàn diện: Đặc quyền VIP, Lo-Fi Radio, Thả emoji!', bg: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
  { id: 4, author: 'Bảo Ngọc 🌸', avatar: 'B', time: '5h trước', tag: '🎧 Lo-Fi Beats', seen: true, content: 'Nghe list nhạc này làm việc cả đêm không thấy mệt luôn á.', bg: 'linear-gradient(135deg, #10b981, #6366f1)' },
];

// Danh sách câu hỏi Vòng quay thử thách (Party Wheel)
const TRUTH_OR_DARE_QUESTIONS = [
  "Thú nhận: Điều ngớ ngẩn nhất bạn từng làm khi thích một ai đó?",
  "Thử thách: Hát 1 câu bất kỳ bằng giọng ngọng trong 10 giây!",
  "Thú nhận: Bạn có đang crush ai trong danh sách bạn bè này không?",
  "Thử thách: Đổi biệt danh hiển thị thành 'Siêu Nhân Heo' trong 1 tiếng!",
  "Thú nhận: Món đồ đắt nhất bạn mua nhưng chưa từng dùng đến?",
  "Thử thách: Gửi 1 lời nhắn chúc ngủ ngon cho người thứ 3 trong danh sách bạn bè!",
];

const Home = () => {
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem('user_id');

  // Navigation tab chính: 'feed' | 'rooms' | 'trending' | 'saved'
  const [activeTab, setActiveTab] = useState('feed');

  // State Dữ liệu Phòng Chat
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [newRoomData, setNewRoomData] = useState({ name: '', password: '', nickname: '' });
  const [joinData, setJoinData] = useState({ nickname: '', password: '' });

  // State Dữ liệu Mạng Xã Hội (Feed & Posts)
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedVibe, setSelectedVibe] = useState(null);
  const [postImageUrl, setPostImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [activeReactionPicker, setActiveReactionPicker] = useState(null); // ID bài viết đang mở bảng emoji

  // Bình luận
  const [expandedComments, setExpandedComments] = useState({});
  const [commentsMap, setCommentsMap] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});

  // Bài viết đã lưu (Bookmarks)
  const [savedPostIds, setSavedPostIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('saved_post_ids') || '[]');
    } catch {
      return [];
    }
  });

  // Stories
  const [stories, setStories] = useState(INITIAL_STORIES);
  const [activeStory, setActiveStory] = useState(null);

  // Đột Phá 1: Cyber Vibe Radio (Nghe nhạc chung)
  const [isPlayingRadio, setIsPlayingRadio] = useState(false);
  const [currentRadioIndex, setCurrentRadioIndex] = useState(0);
  const [radioVolume, setRadioVolume] = useState(0.5);
  const audioRef = useRef(null);

  // Đột Phá 2: Speed Vibe Match (Ghép đôi ngẫu nhiên)
  const [isSpeedMatchOpen, setIsSpeedMatchOpen] = useState(false);
  const [matchingStatus, setMatchingStatus] = useState('idle'); // 'idle' | 'searching' | 'matched'
  const [matchedPartner, setMatchedPartner] = useState(null);

  // Đột Phá 3: Mini Social Party Wheel (Vòng quay thử thách)
  const [isPartyWheelOpen, setIsPartyWheelOpen] = useState(false);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelResult, setWheelResult] = useState(null);

  // Modals & Menu
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [sharePost, setSharePost] = useState(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Minh Thư đã thả tim 🔥 bài viết của bạn', time: '5p trước', unread: true },
    { id: 2, text: 'Hoàng Nam vừa tham gia phòng chat "Lo-Fi Cuối Tuần"', time: '20p trước', unread: true },
    { id: 3, text: 'Bạn vừa nhận được đặc quyền VIP Kim Cương 💎', time: '1h trước', unread: false },
  ]);

  const newPostInputRef = useRef(null);

  // ====================== PHÒNG TRÒ CHUYỆN ======================
  const isUserInRoom = (room) => {
    if (!currentUserId || !room?.userRoomDTOList) return false;
    return room.userRoomDTOList.some(ur => ur.userDTO?.id?.toString() === currentUserId.toString());
  };

  const checkActiveRoom = async () => {
    if (sessionStorage.getItem('hasCheckedActiveRoom')) return false;
    try {
      const response = await axiosClient.get('/users/active-room');
      if (response.data && response.data.data) {
        sessionStorage.setItem('hasCheckedActiveRoom', 'true');
        navigate(`/room/${response.data.data}`);
        return true;
      }
    } catch (err) {
      console.error("Lỗi khi kiểm tra phòng hoạt động:", err);
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
      if (!isSilent) setLoadingPosts(true);
      const response = await axiosClient.get('/posts');
      if (response.data?.data) {
        setPosts(response.data.data);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách bài viết:", err);
    } finally {
      if (!isSilent) setLoadingPosts(false);
    }
  }, []);

  const handleCreatePost = async (e) => {
    if (e) e.preventDefault();
    const content = newPostContent.trim();
    if (!content) {
      toast.error("Vui lòng viết nội dung bài đăng!");
      return;
    }

    if (!navigator.onLine) {
      toast.error("Cần kết nối mạng để đăng bài viết!");
      return;
    }

    try {
      setIsPosting(true);
      const payload = {
        content,
        imageUrl: postImageUrl.trim() || null,
        vibe: selectedVibe?.label || null,
      };

      const res = await axiosClient.post('/posts', payload);
      if (res.data?.data) {
        setPosts(prev => [res.data.data, ...prev]);
        setNewPostContent('');
        setSelectedVibe(null);
        setPostImageUrl('');
        setShowImageInput(false);
        toast.success("Đăng bài viết thành công! ✨", { icon: '🚀' });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể đăng bài viết!");
    } finally {
      setIsPosting(false);
    }
  };

  // AI Vibe Assistant: Tự động biến đổi phong cách bài viết
  const handleAIEnhancePost = () => {
    if (!newPostContent.trim()) {
      const templates = [
        "Cuối tuần rồi, chúc mọi người có những phút giây thật thảnh thơi và tích cực nhé! ☕✨",
        "Có những ngày chỉ muốn nghe một bản nhạc quen, ngồi góc cafe yên tĩnh và ngắm phố xá trôi chậm lại... 🎧🌆",
        "Đồng đội ơi tối nay lập team phá đảo thế giới ảo không nào? Bắn tín hiệu ngay nha! 🎮🔥",
        "Hôm nay bạn đã tự thưởng cho bản thân một cốc trà sữa hay điều gì ngọt ngào chưa? 🧋🌸"
      ];
      const randomText = templates[Math.floor(Math.random() * templates.length)];
      setNewPostContent(randomText);
      setSelectedVibe(VIBE_TAGS[0]);
      toast.success("AI đã gợi ý 1 bài đăng cực cuốn!", { icon: '✨' });
    } else {
      const styles = [
        `"${newPostContent.trim()}" ✨ Chill vibe cùng Chat Together nào cả nhà!`,
        `Góc tâm sự: ${newPostContent.trim()} 🔥 Mọi người thấy sao về điều này?`,
        `${newPostContent.trim()} 💫 Cứ bình thản mà sống, việc gì đến sẽ đến!`
      ];
      setNewPostContent(styles[Math.floor(Math.random() * styles.length)]);
      toast.success("AI đã làm bài viết sinh động hơn!", { icon: '🪄' });
    }
  };

  // Thả Cảm Xúc / Emoji Reaction (Facebook Style)
  const handleReactPost = async (postId, reactionType = 'HEART') => {
    setActiveReactionPicker(null);
    try {
      const res = await axiosClient.post(`/posts/${postId}/like`, null, {
        params: { type: reactionType }
      });
      if (res.data?.data) {
        const updated = res.data.data;
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          likesCount: updated.likesCount,
          isLikedByMe: updated.isLikedByMe,
          myReaction: updated.myReaction
        } : p));
      }
    } catch (err) {
      toast.error("Không thể thao tác thả cảm xúc!");
    }
  };

  const handleToggleComments = async (postId) => {
    const isCurrentlyOpen = expandedComments[postId];
    setExpandedComments(prev => ({ ...prev, [postId]: !isCurrentlyOpen }));

    if (!isCurrentlyOpen && !commentsMap[postId]) {
      try {
        const res = await axiosClient.get(`/posts/${postId}/comments`);
        if (res.data?.data) {
          setCommentsMap(prev => ({ ...prev, [postId]: res.data.data }));
        }
      } catch (err) {
        console.error("Lỗi tải bình luận:", err);
      }
    }
  };

  const handleAddComment = async (e, postId) => {
    e.preventDefault();
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    try {
      setSubmittingComment(prev => ({ ...prev, [postId]: true }));
      const res = await axiosClient.post(`/posts/${postId}/comments`, { content: text });
      if (res.data?.data) {
        const newCmt = res.data.data;
        setCommentsMap(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), newCmt]
        }));
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          commentsCount: (p.commentsCount || 0) + 1
        } : p));
        toast.success("Đã gửi bình luận!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi bình luận!");
    } finally {
      setSubmittingComment(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Lưu / Bỏ lưu bài viết (Bookmarks)
  const handleToggleSavePost = (postId) => {
    setSavedPostIds(prev => {
      let updated;
      if (prev.includes(postId)) {
        updated = prev.filter(id => id !== postId);
        toast("Đã bỏ lưu bài viết", { icon: '🗑️' });
      } else {
        updated = [...prev, postId];
        toast.success("Đã lưu vào danh sách đọc sau!", { icon: '🔖' });
      }
      localStorage.setItem('saved_post_ids', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const kw = searchKeyword.trim();
    if (!kw) {
      fetchPosts();
      return;
    }

    try {
      setSearching(true);
      const res = await axiosClient.get('/posts/search', {
        params: { keyword: kw }
      });
      if (res.data?.data) {
        setPosts(res.data.data);
      }
    } catch (err) {
      toast.error("Lỗi khi tìm kiếm bài viết!");
    } finally {
      setSearching(false);
    }
  };

  // ====================== ĐỘT PHÁ 1: LO-FI RADIO ======================
  const togglePlayRadio = () => {
    if (!audioRef.current) return;
    if (isPlayingRadio) {
      audioRef.current.pause();
      setIsPlayingRadio(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingRadio(true);
        toast.success(`Đang phát: ${RADIO_CHANNELS[currentRadioIndex].name}`, { icon: '🎧' });
      }).catch(err => {
        console.warn("Không thể phát radio:", err);
        toast.error("Không thể phát đài radio lúc này!");
      });
    }
  };

  const handleNextRadioChannel = () => {
    const nextIdx = (currentRadioIndex + 1) % RADIO_CHANNELS.length;
    setCurrentRadioIndex(nextIdx);
    if (audioRef.current) {
      audioRef.current.src = RADIO_CHANNELS[nextIdx].audioSrc;
      if (isPlayingRadio) {
        audioRef.current.play().catch(() => {});
        toast.success(`Chuyển kênh: ${RADIO_CHANNELS[nextIdx].name}`, { icon: '📻' });
      }
    }
  };

  // ====================== ĐỘT PHÁ 2: SPEED VIBE MATCH ======================
  const handleStartSpeedMatch = () => {
    setIsSpeedMatchOpen(true);
    setMatchingStatus('searching');
    setTimeout(() => {
      setMatchingStatus('matched');
      setMatchedPartner({
        nickname: 'VibeSoul_' + Math.floor(100 + Math.random() * 900),
        vibe: 'Đang nghe Lo-Fi & muốn tìm bạn trò chuyện chill',
        icebreaker: 'Nếu được chọn 1 siêu năng lực ngay bây giờ, bạn sẽ chọn gì?'
      });
    }, 2000);
  };

  // ====================== ĐỘT PHÁ 3: PARTY WHEEL ======================
  const handleSpinPartyWheel = () => {
    if (wheelSpinning) return;
    setWheelSpinning(true);
    setWheelResult(null);
    setTimeout(() => {
      const q = TRUTH_OR_DARE_QUESTIONS[Math.floor(Math.random() * TRUTH_OR_DARE_QUESTIONS.length)];
      setWheelResult(q);
      setWheelSpinning(false);
    }, 1500);
  };

  // Chia sẻ bài viết
  const handleCopyPostLink = (post) => {
    const url = `${window.location.origin}/#post-${post.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Đã sao chép liên kết bài viết!");
    setSharePost(null);
  };

  // ====================== EFFECTS ======================
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchRooms(true);
      fetchPosts(true);
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast("Đang ngoại tuyến. Đang hiển thị dữ liệu lưu trong máy.", { icon: '📶' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchPosts]);

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
      checkActiveRoom();
    };

    init();

    // WebSocket lắng nghe cập nhật realtime
    let stompClient = null;
    try {
      const socketUrl = BACKEND_URL ? `${BACKEND_URL}/ws-gs-guide` : '/ws-gs-guide';
      const socket = new SockJS(socketUrl);
      stompClient = Stomp.over(socket);
      stompClient.debug = null;

      stompClient.connect({}, () => {
        if (!isMounted) return;
        stompClient.subscribe('/topic/rooms', () => fetchRooms(true));
        stompClient.subscribe('/topic/posts', () => fetchPosts(true));
      }, (err) => {
        console.warn("WebSocket notice:", err);
      });
    } catch (wsErr) {
      console.warn("WebSocket init error:", wsErr);
    }

    return () => {
      isMounted = false;
      try {
        if (stompClient && stompClient.connected) {
          stompClient.disconnect(() => {});
        }
      } catch (_) {}
    };
  }, [fetchPosts]);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    toast.success("Đã đăng xuất tài khoản!");
    navigate('/login');
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomData.name.trim()) {
      toast.error("Vui lòng nhập tên phòng chat!");
      return;
    }

    try {
      const response = await axiosClient.post('/rooms/create-room', {
        roomName: newRoomData.name.trim(),
        password: newRoomData.password || null
      });

      if (response.data && response.data.data) {
        const resData = response.data.data;
        if (resData.accessToken) {
          localStorage.setItem('accesstoken', resData.accessToken);
        }
        toast.success("Tạo phòng thành công!");
        setIsCreateModalOpen(false);
        setNewRoomData({ name: '', password: '', nickname: '' });
        navigate(`/room/${resData.roomId}`);
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
        password: joinData.password || null
      }, {
        params: { idRoom: selectedRoom.id }
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

  // Lọc bài viết theo Tab
  const displayedPosts = posts.filter(p => {
    if (activeTab === 'saved') return savedPostIds.includes(p.id);
    if (activeTab === 'trending') return (p.likesCount || 0) > 0 || (p.commentsCount || 0) > 0;
    return true;
  });

  return (
    <div className="social-app-wrapper">
      {/* Audio Element cho Lo-Fi Radio */}
      <audio 
        ref={audioRef} 
        src={RADIO_CHANNELS[currentRadioIndex].audioSrc} 
        preload="none"
      />

      {/* ============================================================== */}
      {/* CỘT 1: THANH ĐIỀU HƯỚNG TRÁI (NAV RAIL DESKTOP) */}
      {/* ============================================================== */}
      <aside className="nav-sidebar">
        <div className="nav-brand" onClick={() => setActiveTab('feed')}>
          <div className="brand-logo-glow">
            <MessageSquare size={22} color="white" />
          </div>
          <div className="brand-text-block">
            <span className="brand-name">Chat Together</span>
            <span className="brand-badge-vip"><Crown size={10} /> Next-Gen Social</span>
          </div>
        </div>

        {/* Cyber Radio Mini-Player trên thanh điều hướng */}
        <div className="sidebar-radio-card">
          <div className="radio-header">
            <div className="radio-title-row">
              <Music size={14} className={isPlayingRadio ? "icon-spin" : ""} color="#818cf8" />
              <span className="radio-channel-name">{RADIO_CHANNELS[currentRadioIndex].name}</span>
            </div>
            {isPlayingRadio && (
              <div className="sound-wave-bars">
                <span></span><span></span><span></span><span></span>
              </div>
            )}
          </div>
          <div className="radio-controls-row">
            <button onClick={togglePlayRadio} className="btn-radio-play" title={isPlayingRadio ? "Tạm dừng" : "Phát nhạc"}>
              {isPlayingRadio ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={handleNextRadioChannel} className="btn-radio-shuffle" title="Đổi kênh khác">
              <Shuffle size={13} />
            </button>
            <span className="radio-genre-tag">{RADIO_CHANNELS[currentRadioIndex].genre}</span>
          </div>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            <Compass size={19} />
            <span>Bảng tin</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            <Radio size={19} />
            <span>Phòng chat ({rooms.length})</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'trending' ? 'active' : ''}`}
            onClick={() => setActiveTab('trending')}
          >
            <Flame size={19} color="#f97316" />
            <span>Thịnh hành 🔥</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => setActiveTab('saved')}
          >
            <Bookmark size={19} />
            <span>Đã lưu ({savedPostIds.length})</span>
          </button>

          <button 
            className="nav-item"
            onClick={() => setIsFriendsOpen(true)}
          >
            <Users size={19} />
            <span>Bạn bè</span>
          </button>

          <button 
            className="nav-item nav-item-vip"
            onClick={() => setSelectedProfileUserId(currentUserId)}
          >
            <Crown size={19} color="#fbbf24" />
            <span>Đặc quyền & Hồ sơ</span>
          </button>
        </nav>

        {/* Nút hành động tính năng Đột phá */}
        <div className="nav-action-box">
          <button 
            className="btn-speed-match"
            onClick={handleStartSpeedMatch}
            title="Ghép ngẫu nhiên với 1 người bạn online cùng vibe"
          >
            <Zap size={16} />
            <span>⚡ Ghép Vibe Nhanh</span>
          </button>

          <button 
            className="btn-party-wheel"
            onClick={() => setIsPartyWheelOpen(true)}
            title="Mở vòng quay thử thách giải trí"
          >
            <Dices size={16} />
            <span>🎮 Vòng Quay Party</span>
          </button>

          <button 
            className="btn-create-post-nav"
            onClick={() => {
              setActiveTab('feed');
              setTimeout(() => newPostInputRef.current?.focus(), 100);
            }}
          >
            <Sparkles size={16} />
            <span>Đăng bài mới</span>
          </button>

          <button 
            className="btn-create-room-nav"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={16} />
            <span>Tạo phòng</span>
          </button>
        </div>

        <div className="nav-footer">
          <button onClick={handleLogout} className="btn-logout-nav" title="Đăng xuất">
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* CỘT 2: LUỒNG CHÍNH (MAIN STREAM FEED / ROOMS) */}
      {/* ============================================================== */}
      <main className="main-stream">
        {/* Top App Bar trên Mobile */}
        <div className="mobile-top-bar">
          <div className="m-brand" onClick={() => setActiveTab('feed')}>
            <div className="brand-logo-glow m-logo">
              <MessageSquare size={18} color="white" />
            </div>
            <span className="m-title">Chat Together</span>
          </div>

          <div className="m-actions">
            <button onClick={togglePlayRadio} className={`m-radio-pill ${isPlayingRadio ? 'active' : ''}`}>
              <Music size={14} />
              <span>{isPlayingRadio ? 'Đang phát' : 'Radio'}</span>
            </button>
            <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="m-icon-btn">
              <Bell size={18} />
              {notifications.some(n => n.unread) && <span className="m-notif-dot"></span>}
            </button>
            <div 
              className="m-user-avatar"
              onClick={() => setSelectedProfileUserId(currentUserId)}
            >
              {localStorage.getItem('nickname')?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </div>

        {isOffline && (
          <div className="offline-stream-banner">
            <WifiOff size={16} />
            <span>Bạn đang ngoại tuyến. Đang hiển thị dữ liệu đã lưu trong máy.</span>
          </div>
        )}

        {/* Header Tabs Bộ Lọc Bảng Tin */}
        <header className="stream-header">
          <div className="stream-tabs">
            <button 
              className={`stream-tab ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              Dành cho bạn
            </button>
            <button 
              className={`stream-tab ${activeTab === 'trending' ? 'active' : ''}`}
              onClick={() => setActiveTab('trending')}
            >
              <Flame size={15} color="#f97316" /> Thịnh hành
            </button>
            <button 
              className={`stream-tab ${activeTab === 'saved' ? 'active' : ''}`}
              onClick={() => setActiveTab('saved')}
            >
              <Bookmark size={15} /> Đã lưu
            </button>
            <button 
              className={`stream-tab ${activeTab === 'rooms' ? 'active' : ''}`}
              onClick={() => setActiveTab('rooms')}
            >
              <Radio size={15} /> Phòng chat ({rooms.length})
            </button>
          </div>

          <div className="stream-header-actions">
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)} 
              className="btn-header-notif" 
              title="Thông báo"
            >
              <Bell size={18} />
              {notifications.some(n => n.unread) && (
                <span className="notif-badge-pill">{notifications.filter(n => n.unread).length}</span>
              )}
            </button>
          </div>
        </header>

        {/* DROPDOWN TRUNG TÂM THÔNG BÁO */}
        {isNotifOpen && (
          <div className="notif-dropdown-card">
            <div className="notif-header">
              <h4>Thông báo mới</h4>
              <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, unread: false })))} className="btn-read-all">
                Đánh dấu đã đọc
              </button>
            </div>
            <div className="notif-list">
              {notifications.map(n => (
                <div key={n.id} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                  <div className="notif-icon-circle">
                    <Sparkles size={14} color="#818cf8" />
                  </div>
                  <div className="notif-content">
                    <p>{n.text}</p>
                    <span>{n.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NỘI DUNG 1: BẢNG TIN MẠNG XÃ HỘI (FEED) */}
        {activeTab !== 'rooms' && (
          <div className="feed-container">
            {/* ========================================== */}
            {/* STORIES / KHOẢNG KHẮC 24H BAR */}
            {/* ========================================== */}
            <div className="stories-bar-container">
              <div className="stories-scroll">
                {/* Story của bạn */}
                <div 
                  className="story-item story-create-item"
                  onClick={() => toast.success("Tính năng đăng khoảnh khắc Story 24h đang chuẩn bị mở!", { icon: '📸' })}
                >
                  <div className="story-avatar-wrap add-story-wrap">
                    <div className="story-avatar-inner">
                      {localStorage.getItem('nickname')?.charAt(0).toUpperCase() || 'T'}
                    </div>
                    <span className="add-story-plus"><Plus size={12} /></span>
                  </div>
                  <span className="story-author-name">Tạo tin</span>
                </div>

                {/* Các Story của cộng đồng */}
                {stories.filter(s => !s.isSelf).map(st => (
                  <div 
                    key={st.id} 
                    className="story-item"
                    onClick={() => setActiveStory(st)}
                  >
                    <div className={`story-avatar-wrap ${st.seen ? 'seen' : 'unseen'}`}>
                      <div className="story-avatar-inner" style={{ background: st.bg }}>
                        {st.avatar}
                      </div>
                    </div>
                    <span className="story-author-name">{st.author.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ========================================== */}
            {/* HỘP ĐĂNG BÀI VIẾT CAO CẤP */}
            {/* ========================================== */}
            <div className="post-creator-card">
              <div className="creator-header-row">
                <div className="creator-avatar">
                  {localStorage.getItem('nickname')?.charAt(0).toUpperCase() || "T"}
                </div>
                <div className="creator-greeting">
                  <span className="greeting-name">{localStorage.getItem('nickname') || "Bạn"}</span>
                  <span className="greeting-sub">Chia sẻ suy nghĩ, âm nhạc hay tìm cạ nói chuyện...</span>
                </div>
                {/* Nút AI Wingman */}
                <button 
                  type="button" 
                  onClick={handleAIEnhancePost}
                  className="btn-ai-magic"
                  title="Để AI gợi ý ý tưởng hoặc làm bài viết hay hơn"
                >
                  <Wand2 size={14} />
                  <span>AI Gợi ý</span>
                </button>
              </div>

              <form onSubmit={handleCreatePost} className="creator-form">
                <textarea 
                  ref={newPostInputRef}
                  rows="3"
                  placeholder="Hôm nay bạn có cảm xúc, câu chuyện hay điều gì thú vị muốn lan tỏa cùng mọi người?..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                />

                {/* Vibe Selector Pills */}
                <div className="vibe-tags-row">
                  <span className="vibe-label">Tâm trạng:</span>
                  {VIBE_TAGS.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVibe(selectedVibe?.id === v.id ? null : v)}
                      className={`vibe-tag-pill ${selectedVibe?.id === v.id ? 'active' : ''}`}
                      style={{
                        background: selectedVibe?.id === v.id ? v.text : v.bg,
                        color: selectedVibe?.id === v.id ? '#090d16' : v.text,
                        borderColor: v.text
                      }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                {/* Ô đính kèm ảnh (nếu mở) */}
                {showImageInput && (
                  <div className="image-input-box">
                    <ImageIcon size={16} className="img-icon" />
                    <input 
                      type="url"
                      placeholder="Dán đường dẫn ảnh trực tiếp (VD: https://images.unsplash.com/...)"
                      value={postImageUrl}
                      onChange={(e) => setPostImageUrl(e.target.value)}
                    />
                    {postImageUrl && (
                      <button type="button" onClick={() => setPostImageUrl('')} className="btn-clear-img">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}

                {postImageUrl && (
                  <div className="image-preview-box">
                    <img src={postImageUrl} alt="Preview" onError={() => toast.error("Đường dẫn ảnh không tải được!")} />
                  </div>
                )}

                <div className="creator-footer">
                  <div className="creator-tools">
                    <button 
                      type="button" 
                      onClick={() => setShowImageInput(!showImageInput)} 
                      className={`btn-tool ${showImageInput ? 'active' : ''}`}
                      title="Chèn ảnh"
                    >
                      <ImageIcon size={17} />
                      <span>{showImageInput ? 'Đóng ảnh' : 'Đính kèm ảnh'}</span>
                    </button>
                  </div>

                  <button 
                    type="submit" 
                    disabled={!newPostContent.trim() || isPosting}
                    className="btn-publish-post"
                  >
                    <Send size={15} />
                    <span>{isPosting ? 'Đang đăng...' : 'Đăng bài'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* ========================================== */}
            {/* DANH SÁCH BÀI VIẾT (FEED STREAM) */}
            {/* ========================================== */}
            <div className="posts-stream">
              {loadingPosts ? (
                <div className="stream-loading">
                  <div className="stream-spinner"></div>
                  <p>Đang chuẩn bị bảng tin...</p>
                </div>
              ) : displayedPosts.length === 0 ? (
                <div className="stream-empty">
                  <MessageCircle size={44} className="empty-icon" />
                  <h3>Chưa có bài viết nào ở mục này</h3>
                  <p>Hãy là người đầu tiên chia sẻ cảm nghĩ của bạn lên bảng tin!</p>
                </div>
              ) : (
                displayedPosts.map((post) => {
                  const isSaved = savedPostIds.includes(post.id);
                  const isPostAuthorFounder = post.authorVipTier === 'FOUNDER' || post.authorRoles?.includes('ROLE_AMDIN') || post.authorRoles?.includes('ROLE_ADMIN');
                  const currentReactionObj = REACTION_EMOJIS.find(r => r.type === post.myReaction);

                  return (
                    <article key={post.id} className="post-card" id={`post-${post.id}`}>
                      <div className="post-header">
                        {/* Avatar tác giả với viền hào quang VIP */}
                        <div 
                          className={`post-author-avatar ${isPostAuthorFounder ? 'founder-frame' : 'vip-frame'}`}
                          onClick={() => setSelectedProfileUserId(post.authorId)}
                          title={`Xem hồ sơ của ${post.authorNickname}`}
                        >
                          {post.authorNickname?.charAt(0).toUpperCase() || "U"}
                        </div>

                        <div className="post-author-meta">
                          <div className="author-name-row">
                            <h4 
                              onClick={() => setSelectedProfileUserId(post.authorId)}
                              title={`Xem hồ sơ của ${post.authorNickname}`}
                            >
                              {post.authorNickname}
                            </h4>

                            {/* Biểu Tượng Đặc Quyền VIP & Verified */}
                            {post.authorIsVerified && (
                              <span className="badge-verified" title="Tài khoản đã xác thực">
                                <CheckCircle2 size={15} color="#38bdf8" />
                              </span>
                            )}

                            {isPostAuthorFounder ? (
                              <span className="privilege-pill founder-pill">
                                <Crown size={12} /> Sáng Lập
                              </span>
                            ) : (
                              <span className="privilege-pill diamond-pill">
                                <Gem size={12} /> VIP
                              </span>
                            )}

                            <span className="author-account">@{post.authorAccount}</span>
                          </div>

                          <div className="post-sub-meta">
                            <span className="post-time">{post.formattedTime}</span>
                            {post.authorLocation && (
                              <span className="post-location">📍 {post.authorLocation}</span>
                            )}
                            {post.vibe && (
                              <span className="post-vibe-tag">{post.vibe}</span>
                            )}
                          </div>
                        </div>

                        {/* Nút lưu bài viết */}
                        <button 
                          onClick={() => handleToggleSavePost(post.id)}
                          className={`btn-bookmark-post ${isSaved ? 'saved' : ''}`}
                          title={isSaved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
                        >
                          <Bookmark size={17} fill={isSaved ? "#818cf8" : "none"} color={isSaved ? "#818cf8" : "currentColor"} />
                        </button>
                      </div>

                      {/* Nội dung bài đăng */}
                      <div className="post-content">
                        <p>{post.content}</p>
                        {post.imageUrl && (
                          <div className="post-attached-image">
                            <img src={post.imageUrl} alt="Đính kèm" loading="lazy" />
                          </div>
                        )}
                      </div>

                      {/* Thanh Tương Tác: Reactions, Bình Luận, Chia Sẻ */}
                      <div className="post-actions-bar">
                        {/* Hộp Thả Emoji / Like */}
                        <div className="reaction-wrapper">
                          <button 
                            onClick={() => handleReactPost(post.id, post.myReaction ? post.myReaction : 'HEART')}
                            onMouseEnter={() => setActiveReactionPicker(post.id)}
                            className={`action-pill ${post.isLikedByMe ? 'liked' : ''}`}
                            title="Thả cảm xúc"
                          >
                            {currentReactionObj ? (
                              <span className="reaction-active-emoji">{currentReactionObj.emoji}</span>
                            ) : (
                              <Heart size={18} fill={post.isLikedByMe ? "#ef4444" : "none"} color={post.isLikedByMe ? "#ef4444" : "currentColor"} />
                            )}
                            <span>{post.likesCount || 0}</span>
                          </button>

                          {/* Bảng chọn Emoji Reactions (Hover / Mở) */}
                          {activeReactionPicker === post.id && (
                            <div 
                              className="reactions-popover"
                              onMouseLeave={() => setActiveReactionPicker(null)}
                            >
                              {REACTION_EMOJIS.map(emojiItem => (
                                <button
                                  key={emojiItem.type}
                                  type="button"
                                  onClick={() => handleReactPost(post.id, emojiItem.type)}
                                  className="reaction-emoji-btn"
                                  title={emojiItem.label}
                                >
                                  <span>{emojiItem.emoji}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <button 
                          onClick={() => handleToggleComments(post.id)}
                          className="action-pill"
                          title="Bình luận"
                        >
                          <MessageCircle size={18} />
                          <span>{post.commentsCount || 0}</span>
                        </button>

                        <button 
                          onClick={() => setSharePost(post)}
                          className="action-pill action-share"
                          title="Chia sẻ bài viết"
                        >
                          <Share2 size={18} />
                          <span>Chia sẻ</span>
                        </button>
                      </div>

                      {/* Hộp Bình Luận (Mở rộng khi click) */}
                      {expandedComments[post.id] && (
                        <div className="comments-section">
                          <div className="comments-list">
                            {commentsMap[post.id]?.length === 0 ? (
                              <p className="no-comments-msg">Chưa có bình luận nào. Hãy là người đầu tiên bình luận!</p>
                            ) : (
                              commentsMap[post.id]?.map((cmt) => (
                                <div key={cmt.id} className="comment-bubble">
                                  <div 
                                    className="cmt-avatar"
                                    onClick={() => setSelectedProfileUserId(cmt.authorId)}
                                  >
                                    {cmt.authorNickname?.charAt(0).toUpperCase() || "U"}
                                  </div>
                                  <div className="cmt-body">
                                    <div className="cmt-header">
                                      <span 
                                        className="cmt-author"
                                        onClick={() => setSelectedProfileUserId(cmt.authorId)}
                                      >
                                        {cmt.authorNickname}
                                      </span>
                                      <span className="cmt-time">{cmt.formattedTime}</span>
                                    </div>
                                    <p className="cmt-text">{cmt.content}</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Ô nhập bình luận */}
                          <form onSubmit={(e) => handleAddComment(e, post.id)} className="comment-form">
                            <input 
                              type="text" 
                              placeholder="Viết câu trả lời của bạn..."
                              value={commentInputs[post.id] || ''}
                              onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                            />
                            <button 
                              type="submit" 
                              disabled={!commentInputs[post.id]?.trim() || submittingComment[post.id]}
                              className="btn-send-cmt"
                            >
                              <CornerDownRight size={16} />
                            </button>
                          </form>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* NỘI DUNG 2: DANH SÁCH PHÒNG CHAT & VOICE CALL (ROOMS) */}
        {activeTab === 'rooms' && (
          <div className="rooms-container">
            <div className="rooms-banner">
              <div>
                <h2>Phòng Trò Chuyện & Gọi Thoại WebRTC</h2>
                <p>Tham gia phòng để trao đổi tin nhắn, đàm thoại âm thanh HD thời gian thực cùng bạn bè.</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(true)} className="btn-create-room-header">
                <Plus size={16} /> Tạo phòng mới
              </button>
            </div>

            <div className="rooms-grid">
              {rooms.map((room) => {
                const alreadyIn = isUserInRoom(room);
                return (
                  <div key={room.id} className={`room-card-modern ${alreadyIn ? 'is-my-room' : ''}`}>
                    <div className="card-top">
                      <h3>{room.nameroom}</h3>
                      <span className="online-pill">
                        <span className="pulse-green"></span>
                        {room.soluong || room.userRoomDTOList?.length || 0} online
                      </span>
                    </div>

                    <div className="card-badges">
                      {room.hasPassword && (
                        <span className="badge badge-locked">
                          <Lock size={12} /> Khóa
                        </span>
                      )}
                      {alreadyIn && (
                        <span className="badge badge-joined">
                          <CheckCircle size={12} /> Phòng của bạn
                        </span>
                      )}
                    </div>

                    <div className="members-chips">
                      {room.userRoomDTOList?.slice(0, 4).map((ur, idx) => (
                        <span key={idx} className="chip">
                          {ur.userDTO?.nickname || "User"}
                        </span>
                      ))}
                      {(room.userRoomDTOList?.length || 0) > 4 && (
                        <span className="chip chip-more">+{room.userRoomDTOList.length - 4}</span>
                      )}
                    </div>

                    <div className="card-action">
                      {alreadyIn ? (
                        <button onClick={() => navigate(`/room/${room.id}`)} className="btn-enter-room btn-reenter">
                          Vào lại phòng <ArrowRight size={16} />
                        </button>
                      ) : (
                        <button onClick={() => setSelectedRoom(room)} className="btn-enter-room">
                          Tham gia ngay <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* CỘT 3: TIỆN ÍCH PHẢI (WIDGETS & DISCOVERY) */}
      {/* ============================================================== */}
      <aside className="widgets-sidebar">
        {/* Hộp Tìm Kiếm Bài Viết */}
        <div className="search-widget">
          <form onSubmit={handleSearch} className="search-box">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Tìm kiếm bài viết, hashtag..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
            {searchKeyword && (
              <button type="button" onClick={() => { setSearchKeyword(''); fetchPosts(); }} className="btn-clear-search">
                <X size={14} />
              </button>
            )}
          </form>
        </div>

        {/* Tiện Ích Đột Phá: Ghép Đôi Vibe Nhanh */}
        <div className="widget-card widget-speed-match">
          <div className="widget-header">
            <Zap size={18} className="widget-icon zap-glow" />
            <h4>⚡ Speed Vibe Match</h4>
          </div>
          <p className="speed-match-desc">Ghép đôi ẩn danh 1-click với người dùng online cùng gu âm nhạc & sở thích.</p>
          <button onClick={handleStartSpeedMatch} className="btn-widget-match">
            Tìm người cùng Vibe ngay
          </button>
        </div>

        {/* Tiện Ích Xu Hướng & Hashtags Nổi Bật */}
        <div className="widget-card">
          <div className="widget-header">
            <TrendingUp size={18} className="widget-icon" />
            <h4>Chủ Đề Nóng Hôm Nay</h4>
          </div>
          <div className="trending-tags-list">
            <div className="trending-item" onClick={() => { setSearchKeyword('LoFi'); fetchPosts(); }}>
              <span className="tag-name">#LoFiCafe</span>
              <span className="tag-count">1.4k thảo luận</span>
            </div>
            <div className="trending-item" onClick={() => { setSearchKeyword('ChatTogether'); fetchPosts(); }}>
              <span className="tag-name">#ChatTogetherPlatform</span>
              <span className="tag-count">3.2k bài viết</span>
            </div>
            <div className="trending-item" onClick={() => { setSearchKeyword('GócChill'); fetchPosts(); }}>
              <span className="tag-name">#GócChillĐêm</span>
              <span className="tag-count">890 lượt thả tim</span>
            </div>
          </div>
        </div>

        {/* Tiện Ích Phòng Sôi Nổi */}
        <div className="widget-card">
          <div className="widget-header">
            <Radio size={18} className="widget-icon" />
            <h4>Phòng Trò Chuyện Trực Tiếp</h4>
          </div>
          <div className="widget-rooms-list">
            {rooms.slice(0, 3).map((r) => (
              <div key={r.id} className="widget-room-item" onClick={() => navigate(`/room/${r.id}`)}>
                <div className="w-room-info">
                  <span className="w-name">#{r.nameroom}</span>
                  <span className="w-online">{r.soluong || r.userRoomDTOList?.length || 0} người online</span>
                </div>
                <ChevronRight size={16} className="w-arrow" />
              </div>
            ))}
          </div>
        </div>

        {/* Giới Thiệu & Bản Quyền */}
        <div className="widget-footer-info">
          <p>© 2026 Chat Together Platform. Mạng xã hội thế hệ mới & liên lạc thời gian thực.</p>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* THANH ĐIỀU HƯỚNG DƯỚI ĐÁY DÀNH CHO MOBILE (BOTTOM NAV BAR) */}
      {/* ============================================================== */}
      <nav className="mobile-bottom-nav">
        <button 
          className={`b-nav-item ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          <Compass size={22} />
          <span>Bảng tin</span>
        </button>

        <button 
          className={`b-nav-item ${activeTab === 'trending' ? 'active' : ''}`}
          onClick={() => setActiveTab('trending')}
        >
          <Flame size={22} color={activeTab === 'trending' ? '#f97316' : 'currentColor'} />
          <span>Hot</span>
        </button>

        <button 
          className="b-nav-item b-nav-create"
          onClick={() => {
            setActiveTab('feed');
            setTimeout(() => newPostInputRef.current?.focus(), 150);
          }}
          title="Đăng bài viết mới"
        >
          <Plus size={26} />
        </button>

        <button 
          className={`b-nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
          onClick={() => setActiveTab('rooms')}
        >
          <Radio size={22} />
          <span>Phòng</span>
        </button>

        <button 
          className="b-nav-item"
          onClick={() => setSelectedProfileUserId(currentUserId)}
        >
          <Crown size={22} color="#fbbf24" />
          <span>VIP</span>
        </button>
      </nav>

      {/* ============================================================== */}
      {/* MODAL STORY VIEWER (XEM KHOẢNG KHẮC 24H) */}
      {/* ============================================================== */}
      {activeStory && (
        <div className="story-viewer-modal" onClick={() => setActiveStory(null)}>
          <div className="story-card-view" onClick={(e) => e.stopPropagation()} style={{ background: activeStory.bg }}>
            <div className="story-progress-bar">
              <div className="story-progress-fill"></div>
            </div>
            <div className="story-top-info">
              <div className="story-author-tag">
                <div className="st-mini-avatar">{activeStory.avatar}</div>
                <div>
                  <strong>{activeStory.author}</strong>
                  <span>{activeStory.time}</span>
                </div>
              </div>
              <button onClick={() => setActiveStory(null)} className="btn-close-story"><X size={18} /></button>
            </div>

            <div className="story-body-content">
              <span className="story-vibe-pill">{activeStory.tag}</span>
              <p className="story-text-center">{activeStory.content}</p>
            </div>

            <div className="story-reply-row">
              <input type="text" placeholder={`Gửi phản hồi cho ${activeStory.author}...`} />
              <button onClick={() => { toast.success("Đã gửi phản hồi story!"); setActiveStory(null); }} className="btn-send-story">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL SPEED VIBE MATCH (GHÉP ĐÔI ẨN DANH) */}
      {/* ============================================================== */}
      {isSpeedMatchOpen && (
        <div className="modal-backdrop-blur" onClick={() => setIsSpeedMatchOpen(false)}>
          <div className="speed-match-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-row">
                <Zap size={20} color="#eab308" />
                <h3>Speed Vibe Match</h3>
              </div>
              <button onClick={() => setIsSpeedMatchOpen(false)} className="btn-close-modal"><X size={18} /></button>
            </div>

            {matchingStatus === 'searching' ? (
              <div className="speed-searching-body">
                <div className="sonar-emitter">
                  <div className="sonar-wave"></div>
                  <div className="sonar-wave wave2"></div>
                  <div className="sonar-core"><Zap size={32} color="#eab308" /></div>
                </div>
                <h4>Đang quét tìm người có cùng tần số Vibe...</h4>
                <p>Hệ thống tự động lọc theo gu âm nhạc & câu chuyện hôm nay</p>
              </div>
            ) : (
              <div className="speed-matched-body">
                <div className="matched-banner">
                  <Sparkles size={24} color="#38bdf8" />
                  <h4>TÌM THẤY ĐỒNG ĐIỆU!</h4>
                </div>
                <div className="partner-card">
                  <div className="partner-avatar">✨</div>
                  <div className="partner-info">
                    <strong>{matchedPartner?.nickname}</strong>
                    <p>{matchedPartner?.vibe}</p>
                  </div>
                </div>
                <div className="icebreaker-box">
                  <span className="icebreaker-tag">💡 Câu hỏi phá băng:</span>
                  <p>"{matchedPartner?.icebreaker}"</p>
                </div>
                <div className="modal-actions-row">
                  <button onClick={() => setMatchingStatus('searching')} className="btn-cancel">Tìm người khác</button>
                  <button 
                    onClick={() => {
                      setIsSpeedMatchOpen(false);
                      toast.success("Đang kết nối vào phòng trò chuyện ẩn danh 1-1...", { icon: '🚀' });
                    }} 
                    className="btn-confirm"
                  >
                    Bắt đầu trò chuyện ngay
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL VÒNG QUAY PARTY (TRUTH OR DARE) */}
      {/* ============================================================== */}
      {isPartyWheelOpen && (
        <div className="modal-backdrop-blur" onClick={() => setIsPartyWheelOpen(false)}>
          <div className="party-wheel-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-row">
                <Dices size={20} color="#ec4899" />
                <h3>Vòng Quay Sự Thật Hay Thử Thách</h3>
              </div>
              <button onClick={() => setIsPartyWheelOpen(false)} className="btn-close-modal"><X size={18} /></button>
            </div>

            <div className="party-wheel-body">
              <p className="wheel-sub">Quay vòng quay để nhận ngay 1 câu hỏi thú nhận hoặc thử thách táo bạo cùng bạn bè!</p>
              <div className={`wheel-circle ${wheelSpinning ? 'spinning' : ''}`}>
                <div className="wheel-needle"></div>
                <div className="wheel-center-label">
                  <Flame size={24} color="#f97316" />
                </div>
              </div>

              {wheelResult && (
                <div className="wheel-result-card">
                  <span className="result-badge">Nhiệm vụ của bạn:</span>
                  <p>{wheelResult}</p>
                </div>
              )}

              <button 
                onClick={handleSpinPartyWheel} 
                disabled={wheelSpinning}
                className="btn-spin-wheel"
              >
                {wheelSpinning ? 'Vòng quay đang quay...' : 'QUAY NGAY 🎲'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHIA SẺ BÀI VIẾT */}
      {sharePost && (
        <div className="modal-backdrop-blur" onClick={() => setSharePost(null)}>
          <div className="share-card" onClick={(e) => e.stopPropagation()}>
            <div className="share-header">
              <h3>Chia sẻ bài viết</h3>
              <button onClick={() => setSharePost(null)} className="btn-close-share"><X size={18} /></button>
            </div>
            <p className="share-preview">"{sharePost.content?.slice(0, 80)}..."</p>
            <div className="share-options">
              <button onClick={() => handleCopyPostLink(sharePost)} className="share-opt-btn btn-copy">
                <Copy size={18} /> Sao chép liên kết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HỒ SƠ NGƯỜI DÙNG */}
      {selectedProfileUserId && (
        <UserProfileModal 
          userId={selectedProfileUserId}
          currentUserId={currentUserId}
          onClose={() => setSelectedProfileUserId(null)}
        />
      )}

      {/* MODAL BẠN BÈ */}
      {isFriendsOpen && (
        <FriendsModal 
          onClose={() => setIsFriendsOpen(false)}
          onSelectUser={(uid) => {
            setIsFriendsOpen(false);
            setSelectedProfileUserId(uid);
          }}
        />
      )}

      {/* MODAL TẠO PHÒNG CHAT */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="modal-backdrop-blur" onClick={() => setIsCreateModalOpen(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Tạo Phòng Chat Mới</h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="btn-close-modal"><X size={18} /></button>
              </div>
              <form onSubmit={handleCreateRoom} className="modal-form">
                <div className="form-item">
                  <label>Tên phòng chat</label>
                  <input 
                    type="text" 
                    placeholder="VD: Không gian trò chuyện cuối tuần"
                    value={newRoomData.name}
                    onChange={(e) => setNewRoomData({ ...newRoomData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-item">
                  <label>Mật khẩu (Không bắt buộc)</label>
                  <input 
                    type="password" 
                    placeholder="Để trống nếu là phòng công khai"
                    value={newRoomData.password}
                    onChange={(e) => setNewRoomData({ ...newRoomData, password: e.target.value })}
                  />
                </div>
                <div className="modal-actions-row">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn-cancel">Hủy</button>
                  <button type="submit" className="btn-confirm">Tạo ngay</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL THAM GIA PHÒNG CÓ MẬT KHẨU */}
      <AnimatePresence>
        {selectedRoom && (
          <div className="modal-backdrop-blur" onClick={() => setSelectedRoom(null)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Tham gia #{selectedRoom.nameroom}</h3>
                <button onClick={() => setSelectedRoom(null)} className="btn-close-modal"><X size={18} /></button>
              </div>
              <form onSubmit={handleJoinRoom} className="modal-form">
                {selectedRoom.hasPassword ? (
                  <div className="form-item">
                    <label>Mật khẩu phòng (Bắt buộc)</label>
                    <input 
                      type="password" 
                      placeholder="Nhập mật khẩu phòng..."
                      value={joinData.password}
                      onChange={(e) => setJoinData({ ...joinData, password: e.target.value })}
                      required
                    />
                  </div>
                ) : (
                  <p className="public-notice">Phòng này công khai, bạn có thể tham gia trò chuyện ngay!</p>
                )}
                <div className="modal-actions-row">
                  <button type="button" onClick={() => setSelectedRoom(null)} className="btn-cancel">Hủy</button>
                  <button type="submit" className="btn-confirm">Vào phòng</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --social-bg: #090d16;
          --sidebar-bg: #060911;
          --card-bg: #0f172a;
          --card-border: rgba(255, 255, 255, 0.08);
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --brand: #6366f1;
          --brand-hover: #4f46e5;
        }

        .social-app-wrapper {
          display: flex;
          min-height: 100vh;
          background: var(--social-bg);
          color: var(--text-main);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }

        /* CỘT 1: NAV RAIL */
        .nav-sidebar {
          width: 270px;
          height: 100vh;
          position: sticky;
          top: 0;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--card-border);
          display: flex;
          flex-direction: column;
          padding: 20px 16px;
          box-sizing: border-box;
          z-index: 50;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          margin-bottom: 16px;
          padding: 0 4px;
        }
        .brand-logo-glow {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.45);
        }
        .brand-text-block {
          display: flex;
          flex-direction: column;
        }
        .brand-name {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.3px;
          background: linear-gradient(to right, #ffffff, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .brand-badge-vip {
          font-size: 10px;
          font-weight: 700;
          color: #fbbf24;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Sidebar Radio Card */
        .sidebar-radio-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 10px 12px;
          margin-bottom: 16px;
        }
        .radio-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .radio-title-row {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow: hidden;
        }
        .radio-channel-name {
          font-size: 11.5px;
          font-weight: 700;
          color: #f1f5f9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .radio-controls-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-radio-play {
          background: #6366f1;
          color: white;
          border: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s;
        }
        .btn-radio-play:hover { transform: scale(1.08); }
        .btn-radio-shuffle {
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: none;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .radio-genre-tag {
          font-size: 10px;
          color: #94a3b8;
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 8px;
          border-radius: 8px;
          margin-left: auto;
        }
        .sound-wave-bars {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 12px;
        }
        .sound-wave-bars span {
          width: 2px;
          background: #38bdf8;
          border-radius: 1px;
          animation: soundWave 0.8s ease-in-out infinite alternate;
        }
        .sound-wave-bars span:nth-child(2) { animation-delay: 0.2s; }
        .sound-wave-bars span:nth-child(3) { animation-delay: 0.4s; }
        .sound-wave-bars span:nth-child(4) { animation-delay: 0.6s; }
        @keyframes soundWave {
          0% { height: 2px; }
          100% { height: 12px; }
        }

        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 12px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
        }
        .nav-item.active {
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
          font-weight: 700;
        }
        .nav-item-vip {
          color: #f1f5f9;
        }

        .nav-action-box {
          margin-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .btn-speed-match {
          background: linear-gradient(135deg, #eab308, #ca8a04);
          color: #090d16;
          border: none;
          padding: 10px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 4px 15px rgba(234, 179, 8, 0.3);
          transition: transform 0.15s;
        }
        .btn-speed-match:hover { transform: scale(1.02); }
        .btn-party-wheel {
          background: rgba(236, 72, 153, 0.15);
          border: 1px solid rgba(236, 72, 153, 0.4);
          color: #f472b6;
          padding: 8px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 12.5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .btn-create-post-nav {
          background: linear-gradient(135deg, var(--brand), #8b5cf6);
          color: white;
          border: none;
          padding: 10px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .btn-create-room-nav {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 8px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .nav-footer {
          margin-top: auto;
          padding-top: 10px;
        }
        .btn-logout-nav {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 9px 12px;
          background: transparent;
          border: none;
          color: #ef4444;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
        }
        .btn-logout-nav:hover { background: rgba(239, 68, 68, 0.1); }

        /* CỘT 2: MAIN STREAM */
        .main-stream {
          flex: 1;
          max-width: 680px;
          border-right: 1px solid var(--card-border);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .mobile-top-bar {
          display: none;
          padding: 12px 16px;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--card-border);
          background: var(--sidebar-bg);
          position: sticky;
          top: 0;
          z-index: 60;
        }
        .m-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        .m-logo { width: 32px; height: 32px; border-radius: 8px; }
        .m-title { font-size: 15px; font-weight: 800; }
        .m-actions { display: flex; align-items: center; gap: 8px; }
        .m-radio-pill {
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.35);
          color: #818cf8;
          border-radius: 20px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .m-radio-pill.active {
          background: #6366f1;
          color: white;
        }
        .m-icon-btn {
          background: transparent;
          border: none;
          color: #cbd5e1;
          position: relative;
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .m-notif-dot {
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          position: absolute;
          top: -2px;
          right: -2px;
        }
        .m-user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white;
          font-weight: 700;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .stream-header {
          position: sticky;
          top: 0;
          background: rgba(9, 13, 22, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--card-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          z-index: 40;
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
          border: none;
          color: var(--text-muted);
          font-size: 13.5px;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .stream-tab.active {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-main);
          font-weight: 700;
        }
        .btn-header-notif {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
        }
        .notif-badge-pill {
          position: absolute;
          top: -2px;
          right: -2px;
          background: #ef4444;
          color: white;
          font-size: 10px;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 10px;
        }

        /* Notif Dropdown */
        .notif-dropdown-card {
          position: absolute;
          top: 55px;
          right: 20px;
          width: 320px;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
          border-radius: 16px;
          padding: 12px;
          z-index: 100;
          animation: scaleCard 0.2s ease-out;
        }
        .notif-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .notif-header h4 { margin: 0; font-size: 13.5px; font-weight: 700; }
        .btn-read-all {
          background: transparent;
          border: none;
          color: #818cf8;
          font-size: 11px;
          cursor: pointer;
        }
        .notif-list { display: flex; flex-direction: column; gap: 6px; }
        .notif-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 8px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
        }
        .notif-item.unread { background: rgba(99, 102, 241, 0.12); }
        .notif-icon-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .notif-content p { margin: 0; font-size: 12px; color: #f1f5f9; line-height: 1.4; }
        .notif-content span { font-size: 10.5px; color: #94a3b8; display: block; margin-top: 2px; }

        /* STORIES BAR */
        .stories-bar-container {
          padding: 14px 16px 8px;
          border-bottom: 1px solid var(--card-border);
          overflow: hidden;
        }
        .stories-scroll {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 4px;
        }
        .stories-scroll::-webkit-scrollbar { display: none; }
        .story-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .story-avatar-wrap {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          padding: 2.5px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .story-avatar-wrap.unseen {
          background: linear-gradient(135deg, #ec4899, #8b5cf6, #f59e0b);
        }
        .story-avatar-wrap.seen {
          background: rgba(255, 255, 255, 0.2);
        }
        .story-avatar-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #1e293b;
          border: 2px solid #090d16;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 18px;
        }
        .add-story-wrap {
          border: 2px dashed rgba(255, 255, 255, 0.3);
          padding: 0;
        }
        .add-story-plus {
          position: absolute;
          bottom: 0;
          right: 0;
          background: #6366f1;
          color: white;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #090d16;
        }
        .story-author-name {
          font-size: 11.5px;
          color: #cbd5e1;
          font-weight: 600;
        }

        /* POST CREATOR CARD */
        .post-creator-card {
          padding: 16px;
          border-bottom: 1px solid var(--card-border);
          background: rgba(15, 23, 42, 0.4);
        }
        .creator-header-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .creator-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .creator-greeting {
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .greeting-name { font-size: 13.5px; font-weight: 700; color: #f8fafc; }
        .greeting-sub { font-size: 11.5px; color: #94a3b8; }
        .btn-ai-magic {
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.4);
          color: #818cf8;
          font-size: 11.5px;
          font-weight: 700;
          padding: 5px 10px;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s;
        }
        .btn-ai-magic:hover { background: #6366f1; color: white; }

        .creator-form textarea {
          width: 100%;
          background: transparent;
          border: none;
          color: #f8fafc;
          font-size: 14.5px;
          font-family: inherit;
          resize: none;
          outline: none;
          box-sizing: border-box;
          line-height: 1.5;
        }
        .creator-form textarea::placeholder { color: #64748b; }

        .vibe-tags-row {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          margin: 10px 0;
        }
        .vibe-tags-row::-webkit-scrollbar { display: none; }
        .vibe-label { font-size: 11px; color: #94a3b8; font-weight: 600; white-space: nowrap; }
        .vibe-tag-pill {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 10px;
          border: 1px solid;
          cursor: pointer;
          white-space: nowrap;
          transition: transform 0.1s;
        }
        .vibe-tag-pill:hover { transform: scale(1.05); }

        .image-input-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 6px 10px;
          margin: 8px 0;
        }
        .img-icon { color: #818cf8; }
        .image-input-box input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 12.5px;
          outline: none;
        }
        .btn-clear-img { background: transparent; border: none; color: #ef4444; cursor: pointer; }
        .image-preview-box {
          border-radius: 12px;
          overflow: hidden;
          max-height: 220px;
          margin: 8px 0;
          border: 1px solid var(--card-border);
        }
        .image-preview-box img { width: 100%; height: 100%; object-fit: cover; }

        .creator-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 10px;
        }
        .creator-tools { display: flex; gap: 8px; }
        .btn-tool {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 12.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 8px;
        }
        .btn-tool:hover { background: rgba(255, 255, 255, 0.05); color: #f8fafc; }
        .btn-tool.active { color: #818cf8; background: rgba(99, 102, 241, 0.1); }
        .btn-publish-post {
          background: var(--brand);
          color: white;
          border: none;
          padding: 7px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s;
        }
        .btn-publish-post:hover:not(:disabled) { background: var(--brand-hover); }
        .btn-publish-post:disabled { opacity: 0.5; cursor: not-allowed; }

        /* POST CARDS */
        .post-card {
          padding: 16px;
          border-bottom: 1px solid var(--card-border);
          transition: background 0.15s;
        }
        .post-card:hover { background: rgba(255, 255, 255, 0.015); }
        .post-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          position: relative;
        }
        .post-author-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white;
          font-weight: 800;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          border: 2px solid transparent;
        }
        .founder-frame {
          border-color: #fbbf24;
          box-shadow: 0 0 10px rgba(251, 191, 36, 0.4);
        }
        .vip-frame {
          border-color: #38bdf8;
          box-shadow: 0 0 8px rgba(56, 189, 248, 0.3);
        }

        .post-author-meta { flex: 1; }
        .author-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .author-name-row h4 {
          margin: 0;
          font-size: 14.5px;
          font-weight: 700;
          color: #f8fafc;
          cursor: pointer;
        }
        .badge-verified { display: flex; align-items: center; }
        .privilege-pill {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .founder-pill {
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.4);
          color: #fbbf24;
        }
        .diamond-pill {
          background: rgba(56, 189, 248, 0.2);
          border: 1px solid rgba(56, 189, 248, 0.4);
          color: #38bdf8;
        }
        .author-account { font-size: 12px; color: #64748b; }
        .post-sub-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 2px;
          font-size: 11.5px;
          color: #94a3b8;
        }
        .post-vibe-tag {
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
          padding: 1px 6px;
          border-radius: 6px;
          font-weight: 600;
        }
        .btn-bookmark-post {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          transition: all 0.15s;
        }
        .btn-bookmark-post:hover { background: rgba(255, 255, 255, 0.05); color: #f8fafc; }
        .btn-bookmark-post.saved { color: #818cf8; }

        .post-content {
          margin: 10px 0 12px 56px;
          font-size: 14px;
          line-height: 1.5;
          color: #f1f5f9;
        }
        .post-content p { margin: 0; white-space: pre-wrap; word-break: break-word; }
        .post-attached-image {
          margin-top: 10px;
          border-radius: 14px;
          overflow: hidden;
          max-height: 360px;
          border: 1px solid var(--card-border);
        }
        .post-attached-image img { width: 100%; height: 100%; object-fit: cover; }

        /* Actions Bar & Reactions Popover */
        .post-actions-bar {
          margin-left: 56px;
          display: flex;
          gap: 12px;
          position: relative;
        }
        .reaction-wrapper { position: relative; }
        .action-pill {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #94a3b8;
          font-size: 12.5px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }
        .action-pill:hover { background: rgba(255, 255, 255, 0.08); color: #f8fafc; }
        .action-pill.liked {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }
        .reaction-active-emoji { font-size: 16px; line-height: 1; }

        /* Emoji Reactions Popover */
        .reactions-popover {
          position: absolute;
          bottom: 38px;
          left: 0;
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
          border-radius: 30px;
          padding: 4px 8px;
          display: flex;
          gap: 6px;
          z-index: 50;
          animation: popReaction 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes popReaction {
          from { transform: scale(0.7) translateY(10px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .reaction-emoji-btn {
          background: transparent;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 4px;
          transition: transform 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .reaction-emoji-btn:hover { transform: scale(1.35) translateY(-4px); }

        /* Comments */
        .comments-section {
          margin: 12px 0 0 56px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          padding: 12px;
        }
        .comments-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
        .no-comments-msg { margin: 0; font-size: 12px; color: #64748b; font-style: italic; }
        .comment-bubble { display: flex; gap: 8px; }
        .cmt-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #475569;
          color: white;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          cursor: pointer;
        }
        .cmt-body {
          background: rgba(255, 255, 255, 0.05);
          padding: 6px 10px;
          border-radius: 10px;
          flex: 1;
        }
        .cmt-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
        .cmt-author { font-size: 12px; font-weight: 700; color: #f8fafc; cursor: pointer; }
        .cmt-time { font-size: 10px; color: #64748b; }
        .cmt-text { margin: 0; font-size: 12.5px; color: #cbd5e1; }
        .comment-form { display: flex; gap: 6px; }
        .comment-form input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 6px 12px;
          color: white;
          font-size: 12.5px;
          outline: none;
        }
        .btn-send-cmt {
          background: var(--brand);
          color: white;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        /* ROOMS CONTAINER */
        .rooms-container { padding: 16px; }
        .rooms-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15));
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .rooms-banner h2 { margin: 0 0 4px 0; font-size: 16px; }
        .rooms-banner p { margin: 0; font-size: 12px; color: #94a3b8; }
        .btn-create-room-header {
          background: #6366f1;
          color: white;
          border: none;
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .rooms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }
        .room-card-modern {
          background: #0f172a;
          border: 1px solid var(--card-border);
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .room-card-modern.is-my-room {
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 0 16px rgba(99, 102, 241, 0.2);
        }
        .card-top { display: flex; justify-content: space-between; align-items: center; }
        .card-top h3 { margin: 0; font-size: 14.5px; }
        .online-pill {
          font-size: 11px;
          color: #34d399;
          background: rgba(16, 185, 129, 0.15);
          padding: 2px 8px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .pulse-green {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          animation: pulseGreen 1.5s infinite;
        }
        @keyframes pulseGreen { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        .card-badges { display: flex; gap: 6px; }
        .badge { font-size: 10.5px; padding: 2px 6px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; }
        .badge-locked { background: rgba(239, 68, 68, 0.15); color: #f87171; }
        .badge-joined { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .members-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
        .chip { font-size: 10.5px; background: rgba(255, 255, 255, 0.05); padding: 2px 6px; border-radius: 4px; color: #cbd5e1; }
        .chip-more { background: rgba(99, 102, 241, 0.2); color: #818cf8; }
        .btn-enter-room {
          width: 100%;
          background: #334155;
          color: white;
          border: none;
          padding: 8px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 6px;
        }
        .btn-enter-room:hover { background: #475569; }
        .btn-reenter { background: #4f46e5; }
        .btn-reenter:hover { background: #4338ca; }

        /* CỘT 3: WIDGETS SIDEBAR */
        .widgets-sidebar {
          width: 320px;
          padding: 20px 16px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .search-box {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--card-border);
          border-radius: 20px;
          display: flex;
          align-items: center;
          padding: 8px 12px;
          gap: 8px;
        }
        .search-icon { color: #64748b; }
        .search-box input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 13px;
          outline: none;
        }
        .btn-clear-search { background: transparent; border: none; color: #64748b; cursor: pointer; }

        .widget-card {
          background: #0f172a;
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 14px;
        }
        .widget-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .widget-header h4 { margin: 0; font-size: 13.5px; font-weight: 700; color: #f8fafc; }
        .widget-icon { color: #818cf8; }

        /* Speed Match Widget */
        .widget-speed-match {
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.1), rgba(99, 102, 241, 0.1));
          border-color: rgba(234, 179, 8, 0.3);
        }
        .zap-glow { color: #eab308; }
        .speed-match-desc { font-size: 11.5px; color: #94a3b8; margin: 0 0 10px 0; line-height: 1.4; }
        .btn-widget-match {
          width: 100%;
          background: #eab308;
          color: #090d16;
          border: none;
          padding: 8px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
        }

        .trending-tags-list { display: flex; flex-direction: column; gap: 8px; }
        .trending-item {
          display: flex;
          justify-content: space-between;
          padding: 6px 8px;
          border-radius: 8px;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.02);
        }
        .trending-item:hover { background: rgba(255, 255, 255, 0.05); }
        .tag-name { font-size: 12.5px; font-weight: 700; color: #38bdf8; }
        .tag-count { font-size: 11px; color: #64748b; }

        .widget-rooms-list { display: flex; flex-direction: column; gap: 6px; }
        .widget-room-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.03);
          cursor: pointer;
        }
        .widget-room-item:hover { background: rgba(99, 102, 241, 0.15); }
        .w-room-info { display: flex; flex-direction: column; }
        .w-name { font-size: 12.5px; font-weight: 700; }
        .w-online { font-size: 10.5px; color: #10b981; }
        .w-arrow { color: #64748b; }
        .widget-footer-info p { font-size: 11px; color: #64748b; margin: 0; }

        /* MOBILE BOTTOM NAV */
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: rgba(6, 9, 17, 0.95);
          backdrop-filter: blur(12px);
          border-top: 1px solid var(--card-border);
          justify-content: space-around;
          align-items: center;
          z-index: 90;
        }
        .b-nav-item {
          background: transparent;
          border: none;
          color: #94a3b8;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
        }
        .b-nav-item.active { color: #818cf8; }
        .b-nav-create {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white;
          justify-content: center;
          margin-top: -16px;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.5);
        }

        /* MODALS */
        .modal-backdrop-blur {
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
        .modal-box, .share-card, .speed-match-modal, .party-wheel-modal {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.8);
          border-radius: 20px;
          width: 100%;
          max-width: 420px;
          padding: 18px;
          position: relative;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }
        .header-title-row { display: flex; align-items: center; gap: 8px; }
        .modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
        .btn-close-modal, .btn-close-share {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        }
        .btn-close-modal:hover, .btn-close-share:hover { color: white; }
        .modal-form { display: flex; flex-direction: column; gap: 12px; }
        .form-item { display: flex; flex-direction: column; gap: 6px; }
        .form-item label { font-size: 11.5px; font-weight: 600; color: #94a3b8; }
        .form-item input {
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 9px 12px;
          color: white;
          font-size: 13.5px;
          outline: none;
        }
        .form-item input:focus { border-color: #6366f1; }
        .modal-actions-row { display: flex; gap: 10px; margin-top: 10px; }
        .btn-cancel {
          flex: 1;
          background: #334155;
          color: #cbd5e1;
          border: none;
          padding: 9px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-confirm {
          flex: 1;
          background: #6366f1;
          color: white;
          border: none;
          padding: 9px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        /* Story Viewer */
        .story-viewer-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          padding: 1rem;
        }
        .story-card-view {
          width: 100%;
          max-width: 360px;
          height: 560px;
          border-radius: 20px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        }
        .story-progress-bar {
          width: 100%;
          height: 3px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
          margin-bottom: 12px;
          overflow: hidden;
        }
        .story-progress-fill {
          height: 100%;
          background: white;
          animation: storyProgress 5s linear forwards;
        }
        @keyframes storyProgress { from { width: 0%; } to { width: 100%; } }
        .story-top-info { display: flex; justify-content: space-between; align-items: center; }
        .story-author-tag { display: flex; align-items: center; gap: 8px; }
        .st-mini-avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-weight: 700; }
        .story-author-tag strong { display: block; font-size: 13px; color: white; }
        .story-author-tag span { font-size: 10.5px; color: rgba(255,255,255,0.7); }
        .btn-close-story { background: transparent; border: none; color: white; cursor: pointer; }
        .story-body-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          text-align: center;
        }
        .story-vibe-pill {
          background: rgba(0, 0, 0, 0.35);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        .story-text-center { font-size: 18px; font-weight: 700; color: white; line-height: 1.5; }
        .story-reply-row { display: flex; gap: 8px; }
        .story-reply-row input {
          flex: 1;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 20px;
          padding: 8px 14px;
          color: white;
          font-size: 12.5px;
          outline: none;
        }
        .btn-send-story {
          background: white;
          color: #090d16;
          border: none;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        /* Speed Match Sonar Animation */
        .speed-searching-body {
          text-align: center;
          padding: 20px;
        }
        .sonar-emitter {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sonar-core {
          width: 56px;
          height: 56px;
          background: rgba(234, 179, 8, 0.2);
          border: 2px solid #eab308;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }
        .sonar-wave {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid #eab308;
          animation: sonar 1.8s cubic-bezier(0, 0.2, 0.8, 1) infinite;
        }
        .wave2 { animation-delay: 0.6s; }
        @keyframes sonar {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .speed-searching-body h4 { margin: 0 0 6px 0; font-size: 15px; }
        .speed-searching-body p { margin: 0; font-size: 12px; color: #94a3b8; }
        .speed-matched-body { text-align: center; }
        .matched-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .matched-banner h4 { margin: 0; font-size: 16px; color: #38bdf8; font-weight: 800; }
        .partner-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          text-align: left;
        }
        .partner-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #06b6d4, #3b82f6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        .partner-info strong { display: block; font-size: 13.5px; }
        .partner-info p { margin: 2px 0 0 0; font-size: 11.5px; color: #94a3b8; }
        .icebreaker-box {
          background: rgba(234, 179, 8, 0.1);
          border: 1px dashed rgba(234, 179, 8, 0.4);
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 14px;
        }
        .icebreaker-tag { font-size: 11px; font-weight: 700; color: #eab308; }
        .icebreaker-box p { margin: 4px 0 0 0; font-size: 13px; font-weight: 600; color: #f8fafc; }

        /* Party Wheel */
        .party-wheel-body { text-align: center; }
        .wheel-sub { font-size: 12px; color: #94a3b8; margin: 0 0 16px 0; }
        .wheel-circle {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          border: 4px solid #ec4899;
          margin: 0 auto 16px;
          position: relative;
          background: conic-gradient(#ec4899 0deg 60deg, #8b5cf6 60deg 120deg, #3b82f6 120deg 180deg, #10b981 180deg 240deg, #f59e0b 240deg 300deg, #ef4444 300deg 360deg);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .wheel-circle.spinning { animation: spinWheel 1.5s cubic-bezier(0.15, 0.9, 0.3, 1.2) forwards; }
        @keyframes spinWheel {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(1440deg); }
        }
        .wheel-center-label {
          width: 44px;
          height: 44px;
          background: #0f172a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
        .wheel-result-card {
          background: rgba(236, 72, 153, 0.15);
          border: 1px solid rgba(236, 72, 153, 0.4);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 14px;
        }
        .result-badge { font-size: 11px; font-weight: 700; color: #f472b6; }
        .wheel-result-card p { margin: 6px 0 0 0; font-size: 13.5px; font-weight: 700; color: white; }
        .btn-spin-wheel {
          width: 100%;
          background: linear-gradient(135deg, #ec4899, #d946ef);
          color: white;
          border: none;
          padding: 11px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
        }

        /* RESPONSIVE DESIGN MEDIA QUERIES */
        @media (max-width: 1024px) {
          .widgets-sidebar { display: none; }
        }

        @media (max-width: 768px) {
          .nav-sidebar { display: none; }
          .mobile-top-bar { display: flex; }
          .mobile-bottom-nav { display: flex; }
          .main-stream { max-width: 100%; padding-bottom: 70px; }
          .post-content { margin-left: 0; }
          .post-actions-bar { margin-left: 0; }
          .comments-section { margin-left: 0; }
        }
      `}} />
    </div>
  );
};

export default Home;
