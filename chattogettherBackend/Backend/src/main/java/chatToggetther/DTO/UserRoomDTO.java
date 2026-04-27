package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UserRoomDTO {
    private Long id;
    private LocalDateTime timeJoin;
    private List<LocalDateTime> timeLeft;
    private UserDTO userDTO;
    private Boolean isAdmin;
}
