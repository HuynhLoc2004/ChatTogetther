import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Shield, Crown, CheckCircle2, XCircle, 
  Settings, LogOut, Trash2, Camera, Lock, Globe, FileText, ChevronRight, X,
  ArrowLeft, MessageSquare, PhoneCall, Radio, Send, Image as ImageIcon,
  Heart, MessageCircle, Sparkles, Flame, Check, CornerDownRight, Play, Pause,
  Volume2, Share2, MoreVertical, UserPlus, Flag, Mic, Square, RotateCcw, Star,
  Sliders, Edit3, AlertTriangle, Layers
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import GroupCollageAvatar from './GroupCollageAvatar';
import toast from 'react-hot-toast';

const COMMUNITY_CATEGORIES = [
  { id: 'all', label: 'Tất cả cộng đồng' },
  { id: 'music', label: 'Âm nhạc & Lo-Fi' },
  { id: 'tech', label: 'Học tập & Tech' },
  { id: 'lifestyle', label: 'Tâm sự & Chill' },
  { id: 'game', label: 'Game & Giải trí' }
];

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

  // Nhóm đang mở xem chi tiết
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('feed'); // 'feed' | 'voice' | 'members' | 'rules' | 'settings' | 'moderation'

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
  const mediaRecorderRef = React.useRef(null);
  const voiceTimerRef = React.useRef(null);
  const voiceChunksRef = React.useRef([]);
  const recordedAudioRef = React.useRef(null);

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
    avatarUrl: '',
    coverUrl: ''
  });
  const [isSavingGroupInfo, setIsSavingGroupInfo] = useState(false);

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
    coverUrl: '',
    avatarUrl: '',
    isPrivate: false,
    requiresApproval: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chỉnh sửa quy định
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [editRulesText, setEditRulesText] = useState('');

  // Nạp danh sách cộng đồng
  const fetchGroups = async (kw = '') => {
    try {
      setLoading(true);
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

  // Mở không gian cộng đồng chi tiết
  const handleOpenGroup = async (group) => {
    if (!group) return;
    setSelectedGroup(group);
    setActiveWorkspaceTab('feed');
    fetchGroupDedicatedPosts(group.id);
    setEditGroupForm({
      name: group.name || '',
      description: group.description || '',
      categoryCode: group.categoryCode || 'general',
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
        handleOpenGroup(selectedGroup);
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
    try {
      await axiosClient.delete(`/groups/${selectedGroup.id}`);
      toast.success("Đã giải tán cộng đồng");
      setSelectedGroup(null);
      fetchGroups(searchKeyword);
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
        reason: reportReason,
        description: reportDescription.trim() || undefined
      }).catch(() =>
        axiosClient.post(`/communities/${selectedGroup.id}/report`, {
          reason: reportReason,
          description: reportDescription.trim() || undefined
        })
      );
      toast.success("Báo cáo vi phạm đã được gửi tới Ban quản trị hệ thống!");
      setIsReportModalOpen(false);
      setReportDescription('');
      setReportReason('SPAM');
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi báo cáo lúc này");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // ==========================================
  // QUẢN TRỊ VIÊN: SWITCH TOGGLES & CẬP NHẬT
  // ==========================================
  const handleToggleApproval = async () => {
    if (!selectedGroup) return;
    try {
      const newVal = !selectedGroup.requiresApproval;
      await axiosClient.put(`/groups/${selectedGroup.id}`, { requiresApproval: newVal });
      setSelectedGroup(prev => ({ ...prev, requiresApproval: newVal }));
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
      await axiosClient.put(`/groups/${selectedGroup.id}`, { requiresPostApproval: newVal });
      setSelectedGroup(prev => ({ ...prev, requiresPostApproval: newVal }));
      toast.success(newVal ? "Đã bật kiểm duyệt bài viết trước khi xuất bản!" : "Đã cho phép đăng bài tự do!");
      fetchGroups(searchKeyword);
    } catch (e) {
      toast.error("Không thể cập nhật kiểm duyệt bài viết");
    }
  };

  const handleTogglePublicToFeed = async () => {
    if (!selectedGroup) return;
    try {
      const newVal = selectedGroup.isPublicToFeed === false ? true : false;
      await axiosClient.put(`/groups/${selectedGroup.id}`, { isPublicToFeed: newVal });
      setSelectedGroup(prev => ({ ...prev, isPublicToFeed: newVal }));
      toast.success(newVal ? "Đã bật đề xuất bài viết ra Feed chung!" : "Đã tắt đề xuất bài viết ra Feed chung!");
      fetchGroups(searchKeyword);
    } catch (e) {
      toast.error("Không thể cập nhật đề xuất Feed");
    }
  };

  const handleUpdateGroupInfo = async (e) => {
    if (e) e.preventDefault();
    if (!selectedGroup) return;
    try {
      setIsSavingGroupInfo(true);
      const res = await axiosClient.put(`/groups/${selectedGroup.id}`, {
        name: editGroupForm.name || selectedGroup.name,
        description: editGroupForm.description,
        categoryCode: editGroupForm.categoryCode,
        avatarUrl: editGroupForm.avatarUrl || selectedGroup.avatarUrl,
        coverUrl: editGroupForm.coverUrl || selectedGroup.coverUrl
      });
      if (res.data?.data) {
        setSelectedGroup(res.data.data);
        toast.success("Đã cập nhật thông tin cộng đồng!");
        fetchGroups(searchKeyword);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể lưu thông tin");
    } finally {
      setIsSavingGroupInfo(false);
    }
  };

  // Đăng bài thảo luận vào cộng đồng
  const handleCreateGroupPost = async (e) => {
    e.preventDefault();
    if (!groupPostText.trim() && !groupAttachedImage && !voiceBase64) {
      toast.error("Vui lòng nhập nội dung, đính kèm ảnh hoặc ghi âm giọng nói!");
      return;
    }

    try {
      setIsPostingGroup(true);
      const groupTag = `✦ Cộng đồng: ${selectedGroup.name}`;
      
      let payloadMedia = null;
      if (voiceBase64) {
        payloadMedia = JSON.stringify({
          mediaUrl: voiceBase64,
          mediaType: 'voice',
          duration: voiceDuration
        });
      } else if (groupAttachedImage) {
        payloadMedia = JSON.stringify({
          mediaUrl: groupAttachedImage,
          mediaType: 'image'
        });
      }

      const res = await axiosClient.post('/posts', {
        content: groupPostText.trim() || "Thảo luận cộng đồng",
        imageUrl: payloadMedia,
        vibe: groupTag,
        groupId: selectedGroup.id
      });

      if (res.data && res.data.data) {
        if (res.data.data.status === 'PENDING') {
          toast("Bài viết đã gửi, đang chờ Ban quản trị duyệt!", { icon: '⏳' });
        } else {
          toast.success("Đã đăng bài thảo luận vào cộng đồng!");
        }
        setGroupPostText('');
        setGroupAttachedImage(null);
        setVoiceBase64(null);
        setVoiceDuration(0);
        setIsPlayingRecordedVoice(false);
        fetchGroupDedicatedPosts(selectedGroup.id);
        if (setPosts && res.data.data.status === 'APPROVED') {
          setPosts(prev => [res.data.data, ...prev]);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể đăng bài viết lúc này");
    } finally {
      setIsPostingGroup(false);
    }
  };

  // Tham gia hoặc tạo phòng thoại của nhóm
  const handleOpenGroupVoiceRoom = async () => {
    if (!selectedGroup) return;
    if (!navigate) return;

    try {
      const gNameLower = selectedGroup.name.toLowerCase();
      // Tìm phòng thoại đang mở khớp tên cộng đồng
      const existingRoom = (rooms || []).find(r => 
        (r.nameroom || '').toLowerCase().includes(gNameLower)
      );

      if (existingRoom) {
        toast.success(`Đang vào phòng đàm thoại: ${existingRoom.nameroom}`);
        navigate(`/room/${existingRoom.id}`);
        return;
      }

      // Tạo mới phòng đàm thoại mang thương hiệu nhóm
      const roomName = `[Cộng đồng] ${selectedGroup.name}`;
      const res = await axiosClient.post('/rooms/create-room', {
        roomName: roomName,
        password: null
      });

      if (res.data && res.data.data) {
        toast.success(`Đã mở không gian đàm thoại cho nhóm ${selectedGroup.name}!`);
        navigate(`/room/${res.data.data.id}`);
      }
    } catch (err) {
      toast.error("Không thể mở phòng đàm thoại lúc này");
    }
  };

  // Mở chat 1-1 với thành viên nhóm
  const handleDirectChatWithMember = async (member) => {
    if (!navigate) return;
    try {
      const myName = currentUserName || 'Tôi';
      const friendName = member.nickname || member.account || 'Thành viên';
      const roomName = `Chat: ${myName} & ${friendName}`;

      const res = await axiosClient.post('/rooms/create-room', {
        roomName: roomName,
        password: null
      });

      if (res.data && res.data.data) {
        navigate(`/room/${res.data.data.id}`);
      }
    } catch (err) {
      if (onSelectUser) onSelectUser(member.userId);
    }
  };

  // Lọc và kết hợp các bài viết thuộc về cộng đồng đang chọn
  const safeGroupName = String(selectedGroup?.name || '').toLowerCase().trim();
  const groupPosts = React.useMemo(() => {
    const map = new Map();
    groupDedicatedPosts.forEach(p => { if (p && p.id) map.set(p.id, p); });
    (posts || []).forEach(p => {
      if (!p) return;
      if (selectedGroup && p.groupId && p.groupId.toString() === selectedGroup.id.toString()) {
        map.set(p.id, p);
      } else if (safeGroupName && String(p.vibe || '').toLowerCase().includes(safeGroupName)) {
        map.set(p.id, p);
      }
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [groupDedicatedPosts, posts, selectedGroup, safeGroupName]);

  // Tìm phòng thoại đang mở cho nhóm này
  const activeGroupRoom = safeGroupName ? (rooms || []).find(r => 
    r && String(r.nameroom || '').toLowerCase().includes(safeGroupName)
  ) : null;

  return (
    <div className="community-module-container py-2 text-zinc-100">
      
      {/* ========================================================================= */}
      {/* TRƯỜNG HỢP 1: KHÔNG GIAN LÀM VIỆC CỦA CỘNG ĐỒNG ĐÃ CHỌN (COMMUNITY WORKSPACE) */}
      {/* ========================================================================= */}
            {selectedGroup ? (
        <div className="community-workspace space-y-5 animate-fade-in">
          
          {/* Thanh Breadcrumb / Back Bar trên cùng */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <button 
              type="button"
              onClick={() => setSelectedGroup(null)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-800 transition-all active:scale-95"
            >
              <ArrowLeft size={15} />
              <span>Quay lại danh sách cộng đồng</span>
            </button>

            <div className="flex items-center gap-2">
              {selectedGroup.currentUserRole === 'OWNER' && (
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-300 text-xs font-semibold flex items-center gap-1.5 font-mono">
                  <Crown size={12} /> Chủ nhóm
                </span>
              )}
              {selectedGroup.currentUserRole === 'DEPUTY' && (
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 font-mono">
                  <Shield size={12} /> Phó nhóm
                </span>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* BANNER CỘNG ĐỒNG GỌN GÀNG & ĐỒNG BỘ MÀU SẮC (DARK ZINC)         */}
          {/* ============================================================== */}
          <div className="rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-xl">
            {/* Banner Cover thu gọn h-28 sm:h-36 */}
            <div className="h-28 sm:h-36 relative bg-gradient-to-r from-zinc-900 via-zinc-900/95 to-zinc-950 border-b border-zinc-800 overflow-hidden">
              {selectedGroup.coverUrl ? (
                <img src={selectedGroup.coverUrl} alt={selectedGroup.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full opacity-30 bg-[radial-gradient(#52525b_1px,transparent_1px)] [background-size:16px_16px]"></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/95 via-transparent to-black/30"></div>
              
              {/* Nút icon Báo cáo nhóm (Flag) ở góc trên banner */}
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-zinc-950/70 hover:bg-zinc-900 text-zinc-400 hover:text-rose-400 border border-zinc-800/80 backdrop-blur-md transition-all active:scale-95 flex items-center gap-1.5 text-xs z-10"
                title="Báo cáo vi phạm cộng đồng"
              >
                <Flag size={13} />
                <span className="hidden sm:inline">Báo cáo</span>
              </button>
            </div>

            {/* Thông tin chính & Hàng nút hành động chuẩn quy cách */}
            <div className="px-5 sm:px-6 pb-5 pt-0 relative">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 mb-4">
                <div className="flex items-end gap-3.5">
                  <GroupCollageAvatar 
                    avatar={selectedGroup.avatarUrl} 
                    name={selectedGroup.name}
                    size={72}
                    className="border-4 border-zinc-900 shadow-xl ring-1 ring-zinc-800 rounded-2xl flex-shrink-0"
                  />
                  <div className="pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-zinc-100 font-bold text-lg sm:text-xl tracking-tight leading-snug">
                        {selectedGroup.name}
                      </h1>
                      {selectedGroup.isFeatured && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-mono flex items-center gap-1">
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          <span>Nổi bật</span>
                        </span>
                      )}
                      {selectedGroup.categoryCode && (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 text-[10px] font-mono">
                          #{selectedGroup.categoryCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
                      <span>{selectedGroup.membersCount || groupDetail?.members?.length || 1} thành viên</span>
                      <span>•</span>
                      <span className={activeGroupRoom ? "text-emerald-400 font-semibold flex items-center gap-1" : "text-zinc-400"}>
                        {activeGroupRoom && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>}
                        {activeGroupRoom ? 'Đang có phòng thoại trực tiếp' : 'Sẵn sàng kết nối'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hàng nút hành động: Nút chính trắng sắc nét & Nút phụ tối viền mảnh */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Nút phụ: Mời bạn bè */}
                  <button 
                    type="button"
                    onClick={() => setIsInviteFriendsOpen(true)}
                    className="px-3.5 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-800 transition-all active:scale-95 flex items-center gap-2"
                    title="Mời bạn bè vào cộng đồng"
                  >
                    <UserPlus size={14} />
                    <span>Mời bạn bè</span>
                  </button>

                  {/* Nút phụ: Rời nhóm (nếu là member) */}
                  {selectedGroup.currentUserRole === 'MEMBER' && (
                    <button 
                      type="button"
                      onClick={() => handleLeaveGroup(selectedGroup.id)}
                      className="px-3.5 h-10 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-400 border border-zinc-800 text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <LogOut size={13} />
                      <span>Rời nhóm</span>
                    </button>
                  )}

                  {/* Nút chính: Trắng sắc nét (bg-white text-zinc-950) */}
                  {!selectedGroup.currentUserRole ? (
                    <button 
                      type="button"
                      onClick={() => handleJoinGroup(selectedGroup.id)}
                      className="px-4 h-10 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                      <Plus size={15} />
                      <span>Gia nhập cộng đồng</span>
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={handleOpenGroupVoiceRoom}
                      className="px-4 h-10 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                      <Radio size={14} className={activeGroupRoom ? "text-emerald-600 animate-pulse" : "text-zinc-950"} />
                      <span>{activeGroupRoom ? "Tham gia phòng thoại" : "Mở phòng thoại nhóm"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Mô tả nhóm */}
              <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed max-w-3xl pt-1">
                {selectedGroup.description || 'Chào mừng bạn đến với cộng đồng. Cùng chia sẻ góc nhìn và tham gia các buổi đàm thoại bổ ích!'}
              </p>

              {/* Rút gọn còn ĐÚNG 4 tab, ẩn hoàn toàn thanh cuộn ngang */}
              <div className="flex items-center gap-1.5 pt-4 mt-3 border-t border-zinc-800/80 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button 
                  type="button"
                  onClick={() => setActiveWorkspaceTab('feed')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${activeWorkspaceTab === 'feed' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  <MessageSquare size={14} />
                  <span>Thảo luận ({groupPosts.length})</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setActiveWorkspaceTab('voice')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${activeWorkspaceTab === 'voice' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  <Radio size={14} />
                  <span>Phòng thoại</span>
                  {activeGroupRoom && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  )}
                </button>

                <button 
                  type="button"
                  onClick={() => setActiveWorkspaceTab('members')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${activeWorkspaceTab === 'members' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  <Users size={14} />
                  <span>Thành viên ({groupDetail?.members?.length || selectedGroup.membersCount || 1})</span>
                </button>

                {['OWNER', 'DEPUTY'].includes(groupDetail?.currentUserRole || selectedGroup.currentUserRole) && (
                  <button 
                    type="button"
                    onClick={() => {
                      setActiveWorkspaceTab('settings');
                      fetchPendingMembers(selectedGroup.id);
                      fetchPendingPosts(selectedGroup.id);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${activeWorkspaceTab === 'settings' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <Settings size={14} />
                    <span>Quản trị</span>
                    {(pendingMembers.length > 0 || pendingPosts.length > 0) && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">
                        {pendingMembers.length + pendingPosts.length}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* TAB 1: BẢNG TIN THẢO LUẬN (FEED TRONG NHÓM) */}
          {/* ========================================================= */}
          {activeWorkspaceTab === 'feed' && (
            <div className="space-y-4">
              
              {/* Thẻ Phòng thoại nhóm đang mở (Audio-First 1-click) */}
              {activeGroupRoom && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border border-emerald-500/30 flex items-center justify-between gap-4 shadow-xl animate-fade-in">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <Radio size={20} className="animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-100">{activeGroupRoom.nameroom}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                          Trực tiếp
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                        {activeGroupRoom.soluong || (activeGroupRoom.userRoomDTOList?.length || 1)} thành viên đang kết nối âm thanh
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/room/${activeGroupRoom.id}`)}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 flex-shrink-0"
                  >
                    <span>Vào phòng nghe ngay</span>
                  </button>
                </div>
              )}

              {/* Box soạn thảo bài viết dành riêng cho nhóm (Hỗ trợ Ảnh & Ghi âm 15s) */}
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm">
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
                      className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed"
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

                    {/* Trạng thái đang ghi âm */}
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
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition-all active:scale-95"
                          >
                            {isPlayingRecordedVoice ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
                          </button>
                          <span className="text-xs font-mono text-emerald-400">Tín hiệu ghi âm ({voiceDuration}s)</span>
                          <audio
                            ref={recordedAudioRef}
                            src={voiceBase64}
                            onEnded={() => setIsPlayingRecordedVoice(false)}
                            className="hidden"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={cancelRecordingVoice}
                          className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 transition-colors"
                          title="Xóa bản ghi âm"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 mt-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 transition-all border border-zinc-700/60">
                          <ImageIcon size={13} />
                          <span>Ảnh</span>
                          <input 
                            type="file" 
                            accept="image/*"
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => setGroupAttachedImage(ev.target.result);
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>

                        {/* Nút Ghi âm 15s */}
                        {!isRecordingVoice && !voiceBase64 && (
                          <button
                            type="button"
                            onClick={startRecordingVoice}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 transition-all border border-zinc-700/60"
                            title="Ghi âm giọng nói 15s"
                          >
                            <Mic size={13} />
                            <span>Ghi âm 15s</span>
                          </button>
                        )}

                        <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
                          Tag: ✦ {selectedGroup.name}
                        </span>
                      </div>

                      <button 
                        type="button"
                        onClick={handleCreateGroupPost}
                        disabled={isPostingGroup || (!groupPostText.trim() && !groupAttachedImage && !voiceBase64)}
                        className="px-4 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-40"
                      >
                        {isPostingGroup ? "Đang gửi..." : "Đăng thảo luận"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Danh sách bài viết thảo luận */}
              {groupPosts.length === 0 ? (
                <div className="py-14 px-4 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60">
                  <MessageSquare size={32} className="mx-auto mb-2 text-zinc-600 opacity-60" />
                  <p className="text-zinc-300 text-sm font-semibold mb-1">Chưa có bài thảo luận nào trong cộng đồng này</p>
                  <p className="text-zinc-500 text-xs max-w-md mx-auto">
                    Hãy là thành viên đầu tiên mở bát chủ đề thảo luận hoặc chia sẻ góc nhìn thú vị cùng mọi người!
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {groupPosts.map(post => (
                    <div 
                      key={post.id} 
                      className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-3 shadow-sm"
                    >
                      {/* Post Header */}
                      <div className="flex items-start justify-between">
                        <div 
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => {
                            if (onSelectUser) onSelectUser(post.authorId || post.userId);
                          }}
                        >
                          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs text-white overflow-hidden border border-zinc-700 flex-shrink-0">
                            {post.authorAvatar ? (
                              <img src={post.authorAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (post.authorNickname || post.authorAccount || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-zinc-200 hover:underline">
                                {post.authorNickname || post.authorAccount}
                              </span>
                              {post.authorBadge && (
                                <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 text-[10px] font-mono border border-zinc-700">
                                  {post.authorBadge}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">
                              {post.formattedTime || post.createdAt || 'Vừa xong'}
                            </span>
                          </div>
                        </div>

                        {post.vibe && (
                          <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-lg border border-zinc-700/50">
                            {post.vibe}
                          </span>
                        )}
                      </div>

                      {/* Post Content */}
                      <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                        {post.content}
                      </p>

                      {/* Post Media (Ảnh hoặc Voice player) */}
                      {post.imageUrl && (
                        (() => {
                          try {
                            const parsed = JSON.parse(post.imageUrl);
                            if (parsed.mediaType === 'voice') {
                              return (
                                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 max-w-sm flex items-center gap-3">
                                  <Volume2 size={16} className="text-emerald-400 flex-shrink-0" />
                                  <audio src={parsed.mediaUrl} controls className="w-full h-8" />
                                </div>
                              );
                            }
                            return (
                              <div className="rounded-xl overflow-hidden border border-zinc-800 max-h-96">
                                <img src={parsed.mediaUrl || post.imageUrl} alt="" className="w-full object-cover" />
                              </div>
                            );
                          } catch {
                            return (
                              <div className="rounded-xl overflow-hidden border border-zinc-800 max-h-96">
                                <img src={post.imageUrl} alt="" className="w-full object-cover" />
                              </div>
                            );
                          }
                        })()
                      )}

                      {/* Footer Actions */}
                      <div className="flex items-center gap-4 pt-2 border-t border-zinc-800/60 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Heart size={14} className="text-rose-500 fill-rose-500" />
                          <span>{post.likesCount || 0}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={14} />
                          <span>{post.commentsCount || 0}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: PHÒNG ĐÀM THOẠI (LIVE VOICE ROOMS) */}
          {/* ========================================================= */}
          {activeWorkspaceTab === 'voice' && (
            <div className="space-y-4">
              {activeGroupRoom ? (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span className="text-emerald-400 font-mono text-xs font-semibold uppercase tracking-wider">
                          Phòng thoại đang trực tiếp
                        </span>
                      </div>
                      <h3 className="text-zinc-100 font-bold text-base mb-1">{activeGroupRoom.nameroom}</h3>
                      <p className="text-zinc-400 text-xs font-mono">
                        {activeGroupRoom.soluong || (activeGroupRoom.userRoomDTOList?.length || 1)} thành viên đang kết nối âm thanh
                      </p>
                    </div>

                    <button 
                      type="button"
                      onClick={() => navigate(`/room/${activeGroupRoom.id}`)}
                      className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                    >
                      <Radio size={15} />
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
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs shadow-md transition-all active:scale-95"
                  >
                    <Plus size={15} />
                    <span>Mở phòng đàm thoại nhóm ngay</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: THÀNH VIÊN CỘNG ĐỒNG */}
          {/* ========================================================= */}
          {activeWorkspaceTab === 'members' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2">
                <span className="text-zinc-400 text-xs font-mono uppercase tracking-wider">
                  Tổng số {groupDetail?.members?.length || 1} thành viên
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
                          if (onSelectUser) onSelectUser(member.userId);
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
                            <span className="text-zinc-100 font-semibold text-xs truncate">{member.nickname}</span>
                            {isOwner && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold font-mono">
                                Chủ nhóm
                              </span>
                            )}
                            {isDeputy && (
                              <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-bold font-mono">
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
                            title="Nhắn tin 1-1"
                          >
                            <MessageCircle size={13} />
                            <span className="hidden sm:inline">Nhắn tin</span>
                          </button>
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
          {activeWorkspaceTab === 'settings' && ['OWNER', 'DEPUTY'].includes(groupDetail?.currentUserRole || selectedGroup.currentUserRole) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              
              {/* THẺ 1: CẤU HÌNH PHÊ DUYỆT & ĐỀ XUẤT (SWITCH TOGGLES) */}
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
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
                    <span className="text-[11px] text-zinc-400 block mt-0.5">Yêu cầu quản trị viên phê duyệt trước khi truy cập đầy đủ</span>
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

              {/* THẺ 2: CHỈNH SỬA THÔNG TIN & DANH MỤC */}
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
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
                  <div>
                    <label className="text-[11px] font-mono text-zinc-400 block mb-1">Danh mục chuyên biệt</label>
                    <select
                      value={editGroupForm.categoryCode}
                      onChange={(e) => setEditGroupForm(prev => ({ ...prev, categoryCode: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                    >
                      <option value="general">Chung • Mọi chủ đề</option>
                      <option value="music">Âm nhạc & Lo-Fi Lounge</option>
                      <option value="tech">Học tập & Công nghệ</option>
                      <option value="lifestyle">Tâm sự & Lối sống</option>
                      <option value="game">Gaming & Giải trí</option>
                    </select>
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
                      className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSavingGroupInfo ? "Đang lưu..." : "Lưu cập nhật"}
                    </button>
                  </div>
                </form>
              </div>

              {/* THẺ 3: HÀNG ĐỢI PHÊ DUYỆT (THÀNH VIÊN & BÀI VIẾT) */}
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
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
                      className={`px-2 py-0.5 rounded-md transition-all ${adminSubTab === 'members_queue' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'}`}
                    >
                      Thành viên ({pendingMembers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminSubTab('posts_queue')}
                      className={`px-2 py-0.5 rounded-md transition-all ${adminSubTab === 'posts_queue' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'}`}
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
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
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

        /* ========================================================================= */
        /* TRƯỜNG HỢP 2: KHÁM PHÁ CÁC CỘNG ĐỒNG (COMMUNITY DISCOVERY SHOWCASE)       */
        /* ========================================================================= */
        <div className="space-y-6 animate-fade-in">
          
          {/* Header Banner Khám phá */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-md">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h2 className="text-zinc-100 font-bold text-lg sm:text-xl tracking-tight">Cộng Đồng & Không Gian Thảo Luận</h2>
              </div>
              <p className="text-zinc-400 text-xs sm:text-sm font-sans max-w-xl">
                Khám phá các cộng đồng theo gu âm nhạc, sở thích và chuyên môn. Tham gia phòng đàm thoại và trao đổi trực tiếp!
              </p>
            </div>

            <button 
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow-md transition-all active:scale-95 flex-shrink-0"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Tạo cộng đồng mới</span>
            </button>
          </div>

          {/* Search Bar & Category Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Tìm kiếm cộng đồng theo tên, chủ đề hoặc mô tả..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {COMMUNITY_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${activeCategory === cat.id ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm' : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-zinc-200'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Groups */}
          {loading ? (
            <div className="py-20 text-center text-zinc-500 text-xs font-mono">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin mx-auto mb-2"></div>
              <span>Đang tải các không gian cộng đồng...</span>
            </div>
          ) : (!Array.isArray(groups) || groups.length === 0) ? (
            <div className="py-16 px-4 text-center rounded-3xl bg-[#141414] border border-[#1e1e1e]">
              <Users size={36} className="mx-auto mb-3 text-zinc-600 opacity-60" />
              <p className="text-zinc-300 text-sm font-semibold mb-1">Chưa có cộng đồng nào phù hợp</p>
              <p className="text-zinc-500 text-xs mb-4">Hãy là người đầu tiên sáng lập một cộng đồng mới ngay hôm nay!</p>
              <button 
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-md transition-all active:scale-95"
              >
                <Plus size={14} /> Tạo cộng đồng ngay
              </button>
            </div>
          ) : (() => {
            const allList = Array.isArray(groups) ? groups : [];
            const myJoinedGroups = allList.filter(g => ['OWNER', 'DEPUTY', 'MEMBER'].includes(g.currentUserRole));
            const suggestedGroups = allList.filter(g => !['OWNER', 'DEPUTY', 'MEMBER'].includes(g.currentUserRole));

            const renderGroupCard = (group, isJoined) => {
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
                  className="group-card relative rounded-3xl bg-[#141414] border border-[#1e1e1e] hover:border-[#2a2a2a] overflow-hidden cursor-pointer transition-all hover:shadow-lg flex flex-col justify-between"
                >
                  {/* Cover Banner */}
                  <div className="h-24 relative bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 overflow-hidden">
                    {group.coverUrl ? (
                      <img src={group.coverUrl} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full opacity-20 bg-[radial-gradient(#52525b_1px,transparent_1px)] [background-size:14px_14px]"></div>
                    )}
                    
                    {/* Badges on Top Right */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      {hasVoiceRoom && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 backdrop-blur-md border border-emerald-500/30 text-[10px] font-mono text-emerald-400 flex items-center gap-1 font-medium">
                          <Radio size={10} className="animate-pulse" /> Đang voice
                        </span>
                      )}
                      {group.requiresApproval ? (
                        <span className="px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-amber-500/30 text-[10px] font-mono text-amber-400 flex items-center gap-1">
                          <Lock size={9} /> Cần duyệt
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-zinc-700 text-[10px] font-mono text-zinc-300 flex items-center gap-1">
                          <Globe size={9} /> Công khai
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content Body */}
                  <div className="p-4 sm:p-5 pt-0 relative flex-1 flex flex-col justify-between">
                    <div className="flex items-end justify-between -mt-6 mb-3">
                      <GroupCollageAvatar 
                        avatar={group.avatarUrl} 
                        name={group.name}
                        size={52}
                        className="border-2 border-[#141414] ring-1 ring-zinc-700 shadow-md rounded-2xl"
                      />

                      {/* Role Badge */}
                      {isOwner && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                          <Crown size={10} /> Chủ nhóm
                        </span>
                      )}
                      {isDeputy && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold flex items-center gap-1">
                          <Shield size={10} /> Phó nhóm
                        </span>
                      )}
                      {isMember && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-medium">
                          Đã tham gia
                        </span>
                      )}
                      {isPending && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-950/40 border border-amber-500/30 text-amber-400 text-[10px] font-medium">
                          Đang chờ duyệt
                        </span>
                      )}
                    </div>

                    <div className="mb-3">
                      <h3 className="text-zinc-100 font-bold text-sm mb-1 line-clamp-1">{group.name}</h3>
                      <p className="text-zinc-400 text-xs font-sans line-clamp-2 leading-relaxed">
                        {group.description || 'Không gian thảo luận và giao lưu dành cho các thành viên.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#1e1e1e] text-xs">
                      <div className="flex items-center gap-2 text-zinc-500 font-mono text-[11px]">
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {group.membersCount || 1}
                        </span>
                        <span>•</span>
                        <span className="text-zinc-400">
                          {hasVoiceRoom ? 'Phòng thoại mở' : 'Sẵn sàng'}
                        </span>
                      </div>

                      {isMember || isOwner || isDeputy ? (
                        <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1 hover:text-white">
                          Vào nhóm <ChevronRight size={14} />
                        </span>
                      ) : isPending ? (
                        <span className="text-xs text-amber-400 font-medium">
                          Chờ duyệt...
                        </span>
                      ) : (
                        <button 
                          type="button"
                          onClick={(e) => handleJoinGroup(group.id, e)}
                          className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-all active:scale-95"
                        >
                          Gia nhập
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <div className="space-y-6">
                {/* 1. CỘNG ĐỒNG CỦA BẠN (ĐÃ THAM GIA) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      <span>Cộng đồng của bạn (Đã tham gia)</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        {myJoinedGroups.length}
                      </span>
                    </div>
                  </div>

                  {myJoinedGroups.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#141414]/60 border border-dashed border-[#222222] text-center text-zinc-500 text-xs">
                      Bạn chưa tham gia cộng đồng nào. Hãy khám phá và gia nhập các cộng đồng đề xuất bên dưới!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {myJoinedGroups.map(group => renderGroupCard(group, true))}
                    </div>
                  )}
                </div>

                {/* 2. CỘNG ĐỒNG ĐỀ XUẤT CHO BẠN */}
                {suggestedGroups.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>Khám phá & Đề xuất cộng đồng</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
                          {suggestedGroups.length}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {suggestedGroups.map(group => renderGroupCard(group, false))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL TẠO CỘNG ĐỒNG MỚI */}
      {/* ========================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setIsCreateOpen(false)}>
          <div 
            className="relative w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl flex flex-col"
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 placeholder-zinc-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 text-xs font-semibold mb-1">Mô tả ngắn</label>
                <textarea 
                  rows="2"
                  placeholder="Mô tả mục tiêu, định hướng và chủ đề của cộng đồng..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 placeholder-zinc-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 text-xs font-semibold mb-1">Quy định / Nội quy ban đầu</label>
                <textarea 
                  rows="2"
                  placeholder="Nguyên tắc tham gia và chia sẻ..."
                  value={createForm.rules}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, rules: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 placeholder-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 text-xs font-semibold mb-1">Link ảnh bìa (Cover)</label>
                  <input 
                    type="url" 
                    placeholder="https://..."
                    value={createForm.coverUrl}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, coverUrl: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 placeholder-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 text-xs font-semibold mb-1">Link ảnh đại diện</label>
                  <input 
                    type="url" 
                    placeholder="https://..."
                    value={createForm.avatarUrl}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, avatarUrl: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 placeholder-zinc-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input 
                    type="checkbox" 
                    checked={createForm.requiresApproval}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, requiresApproval: e.target.checked }))}
                    className="rounded bg-zinc-950 border-zinc-700 text-emerald-500 focus:ring-0"
                  />
                  <span>Bật chế độ phê duyệt (Thành viên cần được Chủ/Phó nhóm duyệt mới được vào)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
                <button 
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? "Đang tạo..." : "Tạo cộng đồng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL TỪ CHỐI BÀI VIẾT KÈM LÝ DO (ĐỘNG KHÔNG FIX CỨNG) */}
      {/* ========================================================= */}
      {rejectModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setRejectModalPost(null)}>
          <div 
            className="relative w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl flex flex-col space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <XCircle size={18} className="text-rose-400" />
                <h3 className="text-zinc-100 font-bold text-sm">Lý Do Từ Chối Bài Viết</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setRejectModalPost(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-zinc-400 text-xs leading-relaxed">
              Vui lòng chọn hoặc nhập lý do từ chối để thông báo minh bạch cho tác giả bài viết:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {systemRejectReasons.map(r => (
                <label 
                  key={r.id} 
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedRejectReason === r.id 
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold' 
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="reject_reason" 
                    value={r.id}
                    checked={selectedRejectReason === r.id}
                    onChange={() => setSelectedRejectReason(r.id)}
                    className="accent-rose-500"
                  />
                  <span>{r.label}</span>
                </label>
              ))}

              <label 
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  selectedRejectReason === 'CUSTOM' 
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold' 
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60'
                }`}
              >
                <input 
                  type="radio" 
                  name="reject_reason" 
                  value="CUSTOM"
                  checked={selectedRejectReason === 'CUSTOM'}
                  onChange={() => setSelectedRejectReason('CUSTOM')}
                  className="accent-rose-500"
                />
                <span>Lý do tùy chỉnh khác...</span>
              </label>
            </div>

            {selectedRejectReason === 'CUSTOM' && (
              <textarea 
                rows="3"
                value={customRejectReason}
                onChange={(e) => setCustomRejectReason(e.target.value)}
                placeholder="Nhập lý do chi tiết từ chối bài viết..."
                className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-rose-500"
              />
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button 
                type="button"
                onClick={() => setRejectModalPost(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Hủy
              </button>
              <button 
                type="button"
                onClick={handleConfirmRejectPost}
                disabled={isRejecting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {isRejecting ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL MỜI BẠN BÈ VÀO CỘNG ĐỒNG */}
      {/* ========================================================= */}
      {isInviteFriendsOpen && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setIsInviteFriendsOpen(false)}>
          <div 
            className="relative w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-indigo-400" />
                <h3 className="text-zinc-100 font-bold text-sm">Mời Bạn Bè Vào {selectedGroup.name}</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsInviteFriendsOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-zinc-400 text-xs leading-relaxed">
              Chọn bạn bè thân thiết từ danh sách kết nối để mời họ cùng tham gia thảo luận và kết nối trong cộng đồng:
            </p>

            <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
              {!friends || friends.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  Bạn chưa có bạn bè nào trong danh sách kết nối. Hãy kết bạn ở Sảnh trực tuyến trước nhé!
                </div>
              ) : (
                friends.map(friend => {
                  const friendId = friend.id || friend.userId;
                  const isAlreadyMember = groupDetail?.members?.some(m => m.userId === friendId) || false;

                  return (
                    <div key={friendId} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-200 overflow-hidden">
                          {friend.avatar ? (
                            <img src={friend.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (friend.nickname || friend.account || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-zinc-200">{friend.nickname || friend.account}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">@{friend.account || 'user'}</div>
                        </div>
                      </div>

                      {isAlreadyMember ? (
                        <span className="text-[11px] font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Đã tham gia
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleInviteFriend(friendId)}
                          disabled={invitingFriendId === friendId}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 shadow-sm"
                        >
                          <UserPlus size={12} />
                          <span>{invitingFriendId === friendId ? 'Đang gửi...' : 'Mời vào'}</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-zinc-800">
              <button 
                type="button"
                onClick={() => setIsInviteFriendsOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
          {/* ============================================================== */}
      {/* MODAL BÁO CÁO VI PHẠM CỘNG ĐỒNG (SUPER ADMIN MODERATION)        */}
      {/* ============================================================== */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Flag size={18} className="text-rose-400" />
                <h3 className="text-sm font-bold text-white">Báo cáo vi phạm cộng đồng</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Bạn đang báo cáo cộng đồng <strong className="text-white">{selectedGroup?.name}</strong> tới Ban quản trị hệ thống Talovin.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Lý do vi phạm</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="SPAM">Spam & Quảng cáo rác trái phép</option>
                  <option value="HARASSMENT">Quấy rối & Công kích thành viên</option>
                  <option value="HATE_SPEECH">Nội dung thù địch, độc hại</option>
                  <option value="INAPPROPRIATE">Nội dung phản cảm, không phù hợp</option>
                  <option value="OTHER">Vi phạm quy định khác</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Chi tiết bổ sung (tùy chọn)</label>
                <textarea
                  rows="3"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Mô tả cụ thể hành vi vi phạm hoặc bằng chứng liên quan..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSendCommunityReport}
                disabled={isSubmittingReport}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
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
