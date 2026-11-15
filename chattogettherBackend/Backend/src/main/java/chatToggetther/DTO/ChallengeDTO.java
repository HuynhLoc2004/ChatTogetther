package chatToggetther.DTO;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ChallengeDTO {
    private Long id;
    private String question;
    private String content; // alias for question
    private String category;
    private String categoryName;
    private String badgeColor;
    private String author;
    private Long authorId;
    private String authorUsername;
    private Integer usageCount;
    private Integer drawCount;
    private String status;
    private Integer sortOrder;
    private LocalDateTime createdAt;
}
