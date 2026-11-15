package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class NotificationListResponseDTO {
    private List<NotificationDTO> notifications;
    private long unreadCount;
}
