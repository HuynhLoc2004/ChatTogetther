import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Fix "global is not defined" error for stompjs
window.global = window;

// Ngay khi client được truy cập trên Vercel/trình duyệt, gửi ping đánh thức Backend trên Render ngay lập tức!
(() => {
  try {
    const rawEndpoint = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
    const backendUrl = rawEndpoint.replace(/\/api$/, '');
    const pingUrl = backendUrl ? `${backendUrl}/api/tracks` : '/api/tracks';
    fetch(pingUrl, { method: 'GET', keepalive: true }).catch(() => {});
  } catch (_) {}
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
