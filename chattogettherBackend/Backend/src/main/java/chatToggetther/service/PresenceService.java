package chatToggetther.service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Quản lý trạng thái trực tuyến toàn hệ thống (Global Online Presence).
 * Hỗ trợ đa thiết bị (Điện thoại + Laptop đồng thời):
 * - Khi kết nối / gửi heartbeat: đánh dấu ONLINE và lưu timestamp.
 * - Khi ngắt kết nối: duy trì grace period 15 giây trước khi chuyển sang OFFLINE.
 * - Heartbeat timeout 45 giây nếu không nhận được tín hiệu.
 */
@Service
public class PresenceService {

    private final SimpMessagingTemplate messagingTemplate;

    // userId -> Set<sessionId> (hỗ trợ nhiều thiết bị: Phone + Laptop)
    private final ConcurrentHashMap<Long, Set<String>> userSessions = new ConcurrentHashMap<>();
    // sessionId -> userId
    private final ConcurrentHashMap<String, Long> sessionToUser = new ConcurrentHashMap<>();
    // userId -> lastActiveTimestamp
    private final ConcurrentHashMap<Long, Long> lastActiveTimestamps = new ConcurrentHashMap<>();
    // userId -> pending offline disconnect task timestamp
    private final ConcurrentHashMap<Long, Long> pendingDisconnectTimestamps = new ConcurrentHashMap<>();

    public static final long DISCONNECT_GRACE_PERIOD_MS = 5_000L;  // 5s grace period
    public static final long HEARTBEAT_TIMEOUT_MS = 20_000L;       // 20s heartbeat timeout (nhanh nhạy, tức thì)

    public PresenceService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Ghi nhận chủ động user offline (ví dụ khi Đăng xuất / Logout)
     */
    public void recordOffline(Long userId, String sessionId) {
        if (userId == null) return;
        lastActiveTimestamps.remove(userId);
        userSessions.remove(userId);
        pendingDisconnectTimestamps.remove(userId);
        if (sessionId != null) {
            sessionToUser.remove(sessionId);
        }
        broadcastPresence(userId, false);
    }

    /**
     * Ghi nhận hoạt động trực tuyến của user (từ STOMP session hoặc heartbeat REST/WS)
     */
    public void recordActive(Long userId, String sessionId) {
        if (userId == null) return;
        long now = System.currentTimeMillis();
        boolean wasOnline = isUserOnline(userId);

        lastActiveTimestamps.put(userId, now);
        pendingDisconnectTimestamps.remove(userId);

        if (sessionId != null && !sessionId.isEmpty()) {
            sessionToUser.put(sessionId, userId);
            userSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(sessionId);
        }

        if (!wasOnline) {
            broadcastPresence(userId, true);
        }
    }

    /**
     * Xử lý khi một phiên kết nối WebSocket bị đóng
     */
    public void handleDisconnect(String sessionId) {
        if (sessionId == null) return;
        Long userId = sessionToUser.remove(sessionId);
        if (userId != null) {
            Set<String> sessions = userSessions.get(userId);
            if (sessions != null) {
                sessions.remove(sessionId);
                // Nếu tất cả các thiết bị/tab đều đã ngắt kết nối -> bắt đầu 15s grace period
                if (sessions.isEmpty()) {
                    userSessions.remove(userId);
                    pendingDisconnectTimestamps.put(userId, System.currentTimeMillis());
                }
            }
        }
    }

    /**
     * Kiểm tra một user có đang trực tuyến không
     */
    public boolean isUserOnline(Long userId) {
        if (userId == null) return false;
        Long lastSeen = lastActiveTimestamps.get(userId);
        if (lastSeen == null) return false;
        long now = System.currentTimeMillis();
        if (now - lastSeen > HEARTBEAT_TIMEOUT_MS) return false;
        Long disconnectTime = pendingDisconnectTimestamps.get(userId);
        if (disconnectTime != null && (now - disconnectTime > DISCONNECT_GRACE_PERIOD_MS)) {
            return false;
        }
        return true;
    }

    /**
     * Trả về danh sách tất cả các User ID đang trực tuyến
     */
    public List<Long> getOnlineUserIds() {
        long now = System.currentTimeMillis();
        List<Long> result = new ArrayList<>();
        lastActiveTimestamps.forEach((uid, lastSeen) -> {
            if (now - lastSeen <= HEARTBEAT_TIMEOUT_MS) {
                Long disconnectTime = pendingDisconnectTimestamps.get(uid);
                if (disconnectTime == null || (now - disconnectTime <= DISCONNECT_GRACE_PERIOD_MS)) {
                    result.add(uid);
                }
            }
        });
        return result;
    }

    /**
     * Broadcast sự kiện thay đổi trạng thái thời gian thực qua STOMP topic /topic/presence
     */
    public void broadcastPresence(Long userId, boolean isOnline) {
        if (userId == null) return;
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "PRESENCE_CHANGE");
        payload.put("userId", userId);
        payload.put("isOnline", isOnline);
        payload.put("lastActiveAt", LocalDateTime.now().toString());
        payload.put("timestamp", System.currentTimeMillis());

        try {
            messagingTemplate.convertAndSend("/topic/presence", payload);
            messagingTemplate.convertAndSend("/topic/user/" + userId + "/presence", payload);
        } catch (Exception ignored) {}
    }

    /**
     * Quét định kỳ mỗi 5s để giải phóng các user đã quá 15s grace period hoặc quá 45s heartbeat
     */
    @Scheduled(fixedRate = 5000)
    public void scanAndEvict() {
        long now = System.currentTimeMillis();

        // 1. Kiểm tra các user trong pendingDisconnectTimestamps quá 15s grace period
        Iterator<Map.Entry<Long, Long>> it = pendingDisconnectTimestamps.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<Long, Long> entry = it.next();
            Long uid = entry.getKey();
            Long disconnectTime = entry.getValue();
            if (now - disconnectTime > DISCONNECT_GRACE_PERIOD_MS) {
                it.remove();
                lastActiveTimestamps.remove(uid);
                broadcastPresence(uid, false);
            }
        }

        // 2. Kiểm tra các user timeout do không gửi heartbeat quá 45s
        Iterator<Map.Entry<Long, Long>> hIt = lastActiveTimestamps.entrySet().iterator();
        while (hIt.hasNext()) {
            Map.Entry<Long, Long> entry = hIt.next();
            Long uid = entry.getKey();
            Long lastSeen = entry.getValue();
            if (now - lastSeen > HEARTBEAT_TIMEOUT_MS) {
                hIt.remove();
                userSessions.remove(uid);
                pendingDisconnectTimestamps.remove(uid);
                broadcastPresence(uid, false);
            }
        }
    }
}
