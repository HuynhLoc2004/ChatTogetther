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

    @Size(max = 1000, message = "Đường dẫn ảnh đại diện tối đa 1000 ký tự")
    private String avatar;

    @Min(value = 1, message = "Tuổi không hợp lệ")
    @Max(value = 150, message = "Tuổi không hợp lệ")
    private Integer age;

    @Size(max = 100, message = "Địa điểm tối đa 100 ký tự")
    private String location;

    @Size(max = 500, message = "Tiểu sử tối đa 500 ký tự")
    private String bio;
}

