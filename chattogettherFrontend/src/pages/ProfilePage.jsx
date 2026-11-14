import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit3, LogOut, UserPlus, UserCheck, Clock, 
  MapPin, Calendar, Mail, Phone, PhoneCall, Lock, Check, X, 
  Camera, Upload, Trash2, Heart, MessageSquare, Share2, 
  Shield, Sparkles, Loader2, Users, Radio, Headphones, 
  Mic, Play, Pause, Square, RotateCcw, AudioLines, Volume2, 
  VolumeX, Music, Tag
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import TalovinLogo from '../components/TalovinLogo';
import { UserAvatar, playHeartSound } from './Home';

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
  const navigate = useNavigate();

  const currentUserId = localStorage.getItem('user_id');
  const effectiveUserId = userId || currentUserId;
  const isMe = Boolean(currentUserId && String(effectiveUserId) === String(currentUserId));

  // States
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'friends'
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dữ liệu bài viết, bạn bè
  const [userPosts, setUserPosts] = useState([]);
  const [userFriends, setUserFriends] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Trạng thái kết bạn (nếu xem người khác)
  const [friendStatus, setFriendStatus] = useState('NONE'); // 'NONE' | 'PENDING_SENT' | 'ACCEPTED'
  const [processingFriend, setProcessingFriend] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Voice Bio 10s State
  const [voiceBioUrl, setVoiceBioUrl] = useState(() => {
    return localStorage.getItem(`voice_bio_${effectiveUserId}`) || null;
  });
  const [isPlayingVoiceBio, setIsPlayingVoiceBio] = useState(false);
  const [isRecordingBio, setIsRecordingBio] = useState(false);
  const [recordTimeLeft, setRecordTimeLeft] = useState(10);
  const [tempBioBlob, setTempBioBlob] = useState(null);

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
    favoriteGenre: '',
    favoriteFreq: '',
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
      }).catch(() => {});
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
        const storedGenre = localStorage.getItem(`user_genre_${effectiveUserId}`) || '';
        const storedFreq = localStorage.getItem(`user_freq_${effectiveUserId}`) || '';
        
        setEditData({
          nickname: data.nickname || '',
          age: data.age || '',
          location: data.location || '',
          bio: data.bio || '',
          favoriteGenre: data.favoriteGenre || storedGenre,
          favoriteFreq: data.favoriteFreq || storedFreq,
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

  // 3. Nạp danh sách bạn bè
  const fetchUserFriends = useCallback(async () => {
    try {
      setLoadingFriends(true);
      const res = await axiosClient.get('/friends/list');
      if (res.data?.data) {
        setUserFriends(res.data.data);
        if (!isMe && effectiveUserId) {
          const isFriend = res.data.data.some(f => String(f.id) === String(effectiveUserId));
          if (isFriend) setFriendStatus('ACCEPTED');
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

  // Xử lý nén ảnh đại diện WebP
  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Vui lòng chọn tệp hình ảnh hợp lệ");
      return;
    }

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
        const webpData = canvas.toDataURL('image/webp', 0.85);
        setEditData(prev => ({ ...prev, avatar: webpData }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
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
        avatar: editData.avatar || null
      };

      const res = await axiosClient.put('/users/profile', payload);
      if (res.data?.data) {
        setProfile(prev => ({
          ...prev,
          ...res.data.data,
          favoriteGenre: editData.favoriteGenre,
          favoriteFreq: editData.favoriteFreq
        }));
        if (payload.nickname) localStorage.setItem('nickname', payload.nickname);
        if (payload.avatar) localStorage.setItem('user_avatar', payload.avatar);
      }
      localStorage.setItem(`user_genre_${effectiveUserId}`, editData.favoriteGenre);
      localStorage.setItem(`user_freq_${effectiveUserId}`, editData.favoriteFreq);

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

  // Gửi lời mời kết bạn
  const handleSendFriendRequest = async () => {
    if (!effectiveUserId) return;
    setProcessingFriend(true);
    try {
      await axiosClient.post(`/friends/request/${effectiveUserId}`);
      setFriendStatus('PENDING_SENT');
      toast.success("Đã gửi lời mời kết nối tần số!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi yêu cầu!");
    } finally {
      setProcessingFriend(false);
    }
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

  const isOnline = Boolean(profile?.isOnline ?? true);
  const userGenre = editData.favoriteGenre || (dynamicTracks[0] ? `${dynamicTracks[0].title} • ${dynamicTracks[0].artist || dynamicTracks[0].genreTag || 'Lo-Fi'}` : 'Chưa chọn gu âm nhạc');
  const userFreq = editData.favoriteFreq || (dynamicIntents[0] ? `${dynamicIntents[0].freqStart?.toFixed(1)} - ${dynamicIntents[0].freqEnd?.toFixed(1)} MHz • ${dynamicIntents[0].title}` : 'Chưa chọn băng tần');

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

      {/* TOP NAVBAR MINIMAL */}
      <header className="sticky top-0 z-40 bg-[#0c0d12]/90 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => navigate('/')}
              className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-all active:scale-95 flex items-center gap-2 text-xs font-medium"
              title="Quay lại sảnh chính"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Quay lại sảnh</span>
            </button>
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-emerald-400" />
              <span className="text-sm font-bold text-white tracking-tight">Trạm Tần Số Cá Nhân</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ============================================================== */}
          {/* CỘT TRÁI (lg:col-span-4): THẺ CĂN CƯỚC TẦN SỐ (AUDIO-FIRST ID) */}
          {/* ============================================================== */}
          <aside className="lg:col-span-4 lg:sticky lg:top-20 space-y-5">
            <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800/90 p-5 sm:p-6 rounded-2xl space-y-5 shadow-2xl">
              
              {/* Header thẻ: Avatar vuông bo góc + Chấm Online + Tên */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-start gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-zinc-700/80 bg-zinc-950 shadow-lg">
                    <UserAvatar 
                      avatar={profile?.avatar} 
                      name={profile?.nickname || profile?.account} 
                      size={96} 
                      className="w-full h-full rounded-2xl object-cover" 
                    />
                  </div>
                  {/* Chấm Online / Offline */}
                  <span 
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ring-4 ring-zinc-900 ${
                      isOnline ? 'bg-emerald-500' : 'bg-zinc-600'
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
                    {profile?.roles?.includes('ROLE_ADMIN') && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-zinc-400 mt-0.5">
                    @{profile?.account || 'user'}
                  </p>
                  
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

              {/* Hàng nút hành động (Touch-friendly h-11) */}
              <div>
                {!isMe ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {friendStatus === 'ACCEPTED' ? (
                      <div className="h-11 rounded-xl bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center justify-center gap-1.5 select-none">
                        <UserCheck size={15} className="text-emerald-400" />
                        <span>Bạn bè</span>
                      </div>
                    ) : friendStatus === 'PENDING_SENT' ? (
                      <div className="h-11 rounded-xl bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-semibold flex items-center justify-center gap-1.5 select-none">
                        <Clock size={15} />
                        <span>Đã gửi lời mời</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendFriendRequest}
                        disabled={processingFriend}
                        className="h-11 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                      >
                        <UserPlus size={15} />
                        <span>{processingFriend ? 'Đang gửi...' : 'Kết bạn'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => navigate(`/messages/${targetUserId}`)}
                      className="h-10 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition-colors duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm"
                      title="Nhắn tin riêng 1-1 với người này"
                    >
                      <MessageSquare size={14} />
                      <span>Nhắn tin riêng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/call/direct/${targetUserId}?type=audio`)}
                      className="h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium text-xs transition-colors duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5"
                      title="Gọi ngay với người này"
                    >
                      <PhoneCall size={14} className="text-zinc-300" />
                      <span>Gọi ngay</span>
                    </button>
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
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        isPlayingVoiceBio 
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
                          className={`flex-1 rounded-full transition-all duration-200 ${
                            isPlayingVoiceBio 
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

                <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-300">
                    <Headphones size={13} className="text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{userGenre}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                    <Radio size={13} className="text-emerald-400 flex-shrink-0" />
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
                className={`py-3.5 text-sm font-medium transition-all relative flex items-center gap-2 ${
                  activeTab === 'posts' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
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
                className={`py-3.5 text-sm font-medium transition-all relative flex items-center gap-2 ${
                  activeTab === 'friends' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
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
                  <div className="py-20 text-center text-zinc-500 flex flex-col items-center gap-3">
                    <Loader2 size={24} className="animate-spin text-zinc-400" />
                    <span className="text-xs">Đang đồng bộ khoảnh khắc từ tần số...</span>
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
                      className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-3.5 shadow-sm"
                    >
                      {/* Header tác giả */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <UserAvatar 
                            avatar={post.authorAvatar || profile?.avatar} 
                            name={post.authorNickname || profile?.nickname} 
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
                      {post.imageUrl && (
                        <div className="rounded-xl overflow-hidden border border-zinc-800 my-2">
                          {post.imageUrl.includes('.mp4') || post.imageUrl.includes('video') ? (
                            <video src={post.imageUrl} controls className="w-full max-h-[380px] object-cover" />
                          ) : (
                            <img src={post.imageUrl} alt="Post media" className="w-full max-h-[380px] object-cover" />
                          )}
                        </div>
                      )}

                      {/* Hàng tương tác (Ẩn khung bình luận mặc định) */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs text-zinc-400">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => handleLikePost(post.id)}
                            className={`flex items-center gap-1.5 transition-colors ${
                              post.isLikedByMe ? 'text-rose-500 font-semibold' : 'hover:text-white'
                            }`}
                          >
                            <Heart size={15} className={post.isLikedByMe ? 'fill-rose-500 text-rose-500' : ''} />
                            <span>{post.likesCount || 0}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="flex items-center gap-1.5 hover:text-white transition-colors"
                            title="Xem thảo luận tại sảnh chính"
                          >
                            <MessageSquare size={15} />
                            <span>{post.commentsCount || 0}</span>
                          </button>
                        </div>

                        <span className="font-mono text-[10px] text-zinc-400">Talovin Signal</span>
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
                  <div className="py-20 text-center text-zinc-500 flex flex-col items-center gap-3">
                    <Loader2 size={24} className="animate-spin text-zinc-400" />
                    <span className="text-xs">Đang tải danh sách kết nối...</span>
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
      </main>

      {/* MODAL CẬP NHẬT TẦN SỐ CÁ NHÂN & HỒ SƠ Ở GIỮA MÀN HÌNH (MAX-W-LG) */}
      {isMe && isEditing && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setIsEditing(false)}
        >
          <div 
            className="w-full max-w-lg bg-zinc-900 border border-zinc-800/90 p-5 sm:p-6 rounded-2xl space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
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

              <div>
                <label className="text-[11px] text-zinc-400 font-mono block mb-1">Kênh nhạc Lo-Fi yêu thích</label>
                <select
                  value={editData.favoriteGenre}
                  onChange={(e) => setEditData(prev => ({ ...prev, favoriteGenre: e.target.value }))}
                  className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-zinc-600"
                >
                  {dynamicTracks.length > 0 ? (
                    dynamicTracks.map((tr) => {
                      const val = `${tr.title} • ${tr.artist || tr.genreTag || 'Lo-Fi'}`;
                      return (
                        <option key={tr.id || tr.title} value={val} className="bg-zinc-900 text-white">
                          {val}
                        </option>
                      );
                    })
                  ) : (
                    <option value="" className="bg-zinc-900 text-zinc-500">Chưa có kênh nhạc từ hệ thống</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 font-mono block mb-1">Băng tần thường tham gia</label>
                <select
                  value={editData.favoriteFreq}
                  onChange={(e) => setEditData(prev => ({ ...prev, favoriteFreq: e.target.value }))}
                  className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-zinc-600 font-mono"
                >
                  {dynamicIntents.length > 0 ? (
                    dynamicIntents.map((it) => {
                      const val = `${it.freqStart?.toFixed(1)} - ${it.freqEnd?.toFixed(1)} MHz • ${it.title}`;
                      return (
                        <option key={it.id || it.code} value={val} className="bg-zinc-900 text-white">
                          {val}
                        </option>
                      );
                    })
                  ) : (
                    <option value="" className="bg-zinc-900 text-zinc-500">Chưa có băng tần từ hệ thống</option>
                  )}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800/80">
                <button 
                  type="button" 
                  onClick={() => setIsEditing(false)} 
                  className="h-9 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="h-9 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 shadow-sm"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
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
    </div>
  );
};

export default ProfilePage;
