package chatToggetther.DTO;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AudioChannelDTO {
    private Long id;
    private String name;
    private String genreTag;
    private String streamUrl;
    private Boolean isActive;
}
