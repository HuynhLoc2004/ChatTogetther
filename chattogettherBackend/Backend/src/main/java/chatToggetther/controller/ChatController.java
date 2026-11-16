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
import java.util.HashMap;

@RestController
@RequestMapping({"/api/message", "/api/messages"})
public class ChatController {
    private final ChatService chatService;
    private final chatToggetther.service.MediaStorageService mediaStorageService;

    public ChatController(ChatService chatService, chatToggetther.service.MediaStorageService mediaStorageService) {
        this.chatService = chatService;
        this.mediaStorageService = mediaStorageService;
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

    @PostMapping(value = "/upload", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ResponseData<Map<String, String>>> uploadMedia(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file
    ) {
        String mediaUrl = this.mediaStorageService.storeChatMedia(file);
        Map<String, String> res = new HashMap<>();
        res.put("url", mediaUrl);
        return ResponseEntity.ok(new ResponseData<>(200, "Tải lên tệp thành công", res));
    }

    @GetMapping("/files/{fileName:.+}")
    public ResponseEntity<org.springframework.core.io.Resource> getChatMediaFile(
            @PathVariable("fileName") String fileName
    ) {
        org.springframework.core.io.Resource resource = this.mediaStorageService.loadChatMediaAsResource(fileName);
        String contentType = "application/octet-stream";
        try {
            contentType = java.nio.file.Files.probeContentType(java.nio.file.Paths.get(resource.getFile().getAbsolutePath()));
        } catch (Exception ignored) {}
        if (contentType == null) contentType = "application/octet-stream";

        return ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.parseMediaType(contentType))
                .header(org.springframework.http.HttpHeaders.CACHE_CONTROL, "max-age=31536000, public")
                .body(resource);
    }

    @GetMapping("/hidden/status")
    public ResponseEntity<ResponseData<Map<String, Object>>> getHiddenChatStatus(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.chatService.getHiddenChatStatus(token));
    }

    @PostMapping("/hidden/setup-pin")
    public ResponseEntity<ResponseData<Boolean>> setupHiddenChatPin(
            JwtAuthenticationToken token,
            @RequestBody Map<String, String> body
    ) {
        String pin = body != null ? body.get("pin") : null;
        return ResponseEntity.ok(this.chatService.setupHiddenChatPin(token, pin));
    }

    @PostMapping("/hidden/verify-pin")
    public ResponseEntity<ResponseData<Map<String, Object>>> verifyHiddenChatPin(
            JwtAuthenticationToken token,
            @RequestBody Map<String, String> body
    ) {
        String pin = body != null ? body.get("pin") : null;
        return ResponseEntity.ok(this.chatService.verifyHiddenChatPin(token, pin));
    }

    @PostMapping("/hidden/hide")
    public ResponseEntity<ResponseData<Boolean>> hideChat(
            JwtAuthenticationToken token,
            @RequestBody Map<String, Object> body
    ) {
        Long partnerId = null;
        if (body != null && body.get("partnerId") != null) {
            try {
                partnerId = Long.valueOf(body.get("partnerId").toString());
            } catch (Exception ignored) {}
        }
        String pin = body != null ? (String) body.get("pin") : null;
        return ResponseEntity.ok(this.chatService.hideChat(token, partnerId, pin));
    }

    @PostMapping("/hidden/unhide")
    public ResponseEntity<ResponseData<Boolean>> unhideChat(
            JwtAuthenticationToken token,
            @RequestBody Map<String, Object> body
    ) {
        Long partnerId = null;
        if (body != null && body.get("partnerId") != null) {
            try {
                partnerId = Long.valueOf(body.get("partnerId").toString());
            } catch (Exception ignored) {}
        }
        String pin = body != null ? (String) body.get("pin") : null;
        return ResponseEntity.ok(this.chatService.unhideChat(token, partnerId, pin));
    }

}
