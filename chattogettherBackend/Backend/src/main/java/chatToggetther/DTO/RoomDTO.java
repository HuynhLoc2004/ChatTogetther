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
    private Boolean hasPassword;
    private String avatar;
    private String description;
    private Boolean active;
    private Boolean isPrivate;
    private java.time.LocalDateTime createdAt;
    private Long ownerId;
    private String ownerName;
    private String ownerAccount;
    private String ownerAvatar;
}
