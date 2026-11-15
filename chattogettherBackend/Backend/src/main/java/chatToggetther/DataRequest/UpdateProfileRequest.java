package chatToggetther.DataRequest;

import com.fasterxml.jackson.annotation.JsonSetter;
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

    private String avatarUrl;

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
    private Long preferredMusicId;
    private String matchIntentCode;
    private String preferredIntentCode;

    @JsonSetter("age")
    public void setAgeJson(Object ageObj) {
        if (ageObj == null) {
            this.age = null;
        } else if (ageObj instanceof Number) {
            this.age = ((Number) ageObj).intValue();
        } else if (ageObj instanceof String) {
            String s = ((String) ageObj).trim();
            if (s.isEmpty() || "null".equalsIgnoreCase(s)) {
                this.age = null;
            } else {
                try {
                    this.age = Integer.parseInt(s);
                } catch (NumberFormatException e) {
                    this.age = null;
                }
            }
        }
    }

    public String getEffectiveAvatar() {
        if (this.avatarUrl != null && !this.avatarUrl.trim().isEmpty()) {
            return this.avatarUrl.trim();
        }
        return this.avatar;
    }

    public String getEffectiveIntentCode() {
        if (this.preferredIntentCode != null && !this.preferredIntentCode.trim().isEmpty()) {
            return this.preferredIntentCode.trim();
        }
        return this.matchIntentCode;
    }

    public Long getEffectiveMusicId() {
        if (this.preferredMusicId != null) {
            return this.preferredMusicId;
        }
        return this.favoriteMusicId;
    }
}
