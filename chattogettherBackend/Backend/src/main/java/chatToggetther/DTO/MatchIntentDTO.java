package chatToggetther.DTO;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchIntentDTO {
    private Long id;
    private String code;
    private String title;
    private String subtitle;
    private String iconName;
    private Double freqStart;
    private Double freqEnd;
    private Boolean isActive;
    private Integer displayOrder;
}
