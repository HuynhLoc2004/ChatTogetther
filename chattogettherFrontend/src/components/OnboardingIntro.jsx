import React, { useState, useEffect, useRef } from 'react';
import { Radio, Sparkles, ShieldCheck, ArrowRight, Check } from 'lucide-react';

export const OnboardingIntro = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(() => {
    return !localStorage.getItem('talovin_onboarded');
  });
  const [phase, setPhase] = useState('splash'); // 'splash' | 'slides'
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  // Bước 1: Hiệu ứng Splash 1.2s
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      setPhase('slides');
    }, 1200);
    return () => clearTimeout(timer);
  }, [isVisible]);

  const handleFinish = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      localStorage.setItem('talovin_onboarded', 'true');
      setIsVisible(false);
      onComplete?.();
    }, 280);
  };

  const handleNext = () => {
    if (currentSlide < 2) {
      setCurrentSlide(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

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

  if (!isVisible) return null;

  const slides = [
    {
      badge: 'TẦN SỐ ÂM THANH',
      title: 'Trạm Sóng FM 5 Giây',
      description: 'Lắng nghe tần số cảm xúc — Kết nối qua giọng nói chân thật trước khi nhìn thấy nhau.',
      icon: Radio,
      gradient: 'from-indigo-500/20 via-violet-500/10 to-transparent',
      accentColor: '#6366F1'
    },
    {
      badge: 'TƯƠNG TÁC ĐỐI THOẠI',
      title: 'Thẻ Bài Thử Thách',
      description: 'Xóa tan sự ngại ngùng với bộ thẻ câu hỏi tương tác thú vị cùng bạn bè.',
      icon: Sparkles,
      gradient: 'from-amber-500/20 via-rose-500/10 to-transparent',
      accentColor: '#F59E0B'
    },
    {
      badge: 'BẢO MẬT & TỰ DO',
      title: 'Không Gian Riêng Tư & An Toàn',
      description: 'Chia sẻ khoảnh khắc tự do với hệ thống bảo mật dữ liệu toàn vẹn.',
      icon: ShieldCheck,
      gradient: 'from-emerald-500/20 via-indigo-500/10 to-transparent',
      accentColor: '#10B981'
    }
  ];

  return (
    <div
      className={`fixed inset-0 z-[100000] bg-[#0D0F14] text-[#F8FAFC] flex flex-col justify-between select-none overflow-hidden transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))'
      }}
    >
      {/* ============================================================== */}
      {/* GIAI ĐOẠN 1: SPLASH SCREEN 1.2S                               */}
      {/* ============================================================== */}
      {phase === 'splash' && (
        <div className="flex-1 flex flex-col items-center justify-center relative animate-in fade-in zoom-in-95 duration-500 px-6">
          {/* Sóng âm thanh tỏa tròn mượt mà (cubic-bezier) */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-48 h-48 rounded-full border border-indigo-500/20 animate-ping [animation-duration:2.4s]" />
            <div className="absolute w-36 h-36 rounded-full border border-violet-500/30 animate-pulse [animation-duration:1.8s]" />
            <div className="absolute w-24 h-24 rounded-full bg-indigo-500/20 blur-xl" />

            {/* Logo Talovin Icon */}
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-2xl shadow-indigo-500/40 border border-white/20">
              <span className="text-3xl font-black tracking-tight text-white font-sans">T</span>
            </div>
          </div>

          <h1 className="mt-8 text-2xl font-bold tracking-tight text-white font-sans">
            Talovin
          </h1>
          <p className="mt-2 text-xs text-zinc-400 font-medium tracking-wide text-center">
            Social Lounge & Sonic Frequency
          </p>
        </div>
      )}

      {/* ============================================================== */}
      {/* GIAI ĐOẠN 2: 3 SLIDE VUỐT NGANG ONBOARDING MƯỢT MÀ             */}
      {/* ============================================================== */}
      {phase === 'slides' && (
        <>
          {/* Header với nút Bỏ qua ở góc trên bên phải */}
          <header className="px-6 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold">
                T
              </div>
              <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
                Talovin
              </span>
            </div>
            <button
              type="button"
              onClick={handleFinish}
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
              const IconComp = slide.icon;

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
                  {/* Visual Graphic Card */}
                  <div className="relative mb-8 flex items-center justify-center">
                    <div className={`w-44 h-44 rounded-full bg-gradient-to-b ${slide.gradient} blur-2xl absolute`} />
                    <div className="w-28 h-28 rounded-3xl bg-[#161922] border border-white/10 flex items-center justify-center shadow-2xl relative z-10 backdrop-blur-xl">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white shadow-inner">
                        <IconComp size={30} strokeWidth={1.75} style={{ color: slide.accentColor }} />
                      </div>
                    </div>
                  </div>

                  {/* Badge */}
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-white/5 text-zinc-300 border border-white/10 mb-3">
                    {slide.badge}
                  </span>

                  {/* Title */}
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F8FAFC] font-sans max-w-xs mb-3">
                    {slide.title}
                  </h2>

                  {/* Description */}
                  <p className="text-sm text-[#94A3B8] leading-relaxed max-w-xs">
                    {slide.description}
                  </p>
                </div>
              );
            })}
          </main>

          {/* Footer: Pagination Dots & Action Buttons */}
          <footer className="px-6 pt-4 flex flex-col gap-5 shrink-0">
            {/* Pagination Dots (Co giãn mượt theo slide) */}
            <div className="flex items-center justify-center gap-2">
              {[0, 1, 2].map((idx) => {
                const isActive = idx === currentSlide;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'w-8 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] shadow-md shadow-indigo-500/30'
                        : 'w-2 bg-zinc-700/80 hover:bg-zinc-600'
                    }`}
                    title={`Slide ${idx + 1}`}
                  />
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="w-full">
              {currentSlide === 2 ? (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/30 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <span>Bắt đầu khám phá Talovin</span>
                  <Check size={18} strokeWidth={2} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full h-12 rounded-2xl bg-[#161922] hover:bg-zinc-850 text-white font-semibold text-sm flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 active:scale-[0.98] transition-all cursor-pointer shadow-lg"
                >
                  <span>Tiếp tục</span>
                  <ArrowRight size={18} strokeWidth={1.75} />
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
