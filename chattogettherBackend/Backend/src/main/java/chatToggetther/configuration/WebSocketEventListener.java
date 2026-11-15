package chatToggetther.configuration;

import chatToggetther.service.PresenceService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * Lắng nghe các sự kiện kết nối/ngắt kết nối WebSocket STOMP
 * để tự động ghi nhận thiết bị kết nối và duy trì trạng thái trực tuyến.
 */
@Component
public class WebSocketEventListener {

    private final PresenceService presenceService;

    public WebSocketEventListener(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        String userIdStr = headerAccessor.getFirstNativeHeader("userId");
        if (userIdStr != null) {
            try {
                Long userId = Long.valueOf(userIdStr);
                presenceService.recordActive(userId, sessionId);
            } catch (Exception ignored) {}
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        if (sessionId != null) {
            presenceService.handleDisconnect(sessionId);
        }
    }
}
