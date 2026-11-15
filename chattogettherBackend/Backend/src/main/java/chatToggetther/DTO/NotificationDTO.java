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
    private String actorName;
    private String actorAvatar;
    private String type; // FRIEND_REQUEST, FRIEND_ACCEPTED, POST_LIKE, POST_COMMENT, SYSTEM
    private Long referenceId;
    private String content;
    private String text; // alias for content
    private String status; // PENDING, ACCEPTED, REJECTED, COMPLETED
    private Boolean isRead;
    private Boolean unread; // convenience getter/setter
    private String time;
    private LocalDateTime createdAt;
}
