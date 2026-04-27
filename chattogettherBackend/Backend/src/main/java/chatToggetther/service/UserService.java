package chatToggetther.service;
import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.DataRequest.UserRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.ENUMS.PermissionUserEnum;
import chatToggetther.ENUMS.RoleUserEnum;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.UserRepository;
import chatToggetther.modelEntity.UserRoomEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);
    
    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public ResponseData<Long> getActiveRoom(JwtAuthenticationToken jwtAuthenticationToken) {
        Long userId = jwtAuthenticationToken.getToken().getClaim("user_id");
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(() -> {
            throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "user không tồn tại", ErrorCode.USER_NOT_EXISTED.getStatusCode().value());
        });

        UserRoomEntity userRoomEntity = userEntity.getUserRoomEntity();
        if (userRoomEntity != null && Boolean.TRUE.equals(userRoomEntity.getActive()) && userRoomEntity.getRoomEntity() != null) {
            return new ResponseData<>(200, "User đang ở trong phòng", userRoomEntity.getRoomEntity().getId());
        }

        return new ResponseData<>(200, "User không ở trong phòng nào", null);
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
