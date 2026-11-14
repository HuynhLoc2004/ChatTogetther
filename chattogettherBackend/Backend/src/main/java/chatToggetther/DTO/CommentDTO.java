package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class CommentDTO {
    private Long id;
    private String content;
    private LocalDateTime createdAt;
    private String formattedTime;

    private Long authorId;
    private String authorNickname;
    private String authorAccount;
    private String authorAvatar;

    private Long parentId;
    private String replyToUser;

    private Long likesCount = 0L;
    private Boolean isLiked = false;
}

