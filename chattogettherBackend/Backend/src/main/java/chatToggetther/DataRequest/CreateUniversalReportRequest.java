package chatToggetther.DataRequest;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateUniversalReportRequest {

    /**
     * COMMUNITY | POST | USER_AUDIO
     */
    @NotBlank(message = "targetType không được để trống!")
    private String targetType;

    @NotNull(message = "targetId không được để trống!")
    private Long targetId;

    @NotBlank(message = "reason không được để trống!")
    private String reason;

    private String description;
}
