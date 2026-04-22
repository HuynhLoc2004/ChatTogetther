package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.RoomDTO;
import chatToggetther.DTO.UserDTO;
import chatToggetther.DTO.UserRoomDTO;
import chatToggetther.DataRequest.RoomRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.RoomEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.modelEntity.UserRoomEntity;
import chatToggetther.repository.RoomRepository;
import chatToggetther.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class RoomService {
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    public RoomService(RoomRepository roomRepository, UserRepository userRepository) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ResponseData<Long> createRoom(JwtAuthenticationToken jwtAuthenticationToken , RoomRequest roomRequest){
        Long userId = jwtAuthenticationToken.getToken().getClaim("user_id");
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(()->{
            throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode(),  "user không tồn tại" , ErrorCode.USER_NOT_EXISTED.getStatusCode().value());
        });
        RoomEntity roomEntity = new RoomEntity();
        roomEntity.setActive(true);
        roomEntity.setRoomName(roomRequest.getNameRoom());
        roomEntity.setPassword(roomRequest.getPassword());
        roomEntity.setLocalDateTime(LocalDateTime.now());

        // tạo userroom
        UserRoomEntity userRoomEntity = new UserRoomEntity();
        userRoomEntity.setTimeJoin(LocalDateTime.now());
        userRoomEntity.setUserEntity(userEntity);
        userRoomEntity.setRoomEntity(roomEntity);

        roomEntity.getUserRoomEntityList().add(userRoomEntity);
        userEntity.setUserRoomEntity(userRoomEntity);

        this.roomRepository.save(roomEntity);
        return new  ResponseData<>(200 , "create room thành công" ,roomEntity.getId());
    }

    public ResponseData<List<RoomDTO>> getAllRoomActive(){
        List<RoomEntity> roomEntityList = this.roomRepository.getallRoomActive(true);
        List<RoomDTO> roomDTOList = roomEntityList.stream().map(item->{
                RoomDTO roomDTO = new RoomDTO();
                roomDTO.setId(item.getId());
                roomDTO.setNameroom(item.getRoomName());
                 List<UserRoomDTO> roomDTOS  = item.getUserRoomEntityList().stream().map(ur->{
                  UserRoomDTO userRoomDTO = new UserRoomDTO();
                  userRoomDTO.setId(ur.getId());
                  userRoomDTO.setTimeJoin(ur.getTimeJoin());
                  userRoomDTO.setTimeLeft(ur.getTimeLeft());
                  UserDTO userDTO = new UserDTO();
                  userDTO.setId(ur.getUserEntity().getId());
                  userDTO.setActive(ur.getUserEntity().getActive());
                  userDTO.setNickname(ur.getUserEntity().getNickname());
                  userRoomDTO.setUserDTO(userDTO);
                  return userRoomDTO;
              }).collect(Collectors.toList());
                 roomDTO.setUserRoomDTOList(roomDTOS);
                 return roomDTO;
        }).collect(Collectors.toList());
        return new ResponseData<>(200 , "get rooms thành công" , roomDTOList);
    }

}
