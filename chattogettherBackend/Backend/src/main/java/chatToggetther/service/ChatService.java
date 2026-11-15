package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.DTO.SendMessageDTO;
import chatToggetther.DataRequest.MessageRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.MessageEntity;
import chatToggetther.modelEntity.RoomEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.modelEntity.UserRoomEntity;
import chatToggetther.repository.MessageRepository;
import chatToggetther.repository.RoomRepository;
import chatToggetther.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Map;
import java.util.HashMap;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ChatService {
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final SimpMessagingTemplate simpMessagingTemplate;
    private final ObjectMapper objectMapper;

    public ChatService(RoomRepository roomRepository, UserRepository userRepository, MessageRepository messageRepository, SimpMessagingTemplate simpMessagingTemplate, ObjectMapper objectMapper) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ResponseData<Boolean> sendMessage(JwtAuthenticationToken jwtAuthenticationToken , MessageRequest messageRequest , Long user_room){
            if (messageRequest.getMessage() == null || messageRequest.getMessage().trim().isEmpty()) {
                throw new AppException(400, "Tin nhắn không được để trống", 400);
            }

            Long userId = SecurityUtils.extractUserId(jwtAuthenticationToken);
            UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(()->{
                throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "không tồn tại user" , ErrorCode.USER_NOT_EXISTED.getStatusCode().value());
            });
            RoomEntity roomEntity = this.roomRepository.findById(user_room).orElseThrow(()->{
                throw new AppException(ErrorCode.ROOM_NOT_FOUND.getCode(),  "phòng không tồn tại" , ErrorCode.ROOM_NOT_FOUND.getStatusCode().value());
            });

            // Tự động đảm bảo quyền và trạng thái hoạt động trong phòng trước khi gửi
            boolean isDm = roomEntity.getPassword() != null && roomEntity.getPassword().startsWith("DM_");
            Long partnerId = null;
            if (isDm) {
                String[] parts = roomEntity.getPassword().split("_");
                if (parts.length >= 3) {
                    try {
                        Long u1 = Long.parseLong(parts[1]);
                        Long u2 = Long.parseLong(parts[2]);
                        if (!userId.equals(u1) && !userId.equals(u2)) {
                            throw new AppException(403, "Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện riêng tư này", 403);
                        }
                        partnerId = userId.equals(u1) ? u2 : u1;
                    } catch (NumberFormatException ignored) {}
                }
            } else {
                UserRoomEntity myUr = roomEntity.getUserRoomEntityList().stream()
                        .filter(ur -> ur.getUserEntity() != null && ur.getUserEntity().getId().equals(userId))
                        .findFirst()
                        .orElse(null);

                if (myUr != null && !Boolean.TRUE.equals(myUr.getActive())) {
                    myUr.setActive(true);
                    this.roomRepository.save(roomEntity);
                }
            }

            LocalDateTime now = LocalDateTime.now();
            MessageEntity messageEntity = new MessageEntity();
            messageEntity.setMessage(messageRequest.getMessage().trim());
            messageEntity.setTimeSend(now);
            messageEntity.setTimeRetrieve(now);
            messageEntity.setUserEntity(userEntity);
            messageEntity.setRoomEntity(roomEntity);
            this.messageRepository.save(messageEntity);

            String senderNickname = (userEntity.getNickname() != null && !userEntity.getNickname().trim().isEmpty())
                    ? userEntity.getNickname() : userEntity.getAccount();
            String senderUsername = userEntity.getAccount();
            String senderAvatar = userEntity.getAvatar();

            SendMessageDTO sendMessageDTO = new SendMessageDTO();
            sendMessageDTO.setId(messageEntity.getId());
            sendMessageDTO.setMessage(messageEntity.getMessage());
            sendMessageDTO.setTimeSend(now);
            sendMessageDTO.setTime_retrieve(now);
            sendMessageDTO.setUserId(userId);
            sendMessageDTO.setSenderId(userId);
            sendMessageDTO.setNickname(senderNickname);
            sendMessageDTO.setSenderUsername(senderUsername);
            sendMessageDTO.setSenderAvatar(senderAvatar);
            sendMessageDTO.setAvatar(senderAvatar);
            sendMessageDTO.setFormattedTime(now.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")));
            
            this.simpMessagingTemplate.convertAndSend("/topic/room/" + user_room, sendMessageDTO);
            this.simpMessagingTemplate.convertAndSend("/topic/" + user_room, sendMessageDTO);
            if (partnerId != null) {
                this.simpMessagingTemplate.convertAndSend("/topic/messages/" + partnerId, sendMessageDTO);
                this.simpMessagingTemplate.convertAndSend("/topic/messages/" + userId, sendMessageDTO);
            }

            // Bắn sự kiện thông báo realtime (Floating Alert & Âm thanh & OS Notification) cho tin nhắn 1-1
            if (isDm && partnerId != null) {
                String contentPreview = messageEntity.getMessage();
                if (contentPreview != null && contentPreview.length() > 100) {
                    contentPreview = contentPreview.substring(0, 97) + "...";
                }
                java.util.Map<String, Object> dmAlertPayload = new java.util.HashMap<>();
                dmAlertPayload.put("roomId", roomEntity.getId());
                dmAlertPayload.put("roomName", senderNickname);
                dmAlertPayload.put("isDirect", true);
                dmAlertPayload.put("partnerId", userId);
                dmAlertPayload.put("senderId", userId);
                dmAlertPayload.put("senderUsername", senderUsername);
                dmAlertPayload.put("senderDisplayName", senderNickname);
                dmAlertPayload.put("senderAvatar", senderAvatar);
                dmAlertPayload.put("contentPreview", contentPreview);
                dmAlertPayload.put("createdAt", now.toString());

                this.simpMessagingTemplate.convertAndSendToUser(partnerId.toString(), "/queue/room-alerts", dmAlertPayload);
                this.simpMessagingTemplate.convertAndSend("/topic/room-alerts/" + partnerId, dmAlertPayload);
            }

            // Bắn sự kiện tin nhắn nhóm qua kênh riêng (tuyệt đối không tạo bản ghi Notification ở Chuông Sảnh)
            if (!isDm && roomEntity.getUserRoomEntityList() != null) {
                String contentPreview = messageEntity.getMessage();
                if (contentPreview != null && contentPreview.length() > 100) {
                    contentPreview = contentPreview.substring(0, 97) + "...";
                }
                java.util.Map<String, Object> alertPayload = new java.util.HashMap<>();
                alertPayload.put("roomId", roomEntity.getId());
                alertPayload.put("roomName", roomEntity.getRoomName());
                alertPayload.put("senderId", userId);
                alertPayload.put("senderUsername", senderUsername);
                alertPayload.put("senderDisplayName", senderNickname);
                alertPayload.put("senderAvatar", senderAvatar);
                alertPayload.put("contentPreview", contentPreview);
                alertPayload.put("createdAt", now.toString());

                for (UserRoomEntity ur : roomEntity.getUserRoomEntityList()) {
                    if (ur.getUserEntity() != null && Boolean.TRUE.equals(ur.getActive())) {
                        Long memberId = ur.getUserEntity().getId();
                        if (!memberId.equals(userId) && !Boolean.TRUE.equals(ur.getMuted())) {
                            this.simpMessagingTemplate.convertAndSendToUser(memberId.toString(), "/queue/room-alerts", alertPayload);
                            this.simpMessagingTemplate.convertAndSend("/topic/room-alerts/" + memberId, alertPayload);
                        }
                    }
                }
            }
            
            return new ResponseData<>(ErrorCode.SUCCESS.getCode() , "gửi tin nhắn thành công" , true);
    }

    @Transactional
    public ResponseData<List<SendMessageDTO>> getMessageHistory(JwtAuthenticationToken jwtAuthenticationToken, Long roomId, Long beforeId, Integer size) {
        if (roomId == null) {
            throw new AppException(400, "room_id không được để trống", 400);
        }

        Long userId = SecurityUtils.extractUserId(jwtAuthenticationToken);
        RoomEntity roomEntity = this.roomRepository.findById(roomId).orElseThrow(() -> {
            throw new AppException(ErrorCode.ROOM_NOT_FOUND.getCode(), "Phòng không tồn tại", ErrorCode.ROOM_NOT_FOUND.getStatusCode().value());
        });

        int pageSize = (size != null && size > 0 && size <= 100) ? size : 30;
        List<MessageEntity> messages = this.messageRepository.findMessagesBeforeId(roomId, beforeId, PageRequest.of(0, pageSize));
        
        // Sắp xếp lại theo thứ tự thời gian tăng dần để client hiển thị từ trên xuống dưới
        Collections.reverse(messages);

        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("HH:mm");

        List<SendMessageDTO> history = messages.stream().map(m -> {
            SendMessageDTO dto = new SendMessageDTO();
            dto.setId(m.getId());
            dto.setMessage(m.getMessage());
            LocalDateTime displayTime = m.getTimeSend() != null ? m.getTimeSend() : m.getTimeRetrieve();
            if (displayTime == null) {
                displayTime = LocalDateTime.now();
            }
            dto.setTimeSend(displayTime); 
            dto.setFormattedTime(displayTime.format(formatter));
            
            if (m.getUserEntity() != null) {
                UserEntity u = m.getUserEntity();
                dto.setUserId(u.getId());
                dto.setSenderId(u.getId());
                String nickname = (u.getNickname() != null && !u.getNickname().trim().isEmpty())
                        ? u.getNickname() : u.getAccount();
                dto.setNickname(nickname);
                dto.setSenderUsername(u.getAccount());
                dto.setSenderAvatar(u.getAvatar());
                dto.setAvatar(u.getAvatar());
            } else {
                dto.setUserId(0L);
                dto.setSenderId(0L);
                dto.setNickname("Hệ thống");
                dto.setSenderUsername("system");
                dto.setSenderAvatar(null);
                dto.setAvatar(null);
            }
            return dto;
        }).collect(Collectors.toList());
        return new ResponseData<>(200, "Lấy lịch sử tin nhắn thành công", history);
    }

    @Transactional
    public ResponseData<Map<String, Object>> getOrCreateDirectRoom(JwtAuthenticationToken token, Long targetUserId) {
        return getOrCreateDirectRoom(token, targetUserId != null ? targetUserId.toString() : null);
    }

    @Transactional
    public ResponseData<Map<String, Object>> getOrCreateDirectRoom(JwtAuthenticationToken token, String targetIdentifier) {
        UserEntity me = SecurityUtils.getAuthenticatedUser(token, userRepository);
        if (me == null) {
            throw new AppException(401, "Yêu cầu đăng nhập hoặc phiên làm việc đã hết hạn", 401);
        }
        Long myId = me.getId();

        if (targetIdentifier == null || targetIdentifier.trim().isEmpty()) {
            throw new AppException(400, "Thiếu thông tin người nhận", 400);
        }

        String targetStr = targetIdentifier.trim();
        UserEntity target = null;

        // 1. Thử tìm theo ID số
        try {
            Long targetIdNum = Long.parseLong(targetStr);
            target = userRepository.findById(targetIdNum).orElse(null);
        } catch (NumberFormatException ignored) {}

        // 2. Thử tìm theo account (username)
        if (target == null) {
            target = userRepository.findByAccount(targetStr).orElse(null);
        }

        // 3. Thử tìm theo nickname hoặc account không phân biệt hoa thường
        if (target == null) {
            List<UserEntity> allUsers = userRepository.findAll();
            target = allUsers.stream()
                    .filter(u -> targetStr.equalsIgnoreCase(u.getAccount()) || 
                                 targetStr.equalsIgnoreCase(u.getNickname()))
                    .findFirst()
                    .orElse(null);
        }

        if (target == null) {
            throw new AppException(404, "Không tìm thấy người dùng nhận", 404);
        }

        Long targetUserId = target.getId();
        if (myId.equals(targetUserId)) {
            throw new AppException(400, "Không thể tạo đoạn chat với chính mình", 400);
        }

        String directKey = "DM_" + Math.min(myId, targetUserId) + "_" + Math.max(myId, targetUserId);

        // 1. Tìm kiếm Idempotent phòng chat 1-1 bằng directKey
        RoomEntity dmRoom = roomRepository.findByPassword(directKey).orElse(null);
        if (dmRoom == null) {
            List<RoomEntity> existing = roomRepository.findAll();
            dmRoom = existing.stream()
                    .filter(r -> directKey.equals(r.getPassword()))
                    .findFirst()
                    .orElse(null);
        }

        if (dmRoom != null) {
            if (!Boolean.TRUE.equals(dmRoom.getActive())) {
                dmRoom.setActive(true);
                dmRoom = roomRepository.save(dmRoom);
            }
        } else {
            String myName = (me.getNickname() != null && !me.getNickname().trim().isEmpty()) ? me.getNickname() : me.getAccount();
            String targetName = (target.getNickname() != null && !target.getNickname().trim().isEmpty()) ? target.getNickname() : target.getAccount();

            dmRoom = new RoomEntity();
            dmRoom.setActive(true);
            dmRoom.setRoomName("Chat: " + myName + " & " + targetName + "_" + directKey);
            dmRoom.setDescription("Cuộc trò chuyện riêng tư 1-1");
            dmRoom.setPassword(directKey);
            dmRoom.setAvatar(target.getAvatar() != null ? target.getAvatar() : me.getAvatar());
            dmRoom.setLocalDateTime(LocalDateTime.now());
            dmRoom.setUserRoomEntityList(new ArrayList<>());

            try {
                // Tuyệt đối không tạo UserRoomEntity cho phòng DM để tránh xung đột với phòng công cộng
                dmRoom = roomRepository.saveAndFlush(dmRoom);
            } catch (Exception ex) {
                // Nếu bị duplicate do 2 bên cùng nhấn mở đồng thời
                dmRoom = roomRepository.findByPassword(directKey)
                        .orElseGet(() -> roomRepository.findAll().stream()
                                .filter(r -> directKey.equals(r.getPassword()))
                                .findFirst()
                                .orElse(null));
                if (dmRoom == null) {
                    throw new AppException(500, "Không thể khởi tạo cuộc trò chuyện: " + ex.getMessage(), 500);
                }
            }
        }

        Map<String, Object> targetData = new HashMap<>();
        targetData.put("id", target.getId());
        targetData.put("nickname", target.getNickname() != null ? target.getNickname() : target.getAccount());
        targetData.put("account", target.getAccount());
        targetData.put("avatar", target.getAvatar() != null ? target.getAvatar() : "");

        Map<String, Object> res = new HashMap<>();
        res.put("roomId", dmRoom.getId());
        res.put("roomName", dmRoom.getRoomName());
        res.put("targetUser", targetData);

        return new ResponseData<>(200, "Lấy phòng chat 1-1 thành công", res);
    }

}
