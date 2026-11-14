package chatToggetther.DataRequest;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class CreateCommunityReportRequest {
    @NotBlank(message = "Lý do báo cáo không được để trống")
    private String reasonCode; // SPAM, HATE_SPEECH, NSFW_AUDIO, SCAM, OTHER

    private String description;

    private Long targetPostId;
}
