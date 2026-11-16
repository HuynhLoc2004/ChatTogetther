package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.DTO.NotificationDTO;
import chatToggetther.DTO.NotificationListResponseDTO;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.NotificationEntity;
import chatToggetther.repository.NotificationRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // Cache chống spam thông báo (Anti-spam Debounce Cooldown)
    private final java.util.concurrent.ConcurrentHashMap<String, Long> notifCooldownMap = new java.util.concurrent.ConcurrentHashMap<>();

    public NotificationService(NotificationRepository notificationRepository, SimpMessagingTemplate messagingTemplate) {
        this.notificationRepository = notificationRepository;
        this.messagingTemplate = messagingTemplate;
    }

    private boolean isSpamNotification(Long actorId, Long recipientId, String type, Long referenceId) {
        if (actorId == null || type == null || referenceId == null) {
            return false;
        }

        long now = System.currentTimeMillis();
        long cooldownMillis;

        if ("POST_REACT".equalsIgnoreCase(type) || "POST_LIKE".equalsIgnoreCase(type)) {
            // Cooldown 3 phút cho cảm xúc bài viết (chống spam like/unlike/like liên tục)
            cooldownMillis = 180_000L;
        } else if ("POST_COMMENT".equalsIgnoreCase(type) || "COMMENT_REPLY".equalsIgnoreCase(type)) {
            // Cooldown 30 giây cho bình luận dồn dập trên cùng một bài viết
            cooldownMillis = 30_000L;
        } else {
            return false;
        }

        String key = type.toUpperCase() + ":" + actorId + ":" + referenceId;
        Long lastSent = notifCooldownMap.get(key);

        if (lastSent != null && (now - lastSent) < cooldownMillis) {
            // Đã gửi thông báo tương tự trong khoảng cooldown -> Bỏ qua để tránh làm phiền
            return true;
        }

        notifCooldownMap.put(key, now);

        // Dọn dẹp cache định kỳ nếu quá 5000 key
        if (notifCooldownMap.size() > 5000) {
            notifCooldownMap.entrySet().removeIf(entry -> (now - entry.getValue()) > 600_000L);
        }

        return false;
    }

    private String calculateRelativeTime(LocalDateTime createdAt) {
        if (createdAt == null) return "Vừa xong";
        Duration duration = Duration.between(createdAt, LocalDateTime.now());
        long seconds = duration.getSeconds();
        if (seconds < 60) return "Vừa xong";
        long minutes = duration.toMinutes();
        if (minutes < 60) return minutes + " phút trước";
        long hours = duration.toHours();
        if (hours < 24) return hours + " giờ trước";
        long days = duration.toDays();
        if (days < 7) return days + " ngày trước";
        return createdAt.getDayOfMonth() + "/" + createdAt.getMonthValue();
    }

    public NotificationDTO mapToDTO(NotificationEntity entity) {
        if (entity == null) return null;
        boolean isUnread = entity.getIsRead() == null || !entity.getIsRead();
        Long refId = entity.getReferenceId();
        String uName = entity.getActorUsername() != null && !entity.getActorUsername().isEmpty()
                ? entity.getActorUsername() : entity.getActorName();
        String type = entity.getType();
        boolean isPostRelated = type != null && (type.contains("POST") || type.contains("COMMENT") || type.contains("REACT") || type.equals("LIKE") || type.equals("SHARE"));
        Long targetPostId = isPostRelated ? refId : null;

        return NotificationDTO.builder()
                .id(entity.getId())
                .recipientId(entity.getRecipientId())
                .actorId(entity.getActorId())
                .actorUsername(uName)
                .actorName(entity.getActorName())
                .actorDisplayName(entity.getActorName())
                .actorAvatar(entity.getActorAvatar())
                .type(entity.getType())
                .referenceId(refId)
                .targetPostId(targetPostId)
                .postId(targetPostId)
                .content(entity.getContent())
                .text(entity.getContent())
                .message(entity.getContent())
                .status(entity.getStatus())
                .isRead(!isUnread)
                .unread(isUnread)
                .time(calculateRelativeTime(entity.getCreatedAt()))
                .createdAt(entity.getCreatedAt())
                .build();
    }

    @Transactional
    public NotificationDTO createAndSendNotification(
            Long recipientId,
            Long actorId,
            String actorUsername,
            String actorDisplayName,
            String actorAvatar,
            String type,
            Long referenceId,
            String content,
            String status
    ) {
        if (recipientId == null || (actorId != null && recipientId.equals(actorId))) {
            return null;
        }

        // Chống spam thông báo dồn dập
        if (isSpamNotification(actorId, recipientId, type, referenceId)) {
            return null;
        }

        NotificationEntity entity = new NotificationEntity();
        entity.setRecipientId(recipientId);
        entity.setActorId(actorId);
        entity.setActorUsername(actorUsername);
        entity.setActorName(actorDisplayName != null && !actorDisplayName.isEmpty() ? actorDisplayName : actorUsername);
        entity.setActorAvatar(actorAvatar);
        entity.setType(type);
        entity.setReferenceId(referenceId);
        entity.setContent(content);
        entity.setStatus(status != null ? status : "PENDING");
        entity.setIsRead(false);
        entity.setCreatedAt(LocalDateTime.now());

        NotificationEntity saved = notificationRepository.save(entity);
        NotificationDTO dto = mapToDTO(saved);

        // Bắn realtime qua STOMP WebSocket
        try {
            // Push to personal notification channel
            messagingTemplate.convertAndSend("/topic/user/" + recipientId + "/notifications", dto);
            messagingTemplate.convertAndSend("/topic/notifications/" + recipientId, dto);
            messagingTemplate.convertAndSend("/user/" + recipientId + "/queue/notifications", dto);
            messagingTemplate.convertAndSendToUser(String.valueOf(recipientId), "/queue/notifications", dto);
            messagingTemplate.convertAndSend("/topic/user/" + recipientId, type);
        } catch (Exception ignored) {}

        return dto;
    }

    @Transactional
    public NotificationDTO createAndSendNotification(
            Long recipientId,
            Long actorId,
            String actorName,
            String actorAvatar,
            String type,
            Long referenceId,
            String content,
            String status
    ) {
        return createAndSendNotification(recipientId, actorId, actorName, actorName, actorAvatar, type, referenceId, content, status);
    }

    @Transactional
    public void updateFriendRequestStatus(Long recipientId, Long actorId, String newStatus) {
        Optional<NotificationEntity> opt = notificationRepository
                .findFirstByRecipientIdAndActorIdAndTypeOrderByCreatedAtDesc(recipientId, actorId, "FRIEND_REQUEST");
        if (opt.isPresent()) {
            NotificationEntity entity = opt.get();
            entity.setStatus(newStatus);
            entity.setIsRead(true);
            notificationRepository.save(entity);
        }
    }

    @Transactional(readOnly = true)
    public ResponseData<NotificationListResponseDTO> getNotifications(JwtAuthenticationToken token) {
        if (token == null) {
            return new ResponseData<>(200, "Lấy danh sách thông báo thành công",
                    NotificationListResponseDTO.builder().notifications(Collections.emptyList()).unreadCount(0L).build());
        }
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            return new ResponseData<>(200, "Lấy danh sách thông báo thành công",
                    NotificationListResponseDTO.builder().notifications(Collections.emptyList()).unreadCount(0L).build());
        }

        List<NotificationEntity> entities = notificationRepository.findByRecipientIdOrderByCreatedAtDesc(currentUserId);
        long unreadCount = notificationRepository.countByRecipientIdAndIsReadFalse(currentUserId);

        List<NotificationDTO> dtos = entities.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());

        NotificationListResponseDTO res = NotificationListResponseDTO.builder()
                .notifications(dtos)
                .unreadCount(unreadCount)
                .build();

        return new ResponseData<>(200, "Lấy danh sách thông báo thành công", res);
    }

    @Transactional(readOnly = true)
    public ResponseData<Long> getUnreadCount(JwtAuthenticationToken token) {
        if (token == null) {
            return new ResponseData<>(200, "Lấy số thông báo chưa đọc thành công", 0L);
        }
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            return new ResponseData<>(200, "Lấy số thông báo chưa đọc thành công", 0L);
        }
        long count = notificationRepository.countByRecipientIdAndIsReadFalse(currentUserId);
        return new ResponseData<>(200, "Lấy số thông báo chưa đọc thành công", count);
    }

    @Transactional
    public ResponseData<Boolean> markAllAsRead(JwtAuthenticationToken token) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        notificationRepository.markAllAsRead(currentUserId);
        return new ResponseData<>(200, "Đã đánh dấu tất cả thông báo là đã đọc", true);
    }

    @Transactional
    public ResponseData<Boolean> markAsRead(JwtAuthenticationToken token, Long notifId) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        Optional<NotificationEntity> opt = notificationRepository.findById(notifId);
        if (opt.isPresent() && opt.get().getRecipientId().equals(currentUserId)) {
            NotificationEntity entity = opt.get();
            entity.setIsRead(true);
            notificationRepository.save(entity);
            return new ResponseData<>(200, "Đã đánh dấu thông báo là đã đọc", true);
        }

        return new ResponseData<>(404, "Không tìm thấy thông báo", false);
    }

    @Transactional
    public ResponseData<Boolean> deleteAll(JwtAuthenticationToken token) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        notificationRepository.deleteAllByRecipientId(currentUserId);
        return new ResponseData<>(200, "Đã xóa toàn bộ thông báo", true);
    }
}
