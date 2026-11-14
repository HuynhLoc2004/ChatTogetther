import React, { Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import ChatRoom from './pages/ChatRoom';
import AdminDashboard from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';
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

  handleResetCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
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
          background: '#09090b',
          color: '#f4f4f5',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '20px',
            padding: '32px 28px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#27272a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: '#10b981',
              fontSize: '20px'
            }}>
              ✦
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: '#f4f4f5', letterSpacing: '-0.02em' }}>
              Đã khôi phục dữ liệu hiển thị
            </h2>
            <p style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '22px', lineHeight: 1.5 }}>
              Ứng dụng vừa hoàn tất đồng bộ phiên bản mới. Bạn hãy bấm nút bên dưới để tải lại và tiếp tục trải nghiệm.
            </p>

            {this.state.error && (
              <details style={{ textAlign: 'left', marginBottom: '20px', padding: '10px 12px', background: '#09090b', borderRadius: '10px', border: '1px solid #27272a', fontSize: '11px', color: '#f87171', fontFamily: 'monospace' }}>
                <summary style={{ cursor: 'pointer', color: '#71717a', userSelect: 'none' }}>Chi tiết kỹ thuật</summary>
                <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {this.state.error.toString()}
                </div>
              </details>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexDirection: 'column' }}>
              <button 
                onClick={this.handleReload}
                style={{
                  background: '#f4f4f5',
                  color: '#09090b',
                  border: 'none',
                  padding: '11px 20px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s'
                }}
              >
                Tải lại trang ngay
              </button>
              <button 
                onClick={this.handleResetCache}
                style={{
                  background: 'transparent',
                  color: '#a1a1aa',
                  border: '1px solid #27272a',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                Làm mới phiên & Đăng nhập lại
              </button>
            </div>
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
            position="top-center" 
            reverseOrder={false}
            containerStyle={{
              top: 58,
              left: 12,
              right: 12,
              zIndex: 99999
            }}
            toastOptions={{
              duration: 2500,
              style: {
                background: 'rgba(24, 24, 27, 0.95)',
                color: '#f4f4f5',
                border: '1px solid #3f3f46',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500',
                padding: '8px 14px',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
                maxWidth: '92vw'
              },
              success: {
                iconTheme: {
                  primary: '#27272a',
                  secondary: '#10b981',
                },
              },
              error: {
                iconTheme: {
                  primary: '#27272a',
                  secondary: '#f43f5e',
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
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile/:userId" 
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <ProfilePage />
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
