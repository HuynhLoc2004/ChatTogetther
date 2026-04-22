package chatToggetther.Customize;
import lombok.*;

import java.util.Date;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ResponseErr {
    private Integer code;
    private String message;
    private Integer statusCode;
    private Date time;
}
