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
 * Khởi tạo STOMP client WebSocket thuần (Native WebSocket)
 * Hoàn toàn loại bỏ SockJS để triệt tiêu vĩnh viễn lỗi:
 * [Violation] Permissions policy violation: unload is not allowed in this document.
 */
export const createStompClient = () => {
  const wsUrl = getWebSocketUrl();
  const socket = new WebSocket(wsUrl);
  const client = Stomp.over(socket);
  client.debug = () => {};
  return client;
};
