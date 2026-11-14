package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "community_groups")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class CommunityGroupEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, columnDefinition = "TEXT")
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "rules", columnDefinition = "TEXT")
    private String rules;

    @Column(name = "cover_url", columnDefinition = "TEXT")
    private String coverUrl;

    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl;

    @Column(name = "is_private")
    private Boolean isPrivate = false;

    @Column(name = "requires_approval")
    private Boolean requiresApproval = false;

    @Column(name = "is_public_to_feed")
    private Boolean isPublicToFeed = true;

    @Column(name = "requires_post_approval")
    private Boolean requiresPostApproval = false;

    @Column(name = "category_id")
    private Long categoryId;

    @Column(name = "category_code")
    private String categoryCode = "GENERAL";

    @Column(name = "status")
    private String status = "ACTIVE"; // ACTIVE, PENDING, RESTRICTED, SUSPENDED

    @Column(name = "is_featured")
    private Boolean isFeatured = false;

    @Column(name = "active_voice_room_id")
    private Long activeVoiceRoomId;

    public Boolean getRequireMemberApproval() {
        return this.requiresApproval;
    }

    public void setRequireMemberApproval(Boolean val) {
        this.requiresApproval = val;
    }

    public Boolean getRequirePostApproval() {
        return this.requiresPostApproval;
    }

    public void setRequirePostApproval(Boolean val) {
        this.requiresPostApproval = val;
    }

    public Boolean getAllowFeedPromotion() {
        return this.isPublicToFeed;
    }

    public void setAllowFeedPromotion(Boolean val) {
        this.isPublicToFeed = val;
    }

    public Boolean getIsPinnedFeatured() {
        return this.isFeatured;
    }

    public void setIsPinnedFeatured(Boolean val) {
        this.isFeatured = val;
    }

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private UserEntity owner;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<CommunityMemberEntity> members = new ArrayList<>();
}

