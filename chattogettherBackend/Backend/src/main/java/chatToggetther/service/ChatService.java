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

            // Tự động đảm bảo thành viên đang hoạt động trong phòng trước khi gửi
            UserRoomEntity myUr = roomEntity.getUserRoomEntityList().stream()
                    .filter(ur -> ur.getUserEntity() != null && ur.getUserEntity().getId().equals(userId))
                    .findFirst()
                    .orElse(null);

            if (myUr == null) {
                myUr = new UserRoomEntity();
                myUr.setRoomEntity(roomEntity);
                myUr.setUserEntity(userEntity);
                myUr.setActive(true);
                roomEntity.getUserRoomEntityList().add(myUr);
                this.roomRepository.save(roomEntity);
            } else if (!Boolean.TRUE.equals(myUr.getActive())) {
                myUr.setActive(true);
                this.roomRepository.save(roomEntity);
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

            SendMessageDTO sendMessageDTO = new SendMessageDTO();
            sendMessageDTO.setId(messageEntity.getId());
            sendMessageDTO.setMessage(messageEntity.getMessage());
            sendMessageDTO.setTimeSend(now);
            sendMessageDTO.setTime_retrieve(now);
            sendMessageDTO.setUserId(userId);
            sendMessageDTO.setNickname(senderNickname);
            sendMessageDTO.setFormattedTime(now.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")));
            
            this.simpMessagingTemplate.convertAndSend("/topic/room/" + user_room, sendMessageDTO);
            this.simpMessagingTemplate.convertAndSend("/topic/" + user_room, sendMessageDTO);
            
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
            dto.setUserId(m.getUserEntity() != null ? m.getUserEntity().getId() : 0L);
            String nickname = "Hệ thống";
            if (m.getUserEntity() != null) {
                nickname = (m.getUserEntity().getNickname() != null && !m.getUserEntity().getNickname().trim().isEmpty())
                        ? m.getUserEntity().getNickname() : m.getUserEntity().getAccount();
            }
            dto.setNickname(nickname);
            return dto;
        }).collect(Collectors.toList());
        return new ResponseData<>(200, "Lấy lịch sử tin nhắn thành công", history);
    }

    @Transactional
    public ResponseData<Map<String, Object>> getOrCreateDirectRoom(JwtAuthenticationToken token, Long targetUserId) {
        Long myId = SecurityUtils.extractUserId(token);
        if (myId.equals(targetUserId)) {
            throw new AppException(400, "Không thể tạo đoạn chat với chính mình", 400);
        }
        UserEntity me = userRepository.findById(myId)
                .orElseThrow(() -> new AppException(404, "Không tìm thấy người dùng hiện tại", 404));
        UserEntity target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new AppException(404, "Không tìm thấy người dùng nhận", 404));

        String directKey = "DM_" + Math.min(myId, targetUserId) + "_" + Math.max(myId, targetUserId);

        List<RoomEntity> existing = roomRepository.findAll();
        RoomEntity dmRoom = existing.stream()
                .filter(r -> Boolean.TRUE.equals(r.getActive()) && directKey.equals(r.getPassword()))
                .findFirst()
                .orElse(null);

        if (dmRoom == null) {
            String myName = me.getNickname() != null && !me.getNickname().isEmpty() ? me.getNickname() : me.getAccount();
            String targetName = target.getNickname() != null && !target.getNickname().isEmpty() ? target.getNickname() : target.getAccount();

            dmRoom = new RoomEntity();
            dmRoom.setActive(true);
            dmRoom.setRoomName(myName + " & " + targetName);
            dmRoom.setDescription("Cuộc trò chuyện riêng tư 1-1");
            dmRoom.setPassword(directKey);
            dmRoom.setAvatar(target.getAvatar());
            dmRoom.setLocalDateTime(LocalDateTime.now());

            UserRoomEntity urMe = new UserRoomEntity();
            urMe.setUserEntity(me);
            urMe.setRoomEntity(dmRoom);
            urMe.setActive(true);
            urMe.setIsAdmin(true);
            urMe.getTimeJoin().add(LocalDateTime.now());
            dmRoom.getUserRoomEntityList().add(urMe);

            UserRoomEntity urTarget = new UserRoomEntity();
            urTarget.setUserEntity(target);
            urTarget.setRoomEntity(dmRoom);
            urTarget.setActive(true);
            urTarget.setIsAdmin(false);
            urTarget.getTimeJoin().add(LocalDateTime.now());
            dmRoom.getUserRoomEntityList().add(urTarget);

            roomRepository.saveAndFlush(dmRoom);
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
