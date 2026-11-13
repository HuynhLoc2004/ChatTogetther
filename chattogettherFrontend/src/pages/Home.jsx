import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, LogOut, Plus, MessageSquare, Shield, User, X, Lock, Hash, 
  CheckCircle, ArrowRight, WifiOff, Heart, MessageCircle, Share2, 
  Search, Sparkles, Send, Copy, Compass, Radio, ChevronRight, CornerDownRight,
  Bell, Bookmark, Flame, Gem, Crown, Volume2, VolumeX, Music, Play, Pause,
  Shuffle, Wand2, Image as ImageIcon, CheckCircle2, Zap, Dices
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import { saveRoomsOffline, getRoomsOffline } from '../utils/offlineDB';
import UserProfileModal from './UserProfileModal';
import FriendsModal from './FriendsModal';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import toast from 'react-hot-toast';

// Component Avatar: Nếu chưa cập nhật ảnh thì dùng Icon Ẩn Danh, KHÔNG dùng chữ cái đầu
export const UserAvatar = ({ avatar, size = 40, className = "" }) => {
  if (avatar && avatar.trim()) {
    return (
      <img 
        src={avatar} 
        alt="Avatar" 
        className={`user-avatar-img ${className}`} 
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} 
        onError={(e) => {
          e.target.style.display = 'none';
          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
        }}
      />
    );
  }
  return (
    <div 
      className={`anonymous-avatar-box ${className}`}
      style={{ 
        width: size, 
        height: size, 
        borderRadius: '50%', 
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#94a3b8',
        flexShrink: 0
      }}
      title="Người dùng ẩn danh"
    >
      <User size={Math.round(size * 0.52)} />
    </div>
  );
};

// Danh sách các biểu tượng cảm xúc (Reactions)
const REACTION_EMOJIS = [
  { type: 'HEART', emoji: '❤️', label: 'Yêu thích' },
  { type: 'FIRE', emoji: '🔥', label: 'Siêu cháy' },
  { type: 'HAHA', emoji: '😂', label: 'Haha' },
  { type: 'WOW', emoji: '😮', label: 'Wow' },
  { type: 'LIKE', emoji: '👍', label: 'Thích' },
  { type: 'CROWN', emoji: '👑', label: 'Đỉnh chóp' },
];

// Danh sách tâm trạng / Vibe bài viết (Cyber tone tối giản)
const VIBE_TAGS = [
  { id: 'lofi', label: '🎧 Lo-Fi Chill' },
  { id: 'energy', label: '🔥 Năng lượng' },
  { id: 'night', label: '🌙 Chill đêm' },
  { id: 'gaming', label: '🎮 Lập team' },
  { id: 'deep', label: '💭 Tâm sự' },
];

// Kênh Radio nhạc nền không gian làm việc
const RADIO_CHANNELS = [
  { name: 'Lo-Fi Chill Cafe', genre: 'Chill Beats', audioSrc: 'https://stream.zeno.fm/f3wvbbqmdg8uv' },
  { name: 'Synthwave 80s', genre: 'Retro Neon', audioSrc: 'https://stream.zeno.fm/0r0xa792kwzuv' },
  { name: 'Acoustic Rain', genre: 'Ambient Calm', audioSrc: 'https://stream.zeno.fm/e0r45u72kwzuv' },
];

// Danh sách câu hỏi Thử Thách Party
const PARTY_QUESTIONS = [
  "Thú nhận: Điều ngớ ngẩn nhất bạn từng làm khi thích một ai đó?",
  "Thử thách: Hát 1 câu bất kỳ bằng giọng ngọng trong 10 giây!",
  "Thú nhận: Bạn có đang crush ai trong danh sách bạn bè không?",
  "Thử thách: Đổi bio trang cá nhân thành một câu siêu sến trong 1 tiếng!",
  "Thú nhận: Lời nói dối vô hại gần đây nhất của bạn là gì?",
];

const Home = () => {
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem('user_id');

  // Navigation tab chính: 'feed' | 'rooms' | 'trending' | 'saved'
  const [activeTab, setActiveTab] = useState('feed');

  // State Phòng Chat
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [newRoomData, setNewRoomData] = useState({ name: '', password: '', nickname: '' });
  const [joinData, setJoinData] = useState({ nickname: '', password: '' });

  // State Bảng Tin (Posts)
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedVibe, setSelectedVibe] = useState(null);
  const [postImageUrl, setPostImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeReactionPicker, setActiveReactionPicker] = useState(null);

  // Bình luận
  const [expandedComments, setExpandedComments] = useState({});
  const [commentsMap, setCommentsMap] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});

  // Bài viết đã lưu
  const [savedPostIds, setSavedPostIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('saved_post_ids') || '[]');
    } catch {
      return [];
    }
  });

  // Cyber Lo-Fi Radio
  const [isPlayingRadio, setIsPlayingRadio] = useState(false);
  const [currentRadioIndex, setCurrentRadioIndex] = useState(0);
  const audioRef = useRef(null);

  // Speed Vibe Match
  const [isSpeedMatchOpen, setIsSpeedMatchOpen] = useState(false);
  const [matchingStatus, setMatchingStatus] = useState('idle');
  const [matchedPartner, setMatchedPartner] = useState(null);

  // Party Wheel
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
    { id: 1, text: 'Thành viên mới vừa tham gia Chat Together', time: '5p trước', unread: true },
    { id: 2, text: 'Phòng chat "Chill Cuối Tuần" đang mở đàm thoại', time: '15p trước', unread: false },
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
      toast.error("Vui lòng nhập nội dung bài viết!");
      return;
    }

    const token = localStorage.getItem('accesstoken');
    if (!token) {
      toast.error("Vui lòng đăng nhập lại để đăng bài!");
      navigate('/login');
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
        toast.success("Đăng bài viết thành công!");
      }
    } catch (err) {
      console.error("Lỗi đăng bài:", err);
      const serverMsg = err.response?.data?.message;
      toast.error(serverMsg || "Không thể đăng bài viết. Vui lòng kiểm tra lại kết nối!");
    } finally {
      setIsPosting(false);
    }
  };

  // Trợ lý gợi ý ý tưởng
  const handleAIEnhancePost = () => {
    const templates = [
      "Cuối tuần nhẹ nhàng, cùng bật chút Lo-Fi và tận hưởng không gian riêng... 🎧",
      "Đôi khi sự im lặng cũng là một câu trả lời trọn vẹn nhất. Chúc mọi người buổi tối an yên.",
      "Có ai đang thức đêm cùng chạy deadline không? Gửi chút năng lượng tích cực đến bạn nhé! ✨",
      "Tìm cạ đàm thoại voice trao đổi về công nghệ và cuộc sống, ai rảnh thì ới mình nha ☕"
    ];
    const pick = templates[Math.floor(Math.random() * templates.length)];
    setNewPostContent(pick);
    setSelectedVibe(VIBE_TAGS[0]);
    toast.success("Đã gợi ý nội dung!");
  };

  // Thả cảm xúc
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
      toast.error("Không thể thao tác cảm xúc lúc này!");
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
        toast.success("Đã gửi phản hồi!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi bình luận!");
    } finally {
      setSubmittingComment(prev => ({ ...prev, [postId]: false }));
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
        toast.success("Đã lưu bài viết!");
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
      const res = await axiosClient.get('/posts/search', {
        params: { keyword: kw }
      });
      if (res.data?.data) {
        setPosts(res.data.data);
      }
    } catch (err) {
      toast.error("Lỗi tìm kiếm!");
    }
  };

  // Lo-Fi Radio
  const togglePlayRadio = () => {
    if (!audioRef.current) return;
    if (isPlayingRadio) {
      audioRef.current.pause();
      setIsPlayingRadio(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingRadio(true);
        toast.success(`Đang phát: ${RADIO_CHANNELS[currentRadioIndex].name}`);
      }).catch(err => {
        console.warn("Lỗi phát audio:", err);
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
      }
    }
  };

  // Speed Match
  const handleStartSpeedMatch = () => {
    setIsSpeedMatchOpen(true);
    setMatchingStatus('searching');
    setTimeout(() => {
      setMatchingStatus('matched');
      setMatchedPartner({
        nickname: 'Ẩn Danh #' + Math.floor(100 + Math.random() * 900),
        vibe: 'Đang lắng nghe giai điệu Lo-Fi & tìm người trò chuyện',
        icebreaker: 'Nếu chỉ được chọn một điều bạn mong muốn nhất lúc này, đó là gì?'
      });
    }, 1500);
  };

  // Party Wheel
  const handleSpinPartyWheel = () => {
    if (wheelSpinning) return;
    setWheelSpinning(true);
    setWheelResult(null);
    setTimeout(() => {
      const q = PARTY_QUESTIONS[Math.floor(Math.random() * PARTY_QUESTIONS.length)];
      setWheelResult(q);
      setWheelSpinning(false);
    }, 1200);
  };

  const handleCopyPostLink = (post) => {
    const url = `${window.location.origin}/#post-${post.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Đã sao chép liên kết!");
    setSharePost(null);
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
      console.warn("WebSocket error:", wsErr);
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

  const displayedPosts = posts.filter(p => {
    if (activeTab === 'saved') return savedPostIds.includes(p.id);
    if (activeTab === 'trending') return (p.likesCount || 0) > 0 || (p.commentsCount || 0) > 0;
    return true;
  });

  return (
    <div className="social-app-wrapper">
      <audio 
        ref={audioRef} 
        src={RADIO_CHANNELS[currentRadioIndex].audioSrc} 
        preload="none"
      />

      {/* KHUNG CĂN GIỮA TOÀN BỘ ỨNG DỤNG - KHÔNG BỊ TRỐNG ĐEN LỆCH BÊN PHẢI */}
      <div className="app-main-layout">

        {/* ============================================================== */}
        {/* CỘT 1: THANH ĐIỀU HƯỚNG TRÁI */}
        {/* ============================================================== */}
        <aside className="nav-sidebar">
          <div className="nav-brand" onClick={() => setActiveTab('feed')}>
            <div className="brand-logo-glow">
              <MessageSquare size={20} color="white" />
            </div>
            <div className="brand-meta">
              <span className="brand-name">Chat Together</span>
              <span className="brand-sub">Không Gian Kết Nối</span>
            </div>
          </div>

          {/* Widget phát nhạc không gian tối giản */}
          <div className="ambient-radio-widget">
            <div className="radio-top-row">
              <Music size={13} className={isPlayingRadio ? "icon-spin" : ""} color="#818cf8" />
              <span className="radio-name-text">{RADIO_CHANNELS[currentRadioIndex].name}</span>
            </div>
            <div className="radio-btns-row">
              <button onClick={togglePlayRadio} className="btn-radio-toggle" title={isPlayingRadio ? "Tạm dừng" : "Phát"}>
                {isPlayingRadio ? <Pause size={12} /> : <Play size={12} />}
              </button>
              <button onClick={handleNextRadioChannel} className="btn-radio-next" title="Đổi bài">
                <Shuffle size={12} />
              </button>
              <span className="radio-genre-label">{RADIO_CHANNELS[currentRadioIndex].genre}</span>
            </div>
          </div>

          <nav className="nav-menu">
            <button 
              className={`nav-item ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              <Compass size={18} />
              <span>Bảng tin</span>
            </button>

            <button 
              className={`nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
              onClick={() => setActiveTab('rooms')}
            >
              <Radio size={18} />
              <span>Phòng trò chuyện ({rooms.length})</span>
            </button>

            <button 
              className={`nav-item ${activeTab === 'trending' ? 'active' : ''}`}
              onClick={() => setActiveTab('trending')}
            >
              <Flame size={18} />
              <span>Thịnh hành</span>
            </button>

            <button 
              className={`nav-item ${activeTab === 'saved' ? 'active' : ''}`}
              onClick={() => setActiveTab('saved')}
            >
              <Bookmark size={18} />
              <span>Đã lưu ({savedPostIds.length})</span>
            </button>

            <button 
              className="nav-item"
              onClick={() => setIsFriendsOpen(true)}
            >
              <Users size={18} />
              <span>Bạn bè</span>
            </button>

            <button 
              className="nav-item"
              onClick={() => setSelectedProfileUserId(currentUserId)}
            >
              <Crown size={18} color="#eab308" />
              <span>Hồ sơ & Đặc quyền</span>
            </button>
          </nav>

          <div className="nav-action-box">
            <button 
              className="btn-speed-match-minimal"
              onClick={handleStartSpeedMatch}
              title="Ghép ngẫu nhiên với 1 người bạn online cùng vibe"
            >
              <Zap size={15} />
              <span>Ghép Vibe Ẩn Danh</span>
            </button>

            <button 
              className="btn-party-wheel-minimal"
              onClick={() => setIsPartyWheelOpen(true)}
              title="Vòng quay thử thách"
            >
              <Dices size={15} />
              <span>Vòng Quay Party</span>
            </button>

            <button 
              className="btn-create-room-minimal"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus size={15} />
              <span>Tạo phòng chat</span>
            </button>
          </div>

          <div className="nav-footer">
            <button onClick={handleLogout} className="btn-logout-nav">
              <LogOut size={16} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </aside>

        {/* ============================================================== */}
        {/* CỘT 2: LUỒNG CHÍNH (STREAM FEED) */}
        {/* ============================================================== */}
        <main className="main-stream">
          {/* Top Bar cho Mobile */}
          <div className="mobile-top-bar">
            <div className="m-brand" onClick={() => setActiveTab('feed')}>
              <div className="brand-logo-glow m-logo">
                <MessageSquare size={16} color="white" />
              </div>
              <span className="m-title">Chat Together</span>
            </div>

            <div className="m-actions">
              <button onClick={togglePlayRadio} className={`m-radio-pill ${isPlayingRadio ? 'active' : ''}`}>
                <Music size={13} />
                <span>{isPlayingRadio ? 'Phát' : 'Nhạc'}</span>
              </button>
              <div 
                className="m-user-avatar-wrap"
                onClick={() => setSelectedProfileUserId(currentUserId)}
              >
                <UserAvatar avatar={localStorage.getItem('avatar')} size={30} />
              </div>
            </div>
          </div>

          {isOffline && (
            <div className="offline-stream-banner">
              <WifiOff size={15} />
              <span>Bạn đang ngoại tuyến. Hiển thị nội dung lưu trong máy.</span>
            </div>
          )}

          {/* Header Tabs */}
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
                Thịnh hành
              </button>
              <button 
                className={`stream-tab ${activeTab === 'saved' ? 'active' : ''}`}
                onClick={() => setActiveTab('saved')}
              >
                Đã lưu
              </button>
              <button 
                className={`stream-tab ${activeTab === 'rooms' ? 'active' : ''}`}
                onClick={() => setActiveTab('rooms')}
              >
                Phòng trò chuyện ({rooms.length})
              </button>
            </div>

            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)} 
              className="btn-header-notif" 
              title="Thông báo"
            >
              <Bell size={17} />
              {notifications.some(n => n.unread) && <span className="notif-dot"></span>}
            </button>
          </header>

          {/* Dropdown Thông Báo */}
          {isNotifOpen && (
            <div className="notif-dropdown-card">
              <div className="notif-header">
                <h4>Thông báo</h4>
                <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, unread: false })))} className="btn-read-all">
                  Đánh dấu đã đọc
                </button>
              </div>
              <div className="notif-list">
                {notifications.map(n => (
                  <div key={n.id} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                    <Sparkles size={13} color="#818cf8" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div className="notif-text-wrap">
                      <p>{n.text}</p>
                      <span>{n.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NỘI DUNG 1: BẢNG TIN */}
          {activeTab !== 'rooms' && (
            <div className="feed-container">
              
              {/* Dải Tín Hiệu Trực Tiếp (Live Vibe Signals) - THAY THẾ CHO STORY FACEBOOK */}
              <div className="live-signals-strip">
                <span className="live-signal-label"><Radio size={13} className="pulse-icon" /> Không gian online:</span>
                <div className="live-signal-scroll">
                  <div className="signal-pill active" onClick={() => setActiveTab('rooms')}>
                    <span className="status-dot green"></span>
                    <span>Phòng đàm thoại ({rooms.length} phòng)</span>
                  </div>
                  <div className="signal-pill" onClick={handleStartSpeedMatch}>
                    <Zap size={12} color="#eab308" />
                    <span>Ghép ẩn danh</span>
                  </div>
                  <div className="signal-pill" onClick={togglePlayRadio}>
                    <Music size={12} color="#818cf8" />
                    <span>{isPlayingRadio ? 'Đang phát Radio' : 'Bật đài Lo-Fi'}</span>
                  </div>
                </div>
              </div>

              {/* HỘP SOẠN BÀI VIẾT TỐI GIẢN */}
              <div className="post-creator-box">
                <div className="creator-input-row">
                  {/* Avatar ẩn danh nếu chưa có ảnh */}
                  <UserAvatar avatar={localStorage.getItem('avatar')} size={40} />
                  
                  <div className="creator-field-wrap">
                    <textarea 
                      ref={newPostInputRef}
                      rows="2"
                      placeholder="Chia sẻ suy nghĩ hoặc câu chuyện của bạn..."
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                    />
                  </div>
                </div>

                {/* Vibe Tags */}
                <div className="vibe-tags-row">
                  {VIBE_TAGS.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVibe(selectedVibe?.id === v.id ? null : v)}
                      className={`vibe-tag-pill ${selectedVibe?.id === v.id ? 'active' : ''}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                {/* Ô đính kèm ảnh */}
                {showImageInput && (
                  <div className="image-input-row">
                    <ImageIcon size={15} color="#94a3b8" />
                    <input 
                      type="url"
                      placeholder="Dán link ảnh (VD: https://...)"
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
                  <div className="post-img-preview">
                    <img src={postImageUrl} alt="Preview" onError={() => toast.error("Link ảnh không hiển thị được!")} />
                  </div>
                )}

                <div className="creator-bottom-row">
                  <div className="creator-left-tools">
                    <button 
                      type="button" 
                      onClick={() => setShowImageInput(!showImageInput)} 
                      className={`btn-subtool ${showImageInput ? 'active' : ''}`}
                      title="Chèn ảnh"
                    >
                      <ImageIcon size={15} />
                      <span>{showImageInput ? 'Đóng link ảnh' : 'Đính ảnh'}</span>
                    </button>

                    <button 
                      type="button" 
                      onClick={handleAIEnhancePost}
                      className="btn-subtool"
                      title="Gợi ý câu chữ"
                    >
                      <Wand2 size={15} />
                      <span>Gợi ý ý tưởng</span>
                    </button>
                  </div>

                  <button 
                    type="button" 
                    onClick={handleCreatePost}
                    disabled={!newPostContent.trim() || isPosting}
                    className="btn-publish-submit"
                  >
                    <Send size={14} />
                    <span>{isPosting ? 'Đang gửi...' : 'Đăng bài'}</span>
                  </button>
                </div>
              </div>

              {/* DANH SÁCH BÀI VIẾT */}
              <div className="feed-posts-list">
                {loadingPosts ? (
                  <div className="feed-status-box">
                    <div className="feed-spinner"></div>
                    <p>Đang chuẩn bị bảng tin...</p>
                  </div>
                ) : displayedPosts.length === 0 ? (
                  <div className="feed-status-box">
                    <MessageCircle size={38} className="empty-icon-muted" />
                    <h4>Chưa có bài viết nào</h4>
                    <p>Hãy là người đầu tiên chia sẻ cảm nghĩ của bạn lên bảng tin!</p>
                  </div>
                ) : (
                  displayedPosts.map((post) => {
                    const isSaved = savedPostIds.includes(post.id);
                    const isAuthorAdmin = post.authorVipTier === 'FOUNDER' || post.authorRoles?.includes('ROLE_AMDIN') || post.authorRoles?.includes('ROLE_ADMIN');
                    const currentReaction = REACTION_EMOJIS.find(r => r.type === post.myReaction);

                    return (
                      <article key={post.id} className="post-item-card" id={`post-${post.id}`}>
                        <div className="post-header-row">
                          {/* Avatar Ẩn danh nếu chưa cập nhật ảnh */}
                          <div 
                            className="post-avatar-click"
                            onClick={() => setSelectedProfileUserId(post.authorId)}
                          >
                            <UserAvatar avatar={post.authorAvatar} size={38} />
                          </div>

                          <div className="post-header-info">
                            <div className="post-name-line">
                              <span 
                                className="author-display-name"
                                onClick={() => setSelectedProfileUserId(post.authorId)}
                              >
                                {post.authorNickname}
                              </span>

                              {/* Huy hiệu đặc quyền tinh tế */}
                              {isAuthorAdmin && (
                                <span className="privilege-badge founder" title="Quản trị viên / Sáng lập">
                                  <Crown size={11} /> Sáng Lập
                                </span>
                              )}
                              {post.authorVipTier === 'VIP_DIAMOND' && (
                                <span className="privilege-badge vip" title="Thành viên VIP">
                                  <Gem size={11} /> VIP
                                </span>
                              )}
                              {post.authorIsVerified && (
                                <CheckCircle2 size={14} color="#38bdf8" title="Đã xác thực" />
                              )}

                              <span className="author-handle">@{post.authorAccount}</span>
                            </div>

                            <div className="post-meta-sub">
                              <span>{post.formattedTime}</span>
                              {post.authorLocation && <span>• 📍 {post.authorLocation}</span>}
                              {post.vibe && <span className="vibe-tag-badge">• {post.vibe}</span>}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleToggleSavePost(post.id)}
                            className={`btn-save-post ${isSaved ? 'saved' : ''}`}
                            title={isSaved ? "Bỏ lưu" : "Lưu bài viết"}
                          >
                            <Bookmark size={16} fill={isSaved ? "#818cf8" : "none"} />
                          </button>
                        </div>

                        {/* Nội dung bài viết */}
                        <div className="post-body-content">
                          <p>{post.content}</p>
                          {post.imageUrl && (
                            <div className="post-media-frame">
                              <img src={post.imageUrl} alt="Đính kèm" loading="lazy" />
                            </div>
                          )}
                        </div>

                        {/* Thanh tương tác */}
                        <div className="post-actions-toolbar">
                          <div className="reaction-drop-wrapper">
                            <button 
                              onClick={() => handleReactPost(post.id, post.myReaction || 'HEART')}
                              onMouseEnter={() => setActiveReactionPicker(post.id)}
                              className={`action-btn ${post.isLikedByMe ? 'active-liked' : ''}`}
                            >
                              {currentReaction ? (
                                <span className="custom-emoji-view">{currentReaction.emoji}</span>
                              ) : (
                                <Heart size={16} fill={post.isLikedByMe ? "#ef4444" : "none"} color={post.isLikedByMe ? "#ef4444" : "currentColor"} />
                              )}
                              <span>{post.likesCount || 0}</span>
                            </button>

                            {/* Bảng chọn Emoji Reactions */}
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

                          <button 
                            onClick={() => handleToggleComments(post.id)}
                            className="action-btn"
                          >
                            <MessageCircle size={16} />
                            <span>{post.commentsCount || 0}</span>
                          </button>

                          <button 
                            onClick={() => handleCopyPostLink(post)}
                            className="action-btn"
                            title="Sao chép liên kết"
                          >
                            <Share2 size={16} />
                            <span>Chia sẻ</span>
                          </button>
                        </div>

                        {/* Khu vực bình luận */}
                        {expandedComments[post.id] && (
                          <div className="post-comments-container">
                            <div className="comments-stack">
                              {commentsMap[post.id]?.length === 0 ? (
                                <p className="empty-cmt-notice">Chưa có bình luận nào.</p>
                              ) : (
                                commentsMap[post.id]?.map((cmt) => (
                                  <div key={cmt.id} className="cmt-row">
                                    <UserAvatar avatar={cmt.authorAvatar} size={26} />
                                    <div className="cmt-bubble-content">
                                      <div className="cmt-name-row">
                                        <span className="cmt-user-name">{cmt.authorNickname}</span>
                                        <span className="cmt-time-label">{cmt.formattedTime}</span>
                                      </div>
                                      <p className="cmt-body-text">{cmt.content}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <form onSubmit={(e) => handleAddComment(e, post.id)} className="cmt-input-form">
                              <input 
                                type="text" 
                                placeholder="Viết phản hồi..."
                                value={commentInputs[post.id] || ''}
                                onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                              />
                              <button 
                                type="submit" 
                                disabled={!commentInputs[post.id]?.trim() || submittingComment[post.id]}
                                className="btn-submit-cmt"
                              >
                                <CornerDownRight size={14} />
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

          {/* NỘI DUNG 2: PHÒNG CHAT */}
          {activeTab === 'rooms' && (
            <div className="rooms-section-wrapper">
              <div className="rooms-header-banner">
                <div>
                  <h3>Phòng Trò Chuyện & Gọi Thoại WebRTC</h3>
                  <p>Tham gia trao đổi văn bản và kết nối âm thanh thời gian thực với độ trễ thấp.</p>
                </div>
                <button onClick={() => setIsCreateModalOpen(true)} className="btn-add-room-action">
                  <Plus size={15} /> Tạo phòng mới
                </button>
              </div>

              <div className="rooms-cards-grid">
                {rooms.map((room) => {
                  const alreadyIn = isUserInRoom(room);
                  return (
                    <div key={room.id} className={`room-simple-card ${alreadyIn ? 'active-room' : ''}`}>
                      <div className="room-top-info">
                        <h4>{room.nameroom}</h4>
                        <span className="room-online-tag">
                          <span className="green-circle"></span>
                          {room.soluong || room.userRoomDTOList?.length || 0} online
                        </span>
                      </div>

                      <div className="room-chips-list">
                        {room.hasPassword && (
                          <span className="room-flag locked"><Lock size={11} /> Khóa</span>
                        )}
                        {alreadyIn && (
                          <span className="room-flag joined"><CheckCircle size={11} /> Đã vào</span>
                        )}
                      </div>

                      <div className="room-card-bottom">
                        {alreadyIn ? (
                          <button onClick={() => navigate(`/room/${room.id}`)} className="btn-join-room btn-rejoin">
                            Vào lại phòng <ArrowRight size={14} />
                          </button>
                        ) : (
                          <button onClick={() => setSelectedRoom(room)} className="btn-join-room">
                            Tham gia ngay <ArrowRight size={14} />
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
        {/* CỘT 3: TIỆN ÍCH PHẢI (WIDGETS) */}
        {/* ============================================================== */}
        <aside className="widgets-sidebar">
          {/* Ô Tìm kiếm */}
          <div className="search-input-wrap">
            <Search size={16} className="search-icon-muted" />
            <input 
              type="text" 
              placeholder="Tìm kiếm nội dung..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
            />
            {searchKeyword && (
              <button type="button" onClick={() => { setSearchKeyword(''); fetchPosts(); }} className="btn-clear-kw">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Tiện ích Ghép Đôi Vibe Tối Giản */}
          <div className="widget-box-card">
            <div className="widget-card-title">
              <Zap size={16} color="#eab308" />
              <span>Ghép Vibe Ẩn Danh</span>
            </div>
            <p className="widget-card-desc">Kết nối ngẫu nhiên 1-1 với người dùng đang online cùng chung tâm trạng.</p>
            <button onClick={handleStartSpeedMatch} className="btn-widget-action">
              Tìm bạn trò chuyện
            </button>
          </div>

          {/* Tiện ích Vòng Quay Thử Thách */}
          <div className="widget-box-card">
            <div className="widget-card-title">
              <Dices size={16} color="#818cf8" />
              <span>Vòng Quay Party</span>
            </div>
            <p className="widget-card-desc">Bốc thăm câu hỏi thú nhận hoặc thử thách vui cùng bạn bè.</p>
            <button onClick={() => setIsPartyWheelOpen(true)} className="btn-widget-action secondary">
              Mở vòng quay
            </button>
          </div>

          {/* Phòng Chat Đang Hoạt Động */}
          <div className="widget-box-card">
            <div className="widget-card-title">
              <Radio size={16} color="#34d399" />
              <span>Phòng Đang Hoạt Động</span>
            </div>
            <div className="widget-rooms-col">
              {rooms.slice(0, 3).map((r) => (
                <div key={r.id} className="widget-room-row" onClick={() => navigate(`/room/${r.id}`)}>
                  <div>
                    <span className="w-room-title">#{r.nameroom}</span>
                    <span className="w-room-count">{r.soluong || r.userRoomDTOList?.length || 0} người</span>
                  </div>
                  <ChevronRight size={14} color="#64748b" />
                </div>
              ))}
            </div>
          </div>

          <div className="widget-legal-footer">
            <p>© 2026 Chat Together. Nền tảng kết nối & mạng xã hội tối giản.</p>
          </div>
        </aside>

      </div>

      {/* THANH ĐIỀU HƯỚNG DÀNH CHO MOBILE */}
      <nav className="mobile-bottom-nav">
        <button 
          className={`b-nav-item ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          <Compass size={20} />
          <span>Bảng tin</span>
        </button>

        <button 
          className={`b-nav-item ${activeTab === 'trending' ? 'active' : ''}`}
          onClick={() => setActiveTab('trending')}
        >
          <Flame size={20} />
          <span>Hot</span>
        </button>

        <button 
          className="b-nav-item b-nav-create-center"
          onClick={() => {
            setActiveTab('feed');
            setTimeout(() => newPostInputRef.current?.focus(), 100);
          }}
        >
          <Plus size={24} />
        </button>

        <button 
          className={`b-nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
          onClick={() => setActiveTab('rooms')}
        >
          <Radio size={20} />
          <span>Phòng</span>
        </button>

        <button 
          className="b-nav-item"
          onClick={() => setSelectedProfileUserId(currentUserId)}
        >
          <User size={20} />
          <span>Hồ sơ</span>
        </button>
      </nav>

      {/* MODAL SPEED MATCH */}
      {isSpeedMatchOpen && (
        <div className="modal-veil" onClick={() => setIsSpeedMatchOpen(false)}>
          <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title-flex">
                <Zap size={18} color="#eab308" />
                <h4>Ghép Vibe Ẩn Danh</h4>
              </div>
              <button onClick={() => setIsSpeedMatchOpen(false)} className="btn-close-dialog"><X size={16} /></button>
            </div>

            {matchingStatus === 'searching' ? (
              <div className="dialog-searching-body">
                <div className="radar-circle">
                  <Zap size={24} color="#eab308" />
                </div>
                <p>Đang tìm người dùng online cùng chung cảm xúc...</p>
              </div>
            ) : (
              <div className="dialog-matched-body">
                <div className="partner-matched-card">
                  <UserAvatar size={42} />
                  <div>
                    <strong>{matchedPartner?.nickname}</strong>
                    <p>{matchedPartner?.vibe}</p>
                  </div>
                </div>

                <div className="icebreaker-quote">
                  <span>💡 Câu hỏi phá băng:</span>
                  <p>"{matchedPartner?.icebreaker}"</p>
                </div>

                <div className="dialog-actions-row">
                  <button onClick={() => setMatchingStatus('searching')} className="btn-dialog-back">Tìm người khác</button>
                  <button 
                    onClick={() => {
                      setIsSpeedMatchOpen(false);
                      toast.success("Đang kết nối vào phòng trò chuyện...");
                    }} 
                    className="btn-dialog-primary"
                  >
                    Bắt đầu trò chuyện
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PARTY WHEEL */}
      {isPartyWheelOpen && (
        <div className="modal-veil" onClick={() => setIsPartyWheelOpen(false)}>
          <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title-flex">
                <Dices size={18} color="#818cf8" />
                <h4>Vòng Quay Thử Thách</h4>
              </div>
              <button onClick={() => setIsPartyWheelOpen(false)} className="btn-close-dialog"><X size={16} /></button>
            </div>

            <div className="wheel-dialog-body">
              <div className={`clean-wheel-dial ${wheelSpinning ? 'spinning' : ''}`}>
                <Dices size={28} color="#818cf8" />
              </div>

              {wheelResult && (
                <div className="wheel-card-result">
                  <span>Nhiệm vụ của bạn:</span>
                  <p>{wheelResult}</p>
                </div>
              )}

              <button 
                onClick={handleSpinPartyWheel} 
                disabled={wheelSpinning}
                className="btn-spin-action"
              >
                {wheelSpinning ? 'Đang quay...' : 'Bốc thăm câu hỏi 🎲'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HỒ SƠ */}
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

      {/* MODAL TẠO PHÒNG */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="modal-veil" onClick={() => setIsCreateModalOpen(false)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-dialog-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dialog-header">
                <h4>Tạo Phòng Trò Chuyện</h4>
                <button onClick={() => setIsCreateModalOpen(false)} className="btn-close-dialog"><X size={16} /></button>
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL VÀO PHÒNG CÓ KHÓA */}
      <AnimatePresence>
        {selectedRoom && (
          <div className="modal-veil" onClick={() => setSelectedRoom(null)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-dialog-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dialog-header">
                <h4>Tham gia #{selectedRoom.nameroom}</h4>
                <button onClick={() => setSelectedRoom(null)} className="btn-close-dialog"><X size={16} /></button>
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
                      required
                    />
                  </div>
                ) : (
                  <p className="clean-hint">Phòng này công khai, bạn có thể tham gia ngay.</p>
                )}
                <div className="dialog-actions-row">
                  <button type="button" onClick={() => setSelectedRoom(null)} className="btn-dialog-back">Hủy</button>
                  <button type="submit" className="btn-dialog-primary">Vào phòng</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CSS TỐI GIẢN - CÂN ĐỐI - KHÔNG MÀU MÈ - KHÔNG BỊ TRỐNG ĐEN */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --social-bg: #090d16;
          --sidebar-bg: #0b1120;
          --card-bg: #111827;
          --card-border: rgba(255, 255, 255, 0.07);
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --brand: #6366f1;
          --brand-hover: #4f46e5;
        }

        .social-app-wrapper {
          min-height: 100vh;
          background: var(--social-bg);
          color: var(--text-main);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          justify-content: center;
        }

        /* KHUNG CHÍNH CĂN GIỮA - CO GIÃN HỢP LÝ */
        .app-main-layout {
          display: flex;
          width: 100%;
          max-width: 1320px;
          margin: 0 auto;
        }

        /* CỘT 1: THANH ĐIỀU HƯỚNG TRÁI */
        .nav-sidebar {
          width: 250px;
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
        .brand-logo-glow {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #6366f1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .brand-meta { display: flex; flex-direction: column; }
        .brand-name { font-size: 16px; font-weight: 700; color: #f8fafc; }
        .brand-sub { font-size: 10px; color: #64748b; font-weight: 500; }

        /* Widget Radio tối giản */
        .ambient-radio-widget {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--card-border);
          border-radius: 10px;
          padding: 8px 10px;
          margin-bottom: 14px;
        }
        .radio-top-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }
        .radio-name-text {
          font-size: 11px;
          font-weight: 600;
          color: #cbd5e1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .radio-btns-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .btn-radio-toggle, .btn-radio-next {
          background: rgba(255, 255, 255, 0.08);
          border: none;
          color: #cbd5e1;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .btn-radio-toggle:hover { background: #6366f1; color: white; }
        .radio-genre-label {
          font-size: 9.5px;
          color: #64748b;
          margin-left: auto;
        }

        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 10px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-main);
        }
        .nav-item.active {
          background: rgba(99, 102, 241, 0.12);
          color: #818cf8;
          font-weight: 700;
        }

        .nav-action-box {
          margin-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .btn-speed-match-minimal, .btn-party-wheel-minimal, .btn-create-room-minimal {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid var(--card-border);
          background: rgba(255, 255, 255, 0.03);
          color: #cbd5e1;
          transition: all 0.15s;
        }
        .btn-speed-match-minimal:hover { background: rgba(234, 179, 8, 0.1); border-color: rgba(234, 179, 8, 0.3); color: #eab308; }
        .btn-party-wheel-minimal:hover { background: rgba(129, 140, 248, 0.1); border-color: rgba(129, 140, 248, 0.3); color: #818cf8; }
        .btn-create-room-minimal:hover { background: rgba(255, 255, 255, 0.08); color: white; }

        .nav-footer { margin-top: auto; padding-top: 10px; }
        .btn-logout-nav {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 10px;
          background: transparent;
          border: none;
          color: #ef4444;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
        }
        .btn-logout-nav:hover { background: rgba(239, 68, 68, 0.08); }

        /* CỘT 2: STREAM CHÍNH */
        .main-stream {
          flex: 1;
          min-width: 0;
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
        .m-logo { width: 28px; height: 28px; border-radius: 8px; }
        .m-title { font-size: 14.5px; font-weight: 700; }
        .m-actions { display: flex; align-items: center; gap: 8px; }
        .m-radio-pill {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--card-border);
          color: #cbd5e1;
          border-radius: 14px;
          padding: 3px 8px;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .m-radio-pill.active { background: #6366f1; color: white; }

        .stream-header {
          position: sticky;
          top: 0;
          background: rgba(9, 13, 22, 0.9);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--card-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          z-index: 30;
        }
        .stream-tabs {
          display: flex;
          gap: 4px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .stream-tabs::-webkit-scrollbar { display: none; }
        .stream-tab {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 16px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .stream-tab.active {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-main);
        }
        .btn-header-notif {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--card-border);
          color: #cbd5e1;
          width: 32px;
          height: 32px;
          border-radius: 50%;
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
          top: 6px;
          right: 6px;
        }

        .notif-dropdown-card {
          position: absolute;
          top: 52px;
          right: 16px;
          width: 300px;
          background: #111827;
          border: 1px solid var(--card-border);
          box-shadow: 0 10px 30px rgba(0,0,0,0.6);
          border-radius: 12px;
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
        .notif-header h4 { margin: 0; font-size: 12.5px; }
        .btn-read-all { background: transparent; border: none; color: #818cf8; font-size: 10.5px; cursor: pointer; }
        .notif-list { display: flex; flex-direction: column; gap: 4px; }
        .notif-item {
          display: flex;
          gap: 8px;
          padding: 6px;
          border-radius: 8px;
          font-size: 11.5px;
          background: rgba(255, 255, 255, 0.02);
        }
        .notif-item.unread { background: rgba(99, 102, 241, 0.08); }
        .notif-text-wrap p { margin: 0; color: #f1f5f9; }
        .notif-text-wrap span { font-size: 9.5px; color: #64748b; }

        /* DẢI TÍN HIỆU TRỰC TIẾP (THAY THẾ STORY) */
        .live-signals-strip {
          padding: 10px 16px;
          border-bottom: 1px solid var(--card-border);
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
        }
        .live-signal-label {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .live-signal-scroll {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .live-signal-scroll::-webkit-scrollbar { display: none; }
        .signal-pill {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          color: #cbd5e1;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          white-space: nowrap;
        }
        .signal-pill:hover { background: rgba(255, 255, 255, 0.08); color: white; }
        .signal-pill.active { border-color: rgba(99, 102, 241, 0.4); color: #818cf8; }
        .status-dot.green {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
        }

        /* HỘP SOẠN BÀI VIẾT */
        .post-creator-box {
          padding: 16px;
          border-bottom: 1px solid var(--card-border);
          background: rgba(17, 24, 39, 0.3);
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
          color: #f8fafc;
          font-size: 14px;
          font-family: inherit;
          resize: none;
          outline: none;
          line-height: 1.5;
        }
        .creator-field-wrap textarea::placeholder { color: #64748b; }

        .vibe-tags-row {
          display: flex;
          gap: 6px;
          margin: 10px 0 10px 52px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .vibe-tags-row::-webkit-scrollbar { display: none; }
        .vibe-tag-pill {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--card-border);
          color: #94a3b8;
          font-size: 10.5px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
        }
        .vibe-tag-pill.active {
          background: rgba(99, 102, 241, 0.15);
          border-color: #6366f1;
          color: #818cf8;
        }

        .image-input-row {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--card-border);
          border-radius: 8px;
          padding: 5px 10px;
          margin: 6px 0 10px 52px;
        }
        .image-input-row input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 12px;
          outline: none;
        }
        .btn-clear-img { background: transparent; border: none; color: #ef4444; cursor: pointer; }
        .post-img-preview {
          margin: 0 0 10px 52px;
          max-height: 200px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--card-border);
        }
        .post-img-preview img { width: 100%; height: 100%; object-fit: cover; }

        .creator-bottom-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-left: 52px;
        }
        .creator-left-tools { display: flex; gap: 8px; }
        .btn-subtool {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 11.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 6px;
        }
        .btn-subtool:hover { color: #f8fafc; }
        .btn-subtool.active { color: #818cf8; }
        .btn-publish-submit {
          background: var(--brand);
          color: white;
          border: none;
          padding: 6px 14px;
          border-radius: 16px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .btn-publish-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-publish-submit:hover:not(:disabled) { background: var(--brand-hover); }

        /* POST CARDS */
        .post-item-card {
          padding: 16px;
          border-bottom: 1px solid var(--card-border);
        }
        .post-item-card:hover { background: rgba(255, 255, 255, 0.01); }
        .post-header-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .post-avatar-click { cursor: pointer; flex-shrink: 0; }
        .post-header-info { flex: 1; }
        .post-name-line {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .author-display-name {
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
          cursor: pointer;
        }
        .privilege-badge {
          font-size: 9.5px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .privilege-badge.founder {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .privilege-badge.vip {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
        }
        .author-handle { font-size: 11.5px; color: #64748b; }
        .post-meta-sub {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
          display: flex;
          gap: 4px;
        }
        .vibe-tag-badge { color: #818cf8; }
        .btn-save-post {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
        }
        .btn-save-post.saved { color: #818cf8; }

        .post-body-content {
          margin: 8px 0 10px 48px;
          font-size: 13.5px;
          line-height: 1.5;
          color: #e2e8f0;
        }
        .post-body-content p { margin: 0; white-space: pre-wrap; word-break: break-word; }
        .post-media-frame {
          margin-top: 8px;
          border-radius: 10px;
          overflow: hidden;
          max-height: 320px;
          border: 1px solid var(--card-border);
        }
        .post-media-frame img { width: 100%; height: 100%; object-fit: cover; }

        .post-actions-toolbar {
          margin-left: 48px;
          display: flex;
          gap: 10px;
          position: relative;
        }
        .reaction-drop-wrapper { position: relative; }
        .action-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--card-border);
          color: #94a3b8;
          font-size: 12px;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .action-btn:hover { background: rgba(255, 255, 255, 0.06); color: white; }
        .action-btn.active-liked { color: #ef4444; border-color: rgba(239, 68, 68, 0.3); }
        .custom-emoji-view { font-size: 14px; }

        .reactions-popup-menu {
          position: absolute;
          bottom: 34px;
          left: 0;
          background: #1f2937;
          border: 1px solid var(--card-border);
          box-shadow: 0 8px 24px rgba(0,0,0,0.6);
          border-radius: 20px;
          padding: 3px 6px;
          display: flex;
          gap: 4px;
          z-index: 40;
        }
        .reaction-emoji-item {
          background: transparent;
          border: none;
          font-size: 18px;
          cursor: pointer;
          padding: 3px;
        }
        .reaction-emoji-item:hover { transform: scale(1.3); }

        /* Comments */
        .post-comments-container {
          margin: 10px 0 0 48px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--card-border);
          border-radius: 10px;
          padding: 10px;
        }
        .comments-stack { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
        .empty-cmt-notice { margin: 0; font-size: 11.5px; color: #64748b; font-style: italic; }
        .cmt-row { display: flex; gap: 8px; }
        .cmt-bubble-content {
          background: rgba(255, 255, 255, 0.03);
          padding: 5px 8px;
          border-radius: 8px;
          flex: 1;
        }
        .cmt-name-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
        .cmt-user-name { font-size: 11.5px; font-weight: 700; color: #f8fafc; }
        .cmt-time-label { font-size: 9.5px; color: #64748b; }
        .cmt-body-text { margin: 0; font-size: 12px; color: #cbd5e1; }
        .cmt-input-form { display: flex; gap: 6px; }
        .cmt-input-form input {
          flex: 1;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          padding: 5px 10px;
          color: white;
          font-size: 12px;
          outline: none;
        }
        .btn-submit-cmt {
          background: var(--brand);
          color: white;
          border: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        /* ROOMS SECTION */
        .rooms-section-wrapper { padding: 16px; }
        .rooms-header-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .rooms-header-banner h3 { margin: 0 0 3px 0; font-size: 15px; }
        .rooms-header-banner p { margin: 0; font-size: 11.5px; color: #94a3b8; }
        .btn-add-room-action {
          background: #6366f1;
          color: white;
          border: none;
          padding: 7px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .rooms-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 10px;
        }
        .room-simple-card {
          background: #111827;
          border: 1px solid var(--card-border);
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .room-simple-card.active-room { border-color: rgba(99, 102, 241, 0.4); }
        .room-top-info { display: flex; justify-content: space-between; align-items: center; }
        .room-top-info h4 { margin: 0; font-size: 13.5px; }
        .room-online-tag { font-size: 10px; color: #34d399; display: flex; align-items: center; gap: 4px; }
        .green-circle { width: 5px; height: 5px; border-radius: 50%; background: #10b981; }
        .room-chips-list { display: flex; gap: 4px; }
        .room-flag { font-size: 9.5px; padding: 1px 5px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; }
        .room-flag.locked { background: rgba(239, 68, 68, 0.15); color: #f87171; }
        .room-flag.joined { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .btn-join-room {
          width: 100%;
          background: #1f2937;
          color: white;
          border: none;
          padding: 7px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin-top: 4px;
        }
        .btn-join-room:hover { background: #374151; }
        .btn-rejoin { background: #4f46e5; }
        .btn-rejoin:hover { background: #4338ca; }

        /* CỘT 3: WIDGETS PHẢI */
        .widgets-sidebar {
          width: 300px;
          padding: 18px 14px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-shrink: 0;
        }
        .search-input-wrap {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          display: flex;
          align-items: center;
          padding: 7px 10px;
          gap: 6px;
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
        .btn-clear-kw { background: transparent; border: none; color: #64748b; cursor: pointer; }

        .widget-box-card {
          background: #111827;
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 12px;
        }
        .widget-card-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 6px;
        }
        .widget-card-desc { font-size: 11px; color: #94a3b8; margin: 0 0 10px 0; line-height: 1.4; }
        .btn-widget-action {
          width: 100%;
          background: #eab308;
          color: #090d16;
          border: none;
          padding: 7px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 11.5px;
          cursor: pointer;
        }
        .btn-widget-action.secondary {
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
          border: 1px solid rgba(99, 102, 241, 0.3);
        }

        .widget-rooms-col { display: flex; flex-direction: column; gap: 4px; }
        .widget-room-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.02);
          cursor: pointer;
        }
        .widget-room-row:hover { background: rgba(255, 255, 255, 0.05); }
        .w-room-title { font-size: 12px; font-weight: 600; display: block; }
        .w-room-count { font-size: 10px; color: #10b981; }

        .widget-legal-footer p { font-size: 10.5px; color: #64748b; margin: 0; }

        /* MOBILE NAV */
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 56px;
          background: rgba(11, 17, 32, 0.95);
          backdrop-filter: blur(10px);
          border-top: 1px solid var(--card-border);
          justify-content: space-around;
          align-items: center;
          z-index: 80;
        }
        .b-nav-item {
          background: transparent;
          border: none;
          color: #94a3b8;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          font-size: 9.5px;
          cursor: pointer;
        }
        .b-nav-item.active { color: #818cf8; }
        .b-nav-create-center {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #6366f1;
          color: white;
          justify-content: center;
          margin-top: -14px;
        }

        /* MODAL COMMON */
        .modal-veil {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .modal-dialog-box {
          background: #111827;
          border: 1px solid var(--card-border);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
          border-radius: 14px;
          width: 100%;
          max-width: 380px;
          padding: 16px;
        }
        .dialog-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .dialog-title-flex { display: flex; align-items: center; gap: 6px; }
        .dialog-header h4 { margin: 0; font-size: 14.5px; }
        .btn-close-dialog { background: transparent; border: none; color: #94a3b8; cursor: pointer; }
        .dialog-form { display: flex; flex-direction: column; gap: 10px; }
        .dialog-field { display: flex; flex-direction: column; gap: 4px; }
        .dialog-field label { font-size: 11px; font-weight: 600; color: #94a3b8; }
        .dialog-field input {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid #374151;
          border-radius: 6px;
          padding: 7px 10px;
          color: white;
          font-size: 12.5px;
          outline: none;
        }
        .dialog-actions-row { display: flex; gap: 8px; margin-top: 8px; }
        .btn-dialog-back {
          flex: 1;
          background: #1f2937;
          color: #cbd5e1;
          border: none;
          padding: 8px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-dialog-primary {
          flex: 1;
          background: #6366f1;
          color: white;
          border: none;
          padding: 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        /* Speed match dialog */
        .dialog-searching-body { text-align: center; padding: 20px 10px; }
        .radar-circle {
          width: 50px;
          height: 50px;
          margin: 0 auto 12px;
          border-radius: 50%;
          border: 2px solid #eab308;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulseGreen 1.2s infinite;
        }
        .partner-matched-card {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--card-border);
          border-radius: 8px;
          padding: 8px;
          margin-bottom: 10px;
        }
        .partner-matched-card strong { display: block; font-size: 13px; }
        .partner-matched-card p { margin: 2px 0 0 0; font-size: 11px; color: #94a3b8; }
        .icebreaker-quote {
          background: rgba(234, 179, 8, 0.08);
          border: 1px dashed rgba(234, 179, 8, 0.3);
          border-radius: 8px;
          padding: 8px;
          margin-bottom: 12px;
        }
        .icebreaker-quote span { font-size: 10.5px; font-weight: 700; color: #eab308; }
        .icebreaker-quote p { margin: 3px 0 0 0; font-size: 12px; font-weight: 600; color: #f8fafc; }

        /* Wheel dialog */
        .wheel-dialog-body { text-align: center; }
        .clean-wheel-dial {
          width: 80px;
          height: 80px;
          margin: 10px auto 16px;
          border-radius: 50%;
          border: 2px solid #818cf8;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .clean-wheel-dial.spinning { animation: spinWheel 1.2s cubic-bezier(0.15, 0.9, 0.3, 1.2) forwards; }
        .wheel-card-result {
          background: rgba(129, 140, 248, 0.1);
          border: 1px solid rgba(129, 140, 248, 0.3);
          border-radius: 8px;
          padding: 10px;
          margin-bottom: 12px;
          text-align: left;
        }
        .wheel-card-result span { font-size: 10px; font-weight: 700; color: #818cf8; }
        .wheel-card-result p { margin: 4px 0 0 0; font-size: 12.5px; color: white; }
        .btn-spin-action {
          width: 100%;
          background: #6366f1;
          color: white;
          border: none;
          padding: 9px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 12.5px;
          cursor: pointer;
        }

        .feed-status-box { padding: 40px 20px; text-align: center; color: #64748b; }
        .feed-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255,255,255,0.1);
          border-bottom-color: #818cf8;
          border-radius: 50%;
          margin: 0 auto 10px;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        /* RESPONSIVE */
        @media (max-width: 1024px) {
          .widgets-sidebar { display: none; }
        }

        @media (max-width: 768px) {
          .nav-sidebar { display: none; }
          .mobile-top-bar { display: flex; }
          .mobile-bottom-nav { display: flex; }
          .main-stream { max-width: 100%; padding-bottom: 60px; }
          .vibe-tags-row { margin-left: 0; }
          .image-input-row { margin-left: 0; }
          .post-img-preview { margin-left: 0; }
          .creator-bottom-row { padding-left: 0; }
          .post-body-content { margin-left: 0; }
          .post-actions-toolbar { margin-left: 0; }
          .post-comments-container { margin-left: 0; }
        }
      `}} />
    </div>
  );
};

export default Home;
