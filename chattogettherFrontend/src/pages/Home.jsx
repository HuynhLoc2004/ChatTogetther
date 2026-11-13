import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, LogOut, Plus, MessageSquare, Shield, User, X, Lock, Hash, 
  CheckCircle, ArrowRight, WifiOff, Heart, MessageCircle, Share2, 
  Search, Sparkles, Send, Copy, Compass, Radio, ChevronRight, CornerDownRight,
  Bell, Bookmark, Flame, Gem, Crown, Volume2, VolumeX, Music, Play, Pause,
  Shuffle, Image as ImageIcon, CheckCircle2, Zap, Dices,
  Edit3, Trash2, MoreVertical, Tag, Filter, Check,
  Mic, Headphones, Moon, Gamepad2, Film, Square
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import { saveRoomsOffline, getRoomsOffline } from '../utils/offlineDB';
import UserProfileModal from './UserProfileModal';
import FriendsModal from './FriendsModal';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import toast from 'react-hot-toast';
import TalovinLogo from '../components/TalovinLogo';

// Avatar: Ưu tiên ảnh thật từ backend. Nếu chưa có ảnh, dùng DiceBear neutral theo username
export const UserAvatar = ({ avatar, name = '', size = 36, className = "" }) => {
  const seed = encodeURIComponent(name || 'user');
  const fallback = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${seed}`;
  const src = avatar && avatar.trim() ? avatar : fallback;

  return (
    <img 
      src={src} 
      alt={name || "Avatar"} 
      className={`user-avatar-img ${className}`} 
      style={{ 
        width: size, 
        height: size, 
        borderRadius: '50%', 
        objectFit: 'cover',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: '#18181b',
        flexShrink: 0
      }} 
      onError={(e) => {
        if (e.target.src !== fallback) {
          e.target.src = fallback;
        }
      }}
    />
  );
};

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

// Danh sách câu hỏi Thử Thách Party
const PARTY_QUESTIONS = [
  "Thú nhận: Điều ngớ ngẩn nhất bạn từng làm khi thích một ai đó?",
  "Thử thách: Hát 1 câu bất kỳ bằng giọng ngọng trong 10 giây!",
  "Thú nhận: Bạn có đang crush ai trong danh sách bạn bè không?",
  "Thử thách: Đổi bio trang cá nhân thành một câu siêu sến trong 1 tiếng!",
  "Thú nhận: Lời nói dối vô hại gần đây nhất của bạn là gì?",
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

const Home = () => {
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem('user_id');
  const currentUserName = localStorage.getItem('nickname') || localStorage.getItem('username') || '';

  // Navigation tab chính: 'feed' | 'rooms' | 'trending' | 'saved'
  const [activeTab, setActiveTab] = useState('feed');

  // State Phòng Chat
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [newRoomData, setNewRoomData] = useState({ name: '', password: '' });
  const [joinData, setJoinData] = useState({ nickname: '', password: '' });

  // State Bài Viết
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
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
  const [notifications, setNotifications] = useState([]);

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

  // Kiểm tra phòng đang tham gia
  const isUserInRoom = (room) => {
    if (!room || !room.userRoomDTOList) return false;
    const account = localStorage.getItem('account');
    return room.userRoomDTOList.some(ur => ur.userDTO && (ur.userDTO.account === account || ur.userDTO.id?.toString() === currentUserId?.toString()));
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
      if (!isSilent) setLoadingPosts(true);
      const response = await axiosClient.get('/posts');
      if (response.data && response.data.data) {
        setPosts(response.data.data);
      }
    } catch (err) {
      console.error("Lỗi khi nạp bài viết:", err);
    } finally {
      if (!isSilent) setLoadingPosts(false);
    }
  }, []);

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
        content: newPostContent.trim() || (voiceBase64 ? "Ghi âm giọng nói" : "Khoảnh khắc hình ảnh"),
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
      toast.error(err.response?.data?.message || "Không thể đăng bài viết lúc này!");
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

  const handleAddComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    try {
      setSubmittingComment(prev => ({ ...prev, [postId]: true }));
      const res = await axiosClient.post(`/posts/${postId}/comments`, { content: text });
      if (res.data && res.data.data) {
        setCommentsMap(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), res.data.data]
        }));
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
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
      const res = await axiosClient.put(`/posts/${postId}/comments/${commentId}`, {
        content: editingCommentText.trim()
      });
      if (res.data && res.data.data) {
        setCommentsMap(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).map(c => c.id === commentId ? res.data.data : c)
        }));
        setEditingCommentId(null);
        toast.success("Đã sửa bình luận");
      }
    } catch (err) {
      toast.error("Lỗi cập nhật bình luận!");
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

  // Speed Match - Kết nối trực tiếp thành viên thật hoặc duy trì Radar chờ
  const handleStartSpeedMatch = () => {
    setIsSpeedMatchOpen(true);
    setMatchingStatus('searching');

    const myName = currentUserName || localStorage.getItem('nickname') || '';
    const realUsers = (posts || [])
      .map(p => ({
        userId: p.authorId || p.userId,
        nickname: p.authorName || p.authorNickname || p.author,
        avatar: p.authorAvatar,
        vibe: p.vibe ? `Quan tâm: ${p.vibe}` : 'Đang lắng nghe âm nhạc cùng sảnh Talovin',
        icebreaker: ICEBREAKER_PROMPTS[Math.floor(Math.random() * ICEBREAKER_PROMPTS.length)]
      }))
      .filter(u => u.nickname && u.nickname !== myName);

    setTimeout(() => {
      if (realUsers.length > 0) {
        const picked = realUsers[Math.floor(Math.random() * realUsers.length)];
        setMatchedPartner(picked);
        setMatchingStatus('matched');
      } else {
        setMatchingStatus('waiting');
      }
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
    if (room.hasPassword) {
      setSelectedRoom(room);
    } else {
      axiosClient.post('/rooms/join-room', { roomId: room.id, password: null }, { params: { room_id: room.id, idRoom: room.id } })
        .then(() => {
          navigate(`/room/${room.id}`);
        })
        .catch(() => {
          setSelectedRoom(room);
        });
    }
  };

  const displayedPosts = posts.filter(p => {
    if (activeFilterTag) {
      const pVibe = (p.vibe || '').toLowerCase();
      const pContent = (p.content || '').toLowerCase();
      const tagLower = activeFilterTag.toLowerCase();
      if (!pVibe.includes(tagLower) && !pContent.includes(tagLower)) return false;
    }

    if (activeTab === 'saved') {
      return savedPostIds.includes(p.id);
    }
    if (activeTab === 'trending') {
      return (p.likesCount || 0) >= 1 || (p.commentsCount || 0) >= 1;
    }
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      const matchContent = (p.content || '').toLowerCase().includes(kw);
      const matchAuthor = (p.authorNickname || p.authorAccount || '').toLowerCase().includes(kw);
      const matchVibe = (p.vibe || '').toLowerCase().includes(kw);
      return matchContent || matchAuthor || matchVibe;
    }
    return true;
  });

  const allCommunitySparks = Array.from(new Set(
    posts.flatMap(p => {
      const tags = [];
      if (p.vibe) {
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

      {/* KHUNG CĂN GIỮA TOÀN BỘ ỨNG DỤNG - DARK ZINC MATTE */}
      <div className="app-main-layout">

        {/* ============================================================== */}
        {/* CỘT 1: THANH ĐIỀU HƯỚNG TRÁI (220px - 240px) */}
        {/* ============================================================== */}
        <aside className="nav-sidebar">
          <div className="nav-brand" onClick={() => setActiveTab('feed')}>
            <TalovinLogo size={30} />
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

          {/* Menu Điều Hướng (Clean Active State - Bỏ nền tím) */}
          <div className="nav-menu">
            <button 
              className={`nav-item ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              <Compass size={15} strokeWidth={1.5} />
              <span>Sảnh trực tuyến</span>
            </button>

            <button 
              className={`nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
              onClick={() => setActiveTab('rooms')}
            >
              <Radio size={15} strokeWidth={1.5} />
              <span>Phòng đàm thoại</span>
            </button>

            <button 
              className={`nav-item ${activeTab === 'trending' ? 'active' : ''}`}
              onClick={() => setActiveTab('trending')}
            >
              <Flame size={15} strokeWidth={1.5} />
              <span>Thịnh hành</span>
            </button>

            <button 
              className={`nav-item ${activeTab === 'saved' ? 'active' : ''}`}
              onClick={() => setActiveTab('saved')}
            >
              <Bookmark size={15} strokeWidth={1.5} />
              <span>Đã lưu ({savedPostIds.length})</span>
            </button>

            <button 
              className="nav-item"
              onClick={() => setIsFriendsOpen(true)}
            >
              <Users size={15} strokeWidth={1.5} />
              <span>Bạn bè</span>
            </button>

            <button 
              className="nav-item"
              onClick={() => setSelectedProfileUserId(currentUserId)}
            >
              <User size={15} strokeWidth={1.5} />
              <span>Hồ sơ & Huy hiệu</span>
            </button>
          </div>

          {/* Nút đăng xuất */}
          <div className="nav-footer">
            <button onClick={handleLogout} className="btn-logout-nav">
              <LogOut size={15} strokeWidth={1.5} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </aside>

        {/* ============================================================== */}
        {/* CỘT 2: MAIN WORKSPACE (Sảnh trực tuyến & Tín hiệu đa phương tiện) */}
        {/* ============================================================== */}
        <main className="main-stream">
          
          {/* Header Mobile */}
          <header className="mobile-top-bar">
            <div className="m-brand" onClick={() => setActiveTab('feed')}>
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
                Tất cả phòng ({rooms.length})
              </button>
            </div>

            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)} 
              className="btn-header-notif"
              title="Thông báo sảnh"
            >
              <Bell size={15} strokeWidth={1.5} />
              {notifications.some(n => n.unread) && <span className="notif-dot"></span>}
            </button>

            {/* Dropdown Thông báo */}
            {isNotifOpen && (
              <div className="notif-dropdown-card">
                <div className="notif-header">
                  <h4>Thông báo không gian</h4>
                  <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, unread: false })))} className="btn-read-all">
                    Đã đọc hết
                  </button>
                </div>
                <div className="notif-list">
                  {notifications.map(n => (
                    <div key={n.id} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                      <div className="notif-text-wrap">
                        <p>{n.text}</p>
                        <span className="font-mono">{n.time}</span>
                      </div>
                    </div>
                  ))}
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
          {/* KHU VỰC A: KHÔNG GIAN ĐANG MỞ (Live Active Rooms - Ưu tiên trên đầu) */}
          {/* ============================================================== */}
          {activeTab !== 'rooms' && (
            <section className="live-rooms-showcase-section">
              <div className="rooms-section-header">
                <div className="rooms-header-title-flex">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h3 className="section-heading-title">Không Gian Đang Mở</h3>
                  <span className="rooms-count-pill font-mono">{rooms.length} phòng</span>
                </div>
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="btn-create-room-cta"
                >
                  <Plus size={13} /> Tạo phòng
                </button>
              </div>

              {loadingRooms ? (
                <div className="rooms-loading-state font-mono">
                  Đang đồng bộ danh sách phòng đàm thoại...
                </div>
              ) : rooms.length === 0 ? (
                <div className="rooms-empty-card">
                  <p>Chưa có phòng đàm thoại nào đang mở lúc này.</p>
                  <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="btn-create-room-cta mt-2"
                  >
                    <Plus size={13} /> Tạo không gian trò chuyện đầu tiên
                  </button>
                </div>
              ) : (
                <div className="rooms-active-grid">
                  {rooms.slice(0, 4).map(room => (
                    <div key={room.id} className="room-card-matte" onClick={() => onRoomCardClick(room)}>
                      <div className="room-card-top">
                        <div className="room-name-line">
                          <span className="room-code-tag font-mono">{room.nameroom}</span>
                          {room.hasPassword && <Lock size={12} className="text-zinc-500" />}
                        </div>
                        <div className="room-status-indicator">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span className="font-mono text-[11px] text-zinc-400">{room.soluong || 0} người</span>
                        </div>
                      </div>

                      <div className="room-card-bottom">
                        <div className="room-avatar-stack">
                          {room.userRoomDTOList?.slice(0, 3).map((ur, idx) => (
                            <UserAvatar 
                              key={ur.id || idx}
                              avatar={ur.userDTO?.avatar}
                              name={ur.userDTO?.nickname}
                              size={22}
                              className="stacked-avatar"
                            />
                          ))}
                          {(room.soluong || 0) > 3 && (
                            <span className="stacked-avatar-more font-mono">
                              +{(room.soluong || 0) - 3}
                            </span>
                          )}
                        </div>

                        <button 
                          type="button" 
                          className="btn-join-room-compact"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRoomCardClick(room);
                          }}
                        >
                          Tham gia <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
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

              {/* Chọn Vibe Tags (Anti-AI: Lucide icon mảnh, NO emoji) */}
              <div className="vibe-tags-row">
                {VIBE_TAGS.map(v => {
                  const IconComponent = v.icon;
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
                <div className="community-sparks-section">
                  <div className="custom-spark-input-row">
                    <Hash size={13} className="spark-input-icon" />
                    <input 
                      type="text" 
                      placeholder="Nhập thẻ chủ đề (nhấn Enter)..."
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
                      <Plus size={11} /> Thêm
                    </button>
                  </div>
                  {selectedTags.length > 0 && (
                    <div className="selected-sparks-wrap">
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
                    <span>Ảnh / Film</span>
                  </button>

                  <button 
                    type="button"
                    onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                    className={`btn-subtool ${isRecordingVoice || voiceBase64 ? 'active-rose' : ''}`}
                    title="Ghi âm giọng nói 15 giây"
                  >
                    <Mic size={15} strokeWidth={1.5} />
                    <span>{isRecordingVoice ? 'Đang thu' : (voiceBase64 ? 'Đã ghi âm' : 'Ghi âm 15s')}</span>
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
          {/* TAB: DANH SÁCH BÀI VIẾT */}
          {/* ============================================================== */}
          {activeTab !== 'rooms' && (
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
                    <article key={post.id} className="post-item-card">
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

                          {isMe && (
                            <div className="post-menu-container">
                              <button 
                                type="button"
                                onClick={() => setPostMenuOpenId(postMenuOpenId === post.id ? null : post.id)}
                                className="post-menu-btn"
                              >
                                <MoreVertical size={15} strokeWidth={1.5} />
                              </button>

                              {postMenuOpenId === post.id && (
                                <div className="post-menu-dropdown">
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
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Nội dung bài viết */}
                      <div className="post-body-content">
                        <p>{post.content}</p>

                        {/* Hiển thị Media: Ảnh hoặc Video ngắn tự động lặp muted */}
                        {parsedMedia.mediaUrl && (
                          <div className="post-media-frame">
                            {parsedMedia.mediaType === 'video' ? (
                              <video 
                                src={parsedMedia.mediaUrl} 
                                autoPlay 
                                loop 
                                muted 
                                playsInline 
                                className="post-media-video" 
                              />
                            ) : (
                              <img 
                                src={parsedMedia.mediaUrl} 
                                alt="Khoảnh khắc" 
                                loading="lazy" 
                                className="post-media-image" 
                              />
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
                          >
                            <Heart 
                              size={15} 
                              strokeWidth={1.5} 
                              fill={post.isLikedByMe ? "#ef4444" : "none"} 
                              color={post.isLikedByMe ? "#ef4444" : "currentColor"} 
                            />
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
                          onClick={() => handleCopyPostLink(post)}
                          className="action-btn"
                          title="Sao chép liên kết bài viết"
                        >
                          <Share2 size={15} strokeWidth={1.5} />
                          <span className="text-xs">Chia sẻ</span>
                        </button>
                      </div>

                      {/* Khu vực bình luận: Chỉ mở khi người dùng click */}
                      {expandedComments[post.id] && (
                        <div className="post-comments-container">
                          <div className="comments-stack">
                            {commentsMap[post.id]?.length === 0 ? (
                              <p className="empty-cmt-notice">Chưa có phản hồi nào. Hãy là người đầu tiên chia sẻ góc nhìn!</p>
                            ) : (
                              commentsMap[post.id]?.map((cmt) => {
                                const isCmtMe = currentUserId && cmt.authorId?.toString() === currentUserId.toString();
                                const canDeleteCmt = isCmtMe || (currentUserId && post.authorId?.toString() === currentUserId.toString());
                                const isEditingThisCmt = editingCommentId === cmt.id;

                                return (
                                  <div key={cmt.id} className="cmt-row">
                                    <UserAvatar avatar={cmt.authorAvatar} name={cmt.authorNickname || cmt.authorAccount} size={26} />
                                    <div className="cmt-bubble-content">
                                      <div className="cmt-name-row">
                                        <span className="cmt-user-name">{cmt.authorNickname || cmt.authorAccount || 'Thành viên'}</span>
                                        <span className="cmt-time-label font-mono">{cmt.formattedTime}</span>

                                        <div className="cmt-action-btns">
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
                                              Lưu
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="cmt-body-text">{cmt.content}</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          <div className="cmt-input-form">
                            <input 
                              type="text" 
                              placeholder="Viết phản hồi ngắn..." 
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
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB: TẤT CẢ PHÒNG ĐÀM THOẠI */}
          {/* ============================================================== */}
          {activeTab === 'rooms' && (
            <div className="rooms-section-wrapper">
              <div className="rooms-header-banner">
                <div>
                  <h3 className="text-zinc-100 font-semibold text-base mb-1">Không Gian Trò Chuyện Âm Thanh</h3>
                  <p className="text-zinc-400 text-xs">Tham gia các phòng đàm thoại trực tiếp thời gian thực</p>
                </div>
                <button onClick={() => setIsCreateModalOpen(true)} className="btn-add-room-action">
                  <Plus size={14} /> Tạo phòng mới
                </button>
              </div>

              {loadingRooms ? (
                <div className="feed-status-box font-mono">Đang nạp danh sách phòng...</div>
              ) : rooms.length === 0 ? (
                <div className="feed-status-box">Chưa có phòng nào hoạt động.</div>
              ) : (
                <div className="rooms-cards-grid">
                  {rooms.map(room => (
                    <div key={room.id} className="room-simple-card">
                      <div className="room-top-info">
                        <h4 className="font-mono text-zinc-100 flex items-center gap-1"><Radio size={12} className="text-zinc-400" />{room.nameroom}</h4>
                        <span className="room-online-tag font-mono">
                          <span className="green-circle"></span> {room.soluong || 0} người
                        </span>
                      </div>

                      <div className="room-chips-list">
                        {room.hasPassword && <span className="room-flag locked"><Lock size={10} /> Khóa</span>}
                        {isUserInRoom(room) && <span className="room-flag joined">Đang tham gia</span>}
                      </div>

                      <button 
                        type="button" 
                        onClick={() => onRoomCardClick(room)}
                        className={`btn-join-room ${isUserInRoom(room) ? 'btn-rejoin' : ''}`}
                      >
                        {isUserInRoom(room) ? 'Quay lại phòng' : 'Vào trò chuyện'}
                      </button>
                    </div>
                  ))}
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

          {/* Widget 1: Kết Nối Ngẫu Nhiên (1-1) */}
          <div className="widget-box-card">
            <div className="widget-card-title">
              <Zap size={14} className="text-zinc-300" />
              <span>Kết Nối Ngẫu Nhiên</span>
            </div>
            <p className="widget-card-desc">
              Ghép đôi 1-1 với thành viên trực tuyến đang cùng nghe nhạc và chung gu trò chuyện.
            </p>
            <button 
              type="button" 
              onClick={handleStartSpeedMatch} 
              className="btn-widget-action"
            >
              Tìm người kết nối
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
              onClick={() => { setIsPartyWheelOpen(true); handleSpinPartyWheel(); }} 
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

      {/* THANH ĐIỀU HƯỚNG DÀNH CHO MOBILE */}
      <nav className="mobile-bottom-nav">
        <button 
          className={`b-nav-item ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          <Compass size={18} strokeWidth={1.5} />
          <span>Sảnh</span>
        </button>

        <button 
          className={`b-nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
          onClick={() => setActiveTab('rooms')}
        >
          <Radio size={18} strokeWidth={1.5} />
          <span>Phòng</span>
        </button>

        <button 
          className="b-nav-item b-nav-create-center"
          onClick={() => {
            setActiveTab('feed');
            setTimeout(() => newPostInputRef.current?.focus(), 100);
          }}
        >
          <Plus size={20} />
        </button>

        <button 
          className={`b-nav-item ${activeTab === 'trending' ? 'active' : ''}`}
          onClick={() => setActiveTab('trending')}
        >
          <Flame size={18} strokeWidth={1.5} />
          <span>Hot</span>
        </button>

        <button 
          className="b-nav-item"
          onClick={() => setSelectedProfileUserId(currentUserId)}
        >
          <User size={18} strokeWidth={1.5} />
          <span>Hồ sơ</span>
        </button>
      </nav>

      {/* MODAL SPEED MATCH */}
      {isSpeedMatchOpen && (
        <div className="modal-veil" onClick={() => setIsSpeedMatchOpen(false)}>
          <div className="modal-dialog-box modal-match-zinc" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title-flex">
                <Zap size={16} color="#a1a1aa" />
                <h4>Kết Nối Trực Tiếp</h4>
              </div>
              <button onClick={() => setIsSpeedMatchOpen(false)} className="btn-close-dialog"><X size={15} /></button>
            </div>

            {matchingStatus === 'searching' ? (
              <div className="dialog-searching-body">
                <div className="radar-circle-zinc">
                  <Zap size={20} color="#f4f4f5" />
                </div>
                <p className="radar-status-text">Đang quét tìm thành viên trực tuyến cùng gu âm nhạc...</p>
              </div>
            ) : matchingStatus === 'waiting' ? (
              <div className="dialog-searching-body">
                <div className="radar-circle-zinc pulse-waiting">
                  <Compass size={20} color="#a1a1aa" />
                </div>
                <p className="radar-status-text">Hiện tại chưa có thành viên khác trong hàng đợi ghép đôi.</p>
                <div className="dialog-actions-row" style={{ marginTop: 14 }}>
                  <button onClick={() => handleStartSpeedMatch()} className="btn-dialog-back">Quét lại</button>
                  <button onClick={() => { setIsSpeedMatchOpen(false); setActiveTab('rooms'); }} className="btn-dialog-primary">
                    Xem phòng trò chuyện
                  </button>
                </div>
              </div>
            ) : (
              <div className="dialog-matched-body">
                <div className="partner-matched-card-zinc">
                  <UserAvatar avatar={matchedPartner?.avatar} name={matchedPartner?.nickname} size={42} />
                  <div>
                    <strong>{matchedPartner?.nickname}</strong>
                    <p>{matchedPartner?.vibe}</p>
                  </div>
                </div>

                {/* Bấm trực tiếp vào Gợi ý mở đầu để sao chép */}
                <div 
                  className="icebreaker-quote-interactive"
                  onClick={() => {
                    navigator.clipboard.writeText(matchedPartner?.icebreaker || '');
                    toast.success("Đã sao chép câu gợi ý mở đầu!");
                  }}
                  title="Nhấp để sao chép câu mở đầu này"
                >
                  <div className="icebreaker-top-row">
                    <span>Gợi ý mở đầu (Bấm để sao chép):</span>
                    <Copy size={12} className="copy-icon-subtle" />
                  </div>
                  <p>"{matchedPartner?.icebreaker}"</p>
                </div>

                <div className="dialog-actions-row">
                  <button onClick={() => handleStartSpeedMatch()} className="btn-dialog-back">Tìm người khác</button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(matchedPartner?.icebreaker || '');
                      setIsSpeedMatchOpen(false);
                      toast.success(`Đã sao chép câu mở đầu! Hãy bắt đầu trò chuyện cùng ${matchedPartner?.nickname}`);
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
          <div className="modal-dialog-box modal-wheel-zinc" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title-flex">
                <Dices size={16} color="#a1a1aa" />
                <h4>Thẻ Bài Thử Thách</h4>
              </div>
              <button onClick={() => setIsPartyWheelOpen(false)} className="btn-close-dialog"><X size={15} /></button>
            </div>

            <div className="wheel-dialog-body">
              <div className={`clean-wheel-dial ${wheelSpinning ? 'spinning' : ''}`}>
                <Dices size={24} color="#e4e4e7" />
              </div>

              {wheelResult && (
                <div className="party-challenge-card-zinc">
                  <div className="challenge-card-badge">
                    <Dices size={12} /> LÁ BÀI THỬ THÁCH
                  </div>
                  <p className="challenge-card-question">"{wheelResult}"</p>
                  <button 
                    type="button"
                    className="btn-share-challenge-feed"
                    onClick={() => {
                      setNewPostContent(`[Thử thách câu hỏi]: "${wheelResult}"\n\nBạn nghĩ sao về câu hỏi này? Cùng chia sẻ góc nhìn nhé!`);
                      setIsPartyWheelOpen(false);
                      setActiveTab('feed');
                      setTimeout(() => newPostInputRef.current?.focus(), 150);
                      toast.success("Đã đưa câu hỏi vào khung đăng bài!");
                    }}
                  >
                    <Share2 size={13} /> Đưa câu hỏi này ra Sảnh
                  </button>
                </div>
              )}

              <button 
                type="button"
                onClick={handleSpinPartyWheel} 
                disabled={wheelSpinning}
                className="btn-spin-action-zinc"
              >
                {wheelSpinning ? 'Đang bốc thăm câu hỏi...' : (wheelResult ? 'Bốc câu hỏi khác' : 'Bốc câu hỏi ngẫu nhiên')}
              </button>
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

      {/* ============================================================== */}
      {/* CSS DARK ZINC TOÀN DIỆN - ANTI AI-GENERATED UI */}
      {/* ============================================================== */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --social-bg: #09090b; /* Dark Zinc 950 Deep Obsidian */
          --sidebar-bg: #0d0e12; /* Subtle elevated sidebar */
          --card-bg: #14161f; /* Surface card */
          --card-border: #27272a; /* Zinc 800 hairline 1px border */
          --text-main: #f4f4f5; /* Zinc 100 */
          --text-muted: #a1a1aa; /* Zinc 400 */
          --text-subtle: #71717a; /* Zinc 500 */
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
          background: rgba(24, 24, 27, 0.6);
          border: 1px solid var(--card-border);
          border-radius: 8px; /* rounded-lg */
          padding: 10px 12px;
          margin-bottom: 16px;
        }
        .radio-top-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }
        .radio-name-text {
          font-size: 11px;
          font-weight: 600;
          color: #d4d4d8;
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
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #d4d4d8;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-radio-toggle:hover, .btn-radio-next:hover { background: #3f3f46; color: white; }
        .radio-genre-label {
          font-size: 9.5px;
          color: #71717a;
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
          padding: 8px 12px;
          border-radius: 6px; /* rounded-md */
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-main);
        }
        .nav-item.active {
          background: rgba(39, 39, 42, 0.8); /* bg-zinc-800/80 */
          color: #f4f4f5;
          font-weight: 600;
        }

        .nav-footer { margin-top: auto; padding-top: 10px; }
        .btn-logout-nav {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 10px;
          background: transparent;
          border: none;
          color: #f87171;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          border-radius: 6px;
        }
        .btn-logout-nav:hover { background: rgba(239, 68, 68, 0.08); }

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
          background: rgba(9, 9, 11, 0.92);
          backdrop-filter: blur(12px);
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
          font-size: 12.5px;
          font-weight: 500;
          padding: 6px 10px;
          border-radius: 6px; /* rounded-md */
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .stream-tab:hover { color: var(--text-main); }
        .stream-tab.active {
          background: #27272a;
          color: var(--text-main);
          font-weight: 600;
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
        .notif-list { display: flex; flex-direction: column; gap: 4px; }
        .notif-item {
          display: flex;
          gap: 8px;
          padding: 6px;
          border-radius: 6px;
          font-size: 11.5px;
          background: rgba(255, 255, 255, 0.02);
        }
        .notif-item.unread { background: #27272a; }
        .notif-text-wrap p { margin: 0; color: #f4f4f5; }
        .notif-text-wrap span { font-size: 9.5px; color: #71717a; }

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
          margin: 16px 16px 0;
          padding: 16px 18px;
          border: 1px solid rgba(39, 39, 42, 0.85);
          border-radius: 14px;
          background: rgba(18, 19, 24, 0.6);
          backdrop-filter: blur(8px);
        }
        .rooms-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .rooms-header-title-flex {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .section-heading-title {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: #f4f4f5;
        }
        .rooms-count-pill {
          font-size: 10.5px;
          color: #71717a;
          background: #27272a;
          padding: 1px 6px;
          border-radius: 4px;
        }
        .btn-create-room-cta {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #f4f4f5;
          color: #09090b;
          border: none;
          font-size: 11.5px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px; /* rounded-md */
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-create-room-cta:hover { background: #ffffff; }

        .rooms-active-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .room-card-matte {
          background: #121214; /* surface */
          border: 1px solid var(--card-border);
          border-radius: 8px; /* rounded-lg */
          padding: 10px 12px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .room-card-matte:hover {
          border-color: #3f3f46;
          background: #18181b;
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
          background: rgba(18, 19, 24, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(39, 39, 42, 0.85);
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 18px;
          gap: 16px;
        }
        .btn-add-room-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f4f4f5;
          border: 1px solid #f4f4f5;
          color: #09090b;
          font-size: 12px;
          font-weight: 500;
          padding: 8px 14px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .btn-add-room-action:hover {
          background: #ffffff;
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.25);
        }
        .rooms-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 14px;
        }
        .room-simple-card {
          background: rgba(18, 19, 24, 0.75);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(39, 39, 42, 0.85);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .room-simple-card:hover {
          border-color: rgba(63, 63, 70, 0.9);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.5);
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
          margin: 16px 16px 0;
          padding: 18px;
          border: 1px solid rgba(39, 39, 42, 0.9);
          border-radius: 14px;
          background: rgba(18, 19, 24, 0.85);
          backdrop-filter: blur(12px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
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
          color: #f4f4f5;
          font-size: 13.5px;
          font-family: inherit;
          resize: none;
          outline: none;
          line-height: 1.5;
        }
        .creator-field-wrap textarea::placeholder { color: #71717a; }

        /* Preview Ảnh/Video trong Composer */
        .composer-attached-preview {
          margin: 8px 0 10px 48px;
          position: relative;
          display: inline-block;
          max-height: 220px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--card-border);
        }
        .preview-media-element {
          max-height: 220px;
          display: block;
          border-radius: 6px;
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
          background: #18181b;
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 5px 10px;
        }
        .btn-play-voice-preview {
          background: #27272a;
          border: 1px solid #3f3f46;
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

        /* Vibe Tags Row (Anti-AI: Không emoji, icon Lucide nét mảnh) */
        .vibe-tags-row {
          display: flex;
          gap: 6px;
          margin: 8px 0 10px 48px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .vibe-tags-row::-webkit-scrollbar { display: none; }
        .vibe-tag-pill {
          background: transparent;
          border: 1px solid var(--card-border);
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 500;
          padding: 4px 8px;
          border-radius: 6px; /* rounded-md */
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .vibe-tag-pill:hover {
          background: #18181b;
          color: #f4f4f5;
          border-color: #3f3f46;
        }
        .vibe-tag-pill.active {
          background: #27272a;
          border-color: #52525b;
          color: #f4f4f5;
          font-weight: 600;
        }

        /* Sparks Custom Tag */
        .community-sparks-section {
          margin: 6px 0 10px 48px;
        }
        .custom-spark-input-row {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #09090b;
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 4px 8px;
        }
        .spark-input-icon { color: #71717a; }
        .custom-spark-input-row input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 11.5px;
          outline: none;
        }
        .btn-add-spark-action {
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #f4f4f5;
          font-size: 11px;
          padding: 2px 7px;
          border-radius: 4px;
          cursor: pointer;
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
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #f4f4f5;
          font-size: 10.5px;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .btn-remove-spark {
          background: transparent;
          border: none;
          color: #a1a1aa;
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
        }
        .creator-left-tools {
          display: flex;
          gap: 6px;
        }
        .btn-subtool {
          background: transparent;
          border: 1px solid transparent;
          color: #a1a1aa;
          font-size: 11.5px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px; /* rounded-md */
          transition: all 0.15s;
        }
        .btn-subtool:hover {
          background: rgba(255, 255, 255, 0.04);
          color: #f4f4f5;
        }
        .btn-subtool.active {
          background: #27272a;
          border-color: #3f3f46;
          color: #f4f4f5;
        }
        .btn-subtool.active-rose {
          background: rgba(244, 63, 94, 0.15);
          border-color: rgba(244, 63, 94, 0.3);
          color: #fb7185;
        }

        /* Nút CTA Đăng bài: Nền sáng - Chữ tối */
        .btn-publish-submit {
          background: #f4f4f5;
          color: #09090b;
          border: none;
          padding: 5px 14px;
          border-radius: 6px; /* rounded-md */
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-publish-submit:hover:not(:disabled) {
          background: #ffffff;
        }
        .btn-publish-submit:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        /* ================= THẺ TÍN HIỆU KHÔNG GIAN (TALOVIN SPATIAL SIGNAL CARD) ================= */
        .post-item-card {
          background: rgba(18, 19, 24, 0.75);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(39, 39, 42, 0.85);
          border-radius: 14px;
          margin: 14px 16px 16px;
          padding: 18px 20px;
          box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.5);
          position: relative;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .post-item-card:hover {
          border-color: rgba(63, 63, 70, 0.9);
          transform: translateY(-1.5px);
          box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.65);
        }
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
          font-size: 13.5px;
          font-weight: 600;
          color: #f4f4f5;
          cursor: pointer;
        }
        .author-handle { font-size: 11px; color: #71717a; }
        .post-time-meta { font-size: 11px; color: #71717a; }
        .vibe-tag-badge {
          font-size: 10px;
          font-weight: 500;
          color: #a1a1aa;
          background: #27272a;
          border: 1px solid #3f3f46;
          border-radius: 4px;
          padding: 1px 5px;
          display: inline-flex;
          align-items: center;
        }
        .post-topics-bar {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
        }
        .post-topic-chip {
          background: #18181b;
          border: 1px solid #27272a;
          color: #a1a1aa;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10.5px;
          padding: 1.5px 6px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 4.5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .post-topic-chip:hover {
          color: #f4f4f5;
          border-color: #3f3f46;
          background: #27272a;
        }
        .post-topic-chip.active {
          color: #f4f4f5;
          border-color: #52525b;
          background: #3f3f46;
        }
        .topic-dot {
          width: 4px;
          height: 4px;
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
          color: #71717a;
          cursor: pointer;
          padding: 4px;
        }
        .btn-save-post.saved { color: #f4f4f5; }

        .post-body-content {
          margin: 6px 0 10px 46px;
          font-size: 13px;
          line-height: 1.5;
          color: #d4d4d8;
        }
        .post-body-content p {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }

        /* Frame Đa phương tiện */
        .post-media-frame {
          margin-top: 8px;
          border-radius: 8px; /* rounded-lg */
          overflow: hidden;
          max-height: 360px;
          border: 1px solid var(--card-border);
          background: #09090b;
        }
        .post-media-image, .post-media-video {
          width: 100%;
          max-height: 360px;
          object-fit: cover;
          display: block;
        }

        /* Voice Pill Player trên thẻ bài viết */
        .post-voice-player-pill {
          margin-top: 8px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(18, 18, 20, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 6px 10px;
        }
        .btn-play-card-voice {
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #f4f4f5;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
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

        /* Vùng tương tác phẳng trên nền thẻ (Bỏ khung viền pill quanh nút) */
        .post-actions-toolbar {
          margin-left: 46px;
          display: flex;
          gap: 16px;
          position: relative;
        }
        .reaction-drop-wrapper { position: relative; }
        .action-btn {
          background: transparent;
          border: none;
          color: #71717a;
          font-size: 11.5px;
          font-weight: 500;
          padding: 4px 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: color 0.15s;
        }
        .action-btn:hover { color: #f4f4f5; }
        .action-btn.active-liked { color: #f87171; }

        /* REACTION POPOVER: NẰM GỌN TRÊN NÚT, KHÔNG CHE CHỮ */
        .reactions-popup-menu {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          background: #18181b; /* bg-zinc-900 */
          border: 1px solid #3f3f46; /* border-zinc-700 */
          border-radius: 8px; /* rounded-lg */
          padding: 4px 6px; /* px-2.5 py-1.5 */
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.7); /* shadow-2xl */
          display: flex;
          align-items: center;
          gap: 5px;
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
          font-size: 17px;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          line-height: 1;
          transition: transform 0.15s ease;
        }
        .reaction-emoji-item:hover {
          transform: scale(1.25);
        }

        /* Post Dropdown Menu */
        .post-menu-container { position: relative; }
        .post-menu-btn {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          padding: 3px;
        }
        .post-menu-btn:hover { color: #f4f4f5; }
        .post-menu-dropdown {
          position: absolute;
          top: 24px;
          right: 0;
          background: #18181b;
          border: 1px solid var(--card-border);
          border-radius: 6px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.6);
          padding: 4px;
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

        /* Comments Container (Chỉ mở khi bấm vào nút) */
        .post-comments-container {
          margin: 10px 0 0 46px;
          background: #09090b;
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 10px;
        }
        .comments-stack { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
        .empty-cmt-notice { margin: 0; font-size: 11px; color: #71717a; font-style: italic; }
        .cmt-row { display: flex; gap: 8px; }
        .cmt-bubble-content {
          background: #18181b;
          border: 1px solid var(--card-border);
          padding: 5px 8px;
          border-radius: 6px;
          flex: 1;
        }
        .cmt-name-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
        .cmt-user-name { font-size: 11px; font-weight: 600; color: #f4f4f5; }
        .cmt-time-label { font-size: 9.5px; color: #71717a; }
        .cmt-body-text { margin: 0; font-size: 11.5px; color: #d4d4d8; }
        .cmt-action-btns { display: flex; align-items: center; gap: 3px; margin-left: auto; }
        .btn-cmt-act {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
        }
        .btn-cmt-act:hover { color: #d4d4d8; }
        .btn-cmt-act.danger:hover { color: #f87171; }
        .cmt-inline-edit-box { display: flex; flex-direction: column; gap: 5px; margin-top: 4px; }
        .cmt-inline-edit-input {
          width: 100%;
          background: #09090b;
          border: 1px solid #3f3f46;
          border-radius: 4px;
          padding: 4px 6px;
          color: white;
          font-size: 11.5px;
          outline: none;
        }
        .cmt-inline-edit-actions { display: flex; gap: 5px; justify-content: flex-end; }
        .btn-save-inline-cmt {
          background: #f4f4f5;
          color: #09090b;
          border: none;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-cancel-inline-cmt {
          background: transparent;
          color: #a1a1aa;
          border: 1px solid var(--card-border);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10.5px;
          cursor: pointer;
        }
        .cmt-input-form { display: flex; gap: 6px; }
        .cmt-input-form input {
          flex: 1;
          background: #18181b;
          border: 1px solid var(--card-border);
          border-radius: 4px;
          padding: 5px 8px;
          color: white;
          font-size: 11.5px;
          outline: none;
        }
        .btn-submit-cmt {
          background: #f4f4f5;
          color: #09090b;
          border: none;
          width: 26px;
          height: 26px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        /* ================= CỘT 3: RIGHT DOCK (280px - 300px) ================= */
        .widgets-sidebar {
          width: 290px;
          min-width: 280px;
          padding: 18px 14px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-shrink: 0;
        }
        .search-input-wrap {
          background: rgba(24, 24, 27, 0.4); /* bg-zinc-900/40 */
          border: 1px solid var(--card-border); /* border-zinc-800 */
          border-radius: 6px; /* rounded-md */
          display: flex;
          align-items: center;
          padding: 6px 10px;
          gap: 6px;
        }
        .search-icon-muted { color: #71717a; }
        .search-input-wrap input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 12px;
          outline: none;
        }
        .btn-clear-kw { background: transparent; border: none; color: #71717a; cursor: pointer; }

        .widget-box-card {
          background: #121214; /* surface */
          border: 1px solid var(--card-border);
          border-radius: 8px; /* rounded-lg */
          padding: 12px;
        }
        .widget-card-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #f4f4f5;
          margin-bottom: 5px;
        }
        .widget-card-desc {
          font-size: 11px;
          color: #a1a1aa;
          margin: 0 0 10px 0;
          line-height: 1.4;
        }
        .btn-widget-action {
          width: 100%;
          background: #f4f4f5; /* bg-zinc-100 */
          color: #09090b; /* text-zinc-950 */
          border: none;
          padding: 6px 10px;
          border-radius: 6px; /* rounded-md */
          font-weight: 600;
          font-size: 11.5px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-widget-action:hover { background: #ffffff; }
        .btn-widget-action.secondary {
          background: rgba(39, 39, 42, 0.7); /* bg-zinc-800/70 */
          color: #d4d4d8;
          border: 1px solid rgba(63, 63, 70, 0.6);
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
          height: 54px;
          background: rgba(9, 9, 11, 0.95);
          backdrop-filter: blur(10px);
          border-top: 1px solid var(--card-border);
          justify-content: space-around;
          align-items: center;
          z-index: 80;
        }
        .b-nav-item {
          background: transparent;
          border: none;
          color: #71717a;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          font-size: 9.5px;
          cursor: pointer;
        }
        .b-nav-item.active { color: #f4f4f5; }
        .b-nav-create-center {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #f4f4f5;
          color: #09090b;
          justify-content: center;
          margin-top: -12px;
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
          .mobile-bottom-nav { display: flex; }
          .main-stream { max-width: 100%; min-width: 0; padding-bottom: 60px; }
          .rooms-active-grid { grid-template-columns: 1fr; }
          .creator-bottom-row { padding-left: 0; }
          .post-body-content { margin-left: 0; }
          .post-actions-toolbar { margin-left: 0; }
          .post-comments-container { margin-left: 0; }
          .vibe-tags-row { margin-left: 0; }
          .composer-attached-preview { margin-left: 0; }
          .voice-recording-indicator { margin-left: 0; }
          .voice-preview-deck { margin-left: 0; }
          .community-sparks-section { margin-left: 0; }
        }
      `}} />
    </div>
  );
};

export default Home;
