import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axiosClient from '../api/axiosClient';

const Register = () => {
  const [formData, setFormData] = useState({ account: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axiosClient.post('/users/create', {
        account: formData.account,
        password: formData.password
      });

      if (response.status === 200) {
        alert('Đăng ký thành công! Hãy đăng nhập.');
        navigate('/login');
      }
    } catch (err) {
      if (err.response) {
        // Backend ném AppException nếu user đã tồn tại (thường là 400)
        setError(err.response.data.message || 'Đăng ký thất bại, vui lòng thử lại!');
      } else {
        setError('Không thể kết nối đến server!');
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="auth-card"
    >
      <div className="auth-header">
        <h1 className="logo-text">Tham Gia Ngay</h1>
        <p className="auth-subtitle">Tạo tài khoản để bắt đầu Chat</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Tài khoản</label>
          <input 
            type="text" 
            className="form-input"
            placeholder="Nhập tài khoản muốn đăng ký"
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
        <button type="submit" className="auth-button">Đăng Ký</button>
      </form>

      <div className="auth-footer">
        Đã có tài khoản? <Link to="/login" className="auth-link">Đăng nhập</Link>
      </div>
    </motion.div>
  );
};

export default Register;
