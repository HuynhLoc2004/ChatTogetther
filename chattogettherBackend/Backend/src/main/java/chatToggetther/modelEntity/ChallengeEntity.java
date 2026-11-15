package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "challenges")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class ChallengeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "question", nullable = false, columnDefinition = "TEXT")
    private String question;

    @Column(name = "category", nullable = false, length = 50)
    private String category; // "TRUTH", "DARE", "DEEP_TALK", "MUSIC", "CREATIVE", "PHILOSOPHY"

    @Column(name = "category_name", length = 100)
    private String categoryName; // "Thú nhận", "Thử thách", "Tâm sự sâu lắng", "Gu âm nhạc", "Sáng tạo", "Góc nhìn cuộc sống"

    @Column(name = "badge_color", length = 50)
    private String badgeColor; // hex color e.g. #818cf8, #ec4899

    @Column(name = "author", length = 100)
    private String author; // "Hệ thống Talovin" or user nickname

    @Column(name = "author_id")
    private Long authorId;

    @Column(name = "author_username", length = 100)
    private String authorUsername;

    @Column(name = "usage_count")
    @Builder.Default
    private Integer usageCount = 0;

    @Column(name = "draw_count")
    @Builder.Default
    private Integer drawCount = 0;

    @Column(name = "status", length = 20)
    @Builder.Default
    private String status = "ACTIVE"; // "ACTIVE", "PENDING", "HIDDEN"

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "active")
    @Builder.Default
    private Boolean active = true;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @PostLoad
    public void postLoad() {
        if (this.drawCount == null || this.drawCount == 0) {
            if (this.usageCount != null && this.usageCount > 0) {
                this.drawCount = this.usageCount;
            }
        }
        if (this.status == null || this.status.trim().isEmpty()) {
            this.status = (this.active != null && !this.active) ? "HIDDEN" : "ACTIVE";
        }
    }

    public Integer getEffectiveDrawCount() {
        if (this.drawCount != null && this.drawCount > 0) return this.drawCount;
        return this.usageCount != null ? this.usageCount : 0;
    }
}
