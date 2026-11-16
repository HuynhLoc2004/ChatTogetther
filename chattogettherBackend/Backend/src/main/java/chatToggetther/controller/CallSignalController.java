package chatToggetther.controller;

import chatToggetther.DTO.SendMessageDTO;
import chatToggetther.modelEntity.MessageEntity;
import chatToggetther.modelEntity.RoomEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.MessageRepository;
import chatToggetther.repository.RoomRepository;
import chatToggetther.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Controller
public class CallSignalController {

    private final SimpMessagingTemplate messagingTemplate;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;

    public CallSignalController(SimpMessagingTemplate messagingTemplate,
                                RoomRepository roomRepository,
                                UserRepository userRepository,
                                MessageRepository messageRepository) {
        this.messagingTemplate = messagingTemplate;
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
    }

    // Cuộc gọi thoại/video trong phòng nhóm
    @MessageMapping("/call/{roomId}")
    public void handleRoomCallSignal(@DestinationVariable("roomId") Long roomId, @Payload Map<String, Object> payload) {
        this.messagingTemplate.convertAndSend("/topic/call/" + roomId, payload);
        recordCallLog(roomId, null, payload);
    }

    // Cuộc gọi 1-1 riêng giữa 2 thành viên
    @MessageMapping("/call/user/{userId}")
    public void handlePrivateCallSignal(@DestinationVariable("userId") Long userId, @Payload Map<String, Object> payload) {
        this.messagingTemplate.convertAndSend("/topic/call/user/" + userId, payload);
        recordCallLog(null, userId, payload);
    }

    // Kênh tiếp nhận ghi log kết thúc cuộc gọi trực tiếp qua WebSocket
    @MessageMapping("/call/log")
    public void handleDirectCallLog(@Payload Map<String, Object> payload) {
        if (payload == null) return;
        Long targetUserId = null;
        if (payload.get("targetUserId") != null) {
            try {
                targetUserId = Long.valueOf(String.valueOf(payload.get("targetUserId")));
            } catch (Exception ignored) {}
        }
        Long roomId = null;
        if (payload.get("roomId") != null) {
            try {
                roomId = Long.valueOf(String.valueOf(payload.get("roomId")));
            } catch (Exception ignored) {}
        }
        recordCallLog(roomId, targetUserId, payload);
    }

    // REST API Endpoint kết thúc cuộc gọi & ghi log dự phòng (reliable HTTP fallback)
    @PostMapping({"/api/call/end", "/call/end", "/api/call/log", "/call/log"})
    @ResponseBody
    public ResponseEntity<?> endCallRest(@RequestBody Map<String, Object> payload) {
        if (payload == null) return ResponseEntity.ok(Map.of("success", true));
        Long targetUserId = null;
        if (payload.get("targetUserId") != null) {
            try {
                targetUserId = Long.valueOf(String.valueOf(payload.get("targetUserId")));
            } catch (Exception ignored) {}
        }
        Long roomId = null;
        if (payload.get("roomId") != null) {
            try {
                roomId = Long.valueOf(String.valueOf(payload.get("roomId")));
            } catch (Exception ignored) {}
        }

        // Bắn tín hiệu END qua WebSocket để bên kia thoát ngay lập tức nếu đang treo
        if (targetUserId != null) {
            this.messagingTemplate.convertAndSend("/topic/call/user/" + targetUserId, payload);
        } else if (roomId != null) {
            this.messagingTemplate.convertAndSend("/topic/call/" + roomId, payload);
        }

        // Ghi log cuộc gọi vào DB
        recordCallLog(roomId, targetUserId, payload);
        return ResponseEntity.ok(Map.of("success", true));
    }

    private void recordCallLog(Long roomId, Long targetUserId, Map<String, Object> payload) {
        if (payload == null) return;
        try {
            String type = payload.get("type") != null ? String.valueOf(payload.get("type")).toUpperCase() : "";
            if (!"END".equals(type) && !"DECLINE".equals(type) && !"CALL_LOG".equals(type) && !"BUSY".equals(type) && !"CANCEL".equals(type)) {
                return;
            }

            Long callerId = null;
            if (payload.get("callerId") != null) {
                try {
                    callerId = Long.valueOf(String.valueOf(payload.get("callerId")));
                } catch (Exception ignored) {}
            }
            if (payload.get("targetUserId") != null && targetUserId == null) {
                try {
                    targetUserId = Long.valueOf(String.valueOf(payload.get("targetUserId")));
                } catch (Exception ignored) {}
            }
            if (callerId == null) return;

            UserEntity sender = userRepository.findById(callerId).orElse(null);
            if (sender == null) return;

            RoomEntity room = null;
            if (roomId != null) {
                room = roomRepository.findById(roomId).orElse(null);
            }
            if (room == null && targetUserId != null) {
                long min = Math.min(callerId, targetUserId);
                long max = Math.max(callerId, targetUserId);
                String dmPass = "DM_" + min + "_" + max;
                room = roomRepository.findByPassword(dmPass).orElse(null);
                if (room == null) {
                    List<RoomEntity> allRooms = roomRepository.findAll();
                    room = allRooms.stream()
                            .filter(r -> (r.getPassword() != null && dmPass.equals(r.getPassword())) ||
                                         (r.getRoomName() != null && r.getRoomName().contains(dmPass)))
                            .findFirst()
                            .orElse(null);
                }
                if (room == null) {
                    UserEntity targetUser = userRepository.findById(targetUserId).orElse(null);
                    if (targetUser != null) {
                        room = new RoomEntity();
                        room.setActive(true);
                        room.setPassword(dmPass);
                        String sName = sender.getNickname() != null ? sender.getNickname() : sender.getAccount();
                        String tName = targetUser.getNickname() != null ? targetUser.getNickname() : targetUser.getAccount();
                        room.setRoomName("Chat: " + sName + " & " + tName + "_" + dmPass);
                        room.setDescription("Cuộc trò chuyện riêng tư 1-1");
                        room.setLocalDateTime(LocalDateTime.now());
                        room = roomRepository.save(room);
                    }
                }
            }
            if (room == null) return;

            Object durationObj = payload.get("duration");
            int durationSecs = 0;
            if (durationObj instanceof Number) {
                durationSecs = ((Number) durationObj).intValue();
            } else if (durationObj != null) {
                try {
                    durationSecs = Integer.parseInt(durationObj.toString());
                } catch (Exception ignored) {}
            }

            boolean isVideo = Boolean.TRUE.equals(payload.get("isVideo")) || "video".equalsIgnoreCase(String.valueOf(payload.get("callMode")));
            String logText;
            if ("DECLINE".equals(type) || "BUSY".equals(type) || "CANCEL".equals(type)) {
                logText = isVideo ? "📹 Cuộc gọi video nhỡ" : "📞 Cuộc gọi thoại nhỡ";
            } else if (durationSecs > 0) {
                int mins = durationSecs / 60;
                int secs = durationSecs % 60;
                String timeStr = String.format("%02d:%02d", mins, secs);
                logText = isVideo ? ("📹 Cuộc gọi video (" + timeStr + ")") : ("📞 Cuộc gọi thoại (" + timeStr + ")");
            } else {
                logText = isVideo ? "📹 Cuộc gọi video nhỡ" : "📞 Cuộc gọi thoại nhỡ";
            }

            MessageEntity msg = new MessageEntity();
            msg.setUserEntity(sender);
            msg.setRoomEntity(room);
            msg.setMessage(logText);
            msg.setTimeSend(LocalDateTime.now());
            msg.setTimeRetrieve(LocalDateTime.now());
            messageRepository.save(msg);

            // Bắn realtime thông báo tin nhắn mới vào phòng
            SendMessageDTO sendDto = new SendMessageDTO();
            sendDto.setId(msg.getId());
            sendDto.setUserId(sender.getId());
            sendDto.setMessage(msg.getMessage());
            sendDto.setNickname(sender.getNickname() != null ? sender.getNickname() : sender.getAccount());
            sendDto.setTimeSend(msg.getTimeSend());
            sendDto.setTime_retrieve(msg.getTimeRetrieve());
            int hour = msg.getTimeSend().getHour();
            int minute = msg.getTimeSend().getMinute();
            sendDto.setFormattedTime(String.format("%02d:%02d", hour, minute));
            this.messagingTemplate.convertAndSend("/topic/room/" + room.getId(), sendDto);
            this.messagingTemplate.convertAndSend("/topic/" + room.getId(), sendDto);
            if (targetUserId != null) {
                this.messagingTemplate.convertAndSend("/topic/messages/" + targetUserId, sendDto);
                this.messagingTemplate.convertAndSend("/topic/messages/" + callerId, sendDto);
                this.messagingTemplate.convertAndSend("/topic/room-alerts/" + targetUserId, sendDto);
                this.messagingTemplate.convertAndSend("/topic/room-alerts/" + callerId, sendDto);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
