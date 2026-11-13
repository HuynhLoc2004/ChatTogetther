package chatToggetther.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Controller
public class CallSignalController {

    private final SimpMessagingTemplate messagingTemplate;

    public CallSignalController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    // Cuộc gọi thoại/video trong phòng nhóm
    @MessageMapping("/call/{roomId}")
    public void handleRoomCallSignal(@DestinationVariable("roomId") Long roomId, @Payload Map<String, Object> payload) {
        this.messagingTemplate.convertAndSend("/topic/call/" + roomId, payload);
    }

    // Cuộc gọi 1-1 riêng giữa 2 thành viên
    @MessageMapping("/call/user/{userId}")
    public void handlePrivateCallSignal(@DestinationVariable("userId") Long userId, @Payload Map<String, Object> payload) {
        this.messagingTemplate.convertAndSend("/topic/call/user/" + userId, payload);
    }
}
