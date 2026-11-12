import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import ChatRoom from './pages/ChatRoom';
import './App.css';

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
    <Router>
      <div className="app-container">
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
            element={<PublicRoute><Login /></PublicRoute>} 
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
  );
}

export default App;
