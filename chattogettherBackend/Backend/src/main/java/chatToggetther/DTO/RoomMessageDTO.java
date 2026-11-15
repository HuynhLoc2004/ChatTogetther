package chatToggetther.DTO;

import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@NoArgsConstructor
public class RoomMessageDTO extends SendMessageDTO {
    public RoomMessageDTO(Long id, Long senderId, String senderUsername, String senderAvatar, String nickname, String message, LocalDateTime timeSend, String formattedTime) {
        setId(id);
        setUserId(senderId);
        setSenderId(senderId);
        setNickname(nickname);
        setSenderUsername(senderUsername);
        setSenderAvatar(senderAvatar);
        setAvatar(senderAvatar);
        setMessage(message);
        setTimeSend(timeSend);
        setFormattedTime(formattedTime);
    }
}
