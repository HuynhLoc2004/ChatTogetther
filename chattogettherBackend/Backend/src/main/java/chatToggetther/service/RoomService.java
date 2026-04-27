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
import jakarta.servlet.http.HttpServletResponse;
import jakarta.transaction.Transactional;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
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

        if (!userEntity.getPermissions().contains("ADMIN_ROOM")) {
            userEntity.getPermissions().add("ADMIN_ROOM");
        }
        this.userRepository.save(userEntity);

        String newAccessToken = this.authenticationService.genAccessToken(userEntity);
        this.authenticationService.genRefreshToken(userEntity, httpServletResponse);

        RoomEntity roomEntity = new RoomEntity();
        roomEntity.setActive(true);
        roomEntity.setRoomName(roomRequest.getNameRoom());
        roomEntity.setPassword(roomRequest.getPassword());
        roomEntity.setLocalDateTime(LocalDateTime.now());

        UserRoomEntity userRoomEntity = userEntity.getUserRoomEntity();
        if (userRoomEntity == null) {
            userRoomEntity = new UserRoomEntity();
            userRoomEntity.setUserEntity(userEntity);
        }
        
        userRoomEntity.getTimeJoin().add(LocalDateTime.now()); 
        userRoomEntity.setRoomEntity(roomEntity);
        userRoomEntity.setActive(true);
        userRoomEntity.setIsAdmin(true); 

        roomEntity.getUserRoomEntityList().add(userRoomEntity);
        userEntity.setUserRoomEntity(userRoomEntity);

        this.roomRepository.saveAndFlush(roomEntity);
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
                
                List<UserRoomDTO> roomDTOS = item.getUserRoomEntityList().stream()
                        .filter(ur -> Boolean.TRUE.equals(ur.getActive()))
                        .map(ur -> {
                            UserRoomDTO userRoomDTO = new UserRoomDTO();
                            userRoomDTO.setId(ur.getId());
                            if (ur.getTimeJoin() != null && !ur.getTimeJoin().isEmpty()) {
                                userRoomDTO.setTimeJoin(ur.getTimeJoin().get(ur.getTimeJoin().size() - 1));
                            }
                            userRoomDTO.setTimeLeft(ur.getTimeLeft());

                            UserDTO userDTO = new UserDTO();
                            if (ur.getUserEntity() != null) {
                                userDTO.setId(ur.getUserEntity().getId());
                                userDTO.setActive(ur.getUserEntity().getActive());
                                userDTO.setNickname(ur.getUserEntity().getNickname());
                            }
                            userRoomDTO.setUserDTO(userDTO);
                            userRoomDTO.setIsAdmin(ur.getIsAdmin());
                            return userRoomDTO;
                        }).collect(Collectors.toList());
                
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
          userRoomEntity.setIsAdmin(false);

          this.userRoomRepository.save(userRoomEntity);
          messagingTemplate.convertAndSend("/topic/rooms", "ROOM_UPDATED");
          
          SendMessageDTO systemMsg = new SendMessageDTO();
          systemMsg.setMessage(userEntity.getNickname() + " vừa vào phòng");
          systemMsg.setUserId(0L);
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
        if (userRoomEntity != null && userRoomEntity.getRoomEntity().getId().equals(idRoom) && Boolean.TRUE.equals(userRoomEntity.getActive())) {
            RoomEntity roomEntity = userRoomEntity.getRoomEntity();
            
            // RÀNG BUỘC: Nếu là Admin, chỉ được rời khi là người duy nhất
            if (Boolean.TRUE.equals(userRoomEntity.getIsAdmin())) {
                long activeUsers = this.userRoomRepository.countByRoomEntityAndActive(roomEntity, true);
                if (activeUsers > 1) {
                    throw new AppException(400, "Bạn là quản trị viên, vui lòng chuyển quyền hoặc giải tán nhóm trước khi rời phòng!", 400);
                }
            }

            userRoomEntity.setActive(false);
            if (userRoomEntity.getTimeLeft() == null) {
                userRoomEntity.setTimeLeft(new ArrayList<>());
            }
            userRoomEntity.getTimeLeft().add(LocalDateTime.now());
            userRoomEntity.setIsAdmin(false); // Reset quyền admin khi rời
            this.userRoomRepository.save(userRoomEntity);

            SendMessageDTO systemMsg = new SendMessageDTO();
            systemMsg.setMessage(userEntity.getNickname() + " đã rời khỏi phòng");
            systemMsg.setUserId(0L);
            systemMsg.setNickname("Hệ thống");
            systemMsg.setTimeSend(LocalDateTime.now());
            messagingTemplate.convertAndSend("/topic/room/" + idRoom, systemMsg);

            long activeUsers = this.userRoomRepository.countByRoomEntityAndActive(roomEntity, true);
            if (activeUsers == 0) {
                roomEntity.setActive(false);
                this.roomRepository.save(roomEntity);
                messagingTemplate.convertAndSend("/topic/rooms", "ROOM_DELETED");
            } else {
                messagingTemplate.convertAndSend("/topic/rooms", "ROOM_UPDATED");
            }

            return new ResponseData<>(200, "Rời phòng thành công", true);
        }
        return new ResponseData<>(400, "User không ở trong phòng này", false);
    }

    @Transactional
    public ResponseData<Boolean> removeUserFromRoom(JwtAuthenticationToken jwtAuthenticationToken, Long userIdToRemove, Long roomId) {
        Long adminId = jwtAuthenticationToken.getToken().getClaim("user_id");
        
        UserRoomEntity adminRoom = userRoomRepository.findAll().stream()
                .filter(ur -> ur.getUserEntity().getId().equals(adminId) && ur.getRoomEntity().getId().equals(roomId))
                .findFirst()
                .orElseThrow(() -> new AppException(403, "Bạn không có quyền quản trị trong phòng này", 403));

        if (!Boolean.TRUE.equals(adminRoom.getIsAdmin())) {
             throw new AppException(403, "Bạn không phải là quản trị viên của phòng này", 403);
        }

        UserEntity userToRemove = this.userRepository.findById(userIdToRemove).orElseThrow(() -> {
            throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "User cần xóa không tồn tại", 404);
        });

        UserRoomEntity userRoomEntity = userToRemove.getUserRoomEntity();
        if (userRoomEntity != null && userRoomEntity.getRoomEntity().getId().equals(roomId) && Boolean.TRUE.equals(userRoomEntity.getActive())) {
            userRoomEntity.setActive(false);
            if (userRoomEntity.getTimeLeft() == null) {
                userRoomEntity.setTimeLeft(new ArrayList<>());
            }
            userRoomEntity.getTimeLeft().add(LocalDateTime.now());
            this.userRoomRepository.save(userRoomEntity);

            SendMessageDTO systemMsg = new SendMessageDTO();
            systemMsg.setMessage(userToRemove.getNickname() + " đã bị mời ra khỏi phòng");
            systemMsg.setUserId(userIdToRemove); 
            systemMsg.setId(-1L); // Đánh dấu là KICK
            systemMsg.setNickname("Hệ thống");
            systemMsg.setTimeSend(LocalDateTime.now());
            
            messagingTemplate.convertAndSend("/topic/room/" + roomId, systemMsg);
            messagingTemplate.convertAndSend("/topic/rooms", "ROOM_UPDATED");

            return new ResponseData<>(200, "Đuổi thành viên " + userToRemove.getNickname() + " thành công", true);
        }
        return new ResponseData<>(400, "Người dùng này không ở trong phòng", false);
    }

    @Transactional
    public ResponseData<Boolean> disbandRoom(JwtAuthenticationToken jwtAuthenticationToken, Long roomId) {
        Long adminId = jwtAuthenticationToken.getToken().getClaim("user_id");
        RoomEntity roomEntity = roomRepository.findById(roomId).orElseThrow(() -> new AppException(404, "Phòng không tồn tại", 404));

        UserRoomEntity adminRoom = roomEntity.getUserRoomEntityList().stream()
                .filter(ur -> ur.getUserEntity().getId().equals(adminId) && Boolean.TRUE.equals(ur.getActive()))
                .findFirst()
                .orElseThrow(() -> new AppException(403, "Bạn không ở trong phòng này", 403));

        if (!Boolean.TRUE.equals(adminRoom.getIsAdmin())) {
            throw new AppException(403, "Chỉ quản trị viên mới có quyền giải tán phòng!", 403);
        }

        // Deactivate room and all members
        roomEntity.setActive(false);
        roomEntity.getUserRoomEntityList().forEach(ur -> {
            if (Boolean.TRUE.equals(ur.getActive())) {
                ur.setActive(false);
                if (ur.getTimeLeft() == null) ur.setTimeLeft(new ArrayList<>());
                ur.getTimeLeft().add(LocalDateTime.now());
                ur.setIsAdmin(false);
            }
        });

        this.roomRepository.saveAndFlush(roomEntity);

        // Notify global topic to refresh room list for everyone on Home page
        messagingTemplate.convertAndSend("/topic/rooms", "ROOM_DELETED");

        // Notify all clients in the specific room that room is disbanded
        SendMessageDTO systemMsg = new SendMessageDTO();
        systemMsg.setMessage("Phòng chat đã được giải tán bởi quản trị viên!");
        systemMsg.setId(-2L); // Đánh dấu là DISBAND
        systemMsg.setUserId(0L);
        systemMsg.setNickname("Hệ thống");
        systemMsg.setTimeSend(LocalDateTime.now());
        
        messagingTemplate.convertAndSend("/topic/room/" + roomId, systemMsg);
        messagingTemplate.convertAndSend("/topic/rooms", "ROOM_DELETED");

        return new ResponseData<>(200, "Giải tán phòng thành công", true);
    }

    @Transactional
    public ResponseData<Boolean> delegateAdmin(JwtAuthenticationToken jwtAuthenticationToken, Long roomId, Long newAdminUserId) {
        Long currentAdminId = jwtAuthenticationToken.getToken().getClaim("user_id");
        RoomEntity roomEntity = roomRepository.findById(roomId).orElseThrow(() -> new AppException(404, "Phòng không tồn tại", 404));

        UserRoomEntity currentAdminUR = roomEntity.getUserRoomEntityList().stream()
                .filter(ur -> ur.getUserEntity().getId().equals(currentAdminId) && Boolean.TRUE.equals(ur.getActive()))
                .findFirst()
                .orElseThrow(() -> new AppException(403, "Bạn không ở trong phòng này", 403));

        if (!Boolean.TRUE.equals(currentAdminUR.getIsAdmin())) {
            throw new AppException(403, "Chỉ quản trị viên mới có quyền ủy quyền!", 403);
        }

        UserRoomEntity newAdminUR = roomEntity.getUserRoomEntityList().stream()
                .filter(ur -> ur.getUserEntity().getId().equals(newAdminUserId) && Boolean.TRUE.equals(ur.getActive()))
                .findFirst()
                .orElseThrow(() -> new AppException(404, "Thành viên nhận quyền không tồn tại trong phòng!", 404));

        // Transfer rights
        currentAdminUR.setIsAdmin(false);
        newAdminUR.setIsAdmin(true);
        
        // Ensure new admin has global ADMIN_ROOM permission
        UserEntity newAdminUser = newAdminUR.getUserEntity();
        if (!newAdminUser.getPermissions().contains("ADMIN_ROOM")) {
            newAdminUser.getPermissions().add("ADMIN_ROOM");
            userRepository.save(newAdminUser);
        }

        userRoomRepository.save(currentAdminUR);
        userRoomRepository.save(newAdminUR);

        // Notify all clients
        SendMessageDTO systemMsg = new SendMessageDTO();
        systemMsg.setMessage(newAdminUser.getNickname() + " đã trở thành quản trị viên mới của phòng!");
        systemMsg.setId(0L);
        systemMsg.setUserId(0L);
        systemMsg.setNickname("Hệ thống");
        systemMsg.setTimeSend(LocalDateTime.now());
        
        messagingTemplate.convertAndSend("/topic/room/" + roomId, systemMsg);
        messagingTemplate.convertAndSend("/topic/rooms", "ROOM_UPDATED");

        return new ResponseData<>(200, "Ủy quyền quản trị thành công", true);
    }
}
