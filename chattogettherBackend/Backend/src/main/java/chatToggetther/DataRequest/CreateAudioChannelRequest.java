package chatToggetther.DataRequest;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateAudioChannelRequest {
    @NotBlank(message = "Tên kênh không được để trống")
    private String name;

    private String genreTag;

    @NotBlank(message = "Stream URL không được để trống")
    private String streamUrl;

    private Boolean isActive = true;
}
