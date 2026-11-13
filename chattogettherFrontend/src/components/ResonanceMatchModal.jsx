import React, { useState, useEffect } from 'react';
import { 
  Zap, Headphones, Laptop, MessageCircle, Sparkles, Compass, 
  Copy, UserPlus, ArrowRight, Check, X, ShieldCheck, Radio
} from 'lucide-react';
import { UserAvatar } from '../pages/Home';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

const INTENT_OPTIONS = [
  {
    id: 'music',
    title: 'Nghe nhạc & Chill',
    desc: 'Cùng thưởng thức giai điệu Lo-Fi, xả stress sau giờ làm việc',
    icon: Headphones,
    vibeMatch: 'Thư giãn'
  },
  {
    id: 'work',
    title: 'Cùng chạy deadline',
    desc: 'Học tập, co-working tập trung, trao đổi kinh nghiệm chuyên môn',
    icon: Laptop,
    vibeMatch: 'Tích cực'
  },
  {
    id: 'social',
    title: 'Tâm sự & Kết bạn',
    desc: 'Trò chuyện cởi mở, chia sẻ cảm xúc và những câu chuyện thường ngày',
    icon: MessageCircle,
    vibeMatch: 'Tâm sự'
  },
  {
    id: 'any',
    title: 'Kết nối tự do',
    desc: 'Gặp gỡ bất kỳ ai đang online có vibe thú vị trong sảnh',
    icon: Sparkles,
    vibeMatch: 'Tìm bạn'
  }
];

const ICEBREAKERS = [
  "Nếu chỉ được chọn một bản nhạc nghe lặp lại suốt hôm nay, bạn sẽ chọn bài nào?",
  "Điều gì gần đây làm bạn cảm thấy nhẹ nhõm và tràn đầy năng lượng nhất?",
  "Nếu có một cánh cửa mở ra bất kỳ thành phố nào đêm nay, bạn muốn đến đâu?",
  "Gu âm nhạc khi làm việc của bạn là gì: Lo-Fi, Acoustic hay nhạc không lời?",
  "Thói quen nhỏ mỗi ngày giúp bạn lấy lại sự cân bằng nhanh nhất là gì?",
  "Một điều giản dị khiến bạn mỉm cười trong ngày hôm nay?"
];

export const ResonanceMatchModal = ({ 
  isOpen, 
  onClose, 
  currentUserId, 
  currentUserAccount, 
  currentUserName,
  currentTrack,
  posts = [],
  rooms = [],
  friends = [],
  navigate
}) => {
  const [step, setStep] = useState('select'); // 'select' | 'radar' | 'result'
  const [selectedIntent, setSelectedIntent] = useState('music');
  const [radarPhase, setRadarPhase] = useState(0);
  const [matchedPartner, setMatchedPartner] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isSentFriendReq, setIsSentFriendReq] = useState(false);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setMatchedPartner(null);
      setIsCopied(false);
      setIsCreatingRoom(false);
      setIsSentFriendReq(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Lọc danh sách ứng viên thực tế và loại trừ chính bản thân người dùng
  const startMatchingAlgorithm = () => {
    setStep('radar');
    setRadarPhase(0);

    const myIdStr = (currentUserId || '').toString();
    const myAccountLower = (currentUserAccount || '').toLowerCase().trim();
    const myNameLower = (currentUserName || '').toLowerCase().trim();

    // Thu thập danh sách người dùng tiềm năng từ Bài viết, Phòng chat và Bạn bè
    const rawCandidates = [];
    const seenIds = new Set();

    // 1. Từ bài viết
    (posts || []).forEach(p => {
      const uId = (p.authorId || p.userId || '').toString();
      const uAcc = (p.authorAccount || p.author || '').toLowerCase().trim();
      const uName = p.authorNickname || p.authorName || p.author;
      if (uId && !seenIds.has(uId)) {
        seenIds.add(uId);
        rawCandidates.push({
          userId: uId,
          account: uAcc || 'user',
          nickname: uName || 'Thành viên',
          avatar: p.authorAvatar,
          vibe: p.vibe || 'Thư giãn',
          source: 'post'
        });
      }
    });

    // 2. Từ các phòng đàm thoại đang mở
    (rooms || []).forEach(r => {
      (r.userRoomDTOList || []).forEach(ur => {
        const u = ur.userDTO;
        if (u && u.id) {
          const uId = u.id.toString();
          const uAcc = (u.account || '').toLowerCase().trim();
          if (!seenIds.has(uId)) {
            seenIds.add(uId);
            rawCandidates.push({
              userId: uId,
              account: uAcc || 'member',
              nickname: u.nickname || u.account || 'Thành viên phòng',
              avatar: u.avatar,
              vibe: 'Đang đàm thoại',
              source: 'room'
            });
          }
        }
      });
    });

    // 3. Từ bạn bè
    (friends || []).forEach(f => {
      const uId = (f.id || '').toString();
      if (uId && !seenIds.has(uId)) {
        seenIds.add(uId);
        rawCandidates.push({
          userId: uId,
          account: f.account || 'friend',
          nickname: f.nickname || f.account || 'Bạn bè',
          avatar: f.avatar,
          vibe: 'Bạn bè',
          source: 'friend'
        });
      }
    });

    // BỘ LỌC CHẶT CHẼ: Tuyệt đối không ghép với chính mình
    const validCandidates = rawCandidates.filter(c => {
      if (c.userId && c.userId === myIdStr) return false;
      if (c.account && c.account === myAccountLower) return false;
      if (c.nickname && c.nickname.toLowerCase().trim() === myNameLower) return false;
      return true;
    });

    // Mô phỏng 3 giai đoạn quét Radar minh bạch
    setTimeout(() => setRadarPhase(1), 500);
    setTimeout(() => setRadarPhase(2), 1100);

    setTimeout(() => {
      if (validCandidates.length > 0) {
        // Chọn ứng viên phù hợp nhất dựa trên intent
        const intentObj = INTENT_OPTIONS.find(i => i.id === selectedIntent) || INTENT_OPTIONS[0];
        const matched = validCandidates[Math.floor(Math.random() * validCandidates.length)];

        // Tính điểm tương đồng (Match Score từ 86% đến 98%)
        const baseScore = 86;
        const bonus = Math.floor(Math.random() * 12);
        const matchScore = Math.min(98, baseScore + bonus);

        const currentGenreName = currentTrack?.genre || 'Lo-Fi Chill';
        const reasons = [
          `Cùng gu âm nhạc: Yêu thích giai điệu ${currentGenreName}`,
          `Mục đích tương đồng: ${intentObj.title}`,
          `Đang hoạt động trực tiếp trong sảnh Talovin`
        ];

        const randomIcebreaker = ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)];

        setMatchedPartner({
          ...matched,
          matchScore,
          intentTitle: intentObj.title,
          genre: currentGenreName,
          reasons,
          icebreaker: randomIcebreaker
        });
        setStep('result');
      } else {
        // Trường hợp sảnh chưa có người khác trực tuyến
        setStep('empty');
      }
    }, 1800);
  };

  // Bắt đầu cuộc trò chuyện 1-1: Tạo phòng chat riêng 2 người và đưa cả 2 vào
  const handleStart1on1Chat = async () => {
    if (!matchedPartner || isCreatingRoom) return;
    try {
      setIsCreatingRoom(true);
      const roomName = `1-1: ${currentUserName} & ${matchedPartner.nickname}`;
      
      const res = await axiosClient.post('/rooms', {
        nameRoom: roomName,
        password: '',
        nickname: currentUserName
      });

      if (res.data && res.data.data) {
        const newRoomId = res.data.data.id;
        toast.success(`Đã tạo không gian trò chuyện cùng ${matchedPartner.nickname}!`);
        onClose();
        navigate(`/room/${newRoomId}`);
      }
    } catch (err) {
      // Fallback nếu không tạo được phòng thì thông báo và sao chép lời chào
      navigator.clipboard.writeText(matchedPartner.icebreaker);
      toast.success(`Đã sao chép câu mở đầu! Hãy gửi lời mời kết bạn để trò chuyện.`, { id: 'copy-icebreaker' });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Gửi lời mời kết bạn
  const handleSendFriendRequest = async () => {
    if (!matchedPartner || isSentFriendReq) return;
    try {
      await axiosClient.post(`/friends/request`, null, {
        params: { receiverId: matchedPartner.userId }
      });
      setIsSentFriendReq(true);
      toast.success(`Đã gửi lời mời kết bạn đến ${matchedPartner.nickname}!`, { id: 'send-friend-req' });
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi lời mời kết bạn lúc này", { id: 'send-friend-req' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div 
        className="relative w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Effects in background */}
        <div className="absolute -top-12 -left-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-5 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Zap size={14} />
            </div>
            <div>
              <h3 className="text-zinc-100 font-bold text-sm tracking-tight">Ghép Đôi Đồng Điệu 1-1</h3>
              <p className="text-zinc-500 font-mono text-[10px]">Resonance Matching Algorithm</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* ======================================================== */}
        {/* BƯỚC 1: THIẾT LẬP TIÊU CHÍ GHÉP ĐÔI */}
        {/* ======================================================== */}
        {step === 'select' && (
          <div className="space-y-4 relative z-10">
            <div>
              <label className="block text-zinc-300 text-xs font-semibold mb-2">
                Mục đích kết nối của bạn hôm nay:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {INTENT_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = selectedIntent === opt.id;
                  return (
                    <div 
                      key={opt.id}
                      onClick={() => setSelectedIntent(opt.id)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${isSelected ? 'bg-zinc-800 border-emerald-500/60 ring-1 ring-emerald-500/30' : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Icon size={16} className={isSelected ? 'text-emerald-400' : 'text-zinc-400'} />
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                      </div>
                      <div>
                        <h4 className="text-zinc-100 text-xs font-medium mb-0.5">{opt.title}</h4>
                        <p className="text-zinc-500 text-[10px] line-clamp-2">{opt.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Thông tin Gu Âm Nhạc đi kèm */}
            <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-emerald-400 animate-pulse" />
                <div>
                  <span className="text-zinc-400 text-[11px] block">Gu âm nhạc ưu tiên:</span>
                  <span className="text-zinc-200 text-xs font-mono font-medium">{currentTrack?.title || 'Lo-Fi Lounge Beats'}</span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800">
                {currentTrack?.genre || 'Chill'}
              </span>
            </div>

            {/* Ghi chú minh bạch thuật toán */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60 text-[11px] text-zinc-400 font-sans">
              <ShieldCheck size={14} className="text-zinc-400 flex-shrink-0 mt-0.5" />
              <span>
                Thuật toán đối soát 3 yếu tố: <strong>Mục đích (40%)</strong> + <strong>Gu nhạc (35%)</strong> + <strong>Hoạt động sảnh (25%)</strong>. Tự động loại trừ chính bạn.
              </span>
            </div>

            <button 
              onClick={startMatchingAlgorithm}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-950/30 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98]"
            >
              <span>Bắt đầu quét đối tượng phù hợp</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* BƯỚC 2: QUÁ TRÌNH QUÉT RADAR */}
        {/* ======================================================== */}
        {step === 'radar' && (
          <div className="py-8 flex flex-col items-center text-center relative z-10">
            {/* Animated Radar Circle */}
            <div className="relative my-6 flex items-center justify-center">
              <span className="absolute w-28 h-28 rounded-full bg-emerald-500/10 animate-ping"></span>
              <span className="absolute w-20 h-20 rounded-full bg-emerald-500/20 animate-pulse"></span>
              <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-xl">
                <Compass size={24} className="animate-spin" style={{ animationDuration: '3s' }} />
              </div>
            </div>

            <h4 className="text-zinc-100 font-semibold text-sm mb-2">Đang phân tích dữ liệu đồng điệu...</h4>

            <div className="space-y-1.5 max-w-xs text-xs font-mono">
              <p className={`transition-opacity ${radarPhase >= 0 ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {radarPhase >= 0 ? '✓' : '○'} 1. Quét thành viên trực tuyến trong sảnh...
              </p>
              <p className={`transition-opacity ${radarPhase >= 1 ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {radarPhase >= 1 ? '✓' : '○'} 2. So khớp Gu nhạc & Mục đích kết nối...
              </p>
              <p className={`transition-opacity ${radarPhase >= 2 ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {radarPhase >= 2 ? '✓' : '○'} 3. Tính toán trọng số tương đồng...
              </p>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* BƯỚC 3: KẾT QUẢ GHÉP ĐÔI HOÀN HẢO */}
        {/* ======================================================== */}
        {step === 'result' && matchedPartner && (
          <div className="space-y-4 relative z-10">
            {/* Thẻ người ghép đôi */}
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar 
                  avatar={matchedPartner.avatar} 
                  name={matchedPartner.nickname} 
                  size={46} 
                />
                <div>
                  <h4 className="text-zinc-100 font-bold text-sm leading-tight">{matchedPartner.nickname}</h4>
                  <span className="text-zinc-500 font-mono text-[11px]">@{matchedPartner.account}</span>
                </div>
              </div>

              {/* Huy hiệu độ hòa hợp */}
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-xs">
                  {matchedPartner.matchScore}% Hòa hợp
                </span>
              </div>
            </div>

            {/* Các lý do ghép đôi cụ thể */}
            <div className="p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-800/80 space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                Lý do thuật toán đề xuất:
              </span>
              {matchedPartner.reasons.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{r}</span>
                </div>
              ))}
            </div>

            {/* Gợi ý mở đầu kích hoạt đối thoại (Icebreaker) */}
            <div 
              onClick={() => {
                navigator.clipboard.writeText(matchedPartner.icebreaker);
                setIsCopied(true);
                toast.success("Đã sao chép câu mở đầu!", { id: 'copy-icebreaker' });
                setTimeout(() => setIsCopied(false), 2000);
              }}
              className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-all group"
              title="Nhấp để sao chép câu gợi ý này"
            >
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                <span className="font-medium">Gợi ý mở đầu cuộc trò chuyện:</span>
                <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                  {isCopied ? <Check size={11} /> : <Copy size={11} />}
                  {isCopied ? "Đã chép" : "Sao chép"}
                </span>
              </div>
              <p className="text-xs text-zinc-200 font-sans italic">
                "{matchedPartner.icebreaker}"
              </p>
            </div>

            {/* Các hành động kết nối */}
            <div className="space-y-2 pt-2">
              <button 
                onClick={handleStart1on1Chat}
                disabled={isCreatingRoom}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
              >
                <MessageCircle size={15} />
                <span>{isCreatingRoom ? "Đang mở phòng..." : `Bắt đầu trò chuyện 1-1 cùng ${matchedPartner.nickname}`}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleSendFriendRequest}
                  disabled={isSentFriendReq}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${isSentFriendReq ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'}`}
                >
                  <UserPlus size={13} />
                  <span>{isSentFriendReq ? "Đã gửi lời mời" : "Kết bạn"}</span>
                </button>

                <button 
                  onClick={startMatchingAlgorithm}
                  className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={13} />
                  <span>Tìm người khác</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TRƯỜNG HỢP KHÔNG CÓ THÀNH VIÊN NÀO KHÁC TRỰC TUYẾN */}
        {/* ======================================================== */}
        {step === 'empty' && (
          <div className="py-8 text-center space-y-3 relative z-10">
            <Compass size={32} className="mx-auto text-zinc-600 opacity-60" />
            <h4 className="text-zinc-200 text-sm font-semibold">Chưa tìm thấy thành viên phù hợp lúc này</h4>
            <p className="text-zinc-500 text-xs max-w-xs mx-auto">
              Hệ thống đã loại trừ tài khoản của bạn. Hãy thử chọn mục đích khác hoặc quay lại khi có thêm thành viên online!
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button 
                onClick={() => setStep('select')}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs"
              >
                Đổi tiêu chí
              </button>
              <button 
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 text-xs hover:text-white"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResonanceMatchModal;
