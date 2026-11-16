import Stomp from 'stompjs';
import { BACKEND_URL } from '../api/axiosClient';

/**
 * Trả về URL kết nối WebSocket thuần (ws:// hoặc wss://)
 * Spring Boot STOMP: hỗ trợ /ws-gs-guide và /ws-gs-guide/websocket
 */
export const getWebSocketUrl = () => {
  const wsProto = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
  if (BACKEND_URL) {
    const raw = BACKEND_URL.replace(/\/$/, '').replace(/^https?:/, wsProto);
    return `${raw}/ws-gs-guide/websocket`;
  }
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
  return `${wsProto}//${host}/ws-gs-guide/websocket`;
};

/**
 * Khởi tạo STOMP client qua Native WebSocket chuẩn trình duyệt:
 * - 100% Native WebSocket (Cực nhanh, kết nối tức thì, không độ trễ)
 * - Triệt tiêu hoàn toàn Permissions Policy Violation 'unload' của SockJS
 */
export const createStompClient = () => {
  const wsUrl = getWebSocketUrl();
  const socket = new WebSocket(wsUrl);
  const client = Stomp.over(socket);
  client.debug = () => {};
  client.heartbeat.outgoing = 10000;
  client.heartbeat.incoming = 10000;
  return client;
};
