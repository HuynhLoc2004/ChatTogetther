import React, { Component, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import ChatRoom from './pages/ChatRoom';
import AdminDashboard from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';
import DirectMessagePage from './pages/DirectMessagePage';
import CallPage from './pages/CallPage';
import GlobalCallBanner from './components/GlobalCallBanner';
import { AuthProvider } from './context/AuthContext';
import { PresenceProvider } from './context/PresenceContext';
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
    const msg = (error && error.message) ? error.message.toLowerCase() : '';
    if (msg.includes('dynamically imported module') || msg.includes('failed to fetch') || msg.includes('loading chunk') || msg.includes('load failed')) {
      const hasAutoReloaded = sessionStorage.getItem('chunk_reload_attempt');
      if (!hasAutoReloaded) {
        sessionStorage.setItem('chunk_reload_attempt', '1');
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    localStorage.removeItem('hasCheckedActiveRoom');
    localStorage.removeItem('talovin_cached_posts');
    localStorage.removeItem('offline_rooms');
    localStorage.removeItem('saved_post_ids');
    localStorage.removeItem('talovin_recent_searches');
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
              <details open style={{ textAlign: 'left', marginBottom: '20px', padding: '10px 12px', background: '#09090b', borderRadius: '10px', border: '1px solid #27272a', fontSize: '11px', color: '#f87171', fontFamily: 'monospace' }}>
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

// Helper kiểm tra token JWT hợp lệ & chưa hết hạn
export const isTokenValid = (token) => {
  if (!token || typeof token !== 'string') return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true;
    return payload.exp * 1000 > Date.now();
  } catch (e) {
    return false;
  }
};

// Component bảo vệ Route
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('accesstoken');
  if (!token || !isTokenValid(token)) {
    if (token) {
      localStorage.removeItem('accesstoken');
      localStorage.removeItem('refreshToken');
    }
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Component ngăn truy cập Register khi đã có phiên đăng nhập hợp lệ
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('accesstoken');
  if (token && isTokenValid(token)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Component tự động lưu màn hình gốc (Screen A) trước khi người dùng chuyển vào /messages hoặc /call
const RouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const p = location.pathname;
    // Bỏ qua các route tạm thời như /messages, /call, /login, /register
    if (
      !p.startsWith('/messages') &&
      !p.startsWith('/call') &&
      !p.startsWith('/login') &&
      !p.startsWith('/register')
    ) {
      const fullPath = p + location.search + location.hash;
      sessionStorage.setItem('talovin_origin_screen_a', fullPath);
    }
  }, [location]);

  return null;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PresenceProvider>
          <Router>
          <RouteTracker />
          <div className="app-root">
          <Toaster 
            position="bottom-right" 
            reverseOrder={false}
            toastOptions={{
              duration: 3000,
              style: {
                background: 'rgba(20, 24, 33, 0.95)',
                color: '#F8FAFC',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '14px',
                fontSize: '13px',
                fontWeight: '500',
                padding: '10px 16px',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                maxWidth: '92vw',
                fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif"
              },
              success: {
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#0D0F14',
                },
              },
              error: {
                iconTheme: {
                  primary: '#F43F5E',
                  secondary: '#0D0F14',
                },
              },
            }}
          />
          <GlobalCallBanner />
          <Routes>
            <Route 
              path="/login" 
              element={<Login />} 
            />
            <Route 
              path="/register" 
              element={<PublicRoute><Register /></PublicRoute>} 
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
              path="/communities" 
              element={
                <ProtectedRoute>
                  <Home initialTab="groups" />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/communities/:id" 
              element={
                <ProtectedRoute>
                  <Home initialTab="groups" />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/friends" 
              element={
                <ProtectedRoute>
                  <Home initialTab="friends" />
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
            <Route 
              path="/messages/:userId" 
              element={
                <ProtectedRoute>
                  <DirectMessagePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/messages" 
              element={
                <ProtectedRoute>
                  <DirectMessagePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/call/direct/:userId" 
              element={
                <ProtectedRoute>
                  <CallPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/call/direct" 
              element={
                <ProtectedRoute>
                  <CallPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/call/room/:roomId" 
              element={
                <ProtectedRoute>
                  <CallPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/call" 
              element={
                <ProtectedRoute>
                  <CallPage />
                </ProtectedRoute>
              } 
            />
            {/* Fallback cho các route không tồn tại */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
      </PresenceProvider>
    </AuthProvider>
  </ErrorBoundary>
  );
}

export default App;
