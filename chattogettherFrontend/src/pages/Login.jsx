import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axiosClient from '../api/axiosClient';
import TalovinLogo from '../components/TalovinLogo';

const Login = () => {
  const [formData, setFormData] = useState({ account: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slowMessage, setSlowMessage] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedTimerRef = useRef(null);
  const navigate = useNavigate();

  // Khởi động làm ấm máy chủ ngay khi người dùng mở trang Đăng Nhập
  useEffect(() => {
    // Gửi request nhẹ không yêu cầu xác thực để đánh thức Render trong lúc người dùng đang nhập tài khoản
    axiosClient.get('/ping').catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
          const payloadBase64 = token.split('.')[1]; // Lấy phần Payload của JWT
          const decodedPayload = JSON.parse(atob(payloadBase64)); // Giải mã Base64 sang JSON
          const userId = decodedPayload.user_id;
          
          if (userId) {
            localStorage.setItem('user_id', userId);
            console.log("Đã lưu user_id:", userId);
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
        // Backend ném AppException với HttpStatus tương ứng
        const status = err.response.status;
        if (status === 401 || status === 400) {
          setError('Tài khoản hoặc mật khẩu không đúng!');
        } else if (status === 404) {
          setError('Tài khoản không tồn tại!');
        } else if (status === 429) {
          setError(err.response.data?.message || 'Bạn đang thao tác quá nhanh. Vui lòng đợi 30 giây rồi thử lại!');
        } else {
          setError(err.response.data?.message || 'Đã có lỗi xảy ra!');
        }
      } else {
        setError('Máy chủ đang thức dậy từ chế độ ngủ (Render Free). Vui lòng đợi khoảng 30 - 50 giây rồi bấm lại!');
      }
    } finally {
      clearTimeout(timer);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setSubmitting(false);
      setSlowMessage(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="auth-card"
    >
      <div className="auth-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <TalovinLogo size={46} showText={false} style={{ marginBottom: 12 }} />
        <h1 className="logo-text">Talovin</h1>
        <p className="auth-subtitle">Không gian trò chuyện & âm nhạc trực tiếp</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Tài khoản</label>
          <input 
            type="text" 
            className="form-input"
            placeholder="Nhập tài khoản"
            required
            value={formData.account}
            onChange={(e) => setFormData({...formData, account: e.target.value})}
          />
        </div>
        <div className="form-group">
          <label>Mật khẩu</label>
          <input 
            type="password" 
            className="form-input"
            placeholder="Nhập mật khẩu"
            required
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
          />
        </div>
        <button type="submit" disabled={submitting} className="auth-button">
          {submitting ? 'Đang Đăng Nhập...' : 'Đăng Nhập'}
        </button>
        {slowMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-center space-y-1 animate-fade-in">
            <p className="text-xs text-zinc-300 font-medium">
              ⚡ Đang kết nối máy chủ Render ({elapsedSec}s)...
            </p>
            <p className="text-[11px] text-zinc-500">
              Máy chủ đang được đánh thức từ chế độ ngủ, vui lòng giữ màn hình.
            </p>
          </div>
        )}
      </form>

      <div className="auth-footer">
        Chưa có tài khoản? <Link to="/register" className="auth-link">Đăng ký ngay</Link>
      </div>
    </motion.div>
  );
};

export default Login;
