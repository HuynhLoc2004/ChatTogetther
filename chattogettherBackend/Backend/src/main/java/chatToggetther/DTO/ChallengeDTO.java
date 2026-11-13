package chatToggetther.DTO;

import lombok.*;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ChallengeDTO {
    private Long id;
    private String question;
    private String category;
    private String categoryName;
    private String badgeColor;
    private String author;
    private Long authorId;
    private Integer usageCount;
}

