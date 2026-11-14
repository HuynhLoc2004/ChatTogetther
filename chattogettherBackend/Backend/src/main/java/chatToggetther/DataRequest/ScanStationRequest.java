package chatToggetther.DataRequest;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ScanStationRequest {
    private String intentCode;
    private List<Long> excludedUserIds;
}
