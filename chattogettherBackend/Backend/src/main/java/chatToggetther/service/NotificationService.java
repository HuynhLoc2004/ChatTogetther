package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.DTO.NotificationDTO;
import chatToggetther.DTO.NotificationListResponseDTO;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.NotificationEntity;
import chatToggetther.repository.NotificationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // Cache chống spam thông báo (Anti-spam Debounce Cooldown theo actor + post)
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

        if ("POST_REACT".equalsIgnoreCase(type) || "POST_LIKE".equalsIgnoreCase(type) || "COMMENT_LIKE".equalsIgnoreCase(type)) {
            // Cooldown 8 giây cho cảm xúc (chỉ chống click spam dồn dập từ CÙNG 1 người)
            cooldownMillis = 8_000L;
        } else if ("POST_COMMENT".equalsIgnoreCase(type) || "COMMENT_REPLY".equalsIgnoreCase(type)) {
            // Cooldown 4 giây cho bình luận dồn dập từ CÙNG 1 người
            cooldownMillis = 4_000L;
        } else {
            return false;
        }

        // Khóa định danh riêng biệt theo type + người thao tác (actorId) + bài viết (referenceId)
        // Khi CÓ NGƯỜI MỚI (actorId khác), key sẽ khác hoàn toàn -> Thông báo phát ngay lập tức không bị nghẽn
        String key = type.toUpperCase() + ":" + actorId + ":" + referenceId;
        Long lastSent = notifCooldownMap.get(key);

        if (lastSent != null && (now - lastSent) < cooldownMillis) {
            log.info(">>> [NOTIFICATION] Chống spam: Bỏ qua thông báo lặp từ cùng 1 người (type={}, actorId={}, refId={}, còn {}ms cooldown)",
                    type, actorId, referenceId, cooldownMillis - (now - lastSent));
            return true;
        }

        notifCooldownMap.put(key, now);

        // Dọn dẹp cache định kỳ nếu quá 5000 key
        if (notifCooldownMap.size() > 5000) {
            notifCooldownMap.entrySet().removeIf(entry -> (now - entry.getValue()) > 60_000L);
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
        if (recipientId == null) {
            log.warn(">>> [NOTIFICATION] recipientId là null, hủy gửi");
            return null;
        }

        if (actorId != null && recipientId.equals(actorId)) {
            log.info(">>> [NOTIFICATION] Tự tương tác: Không gửi thông báo cho chính mình (actorId == recipientId: {})", actorId);
            return null;
        }

        // Chống spam thông báo dồn dập
        if (isSpamNotification(actorId, recipientId, type, referenceId)) {
            return null;
        }

        // Gôm gọn thông báo (Deduplicate / Aggregate):
        // Nếu cùng 1 người tương tác nhiều lần trên 1 đối tượng (bình luận, trả lời bình luận, thả cảm xúc),
        // gôm lại thành 1 thông báo duy nhất, cập nhật thời gian mới nhất và nội dung mới nhất.
        boolean isAggregatable = type != null && (
                "POST_COMMENT".equalsIgnoreCase(type)
                || "COMMENT_REPLY".equalsIgnoreCase(type)
                || "POST_REACT".equalsIgnoreCase(type)
                || "POST_LIKE".equalsIgnoreCase(type)
                || "COMMENT_LIKE".equalsIgnoreCase(type)
                || "REACTION".equalsIgnoreCase(type)
                || "POST_SHARE".equalsIgnoreCase(type)
        );

        NotificationEntity entity = null;
        if (isAggregatable && actorId != null && referenceId != null) {
            List<NotificationEntity> existingList = notificationRepository
                    .findByRecipientIdAndActorIdAndTypeAndReferenceIdOrderByCreatedAtDesc(recipientId, actorId, type, referenceId);
            if (!existingList.isEmpty()) {
                // Tái sử dụng bản ghi mới nhất, cập nhật thời gian mới nhất và đánh dấu chưa đọc
                entity = existingList.get(0);
                entity.setActorUsername(actorUsername);
                entity.setActorName(actorDisplayName != null && !actorDisplayName.isEmpty() ? actorDisplayName : actorUsername);
                entity.setActorAvatar(actorAvatar);
                entity.setContent(content);
                entity.setStatus(status != null ? status : "COMPLETED");
                entity.setIsRead(false);
                entity.setCreatedAt(LocalDateTime.now());

                // Nếu có các bản ghi trùng lặp cũ từ trước trong DB, xóa sạch để giải phóng bộ nhớ lưu trữ
                if (existingList.size() > 1) {
                    List<NotificationEntity> duplicatesToDelete = existingList.subList(1, existingList.size());
                    try {
                        notificationRepository.deleteAll(duplicatesToDelete);
                        log.info(">>> [NOTIFICATION] Đã dọn dẹp {} bản ghi thông báo trùng lặp cũ trong DB", duplicatesToDelete.size());
                    } catch (Exception e) {
                        log.warn("Lỗi dọn dẹp thông báo trùng lặp: {}", e.getMessage());
                    }
                }
            }
        }

        if (entity == null) {
            entity = new NotificationEntity();
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
        }

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
            log.info(">>> [NOTIFICATION] Đã gửi thông báo thành công: recipientId={}, actor={}, type={}, refId={}, content='{}'",
                    recipientId, actorUsername, type, referenceId, content);
        } catch (Exception e) {
            log.error(">>> [NOTIFICATION] Lỗi bắn WebSocket thông báo tới recipientId {}: {}", recipientId, e.getMessage());
        }

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

    @Transactional
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

        // Gôm gọn thông báo trùng lặp và dọn dẹp các bản ghi cũ thừa trong database
        List<NotificationEntity> consolidatedEntities = new ArrayList<>();
        List<NotificationEntity> toDelete = new ArrayList<>();
        Set<String> seenKeys = new HashSet<>();

        for (NotificationEntity entity : entities) {
            String type = entity.getType();
            boolean isAggregatable = type != null && (
                    "POST_COMMENT".equalsIgnoreCase(type)
                    || "COMMENT_REPLY".equalsIgnoreCase(type)
                    || "POST_REACT".equalsIgnoreCase(type)
                    || "POST_LIKE".equalsIgnoreCase(type)
                    || "COMMENT_LIKE".equalsIgnoreCase(type)
                    || "REACTION".equalsIgnoreCase(type)
                    || "POST_SHARE".equalsIgnoreCase(type)
            );

            if (isAggregatable && entity.getActorId() != null && entity.getReferenceId() != null) {
                String groupKey = type.toUpperCase() + "_" + entity.getActorId() + "_" + entity.getReferenceId();
                if (seenKeys.contains(groupKey)) {
                    toDelete.add(entity);
                    continue;
                }
                seenKeys.add(groupKey);
            }
            consolidatedEntities.add(entity);
        }

        if (!toDelete.isEmpty()) {
            try {
                notificationRepository.deleteAll(toDelete);
                log.info(">>> [NOTIFICATION] Đã gôm gọn và xóa {} bản ghi thông báo trùng lặp cũ trong DB cho user {}", toDelete.size(), currentUserId);
            } catch (Exception e) {
                log.warn("Lỗi dọn dẹp bản ghi thông báo trùng lặp: {}", e.getMessage());
            }
        }

        long unreadCount = consolidatedEntities.stream()
                .filter(n -> n.getIsRead() == null || !n.getIsRead())
                .count();

        List<NotificationDTO> dtos = consolidatedEntities.stream()
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
