import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Edit3, LogOut, UserPlus, UserCheck, Clock,
  MapPin, Calendar, Mail, Phone, PhoneCall, Lock, Check, X,
  Camera, Upload, Trash2, Heart, MessageSquare, Share2,
  Shield, Sparkles, Loader2, Users, Radio, Headphones,
  Mic, Play, Pause, Square, RotateCcw, AudioLines, Volume2,
  VolumeX, Music, Tag, CornerDownRight, Send, ChevronDown,
  Compass, Plus, User, UserMinus
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import TalovinLogo from '../components/TalovinLogo';
import UserAvatar from '../components/UserAvatar';
import MobileBottomNav from '../components/MobileBottomNav';
import { playHeartSound } from '../utils/soundEffects';
import { useAuth } from '../context/AuthContext';
import { usePresence } from '../context/PresenceContext';

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
        let parsedMedia = parsed.mediaUrl || null;
        let parsedAudio = parsed.audioUrl || directAudio || null;
        if (parsedMedia && (parsedMedia.match(/\.(mp3|wav|ogg|m4a|aac|webm)(\?.*)?$/i) || parsedMedia.startsWith('data:audio/') || parsed.mediaType === 'audio' || parsed.mediaType === 'AUDIO')) {
          if (!parsedAudio) parsedAudio = parsedMedia;
          parsedMedia = null;
        }
        return {
          mediaUrl: parsedMedia,
          mediaType: parsedMedia ? (parsed.mediaType || (parsedMedia.includes('video') ? 'video' : 'image')) : (parsedAudio ? 'audio' : null),
          audioUrl: parsedAudio,
          audioDuration: parsed.audioDuration || directDuration || null
        };
      } catch (e) {}
    }
    const isAudio = trimmed.match(/\.(mp3|wav|ogg|m4a|aac|webm)(\?.*)?$/i) || trimmed.startsWith('data:audio/') || trimmed.includes('audio') || trimmed.includes('voice');
    if (isAudio) {
      return {
        mediaUrl: null,
        mediaType: 'audio',
        audioUrl: trimmed,
        audioDuration: directDuration || null
      };
    }
    const isVideo = trimmed.match(/\.(mp4|mov)(\?.*)?$/i) || trimmed.startsWith('data:video/');
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

const TIME_FORMATTER = (dateStr) => {
  if (!dateStr) return 'Vừa xong';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
      d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  } catch (e) {
    return dateStr;
  }
};

const ProfilePage = () => {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, updateCurrentUser } = useAuth();

  // Điều hướng lùi về đúng vị trí trang trước (N+1 -> N) thay vì luôn nhảy về Sảnh
  const handleBack = () => {
    const fromParam = searchParams.get('from');
    if (fromParam) {
      try {
        navigate(decodeURIComponent(fromParam));
        return;
      } catch (_) {}
    }
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const currentUserId = currentUser?.id || localStorage.getItem('user_id');
  const effectiveUserId = userId || currentUserId;
  const isMe = Boolean(currentUserId && String(effectiveUserId) === String(currentUserId));

  // States: Khởi tạo snapshot ngay lập tức nếu là tài khoản của mình (0ms delay)
  const [profile, setProfile] = useState(() => (isMe && currentUser ? currentUser : null));
  const [loading, setLoading] = useState(() => !isMe && !profile);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'friends'
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [openIntentDropdown, setOpenIntentDropdown] = useState(false);
  const [openMusicDropdown, setOpenMusicDropdown] = useState(false);

  // Dữ liệu bài viết, bạn bè
  const [userPosts, setUserPosts] = useState([]);
  const [userFriends, setUserFriends] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Trạng thái kết bạn (nếu xem người khác)
  const [friendStatus, setFriendStatus] = useState('NONE'); // 'NONE' | 'PENDING_SENT' | 'ACCEPTED'
  const [processingFriend, setProcessingFriend] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Post Detail Modal State on Profile
  const [selectedDetailPost, setSelectedDetailPost] = useState(null);
  const [detailCommentsMap, setDetailCommentsMap] = useState({});
  const [detailCommentInput, setDetailCommentInput] = useState('');
  const [detailReplyTarget, setDetailReplyTarget] = useState(null);
  const [submittingDetailComment, setSubmittingDetailComment] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedDetailPost) {
        setSelectedDetailPost(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDetailPost]);

  const fetchCommentsForPost = async (postId) => {
    try {
      const res = await axiosClient.get(`/posts/${postId}/comments`);
      if (res.data && res.data.data) {
        setDetailCommentsMap(prev => ({ ...prev, [postId]: res.data.data }));
      }
    } catch (err) {
      console.warn("Lỗi lấy bình luận trên trang cá nhân:", err);
    }
  };

  const handlePostCardClick = (e, post, autoFocusComment = false) => {
    const selection = window.getSelection()?.toString();
    if (selection && selection.trim().length > 0) return;

    setSelectedDetailPost(post);
    fetchCommentsForPost(post.id);
    if (autoFocusComment) {
      setTimeout(() => {
        const input = document.getElementById('profile-detail-comment-input');
        if (input) input.focus();
      }, 200);
    }
  };

  const handleAddDetailComment = async (postId) => {
    const text = detailCommentInput.trim();
    if (!text) return;

    const payload = {
      content: text,
      parentId: detailReplyTarget?.commentId || null,
      replyToUser: detailReplyTarget?.authorAccount || null
    };

    try {
      setSubmittingDetailComment(true);
      const res = await axiosClient.post(`/posts/${postId}/comments`, payload);
      if (res.data && res.data.data) {
        setDetailCommentsMap(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), res.data.data]
        }));
        setDetailCommentInput('');
        setDetailReplyTarget(null);
        // Cập nhật số lượng comment trên bài viết ngoài trang cá nhân
        setUserPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
        setSelectedDetailPost(prev => prev && prev.id === postId ? { ...prev, commentsCount: (prev.commentsCount || 0) + 1 } : prev);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi gửi phản hồi!");
    } finally {
      setSubmittingDetailComment(false);
    }
  };

  const handleToggleLikeDetailComment = async (postId, commentId) => {
    if (!postId || !commentId) return;
    playHeartSound();
    setDetailCommentsMap(prev => {
      const list = prev[postId] || [];
      return {
        ...prev,
        [postId]: list.map(c => {
          if (String(c.id) === String(commentId)) {
            const wasLiked = Boolean(c.isLiked);
            const count = Number(c.likesCount || 0);
            return {
              ...c,
              isLiked: !wasLiked,
              likesCount: wasLiked ? Math.max(0, count - 1) : count + 1
            };
          }
          return c;
        })
      };
    });

    try {
      await axiosClient.post(`/posts/${postId}/comments/${commentId}/like`).catch(() =>
        axiosClient.post(`/posts/comments/${commentId}/like`)
      );
    } catch (e) {
      fetchCommentsForPost(postId);
    }
  };

  // Voice Bio 10s State
  const [voiceBioUrl, setVoiceBioUrl] = useState(() => {
    return localStorage.getItem(`voice_bio_${effectiveUserId}`) || null;
  });
  const [isPlayingVoiceBio, setIsPlayingVoiceBio] = useState(false);
  const [isRecordingBio, setIsRecordingBio] = useState(false);
  const [recordTimeLeft, setRecordTimeLeft] = useState(10);
  const [tempBioBlob, setTempBioBlob] = useState(null);

  // Voice note player for user posts
  const [playingVoicePostId, setPlayingVoicePostId] = useState(null);
  const voicePostAudioRef = useRef(null);

  const handleTogglePlayPostVoice = (postId, audioUrl) => {
    if (!audioUrl) return;
    if (playingVoicePostId === postId) {
      if (voicePostAudioRef.current) {
        voicePostAudioRef.current.pause();
      }
      setPlayingVoicePostId(null);
    } else {
      if (voicePostAudioRef.current) {
        voicePostAudioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      voicePostAudioRef.current = audio;
      audio.onended = () => setPlayingVoicePostId(null);
      audio.onerror = () => {
        toast.error('Không thể phát âm thanh này');
        setPlayingVoicePostId(null);
      };
      audio.play().then(() => {
        setPlayingVoicePostId(postId);
      }).catch(err => {
        console.error('Lỗi phát âm thanh bài viết:', err);
        setPlayingVoicePostId(null);
      });
    }
  };

  useEffect(() => {
    return () => {
      if (voicePostAudioRef.current) {
        voicePostAudioRef.current.pause();
      }
    };
  }, []);

  const voiceBioAudioRef = useRef(null);
  const bioRecorderRef = useRef(null);
  const bioTimerRef = useRef(null);
  const bioChunksRef = useRef([]);

  // Băng tần & Kênh nhạc động từ Backend
  const [dynamicIntents, setDynamicIntents] = useState([]);
  const [dynamicTracks, setDynamicTracks] = useState([]);

  // Form chỉnh sửa hồ sơ & tần số
  const [editData, setEditData] = useState({
    nickname: '',
    age: '',
    location: '',
    bio: '',
    personalFrequency: '96.4',
    favoriteMusicId: '',
    matchIntentCode: '',
    avatar: ''
  });

  // Đổi mật khẩu
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);

  const fileInputRef = useRef(null);

  // 0. Tải cấu hình Băng tần & Kênh nhạc động
  useEffect(() => {
    axiosClient.get('/public/lobby-config').then(res => {
      if (res.data?.data) {
        setDynamicIntents(res.data.data.intents || []);
        setDynamicTracks(res.data.data.tracks || []);
      }
    }).catch(() => {
      axiosClient.get('/match/config').then(res => {
        if (res.data) {
          setDynamicIntents(res.data.intents || []);
          setDynamicTracks(res.data.channels || []);
        }
      }).catch(() => { });
    });
  }, []);

  // 1. Nạp thông tin hồ sơ
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const params = effectiveUserId ? { user_id: effectiveUserId } : {};
      const res = await axiosClient.get('/users/profile', { params });
      if (res.data?.data) {
        const data = res.data.data;
        setProfile(data);
        if (isMe) {
          updateCurrentUser(data);
        }

        setEditData({
          nickname: data.nickname || '',
          age: data.age || '',
          location: data.location || '',
          bio: data.bio || '',
          personalFrequency: data.personalFrequency ? Number(data.personalFrequency).toFixed(1) : '96.4',
          favoriteMusicId: data.favoriteMusicId ? String(data.favoriteMusicId) : '',
          matchIntentCode: data.matchIntentCode || '',
          avatar: data.avatar || ''
        });
      }
    } catch (err) {
      console.warn("Lỗi tải thông tin cá nhân:", err);
      if (isMe) {
        setProfile({
          id: currentUserId,
          nickname: localStorage.getItem('nickname') || 'Người dùng Talovin',
          account: localStorage.getItem('account') || 'user',
          avatar: localStorage.getItem('user_avatar') || '',
          bio: '',
          roles: ['ROLE_USER'],
          vipTier: 'MEMBER'
        });
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, isMe, currentUserId]);

  // 2. Nạp bài viết của người dùng
  const fetchUserPosts = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      setLoadingPosts(true);
      const res = await axiosClient.get(`/posts/user/${effectiveUserId}`);
      if (res.data?.data) {
        setUserPosts(res.data.data);
      } else {
        setUserPosts([]);
      }
    } catch (e) {
      setUserPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [effectiveUserId]);

  // 3. Nạp danh sách bạn bè & kiểm tra quan hệ bạn bè chính xác
  const fetchUserFriends = useCallback(async () => {
    try {
      setLoadingFriends(true);
      const res = await axiosClient.get('/friends/list');
      if (res.data?.data) {
        setUserFriends(res.data.data);
      }
      if (!isMe && effectiveUserId) {
        try {
          const statusRes = await axiosClient.get(`/friends/status/${effectiveUserId}`);
          if (statusRes.data?.data) {
            setFriendStatus(statusRes.data.data);
          }
        } catch (_) {
          if (res.data?.data) {
            const isFriend = res.data.data.some(f => String(f.id) === String(effectiveUserId));
            if (isFriend) setFriendStatus('ACCEPTED');
          }
        }
      }
    } catch (e) {
      console.warn("Lỗi tải danh sách bạn bè:", e);
    } finally {
      setLoadingFriends(false);
    }
  }, [isMe, effectiveUserId]);

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
    fetchUserFriends();
    const storedBio = localStorage.getItem(`voice_bio_${effectiveUserId}`);
    setVoiceBioUrl(storedBio || null);
  }, [fetchProfile, fetchUserPosts, fetchUserFriends, effectiveUserId]);

  // Đổi Avatar: Upload file lên /api/media/upload (Cloudflare R2) -> gọi ngay PUT /api/users/profile lưu avatarUrl vào DB
  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Vui lòng chọn tệp hình ảnh hợp lệ");
      return;
    }

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append('file', file);

      let avatarUrl = '';
      try {
        const uploadRes = await axiosClient.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        avatarUrl = uploadRes.data?.data?.url || uploadRes.data?.data || '';
      } catch (uploadErr) {
        // Fallback: WebP canvas
        avatarUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const size = 400;
              canvas.width = size;
              canvas.height = size;

              let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;
              if (img.width > img.height) {
                srcX = (img.width - img.height) / 2;
                srcW = img.height;
              } else {
                srcY = (img.height - img.width) / 2;
                srcH = img.width;
              }

              ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, size, size);
              resolve(canvas.toDataURL('image/webp', 0.85));
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      if (avatarUrl) {
        const updateRes = await axiosClient.put('/users/profile', {
          avatarUrl: avatarUrl,
          avatar: avatarUrl
        });
        const updatedUser = updateRes.data?.data;
        if (updatedUser) {
          setProfile(prev => ({ ...prev, ...updatedUser }));
          updateCurrentUser(updatedUser);
        } else {
          setProfile(prev => ({ ...prev, avatar: avatarUrl, avatarUrl: avatarUrl }));
          updateCurrentUser({ avatar: avatarUrl, avatarUrl: avatarUrl });
        }
        localStorage.setItem('user_avatar', avatarUrl);
        toast.success("Đã cập nhật ảnh đại diện mới!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tải lên ảnh đại diện");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Lưu thông tin hồ sơ
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        nickname: editData.nickname?.trim(),
        age: editData.age ? parseInt(editData.age, 10) : null,
        location: editData.location?.trim() || null,
        bio: editData.bio?.trim() || null,
        avatar: editData.avatar || null,
        personalFrequency: editData.personalFrequency ? parseFloat(Number(editData.personalFrequency).toFixed(1)) : null,
        favoriteMusicId: editData.favoriteMusicId ? Number(editData.favoriteMusicId) : null,
        matchIntentCode: editData.matchIntentCode || null
      };

      const res = await axiosClient.put('/users/profile', payload);
      if (res.data?.data) {
        setProfile(prev => ({
          ...prev,
          ...res.data.data
        }));
        updateCurrentUser(res.data.data);
      }

      toast.success("Đã lưu tần số & hồ sơ cá nhân!");
      setIsEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Cập nhật thất bại!");
    } finally {
      setSubmitting(false);
    }
  };

  // Đổi mật khẩu
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự!");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return;
    }

    setChangingPassword(true);
    try {
      await axiosClient.put('/auth/change_password', {
        old_password: passwordData.oldPassword,
        new_password: passwordData.newPassword
      });
      toast.success("Đổi mật khẩu thành công!");
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Đổi mật khẩu thất bại!");
    } finally {
      setChangingPassword(false);
    }
  };

  // 1. Gửi lời mời kết bạn (Optimistic UI)
  const handleSendFriendRequest = async () => {
    if (!effectiveUserId || processingFriend) return;
    setProcessingFriend(true);
    setFriendStatus('PENDING_SENT');
    try {
      const res = await axiosClient.post(`/friends/request/${effectiveUserId}`, null, {
        params: { receiver_id: effectiveUserId, user_id: effectiveUserId }
      });
      toast.success(res.data?.message || "Đã gửi lời mời kết bạn!");
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.includes('đã gửi') || msg.includes('đợi phản hồi')) {
        setFriendStatus('PENDING_SENT');
        toast(msg);
      } else if (msg.includes('đã là bạn bè')) {
        setFriendStatus('ACCEPTED');
        toast(msg);
      } else {
        setFriendStatus('NONE');
        toast.error(msg || "Không thể gửi yêu cầu kết bạn!");
      }
    } finally {
      setProcessingFriend(false);
    }
  };

  // 2. Chấp nhận lời mời kết bạn
  const handleAcceptFriendRequest = async () => {
    if (!effectiveUserId || processingFriend) return;
    setProcessingFriend(true);
    setFriendStatus('ACCEPTED');
    try {
      await axiosClient.post(`/friends/accept/${effectiveUserId}`, null, {
        params: { sender_id: effectiveUserId }
      });
      toast.success("Đã đồng ý kết bạn!");
      fetchUserFriends();
    } catch (err) {
      setFriendStatus('PENDING_RECEIVED');
      toast.error(err.response?.data?.message || "Không thể chấp nhận lời mời!");
    } finally {
      setProcessingFriend(false);
    }
  };

  // 3. Từ chối lời mời kết bạn
  const handleDeclineFriendRequest = async () => {
    if (!effectiveUserId || processingFriend) return;
    setProcessingFriend(true);
    setFriendStatus('NONE');
    try {
      await axiosClient.post(`/friends/decline/${effectiveUserId}`, null, {
        params: { sender_id: effectiveUserId }
      });
      toast.success("Đã từ chối lời mời kết bạn.");
    } catch (err) {
      setFriendStatus('PENDING_RECEIVED');
      toast.error(err.response?.data?.message || "Lỗi thao tác!");
    } finally {
      setProcessingFriend(false);
    }
  };

  // 4. Hủy lời mời kết bạn đã gửi
  const handleCancelFriendRequest = async () => {
    if (!effectiveUserId || processingFriend) return;
    setProcessingFriend(true);
    setFriendStatus('NONE');
    try {
      await axiosClient.post(`/friends/cancel/${effectiveUserId}`, null, {
        params: { friend_id: effectiveUserId }
      });
      toast.success("Đã hủy lời mời kết bạn.");
    } catch (err) {
      setFriendStatus('PENDING_SENT');
      toast.error(err.response?.data?.message || "Không thể hủy lời mời!");
    } finally {
      setProcessingFriend(false);
    }
  };

  // 5. Hủy kết bạn (Unfriend)
  const handleUnfriend = async () => {
    if (!effectiveUserId || processingFriend) return;
    if (!window.confirm("Bạn có chắc chắn muốn hủy kết bạn với người này không?")) return;
    setProcessingFriend(true);
    setFriendStatus('NONE');
    try {
      await axiosClient.post(`/friends/remove/${effectiveUserId}`, null, {
        params: { friend_id: effectiveUserId }
      });
      toast.success("Đã hủy kết bạn.");
      fetchUserFriends();
    } catch (err) {
      setFriendStatus('ACCEPTED');
      toast.error(err.response?.data?.message || "Lỗi khi hủy kết bạn!");
    } finally {
      setProcessingFriend(false);
    }
  };

  // Mở tin nhắn trực tiếp với người dùng kèm đường dẫn quay lại
  const handleOpenDirectMessage = (e) => {
    if (e) e.stopPropagation();
    if (!effectiveUserId) return;
    const currentPath = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : `/profile/${effectiveUserId}`;
    
    // Chỉ truyền partnerState khi có thông tin thực tế, tuyệt đối không truyền undefined
    const partnerState = (profile && (profile.account || profile.nickname)) ? {
      id: Number(effectiveUserId),
      account: profile.account,
      nickname: profile.nickname || profile.account,
      avatar: profile.avatar || ''
    } : null;

    navigate(`/messages/${effectiveUserId}?from=${encodeURIComponent(currentPath)}`, {
      state: partnerState ? { targetUser: partnerState, partner: partnerState } : undefined
    });
  };

  // ==========================================
  // VOICE BIO 10S: RECORD & PLAYBACK
  // ==========================================
  const startRecordingVoiceBio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      bioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      bioRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) bioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(bioChunksRef.current, { type: 'audio/webm' });
        setTempBioBlob(audioBlob);
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result;
          setVoiceBioUrl(base64Audio);
          localStorage.setItem(`voice_bio_${effectiveUserId}`, base64Audio);
          toast.success("Đã ghi lại tín hiệu giọng nói 10s!");
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecordingBio(true);
      setRecordTimeLeft(10);

      bioTimerRef.current = setInterval(() => {
        setRecordTimeLeft(prev => {
          if (prev <= 1) {
            stopRecordingVoiceBio();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.warn("Lỗi Microphone:", err);
      toast.error("Vui lòng cấp quyền Microphone để ghi âm giọng nói!");
    }
  };

  const stopRecordingVoiceBio = () => {
    if (bioTimerRef.current) clearInterval(bioTimerRef.current);
    if (bioRecorderRef.current && bioRecorderRef.current.state === 'recording') {
      bioRecorderRef.current.stop();
    }
    setIsRecordingBio(false);
  };

  const togglePlayVoiceBio = () => {
    if (!voiceBioAudioRef.current) return;
    if (isPlayingVoiceBio) {
      voiceBioAudioRef.current.pause();
      setIsPlayingVoiceBio(false);
    } else {
      voiceBioAudioRef.current.currentTime = 0;
      voiceBioAudioRef.current.play().then(() => {
        setIsPlayingVoiceBio(true);
      }).catch(err => {
        console.warn("Không thể phát Voice Bio:", err);
      });
    }
  };

  const handleDeleteVoiceBio = () => {
    if (voiceBioAudioRef.current) {
      voiceBioAudioRef.current.pause();
    }
    setIsPlayingVoiceBio(false);
    setVoiceBioUrl(null);
    localStorage.removeItem(`voice_bio_${effectiveUserId}`);
    toast.success("Đã xóa tín hiệu giọng nói.");
  };

  // Thả tim bài viết
  const handleLikePost = async (postId) => {
    if (!postId) return;
    playHeartSound();
    setUserPosts(prev => prev.map(p => {
      if (String(p.id) !== String(postId)) return p;
      const wasLiked = p.isLikedByMe;
      return {
        ...p,
        isLikedByMe: !wasLiked,
        likesCount: wasLiked ? Math.max(0, (p.likesCount || 1) - 1) : (p.likesCount || 0) + 1
      };
    }));
    try {
      await axiosClient.post(`/posts/${postId}/like`, null, { params: { type: 'HEART' } });
    } catch (err) {
      console.warn("Lỗi like bài:", err);
    }
  };

  const { isUserOnline, getUserStatusText } = usePresence();
  const isOnline = isMe ? true : (isUserOnline(effectiveUserId) || Boolean(profile?.isOnline));
  const matchedTrack = dynamicTracks.find(t => String(t.id) === String(profile?.favoriteMusicId || editData.favoriteMusicId));
  const userGenre = matchedTrack ? `${matchedTrack.title} • ${matchedTrack.artist || matchedTrack.genreTag || 'Lo-Fi'}` : (dynamicTracks[0] ? `${dynamicTracks[0].title} • ${dynamicTracks[0].artist || 'Lo-Fi'}` : 'Chưa chọn gu âm nhạc');

  const matchedIntent = dynamicIntents.find(i => i.code === (profile?.matchIntentCode || editData.matchIntentCode));
  const userFreq = profile?.personalFrequency
    ? `${Number(profile.personalFrequency).toFixed(1)} MHz ${matchedIntent ? `• ${matchedIntent.title}` : ''}`
    : (editData.personalFrequency ? `${Number(editData.personalFrequency).toFixed(1)} MHz` : '96.4 MHz • Tần số cá nhân');

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans pb-28 selection:bg-emerald-500 selection:text-black">
      {/* Audio Element cho Voice Bio */}
      {voiceBioUrl && (
        <audio
          ref={voiceBioAudioRef}
          src={voiceBioUrl}
          onEnded={() => setIsPlayingVoiceBio(false)}
        />
      )}

      {/* TOP NAVBAR MINIMAL (SAFE AREA) */}
      <header 
        style={{ paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))' }}
        className="sticky top-0 z-40 bg-[#0c0d12]/90 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 pb-3.5"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-all active:scale-95 flex items-center gap-2 text-xs font-medium"
              title="Quay lại"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Quay lại</span>
            </button>
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-zinc-300" />
              <span className="text-sm font-bold text-white tracking-tight">Trạm Tần Số Cá Nhân</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMe && (profile?.roles?.some(r => r.includes('ADMIN') || r.includes('AMDIN')) || profile?.vipTier === 'ADMIN') && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
                title="Mở Bảng Quản Trị Hệ Thống"
              >
                <Shield size={13} />
                <span>Bảng Quản Trị</span>
              </button>
            )}
            {isMe && (
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/60 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
              >
                <LogOut size={13} />
                <span>Đăng xuất</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* BỐ CỤC 2 CỘT CHUẨN: MOBILE 1 CỘT -> DESKTOP 12 CỘT */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8 pb-24 md:pb-8">
        {loading && !profile ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-pulse">
            <aside className="lg:col-span-4 space-y-5">
              <div className="bg-zinc-900/60 border border-zinc-800/80 p-6 rounded-2xl space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-zinc-800" />
                  <div className="space-y-2 flex-1 pt-2">
                    <div className="h-5 w-32 bg-zinc-800 rounded-lg" />
                    <div className="h-3 w-20 bg-zinc-800/80 rounded" />
                  </div>
                </div>
                <div className="h-10 bg-zinc-800/60 rounded-xl" />
                <div className="h-16 bg-zinc-800/40 rounded-xl" />
              </div>
            </aside>
            <section className="lg:col-span-8 space-y-4">
              <div className="h-12 bg-zinc-900/60 border border-zinc-800/80 rounded-xl" />
              <div className="h-36 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl" />
              <div className="h-36 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl" />
            </section>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ============================================================== */}
          {/* CỘT TRÁI (lg:col-span-4): THẺ CĂN CƯỚC TẦN SỐ (AUDIO-FIRST ID) */}
          {/* ============================================================== */}
          <aside className="lg:col-span-4 lg:sticky lg:top-20 space-y-5">
            <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800/90 p-5 sm:p-6 rounded-2xl space-y-5 shadow-2xl">

              {/* Header thẻ: Avatar vuông bo góc + Chấm Online + Tên */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-start gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-24 h-24 rounded-[26px] overflow-hidden border-2 border-zinc-700/80 ring-4 ring-zinc-950 bg-zinc-950 shadow-lg relative">
                    <UserAvatar
                      user={isMe ? (currentUser || profile) : profile}
                      avatar={profile?.avatar || (isMe ? currentUser?.avatar : '')}
                      name={profile?.nickname || profile?.account || (isMe ? (currentUser?.displayName || currentUser?.account) : '')}
                      userId={effectiveUserId}
                      size={96}
                      className="w-full h-full rounded-[26px] object-cover"
                    />
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center rounded-[26px]">
                        <Loader2 size={24} className="animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  {/* Chấm Online / Offline */}
                  <span
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ring-4 ring-zinc-900 ${isOnline ? 'bg-emerald-500' : 'bg-zinc-600'
                      }`}
                    title={isOnline ? 'Đang trực tuyến' : 'Ngoại tuyến'}
                  />
                  {isMe && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -top-1.5 -right-1.5 p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 shadow-md active:scale-90 transition-all cursor-pointer"
                      title="Đổi ảnh đại diện"
                    >
                      <Camera size={12} strokeWidth={2.5} />
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileSelect}
                    className="hidden"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xl font-bold text-white tracking-tight truncate">
                      {profile?.nickname || profile?.account || 'Người dùng Talovin'}
                    </h2>
                    {(profile?.roles?.some(r => r.includes('ADMIN') || r.includes('AMDIN')) || profile?.vipTier === 'ADMIN') && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-zinc-400 mt-0.5">
                    @{profile?.account || 'user'}
                  </p>

                  {/* Trạng thái hoạt động thời gian thực */}
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs font-sans">
                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                    <span className={isOnline ? 'text-emerald-400 font-medium' : 'text-zinc-400'}>
                      {isMe ? 'Đang hoạt động' : getUserStatusText(effectiveUserId, profile?.lastActiveAt)}
                    </span>
                  </div>

                  {/* Tiểu sử */}
                  <p className="text-xs text-zinc-300 mt-2.5 leading-relaxed whitespace-pre-wrap">
                    {profile?.bio || (isMe ? 'Chưa cập nhật tiểu sử. Bấm nút dưới để viết đôi dòng giới thiệu.' : 'Người dùng này chưa cập nhật tiểu sử.')}
                  </p>

                  {/* Vị trí & Tuổi */}
                  <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-xs text-zinc-400">
                    {profile?.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} className="text-zinc-500" />
                        <span>{profile.location}</span>
                      </span>
                    )}
                    {profile?.age && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-zinc-500" />
                        <span>{profile.age} tuổi</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Hàng nút hành động (Touch-friendly h-10) */}
              <div>
                {!isMe ? (
                  <div>
                    {friendStatus === 'ACCEPTED' ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={handleUnfriend}
                          disabled={processingFriend}
                          className="h-10 rounded-xl bg-zinc-900 hover:bg-rose-500/10 text-zinc-300 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm group"
                          title="Bấm để hủy kết bạn"
                        >
                          <UserCheck size={14} className="text-emerald-400 group-hover:hidden" />
                          <UserMinus size={14} className="hidden group-hover:block" />
                          <span className="group-hover:hidden">Bạn bè</span>
                          <span className="hidden group-hover:inline">Hủy kết bạn</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleOpenDirectMessage}
                          className="h-10 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition-colors duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm"
                          title="Gửi tin nhắn trực tiếp"
                        >
                          <MessageSquare size={14} />
                          <span>Nhắn tin</span>
                        </button>
                      </div>
                    ) : friendStatus === 'PENDING_SENT' ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={handleCancelFriendRequest}
                          disabled={processingFriend}
                          className="h-10 rounded-xl bg-zinc-900 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm group"
                          title="Bấm để hủy lời mời đã gửi"
                        >
                          <Clock size={14} className="group-hover:hidden" />
                          <X size={14} className="hidden group-hover:block" />
                          <span className="group-hover:hidden">Đã gửi lời mời</span>
                          <span className="hidden group-hover:inline">Hủy lời mời</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleOpenDirectMessage}
                          className="h-10 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition-colors duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm"
                          title="Gửi tin nhắn trực tiếp"
                        >
                          <MessageSquare size={14} />
                          <span>Nhắn tin</span>
                        </button>
                      </div>
                    ) : friendStatus === 'PENDING_RECEIVED' ? (
                      <div className="space-y-2">
                        <div className="text-[11px] text-zinc-400 text-center font-medium">Người này đã gửi lời mời kết bạn</div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={handleAcceptFriendRequest}
                            disabled={processingFriend}
                            className="h-10 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                          >
                            <Check size={14} />
                            <span>Chấp nhận</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDeclineFriendRequest}
                            disabled={processingFriend}
                            className="h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                          >
                            <X size={14} />
                            <span>Từ chối</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={handleSendFriendRequest}
                          disabled={processingFriend}
                          className="h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 font-semibold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                          <UserPlus size={14} />
                          <span>{processingFriend ? '...' : 'Kết bạn'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleOpenDirectMessage}
                          className="h-10 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition-colors duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm"
                          title="Gửi tin nhắn trực tiếp"
                        >
                          <MessageSquare size={14} />
                          <span>Nhắn tin</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className="w-full h-11 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold text-xs transition-all active:scale-98 flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Edit3 size={15} />
                    <span>{isEditing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa tần số & Hồ sơ'}</span>
                  </button>
                )}
              </div>

              {/* KHỐI 1: TÍN HIỆU GIỌNG NÓI (VOICE BIO 10S) */}
              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 size={14} className="text-emerald-400" />
                    <span className="text-xs font-semibold text-zinc-200">Tín hiệu giọng nói (10s)</span>
                  </div>
                  {voiceBioUrl && (
                    <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      00:10
                    </span>
                  )}
                </div>

                {voiceBioUrl ? (
                  <div className="flex items-center gap-3 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/60">
                    <button
                      type="button"
                      onClick={togglePlayVoiceBio}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isPlayingVoiceBio
                        ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                        : 'bg-white text-black hover:bg-zinc-200'
                        }`}
                      title={isPlayingVoiceBio ? "Tạm dừng" : "Phát tín hiệu"}
                    >
                      {isPlayingVoiceBio ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                    </button>

                    {/* Dải sóng âm thanh Visualizer */}
                    <div className="flex-1 flex items-center gap-1 h-6 px-1">
                      {[35, 60, 85, 45, 95, 70, 50, 90, 65, 40, 80, 55].map((h, i) => (
                        <span
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-200 ${isPlayingVoiceBio
                            ? 'bg-emerald-400 animate-pulse'
                            : 'bg-zinc-700'
                            }`}
                          style={{
                            height: isPlayingVoiceBio ? `${Math.max(20, (h * Math.sin(i + 1)) % 100)}%` : `${h * 0.4}%`
                          }}
                        />
                      ))}
                    </div>

                    {isMe && (
                      <button
                        type="button"
                        onClick={handleDeleteVoiceBio}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                        title="Xóa tín hiệu giọng nói"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    {isMe ? (
                      <div>
                        {isRecordingBio ? (
                          <div className="flex items-center justify-between bg-rose-950/30 border border-rose-800/40 p-2.5 rounded-lg">
                            <div className="flex items-center gap-2 text-rose-400 text-xs font-mono">
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                              <span>Đang thu: {recordTimeLeft}s</span>
                            </div>
                            <button
                              type="button"
                              onClick={stopRecordingVoiceBio}
                              className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1"
                            >
                              <Square size={12} />
                              <span>Hoàn tất</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={startRecordingVoiceBio}
                            className="w-full py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-98"
                          >
                            <Mic size={14} className="text-emerald-400" />
                            <span>Ghi âm giới thiệu 10s</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 italic py-1 text-center">
                        Chưa phát tín hiệu giọng nói
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* KHỐI 2: BĂNG TẦN & GU NHẠC */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block px-1">
                  Băng Tần & Gu Âm Nhạc
                </span>

                <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-300">
                    <Headphones size={13} className="text-zinc-400 flex-shrink-0" />
                    <span className="truncate">{userGenre}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-200">
                    <Radio size={13} className="text-zinc-400 flex-shrink-0" />
                    <span className="truncate">{userFreq}</span>
                  </div>
                </div>
              </div>

            </div>
          </aside>

          {/* ============================================================== */}
          {/* CỘT PHẢI (lg:col-span-8): KHOẢNH KHẮC & KẾT NỐI */}
          {/* ============================================================== */}
          <section className="lg:col-span-8 space-y-4">

            {/* Thanh Tab dính: Đúng 2 tab tối giản có vùng chạm lớn */}
            <div className="sticky top-16 z-30 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800 flex items-center gap-8 px-2">
              <button
                type="button"
                onClick={() => setActiveTab('posts')}
                className={`py-3.5 text-sm font-medium transition-all relative flex items-center gap-2 ${activeTab === 'posts' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                <span>Khoảnh khắc & Tín hiệu</span>
                <span className="font-mono text-xs px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
                  {userPosts.length}
                </span>
                {activeTab === 'posts' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('friends')}
                className={`py-3.5 text-sm font-medium transition-all relative flex items-center gap-2 ${activeTab === 'friends' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                <span>Kết nối (Bạn bè)</span>
                <span className="font-mono text-xs px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
                  {userFriends.length}
                </span>
                {activeTab === 'friends' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                )}
              </button>
            </div>

            {/* NỘI DUNG TAB 1: KHOẢNH KHẮC & TÍN HIỆU */}
            {activeTab === 'posts' && (
              <div className="space-y-4">
                {loadingPosts ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-800/80 shrink-0" />
                          <div className="space-y-1.5 flex-1">
                            <div className="h-3.5 w-32 bg-zinc-800/80 rounded" />
                            <div className="h-2.5 w-20 bg-zinc-800/50 rounded" />
                          </div>
                        </div>
                        <div className="space-y-2 pt-1">
                          <div className="h-3 w-full bg-zinc-800/60 rounded" />
                          <div className="h-3 w-4/5 bg-zinc-800/50 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : userPosts.length === 0 ? (
                  /* Empty State chuẩn phong cách Trạm Tần Số */
                  <div className="py-20 px-4 text-center rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-900/20 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                      <AudioLines size={22} className="opacity-70" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-300">Chưa có tín hiệu nào</p>
                      <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">
                        {isMe
                          ? 'Bạn chưa đăng bài viết hoặc bản ghi âm nào lên sảnh trực tuyến. Hãy chia sẻ góc nhìn đầu tiên!'
                          : 'Người dùng này chưa phát tín hiệu hoặc bài viết nào.'}
                      </p>
                    </div>
                    {isMe && (
                      <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="mt-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-all active:scale-95"
                      >
                        Đến sảnh đăng bài
                      </button>
                    )}
                  </div>
                ) : (
                  /* Danh sách bài viết Dark Zinc */
                  userPosts.map(post => (
                    <article
                      key={post.id}
                      onClick={(e) => handlePostCardClick(e, post)}
                      className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 hover:bg-zinc-900 cursor-pointer transition-all space-y-3.5 shadow-sm"
                    >
                      {/* Header tác giả */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            user={isMe ? (currentUser || profile) : { avatar: post.authorAvatar, nickname: post.authorNickname, username: post.authorAccount, id: post.authorId }}
                            avatar={post.authorAvatar || profile?.avatar}
                            name={post.authorNickname || post.authorAccount || profile?.nickname || profile?.account}
                            userId={post.authorId || profile?.id}
                            size={38}
                            className="rounded-xl"
                          />
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {post.authorNickname || profile?.nickname || 'Người dùng'}
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400">
                              {post.formattedTime || TIME_FORMATTER(post.createdAt)}
                            </span>
                          </div>
                        </div>

                        {post.vibe && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {post.vibe}
                          </span>
                        )}
                      </div>

                      {/* Nội dung bài viết */}
                      <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                        {post.content}
                      </p>

                      {/* Media (Ảnh / Video / Voice) */}
                      {(() => {
                        const media = parsePostMedia(post.imageUrl, post);
                        if (!media.mediaUrl && !media.audioUrl) return null;
                        return (
                          <div className="space-y-2.5 my-2">
                            {media.mediaUrl && (
                              <div className="rounded-xl overflow-hidden border border-zinc-800" onClick={(e) => e.stopPropagation()}>
                                {media.mediaType === 'video' ? (
                                  <video src={media.mediaUrl} controls className="w-full max-h-[380px] object-cover" />
                                ) : (
                                  <img 
                                    src={media.mediaUrl} 
                                    alt="Khoảnh khắc" 
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    className="w-full max-h-[380px] object-cover" 
                                  />
                                )}
                              </div>
                            )}

                            {media.audioUrl && (
                              <div 
                                className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 shadow-sm flex items-center justify-between gap-3 group hover:border-zinc-700 transition-all"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTogglePlayPostVoice(post.id, media.audioUrl);
                                    }}
                                    className="w-10 h-10 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md transition-all"
                                    title={playingVoicePostId === post.id ? "Tạm dừng" : "Nghe ghi âm"}
                                  >
                                    {playingVoicePostId === post.id ? (
                                      <Pause size={16} className="fill-zinc-950" />
                                    ) : (
                                      <Play size={16} className="fill-zinc-950 ml-0.5" />
                                    )}
                                  </button>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <AudioLines size={14} className={playingVoicePostId === post.id ? "text-emerald-400 animate-pulse" : "text-zinc-500"} />
                                      <span className="text-xs font-semibold text-zinc-200 truncate">
                                        {playingVoicePostId === post.id ? "Đang phát giọng nói..." : "Ghi âm giọng nói"}
                                      </span>
                                    </div>
                                    <span className="text-[11px] font-mono text-zinc-500">
                                      {media.audioDuration ? `${media.audioDuration}s` : '00:15'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 text-zinc-600">
                                  <span className="w-1 h-3 rounded-full bg-zinc-700"></span>
                                  <span className="w-1 h-5 rounded-full bg-zinc-600"></span>
                                  <span className="w-1 h-2 rounded-full bg-zinc-700"></span>
                                  <span className="w-1 h-4 rounded-full bg-zinc-600"></span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Hàng tương tác */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs text-zinc-400">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLikePost(post.id);
                            }}
                            className={`flex items-center gap-1.5 transition-colors ${post.isLikedByMe ? 'text-rose-500 font-semibold' : 'hover:text-white'
                              }`}
                          >
                            <Heart size={15} className={post.isLikedByMe ? 'fill-rose-500 text-rose-500' : ''} />
                            <span>{post.likesCount || 0}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePostCardClick(e, post, true);
                            }}
                            className="flex items-center gap-1.5 hover:text-white transition-colors"
                            title="Xem thảo luận & phản hồi"
                          >
                            <MessageSquare size={15} />
                            <span>{post.commentsCount || 0}</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}

            {/* NỘI DUNG TAB 2: KẾT NỐI (BẠN BÈ) */}
            {activeTab === 'friends' && (
              <div>
                {loadingFriends ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-11 h-11 rounded-full bg-zinc-800/80 shrink-0" />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="h-3.5 w-28 bg-zinc-800/80 rounded" />
                            <div className="h-2.5 w-20 bg-zinc-800/50 rounded" />
                          </div>
                        </div>
                        <div className="w-16 h-8 rounded-xl bg-zinc-800/60 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : userFriends.length === 0 ? (
                  <div className="py-20 px-4 text-center rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-900/20 space-y-2">
                    <Users size={24} className="mx-auto text-zinc-500 opacity-60" />
                    <p className="text-sm font-semibold text-zinc-300">Chưa có kết nối nào</p>
                    <p className="text-xs text-zinc-500">Các người bạn cùng tần số sẽ xuất hiện tại đây.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {userFriends.map(friend => (
                      <div
                        key={friend.id}
                        className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex items-center justify-between gap-3"
                      >
                        <div
                          className="flex items-center gap-3 min-w-0 cursor-pointer"
                          onClick={() => navigate(`/profile/${friend.id}`)}
                        >
                          <UserAvatar avatar={friend.avatar} name={friend.nickname || friend.account} size={42} className="rounded-xl flex-shrink-0" />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate hover:underline">
                              {friend.nickname || friend.account || 'Thành viên'}
                            </h4>
                            <p className="text-[11px] font-mono text-zinc-400 truncate">
                              @{friend.account || 'user'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => navigate(`/profile/${friend.id}`)}
                          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-all active:scale-95 flex-shrink-0"
                        >
                          Hồ sơ
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </section>

        </div>
        )}
      </main>

      {/* MODAL CẬP NHẬT TẦN SỐ CÁ NHÂN & HỒ SƠ Ở GIỮA MÀN HÌNH (MAX-W-LG) */}
      {isMe && isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="w-full max-w-lg bg-zinc-900 border border-zinc-800/90 p-5 sm:p-6 rounded-2xl space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 size={15} className="text-zinc-300" />
                <span>Cập nhật tần số cá nhân</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-[11px] text-zinc-400 font-mono block mb-1">Tên hiển thị *</label>
                <input
                  type="text"
                  value={editData.nickname}
                  onChange={(e) => setEditData(prev => ({ ...prev, nickname: e.target.value }))}
                  className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 text-xs text-white focus:outline-none focus:border-zinc-600"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 font-mono block mb-1">Tiểu sử</label>
                <textarea
                  rows={3}
                  value={editData.bio}
                  onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Viết đôi dòng về năng lượng và tần số của bạn..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-zinc-600 resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 font-mono block mb-1">Tuổi</label>
                  <input
                    type="number"
                    value={editData.age}
                    onChange={(e) => setEditData(prev => ({ ...prev, age: e.target.value }))}
                    className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 text-xs text-white focus:outline-none focus:border-zinc-600 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 font-mono block mb-1">Vị trí / Khu vực</label>
                  <input
                    type="text"
                    value={editData.location}
                    onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="VD: TP. Hồ Chí Minh"
                    className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 text-xs text-white focus:outline-none focus:border-zinc-600"
                  />
                </div>
              </div>

              {/* THANH KÉO CHỌN TẦN SỐ ĐỊNH DANH FM (88.0 - 108.0 MHz) */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-zinc-400 font-mono">Tần số định danh FM riêng</label>
                  <button
                    type="button"
                    onClick={() => {
                      const rand = (88.0 + Math.random() * 20.0).toFixed(1);
                      setEditData(prev => ({ ...prev, personalFrequency: rand }));
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-mono transition-colors active:scale-95"
                  >
                    Ngẫu nhiên
                  </button>
                </div>

                <div className="text-center py-1">
                  <span className="text-3xl font-mono font-bold tabular-nums text-white tracking-tight">
                    {editData.personalFrequency || '96.4'} <span className="text-sm text-zinc-400 font-normal">MHz</span>
                  </span>
                </div>

                <input
                  type="range"
                  min="88.0"
                  max="108.0"
                  step="0.1"
                  value={editData.personalFrequency || '96.4'}
                  onChange={(e) => setEditData(prev => ({ ...prev, personalFrequency: e.target.value }))}
                  className="w-full accent-white h-2 bg-zinc-800 rounded-lg cursor-pointer"
                />

                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>88.0 MHz</span>
                  <span>98.0 MHz</span>
                  <span>108.0 MHz</span>
                </div>
              </div>

              {/* GU KẾT NỐI (matchIntentCode) - CUSTOM DROPDOWN DARK ZINC */}
              <div className="relative">
                <label className="text-[11px] text-zinc-400 font-mono block mb-1">Gu kết nối (Băng tần mục tiêu)</label>
                <button
                  type="button"
                  onClick={() => {
                    setOpenIntentDropdown(!openIntentDropdown);
                    setOpenMusicDropdown(false);
                  }}
                  className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 text-xs text-white flex items-center justify-between font-sans hover:border-zinc-700 transition-colors"
                >
                  <span className={editData.matchIntentCode ? 'text-zinc-100 font-medium' : 'text-zinc-500'}>
                    {dynamicIntents.find(it => it.code === editData.matchIntentCode)?.title || '-- Chọn gu kết nối --'}
                  </span>
                  <ChevronDown size={14} className={`text-zinc-400 transition-transform ${openIntentDropdown ? 'rotate-180' : ''}`} />
                </button>
                {openIntentDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-zinc-900 border border-zinc-800 rounded-xl py-1 shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
                    <div
                      onClick={() => {
                        setEditData(prev => ({ ...prev, matchIntentCode: '' }));
                        setOpenIntentDropdown(false);
                      }}
                      className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/80 cursor-pointer transition-colors"
                    >
                      -- Chọn gu kết nối --
                    </div>
                    {dynamicIntents.map(it => (
                      <div
                        key={it.code}
                        onClick={() => {
                          setEditData(prev => ({ ...prev, matchIntentCode: it.code }));
                          setOpenIntentDropdown(false);
                        }}
                        className={`px-3.5 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                          editData.matchIntentCode === it.code ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'
                        }`}
                      >
                        <span>{it.title}</span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {it.freqStart?.toFixed(1)} - {it.freqEnd?.toFixed(1)} MHz
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* KÊNH NHẠC LO-FI (favoriteMusicId) - CUSTOM DROPDOWN DARK ZINC */}
              <div className="relative">
                <label className="text-[11px] text-zinc-400 font-mono block mb-1">Kênh nhạc Lo-Fi yêu thích</label>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMusicDropdown(!openMusicDropdown);
                    setOpenIntentDropdown(false);
                  }}
                  className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 text-xs text-white flex items-center justify-between font-sans hover:border-zinc-700 transition-colors"
                >
                  <span className={editData.favoriteMusicId ? 'text-zinc-100 font-medium' : 'text-zinc-500'}>
                    {dynamicTracks.find(tr => String(tr.id) === String(editData.favoriteMusicId))?.title || '-- Chọn kênh nhạc Lo-Fi --'}
                  </span>
                  <ChevronDown size={14} className={`text-zinc-400 transition-transform ${openMusicDropdown ? 'rotate-180' : ''}`} />
                </button>
                {openMusicDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-zinc-900 border border-zinc-800 rounded-xl py-1 shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
                    <div
                      onClick={() => {
                        setEditData(prev => ({ ...prev, favoriteMusicId: null }));
                        setOpenMusicDropdown(false);
                      }}
                      className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/80 cursor-pointer transition-colors"
                    >
                      -- Chọn kênh nhạc Lo-Fi --
                    </div>
                    {dynamicTracks.map(tr => (
                      <div
                        key={tr.id}
                        onClick={() => {
                          setEditData(prev => ({ ...prev, favoriteMusicId: tr.id }));
                          setOpenMusicDropdown(false);
                        }}
                        className={`px-3.5 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                          String(editData.favoriteMusicId) === String(tr.id) ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'
                        }`}
                      >
                        <span>{tr.title}</span>
                        <span className="text-[11px] text-zinc-500 font-sans">{tr.artist || tr.genreTag || 'Lo-Fi'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="h-10 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 px-5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 shadow-sm flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-zinc-950" />
                      <span>Đang lưu thay đổi...</span>
                    </>
                  ) : (
                    <span>Lưu thay đổi</span>
                  )}
                </button>
              </div>
            </form>

            {/* Mở rộng đổi mật khẩu */}
            <div className="border-t border-zinc-800/80 pt-3">
              <button
                type="button"
                onClick={() => setShowPasswordSection(!showPasswordSection)}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <Lock size={12} />
                <span>{showPasswordSection ? 'Ẩn đổi mật khẩu' : 'Đổi mật khẩu tài khoản'}</span>
              </button>

              {showPasswordSection && (
                <form onSubmit={handleChangePassword} className="mt-3 space-y-2.5">
                  <input
                    type="password"
                    placeholder="Mật khẩu cũ"
                    value={passwordData.oldPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, oldPassword: e.target.value }))}
                    className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 text-xs text-white focus:outline-none"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 text-xs text-white focus:outline-none"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Xác nhận mật khẩu mới"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 text-xs text-white focus:outline-none"
                    required
                  />
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="w-full h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors active:scale-[0.98]"
                  >
                    {changingPassword ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN ĐĂNG XUẤT */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <LogOut size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Đăng xuất tài khoản?</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Bạn sẽ cần đăng nhập lại để tiếp tục kết nối các trạm tần số âm thanh.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  navigate('/login');
                }}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition-all active:scale-95"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT BÀI VIẾT TRÊN TRANG CÁ NHÂN */}
      {selectedDetailPost && (
        <div 
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-5 bg-black/80 backdrop-blur-md"
          onClick={() => setSelectedDetailPost(null)}
        >
          <div 
            className="relative w-full sm:w-[860px] lg:w-[940px] h-[100dvh] sm:h-[82vh] sm:max-h-[740px] sm:min-h-[560px] bg-zinc-950 border-0 sm:border border-zinc-800 sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800 bg-zinc-900/60 flex-shrink-0">
              <button 
                type="button"
                onClick={() => setSelectedDetailPost(null)}
                className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all active:scale-95 flex items-center gap-2 text-xs font-semibold"
                title="Quay lại"
              >
                <ArrowLeft size={18} />
                <span>Chi tiết bài viết</span>
              </button>

              <button 
                type="button"
                onClick={() => setSelectedDetailPost(null)}
                className="w-8 h-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                title="Đóng (ESC)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Layout nội dung: Mobile 1 cột cuộn; PC Dual-View 2 cột */}
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0 bg-zinc-950">
              {/* CỘT BÀI VIẾT CHÍNH (Mobile: phần trên; Desktop: 48% bên trái) */}
              <div className="w-full sm:w-[48%] flex flex-col border-b sm:border-b-0 sm:border-r border-zinc-800 p-5 overflow-y-auto space-y-4 bg-zinc-900/30">
                {/* Tác giả */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      avatar={selectedDetailPost.authorAvatar || profile?.avatar}
                      name={selectedDetailPost.authorNickname || profile?.nickname}
                      size={40}
                      className="rounded-xl"
                    />
                    <div>
                      <span className="text-sm font-bold text-white block">
                        {selectedDetailPost.authorNickname || profile?.nickname || 'Người dùng'}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        {selectedDetailPost.formattedTime || TIME_FORMATTER(selectedDetailPost.createdAt)}
                      </span>
                    </div>
                  </div>

                  {selectedDetailPost.vibe && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {selectedDetailPost.vibe}
                    </span>
                  )}
                </div>

                {/* Nội dung bài viết */}
                {selectedDetailPost.content && (selectedDetailPost.content.trim() !== 'Ghi âm giọng nói' || !parsePostMedia(selectedDetailPost.imageUrl, selectedDetailPost).audioUrl) && (
                  <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {selectedDetailPost.content}
                  </p>
                )}

                {/* Media (Ảnh / Video / Voice) */}
                {(() => {
                  const media = parsePostMedia(selectedDetailPost.imageUrl, selectedDetailPost);
                  if (!media.mediaUrl && !media.audioUrl) return null;
                  return (
                    <div className="space-y-3 my-2">
                      {media.mediaUrl && (
                        <div className="rounded-xl overflow-hidden border border-zinc-800">
                          {media.mediaType === 'video' ? (
                            <video src={media.mediaUrl} controls autoPlay loop playsInline className="w-full max-h-[340px] object-cover" />
                          ) : (
                            <img 
                              src={media.mediaUrl} 
                              alt="Khoảnh khắc" 
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              className="w-full max-h-[340px] object-cover" 
                            />
                          )}
                        </div>
                      )}

                      {/* Trình phát Voice Note */}
                      {media.audioUrl && (
                        <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-lg flex items-center gap-3.5">
                          <button
                            type="button"
                            onClick={() => handleTogglePlayPostVoice(selectedDetailPost.id, media.audioUrl)}
                            className="w-10 h-10 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md transition-all"
                            title={playingVoicePostId === selectedDetailPost.id ? "Tạm dừng" : "Nghe ghi âm"}
                          >
                            {playingVoicePostId === selectedDetailPost.id ? (
                              <Pause size={16} className="fill-zinc-950" />
                            ) : (
                              <Play size={16} className="fill-zinc-950 ml-0.5" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <Mic size={13} className="text-emerald-400" />
                                <span className="text-xs font-semibold text-zinc-200">
                                  {playingVoicePostId === selectedDetailPost.id ? "Đang phát giọng nói..." : "Tín hiệu giọng nói"}
                                </span>
                              </div>
                              <span className="text-xs font-mono tabular-nums text-zinc-400">
                                {media.audioDuration ? `00:${media.audioDuration < 10 ? `0${media.audioDuration}` : media.audioDuration}` : '00:15'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 h-4 overflow-hidden">
                              {[35, 70, 50, 90, 60, 85, 45, 100, 75, 80, 55, 95].map((h, idx) => (
                                <span
                                  key={idx}
                                  className={`w-1 rounded-full transition-all duration-200 ${
                                    playingVoicePostId === selectedDetailPost.id
                                      ? 'bg-emerald-400 animate-pulse'
                                      : 'bg-zinc-700'
                                  }`}
                                  style={{
                                    height: playingVoicePostId === selectedDetailPost.id ? `${Math.max(25, (h * ((idx % 3) + 1)) % 100)}%` : `${h * 0.4}%`
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
                <div className="flex items-center gap-4 py-2 text-xs text-zinc-400 border-y border-zinc-800">
                  <span><strong className="text-white font-mono">{selectedDetailPost.likesCount || 0}</strong> lượt thích</span>
                  <span>•</span>
                  <span><strong className="text-white font-mono">{selectedDetailPost.commentsCount || (detailCommentsMap[selectedDetailPost.id]?.length || 0)}</strong> phản hồi</span>
                </div>

                {/* Nút Like nhanh */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleLikePost(selectedDetailPost.id);
                      setSelectedDetailPost(prev => prev ? {
                        ...prev,
                        isLikedByMe: !prev.isLikedByMe,
                        likesCount: prev.isLikedByMe ? Math.max(0, (prev.likesCount || 0) - 1) : (prev.likesCount || 0) + 1
                      } : prev);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all active:scale-95 text-xs ${
                      selectedDetailPost.isLikedByMe
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 font-semibold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Heart size={15} className={selectedDetailPost.isLikedByMe ? 'fill-rose-500' : ''} />
                    <span>{selectedDetailPost.isLikedByMe ? 'Đã thích' : 'Thích bài viết'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('profile-detail-comment-input');
                      if (input) input.focus();
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white text-xs transition-all active:scale-95"
                  >
                    <MessageSquare size={15} />
                    <span>Viết phản hồi</span>
                  </button>
                </div>
              </div>

              {/* CỘT BÌNH LUẬN (Mobile: phần dưới; Desktop: 52% bên phải) */}
              <div className="w-full sm:w-[52%] flex flex-col flex-1 min-h-0 bg-zinc-950">
                <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between flex-shrink-0 bg-zinc-900/40">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-zinc-400" />
                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Dòng thảo luận ({detailCommentsMap[selectedDetailPost.id]?.length || selectedDetailPost.commentsCount || 0})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">Phản hồi phân cấp</span>
                </div>

                {/* Danh sách bình luận */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                  {(!detailCommentsMap[selectedDetailPost.id] || detailCommentsMap[selectedDetailPost.id].length === 0) ? (
                    <div className="py-12 text-center text-zinc-500 text-xs">
                      <MessageSquare size={20} className="mx-auto mb-2 opacity-40 text-zinc-600" />
                      Chưa có phản hồi nào. Hãy là người đầu tiên để lại suy nghĩ!
                    </div>
                  ) : (
                    detailCommentsMap[selectedDetailPost.id].map(cmt => (
                      <div key={cmt.id} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              avatar={cmt.authorAvatar}
                              name={cmt.authorNickname || cmt.authorAccount}
                              size={28}
                              className="rounded-lg"
                            />
                            <div>
                              <span className="text-xs font-semibold text-white block">
                                {cmt.authorNickname || cmt.authorAccount || 'Thành viên'}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400">
                                @{cmt.authorAccount || 'user'} • {cmt.formattedTime || TIME_FORMATTER(cmt.createdAt)}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleLikeDetailComment(selectedDetailPost.id, cmt.id)}
                            className={`flex items-center gap-1 text-[11px] transition-colors ${
                              cmt.isLiked ? 'text-rose-500 font-bold' : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <Heart size={12} className={cmt.isLiked ? 'fill-rose-500 text-rose-500' : ''} />
                            {Number(cmt.likesCount || 0) > 0 && <span className="font-mono">{cmt.likesCount}</span>}
                          </button>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed pl-9">
                          {cmt.replyToUser && (
                            <span className="text-sky-400 font-mono mr-1.5">@{cmt.replyToUser}</span>
                          )}
                          {cmt.content}
                        </p>

                        <div className="flex items-center gap-2 pl-9 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailReplyTarget({
                                commentId: cmt.id,
                                authorAccount: cmt.authorAccount || 'user',
                                authorNickname: cmt.authorNickname || cmt.authorAccount || 'Thành viên'
                              });
                              const input = document.getElementById('profile-detail-comment-input');
                              if (input) input.focus();
                            }}
                            className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                          >
                            <CornerDownRight size={11} />
                            <span>Trả lời</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Ô nhập bình luận ở đáy modal */}
                <div className="p-3.5 bg-zinc-900/90 border-t border-zinc-800 flex items-center gap-3 flex-shrink-0">
                  <div className="flex-1 min-w-0">
                    {detailReplyTarget && (
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-1 mb-1 border-b border-zinc-800">
                        <span>Đang trả lời <strong>@{detailReplyTarget.authorAccount}</strong></span>
                        <button
                          type="button"
                          onClick={() => setDetailReplyTarget(null)}
                          className="text-zinc-400 hover:text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    <input
                      id="profile-detail-comment-input"
                      type="text"
                      value={detailCommentInput}
                      onChange={(e) => setDetailCommentInput(e.target.value)}
                      placeholder={`Phản hồi bài viết của @${selectedDetailPost.authorAccount || profile?.account || 'user'}...`}
                      className="w-full bg-transparent border-none text-xs text-white focus:outline-none placeholder-zinc-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddDetailComment(selectedDetailPost.id);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddDetailComment(selectedDetailPost.id)}
                    disabled={submittingDetailComment || !detailCommentInput.trim()}
                    className="px-4 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-all disabled:opacity-40 disabled:hover:bg-white active:scale-95 flex items-center gap-1.5 flex-shrink-0"
                  >
                    <span>{submittingDetailComment ? 'Đang gửi...' : 'Đăng'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* THANH ĐIỀU HƯỚNG DÀNH CHO MOBILE (5 TAB CHUẨN THỰC DỤNG) */}
      <MobileBottomNav activeTab="profile" />
    </div>
  );
};

export default ProfilePage;
