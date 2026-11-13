import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axiosClient from '../api/axiosClient';
import KlyvixLogo from '../components/KlyvixLogo';

const Login = () => {
  const [formData, setFormData] = useState({ account: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slowMessage, setSlowMessage] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    setSlowMessage(false);

    const timer = setTimeout(() => {
      setSlowMessage(true);
    }, 2500);
    
    try {
      const response = await axiosClient.post('/auth/login', {
        account: formData.account,
        password: formData.password
      });

      clearTimeout(timer);

      if (response.status === 200) {
        const { token, roomId, refreshToken } = response.data.data;
        localStorage.setItem('accesstoken', token);
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }

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

        if (roomId) {
          sessionStorage.setItem('hasCheckedActiveRoom', 'true');
          navigate(`/room/${roomId}`);
        } else {
          navigate('/'); 
        }
      }
    } catch (err) {
      if (err.response) {
        // Backend ném AppException với HttpStatus tương ứng
        const status = err.response.status;
        if (status === 401 || status === 400) {
          setError('Tài khoản hoặc mật khẩu không đúng!');
        } else if (status === 404) {
          setError('Tài khoản không tồn tại!');
        } else {
          setError(err.response.data.message || 'Đã có lỗi xảy ra!');
        }
      } else {
        setError('Không thể kết nối đến server!');
      }
    } finally {
      clearTimeout(timer);
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
        <KlyvixLogo size={46} showText={false} style={{ marginBottom: 12 }} />
        <h1 className="logo-text">Klyvix</h1>
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
          <p style={{ fontSize: '0.8rem', color: '#818cf8', textAlign: 'center', marginTop: '0.75rem', lineHeight: '1.4' }}>
            🚀 Đang kết nối và đánh thức máy chủ Render, vui lòng đợi trong giây lát...
          </p>
        )}
      </form>

      <div className="auth-footer">
        Chưa có tài khoản? <Link to="/register" className="auth-link">Đăng ký ngay</Link>
      </div>
    </motion.div>
  );
};

export default Login;
