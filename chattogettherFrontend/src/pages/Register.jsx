import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import TalovinLogo from '../components/TalovinLogo';

const Register = () => {
  const [formData, setFormData] = useState({ account: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slowMessage, setSlowMessage] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Đảm bảo không còn token cũ từ phiên trước gây nhiễu
    localStorage.removeItem('accesstoken');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.account.trim() || !formData.password) {
      setError('Vui lòng nhập tài khoản và mật khẩu.');
      return;
    }

    setError('');
    setSubmitting(true);
    setSlowMessage(false);

    const timer = setTimeout(() => {
      setSlowMessage(true);
    }, 2500);

    try {
      const response = await axiosClient.post('/users/create', {
        account: formData.account.trim(),
        password: formData.password
      });

      clearTimeout(timer);
      if (response.status === 200) {
        toast.success('Đăng ký tài khoản thành công! Hãy đăng nhập.');
        navigate('/login');
      }
    } catch (err) {
      if (err.response) {
        setError(err.response.data?.message || 'Đăng ký không thành công, vui lòng thử lại tên tài khoản khác!');
      } else {
        setError('Không thể kết nối đến máy chủ! Vui lòng kiểm tra lại đường truyền mạng.');
      }
    } finally {
      clearTimeout(timer);
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
            Tạo tài khoản Talovin
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-zinc-400 font-normal">
            Gia nhập cộng đồng âm thanh và trò chuyện độc bản
          </p>
        </div>

        {/* Khung thẻ Form đăng ký */}
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
                Tài khoản mới
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
                  placeholder="Tên tài khoản (viết liền không dấu)"
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
                  autoComplete="new-password"
                  required
                  placeholder="Mật khẩu bảo mật"
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

            {/* Nút Đăng ký */}
            <div className="pt-2">
              <button 
                type="submit" 
                disabled={submitting} 
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    <span>Đang tạo tài khoản...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng ký ngay</span>
                    <ArrowRight size={16} strokeWidth={2} />
                  </>
                )}
              </button>
            </div>

            {slowMessage && (
              <p className="text-xs text-indigo-300 text-center mt-2 leading-relaxed">
                Đang kết nối và đánh thức máy chủ đám mây, vui lòng giữ màn hình...
              </p>
            )}
          </form>

          {/* Footer chuyển sang Đăng nhập */}
          <div className="mt-6 pt-5 border-t border-white/5 text-center text-xs text-zinc-400">
            Đã có tài khoản?{' '}
            <Link 
              to="/login" 
              className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors ml-1 inline-flex items-center gap-1"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
