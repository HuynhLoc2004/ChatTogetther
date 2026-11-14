package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "community_reports")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class CommunityReportEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "community_id", nullable = true)
    private CommunityGroupEntity community;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id", nullable = false)
    private UserEntity reporter;

    @Column(name = "target_type", length = 32)
    @Builder.Default
    private String targetType = "COMMUNITY"; // COMMUNITY, POST, USER_AUDIO

    @Column(name = "target_id")
    private Long targetId;

    @Column(name = "target_post_id")
    private Long targetPostId;

    @Column(name = "reason_code")
    private String reasonCode; // SPAM, HATE_SPEECH, NSFW_AUDIO, SCAM, OTHER

    @Column(name = "reason", length = 255)
    private String reason;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "status", nullable = false)
    @Builder.Default
    private String status = "PENDING"; // PENDING, RESOLVED_WARNED, RESOLVED_SUSPENDED, RESOLVED, DISMISSED

    @Column(name = "admin_note", columnDefinition = "TEXT")
    private String adminNote;

    @Column(name = "resolved_by")
    private Long resolvedBy;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) this.createdAt = LocalDateTime.now();
        if (this.status == null) this.status = "PENDING";
        if (this.targetType == null) this.targetType = "COMMUNITY";
        if (this.reason == null && this.reasonCode != null) this.reason = this.reasonCode;
        if (this.reasonCode == null && this.reason != null) this.reasonCode = this.reason;
    }
}
