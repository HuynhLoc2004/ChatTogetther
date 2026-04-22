package chatToggetther.DataRequest;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@Setter
@Getter
@NoArgsConstructor
public class UserRequest {
    @NotNull(message = "accout not null")
    private String account;
    @NotNull(message = "password not null")
    private String password;
}
