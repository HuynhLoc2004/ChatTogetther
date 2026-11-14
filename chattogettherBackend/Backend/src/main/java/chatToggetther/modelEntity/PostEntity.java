package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "posts", indexes = {
    @Index(name = "idx_post_created_at", columnList = "created_at DESC"),
    @Index(name = "idx_post_user_id", columnList = "user_id"),
    @Index(name = "idx_post_group_status", columnList = "group_id, status"),
    @Index(name = "idx_post_search_hits", columnList = "search_hits DESC")
})
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class PostEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Column(name = "vibe", columnDefinition = "TEXT")
    private String vibe;

    @Column(name = "search_hits")
    private Long searchHits = 0L;

    @Column(name = "group_id")
    private Long groupId;

    @Column(name = "group_name", columnDefinition = "TEXT")
    private String groupName;

    @Column(name = "status")
    private String status = "APPROVED"; // "APPROVED", "PENDING", "REJECTED"

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "deleted_reason", columnDefinition = "TEXT")
    private String deletedReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<PostLikeEntity> likes = new ArrayList<>();

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<CommentEntity> comments = new ArrayList<>();
}
