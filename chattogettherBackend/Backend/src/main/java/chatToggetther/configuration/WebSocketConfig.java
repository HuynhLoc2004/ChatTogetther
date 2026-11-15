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
        // Topic để client subscribe nhận tin nhắn
        config.enableSimpleBroker("/topic");
        // Prefix cho các tin nhắn từ client gửi lên server (nếu có)
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 1. Endpoint WebSocket thuần chuẩn (ws://, wss://) - Zero unload permissions violation
        // Tuyệt đối không gọi withSockJS() trên endpoint này để Native WebSocket kết nối trực tiếp thành công
        registry.addEndpoint("/ws-gs-guide", "/ws", "/ws-native")
                .setAllowedOriginPatterns("*");

        // 2. Endpoint hỗ trợ SockJS fallback riêng biệt
        registry.addEndpoint("/ws-sockjs")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
