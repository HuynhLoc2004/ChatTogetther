package chatToggetther.DataRequest;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UpdateProfileRequest {
    private String nickname;
    private String avatar;
    private Integer age;
    private String location;
    private String bio;
}

