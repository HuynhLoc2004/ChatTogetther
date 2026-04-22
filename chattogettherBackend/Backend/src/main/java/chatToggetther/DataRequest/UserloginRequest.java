package chatToggetther.DataRequest;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UserloginRequest {
    @NotNull(message =  "account login not null")
    private String account;
    @NotNull(message = "password not null")
    private String password;
}
