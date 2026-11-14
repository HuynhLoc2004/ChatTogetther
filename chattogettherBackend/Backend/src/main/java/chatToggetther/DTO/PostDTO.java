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
    private Integer repostsCount;
    private Long searchHits;
    private Double trendingScore;
    private Boolean isLikedByMe;
    private Boolean isRepostedByMe;
    private String repostedByUsername;
    private String repostedByNickname;
    private String repostedAt;
    private String myReaction; // "HEART", "FIRE", "HAHA", "WOW", "LIKE", "CROWN"
    private String reactionSummary; // e.g. "❤️ 🔥 😂"

    // Trạng thái gỡ bài / Xóa mềm & Lý do của Admin
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private String deletedReason;

    // Thông tin Cộng đồng (Nếu bài viết đăng trong một Group)
    private Long groupId;
    private String groupName;
    private String status; // "APPROVED", "PENDING", "REJECTED"
    private String rejectionReason;
    private Boolean isGroupPublic;
    private Boolean isMemberOfGroup;

    // Đề xuất thông minh & Lý do hiển thị (Social Discovery Signals)
    private String recommendationReason; // Ví dụ: "Bạn bè @loc112 đã bình luận", "Từ cộng đồng Âm Nhạc bạn đã tham gia", "Thịnh hành hôm nay"
    private Boolean isFriendInteraction;
    private String friendInteractionAccount;
}
