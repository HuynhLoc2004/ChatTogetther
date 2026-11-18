import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import TalovinLogo from '../components/TalovinLogo';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { updateCurrentUser, refreshProfile } = useAuth();
  const [formData, setFormData] = useState({ account: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slowMessage, setSlowMessage] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedTimerRef = useRef(null);
  const navigate = useNavigate();

  // Khởi động làm ấm máy chủ ngay khi người dùng mở trang Đăng Nhập
  useEffect(() => {
    // Đảm bảo không còn token cũ từ phiên trước gây nhiễu
    localStorage.removeItem('accesstoken');
    // Gửi request nhẹ không yêu cầu xác thực để đánh thức máy chủ trong lúc người dùng đang nhập tài khoản
    axiosClient.get('/ping').catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.account.trim() || !formData.password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setError('');
    setSubmitting(true);
    setSlowMessage(false);
    setElapsedSec(0);

    const timer = setTimeout(() => {
      setSlowMessage(true);
    }, 2500);

    elapsedTimerRef.current = setInterval(() => {
      setElapsedSec(prev => prev + 1);
    }, 1000);
    
    try {
      const response = await axiosClient.post('/auth/login', {
        account: formData.account.trim(),
        password: formData.password
      });

      clearTimeout(timer);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

      if (response.status === 200) {
        const { token, roomId, refreshToken } = response.data.data;
        localStorage.setItem('accesstoken', token);
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }

        // Xóa cache bài viết cũ để tránh xung đột dữ liệu phiên bản mới
        localStorage.removeItem('talovin_cached_posts');
        localStorage.removeItem('hasCheckedActiveRoom');

        // Giải mã JWT để lấy user_id
        try {
          const payloadBase64 = token.split('.')[1];
          const decodedPayload = JSON.parse(atob(payloadBase64));
          const userId = decodedPayload.user_id;
          const userAccount = decodedPayload.sub || formData.account.trim();
          
          if (userId) {
            localStorage.setItem('user_id', userId);
            console.log("Đã lưu user_id:", userId);
          }
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
        } catch (decodeError) {
          console.error("Không thể giải mã token:", decodeError);
        }

        // Chuyển về Sảnh
        sessionStorage.setItem('hasCheckedActiveRoom', 'true');
        navigate('/');
      }
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        if (status === 401 || status === 400) {
          setError('Tài khoản hoặc mật khẩu không chính xác!');
        } else if (status === 404) {
          setError('Tài khoản không tồn tại trên hệ thống!');
        } else if (status === 429) {
          setError(err.response.data?.message || 'Bạn đang thao tác quá nhanh. Vui lòng đợi 30 giây rồi thử lại!');
        } else {
          setError(err.response.data?.message || 'Đã có lỗi xảy ra trong quá trình xác thực!');
        }
      } else {
        setError('Máy chủ đang khởi động từ chế độ ngủ (Render Free). Vui lòng đợi khoảng 30 - 50 giây rồi thử lại!');
      }
    } finally {
      clearTimeout(timer);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setSubmitting(false);
      setSlowMessage(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0D12] text-[#F8FAFC] flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden select-none">
      {/* Vòng sáng nền tạo chiều sâu không gian (Ambient Glow) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px] relative z-10"
      >
        {/* Header Thương hiệu */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-3.5 relative">
            <TalovinLogo size={48} showText={false} />
            <div className="absolute -inset-1 rounded-2xl bg-indigo-500/20 blur-md -z-10" />
          </div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight font-sans">
            Đăng nhập Talovin
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-zinc-400 font-normal">
            Không gian kết nối giọng nói & âm nhạc trực tiếp
          </p>
        </div>

        {/* Khung thẻ Form đăng nhập */}
        <div className="bg-[#161922]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-300 text-xs leading-relaxed"
            >
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Tài khoản */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300 tracking-wide">
                Tài khoản
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-zinc-500 pointer-events-none">
                  <User size={17} strokeWidth={1.75} />
                </div>
                <input 
                  type="text" 
                  name="account"
                  autoComplete="username"
                  required
                  placeholder="Nhập tên tài khoản"
                  value={formData.account}
                  onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-[#0D0F14] border border-white/10 hover:border-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-sm text-white placeholder-zinc-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Input Mật khẩu */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300 tracking-wide">
                Mật khẩu
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-zinc-500 pointer-events-none">
                  <Lock size={17} strokeWidth={1.75} />
                </div>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  name="password"
                  autoComplete="current-password"
                  required
                  placeholder="Nhập mật khẩu"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-11 py-3 bg-[#0D0F14] border border-white/10 hover:border-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-sm text-white placeholder-zinc-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-zinc-400 hover:text-zinc-200 transition-colors p-1 cursor-pointer"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Nút Đăng nhập */}
            <div className="pt-2">
              <button 
                type="submit" 
                disabled={submitting} 
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    <span>Đang kết nối...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng nhập</span>
                    <ArrowRight size={16} strokeWidth={2} />
                  </>
                )}
              </button>
            </div>

            {/* Thông báo đánh thức máy chủ (Render Free Tier) */}
            {slowMessage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-2xl bg-[#0D0F14] border border-indigo-500/20 text-center space-y-1"
              >
                <p className="text-xs text-indigo-300 font-medium flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                  Đang khởi động máy chủ đám mây ({elapsedSec}s)...
                </p>
                <p className="text-[11px] text-zinc-400">
                  Hệ thống đang sẵn sàng trong giây lát, vui lòng giữ màn hình.
                </p>
              </motion.div>
            )}
          </form>

          {/* Footer chuyển hướng Đăng ký */}
          <div className="mt-6 pt-5 border-t border-white/5 text-center text-xs text-zinc-400">
            Chưa có tài khoản?{' '}
            <Link 
              to="/register" 
              className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors ml-1 inline-flex items-center gap-1"
            >
              Tạo tài khoản mới
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
