package chatToggetther.DataRequest;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Null;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RoomRequest {
    @NotNull(message = "name room not null")
    private String nameRoom;
    @NotNull(message = "password not null")
    private String password;
    private String nickname;
}
