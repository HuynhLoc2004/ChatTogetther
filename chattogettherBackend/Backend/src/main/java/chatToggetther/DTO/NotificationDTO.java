package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class NotificationDTO {
    private Long id;
    private Long recipientId;
    private Long actorId;
    private String actorUsername;
    private String actorName;
    private String actorDisplayName;
    private String actorAvatar;
    private String type; // FRIEND_REQUEST, FRIEND_ACCEPTED, POST_REACT, POST_LIKE, POST_COMMENT, COMMENT_REPLY, COMMENT_LIKE, POST_SHARE, SYSTEM
    private Long referenceId;
    private Long targetPostId;
    private Long postId; // convenience alias
    private String content;
    private String text; // alias for content
    private String message; // alias for content
    private String status; // PENDING, ACCEPTED, REJECTED, COMPLETED
    private Boolean isRead;
    private Boolean unread; // convenience getter/setter
    private String time;
    private LocalDateTime createdAt;

    public String getActorUsername() {
        if (actorUsername != null && !actorUsername.trim().isEmpty()) {
            return actorUsername.trim();
        }
        return actorName != null ? actorName.trim() : null;
    }

    public Long getTargetPostId() {
        if (targetPostId != null) return targetPostId;
        if (referenceId != null) return referenceId;
        return postId;
    }

    public Long getPostId() {
        if (postId != null) return postId;
        if (targetPostId != null) return targetPostId;
        return referenceId;
    }

    public String getText() {
        if (text != null && !text.trim().isEmpty()) return text;
        if (content != null && !content.trim().isEmpty()) return content;
        return message;
    }
}
