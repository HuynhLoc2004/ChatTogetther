package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class CommunityGroupDTO {
    private Long id;
    private String name;
    private String description;
    private String rules;
    private String coverUrl;
    private String avatarUrl;
    private Boolean isPrivate;
    private Boolean requiresApproval;
    private Boolean isPublicToFeed;
    private Boolean requiresPostApproval;
    private Long categoryId;
    private String categoryName;
    private String categoryCode;
    private String status;
    private Boolean isFeatured;
    private Boolean requireMemberApproval;
    private Boolean requirePostApproval;
    private Boolean allowFeedPromotion;
    private Boolean isPinnedFeatured;
    private Long activeVoiceRoomId;
    private Long postsCount;
    private Long ownerId;
    private String ownerName;
    private String ownerAvatar;
    private Long membersCount;
    private Long pendingReportsCount;
    private String currentUserRole; // null, OWNER, DEPUTY, MEMBER, PENDING
    private Boolean isOwner;
    private LocalDateTime createdAt;
    private List<CommunityMemberDTO> members = new ArrayList<>();
}
