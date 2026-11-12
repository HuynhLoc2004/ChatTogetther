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
public class PostDTO {
    private Long id;
    private String content;
    private LocalDateTime createdAt;
    private String formattedTime;
    
    // Thông tin tác giả bài viết
    private Long authorId;
    private String authorNickname;
    private String authorAccount;
    private String authorAvatar;
    private String authorLocation;

    // Số liệu tương tác
    private Integer likesCount;
    private Integer commentsCount;
    private Boolean isLikedByMe;
}

