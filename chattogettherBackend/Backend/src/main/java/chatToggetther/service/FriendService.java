package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
        dto.setRoles(u.getRoles());

        boolean isAdmin = u.getRoles() != null && (u.getRoles().contains("ROLE_AMDIN") || u.getRoles().contains("ROLE_ADMIN"));
        dto.setIsVerified(isAdmin || (u.getId() != null && u.getId() <= 5));
        dto.setLevel(isAdmin ? 99 : (u.getId() != null ? (int)(10 + (u.getId() * 3) % 40) : 15));
        dto.setStreakDays(7);
        if (isAdmin) {
            dto.setVipTier("FOUNDER");
            dto.setCustomTitle("👑 Sáng Lập");
        } else if (u.getId() != null && u.getId() % 2 == 0) {
            dto.setVipTier("VIP_DIAMOND");
            dto.setCustomTitle("💎 VIP Kim Cương");
        } else {
            dto.setVipTier("VIP_PRO");
            dto.setCustomTitle("✨ Vibe Master");
        }

        return dto;
    }

    @Transactional
    public ResponseData<Boolean> sendFriendRequest(JwtAuthenticationToken token, Long receiverId) {
        Long senderId = SecurityUtils.extractUserId(token);
        if (senderId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }
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
        try {
            messagingTemplate.convertAndSend("/topic/user/" + receiverId, "FRIEND_REQUEST_RECEIVED");
            String senderName = sender.getNickname() != null && !sender.getNickname().isEmpty() ? sender.getNickname() : sender.getAccount();
            Map<String, Object> notif = new HashMap<>();
            notif.put("id", System.currentTimeMillis());
            notif.put("type", "FRIEND_REQUEST");
            notif.put("text", senderName + " đã gửi cho bạn một lời mời kết bạn.");
            notif.put("time", "Vừa xong");
            notif.put("unread", true);
            messagingTemplate.convertAndSend("/topic/user/" + receiverId + "/notifications", notif);
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Đã gửi lời mời kết bạn thành công", true);
    }

    @Transactional
    public ResponseData<Boolean> acceptFriendRequest(JwtAuthenticationToken token, Long senderId) {
        Long receiverId = SecurityUtils.extractUserId(token);
        if (receiverId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

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
        try {
            messagingTemplate.convertAndSend("/topic/user/" + senderId, "FRIEND_REQUEST_ACCEPTED");
            messagingTemplate.convertAndSend("/topic/user/" + receiverId, "FRIEND_REQUEST_ACCEPTED");

            String receiverName = receiver.getNickname() != null && !receiver.getNickname().isEmpty() ? receiver.getNickname() : receiver.getAccount();
            Map<String, Object> notif = new HashMap<>();
            notif.put("id", System.currentTimeMillis());
            notif.put("type", "FRIEND_ACCEPTED");
            notif.put("text", receiverName + " đã đồng ý kết bạn với bạn.");
            notif.put("time", "Vừa xong");
            notif.put("unread", true);
            messagingTemplate.convertAndSend("/topic/user/" + senderId + "/notifications", notif);
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Đã chấp nhận kết bạn", true);
    }

    @Transactional
    public ResponseData<Boolean> removeFriend(JwtAuthenticationToken token, Long targetId) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        UserEntity u1 = userRepository.findById(currentUserId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "User không tồn tại", 404)
        );
        UserEntity u2 = userRepository.findById(targetId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "User không tồn tại", 404)
        );

        Optional<FriendshipEntity> existing = friendshipRepository.findFriendshipBetween(u1, u2);
        if (existing.isPresent()) {
            friendshipRepository.delete(existing.get());
            try {
                messagingTemplate.convertAndSend("/topic/user/" + targetId, "FRIEND_REMOVED");
            } catch (Exception ignored) {}
            return new ResponseData<>(200, "Đã hủy kết bạn thành công", true);
        }

        return new ResponseData<>(400, "Không có quan hệ bạn bè để hủy", false);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<UserDTO>> getFriendsList(JwtAuthenticationToken token) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

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
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        UserEntity user = userRepository.findById(currentUserId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "User không tồn tại", 404)
        );

        List<FriendshipEntity> list = friendshipRepository.findPendingRequestsFor(user);
        List<UserDTO> dtos = list.stream().map(f -> mapToDTO(f.getUser(), "PENDING_RECEIVED")).collect(Collectors.toList());

        return new ResponseData<>(200, "Lấy danh sách lời mời kết bạn thành công", dtos);
    }
}
