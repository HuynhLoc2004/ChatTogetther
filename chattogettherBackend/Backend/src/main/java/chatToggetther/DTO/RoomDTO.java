package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RoomDTO {
    private Long id;
    private String nameroom;
    private List<UserRoomDTO> userRoomDTOList = new ArrayList<>();
    private Long soluong;
}
