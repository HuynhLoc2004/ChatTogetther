package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.UserDTO;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.FriendshipEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.FriendshipRepository;
import chatToggetther.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class FriendService {
    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public FriendService(UserRepository userRepository, FriendshipRepository friendshipRepository, SimpMessagingTemplate messagingTemplate) {
        this.userRepository = userRepository;
        this.friendshipRepository = friendshipRepository;
        this.messagingTemplate = messagingTemplate;
    }

    private UserDTO mapToDTO(UserEntity u, String status) {
        UserDTO dto = new UserDTO();
        dto.setId(u.getId());
        dto.setAccount(u.getAccount());
        dto.setNickname(u.getNickname() != null && !u.getNickname().isEmpty() ? u.getNickname() : u.getAccount());
        dto.setAvatar(u.getAvatar());
        dto.setAge(u.getAge());
        dto.setLocation(u.getLocation());
        dto.setBio(u.getBio());
        dto.setActive(u.getActive());
        dto.setFriendshipStatus(status);
        return dto;
    }

    @Transactional
    public ResponseData<Boolean> sendFriendRequest(JwtAuthenticationToken token, Long receiverId) {
        Long senderId = token.getToken().getClaim("user_id");
        if (senderId.equals(receiverId)) {
            throw new AppException(400, "Bạn không thể gửi lời mời kết bạn cho chính mình", 400);
        }

        UserEntity sender = userRepository.findById(senderId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng gửi không tồn tại", 404)
        );
        UserEntity receiver = userRepository.findById(receiverId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng nhận không tồn tại", 404)
        );

        Optional<FriendshipEntity> existing = friendshipRepository.findFriendshipBetween(sender, receiver);
        if (existing.isPresent()) {
            FriendshipEntity f = existing.get();
            if ("ACCEPTED".equalsIgnoreCase(f.getStatus())) {
                throw new AppException(400, "Hai bạn đã là bạn bè từ trước", 400);
            }
            if ("PENDING".equalsIgnoreCase(f.getStatus())) {
                if (f.getUser().getId().equals(senderId)) {
                    throw new AppException(400, "Bạn đã gửi lời mời kết bạn rồi, vui lòng đợi phản hồi", 400);
                } else {
                    // Nếu đối phương đã gửi cho mình trước đó -> Tự động chấp nhận luôn!
                    f.setStatus("ACCEPTED");
                    friendshipRepository.save(f);
                    return new ResponseData<>(200, "Đã chấp nhận kết bạn!", true);
                }
            }
        }

        FriendshipEntity friendship = new FriendshipEntity();
        friendship.setUser(sender);
        friendship.setFriend(receiver);
        friendship.setStatus("PENDING");
        friendship.setCreatedAt(LocalDateTime.now());
        friendshipRepository.save(friendship);

        // Báo cho receiver qua WebSocket
        messagingTemplate.convertAndSend("/topic/user/" + receiverId, "FRIEND_REQUEST_RECEIVED");

        return new ResponseData<>(200, "Đã gửi lời mời kết bạn thành công", true);
    }

    @Transactional
    public ResponseData<Boolean> acceptFriendRequest(JwtAuthenticationToken token, Long senderId) {
        Long receiverId = token.getToken().getClaim("user_id");
        UserEntity receiver = userRepository.findById(receiverId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "User không tồn tại", 404)
        );
        UserEntity sender = userRepository.findById(senderId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "User không tồn tại", 404)
        );

        Optional<FriendshipEntity> existing = friendshipRepository.findFriendshipBetween(sender, receiver);
        if (existing.isEmpty() || !"PENDING".equalsIgnoreCase(existing.get().getStatus())) {
            throw new AppException(400, "Không tìm thấy lời mời kết bạn phù hợp", 400);
        }

        FriendshipEntity f = existing.get();
        f.setStatus("ACCEPTED");
        friendshipRepository.save(f);

        // Báo cho cả 2 qua WebSocket
        messagingTemplate.convertAndSend("/topic/user/" + senderId, "FRIEND_REQUEST_ACCEPTED");
        messagingTemplate.convertAndSend("/topic/user/" + receiverId, "FRIEND_REQUEST_ACCEPTED");

        return new ResponseData<>(200, "Đã chấp nhận kết bạn", true);
    }

    @Transactional
    public ResponseData<Boolean> removeFriend(JwtAuthenticationToken token, Long targetId) {
        Long currentUserId = token.getToken().getClaim("user_id");
        UserEntity u1 = userRepository.findById(currentUserId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "User không tồn tại", 404)
        );
        UserEntity u2 = userRepository.findById(targetId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "User không tồn tại", 404)
        );

        Optional<FriendshipEntity> existing = friendshipRepository.findFriendshipBetween(u1, u2);
        if (existing.isPresent()) {
            friendshipRepository.delete(existing.get());
            messagingTemplate.convertAndSend("/topic/user/" + targetId, "FRIEND_REMOVED");
            return new ResponseData<>(200, "Đã hủy kết bạn thành công", true);
        }

        return new ResponseData<>(400, "Không có quan hệ bạn bè để hủy", false);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<UserDTO>> getFriendsList(JwtAuthenticationToken token) {
        Long currentUserId = token.getToken().getClaim("user_id");
        UserEntity user = userRepository.findById(currentUserId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "User không tồn tại", 404)
        );

        List<FriendshipEntity> list = friendshipRepository.findAllAcceptedFriends(user);
        List<UserDTO> dtos = list.stream().map(f -> {
            UserEntity other = f.getUser().getId().equals(currentUserId) ? f.getFriend() : f.getUser();
            return mapToDTO(other, "ACCEPTED");
        }).collect(Collectors.toList());

        return new ResponseData<>(200, "Lấy danh sách bạn bè thành công", dtos);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<UserDTO>> getPendingRequests(JwtAuthenticationToken token) {
        Long currentUserId = token.getToken().getClaim("user_id");
        UserEntity user = userRepository.findById(currentUserId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "User không tồn tại", 404)
        );

        List<FriendshipEntity> list = friendshipRepository.findPendingRequestsFor(user);
        List<UserDTO> dtos = list.stream().map(f -> mapToDTO(f.getUser(), "PENDING_RECEIVED")).collect(Collectors.toList());

        return new ResponseData<>(200, "Lấy danh sách lời mời kết bạn thành công", dtos);
    }
}
