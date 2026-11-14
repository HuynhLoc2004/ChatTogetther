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

    // Số liệu tương tác & Reactions & Thuật toán Thịnh hành Tìm kiếm
    private Integer likesCount;
    private Integer commentsCount;
    private Long searchHits;
    private Double trendingScore;
    private Boolean isLikedByMe;
    private String myReaction; // "HEART", "FIRE", "HAHA", "WOW", "LIKE", "CROWN"
    private String reactionSummary; // e.g. "❤️ 🔥 😂"

    // Thông tin Cộng đồng (Nếu bài viết đăng trong một Group)
    private Long groupId;
    private String groupName;
    private String status; // "APPROVED", "PENDING", "REJECTED"
    private String rejectionReason;
    private Boolean isGroupPublic;
    private Boolean isMemberOfGroup;
}
