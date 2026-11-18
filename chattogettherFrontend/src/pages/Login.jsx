import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Lock, Eye, EyeOff, AlertCircle, Loader2, 
  ArrowRight, Sparkles, Mic, Music 
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import TalovinLogo from '../components/TalovinLogo';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// 16 thanh Audio Visualizer chuẩn cho hiệu ứng âm thanh trên form đăng nhập
const AUDIO_BAR_HEIGHTS = [10, 18, 26, 14, 30, 22, 12, 28, 16, 24, 8, 20, 28, 14, 18, 10];

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

  // Kiểm tra cờ xem màn hình Welcome Intro lần đầu
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() => {
    return localStorage.getItem('talovin_welcome_seen') === 'true';
  });
  const [isExitingWelcome, setIsExitingWelcome] = useState(false);

  // Trạng thái Form Đăng nhập / Đăng ký
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({ account: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slowMessage, setSlowMessage] = useState(false);

  const elapsedTimerRef = useRef(null);

  // Tự động vào Sảnh chính nếu token còn hạn
  useEffect(() => {
    const token = localStorage.getItem('accesstoken');
    if (token && isTokenValid(token)) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // Làm ấm máy chủ ngay khi mở màn hình
  useEffect(() => {
    axiosClient.get('/ping').catch(() => {});
  }, []);

  // Chuyển mượt 350ms từ Welcome Intro sang Form Đăng nhập / Đăng ký
  const handleEnterApp = (forRegister = false) => {
    if (isExitingWelcome) return;
    setIsExitingWelcome(true);
    setTimeout(() => {
      localStorage.setItem('talovin_welcome_seen', 'true');
      setIsRegisterMode(forRegister);
      setHasSeenWelcome(true);
      setIsExitingWelcome(false);
    }, 350);
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
  // 1. MÀN HÌNH WELCOME INTRO: CỤM 3 THẺ KÍNH MỜ XẾP CHỒNG NGHỆ THUẬT & ÁNH SÁNG ẤM
  // =========================================================================
  if (!hasSeenWelcome) {
    return (
      <div 
        className={`min-h-[100dvh] w-full bg-[#08090C] text-[#F4F4F5] flex items-center justify-center relative overflow-hidden select-none font-sans transition-all duration-350 ease-out ${
          isExitingWelcome ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
        }`}
      >
        {/* Nguồn sáng khuếch tán nền cực dịu từ đỉnh */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(99, 102, 241, 0.08), rgba(255, 255, 255, 0.02), transparent)'
          }}
        />

        {/* ------------------------------------------------------------- */}
        {/* A. BỐ CỤC LAPTOP / DESKTOP (>= 1024px): 2 CỘT CÂN ĐỐI GẮN KẾT */}
        {/* ------------------------------------------------------------- */}
        <div className="hidden lg:grid grid-cols-2 gap-16 items-center w-full max-w-5xl mx-auto px-8 py-12 relative z-10">
          
          {/* CỘT TRÁI: TIÊU ĐỀ, MÔ TẢ & CỤM 2 NÚT HÀNH ĐỘNG */}
          <div className="flex flex-col items-start text-left">
            {/* Tiêu đề chính lớn */}
            <h1 className="text-4xl lg:text-[44px] font-bold text-white tracking-tight leading-[1.2] mb-4 font-sans">
              Bắt đúng tần số.<br />
              Chuyện gì cũng dễ mở lời.
            </h1>

            {/* Mô tả tiếng Việt súc tích */}
            <p className="text-[15px] text-zinc-400 leading-relaxed max-w-md mb-8 font-sans">
              Gửi nhanh đoạn voice 5 giây, nghe chung một giai điệu và trò chuyện cùng hội bạn.
            </p>

            {/* Cụm 2 nút hành động nằm ngang gọn gàng */}
            <div className="flex items-center gap-5 flex-wrap">
              <button
                type="button"
                onClick={() => handleEnterApp(true)}
                className="h-12 px-8 rounded-full bg-[#F4F4F5] hover:bg-white text-[#090A0F] font-semibold text-sm shadow-[0_4px_24px_rgba(255,255,255,0.15)] hover:shadow-[0_6px_30px_rgba(255,255,255,0.25)] transition-all active:scale-[0.98] cursor-pointer flex items-center gap-2.5"
              >
                <span>Bắt đầu khám phá</span>
                <ArrowRight size={16} strokeWidth={2} />
              </button>

              <button
                type="button"
                onClick={() => handleEnterApp(false)}
                className="text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer py-2"
              >
                Tôi đã có tài khoản? <span className="text-zinc-200 underline underline-offset-4 font-medium">Đăng nhập</span>
              </button>
            </div>
          </div>

          {/* CỘT PHẢI: CỤM 3 THẺ KÍNH MỜ XẾP CHỒNG NGHỆ THUẬT (STACKED GLASS CARDS) */}
          <div className="relative w-full h-[360px] flex items-center justify-center select-none">
            
            {/* Nguồn sáng khuếch tán mềm mại phía sau cụm thẻ (w-300 h-300 blur-90px) */}
            <div className="absolute w-[320px] h-[320px] rounded-full bg-indigo-500/15 blur-[90px] pointer-events-none -z-0" />

            {/* Khối khung cụm thẻ */}
            <div className="relative w-[320px] h-[250px] flex items-center justify-center">
              
              {/* THẺ 1: THẺ SAU CÙNG (NGHIÊNG NHẸ TRÁI -rotate-3, THANH NHẠC) */}
              <div className="absolute -top-6 -left-5 w-[300px] p-3.5 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.09] shadow-[0_16px_40px_rgba(0,0,0,0.55)] -rotate-3 z-10 animate-gentle-breathe-1 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                      <Music size={14} strokeWidth={2} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-zinc-400 font-medium">Đang phát chung</span>
                      <span className="text-xs font-semibold text-zinc-200 truncate max-w-[150px]">Sunset Coffee Vibe</span>
                    </div>
                  </div>

                  {/* 3 cột sóng nhạc đang nhảy nhẹ */}
                  <div className="flex items-center gap-1 h-4 pr-1" aria-hidden="true">
                    <span className="w-1 h-3 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="w-1 h-4 rounded-full bg-indigo-400 animate-pulse delay-75" />
                    <span className="w-1 h-2 rounded-full bg-indigo-400 animate-pulse delay-150" />
                  </div>
                </div>
              </div>

              {/* THẺ 2: THẺ GIỮA (NGHIÊNG NHẸ PHẢI rotate-2, CÂU HỎI NHANH) */}
              <div className="absolute top-12 -right-5 w-[300px] p-3.5 rounded-2xl bg-white/[0.05] backdrop-blur-xl border border-white/[0.11] shadow-[0_18px_45px_rgba(0,0,0,0.6)] rotate-2 z-20 animate-gentle-breathe-2 text-left">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={14} strokeWidth={2} />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-semibold text-zinc-100 leading-tight">
                      "Đêm nay ai còn thức?"
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      {/* 2 avatar nhỏ đang trả lời */}
                      <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                        <div className="w-5 h-5 rounded-full bg-emerald-600 border border-[#11131A] flex items-center justify-center text-[9px] font-bold text-white">M</div>
                        <div className="w-5 h-5 rounded-full bg-indigo-600 border border-[#11131A] flex items-center justify-center text-[9px] font-bold text-white">L</div>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">14 câu trả lời</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* THẺ 3: THẺ CHÍNH PHÍA TRƯỚC (THẲNG, NỔI BẬT NHẤT, LOGO + 18 NGƯỜI TRỰC TUYẾN + VOICE 5S) */}
              <div className="relative w-[320px] p-4 rounded-2xl bg-white/[0.07] backdrop-blur-2xl border border-white/[0.16] shadow-[0_24px_60px_rgba(0,0,0,0.7)] z-30 animate-gentle-breathe-3 text-left">
                {/* Hàng trên: Logo Talovin + Chấm xanh "18 người đang trong sảnh" (whitespace-nowrap) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TalovinLogo size={24} showText={true} />
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10.5px] font-medium whitespace-nowrap shrink-0 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="whitespace-nowrap">18 người đang trong sảnh</span>
                  </div>
                </div>

                {/* Hàng dưới: Thanh phát voice 5 giây mượt mà */}
                <div className="mt-3.5 p-2 rounded-xl bg-black/40 border border-white/[0.07] flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Mic size={13} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] text-zinc-400 font-medium">Voice tâm sự</span>
                      <div className="flex items-center gap-1 mt-0.5" aria-hidden="true">
                        <span className="w-1 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="w-1 h-3.5 rounded-full bg-emerald-400 animate-pulse delay-75" />
                        <span className="w-1 h-2 rounded-full bg-emerald-400 animate-pulse delay-150" />
                        <span className="w-1 h-3 rounded-full bg-emerald-400 animate-pulse delay-100" />
                        <span className="w-1 h-2 rounded-full bg-emerald-400 animate-pulse delay-200" />
                      </div>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 font-bold px-1.5">0:05</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* B. BỐ CỤC ĐIỆN THOẠI / MOBILE (< 1024px): BỐ CỤC DỌC GẮN KẾT */}
        {/* ------------------------------------------------------------- */}
        <div className="lg:hidden flex flex-col items-center justify-center min-h-[100dvh] w-full px-5 py-8 relative z-10 text-center">
          
          {/* NỬA TRÊN: CỤM 3 THẺ KÍNH MỜ XẾP CHỒNG NGHỆ THUẬT */}
          <div className="relative w-full max-w-[280px] h-[230px] flex items-center justify-center select-none shrink-0 mb-6">
            
            {/* Nguồn sáng khuếch tán mềm mại phía sau (w-260 h-260 blur-80px) */}
            <div className="absolute w-[260px] h-[260px] rounded-full bg-indigo-500/15 blur-[80px] pointer-events-none -z-0" />

            {/* Khung cụm thẻ */}
            <div className="relative w-[260px] h-[210px] flex items-center justify-center">
              
              {/* THẺ 1: THẺ SAU CÙNG (NGHIÊNG NHẸ TRÁI -rotate-3) */}
              <div className="absolute -top-4 -left-3 w-[240px] p-2.5 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.09] shadow-[0_14px_36px_rgba(0,0,0,0.5)] -rotate-3 z-10 animate-gentle-breathe-1 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                      <Music size={12} strokeWidth={2} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9.5px] text-zinc-400 font-medium">Đang phát chung</span>
                      <span className="text-[11px] font-semibold text-zinc-200 truncate max-w-[125px]">Sunset Coffee Vibe</span>
                    </div>
                  </div>

                  {/* 3 cột sóng nhạc */}
                  <div className="flex items-center gap-1 h-3.5 pr-1" aria-hidden="true">
                    <span className="w-1 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="w-1 h-3.5 rounded-full bg-indigo-400 animate-pulse delay-75" />
                    <span className="w-1 h-2 rounded-full bg-indigo-400 animate-pulse delay-150" />
                  </div>
                </div>
              </div>

              {/* THẺ 2: THẺ GIỮA (NGHIÊNG NHẸ PHẢI rotate-2) */}
              <div className="absolute top-9 -right-3 w-[240px] p-2.5 rounded-2xl bg-white/[0.05] backdrop-blur-xl border border-white/[0.11] shadow-[0_16px_40px_rgba(0,0,0,0.55)] rotate-2 z-20 animate-gentle-breathe-2 text-left">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={12} strokeWidth={2} />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-[11.5px] font-semibold text-zinc-100 leading-tight">
                      "Đêm nay ai còn thức?"
                    </span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                        <div className="w-4 h-4 rounded-full bg-emerald-600 border border-[#11131A] flex items-center justify-center text-[8px] font-bold text-white">M</div>
                        <div className="w-4 h-4 rounded-full bg-indigo-600 border border-[#11131A] flex items-center justify-center text-[8px] font-bold text-white">L</div>
                      </div>
                      <span className="text-[9.5px] text-zinc-400 font-mono">14 câu trả lời</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* THẺ 3: THẺ CHÍNH PHÍA TRƯỚC (THẲNG, NỔI BẬT NHẤT) */}
              <div className="relative w-[260px] p-3.5 rounded-2xl bg-white/[0.07] backdrop-blur-2xl border border-white/[0.16] shadow-[0_22px_50px_rgba(0,0,0,0.7)] z-30 animate-gentle-breathe-3 text-left">
                {/* Logo + Trạng thái trực tuyến (whitespace-nowrap) */}
                <div className="flex items-center justify-between gap-1.5">
                  <TalovinLogo size={22} showText={true} />
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-medium whitespace-nowrap shrink-0 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="whitespace-nowrap">18 người đang trong sảnh</span>
                  </div>
                </div>

                {/* Thanh voice 5s */}
                <div className="mt-3 p-1.5 rounded-xl bg-black/40 border border-white/[0.07] flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Mic size={11} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <div className="flex flex-col text-left">
                      <span className="text-[9.5px] text-zinc-400 font-medium">Voice tâm sự</span>
                      <div className="flex items-center gap-1 mt-0.5" aria-hidden="true">
                        <span className="w-1 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="w-1 h-3 rounded-full bg-emerald-400 animate-pulse delay-75" />
                        <span className="w-1 h-2 rounded-full bg-emerald-400 animate-pulse delay-150" />
                        <span className="w-1 h-2.5 rounded-full bg-emerald-400 animate-pulse delay-100" />
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold px-1">0:05</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* NỬA DƯỚI: TIÊU ĐỀ, MÔ TẢ & 2 NÚT HÀNH ĐỘNG GẮN KẾT */}
          <div className="w-full max-w-sm flex flex-col items-center text-center">
            {/* Tiêu đề chính */}
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug mb-2 font-sans">
              Bắt đúng tần số.<br />Chuyện gì cũng dễ mở lời.
            </h1>

            {/* Mô tả tiếng Việt */}
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-[320px] mb-6 font-sans">
              Gửi nhanh đoạn voice 5 giây, nghe chung một giai điệu và trò chuyện cùng hội bạn.
            </p>

            {/* Cụm nút hành động */}
            <div className="flex flex-col items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => handleEnterApp(true)}
                className="h-11 w-full max-w-[280px] rounded-full bg-[#F4F4F5] hover:bg-white text-[#090A0F] font-semibold text-sm shadow-[0_4px_24px_rgba(255,255,255,0.15)] hover:shadow-[0_6px_30px_rgba(255,255,255,0.25)] transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Bắt đầu khám phá</span>
                <ArrowRight size={15} strokeWidth={2} />
              </button>

              <button
                type="button"
                onClick={() => handleEnterApp(false)}
                className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer py-1"
              >
                Tôi đã có tài khoản? <span className="text-zinc-200 underline underline-offset-4 font-medium">Đăng nhập</span>
              </button>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CSS KEYFRAMES CHO CHUYỂN ĐỘNG NHỊP THỞ ÊM ÁI CỦA 3 THẺ KÍNH   */}
        {/* ------------------------------------------------------------- */}
        <style>{`
          @keyframes gentleBreathe1 {
            0%, 100% {
              transform: translateY(0px) rotate(-3deg);
            }
            50% {
              transform: translateY(-5px) rotate(-2deg);
            }
          }

          @keyframes gentleBreathe2 {
            0%, 100% {
              transform: translateY(0px) rotate(2deg);
            }
            50% {
              transform: translateY(-6px) rotate(2.8deg);
            }
          }

          @keyframes gentleBreathe3 {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-4px);
            }
          }

          .animate-gentle-breathe-1 {
            animation: gentleBreathe1 6s ease-in-out infinite;
          }
          .animate-gentle-breathe-2 {
            animation: gentleBreathe2 7s ease-in-out infinite 0.4s;
          }
          .animate-gentle-breathe-3 {
            animation: gentleBreathe3 8s ease-in-out infinite 0.8s;
          }
        `}</style>
      </div>
    );
  }

  // =========================================================================
  // 2. FORM ĐĂNG NHẬP / ĐĂNG KÝ: MODERN DARK CRAFT (ARC / RAYCAST STYLE)
  // =========================================================================
  return (
    <div className="min-h-[100dvh] w-full bg-[#08090C] text-[#F4F4F5] flex flex-col justify-center items-center px-4 py-8 select-none relative overflow-hidden font-sans animate-in fade-in duration-300">
      {/* 1. Nguồn sáng khuếch tán cực dịu từ đỉnh màn hình xuống */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,255,255,0.06), transparent)'
        }}
      />

      {/* 2. Khối thẻ trung tâm (w-full max-w-[420px]) có chiều sâu vật lý */}
      <div className="w-full max-w-[420px] bg-[#11131A] rounded-2xl border-t border-white/[0.14] border-x border-b border-white/[0.06] shadow-[0_24px_64px_rgba(0,0,0,0.75)] p-6 sm:p-8 relative z-10 animate-in zoom-in-95 duration-200">
        
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
