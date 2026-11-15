package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "admin_audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminAuditLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "admin_id")
    private Long adminId;

    @Column(name = "admin_name", length = 100)
    private String adminName;

    @Column(nullable = false, length = 100)
    private String action; // DELETE_POST, BAN_USER, APPROVE_CARD, REJECT_CARD, UPDATE_CONFIG, DISCONNECT_FM, RESOLVE_REPORT

    @Column(name = "target_type", length = 50)
    private String targetType; // POST, USER, ICEBREAKER, CONFIG, FM_STATION, REPORT

    @Column(name = "target_id", length = 100)
    private String targetId;

    @Column(columnDefinition = "TEXT")
    private String detail;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
