package chatToggetther.DataRequest;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateMusicTrackRequest {

    @NotBlank(message = "Tên bản nhạc không được để trống!")
    private String title;

    private String artist;

    private String coverUrl;

    @NotBlank(message = "Đường dẫn âm thanh không được để trống!")
    private String audioUrl;

    private String genreTag;

    private Boolean isFeatured = false;

    private Boolean isActive = true;
}
