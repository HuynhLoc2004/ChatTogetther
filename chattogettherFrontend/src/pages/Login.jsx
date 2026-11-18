import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import TalovinLogo from '../components/TalovinLogo';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// Chiều cao chuẩn 16 thanh Audio Visualizer
const AUDIO_BAR_HEIGHTS = [10, 18, 26, 14, 30, 22, 12, 28, 16, 24, 8, 20, 28, 14, 18, 10];

const Login = () => {
  const { updateCurrentUser, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({ account: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slowMessage, setSlowMessage] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const elapsedTimerRef = useRef(null);

  // Splash Screen khi đã có token đăng nhập hợp lệ: hiển thị tinh gọn 0.8s rồi chuyển vào Sảnh
  useEffect(() => {
    const token = localStorage.getItem('accesstoken');
    if (token) {
      setIsRedirecting(true);
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 850);
      return () => clearTimeout(timer);
    }
  }, [navigate]);

  // Làm ấm máy chủ ngay khi mở màn hình
  useEffect(() => {
    axiosClient.get('/ping').catch(() => {});
  }, []);

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

  // MÀN HÌNH SPLASH SCREEN KHI ĐÃ ĐĂNG NHẬP
  if (isRedirecting) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#08090C] text-[#F4F4F5] flex flex-col justify-center items-center select-none relative overflow-hidden">
        {/* Nguồn sáng khuếch tán từ đỉnh */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,255,255,0.06), transparent)'
          }}
        />

        <div className="flex flex-col items-center gap-4 relative z-10 animate-fade-in">
          <TalovinLogo size={36} showText={true} />

          {/* Sóng âm thanh mini */}
          <div className="flex items-center gap-1.5 h-6 my-1" aria-hidden="true">
            {[10, 16, 22, 12, 24, 18, 10, 20].map((h, i) => (
              <span
                key={i}
                className="w-[2.5px] rounded-full bg-white/70"
                style={{
                  height: `${h}px`,
                  animation: 'talovinWave 1.2s ease-in-out infinite',
                  animationDelay: `${(i * 0.1).toFixed(2)}s`
                }}
              />
            ))}
          </div>

          <p className="text-xs text-zinc-500 font-mono tracking-wide">Đang vào Sảnh trực tuyến...</p>
        </div>

        <style>{`
          @keyframes talovinWave {
            0%, 100% { transform: scaleY(0.4); opacity: 0.35; }
            50% { transform: scaleY(1); opacity: 0.9; }
          }
        `}</style>
      </div>
    );
  }

  // GIAO DIỆN CHÍNH: MODERN DARK CRAFT (ARC BROWSER / RAYCAST STYLE)
  return (
    <div className="min-h-[100dvh] w-full bg-[#08090C] text-[#F4F4F5] flex flex-col justify-center items-center px-4 py-8 select-none relative overflow-hidden">
      {/* 1. NGUỒN SÁNG KHUẾCH TÁN CỰC DỊU TỪ ĐỈNH MÀN HÌNH XUỐNG */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,255,255,0.06), transparent)'
        }}
      />

      {/* 2. KHỐI THẺ TRUNG TÂM (w-full max-w-[420px]) CÓ CHIỀU SÂU VẬT LÝ */}
      <div className="w-full max-w-[420px] bg-[#11131A] rounded-2xl border-t border-white/[0.14] border-x border-b border-white/[0.06] shadow-[0_24px_64px_rgba(0,0,0,0.75)] p-6 sm:p-8 relative z-10">
        
        {/* PHẦN ĐẦU THẺ: Logo Talovin + Status Pill "Sảnh đang mở" */}
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

        {/* DÒNG GIỚI THIỆU DUY NHẤT */}
        <p className="text-[13px] text-zinc-400 text-center font-normal leading-relaxed mb-6">
          Trò chuyện, gửi voice 5s và nghe nhạc cùng nhau.
        </p>

        {/* THÔNG BÁO LỖI (NẾU CÓ) */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-300 text-xs leading-relaxed">
            <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        {/* 3. FORM ĐĂNG NHẬP / ĐĂNG KÝ SẮC NÉT, ĐỘ TƯƠNG PHẢN CAO */}
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

          {/* Thông báo đánh thức máy chủ Render */}
          {slowMessage && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-[11px] leading-relaxed">
              Máy chủ đang được đánh thức, vui lòng giữ trang trong giây lát...
            </div>
          )}

          {/* Nút bấm chính ("Tiếp tục vào Sảnh") */}
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

        {/* Đường phân cách mảnh với chữ "hoặc" */}
        <div className="relative flex items-center justify-center my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/[0.06]" />
          </div>
          <span className="relative px-3 bg-[#11131A] text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
            hoặc
          </span>
        </div>

        {/* Nút chuyển đổi qua lại giữa Đăng nhập / Tạo tài khoản mới */}
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

      {/* FOOTER TINH TẾ */}
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
