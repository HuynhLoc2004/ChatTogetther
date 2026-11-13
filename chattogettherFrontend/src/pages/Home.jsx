import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, LogOut, Plus, MessageSquare, Shield, User, X, Lock, Hash, 
  CheckCircle, ArrowRight, WifiOff, Heart, MessageCircle, Share2, 
  Search, Sparkles, Send, Copy, Compass, Radio, ChevronRight, CornerDownRight,
  Bell, Bookmark, Flame, Gem, Crown, Volume2, VolumeX, Music, Play, Pause,
  Shuffle, Wand2, Image as ImageIcon, CheckCircle2, Zap, Dices,
  Edit3, Trash2, MoreVertical, Tag, Filter, Check
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import { saveRoomsOffline, getRoomsOffline } from '../utils/offlineDB';
import UserProfileModal from './UserProfileModal';
import FriendsModal from './FriendsModal';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import toast from 'react-hot-toast';
import KlyvixLogo from '../components/KlyvixLogo';

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

// Danh sách tâm trạng / Chủ đề chia sẻ (Hài hòa, tinh tế)
const VIBE_TAGS = [
  { id: 'relax', label: '🎧 Thư giãn' },
  { id: 'energy', label: '✨ Tích cực' },
  { id: 'night', label: '🌙 Lắng đọng' },
  { id: 'gaming', label: '🎮 Tìm bạn' },
  { id: 'deep', label: '💬 Tâm sự' },
];

// Kênh âm thanh thư giãn
const RADIO_CHANNELS = [
  { name: 'Giai điệu Lo-Fi', genre: 'Chill Beats', audioSrc: 'https://stream.zeno.fm/f3wvbbqmdg8uv' },
  { name: 'Sóng đêm Neon', genre: 'Retro Synth', audioSrc: 'https://stream.zeno.fm/0r0xa792kwzuv' },
  { name: 'Mưa acoustic êm dịu', genre: 'Acoustic Rain', audioSrc: 'https://stream.zeno.fm/e0r45u72kwzuv' },
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
    { id: 1, text: 'Thành viên mới vừa tham gia Klyvix', time: '5p trước', unread: true },
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
      const combinedVibe = selectedTags.length > 0 ? selectedTags.join(', ') : (selectedVibe?.label || null);
      const payload = {
        content,
        imageUrl: postImageUrl.trim() || null,
        vibe: combinedVibe,
      };

      const res = await axiosClient.post('/posts', payload);
      if (res.data?.data) {
        setPosts(prev => [res.data.data, ...prev]);
        setNewPostContent('');
        setSelectedVibe(null);
        setSelectedTags([]);
        setCustomTagInput('');
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

  // Thêm thẻ chủ đề tự do (Dấu ấn cộng đồng riêng, không dùng #)
  const handleAddCustomTag = (e) => {
    if (e) e.preventDefault();
    const tag = customTagInput.trim();
    if (!tag) return;
    
    // Tự động gắn tiền tố biểu tượng riêng biệt (✦ cho chủ đề, ◈ cho hội nhóm)
    let formattedTag = tag;
    if (!formattedTag.startsWith('✦') && !formattedTag.startsWith('◈') && !formattedTag.startsWith('@')) {
      formattedTag = `✦ ${formattedTag}`;
    }
    
    if (!selectedTags.includes(formattedTag)) {
      if (selectedTags.length >= 5) {
        toast.error("Tối đa 5 thẻ chủ đề cho một bài viết!");
        return;
      }
      setSelectedTags(prev => [...prev, formattedTag]);
    }
    setCustomTagInput('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleTogglePopularTag = (tagLabel) => {
    if (selectedTags.includes(tagLabel)) {
      setSelectedTags(prev => prev.filter(t => t !== tagLabel));
    } else {
      if (selectedTags.length >= 5) {
        toast.error("Tối đa 5 thẻ chủ đề cho một bài viết!");
        return;
      }
      setSelectedTags(prev => [...prev, tagLabel]);
    }
  };

  // Xóa bài viết
  const handleDeletePost = async (postId) => {
    setPostMenuOpenId(null);
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) return;

    try {
      await axiosClient.delete(`/posts/${postId}`);
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success("Đã xóa bài viết thành công!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa bài viết!");
    }
  };

  // Mở modal sửa bài viết
  const handleOpenEditPost = (post) => {
    setPostMenuOpenId(null);
    setEditingPost(post);
    setEditPostContent(post.content || '');
    setEditPostImageUrl(post.imageUrl || '');
    const currentTags = post.vibe ? post.vibe.split(',').map(s => s.trim()).filter(Boolean) : [];
    setEditPostTags(currentTags);
  };

  // Lưu chỉnh sửa bài viết
  const handleSaveEditPost = async (e) => {
    if (e) e.preventDefault();
    if (!editingPost) return;
    const content = editPostContent.trim();
    if (!content) {
      toast.error("Nội dung bài viết không được để trống!");
      return;
    }

    try {
      setIsSavingEditPost(true);
      const res = await axiosClient.put(`/posts/${editingPost.id}`, {
        content,
        imageUrl: editPostImageUrl.trim() || null,
        vibe: editPostTags.join(', ') || null,
      });

      if (res.data?.data) {
        const updated = res.data.data;
        setPosts(prev => prev.map(p => p.id === editingPost.id ? {
          ...p,
          content: updated.content,
          imageUrl: updated.imageUrl,
          vibe: updated.vibe,
        } : p));
        setEditingPost(null);
        toast.success("Đã cập nhật bài viết!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật bài viết!");
    } finally {
      setIsSavingEditPost(false);
    }
  };

  // Trợ lý gợi ý ý tưởng
  const handleAIEnhancePost = () => {
    const templates = [
      "Cuối tuần nhẹ nhàng, cùng bật chút giai điệu êm dịu và tận hưởng không gian riêng... 🎧",
      "Đôi khi sự im lặng cũng là một câu trả lời trọn vẹn nhất. Chúc mọi người buổi tối an yên. ✨",
      "Có ai đang thức đêm cùng chạy deadline không? Gửi chút năng lượng tích cực đến bạn nhé!",
      "Tìm bạn đàm thoại voice trao đổi về sở thích và cuộc sống, bạn nào rảnh thì kết nối nhé ☕"
    ];
    const pick = templates[Math.floor(Math.random() * templates.length)];
    setNewPostContent(pick);
    if (!selectedTags.includes('✦ Thư giãn')) {
      setSelectedTags(prev => [...prev, '✦ Thư giãn']);
    }
    toast.success("Đã gợi ý nội dung!");
  };

  // Thao tác cảm xúc với Optimistic Update (phản hồi siêu mượt 60fps)
  const handleReactPost = async (postId, reactionType = 'HEART') => {
    setActiveReactionPicker(null);
    const targetPost = posts.find(p => p.id === postId);
    if (!targetPost) return;

    const prevLiked = targetPost.isLikedByMe;
    const prevCount = targetPost.likesCount || 0;
    const prevReaction = targetPost.myReaction;

    const isTogglingOff = prevLiked && prevReaction === reactionType;
    const nextLiked = !isTogglingOff;
    const nextReaction = isTogglingOff ? null : reactionType;
    const nextCount = isTogglingOff ? Math.max(0, prevCount - 1) : (prevLiked ? prevCount : prevCount + 1);

    // Cập nhật giao diện tức thì
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      isLikedByMe: nextLiked,
      likesCount: nextCount,
      myReaction: nextReaction
    } : p));

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
      // Rollback nếu server trả lỗi
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        isLikedByMe: prevLiked,
        likesCount: prevCount,
        myReaction: prevReaction
      } : p));
      const msg = err.response?.data?.message || "Không thể thao tác cảm xúc lúc này!";
      toast.error(msg);
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

  // Xóa bình luận
  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bình luận này không?")) return;

    try {
      await axiosClient.delete(`/posts/${postId}/comments/${commentId}`);
      setCommentsMap(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
      }));
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        commentsCount: Math.max(0, (p.commentsCount || 1) - 1)
      } : p));
      toast.success("Đã xóa bình luận!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa bình luận!");
    }
  };

  // Bắt đầu chỉnh sửa bình luận
  const handleStartEditComment = (cmt) => {
    setEditingCommentId(cmt.id);
    setEditingCommentText(cmt.content || '');
  };

  // Lưu chỉnh sửa bình luận
  const handleSaveEditComment = async (postId, commentId) => {
    const text = editingCommentText.trim();
    if (!text) {
      toast.error("Nội dung bình luận không được để trống!");
      return;
    }

    try {
      setIsSavingComment(true);
      const res = await axiosClient.put(`/posts/${postId}/comments/${commentId}`, { content: text });
      if (res.data?.data) {
        const updated = res.data.data;
        setCommentsMap(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).map(c => c.id === commentId ? {
            ...c,
            content: updated.content,
            formattedTime: updated.formattedTime || c.formattedTime
          } : c)
        }));
        setEditingCommentId(null);
        setEditingCommentText('');
        toast.success("Đã cập nhật bình luận!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể sửa bình luận!");
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
        vibe: p.vibe ? `Quan tâm chủ đề: ${p.vibe}` : 'Đang lắng nghe âm nhạc cùng sảnh Klyvix',
        icebreaker: ICEBREAKER_PROMPTS[Math.floor(Math.random() * ICEBREAKER_PROMPTS.length)]
      }))
      .filter(u => u.nickname && u.nickname !== myName);

    setTimeout(() => {
      if (realUsers.length > 0) {
        const picked = realUsers[Math.floor(Math.random() * realUsers.length)];
        setMatchedPartner(picked);
        setMatchingStatus('matched');
      } else {
        // Không dùng tên giả lập - hiển thị Radar chờ người kết nối
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
    if (activeFilterTag) {
      const pVibe = (p.vibe || '').toLowerCase();
      const pContent = (p.content || '').toLowerCase();
      const target = activeFilterTag.replace(/^[✦◈@]\s*/, '').toLowerCase();
      if (!pVibe.includes(target) && !pContent.includes(target)) return false;
    }
    if (activeTab === 'saved') return Array.isArray(savedPostIds) && savedPostIds.includes(p.id);
    if (activeTab === 'trending') return (p.likesCount || 0) > 0 || (p.commentsCount || 0) > 0;
    return true;
  });

  // Gom các chủ đề cộng đồng sôi nổi từ các bài viết hiện tại
  const communityTags = Array.from(new Set([
    '✦ Thư giãn', '✦ Tích cực', '✦ Đêm muộn', '✦ Bạn mới', '✦ Tâm sự',
    ...posts.flatMap(p => (p.vibe || '').split(',').map(s => s.trim()).filter(Boolean))
  ])).slice(0, 10);

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
            <KlyvixLogo size={32} />
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
              <Crown size={18} color="#818cf8" />
              <span>Hồ sơ & Huy hiệu</span>
            </button>
          </nav>

          <div className="nav-action-box">
            <button 
              className="btn-speed-match-minimal"
              onClick={handleStartSpeedMatch}
              title="Kết nối nhanh với 1 người bạn online ngẫu nhiên"
            >
              <Zap size={15} />
              <span>Kết nối bạn mới</span>
            </button>

            <button 
              className="btn-party-wheel-minimal"
              onClick={() => setIsPartyWheelOpen(true)}
              title="Vòng quay câu hỏi chia sẻ"
            >
              <Dices size={15} />
              <span>Vòng quay câu hỏi</span>
            </button>

            <button 
              className="btn-create-room-minimal"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus size={15} />
              <span>Tạo phòng đàm thoại</span>
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
              <KlyvixLogo size={26} />
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
                    <Zap size={12} color="#818cf8" />
                    <span>Kết nối ngẫu nhiên</span>
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

                {/* Thẻ chủ đề / Dấu ấn cộng đồng riêng (Sparks) */}
                <div className="community-sparks-section">
                  {/* Danh sách thẻ đã chọn */}
                  {selectedTags.length > 0 && (
                    <div className="selected-sparks-wrap">
                      {selectedTags.map(tag => (
                        <span key={tag} className="active-spark-chip">
                          {tag}
                          <button type="button" onClick={() => handleRemoveTag(tag)} className="btn-remove-spark">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Ô nhập chủ đề / hội nhóm tự tạo của cộng đồng */}
                  <div className="custom-spark-input-row">
                    <Tag size={13} className="spark-input-icon" />
                    <input 
                      type="text"
                      placeholder="Tự tạo chủ đề hoặc hội nhóm (VD: Dân IT, Hội Yêu Mèo, Đêm Sài Gòn)..."
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomTag(e);
                        }
                      }}
                    />
                    <button 
                      type="button" 
                      onClick={handleAddCustomTag}
                      disabled={!customTagInput.trim()}
                      className="btn-add-spark-action"
                    >
                      <Plus size={13} />
                      <span>Gắn thẻ</span>
                    </button>
                  </div>

                  {/* Các chủ đề phổ biến gợi ý nhanh */}
                  <div className="vibe-tags-row">
                    {VIBE_TAGS.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleTogglePopularTag(v.label)}
                        className={`vibe-tag-pill ${selectedTags.includes(v.label) ? 'active' : ''}`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
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
                {/* Banner khi đang lọc theo chủ đề cộng đồng */}
                {activeFilterTag && (
                  <div className="active-tag-filter-banner">
                    <div className="filter-badge-left">
                      <Filter size={14} color="#818cf8" />
                      <span>Đang xem chủ đề: <strong>{activeFilterTag}</strong></span>
                    </div>
                    <button onClick={() => setActiveFilterTag(null)} className="btn-clear-tag-filter">
                      <X size={13} /> Xem tất cả
                    </button>
                  </div>
                )}

                {loadingPosts ? (
                  <div className="feed-status-box">
                    <div className="feed-spinner"></div>
                    <p>Đang chuẩn bị bảng tin...</p>
                  </div>
                ) : displayedPosts.length === 0 ? (
                  <div className="feed-status-box">
                    <MessageCircle size={38} className="empty-icon-muted" />
                    <h4>Chưa có bài viết nào</h4>
                    <p>{activeFilterTag ? `Chưa có bài viết nào thuộc chủ đề "${activeFilterTag}". Hãy là người đầu tiên tạo bài viết!` : "Hãy là người đầu tiên chia sẻ cảm nghĩ của bạn lên bảng tin!"}</p>
                    {activeFilterTag && (
                      <button onClick={() => setActiveFilterTag(null)} className="btn-return-feed">
                        Quay lại tất cả bài viết
                      </button>
                    )}
                  </div>
                ) : (
                  displayedPosts.map((post) => {
                    const isSaved = Array.isArray(savedPostIds) && savedPostIds.includes(post.id);
                    const isAuthorAdmin = post.authorVipTier === 'FOUNDER' || 
                      (Array.isArray(post.authorRoles) && (post.authorRoles.includes('ROLE_AMDIN') || post.authorRoles.includes('ROLE_ADMIN')));
                    const isAuthorMe = currentUserId && post.authorId?.toString() === currentUserId.toString();
                    const currentReaction = REACTION_EMOJIS.find(r => r.type === post.myReaction);
                    const postSparks = post.vibe ? post.vibe.split(',').map(s => s.trim()).filter(Boolean) : [];

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
                                {post.authorNickname || post.authorAccount || 'Người dùng'}
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
                            </div>
                          </div>

                          <div className="post-header-actions-group">
                            <button 
                              onClick={() => handleToggleSavePost(post.id)}
                              className={`btn-save-post ${isSaved ? 'saved' : ''}`}
                              title={isSaved ? "Bỏ lưu" : "Lưu bài viết"}
                            >
                              <Bookmark size={16} fill={isSaved ? "#818cf8" : "none"} />
                            </button>

                            {/* Menu tùy chọn sửa / xóa cho chính chủ bài viết */}
                            {isAuthorMe && (
                              <div className="post-owner-menu-anchor">
                                <button 
                                  type="button"
                                  onClick={() => setPostMenuOpenId(postMenuOpenId === post.id ? null : post.id)} 
                                  className="btn-post-menu"
                                  title="Tùy chọn bài viết"
                                >
                                  <MoreVertical size={16} />
                                </button>
                                {postMenuOpenId === post.id && (
                                  <div className="post-owner-dropdown">
                                    <button 
                                      type="button"
                                      onClick={() => handleOpenEditPost(post)} 
                                      className="post-menu-item"
                                    >
                                      <Edit3 size={13} /> Chỉnh sửa bài viết
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

                        {/* Thẻ không gian / chủ đề bài viết */}
                        {postSparks.length > 0 && (
                          <div className="post-sparks-row">
                            {postSparks.map(tag => (
                              <span 
                                key={tag} 
                                className={`post-spark-badge ${activeFilterTag === tag ? 'active' : ''}`}
                                onClick={() => setActiveFilterTag(activeFilterTag === tag ? null : tag)}
                                title={`Lọc bài viết theo chủ đề: ${tag}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

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
                                commentsMap[post.id]?.map((cmt) => {
                                  const isCmtMe = currentUserId && cmt.authorId?.toString() === currentUserId.toString();
                                  const canDeleteCmt = isCmtMe || (currentUserId && post.authorId?.toString() === currentUserId.toString());
                                  const isEditingThisCmt = editingCommentId === cmt.id;

                                  return (
                                    <div key={cmt.id} className="cmt-row">
                                      <UserAvatar avatar={cmt.authorAvatar} size={26} />
                                      <div className="cmt-bubble-content">
                                        <div className="cmt-name-row">
                                          <span className="cmt-user-name">{cmt.authorNickname || cmt.authorAccount || 'Thành viên'}</span>
                                          <span className="cmt-time-label">{cmt.formattedTime}</span>

                                          {/* Nút Sửa / Xóa bình luận */}
                                          <div className="cmt-action-btns">
                                            {isCmtMe && !isEditingThisCmt && (
                                              <button 
                                                type="button"
                                                onClick={() => handleStartEditComment(cmt)}
                                                className="btn-cmt-act"
                                                title="Sửa bình luận"
                                              >
                                                <Edit3 size={11} />
                                              </button>
                                            )}
                                            {canDeleteCmt && (
                                              <button 
                                                type="button"
                                                onClick={() => handleDeleteComment(post.id, cmt.id)}
                                                className="btn-cmt-act danger"
                                                title="Xóa bình luận"
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
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  handleSaveEditComment(post.id, cmt.id);
                                                }
                                              }}
                                              className="cmt-inline-edit-input"
                                              autoFocus
                                            />
                                            <div className="cmt-inline-edit-actions">
                                              <button 
                                                type="button" 
                                                onClick={() => handleSaveEditComment(post.id, cmt.id)}
                                                disabled={isSavingComment || !editingCommentText.trim()}
                                                className="btn-save-inline-cmt"
                                              >
                                                Lưu
                                              </button>
                                              <button 
                                                type="button" 
                                                onClick={() => setEditingCommentId(null)}
                                                className="btn-cancel-inline-cmt"
                                              >
                                                Hủy
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
                  <h3>Không Gian Trò Chuyện & Gọi Thoại</h3>
                  <p>Tham gia nhắn tin và đàm thoại âm thanh trực tiếp cùng bạn bè.</p>
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

          {/* Tiện ích Chủ Đề & Hội Nhóm Cộng Đồng Riêng */}
          <div className="widget-box-card">
            <div className="widget-card-title">
              <Tag size={16} color="#818cf8" />
              <span>Chủ Đề & Không Gian Sôi Nổi</span>
            </div>
            <p className="widget-card-desc">Khám phá các chủ đề hoặc hội nhóm do cộng đồng cùng tạo:</p>
            <div className="widget-sparks-cloud">
              {communityTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setActiveFilterTag(activeFilterTag === tag ? null : tag);
                    setActiveTab('feed');
                  }}
                  className={`widget-spark-pill ${activeFilterTag === tag ? 'active' : ''}`}
                  title={`Xem bài viết: ${tag}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Tiện ích Ghép Đôi Tối Giản */}
          <div className="widget-box-card">
            <div className="widget-card-title">
              <Zap size={16} color="#818cf8" />
              <span>Kết Nối Ngẫu Nhiên</span>
            </div>
            <p className="widget-card-desc">Trò chuyện trực tiếp 1-1 với một người bạn ngẫu nhiên có cùng sở thích.</p>
            <button onClick={handleStartSpeedMatch} className="btn-widget-action">
              Bắt đầu kết nối
            </button>
          </div>

          {/* Tiện ích Vòng Quay Trò Chơi */}
          <div className="widget-box-card">
            <div className="widget-card-title">
              <Dices size={16} color="#818cf8" />
              <span>Vòng Quay Trò Chơi</span>
            </div>
            <p className="widget-card-desc">Bốc thăm câu hỏi thú vị để câu chuyện giữa bạn bè thêm phần rôm rả.</p>
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
              {rooms.slice(0, 4).map((r) => (
                <div key={r.id} className="widget-room-row" onClick={() => navigate(`/room/${r.id}`)}>
                  <div>
                    <span className="w-room-title">{r.nameroom}</span>
                    <span className="w-room-count">{r.soluong || r.userRoomDTOList?.length || 0} người đang tham gia</span>
                  </div>
                  <ChevronRight size={14} color="#64748b" />
                </div>
              ))}
            </div>
          </div>

          <div className="widget-legal-footer">
            <p>© 2026 Klyvix. Không gian trò chuyện & âm nhạc trực tiếp.</p>
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
          <div className="modal-dialog-box modal-match-zinc" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title-flex">
                <Zap size={17} color="#a1a1aa" />
                <h4>Kết Nối Trực Tiếp</h4>
              </div>
              <button onClick={() => setIsSpeedMatchOpen(false)} className="btn-close-dialog"><X size={16} /></button>
            </div>

            {matchingStatus === 'searching' ? (
              <div className="dialog-searching-body">
                <div className="radar-circle-zinc">
                  <Zap size={22} color="#f4f4f5" />
                </div>
                <p className="radar-status-text">Đang quét tìm thành viên trực tuyến cùng gu âm nhạc...</p>
              </div>
            ) : matchingStatus === 'waiting' ? (
              <div className="dialog-searching-body">
                <div className="radar-circle-zinc pulse-waiting">
                  <Compass size={22} color="#a1a1aa" />
                </div>
                <p className="radar-status-text">Hiện tại chưa có thành viên khác đang trong hàng đợi ghép đôi.</p>
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
                  <UserAvatar avatar={matchedPartner?.avatar} size={42} />
                  <div>
                    <strong>{matchedPartner?.nickname}</strong>
                    <p>{matchedPartner?.vibe}</p>
                  </div>
                </div>

                {/* Cho phép bấm trực tiếp vào câu Gợi ý mở đầu để sao chép */}
                <div 
                  className="icebreaker-quote-interactive"
                  onClick={() => {
                    navigator.clipboard.writeText(matchedPartner?.icebreaker || '');
                    toast.success("Đã sao chép câu gợi ý mở đầu!", { icon: '📋' });
                  }}
                  title="Nhấp để sao chép câu mở đầu này"
                >
                  <div className="icebreaker-top-row">
                    <span>💬 Gợi ý mở đầu (Bấm để sao chép):</span>
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
                      toast.success(`Đã sao chép câu mở đầu! Hãy bắt đầu trò chuyện cùng ${matchedPartner?.nickname}`, { icon: '💬' });
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
                <Dices size={17} color="#a1a1aa" />
                <h4>Vòng Quay Thử Thách</h4>
              </div>
              <button onClick={() => setIsPartyWheelOpen(false)} className="btn-close-dialog"><X size={16} /></button>
            </div>

            <div className="wheel-dialog-body">
              <div className={`clean-wheel-dial ${wheelSpinning ? 'spinning' : ''}`}>
                <Dices size={26} color="#e4e4e7" />
              </div>

              {wheelResult && (
                <div className="party-challenge-card-zinc">
                  <div className="challenge-card-badge">
                    <Dices size={12} /> LÁ BÀI THỬ THÁCH
                  </div>
                  <p className="challenge-card-question">"{wheelResult}"</p>
                  <button 
                    className="btn-share-challenge-feed"
                    onClick={() => {
                      setNewPostContent(`🎲 [Thử thách câu hỏi]: "${wheelResult}"\n\nBạn nghĩ sao về câu hỏi này? Cùng chia sẻ góc nhìn nhé!`);
                      setIsPartyWheelOpen(false);
                      setActiveTab('feed');
                      setTimeout(() => newPostInputRef.current?.focus(), 150);
                      toast.success("Đã đưa câu hỏi vào khung đăng bài!", { icon: '📝' });
                    }}
                  >
                    <Share2 size={13} /> Chia sẻ câu hỏi này lên Sảnh
                  </button>
                </div>
              )}

              <button 
                onClick={handleSpinPartyWheel} 
                disabled={wheelSpinning}
                className="btn-spin-action-zinc"
              >
                {wheelSpinning ? 'Đang bốc thăm câu hỏi...' : (wheelResult ? 'Quay câu hỏi khác 🎲' : 'Bốc câu hỏi ngẫu nhiên 🎲')}
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

      {/* MODAL CHỈNH SỬA BÀI VIẾT */}
      {editingPost && (
        <div className="modal-veil" onClick={() => setEditingPost(null)}>
          <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title-flex">
                <Edit3 size={18} color="#818cf8" />
                <h4>Chỉnh sửa bài viết</h4>
              </div>
              <button onClick={() => setEditingPost(null)} className="btn-close-dialog"><X size={16} /></button>
            </div>

            <form onSubmit={handleSaveEditPost} className="dialog-form">
              <div className="dialog-field">
                <label>Nội dung bài viết</label>
                <textarea 
                  rows="4" 
                  value={editPostContent} 
                  onChange={(e) => setEditPostContent(e.target.value)}
                  placeholder="Nhập nội dung mới..."
                  required
                />
              </div>

              <div className="dialog-field">
                <label>Đường dẫn hình ảnh (tùy chọn)</label>
                <input 
                  type="url" 
                  placeholder="https://..." 
                  value={editPostImageUrl} 
                  onChange={(e) => setEditPostImageUrl(e.target.value)}
                />
              </div>

              {/* Thẻ chủ đề bài viết khi sửa */}
              {editPostTags.length > 0 && (
                <div className="dialog-field">
                  <label>Thẻ chủ đề / Hội nhóm</label>
                  <div className="edit-tags-cloud">
                    {editPostTags.map(tag => (
                      <span key={tag} className="active-spark-chip">
                        {tag}
                        <button 
                          type="button" 
                          onClick={() => setEditPostTags(editPostTags.filter(t => t !== tag))} 
                          className="btn-remove-spark"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="dialog-actions-row">
                <button type="button" onClick={() => setEditingPost(null)} className="btn-dialog-back">Hủy</button>
                <button type="submit" disabled={isSavingEditPost || !editPostContent.trim()} className="btn-dialog-primary">
                  {isSavingEditPost ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
                <h4>Tham gia phòng {selectedRoom.nameroom}</h4>
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
          --social-bg: #09090b; /* Dark Zinc 950 Deep Obsidian */
          --sidebar-bg: #0d0e12; /* Subtle elevated sidebar */
          --card-bg: #14161f; /* Clean elevated surface */
          --card-border: #27272a; /* Zinc 800 hairline border */
          --text-main: #f4f4f5; /* Zinc 100 */
          --text-muted: #a1a1aa; /* Zinc 400 */
          --brand: #6366f1;
          --brand-hover: #4f46e5;
        }

        .social-app-wrapper {
          min-height: 100vh;
          width: 100%;
          background: var(--social-bg);
          color: var(--text-main);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          justify-content: center;
        }

        /* KHUNG CHÍNH CĂN GIỮA - CO GIÃN TỰ NHIÊN - KHÔNG BỊ TRỐNG RỖNG 2 BÊN TRÊN MÀN HÌNH RỘNG */
        .app-main-layout {
          display: flex;
          width: 100%;
          max-width: 1480px;
          margin: 0 auto;
          justify-content: center;
        }

        /* CỘT 1: THANH ĐIỀU HƯỚNG TRÁI */
        .nav-sidebar {
          width: 260px;
          min-width: 240px;
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

        /* Widget Radio tối giản */
        .ambient-radio-widget {
          background: rgba(255, 255, 255, 0.02);
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
          color: #d4d4d8;
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
          background: rgba(255, 255, 255, 0.06);
          border: none;
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
        .btn-radio-toggle:hover, .btn-radio-next:hover { background: #6366f1; color: white; }
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
          padding: 9px 12px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 13px;
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
          background: #27272a;
          color: #f4f4f5;
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
          background: rgba(255, 255, 255, 0.02);
          color: #d4d4d8;
          transition: all 0.15s;
        }
        .btn-speed-match-minimal:hover { background: #27272a; color: #f4f4f5; }
        .btn-party-wheel-minimal:hover { background: #27272a; color: #f4f4f5; }
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
          background: rgba(255, 255, 255, 0.04);
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
        .m-radio-pill.active { background: #6366f1; color: white; }

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
          font-size: 13px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 14px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .stream-tab.active {
          background: #27272a;
          color: var(--text-main);
        }
        .btn-header-notif {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--card-border);
          color: #d4d4d8;
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
          background: #18181b;
          border: 1px solid var(--card-border);
          box-shadow: 0 10px 30px rgba(0,0,0,0.6);
          border-radius: 10px;
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

        /* DẢI TÍN HIỆU TRỰC TIẾP */
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
          color: #a1a1aa;
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
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          color: #d4d4d8;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          white-space: nowrap;
        }
        .signal-pill:hover { background: #27272a; color: white; }
        .signal-pill.active { border-color: #52525b; color: #f4f4f5; }
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
          background: rgba(18, 20, 28, 0.5);
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
          font-size: 14px;
          font-family: inherit;
          resize: none;
          outline: none;
          line-height: 1.5;
        }
        .creator-field-wrap textarea::placeholder { color: #71717a; }

        /* Sparks & Community Tags */
        .community-sparks-section {
          margin: 8px 0 10px 52px;
        }
        .selected-sparks-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 8px;
        }
        .active-spark-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #27272a;
          border: 1px solid #3f3f46;
          color: #f4f4f5;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
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
        .btn-remove-spark:hover { color: #f87171; }
        .custom-spark-input-row {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #09090b;
          border: 1px solid var(--card-border);
          border-radius: 8px;
          padding: 4px 8px;
          margin-bottom: 8px;
        }
        .spark-input-icon { color: #a1a1aa; flex-shrink: 0; }
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
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .btn-add-spark-action:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Filter Banner */
        .active-tag-filter-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #18181b;
          border-bottom: 1px solid var(--card-border);
          padding: 8px 16px;
          font-size: 12px;
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

        .vibe-tags-row {
          display: flex;
          gap: 6px;
          margin: 10px 0 10px 52px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .vibe-tags-row::-webkit-scrollbar { display: none; }
        .vibe-tag-pill {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--card-border);
          color: #a1a1aa;
          font-size: 10.5px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
        }
        .vibe-tag-pill.active {
          background: #27272a;
          border-color: #3f3f46;
          color: #f4f4f5;
        }

        .image-input-row {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #09090b;
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
          color: #a1a1aa;
          font-size: 11.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 6px;
        }
        .btn-subtool:hover { color: #f4f4f5; }
        .btn-subtool.active { color: #ffffff; }
        .btn-publish-submit {
          background: #f4f4f5;
          color: #18181b;
          border: none;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s;
        }
        .btn-publish-submit:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-publish-submit:hover:not(:disabled) { background: #e4e4e7; }

        /* POST CARDS */
        .post-item-card {
          padding: 16px;
          border-bottom: 1px solid var(--card-border);
          position: relative;
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
          font-size: 13.5px;
          font-weight: 700;
          color: #f4f4f5;
          cursor: pointer;
        }
        .privilege-badge {
          font-size: 9.5px;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .privilege-badge.founder {
          background: #27272a;
          color: #e4e4e7;
          border: 1px solid #3f3f46;
        }
        .privilege-badge.vip {
          background: #27272a;
          color: #cbd5e1;
          border: 1px solid #3f3f46;
        }
        .author-handle { font-size: 11px; color: #71717a; }
        .post-meta-sub {
          font-size: 11px;
          color: #71717a;
          margin-top: 2px;
          display: flex;
          gap: 4px;
        }
        .vibe-tag-badge { color: #a1a1aa; }
        .btn-save-post {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          padding: 4px;
        }
        .btn-save-post.saved { color: #f4f4f5; }

        .post-body-content {
          margin: 8px 0 10px 48px;
          font-size: 13.5px;
          line-height: 1.5;
          color: #e4e4e7;
        }
        .post-body-content p { margin: 0; white-space: pre-wrap; word-break: break-word; }
        .post-media-frame {
          margin-top: 8px;
          border-radius: 8px;
          overflow: hidden;
          max-height: 320px;
          border: 1px solid var(--card-border);
        }
        .post-media-frame img { width: 100%; height: 100%; object-fit: cover; }

        .post-actions-toolbar {
          margin-left: 48px;
          display: flex;
          gap: 8px;
          position: relative;
        }
        .reaction-drop-wrapper { position: relative; }
        .action-btn {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--card-border);
          color: #a1a1aa;
          font-size: 11.5px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s;
        }
        .action-btn:hover { background: #27272a; color: white; }
        .action-btn.active-liked { color: #f87171; border-color: rgba(239, 68, 68, 0.3); }
        .custom-emoji-view { font-size: 13.5px; }

        /* REACTION POPOVER: NẰM PHÍA TRÊN NÚT, KHÔNG ĐÈ LÊN TEXT */
        .reactions-popup-menu {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          background: rgba(24, 24, 27, 0.96); /* bg-zinc-900/95 */
          backdrop-filter: blur(12px); /* backdrop-blur-md */
          border: 1px solid #27272a; /* border-zinc-800 */
          border-radius: 8px; /* rounded-lg */
          padding: 4px 6px; /* px-2 py-1 */
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5); /* shadow-xl */
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
          font-size: 18px;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 6px;
          line-height: 1;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .reaction-emoji-item:hover {
          transform: scale(1.28);
          background: rgba(255, 255, 255, 0.08);
        }

        /* Post Dropdown Menu */
        .post-menu-btn {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          padding: 3px;
          border-radius: 4px;
        }
        .post-menu-btn:hover { color: #f4f4f5; background: rgba(255,255,255,0.05); }
        .post-menu-dropdown {
          position: absolute;
          top: 26px;
          right: 0;
          background: #18181b;
          border: 1px solid var(--card-border);
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.6);
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          z-index: 50;
          min-width: 140px;
        }
        .post-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: none;
          color: #d4d4d8;
          font-size: 11.5px;
          padding: 6px 8px;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
        }
        .post-menu-item:hover { background: #27272a; color: white; }
        .post-menu-item.danger { color: #f87171; }
        .post-menu-item.danger:hover { background: rgba(239, 68, 68, 0.15); color: #f87171; }

        /* Comments */
        .post-comments-container {
          margin: 10px 0 0 48px;
          background: #09090b;
          border: 1px solid var(--card-border);
          border-radius: 8px;
          padding: 10px;
        }
        .comments-stack { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
        .empty-cmt-notice { margin: 0; font-size: 11px; color: #71717a; font-style: italic; }
        .cmt-row { display: flex; gap: 8px; }
        .cmt-bubble-content {
          background: #18181b;
          border: 1px solid var(--card-border);
          padding: 6px 8px;
          border-radius: 6px;
          flex: 1;
        }
        .cmt-name-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
        .cmt-user-name { font-size: 11.5px; font-weight: 700; color: #f4f4f5; }
        .cmt-time-label { font-size: 9.5px; color: #71717a; }
        .cmt-body-text { margin: 0; font-size: 12px; color: #d4d4d8; }
        .cmt-action-btns {
          display: flex;
          align-items: center;
          gap: 3px;
          margin-left: auto;
        }
        .btn-cmt-act {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
        }
        .btn-cmt-act:hover { color: #d4d4d8; }
        .btn-cmt-act.danger:hover { color: #f87171; }
        .cmt-inline-edit-box {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 4px;
        }
        .cmt-inline-edit-input {
          width: 100%;
          background: #09090b;
          border: 1px solid #3f3f46;
          border-radius: 6px;
          padding: 5px 8px;
          color: white;
          font-size: 12px;
          outline: none;
        }
        .cmt-inline-edit-actions {
          display: flex;
          gap: 6px;
          justify-content: flex-end;
        }
        .btn-save-inline-cmt {
          background: #f4f4f5;
          color: #18181b;
          border: none;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-cancel-inline-cmt {
          background: transparent;
          color: #a1a1aa;
          border: 1px solid var(--card-border);
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          cursor: pointer;
        }
        .cmt-input-form { display: flex; gap: 6px; }
        .cmt-input-form input {
          flex: 1;
          background: #18181b;
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 6px 10px;
          color: white;
          font-size: 12px;
          outline: none;
        }
        .btn-submit-cmt {
          background: #f4f4f5;
          color: #18181b;
          border: none;
          width: 28px;
          height: 28px;
          border-radius: 6px;
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
          background: #18181b;
          border: 1px solid var(--card-border);
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .rooms-header-banner h3 { margin: 0 0 3px 0; font-size: 14.5px; }
        .rooms-header-banner p { margin: 0; font-size: 11.5px; color: #a1a1aa; }
        .btn-add-room-action {
          background: #f4f4f5;
          color: #18181b;
          border: none;
          padding: 7px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
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
          background: #18181b;
          border: 1px solid var(--card-border);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .room-simple-card.active-room { border-color: #3f3f46; }
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
          background: #27272a;
          color: #f4f4f5;
          border: 1px solid #3f3f46;
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
        .btn-join-room:hover { background: #3f3f46; }
        .btn-rejoin { background: #3f3f46; border-color: #52525b; }

        /* CỘT 3: WIDGETS PHẢI */
        .widgets-sidebar {
          width: 340px;
          min-width: 300px;
          padding: 18px 14px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-shrink: 0;
        }
        .search-input-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--card-border);
          border-radius: 8px;
          display: flex;
          align-items: center;
          padding: 7px 10px;
          gap: 6px;
        }
        .search-icon-muted { color: #71717a; }
        .search-input-wrap input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 12.5px;
          outline: none;
        }
        .btn-clear-kw { background: transparent; border: none; color: #71717a; cursor: pointer; }

        .widget-box-card {
          background: #18181b;
          border: 1px solid var(--card-border);
          border-radius: 10px;
          padding: 14px;
        }
        .widget-card-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 700;
          color: #f4f4f5;
          margin-bottom: 6px;
        }
        .widget-card-desc { font-size: 11px; color: #a1a1aa; margin: 0 0 10px 0; line-height: 1.4; }
        .btn-widget-action {
          width: 100%;
          background: #27272a;
          color: #f4f4f5;
          border: 1px solid #3f3f46;
          padding: 8px 12px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 11.5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-widget-action:hover {
          background: #3f3f46;
          color: #ffffff;
        }
        .btn-widget-action.secondary {
          background: transparent;
          color: #a1a1aa;
          border: 1px solid var(--card-border);
        }
        .btn-widget-action.secondary:hover {
          background: #27272a;
          color: #f4f4f5;
        }

        .widget-sparks-cloud {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 6px;
        }
        .widget-spark-pill {
          background: #09090b;
          border: 1px solid var(--card-border);
          color: #d4d4d8;
          font-size: 11px;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .widget-spark-pill:hover {
          background: #27272a;
          color: #f4f4f5;
        }
        .widget-spark-pill.active {
          background: #f4f4f5;
          color: #18181b;
          border-color: #f4f4f5;
          font-weight: 700;
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

        .widget-legal-footer p { font-size: 10.5px; color: #71717a; margin: 0; }

        /* MOBILE NAV */
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 56px;
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
          color: #a1a1aa;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          font-size: 9.5px;
          cursor: pointer;
        }
        .b-nav-item.active { color: #f4f4f5; }
        .b-nav-create-center {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #f4f4f5;
          color: #18181b;
          justify-content: center;
          margin-top: -12px;
        }

        /* MODAL COMMON DARK ZINC */
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
          background: #18181b;
          border: 1px solid #27272a;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
          border-radius: 14px;
          width: 100%;
          max-width: 400px;
          padding: 18px;
        }
        .dialog-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .dialog-title-flex { display: flex; align-items: center; gap: 6px; }
        .dialog-header h4 { margin: 0; font-size: 14px; color: #f4f4f5; }
        .btn-close-dialog { background: transparent; border: none; color: #a1a1aa; cursor: pointer; }
        .dialog-form { display: flex; flex-direction: column; gap: 10px; }
        .dialog-field { display: flex; flex-direction: column; gap: 4px; }
        .dialog-field label { font-size: 11px; font-weight: 600; color: #a1a1aa; }
        .dialog-field input {
          background: #09090b;
          border: 1px solid #3f3f46;
          border-radius: 6px;
          padding: 7px 10px;
          color: white;
          font-size: 12.5px;
          outline: none;
        }
        .dialog-actions-row { display: flex; gap: 8px; margin-top: 10px; }
        .btn-dialog-back {
          flex: 1;
          background: #27272a;
          color: #d4d4d8;
          border: 1px solid #3f3f46;
          padding: 8px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-dialog-primary {
          flex: 1;
          background: #f4f4f5;
          color: #18181b;
          border: none;
          padding: 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        /* Speed match dialog styles */
        .dialog-searching-body { text-align: center; padding: 24px 10px; }
        .radar-circle-zinc {
          width: 52px;
          height: 52px;
          margin: 0 auto 12px;
          border-radius: 50%;
          border: 2px solid #52525b;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulseZinc 1.2s infinite;
        }
        @keyframes pulseZinc {
          0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.2); }
          70% { box-shadow: 0 0 0 14px rgba(255, 255, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }
        .radar-status-text {
          font-size: 12px;
          color: #a1a1aa;
          margin: 0;
          line-height: 1.5;
        }
        .partner-matched-card-zinc {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 10px;
          margin-bottom: 12px;
        }
        .partner-matched-card-zinc strong { display: block; font-size: 13.5px; color: #f4f4f5; }
        .partner-matched-card-zinc p { margin: 2px 0 0 0; font-size: 11px; color: #a1a1aa; }

        /* Bấm trực tiếp vào gợi ý mở đầu để sao chép */
        .icebreaker-quote-interactive {
          background: #09090b;
          border: 1px dashed #3f3f46;
          border-radius: 8px;
          padding: 10px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .icebreaker-quote-interactive:hover {
          border-color: #71717a;
          background: rgba(255, 255, 255, 0.03);
        }
        .icebreaker-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .icebreaker-top-row span {
          font-size: 10.5px;
          font-weight: 600;
          color: #a1a1aa;
        }
        .copy-icon-subtle { color: #71717a; }
        .icebreaker-quote-interactive p {
          margin: 0;
          font-size: 12.5px;
          font-weight: 500;
          color: #f4f4f5;
          line-height: 1.45;
        }

        /* Wheel dialog - Lá bài thử thách bg-zinc-950 border border-zinc-800 p-6 rounded-lg */
        .wheel-dialog-body { text-align: center; }
        .clean-wheel-dial {
          width: 68px;
          height: 68px;
          margin: 6px auto 14px;
          border-radius: 50%;
          border: 2px solid #3f3f46;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .clean-wheel-dial.spinning { animation: spinWheel 1.2s cubic-bezier(0.15, 0.9, 0.3, 1.2) forwards; }
        @keyframes spinWheel {
          100% { transform: rotate(1080deg); }
        }

        .party-challenge-card-zinc {
          background: #09090b; /* bg-zinc-950 */
          border: 1px solid #27272a; /* border-zinc-800 */
          border-radius: 8px; /* rounded-lg */
          padding: 16px; /* p-6 style */
          margin-bottom: 14px;
          text-align: left;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        }
        .challenge-card-badge {
          font-size: 10.5px;
          font-weight: 700;
          color: #a1a1aa;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 8px;
        }
        .challenge-card-question {
          font-size: 13.5px;
          line-height: 1.5;
          color: #f4f4f5;
          font-weight: 500;
          margin: 0 0 12px 0;
        }
        .btn-share-challenge-feed {
          width: 100%;
          background: #18181b;
          border: 1px solid #3f3f46;
          color: #f4f4f5;
          padding: 7px 10px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.15s ease;
        }
        .btn-share-challenge-feed:hover {
          background: #27272a;
          color: white;
        }

        .btn-spin-action-zinc {
          width: 100%;
          background: #f4f4f5;
          color: #18181b;
          border: none;
          padding: 9px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 12.5px;
          cursor: pointer;
        }
        .btn-spin-action-zinc:disabled { opacity: 0.5; cursor: not-allowed; }

        .feed-status-box { padding: 40px 20px; text-align: center; color: #71717a; }
        .feed-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255,255,255,0.1);
          border-bottom-color: #a1a1aa;
          border-radius: 50%;
          margin: 0 auto 10px;
          animation: spin 0.8s linear infinite;
        }

        /* WIDESCREEN ENHANCEMENT - Tránh bị trống đen ở hai bên */
        @media (min-width: 1600px) {
          .app-main-layout {
            max-width: 1560px;
          }
          .main-stream {
            max-width: 820px;
          }
          .widgets-sidebar {
            width: 360px;
          }
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
          .community-sparks-section { margin-left: 0; }
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
