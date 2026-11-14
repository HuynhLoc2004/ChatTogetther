package chatToggetther.DTO;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BroadcastStationDTO {
    private Long userId;
    private String username;
    private String displayName;
    private String avatarUrl;
    private String bio;
    private String displayNameMasked;
    private Double frequency;
    private String audioUrl;
    private String intentCode;
    private String intentTitle;
    private String genreTag;
    private Long broadcastAt;
}
