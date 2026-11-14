package chatToggetther.DataRequest;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateMatchIntentRequest {
    @NotBlank(message = "Code không được để trống")
    private String code;

    @NotBlank(message = "Tiêu đề không được để trống")
    private String title;

    private String subtitle;
    private String iconName;

    @NotNull(message = "Tần số bắt đầu không được để trống")
    private Double freqStart;

    @NotNull(message = "Tần số kết thúc không được để trống")
    private Double freqEnd;

    private Boolean isActive = true;
    private Integer displayOrder = 1;
}
