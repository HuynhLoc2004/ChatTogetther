package chatToggetther.Customize;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ResponseData <T>{
    private Integer code;
    private String message;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private T data;
}
