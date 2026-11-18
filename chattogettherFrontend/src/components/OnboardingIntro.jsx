import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Sparkles, Music, ArrowRight } from 'lucide-react';
import TalovinLogo from './TalovinLogo';

export const OnboardingIntro = ({ onComplete }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // 1. Kiểm tra trạng thái đã xem Onboarding hay chưa
  const [hasSeenOnboarding] = useState(() => {
    return (
      localStorage.getItem('talovin_has_seen_onboarding') === 'true' ||
      localStorage.getItem('talovin_onboarded') === 'true'
    );
  });

  // 2. Chế độ hiển thị:
  // - 'onboarding': Lần đầu truy cập (chưa xem onboarding) -> Hiện 3 slide
  // - 'splash': Từ lần 2 trở đi -> Chỉ hiện Splash 1.2s rồi tắt (nếu chưa hiện trong session này)
  // - null: Không hiển thị gì cả
  const [mode, setMode] = useState(() => {
    const seen = (
      localStorage.getItem('talovin_has_seen_onboarding') === 'true' ||
      localStorage.getItem('talovin_onboarded') === 'true'
    );
    if (!seen) return 'onboarding';

    const splashAlreadyShown = sessionStorage.getItem('talovin_splash_shown') === 'true';
    if (!splashAlreadyShown) return 'splash';

    return null;
  });

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  // Xử lý Splash Screen 1.2s cho lần truy cập thứ 2 trở đi
  useEffect(() => {
    if (mode === 'splash') {
      const timer = setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          sessionStorage.setItem('talovin_splash_shown', 'true');
          setMode(null);
          // Kiểm tra nếu chưa đăng nhập và đang ở '/', chuyển về '/login'
          const token = localStorage.getItem('accesstoken');
          if (!token && location.pathname === '/') {
            navigate('/login', { replace: true });
          }
          onComplete?.();
        }, 280);
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [mode, location.pathname, navigate, onComplete]);

  // Hoàn tất Onboarding (Khi bấm "Vào Talovin" hoặc "Bỏ qua")
  const handleFinishOnboarding = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      localStorage.setItem('talovin_has_seen_onboarding', 'true');
      localStorage.setItem('talovin_onboarded', 'true');
      sessionStorage.setItem('talovin_splash_shown', 'true');
      setMode(null);

      const token = localStorage.getItem('accesstoken');
      if (!token) {
        navigate('/login', { replace: true });
      }
      onComplete?.();
    }, 280);
  };

  const handleNext = () => {
    if (currentSlide < 2) {
      setCurrentSlide(prev => prev + 1);
    } else {
      handleFinishOnboarding();
    }
  };

  // Vuốt chạm cảm ứng cho mobile
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (touchDeltaX.current < -45 && currentSlide < 2) {
      setCurrentSlide(prev => prev + 1);
    } else if (touchDeltaX.current > 45 && currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
    touchDeltaX.current = 0;
  };

  if (!mode) return null;

  // Dữ liệu 3 Slide Onboarding chuẩn văn phong tự nhiên & đời thường
  const slides = [
    {
      title: 'Nghe giọng nhau trước khi mở lời',
      description: 'Gửi nhanh một đoạn voice 5 giây lên Sóng FM, tìm người cùng tần số ngay lúc này.',
      preview: (
        /* UI Preview Card: Thẻ Sóng FM 5s */
        <div className="w-[305px] sm:w-[330px] rounded-2xl bg-[#161922] border border-white/10 p-4 shadow-2xl shadow-indigo-500/10 text-left">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-sm shadow-md">
                  🎙️
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#161922]" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>@minh.audio</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">Sóng FM</span>
                </div>
                <p className="text-[10px] text-zinc-400">Vừa phát sóng</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-rose-400 font-medium bg-rose-500/10 px-2 py-0.5 rounded-full">
              ❤️ 24
            </span>
          </div>

          <div className="bg-[#1C202C] border border-white/5 rounded-xl p-3">
            <p className="text-xs text-zinc-200 font-medium mb-2.5">
              "Alo bạn gì ơi, chiều nay cà phê không? ☕"
            </p>

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white shrink-0 shadow-md">
                <Play size={12} fill="white" />
              </div>
              
              {/* Equalizer sóng âm dao động */}
              <div className="flex-1 flex items-center gap-1 h-6">
                {[8, 16, 24, 12, 19, 26, 14, 21, 10, 17, 24, 18, 13, 20].map((h, i) => (
                  <span 
                    key={i} 
                    className="w-1 bg-gradient-to-t from-indigo-500 to-violet-400 rounded-full"
                    style={{ 
                      height: `${h}px`,
                      animation: 'soundwavePulse 1s ease-in-out infinite alternate',
                      animationDelay: `${(i % 5) * 0.14}s`
                    }} 
                  />
                ))}
              </div>

              <span className="text-[10px] font-mono text-zinc-400 shrink-0">0:03 / 0:05</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Hết ngại mở đầu câu chuyện',
      description: 'Rút ngẫu nhiên một thẻ câu hỏi, trả lời vui với bạn bè hoặc người lạ cùng sảnh.',
      preview: (
        /* UI Preview Card: Thẻ Bài Câu Hỏi & Phản hồi nhanh */
        <div className="w-[305px] sm:w-[330px] space-y-2.5 text-left">
          <div className="rounded-2xl bg-gradient-to-br from-[#1C1F2E] to-[#161922] border border-amber-500/30 p-4 shadow-xl shadow-amber-500/10">
            <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-semibold mb-1.5">
              <Sparkles size={13} />
              <span>Thẻ câu hỏi ngẫu nhiên #42</span>
            </div>
            <p className="text-xs sm:text-[13px] font-semibold text-white leading-snug">
              "Nếu chỉ được nghe một bài hát duy nhất cả tuần này, bạn sẽ chọn bài nào?"
            </p>
          </div>

          <div className="space-y-1.5 pl-2">
            <div className="flex items-center gap-2 bg-[#161922]/90 border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-200">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">N</span>
              <span className="font-semibold text-zinc-300 shrink-0">@nam.vibes:</span>
              <span className="truncate text-zinc-200">Chắc chắn là Đêm Nay Chill Phết! 🎧</span>
            </div>
            <div className="flex items-center gap-2 bg-[#161922]/90 border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-200">
              <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[10px] font-bold shrink-0">L</span>
              <span className="font-semibold text-zinc-300 shrink-0">@linh_sound:</span>
              <span className="truncate text-zinc-200">Bài gì cũng được, miễn nghe với ai đó 💬</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Góc chill riêng cho hội bạn',
      description: 'Vừa nghe chung một playlist nhạc, vừa nhắn tin và gọi nhóm không bị làm phiền.',
      preview: (
        /* UI Preview Card: Phòng Nghe Nhạc & Chat Nhóm */
        <div className="w-[305px] sm:w-[330px] rounded-2xl bg-[#161922] border border-white/10 p-3.5 shadow-2xl shadow-indigo-500/10 text-left">
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-white/5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-800 flex items-center justify-center text-white shrink-0 shadow-md">
              <Music size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">Lofi Chill & Midnight Rain</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="flex items-center gap-0.5 h-2.5">
                  <span className="w-0.5 h-2 bg-emerald-400 rounded animate-pulse" />
                  <span className="w-0.5 h-3 bg-emerald-400 rounded animate-pulse [animation-delay:0.2s]" />
                  <span className="w-0.5 h-1.5 bg-emerald-400 rounded animate-pulse [animation-delay:0.4s]" />
                </span>
                <span className="text-[10px] text-zinc-400">Đang phát trong phòng</span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">1:42</span>
          </div>

          <div className="py-2 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center -space-x-1.5">
              {['M', 'K', 'T', 'H'].map((letter, i) => (
                <div 
                  key={i} 
                  className="w-6 h-6 rounded-full border-2 border-[#161922] bg-gradient-to-tr from-zinc-700 to-zinc-800 text-white flex items-center justify-center text-[9px] font-bold"
                >
                  {letter}
                </div>
              ))}
              <div className="w-6 h-6 rounded-full border-2 border-[#161922] bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[8px] font-bold">
                +6
              </div>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              10 bạn đang online
            </span>
          </div>

          <div className="pt-2 space-y-1">
            <p className="text-[11px] text-zinc-300 truncate">
              <strong className="text-indigo-400 font-semibold">@tuan:</strong> Nhạc này cuốn thật sự 🔥
            </p>
            <p className="text-[11px] text-zinc-300 truncate">
              <strong className="text-violet-400 font-semibold">@mai:</strong> Mọi người bật mic lên buôn chuyện đi nào!
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div
      className={`fixed inset-0 z-[100000] bg-[#0B0D12] text-[#F8FAFC] flex flex-col justify-between select-none overflow-hidden transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))'
      }}
    >
      {/* ============================================================== */}
      {/* CHẾ ĐỘ 1: APP INTRO / SPLASH SCREEN 1.2S (TỪ LẦN THỨ 2 TRỞ ĐI)  */}
      {/* ============================================================== */}
      {mode === 'splash' && (
        <div className="flex-1 flex flex-col items-center justify-center relative animate-in fade-in duration-300 px-6">
          {/* Vòng sóng âm tỏa tròn mượt mà */}
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute w-44 h-44 rounded-full border border-indigo-500/20 animate-ping [animation-duration:2s]" />
            <div className="absolute w-32 h-32 rounded-full border border-violet-500/30 animate-pulse [animation-duration:1.5s]" />
            <div className="absolute w-20 h-20 rounded-full bg-indigo-500/25 blur-xl" />

            {/* Logo Talovin Monogram */}
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-2xl shadow-indigo-500/40 border border-white/20">
              <span className="text-2xl font-black tracking-tight text-white font-sans">T</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            Talovin
          </h1>
          
          {/* Thanh sóng âm thanh mini sinh động ở chính giữa */}
          <div className="mt-3 flex items-center gap-1 h-5">
            {[6, 12, 18, 14, 20, 15, 10, 16, 8].map((h, i) => (
              <span
                key={i}
                className="w-1 bg-gradient-to-t from-[#6366F1] to-[#8B5CF6] rounded-full"
                style={{
                  height: `${h}px`,
                  animation: 'soundwavePulse 0.9s ease-in-out infinite alternate',
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CHẾ ĐỘ 2: 3 SLIDE ONBOARDING (CHỈ HIỂN THỊ LẦN ĐẦU TIÊN)       */}
      {/* ============================================================== */}
      {mode === 'onboarding' && (
        <>
          {/* Header với nút Bỏ qua */}
          <header className="px-6 py-2 flex items-center justify-between shrink-0">
            <TalovinLogo size={24} showText={true} />
            <button
              type="button"
              onClick={handleFinishOnboarding}
              className="text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            >
              Bỏ qua
            </button>
          </header>

          {/* Vùng vuốt trượt ngang các Slide */}
          <main
            className="flex-1 flex flex-col justify-center items-center px-6 relative overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {slides.map((slide, idx) => {
              const isCurrent = idx === currentSlide;

              return (
                <div
                  key={idx}
                  className={`absolute inset-x-6 flex flex-col items-center text-center transition-all duration-300 ease-out ${
                    isCurrent
                      ? 'opacity-100 translate-x-0 pointer-events-auto'
                      : idx < currentSlide
                      ? 'opacity-0 -translate-x-16 pointer-events-none'
                      : 'opacity-0 translate-x-16 pointer-events-none'
                  }`}
                >
                  {/* UI Preview Card thu nhỏ bo góc tinh tế */}
                  <div className="mb-7 flex items-center justify-center">
                    {slide.preview}
                  </div>

                  {/* Tiêu đề tự nhiên */}
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F8FAFC] font-sans max-w-xs mb-2">
                    {slide.title}
                  </h2>

                  {/* Mô tả đời thường */}
                  <p className="text-sm text-zinc-400 leading-relaxed max-w-xs sm:max-w-sm">
                    {slide.description}
                  </p>
                </div>
              );
            })}
          </main>

          {/* Footer cố định vị trí: Pagination Dots & Action Buttons */}
          <footer className="px-6 pt-2 pb-2 flex flex-col gap-4 shrink-0">
            {/* Pagination Dots (Co giãn mượt theo slide) */}
            <div className="flex items-center justify-center gap-1.5">
              {[0, 1, 2].map((idx) => {
                const isActive = idx === currentSlide;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'w-7 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] shadow-md shadow-indigo-500/30'
                        : 'w-1.5 bg-zinc-700/80 hover:bg-zinc-600'
                    }`}
                    title={`Slide ${idx + 1}`}
                  />
                );
              })}
            </div>

            {/* Action Buttons - Giữ chiều cao cố định h-12 không nhảy layout */}
            <div className="w-full h-12">
              {currentSlide === 2 ? (
                <button
                  type="button"
                  onClick={handleFinishOnboarding}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-semibold text-sm flex items-center justify-center shadow-xl shadow-indigo-500/30 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Vào Talovin
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full h-12 rounded-2xl bg-[#161922] hover:bg-zinc-800 text-white font-semibold text-sm flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 active:scale-[0.98] transition-all cursor-pointer shadow-lg"
                >
                  <span>Tiếp tục</span>
                  <ArrowRight size={17} strokeWidth={1.75} />
                </button>
              )}
            </div>
          </footer>
        </>
      )}
    </div>
  );
};

export default OnboardingIntro;
