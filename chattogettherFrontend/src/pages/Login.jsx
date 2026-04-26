import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axiosClient from '../api/axiosClient';

const Login = () => {
  const [formData, setFormData] = useState({ account: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await axiosClient.post('/auth/login', {
        account: formData.account,
        password: formData.password
      });

      if (response.status === 200) {
        const { token, roomId } = response.data.data;
        localStorage.setItem('accesstoken', token);

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
          window.location.href = `/room/${roomId}`;
        } else {
          window.location.href = '/'; 
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
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="auth-card"
    >
      <div className="auth-header">
        <h1 className="logo-text">Chat Togetther</h1>
        <p className="auth-subtitle">Chào mừng bạn quay trở lại!</p>
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
        <button type="submit" className="auth-button">Đăng Nhập</button>
      </form>

      <div className="auth-footer">
        Chưa có tài khoản? <Link to="/register" className="auth-link">Đăng ký ngay</Link>
      </div>
    </motion.div>
  );
};

export default Login;
