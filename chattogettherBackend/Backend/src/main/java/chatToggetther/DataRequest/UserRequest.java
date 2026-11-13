package chatToggetther.DataRequest;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@Setter
@Getter
@NoArgsConstructor
public class UserRequest {
    @NotBlank(message = "Tài khoản không được để trống")
    @Size(min = 3, max = 32, message = "Tài khoản phải từ 3 đến 32 ký tự")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "Tài khoản chỉ được chứa chữ cái, số và dấu gạch dưới")
    private String account;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(min = 6, max = 64, message = "Mật khẩu phải từ 6 đến 64 ký tự")
    private String password;
}
