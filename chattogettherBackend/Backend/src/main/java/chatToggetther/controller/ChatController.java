package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.AppException;
import chatToggetther.DTO.SendMessageDTO;
import chatToggetther.DataRequest.MessageRequest;
import chatToggetther.service.ChatService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping({"/api/message", "/api/messages", "/api/conversations"})
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
            @RequestParam(value = "roomId", required = false) Long roomId,
            @RequestParam(value = "targetUserId", required = false) String targetUserId,
            @RequestBody MessageRequest messageRequest
    ) {
        Long effectiveRoomId = user_room != null ? user_room : roomId;
        if (effectiveRoomId == null && messageRequest != null) {
            effectiveRoomId = messageRequest.getUser_room() != null ? messageRequest.getUser_room() : messageRequest.getRoomId();
        }

        String effectiveTargetUserId = targetUserId;
        if ((effectiveTargetUserId == null || effectiveTargetUserId.trim().isEmpty()) && messageRequest != null) {
            effectiveTargetUserId = messageRequest.getTargetUserId();
        }

        if (effectiveRoomId == null && effectiveTargetUserId != null && !effectiveTargetUserId.trim().isEmpty()) {
            try {
                ResponseData<Map<String, Object>> dmRes = this.chatService.getOrCreateDirectRoom(jwtAuthenticationToken, effectiveTargetUserId.trim());
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

    @GetMapping({"", "/conversations", "/recent-chats"})
    public ResponseEntity<ResponseData<List<Map<String, Object>>>> getRecentConversations(
            JwtAuthenticationToken token
    ) {
        return ResponseEntity.ok(this.chatService.getRecentConversations(token));
    }

    @GetMapping({"/{targetUserId}/messages", "/messages/{targetUserId}"})
    public ResponseEntity<ResponseData<List<SendMessageDTO>>> getTargetUserMessages(
            JwtAuthenticationToken token,
            @PathVariable("targetUserId") String targetUserId,
            @RequestParam(value = "beforeId", required = false) Long beforeId,
            @RequestParam(value = "limit", required = false, defaultValue = "30") Integer limit
    ) {
        ResponseData<Map<String, Object>> dmRes = this.chatService.getOrCreateDirectRoom(token, targetUserId);
        Long roomId = null;
        if (dmRes.getData() != null && dmRes.getData().get("roomId") != null) {
            roomId = Long.valueOf(dmRes.getData().get("roomId").toString());
        }
        if (roomId == null) {
            return ResponseEntity.ok(new ResponseData<>(200, "Thành công", java.util.Collections.emptyList()));
        }
        return ResponseEntity.ok(this.chatService.getMessageHistory(token, roomId, beforeId, limit));
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
    public ResponseEntity<?> getChatMediaFile(
            @PathVariable("fileName") String fileName,
            @RequestHeader HttpHeaders headers
    ) {
        try {
            Resource resource = this.mediaStorageService.loadChatMediaAsResource(fileName);
            String contentType = determineMediaContentType(fileName);
            MediaType mediaType = MediaType.parseMediaType(contentType);

            long contentLength = resource.contentLength();
            List<HttpRange> ranges = headers.getRange();

            if (!ranges.isEmpty()) {
                HttpRange range = ranges.get(0);
                long start = range.getRangeStart(contentLength);
                long end = range.getRangeEnd(contentLength);
                long rangeLength = Math.min(2 * 1024 * 1024, end - start + 1); // 2MB streaming chunks
                ResourceRegion region = new ResourceRegion(resource, start, rangeLength);
                return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                        .contentType(mediaType)
                        .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                        .header(HttpHeaders.CACHE_CONTROL, "max-age=31536000, public")
                        .body(region);
            }

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .header(HttpHeaders.CACHE_CONTROL, "max-age=31536000, public")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    private String determineMediaContentType(String fileName) {
        if (fileName == null) return "application/octet-stream";
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".mp4")) return "video/mp4";
        if (lower.endsWith(".webm")) return "video/webm";
        if (lower.endsWith(".mov")) return "video/quicktime";
        if (lower.endsWith(".ogg") || lower.endsWith(".ogv")) return "video/ogg";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        return "application/octet-stream";
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
