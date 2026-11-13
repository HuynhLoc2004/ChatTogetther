import React, { useState, useEffect } from 'react';
import { 
  X, Dices, Share2, Sparkles, Plus, Check, Loader2, 
  RotateCw, Flame, MessageSquareQuote, User, Send
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

export const ChallengeDeckModal = ({ isOpen, onClose, onShareToFeed }) => {
  const [categories, setCategories] = useState([
    { key: 'ALL', label: 'Tất cả', color: '#a1a1aa' },
    { key: 'TRUTH', label: 'Thú nhận', color: '#ec4899' },
    { key: 'DARE', label: 'Thử thách vui', color: '#f59e0b' },
    { key: 'DEEP_TALK', label: 'Tâm sự sâu lắng', color: '#818cf8' },
    { key: 'MUSIC', label: 'Gu âm nhạc', color: '#38bdf8' },
    { key: 'PHILOSOPHY', label: 'Góc nhìn cuộc sống', color: '#10b981' }
  ]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showContributeForm, setShowContributeForm] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionCategory, setNewQuestionCategory] = useState('DEEP_TALK');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Lấy danh mục khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    const fetchCategories = async () => {
      try {
        const res = await axiosClient.get('/challenges/categories');
        if (res.data?.data && Array.isArray(res.data.data)) {
          setCategories(res.data.data);
        }
      } catch (err) {
        console.error("Không lấy được danh mục thử thách:", err);
      }
    };

    fetchCategories();
    drawRandomChallenge('ALL');
  }, [isOpen]);

  // Bốc thẻ bài ngẫu nhiên từ API thực tế
  const drawRandomChallenge = async (catKey = selectedCategory) => {
    try {
      setIsShuffling(true);
      setIsLoading(true);
      const params = catKey && catKey !== 'ALL' ? { category: catKey } : {};
      const res = await axiosClient.get('/challenges/random', { params });
      if (res.data?.data) {
        setTimeout(() => {
          setCurrentChallenge(res.data.data);
          setIsShuffling(false);
          setIsLoading(false);
        }, 320); // Thời gian delay giả lập xào bài mượt mà
      }
    } catch (err) {
      console.error("Lỗi bốc thẻ bài:", err);
      setIsShuffling(false);
      setIsLoading(false);
      // Fallback nếu có lỗi mạng
      setCurrentChallenge({
        id: 999,
        category: 'DEEP_TALK',
        categoryName: 'Tâm sự',
        badgeColor: '#818cf8',
        question: 'Khoảnh khắc nào trong ngày bạn cảm thấy bình yên và là chính mình nhất?',
        author: 'Hệ thống Talovin',
        usageCount: 12
      });
    }
  };

  const handleSelectCategory = (catKey) => {
    setSelectedCategory(catKey);
    drawRandomChallenge(catKey);
  };

  // Đóng góp câu hỏi mới
  const handleSubmitContribution = async (e) => {
    if (e) e.preventDefault();
    const text = newQuestionText.trim();
    if (!text) {
      toast.error("Vui lòng nhập nội dung câu hỏi!");
      return;
    }
    if (text.length < 10) {
      toast.error("Câu hỏi nên có ít nhất 10 ký tự!");
      return;
    }

    try {
      setIsSubmittingNew(true);
      const res = await axiosClient.post('/challenges', {
        question: text,
        category: newQuestionCategory
      });
      if (res.data?.data) {
        toast.success("Đã đóng góp câu hỏi thành công! Thẻ bài của bạn đã được thêm vào sàn đấu.", { id: 'challenge-created' });
        setCurrentChallenge(res.data.data);
        setSelectedCategory(newQuestionCategory);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-lg bg-zinc-950/95 border border-zinc-800/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Dices size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                Thẻ Bài Thử Thách & Tương Tác
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                  Data Thực Tế
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">Khơi nguồn đối thoại, kết nối cảm xúc chân thật</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Category Pills Bar */}
        <div className="px-4 py-2.5 border-b border-zinc-800/50 bg-zinc-900/30 overflow-x-auto no-scrollbar flex items-center gap-1.5">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => handleSelectCategory(cat.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected 
                    ? 'bg-zinc-100 text-zinc-900 shadow-sm font-bold' 
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                {cat.key !== 'ALL' && (
                  <span 
                    className="w-1.5 h-1.5 rounded-full" 
                    style={{ backgroundColor: isSelected ? '#18181b' : cat.color || '#a1a1aa' }} 
                  />
                )}
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Card Lá Bài */}
          <div className="relative min-h-[220px] rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between bg-gradient-to-br from-zinc-900/90 via-zinc-900/40 to-zinc-950 border-zinc-800/90 hover:border-zinc-700 shadow-lg">
            {/* Background Ambient Glow */}
            <div 
              className="absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-15 pointer-events-none"
              style={{ backgroundColor: currentChallenge?.badgeColor || '#6366f1' }}
            />

            {/* Top Bar of Card */}
            <div className="flex items-center justify-between relative z-10">
              <div 
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide uppercase"
                style={{ 
                  backgroundColor: `${currentChallenge?.badgeColor || '#6366f1'}15`,
                  color: currentChallenge?.badgeColor || '#818cf8',
                  border: `1px solid ${currentChallenge?.badgeColor || '#6366f1'}35`
                }}
              >
                <Sparkles size={11} />
                <span>{currentChallenge?.categoryName || 'Thử Thách'}</span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
                <Flame size={12} className="text-amber-400" />
                <span>Đã bốc {currentChallenge?.usageCount || 1} lần</span>
              </div>
            </div>

            {/* Question Text */}
            <div className={`my-4 relative z-10 transition-all duration-200 ${isShuffling ? 'opacity-30 scale-95 blur-xs' : 'opacity-100 scale-100'}`}>
              <div className="flex items-start gap-2.5">
                <MessageSquareQuote size={20} className="text-zinc-600 flex-shrink-0 mt-0.5" />
                <p className="text-base sm:text-lg font-medium text-zinc-100 leading-relaxed tracking-normal font-sans">
                  "{currentChallenge?.question || 'Đang bốc câu hỏi mới...'}"
                </p>
              </div>

              {/* Author Attribution */}
              <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
                <User size={12} className="text-zinc-500" />
                <span>Khởi xướng: <strong className="text-zinc-300 font-semibold">{currentChallenge?.author || 'Hệ thống Talovin'}</strong></span>
              </div>
            </div>

            {/* Action inside Card: Đưa ra sảnh */}
            <div className="pt-3 border-t border-zinc-800/60 relative z-10 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!currentChallenge?.question) return;
                  if (onShareToFeed) {
                    onShareToFeed(currentChallenge);
                  }
                  onClose();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 active:scale-98"
              >
                <Share2 size={14} />
                <span>Đưa câu hỏi này ra Sảnh</span>
              </button>

              <button
                type="button"
                onClick={() => drawRandomChallenge()}
                disabled={isLoading}
                className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-all flex items-center justify-center gap-2 border border-zinc-700/80 active:scale-98"
                title="Bốc lá bài khác ngẫu nhiên"
              >
                <RotateCw size={14} className={isShuffling ? 'animate-spin' : ''} />
                <span>Bốc câu khác</span>
              </button>
            </div>
          </div>

          {/* Collapsible Form: Đóng góp câu hỏi của bạn */}
          {!showContributeForm ? (
            <button
              type="button"
              onClick={() => setShowContributeForm(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <Plus size={14} />
              <span>Đóng góp câu hỏi thử thách của bạn vào bộ sưu tập</span>
            </button>
          ) : (
            <form onSubmit={handleSubmitContribution} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-400" /> Đóng góp câu hỏi mới
                </span>
                <button 
                  type="button" 
                  onClick={() => setShowContributeForm(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  Đóng
                </button>
              </div>

              <textarea
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Nhập câu hỏi gợi mở, sâu sắc hoặc thử thách thú vị..."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />

              <div className="flex items-center justify-between gap-2">
                <select
                  value={newQuestionCategory}
                  onChange={(e) => setNewQuestionCategory(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="TRUTH">Thú nhận (Truth)</option>
                  <option value="DARE">Thử thách vui (Dare)</option>
                  <option value="DEEP_TALK">Tâm sự sâu lắng (Deep Talk)</option>
                  <option value="MUSIC">Gu âm nhạc & Vibe</option>
                  <option value="PHILOSOPHY">Góc nhìn cuộc sống</option>
                </select>

                <button
                  type="submit"
                  disabled={isSubmittingNew || !newQuestionText.trim()}
                  className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
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
