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

    @Column(name = "usage_count")
    @Builder.Default
    private Integer usageCount = 0;

    @Column(name = "active")
    @Builder.Default
    private Boolean active = true;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
