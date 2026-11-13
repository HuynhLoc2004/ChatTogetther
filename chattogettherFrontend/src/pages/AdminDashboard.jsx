import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Users, MessageSquare, Radio, Music, Sparkles, Settings, 
  ArrowLeft, Plus, Trash2, Edit3, Check, X, Search, RefreshCw, 
  Lock, Unlock, Eye, EyeOff, Tag, Compass, Flame, Bookmark, Play, Pause,
  AlertTriangle, CheckCircle2, ChevronRight, Sliders, LayoutGrid
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'branding' | 'challenges' | 'vibes' | 'music' | 'users'
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Dữ liệu thống kê
  const [stats, setStats] = useState(null);

  // Dữ liệu cấu hình hệ thống
  const [configs, setConfigs] = useState({
    brand_name: 'Talovin',
    brand_slogan: 'Social Lounge',
    menu_items: '[]',
    vibe_options: '[]',
    feature_toggles: '{}'
  });
  const [parsedMenuItems, setParsedMenuItems] = useState([]);
  const [parsedVibes, setParsedVibes] = useState([]);
  const [newVibeInput, setNewVibeInput] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Dữ liệu Thẻ bài thử thách
  const [challenges, setChallenges] = useState([]);
  const [challengeFilter, setChallengeFilter] = useState('ALL');
  const [isAddChallengeOpen, setIsAddChallengeOpen] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
    question: '',
    category: 'DEEP_TALK',
    categoryName: 'Tâm sự sâu lắng',
    badgeColor: '#818cf8'
  });

  // Dữ liệu Âm nhạc
  const [tracks, setTracks] = useState([]);
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);
  const [newTrack, setNewTrack] = useState({
    name: '',
    artist: '',
    genre: 'Lo-Fi Chill',
    audioSrc: ''
  });
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const [audioPlayer, setAudioPlayer] = useState(null);

  // Dữ liệu Người dùng
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  // Kiểm tra quyền Admin khi vào trang
  useEffect(() => {
    checkAdminRole();
  }, []);

  const checkAdminRole = async () => {
    try {
      setLoading(true);
      // Gọi thử endpoint admin stats để kiểm tra token & quyền admin
      const res = await axiosClient.get('/admin/stats');
      if (res.data && res.data.data) {
        setIsAdmin(true);
        setStats(res.data.data);
        fetchAllData();
      }
    } catch (err) {
      setIsAdmin(false);
      toast.error("Bạn không có quyền truy cập trang Quản trị!");
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    fetchConfigs();
    fetchChallenges();
    fetchTracks();
    fetchUsers();
  };

  // Nạp cấu hình hệ thống
  const fetchConfigs = async () => {
    try {
      const res = await axiosClient.get('/admin/config');
      if (res.data && res.data.data) {
        const data = res.data.data;
        setConfigs(data);
        try {
          setParsedMenuItems(JSON.parse(data.menu_items || '[]'));
        } catch {
          setParsedMenuItems([]);
        }
        try {
          setParsedVibes(JSON.parse(data.vibe_options || '[]'));
        } catch {
          setParsedVibes([]);
        }
      }
    } catch (err) {
      console.error("Lỗi nạp cấu hình hệ thống:", err);
    }
  };

  // Lưu cấu hình hệ thống
  const handleSaveConfigs = async () => {
    try {
      setIsSavingConfig(true);
      const payload = {
        brand_name: configs.brand_name || 'Talovin',
        brand_slogan: configs.brand_slogan || 'Social Lounge',
        menu_items: JSON.stringify(parsedMenuItems),
        vibe_options: JSON.stringify(parsedVibes),
        feature_toggles: configs.feature_toggles || '{}'
      };

      await axiosClient.put('/admin/config', payload);
      toast.success("Đã cập nhật cấu hình hệ thống thành công!");
      fetchConfigs();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể lưu cấu hình");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Nạp câu hỏi thử thách
  const fetchChallenges = async () => {
    try {
      const res = await axiosClient.get('/admin/challenges');
      if (res.data && res.data.data) {
        setChallenges(res.data.data);
      }
    } catch (err) {
      console.error("Lỗi nạp câu hỏi thử thách:", err);
    }
  };

  // Thêm câu hỏi thử thách
  const handleAddChallenge = async (e) => {
    e.preventDefault();
    if (!newChallenge.question.trim()) {
      toast.error("Vui lòng nhập nội dung câu hỏi!");
      return;
    }
    try {
      await axiosClient.post('/admin/challenges', newChallenge);
      toast.success("Đã thêm câu hỏi thử thách mới!");
      setIsAddChallengeOpen(false);
      setNewChallenge({
        question: '',
        category: 'DEEP_TALK',
        categoryName: 'Tâm sự sâu lắng',
        badgeColor: '#818cf8'
      });
      fetchChallenges();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi thêm câu hỏi");
    }
  };

  // Xóa câu hỏi thử thách
  const handleDeleteChallenge = async (id) => {
    try {
      await axiosClient.delete(`/admin/challenges/${id}`);
      toast.success("Đã xóa câu hỏi");
      fetchChallenges();
    } catch (err) {
      toast.error("Không thể xóa câu hỏi");
    }
  };

  // Bật/tắt câu hỏi
  const handleToggleChallenge = async (item) => {
    try {
      await axiosClient.put(`/admin/challenges/${item.id}`, {
        active: !item.active
      });
      toast.success(`Đã ${item.active ? 'ẩn' : 'kích hoạt'} câu hỏi!`);
      fetchChallenges();
    } catch (err) {
      toast.error("Không thể cập nhật trạng thái câu hỏi");
    }
  };

  // Nạp âm nhạc
  const fetchTracks = async () => {
    try {
      const res = await axiosClient.get('/admin/tracks');
      if (res.data && res.data.data) {
        setTracks(res.data.data);
      }
    } catch (err) {
      console.error("Lỗi nạp danh sách nhạc:", err);
    }
  };

  // Thêm bản nhạc mới
  const handleAddTrack = async (e) => {
    e.preventDefault();
    if (!newTrack.name.trim() || !newTrack.audioSrc.trim()) {
      toast.error("Vui lòng nhập đầy đủ tên và đường dẫn nhạc!");
      return;
    }
    try {
      await axiosClient.post('/admin/tracks', newTrack);
      toast.success("Đã thêm bản nhạc mới vào hệ thống!");
      setIsAddTrackOpen(false);
      setNewTrack({
        name: '',
        artist: '',
        genre: 'Lo-Fi Chill',
        audioSrc: ''
      });
      fetchTracks();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi thêm nhạc");
    }
  };

  // Xóa bản nhạc
  const handleDeleteTrack = async (id) => {
    try {
      await axiosClient.delete(`/admin/tracks/${id}`);
      toast.success("Đã xóa bản nhạc");
      if (playingTrackId === id && audioPlayer) {
        audioPlayer.pause();
        setPlayingTrackId(null);
      }
      fetchTracks();
    } catch (err) {
      toast.error("Không thể xóa bản nhạc");
    }
  };

  // Thử phát nhạc
  const handleTogglePlayAudio = (track) => {
    if (playingTrackId === track.id) {
      if (audioPlayer) {
        audioPlayer.pause();
      }
      setPlayingTrackId(null);
    } else {
      if (audioPlayer) {
        audioPlayer.pause();
      }
      const audio = new Audio(track.audioSrc);
      audio.play().catch(() => toast.error("Không thể phát file âm thanh này"));
      audio.onended = () => setPlayingTrackId(null);
      setAudioPlayer(audio);
      setPlayingTrackId(track.id);
    }
  };

  // Nạp người dùng
  const fetchUsers = async () => {
    try {
      const res = await axiosClient.get('/admin/users');
      if (res.data && res.data.data) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error("Lỗi nạp người dùng:", err);
    }
  };

  // Khóa / Mở khóa tài khoản
  const handleToggleUserStatus = async (user) => {
    try {
      const newStatus = !user.active;
      await axiosClient.put(`/admin/users/${user.id}/status`, null, {
        params: { active: newStatus }
      });
      toast.success(`Đã ${newStatus ? 'mở khóa' : 'khóa'} tài khoản ${user.nickname || user.account}!`);
      fetchUsers();
    } catch (err) {
      toast.error("Không thể thay đổi trạng thái tài khoản");
    }
  };

  // Thăng cấp / Hạ cấp Admin
  const handleToggleUserAdminRole = async (user) => {
    try {
      const isUserAdmin = user.roles && (user.roles.includes('ROLE_ADMIN') || user.roles.includes('ROLE_AMDIN'));
      const newRoles = isUserAdmin ? ['ROLE_USER'] : ['ROLE_USER', 'ROLE_ADMIN'];
      
      await axiosClient.put(`/admin/users/${user.id}/roles`, newRoles);
      toast.success(`Đã cập nhật quyền của ${user.nickname || user.account} thành: ${isUserAdmin ? 'Thành viên' : 'Quản trị viên'}!`);
      fetchUsers();
    } catch (err) {
      toast.error("Không thể thay đổi quyền quản trị");
    }
  };

  // Thêm chip vibe mới
  const handleAddVibe = () => {
    if (!newVibeInput.trim()) return;
    if (parsedVibes.includes(newVibeInput.trim())) {
      toast.error("Chủ đề này đã tồn tại!");
      return;
    }
    setParsedVibes(prev => [...prev, newVibeInput.trim()]);
    setNewVibeInput('');
  };

  // Xóa chip vibe
  const handleRemoveVibe = (vibe) => {
    setParsedVibes(prev => prev.filter(v => v !== vibe));
  };

  // Toggle ẩn/hiện menu item
  const handleToggleMenuItem = (id) => {
    setParsedMenuItems(prev => prev.map(item => 
      item.id === id ? { ...item, visible: !item.visible } : item
    ));
  };

  // Đổi tên nhãn menu item
  const handleRenameMenuItem = (id, newLabel) => {
    setParsedMenuItems(prev => prev.map(item => 
      item.id === id ? { ...item, label: newLabel } : item
    ));
  };

  // Lọc câu hỏi thử thách
  const filteredChallenges = challenges.filter(c => {
    if (challengeFilter === 'ALL') return true;
    return c.category === challengeFilter;
  });

  // Lọc người dùng
  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return true;
    return (u.account || '').toLowerCase().includes(q) || 
           (u.nickname || '').toLowerCase().includes(q) || 
           (u.email || '').toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 font-mono text-xs gap-3">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-emerald-400 rounded-full animate-spin"></div>
        <span>Đang xác thực quyền Quản trị viên...</span>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/')}
            className="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-2 border border-zinc-700/60 transition-all active:scale-95"
            title="Quay lại sảnh"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Quay lại Sảnh</span>
          </button>
          
          <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block"></div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Shield size={17} />
            </div>
            <div>
              <h1 className="text-zinc-100 font-bold text-sm tracking-tight flex items-center gap-1.5">
                <span>Trung Tâm Quản Trị Hệ Thống</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px] font-mono font-bold uppercase">
                  Admin
                </span>
              </h1>
              <p className="text-zinc-500 font-mono text-[10px]">Talovin Control Hub & Dynamic Scaling</p>
            </div>
          </div>
        </div>

        <button 
          type="button"
          onClick={fetchAllData}
          className="p-2 rounded-xl bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all border border-zinc-800"
          title="Làm mới dữ liệu"
        >
          <RefreshCw size={15} />
        </button>
      </header>

      {/* MAIN CONTAINER */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 flex flex-col md:flex-row gap-6">
        
        {/* SIDEBAR TABS DOCK */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 space-y-1 sticky top-20 shadow-md">
            
            <button 
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${activeTab === 'overview' ? 'bg-zinc-800 text-white shadow-sm font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'}`}
            >
              <LayoutGrid size={15} className="text-emerald-400" />
              <span>Tổng quan & Số liệu</span>
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('branding')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${activeTab === 'branding' ? 'bg-zinc-800 text-white shadow-sm font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'}`}
            >
              <Sliders size={15} className="text-indigo-400" />
              <span>Menu, Logo & Thương hiệu</span>
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('challenges')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${activeTab === 'challenges' ? 'bg-zinc-800 text-white shadow-sm font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'}`}
            >
              <Sparkles size={15} className="text-amber-400" />
              <span>Thẻ bài thử thách ({challenges.length})</span>
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('vibes')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${activeTab === 'vibes' ? 'bg-zinc-800 text-white shadow-sm font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'}`}
            >
              <Tag size={15} className="text-pink-400" />
              <span>Chủ đề & Thẻ cảm xúc</span>
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('music')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${activeTab === 'music' ? 'bg-zinc-800 text-white shadow-sm font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'}`}
            >
              <Music size={15} className="text-sky-400" />
              <span>Âm nhạc hệ thống ({tracks.length})</span>
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('users')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${activeTab === 'users' ? 'bg-zinc-800 text-white shadow-sm font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'}`}
            >
              <Users size={15} className="text-purple-400" />
              <span>Thành viên & Phân quyền ({users.length})</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE CONTENT AREA */}
        <div className="flex-1 min-w-0">
          
          {/* ========================================================= */}
          {/* TAB 1: TỔNG QUAN & SỐ LIỆU */}
          {/* ========================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-zinc-100 font-bold text-lg mb-1">Tổng Quan Hệ Thống</h2>
                <p className="text-zinc-400 text-xs">Các chỉ số hoạt động thời gian thực của ứng dụng Talovin</p>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-500 mb-2">
                    <span className="text-xs font-semibold">Người dùng</span>
                    <Users size={16} className="text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-zinc-100">{stats?.totalUsers || users.length}</div>
                  <span className="text-[10px] text-zinc-500 font-mono mt-1 block">Tài khoản đã đăng ký</span>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-500 mb-2">
                    <span className="text-xs font-semibold">Bài viết sảnh</span>
                    <MessageSquare size={16} className="text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-zinc-100">{stats?.totalPosts || 0}</div>
                  <span className="text-[10px] text-zinc-500 font-mono mt-1 block">Tín hiệu / khoảnh khắc</span>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-500 mb-2">
                    <span className="text-xs font-semibold">Phòng thoại</span>
                    <Radio size={16} className="text-sky-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-zinc-100">{stats?.totalRooms || 0}</div>
                  <span className="text-[10px] text-zinc-500 font-mono mt-1 block">Không gian đàm thoại</span>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-500 mb-2">
                    <span className="text-xs font-semibold">Thử thách</span>
                    <Sparkles size={16} className="text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-zinc-100">{challenges.length}</div>
                  <span className="text-[10px] text-zinc-500 font-mono mt-1 block">Câu hỏi tương tác thực</span>
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-zinc-100 font-bold text-sm">Hệ Thống Đang Vận Hành Ổn Định</h3>
                    <p className="text-zinc-400 text-xs mt-0.5">
                      Toàn bộ các tham số menu, logo, câu hỏi thử thách và danh sách nhạc hiện được quản trị động qua cơ sở dữ liệu.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: MENU, LOGO & THƯƠNG HIỆU (BRAND & NAVIGATION)      */}
          {/* ========================================================= */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-zinc-100 font-bold text-lg mb-1">Menu & Cấu Hình Thương Hiệu</h2>
                  <p className="text-zinc-400 text-xs">Quản lý tên ứng dụng, logo và cấu hình động các mục trên thanh điều hướng</p>
                </div>
                <button 
                  type="button"
                  onClick={handleSaveConfigs}
                  disabled={isSavingConfig}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSavingConfig ? "Đang lưu..." : "Lưu tất cả thay đổi"}
                </button>
              </div>

              {/* Brand Name & Slogan */}
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
                <h3 className="text-zinc-200 font-bold text-xs uppercase tracking-wider font-mono">Nhận diện thương hiệu (Logo)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-300 text-xs font-medium mb-1">Tên ứng dụng / Logo text *</label>
                    <input 
                      type="text" 
                      value={configs.brand_name || ''}
                      onChange={(e) => setConfigs(prev => ({ ...prev, brand_name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 text-xs font-medium mb-1">Slogan / Phụ đề</label>
                    <input 
                      type="text" 
                      value={configs.brand_slogan || ''}
                      onChange={(e) => setConfigs(prev => ({ ...prev, brand_slogan: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Menu Items Manager */}
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-zinc-200 font-bold text-xs uppercase tracking-wider font-mono">
                    Danh Sách Các Mục Menu Sidebar ({parsedMenuItems.length})
                  </h3>
                  <span className="text-[11px] text-zinc-500 font-mono">Admin có thể đổi nhãn hoặc ẩn/hiện mục menu</span>
                </div>

                <div className="space-y-2">
                  {parsedMenuItems.map((item, index) => (
                    <div key={item.id} className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-zinc-600 font-mono text-xs w-5 text-center">#{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <input 
                            type="text" 
                            value={item.label}
                            onChange={(e) => handleRenameMenuItem(item.id, e.target.value)}
                            className="bg-transparent border-b border-zinc-800 focus:border-zinc-500 text-zinc-100 text-xs font-semibold py-1 px-1 focus:outline-none w-full max-w-xs"
                          />
                          <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">Mã: {item.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={() => handleToggleMenuItem(item.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${item.visible !== false ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}
                        >
                          {item.visible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                          <span>{item.visible !== false ? "Đang hiện" : "Đã ẩn"}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: THẺ BÀI THỬ THÁCH (CHALLENGE DECKS)                */}
          {/* ========================================================= */}
          {activeTab === 'challenges' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-zinc-100 font-bold text-lg mb-1">Quản Lý Thẻ Bài Thử Thách</h2>
                  <p className="text-zinc-400 text-xs">Thêm, sửa, xóa hoặc ẩn các câu hỏi tương tác thực tế</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsAddChallengeOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Plus size={15} />
                  <span>Thêm câu hỏi mới</span>
                </button>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'TRUTH', label: 'Thú nhận' },
                  { id: 'DARE', label: 'Thử thách vui' },
                  { id: 'DEEP_TALK', label: 'Tâm sự sâu lắng' },
                  { id: 'MUSIC', label: 'Gu âm nhạc' },
                  { id: 'PHILOSOPHY', label: 'Góc nhìn cuộc sống' }
                ].map(cat => (
                  <button 
                    key={cat.id}
                    type="button"
                    onClick={() => setChallengeFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${challengeFilter === cat.id ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm' : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-zinc-200'}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* List of Questions */}
              <div className="space-y-2.5">
                {filteredChallenges.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 text-xs">Không có câu hỏi nào trong danh mục này.</div>
                ) : (
                  filteredChallenges.map(item => (
                    <div key={item.id} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span 
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                            style={{ 
                              background: `${item.badgeColor || '#818cf8'}20`,
                              color: item.badgeColor || '#818cf8',
                              border: `1px solid ${item.badgeColor || '#818cf8'}40`
                            }}
                          >
                            {item.categoryName || item.category}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            Đã bốc {item.usageCount || 0} lần
                          </span>
                          {!item.active && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-mono">
                              Đã tắt
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-200 text-xs sm:text-sm font-medium leading-relaxed">
                          "{item.question}"
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
                        <button 
                          type="button"
                          onClick={() => handleToggleChallenge(item)}
                          className={`p-1.5 rounded-lg text-xs transition-all ${item.active ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-amber-500/10 text-amber-400'}`}
                          title={item.active ? "Ẩn câu hỏi" : "Bật câu hỏi"}
                        >
                          {item.active ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteChallenge(item.id)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 transition-all"
                          title="Xóa câu hỏi"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: CHỦ ĐỀ & THẺ CẢM XÚC (VIBE OPTIONS)                 */}
          {/* ========================================================= */}
          {activeTab === 'vibes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-zinc-100 font-bold text-lg mb-1">Quản Lý Thẻ Chủ Đề & Cảm Xúc</h2>
                  <p className="text-zinc-400 text-xs">Các thẻ hiển thị trên thanh đăng bài để người dùng phân loại tâm trạng</p>
                </div>
                <button 
                  type="button"
                  onClick={handleSaveConfigs}
                  disabled={isSavingConfig}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSavingConfig ? "Đang lưu..." : "Lưu chủ đề"}
                </button>
              </div>

              {/* Thêm Vibe mới */}
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
                <h3 className="text-zinc-200 font-bold text-xs uppercase tracking-wider font-mono">Thêm thẻ mới</h3>
                <div className="flex items-center gap-2 max-w-md">
                  <input 
                    type="text" 
                    placeholder="VD: Học tập, Thư giãn, Trà sữa..."
                    value={newVibeInput}
                    onChange={(e) => setNewVibeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddVibe()}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                  />
                  <button 
                    type="button"
                    onClick={handleAddVibe}
                    className="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow-md transition-all active:scale-95 flex-shrink-0"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              {/* Danh sách Vibe hiện tại */}
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                <h3 className="text-zinc-200 font-bold text-xs uppercase tracking-wider font-mono">
                  Các thẻ đang hoạt động ({parsedVibes.length})
                </h3>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {parsedVibes.map((vibe, idx) => (
                    <div key={idx} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700/80 text-zinc-200 text-xs font-medium">
                      <span>{vibe}</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveVibe(vibe)}
                        className="text-zinc-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: ÂM NHẠC HỆ THỐNG (MUSIC TRACKS)                    */}
          {/* ========================================================= */}
          {activeTab === 'music' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-zinc-100 font-bold text-lg mb-1">Âm Nhạc Hệ Thống</h2>
                  <p className="text-zinc-400 text-xs">Quản trị các bản nhạc nền Lo-Fi và âm thanh thư giãn trên toàn hệ thống</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsAddTrackOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Plus size={15} />
                  <span>Thêm bản nhạc mới</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {tracks.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 text-xs">Chưa có bản nhạc nào trong hệ thống.</div>
                ) : (
                  tracks.map(track => (
                    <div key={track.id} className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button 
                          type="button"
                          onClick={() => handleTogglePlayAudio(track)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${playingTrackId === track.id ? 'bg-emerald-600 text-white animate-pulse' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
                          title={playingTrackId === track.id ? "Tạm dừng" : "Nghe thử"}
                        >
                          {playingTrackId === track.id ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <div className="min-w-0">
                          <h4 className="text-zinc-100 font-semibold text-xs truncate">{track.name}</h4>
                          <span className="text-[10px] text-zinc-500 font-mono block truncate">
                            {track.artist || 'Nghệ sĩ chưa rõ'} • {track.genre || 'Lo-Fi Chill'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button 
                          type="button"
                          onClick={() => handleDeleteTrack(track.id)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 transition-all"
                          title="Xóa bài nhạc"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: THÀNH VIÊN & PHÂN QUYỀN (USERS & ROLES)            */}
          {/* ========================================================= */}
          {activeTab === 'users' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-zinc-100 font-bold text-lg mb-1">Quản Lý Thành Viên & Phân Quyền</h2>
                  <p className="text-zinc-400 text-xs">Xem danh sách tài khoản, khóa tài khoản vi phạm hoặc chỉ định Quản trị viên</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Tìm theo tên, account..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-zinc-600"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {filteredUsers.map(u => {
                  const isUserAdmin = u.roles && (u.roles.includes('ROLE_ADMIN') || u.roles.includes('ROLE_AMDIN'));

                  return (
                    <div key={u.id} className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-200 overflow-hidden border border-zinc-700 flex-shrink-0">
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.nickname} className="w-full h-full object-cover" />
                          ) : (
                            (u.nickname || u.account || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-zinc-100 font-bold text-xs truncate">{u.nickname || u.account}</span>
                            {isUserAdmin ? (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px] font-bold">
                                Quản trị viên
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 text-[9px]">
                                Thành viên
                              </span>
                            )}
                            {u.active === false && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold">
                                Đã khóa
                              </span>
                            )}
                          </div>
                          <span className="text-zinc-500 font-mono text-[10px] truncate block">@{u.account} • ID: {u.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button 
                          type="button"
                          onClick={() => handleToggleUserAdminRole(u)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${isUserAdmin ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'}`}
                          title="Thay đổi vai trò Admin"
                        >
                          {isUserAdmin ? "Hạ xuống User" : "Cấp quyền Admin"}
                        </button>

                        <button 
                          type="button"
                          onClick={() => handleToggleUserStatus(u)}
                          className={`p-1.5 rounded-lg border transition-all ${u.active !== false ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}
                          title={u.active !== false ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                        >
                          {u.active !== false ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL THÊM CÂU HỎI THỬ THÁCH MỚI */}
      {/* ========================================================= */}
      {isAddChallengeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setIsAddChallengeOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h3 className="text-zinc-100 font-bold text-sm">Thêm Câu Hỏi Thử Thách Mới</h3>
              <button onClick={() => setIsAddChallengeOpen(false)} className="text-zinc-400 hover:text-white p-1"><X size={16} /></button>
            </div>

            <form onSubmit={handleAddChallenge} className="space-y-4">
              <div>
                <label className="block text-zinc-300 text-xs font-medium mb-1">Nội dung câu hỏi / thử thách *</label>
                <textarea 
                  rows="3"
                  value={newChallenge.question}
                  onChange={(e) => setNewChallenge(prev => ({ ...prev, question: e.target.value }))}
                  required
                  placeholder="Nhập câu hỏi gợi mở, sâu sắc hoặc thử thách thú vị..."
                  className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 text-xs font-medium mb-1">Thể loại</label>
                <select 
                  value={newChallenge.category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    const metaMap = {
                      'TRUTH': { name: 'Thú nhận', color: '#ec4899' },
                      'DARE': { name: 'Thử thách vui', color: '#f59e0b' },
                      'DEEP_TALK': { name: 'Tâm sự sâu lắng', color: '#818cf8' },
                      'MUSIC': { name: 'Gu âm nhạc', color: '#38bdf8' },
                      'PHILOSOPHY': { name: 'Góc nhìn cuộc sống', color: '#10b981' }
                    };
                    const meta = metaMap[cat] || { name: 'Tâm sự sâu lắng', color: '#818cf8' };
                    setNewChallenge(prev => ({
                      ...prev,
                      category: cat,
                      categoryName: meta.name,
                      badgeColor: meta.color
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none"
                >
                  <option value="DEEP_TALK">Tâm sự sâu lắng</option>
                  <option value="TRUTH">Thú nhận (Truth)</option>
                  <option value="DARE">Thử thách vui (Dare)</option>
                  <option value="MUSIC">Gu âm nhạc</option>
                  <option value="PHILOSOPHY">Góc nhìn cuộc sống</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsAddChallengeOpen(false)} className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium">Hủy</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md">Thêm câu hỏi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL THÊM BẢN NHẠC MỚI */}
      {/* ========================================================= */}
      {isAddTrackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setIsAddTrackOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h3 className="text-zinc-100 font-bold text-sm">Thêm Bản Nhạc Hệ Thống</h3>
              <button onClick={() => setIsAddTrackOpen(false)} className="text-zinc-400 hover:text-white p-1"><X size={16} /></button>
            </div>

            <form onSubmit={handleAddTrack} className="space-y-3.5">
              <div>
                <label className="block text-zinc-300 text-xs font-medium mb-1">Tên bản nhạc *</label>
                <input 
                  type="text" 
                  value={newTrack.name}
                  onChange={(e) => setNewTrack(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="VD: Midnight Lo-Fi Beats..."
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 text-xs font-medium mb-1">Nghệ sĩ / Tác giả</label>
                <input 
                  type="text" 
                  value={newTrack.artist}
                  onChange={(e) => setNewTrack(prev => ({ ...prev, artist: e.target.value }))}
                  placeholder="VD: Chillhop Music..."
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 text-xs font-medium mb-1">Thể loại</label>
                <input 
                  type="text" 
                  value={newTrack.genre}
                  onChange={(e) => setNewTrack(prev => ({ ...prev, genre: e.target.value }))}
                  placeholder="VD: Lo-Fi Chill, Acoustic, Jazzhop..."
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 text-xs font-medium mb-1">Đường dẫn file âm thanh (MP3 URL) *</label>
                <input 
                  type="url" 
                  value={newTrack.audioSrc}
                  onChange={(e) => setNewTrack(prev => ({ ...prev, audioSrc: e.target.value }))}
                  required
                  placeholder="https://.../music.mp3"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsAddTrackOpen(false)} className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium">Hủy</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md">Thêm nhạc</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
