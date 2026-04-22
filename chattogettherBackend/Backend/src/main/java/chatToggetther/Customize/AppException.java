package chatToggetther.Customize;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class AppException extends RuntimeException {
    private Integer code;
    private String message;
    private Integer statusCode;
}