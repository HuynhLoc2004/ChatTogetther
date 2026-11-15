package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "reaction_definitions", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"code"})
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReactionDefinitionEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String code; // HEART, FIRE, HAHA, WOW, LIKE, CROWN, CLAP

    @Column(nullable = false, length = 64)
    private String label; // Yêu thích, Bùng nổ, Haha, Wow, Thích, Đỉnh cao, Vỗ tay

    @Column(nullable = false, length = 32)
    private String emoji; // ❤️, 🔥, 😂, 😮, 👍, 👑, 👏

    @Builder.Default
    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Builder.Default
    @Column(nullable = false, length = 16)
    private String status = "ACTIVE"; // ACTIVE, HIDDEN

    @Builder.Default
    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
