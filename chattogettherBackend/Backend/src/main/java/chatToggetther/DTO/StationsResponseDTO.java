package chatToggetther.DTO;

import lombok.*;
import java.util.List;
import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class StationsResponseDTO {
    private List<BroadcastStationDTO> stations;
    private Integer totalOnlineCount;
    private List<Map<String, Object>> activeIntents;
}
