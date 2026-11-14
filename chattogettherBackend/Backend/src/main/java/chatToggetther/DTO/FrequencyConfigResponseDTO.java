package chatToggetther.DTO;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FrequencyConfigResponseDTO {
    private List<MatchIntentDTO> intents;
    private List<AudioChannelDTO> audioChannels;
}
