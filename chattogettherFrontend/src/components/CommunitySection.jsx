import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Shield, Crown, CheckCircle2, XCircle, 
  Settings, LogOut, Trash2, Camera, Lock, Globe, FileText, ChevronRight, X
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import GroupCollageAvatar from './GroupCollageAvatar';
import toast from 'react-hot-toast';

export const CommunitySection = ({ currentUserId, currentUserName, onNavigateFeed }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('rules'); // rules, members, pending, settings
  const [pendingMembers, setPendingMembers] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Modal Create Group
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

  // Edit Group Form (Chủ nhóm / Phó nhóm)
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [editRulesText, setEditRulesText] = useState('');

  // Fetch groups
  const fetchGroups = async (kw = '') => {
    try {
      setLoading(true);
      const res = await axiosClient.get('/groups', {
        params: kw.trim() ? { keyword: kw.trim() } : {}
      });
      if (res.data && res.data.data) {
        setGroups(res.data.data);
      }
    } catch (err) {
      console.error("Lỗi nạp danh sách cộng đồng:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups(searchKeyword);
  }, [searchKeyword]);

  // Open detail
  const handleOpenGroup = async (group) => {
    setSelectedGroup(group);
    setActiveDetailTab('rules');
    try {
      setLoadingDetail(true);
      const res = await axiosClient.get(`/groups/${group.id}`);
      if (res.data && res.data.data) {
        setGroupDetail(res.data.data);
        setEditRulesText(res.data.data.rules || '');
        if (['OWNER', 'DEPUTY'].includes(res.data.data.currentUserRole)) {
          fetchPendingMembers(group.id);
        }
      }
    } catch (err) {
      toast.error("Không thể lấy thông tin chi tiết cộng đồng");
    } finally {
      setLoadingDetail(false);
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

  // Join group
  const handleJoinGroup = async (groupId, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await axiosClient.post(`/groups/${groupId}/join`);
      const status = res.data?.data;
      if (status === 'PENDING') {
        toast.success("Đã gửi yêu cầu tham gia! Chờ Chủ/Phó nhóm duyệt.");
      } else {
        toast.success("Gia nhập cộng đồng thành công!");
      }
      fetchGroups(searchKeyword);
      if (selectedGroup && selectedGroup.id === groupId) {
        handleOpenGroup(selectedGroup);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tham gia nhóm");
    }
  };

  // Leave group
  const handleLeaveGroup = async (groupId) => {
    try {
      await axiosClient.post(`/groups/${groupId}/leave`);
      toast.success("Đã rời khỏi cộng đồng");
      setSelectedGroup(null);
      fetchGroups(searchKeyword);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể rời nhóm");
    }
  };

  // Approve member
  const handleApproveMember = async (userId) => {
    if (!selectedGroup) return;
    try {
      await axiosClient.post(`/groups/${selectedGroup.id}/approve/${userId}`);
      toast.success("Đã phê duyệt thành viên!");
      setPendingMembers(prev => prev.filter(m => m.userId !== userId));
      fetchGroups(searchKeyword);
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi phê duyệt");
    }
  };

  // Reject member
  const handleRejectMember = async (userId) => {
    if (!selectedGroup) return;
    try {
      await axiosClient.post(`/groups/${selectedGroup.id}/reject/${userId}`);
      toast.success("Đã từ chối yêu cầu tham gia");
      setPendingMembers(prev => prev.filter(m => m.userId !== userId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi từ chối");
    }
  };

  // Set member role (promote/demote Deputy)
  const handleSetRole = async (targetUserId, newRole) => {
    if (!selectedGroup) return;
    try {
      await axiosClient.post(`/groups/${selectedGroup.id}/set-role`, {
        userId: targetUserId,
        role: newRole
      });
      toast.success(`Đã cập nhật quyền thành: ${newRole === 'DEPUTY' ? 'Phó nhóm' : 'Thành viên'}`);
      handleOpenGroup(selectedGroup);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật quyền");
    }
  };

  // Save rules
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

  // Create Group
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.error("Vui lòng nhập tên cộng đồng");
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await axiosClient.post('/groups', createForm);
      toast.success("Tạo cộng đồng thành công!");
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

  // Disband group
  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    if (!window.confirm) {}
    try {
      await axiosClient.delete(`/groups/${selectedGroup.id}`);
      toast.success("Đã giải tán cộng đồng");
      setSelectedGroup(null);
      fetchGroups(searchKeyword);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể giải tán cộng đồng");
    }
  };

  return (
    <div className="community-module-container py-2">
      {/* Header Banner */}
      <div className="community-header-dock flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="text-zinc-100 font-bold text-lg tracking-tight">Cộng Đồng & Nhóm Thảo Luận</h2>
          </div>
          <p className="text-zinc-400 text-xs font-sans">
            Không gian chia sẻ kiến thức, gắn kết đồng sở thích với quyền quản trị minh bạch
          </p>
        </div>

        <button 
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs shadow-md transition-all active:scale-95"
        >
          <Plus size={14} strokeWidth={2} />
          <span>Tạo cộng đồng mới</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="relative mb-6">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input 
          type="text" 
          placeholder="Tìm kiếm cộng đồng theo tên, chủ đề hoặc mô tả..."
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 text-zinc-200 text-xs placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
        />
      </div>

      {/* Grid of Groups */}
      {loading ? (
        <div className="py-16 text-center text-zinc-500 text-xs font-mono">
          Đang tải danh sách cộng đồng...
        </div>
      ) : groups.length === 0 ? (
        <div className="py-16 px-4 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60">
          <Users size={32} className="mx-auto mb-3 text-zinc-600 opacity-60" />
          <p className="text-zinc-400 text-sm font-medium mb-1">Chưa có cộng đồng nào phù hợp</p>
          <p className="text-zinc-500 text-xs mb-4">Hãy là người đầu tiên sáng lập một cộng đồng mới!</p>
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-all"
          >
            <Plus size={13} /> Tạo cộng đồng ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(group => {
            const isOwner = group.currentUserRole === 'OWNER';
            const isDeputy = group.currentUserRole === 'DEPUTY';
            const isMember = group.currentUserRole === 'MEMBER';
            const isPending = group.currentUserRole === 'PENDING';

            return (
              <div 
                key={group.id}
                onClick={() => handleOpenGroup(group)}
                className="group-card relative rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 overflow-hidden cursor-pointer transition-all hover:shadow-lg flex flex-col justify-between"
              >
                {/* Cover Banner */}
                <div className="h-28 relative bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-950 overflow-hidden">
                  {group.coverUrl ? (
                    <img src={group.coverUrl} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full opacity-30 bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:12px_12px]"></div>
                  )}
                  {/* Badges on Top Right */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {group.requiresApproval ? (
                      <span className="px-2 py-0.5 rounded-full bg-zinc-950/80 backdrop-blur-md border border-amber-500/30 text-[10px] font-mono text-amber-400 flex items-center gap-1">
                        <Lock size={9} /> Cần duyệt
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-zinc-950/80 backdrop-blur-md border border-emerald-500/30 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <Globe size={9} /> Công khai
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Body */}
                <div className="p-4 pt-0 relative flex-1 flex flex-col justify-between">
                  {/* Overlapping Avatar */}
                  <div className="flex items-end justify-between -mt-7 mb-3">
                    <GroupCollageAvatar 
                      avatar={group.avatarUrl} 
                      name={group.name}
                      size={52}
                      className="border-2 border-zinc-900 ring-2 ring-zinc-800"
                    />

                    {/* Role Pill */}
                    {isOwner && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                        <Crown size={10} /> Chủ nhóm
                      </span>
                    )}
                    {isDeputy && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-semibold flex items-center gap-1">
                        <Shield size={10} /> Phó nhóm
                      </span>
                    )}
                    {isMember && (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-medium">
                        Thành viên
                      </span>
                    )}
                    {isPending && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-950/40 border border-amber-500/30 text-amber-400 text-[10px] font-medium">
                        Đang chờ duyệt
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-zinc-100 font-semibold text-sm mb-1 line-clamp-1">{group.name}</h3>
                    <p className="text-zinc-400 text-xs font-sans line-clamp-2 mb-3">
                      {group.description || 'Chưa có mô tả cho cộng đồng này.'}
                    </p>
                  </div>

                  {/* Footer Meta & CTA */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 text-xs">
                    <span className="text-zinc-500 font-mono text-[11px] flex items-center gap-1">
                      <Users size={12} /> {group.membersCount || 1} thành viên
                    </span>

                    {isOwner || isDeputy ? (
                      <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                        Quản trị nhóm <ChevronRight size={13} />
                      </span>
                    ) : isMember ? (
                      <span className="text-xs text-zinc-400 flex items-center gap-1">
                        Xem chi tiết <ChevronRight size={13} />
                      </span>
                    ) : isPending ? (
                      <span className="text-xs text-amber-400">
                        Chờ duyệt...
                      </span>
                    ) : (
                      <button 
                        onClick={(e) => handleJoinGroup(group.id, e)}
                        className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/80 transition-all"
                      >
                        Gia nhập
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL / DRAWER CHI TIẾT CỘNG ĐỒNG & QUẢN TRỊ */}
      {/* ========================================================= */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setSelectedGroup(null)}>
          <div 
            className="relative w-full max-w-2xl max-h-[90vh] rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Banner */}
            <div className="h-36 relative bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-950 overflow-hidden flex-shrink-0">
              {selectedGroup.coverUrl ? (
                <img src={selectedGroup.coverUrl} alt={selectedGroup.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full opacity-30 bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:12px_12px]"></div>
              )}
              
              <button 
                onClick={() => setSelectedGroup(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-zinc-950/80 backdrop-blur-md border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Sub-header with Avatar, Name and Action */}
            <div className="px-6 py-4 border-b border-zinc-800 flex-shrink-0">
              <div className="flex items-end justify-between -mt-12 mb-3">
                <GroupCollageAvatar 
                  avatar={selectedGroup.avatarUrl} 
                  name={selectedGroup.name}
                  size={68}
                  className="border-4 border-zinc-900 shadow-md"
                />

                <div className="flex items-center gap-2">
                  {selectedGroup.currentUserRole === 'OWNER' && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                      <Crown size={12} /> Bạn là Chủ nhóm
                    </span>
                  )}
                  {selectedGroup.currentUserRole === 'DEPUTY' && (
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold flex items-center gap-1.5">
                      <Shield size={12} /> Bạn là Phó nhóm
                    </span>
                  )}
                  {selectedGroup.currentUserRole === 'MEMBER' && (
                    <button 
                      onClick={() => handleLeaveGroup(selectedGroup.id)}
                      className="px-3 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-medium transition-all"
                    >
                      Rời nhóm
                    </button>
                  )}
                  {!selectedGroup.currentUserRole && (
                    <button 
                      onClick={() => handleJoinGroup(selectedGroup.id)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all shadow-md"
                    >
                      Gia nhập cộng đồng
                    </button>
                  )}
                </div>
              </div>

              <h2 className="text-zinc-100 font-bold text-lg mb-1">{selectedGroup.name}</h2>
              <p className="text-zinc-400 text-xs font-sans mb-3">{selectedGroup.description || 'Chưa có mô tả'}</p>

              {/* Tabs Navigation */}
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60">
                <button 
                  onClick={() => setActiveDetailTab('rules')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeDetailTab === 'rules' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  <span className="flex items-center gap-1.5"><FileText size={13} /> Quy định & Nội quy</span>
                </button>
                <button 
                  onClick={() => setActiveDetailTab('members')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeDetailTab === 'members' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  <span className="flex items-center gap-1.5"><Users size={13} /> Thành viên ({groupDetail?.members?.length || 1})</span>
                </button>
                {['OWNER', 'DEPUTY'].includes(groupDetail?.currentUserRole || selectedGroup.currentUserRole) && (
                  <button 
                    onClick={() => {
                      setActiveDetailTab('pending');
                      fetchPendingMembers(selectedGroup.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${activeDetailTab === 'pending' ? 'bg-zinc-800 text-amber-300' : 'text-zinc-400 hover:text-amber-300'}`}
                  >
                    <span>Duyệt thành viên</span>
                    {pendingMembers.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono border border-amber-500/30">
                        {pendingMembers.length}
                      </span>
                    )}
                  </button>
                )}
                {selectedGroup.currentUserRole === 'OWNER' && (
                  <button 
                    onClick={() => setActiveDetailTab('settings')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeDetailTab === 'settings' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <span className="flex items-center gap-1.5"><Settings size={13} /> Thiết lập</span>
                  </button>
                )}
              </div>
            </div>

            {/* Modal Body Tab Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* TAB 1: RULES & NỘI QUY */}
              {activeDetailTab === 'rules' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-zinc-200 font-semibold text-xs tracking-wide uppercase font-mono">Quy định của cộng đồng</h4>
                    {['OWNER', 'DEPUTY'].includes(groupDetail?.currentUserRole || selectedGroup.currentUserRole) && !isEditingRules && (
                      <button 
                        onClick={() => setIsEditingRules(true)}
                        className="text-xs text-emerald-400 hover:underline"
                      >
                        Chỉnh sửa quy định
                      </button>
                    )}
                  </div>

                  {isEditingRules ? (
                    <div className="space-y-3">
                      <textarea 
                        rows="6"
                        value={editRulesText}
                        onChange={(e) => setEditRulesText(e.target.value)}
                        className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs focus:outline-none font-mono"
                        placeholder="Nhập các quy định của nhóm..."
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setIsEditingRules(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
                        >
                          Hủy
                        </button>
                        <button 
                          onClick={handleSaveRules}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium"
                        >
                          Lưu quy định
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 text-zinc-300 text-xs font-sans leading-relaxed whitespace-pre-wrap">
                      {groupDetail?.rules || selectedGroup.rules || "Chưa có quy định cụ thể. Vui lòng tôn trọng các thành viên trong nhóm."}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MEMBERS */}
              {activeDetailTab === 'members' && (
                <div className="space-y-2">
                  <h4 className="text-zinc-200 font-semibold text-xs tracking-wide uppercase font-mono mb-3">Danh sách thành viên</h4>
                  {(groupDetail?.members || []).map(member => {
                    const isOwner = member.role === 'OWNER';
                    const isDeputy = member.role === 'DEPUTY';
                    const canManage = selectedGroup.currentUserRole === 'OWNER' && !isOwner;

                    return (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/60">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-200 overflow-hidden">
                            {member.avatar ? (
                              <img src={member.avatar} alt={member.nickname} className="w-full h-full object-cover" />
                            ) : (
                              (member.nickname || 'U').charAt(0)
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-100 text-xs font-semibold">{member.nickname}</span>
                              <span className="text-zinc-500 font-mono text-[10px]">@{member.account}</span>
                            </div>
                            <span className="text-zinc-500 text-[10px]">Tham gia lúc: {new Date(member.joinedAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isOwner && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-semibold flex items-center gap-1">
                              <Crown size={10} /> Chủ nhóm
                            </span>
                          )}
                          {isDeputy && (
                            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-semibold flex items-center gap-1">
                              <Shield size={10} /> Phó nhóm
                            </span>
                          )}
                          
                          {canManage && (
                            <button
                              onClick={() => handleSetRole(member.userId, isDeputy ? 'MEMBER' : 'DEPUTY')}
                              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium transition-colors"
                            >
                              {isDeputy ? 'Hạ xuống thành viên' : 'Bổ nhiệm Phó nhóm'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 3: PENDING MEMBERS APPROVAL */}
              {activeDetailTab === 'pending' && (
                <div>
                  <h4 className="text-zinc-200 font-semibold text-xs tracking-wide uppercase font-mono mb-3">Yêu cầu gia nhập ({pendingMembers.length})</h4>
                  {loadingPending ? (
                    <div className="text-center py-6 text-zinc-500 text-xs">Đang kiểm tra yêu cầu...</div>
                  ) : pendingMembers.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs">Không có yêu cầu tham gia nào đang chờ duyệt.</div>
                  ) : (
                    <div className="space-y-2">
                      {pendingMembers.map(req => (
                        <div key={req.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-200 overflow-hidden">
                              {req.avatar ? (
                                <img src={req.avatar} alt={req.nickname} className="w-full h-full object-cover" />
                              ) : (
                                (req.nickname || 'U').charAt(0)
                              )}
                            </div>
                            <div>
                              <div className="text-zinc-200 text-xs font-semibold">{req.nickname}</div>
                              <div className="text-zinc-500 font-mono text-[10px]">@{req.account}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleApproveMember(req.userId)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all"
                            >
                              <CheckCircle2 size={13} /> Phê duyệt
                            </button>
                            <button 
                              onClick={() => handleRejectMember(req.userId)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-400 border border-zinc-700 transition-all text-xs"
                            >
                              <XCircle size={13} /> Từ chối
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: SETTINGS (CHỦ NHÓM ONLY) */}
              {activeDetailTab === 'settings' && selectedGroup.currentUserRole === 'OWNER' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-zinc-200 font-semibold text-xs tracking-wide uppercase font-mono mb-2">Chế độ phê duyệt thành viên</h4>
                    <p className="text-zinc-400 text-xs mb-3">
                      Khi bật, người dùng xin gia nhập phải được bạn hoặc Phó nhóm phê duyệt trước khi có thể xem hoặc đăng bài.
                    </p>
                    <button 
                      onClick={async () => {
                        try {
                          await axiosClient.put(`/groups/${selectedGroup.id}`, {
                            requiresApproval: !selectedGroup.requiresApproval
                          });
                          setSelectedGroup(prev => ({ ...prev, requiresApproval: !prev.requiresApproval }));
                          toast.success("Đã cập nhật chế độ phê duyệt!");
                          fetchGroups(searchKeyword);
                        } catch (e) {
                          toast.error("Không thể cập nhật");
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all ${selectedGroup.requiresApproval ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-zinc-800 border-zinc-700 text-zinc-300'}`}
                    >
                      {selectedGroup.requiresApproval ? "✓ Đang bật chế độ cần phê duyệt" : "○ Đang cho phép gia nhập tự do"}
                    </button>
                  </div>

                  <div className="pt-4 border-t border-zinc-800">
                    <h4 className="text-rose-400 font-semibold text-xs tracking-wide uppercase font-mono mb-2">Vùng nguy hiểm</h4>
                    <p className="text-zinc-500 text-xs mb-3">Giải tán cộng đồng sẽ xóa vĩnh viễn dữ liệu nhóm và toàn bộ thành viên.</p>
                    <button 
                      onClick={handleDeleteGroup}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-medium transition-all"
                    >
                      <Trash2 size={13} /> Giải tán cộng đồng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL TẠO CỘNG ĐỒNG MỚI */}
      {/* ========================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsCreateOpen(false)}>
          <div 
            className="relative w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
              <h3 className="text-zinc-100 font-bold text-base">Khởi Tạo Cộng Đồng Mới</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-zinc-300 text-xs font-medium mb-1">Tên cộng đồng *</label>
                <input 
                  type="text" 
                  required
                  placeholder="VD: Hội Lập Trình Viên Web & AI, Chill Beats Lounge..."
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 text-xs font-medium mb-1">Mô tả ngắn</label>
                <textarea 
                  rows="2"
                  placeholder="Mô tả mục tiêu và định hướng của cộng đồng..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 text-xs font-medium mb-1">Quy định / Nội quy nhóm</label>
                <textarea 
                  rows="3"
                  placeholder="1. Tôn trọng lẫn nhau&#10;2. Không spam nội dung rác..."
                  value={createForm.rules}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, rules: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 text-xs font-medium mb-1">Link ảnh bìa (Cover)</label>
                  <input 
                    type="url" 
                    placeholder="https://..."
                    value={createForm.coverUrl}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, coverUrl: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 text-xs font-medium mb-1">Link avatar nhóm</label>
                  <input 
                    type="url" 
                    placeholder="https://..."
                    value={createForm.avatarUrl}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, avatarUrl: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button 
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? "Đang tạo..." : "Tạo cộng đồng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunitySection;

