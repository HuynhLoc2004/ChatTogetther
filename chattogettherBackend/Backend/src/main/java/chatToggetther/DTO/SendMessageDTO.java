package chatToggetther.DTO;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;
import org.springframework.cglib.core.Local;

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
}
