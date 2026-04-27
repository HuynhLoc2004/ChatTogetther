package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
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
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
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
            Long userId = jwtAuthenticationToken.getToken().getClaim("user_id");
            UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(()->{
                throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "không tồn tại user" , ErrorCode.USER_NOT_EXISTED.getStatusCode().value());
            });
            RoomEntity roomEntity = this.roomRepository.findById(user_room).orElseThrow(()->{
                throw new AppException(ErrorCode.ROOM_NOT_FOUND.getCode(),  "phòng không tồn tại" , ErrorCode.ROOM_NOT_FOUND.getStatusCode().value());
            });

            MessageEntity messageEntity = new MessageEntity();
            messageEntity.setMessage(messageRequest.getMessage());
            messageEntity.setTimeSend(LocalDateTime.now());
            messageEntity.setTimeRetrieve(messageRequest.getTimeSend());
            messageEntity.setUserEntity(userEntity);
            messageEntity.setRoomEntity(roomEntity);
            this.messageRepository.save(messageEntity);

            for(UserRoomEntity userRoomEntity : roomEntity.getUserRoomEntityList()){
                if(userRoomEntity.getUserEntity().getId().equals(userId) && Boolean.TRUE.equals(userRoomEntity.getActive())){
                    SendMessageDTO sendMessageDTO = new SendMessageDTO();
                    sendMessageDTO.setId(messageEntity.getId());
                    sendMessageDTO.setMessage(messageRequest.getMessage());
                    sendMessageDTO.setTimeSend(messageRequest.getTimeSend());
                    sendMessageDTO.setUserId(userId);
                    sendMessageDTO.setNickname(userEntity.getNickname());
                    
                    this.simpMessagingTemplate.convertAndSend("/topic/room/" + user_room, sendMessageDTO);
                    
                    return new ResponseData<>(ErrorCode.SUCCESS.getCode() , "gửi tin nhắn thành công" , true);
                }
            }

            throw new AppException(ErrorCode.NOT_IN_ROOM.getCode(), "Bạn không ở trong phòng này hoặc không còn hoạt động", ErrorCode.NOT_IN_ROOM.getStatusCode().value());
    }

    @Transactional
    public ResponseData<List<SendMessageDTO>> getMessageHistory(Long roomId) {
        List<MessageEntity> messages = this.messageRepository.findByRoomEntity_IdOrderByTimeSendAsc(roomId);
        List<SendMessageDTO> history = messages.stream().map(m -> {
            SendMessageDTO dto = new SendMessageDTO();
            dto.setId(m.getId());
            dto.setMessage(m.getMessage());
            dto.setTimeSend(m.getTimeRetrieve()); 
            dto.setUserId(m.getUserEntity() != null ? m.getUserEntity().getId() : 0L);
            dto.setNickname(m.getUserEntity() != null ? m.getUserEntity().getNickname() : "Hệ thống");
            return dto;
        }).collect(Collectors.toList());
        return new ResponseData<>(200, "Lấy lịch sử tin nhắn thành công", history);
    }
}
