package chatToggetther.DataRequest;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateMatchIntentRequest {
    private String title;
    private String subtitle;
    private String iconName;
    private Double freqStart;
    private Double freqEnd;
    private Boolean isActive;
    private Integer displayOrder;
}
