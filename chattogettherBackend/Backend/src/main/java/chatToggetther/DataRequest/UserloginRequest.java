package chatToggetther.DataRequest;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UserloginRequest {
    @NotBlank(message = "Tài khoản đăng nhập không được để trống")
    @Size(min = 3, max = 50, message = "Tài khoản từ 3 đến 50 ký tự")
    private String account;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(min = 1, max = 64, message = "Mật khẩu tối đa 64 ký tự")
    private String password;
}
