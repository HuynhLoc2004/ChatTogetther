package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.RoomDTO;
import chatToggetther.DTO.UserDTO;
import chatToggetther.DTO.UserRoomDTO;
import chatToggetther.DTO.SendMessageDTO;
import chatToggetther.DTO.CreateRoomResponseDTO;
import chatToggetther.DataRequest.JoinRoomRequest;
import chatToggetther.DataRequest.RoomRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.RoomEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.modelEntity.UserRoomEntity;
import chatToggetther.repository.RoomRepository;
import chatToggetther.repository.UserRepository;
import chatToggetther.repository.UserRoomRepository;
import io.jsonwebtoken.Jwt;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class RoomService {
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final UserRoomRepository userRoomRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final AuthenticationService authenticationService;

    public RoomService(RoomRepository roomRepository, UserRepository userRepository, UserRoomRepository userRoomRepository, SimpMessagingTemplate messagingTemplate, AuthenticationService authenticationService) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.userRoomRepository = userRoomRepository;
        this.messagingTemplate = messagingTemplate;
        this.authenticationService = authenticationService;
    }

    @Transactional
    public ResponseData<CreateRoomResponseDTO> createRoom(JwtAuthenticationToken jwtAuthenticationToken , RoomRequest roomRequest, HttpServletResponse httpServletResponse){
        Long userId = jwtAuthenticationToken.getToken().getClaim("user_id");
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(()->{
            throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode(),  "user không tồn tại" , ErrorCode.USER_NOT_EXISTED.getStatusCode().value());
        });

        if (roomRequest.getNickname() != null && !roomRequest.getNickname().isEmpty()) {
            userEntity.setNickname(roomRequest.getNickname());
        }

        // Cấp quyền AD_ROOM cho người tạo phòng
        if (!userEntity.getPermissions().contains("AD_ROOM")) {
            userEntity.getPermissions().add("AD_ROOM");
        }
        this.userRepository.save(userEntity);

        // Tạo lại token mới chứa quyền AD_ROOM
        String newAccessToken = this.authenticationService.genAccessToken(userEntity);
        this.authenticationService.genRefreshToken(userEntity, httpServletResponse);

        RoomEntity roomEntity = new RoomEntity();
        roomEntity.setActive(true);
        roomEntity.setRoomName(roomRequest.getNameRoom());
        roomEntity.setPassword(roomRequest.getPassword());
        roomEntity.setLocalDateTime(LocalDateTime.now());

        // tạo hoặc tái sử dụng userroom
        UserRoomEntity userRoomEntity = userEntity.getUserRoomEntity();
        if (userRoomEntity == null) {
            userRoomEntity = new UserRoomEntity();
            userRoomEntity.setUserEntity(userEntity);
        }
        
        userRoomEntity.getTimeJoin().add(LocalDateTime.now()); 
        userRoomEntity.setRoomEntity(roomEntity);
        userRoomEntity.setActive(true);

        roomEntity.getUserRoomEntityList().add(userRoomEntity);
        userEntity.setUserRoomEntity(userRoomEntity);

        this.roomRepository.save(roomEntity);

        // Gửi tín hiệu thông báo có phòng mới tạo đến tất cả mọi người qua WebSocket
        messagingTemplate.convertAndSend("/topic/rooms", "NEW_ROOM_CREATED");

        return new ResponseData<>(200 , "create room thành công" , new CreateRoomResponseDTO(roomEntity.getId(), newAccessToken));
    }

    @Transactional
    public ResponseData<List<RoomDTO>> getAllRoomActive(){
        List<RoomEntity> roomEntityList = this.roomRepository.getallRoomActive(true);
        List<RoomDTO> roomDTOList = roomEntityList.stream().map(item->{
                RoomDTO roomDTO = new RoomDTO();
                roomDTO.setId(item.getId());
                roomDTO.setNameroom(item.getRoomName());
                
                List<UserRoomDTO> roomDTOS = new ArrayList<>();
                if (item.getUserRoomEntityList() != null) {
                    roomDTOS = item.getUserRoomEntityList().stream()
                        .filter(ur -> ur.getActive() != null && ur.getActive())
                        .map(ur -> {
                            UserRoomDTO userRoomDTO = new UserRoomDTO();
                            userRoomDTO.setId(ur.getId());
                            if (ur.getTimeJoin() != null && !ur.getTimeJoin().isEmpty()) {
                                userRoomDTO.setTimeJoin(ur.getTimeJoin().get(ur.getTimeJoin().size() - 1));
                            }
                            // Trả về toàn bộ danh sách lịch sử logout
                            userRoomDTO.setTimeLeft(ur.getTimeLeft());

                            UserDTO userDTO = new UserDTO();
                            if (ur.getUserEntity() != null) {
                                userDTO.setId(ur.getUserEntity().getId());
                                userDTO.setActive(ur.getUserEntity().getActive());
                                userDTO.setNickname(ur.getUserEntity().getNickname());
                            }
                            userRoomDTO.setUserDTO(userDTO);
                            return userRoomDTO;
                        }).collect(Collectors.toList());
                }
                
                roomDTO.setUserRoomDTOList(roomDTOS);
                roomDTO.setSoluong((long) roomDTOS.size());
                
                return roomDTO;
        }).collect(Collectors.toList());
        return new ResponseData<>(200 , "get rooms thành công" , roomDTOList);
    }

    @Transactional
    public ResponseData<Long> joinRoom(JwtAuthenticationToken jwtAuthenticationToken ,Long idRoom, JoinRoomRequest joinRoomRequest){
          Long userId = jwtAuthenticationToken.getToken().getClaim("user_id");
          UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(()->{
              throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode(),  "user không tồn tại" , ErrorCode.USER_NOT_EXISTED.getStatusCode().value());
          });

          RoomEntity roomEntity = this.roomRepository.findById(idRoom).orElseThrow(()->{
              throw new AppException(ErrorCode.ROOM_NOT_FOUND.getCode(),  "phòng không tồn tại" , ErrorCode.ROOM_NOT_FOUND.getStatusCode().value());
          });

          if (joinRoomRequest.getNickname() != null && !joinRoomRequest.getNickname().isEmpty()) {
              userEntity.setNickname(joinRoomRequest.getNickname());
              this.userRepository.save(userEntity);
          }

          UserRoomEntity userRoomEntity = userEntity.getUserRoomEntity();
          
          if (userRoomEntity == null) {
              userRoomEntity = new UserRoomEntity();
              userRoomEntity.setUserEntity(userEntity);
          }
          
          userRoomEntity.setRoomEntity(roomEntity);
          userRoomEntity.getTimeJoin().add(LocalDateTime.now()); 
          userRoomEntity.setActive(true);

          this.userRoomRepository.save(userRoomEntity);

          // Thông báo cập nhật danh sách phòng chung
          messagingTemplate.convertAndSend("/topic/rooms", "ROOM_UPDATED");
          
          // Thông báo cho mọi người TRONG PHÒNG là có người mới vào
          SendMessageDTO systemMsg = new SendMessageDTO();
          systemMsg.setMessage(userEntity.getNickname() + " vừa vào phòng");
          systemMsg.setUserId(0L); // 0 là system
          systemMsg.setNickname("Hệ thống");
          systemMsg.setTimeSend(LocalDateTime.now());
          messagingTemplate.convertAndSend("/topic/room/" + idRoom, systemMsg);

          return new ResponseData<>(200 , "tham gia phòng thành công" , roomEntity.getId());
    }

    @Transactional
    public ResponseData<Boolean> leaveRoom(JwtAuthenticationToken jwtAuthenticationToken, Long idRoom) {
        Long userId = jwtAuthenticationToken.getToken().getClaim("user_id");
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(() -> {
            throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "user không tồn tại", ErrorCode.USER_NOT_EXISTED.getStatusCode().value());
        });

        UserRoomEntity userRoomEntity = userEntity.getUserRoomEntity();
        if (userRoomEntity != null && userRoomEntity.getRoomEntity().getId().equals(idRoom) && userRoomEntity.getActive()) {
            RoomEntity roomEntity = userRoomEntity.getRoomEntity();
            
            userRoomEntity.setActive(false);
            
            List<LocalDateTime> timeLeftList = userRoomEntity.getTimeLeft();
            if (timeLeftList == null) {
                timeLeftList = new ArrayList<>();
                userRoomEntity.setTimeLeft(timeLeftList);
            }
            timeLeftList.add(LocalDateTime.now());
            
            this.userRoomRepository.save(userRoomEntity);

            // Thông báo cho mọi người TRONG PHÒNG là có người rời phòng
            SendMessageDTO systemMsg = new SendMessageDTO();
            systemMsg.setMessage(userEntity.getNickname() + " đã rời khỏi phòng");
            systemMsg.setUserId(0L);
            systemMsg.setNickname("Hệ thống");
            systemMsg.setTimeSend(LocalDateTime.now());
            messagingTemplate.convertAndSend("/topic/room/" + idRoom, systemMsg);

            // Kiểm tra số lượng user còn lại trong phòng
            long activeUsers = this.userRoomRepository.countByRoomEntityAndActive(roomEntity, true);
            
            if (activeUsers == 0) {
                // Nếu không còn ai, chuyển trạng thái active sang false
                roomEntity.setActive(false);
                this.roomRepository.save(roomEntity);
                messagingTemplate.convertAndSend("/topic/rooms", "ROOM_DELETED");
            } else {
                // Nếu vẫn còn người, chỉ thông báo cập nhật
                messagingTemplate.convertAndSend("/topic/rooms", "ROOM_UPDATED");
            }

            return new ResponseData<>(200, "Rời phòng thành công", true);
        }
        return new ResponseData<>(400, "User không ở trong phòng này", false);
    }

    @Transactional
    public ResponseData<Boolean> removeUserFromRoom(Long userIdToRemove, Long roomId) {
        UserEntity userToRemove = this.userRepository.findById(userIdToRemove).orElseThrow(() -> {
            throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "User cần xóa không tồn tại", 404);
        });

        UserRoomEntity userRoomEntity = userToRemove.getUserRoomEntity();
        if (userRoomEntity != null && userRoomEntity.getRoomEntity().getId().equals(roomId) && userRoomEntity.getActive()) {
            userRoomEntity.setActive(false);
            if (userRoomEntity.getTimeLeft() == null) {
                userRoomEntity.setTimeLeft(new ArrayList<>());
            }
            userRoomEntity.getTimeLeft().add(LocalDateTime.now());
            this.userRoomRepository.save(userRoomEntity);

            // Thông báo qua WebSocket là người này bị đuổi
            SendMessageDTO systemMsg = new SendMessageDTO();
            systemMsg.setMessage(userToRemove.getNickname() + " đã bị mời ra khỏi phòng");
            systemMsg.setUserId(-1L); // -1 để FE biết là bị KICK
            systemMsg.setNickname("Hệ thống");
            systemMsg.setTimeSend(LocalDateTime.now());
            messagingTemplate.convertAndSend("/topic/room/" + roomId, systemMsg);

            messagingTemplate.convertAndSend("/topic/rooms", "ROOM_UPDATED");

            return new ResponseData<>(200, "Đuổi người dùng thành công", true);
        }
        return new ResponseData<>(400, "Người dùng này không ở trong phòng", false);
    }

}
