package chatToggetther.DTO;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SendMessageDTO {
    private Long id; // ID của tin nhắn từ Database
    private Long userId;
    private String nickname;
    private String message;
    private LocalDateTime timeSend;
    private LocalDateTime time_retrieve;
    private String formattedTime; // Giờ chuẩn Việt Nam HH:mm để hiển thị trên UI chính xác 100%

    // Đồng bộ chuẩn 100% Avatar & Người gửi
    private Long senderId;
    private String senderUsername;
    private String senderAvatar;
    private String avatar;

    public Long getSenderId() {
        return senderId != null ? senderId : userId;
    }

    public String getSenderUsername() {
        return senderUsername != null ? senderUsername : nickname;
    }

    public String getSenderAvatar() {
        return senderAvatar != null ? senderAvatar : avatar;
    }
}
