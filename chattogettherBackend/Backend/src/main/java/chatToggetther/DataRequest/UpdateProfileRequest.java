package chatToggetther.DataRequest;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UpdateProfileRequest {
    @Size(max = 50, message = "Tên hiển thị tối đa 50 ký tự")
    private String nickname;

    @Size(max = 2000000, message = "Dữ liệu ảnh đại diện vượt quá kích thước cho phép")
    private String avatar;

    @Min(value = 1, message = "Tuổi không hợp lệ")
    @Max(value = 150, message = "Tuổi không hợp lệ")
    private Integer age;

    @Size(max = 100, message = "Địa điểm tối đa 100 ký tự")
    private String location;

    @Size(max = 500, message = "Tiểu sử tối đa 500 ký tự")
    private String bio;

    @Size(max = 100, message = "Email tối đa 100 ký tự")
    private String email;

    @Size(max = 20, message = "Số điện thoại tối đa 20 ký tự")
    private String phone;

    private Double personalFrequency;
    private Long favoriteMusicId;
    private String matchIntentCode;
}

