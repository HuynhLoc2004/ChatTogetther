package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReactionCountDTO {
    private String type;   // HEART, FIRE, HAHA, WOW, LIKE, CROWN, CLAP
    private String emoji;  // ❤️, 🔥, 😂, 😮, 👍, 👑, 👏
    private String label;  // Yêu thích, Bùng nổ, etc.
    private long count;
}
