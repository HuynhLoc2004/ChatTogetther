import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import TalovinLogo from '../components/TalovinLogo';

const Register = () => {
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
      const response = await axiosClient.post('/users/create', {
        account: formData.account.trim(),
        password: formData.password
      });

      clearTimeout(timer);
      if (response.status === 200) {
        toast.success('Đăng ký thành công! Hãy đăng nhập.');
        navigate('/login');
      }
    } catch (err) {
      if (err.response) {
        setError(err.response.data?.message || 'Đăng ký thất bại, vui lòng thử lại!');
      } else {
        setError('Không thể kết nối đến máy chủ! Kiểm tra lại đường truyền mạng.');
      }
    } finally {
      clearTimeout(timer);
      setSubmitting(false);
      setSlowMessage(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="auth-card"
    >
      <div className="auth-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <TalovinLogo size={46} showText={false} style={{ marginBottom: 12 }} />
        <h1 className="logo-text">Gia Nhập Talovin</h1>
        <p className="auth-subtitle">Tạo tài khoản để tham gia không gian kết nối & âm nhạc</p>
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
        <button type="submit" disabled={submitting} className="auth-button">
          {submitting ? 'Đang Đăng Ký...' : 'Đăng Ký'}
        </button>
        {slowMessage && (
          <p style={{ fontSize: '0.8rem', color: '#818cf8', textAlign: 'center', marginTop: '0.75rem', lineHeight: '1.4' }}>
            🚀 Đang kết nối và đánh thức máy chủ Render, vui lòng đợi trong giây lát...
          </p>
        )}
      </form>

      <div className="auth-footer">
        Đã có tài khoản? <Link to="/login" className="auth-link">Đăng nhập</Link>
      </div>
    </motion.div>
  );
};

export default Register;
