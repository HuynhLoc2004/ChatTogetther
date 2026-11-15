import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X, Dices, Share2, Sparkles, Plus, Loader2,
  RotateCw, Flame, MessageSquareQuote, ChevronLeft, ChevronRight, ChevronDown, Send
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

export const ChallengeDeckModal = ({ isOpen, onClose, onShareToFeed }) => {
  const [allCards, setAllCards] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showContributeForm, setShowContributeForm] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionCategory, setNewQuestionCategory] = useState('DEEP_TALK');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  const chipScrollRef = useRef(null);

  // Helper lấy/lưu seenIds từ sessionStorage
  const getSeenIds = (catKey) => {
    try {
      const data = sessionStorage.getItem(`talovin_seen_icebreakers_${catKey}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const setSeenIds = (catKey, ids) => {
    try {
      sessionStorage.setItem(`talovin_seen_icebreakers_${catKey}`, JSON.stringify(ids));
    } catch {}
  };

  // 1. Tự động trích xuất danh mục duy nhất từ thẻ bài ACTIVE (Zero Hardcode)
  const categories = useMemo(() => {
    const map = new Map();
    allCards.forEach(c => {
      const key = c.category || 'DEEP_TALK';
      const label = c.categoryName || c.category || 'Tâm sự';
      if (!map.has(key)) {
        map.set(key, { key, label, color: c.badgeColor || '#a1a1aa' });
      }
    });

    const dynamicList = Array.from(map.values());
    if (dynamicList.length === 0) {
      return [
        { key: 'ALL', label: 'Tất cả', color: '#ffffff' },
        { key: 'DEEP_TALK', label: 'Tâm sự sâu lắng', color: '#818cf8' },
        { key: 'TRUTH', label: 'Thú nhận', color: '#ec4899' },
        { key: 'DARE', label: 'Thử thách vui', color: '#f59e0b' },
        { key: 'MUSIC', label: 'Gu âm nhạc', color: '#38bdf8' },
        { key: 'PHILOSOPHY', label: 'Góc nhìn cuộc sống', color: '#10b981' }
      ];
    }

    return [{ key: 'ALL', label: 'Tất cả', color: '#ffffff' }, ...dynamicList];
  }, [allCards]);

  // 2. Thuật toán Bốc Ngẫu Nhiên Không Trùng (Non-Repeating Deck Algorithm)
  const pickCardFromPool = useCallback((cardsList, catKey, currentId) => {
    if (!cardsList || cardsList.length === 0) return null;

    let pool = catKey === 'ALL' ? cardsList : cardsList.filter(c => c.category === catKey);
    if (pool.length === 0) pool = cardsList;

    let seen = getSeenIds(catKey);
    let available = pool.filter(c => !seen.includes(c.id));

    // Nếu đã bốc hết 1 vòng, reset seenIds nhưng loại trừ currentId để không trùng 2 lần liên tiếp
    if (available.length === 0) {
      seen = currentId ? [currentId] : [];
      setSeenIds(catKey, seen);
      available = pool.filter(c => c.id !== currentId);
      if (available.length === 0) available = pool;
    }

    // Chọn ngẫu nhiên có trọng số nhẹ ưu tiên drawCount thấp hơn
    const sorted = [...available].sort((a, b) => {
      const countA = a.drawCount ?? a.usageCount ?? 0;
      const countB = b.drawCount ?? b.usageCount ?? 0;
      return (countA - countB) + (Math.random() - 0.5) * 4;
    });

    const picked = sorted[0] || pool[0];
    setSeenIds(catKey, [...seen, picked.id]);
    return picked;
  }, []);

  // Thực hiện bốc thẻ bài
  const drawCard = useCallback((catKey = selectedCategory) => {
    if (allCards.length === 0) return;

    setIsShuffling(true);
    const picked = pickCardFromPool(allCards, catKey, currentChallenge?.id);

    setTimeout(() => {
      if (picked) {
        // Optimistic UI update
        const currentCount = picked.drawCount ?? picked.usageCount ?? 0;
        const updated = {
          ...picked,
          drawCount: currentCount + 1,
          usageCount: currentCount + 1
        };
        setCurrentChallenge(updated);

        // Gọi ngầm Atomic Draw Counter lên server
        if (picked.id) {
          axiosClient.post(`/public/icebreakers/${picked.id}/draw`).catch(() => {});
        }
      }
      setIsShuffling(false);
    }, 240);
  }, [allCards, selectedCategory, currentChallenge, pickCardFromPool]);

  // Nạp toàn bộ thẻ ACTIVE khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    const fetchIcebreakers = async () => {
      try {
        setIsLoading(true);
        const res = await axiosClient.get('/public/icebreakers');
        const cards = res.data?.data || [];
        if (Array.isArray(cards) && cards.length > 0) {
          setAllCards(cards);
          const firstPick = pickCardFromPool(cards, selectedCategory, null);
          if (firstPick) {
            const currentCount = firstPick.drawCount ?? firstPick.usageCount ?? 0;
            setCurrentChallenge({
              ...firstPick,
              drawCount: currentCount + 1,
              usageCount: currentCount + 1
            });
            if (firstPick.id) {
              axiosClient.post(`/public/icebreakers/${firstPick.id}/draw`).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách thẻ bài:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIcebreakers();
  }, [isOpen, pickCardFromPool, selectedCategory]);

  const handleSelectCategory = (catKey) => {
    setSelectedCategory(catKey);
    drawCard(catKey);
  };

  // Đóng góp câu hỏi mới
  const handleSubmitContribution = async (e) => {
    if (e) e.preventDefault();
    const text = newQuestionText.trim();
    if (!text) {
      toast.error("Vui lòng nhập nội dung câu hỏi!");
      return;
    }
    if (text.length < 10 || text.length > 220) {
      toast.error("Nội dung câu hỏi phải có từ 10 đến 220 ký tự!");
      return;
    }

    try {
      setIsSubmittingNew(true);
      const res = await axiosClient.post('/icebreakers/submit', {
        question: text,
        category: newQuestionCategory
      });
      if (res.data?.data) {
        toast.success("Đã gửi câu hỏi đóng góp thành công! Đang chờ duyệt.", { id: 'icebreaker-submitted' });
        setNewQuestionText('');
        setShowContributeForm(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi câu hỏi lúc này!");
    } finally {
      setIsSubmittingNew(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans" onClick={onClose}>
      <div
        className="w-[92vw] max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 shadow-inner">
              <Dices size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                Thẻ Bài Thử Thách & Tương Tác
              </h3>
              <p className="text-[11px] text-zinc-400">Khơi nguồn đối thoại, kết nối cảm xúc chân thật</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Dynamic Category Chips Bar với 2 nút điều hướng tròn < > */}
        <div className="px-3 py-2 border-b border-zinc-800/80 bg-zinc-950 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (chipScrollRef.current) chipScrollRef.current.scrollBy({ left: -140, behavior: 'smooth' });
            }}
            className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center shrink-0 active:scale-95 transition-all"
            title="Cuộn sang trái"
          >
            <ChevronLeft size={14} />
          </button>

          <div
            ref={chipScrollRef}
            onWheel={(e) => {
              if (e.deltaY && chipScrollRef.current) {
                chipScrollRef.current.scrollLeft += e.deltaY;
              }
            }}
            className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-1 scroll-smooth"
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleSelectCategory(cat.key)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-white text-zinc-950 border-white font-bold shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              if (chipScrollRef.current) chipScrollRef.current.scrollBy({ left: 140, behavior: 'smooth' });
            }}
            className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center shrink-0 active:scale-95 transition-all"
            title="Cuộn sang phải"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Thẻ Lá Bài Chuẩn Dark Zinc */}
          <div className="relative min-h-[210px] rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-xl">
            {/* Top Bar of Card */}
            <div className="flex items-center justify-between relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide uppercase bg-zinc-950 text-zinc-300 border border-zinc-800">
                <Sparkles size={11} className="text-zinc-400" />
                <span>{currentChallenge?.categoryName || 'Thử Thách'}</span>
              </div>

              {/* Lượt bốc đơn sắc text-zinc-400 */}
              <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-zinc-400">
                <Flame size={12} className="text-zinc-400" />
                <span>Đã bốc {currentChallenge?.drawCount || currentChallenge?.usageCount || 1} lần</span>
              </div>
            </div>

            {/* Question Text */}
            <div className={`my-4 relative z-10 transition-all duration-200 ${isShuffling ? 'opacity-30 scale-95 blur-xs' : 'opacity-100 scale-100'}`}>
              <div className="flex items-start gap-2.5">
                <MessageSquareQuote size={20} className="text-zinc-600 flex-shrink-0 mt-0.5" />
                <p className="text-base sm:text-lg font-medium text-zinc-100 leading-relaxed font-sans">
                  "{currentChallenge?.question || currentChallenge?.content || 'Đang bốc câu hỏi mới...'}"
                </p>
              </div>

              {/* Tác giả: Chủ đề gợi ý hoặc Đóng góp bởi @username */}
              <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                <span>
                  {currentChallenge?.authorUsername && currentChallenge.authorUsername !== 'talovin' && currentChallenge.authorUsername !== 'admin'
                    ? `Đóng góp bởi @${currentChallenge.authorUsername}`
                    : 'Chủ đề gợi ý'}
                </span>
              </div>
            </div>

            {/* Hàng 2 nút hành động thẳng 1 hàng h-10 */}
            <div className="pt-3 border-t border-zinc-800/80 relative z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const q = currentChallenge?.question || currentChallenge?.content;
                  if (!q) return;
                  if (onShareToFeed) {
                    onShareToFeed(currentChallenge);
                  }
                  onClose();
                }}
                className="flex-1 h-10 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition-all flex items-center justify-center gap-2 shadow-sm active:scale-98 whitespace-nowrap"
              >
                <Share2 size={14} />
                <span>Đăng ra Sảnh</span>
              </button>

              <button
                type="button"
                onClick={() => drawCard()}
                disabled={isLoading || isShuffling}
                className="h-10 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium transition-all flex items-center justify-center gap-2 active:scale-98 whitespace-nowrap shrink-0"
                title="Bốc câu khác ngẫu nhiên"
              >
                <RotateCw size={13} className={isShuffling ? 'animate-spin' : ''} />
                <span>Bốc câu khác</span>
              </button>
            </div>
          </div>

          {/* Collapsible Form: Đóng góp câu hỏi mới */}
          {!showContributeForm ? (
            <button
              type="button"
              onClick={() => setShowContributeForm(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 text-xs font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Plus size={14} />
              <span>+ Đóng góp câu hỏi mới</span>
            </button>
          ) : (
            <form onSubmit={handleSubmitContribution} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-zinc-400" /> Đóng góp câu hỏi mới
                </span>
                <button
                  type="button"
                  onClick={() => setShowContributeForm(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  Đóng
                </button>
              </div>

              <div>
                <textarea
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="Nhập câu hỏi gợi mở, sâu sắc hoặc thử thách thú vị (10 - 220 ký tự)..."
                  rows={3}
                  maxLength={220}
                  className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors resize-none"
                />
                <div className="flex justify-end text-[10px] font-mono text-zinc-500 mt-1">
                  {newQuestionText.length}/220
                </div>
              </div>

              {/* Custom Dark Zinc Dropdown for Category */}
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                    className="w-full h-9 px-3 text-xs bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 flex items-center justify-between font-medium"
                  >
                    <span>
                      {categories.find(c => c.key === newQuestionCategory)?.label || 'Chọn danh mục'}
                    </span>
                    <ChevronDown size={14} className="text-zinc-400" />
                  </button>

                  {isCategoryDropdownOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 py-1 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                      {categories.filter(c => c.key !== 'ALL').map((c) => (
                        <div
                          key={c.key}
                          onClick={() => {
                            setNewQuestionCategory(c.key);
                            setIsCategoryDropdownOpen(false);
                          }}
                          className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between hover:bg-zinc-800 transition-colors ${
                            newQuestionCategory === c.key ? 'text-white font-semibold bg-zinc-800/60' : 'text-zinc-300'
                          }`}
                        >
                          <span>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingNew || newQuestionText.trim().length < 10}
                  className="h-9 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:hover:bg-white"
                >
                  {isSubmittingNew ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  <span>Gửi duyệt</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChallengeDeckModal;
