package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class PostDTO {
    private Long id;
    private String content;
    private String imageUrl;
    private String vibe;
    private LocalDateTime createdAt;
    private String formattedTime;
    
    // Thông tin tác giả bài viết
    private Long authorId;
    private String authorNickname;
    private String authorAccount;
    private String authorAvatar;
    private String authorLocation;
    private List<String> authorRoles;
    private String authorVipTier;
    private String authorBadge;
    private Boolean authorIsVerified;

    // Số liệu tương tác & Reactions
    private Integer likesCount;
    private Integer commentsCount;
    private Boolean isLikedByMe;
    private String myReaction; // "HEART", "FIRE", "HAHA", "WOW", "LIKE", "CROWN"
    private String reactionSummary; // e.g. "❤️ 🔥 😂"
}
