package chatToggetther.DataRequest;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RoomRequest {
    private String nameRoom;
    private String roomName;
    private String nameroom;
    private String password;
    private String nickname;
    private String avatar;
    private String description;

    public String getEffectiveRoomName() {
        if (nameRoom != null && !nameRoom.trim().isEmpty()) return nameRoom.trim();
        if (roomName != null && !roomName.trim().isEmpty()) return roomName.trim();
        if (nameroom != null && !nameroom.trim().isEmpty()) return nameroom.trim();
        return null;
    }
}
