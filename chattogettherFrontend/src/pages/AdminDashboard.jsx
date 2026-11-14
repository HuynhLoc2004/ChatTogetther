import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Users, MessageSquare, Radio, Music, Sparkles, Settings, 
  ArrowLeft, Plus, Trash2, Edit3, Check, X, Search, RefreshCw, 
  Lock, Unlock, Eye, EyeOff, Tag, Compass, Flame, Bookmark, Play, Pause,
  AlertTriangle, CheckCircle2, ChevronRight, Sliders, LayoutGrid,
  ShieldCheck, ShieldAlert, KeyRound, Palette, ExternalLink, Layers,
  FolderCog, Save, UserCheck, ShieldPlus, LogOut, Menu, Globe,
  FileText, Repeat, RotateCcw, AlertOctagon, Heart, Signal, Disc3
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import TalovinLogo from '../components/TalovinLogo';

// ==========================================
// ĐỊNH NGHĨA HỆ THỐNG QUYỀN HẠN & VAI TRÒ CHUẨN (RBAC)
// ==========================================
export const SYSTEM_PERMISSIONS = [
  { id: 'TL_PERM_STATS_VIEW', name: 'Xem Tổng quan & Số liệu', module: 'Hệ thống', description: 'Xem các chỉ số thời gian thực và thống kê hệ thống' },
  { id: 'TL_PERM_BRAND_MANAGE', name: 'Quản lý Menu & Thương hiệu', module: 'Hệ thống', description: 'Chỉnh sửa Tên app, Slogan, Logo và cấu hình ẩn/hiện Menu điều hướng' },
  { id: 'TL_PERM_CHALLENGE_MANAGE', name: 'Quản lý Thẻ bài & Thể loại', module: 'Nội dung', description: 'Toàn quyền thêm, sửa, xóa thẻ bài thử thách và danh mục thể loại' },
  { id: 'TL_PERM_TOPIC_MANAGE', name: 'Quản lý Chủ đề & Cảm xúc', module: 'Nội dung', description: 'Cấu hình các thẻ cảm xúc (Vibes) và chủ đề sảnh trực tuyến' },
  { id: 'TL_PERM_MUSIC_MANAGE', name: 'Quản lý Âm nhạc hệ thống', module: 'Nội dung', description: 'Thêm, phát thử nghiệm và xóa các bản nhạc nền thư giãn' },
  { id: 'TL_PERM_COMMUNITY_MANAGE', name: 'Quản lý Cộng đồng & Nhóm', module: 'Nội dung', description: 'Quản trị nhóm, bật/tắt đề xuất Feed, duyệt bài và danh mục lý do từ chối' },
  { id: 'TL_PERM_USER_MANAGE', name: 'Quản lý Tài khoản & Kiểm duyệt', module: 'Bảo mật', description: 'Tìm kiếm, xem hồ sơ thành viên và khóa/mở khóa tài khoản' },
  { id: 'TL_PERM_ROLE_MANAGE', name: 'Quản lý Vai trò & Phân quyền', module: 'Bảo mật', description: 'Tạo vai trò tùy biến mới và cấp phát quyền hạn chi tiết cho từng người' }
];

export const DEFAULT_ROLES = [
  { 
    id: 'TL_SYS_SUPERADMIN', 
    name: 'Quản trị viên tối cao', 
    description: 'Toàn quyền quản trị và vận hành toàn bộ hệ thống Talovin', 
    permissions: ['TL_PERM_ALL'], 
    badgeColor: '#ef4444' 
  },
  { 
    id: 'TL_ROLE_CONTENT_EDITOR', 
    name: 'Biên tập viên nội dung', 
    description: 'Quản lý thẻ bài thử thách và các chủ đề thảo luận', 
    permissions: ['TL_PERM_STATS_VIEW', 'TL_PERM_CHALLENGE_MANAGE', 'TL_PERM_TOPIC_MANAGE'], 
    badgeColor: '#818cf8' 
  },
  { 
    id: 'TL_ROLE_COMMUNITY_MOD', 
    name: 'Kiểm duyệt viên cộng đồng', 
    description: 'Quản lý thành viên, kiểm tra và xử lý vi phạm', 
    permissions: ['TL_PERM_STATS_VIEW', 'TL_PERM_USER_MANAGE'], 
    badgeColor: '#10b981' 
  },
  { 
    id: 'TL_ROLE_BRAND_MANAGER', 
    name: 'Quản lý thương hiệu & Menu', 
    description: 'Cấu hình menu, tên ứng dụng và logo nhận diện', 
    permissions: ['TL_PERM_STATS_VIEW', 'TL_PERM_BRAND_MANAGE'], 
    badgeColor: '#f59e0b' 
  },
  { 
    id: 'TL_ROLE_MEDIA_CURATOR', 
    name: 'Điều phối viên âm nhạc', 
    description: 'Quản lý danh sách bài hát và kho nhạc nền sảnh', 
    permissions: ['TL_PERM_STATS_VIEW', 'TL_PERM_MUSIC_MANAGE'], 
    badgeColor: '#ec4899' 
  }
];

export const DEFAULT_CHALLENGE_CATEGORIES = [
  { id: 'DEEP_TALK', name: 'Tâm sự sâu lắng', color: '#818cf8' },
  { id: 'TRUTH', name: 'Thú nhận (Truth)', color: '#f43f5e' },
  { id: 'DARE', name: 'Thử thách vui (Dare)', color: '#eab308' },
  { id: 'MUSIC', name: 'Gu âm nhạc', color: '#06b6d4' },
  { id: 'LIFE', name: 'Góc nhìn cuộc sống', color: '#10b981' }
];

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Thống kê hệ thống
  const [stats, setStats] = useState(null);

  // Cấu hình hệ thống (System Config)
  const [configs, setConfigs] = useState({
    brand_name: 'Talovin',
    brand_slogan: 'Social Lounge',
    menu_items: '[]',
    vibe_options: '[]',
    challenge_categories: '[]',
    system_roles: '[]',
    feature_toggles: '{}'
  });
  const [parsedMenuItems, setParsedMenuItems] = useState([]);
  const [parsedVibes, setParsedVibes] = useState([]);
  const [newVibeInput, setNewVibeInput] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Thể loại thẻ bài động (Dynamic Challenge Categories)
  const [challengeCategories, setChallengeCategories] = useState(DEFAULT_CHALLENGE_CATEGORIES);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState({ id: '', name: '', color: '#818cf8' });

  // Thẻ bài thử thách (Challenges)
  const [challenges, setChallenges] = useState([]);
  const [challengeFilter, setChallengeFilter] = useState('ALL');
  const [challengeSearch, setChallengeSearch] = useState('');
  const [isAddChallengeOpen, setIsAddChallengeOpen] = useState(false);
  const [editingChallengeItem, setEditingChallengeItem] = useState(null);
  const [challengeFormData, setChallengeFormData] = useState({
    question: '',
    category: 'DEEP_TALK',
    categoryName: 'Tâm sự sâu lắng',
    badgeColor: '#818cf8'
  });

  // Âm nhạc
  const [tracks, setTracks] = useState([]);
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);
  const [newTrack, setNewTrack] = useState({ name: '', artist: '', genre: 'Lo-Fi Chill', audioSrc: '' });
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const [audioPlayer, setAudioPlayer] = useState(null);

  // Người dùng & Phân quyền (Users & Roles)
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [selectedUserForRoles, setSelectedUserForRoles] = useState(null);
  const [userRolesEditList, setUserRolesEditList] = useState([]);

  // Vai trò tùy biến (System Roles Matrix)
  const [systemRoles, setSystemRoles] = useState(DEFAULT_ROLES);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    id: '',
    name: '',
    description: '',
    permissions: ['TL_PERM_STATS_VIEW'],
    badgeColor: '#6366f1'
  });

  // Quản lý Cộng đồng & Danh mục Lý do Từ chối
  const [adminGroups, setAdminGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [rejectReasons, setRejectReasons] = useState([
    { id: 'SPAM', label: 'Spam / Quảng cáo / Tin rác' },
    { id: 'RULE_VIOLATION', label: 'Vi phạm quy định & nội quy cộng đồng' },
    { id: 'OFF_TOPIC', label: 'Lạc đề / Không phù hợp với chủ đề nhóm' },
    { id: 'INAPPROPRIATE', label: 'Ngôn từ thù địch / Phản cảm / Độc hại' },
    { id: 'COPYRIGHT', label: 'Vi phạm bản quyền nội dung / hình ảnh' }
  ]);
  const [newReasonInput, setNewReasonInput] = useState('');

  // Quản lý Báo cáo Vi phạm Bài viết (Post Reports)
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportFilter, setReportFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'RESOLVED_TAKEDOWN' | 'DISMISSED'
  const [reportActionModal, setReportActionModal] = useState({ isOpen: false, report: null, action: 'TAKEDOWN', note: '' });
  const [reportReasons, setReportReasons] = useState([
    { id: 'HARASSMENT', label: 'Quấy rối / Đả kích cá nhân' },
    { id: 'SPAM', label: 'Spam / Quảng cáo / Tin rác' },
    { id: 'HATE_SPEECH', label: 'Ngôn từ thù địch / Phản cảm' },
    { id: 'NSFW', label: 'Nội dung 18+ / Bạo lực' },
    { id: 'MISINFORMATION', label: 'Thông tin sai lệch / Lừa đảo' },
    { id: 'COPYRIGHT', label: 'Vi phạm bản quyền sở hữu' }
  ]);
  const [newReportReason, setNewReportReason] = useState({ id: '', label: '' });
  const [isAddReportReasonOpen, setIsAddReportReasonOpen] = useState(false);

  // Quản lý Bài viết & Đăng lại (Posts Moderation & Soft Delete)
  const [adminPosts, setAdminPosts] = useState([]);
  const [loadingAdminPosts, setLoadingAdminPosts] = useState(false);
  const [adminPostFilter, setAdminPostFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'DELETED'
  const [adminPostSearch, setAdminPostSearch] = useState('');
  const [adminPostsSubTab, setAdminPostsSubTab] = useState('posts'); // 'posts' | 'reposts'
  const [takedownModal, setTakedownModal] = useState({ isOpen: false, post: null, reason: 'Vi phạm tiêu chuẩn cộng đồng Talovin' });
  const [adminReposts, setAdminReposts] = useState([]);
  const [loadingAdminReposts, setLoadingAdminReposts] = useState(false);

  // Quản lý Băng tần & Đài nhạc FM (Frequency & Audio Channels)
  const [adminIntents, setAdminIntents] = useState([]);
  const [adminChannels, setAdminChannels] = useState([]);
  const [liveFrequencyStats, setLiveFrequencyStats] = useState({ activeBroadcasters: 0, activeIntents: 0, activeChannels: 0 });
  const [loadingFrequency, setLoadingFrequency] = useState(false);

  // Modal Intent
  const [isIntentModalOpen, setIsIntentModalOpen] = useState(false);
  const [editingIntent, setEditingIntent] = useState(null);
  const [intentFormData, setIntentFormData] = useState({
    code: '',
    title: '',
    subtitle: '',
    iconName: 'Headphones',
    freqStart: 88.0,
    freqEnd: 92.9,
    isActive: true,
    displayOrder: 1
  });

  // Modal Channel
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [channelFormData, setChannelFormData] = useState({
    name: '',
    genreTag: 'Lo-Fi Chill',
    streamUrl: '',
    isActive: true
  });

  // ==========================================
  // KHỞI TẠO & PHÂN QUYỀN TRUY CẬP (RBAC RESOLVER)
  // ==========================================
  useEffect(() => {
    initAdminSession();
    return () => {
      if (audioPlayer) audioPlayer.pause();
    };
  }, []);

  const initAdminSession = async () => {
    try {
      setLoading(true);
      // 1. Tải thông tin người dùng hiện tại
      const profileRes = await axiosClient.get('/users/profile');
      const user = profileRes?.data?.data;
      if (!user) throw new Error("Chưa đăng nhập");
      setCurrentUser(user);

      // 2. Xác thực quyền Admin / Moderator
      const userRoles = user.roles || [];
      const hasAnyAdminPrivilege = userRoles.some(r => 
        r.includes('ADMIN') || r.startsWith('TL_') || r.startsWith('PERM_')
      );

      if (!hasAnyAdminPrivilege) {
        toast.error("Bạn không có quyền truy cập trung tâm quản trị!");
        navigate('/');
        return;
      }

      // 3. Nạp toàn bộ dữ liệu cấu hình ban đầu
      await fetchConfigs();
      await fetchStats();
      await fetchChallenges();
      await fetchTracks();
      await fetchUsers();
      await fetchAdminGroups();
      await fetchReports();
      await fetchAdminPosts();
      await fetchAdminReposts();
      await fetchFrequencyData();
    } catch (err) {
      console.error("Lỗi xác thực quyền:", err);
      toast.error("Phiên làm việc hết hạn hoặc không có quyền quản trị");
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  // Tính toán danh sách quyền của người dùng hiện tại
  const currentUserPermissions = useMemo(() => {
    if (!currentUser) return new Set();
    const roles = currentUser.roles || [];
    const isSuper = roles.includes('ROLE_ADMIN') || roles.includes('ROLE_AMDIN') || 
                    roles.includes('TL_SYS_SUPERADMIN') || roles.includes('TL_PERM_ALL');
    
    if (isSuper) {
      return new Set(['TL_PERM_ALL', ...SYSTEM_PERMISSIONS.map(p => p.id)]);
    }

    const perms = new Set();
    roles.forEach(r => {
      if (r.startsWith('TL_PERM_')) perms.add(r);
      const roleDef = systemRoles.find(def => def.id === r);
      if (roleDef && roleDef.permissions) {
        roleDef.permissions.forEach(p => perms.add(p));
      }
    });
    return perms;
  }, [currentUser, systemRoles]);

  const hasPermission = (permId) => {
    if (currentUserPermissions.has('TL_PERM_ALL')) return true;
    return currentUserPermissions.has(permId);
  };

  // Định nghĩa các Menu Sidebar theo nhóm rõ ràng
  const sidebarSections = useMemo(() => {
    return [
      {
        sectionTitle: 'TỔNG QUAN & HỆ THỐNG',
        items: [
          { id: 'overview', label: 'Tổng quan & Số liệu', icon: LayoutGrid, permission: 'TL_PERM_STATS_VIEW' },
          { id: 'branding', label: 'Menu & Thương hiệu', icon: Sliders, permission: 'TL_PERM_BRAND_MANAGE' }
        ]
      },
      {
        sectionTitle: 'NỘI DUNG & TƯƠNG TÁC',
        items: [
          { id: 'posts_moderation', label: `Kiểm duyệt Bài viết (${adminPosts.length})`, icon: FileText, permission: 'TL_PERM_COMMUNITY_MANAGE' },
          { id: 'frequency_management', label: `Băng tần & Đài phát FM (${adminIntents.length})`, icon: Radio, permission: 'TL_PERM_MUSIC_MANAGE' },
          { id: 'challenges', label: `Thẻ bài thử thách (${challenges.length})`, icon: Sparkles, permission: 'TL_PERM_CHALLENGE_MANAGE' },
          { id: 'vibes', label: `Chủ đề & Cảm xúc (${parsedVibes.length})`, icon: Tag, permission: 'TL_PERM_TOPIC_MANAGE' },
          { id: 'music', label: `Âm nhạc hệ thống (${tracks.length})`, icon: Music, permission: 'TL_PERM_MUSIC_MANAGE' },
          { id: 'communities', label: `Cộng đồng & Nhóm (${adminGroups.length})`, icon: Globe, permission: 'TL_PERM_COMMUNITY_MANAGE' },
          { id: 'reports', label: `Báo cáo vi phạm (${reports.filter(r => r.status === 'PENDING').length})`, icon: AlertTriangle, permission: 'TL_PERM_COMMUNITY_MANAGE' }
        ]
      },
      {
        sectionTitle: 'BẢO MẬT & PHÂN QUYỀN',
        items: [
          { id: 'users', label: `Tài khoản thành viên (${users.length})`, icon: Users, permission: 'TL_PERM_USER_MANAGE' },
          { id: 'roles', label: `Vai trò & Quyền hạn (${systemRoles.length})`, icon: ShieldCheck, permission: 'TL_PERM_ROLE_MANAGE' }
        ]
      }
    ];
  }, [adminPosts.length, adminIntents.length, challenges.length, parsedVibes.length, tracks.length, adminGroups.length, reports.length, users.length, systemRoles.length]);

  // Tự động chuyển tab nếu tab hiện tại không được phép
  useEffect(() => {
    const currentItem = sidebarSections.flatMap(s => s.items).find(i => i.id === activeTab);
    if (currentItem && !hasPermission(currentItem.permission)) {
      const firstAllowed = sidebarSections.flatMap(s => s.items).find(i => hasPermission(i.permission));
      if (firstAllowed) {
        setActiveTab(firstAllowed.id);
      }
    }
  }, [activeTab, currentUserPermissions, sidebarSections]);

  // ==========================================
  // CÁC HÀM TẢI & THAO TÁC DỮ LIỆU
  // ==========================================
  const fetchStats = async () => {
    try {
      const res = await axiosClient.get('/admin/stats');
      if (res?.data?.data) setStats(res.data.data);
    } catch (e) {
      console.warn("Không thể tải thống kê:", e);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await axiosClient.get('/admin/config');
      if (res?.data?.data) {
        const d = res.data.data;
        setConfigs(d);
        try { setParsedMenuItems(JSON.parse(d.menu_items || '[]')); } catch { setParsedMenuItems([]); }
        try { setParsedVibes(JSON.parse(d.vibe_options || '[]')); } catch { setParsedVibes([]); }
        try { 
          if (d.challenge_categories) {
            const parsedCats = JSON.parse(d.challenge_categories);
            if (Array.isArray(parsedCats) && parsedCats.length > 0) setChallengeCategories(parsedCats);
          }
        } catch {}
        try {
          if (d.system_roles) {
            const parsedRoles = JSON.parse(d.system_roles);
            if (Array.isArray(parsedRoles) && parsedRoles.length > 0) setSystemRoles(parsedRoles);
          }
        } catch {}
        try {
          if (d.reject_reasons) {
            const parsedReasons = JSON.parse(d.reject_reasons);
            if (Array.isArray(parsedReasons) && parsedReasons.length > 0) setRejectReasons(parsedReasons);
          }
        } catch {}
        try {
          if (d.report_reasons) {
            const parsedReports = JSON.parse(d.report_reasons);
            if (Array.isArray(parsedReports) && parsedReports.length > 0) setReportReasons(parsedReports);
          }
        } catch {}
      }
    } catch (e) {
      console.error("Lỗi nạp cấu hình hệ thống:", e);
    }
  };

  const fetchAdminGroups = async () => {
    try {
      setLoadingGroups(true);
      const res = await axiosClient.get('/admin/groups');
      if (res?.data?.data) {
        setAdminGroups(res.data.data);
      }
    } catch (e) {
      console.warn("Không thể nạp danh sách cộng đồng admin:", e);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleToggleGroupFeed = async (groupId, currentVal) => {
    try {
      await axiosClient.post(`/admin/groups/${groupId}/toggle-feed`, {
        isPublicToFeed: !currentVal
      });
      setAdminGroups(prev => prev.map(g => g.id === groupId ? { ...g, isPublicToFeed: !currentVal } : g));
      toast.success("Đã cập nhật trạng thái đề xuất ra Feed chung!");
    } catch (e) {
      toast.error("Không thể cập nhật lúc này");
    }
  };

  const handleToggleGroupApproval = async (groupId, currentVal) => {
    try {
      await axiosClient.post(`/admin/groups/${groupId}/toggle-approval`, {
        requiresPostApproval: !currentVal
      });
      setAdminGroups(prev => prev.map(g => g.id === groupId ? { ...g, requiresPostApproval: !currentVal } : g));
      toast.success("Đã cập nhật chế độ duyệt bài trước khi đăng!");
    } catch (e) {
      toast.error("Không thể cập nhật lúc này");
    }
  };

  const handleAddRejectReason = async (e) => {
    e.preventDefault();
    if (!newReasonInput.trim()) return;
    const newId = 'REASON_' + Date.now();
    const updated = [...rejectReasons, { id: newId, label: newReasonInput.trim() }];
    setRejectReasons(updated);
    setNewReasonInput('');
    await saveConfigToBackend({ reject_reasons: JSON.stringify(updated) }, "Đã lưu lý do từ chối bài viết mẫu!");
  };

  const handleDeleteRejectReason = async (idToDelete) => {
    const updated = rejectReasons.filter(r => r.id !== idToDelete);
    setRejectReasons(updated);
    await saveConfigToBackend({ reject_reasons: JSON.stringify(updated) }, "Đã xóa lý do từ chối bài viết!");
  };

  // --- Quản lý Báo cáo Vi phạm ---
  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const res = await axiosClient.get('/admin/reports');
      if (res?.data?.data) {
        setReports(res.data.data);
      }
    } catch (e) {
      console.warn("Không thể tải danh sách báo cáo vi phạm:", e);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleResolveReport = async (reportId, action, note) => {
    try {
      await axiosClient.post(`/admin/reports/${reportId}/resolve`, {
        action,
        note
      });
      toast.success(action === 'TAKEDOWN' ? "Đã gỡ bài viết vi phạm và gửi thông báo tới tác giả!" : "Đã bỏ qua báo cáo!");
      setReportActionModal({ isOpen: false, report: null, action: 'TAKEDOWN', note: '' });
      fetchReports();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xử lý báo cáo lúc này");
    }
  };

  const handleAddReportReason = async (e) => {
    e.preventDefault();
    if (!newReportReason.id.trim() || !newReportReason.label.trim()) {
      toast.error("Vui lòng điền mã và mô tả lý do báo cáo");
      return;
    }
    const cleanId = newReportReason.id.trim().toUpperCase().replace(/\s+/g, '_');
    const updated = [...reportReasons.filter(r => r.id !== cleanId), { id: cleanId, label: newReportReason.label.trim() }];
    setReportReasons(updated);
    await saveConfigToBackend({ report_reasons: JSON.stringify(updated) }, "Đã lưu lý do báo cáo vi phạm mới!");
    setNewReportReason({ id: '', label: '' });
    setIsAddReportReasonOpen(false);
  };

  const handleDeleteReportReason = async (idToDelete) => {
    const updated = reportReasons.filter(r => r.id !== idToDelete);
    setReportReasons(updated);
    await saveConfigToBackend({ report_reasons: JSON.stringify(updated) }, "Đã xóa lý do báo cáo!");
  };

  const saveConfigToBackend = async (partialConfigs, successMsg = "Đã lưu cấu hình thành công!") => {
    try {
      setIsSavingConfig(true);
      const updated = { ...configs, ...partialConfigs };
      await axiosClient.put('/admin/config', updated);
      setConfigs(updated);
      toast.success(successMsg);
      fetchConfigs();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật cấu hình");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // --- Quản lý Bài viết & Đăng lại (Posts Moderation & Soft Delete) ---
  const fetchAdminPosts = async (filter = adminPostFilter) => {
    setLoadingAdminPosts(true);
    try {
      const res = await axiosClient.get(`/posts/admin/all?filter=${filter}`);
      if (res.data?.data) {
        setAdminPosts(res.data.data);
      }
    } catch (err) {
      console.error("Lỗi tải bài viết quản trị:", err);
    } finally {
      setLoadingAdminPosts(false);
    }
  };

  const fetchAdminReposts = async () => {
    setLoadingAdminReposts(true);
    try {
      const res = await axiosClient.get('/posts/admin/reposts');
      if (res.data?.data) {
        setAdminReposts(res.data.data);
      }
    } catch (err) {
      console.error("Lỗi tải lượt đăng lại quản trị:", err);
    } finally {
      setLoadingAdminReposts(false);
    }
  };

  const handleAdminSoftDelete = async (postId, reason) => {
    if (!reason || !reason.trim()) {
      toast.error("Vui lòng nhập lý do gỡ bài!");
      return;
    }
    try {
      await axiosClient.post(`/posts/${postId}/admin-takedown`, { reason: reason.trim() });
      toast.success("Đã gỡ bài viết (xóa mềm) và gửi thông báo tới tác giả!");
      setTakedownModal({ isOpen: false, post: null, reason: 'Vi phạm tiêu chuẩn cộng đồng Talovin' });
      fetchAdminPosts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gỡ bài viết!");
    }
  };

  const handleAdminRestorePost = async (postId) => {
    try {
      await axiosClient.post(`/posts/${postId}/admin-restore`);
      toast.success("Đã khôi phục bài viết thành công!");
      fetchAdminPosts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể khôi phục bài viết!");
    }
  };

  const handleAdminHardDelete = async (postId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa VĨNH VIỄN bài viết này cùng toàn bộ bình luận, tương tác và đăng lại liên quan? Hành động này KHÔNG THỂ khôi phục!")) {
      return;
    }
    try {
      await axiosClient.delete(`/posts/${postId}/admin-hard-delete`);
      toast.success("Đã xóa vĩnh viễn bài viết khỏi hệ thống!");
      fetchAdminPosts();
      fetchAdminReposts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa bài viết!");
    }
  };

  const handleAdminDeleteRepost = async (repostId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa lượt đăng lại này của người dùng? Bài viết gốc của tác giả vẫn sẽ được giữ nguyên hoàn toàn.")) {
      return;
    }
    try {
      await axiosClient.delete(`/posts/admin/reposts/${repostId}`);
      toast.success("Đã gỡ lượt đăng lại của người dùng thành công!");
      fetchAdminReposts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa lượt đăng lại!");
    }
  };

  // --- Thẻ bài thử thách ---
  const fetchChallenges = async () => {
    try {
      const res = await axiosClient.get('/admin/challenges');
      if (res?.data?.data) setChallenges(res.data.data);
    } catch (e) {
      console.warn("Không thể tải thử thách:", e);
    }
  };

  const handleOpenAddChallenge = () => {
    const firstCat = challengeCategories[0] || { id: 'DEEP_TALK', name: 'Tâm sự sâu lắng', color: '#818cf8' };
    setChallengeFormData({
      question: '',
      category: firstCat.id,
      categoryName: firstCat.name,
      badgeColor: firstCat.color
    });
    setEditingChallengeItem(null);
    setIsAddChallengeOpen(true);
  };

  const handleOpenEditChallenge = (item) => {
    setChallengeFormData({
      question: item.question || '',
      category: item.category || 'DEEP_TALK',
      categoryName: item.categoryName || 'Tâm sự sâu lắng',
      badgeColor: item.badgeColor || '#818cf8'
    });
    setEditingChallengeItem(item);
    setIsAddChallengeOpen(true);
  };

  const handleSaveChallengeForm = async (e) => {
    e.preventDefault();
    if (!challengeFormData.question.trim()) {
      toast.error("Vui lòng nhập nội dung câu hỏi!");
      return;
    }

    try {
      if (editingChallengeItem) {
        await axiosClient.put(`/admin/challenges/${editingChallengeItem.id}`, challengeFormData);
        toast.success("Đã cập nhật câu hỏi thử thách!");
      } else {
        await axiosClient.post('/admin/challenges', challengeFormData);
        toast.success("Đã thêm câu hỏi thử thách mới!");
      }
      setIsAddChallengeOpen(false);
      fetchChallenges();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi lưu câu hỏi");
    }
  };

  const handleDeleteChallenge = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa câu hỏi này?")) return;
    try {
      await axiosClient.delete(`/admin/challenges/${id}`);
      toast.success("Đã xóa câu hỏi");
      fetchChallenges();
    } catch {
      toast.error("Không thể xóa câu hỏi");
    }
  };

  const handleToggleChallenge = async (item) => {
    try {
      await axiosClient.put(`/admin/challenges/${item.id}`, { active: !item.active });
      toast.success(`Đã ${item.active ? 'ẩn' : 'kích hoạt'} câu hỏi!`);
      fetchChallenges();
    } catch {
      toast.error("Không thể cập nhật trạng thái");
    }
  };

  // Quản lý Thể loại Thử thách Động (Dynamic Categories)
  const handleSaveCategory = async () => {
    if (!editingCategory.id.trim() || !editingCategory.name.trim()) {
      toast.error("Mã thể loại và tên hiển thị không được để trống!");
      return;
    }
    const cleanId = editingCategory.id.trim().toUpperCase().replace(/\s+/g, '_');
    const existingIndex = challengeCategories.findIndex(c => c.id === cleanId);
    let updated;
    if (existingIndex >= 0) {
      updated = [...challengeCategories];
      updated[existingIndex] = { ...editingCategory, id: cleanId };
    } else {
      updated = [...challengeCategories, { ...editingCategory, id: cleanId }];
    }
    setChallengeCategories(updated);
    await saveConfigToBackend({ challenge_categories: JSON.stringify(updated) }, "Đã cập nhật danh mục thể loại!");
    setEditingCategory({ id: '', name: '', color: '#818cf8' });
  };

  const handleDeleteCategory = async (catId) => {
    if (challengeCategories.length <= 1) {
      toast.error("Hệ thống phải có ít nhất 1 thể loại!");
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn xóa thể loại "${catId}"? Các câu hỏi thuộc thể loại này sẽ vẫn được lưu.`)) return;
    const updated = challengeCategories.filter(c => c.id !== catId);
    setChallengeCategories(updated);
    await saveConfigToBackend({ challenge_categories: JSON.stringify(updated) }, "Đã xóa thể loại thử thách!");
  };

  // --- Âm nhạc ---
  const fetchTracks = async () => {
    try {
      const res = await axiosClient.get('/admin/tracks');
      if (res?.data?.data) setTracks(res.data.data);
    } catch (e) {
      console.warn("Không thể tải tracks:", e);
    }
  };

  const handleAddTrack = async (e) => {
    e.preventDefault();
    if (!newTrack.name.trim() || !newTrack.audioSrc.trim()) {
      toast.error("Vui lòng nhập tên và link nhạc hợp lệ!");
      return;
    }
    try {
      await axiosClient.post('/admin/tracks', newTrack);
      toast.success("Đã thêm bài hát vào hệ thống!");
      setIsAddTrackOpen(false);
      setNewTrack({ name: '', artist: '', genre: 'Lo-Fi Chill', audioSrc: '' });
      fetchTracks();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi thêm bài hát");
    }
  };

  const handleDeleteTrack = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài hát này?")) return;
    try {
      await axiosClient.delete(`/admin/tracks/${id}`);
      toast.success("Đã xóa bài hát");
      if (playingTrackId === id && audioPlayer) {
        audioPlayer.pause();
        setPlayingTrackId(null);
      }
      fetchTracks();
    } catch {
      toast.error("Không thể xóa bài hát");
    }
  };

  const handleTogglePlayAudio = (track) => {
    if (playingTrackId === track.id) {
      if (audioPlayer) audioPlayer.pause();
      setPlayingTrackId(null);
    } else {
      if (audioPlayer) audioPlayer.pause();
      const audio = new Audio(track.audioSrc);
      audio.play().catch(() => toast.error("Không thể phát URL âm thanh này"));
      audio.onended = () => setPlayingTrackId(null);
      setAudioPlayer(audio);
      setPlayingTrackId(track.id);
    }
  };

  // --- Người dùng & Phân quyền ---
  const fetchUsers = async () => {
    try {
      const res = await axiosClient.get('/admin/users');
      if (res?.data?.data) setUsers(res.data.data);
    } catch (e) {
      console.warn("Không thể tải người dùng:", e);
    }
  };

  const handleToggleUserStatus = async (user) => {
    const newStatus = !user.active;
    try {
      await axiosClient.put(`/admin/users/${user.id}/status`, null, { params: { active: newStatus } });
      toast.success(`Đã ${newStatus ? 'mở khóa' : 'khóa'} tài khoản ${user.nickname || user.account}!`);
      fetchUsers();
    } catch {
      toast.error("Không thể thay đổi trạng thái tài khoản");
    }
  };

  const handleOpenRoleModal = (user) => {
    setSelectedUserForRoles(user);
    setUserRolesEditList([...(user.roles || ['ROLE_USER'])]);
  };

  const handleSaveUserRoles = async () => {
    if (!selectedUserForRoles) return;
    try {
      await axiosClient.put(`/admin/users/${selectedUserForRoles.id}/roles`, userRolesEditList);
      toast.success(`Đã cập nhật quyền hạn cho ${selectedUserForRoles.nickname || selectedUserForRoles.account}!`);
      setSelectedUserForRoles(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật quyền hạn");
    }
  };

  // --- Quản lý Vai trò tùy biến (System Roles) ---
  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleFormData.id.trim() || !roleFormData.name.trim()) {
      toast.error("Mã vai trò và tên vai trò không được để trống!");
      return;
    }
    const cleanId = roleFormData.id.trim().toUpperCase().replace(/\s+/g, '_');
    const existingIndex = systemRoles.findIndex(r => r.id === cleanId);
    let updated;
    if (existingIndex >= 0) {
      updated = [...systemRoles];
      updated[existingIndex] = { ...roleFormData, id: cleanId };
    } else {
      updated = [...systemRoles, { ...roleFormData, id: cleanId }];
    }
    setSystemRoles(updated);
    await saveConfigToBackend({ system_roles: JSON.stringify(updated) }, "Đã lưu vai trò thành công!");
    setIsAddRoleModalOpen(false);
    setRoleFormData({
      id: '',
      name: '',
      description: '',
      permissions: ['TL_PERM_STATS_VIEW'],
      badgeColor: '#6366f1'
    });
  };

  const handleDeleteRole = async (roleId) => {
    if (roleId === 'TL_SYS_SUPERADMIN') {
      toast.error("Không thể xóa vai trò Quản trị viên tối cao!");
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn xóa vai trò "${roleId}"?`)) return;
    const updated = systemRoles.filter(r => r.id !== roleId);
    setSystemRoles(updated);
    await saveConfigToBackend({ system_roles: JSON.stringify(updated) }, "Đã xóa vai trò!");
  };

  // --- Quản lý Băng tần & Đài nhạc FM (Frequency Match & Audio Channels) ---
  const fetchFrequencyData = async () => {
    try {
      setLoadingFrequency(true);
      const [intentsRes, channelsRes, statsRes] = await Promise.all([
        axiosClient.get('/admin/frequency-config/intents').catch(() => ({ data: [] })),
        axiosClient.get('/admin/frequency-config/channels').catch(() => ({ data: [] })),
        axiosClient.get('/admin/frequency-config/live-stats').catch(() => ({ data: {} }))
      ]);
      setAdminIntents(Array.isArray(intentsRes.data) ? intentsRes.data : []);
      setAdminChannels(Array.isArray(channelsRes.data) ? channelsRes.data : []);
      setLiveFrequencyStats(statsRes.data || { activeBroadcasters: 0, activeIntents: 0, activeChannels: 0 });
    } catch (e) {
      console.warn("Lỗi nạp cấu hình tần số:", e);
    } finally {
      setLoadingFrequency(false);
    }
  };

  const handleToggleIntent = async (id) => {
    try {
      const res = await axiosClient.patch(`/admin/frequency-config/intents/${id}/toggle`);
      setAdminIntents(prev => prev.map(i => i.id === id ? res.data : i));
      toast.success("Đã cập nhật trạng thái băng tần!");
    } catch (e) {
      toast.error("Không thể cập nhật trạng thái băng tần");
    }
  };

  const handleDeleteIntent = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa băng tần FM này?")) return;
    try {
      await axiosClient.delete(`/admin/frequency-config/intents/${id}`);
      setAdminIntents(prev => prev.filter(i => i.id !== id));
      toast.success("Đã xóa băng tần thành công!");
    } catch (e) {
      toast.error("Không thể xóa băng tần");
    }
  };

  const handleOpenAddIntent = () => {
    setEditingIntent(null);
    setIntentFormData({
      code: `INTENT_${Date.now()}`,
      title: '',
      subtitle: '',
      iconName: 'Headphones',
      freqStart: 88.0,
      freqEnd: 92.9,
      isActive: true,
      displayOrder: adminIntents.length + 1
    });
    setIsIntentModalOpen(true);
  };

  const handleOpenEditIntent = (intent) => {
    setEditingIntent(intent);
    setIntentFormData({
      code: intent.code,
      title: intent.title,
      subtitle: intent.subtitle || '',
      iconName: intent.iconName || 'Headphones',
      freqStart: intent.freqStart,
      freqEnd: intent.freqEnd,
      isActive: intent.isActive !== false,
      displayOrder: intent.displayOrder || 1
    });
    setIsIntentModalOpen(true);
  };

  const handleSaveIntent = async (e) => {
    e.preventDefault();
    try {
      if (editingIntent) {
        const res = await axiosClient.put(`/admin/frequency-config/intents/${editingIntent.id}`, intentFormData);
        setAdminIntents(prev => prev.map(i => i.id === editingIntent.id ? res.data : i));
        toast.success("Đã cập nhật băng tần thành công!");
      } else {
        const res = await axiosClient.post('/admin/frequency-config/intents', intentFormData);
        setAdminIntents(prev => [...prev, res.data]);
        toast.success("Đã thêm băng tần mới thành công!");
      }
      setIsIntentModalOpen(false);
      setEditingIntent(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi lưu băng tần");
    }
  };

  const handleToggleChannel = async (id) => {
    try {
      const res = await axiosClient.patch(`/admin/frequency-config/channels/${id}/toggle`);
      setAdminChannels(prev => prev.map(c => c.id === id ? res.data : c));
      toast.success("Đã cập nhật trạng thái đài phát!");
    } catch (e) {
      toast.error("Không thể cập nhật đài phát");
    }
  };

  const handleDeleteChannel = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa kênh phát thanh này?")) return;
    try {
      await axiosClient.delete(`/admin/frequency-config/channels/${id}`);
      setAdminChannels(prev => prev.filter(c => c.id !== id));
      toast.success("Đã xóa đài phát thành công!");
    } catch (e) {
      toast.error("Không thể xóa đài phát");
    }
  };

  const handleOpenAddChannel = () => {
    setEditingChannel(null);
    setChannelFormData({
      name: '',
      genreTag: 'Lo-Fi Beats',
      streamUrl: '',
      isActive: true
    });
    setIsChannelModalOpen(true);
  };

  const handleOpenEditChannel = (ch) => {
    setEditingChannel(ch);
    setChannelFormData({
      name: ch.name,
      genreTag: ch.genreTag || 'Lo-Fi Chill',
      streamUrl: ch.streamUrl,
      isActive: ch.isActive !== false
    });
    setIsChannelModalOpen(true);
  };

  const handleSaveChannel = async (e) => {
    e.preventDefault();
    try {
      if (editingChannel) {
        const res = await axiosClient.put(`/admin/frequency-config/channels/${editingChannel.id}`, channelFormData);
        setAdminChannels(prev => prev.map(c => c.id === editingChannel.id ? res.data : c));
        toast.success("Đã cập nhật đài phát thành công!");
      } else {
        const res = await axiosClient.post('/admin/frequency-config/channels', channelFormData);
        setAdminChannels(prev => [...prev, res.data]);
        toast.success("Đã thêm đài phát mới thành công!");
      }
      setIsChannelModalOpen(false);
      setEditingChannel(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi lưu đài phát");
    }
  };

  // --- Lọc dữ liệu hiển thị ---
  const filteredChallenges = useMemo(() => {
    return challenges.filter(c => {
      const matchCat = challengeFilter === 'ALL' || c.category === challengeFilter;
      const matchSearch = !challengeSearch.trim() || (c.question || '').toLowerCase().includes(challengeSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [challenges, challengeFilter, challengeSearch]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = userSearch.toLowerCase().trim();
      const matchSearch = !q || (u.account || '').toLowerCase().includes(q) || 
                                (u.nickname || '').toLowerCase().includes(q) || 
                                (u.email || '').toLowerCase().includes(q);
      const roles = u.roles || [];
      const matchRole = userRoleFilter === 'ALL' || 
                        (userRoleFilter === 'ADMIN' && (roles.includes('ROLE_ADMIN') || roles.includes('TL_SYS_SUPERADMIN') || roles.some(r => r.startsWith('TL_ROLE_')))) ||
                        (userRoleFilter === 'MEMBER' && !roles.some(r => r.includes('ADMIN') || r.startsWith('TL_')));
      return matchSearch && matchRole;
    });
  }, [users, userSearch, userRoleFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3 font-mono">
        <RefreshCw size={26} className="animate-spin text-indigo-500" />
        <span className="text-sm">Đang tải trung tâm quản trị Talovin...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#101010] text-[#f4f4f5] overflow-hidden font-sans antialiased">
      {/* ==========================================
          SIDEBAR QUẢN TRỊ VIÊN (ENTERPRISE SIDEBAR - CHARCOAL THEME)
          ========================================== */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#121212] border-r border-[#1e1e1e] flex flex-col justify-between
        transition-transform duration-300 md:static md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        {/* Header Sidebar */}
        <div className="flex flex-col border-b border-[#1e1e1e] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <TalovinLogo size={26} />
              <div className="flex flex-col leading-none">
                <span className="font-extrabold text-base tracking-tight text-white">{configs.brand_name || "Talovin"}</span>
                <span className="text-[10px] font-mono text-indigo-400 tracking-wider uppercase font-semibold mt-0.5">Admin Console</span>
              </div>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(false)} 
              className="md:hidden text-zinc-400 hover:text-white p-1"
            >
              <X size={18} />
            </button>
          </div>

          {/* Admin User Mini Card */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0">
              {(currentUser?.nickname || currentUser?.account || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-zinc-200 truncate">{currentUser?.nickname || currentUser?.account}</span>
              <span className="text-[10px] font-mono text-zinc-400 truncate">@{currentUser?.account}</span>
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400 mt-0.5">
                <ShieldCheck size={10} /> {currentUserPermissions.has('TL_PERM_ALL') ? 'Toàn quyền' : 'Phân quyền riêng'}
              </span>
            </div>
          </div>
        </div>

        {/* Menu Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6 custom-scrollbar">
          {sidebarSections.map((sec, secIdx) => {
            const allowedItems = sec.items.filter(item => hasPermission(item.permission));
            if (allowedItems.length === 0) return null;

            return (
              <div key={secIdx} className="space-y-1">
                <div className="px-3 text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase mb-2">
                  {sec.sectionTitle}
                </div>
                {allowedItems.map((item) => {
                  const Icon = item.icon;
                  const isCurrent = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all duration-150 ${
                        isCurrent 
                          ? 'bg-[#222222] text-[#f4f4f5] border border-[#2e2e2e] shadow-sm font-bold' 
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon size={16} className={isCurrent ? 'text-white' : 'text-zinc-400'} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {isCurrent && <ChevronRight size={13} className="text-zinc-300" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-zinc-800/80 flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-zinc-800"
          >
            <ArrowLeft size={14} />
            <span>Về Sảnh Trực Tuyến</span>
          </button>
        </div>
      </aside>

      {/* Backdrop trên Mobile khi mở Sidebar */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)} 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden animate-fade-in" 
        />
      )}

      {/* ==========================================
          MAIN CONTENT AREA (FULL ENTERPRISE DASHBOARD)
          ========================================== */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
        {/* Top Navbar */}
        <header className="h-14 border-b border-[#1e1e1e] px-4 sm:px-6 flex items-center justify-between bg-[#121212]/95 backdrop-blur-md flex-shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-zinc-400 hover:text-white p-1.5 rounded-lg bg-zinc-900 border border-zinc-800"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="text-zinc-400">Quản trị</span>
              <span>/</span>
              <span className="text-zinc-200 font-bold capitalize">
                {sidebarSections.flatMap(s => s.items).find(i => i.id === activeTab)?.label.split('(')[0] || activeTab}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Hệ thống bảo mật RBAC Online</span>
            </div>

            <button
              onClick={() => window.open('/', '_blank')}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs flex items-center gap-1.5 transition-all"
              title="Xem ứng dụng ở tab mới"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">Mở Sảnh</span>
            </button>
          </div>
        </header>

        {/* Content Body with Controlled Scrolling */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* ====================================================
                TAB 1: TỔNG QUAN & SỐ LIỆU (OVERVIEW)
                ==================================================== */}
            {activeTab === 'overview' && hasPermission('TL_PERM_STATS_VIEW') && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Tổng Quan Hệ Thống</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Chỉ số vận hành thời gian thực và cấu trúc tài nguyên của Talovin</p>
                </div>

                {/* Grid 4 Cards Thống kê cân đối */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-zinc-400">Người dùng đăng ký</span>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                        <Users size={16} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold font-mono text-zinc-100 tracking-tight">{stats?.totalUsers ?? users.length}</div>
                    <span className="text-[11px] text-zinc-400 mt-1">Tài khoản lưu trên CSDL</span>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-zinc-400">Bài viết Sảnh</span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <MessageSquare size={16} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold font-mono text-zinc-100 tracking-tight">{stats?.totalPosts ?? 0}</div>
                    <span className="text-[11px] text-zinc-400 mt-1">Bài thảo luận & tương tác</span>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-zinc-400">Phòng đàm thoại</span>
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                        <Radio size={16} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold font-mono text-zinc-100 tracking-tight">{stats?.totalRooms ?? 0}</div>
                    <span className="text-[11px] text-zinc-400 mt-1">Không gian chat & WebRTC</span>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-zinc-400">Câu hỏi thử thách</span>
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                        <Sparkles size={16} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold font-mono text-zinc-100 tracking-tight">{challenges.length}</div>
                    <span className="text-[11px] text-zinc-400 mt-1">{challengeCategories.length} thể loại tương tác</span>
                  </div>
                </div>

                {/* Phân hệ thông tin bảo mật & Khối trạng thái */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={18} className="text-indigo-400" />
                        <h3 className="text-sm font-bold text-zinc-200">Trạng Thái An Ninh & Phân Quyền Hạt Mịn (Granular RBAC)</h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Bảo mật cấp cao
                      </span>
                    </div>

                    <div className="space-y-3 text-xs text-zinc-400 leading-relaxed">
                      <p>
                        Toàn bộ các phân hệ quản lý đã được thiết lập bảo vệ độc lập. Thành viên quản trị chỉ thấy và thao tác đúng các tính năng được phân bổ thông qua mã định danh bảo mật <code className="text-indigo-300 font-mono">TL_ROLE_...</code> và <code className="text-indigo-300 font-mono">TL_PERM_...</code>.
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/60">
                          <span className="text-[11px] text-zinc-400 block font-mono">Tổng quyền hạn:</span>
                          <span className="text-base font-bold text-zinc-200 font-mono">{SYSTEM_PERMISSIONS.length} mã quyền</span>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/60">
                          <span className="text-[11px] text-zinc-400 block font-mono">Vai trò mặc định:</span>
                          <span className="text-base font-bold text-zinc-200 font-mono">{systemRoles.length} vai trò</span>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/60 col-span-2 sm:col-span-1">
                          <span className="text-[11px] text-zinc-400 block font-mono">Trạng thái đồng bộ:</span>
                          <span className="text-base font-bold text-emerald-400 font-mono">Real-time DB</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Shortcut Card */}
                  <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-200 mb-2">Thao Tác Nhanh</h3>
                      <p className="text-xs text-zinc-400 mb-4">Các lối tắt quản trị viên thường xuyên sử dụng</p>
                      <div className="space-y-2">
                        {hasPermission('TL_PERM_CHALLENGE_MANAGE') && (
                          <button
                            onClick={() => { setActiveTab('challenges'); handleOpenAddChallenge(); }}
                            className="w-full text-left p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-xs font-semibold text-zinc-300 flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2"><Sparkles size={14} className="text-amber-400" /> Thêm câu hỏi thử thách</span>
                            <Plus size={14} />
                          </button>
                        )}
                        {hasPermission('TL_PERM_USER_MANAGE') && (
                          <button
                            onClick={() => setActiveTab('users')}
                            className="w-full text-left p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-xs font-semibold text-zinc-300 flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2"><Users size={14} className="text-emerald-400" /> Quản lý danh sách thành viên</span>
                            <ChevronRight size={14} />
                          </button>
                        )}
                        {hasPermission('TL_PERM_BRAND_MANAGE') && (
                          <button
                            onClick={() => setActiveTab('branding')}
                            className="w-full text-left p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-xs font-semibold text-zinc-300 flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2"><Sliders size={14} className="text-indigo-400" /> Tùy chỉnh Menu & Logo</span>
                            <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ====================================================
                TAB 2: THƯƠNG HIỆU & MENU (BRANDING & MENU)
                ==================================================== */}
            {activeTab === 'branding' && hasPermission('TL_PERM_BRAND_MANAGE') && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Menu & Cấu Hình Thương Hiệu</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Quản lý nhận diện thương hiệu, logo và cấu hình bật/tắt các mục trên menu thanh điều hướng</p>
                  </div>
                  <button
                    onClick={() => saveConfigToBackend({
                      brand_name: configs.brand_name,
                      brand_slogan: configs.brand_slogan,
                      menu_items: JSON.stringify(parsedMenuItems),
                      enable_repost: configs.enable_repost || 'true',
                      public_friends: configs.public_friends || 'true'
                    })}
                    disabled={isSavingConfig}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all"
                  >
                    <Save size={14} />
                    <span>{isSavingConfig ? "Đang lưu..." : "Lưu tất cả thay đổi"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Nhận diện thương hiệu */}
                  <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                    <h3 className="text-sm font-bold text-zinc-200 border-b border-zinc-800 pb-3 flex items-center gap-2">
                      <Sliders size={15} className="text-indigo-400" />
                      Nhận Diện Ứng Dụng (Brand Info)
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-zinc-400 font-mono mb-1 block">Tên ứng dụng / Logo text *</label>
                        <input
                          type="text"
                          value={configs.brand_name || ''}
                          onChange={(e) => setConfigs({ ...configs, brand_name: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400 font-mono mb-1 block">Slogan / Phụ đề</label>
                        <input
                          type="text"
                          value={configs.brand_slogan || ''}
                          onChange={(e) => setConfigs({ ...configs, brand_slogan: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                        />
                      </div>
                      <div className="pt-2">
                        <span className="text-[11px] text-zinc-400 block mb-2 font-mono">Xem trước logo hiển thị:</span>
                        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center gap-3">
                          <TalovinLogo size={32} />
                          <div>
                            <span className="font-extrabold text-white text-base block">{configs.brand_name || "Talovin"}</span>
                            <span className="text-[11px] text-zinc-400 font-mono">{configs.brand_slogan || "Social Lounge"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quản lý danh sách Menu Sidebar */}
                  <div className="lg:col-span-2 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                        <Layers size={15} className="text-emerald-400" />
                        Danh Sách Các Mục Menu Sidebar ({parsedMenuItems.length})
                      </h3>
                      <span className="text-[11px] text-zinc-400 font-mono">Nhấn để Bật/Tắt ẩn hiện</span>
                    </div>

                    <div className="space-y-2">
                      {parsedMenuItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-zinc-700 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-[11px] text-zinc-400 w-6">#{item.order || 1}</span>
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => {
                                const newLabel = e.target.value;
                                setParsedMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, label: newLabel } : m));
                              }}
                              className="bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-indigo-500 text-xs font-bold text-zinc-200 px-1 py-0.5 focus:outline-none"
                            />
                            <span className="text-[10px] font-mono text-zinc-400 hidden sm:inline">id: {item.id}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setParsedMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, visible: !m.visible } : m));
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                              item.visible 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}
                          >
                            {item.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                            <span>{item.visible ? 'Đang hiện' : 'Đã ẩn'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quản lý các tính năng hệ thống (Feature Toggles: Repost, Public Friends, v.v.) */}
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                      <Sliders size={15} className="text-emerald-400" />
                      Cài Đặt Tính Năng Tương Tác & Cá Nhân (Feature Controls)
                    </h3>
                    <span className="text-[11px] text-zinc-400 font-mono">Bật / Tắt theo nhu cầu vận hành</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-200">Chức năng Đăng lại (Repost)</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">Cho phép người dùng chia sẻ lại bài viết lên trang cá nhân</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const current = configs.enable_repost !== 'false';
                          setConfigs({ ...configs, enable_repost: current ? 'false' : 'true' });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${configs.enable_repost !== 'false' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}
                      >
                        {configs.enable_repost !== 'false' ? 'Đang bật' : 'Đã tắt'}
                      </button>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-200">Công khai danh sách bạn bè</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">Hiển thị danh sách bạn bè cho người khác khi xem trang cá nhân</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const current = configs.public_friends !== 'false';
                          setConfigs({ ...configs, public_friends: current ? 'false' : 'true' });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${configs.public_friends !== 'false' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}
                      >
                        {configs.public_friends !== 'false' ? 'Đang bật' : 'Đã tắt'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ====================================================
                TAB: QUẢN LÝ BÀI VIẾT & ĐĂNG LẠI (POSTS MODERATION & SOFT DELETE)
                ==================================================== */}
            {activeTab === 'posts_moderation' && (hasPermission('TL_PERM_COMMUNITY_MANAGE') || hasPermission('TL_PERM_USER_MANAGE')) && (
              <div className="space-y-6 animate-fade-in">
                {/* Header & Sub-tab Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                      <FileText size={20} className="text-emerald-400" />
                      <span>Kiểm Duyệt Bài Viết & Đăng Lại</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Gỡ bài viết kèm lý do (xóa mềm), khôi phục bài viết, xóa vĩnh viễn và kiểm duyệt các lượt đăng lại độc lập của thành viên
                    </p>
                  </div>

                  {/* Sub-tab Navigation */}
                  <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAdminPostsSubTab('posts')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        adminPostsSubTab === 'posts' 
                          ? 'bg-emerald-600 text-white shadow-sm' 
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <FileText size={13} />
                      <span>Bài viết ({adminPosts.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminPostsSubTab('reposts');
                        fetchAdminReposts();
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        adminPostsSubTab === 'reposts' 
                          ? 'bg-emerald-600 text-white shadow-sm' 
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Repeat size={13} />
                      <span>Lượt đăng lại ({adminReposts.length})</span>
                    </button>
                  </div>
                </div>

                {/* Sub-tab 1: Danh sách Bài viết */}
                {adminPostsSubTab === 'posts' && (
                  <div className="space-y-4">
                    {/* Toolbar Lọc & Tìm kiếm */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80">
                      {/* Bộ lọc trạng thái */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        <button
                          type="button"
                          onClick={() => {
                            setAdminPostFilter('ALL');
                            fetchAdminPosts('ALL');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                            adminPostFilter === 'ALL' 
                              ? 'bg-zinc-800 text-white border border-zinc-700' 
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Tất cả bài viết
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminPostFilter('ACTIVE');
                            fetchAdminPosts('ACTIVE');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                            adminPostFilter === 'ACTIVE' 
                              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' 
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <CheckCircle2 size={12} />
                          <span>Đang hiển thị</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminPostFilter('DELETED');
                            fetchAdminPosts('DELETED');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                            adminPostFilter === 'DELETED' 
                              ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30' 
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <AlertOctagon size={12} />
                          <span>Thùng rác / Đã gỡ</span>
                        </button>
                      </div>

                      {/* Thanh tìm kiếm */}
                      <div className="relative min-w-[240px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Tìm theo nội dung, tác giả..."
                          value={adminPostSearch}
                          onChange={(e) => setAdminPostSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Danh sách bài viết */}
                    {loadingAdminPosts ? (
                      <div className="p-12 text-center text-zinc-500 text-xs font-mono flex flex-col items-center gap-2">
                        <RefreshCw size={20} className="animate-spin text-emerald-500" />
                        <span>Đang tải danh sách bài viết hệ thống...</span>
                      </div>
                    ) : adminPosts.length === 0 ? (
                      <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800 text-zinc-500 text-xs">
                        Không tìm thấy bài viết nào theo bộ lọc hiện tại.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {adminPosts
                          .filter(p => {
                            if (!adminPostSearch.trim()) return true;
                            const q = adminPostSearch.toLowerCase();
                            return (p.content || '').toLowerCase().includes(q) ||
                                   (p.authorAccount || '').toLowerCase().includes(q) ||
                                   (p.authorNickname || '').toLowerCase().includes(q);
                          })
                          .map((post) => {
                            const isSoftDeleted = Boolean(post.isDeleted);
                            return (
                              <div
                                key={post.id}
                                className={`p-4 rounded-2xl border transition-all ${
                                  isSoftDeleted 
                                    ? 'bg-rose-950/10 border-rose-900/40 hover:border-rose-800/60' 
                                    : 'bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700'
                                }`}
                              >
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                  {/* Cột trái: Tác giả + Nội dung */}
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex-shrink-0 flex items-center justify-center font-bold text-xs text-zinc-300 overflow-hidden">
                                      {post.authorAvatar ? (
                                        <img src={post.authorAvatar} alt="avatar" className="w-full h-full object-cover" />
                                      ) : (
                                        (post.authorNickname || post.authorAccount || 'U').charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-xs text-white">{post.authorNickname || post.authorAccount}</span>
                                        <span className="text-[11px] font-mono text-zinc-500">@{post.authorAccount}</span>
                                        <span className="text-[10.5px] text-zinc-600 font-mono">#{post.id}</span>
                                        <span className="text-zinc-600 text-xs">·</span>
                                        <span className="text-[11px] text-zinc-400 font-mono">{post.formattedTime || post.createdAt}</span>

                                        {/* Status badge */}
                                        {isSoftDeleted ? (
                                          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-[10.5px] font-semibold border border-rose-500/30 flex items-center gap-1">
                                            <AlertOctagon size={11} />
                                            Đã gỡ (Xóa mềm)
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10.5px] font-semibold border border-emerald-500/20 flex items-center gap-1">
                                            <CheckCircle2 size={11} />
                                            Đang hiển thị
                                          </span>
                                        )}
                                      </div>

                                      {/* Lý do gỡ bài nếu có */}
                                      {isSoftDeleted && post.deletedReason && (
                                        <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/40 text-[11px] text-rose-300">
                                          <strong>Lý do gỡ:</strong> {post.deletedReason}
                                        </div>
                                      )}

                                      {/* Nội dung bài */}
                                      <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed line-clamp-4">
                                        {post.content || <em className="text-zinc-500">(Bài viết chỉ có tệp đính kèm)</em>}
                                      </p>

                                      {/* Stats bar */}
                                      <div className="flex items-center gap-4 pt-1 text-[11px] text-zinc-400 font-mono">
                                        <span className="flex items-center gap-1">
                                          <Heart size={12} className="text-rose-500" />
                                          {post.likesCount || 0} thích
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <MessageSquare size={12} className="text-indigo-400" />
                                          {post.commentsCount || 0} bình luận
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Repeat size={12} className="text-emerald-400" />
                                          {post.repostsCount || 0} đăng lại
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Cột phải: Thao tác Admin */}
                                  <div className="flex md:flex-col items-center md:items-end justify-end gap-2 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-800">
                                    {!isSoftDeleted ? (
                                      <button
                                        type="button"
                                        onClick={() => setTakedownModal({
                                          isOpen: true,
                                          post,
                                          reason: 'Vi phạm tiêu chuẩn cộng đồng Talovin'
                                        })}
                                        className="px-3 py-1.5 rounded-xl bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                                        title="Gỡ bài viết này khỏi trang chủ và thông báo cho tác giả"
                                      >
                                        <AlertTriangle size={13} />
                                        <span>Gỡ bài (Kèm lý do)</span>
                                      </button>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleAdminRestorePost(post.id)}
                                          className="px-3 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                                          title="Khôi phục lại bài viết này lên Bảng tin công khai"
                                        >
                                          <RotateCcw size={13} />
                                          <span>Khôi phục</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleAdminHardDelete(post.id)}
                                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                                          title="Xóa triệt để khỏi cơ sở dữ liệu"
                                        >
                                          <Trash2 size={13} />
                                          <span>Xóa vĩnh viễn</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab 2: Quản lý Đăng lại (Reposts) của User */}
                {adminPostsSubTab === 'reposts' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Repeat size={16} className="text-emerald-400 flex-shrink-0" />
                        <span>
                          Quản lý các lượt chia sẻ/đăng lại của thành viên. 
                          <strong> Khi gỡ một lượt đăng lại, bài viết gốc của tác giả vẫn được bảo toàn nguyên vẹn.</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={fetchAdminReposts}
                        className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1 font-mono flex-shrink-0"
                      >
                        <RefreshCw size={11} />
                        Làm mới
                      </button>
                    </div>

                    {loadingAdminReposts ? (
                      <div className="p-12 text-center text-zinc-500 text-xs font-mono flex flex-col items-center gap-2">
                        <RefreshCw size={20} className="animate-spin text-emerald-500" />
                        <span>Đang tải danh sách đăng lại của thành viên...</span>
                      </div>
                    ) : adminReposts.length === 0 ? (
                      <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800 text-zinc-500 text-xs">
                        Chưa có lượt đăng lại nào từ thành viên.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/80">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-zinc-800 text-zinc-400 font-mono text-[11px] bg-zinc-950/60">
                              <th className="p-3.5">ID</th>
                              <th className="p-3.5">Người đăng lại</th>
                              <th className="p-3.5">Bài viết gốc</th>
                              <th className="p-3.5">Tác giả bài gốc</th>
                              <th className="p-3.5">Trạng thái bài gốc</th>
                              <th className="p-3.5">Thời gian</th>
                              <th className="p-3.5 text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/60">
                            {adminReposts.map((rep) => {
                              const origPost = rep.post;
                              const isOrigDeleted = origPost && Boolean(origPost.isDeleted);
                              return (
                                <tr key={rep.id} className="hover:bg-zinc-800/30 transition-colors">
                                  <td className="p-3.5 font-mono text-zinc-500">#{rep.id}</td>
                                  <td className="p-3.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-[10px] text-zinc-300">
                                        {(rep.user?.nickname || rep.user?.account || 'U').charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="font-bold text-white">{rep.user?.nickname || rep.user?.account}</div>
                                        <div className="text-[10px] font-mono text-zinc-500">@{rep.user?.account}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3.5 max-w-xs">
                                    <p className="line-clamp-2 text-zinc-300 text-[11.5px]">
                                      {origPost ? (origPost.content || '(Tệp đính kèm)') : '<Bài viết không còn tồn tại>'}
                                    </p>
                                  </td>
                                  <td className="p-3.5">
                                    <span className="font-medium text-zinc-300">
                                      {origPost?.userEntity?.nickname || origPost?.userEntity?.account || 'N/A'}
                                    </span>
                                  </td>
                                  <td className="p-3.5">
                                    {isOrigDeleted ? (
                                      <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-[10.5px] font-semibold border border-rose-500/30">
                                        Đã gỡ bài gốc
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10.5px] font-semibold border border-emerald-500/20">
                                        Đang hoạt động
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3.5 font-mono text-[11px] text-zinc-500">
                                    {rep.createdAt ? new Date(rep.createdAt).toLocaleString('vi-VN') : 'N/A'}
                                  </td>
                                  <td className="p-3.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleAdminDeleteRepost(rep.id)}
                                      className="px-2.5 py-1 rounded-lg bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-semibold transition-all inline-flex items-center gap-1"
                                      title="Gỡ lượt đăng lại này mà không ảnh hưởng tới bài viết gốc"
                                    >
                                      <Trash2 size={12} />
                                      <span>Gỡ đăng lại</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ====================================================
                TAB 3: THẺ BÀI THỬ THÁCH (CHALLENGES - DYNAMIC CATEGORIES)
                ==================================================== */}
            {activeTab === 'challenges' && hasPermission('TL_PERM_CHALLENGE_MANAGE') && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Quản Lý Thẻ Bài Thử Thách</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Thêm, sửa, xóa các câu hỏi tâm lý & tương tác cho người dùng trên Sảnh</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs flex items-center gap-1.5 border border-zinc-800 transition-all"
                    >
                      <FolderCog size={14} className="text-indigo-400" />
                      <span>Quản lý Thể loại ({challengeCategories.length})</span>
                    </button>
                    <button
                      onClick={handleOpenAddChallenge}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all"
                    >
                      <Plus size={14} />
                      <span>Thêm câu hỏi mới</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm nội dung câu hỏi thử thách..."
                      value={challengeSearch}
                      onChange={(e) => setChallengeSearch(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Dynamic Category Pills Filter */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <button
                      onClick={() => setChallengeFilter('ALL')}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        challengeFilter === 'ALL' 
                          ? 'bg-white text-black font-bold' 
                          : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      Tất cả ({challenges.length})
                    </button>
                    {challengeCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setChallengeFilter(cat.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          challengeFilter === cat.id 
                            ? 'bg-zinc-800 text-white border border-zinc-600 font-bold' 
                            : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: cat.color || '#818cf8' }}></span>
                        <span>{cat.name}</span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          ({challenges.filter(c => c.category === cat.id).length})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* List of Challenges */}
                <div className="space-y-2.5">
                  {filteredChallenges.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl bg-zinc-900/30 border border-dashed border-zinc-800 text-zinc-400 text-xs">
                      Không tìm thấy câu hỏi nào phù hợp với bộ lọc.
                    </div>
                  ) : (
                    filteredChallenges.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 flex items-start justify-between gap-4 transition-all"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span 
                              className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider"
                              style={{ 
                                background: `${item.badgeColor || '#818cf8'}20`, 
                                color: item.badgeColor || '#818cf8',
                                border: `1px solid ${item.badgeColor || '#818cf8'}40`
                              }}
                            >
                              {item.categoryName || item.category}
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400">Đã bốc: {item.usageCount || 0} lần</span>
                            {!item.active && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                                Đang ẩn
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-zinc-200 leading-snug break-words">
                            "{item.question}"
                          </p>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                          <button
                            onClick={() => handleToggleChallenge(item)}
                            className={`p-1.5 rounded-lg text-xs transition-all ${item.active ? 'text-zinc-400 hover:text-white' : 'text-amber-400'}`}
                            title={item.active ? "Ẩn câu hỏi" : "Kích hoạt câu hỏi"}
                          >
                            {item.active ? <Eye size={15} /> : <EyeOff size={15} />}
                          </button>
                          <button
                            onClick={() => handleOpenEditChallenge(item)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-400 transition-all"
                            title="Chỉnh sửa câu hỏi"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteChallenge(item.id)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 transition-all"
                            title="Xóa câu hỏi"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ====================================================
                TAB 4: CHỦ ĐỀ & CẢM XÚC (VIBE TAGS)
                ==================================================== */}
            {activeTab === 'vibes' && hasPermission('TL_PERM_TOPIC_MANAGE') && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Chủ Đề & Thẻ Cảm Xúc (Vibes)</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Quản lý các chip cảm xúc và chủ đề thảo luận nhanh cho thành viên khi đăng bài</p>
                  </div>
                  <button
                    onClick={() => saveConfigToBackend({ vibe_options: JSON.stringify(parsedVibes) }, "Đã lưu danh sách thẻ cảm xúc!")}
                    disabled={isSavingConfig}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all"
                  >
                    <Save size={14} />
                    <span>Lưu Thẻ Cảm Xúc</span>
                  </button>
                </div>

                <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nhập tên cảm xúc mới (ví dụ: Chữa lành, Hào hứng, Tâm đắc)..."
                      value={newVibeInput}
                      onChange={(e) => setNewVibeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (!newVibeInput.trim()) return;
                          if (parsedVibes.includes(newVibeInput.trim())) return toast.error("Đã tồn tại!");
                          setParsedVibes([...parsedVibes, newVibeInput.trim()]);
                          setNewVibeInput('');
                        }
                      }}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => {
                        if (!newVibeInput.trim()) return;
                        if (parsedVibes.includes(newVibeInput.trim())) return toast.error("Đã tồn tại!");
                        setParsedVibes([...parsedVibes, newVibeInput.trim()]);
                        setNewVibeInput('');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus size={14} />
                      <span>Thêm Thẻ</span>
                    </button>
                  </div>

                  <div>
                    <span className="text-xs font-mono text-zinc-400 block mb-3 font-semibold">
                      DANH SÁCH CÁC THẺ CẢM XÚC ĐANG HIỂN THỊ TRÊN SẢNH ({parsedVibes.length}):
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {parsedVibes.map((vibe) => (
                        <div
                          key={vibe}
                          className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-2 text-xs font-semibold text-zinc-200 group hover:border-zinc-700"
                        >
                          <Sparkles size={12} className="text-indigo-400" />
                          <span>{vibe}</span>
                          <button
                            type="button"
                            onClick={() => setParsedVibes(parsedVibes.filter(v => v !== vibe))}
                            className="text-zinc-500 hover:text-red-400 ml-1"
                            title="Xóa thẻ này"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ====================================================
                TAB: QUẢN LÝ BĂNG TẦN & ĐÀI NHẠC FM (FREQUENCY & AUDIO CHANNELS)
                ==================================================== */}
            {activeTab === 'frequency_management' && (hasPermission('TL_PERM_MUSIC_MANAGE') || hasPermission('TL_PERM_BRAND_MANAGE')) && (
              <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                      <Radio size={20} className="text-emerald-400" />
                      <span>Quản Lý Băng Tần FM & Đài Phát Nhạc Hệ Thống</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Cấu hình động dải tần số MHz cho Trạm Dò Sóng FM và quản trị các luồng phát thanh Lo-Fi / Ambient
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchFrequencyData}
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-semibold text-xs flex items-center gap-1.5 transition-all border border-zinc-700/60"
                    >
                      <RefreshCw size={13} className={loadingFrequency ? 'animate-spin' : ''} />
                      <span>Làm mới</span>
                    </button>
                  </div>
                </div>

                {/* Live Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Signal size={20} />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono text-zinc-400">Trạm phát sóng trực tiếp</span>
                      <h4 className="text-lg font-bold font-mono text-emerald-400">{liveFrequencyStats.activeBroadcasters || 0}</h4>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                      <Radio size={20} />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono text-zinc-400">Băng tần quy hoạch</span>
                      <h4 className="text-lg font-bold font-mono text-sky-400">{adminIntents.length}</h4>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                      <Disc3 size={20} />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono text-zinc-400">Luồng radio phát thật</span>
                      <h4 className="text-lg font-bold font-mono text-purple-400">{adminChannels.length}</h4>
                    </div>
                  </div>
                </div>

                {/* BẢNG 1: QUẢN LÝ BĂNG TẦN KẾT NỐI (MatchIntent) */}
                <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-200">1. Danh mục Băng Tần FM (Match Intents)</h3>
                      <p className="text-xs text-zinc-400">Quy hoạch dải tần MHz riêng biệt cho từng mục đích kết nối</p>
                    </div>
                    <button
                      onClick={handleOpenAddIntent}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Plus size={13} />
                      <span>Thêm băng tần</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                          <th className="py-2.5 px-3">MÃ (CODE)</th>
                          <th className="py-2.5 px-3">TIÊU ĐỀ & MÔ TẢ</th>
                          <th className="py-2.5 px-3">DẢI TẦN (MHZ)</th>
                          <th className="py-2.5 px-3">ICON</th>
                          <th className="py-2.5 px-3">THỨ TỰ</th>
                          <th className="py-2.5 px-3 text-center">TRẠNG THÁI</th>
                          <th className="py-2.5 px-3 text-right">THAO TÁC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 font-sans">
                        {adminIntents.map(intent => (
                          <tr key={intent.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="py-3 px-3 font-mono text-emerald-400 font-semibold">{intent.code}</td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-zinc-200 block">{intent.title}</span>
                              <span className="text-[11px] text-zinc-400">{intent.subtitle}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-zinc-300">
                              {intent.freqStart?.toFixed(1)} - {intent.freqEnd?.toFixed(1)} MHz
                            </td>
                            <td className="py-3 px-3 font-mono text-zinc-400">{intent.iconName || 'Radio'}</td>
                            <td className="py-3 px-3 font-mono text-zinc-400">{intent.displayOrder || 1}</td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleToggleIntent(intent.id)}
                                className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold border transition-all ${
                                  intent.isActive !== false
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                    : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                                }`}
                              >
                                {intent.isActive !== false ? 'KÍCH HOẠT' : 'TẠM TẮT'}
                              </button>
                            </td>
                            <td className="py-3 px-3 text-right space-x-1.5">
                              <button
                                onClick={() => handleOpenEditIntent(intent)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteIntent(intent.id)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                                title="Xóa"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* BẢNG 2: QUẢN LÝ ĐÀI PHÁT NHẠC HỆ THỐNG (AudioChannel) */}
                <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-200">2. Đài Phát Nhạc Nền Hệ Thống (Audio Channels)</h3>
                      <p className="text-xs text-zinc-400">Các luồng radio Lo-Fi / Ambient phát trực tiếp trên sảnh và phòng chung</p>
                    </div>
                    <button
                      onClick={handleOpenAddChannel}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Plus size={13} />
                      <span>Thêm luồng radio</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                          <th className="py-2.5 px-3">TÊN ĐÀI PHÁT</th>
                          <th className="py-2.5 px-3">THỂ LOẠI / TAG</th>
                          <th className="py-2.5 px-3">STREAM URL</th>
                          <th className="py-2.5 px-3 text-center">TRẠNG THÁI</th>
                          <th className="py-2.5 px-3 text-right">THAO TÁC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 font-sans">
                        {adminChannels.map(ch => (
                          <tr key={ch.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="py-3 px-3 font-semibold text-zinc-200 flex items-center gap-2">
                              <Disc3 size={14} className="text-purple-400 flex-shrink-0" />
                              <span>{ch.name}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/60 text-zinc-300 font-mono text-[10px]">
                                {ch.genreTag || 'Lo-Fi'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-zinc-400 max-w-[240px] truncate" title={ch.streamUrl}>
                              {ch.streamUrl}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleToggleChannel(ch.id)}
                                className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold border transition-all ${
                                  ch.isActive !== false
                                    ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                                    : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                                }`}
                              >
                                {ch.isActive !== false ? 'KÍCH HOẠT' : 'TẠM TẮT'}
                              </button>
                            </td>
                            <td className="py-3 px-3 text-right space-x-1.5">
                              <button
                                onClick={() => handleOpenEditChannel(ch)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteChannel(ch.id)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                                title="Xóa"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ====================================================
                TAB 5: ÂM NHẠC HỆ THỐNG (MUSIC)
                ==================================================== */}
            {activeTab === 'music' && hasPermission('TL_PERM_MUSIC_MANAGE') && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Âm Nhạc Hệ Thống</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Kho nhạc Lo-Fi Chill phát nền thư giãn cho sảnh trực tuyến</p>
                  </div>
                  <button
                    onClick={() => setIsAddTrackOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all"
                  >
                    <Plus size={14} />
                    <span>Thêm bản nhạc mới</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {tracks.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl bg-zinc-900/30 border border-dashed border-zinc-800 text-zinc-400 text-xs">
                      Kho âm nhạc hiện chưa có bản nhạc nào. Hãy thêm file audio .mp3 đầu tiên!
                    </div>
                  ) : (
                    tracks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 flex items-center justify-between gap-4 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => handleTogglePlayAudio(t)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                              playingTrackId === t.id 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900' 
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }`}
                          >
                            {playingTrackId === t.id ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
                          </button>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-zinc-200 truncate">{t.name}</span>
                            <span className="text-[11px] text-zinc-400 truncate">{t.artist || 'Không rõ nghệ sĩ'} • {t.genre || 'Chill'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-mono text-zinc-400 max-w-[150px] truncate hidden sm:inline">
                            {t.audioSrc}
                          </span>
                          <button
                            onClick={() => handleDeleteTrack(t.id)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 transition-all"
                            title="Xóa bài hát"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ====================================================
                TAB 6: QUẢN LÝ THÀNH VIÊN (USERS & ROLE ASSIGNMENT)
                ==================================================== */}
            {activeTab === 'users' && hasPermission('TL_PERM_USER_MANAGE') && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Quản Lý Thành Viên & Phân Quyền Hạt Mịn</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Xem danh sách người dùng, kiểm soát trạng thái khóa và cấp phát quyền hạn theo từng phân hệ</p>
                  </div>
                </div>

                {/* Search & Filter Header */}
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên, nickname, account hoặc email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <button
                      onClick={() => setUserRoleFilter('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${userRoleFilter === 'ALL' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                    >
                      Tất cả ({users.length})
                    </button>
                    <button
                      onClick={() => setUserRoleFilter('ADMIN')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${userRoleFilter === 'ADMIN' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                    >
                      Có quyền Quản trị
                    </button>
                    <button
                      onClick={() => setUserRoleFilter('MEMBER')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${userRoleFilter === 'MEMBER' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                    >
                      Thành viên thường
                    </button>
                  </div>
                </div>

                {/* Users List Table */}
                <div className="space-y-2">
                  {filteredUsers.map((u) => {
                    const roles = u.roles || [];
                    const isSuper = roles.includes('ROLE_ADMIN') || roles.includes('TL_SYS_SUPERADMIN');
                    const isMod = roles.some(r => r.startsWith('TL_ROLE_') || r.startsWith('TL_PERM_'));

                    return (
                      <div
                        key={u.id}
                        className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 flex items-center justify-between gap-3 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 flex items-center justify-center font-bold text-white flex-shrink-0">
                            {(u.nickname || u.account || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-zinc-100 truncate">{u.nickname || u.account}</span>
                              <span className="text-[10px] font-mono text-zinc-400">@{u.account}</span>
                              {isSuper ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                  Super Admin
                                </span>
                              ) : isMod ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                  Quản trị bộ phận
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                                  Thành viên
                                </span>
                              )}
                              {!u.active && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-red-950 text-red-300 border border-red-800">
                                  Đã khóa
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-400 truncate">{u.email || 'Chưa đăng ký email'} • ID: {u.id}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {hasPermission('TL_PERM_ROLE_MANAGE') && (
                            <button
                              onClick={() => handleOpenRoleModal(u)}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                            >
                              <ShieldCheck size={13} />
                              <span>Phân quyền</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`p-2 rounded-lg border text-xs transition-all ${
                              u.active 
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-red-400' 
                                : 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white'
                            }`}
                            title={u.active ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                          >
                            {u.active ? <Lock size={14} /> : <Unlock size={14} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ====================================================
                TAB 7: VAI TRÒ & QUYỀN HẠN (SYSTEM ROLES MATRIX)
                ==================================================== */}
            {activeTab === 'roles' && hasPermission('TL_PERM_ROLE_MANAGE') && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Quản Lý Vai Trò & Ma Trận Phân Quyền</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Tạo các vai trò tùy biến và gắn quyền hạn theo từng tính năng cụ thể</p>
                  </div>
                  <button
                    onClick={() => {
                      setRoleFormData({
                        id: '',
                        name: '',
                        description: '',
                        permissions: ['TL_PERM_STATS_VIEW'],
                        badgeColor: '#6366f1'
                      });
                      setIsAddRoleModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-950 transition-all"
                  >
                    <ShieldPlus size={14} />
                    <span>Tạo vai trò mới</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {systemRoles.map((role) => (
                    <div
                      key={role.id}
                      className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span 
                              className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold"
                              style={{ 
                                background: `${role.badgeColor || '#6366f1'}20`, 
                                color: role.badgeColor || '#6366f1',
                                border: `1px solid ${role.badgeColor || '#6366f1'}40`
                              }}
                            >
                              {role.id}
                            </span>
                            <h3 className="text-sm font-bold text-white">{role.name}</h3>
                          </div>
                          {role.id !== 'TL_SYS_SUPERADMIN' && (
                            <button
                              onClick={() => handleDeleteRole(role.id)}
                              className="text-zinc-500 hover:text-red-400 p-1"
                              title="Xóa vai trò này"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 leading-snug">{role.description}</p>
                      </div>

                      <div className="pt-2 border-t border-zinc-800/60">
                        <span className="text-[10px] font-mono text-zinc-400 block mb-1.5 uppercase font-semibold">Quyền hạn kích hoạt:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {role.permissions.map((p) => {
                            const pDef = SYSTEM_PERMISSIONS.find(sp => sp.id === p);
                            return (
                              <span
                                key={p}
                                className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-zinc-950 border border-zinc-800 text-zinc-300"
                              >
                                {pDef ? pDef.name : p}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ====================================================
                TAB 8: QUẢN TRỊ CỘNG ĐỒNG & LÝ DO TỪ CHỐI BÀI VIẾT
                ==================================================== */}
            {activeTab === 'communities' && (hasPermission('TL_PERM_COMMUNITY_MANAGE') || hasPermission('TL_PERM_USER_MANAGE')) && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Quản Trị Cộng Đồng & Nội Quy</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Quản lý các không gian cộng đồng, toggle đề xuất ra Feed chung và cấu hình danh mục lý do từ chối bài viết</p>
                  </div>
                  <button
                    onClick={fetchAdminGroups}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto"
                  >
                    <RefreshCw size={13} className={loadingGroups ? 'animate-spin' : ''} />
                    <span>Làm mới danh sách</span>
                  </button>
                </div>

                {/* Section 1: Danh sách cộng đồng */}
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                      <Globe size={16} className="text-emerald-400" />
                      Danh Sách Các Nhóm Cộng Đồng ({adminGroups.length})
                    </h3>
                    <span className="text-xs font-mono text-zinc-500">Đồng bộ cơ sở dữ liệu thời gian thực</span>
                  </div>

                  {loadingGroups ? (
                    <div className="py-8 text-center text-zinc-500 font-mono text-xs">Đang tải danh sách cộng đồng...</div>
                  ) : adminGroups.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500 text-xs">Chưa có cộng đồng nào được tạo trong hệ thống.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {adminGroups.map(group => (
                        <div key={group.id} className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col justify-between space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-200 overflow-hidden flex-shrink-0">
                                {group.avatarUrl ? (
                                  <img src={group.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  (group.name || 'G').charAt(0).toUpperCase()
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-zinc-100 line-clamp-1">{group.name}</h4>
                                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 mt-0.5">
                                  <span>Chủ nhóm: {group.ownerName || 'Hệ thống'}</span>
                                  <span>•</span>
                                  <span>{group.membersCount || 1} thành viên</span>
                                  <span>•</span>
                                  <span>{group.postsCount || 0} bài viết</span>
                                </div>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${group.isPrivate ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                              {group.isPrivate ? 'Riêng tư' : 'Công khai'}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                            {group.description || 'Chưa cập nhật mô tả cộng đồng.'}
                          </p>

                          <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                              <input
                                type="checkbox"
                                checked={group.isPublicToFeed !== false}
                                onChange={() => handleToggleGroupFeed(group.id, group.isPublicToFeed !== false)}
                                className="accent-emerald-500 rounded"
                              />
                              <span className="text-[11px] text-zinc-300">Đề xuất ra Feed chung</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                              <input
                                type="checkbox"
                                checked={!!group.requiresPostApproval}
                                onChange={() => handleToggleGroupApproval(group.id, !!group.requiresPostApproval)}
                                className="accent-sky-500 rounded"
                              />
                              <span className="text-[11px] text-zinc-300">Duyệt bài trước khi đăng</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: Danh mục lý do từ chối bài viết mẫu */}
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <Tag size={16} className="text-rose-400" />
                        Danh Mục Lý Do Từ Chối Bài Viết (Reject Reasons)
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Quản lý động danh mục lý do hiển thị cho Quản trị viên nhóm khi từ chối bài viết. Không fix cứng mã nguồn.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleAddRejectReason} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nhập lý do từ chối mẫu mới (VD: Vi phạm quy định phát ngôn, Quảng cáo trái phép...)"
                      value={newReasonInput}
                      onChange={(e) => setNewReasonInput(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 placeholder-zinc-600"
                    />
                    <button
                      type="submit"
                      disabled={!newReasonInput.trim()}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>Thêm lý do</span>
                    </button>
                  </form>

                  <div className="space-y-2">
                    {rejectReasons.map((reason) => (
                      <div
                        key={reason.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0"></span>
                          <span className="text-xs font-medium text-zinc-200">{reason.label}</span>
                          <span className="text-[10px] font-mono text-zinc-500">({reason.id})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteRejectReason(reason.id)}
                          className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                          title="Xóa lý do này"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ====================================================
                TAB 8: QUẢN TRỊ BÁO CÁO VI PHẠM & KIỂM DUYỆT (POST REPORTS)
                ==================================================== */}
            {activeTab === 'reports' && hasPermission('TL_PERM_COMMUNITY_MANAGE') && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                      <AlertTriangle size={20} className="text-amber-400" />
                      <span>Quản Trị Báo Cáo Vi Phạm & Kiểm Duyệt</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Kiểm duyệt các bài viết bị người dùng gắn cờ vi phạm, xem xét gỡ bỏ nội dung và gửi cảnh báo trực tiếp qua hệ thống thông báo realtime.
                    </p>
                  </div>
                  <button
                    onClick={fetchReports}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto"
                  >
                    <RefreshCw size={13} className={loadingReports ? "animate-spin" : ""} />
                    <span>Làm mới danh sách</span>
                  </button>
                </div>

                {/* 4 Thẻ chỉ số tổng quan báo cáo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-zinc-900 border border-amber-500/30">
                    <span className="text-[10px] font-mono text-amber-400 block mb-1">Chờ xử lý</span>
                    <span className="text-2xl font-black text-amber-300 font-mono">
                      {reports.filter(r => r.status === 'PENDING').length}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-zinc-900 border border-rose-500/30">
                    <span className="text-[10px] font-mono text-rose-400 block mb-1">Đã gỡ bài</span>
                    <span className="text-2xl font-black text-rose-400 font-mono">
                      {reports.filter(r => r.status === 'RESOLVED_TAKEDOWN').length}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800">
                    <span className="text-[10px] font-mono text-zinc-400 block mb-1">Đã bỏ qua</span>
                    <span className="text-2xl font-black text-zinc-300 font-mono">
                      {reports.filter(r => r.status === 'DISMISSED').length}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800">
                    <span className="text-[10px] font-mono text-zinc-400 block mb-1">Tổng số báo cáo</span>
                    <span className="text-2xl font-black text-zinc-100 font-mono">
                      {reports.length}
                    </span>
                  </div>
                </div>

                {/* Bộ lọc trạng thái */}
                <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 rounded-xl border border-zinc-800 w-fit">
                  {[
                    { id: 'ALL', label: `Tất cả (${reports.length})` },
                    { id: 'PENDING', label: `Chờ xử lý (${reports.filter(r => r.status === 'PENDING').length})` },
                    { id: 'RESOLVED_TAKEDOWN', label: `Đã gỡ bài (${reports.filter(r => r.status === 'RESOLVED_TAKEDOWN').length})` },
                    { id: 'DISMISSED', label: `Đã bỏ qua (${reports.filter(r => r.status === 'DISMISSED').length})` }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setReportFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        reportFilter === f.id
                          ? 'bg-zinc-800 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Danh sách Báo cáo */}
                <div className="space-y-3">
                  {reports
                    .filter(r => reportFilter === 'ALL' || r.status === reportFilter)
                    .map(r => {
                      const reasonObj = reportReasons.find(item => item.id === r.reason);
                      const reasonLabel = reasonObj ? reasonObj.label : r.reason;

                      return (
                        <div
                          key={r.id}
                          className={`p-4 rounded-2xl bg-zinc-900/90 border transition-all ${
                            r.status === 'PENDING'
                              ? 'border-amber-500/40 shadow-lg shadow-amber-950/10'
                              : 'border-zinc-800/80 opacity-80'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                                r.status === 'PENDING'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : r.status === 'RESOLVED_TAKEDOWN'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              }`}>
                                {r.status === 'PENDING' ? '⏳ Chờ xem xét' : r.status === 'RESOLVED_TAKEDOWN' ? '🚫 Đã gỡ bỏ bài' : '✓ Đã bỏ qua'}
                              </span>

                              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold">
                                {reasonLabel}
                              </span>

                              <span className="text-[11px] font-mono text-zinc-500">
                                Mã bài viết: #{r.postId}
                              </span>
                            </div>

                            <span className="text-[11px] font-mono text-zinc-500">
                              Báo cáo lúc: {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : 'Gần đây'}
                            </span>
                          </div>

                          {/* Chi tiết nội dung bài viết bị báo cáo */}
                          <div className="space-y-2 mb-3">
                            <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/60">
                              <span className="text-[10px] font-mono text-zinc-400 block mb-1">
                                Tác giả: <strong className="text-zinc-200">{r.postAuthorName || 'Thành viên'}</strong> (ID: {r.postAuthorId})
                              </span>
                              <p className="text-xs text-zinc-200 italic font-serif leading-relaxed line-clamp-3">
                                "{r.postContent || '(Bài viết không có văn bản hoặc chỉ có ảnh/video)'}"
                              </p>
                            </div>

                            <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                              <span className="font-mono text-zinc-500">Người báo cáo:</span>
                              <strong className="text-zinc-300">{r.reporterName}</strong>
                              {r.details && (
                                <span className="text-zinc-400">
                                  — Ghi chú thêm: <em className="text-zinc-300 font-sans">"{r.details}"</em>
                                </span>
                              )}
                            </div>

                            {r.adminNote && (
                              <div className="p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-800/50 text-xs text-zinc-400">
                                <span className="font-mono text-amber-400">Ghi chú xử lý của Quản trị viên:</span> {r.adminNote}
                              </div>
                            )}
                          </div>

                          {/* Hành động của Quản trị viên */}
                          {r.status === 'PENDING' && (
                            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setReportActionModal({
                                  isOpen: true,
                                  report: r,
                                  action: 'TAKEDOWN',
                                  note: `Vi phạm quy chuẩn: ${reasonLabel}`
                                })}
                                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-950/30 flex items-center gap-1.5 active:scale-95"
                              >
                                <Trash2 size={13} />
                                <span>Gỡ bài vi phạm & Báo tác giả</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleResolveReport(r.id, 'DISMISS', 'Nội dung hợp lệ')}
                                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all border border-zinc-700 active:scale-95"
                              >
                                Bỏ qua báo cáo
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {reports.filter(r => reportFilter === 'ALL' || r.status === reportFilter).length === 0 && (
                    <div className="p-12 text-center text-zinc-500 text-xs font-mono bg-zinc-900/40 rounded-2xl border border-zinc-800">
                      Không có báo cáo nào trong mục này.
                    </div>
                  )}
                </div>

                {/* ====================================================
                    QUẢN LÝ DANH MỤC LÝ DO BÁO CÁO (ĐỘNG TỪ CSDL)
                    ==================================================== */}
                <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <Tag size={15} className="text-emerald-400" />
                        <span>Danh Mục Lý Do Báo Cáo Vi Phạm (Động từ CSDL)</span>
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Tất cả lý do này được lưu trong CSDL hệ thống và đồng bộ ngay lập tức tới modal báo cáo phía người dùng mà không cần sửa code.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAddReportReasonOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto shadow-sm"
                    >
                      <Plus size={14} />
                      <span>Thêm lý do mới</span>
                    </button>
                  </div>

                  {/* Form thêm lý do mới */}
                  {isAddReportReasonOpen && (
                    <form onSubmit={handleAddReportReason} className="p-4 rounded-xl bg-zinc-950 border border-emerald-500/40 space-y-3 animate-fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-zinc-400 font-mono block mb-1">Mã định danh (ID) *</label>
                          <input
                            type="text"
                            placeholder="VD: COPYRIGHT, SCAM, INAPPROPRIATE..."
                            value={newReportReason.id}
                            onChange={(e) => setNewReportReason({ ...newReportReason, id: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono uppercase"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 font-mono block mb-1">Tên hiển thị cho người dùng *</label>
                          <input
                            type="text"
                            placeholder="VD: Vi phạm bản quyền hình ảnh..."
                            value={newReportReason.label}
                            onChange={(e) => setNewReportReason({ ...newReportReason, label: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddReportReasonOpen(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
                        >
                          Lưu vào hệ thống
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Danh sách các lý do báo cáo hiện tại */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {reportReasons.map((reason) => (
                      <div
                        key={reason.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
                          <span className="text-xs font-semibold text-zinc-200 truncate">{reason.label}</span>
                          <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">({reason.id})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteReportReason(reason.id)}
                          className="text-zinc-500 hover:text-rose-400 p-1 transition-colors flex-shrink-0"
                          title="Xóa lý do này"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* ====================================================
          MODAL: THÊM / CHỈNH SỬA CÂU HỎI THỬ THÁCH
          ==================================================== */}
      {isAddChallengeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsAddChallengeOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                {editingChallengeItem ? "Chỉnh Sửa Câu Hỏi Thử Thách" : "Thêm Câu Hỏi Thử Thách Mới"}
              </h3>
              <button onClick={() => setIsAddChallengeOpen(false)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveChallengeForm} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 font-mono mb-1 block">Nội dung câu hỏi / thử thách *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Nhập câu hỏi gợi mở, sâu sắc hoặc thử thách thú vị..."
                  value={challengeFormData.question}
                  onChange={(e) => setChallengeFormData({ ...challengeFormData, question: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium resize-none leading-relaxed"
                />
              </div>

              {/* Dynamic Category Selector */}
              <div>
                <label className="text-xs text-zinc-400 font-mono mb-1 block">Thể loại (Tự động cập nhật từ CSDL)</label>
                <select
                  value={challengeFormData.category}
                  onChange={(e) => {
                    const selectedCatId = e.target.value;
                    const catObj = challengeCategories.find(c => c.id === selectedCatId) || { id: selectedCatId, name: selectedCatId, color: '#818cf8' };
                    setChallengeFormData({
                      ...challengeFormData,
                      category: catObj.id,
                      categoryName: catObj.name,
                      badgeColor: catObj.color
                    });
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  {challengeCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddChallengeOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950"
                >
                  {editingChallengeItem ? "Cập nhật" : "Lưu câu hỏi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL: QUẢN LÝ THỂ LOẠI THỬ THÁCH ĐỘNG (CATEGORY CONFIG)
          ==================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsCategoryModalOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderCog size={16} className="text-indigo-400" />
                Quản Lý Danh Mục Thể Loại Thử Thách
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Form thêm thể loại mới */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                <span className="text-xs font-bold text-zinc-200 block">Thêm hoặc Cập nhật Thể loại:</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 mb-0.5 block">Mã thể loại (ID)</label>
                    <input
                      type="text"
                      placeholder="VD: SECRET_STORY"
                      value={editingCategory.id}
                      onChange={(e) => setEditingCategory({ ...editingCategory, id: e.target.value.toUpperCase() })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 mb-0.5 block">Tên hiển thị tiếng Việt</label>
                    <input
                      type="text"
                      placeholder="VD: Bí mật chưa kể"
                      value={editingCategory.name}
                      onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-400">Màu huy hiệu:</span>
                    <input
                      type="color"
                      value={editingCategory.color}
                      onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveCategory}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                  >
                    Lưu Thể Loại
                  </button>
                </div>
              </div>

              {/* Danh sách các thể loại đang có */}
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {challengeCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: cat.color }}></span>
                      <span className="text-xs font-bold text-zinc-200 truncate">{cat.name}</span>
                      <span className="text-[10px] font-mono text-zinc-400">({cat.id})</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingCategory(cat)}
                        className="p-1 rounded text-zinc-400 hover:text-white"
                        title="Chỉnh sửa"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1 rounded text-zinc-400 hover:text-red-400"
                        title="Xóa thể loại này"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL: THÊM BÀI HÁT MỚI (ADD TRACK)
          ==================================================== */}
      {isAddTrackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsAddTrackOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Music size={16} className="text-indigo-400" />
                Thêm Bản Nhạc Mới Vào Sảnh
              </h3>
              <button onClick={() => setIsAddTrackOpen(false)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddTrack} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 font-mono mb-1 block">Tên bài hát *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Night Coffee Chill"
                  value={newTrack.name}
                  onChange={(e) => setNewTrack({ ...newTrack, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-mono mb-1 block">Nghệ sĩ / Tác giả</label>
                <input
                  type="text"
                  placeholder="VD: Talovin Records"
                  value={newTrack.artist}
                  onChange={(e) => setNewTrack({ ...newTrack, artist: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-mono mb-1 block">Đường dẫn file âm thanh (.mp3) *</label>
                <input
                  type="url"
                  required
                  placeholder="https://.../song.mp3"
                  value={newTrack.audioSrc}
                  onChange={(e) => setNewTrack({ ...newTrack, audioSrc: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddTrackOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950"
                >
                  Thêm bản nhạc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL: PHÂN QUYỀN THÀNH VIÊN (GRANULAR ROLE ASSIGNMENT)
          ==================================================== */}
      {selectedUserForRoles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setSelectedUserForRoles(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck size={16} className="text-indigo-400" />
                  Cấp Quyền Cho: {selectedUserForRoles.nickname || selectedUserForRoles.account}
                </h3>
                <span className="text-[11px] font-mono text-zinc-400">@{selectedUserForRoles.account} • ID: {selectedUserForRoles.id}</span>
              </div>
              <button onClick={() => setSelectedUserForRoles(null)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {/* Chọn vai trò chính (Roles) */}
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-2 font-mono">
                  1. GÁN VAI TRÒ HỆ THỐNG (SYSTEM ROLES):
                </label>
                <div className="space-y-2">
                  {systemRoles.map((role) => {
                    const isChecked = userRolesEditList.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-indigo-600/10 border-indigo-500/40 text-white' 
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUserRolesEditList([...userRolesEditList, role.id]);
                            } else {
                              setUserRolesEditList(userRolesEditList.filter(r => r !== role.id));
                            }
                          }}
                          className="mt-1 rounded text-indigo-600"
                        />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-200">{role.name}</span>
                            <span className="text-[10px] font-mono text-zinc-400">({role.id})</span>
                          </div>
                          <span className="text-[11px] text-zinc-400">{role.description}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Tích chọn quyền hạn hạt mịn trực tiếp */}
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-2 font-mono">
                  2. CẤP QUYỀN HẠN HẠT MỊN TRỰC TIẾP (GRANULAR PERMISSIONS):
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {SYSTEM_PERMISSIONS.map((perm) => {
                    const isChecked = userRolesEditList.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                          isChecked ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-950 border-zinc-850 text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setUserRolesEditList([...userRolesEditList, perm.id]);
                              } else {
                                setUserRolesEditList(userRolesEditList.filter(r => r !== perm.id));
                              }
                            }}
                            className="rounded text-indigo-600"
                          />
                          <span className="text-xs font-medium text-zinc-200">{perm.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400">{perm.module}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedUserForRoles(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveUserRoles}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-950"
              >
                Lưu Phân Quyền
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL: TẠO VAI TRÒ MỚI (CREATE SYSTEM ROLE)
          ==================================================== */}
      {isAddRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsAddRoleModalOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldPlus size={16} className="text-indigo-400" />
                Định Nghĩa Vai Trò Mới
              </h3>
              <button onClick={() => setIsAddRoleModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 font-mono mb-1 block">Mã vai trò (Role ID) *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: TL_ROLE_EVENT_HOST"
                  value={roleFormData.id}
                  onChange={(e) => setRoleFormData({ ...roleFormData, id: e.target.value.toUpperCase() })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-mono mb-1 block">Tên hiển thị vai trò *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Người điều phối sự kiện"
                  value={roleFormData.name}
                  onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-mono mb-1 block">Mô tả quyền hạn / trách nhiệm</label>
                <input
                  type="text"
                  placeholder="VD: Chịu trách nhiệm thẻ bài và sự kiện trên Sảnh"
                  value={roleFormData.description}
                  onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-mono mb-1.5 block">Chọn các quyền hạn gán cho vai trò này:</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar p-2 rounded-xl bg-zinc-950 border border-zinc-850">
                  {SYSTEM_PERMISSIONS.map((perm) => {
                    const isChecked = roleFormData.permissions.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer p-1 rounded hover:bg-zinc-900"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRoleFormData({ ...roleFormData, permissions: [...roleFormData.permissions, perm.id] });
                            } else {
                              setRoleFormData({ ...roleFormData, permissions: roleFormData.permissions.filter(p => p !== perm.id) });
                            }
                          }}
                          className="rounded text-indigo-600"
                        />
                        <span className="font-medium">{perm.name}</span>
                        <span className="text-[10px] font-mono text-zinc-400">({perm.module})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddRoleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-950"
                >
                  Lưu Vai Trò
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL: XÁC NHẬN GỠ BÀI VIẾT VI PHẠM & GỬI THÔNG BÁO
          ==================================================== */}
      {reportActionModal.isOpen && reportActionModal.report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setReportActionModal({ isOpen: false, report: null, action: 'TAKEDOWN', note: '' })}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-400" />
                <span>Gỡ Bỏ Bài Viết Vi Phạm</span>
              </h3>
              <button 
                onClick={() => setReportActionModal({ isOpen: false, report: null, action: 'TAKEDOWN', note: '' })} 
                className="text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
              <span className="text-zinc-400 font-mono text-[10px] block">Nội dung bài viết:</span>
              <p className="text-zinc-200 italic line-clamp-3 font-serif">"{reportActionModal.report.postContent}"</p>
              <div className="pt-1 text-[11px] text-zinc-400 font-mono">
                Tác giả: <strong className="text-zinc-200">{reportActionModal.report.postAuthorName}</strong>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-300 font-medium mb-1 block">
                Lý do & ghi chú gửi trực tiếp tới tác giả (Realtime):
              </label>
              <textarea
                rows={3}
                value={reportActionModal.note}
                onChange={(e) => setReportActionModal({ ...reportActionModal, note: e.target.value })}
                placeholder="Nhập chi tiết điều khoản vi phạm để gửi thông báo cho tác giả..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 font-sans resize-none"
              />
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                Thông báo này sẽ xuất hiện ngay trên chuông và thanh nổi của tác giả bài viết.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setReportActionModal({ isOpen: false, report: null, action: 'TAKEDOWN', note: '' })}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleResolveReport(reportActionModal.report.id, 'TAKEDOWN', reportActionModal.note)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950 flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Xác nhận gỡ bài & Gửi cảnh báo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL: THÊM / CHỈNH SỬA BĂNG TẦN (MATCH INTENT)
          ==================================================== */}
      {isIntentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsIntentModalOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio size={16} className="text-emerald-400" />
                <span>{editingIntent ? 'Chỉnh Sửa Băng Tần' : 'Thêm Băng Tần FM Mới'}</span>
              </h3>
              <button onClick={() => setIsIntentModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveIntent} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Mã định danh (Code - Unique) *</label>
                <input
                  type="text"
                  required
                  value={intentFormData.code}
                  onChange={(e) => setIntentFormData(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
                  placeholder="VD: CHILL_MUSIC, DEEP_TALK..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Tiêu đề hiển thị *</label>
                <input
                  type="text"
                  required
                  value={intentFormData.title}
                  onChange={(e) => setIntentFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="VD: Nghe nhạc & Chill, Cùng chạy deadline..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Mô tả phụ</label>
                <input
                  type="text"
                  value={intentFormData.subtitle}
                  onChange={(e) => setIntentFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="VD: Thưởng thức giai điệu Lo-Fi, xả stress..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Tần số bắt đầu (MHz) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="88.0"
                    max="108.0"
                    required
                    value={intentFormData.freqStart}
                    onChange={(e) => setIntentFormData(prev => ({ ...prev, freqStart: parseFloat(e.target.value) }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Tần số kết thúc (MHz) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="88.0"
                    max="108.0"
                    required
                    value={intentFormData.freqEnd}
                    onChange={(e) => setIntentFormData(prev => ({ ...prev, freqEnd: parseFloat(e.target.value) }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Tên Icon Lucide</label>
                  <select
                    value={intentFormData.iconName}
                    onChange={(e) => setIntentFormData(prev => ({ ...prev, iconName: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Headphones">Headphones</option>
                    <option value="Laptop">Laptop</option>
                    <option value="MessageCircle">MessageCircle</option>
                    <option value="Sparkles">Sparkles</option>
                    <option value="Radio">Radio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Thứ tự hiển thị</label>
                  <input
                    type="number"
                    value={intentFormData.displayOrder}
                    onChange={(e) => setIntentFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsIntentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950 flex items-center gap-1.5"
                >
                  <Save size={13} />
                  <span>Lưu băng tần</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL: THÊM / CHỈNH SỬA ĐÀI PHÁT NHẠC (AUDIO CHANNEL)
          ==================================================== */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsChannelModalOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Disc3 size={16} className="text-purple-400" />
                <span>{editingChannel ? 'Chỉnh Sửa Đài Phát Nhạc' : 'Thêm Luồng Radio Mới'}</span>
              </h3>
              <button onClick={() => setIsChannelModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveChannel} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Tên đài phát *</label>
                <input
                  type="text"
                  required
                  value={channelFormData.name}
                  onChange={(e) => setChannelFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="VD: Lofi Chill Beats, Ambient Cafe..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Thể loại / Tag *</label>
                <input
                  type="text"
                  required
                  value={channelFormData.genreTag}
                  onChange={(e) => setChannelFormData(prev => ({ ...prev, genreTag: e.target.value }))}
                  placeholder="VD: Lo-Fi, Ambient, Synthwave, Jazz..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Stream URL (Icecast / Zeno / MP3 Stream) *</label>
                <input
                  type="url"
                  required
                  value={channelFormData.streamUrl}
                  onChange={(e) => setChannelFormData(prev => ({ ...prev, streamUrl: e.target.value }))}
                  placeholder="https://stream.zeno.fm/..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsChannelModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-950 flex items-center gap-1.5"
                >
                  <Save size={13} />
                  <span>Lưu đài phát</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL: GỠ BÀI VIẾT (SOFT DELETE KÈM LÝ DO RÀNG BUỘC)
          ==================================================== */}
      {takedownModal.isOpen && takedownModal.post && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setTakedownModal({ isOpen: false, post: null, reason: '' })}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-400" />
                <span>Gỡ Bài Viết Khỏi Hệ Thống</span>
              </h3>
              <button 
                onClick={() => setTakedownModal({ isOpen: false, post: null, reason: '' })} 
                className="text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Thông tin bài viết */}
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span>Tác giả: <strong className="text-white">{takedownModal.post.authorNickname || takedownModal.post.authorAccount}</strong></span>
                <span>#{takedownModal.post.id}</span>
              </div>
              <p className="text-zinc-300 italic line-clamp-3 font-serif pt-1">
                "{takedownModal.post.content || '(Tệp đính kèm)'}"
              </p>
            </div>

            {/* Gợi ý lý do nhanh */}
            <div>
              <label className="text-xs text-zinc-300 font-medium mb-1.5 block">
                Chọn mẫu lý do gỡ bài nhanh:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Spam hoặc quảng cáo không phù hợp',
                  'Nội dung phản cảm, nhạy cảm hoặc bạo lực',
                  'Vi phạm bản quyền hoặc quyền sở hữu trí tuệ',
                  'Quấy rối, công kích cá nhân hoặc ngôn từ thù địch'
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTakedownModal(prev => ({ ...prev, reason: preset }))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all text-left ${
                      takedownModal.reason === preset 
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 font-semibold' 
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Chi tiết lý do gửi cho tác giả */}
            <div>
              <label className="text-xs text-zinc-300 font-medium mb-1 block">
                Lý do hiển thị và gửi thông báo tới tác giả (Bắt buộc) *:
              </label>
              <textarea
                rows={3}
                required
                value={takedownModal.reason}
                onChange={(e) => setTakedownModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Nhập lý do gỡ bài cụ thể để người dùng nắm rõ điều khoản vi phạm..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 font-sans resize-none"
              />
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                Lưu ý: Bài viết sẽ được chuyển vào Thùng rác (Xóa mềm). Bạn có thể khôi phục lại bất kỳ lúc nào nếu có khiếu nại hợp lệ.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setTakedownModal({ isOpen: false, post: null, reason: '' })}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleAdminSoftDelete(takedownModal.post.id, takedownModal.reason)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950 flex items-center gap-1.5"
              >
                <AlertTriangle size={13} />
                <span>Xác nhận gỡ bài</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
