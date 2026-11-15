package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "notifications", indexes = {
    @Index(name = "idx_notif_recipient", columnList = "recipient_id"),
    @Index(name = "idx_notif_created_at", columnList = "created_at")
})
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class NotificationEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "recipient_id", nullable = false)
    private Long recipientId;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "actor_username", columnDefinition = "TEXT")
    private String actorUsername;

    @Column(name = "actor_name", columnDefinition = "TEXT")
    private String actorName;

    @Column(name = "actor_avatar", columnDefinition = "TEXT")
    private String actorAvatar;

    @Column(name = "type", nullable = false, length = 50)
    private String type; // FRIEND_REQUEST, FRIEND_ACCEPTED, POST_LIKE, POST_COMMENT, SYSTEM

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "status", length = 30)
    private String status; // PENDING, ACCEPTED, REJECTED, COMPLETED

    @Column(name = "is_read")
    private Boolean isRead = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
