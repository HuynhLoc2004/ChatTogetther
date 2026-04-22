package chatToggetther.DTO;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UserRoomDTO {
    private Long id;
    private LocalDateTime timeJoin;
    private LocalDateTime timeLeft;
    private UserDTO userDTO;
}
