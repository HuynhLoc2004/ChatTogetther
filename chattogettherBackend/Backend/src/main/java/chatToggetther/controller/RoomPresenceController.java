package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
public class RoomPresenceController {

    private final SimpMessagingTemplate messagingTemplate;

    // Lưu trữ theo phòng: roomId -> (userId -> lastHeartbeatTimestamp)
    private static final ConcurrentHashMap<Long, ConcurrentHashMap<Long, Long>> ROOM_PRESENCE = new ConcurrentHashMap<>();
    private static final long HEARTBEAT_TIMEOUT_MS = 35_000L; // 35 giây nếu mất kết nối thì coi như ngoại tuyến

    public RoomPresenceController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * API REST lấy danh sách user ID đang trực tuyến trong phòng
     */
    @GetMapping("/api/rooms/{roomId}/online-users")
    public ResponseEntity<ResponseData<List<Long>>> getOnlineUsers(@PathVariable("roomId") Long roomId) {
        ConcurrentHashMap<Long, Long> roomUsers = ROOM_PRESENCE.get(roomId);
        if (roomUsers == null || roomUsers.isEmpty()) {
            return ResponseEntity.ok(new ResponseData<>(200, "Danh sách trực tuyến", Collections.emptyList()));
        }

        long now = System.currentTimeMillis();
        List<Long> onlineUsers = new ArrayList<>();
        roomUsers.forEach((userId, timestamp) -> {
            if (now - timestamp <= HEARTBEAT_TIMEOUT_MS) {
                onlineUsers.add(userId);
            }
        });

        return ResponseEntity.ok(new ResponseData<>(200, "Danh sách trực tuyến", onlineUsers));
    }

    /**
     * WebSocket: Khi user vào phòng chat
     */
    @MessageMapping("/room/{roomId}/presence/join")
    public void userJoinRoom(@DestinationVariable("roomId") Long roomId, @Payload Map<String, Object> payload) {
        Long userId = extractUserId(payload);
        if (userId != null && roomId != null) {
            ROOM_PRESENCE.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>()).put(userId, System.currentTimeMillis());
            broadcastRoomPresence(roomId);
        }
    }

    /**
     * WebSocket: Heartbeat định kỳ giữ trạng thái online
     */
    @MessageMapping("/room/{roomId}/presence/heartbeat")
    public void userHeartbeat(@DestinationVariable("roomId") Long roomId, @Payload Map<String, Object> payload) {
        Long userId = extractUserId(payload);
        if (userId != null && roomId != null) {
            ConcurrentHashMap<Long, Long> map = ROOM_PRESENCE.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());
            map.put(userId, System.currentTimeMillis());
        }
    }

    /**
     * WebSocket: Khi user rời phòng chat
     */
    @MessageMapping("/room/{roomId}/presence/leave")
    public void userLeaveRoom(@DestinationVariable("roomId") Long roomId, @Payload Map<String, Object> payload) {
        Long userId = extractUserId(payload);
        if (userId != null && roomId != null) {
            ConcurrentHashMap<Long, Long> map = ROOM_PRESENCE.get(roomId);
            if (map != null) {
                map.remove(userId);
                if (map.isEmpty()) {
                    ROOM_PRESENCE.remove(roomId);
                }
            }
            broadcastRoomPresence(roomId);
        }
    }

    /**
     * Tự động quét và loại bỏ các user mất kết nối (sau 35s không gửi heartbeat)
     */
    @Scheduled(fixedRate = 15000)
    public void evictStaleUsers() {
        long now = System.currentTimeMillis();
        ROOM_PRESENCE.forEach((roomId, users) -> {
            boolean changed = false;
            Iterator<Map.Entry<Long, Long>> it = users.entrySet().iterator();
            while (it.hasNext()) {
                Map.Entry<Long, Long> entry = it.next();
                if (now - entry.getValue() > HEARTBEAT_TIMEOUT_MS) {
                    it.remove();
                    changed = true;
                }
            }
            if (users.isEmpty()) {
                ROOM_PRESENCE.remove(roomId);
            }
            if (changed) {
                broadcastRoomPresence(roomId);
            }
        });
    }

    private void broadcastRoomPresence(Long roomId) {
        ConcurrentHashMap<Long, Long> users = ROOM_PRESENCE.get(roomId);
        List<Long> onlineList = (users != null) ? new ArrayList<>(users.keySet()) : Collections.emptyList();
        this.messagingTemplate.convertAndSend("/topic/room/" + roomId + "/presence", onlineList);
    }

    private Long extractUserId(Map<String, Object> payload) {
        if (payload == null) return null;
        Object val = payload.get("userId");
        if (val == null) return null;
        try {
            return Long.valueOf(val.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}

