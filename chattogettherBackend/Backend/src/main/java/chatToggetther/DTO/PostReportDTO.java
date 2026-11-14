package chatToggetther.DTO;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostReportDTO {
    private Long id;
    private Long postId;
    private String postContent;
    private Long postAuthorId;
    private String postAuthorName;
    private Long reporterId;
    private String reporterName;
    private String reason;
    private String details;
    private String status;
    private String adminNote;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
}
