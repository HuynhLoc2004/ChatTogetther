package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.DTO.CommentDTO;
import chatToggetther.DTO.PostDTO;
import chatToggetther.DataRequest.CreateCommentRequest;
import chatToggetther.DataRequest.CreatePostRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.CommentEntity;
import chatToggetther.modelEntity.CommunityGroupEntity;
import chatToggetther.modelEntity.CommunityMemberEntity;
import chatToggetther.modelEntity.FriendshipEntity;
import chatToggetther.modelEntity.CommentLikeEntity;
import chatToggetther.modelEntity.PostEntity;
import chatToggetther.modelEntity.PostLikeEntity;
import chatToggetther.modelEntity.PostReportEntity;
import chatToggetther.modelEntity.PostRepostEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.CommentLikeRepository;
import chatToggetther.repository.CommentRepository;
import chatToggetther.repository.CommunityGroupRepository;
import chatToggetther.repository.CommunityMemberRepository;
import chatToggetther.repository.FriendshipRepository;
import chatToggetther.repository.PostLikeRepository;
import chatToggetther.repository.PostReportRepository;
import chatToggetther.repository.PostRepostRepository;
import chatToggetther.repository.PostRepository;
import chatToggetther.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class PostService {
    private final PostRepository postRepository;
    private final PostLikeRepository postLikeRepository;
    private final CommentRepository commentRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final CommunityGroupRepository groupRepository;
    private final CommunityMemberRepository memberRepository;
    private final FriendshipRepository friendshipRepository;
    private final PostReportRepository postReportRepository;
    private final CommentLikeRepository commentLikeRepository;
    private final PostRepostRepository postRepostRepository;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm dd/MM");

    public PostService(
            PostRepository postRepository,
            PostLikeRepository postLikeRepository,
            CommentRepository commentRepository,
            UserRepository userRepository,
            SimpMessagingTemplate messagingTemplate,
            CommunityGroupRepository groupRepository,
            CommunityMemberRepository memberRepository,
            FriendshipRepository friendshipRepository,
            PostReportRepository postReportRepository,
            CommentLikeRepository commentLikeRepository,
            PostRepostRepository postRepostRepository
    ) {
        this.postRepository = postRepository;
        this.postLikeRepository = postLikeRepository;
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
        this.groupRepository = groupRepository;
        this.memberRepository = memberRepository;
        this.friendshipRepository = friendshipRepository;
        this.postReportRepository = postReportRepository;
        this.commentLikeRepository = commentLikeRepository;
        this.postRepostRepository = postRepostRepository;
    }

    private PostDTO mapToPostDTO(PostEntity post, UserEntity currentUser) {
        PostDTO dto = new PostDTO();
        dto.setId(post.getId());
        dto.setContent(post.getContent());
        dto.setImageUrl(post.getImageUrl());
        dto.setVibe(post.getVibe());
        dto.setCreatedAt(post.getCreatedAt());
        dto.setFormattedTime(post.getCreatedAt() != null ? post.getCreatedAt().format(TIME_FORMATTER) : "");

        UserEntity author = post.getUser();
        if (author != null) {
            dto.setAuthorId(author.getId());
            dto.setAuthorNickname(author.getNickname() != null && !author.getNickname().isEmpty() ? author.getNickname() : author.getAccount());
            dto.setAuthorAccount(author.getAccount());
            dto.setAuthorAvatar(author.getAvatar());
            dto.setAuthorLocation(author.getLocation());
            dto.setAuthorRoles(author.getRoles());

            // Đặc quyền / Danh hiệu
            boolean isAdmin = author.getRoles() != null && (author.getRoles().contains("ROLE_AMDIN") || author.getRoles().contains("ROLE_ADMIN"));
            dto.setAuthorIsVerified(isAdmin);
            dto.setAuthorVipTier(isAdmin ? "ADMIN" : "MEMBER");
            dto.setAuthorBadge(isAdmin ? "ADMIN" : null);
        }

        int likesCount = this.postLikeRepository.countByPost(post);
        int commentsCount = this.commentRepository.countByPost(post);
        long repostsCount = this.postRepostRepository.countByPost(post);
        long hits = post.getSearchHits() != null ? post.getSearchHits() : 0L;

        dto.setLikesCount(likesCount);
        dto.setCommentsCount(commentsCount);
        dto.setRepostsCount((int) repostsCount);
        dto.setSearchHits(hits);

        dto.setGroupId(post.getGroupId());
        dto.setGroupName(post.getGroupName());
        dto.setStatus(post.getStatus() != null ? post.getStatus() : "APPROVED");
        dto.setRejectionReason(post.getRejectionReason());
        dto.setIsDeleted(Boolean.TRUE.equals(post.getIsDeleted()));
        dto.setDeletedAt(post.getDeletedAt());
        dto.setDeletedReason(post.getDeletedReason());

        // Thuật toán AI Tính điểm Thịnh hành (Search Frequency Dominance Algorithm):
        // Ưu tiên cao nhất các bài viết được cộng đồng tìm kiếm nhiều nhất (Search Hits * 10),
        // kết hợp tần suất tương tác bình luận (Comments * 3) và cảm xúc (Likes * 1),
        // phân rã thời gian tự nhiên theo giờ để luôn làm mới xu hướng tìm kiếm nóng.
        long hoursOld = post.getCreatedAt() != null ? Math.max(0, java.time.Duration.between(post.getCreatedAt(), LocalDateTime.now()).toHours()) : 0;
        double trendingScore = ((hits * 10.0) + (commentsCount * 3.0) + (likesCount * 1.0)) / Math.pow(hoursOld + 2.0, 1.2);
        dto.setTrendingScore(trendingScore);

        if (currentUser != null) {
            Optional<PostLikeEntity> userLike = this.postLikeRepository.findByPostAndUser(post, currentUser);
            if (userLike.isPresent()) {
                dto.setIsLikedByMe(true);
                dto.setMyReaction(userLike.get().getReactionType() != null ? userLike.get().getReactionType() : "HEART");
            } else {
                dto.setIsLikedByMe(false);
                dto.setMyReaction(null);
            }
            dto.setIsRepostedByMe(this.postRepostRepository.existsByPostAndUser(post, currentUser));
        } else {
            dto.setIsLikedByMe(false);
            dto.setMyReaction(null);
            dto.setIsRepostedByMe(false);
        }

        return dto;
    }

    private CommentDTO mapToCommentDTO(CommentEntity comment) {
        return mapToCommentDTO(comment, null);
    }

    private CommentDTO mapToCommentDTO(CommentEntity comment, UserEntity currentUser) {
        CommentDTO dto = new CommentDTO();
        dto.setId(comment.getId());
        dto.setContent(comment.getContent());
        dto.setCreatedAt(comment.getCreatedAt());
        dto.setFormattedTime(comment.getCreatedAt() != null ? comment.getCreatedAt().format(TIME_FORMATTER) : "");

        dto.setParentId(comment.getParentId());
        dto.setReplyToUser(comment.getReplyToUser());

        UserEntity author = comment.getUser();
        if (author != null) {
            dto.setAuthorId(author.getId());
            dto.setAuthorNickname(author.getNickname() != null && !author.getNickname().isEmpty() ? author.getNickname() : author.getAccount());
            dto.setAuthorAccount(author.getAccount());
            dto.setAuthorAvatar(author.getAvatar());
        }

        long count = this.commentLikeRepository.countByComment(comment);
        dto.setLikesCount(count);
        if (currentUser != null) {
            dto.setIsLiked(this.commentLikeRepository.existsByCommentAndUser(comment, currentUser));
        } else {
            dto.setIsLiked(false);
        }

        return dto;
    }

    @Transactional(readOnly = true)
    public ResponseData<List<PostDTO>> getAllPosts(JwtAuthenticationToken token) {
        return getAllPosts(token, 0, 25);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<PostDTO>> getAllPosts(JwtAuthenticationToken token, Integer page, Integer size) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);

        int pageNum = (page != null && page >= 0) ? page : 0;
        int pageSize = (size != null && size > 0 && size <= 50) ? size : 25;

        List<PostEntity> posts = this.postRepository.findAllPostsWithDetails(org.springframework.data.domain.PageRequest.of(pageNum, pageSize));
        if (posts.isEmpty()) {
            return new ResponseData<>(200, "Danh sách bài viết trống", List.of());
        }

        List<Long> postIds = posts.stream().map(PostEntity::getId).toList();

        // Nạp thông tin các Nhóm cộng đồng (nếu có bài viết trong group)
        Set<Long> groupIds = posts.stream().map(PostEntity::getGroupId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, CommunityGroupEntity> groupMap = new HashMap<>();
        if (!groupIds.isEmpty()) {
            this.groupRepository.findAllById(groupIds).forEach(g -> groupMap.put(g.getId(), g));
        }

        // Kiểm tra xem currentUser đã tham gia những group nào
        Set<Long> userMemberGroupIds = new HashSet<>();
        if (currentUser != null) {
            List<CommunityMemberEntity> memberships = this.memberRepository.findByUserAndStatus(currentUser, "ACTIVE");
            for (CommunityMemberEntity m : memberships) {
                if (m.getGroup() != null) {
                    userMemberGroupIds.add(m.getGroup().getId());
                }
            }
        }

        // Lấy danh sách ID bạn bè của currentUser (để tính Social Graph Discovery)
        Set<Long> friendUserIds = new HashSet<>();
        if (currentUser != null) {
            List<FriendshipEntity> friends = this.friendshipRepository.findAllAcceptedFriends(currentUser);
            for (FriendshipEntity f : friends) {
                if (f.getUser().getId().equals(currentUser.getId())) {
                    friendUserIds.add(f.getFriend().getId());
                } else {
                    friendUserIds.add(f.getUser().getId());
                }
            }
        }

        // 1. Tối ưu: Batch count lượt thích gom nhóm trong 1 truy vấn duy nhất (Không chạy vòng lặp)
        Map<Long, Integer> likeCountMap = new HashMap<>();
        List<Object[]> likeCounts = this.postLikeRepository.countLikesByPostIds(postIds);
        for (Object[] row : likeCounts) {
            Long pId = (Long) row[0];
            Long count = (Long) row[1];
            likeCountMap.put(pId, count != null ? count.intValue() : 0);
        }

        // 2. Tối ưu: Batch count bình luận gom nhóm trong 1 truy vấn duy nhất
        Map<Long, Integer> commentCountMap = new HashMap<>();
        List<Object[]> commentCounts = this.commentRepository.countCommentsByPostIds(postIds);
        for (Object[] row : commentCounts) {
            Long pId = (Long) row[0];
            Long count = (Long) row[1];
            commentCountMap.put(pId, count != null ? count.intValue() : 0);
        }

        // 3. Tối ưu: Batch lấy cảm xúc của user hiện tại
        Map<Long, PostLikeEntity> userLikeMap = new HashMap<>();
        if (currentUser != null) {
            List<PostLikeEntity> userLikes = this.postLikeRepository.findByUserAndPostIds(currentUser, postIds);
            for (PostLikeEntity pl : userLikes) {
                userLikeMap.put(pl.getPost().getId(), pl);
            }
        }

        // 3.1. Tín hiệu xã hội thông minh (Smart Social Graph Signals): Tìm bạn bè đã tương tác (Comment/Like) trên danh sách bài viết
        Map<Long, String> friendCommentSignalMap = new HashMap<>();
        Map<Long, String> friendLikeSignalMap = new HashMap<>();
        if (currentUser != null && !friendUserIds.isEmpty()) {
            try {
                List<Object[]> friendComments = this.commentRepository.findFriendCommentsOnPosts(postIds, friendUserIds);
                for (Object[] row : friendComments) {
                    Long pId = (Long) row[0];
                    String acc = (String) row[2];
                    String nick = (String) row[3];
                    String display = (nick != null && !nick.isBlank()) ? nick : ("@" + acc);
                    friendCommentSignalMap.putIfAbsent(pId, display);
                }

                List<Object[]> friendLikes = this.postLikeRepository.findFriendLikesOnPosts(postIds, friendUserIds);
                for (Object[] row : friendLikes) {
                    Long pId = (Long) row[0];
                    String acc = (String) row[2];
                    String nick = (String) row[3];
                    String display = (nick != null && !nick.isBlank()) ? nick : ("@" + acc);
                    friendLikeSignalMap.putIfAbsent(pId, display);
                }
            } catch (Exception ex) {
                log.warn("Không thể tải friend signals: {}", ex.getMessage());
            }
        }

        // 4. Ánh xạ trực tiếp trên bộ nhớ RAM siêu tốc & Thuật toán Đề xuất Cộng đồng Thông minh
        List<PostDTO> dtos = new ArrayList<>();
        for (PostEntity p : posts) {
            CommunityGroupEntity grp = p.getGroupId() != null ? groupMap.get(p.getGroupId()) : null;
            boolean isMemberOfThisGroup = p.getGroupId() != null && userMemberGroupIds.contains(p.getGroupId());

            // Bảo mật: Nếu bài viết thuộc nhóm riêng tư (Private) hoặc nhóm tắt công khai ra feed (isPublicToFeed = false),
            // CHỈ người đã tham gia nhóm mới thấy bài viết này trên feed!
            if (grp != null) {
                if (Boolean.TRUE.equals(grp.getIsPrivate()) && !isMemberOfThisGroup) {
                    continue; // Bỏ qua không đề xuất ra ngoài
                }
                if (Boolean.FALSE.equals(grp.getIsPublicToFeed()) && !isMemberOfThisGroup) {
                    continue; // Nhóm không muốn đề xuất ra Feed chung
                }
            }

            PostDTO dto = new PostDTO();
            dto.setId(p.getId());
            dto.setContent(p.getContent());
            dto.setImageUrl(p.getImageUrl());
            dto.setVibe(p.getVibe());
            dto.setCreatedAt(p.getCreatedAt());
            dto.setFormattedTime(p.getCreatedAt() != null ? p.getCreatedAt().format(TIME_FORMATTER) : "");

            dto.setGroupId(p.getGroupId());
            dto.setGroupName(p.getGroupName() != null ? p.getGroupName() : (grp != null ? grp.getName() : null));
            dto.setStatus(p.getStatus() != null ? p.getStatus() : "APPROVED");
            dto.setRejectionReason(p.getRejectionReason());
            dto.setIsGroupPublic(grp != null ? !Boolean.TRUE.equals(grp.getIsPrivate()) : true);
            dto.setIsMemberOfGroup(isMemberOfThisGroup);

            UserEntity author = p.getUser();
            if (author != null) {
                dto.setAuthorId(author.getId());
                dto.setAuthorNickname(author.getNickname() != null && !author.getNickname().isEmpty() ? author.getNickname() : author.getAccount());
                dto.setAuthorAccount(author.getAccount());
                dto.setAuthorAvatar(author.getAvatar());
                dto.setAuthorLocation(author.getLocation());
                dto.setAuthorRoles(author.getRoles());

                boolean isAdmin = author.getRoles() != null && (author.getRoles().contains("ROLE_AMDIN") || author.getRoles().contains("ROLE_ADMIN"));
                dto.setAuthorIsVerified(isAdmin);
                dto.setAuthorVipTier(isAdmin ? "ADMIN" : "MEMBER");
                dto.setAuthorBadge(isAdmin ? "ADMIN" : null);
            }

            int likesCount = likeCountMap.getOrDefault(p.getId(), 0);
            int commentsCount = commentCountMap.getOrDefault(p.getId(), 0);
            long hits = p.getSearchHits() != null ? p.getSearchHits() : 0L;

            dto.setLikesCount(likesCount);
            dto.setCommentsCount(commentsCount);
            dto.setSearchHits(hits);

            long hoursOld = p.getCreatedAt() != null ? Math.max(0, java.time.Duration.between(p.getCreatedAt(), LocalDateTime.now()).toHours()) : 0;
            
            // THUẬT TOÁN ĐỀ XUẤT CỘNG ĐỒNG THÔNG MINH (Smart Community Resonance Discovery):
            // 1. Điểm tương tác cơ sở & độ phân rã thời gian tự nhiên
            double engagementScore = ((hits * 3.0) + (commentsCount * 4.0) + (likesCount * 3.0) + 1.0) / Math.pow(hoursOld + 2.0, 1.25);
            
            // 2. Hệ số cộng hưởng cá nhân hóa & Thuật toán Đề xuất Xã hội Thông minh (Smart Social Feed Signals)
            double resonanceMultiplier = 1.0;
            String recoReason = null;
            boolean isFriendInteracted = false;

            // Ưu tiên 1: Tín hiệu xã hội trực tiếp từ Bạn Bè (Bình luận / Thích)
            if (friendCommentSignalMap.containsKey(p.getId())) {
                resonanceMultiplier += 0.60;
                recoReason = "Bạn bè (" + friendCommentSignalMap.get(p.getId()) + ") đã bình luận bài viết này";
                isFriendInteracted = true;
            } else if (friendLikeSignalMap.containsKey(p.getId())) {
                resonanceMultiplier += 0.45;
                recoReason = "Bạn bè (" + friendLikeSignalMap.get(p.getId()) + ") đã thích bài viết này";
                isFriendInteracted = true;
            }

            // Ưu tiên 2: Bài viết từ Cộng đồng mà user ĐÃ THAM GIA
            if (isMemberOfThisGroup) {
                resonanceMultiplier += 0.50;
                if (recoReason == null) {
                    recoReason = "Từ cộng đồng " + (grp != null ? grp.getName() : "bạn đã tham gia");
                }
            } else if (grp != null) {
                // Đề xuất bài viết từ Cộng đồng công khai khác mà user CHƯA tham gia
                resonanceMultiplier += 0.25;
                if (recoReason == null) {
                    recoReason = "Khám phá từ cộng đồng " + grp.getName();
                }
            }

            if (currentUser != null && author != null) {
                // Tương thích độ tuổi (Age Affinity): Bạn cùng độ tuổi (+20% đến +40%)
                if (currentUser.getAge() != null && author.getAge() != null) {
                    int ageDiff = Math.abs(currentUser.getAge() - author.getAge());
                    if (ageDiff <= 3) {
                        resonanceMultiplier += 0.35;
                    } else if (ageDiff <= 7) {
                        resonanceMultiplier += 0.15;
                    }
                }

                // Tương thích vị trí địa lý
                if (currentUser.getLocation() != null && author.getLocation() != null 
                        && !currentUser.getLocation().trim().isEmpty() 
                        && currentUser.getLocation().equalsIgnoreCase(author.getLocation())) {
                    resonanceMultiplier += 0.20;
                }

                // Social Graph: Tác giả bài viết là Bạn Bè (+45%)
                if (friendUserIds.contains(author.getId())) {
                    resonanceMultiplier += 0.45;
                    if (recoReason == null) {
                        recoReason = "Bài viết từ bạn bè " + dto.getAuthorNickname();
                    }
                }

                // Bài viết của chính mình
                if (author.getId().equals(currentUser.getId())) {
                    resonanceMultiplier += 0.15;
                }
            }

            // Đa phương tiện phong phú
            if (p.getImageUrl() != null && !p.getImageUrl().trim().isEmpty()) {
                resonanceMultiplier += 0.2;
            }
            if (p.getVibe() != null && !p.getVibe().trim().isEmpty()) {
                resonanceMultiplier += 0.1;
            }

            if (recoReason == null && engagementScore > 10.0) {
                recoReason = "Thịnh hành được quan tâm nhiều";
            }

            dto.setRecommendationReason(recoReason);
            dto.setIsFriendInteraction(isFriendInteracted);

            // 3. Phân kỳ ngẫu nhiên phi xác định cá nhân hóa (Non-deterministic Personal Jitter):
            // Đảm bảo không bị fix cứng, người dùng A và B (dù cùng là bạn của C) sẽ nhìn thấy thứ tự đa dạng, không trùng lặp 100%
            long uId = currentUser != null ? currentUser.getId() : 11L;
            double hashSeed = (uId * 37L + p.getId() * 19L) % 1000;
            double personalJitter = 0.88 + (Math.sin(hashSeed) * 0.12); // Dao động vi mô [0.88 - 1.00]

            double finalRecommendScore = engagementScore * resonanceMultiplier * personalJitter;
            dto.setTrendingScore(finalRecommendScore);

            PostLikeEntity myLike = userLikeMap.get(p.getId());
            if (myLike != null) {
                dto.setIsLikedByMe(true);
                dto.setMyReaction(myLike.getReactionType() != null ? myLike.getReactionType() : "HEART");
            } else {
                dto.setIsLikedByMe(false);
                dto.setMyReaction(null);
            }

            dtos.add(dto);
        }

        // Sắp xếp bài viết thông minh theo điểm đề xuất tối ưu (Personalized Resonance)
        dtos.sort((a, b) -> Double.compare(b.getTrendingScore(), a.getTrendingScore()));

        return new ResponseData<>(200, "Lấy danh sách bài viết thành công", dtos);
    }

    @Transactional
    public ResponseData<PostDTO> createPost(JwtAuthenticationToken token, CreatePostRequest request) {
        if (request.getContent() == null || request.getContent().trim().isEmpty()) {
            throw new AppException(400, "Nội dung bài viết không được để trống", 400);
        }

        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại!", 401);
        }

        PostEntity post = new PostEntity();
        post.setUser(currentUser);
        post.setContent(request.getContent().trim());
        if (request.getImageUrl() != null && !request.getImageUrl().trim().isEmpty()) {
            post.setImageUrl(request.getImageUrl().trim());
        }
        if (request.getVibe() != null && !request.getVibe().trim().isEmpty()) {
            post.setVibe(request.getVibe().trim());
        }

        // Kiểm tra nếu đăng vào một Cộng đồng (Community Group)
        if (request.getGroupId() != null) {
            CommunityGroupEntity grp = this.groupRepository.findById(request.getGroupId()).orElseThrow(() ->
                new AppException(404, "Cộng đồng không tồn tại", 404)
            );

            // Kiểm tra tư cách thành viên
            Optional<CommunityMemberEntity> memberOpt = this.memberRepository.findByGroupAndUser(grp, currentUser);
            boolean isMember = memberOpt.isPresent() && "ACTIVE".equals(memberOpt.get().getStatus());
            boolean isAdmin = currentUser.getRoles() != null && (currentUser.getRoles().contains("ROLE_ADMIN") || currentUser.getRoles().contains("ROLE_AMDIN"));
            if (!isMember && !isAdmin) {
                throw new AppException(403, "Bạn cần gia nhập cộng đồng này trước khi đăng bài thảo luận!", 403);
            }

            post.setGroupId(grp.getId());
            post.setGroupName(grp.getName());

            // Phê duyệt bài viết: Nếu nhóm bật chế độ duyệt bài trước khi đăng
            if (Boolean.TRUE.equals(grp.getRequiresPostApproval())) {
                String role = memberOpt.map(CommunityMemberEntity::getRole).orElse("MEMBER");
                if ("OWNER".equals(role) || "DEPUTY".equals(role) || isAdmin) {
                    post.setStatus("APPROVED");
                } else {
                    post.setStatus("PENDING");
                }
            } else {
                post.setStatus("APPROVED");
            }
        } else {
            post.setStatus("APPROVED");
        }

        post.setCreatedAt(LocalDateTime.now());
        this.postRepository.save(post);

        PostDTO dto = mapToPostDTO(post, currentUser);

        // Thông báo realtime bài đăng mới qua WebSocket
        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "NEW_POST");
        } catch (Exception ignored) {}

        String msg = "PENDING".equals(post.getStatus())
                ? "Bài viết đã được gửi vào cộng đồng và đang chờ Ban quản trị phê duyệt."
                : "Đăng bài viết thành công";

        return new ResponseData<>(200, msg, dto);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<PostDTO>> getGroupPosts(JwtAuthenticationToken token, Long groupId, String status) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        Optional<CommunityMemberEntity> memberOpt = (currentUser != null) 
            ? this.memberRepository.findByGroupAndUser(group, currentUser) 
            : Optional.empty();
        String role = memberOpt.map(CommunityMemberEntity::getRole).orElse(null);
        boolean isPrivileged = "OWNER".equals(role) || "DEPUTY".equals(role) 
            || (currentUser != null && currentUser.getRoles() != null && (currentUser.getRoles().contains("ROLE_ADMIN") || currentUser.getRoles().contains("ROLE_AMDIN")));

        List<PostEntity> posts;
        if ("PENDING".equalsIgnoreCase(status)) {
            if (!isPrivileged) {
                throw new AppException(403, "Chỉ Ban quản trị cộng đồng mới có quyền xem danh sách chờ duyệt!", 403);
            }
            posts = this.postRepository.findByGroupIdAndStatusOrderByCreatedAtDesc(groupId, "PENDING");
        } else if ("REJECTED".equalsIgnoreCase(status)) {
            if (!isPrivileged) {
                throw new AppException(403, "Chỉ Ban quản trị cộng đồng mới có quyền xem danh sách bị từ chối!", 403);
            }
            posts = this.postRepository.findByGroupIdAndStatusOrderByCreatedAtDesc(groupId, "REJECTED");
        } else {
            posts = this.postRepository.findByGroupIdAndStatusOrderByCreatedAtDesc(groupId, "APPROVED");
        }

        List<PostDTO> dtos = posts.stream().map(p -> {
            PostDTO dto = mapToPostDTO(p, currentUser);
            dto.setGroupId(group.getId());
            dto.setGroupName(group.getName());
            dto.setIsGroupPublic(!Boolean.TRUE.equals(group.getIsPrivate()));
            dto.setIsMemberOfGroup(memberOpt.isPresent() && "ACTIVE".equals(memberOpt.get().getStatus()));
            return dto;
        }).collect(Collectors.toList());

        return new ResponseData<>(200, "Lấy danh sách bài viết cộng đồng thành công", dtos);
    }

    @Transactional
    public ResponseData<PostDTO> approvePost(JwtAuthenticationToken token, Long postId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(401, "Yêu cầu đăng nhập", 401);
        }

        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        if (post.getGroupId() == null) {
            throw new AppException(400, "Bài viết này không thuộc cộng đồng", 400);
        }

        CommunityGroupEntity group = this.groupRepository.findById(post.getGroupId()).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        CommunityMemberEntity member = this.memberRepository.findByGroupAndUser(group, currentUser).orElseThrow(() ->
            new AppException(403, "Bạn không có quyền quản trị trong cộng đồng này!", 403)
        );

        boolean isPrivileged = "OWNER".equals(member.getRole()) || "DEPUTY".equals(member.getRole())
                || (currentUser.getRoles() != null && (currentUser.getRoles().contains("ROLE_ADMIN") || currentUser.getRoles().contains("ROLE_AMDIN")));
        if (!isPrivileged) {
            throw new AppException(403, "Chỉ Chủ nhóm hoặc Phó nhóm mới có quyền phê duyệt bài viết!", 403);
        }

        post.setStatus("APPROVED");
        post.setRejectionReason(null);
        this.postRepository.save(post);

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_APPROVED");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Đã phê duyệt bài viết thành công!", mapToPostDTO(post, currentUser));
    }

    @Transactional
    public ResponseData<PostDTO> rejectPost(JwtAuthenticationToken token, Long postId, String reason) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(401, "Yêu cầu đăng nhập", 401);
        }

        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        if (post.getGroupId() == null) {
            throw new AppException(400, "Bài viết này không thuộc cộng đồng", 400);
        }

        CommunityGroupEntity group = this.groupRepository.findById(post.getGroupId()).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        CommunityMemberEntity member = this.memberRepository.findByGroupAndUser(group, currentUser).orElseThrow(() ->
            new AppException(403, "Bạn không có quyền quản trị trong cộng đồng này!", 403)
        );

        boolean isPrivileged = "OWNER".equals(member.getRole()) || "DEPUTY".equals(member.getRole())
                || (currentUser.getRoles() != null && (currentUser.getRoles().contains("ROLE_ADMIN") || currentUser.getRoles().contains("ROLE_AMDIN")));
        if (!isPrivileged) {
            throw new AppException(403, "Chỉ Chủ nhóm hoặc Phó nhóm mới có quyền từ chối bài viết!", 403);
        }

        post.setStatus("REJECTED");
        post.setRejectionReason(reason != null && !reason.trim().isEmpty() ? reason.trim() : "Không phù hợp với định hướng cộng đồng");
        this.postRepository.save(post);

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_REJECTED");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Đã từ chối bài viết!", mapToPostDTO(post, currentUser));
    }

    @Transactional
    public ResponseData<PostDTO> toggleLikePost(JwtAuthenticationToken token, Long postId, String reactionType) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        String desiredReaction = (reactionType != null && !reactionType.trim().isEmpty()) 
                ? reactionType.trim().toUpperCase() 
                : "HEART";

        Optional<PostLikeEntity> existingLike = this.postLikeRepository.findByPostAndUser(post, currentUser);
        if (existingLike.isPresent()) {
            PostLikeEntity like = existingLike.get();
            if (desiredReaction.equalsIgnoreCase(like.getReactionType())) {
                this.postLikeRepository.delete(like);
            } else {
                like.setReactionType(desiredReaction);
                like.setCreatedAt(LocalDateTime.now());
                this.postLikeRepository.save(like);
            }
        } else {
            PostLikeEntity like = new PostLikeEntity();
            like.setPost(post);
            like.setUser(currentUser);
            like.setReactionType(desiredReaction);
            like.setCreatedAt(LocalDateTime.now());
            this.postLikeRepository.save(like);
        }

        PostDTO dto = mapToPostDTO(post, currentUser);

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_REACTION_UPDATED");
            if (desiredReaction != null && post.getUser() != null && !post.getUser().getId().equals(currentUser.getId())) {
                String senderName = currentUser.getNickname() != null && !currentUser.getNickname().isEmpty() ? currentUser.getNickname() : currentUser.getAccount();
                Map<String, Object> notif = new HashMap<>();
                notif.put("id", System.currentTimeMillis());
                notif.put("type", "REACTION");
                notif.put("postId", postId);
                notif.put("text", senderName + " đã bày tỏ cảm xúc với bài viết của bạn.");
                notif.put("time", "Vừa xong");
                notif.put("unread", true);
                this.messagingTemplate.convertAndSend("/topic/user/" + post.getUser().getId() + "/notifications", notif);
            }
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Thao tác thả cảm xúc thành công", dto);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<CommentDTO>> getPostComments(Long postId) {
        return getPostComments(null, postId);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<CommentDTO>> getPostComments(JwtAuthenticationToken token, Long postId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        List<CommentEntity> comments = this.commentRepository.findCommentsByPost(post);
        List<CommentDTO> dtos = comments.stream().map(c -> this.mapToCommentDTO(c, currentUser)).collect(Collectors.toList());
        return new ResponseData<>(200, "Lấy danh sách bình luận thành công", dtos);
    }

    @Transactional
    public ResponseData<CommentDTO> addComment(JwtAuthenticationToken token, Long postId, CreateCommentRequest request) {
        if (request.getContent() == null || request.getContent().trim().isEmpty()) {
            throw new AppException(400, "Nội dung bình luận không được để trống", 400);
        }

        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        CommentEntity comment = new CommentEntity();
        comment.setPost(post);
        comment.setUser(currentUser);
        comment.setContent(request.getContent().trim());
        comment.setParentId(request.getParentId());
        comment.setReplyToUser(request.getReplyToUser() != null && !request.getReplyToUser().trim().isEmpty() ? request.getReplyToUser().trim() : null);
        comment.setCreatedAt(LocalDateTime.now());
        this.commentRepository.save(comment);

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_COMMENT_ADDED");
            String senderName = currentUser.getNickname() != null && !currentUser.getNickname().isEmpty() ? currentUser.getNickname() : currentUser.getAccount();

            // Nếu trả lời bình luận của ai đó -> Gửi thông báo đến tác giả bình luận cha
            if (request.getParentId() != null) {
                this.commentRepository.findById(request.getParentId()).ifPresent(parentCmt -> {
                    if (parentCmt.getUser() != null && !parentCmt.getUser().getId().equals(currentUser.getId())) {
                        Map<String, Object> replyNotif = new HashMap<>();
                        replyNotif.put("id", System.currentTimeMillis());
                        replyNotif.put("type", "COMMENT_REPLY");
                        replyNotif.put("postId", postId);
                        replyNotif.put("text", senderName + " đã trả lời bình luận của bạn.");
                        replyNotif.put("time", "Vừa xong");
                        replyNotif.put("unread", true);
                        this.messagingTemplate.convertAndSend("/topic/user/" + parentCmt.getUser().getId() + "/notifications", replyNotif);
                    }
                });
            }

            // Gửi thông báo cho tác giả bài viết nếu người bình luận khác tác giả bài
            if (post.getUser() != null && !post.getUser().getId().equals(currentUser.getId())) {
                Map<String, Object> notif = new HashMap<>();
                notif.put("id", System.currentTimeMillis() + 1);
                notif.put("type", "COMMENT");
                notif.put("postId", postId);
                notif.put("text", senderName + " đã bình luận về bài viết của bạn.");
                notif.put("time", "Vừa xong");
                notif.put("unread", true);
                this.messagingTemplate.convertAndSend("/topic/user/" + post.getUser().getId() + "/notifications", notif);
            }
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Bình luận thành công", mapToCommentDTO(comment));
    }

    @Transactional
    public ResponseData<List<PostDTO>> searchPosts(JwtAuthenticationToken token, String keyword) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);

        String kw = keyword != null ? keyword.trim() : "";
        List<PostEntity> posts = this.postRepository.searchPosts(kw);
        if (kw.length() >= 2 && !posts.isEmpty()) {
            for (PostEntity p : posts) {
                p.setSearchHits((p.getSearchHits() != null ? p.getSearchHits() : 0L) + 1);
            }
            this.postRepository.saveAll(posts);
        }

        List<PostDTO> dtos = posts.stream()
                .map(p -> mapToPostDTO(p, currentUser))
                .collect(Collectors.toList());

        return new ResponseData<>(200, "Tìm kiếm bài viết thành công", dtos);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<PostDTO>> getTrendingPosts(JwtAuthenticationToken token) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        List<PostEntity> posts = this.postRepository.findAllPostsWithDetails();
        List<PostDTO> dtos = posts.stream()
                .map(p -> mapToPostDTO(p, currentUser))
                .sorted((a, b) -> Double.compare(
                        b.getTrendingScore() != null ? b.getTrendingScore() : 0.0,
                        a.getTrendingScore() != null ? a.getTrendingScore() : 0.0
                ))
                .collect(Collectors.toList());
        return new ResponseData<>(200, "Lấy danh sách bài viết thịnh hành theo thuật toán tìm kiếm thành công", dtos);
    }

    @Transactional
    public void trackSearch(String keyword) {
        if (keyword == null || keyword.trim().length() < 2) return;
        List<PostEntity> matched = this.postRepository.searchPosts(keyword.trim());
        if (!matched.isEmpty()) {
            for (PostEntity p : matched) {
                p.setSearchHits((p.getSearchHits() != null ? p.getSearchHits() : 0L) + 1);
            }
            this.postRepository.saveAll(matched);
        }
    }

    @Transactional
    public ResponseData<Boolean> deletePost(JwtAuthenticationToken token, Long postId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        boolean isAdmin = currentUser.getRoles() != null && 
                (currentUser.getRoles().contains("ROLE_AMDIN") || currentUser.getRoles().contains("ROLE_ADMIN"));

        if (!post.getUser().getId().equals(currentUser.getId()) && !isAdmin) {
            throw new AppException(403, "Bạn không có quyền xóa bài viết này!", 403);
        }

        this.postRepostRepository.deleteAllByPost(post);
        this.postRepository.delete(post);

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_DELETED");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Xóa bài viết thành công", true);
    }

    @Transactional
    public ResponseData<PostDTO> updatePost(JwtAuthenticationToken token, Long postId, CreatePostRequest request) {
        if (request.getContent() == null || request.getContent().trim().isEmpty()) {
            throw new AppException(400, "Nội dung bài viết không được để trống", 400);
        }

        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        if (!post.getUser().getId().equals(currentUser.getId())) {
            throw new AppException(403, "Bạn không có quyền chỉnh sửa bài viết này!", 403);
        }

        post.setContent(request.getContent().trim());
        post.setImageUrl(request.getImageUrl() != null && !request.getImageUrl().trim().isEmpty() ? request.getImageUrl().trim() : null);
        post.setVibe(request.getVibe() != null && !request.getVibe().trim().isEmpty() ? request.getVibe().trim() : null);
        this.postRepository.save(post);

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_UPDATED");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Cập nhật bài viết thành công", mapToPostDTO(post, currentUser));
    }

    @Transactional
    public ResponseData<Boolean> deleteComment(JwtAuthenticationToken token, Long postId, Long commentId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        CommentEntity comment = this.commentRepository.findById(commentId).orElseThrow(() ->
            new AppException(404, "Bình luận không tồn tại", 404)
        );

        boolean isCommentAuthor = comment.getUser().getId().equals(currentUser.getId());
        boolean isPostAuthor = comment.getPost().getUser().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getRoles() != null && 
                (currentUser.getRoles().contains("ROLE_AMDIN") || currentUser.getRoles().contains("ROLE_ADMIN"));

        if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
            throw new AppException(403, "Bạn không có quyền xóa bình luận này!", 403);
        }

        this.commentLikeRepository.deleteAllByComment(comment);
        this.commentRepository.delete(comment);

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_COMMENT_DELETED");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Xóa bình luận thành công", true);
    }

    @Transactional
    public ResponseData<CommentDTO> updateComment(JwtAuthenticationToken token, Long postId, Long commentId, CreateCommentRequest request) {
        if (request.getContent() == null || request.getContent().trim().isEmpty()) {
            throw new AppException(400, "Nội dung bình luận không được để trống", 400);
        }

        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        CommentEntity comment = this.commentRepository.findById(commentId).orElseThrow(() ->
            new AppException(404, "Bình luận không tồn tại", 404)
        );

        if (!comment.getUser().getId().equals(currentUser.getId())) {
            throw new AppException(403, "Bạn chỉ có thể chỉnh sửa bình luận của chính mình!", 403);
        }

        comment.setContent(request.getContent().trim());
        this.commentRepository.save(comment);

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_COMMENT_UPDATED");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Cập nhật bình luận thành công", mapToCommentDTO(comment, currentUser));
    }

    @Transactional
    public ResponseData<CommentDTO> toggleLikeComment(JwtAuthenticationToken token, Long commentId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        CommentEntity comment = this.commentRepository.findById(commentId).orElseThrow(() ->
            new AppException(404, "Bình luận không tồn tại", 404)
        );

        Optional<CommentLikeEntity> existing = this.commentLikeRepository.findByCommentAndUser(comment, currentUser);
        if (existing.isPresent()) {
            this.commentLikeRepository.delete(existing.get());
        } else {
            CommentLikeEntity like = CommentLikeEntity.builder()
                    .comment(comment)
                    .user(currentUser)
                    .createdAt(LocalDateTime.now())
                    .build();
            this.commentLikeRepository.save(like);

            // Gửi realtime notification nếu người thả tim không phải tác giả bình luận
            if (comment.getUser() != null && !comment.getUser().getId().equals(currentUser.getId())) {
                try {
                    Map<String, Object> notif = new HashMap<>();
                    notif.put("type", "COMMENT_LIKE");
                    notif.put("title", "Cảm xúc phản hồi");
                    String actor = currentUser.getNickname() != null ? currentUser.getNickname() : currentUser.getAccount();
                    String preview = comment.getContent().length() > 25 ? comment.getContent().substring(0, 25) + "..." : comment.getContent();
                    notif.put("text", actor + " đã thích phản hồi của bạn: \"" + preview + "\"");
                    notif.put("message", actor + " đã thích phản hồi của bạn: \"" + preview + "\"");
                    notif.put("postId", comment.getPost() != null ? comment.getPost().getId() : null);
                    notif.put("time", "Vừa xong");
                    notif.put("unread", true);
                    this.messagingTemplate.convertAndSend("/topic/user/" + comment.getUser().getId() + "/notifications", notif);
                } catch (Exception ignored) {}
            }
        }

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "COMMENT_LIKED");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Thao tác thành công", mapToCommentDTO(comment, currentUser));
    }

    @Transactional
    public ResponseData<Boolean> reportPost(JwtAuthenticationToken token, Long postId, Map<String, String> request) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        String reason = request != null && request.containsKey("reason") ? request.get("reason") : "OTHER";
        String details = request != null && request.containsKey("details") ? request.get("details") : "";

        PostReportEntity report = PostReportEntity.builder()
                .postId(post.getId())
                .postContent(post.getContent())
                .postAuthorId(post.getUser() != null ? post.getUser().getId() : null)
                .postAuthorName(post.getUser() != null ? (post.getUser().getNickname() != null ? post.getUser().getNickname() : post.getUser().getAccount()) : "Người dùng")
                .reporterId(currentUser.getId())
                .reporterName(currentUser.getNickname() != null ? currentUser.getNickname() : currentUser.getAccount())
                .reason(reason)
                .details(details)
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .build();

        this.postReportRepository.save(report);

        try {
            this.messagingTemplate.convertAndSend("/topic/admin/reports", "NEW_POST_REPORT");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Báo cáo bài viết thành công. Ban quản trị sẽ sớm xem xét xử lý!", true);
    }

    @Transactional
    public ResponseData<PostDTO> toggleRepost(JwtAuthenticationToken token, Long postId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Vui lòng đăng nhập lại", 401);
        }
        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        Optional<PostRepostEntity> existingOpt = this.postRepostRepository.findByPostAndUser(post, currentUser);
        boolean reposted;
        if (existingOpt.isPresent()) {
            this.postRepostRepository.delete(existingOpt.get());
            reposted = false;
        } else {
            PostRepostEntity newRepost = PostRepostEntity.builder()
                    .post(post)
                    .user(currentUser)
                    .createdAt(LocalDateTime.now())
                    .build();
            this.postRepostRepository.save(newRepost);
            reposted = true;

            // Gửi realtime notification cho tác giả bài viết nếu không phải chính mình
            if (!post.getUser().getId().equals(currentUser.getId())) {
                try {
                    String reposterName = currentUser.getNickname() != null && !currentUser.getNickname().trim().isEmpty()
                            ? currentUser.getNickname() : currentUser.getAccount();
                    Map<String, Object> notif = new HashMap<>();
                    notif.put("id", UUID.randomUUID().toString());
                    notif.put("type", "REPOST");
                    notif.put("text", reposterName + " đã đăng lại bài viết của bạn!");
                    notif.put("time", LocalDateTime.now().format(TIME_FORMATTER));
                    notif.put("postId", post.getId());
                    notif.put("unread", true);
                    this.messagingTemplate.convertAndSend("/topic/user/" + post.getUser().getId() + "/notifications", notif);
                } catch (Exception ignored) {}
            }
        }

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_REPOST_UPDATED");
        } catch (Exception ignored) {}

        PostDTO dto = mapToPostDTO(post, currentUser);
        dto.setIsRepostedByMe(reposted);
        return new ResponseData<>(200, reposted ? "Đã đăng lại bài viết lên trang cá nhân!" : "Đã hủy đăng lại bài viết", dto);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<PostDTO>> getUserPosts(JwtAuthenticationToken token, Long targetUserId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        UserEntity targetUser = this.userRepository.findById(targetUserId).orElseThrow(() ->
            new AppException(404, "Người dùng không tồn tại", 404)
        );

        List<PostEntity> posts = this.postRepository.findAllPostsWithDetails().stream()
                .filter(p -> p.getUser().getId().equals(targetUserId))
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .collect(Collectors.toList());

        List<PostDTO> dtos = posts.stream().map(p -> mapToPostDTO(p, currentUser)).collect(Collectors.toList());
        return new ResponseData<>(200, "Lấy danh sách bài viết của người dùng thành công", dtos);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<PostDTO>> getUserReposts(JwtAuthenticationToken token, Long targetUserId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        UserEntity targetUser = this.userRepository.findById(targetUserId).orElseThrow(() ->
            new AppException(404, "Người dùng không tồn tại", 404)
        );

        List<PostRepostEntity> reposts = this.postRepostRepository.findByUserOrderByCreatedAtDesc(targetUser);
        List<PostDTO> dtos = reposts.stream().map(r -> {
            PostDTO dto = mapToPostDTO(r.getPost(), currentUser);
            dto.setRepostedByUsername(targetUser.getAccount());
            dto.setRepostedByNickname(targetUser.getNickname() != null ? targetUser.getNickname() : targetUser.getAccount());
            dto.setRepostedAt(r.getCreatedAt() != null ? r.getCreatedAt().format(TIME_FORMATTER) : "");
            return dto;
        }).collect(Collectors.toList());

        return new ResponseData<>(200, "Lấy danh sách bài đăng lại thành công", dtos);
    }

    @Transactional
    public ResponseData<PostDTO> adminSoftDeletePost(JwtAuthenticationToken token, Long postId, String reason) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        boolean isAdmin = currentUser != null && currentUser.getRoles() != null &&
                (currentUser.getRoles().contains("ROLE_ADMIN") || currentUser.getRoles().contains("ROLE_AMDIN"));
        if (!isAdmin) {
            throw new AppException(403, "Bạn không có quyền quản trị để thực hiện gỡ bài viết!", 403);
        }

        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        String effectiveReason = (reason != null && !reason.trim().isEmpty()) ? reason.trim() : "Vi phạm tiêu chuẩn cộng đồng Talovin";
        post.setIsDeleted(true);
        post.setDeletedReason(effectiveReason);
        post.setDeletedAt(LocalDateTime.now());
        this.postRepository.save(post);

        // Gửi realtime notification tới tác giả bài viết
        if (post.getUser() != null) {
            try {
                Map<String, Object> notif = new HashMap<>();
                notif.put("id", UUID.randomUUID().toString());
                notif.put("type", "POST_TAKEDOWN");
                notif.put("text", "Bài viết của bạn đã bị Ban Quản Trị gỡ xuống. Lý do: " + effectiveReason);
                notif.put("time", LocalDateTime.now().format(TIME_FORMATTER));
                notif.put("postId", post.getId());
                notif.put("unread", true);
                this.messagingTemplate.convertAndSend("/topic/user/" + post.getUser().getId() + "/notifications", notif);
            } catch (Exception ignored) {}
        }

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_DELETED");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Đã gỡ bài viết (xóa mềm) thành công!", mapToPostDTO(post, currentUser));
    }

    @Transactional
    public ResponseData<PostDTO> adminRestorePost(JwtAuthenticationToken token, Long postId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        boolean isAdmin = currentUser != null && currentUser.getRoles() != null &&
                (currentUser.getRoles().contains("ROLE_ADMIN") || currentUser.getRoles().contains("ROLE_AMDIN"));
        if (!isAdmin) {
            throw new AppException(403, "Bạn không có quyền quản trị!", 403);
        }

        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        post.setIsDeleted(false);
        post.setDeletedReason(null);
        post.setDeletedAt(null);
        this.postRepository.save(post);

        // Gửi realtime notification tới tác giả bài viết
        if (post.getUser() != null) {
            try {
                Map<String, Object> notif = new HashMap<>();
                notif.put("id", UUID.randomUUID().toString());
                notif.put("type", "POST_RESTORED");
                notif.put("text", "Bài viết của bạn đã được Ban Quản Trị khôi phục hiển thị.");
                notif.put("time", LocalDateTime.now().format(TIME_FORMATTER));
                notif.put("postId", post.getId());
                notif.put("unread", true);
                this.messagingTemplate.convertAndSend("/topic/user/" + post.getUser().getId() + "/notifications", notif);
            } catch (Exception ignored) {}
        }

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_RESTORED");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Đã khôi phục bài viết thành công!", mapToPostDTO(post, currentUser));
    }

    @Transactional
    public ResponseData<Boolean> adminHardDeletePost(JwtAuthenticationToken token, Long postId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        boolean isAdmin = currentUser != null && currentUser.getRoles() != null &&
                (currentUser.getRoles().contains("ROLE_ADMIN") || currentUser.getRoles().contains("ROLE_AMDIN"));
        if (!isAdmin) {
            throw new AppException(403, "Bạn không có quyền quản trị!", 403);
        }

        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        this.postRepostRepository.deleteAllByPost(post);
        this.postRepository.delete(post);

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_DELETED");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Đã xóa vĩnh viễn bài viết khỏi hệ thống!", true);
    }

    @Transactional
    public ResponseData<Boolean> adminDeleteRepost(JwtAuthenticationToken token, Long repostId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        boolean isAdmin = currentUser != null && currentUser.getRoles() != null &&
                (currentUser.getRoles().contains("ROLE_ADMIN") || currentUser.getRoles().contains("ROLE_AMDIN"));
        if (!isAdmin) {
            throw new AppException(403, "Bạn không có quyền quản trị!", 403);
        }

        PostRepostEntity repost = this.postRepostRepository.findById(repostId).orElseThrow(() ->
            new AppException(404, "Bản ghi đăng lại không tồn tại", 404)
        );

        this.postRepostRepository.delete(repost);

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_REPOST_UPDATED");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Đã gỡ bài đăng lại của thành viên thành công!", true);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<PostDTO>> getAdminPosts(JwtAuthenticationToken token, String filter) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        boolean isAdmin = currentUser != null && currentUser.getRoles() != null &&
                (currentUser.getRoles().contains("ROLE_ADMIN") || currentUser.getRoles().contains("ROLE_AMDIN"));
        if (!isAdmin) {
            throw new AppException(403, "Yêu cầu quyền quản trị viên!", 403);
        }

        List<PostEntity> posts;
        if ("DELETED".equalsIgnoreCase(filter)) {
            posts = this.postRepository.findDeletedPosts();
        } else if ("ACTIVE".equalsIgnoreCase(filter)) {
            posts = this.postRepository.findAllPostsWithDetails();
        } else {
            posts = this.postRepository.findAllPostsForAdmin();
        }

        List<PostDTO> dtos = posts.stream().map(p -> mapToPostDTO(p, currentUser)).collect(Collectors.toList());
        return new ResponseData<>(200, "Lấy danh sách bài viết quản trị thành công", dtos);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<Map<String, Object>>> getAdminReposts(JwtAuthenticationToken token) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        boolean isAdmin = currentUser != null && currentUser.getRoles() != null &&
                (currentUser.getRoles().contains("ROLE_ADMIN") || currentUser.getRoles().contains("ROLE_AMDIN"));
        if (!isAdmin) {
            throw new AppException(403, "Yêu cầu quyền quản trị viên!", 403);
        }

        List<PostRepostEntity> reposts = this.postRepostRepository.findAllRepostsForAdmin();
        List<Map<String, Object>> result = reposts.stream().map(r -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", r.getId());
            map.put("createdAt", r.getCreatedAt() != null ? r.getCreatedAt().format(TIME_FORMATTER) : "");
            map.put("reposterId", r.getUser().getId());
            map.put("reposterAccount", r.getUser().getAccount());
            map.put("reposterNickname", r.getUser().getNickname() != null ? r.getUser().getNickname() : r.getUser().getAccount());
            map.put("reposterAvatar", r.getUser().getAvatar());

            PostEntity post = r.getPost();
            map.put("postId", post.getId());
            map.put("postContent", post.getContent());
            map.put("postIsDeleted", Boolean.TRUE.equals(post.getIsDeleted()));
            if (post.getUser() != null) {
                map.put("authorId", post.getUser().getId());
                map.put("authorAccount", post.getUser().getAccount());
                map.put("authorNickname", post.getUser().getNickname() != null ? post.getUser().getNickname() : post.getUser().getAccount());
            }
            return map;
        }).collect(Collectors.toList());

        return new ResponseData<>(200, "Lấy danh sách đăng lại của người dùng thành công", result);
    }
}
