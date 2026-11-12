import React, { Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import ChatRoom from './pages/ChatRoom';
import './App.css';

// Error Boundary để ngăn chặn hoàn toàn màn hình đen (Blank Screen)
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    localStorage.removeItem('hasCheckedActiveRoom');
    sessionStorage.clear();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090d16',
          color: '#f8fafc',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '480px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#ef4444' }}>
              Đã xảy ra sự cố hiển thị
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px', lineHeight: 1.6 }}>
              Ứng dụng vừa gặp lỗi nhẹ khi nạp dữ liệu. Bạn hãy bấm nút bên dưới để tải lại và tiếp tục trải nghiệm nhé.
            </p>
            <button 
              onClick={this.handleReload}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#fff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Tải lại trang ngay
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Component bảo vệ Route
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('accesstoken');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Component ngăn truy cập Login/Register khi đã đăng nhập
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('accesstoken');
  if (token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="app-root">
          <Toaster 
            position="top-right" 
            reverseOrder={false}
            toastOptions={{
              duration: 3500,
              style: {
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '12px',
                fontSize: '14px',
                padding: '12px 16px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)'
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#ffffff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#ffffff',
                },
              },
            }}
          />
          <Routes>
            <Route 
              path="/login" 
              element={<PublicRoute><div className="auth-wrapper"><Login /></div></PublicRoute>} 
            />
            <Route 
              path="/register" 
              element={<PublicRoute><div className="auth-wrapper"><Register /></div></PublicRoute>} 
            />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/room/:roomId" 
              element={
                <ProtectedRoute>
                  <ChatRoom />
                </ProtectedRoute>
              } 
            />
            {/* Fallback cho các route không tồn tại */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
