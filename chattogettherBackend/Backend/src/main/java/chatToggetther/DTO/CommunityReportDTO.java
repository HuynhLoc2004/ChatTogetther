package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class CommunityReportDTO {
    private Long id;
    private Long communityId;
    private String communityName;
    private Long reporterId;
    private String reporterName;
    private String reporterAccount;
    private Long targetPostId;
    private String reasonCode;
    private String description;
    private String status;
    private String adminNote;
    private Long resolvedBy;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
}
