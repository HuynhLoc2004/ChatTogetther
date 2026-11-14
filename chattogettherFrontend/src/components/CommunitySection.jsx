import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Plus, Search, Shield, Crown, CheckCircle2, XCircle, 
  Settings, LogOut, Trash2, Camera, Lock, Globe, FileText, ChevronRight, ChevronDown, X,
  ArrowLeft, MessageSquare, PhoneCall, Radio, Send, Image as ImageIcon,
  Heart, MessageCircle, Sparkles, Flame, Check, CornerDownRight, Play, Pause,
  Volume2, Share2, MoreVertical, UserPlus, Flag, Mic, Square, RotateCcw, Star,
  Sliders, Edit3, AlertTriangle, Layers, Pin
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import GroupCollageAvatar from './GroupCollageAvatar';
import toast from 'react-hot-toast';

const DEFAULT_REJECT_REASONS = [
  { id: 'SPAM', label: 'Spam / Quảng cáo / Tin rác' },
  { id: 'RULE_VIOLATION', label: 'Vi phạm quy định & nội quy cộng đồng' },
  { id: 'OFF_TOPIC', label: 'Lạc đề / Không phù hợp với chủ đề nhóm' },
  { id: 'INAPPROPRIATE', label: 'Ngôn từ thù địch / Phản cảm / Độc hại' },
  { id: 'COPYRIGHT', label: 'Vi phạm bản quyền nội dung / hình ảnh' }
];

export const CommunitySection = ({ 
  currentUserId, 
  currentUserName, 
  currentUserAvatar = '',
  posts = [],
  setPosts,
  rooms = [],
  friends = [],
  navigate,
  onSelectUser,
  onStartPrivateCall,
  onNavigateFeed 
}) => {
  const safeAvatar = currentUserAvatar || localStorage.getItem('user_avatar') || '';
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [categories, setCategories] = useState([]);

  // Nhóm đang mở xem chi tiết
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('feed'); // 'feed' | 'voice' | 'members' | 'settings'

  // Phê duyệt thành viên & Duyệt bài viết
  const [pendingMembers, setPendingMembers] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [loadingPendingPosts, setLoadingPendingPosts] = useState(false);
  const [groupDedicatedPosts, setGroupDedicatedPosts] = useState([]);

  // Modal Từ chối bài viết kèm lý do
  const [rejectModalPost, setRejectModalPost] = useState(null);
  const [selectedRejectReason, setSelectedRejectReason] = useState('SPAM');
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [systemRejectReasons, setSystemRejectReasons] = useState(DEFAULT_REJECT_REASONS);
  const [isRejecting, setIsRejecting] = useState(false);

  // Modal Mời bạn bè
  const [isInviteFriendsOpen, setIsInviteFriendsOpen] = useState(false);
  const [invitingFriendId, setInvitingFriendId] = useState(null);

  // Ghi âm 15s giọng nói vào bài viết thảo luận (Audio-First)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voiceBase64, setVoiceBase64] = useState(null);
  const [isPlayingRecordedVoice, setIsPlayingRecordedVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const voiceTimerRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const recordedAudioRef = useRef(null);

  // Modal Báo cáo cộng đồng vi phạm
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('SPAM');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Tab Quản trị nhóm 2 cột
  const [adminSubTab, setAdminSubTab] = useState('members_queue'); // 'members_queue' | 'posts_queue'
  const [editGroupForm, setEditGroupForm] = useState({
    name: '',
    description: '',
    categoryCode: 'general',
    categoryId: null,
    avatarUrl: '',
    coverUrl: ''
  });
  const [isSavingGroupInfo, setIsSavingGroupInfo] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Soạn bài viết thảo luận trong nhóm
  const [groupPostText, setGroupPostText] = useState('');
  const [groupAttachedImage, setGroupAttachedImage] = useState(null);
  const [isPostingGroup, setIsPostingGroup] = useState(false);
  const [activePostCommentId, setActivePostCommentId] = useState(null);
  const [commentTextMap, setCommentTextMap] = useState({});

  // Modal Tạo cộng đồng
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    rules: '',
    categoryCode: 'general',
    categoryId: null,
    coverUrl: '',
    avatarUrl: '',
    isPrivate: false,
    requiresApproval: false
  });
  const [isCreateCategoryDropdownOpen, setIsCreateCategoryDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chỉnh sửa quy định
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [editRulesText, setEditRulesText] = useState('');

  // Lấy 2 chữ cái đầu làm avatar nếu chưa có ảnh
  const getInitials = (name) => {
    if (!name) return 'CĐ';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Nạp danh mục động từ Backend API (Zero Hardcode)
  const fetchCategories = async () => {
    try {
      const res = await axiosClient.get('/communities/categories');
      if (res.data?.data && Array.isArray(res.data.data)) {
        setCategories(res.data.data);
      }
    } catch (err) {
      console.warn("Lỗi nạp danh mục cộng đồng động:", err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Nạp danh sách cộng đồng (Hỗ trợ overview 2 mục & tìm kiếm)
  const fetchGroups = async (kw = '') => {
    try {
      setLoading(true);
      if (!kw.trim()) {
        try {
          const resOverview = await axiosClient.get('/groups/overview');
          if (resOverview.data?.data) {
            const joined = resOverview.data.data.joinedCommunities || [];
            const suggested = resOverview.data.data.suggestedCommunities || [];
            setGroups([...joined, ...suggested]);
            return;
          }
        } catch (overviewErr) {
          console.warn("Lỗi gọi /groups/overview, dùng fallback /groups:", overviewErr);
        }
      }

      const res = await axiosClient.get('/groups', {
        params: kw.trim() ? { keyword: kw.trim() } : {}
      });
      if (res.data && Array.isArray(res.data.data)) {
        setGroups(res.data.data);
      } else {
        setGroups([]);
      }
    } catch (err) {
      console.warn("Lỗi nạp danh sách cộng đồng:", err);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups(searchKeyword);
  }, [searchKeyword]);

  // Nạp chi tiết nhóm theo ID (hỗ trợ điều hướng URL /communities/:id)
  const handleOpenGroupById = async (groupId) => {
    if (!groupId) return;
    try {
      setLoadingDetail(true);
      const res = await axiosClient.get(`/groups/${groupId}`);
      if (res.data && res.data.data) {
        const g = res.data.data;
        setSelectedGroup(g);
        setGroupDetail(g);
        setActiveWorkspaceTab('feed');
        fetchGroupDedicatedPosts(g.id);
        setEditGroupForm({
          name: g.name || '',
          description: g.description || '',
          categoryCode: g.categoryCode || 'general',
          categoryId: g.categoryId || null,
          avatarUrl: g.avatarUrl || '',
          coverUrl: g.coverUrl || ''
        });
        setEditRulesText(g.rules || '');
        if (['OWNER', 'DEPUTY'].includes(g.currentUserRole)) {
          fetchPendingMembers(g.id);
          fetchPendingPosts(g.id);
        }
      }
    } catch (err) {
      console.warn("Lỗi nạp chi tiết nhóm theo URL:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Kiểm tra URL khi mount hoặc đổi path để mở đúng nhóm
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/(?:communities|groups)\/(\d+)/);
      if (match && match[1]) {
        const targetId = Number(match[1]);
        if (!selectedGroup || selectedGroup.id !== targetId) {
          handleOpenGroupById(targetId);
        }
      }
    }
  }, []);

  // Mở không gian cộng đồng chi tiết
  const handleOpenGroup = async (group) => {
    if (!group) return;
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/communities/${group.id}`);
    }
    setSelectedGroup(group);
    setActiveWorkspaceTab('feed');
    fetchGroupDedicatedPosts(group.id);
    setEditGroupForm({
      name: group.name || '',
      description: group.description || '',
      categoryCode: group.categoryCode || 'general',
      categoryId: group.categoryId || null,
      avatarUrl: group.avatarUrl || '',
      coverUrl: group.coverUrl || ''
    });

    try {
      setLoadingDetail(true);
      const res = await axiosClient.get(`/groups/${group.id}`);
      if (res.data && res.data.data) {
        setGroupDetail(res.data.data);
        setEditRulesText(res.data.data.rules || '');
        if (['OWNER', 'DEPUTY'].includes(res.data.data.currentUserRole)) {
          fetchPendingMembers(group.id);
          fetchPendingPosts(group.id);
        }
      }
    } catch (err) {
      console.warn("Lỗi tải chi tiết cộng đồng:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Trở lại danh sách cộng đồng
  const handleBackToList = () => {
    setSelectedGroup(null);
    setGroupDetail(null);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/communities');
    }
    fetchGroups(searchKeyword);
  };

  // Nạp cấu hình lý do từ chối động từ hệ thống
  useEffect(() => {
    const fetchRejectReasons = async () => {
      try {
        const res = await axiosClient.get('/system/config');
        if (res.data?.data?.reject_reasons) {
          const parsed = JSON.parse(res.data.data.reject_reasons);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSystemRejectReasons(parsed);
          }
        }
      } catch (e) {}
    };
    fetchRejectReasons();
  }, []);

  const fetchGroupDedicatedPosts = async (groupId) => {
    try {
      const res = await axiosClient.get(`/posts/group/${groupId}?status=APPROVED`);
      if (res.data?.data) {
        setGroupDedicatedPosts(res.data.data);
      }
    } catch (e) {}
  };

  const fetchPendingPosts = async (groupId) => {
    try {
      setLoadingPendingPosts(true);
      const res = await axiosClient.get(`/posts/group/${groupId}?status=PENDING`);
      if (res.data?.data) {
        setPendingPosts(res.data.data);
      }
    } catch (e) {
      setPendingPosts([]);
    } finally {
      setLoadingPendingPosts(false);
    }
  };

  const handleApprovePost = async (postId) => {
    try {
      await axiosClient.post(`/posts/${postId}/approve`);
      toast.success("Đã phê duyệt bài viết thành công!");
      if (selectedGroup) {
        fetchPendingPosts(selectedGroup.id);
        fetchGroupDedicatedPosts(selectedGroup.id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi duyệt bài viết");
    }
  };

  const handleRejectPostOpen = (post) => {
    setRejectModalPost(post);
    setSelectedRejectReason(systemRejectReasons[0]?.id || 'SPAM');
    setCustomRejectReason('');
  };

  const handleConfirmRejectPost = async () => {
    if (!rejectModalPost) return;
    try {
      setIsRejecting(true);
      const reasonLabel = selectedRejectReason === 'CUSTOM'
        ? (customRejectReason.trim() || 'Không phù hợp với nội quy cộng đồng')
        : (systemRejectReasons.find(r => r.id === selectedRejectReason)?.label || selectedRejectReason);

      await axiosClient.post(`/posts/${rejectModalPost.id}/reject`, { reason: reasonLabel });
      toast.success("Đã từ chối bài viết");
      setRejectModalPost(null);
      if (selectedGroup) {
        fetchPendingPosts(selectedGroup.id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi từ chối bài viết");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleInviteFriend = async (friendUserId) => {
    if (!selectedGroup) return;
    try {
      setInvitingFriendId(friendUserId);
      const res = await axiosClient.post(`/groups/${selectedGroup.id}/invite/${friendUserId}`);
      toast.success(res.data?.message || "Đã mời bạn bè tham gia cộng đồng!");
      handleOpenGroup(selectedGroup);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể mời bạn bè vào cộng đồng lúc này");
    } finally {
      setInvitingFriendId(null);
    }
  };

  const fetchPendingMembers = async (groupId) => {
    try {
      setLoadingPending(true);
      const res = await axiosClient.get(`/groups/${groupId}/pending`);
      if (res.data && res.data.data) {
        setPendingMembers(res.data.data);
      }
    } catch (err) {
      // Ignored if forbidden
    } finally {
      setLoadingPending(false);
    }
  };

  // Gia nhập cộng đồng
  const handleJoinGroup = async (groupId, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await axiosClient.post(`/groups/${groupId}/join`);
      const status = res.data?.data;
      if (status === 'PENDING') {
        toast.success("Đã gửi yêu cầu gia nhập, vui lòng chờ Ban quản trị duyệt!");
      } else {
        toast.success("Chúc mừng bạn đã gia nhập cộng đồng!");
      }
      fetchGroups(searchKeyword);
      if (selectedGroup && selectedGroup.id === groupId) {
        handleOpenGroup(selectedGroup);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gia nhập cộng đồng");
    }
  };

  // Rời cộng đồng
  const handleLeaveGroup = async (groupId, e) => {
    if (e) e.stopPropagation();
    try {
      await axiosClient.post(`/groups/${groupId}/leave`);
      toast.success("Đã rời khỏi cộng đồng");
      fetchGroups(searchKeyword);
      if (selectedGroup && selectedGroup.id === groupId) {
        handleBackToList();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi rời nhóm");
    }
  };

  // Phê duyệt thành viên
  const handleApproveMember = async (targetUserId) => {
    if (!selectedGroup) return;
    try {
      await axiosClient.post(`/groups/${selectedGroup.id}/approve/${targetUserId}`);
      toast.success("Đã phê duyệt thành viên mới!");
      fetchPendingMembers(selectedGroup.id);
      handleOpenGroup(selectedGroup);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể duyệt thành viên");
    }
  };

  // Từ chối thành viên
  const handleRejectMember = async (targetUserId) => {
    if (!selectedGroup) return;
    try {
      await axiosClient.post(`/groups/${selectedGroup.id}/reject/${targetUserId}`);
      toast.success("Đã từ chối yêu cầu");
      fetchPendingMembers(selectedGroup.id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể từ chối");
    }
  };

  // Phân quyền
  const handleSetRole = async (targetUserId, newRole) => {
    if (!selectedGroup) return;
    try {
      await axiosClient.post(`/groups/${selectedGroup.id}/set-role`, {
        userId: targetUserId,
        role: newRole
      });
      toast.success(`Đã cập nhật chức vụ thành: ${newRole === 'DEPUTY' ? 'Phó nhóm' : 'Thành viên'}`);
      handleOpenGroup(selectedGroup);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật quyền");
    }
  };

  // Chặn thành viên khỏi cộng đồng
  const handleBanMember = async (targetUserId) => {
    if (!selectedGroup) return;
    if (!window.confirm("Bạn có chắc chắn muốn chặn thành viên này? Họ sẽ không thể đăng bài hoặc bình luận trong nhóm.")) return;
    try {
      await axiosClient.post(`/groups/${selectedGroup.id}/ban/${targetUserId}`);
      toast.success("Đã chặn thành viên khỏi cộng đồng!");
      handleOpenGroup(selectedGroup);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể chặn thành viên");
    }
  };

  // Gỡ chặn thành viên
  const handleUnbanMember = async (targetUserId) => {
    if (!selectedGroup) return;
    try {
      await axiosClient.post(`/groups/${selectedGroup.id}/unban/${targetUserId}`);
      toast.success("Đã gỡ chặn thành viên!");
      handleOpenGroup(selectedGroup);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gỡ chặn thành viên");
    }
  };

  // Lưu quy định
  const handleSaveRules = async () => {
    if (!selectedGroup) return;
    try {
      await axiosClient.put(`/groups/${selectedGroup.id}`, {
        rules: editRulesText
      });
      toast.success("Đã lưu quy định cộng đồng!");
      setIsEditingRules(false);
      handleOpenGroup(selectedGroup);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể lưu quy định");
    }
  };

  // Tạo cộng đồng mới
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.error("Vui lòng nhập tên cộng đồng");
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await axiosClient.post('/groups', createForm);
      toast.success("Đã tạo cộng đồng thành công!");
      setIsCreateOpen(false);
      setCreateForm({
        name: '',
        description: '',
        rules: '',
        categoryCode: 'general',
        categoryId: null,
        coverUrl: '',
        avatarUrl: '',
        isPrivate: false,
        requiresApproval: false
      });
      fetchGroups();
      if (res.data && res.data.data) {
        handleOpenGroup(res.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi tạo cộng đồng");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Giải tán cộng đồng
  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    if (!window.confirm(`Bạn có chắc chắn muốn giải tán cộng đồng "${selectedGroup.name}"? Toàn bộ bài thảo luận và dữ liệu liên quan sẽ bị xóa vĩnh viễn.`)) return;
    try {
      await axiosClient.delete(`/groups/${selectedGroup.id}`);
      toast.success("Đã giải tán cộng đồng");
      handleBackToList();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể giải tán cộng đồng");
    }
  };

  // ==========================================
  // AUDIO-FIRST: GHI ÂM 15S CHO THẢO LUẬN NHÓM
  // ==========================================
  const startRecordingVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setVoiceBase64(reader.result);
          toast.success("Đã ghi lại giọng nói 15s sẵn sàng đính kèm!");
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecordingVoice(true);
      setVoiceDuration(0);

      voiceTimerRef.current = setInterval(() => {
        setVoiceDuration(prev => {
          if (prev >= 14) {
            stopRecordingVoice();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      toast.error("Vui lòng cấp quyền Microphone để ghi âm!");
    }
  };

  const stopRecordingVoice = () => {
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingVoice(false);
  };

  const cancelRecordingVoice = () => {
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingVoice(false);
    setVoiceBase64(null);
    setVoiceDuration(0);
    setIsPlayingRecordedVoice(false);
  };

  const togglePlayRecordedVoice = () => {
    if (!recordedAudioRef.current) return;
    if (isPlayingRecordedVoice) {
      recordedAudioRef.current.pause();
      setIsPlayingRecordedVoice(false);
    } else {
      recordedAudioRef.current.currentTime = 0;
      recordedAudioRef.current.play().then(() => {
        setIsPlayingRecordedVoice(true);
      }).catch(() => {});
    }
  };

  // ==========================================
  // BÁO CÁO VI PHẠM CỘNG ĐỒNG
  // ==========================================
  const handleSendCommunityReport = async () => {
    if (!selectedGroup) return;
    try {
      setIsSubmittingReport(true);
      await axiosClient.post('/reports', {
        targetType: 'COMMUNITY',
        targetId: selectedGroup.id,
        communityId: selectedGroup.id,
        reason: reportReason,
        description: reportDescription.trim() || undefined
      });
      toast.success("Cảm ơn bạn! Báo cáo vi phạm đã được gửi đến Ban quản trị kiểm duyệt.");
      setIsReportModalOpen(false);
      setReportReason('SPAM');
      setReportDescription('');
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi báo cáo lúc này");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // ==========================================
  // QUẢN TRỊ VIÊN: BẬT / TẮT TOGGLES
  // ==========================================
  const handleToggleApproval = async () => {
    if (!selectedGroup) return;
    try {
      const newVal = !selectedGroup.requiresApproval;
      await axiosClient.put(`/groups/${selectedGroup.id}`, { requiresApproval: newVal, requireMemberApproval: newVal });
      setSelectedGroup(prev => ({ ...prev, requiresApproval: newVal, requireMemberApproval: newVal }));
      toast.success(newVal ? "Đã bật chế độ phê duyệt thành viên!" : "Đã chuyển sang gia nhập tự do!");
      fetchGroups(searchKeyword);
    } catch (e) {
      toast.error("Không thể cập nhật chế độ phê duyệt");
    }
  };

  const handleTogglePostApproval = async () => {
    if (!selectedGroup) return;
    try {
      const newVal = !selectedGroup.requiresPostApproval;
      await axiosClient.put(`/groups/${selectedGroup.id}`, { requiresPostApproval: newVal, requirePostApproval: newVal });
      setSelectedGroup(prev => ({ ...prev, requiresPostApproval: newVal, requirePostApproval: newVal }));
      toast.success(newVal ? "Đã bật chế độ kiểm duyệt bài viết!" : "Bài viết giờ đây sẽ được xuất bản trực tiếp!");
      fetchGroups(searchKeyword);
    } catch (e) {
      toast.error("Không thể cập nhật chế độ duyệt bài");
    }
  };

  const handleTogglePublicToFeed = async () => {
    if (!selectedGroup) return;
    try {
      const newVal = selectedGroup.isPublicToFeed === false ? true : false;
      await axiosClient.put(`/groups/${selectedGroup.id}`, { isPublicToFeed: newVal, allowFeedPromotion: newVal });
      setSelectedGroup(prev => ({ ...prev, isPublicToFeed: newVal, allowFeedPromotion: newVal }));
      toast.success(newVal ? "Đã bật đề xuất bài viết ra Sảnh trực tuyến!" : "Bài viết sẽ chỉ hiển thị riêng tư bên trong nhóm!");
      fetchGroups(searchKeyword);
    } catch (e) {
      toast.error("Không thể cập nhật đề xuất feed");
    }
  };

  // Cập nhật thông tin nhóm
  const handleUpdateGroupInfo = async (e) => {
    e.preventDefault();
    if (!selectedGroup) return;
    try {
      setIsSavingGroupInfo(true);
      await axiosClient.put(`/groups/${selectedGroup.id}`, editGroupForm);
      toast.success("Đã cập nhật thông tin cộng đồng!");
      handleOpenGroup({ ...selectedGroup, ...editGroupForm });
      fetchGroups(searchKeyword);
    } catch (e) {
      toast.error("Lỗi cập nhật thông tin nhóm");
    } finally {
      setIsSavingGroupInfo(false);
    }
  };

  // Mở / Tham gia phòng thoại nhóm (Audio-First)
  const handleOpenGroupVoiceRoom = async () => {
    if (!selectedGroup) return;
    const gNameStr = String(selectedGroup.name || '').toLowerCase().trim();
    const existingRoom = (rooms || []).find(r => 
      r && String(r.nameroom || '').toLowerCase().includes(gNameStr)
    );

    if (existingRoom) {
      if (navigate) navigate(`/room/${existingRoom.id}`);
      else window.location.href = `/room/${existingRoom.id}`;
      return;
    }

    try {
      const res = await axiosClient.post('/rooms/create', {
        nameroom: `Phòng đàm thoại • ${selectedGroup.name}`,
        isPrivate: false,
        theme: 'general',
        maxParticipants: 15
      });
      const newRoom = res.data?.data;
      if (newRoom && newRoom.id) {
        toast.success(`Đã mở phòng đàm thoại cho nhóm ${selectedGroup.name}!`);
        if (navigate) navigate(`/room/${newRoom.id}`);
        else window.location.href = `/room/${newRoom.id}`;
      }
    } catch (err) {
      toast.error("Không thể tạo phòng đàm thoại lúc này");
    }
  };

  // Đăng thảo luận vào cộng đồng
  const handleAddGroupPost = async (e) => {
    e.preventDefault();
    if (!groupPostText.trim() && !groupAttachedImage && !voiceBase64) {
      toast.error("Vui lòng nhập nội dung, đính kèm ảnh hoặc ghi âm 15s!");
      return;
    }
    try {
      setIsPostingGroup(true);
      let mediaUrls = [];
      if (groupAttachedImage) {
        mediaUrls.push({ url: groupAttachedImage, type: 'IMAGE' });
      }

      await axiosClient.post('/posts', {
        content: groupPostText,
        groupId: selectedGroup.id,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        audioUrl: voiceBase64 || undefined
      });

      toast.success(selectedGroup.requiresPostApproval 
        ? "Bài thảo luận đã được gửi và đang chờ Chủ nhóm/Mod duyệt!" 
        : "Đã đăng bài thảo luận thành công!");
      
      setGroupPostText('');
      setGroupAttachedImage(null);
      setVoiceBase64(null);
      fetchGroupDedicatedPosts(selectedGroup.id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi đăng bài thảo luận");
    } finally {
      setIsPostingGroup(false);
    }
  };

  const handleDirectChatWithMember = (member) => {
    if (!member) return;
    if (navigate) navigate(`/messages/${member.userId}`);
    else window.location.href = `/messages/${member.userId}`;
  };

  // Lọc bài viết thuộc nhóm
  const groupPosts = groupDedicatedPosts.length > 0 
    ? groupDedicatedPosts 
    : (posts || []).filter(p => p.groupId === selectedGroup?.id);

  // Kiểm tra xem nhóm có phòng thoại đang mở không
  const activeGroupRoom = selectedGroup ? (rooms || []).find(r => 
    r && String(r.nameroom || '').toLowerCase().includes(String(selectedGroup.name || '').toLowerCase().trim())
  ) : null;

  const canManage = selectedGroup && ['OWNER', 'DEPUTY'].includes(groupDetail?.currentUserRole || selectedGroup.currentUserRole);

  // ==========================================
  // RENDER GIAO DIỆN CHÍNH
  // ==========================================
  return (
    <div className="space-y-6 font-sans text-zinc-100">

      {/* AUDIO PLAYER ẨN ĐỂ PREVIEW GHI ÂM 15S */}
      {voiceBase64 && (
        <audio 
          ref={recordedAudioRef} 
          src={voiceBase64} 
          onEnded={() => setIsPlayingRecordedVoice(false)}
          className="hidden" 
        />
      )}

      {/* ============================================================== */}
      {/* 1. MÀN HÌNH CHI TIẾT CỘNG ĐỒNG (/communities/:id)              */}
      {/* ============================================================== */}
      {selectedGroup ? (
        <div className="space-y-4 animate-fade-in">

          {/* Thanh breadcrumb quay lại */}
          <div className="flex items-center justify-between">
            <button 
              type="button"
              onClick={handleBackToList}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-800 transition-all active:scale-95 shadow-sm"
            >
              <ArrowLeft size={14} />
              <span>Quay lại danh sách cộng đồng</span>
            </button>

            <div className="flex items-center gap-2">
              {selectedGroup.currentUserRole === 'OWNER' && (
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center gap-1.5 font-mono">
                  <Crown size={12} /> Chủ nhóm
                </span>
              )}
              {selectedGroup.currentUserRole === 'DEPUTY' && (
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-medium flex items-center gap-1.5 font-mono">
                  <Shield size={12} /> Phó nhóm
                </span>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* HEADER NHÓM GỌN GÀNG (LOẠI BỎ HOÀN TOÀN KHOẢNG ĐEN THỪA)       */}
          {/* ============================================================== */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800/90 p-4 sm:p-5 relative shadow-lg">
            {/* Nút icon Báo cáo ở góc phải */}
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="absolute top-3.5 right-3.5 p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
              title="Báo cáo vi phạm cộng đồng"
            >
              <Flag size={15} />
            </button>

            {/* Khối thông tin ngang */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-8 sm:pr-10">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl font-bold text-white shrink-0 overflow-hidden shadow-inner">
                  {selectedGroup.avatarUrl ? (
                    <img src={selectedGroup.avatarUrl} alt={selectedGroup.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{getInitials(selectedGroup.name)}</span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                      {selectedGroup.name}
                    </h1>
                    {selectedGroup.currentUserRole === 'OWNER' && (
                      <span className="bg-zinc-800 text-zinc-200 border border-zinc-700 text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                        <Crown size={11} /> Chủ nhóm
                      </span>
                    )}
                    {selectedGroup.currentUserRole === 'DEPUTY' && (
                      <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                        <Shield size={11} /> Phó nhóm
                      </span>
                    )}
                    {selectedGroup.isFeatured && (
                      <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Star size={10} className="fill-zinc-300 text-zinc-300" /> Nổi bật
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-400 line-clamp-1 mt-1 font-sans">
                    {selectedGroup.description || 'Không gian thảo luận và kết nối trực tiếp.'}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 font-mono tabular-nums">
                    <span>{selectedGroup.membersCount || groupDetail?.members?.length || 1} thành viên</span>
                    <span>•</span>
                    <span className={activeGroupRoom ? "text-emerald-400 font-medium flex items-center gap-1" : "text-zinc-500"}>
                      {activeGroupRoom && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>}
                      {activeGroupRoom ? 'Đang có phòng thoại trực tiếp' : 'Sẵn sàng kết nối'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nút hành động Desktop: ngang bên phải; Mobile: grid-cols-2 full chiều ngang */}
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsInviteFriendsOpen(true)}
                  className="h-9 px-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <UserPlus size={14} />
                  <span>Mời bạn bè</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenGroupVoiceRoom}
                  className="h-9 px-3.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                >
                  <Radio size={14} className={activeGroupRoom ? "text-emerald-600 animate-pulse" : ""} />
                  <span>{activeGroupRoom ? "Vào phòng thoại" : "Mở phòng thoại nhóm"}</span>
                </button>
              </div>
            </div>

            {/* Hàng nút trên Mobile: xếp 2 cột full width */}
            <div className="grid grid-cols-2 gap-2 w-full mt-3.5 sm:hidden">
              <button
                type="button"
                onClick={() => setIsInviteFriendsOpen(true)}
                className="h-9 px-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 text-xs font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <UserPlus size={13} />
                <span>Mời bạn bè</span>
              </button>

              <button
                type="button"
                onClick={handleOpenGroupVoiceRoom}
                className="h-9 px-3 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Radio size={13} className={activeGroupRoom ? "text-emerald-600 animate-pulse" : ""} />
                <span className="truncate">{activeGroupRoom ? "Vào phòng thoại" : "Mở phòng thoại"}</span>
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* THANH PHÒNG THOẠI TRỰC TIẾP (LIVE GROUP ROOM BAR)               */}
          {/* ============================================================== */}
          {(activeGroupRoom || selectedGroup.activeVoiceRoomId) && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-sm mt-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs text-zinc-200 font-medium truncate">
                  Đang có phòng đàm thoại nhóm • <strong className="text-emerald-400 font-mono tabular-nums">{activeGroupRoom?.members?.length || 1}</strong> thành viên đang kết nối
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenGroupVoiceRoom}
                className="h-8 px-3.5 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shrink-0 transition-colors active:scale-95 shadow-sm"
              >
                Tham gia ngay
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* LƯỚI 4 TAB CHIA ĐỀU CHUẨN MOBILE & LAPTOP (KHÔNG BỊ CẮT CHỮ)    */}
          {/* ============================================================== */}
          <div className={`grid ${canManage ? 'grid-cols-4' : 'grid-cols-3'} gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-center mt-3.5`}>
            <button
              type="button"
              onClick={() => setActiveWorkspaceTab('feed')}
              className={`py-2 px-1 rounded-lg text-[11px] sm:text-xs font-medium flex items-center justify-center gap-1 transition-all truncate ${
                activeWorkspaceTab === 'feed' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <MessageSquare size={13} className="shrink-0" />
              <span className="truncate">Thảo luận</span>
              <span className="font-mono tabular-nums text-[10px]">({groupPosts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveWorkspaceTab('voice')}
              className={`py-2 px-1 rounded-lg text-[11px] sm:text-xs font-medium flex items-center justify-center gap-1 transition-all truncate ${
                activeWorkspaceTab === 'voice' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Radio size={13} className="shrink-0" />
              <span className="truncate">Phòng thoại</span>
              {activeGroupRoom && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveWorkspaceTab('members')}
              className={`py-2 px-1 rounded-lg text-[11px] sm:text-xs font-medium flex items-center justify-center gap-1 transition-all truncate ${
                activeWorkspaceTab === 'members' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users size={13} className="shrink-0" />
              <span className="truncate">Thành viên</span>
              <span className="font-mono tabular-nums text-[10px]">({groupDetail?.members?.length || selectedGroup.membersCount || 1})</span>
            </button>

            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setActiveWorkspaceTab('settings');
                  fetchPendingMembers(selectedGroup.id);
                  fetchPendingPosts(selectedGroup.id);
                }}
                className={`py-2 px-1 rounded-lg text-[11px] sm:text-xs font-medium flex items-center justify-center gap-1 transition-all truncate ${
                  activeWorkspaceTab === 'settings' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Settings size={13} className="shrink-0" />
                <span className="truncate">Quản trị</span>
                {(pendingMembers.length > 0 || pendingPosts.length > 0) && (
                  <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-200 text-[9px] font-mono border border-zinc-700">
                    {pendingMembers.length + pendingPosts.length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* ========================================================= */}
          {/* TAB 1: BẢNG TIN THẢO LUẬN (FEED TRONG NHÓM)               */}
          {/* ========================================================= */}
          {activeWorkspaceTab === 'feed' && (
            <div className="space-y-4">

              {/* NỘI QUY CỘNG ĐỒNG GHIM ĐẦU BẢNG TIN */}
              {selectedGroup.rules && (
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-2.5 text-xs text-zinc-300">
                  <Pin size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-zinc-200 block mb-0.5 font-mono text-[11px] uppercase tracking-wider">
                      Nội quy cộng đồng
                    </span>
                    <p className="text-zinc-400 line-clamp-2 leading-relaxed whitespace-pre-line text-xs font-sans">
                      {selectedGroup.rules}
                    </p>
                  </div>
                </div>
              )}

              {/* Box soạn thảo bài viết dành riêng cho nhóm (Ảnh & Ghi âm 15s) */}
              {selectedGroup.currentUserRole === 'BANNED' ? (
                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-1">
                  <p className="text-xs font-semibold text-rose-400">Bạn đã bị chặn khỏi cộng đồng này</p>
                  <p className="text-[11px] text-zinc-400">Bạn chỉ có thể xem nội dung lưu trữ và không thể đăng bài thảo luận hoặc bình luận.</p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800/90 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-xs text-white border border-zinc-700">
                    {safeAvatar ? (
                      <img src={safeAvatar} alt="Me" className="w-full h-full object-cover" />
                    ) : (
                      (currentUserName || 'U').charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <textarea 
                      rows="3"
                      value={groupPostText}
                      onChange={(e) => setGroupPostText(e.target.value)}
                      placeholder={`Chia sẻ câu chuyện, hỏi đáp hoặc ý tưởng vào cộng đồng ${selectedGroup.name}...`}
                      className="w-full bg-transparent text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed"
                    />

                    {/* Preview Ảnh đính kèm */}
                    {groupAttachedImage && (
                      <div className="relative mt-2 inline-block rounded-xl overflow-hidden border border-zinc-700 max-h-40">
                        <img src={groupAttachedImage} alt="Attached" className="max-h-40 object-cover" />
                        <button 
                          type="button" 
                          onClick={() => setGroupAttachedImage(null)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}

                    {/* Trạng thái đang ghi âm 15s */}
                    {isRecordingVoice && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/40 mt-2 animate-pulse">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          <span className="text-xs text-rose-300 font-mono">Đang thu âm giọng nói... {voiceDuration}s / 15s</span>
                        </div>
                        <button
                          type="button"
                          onClick={stopRecordingVoice}
                          className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1 active:scale-95"
                        >
                          <Square size={12} /> Dừng thu
                        </button>
                      </div>
                    )}

                    {/* Preview Bản ghi âm 15s */}
                    {voiceBase64 && !isRecordingVoice && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 mt-2">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={togglePlayRecordedVoice}
                            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center transition-colors"
                          >
                            {isPlayingRecordedVoice ? <Pause size={12} /> : <Play size={12} />}
                          </button>
                          <span className="text-xs text-zinc-300 font-mono">Bản thu âm ({voiceDuration || 15}s)</span>
                        </div>
                        <button
                          type="button"
                          onClick={cancelRecordingVoice}
                          className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        {/* Nút Đính kèm ảnh */}
                        <label className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors">
                          <ImageIcon size={14} />
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setGroupAttachedImage(reader.result);
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>

                        {/* Nút Ghi âm 15s */}
                        <button
                          type="button"
                          onClick={isRecordingVoice ? stopRecordingVoice : startRecordingVoice}
                          className={`p-2 rounded-xl border text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5 ${
                            isRecordingVoice 
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                              : voiceBase64 
                              ? 'bg-zinc-800 text-white border-zinc-700' 
                              : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                          title="Ghi âm giọng nói 15s"
                        >
                          <Mic size={14} />
                          <span className="hidden sm:inline text-xs">Ghi âm 15s</span>
                        </button>
                      </div>

                      <button 
                        type="button"
                        onClick={handleAddGroupPost}
                        disabled={isPostingGroup || (!groupPostText.trim() && !groupAttachedImage && !voiceBase64)}
                        className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isPostingGroup ? "Đang gửi..." : "Đăng thảo luận"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Danh sách bài thảo luận trong nhóm */}
              {groupPosts.length === 0 ? (
                <div className="py-16 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <MessageSquare size={36} className="mx-auto mb-3 text-zinc-600 opacity-60" />
                  <p className="text-zinc-300 text-sm font-semibold mb-1">Chưa có bài thảo luận nào trong cộng đồng này</p>
                  <p className="text-zinc-500 text-xs">Hãy là thành viên đầu tiên mở bát chủ đề thảo luận hoặc chia sẻ góc nhìn thú vị cùng mọi người!</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {groupPosts.map(post => (
                    <div 
                      key={post.id} 
                      className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800/90 hover:border-zinc-700 transition-all shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex items-center gap-2.5 cursor-pointer"
                          onClick={() => {
                            if (navigate) navigate(`/profile/${post.authorId || post.userId}`);
                            else if (onSelectUser) onSelectUser(post.authorId || post.userId);
                          }}
                        >
                          <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center font-bold text-xs text-white border border-zinc-700">
                            {post.authorAvatar || post.avatar ? (
                              <img src={post.authorAvatar || post.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (post.authorNickname || post.authorAccount || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-zinc-200 block hover:text-white">
                              {post.authorNickname || post.authorAccount || 'Thành viên'}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {post.createdAt ? new Date(post.createdAt).toLocaleDateString('vi-VN') : 'Vừa xong'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-line font-sans">
                        {post.content}
                      </p>

                      {/* Ảnh bài thảo luận */}
                      {post.mediaUrls && post.mediaUrls.length > 0 && (
                        <div className="rounded-xl overflow-hidden border border-zinc-800 max-h-72">
                          <img src={post.mediaUrls[0].url || post.mediaUrls[0]} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      {/* Audio đính kèm */}
                      {post.audioUrl && (
                        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-3">
                          <Volume2 size={16} className="text-zinc-400" />
                          <audio src={post.audioUrl} controls className="h-7 flex-1" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: PHÒNG ĐÀM THOẠI (LIVE VOICE ROOMS)                 */}
          {/* ========================================================= */}
          {activeWorkspaceTab === 'voice' && (
            <div className="space-y-4">
              {activeGroupRoom ? (
                <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span className="text-emerald-400 font-mono text-xs font-semibold uppercase tracking-wider">
                          Phòng thoại đang trực tiếp
                        </span>
                      </div>
                      <h3 className="text-zinc-100 font-bold text-base mb-1">{activeGroupRoom.nameroom}</h3>
                      <p className="text-zinc-400 text-xs font-mono tabular-nums">
                        {activeGroupRoom.soluong || (activeGroupRoom.userRoomDTOList?.length || 1)} thành viên đang kết nối âm thanh
                      </p>
                    </div>

                    <button 
                      type="button"
                      onClick={() => {
                        if (navigate) navigate(`/room/${activeGroupRoom.id}`);
                        else window.location.href = `/room/${activeGroupRoom.id}`;
                      }}
                      className="h-10 px-5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                    >
                      <Radio size={14} />
                      <span>Tham gia đàm thoại ngay</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <Radio size={36} className="mx-auto mb-3 text-zinc-600 opacity-60" />
                  <h4 className="text-zinc-200 font-bold text-sm mb-1">Chưa có phòng đàm thoại nào đang mở</h4>
                  <p className="text-zinc-400 text-xs max-w-md mx-auto mb-4">
                    Bạn có thể khởi tạo một phòng voice call âm thanh độ trễ thấp dành riêng cho các thành viên cộng đồng {selectedGroup.name}.
                  </p>
                  <button 
                    type="button"
                    onClick={handleOpenGroupVoiceRoom}
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs shadow-md transition-all active:scale-95"
                  >
                    <Plus size={14} />
                    <span>Mở phòng đàm thoại nhóm ngay</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: THÀNH VIÊN CỘNG ĐỒNG                              */}
          {/* ========================================================= */}
          {activeWorkspaceTab === 'members' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2">
                <span className="text-zinc-400 text-xs font-mono tabular-nums uppercase tracking-wider">
                  Tổng số {groupDetail?.members?.length || selectedGroup.membersCount || 1} thành viên
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(groupDetail?.members || []).map(member => {
                  const isOwner = member.role === 'OWNER';
                  const isDeputy = member.role === 'DEPUTY';
                  const isSelf = member.userId === currentUserId;

                  return (
                    <div 
                      key={member.id} 
                      className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-between gap-3 shadow-sm"
                    >
                      <div 
                        className="flex items-center gap-3 min-w-0 cursor-pointer"
                        onClick={() => {
                          if (navigate) navigate(`/profile/${member.userId}`);
                          else if (onSelectUser) onSelectUser(member.userId);
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-sm text-zinc-200 overflow-hidden border border-zinc-700 flex-shrink-0">
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.nickname} className="w-full h-full object-cover" />
                          ) : (
                            (member.nickname || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-zinc-100 font-semibold text-xs truncate hover:text-white">{member.nickname}</span>
                            {isOwner && (
                              <span className="bg-zinc-800 text-zinc-200 border border-zinc-700 text-[10px] font-medium px-2 py-0.5 rounded-md font-mono">
                                Chủ nhóm
                              </span>
                            )}
                            {isDeputy && (
                              <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-medium px-2 py-0.5 rounded-md font-mono">
                                Phó nhóm
                              </span>
                            )}
                          </div>
                          <span className="text-zinc-500 font-mono text-[10px] truncate block">@{member.account}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleDirectChatWithMember(member)}
                            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all text-xs flex items-center gap-1"
                            title="Nhắn tin riêng"
                          >
                            <MessageCircle size={13} />
                            <span className="hidden sm:inline">Nhắn tin</span>
                          </button>
                        )}

                        {canManage && !isSelf && !isOwner && (
                          member.status === 'BANNED' ? (
                            <button
                              type="button"
                              onClick={() => handleUnbanMember(member.userId)}
                              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all text-xs flex items-center gap-1 font-mono"
                              title="Gỡ chặn thành viên"
                            >
                              <span>Gỡ chặn</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleBanMember(member.userId)}
                              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition-all text-xs flex items-center gap-1 font-mono"
                              title="Chặn thành viên"
                            >
                              <span>Chặn</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: QUẢN TRỊ CỘNG ĐỒNG (GRID 2 CỘT HIỆN ĐẠI & TOGGLES) */}
          {/* ========================================================= */}
          {activeWorkspaceTab === 'settings' && canManage && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              
              {/* THẺ 1: CẤU HÌNH PHÊ DUYỆT & ĐỀ XUẤT (SWITCH TOGGLES) */}
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800/90 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                  <Sliders size={16} className="text-zinc-300" />
                  <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                    Cấu hình Phê duyệt & Đề xuất
                  </h3>
                </div>

                {/* Switch 1: Chế độ phê duyệt thành viên */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                  <div className="pr-3">
                    <span className="text-xs font-semibold text-zinc-200 block">Duyệt thành viên tham gia</span>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">Yêu cầu quản trị viên phê duyệt trước khi vào nhóm</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={selectedGroup.requiresApproval}
                    onClick={handleToggleApproval}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${selectedGroup.requiresApproval ? 'bg-white' : 'bg-zinc-800'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${selectedGroup.requiresApproval ? 'translate-x-5 bg-zinc-950' : 'translate-x-0 bg-zinc-400'}`}
                    />
                  </button>
                </div>

                {/* Switch 2: Duyệt bài viết trước khi xuất bản */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                  <div className="pr-3">
                    <span className="text-xs font-semibold text-zinc-200 block">Kiểm duyệt bài viết</span>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">Bài thảo luận cần được Chủ nhóm/Mod duyệt trước khi hiển thị</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={selectedGroup.requiresPostApproval}
                    onClick={handleTogglePostApproval}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${selectedGroup.requiresPostApproval ? 'bg-white' : 'bg-zinc-800'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${selectedGroup.requiresPostApproval ? 'translate-x-5 bg-zinc-950' : 'translate-x-0 bg-zinc-400'}`}
                    />
                  </button>
                </div>

                {/* Switch 3: Đề xuất ra Feed chung */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                  <div className="pr-3">
                    <span className="text-xs font-semibold text-zinc-200 block">Đề xuất ra Feed chung</span>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">Cho phép bài thảo luận xuất hiện tại Sảnh trực tuyến hệ thống</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={selectedGroup.isPublicToFeed !== false}
                    onClick={handleTogglePublicToFeed}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${selectedGroup.isPublicToFeed !== false ? 'bg-white' : 'bg-zinc-800'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${selectedGroup.isPublicToFeed !== false ? 'translate-x-5 bg-zinc-950' : 'translate-x-0 bg-zinc-400'}`}
                    />
                  </button>
                </div>
              </div>

              {/* THẺ 2: CHỈNH SỬA THÔNG TIN & DANH MỤC (CUSTOM DROPDOWN) */}
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800/90 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                  <Edit3 size={16} className="text-zinc-300" />
                  <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                    Thông tin & Danh mục
                  </h3>
                </div>
                <form onSubmit={handleUpdateGroupInfo} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-mono text-zinc-400 block mb-1">Tên cộng đồng</label>
                    <input
                      type="text"
                      value={editGroupForm.name}
                      onChange={(e) => setEditGroupForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                      required
                    />
                  </div>

                  {/* CUSTOM DROPDOWN THAY CHO NATIVE SELECT */}
                  <div className="relative">
                    <label className="text-[11px] font-mono text-zinc-400 block mb-1">Danh mục chuyên biệt</label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white flex items-center justify-between focus:outline-none focus:border-zinc-700"
                    >
                      <span>
                        {categories.find(c => c.slug === editGroupForm.categoryCode || c.id === editGroupForm.categoryId)?.name || 'Chung • Mọi chủ đề'}
                      </span>
                      <ChevronDown size={14} className="text-zinc-400" />
                    </button>
                    {isCategoryDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-2xl space-y-0.5 max-h-48 overflow-y-auto custom-dark-scrollbar">
                        {categories.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setEditGroupForm(prev => ({ ...prev, categoryCode: c.slug, categoryId: c.id }));
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                              editGroupForm.categoryCode === c.slug ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-300 hover:bg-zinc-800/60'
                            }`}
                          >
                            <span>{c.name}</span>
                            {editGroupForm.categoryCode === c.slug && <Check size={12} className="text-white" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-zinc-400 block mb-1">Mô tả cộng đồng</label>
                    <textarea
                      rows="2"
                      value={editGroupForm.description}
                      onChange={(e) => setEditGroupForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 resize-none"
                    />
                  </div>
                  <div className="pt-1 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingGroupInfo}
                      className="h-9 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSavingGroupInfo ? "Đang lưu..." : "Lưu cập nhật"}
                    </button>
                  </div>
                </form>
              </div>

              {/* THẺ 3: HÀNG ĐỢI PHÊ DUYỆT (THÀNH VIÊN & BÀI VIẾT) */}
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800/90 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-zinc-300" />
                    <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                      Hàng đợi Phê duyệt
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAdminSubTab('members_queue')}
                      className={`px-2 py-0.5 rounded-md transition-all font-mono tabular-nums ${adminSubTab === 'members_queue' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'}`}
                    >
                      Thành viên ({pendingMembers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminSubTab('posts_queue')}
                      className={`px-2 py-0.5 rounded-md transition-all font-mono tabular-nums ${adminSubTab === 'posts_queue' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'}`}
                    >
                      Bài viết ({pendingPosts.length})
                    </button>
                  </div>
                </div>

                {adminSubTab === 'members_queue' ? (
                  pendingMembers.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500 text-xs">Không có yêu cầu gia nhập nào đang chờ.</div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto custom-dark-scrollbar pr-1">
                      {pendingMembers.map(req => (
                        <div key={req.id} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs text-white flex-shrink-0 overflow-hidden">
                              {req.avatar ? <img src={req.avatar} alt="" className="w-full h-full object-cover" /> : (req.nickname || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium text-zinc-200 truncate">{req.nickname || req.account}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleApproveMember(req.userId)}
                              className="px-2.5 py-1 rounded-lg bg-white text-zinc-950 font-medium text-xs hover:bg-zinc-200 transition-all active:scale-95"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectMember(req.userId)}
                              className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-rose-950/40 hover:text-rose-400 transition-all active:scale-95"
                            >
                              Từ chối
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  pendingPosts.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500 text-xs">Không có bài viết nào đang chờ duyệt.</div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto custom-dark-scrollbar pr-1">
                      {pendingPosts.map(post => (
                        <div key={post.id} className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-zinc-200">{post.authorNickname || post.authorAccount}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApprovePost(post.id)}
                                className="px-2.5 py-1 rounded-lg bg-white text-zinc-950 font-medium text-xs hover:bg-zinc-200 transition-all active:scale-95"
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectPostOpen(post)}
                                className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-rose-950/40 hover:text-rose-400 transition-all active:scale-95"
                              >
                                Từ chối
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">{post.content}</p>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* THẺ 4: NỘI QUY CỘNG ĐỒNG & VÙNG NGUY HIỂM */}
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800/90 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                  <FileText size={16} className="text-zinc-300" />
                  <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                    Nội quy & Vùng nguy hiểm
                  </h3>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-mono text-zinc-400">Nội quy cộng đồng</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditingRules) {
                          handleSaveRules();
                        } else {
                          setEditRulesText(selectedGroup.rules || groupDetail?.rules || '');
                          setIsEditingRules(true);
                        }
                      }}
                      className="text-[11px] text-zinc-400 hover:text-white underline font-mono"
                    >
                      {isEditingRules ? "Lưu quy định" : "Chỉnh sửa"}
                    </button>
                  </div>
                  {isEditingRules ? (
                    <textarea
                      rows="3"
                      value={editRulesText}
                      onChange={(e) => setEditRulesText(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 resize-none"
                    />
                  ) : (
                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-300 max-h-24 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                      {selectedGroup.rules || groupDetail?.rules || "Tôn trọng các thành viên, chia sẻ tích cực và xây dựng cộng đồng văn minh."}
                    </div>
                  )}
                </div>

                {selectedGroup.currentUserRole === 'OWNER' && (
                  <div className="pt-3 border-t border-zinc-800/80">
                    <span className="text-[11px] font-mono text-rose-400 block mb-1 uppercase font-bold">Vùng nguy hiểm</span>
                    <p className="text-[11px] text-zinc-500 mb-2">Giải tán cộng đồng sẽ xóa vĩnh viễn toàn bộ bài viết, phòng thoại và dữ liệu nhóm.</p>
                    <button
                      type="button"
                      onClick={handleDeleteGroup}
                      className="w-full py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={13} />
                      <span>Giải tán cộng đồng này</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      ) : (

        /* ============================================================== */
        /* 2. MÀN HÌNH DANH SÁCH CỘNG ĐỒNG (/communities)                 */
        /* ============================================================== */
        <div className="space-y-5 animate-fade-in">

          {/* HEADER & NÚT TẠO CỘNG ĐỒNG GỌN GÀNG (DESKTOP 1 HÀNG, MOBILE THOÁNG) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900 border border-zinc-800/90 shadow-sm">
            <div>
              <h2 className="text-zinc-100 font-bold text-lg sm:text-xl tracking-tight">Cộng Đồng</h2>
              <p className="text-zinc-400 text-xs sm:text-sm font-sans mt-0.5">
                Khám phá các không gian thảo luận theo gu âm nhạc, sở thích và chuyên môn
              </p>
            </div>

            <button 
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="h-10 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs sm:text-sm shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <Plus size={16} />
              <span>Tạo cộng đồng</span>
            </button>
          </div>

          {/* THANH TÌM KIẾM & DẢI LỌC DANH MỤC ĐỘNG (ẨN THANH CUỘN NGANG) */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Tìm kiếm cộng đồng theo tên, chủ đề hoặc mô tả..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
              />
            </div>

            {/* Dải chip lọc danh mục động (Không có thanh cuộn ngang) */}
            <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1">
              {[{ id: 'all', slug: 'all', name: 'Tất cả cộng đồng' }, ...categories].map(cat => {
                const isSelected = activeCategory === (cat.slug || cat.id);
                return (
                  <button
                    key={cat.id || cat.slug}
                    type="button"
                    onClick={() => setActiveCategory(cat.slug || cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border shrink-0 ${
                      isSelected 
                        ? 'bg-zinc-800 text-white border-zinc-700 shadow-sm' 
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ============================================================== */}
          {/* LƯỚI THẺ CỘNG ĐỒNG HIỆN ĐẠI (KHÔNG CÒN BANNER ĐEN TRỐNG TRÃI)  */}
          {/* ============================================================== */}
          {loading ? (
            <div className="py-20 text-center text-zinc-500 text-xs font-mono">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin mx-auto mb-2"></div>
              <span>Đang tải các không gian cộng đồng...</span>
            </div>
          ) : (!Array.isArray(groups) || groups.length === 0) ? (
            <div className="py-16 px-4 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
              <Users size={36} className="mx-auto mb-3 text-zinc-600 opacity-60" />
              <p className="text-zinc-300 text-sm font-semibold mb-1">Chưa có cộng đồng nào phù hợp</p>
              <p className="text-zinc-500 text-xs mb-4">Hãy là người đầu tiên sáng lập một cộng đồng mới ngay hôm nay!</p>
              <button 
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium shadow-sm transition-all active:scale-95"
              >
                <Plus size={15} /> Tạo cộng đồng ngay
              </button>
            </div>
          ) : (() => {
            const allList = Array.isArray(groups) ? groups : [];
            const filtered = allList.filter(g => {
              if (activeCategory === 'all') return true;
              return (g.categoryCode && g.categoryCode.toLowerCase() === activeCategory.toLowerCase()) ||
                     (g.categoryId && String(g.categoryId) === String(activeCategory));
            });

            const myJoinedGroups = filtered.filter(g => ['OWNER', 'DEPUTY', 'MEMBER'].includes(g.currentUserRole));
            const suggestedGroups = filtered.filter(g => !['OWNER', 'DEPUTY', 'MEMBER'].includes(g.currentUserRole));

            // THẺ CỘNG ĐỒNG BỐ CỤC NGANG TINH GỌN (ZERO EMPTY BANNER)
            const renderGroupCard = (group) => {
              const isOwner = group.currentUserRole === 'OWNER';
              const isDeputy = group.currentUserRole === 'DEPUTY';
              const isMember = group.currentUserRole === 'MEMBER';
              const isPending = group.currentUserRole === 'PENDING';

              const gNameStr = String(group?.name || '').toLowerCase().trim();
              const hasVoiceRoom = gNameStr ? (rooms || []).some(r => 
                r && String(r.nameroom || '').toLowerCase().includes(gNameStr)
              ) : false;

              return (
                <div 
                  key={group.id}
                  onClick={() => handleOpenGroup(group)}
                  className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800/90 hover:border-zinc-700 transition-all cursor-pointer flex items-center justify-between gap-3.5 shadow-sm group"
                >
                  {/* Bên trái: Avatar nhóm vuông bo góc */}
                  <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-lg text-zinc-100 shrink-0 overflow-hidden shadow-inner">
                    {group.avatarUrl ? (
                      <img src={group.avatarUrl} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{getInitials(group.name)}</span>
                    )}
                  </div>

                  {/* Ở giữa: Tên nhóm, badge, mô tả ngắn, số thành viên */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-base font-semibold text-zinc-100 group-hover:text-white truncate">
                        {group.name}
                      </h3>
                      {isOwner && (
                        <span className="bg-zinc-800 text-zinc-200 border border-zinc-700 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                          <Crown size={10} /> Chủ nhóm
                        </span>
                      )}
                      {isDeputy && (
                        <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                          <Shield size={10} /> Phó nhóm
                        </span>
                      )}
                      {isPending && (
                        <span className="bg-zinc-900 text-zinc-400 border border-zinc-800 text-[10px] font-medium px-2 py-0.5 rounded-md font-mono">
                          Chờ duyệt
                        </span>
                      )}
                      {group.categoryName && (
                        <span className="bg-zinc-800/60 text-zinc-400 border border-zinc-700/60 text-[10px] font-mono px-2 py-0.5 rounded-md">
                          {group.categoryName}
                        </span>
                      )}
                      {hasVoiceRoom && (
                        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                          Voice
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-1 mt-1 font-sans">
                      {group.description || 'Không gian thảo luận và giao lưu dành cho các thành viên.'}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-500 font-mono tabular-nums">
                      <span className="flex items-center gap-1">
                        <Users size={12} className="text-zinc-500" />
                        <span>{group.membersCount || 1} thành viên</span>
                      </span>
                      {group.postsCount !== undefined && (
                        <>
                          <span>•</span>
                          <span>{group.postsCount || 0} bài thảo luận</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bên phải: Nút hành động gọn h-9 px-3.5 */}
                  <div className="shrink-0 flex items-center">
                    {isMember || isOwner || isDeputy ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleOpenGroup(group); }}
                        className="h-9 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-all active:scale-95 flex items-center gap-1"
                      >
                        <span>Vào nhóm</span>
                        <ChevronRight size={14} />
                      </button>
                    ) : isPending ? (
                      <button
                        type="button"
                        disabled
                        className="h-9 px-3.5 rounded-xl bg-zinc-900 text-zinc-500 border border-zinc-800 text-xs font-medium cursor-not-allowed opacity-80"
                      >
                        Chờ duyệt
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleJoinGroup(group.id, e)}
                        className="h-9 px-3.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium shadow-sm transition-all active:scale-95 flex items-center gap-1"
                      >
                        <span>{group.requiresApproval ? "Gửi yêu cầu" : "Tham gia"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <div className="space-y-6">
                {/* 1. TRẠM CỘNG ĐỒNG CỦA BẠN (ĐÃ THAM GIA) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                      <CheckCircle2 size={14} className="text-zinc-400" />
                      <span>Trạm cộng đồng của bạn (Đã tham gia)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono tabular-nums">
                        {myJoinedGroups.length}
                      </span>
                    </div>
                  </div>

                  {myJoinedGroups.length === 0 ? (
                    <div className="p-5 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 text-center text-zinc-500 text-xs">
                      Bạn chưa tham gia cộng đồng nào. Hãy khám phá và gia nhập bên dưới!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                      {myJoinedGroups.map(group => renderGroupCard(group))}
                    </div>
                  )}
                </div>

                {/* 2. ĐỀ XUẤT ĐỒNG ĐIỆU */}
                {suggestedGroups.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                        <Sparkles size={14} className="text-zinc-400" />
                        <span>Đề xuất đồng điệu</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono tabular-nums">
                          {suggestedGroups.length}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                      {suggestedGroups.map(group => renderGroupCard(group))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL TẠO CỘNG ĐỒNG MỚI                                   */}
      {/* ========================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setIsCreateOpen(false)}>
          <div 
            className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800/90 p-5 sm:p-6 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-zinc-300" />
                <h3 className="text-zinc-100 font-bold text-sm tracking-tight">Tạo Không Gian Cộng Đồng Mới</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-zinc-300 text-xs font-semibold mb-1">Tên cộng đồng *</label>
                <input 
                  type="text" 
                  placeholder="VD: Hội Yêu Thích Lo-Fi, Lập Trình Viên..."
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-700 placeholder-zinc-500"
                />
              </div>

              {/* CUSTOM DROPDOWN CHO DANH MỤC TRONG MODAL */}
              <div className="relative">
                <label className="block text-zinc-300 text-xs font-semibold mb-1">Danh mục chuyên biệt</label>
                <button
                  type="button"
                  onClick={() => setIsCreateCategoryDropdownOpen(!isCreateCategoryDropdownOpen)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white flex items-center justify-between focus:outline-none focus:border-zinc-700"
                >
                  <span>
                    {categories.find(c => c.slug === createForm.categoryCode || c.id === createForm.categoryId)?.name || 'Chung • Mọi chủ đề'}
                  </span>
                  <ChevronDown size={14} className="text-zinc-400" />
                </button>
                {isCreateCategoryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-2xl space-y-0.5 max-h-48 overflow-y-auto custom-dark-scrollbar">
                    {categories.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCreateForm(prev => ({ ...prev, categoryCode: c.slug, categoryId: c.id }));
                          setIsCreateCategoryDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                          createForm.categoryCode === c.slug ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-300 hover:bg-zinc-800/60'
                        }`}
                      >
                        <span>{c.name}</span>
                        {createForm.categoryCode === c.slug && <Check size={12} className="text-white" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-zinc-300 text-xs font-semibold mb-1">Mô tả ngắn</label>
                <textarea 
                  rows="2"
                  placeholder="Mô tả mục tiêu, định hướng và chủ đề của cộng đồng..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-700 placeholder-zinc-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 text-xs font-semibold mb-1">Nội quy ban đầu</label>
                <textarea 
                  rows="2"
                  placeholder="Nguyên tắc tham gia và chia sẻ..."
                  value={createForm.rules}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, rules: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-700 placeholder-zinc-500"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input 
                    type="checkbox" 
                    checked={createForm.requiresApproval}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, requiresApproval: e.target.checked }))}
                    className="rounded bg-zinc-950 border-zinc-800 text-white focus:ring-0"
                  />
                  <span>Bật chế độ phê duyệt (Thành viên cần được Ban quản trị duyệt)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
                <button 
                  type="button" 
                  onClick={() => setIsCreateOpen(false)}
                  className="h-10 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="h-10 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? "Đang khởi tạo..." : "Xác nhận tạo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL MỜI BẠN BÈ VÀO CỘNG ĐỒNG                            */}
      {/* ========================================================= */}
      {isInviteFriendsOpen && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setIsInviteFriendsOpen(false)}>
          <div 
            className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800/90 p-5 shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-zinc-300" />
                <h3 className="text-zinc-100 font-bold text-sm">Mời bạn bè vào {selectedGroup.name}</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsInviteFriendsOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-dark-scrollbar space-y-2 pr-1">
              {(!friends || friends.length === 0) ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  Bạn chưa có bạn bè kết nối nào để mời.
                </div>
              ) : (
                friends.map(fr => {
                  const frId = fr.userId || fr.id;
                  const isInvited = selectedGroup.members?.some(m => m.userId === frId);

                  return (
                    <div key={frId} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs text-white overflow-hidden flex-shrink-0">
                          {fr.avatar ? <img src={fr.avatar} alt="" className="w-full h-full object-cover" /> : (fr.nickname || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-zinc-200 block truncate">{fr.nickname || fr.account}</span>
                          <span className="text-[10px] text-zinc-500 font-mono block truncate">@{fr.account}</span>
                        </div>
                      </div>

                      {isInvited ? (
                        <span className="text-[11px] text-zinc-500 font-mono">Đã tham gia</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleInviteFriend(frId)}
                          disabled={invitingFriendId === frId}
                          className="h-8 px-3 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition-all active:scale-95 disabled:opacity-50"
                        >
                          {invitingFriendId === frId ? "Đang gửi..." : "Gửi lời mời"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL TỪ CHỐI BÀI VIẾT KÈM LÝ DO                          */}
      {/* ========================================================= */}
      {rejectModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setRejectModalPost(null)}>
          <div 
            className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800/90 p-5 shadow-2xl flex flex-col space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle size={18} />
                <h3 className="text-zinc-100 font-bold text-sm">Từ chối xuất bản bài viết</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setRejectModalPost(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Vui lòng chọn lý do từ chối để thông báo phản hồi rõ ràng tới tác giả bài viết:
            </p>

            <div className="space-y-2">
              {systemRejectReasons.map(r => (
                <label 
                  key={r.id} 
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    selectedRejectReason === r.id 
                      ? 'bg-zinc-800/80 border-zinc-600 text-white' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <span className="text-xs">{r.label}</span>
                  <input 
                    type="radio" 
                    name="rejectReason" 
                    value={r.id}
                    checked={selectedRejectReason === r.id}
                    onChange={() => setSelectedRejectReason(r.id)}
                    className="text-white focus:ring-0"
                  />
                </label>
              ))}

              <label 
                className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                  selectedRejectReason === 'CUSTOM' 
                    ? 'bg-zinc-800/80 border-zinc-600 text-white' 
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <span className="text-xs">Lý do khác (Nhập thủ công)</span>
                <input 
                  type="radio" 
                  name="rejectReason" 
                  value="CUSTOM"
                  checked={selectedRejectReason === 'CUSTOM'}
                  onChange={() => setSelectedRejectReason('CUSTOM')}
                  className="text-white focus:ring-0"
                />
              </label>

              {selectedRejectReason === 'CUSTOM' && (
                <textarea 
                  rows="2"
                  value={customRejectReason}
                  onChange={(e) => setCustomRejectReason(e.target.value)}
                  placeholder="Nhập lý do chi tiết..."
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-zinc-600 resize-none"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button 
                type="button" 
                onClick={() => setRejectModalPost(null)}
                className="h-9 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                type="button" 
                onClick={handleConfirmRejectPost}
                disabled={isRejecting}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-all active:scale-95 disabled:opacity-50 shadow-sm"
              >
                {isRejecting ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL BÁO CÁO CỘNG ĐỒNG VI PHẠM                           */}
      {/* ========================================================= */}
      {isReportModalOpen && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setIsReportModalOpen(false)}>
          <div 
            className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800/90 p-5 shadow-2xl flex flex-col space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-rose-400">
                <Flag size={18} />
                <h3 className="text-zinc-100 font-bold text-sm">Báo cáo cộng đồng vi phạm</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsReportModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Báo cáo của bạn sẽ được gửi ẩn danh trực tiếp đến Super Admin hệ thống để điều tra và xử lý vi phạm.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-zinc-400 block mb-1">Lý do vi phạm</label>
              <select 
                value={reportReason} 
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
              >
                <option value="SPAM">Phát tán Spam / Lừa đảo / Quảng cáo rác</option>
                <option value="HARASSMENT">Quấy rối / Công kích cá nhân / Thù địch</option>
                <option value="INAPPROPRIATE">Nội dung phản cảm / Độc hại</option>
                <option value="COPYRIGHT">Vi phạm bản quyền sở hữu trí tuệ</option>
                <option value="OTHER">Lý do khác</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-zinc-400 block mb-1">Mô tả thêm (Tùy chọn)</label>
              <textarea 
                rows="3"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Cung cấp thêm chi tiết hoặc bằng chứng vi phạm..."
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-zinc-700 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button 
                type="button" 
                onClick={() => setIsReportModalOpen(false)}
                className="h-9 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                type="button" 
                onClick={handleSendCommunityReport}
                disabled={isSubmittingReport}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-all active:scale-95 disabled:opacity-50 shadow-sm"
              >
                {isSubmittingReport ? "Đang gửi..." : "Gửi báo cáo"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CommunitySection;
