package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UserDTO {
    private Long id;
    private String nickname;
    private Boolean active;
    private String account;
    private String avatar;
    private Integer age;
    private String location;
    private String bio;
    private String friendshipStatus; // NONE, PENDING_SENT, PENDING_RECEIVED, ACCEPTED
}
