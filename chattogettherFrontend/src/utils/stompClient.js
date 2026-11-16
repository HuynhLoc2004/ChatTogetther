import Stomp from 'stompjs';
import SockJS from 'sockjs-client';
import { BACKEND_URL } from '../api/axiosClient';

/**
 * Trả về URL kết nối WebSocket thuần (ws:// hoặc wss://)
 * Chuẩn Spring Boot STOMP: cần /ws-gs-guide/websocket cho Native WebSocket
 */
export const getWebSocketUrl = () => {
  if (BACKEND_URL) {
    const raw = BACKEND_URL.replace(/\/$/, '');
    const wsProto = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
    return raw.replace(/^https?:/, wsProto) + '/ws-gs-guide/websocket';
  }
  const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
  return `${protocol}//${host}/ws-gs-guide/websocket`;
};

/**
 * Trả về URL SockJS HTTP(S) fallback
 */
export const getSockJsUrl = () => {
  if (BACKEND_URL) {
    const raw = BACKEND_URL.replace(/\/$/, '');
    return raw + '/ws-gs-guide';
  }
  const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'https:' : 'http:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
  return `${protocol}//${host}/ws-gs-guide`;
};

/**
 * Khởi tạo STOMP client linh hoạt:
 * Ưu tiên Native WebSocket (/ws-gs-guide/websocket - cực nhanh, không lag)
 * Tự động fallback sang SockJS nếu browser/mạng không hỗ trợ raw WS
 */
export const createStompClient = () => {
  let socket;
  try {
    const wsUrl = getWebSocketUrl();
    socket = new WebSocket(wsUrl);
  } catch (_) {
    const sockUrl = getSockJsUrl();
    socket = new SockJS(sockUrl);
  }
  const client = Stomp.over(socket);
  client.debug = () => {};
  return client;
};
