package chatToggetther.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;


@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Topic & Queue để client subscribe nhận tin nhắn và thông báo
        config.enableSimpleBroker("/topic", "/queue");
        // Prefix cho các tin nhắn từ client gửi lên server (nếu có)
        config.setApplicationDestinationPrefixes("/app");
        // Prefix cho các kênh riêng từng user (/user/queue/...)
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureWebSocketTransport(org.springframework.web.socket.config.annotation.WebSocketTransportRegistration registration) {
        // Tăng giới hạn payload WebSocket lên 512KB để truyền tải đầy đủ WebRTC SDP Offer/Answer và ICE candidates
        registration.setMessageSizeLimit(512 * 1024); // 512KB (mặc định Tomcat chỉ có 8KB làm rơi gói SDP)
        registration.setSendBufferSizeLimit(1024 * 1024); // 1MB buffer đệm gửi
        registration.setSendTimeLimit(20 * 1000); // 20 giây
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 1. Endpoint WebSocket thuần chuẩn (ws://, wss://) - Hỗ trợ cả /ws-gs-guide và /ws-gs-guide/websocket
        registry.addEndpoint("/ws-gs-guide", "/ws-gs-guide/websocket", "/ws", "/ws/websocket", "/ws-native")
                .setAllowedOriginPatterns("*");

        // 2. Endpoint hỗ trợ SockJS fallback riêng biệt
        registry.addEndpoint("/ws-sockjs")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
