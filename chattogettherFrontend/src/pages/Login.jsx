import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Lock, Eye, EyeOff, AlertCircle, Loader2, 
  ArrowRight, Sparkles, Mic, Music, Volume2 
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import TalovinLogo from '../components/TalovinLogo';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// 16 thanh Audio Visualizer chuẩn cho hiệu ứng âm thanh sống động
const AUDIO_BAR_HEIGHTS = [12, 22, 32, 16, 36, 26, 14, 30, 20, 28, 10, 24, 34, 18, 22, 12];

// Helper giải mã & kiểm tra JWT token còn hạn sử dụng
const isTokenValid = (token) => {
  if (!token || typeof token !== 'string') return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

const Login = () => {
  const { updateCurrentUser, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Trạng thái màn hình Intro điện ảnh
  const [showIntro, setShowIntro] = useState(true);
  const [introFading, setIntroFading] = useState(false);
  const [hasValidToken, setHasValidToken] = useState(false);

  // Trạng thái Form Đăng nhập / Đăng ký
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({ account: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slowMessage, setSlowMessage] = useState(false);

  const elapsedTimerRef = useRef(null);

  // Khởi động kiểm tra token & điều phối luồng Intro (khoảng 2.6s)
  useEffect(() => {
    const token = localStorage.getItem('accesstoken');
    const valid = isTokenValid(token);
    setHasValidToken(valid);

    // Kích hoạt ping làm ấm máy chủ ngay khi vào trang
    axiosClient.get('/ping').catch(() => {});

    // Thời gian hiển thị đoạn giới thiệu điện ảnh (2.6 giây)
    const introTimer = setTimeout(() => {
      if (valid) {
        // Token còn hạn -> Vào thẳng Sảnh chính, không bắt login lại
        setIntroFading(true);
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 350);
      } else {
        // Chưa đăng nhập hoặc token đã hết hạn -> Hiện Form Login
        if (token) {
          localStorage.removeItem('accesstoken');
          localStorage.removeItem('refreshToken');
        }
        setIntroFading(true);
        setTimeout(() => {
          setShowIntro(false);
        }, 350);
      }
    }, 2600);

    return () => clearTimeout(introTimer);
  }, [navigate]);

  // Bỏ qua intro ngay lập tức khi bấm nút "Vào ngay"
  const handleSkipIntro = () => {
    const token = localStorage.getItem('accesstoken');
    const valid = isTokenValid(token);
    if (valid) {
      navigate('/', { replace: true });
    } else {
      if (token) {
        localStorage.removeItem('accesstoken');
        localStorage.removeItem('refreshToken');
      }
      setShowIntro(false);
    }
  };

  // Xử lý gửi Form Đăng nhập / Đăng ký
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.account.trim() || !formData.password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setError('');
    setSubmitting(true);
    setSlowMessage(false);

    const timer = setTimeout(() => {
      setSlowMessage(true);
    }, 2500);

    try {
      if (isRegisterMode) {
        // Luồng Đăng ký tài khoản mới
        const res = await axiosClient.post('/users/create', {
          account: formData.account.trim(),
          password: formData.password
        });
        clearTimeout(timer);

        if (res.status === 200) {
          toast.success('Đăng ký thành công! Hãy đăng nhập để vào Sảnh.');
          setIsRegisterMode(false);
        }
      } else {
        // Luồng Đăng nhập
        const response = await axiosClient.post('/auth/login', {
          account: formData.account.trim(),
          password: formData.password
        });

        clearTimeout(timer);
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

        if (response.status === 200) {
          const { token, refreshToken } = response.data.data;
          localStorage.setItem('accesstoken', token);
          if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
          }

          localStorage.setItem('talovin_intro_seen', 'true');
          localStorage.setItem('talovin_has_seen_onboarding', 'true');
          localStorage.setItem('talovin_welcome_seen', 'true');
          localStorage.removeItem('talovin_cached_posts');
          localStorage.removeItem('hasCheckedActiveRoom');
          sessionStorage.removeItem('talovin_active_room_session');
          localStorage.removeItem('talovin_active_room_session');

          try {
            const payloadBase64 = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(payloadBase64));
            const userId = decodedPayload.user_id;
            const userAccount = decodedPayload.sub || formData.account.trim();

            if (userId) localStorage.setItem('user_id', userId);
            if (userAccount) {
              localStorage.setItem('account', userAccount);
              localStorage.setItem('username', userAccount);
              localStorage.setItem('nickname', userAccount);
            }
            if (userId || userAccount) {
              updateCurrentUser({
                id: userId,
                account: userAccount,
                username: userAccount,
                nickname: userAccount
              });
              refreshProfile().catch(() => {});
            }
          } catch (_) {}

          sessionStorage.setItem('hasCheckedActiveRoom', 'true');
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        if (status === 401 || status === 400) {
          setError(isRegisterMode ? (err.response.data?.message || 'Tài khoản đã tồn tại!') : 'Tài khoản hoặc mật khẩu không chính xác!');
        } else if (status === 404) {
          setError('Tài khoản không tồn tại trên hệ thống!');
        } else if (status === 429) {
          setError(err.response.data?.message || 'Bạn đang thao tác quá nhanh. Vui lòng đợi 30 giây rồi thử lại!');
        } else {
          setError(err.response.data?.message || 'Đã có lỗi xảy ra trong quá trình xác thực!');
        }
      } else {
        setError('Máy chủ đang khởi động từ chế độ ngủ. Vui lòng đợi khoảng 30 - 45 giây rồi thử lại!');
      }
    } finally {
      clearTimeout(timer);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setSubmitting(false);
      setSlowMessage(false);
    }
  };

  // =========================================================================
  // 1. MÀN HÌNH CINEMATIC INTRO (THẬP SÁNG XẸT QUA -> LOGO BỪNG SÁNG -> TEXT GIỚI THIỆU)
  // =========================================================================
  if (showIntro) {
    return (
      <div 
        className={`min-h-[100dvh] w-full bg-[#08090C] text-[#F4F4F5] flex flex-col items-center justify-center relative overflow-hidden select-none font-sans transition-all duration-350 ease-out ${
          introFading ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
        }`}
      >
        {/* Nguồn sáng khuếch tán nền cực dịu */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 55% at 50% 48%, rgba(99, 102, 241, 0.08), rgba(255, 255, 255, 0.02), transparent)'
          }}
        />

        {/* Nút bỏ qua nhanh ở góc trên bên phải */}
        <button
          type="button"
          onClick={handleSkipIntro}
          className="absolute top-5 right-5 sm:top-7 sm:right-7 z-40 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.16] text-xs text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
        >
          <span>{hasValidToken ? 'Vào sảnh' : 'Vào ngay'}</span>
          <ArrowRight size={13} strokeWidth={2} />
        </button>

        {/* ------------------------------------------------------------- */}
        {/* HIỆU ỨNG TIA SÁNG CHỮ THẬP XẸT QUA MÀN HÌNH (CROSS LASER SLICE) */}
        {/* ------------------------------------------------------------- */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center z-10">
          {/* Tia sáng 1: Chém xiên góc -22 độ từ trái qua phải */}
          <div className="absolute w-[220%] h-[2px] bg-gradient-to-r from-transparent via-white via-indigo-300 to-transparent shadow-[0_0_24px_rgba(255,255,255,0.9),0_0_50px_rgba(99,102,241,0.6)] animate-laser-slice-1" />

          {/* Tia sáng 2: Chém xiên góc 22 độ tạo hình chữ thập cắt ngang tâm */}
          <div className="absolute w-[220%] h-[2px] bg-gradient-to-r from-transparent via-white via-emerald-300 to-transparent shadow-[0_0_24px_rgba(255,255,255,0.9),0_0_50px_rgba(16,185,129,0.5)] animate-laser-slice-2" />

          {/* Bùng sáng tâm điểm tại vị trí 2 tia giao nhau (Epicenter Flash) */}
          <div className="absolute w-52 h-52 rounded-full bg-radial from-white/40 via-indigo-400/20 to-transparent blur-xl animate-center-burst" />

          {/* Vòng sóng chấn lan tỏa nhẹ từ tâm */}
          <div className="absolute w-28 h-28 rounded-full border border-white/30 animate-shockwave" />
          <div className="absolute w-56 h-56 rounded-full border border-white/15 animate-shockwave-delay" />
        </div>

        {/* ------------------------------------------------------------- */}
        {/* KHỐI TRUNG TÂM: LOGO TALOVIN & NỘI DUNG GIỚI THIỆU NỀN TẢNG */}
        {/* ------------------------------------------------------------- */}
        <div className="relative z-20 flex flex-col items-center text-center px-6 max-w-lg mx-auto">
          
          {/* 1. KHỐI LOGO HIỆN LÊN SAU KHI TIA SÁNG XẸT QUA */}
          <div className="relative mb-6 animate-logo-emergence">
            {/* Hào quang nền của logo */}
            <div className="absolute -inset-4 rounded-3xl bg-white/[0.04] blur-xl" />
            
            {/* Khung chứa Squircle cao cấp chuẩn Arc / Raycast */}
            <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-3xl bg-[#11131A] border border-white/[0.18] shadow-[0_16px_48px_rgba(0,0,0,0.8),0_0_50px_rgba(255,255,255,0.08)] flex items-center justify-center">
              <TalovinLogo size={42} showText={false} />
            </div>
          </div>

          {/* 2. CHỮ TALOVIN & HIỆU ỨNG GIỚI THIỆU NỀN TẢNG */}
          <div className="flex flex-col items-center animate-text-reveal">
            
            {/* Badge phân loại */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] shadow-sm mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono font-medium text-zinc-300 tracking-wider uppercase">
                Social Lounge & Audio Space
              </span>
            </div>

            {/* Tên thương hiệu lớn */}
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-[0.18em] uppercase font-sans mb-3 drop-shadow-sm">
              Talovin
            </h1>

            {/* Slogan & Câu giới thiệu nền tảng */}
            <p className="text-sm sm:text-base text-zinc-200 font-medium max-w-md leading-snug mb-2 font-sans">
              Không gian kết nối âm thanh & khoảnh khắc sống động
            </p>
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed mb-6 font-sans">
              Bắt đúng tần số · Trò chuyện trực tiếp · Lắng nghe cùng nhau
            </p>

            {/* SÓNG ÂM THANH EQUALIZER VISUALIZER NHẢY SỐNG ĐỘNG */}
            <div className="flex items-center justify-center gap-1.5 h-8 my-1" aria-hidden="true">
              {AUDIO_BAR_HEIGHTS.map((h, i) => (
                <span
                  key={i}
                  className="w-[2.5px] rounded-full bg-gradient-to-t from-white/30 via-white/80 to-white"
                  style={{
                    height: `${h}px`,
                    animation: 'talovinIntroWave 1.2s ease-in-out infinite',
                    animationDelay: `${(i * 0.07).toFixed(2)}s`
                  }}
                />
              ))}
            </div>

            {/* Dòng trạng thái điều hướng */}
            <p className="text-[11px] text-zinc-500 font-mono tracking-wider mt-5">
              {hasValidToken ? 'Đang kết nối vào Sảnh trực tuyến...' : 'Đang chuẩn bị không gian trò chuyện...'}
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CSS KEYFRAMES CHO TIA SÁNG, FLASH & CHUYỂN ĐỘNG INTRO */}
        {/* ------------------------------------------------------------- */}
        <style>{`
          /* Tia sáng 1 chém xiên góc -22 độ */
          @keyframes laserSlice1 {
            0% {
              transform: translate3d(-140%, -80%, 0) rotate(-22deg);
              opacity: 0;
            }
            15% {
              opacity: 1;
            }
            65% {
              opacity: 1;
            }
            100% {
              transform: translate3d(140%, 80%, 0) rotate(-22deg);
              opacity: 0;
            }
          }

          /* Tia sáng 2 chém xiên góc 22 độ tạo hình thập xẹt qua */
          @keyframes laserSlice2 {
            0% {
              transform: translate3d(-140%, 80%, 0) rotate(22deg);
              opacity: 0;
            }
            15% {
              opacity: 1;
            }
            65% {
              opacity: 1;
            }
            100% {
              transform: translate3d(140%, -80%, 0) rotate(22deg);
              opacity: 0;
            }
          }

          /* Bùng sáng tại tâm điểm giao nhau */
          @keyframes centerBurst {
            0% {
              transform: scale(0.2);
              opacity: 0;
            }
            35% {
              transform: scale(1.3);
              opacity: 0.9;
            }
            60% {
              transform: scale(1);
              opacity: 0.45;
            }
            100% {
              transform: scale(0.8);
              opacity: 0.15;
            }
          }

          /* Vòng sóng chấn lan tỏa từ tâm */
          @keyframes shockwave {
            0% {
              transform: scale(0.4);
              opacity: 0.8;
            }
            100% {
              transform: scale(2.2);
              opacity: 0;
            }
          }

          /* Logo xuất hiện sau tia sáng (0.45s) */
          @keyframes logoEmergence {
            0% {
              transform: scale(0.7) translateY(10px);
              opacity: 0;
              filter: blur(8px) brightness(1.6);
            }
            60% {
              transform: scale(1.04) translateY(-2px);
              opacity: 1;
              filter: blur(0px) brightness(1.2);
            }
            100% {
              transform: scale(1) translateY(0);
              opacity: 1;
              filter: blur(0px) brightness(1);
            }
          }

          /* Nội dung text giới thiệu xuất hiện mượt mà (0.8s) */
          @keyframes textReveal {
            0% {
              transform: translateY(14px);
              opacity: 0;
            }
            100% {
              transform: translateY(0);
              opacity: 1;
            }
          }

          /* Sóng âm thanh nhảy nhẹ */
          @keyframes talovinIntroWave {
            0%, 100% {
              transform: scaleY(0.35);
              opacity: 0.4;
            }
            50% {
              transform: scaleY(1);
              opacity: 0.95;
            }
          }

          .animate-laser-slice-1 {
            animation: laserSlice1 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .animate-laser-slice-2 {
            animation: laserSlice2 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.08s forwards;
          }
          .animate-center-burst {
            animation: centerBurst 1s ease-out 0.25s forwards;
          }
          .animate-shockwave {
            animation: shockwave 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
          }
          .animate-shockwave-delay {
            animation: shockwave 1.3s cubic-bezier(0.16, 1, 0.3, 1) 0.45s forwards;
          }
          .animate-logo-emergence {
            animation: logoEmergence 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both;
          }
          .animate-text-reveal {
            animation: textReveal 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.75s both;
          }
        `}</style>
      </div>
    );
  }

  // =========================================================================
  // 2. FORM ĐĂNG NHẬP / ĐĂNG KÝ: MODERN DARK CRAFT (ARC / RAYCAST STYLE)
  // =========================================================================
  return (
    <div className="min-h-[100dvh] w-full bg-[#08090C] text-[#F4F4F5] flex flex-col justify-center items-center px-4 py-8 select-none relative overflow-hidden font-sans animate-in fade-in duration-400">
      {/* 1. Nguồn sáng khuếch tán cực dịu từ đỉnh màn hình xuống */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,255,255,0.06), transparent)'
        }}
      />

      {/* 2. Khối thẻ trung tâm (w-full max-w-[420px]) có chiều sâu vật lý */}
      <div className="w-full max-w-[420px] bg-[#11131A] rounded-2xl border-t border-white/[0.14] border-x border-b border-white/[0.06] shadow-[0_24px_64px_rgba(0,0,0,0.75)] p-6 sm:p-8 relative z-10 animate-in zoom-in-95 duration-300">
        
        {/* Phần đầu thẻ: Logo Talovin + Status Pill "Sảnh đang mở" */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <TalovinLogo size={30} showText={true} />
          </div>

          {/* Viên thuốc trạng thái nhịp nhẹ */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium tracking-tight">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sảnh đang mở</span>
          </div>
        </div>

        {/* AUDIO VISUALIZER: 16 thanh dọc màu trắng mờ đóng vai trò đường phân cách nghệ thuật */}
        <div className="flex items-center justify-center gap-1.5 h-7 my-3 select-none" aria-hidden="true">
          {AUDIO_BAR_HEIGHTS.map((height, i) => (
            <span
              key={i}
              className="w-[2.5px] rounded-full bg-white/40"
              style={{
                height: `${height}px`,
                animation: 'talovinWave 1.4s ease-in-out infinite',
                animationDelay: `${(i * 0.08).toFixed(2)}s`
              }}
            />
          ))}
        </div>

        {/* Dòng giới thiệu */}
        <p className="text-[13px] text-zinc-400 text-center font-normal leading-relaxed mb-6">
          Trò chuyện, gửi voice 5s và nghe nhạc cùng nhau.
        </p>

        {/* Thông báo lỗi nếu có */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-300 text-xs leading-relaxed">
            <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        {/* Form Đăng nhập / Đăng ký */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ô nhập Tài khoản */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-zinc-400">
              Tài khoản
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-zinc-500 pointer-events-none">
                <User size={16} strokeWidth={1.75} />
              </div>
              <input
                type="text"
                name="account"
                autoComplete="username"
                required
                placeholder="Nhập tên tài khoản"
                value={formData.account}
                onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                className="w-full h-11 pl-10 pr-3.5 bg-[#090A0E] border border-white/[0.08] hover:border-white/[0.14] focus:border-white/30 focus:ring-1 focus:ring-white/20 rounded-xl text-sm text-[#F4F4F5] placeholder-zinc-600 outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Ô nhập Mật khẩu */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-zinc-400">
              Mật khẩu
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-zinc-500 pointer-events-none">
                <Lock size={16} strokeWidth={1.75} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete={isRegisterMode ? "new-password" : "current-password"}
                required
                placeholder="Nhập mật khẩu"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full h-11 pl-10 pr-10 bg-[#090A0E] border border-white/[0.08] hover:border-white/[0.14] focus:border-white/30 focus:ring-1 focus:ring-white/20 rounded-xl text-sm text-[#F4F4F5] placeholder-zinc-600 outline-none transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          {/* Thông báo đánh thức máy chủ */}
          {slowMessage && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-[11px] leading-relaxed">
              Máy chủ đang được đánh thức, vui lòng giữ trang trong giây lát...
            </div>
          )}

          {/* Nút bấm chính */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 mt-2 rounded-xl bg-[#F4F4F5] hover:bg-white text-[#09090B] font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin text-[#09090B]" strokeWidth={2} />
                <span>{isRegisterMode ? 'Đang tạo tài khoản...' : 'Đang vào Sảnh...'}</span>
              </>
            ) : (
              <span>{isRegisterMode ? 'Tạo tài khoản và vào Sảnh' : 'Tiếp tục vào Sảnh'}</span>
            )}
          </button>
        </form>

        {/* Đường phân cách mảnh */}
        <div className="relative flex items-center justify-center my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/[0.06]" />
          </div>
          <span className="relative px-3 bg-[#11131A] text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
            hoặc
          </span>
        </div>

        {/* Nút chuyển đổi Đăng nhập / Đăng ký */}
        <button
          type="button"
          onClick={() => {
            setIsRegisterMode(!isRegisterMode);
            setError('');
          }}
          className="w-full h-10 rounded-xl bg-transparent hover:bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-center"
        >
          {isRegisterMode ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Tạo tài khoản mới'}
        </button>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-[11px] text-zinc-600 font-mono tracking-tight relative z-10">
        Talovin · Social Lounge & Real-time Audio
      </div>

      <style>{`
        @keyframes talovinWave {
          0%, 100% { transform: scaleY(0.4); opacity: 0.35; }
          50% { transform: scaleY(1); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
};

export default Login;
