import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import { BACKEND_URL } from '../api/axiosClient';

/**
 * Trả về URL kết nối WebSocket thuần (ws:// hoặc wss://)
 */
export const getWebSocketUrl = () => {
  if (BACKEND_URL) {
    const raw = BACKEND_URL.replace(/\/$/, '');
    const wsProto = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
    return raw.replace(/^https?:/, wsProto) + '/ws-gs-guide';
  }
  const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
  return `${protocol}//${host}/ws-gs-guide`;
};

/**
 * Khởi tạo STOMP client an toàn:
 * - Ưu tiên native browser WebSocket thuần để xóa hoàn toàn cảnh báo [Violation] Permissions policy: unload.
 * - Tự động fallback sang SockJS với transports: ['websocket'] nếu cần.
 */
export const createStompClient = () => {
  if (typeof window !== 'undefined' && window.WebSocket) {
    try {
      const wsUrl = getWebSocketUrl();
      const socket = new WebSocket(wsUrl);
      const client = Stomp.over(socket);
      client.debug = () => {};
      return client;
    } catch (_) {}
  }

  const socketUrl = BACKEND_URL ? `${BACKEND_URL}/ws-gs-guide` : '/ws-gs-guide';
  const sock = new SockJS(socketUrl, null, { transports: ['websocket'] });
  const client = Stomp.over(sock);
  client.debug = () => {};
  return client;
};
