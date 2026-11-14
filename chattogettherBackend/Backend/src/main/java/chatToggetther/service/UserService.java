package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
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

import java.util.ArrayList;
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
        Long userId = SecurityUtils.extractUserId(jwtAuthenticationToken);
        if (userId == null) {
            return new ResponseData<>(200, "User không ở trong phòng nào", null);
        }

        UserEntity userEntity = this.userRepository.findById(userId).orElse(null);
        if (userEntity == null) {
            return new ResponseData<>(200, "User không ở trong phòng nào", null);
        }

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
        Long currentUserId = SecurityUtils.extractUserId(jwtAuthenticationToken);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

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
        dto.setEmail(targetUser.getEmail());
        dto.setPhone(targetUser.getPhone());
        dto.setActive(targetUser.getActive());
        dto.setRoles(targetUser.getRoles());

        // Đồng bộ Tần số FM cá nhân & Gu kết nối
        Double freq = targetUser.getPersonalFrequency();
        if (freq == null) {
            freq = Math.round((88.0 + Math.random() * 20.0) * 10.0) / 10.0;
            targetUser.setPersonalFrequency(freq);
            this.userRepository.save(targetUser);
        }
        dto.setPersonalFrequency(freq);
        dto.setFavoriteMusicId(targetUser.getFavoriteMusicId());
        dto.setMatchIntentCode(targetUser.getMatchIntentCode());

        // Phân quyền thực tế (không mock dữ liệu ảo)
        boolean isAdmin = targetUser.getRoles() != null && (targetUser.getRoles().contains("ROLE_AMDIN") || targetUser.getRoles().contains("ROLE_ADMIN"));
        dto.setIsVerified(isAdmin);
        dto.setLevel(null);
        dto.setStreakDays(null);

        if (isAdmin) {
            dto.setVipTier("ADMIN");
            dto.setCustomTitle("Quản trị viên");
        } else {
            dto.setVipTier("MEMBER");
            dto.setCustomTitle("Thành viên");
        }

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
        Long currentUserId = SecurityUtils.extractUserId(jwtAuthenticationToken);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

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
        if (request.getEmail() != null) {
            currentUser.setEmail(request.getEmail().trim());
        }
        if (request.getPhone() != null) {
            currentUser.setPhone(request.getPhone().trim());
        }
        if (request.getPersonalFrequency() != null) {
            double clamped = Math.max(88.0, Math.min(108.0, request.getPersonalFrequency()));
            currentUser.setPersonalFrequency(Math.round(clamped * 10.0) / 10.0);
        }
        if (request.getFavoriteMusicId() != null) {
            currentUser.setFavoriteMusicId(request.getFavoriteMusicId());
        }
        if (request.getMatchIntentCode() != null) {
            currentUser.setMatchIntentCode(request.getMatchIntentCode().trim());
        }

        this.userRepository.save(currentUser);

        return getUserProfile(jwtAuthenticationToken, currentUser.getId());
    }

    @Transactional
    public ResponseData<Boolean> changePassword(JwtAuthenticationToken jwtAuthenticationToken, chatToggetther.DataRequest.ChangePasswordRequest request) {
        Long userId = SecurityUtils.extractUserId(jwtAuthenticationToken);
        if (userId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }
        UserEntity user = this.userRepository.findById(userId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại", 404)
        );
        if (request.getOldPassword() == null || !passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new AppException(400, "Mật khẩu hiện tại không chính xác", 400);
        }
        if (request.getNewPassword() == null || request.getNewPassword().length() < 6) {
            throw new AppException(400, "Mật khẩu mới phải có ít nhất 6 ký tự", 400);
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        this.userRepository.save(user);
        return new ResponseData<>(200, "Đổi mật khẩu thành công", true);
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

    public ResponseData<List<UserDTO>> searchUsers(JwtAuthenticationToken token, String query) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }
        String rawQ = (query != null ? query.trim() : "");
        if (rawQ.isEmpty()) {
            return new ResponseData<>(200, "Vui lòng nhập từ khóa tìm kiếm", List.of());
        }

        // Tự động loại bỏ tiền tố '@' nếu người dùng tìm kiếm theo định dạng @account
        String cleanQ = rawQ.replaceAll("^@+", "").trim();
        String searchParam = cleanQ.isEmpty() ? rawQ : cleanQ;

        UserEntity currentUser = this.userRepository.findById(currentUserId).orElse(null);
        List<UserEntity> results = new ArrayList<>(this.userRepository.searchUsers(searchParam));

        // Ưu tiên đưa người dùng khớp chính xác username hoặc nickname lên vị trí đầu tiên
        results.sort((a, b) -> {
            boolean aExact = a.getAccount().equalsIgnoreCase(searchParam) || (a.getNickname() != null && a.getNickname().equalsIgnoreCase(searchParam));
            boolean bExact = b.getAccount().equalsIgnoreCase(searchParam) || (b.getNickname() != null && b.getNickname().equalsIgnoreCase(searchParam));
            if (aExact != bExact) return aExact ? -1 : 1;

            boolean aStarts = a.getAccount().toLowerCase().startsWith(searchParam.toLowerCase()) || (a.getNickname() != null && a.getNickname().toLowerCase().startsWith(searchParam.toLowerCase()));
            boolean bStarts = b.getAccount().toLowerCase().startsWith(searchParam.toLowerCase()) || (b.getNickname() != null && b.getNickname().toLowerCase().startsWith(searchParam.toLowerCase()));
            if (aStarts != bStarts) return aStarts ? -1 : 1;

            return 0;
        });

        List<UserDTO> dtoList = results.stream()
                .filter(u -> !u.getId().equals(currentUserId))
                .limit(25)
                .map(u -> {
                    UserDTO dto = new UserDTO();
                    dto.setId(u.getId());
                    dto.setAccount(u.getAccount());
                    dto.setNickname(u.getNickname() != null && !u.getNickname().isEmpty() ? u.getNickname() : u.getAccount());
                    dto.setAvatar(u.getAvatar());
                    dto.setLocation(u.getLocation());
                    dto.setBio(u.getBio());

                    if (currentUser != null) {
                        Optional<FriendshipEntity> fs = this.friendshipRepository.findFriendshipBetween(currentUser, u);
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
                    } else {
                        dto.setFriendshipStatus("NONE");
                    }
                    return dto;
                })
                .toList();

        return new ResponseData<>(200, "Tìm thấy " + dtoList.size() + " thành viên", dtoList);
    }
}
