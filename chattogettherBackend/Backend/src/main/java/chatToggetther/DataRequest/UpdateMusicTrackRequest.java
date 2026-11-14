package chatToggetther.DataRequest;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateMusicTrackRequest {
    private String title;
    private String artist;
    private String coverUrl;
    private String audioUrl;
    private String genreTag;
    private Boolean isFeatured;
    private Boolean isActive;
}
