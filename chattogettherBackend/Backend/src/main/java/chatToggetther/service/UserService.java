package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.UserDTO;
import chatToggetther.DataRequest.UpdateProfileRequest;
import chatToggetther.DataRequest.UserRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.ENUMS.PermissionUserEnum;
import chatToggetther.ENUMS.RoleUserEnum;
import chatToggetther.modelEntity.FriendshipEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.modelEntity.UserRoomEntity;
import chatToggetther.repository.FriendshipRepository;
import chatToggetther.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);
    
    public UserService(UserRepository userRepository, FriendshipRepository friendshipRepository) {
        this.userRepository = userRepository;
        this.friendshipRepository = friendshipRepository;
    }

    @Transactional(readOnly = true)
    public ResponseData<Long> getActiveRoom(JwtAuthenticationToken jwtAuthenticationToken) {
        Long userId = jwtAuthenticationToken.getToken().getClaim("user_id");
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(() -> {
            throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "user không tồn tại", ErrorCode.USER_NOT_EXISTED.getStatusCode().value());
        });

        UserRoomEntity userRoomEntity = userEntity.getUserRoomEntity();
        if (userRoomEntity != null && Boolean.TRUE.equals(userRoomEntity.getActive()) && userRoomEntity.getRoomEntity() != null) {
            if (Boolean.TRUE.equals(userRoomEntity.getRoomEntity().getActive())) {
                return new ResponseData<>(200, "User đang ở trong phòng", userRoomEntity.getRoomEntity().getId());
            }
        }

        return new ResponseData<>(200, "User không ở trong phòng nào", null);
    }

    @Transactional(readOnly = true)
    public ResponseData<UserDTO> getUserProfile(JwtAuthenticationToken jwtAuthenticationToken, Long targetUserId) {
        Long currentUserId = jwtAuthenticationToken.getToken().getClaim("user_id");
        Long lookupId = (targetUserId != null) ? targetUserId : currentUserId;

        UserEntity targetUser = this.userRepository.findById(lookupId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại", 404)
        );

        UserEntity currentUser = this.userRepository.findById(currentUserId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng hiện tại không hợp lệ", 401)
        );

        UserDTO dto = new UserDTO();
        dto.setId(targetUser.getId());
        dto.setAccount(targetUser.getAccount());
        dto.setNickname(targetUser.getNickname() != null && !targetUser.getNickname().isEmpty() ? targetUser.getNickname() : targetUser.getAccount());
        dto.setAvatar(targetUser.getAvatar());
        dto.setAge(targetUser.getAge());
        dto.setLocation(targetUser.getLocation());
        dto.setBio(targetUser.getBio());
        dto.setActive(targetUser.getActive());

        if (currentUserId.equals(lookupId)) {
            dto.setFriendshipStatus("SELF");
        } else {
            Optional<FriendshipEntity> fs = this.friendshipRepository.findFriendshipBetween(currentUser, targetUser);
            if (fs.isPresent()) {
                FriendshipEntity f = fs.get();
                if ("ACCEPTED".equalsIgnoreCase(f.getStatus())) {
                    dto.setFriendshipStatus("ACCEPTED");
                } else if ("PENDING".equalsIgnoreCase(f.getStatus())) {
                    if (f.getUser().getId().equals(currentUserId)) {
                        dto.setFriendshipStatus("PENDING_SENT");
                    } else {
                        dto.setFriendshipStatus("PENDING_RECEIVED");
                    }
                } else {
                    dto.setFriendshipStatus("NONE");
                }
            } else {
                dto.setFriendshipStatus("NONE");
            }
        }

        return new ResponseData<>(200, "Lấy thông tin cá nhân thành công", dto);
    }

    @Transactional
    public ResponseData<UserDTO> updateUserProfile(JwtAuthenticationToken jwtAuthenticationToken, UpdateProfileRequest request) {
        Long currentUserId = jwtAuthenticationToken.getToken().getClaim("user_id");
        UserEntity currentUser = this.userRepository.findById(currentUserId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại", 404)
        );

        if (request.getNickname() != null && !request.getNickname().trim().isEmpty()) {
            currentUser.setNickname(request.getNickname().trim());
        }
        if (request.getAvatar() != null) {
            currentUser.setAvatar(request.getAvatar().trim());
        }
        if (request.getAge() != null) {
            currentUser.setAge(request.getAge());
        }
        if (request.getLocation() != null) {
            currentUser.setLocation(request.getLocation().trim());
        }
        if (request.getBio() != null) {
            currentUser.setBio(request.getBio().trim());
        }

        this.userRepository.save(currentUser);

        UserDTO dto = new UserDTO();
        dto.setId(currentUser.getId());
        dto.setAccount(currentUser.getAccount());
        dto.setNickname(currentUser.getNickname());
        dto.setAvatar(currentUser.getAvatar());
        dto.setAge(currentUser.getAge());
        dto.setLocation(currentUser.getLocation());
        dto.setBio(currentUser.getBio());
        dto.setActive(currentUser.getActive());
        dto.setFriendshipStatus("SELF");

        return new ResponseData<>(200, "Cập nhật thông tin cá nhân thành công", dto);
    }

    public ResponseData<Boolean> create_user(UserRequest userRequest){
         if(this.userRepository.existsByAccount(userRequest.getAccount())){
             throw new AppException(ErrorCode.USER_EXISTED.getCode() , ErrorCode.USER_EXISTED.getMessage() , ErrorCode.USER_EXISTED.getStatusCode().value());
         }else{
             UserEntity userEntity = new UserEntity();
             userEntity.setAccount(userRequest.getAccount());
             userEntity.setPassword(passwordEncoder.encode(userRequest.getPassword()));
             userEntity.setRoles(List.of(RoleUserEnum.ROLE_USER.toString()));
             userEntity.setPermissions(List.of(PermissionUserEnum.READ.toString() , PermissionUserEnum.UPDATE.toString() , PermissionUserEnum.WRITE.toString()));
             userRepository.save(userEntity);
             return new ResponseData<Boolean>(ErrorCode.CREATED_SUCCESS.getCode(), ErrorCode.CREATED_SUCCESS.getMessage(), true);
         }
    }
}
