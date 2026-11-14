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
public class ResolveReportRequest {
    @NotBlank(message = "Hành động xử lý không được để trống")
    private String action; // DISMISSED, RESOLVED_WARNED, RESOLVED_SUSPENDED

    private String adminNote;
}
