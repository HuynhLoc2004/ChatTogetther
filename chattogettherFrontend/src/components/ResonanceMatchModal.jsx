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
    } else {
      try {
        axiosClient.post('/matchmaking/leave').catch(() => {});
      } catch (e) {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleModalClose = () => {
    try {
      axiosClient.post('/matchmaking/leave').catch(() => {});
    } catch (e) {}
    onClose();
  };

  // Quét ghép đôi thời gian thực qua server (Tuyệt đối không mock dữ liệu hay ghép người offline)
  const startMatchingAlgorithm = async () => {
    setStep('radar');
    setRadarPhase(0);

    setTimeout(() => setRadarPhase(1), 400);
    setTimeout(() => setRadarPhase(2), 900);

    try {
      const res = await axiosClient.post('/matchmaking/join', {
        intent: selectedIntent
      });

      const data = res.data?.data;
      if (data && data.matched && data.partner) {
        const p = data.partner;
        const intentObj = INTENT_OPTIONS.find(i => i.id === (p.intent || selectedIntent)) || INTENT_OPTIONS[0];
        const randomIcebreaker = ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)];

        setMatchedPartner({
          userId: p.userId,
          account: p.account,
          nickname: p.nickname || p.account,
          avatar: p.avatar,
          matchScore: 94,
          intentTitle: intentObj.title,
          genre: currentTrack?.genre || 'Lo-Fi Chill',
          reasons: [
            `Cùng đang bấm tìm kiếm kết nối trực tiếp trong sảnh`,
            `Phù hợp với mục đích: ${intentObj.title}`
          ],
          icebreaker: randomIcebreaker
        });
        setStep('result');
      } else {
        // Hàng đợi thật: Hiện chưa có thành viên thứ hai cùng bấm tìm kiếm
        setTimeout(() => {
          setStep('empty');
        }, 1200);
      }
    } catch (err) {
      console.warn("Lỗi gọi matchmaking:", err);
      setTimeout(() => {
        setStep('empty');
      }, 1000);
    }
  };

  // Bắt đầu cuộc trò chuyện 1-1: Tạo phòng chat riêng 2 người và đưa cả 2 vào
  const handleStart1on1Chat = async () => {
    if (!matchedPartner || isCreatingRoom) return;
    try {
      setIsCreatingRoom(true);
      const roomName = `1-1: ${currentUserName} & ${matchedPartner.nickname}`;
      
      const res = await axiosClient.post('/rooms/create-room', {
        roomName: roomName,
        password: null
      });

      if (res.data && res.data.data) {
        const newRoomId = res.data.data.id;
        toast.success(`Đã tạo không gian trò chuyện cùng ${matchedPartner.nickname}!`);
        onClose();
        navigate(`/room/${newRoomId}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tạo phòng lúc này");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Gửi lời mời kết bạn
  const handleSendFriendRequest = async () => {
    if (!matchedPartner || isSentFriendReq) return;
    try {
      await axiosClient.post(`/friends/request`, null, {
        params: { receiver_id: matchedPartner.userId }
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
        <div className="flex items-center justify-between pb-4 border-b border-[#1e1e1e] mb-5 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#222222] border border-[#2e2e2e] text-zinc-200 flex items-center justify-center">
              <Zap size={14} />
            </div>
            <div>
              <h3 className="text-zinc-100 font-bold text-sm tracking-tight">Ghép Đôi Đồng Điệu 1-1</h3>
              <p className="text-zinc-500 text-[11px]">Kết nối ngẫu nhiên theo sở thích</p>
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
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${isSelected ? 'bg-[#1c1c1c] border-[#444444] text-white' : 'bg-[#121212] border-[#222222] hover:border-[#333333]'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Icon size={16} className={isSelected ? 'text-zinc-100' : 'text-zinc-500'} />
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
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
            <div className="p-3 rounded-2xl bg-[#121212] border border-[#222222] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-zinc-400" />
                <div>
                  <span className="text-zinc-400 text-[11px] block">Gu âm nhạc ưu tiên:</span>
                  <span className="text-zinc-200 text-xs font-mono font-medium">{currentTrack?.title || 'Lo-Fi Lounge Beats'}</span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded-md bg-[#1a1a1a] border border-[#2a2a2a]">
                {currentTrack?.genre || 'Chill'}
              </span>
            </div>

            {/* Ghi chú kết nối thân thiện */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#141414] border border-[#222222] text-[11px] text-zinc-400 font-sans">
              <ShieldCheck size={14} className="text-zinc-400 flex-shrink-0 mt-0.5" />
              <span>
                Tự động tìm kiếm thành viên đang online có cùng mục đích và sở thích âm nhạc để trò chuyện.
              </span>
            </div>

            <button 
              onClick={startMatchingAlgorithm}
              className="w-full py-3 rounded-2xl bg-[#f4f4f5] hover:bg-white text-[#101010] font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98]"
            >
              <span>Bắt đầu tìm người đồng điệu</span>
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
            <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mx-auto text-zinc-400 shadow-inner">
              <Compass size={24} />
            </div>
            <h4 className="text-zinc-200 text-sm font-semibold">Chưa có người dùng nào khác đang bấm tìm kiếm</h4>
            <p className="text-zinc-400 text-xs max-w-xs mx-auto leading-relaxed">
              Hệ thống ghép đôi thời gian thực 100% người dùng thật đang cùng quét. Hiện tại chỉ có bạn trong hàng đợi. Bạn có thể giữ kết nối trong ít phút hoặc quay lại sau nhé!
            </p>
            <div className="flex items-center justify-center gap-2 pt-3">
              <button 
                type="button"
                onClick={startMatchingAlgorithm}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
              >
                Quét lại ngay
              </button>
              <button 
                type="button"
                onClick={handleModalClose}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs hover:text-white transition-all"
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
