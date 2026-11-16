package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.AppException;
import chatToggetther.DTO.SendMessageDTO;
import chatToggetther.DataRequest.MessageRequest;
import chatToggetther.service.ChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/message", "/api/messages"})
public class ChatController {
    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping("/send")
    public ResponseEntity<ResponseData<Boolean>> sendMessage(
            JwtAuthenticationToken jwtAuthenticationToken,
            @RequestParam(value = "user_room", required = false) Long user_room,
            @RequestParam(value = "targetUserId", required = false) String targetUserId,
            @RequestBody MessageRequest messageRequest
    ) {
        Long effectiveRoomId = user_room;
        if (effectiveRoomId == null && targetUserId != null && !targetUserId.trim().isEmpty()) {
            try {
                ResponseData<Map<String, Object>> dmRes = this.chatService.getOrCreateDirectRoom(jwtAuthenticationToken, targetUserId.trim());
                if (dmRes.getData() != null && dmRes.getData().get("roomId") != null) {
                    effectiveRoomId = Long.valueOf(dmRes.getData().get("roomId").toString());
                }
            } catch (Exception ignored) {}
        }
        if (effectiveRoomId == null) {
            throw new AppException(400, "Không thể xác định phòng trò chuyện để gửi tin nhắn", 400);
        }
        return ResponseEntity.ok(this.chatService.sendMessage(jwtAuthenticationToken, messageRequest, effectiveRoomId));
    }

    @PostMapping
    public ResponseEntity<ResponseData<Boolean>> postMessageDirect(
            JwtAuthenticationToken jwtAuthenticationToken,
            @RequestParam(value = "user_room", required = false) Long userRoomParam,
            @RequestBody Map<String, Object> body
    ) {
        MessageRequest req = new MessageRequest();
        String msg = (String) body.get("message");
        if (msg == null) msg = (String) body.get("content");
        req.setMessage(msg);

        Long effectiveRoomId = userRoomParam;
        if (effectiveRoomId == null && body.get("user_room") != null) {
            try {
                effectiveRoomId = Long.valueOf(body.get("user_room").toString());
            } catch (Exception ignored) {}
        }
        if (effectiveRoomId == null && body.get("roomId") != null) {
            try {
                effectiveRoomId = Long.valueOf(body.get("roomId").toString());
            } catch (Exception ignored) {}
        }
        if (effectiveRoomId == null && body.get("targetUserId") != null) {
            try {
                Long targetUserId = Long.valueOf(body.get("targetUserId").toString());
                ResponseData<Map<String, Object>> dmRes = this.chatService.getOrCreateDirectRoom(jwtAuthenticationToken, targetUserId);
                if (dmRes.getData() != null && dmRes.getData().get("roomId") != null) {
                    effectiveRoomId = Long.valueOf(dmRes.getData().get("roomId").toString());
                }
            } catch (Exception ignored) {}
        }
        if (effectiveRoomId == null) {
            throw new AppException(400, "Thiếu tham số phòng trò chuyện (user_room hoặc targetUserId)", 400);
        }
        return ResponseEntity.ok(this.chatService.sendMessage(jwtAuthenticationToken, req, effectiveRoomId));
    }

    @GetMapping("/history")
    public ResponseEntity<ResponseData<List<SendMessageDTO>>> getHistory(
            JwtAuthenticationToken jwtAuthenticationToken,
            @RequestParam(value = "room_id", required = false) Long roomId,
            @RequestParam(value = "idRoom", required = false) Long idRoom,
            @RequestParam(value = "before_id", required = false) Long beforeId,
            @RequestParam(value = "size", required = false, defaultValue = "30") Integer size
    ) {
        Long targetRoomId = (roomId != null) ? roomId : idRoom;
        return ResponseEntity.ok(this.chatService.getMessageHistory(jwtAuthenticationToken, targetRoomId, beforeId, size));
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<ResponseData<List<SendMessageDTO>>> getHistoryByPath(
            JwtAuthenticationToken jwtAuthenticationToken,
            @PathVariable("roomId") Long roomId
    ) {
        return ResponseEntity.ok(this.chatService.getMessageHistory(jwtAuthenticationToken, roomId, null, 50));
    }

    @GetMapping("/direct/{targetUserId}")
    public ResponseEntity<ResponseData<Map<String, Object>>> getOrCreateDirectRoom(
            JwtAuthenticationToken token,
            @PathVariable("targetUserId") String targetUserId
    ) {
        return ResponseEntity.ok(this.chatService.getOrCreateDirectRoom(token, targetUserId));
    }

    @GetMapping({"/conversations", "/recent-chats"})
    public ResponseEntity<ResponseData<List<Map<String, Object>>>> getRecentConversations(
            JwtAuthenticationToken token
    ) {
        return ResponseEntity.ok(this.chatService.getRecentConversations(token));
    }

    @PostMapping("/read")
    public ResponseEntity<ResponseData<Boolean>> markAsRead(
            JwtAuthenticationToken token,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "roomId", required = false) Long roomIdParam,
            @RequestParam(value = "targetUserId", required = false) String targetUserIdParam,
            @RequestParam(value = "upToMessageId", required = false) Long upToMessageIdParam
    ) {
        Long roomId = roomIdParam;
        String targetUserId = targetUserIdParam;
        Long upToMessageId = upToMessageIdParam;
        if (body != null) {
            if (roomId == null && body.get("roomId") != null) {
                try { roomId = Long.valueOf(body.get("roomId").toString()); } catch (Exception ignored) {}
            }
            if (targetUserId == null && body.get("targetUserId") != null) {
                targetUserId = body.get("targetUserId").toString();
            }
            if (upToMessageId == null && body.get("upToMessageId") != null) {
                try { upToMessageId = Long.valueOf(body.get("upToMessageId").toString()); } catch (Exception ignored) {}
            }
        }
        return ResponseEntity.ok(this.chatService.markMessagesAsRead(token, roomId, targetUserId, upToMessageId));
    }

}
