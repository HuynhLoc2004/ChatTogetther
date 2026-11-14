package chatToggetther.DataRequest;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateAudioChannelRequest {
    private String name;
    private String genreTag;
    private String streamUrl;
    private Boolean isActive;
}
