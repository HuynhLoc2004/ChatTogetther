import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import TalovinLogo from '../components/TalovinLogo';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Login = () => {
  const { updateCurrentUser, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Kiểm tra cờ xem intro: chỉ chạy intro lần đầu tiên truy cập
  const [introSeen, setIntroSeen] = useState(() => {
    return localStorage.getItem('talovin_intro_seen') === 'true';
  });

  const [activeSection, setActiveSection] = useState(0);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Form states
  const [formData, setFormData] = useState({ account: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slowMessage, setSlowMessage] = useState(false);

  const containerRef = useRef(null);
  const section1Ref = useRef(null);
  const section2Ref = useRef(null);
  const section3Ref = useRef(null);
  const elapsedTimerRef = useRef(null);

  // Nếu đã có token đăng nhập hợp lệ, chuyển thẳng vào Sảnh chính
  useEffect(() => {
    const token = localStorage.getItem('accesstoken');
    if (token) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // Làm ấm máy chủ ngay khi mở màn hình
  useEffect(() => {
    axiosClient.get('/ping').catch(() => {});
  }, []);

  // Lắng nghe scroll để xác định màn hình đang hiển thị & tự động lưu cờ khi tới màn cuối
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (clientHeight <= 0) return;

    const index = Math.round(scrollTop / clientHeight);
    if (index !== activeSection && index >= 0 && index <= 2) {
      setActiveSection(index);
      if (index === 2) {
        localStorage.setItem('talovin_intro_seen', 'true');
      }
    }
  }, [activeSection]);

  // Cuộn mượt đến màn hình chỉ định
  const scrollToSection = (idx) => {
    const targetRef = idx === 0 ? section1Ref : (idx === 1 ? section2Ref : section3Ref);
    if (targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    setActiveSection(idx);
    if (idx === 2) {
      localStorage.setItem('talovin_intro_seen', 'true');
    }
  };

  // Nút "Bỏ qua": Cuộn thẳng xuống màn Đăng nhập và lưu cờ đã xem
  const handleSkip = () => {
    localStorage.setItem('talovin_intro_seen', 'true');
    scrollToSection(2);
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

          localStorage.removeItem('talovin_cached_posts');
          localStorage.removeItem('hasCheckedActiveRoom');

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

  // Giao diện Form Đăng nhập / Đăng ký dùng chung
  const renderAuthForm = () => (
    <div className="w-full max-w-[360px] mx-auto">
      {/* Header Form */}
      <div className="flex flex-col items-center text-center mb-6">
        <TalovinLogo size={36} showText={false} />
        <h2 className="text-xl sm:text-2xl font-semibold text-[#F3F4F6] tracking-tight mt-4 font-sans">
          {isRegisterMode ? 'Tạo tài khoản' : 'Đăng nhập'}
        </h2>
        <p className="mt-1 text-xs text-[#9CA3AF] font-normal">
          {isRegisterMode ? 'Gia nhập không gian trò chuyện Talovin' : 'Nhập tài khoản để vào thẳng Sảnh chính'}
        </p>
      </div>

      {/* Thẻ Form */}
      <div className="bg-[#161922] border border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/40">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-300 text-xs leading-relaxed">
            <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ô nhập tài khoản */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-[#9CA3AF]">
              Tài khoản
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-[#9CA3AF]/60 pointer-events-none">
                <User size={16} strokeWidth={1.75} />
              </div>
              <input
                type="text"
                name="account"
                autoComplete="username"
                required
                placeholder="Tên tài khoản"
                value={formData.account}
                onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#0F1117] border border-white/[0.08] hover:border-white/[0.15] focus:border-white/25 rounded-xl text-sm text-[#F3F4F6] placeholder-[#9CA3AF]/40 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Ô nhập mật khẩu */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-[#9CA3AF]">
              Mật khẩu
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-[#9CA3AF]/60 pointer-events-none">
                <Lock size={16} strokeWidth={1.75} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                placeholder="Mật khẩu của bạn"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-10 pr-10 py-2.5 bg-[#0F1117] border border-white/[0.08] hover:border-white/[0.15] focus:border-white/25 rounded-xl text-sm text-[#F3F4F6] placeholder-[#9CA3AF]/40 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-[#9CA3AF]/60 hover:text-[#F3F4F6] transition-colors cursor-pointer"
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

          {/* Nút Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:opacity-95 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-500/25 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" strokeWidth={1.75} />
                <span>{isRegisterMode ? 'Đang tạo...' : 'Đang vào...'}</span>
              </>
            ) : (
              <span>{isRegisterMode ? 'Tạo tài khoản' : 'Đăng nhập vào Sảnh'}</span>
            )}
          </button>
        </form>

        {/* Chuyển đổi giữa Đăng nhập và Đăng ký */}
        <div className="mt-5 pt-4 border-t border-white/[0.06] text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setError('');
            }}
            className="text-xs text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors cursor-pointer"
          >
            {isRegisterMode ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
          </button>
        </div>
      </div>
    </div>
  );

  // NẾU ĐÃ XEM INTRO RỒI: Hiển thị thẳng màn hình Đăng nhập (không cuộn snap)
  if (introSeen) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#0F1117] text-[#F3F4F6] flex flex-col justify-center items-center px-4 py-8 select-none">
        {renderAuthForm()}
      </div>
    );
  }

  // LẦN ĐẦU TRUY CẬP: Container Cuộn / Vuốt dọc toàn màn hình (Vertical Scroll-Snap)
  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-[100dvh] w-full bg-[#0F1117] text-[#F3F4F6] overflow-y-scroll snap-y snap-mandatory scroll-smooth relative select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* Nút "Bỏ qua" cố định góc trên bên phải (chỉ hiện khi chưa tới màn 3) */}
      {activeSection < 2 && (
        <button
          type="button"
          onClick={handleSkip}
          className="fixed top-5 right-5 sm:top-7 sm:right-8 z-30 text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1.5 px-3 cursor-pointer"
        >
          Bỏ qua
        </button>
      )}

      {/* 3 dấu chấm dọc siêu mảnh báo hiệu vị trí trang đang vuốt */}
      <div className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30 pointer-events-none">
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className={`w-1 rounded-full transition-all duration-300 ${
              activeSection === idx ? 'h-6 bg-[#F3F4F6]' : 'h-1.5 bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* ============================================================== */}
      {/* MÀN 1 (Chào đón): Logo chữ T tối giản & Tên sản phẩm */}
      {/* ============================================================== */}
      <section
        ref={section1Ref}
        data-section-index="0"
        className="h-[100dvh] w-full snap-start flex flex-col justify-between items-center px-6 py-10 relative overflow-hidden"
      >
        <div className="h-6" />

        <div
          className={`flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto transition-all duration-500 ease-out ${
            activeSection === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <TalovinLogo size={42} showText={false} />
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F3F4F6] mt-6 mb-2.5 font-sans">
            Talovin
          </h1>
          <p className="text-sm sm:text-base text-[#9CA3AF] font-normal leading-relaxed">
            Talovin — Không gian trò chuyện & âm nhạc thời gian thực.
          </p>
        </div>

        {/* Hướng dẫn vuốt lên & đường kẻ dọc mảnh animation */}
        <div className="pb-4 flex flex-col items-center gap-3">
          <span className="text-xs text-zinc-500 tracking-wide font-normal">
            Vuốt lên để tiếp tục
          </span>
          <div className="w-[1.5px] h-7 bg-white/10 rounded-full overflow-hidden relative">
            <div className="w-full h-3 bg-white/40 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* MÀN 2 (Giá trị cốt lõi): 3 dòng ngắn gọn phân cấp rõ ràng */}
      {/* ============================================================== */}
      <section
        ref={section2Ref}
        data-section-index="1"
        className="h-[100dvh] w-full snap-start flex flex-col justify-center items-center px-6 py-12 relative overflow-hidden"
      >
        <div
          className={`max-w-[420px] w-full mx-auto space-y-10 sm:space-y-12 transition-all duration-500 ease-out ${
            activeSection === 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="space-y-2 text-left">
            <span className="text-[11px] font-mono tracking-widest text-zinc-500">01 / ÂM THANH</span>
            <p className="text-base sm:text-lg text-[#F3F4F6] font-normal leading-relaxed">
              Gửi một đoạn voice 5 giây trên Sóng FM, nghe giọng nhau trước khi bắt đầu câu chuyện.
            </p>
          </div>

          <div className="space-y-2 text-left">
            <span className="text-[11px] font-mono tracking-widest text-zinc-500">02 / KẾT NỐI</span>
            <p className="text-base sm:text-lg text-[#F3F4F6] font-normal leading-relaxed">
              Rút thẻ câu hỏi ngẫu nhiên để phá tan sự im lặng trong sảnh.
            </p>
          </div>

          <div className="space-y-2 text-left">
            <span className="text-[11px] font-mono tracking-widest text-zinc-500">03 / ĐỒNG ĐIỆU</span>
            <p className="text-base sm:text-lg text-[#F3F4F6] font-normal leading-relaxed">
              Nghe chung một giai điệu và nhắn tin trực tiếp cùng bạn bè.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* MÀN 3 (Điểm dừng cuối cùng): Tích hợp trực tiếp Form Đăng nhập */}
      {/* ============================================================== */}
      <section
        ref={section3Ref}
        data-section-index="2"
        className="h-[100dvh] w-full snap-start flex flex-col justify-center items-center px-4 sm:px-6 py-8 relative overflow-hidden"
      >
        <div
          className={`w-full flex justify-center transition-all duration-500 ease-out ${
            activeSection === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {renderAuthForm()}
        </div>
      </section>
    </div>
  );
};

export default Login;
