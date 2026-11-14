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
import chatToggetther.modelEntity.SearchTermEntity;
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
import chatToggetther.repository.SearchTermRepository;
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
    private final SearchTermRepository searchTermRepository;

    // Cache danh sách tìm kiếm thịnh hành trong RAM để truy xuất siêu tốc <1ms
    private final List<java.util.Map<String, Object>> hotSearchesCache = new java.util.concurrent.CopyOnWriteArrayList<>();
    private volatile long lastHotSearchesCacheTime = 0;
    private static final long HOT_SEARCHES_CACHE_TTL = 60_000; // 1 phút

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
            PostRepostRepository postRepostRepository,
            SearchTermRepository searchTermRepository
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
        this.searchTermRepository = searchTermRepository;
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

        // 4. Ánh xạ trực tiếp trên bộ nhớ RAM siêu tốc & Thuật toán Đề xuất Sảnh Trực Tuyến Thông Minh (Smart Feed Ranking)
        // Tìm các nhóm mà user đang bị BANNED để tuyệt đối không đề xuất bài
        Set<Long> bannedGroupIds = new HashSet<>();
        if (currentUser != null) {
            List<CommunityMemberEntity> bannedList = this.memberRepository.findByUserAndStatus(currentUser, "BANNED");
            for (CommunityMemberEntity b : bannedList) {
                if (b.getGroup() != null) {
                    bannedGroupIds.add(b.getGroup().getId());
                }
            }
        }

        List<PostDTO> dtos = new ArrayList<>();
        for (PostEntity p : posts) {
            // Loại trừ bài từ nhóm user bị BANNED
            if (p.getGroupId() != null && bannedGroupIds.contains(p.getGroupId())) {
                continue;
            }

            CommunityGroupEntity grp = p.getGroupId() != null ? groupMap.get(p.getGroupId()) : null;
            boolean isMemberOfThisGroup = p.getGroupId() != null && userMemberGroupIds.contains(p.getGroupId());

            // 1. LỌC NGUỒN DỮ LIỆU HỢP LỆ:
            // - Bài viết công khai trên Sảnh chung (groupId == null)
            // - Bài viết thuộc Cộng đồng: phải là nhóm ACTIVE, allowFeedPromotion == true, và user đã tham gia nhóm (hoặc nhóm công khai)
            if (grp != null) {
                if ("SUSPENDED".equalsIgnoreCase(grp.getStatus())) {
                    continue; // Nhóm bị đình chỉ
                }
                if (Boolean.TRUE.equals(grp.getIsPrivate()) && !isMemberOfThisGroup) {
                    continue; // Nhóm riêng tư chỉ thành viên mới được xem
                }
                if (Boolean.FALSE.equals(grp.getIsPublicToFeed()) && !isMemberOfThisGroup) {
                    continue; // Nhóm không muốn đề xuất ra Feed chung nếu không phải thành viên
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

            // 2. CÔNG THỨC CHẤM ĐIỂM XẾP HẠNG (Smart Feed Ranking Formula)
            // Nhận diện tín hiệu âm thanh đặc trưng (Voice note 15s hoặc audio file)
            boolean hasAudio = (p.getVibe() != null && (p.getVibe().contains(".mp3") || p.getVibe().contains(".webm") || p.getVibe().contains("voice") || p.getVibe().contains("audio")))
                    || (p.getImageUrl() != null && (p.getImageUrl().endsWith(".mp3") || p.getImageUrl().endsWith(".webm") || p.getImageUrl().contains("audio")));

            // InteractionScore = (likeCount * 2) + (commentCount * 3) + (hasAudio ? 6 : 0)
            double interactionScore = (likesCount * 2.0) + (commentsCount * 3.0) + (hasAudio ? 6.0 : 0.0);

            // SocialAffinityBonus
            double socialAffinityBonus = 0.0;
            String recoReason = null;
            boolean isFriendInteracted = false;

            boolean isFriendAuthor = author != null && friendUserIds.contains(author.getId());
            boolean hasFriendInteraction = friendCommentSignalMap.containsKey(p.getId()) || friendLikeSignalMap.containsKey(p.getId());

            if (isFriendAuthor) {
                socialAffinityBonus += 15.0;
                recoReason = "Bài viết từ bạn bè @" + (dto.getAuthorAccount() != null ? dto.getAuthorAccount() : dto.getAuthorNickname());
            }

            if (isMemberOfThisGroup) {
                socialAffinityBonus += 10.0;
                if (recoReason == null) {
                    recoReason = "Từ cộng đồng " + (grp != null ? grp.getName() : "bạn đã tham gia");
                }
            }

            if (hasFriendInteraction) {
                socialAffinityBonus += 8.0;
                isFriendInteracted = true;
                if (recoReason == null) {
                    String friendName = friendCommentSignalMap.getOrDefault(p.getId(), friendLikeSignalMap.get(p.getId()));
                    recoReason = "Bạn bè (" + friendName + ") đã tương tác";
                }
            }

            long hoursOld = p.getCreatedAt() != null ? Math.max(0, java.time.Duration.between(p.getCreatedAt(), LocalDateTime.now()).toHours()) : 0;
            // TimeDecay: FinalScore = (InteractionScore + SocialAffinityBonus + 10) / Math.pow(hoursSinceCreated + 2, 1.5)
            double timeDecay = Math.pow(hoursOld + 2.0, 1.5);
            double finalScore = (interactionScore + socialAffinityBonus + 10.0) / timeDecay;

            dto.setTrendingScore(finalScore);
            dto.setRecommendationReason(recoReason);
            dto.setIsFriendInteraction(isFriendInteracted);

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

        // Sắp xếp bài viết sơ bộ theo điểm FinalScore giảm dần
        dtos.sort((a, b) -> Double.compare(b.getTrendingScore(), a.getTrendingScore()));

        // 3. QUY TẮC CHỐNG NGẬP SẢNH (Diversity Cap):
        // Không xếp quá 2 bài liên tiếp từ cùng một Cộng đồng hoặc cùng một tác giả trên bảng tin
        List<PostDTO> diversified = new ArrayList<>();
        List<PostDTO> pool = new ArrayList<>(dtos);

        while (!pool.isEmpty()) {
            int selectedIdx = -1;
            int sz = diversified.size();
            Long last1Group = sz >= 1 ? diversified.get(sz - 1).getGroupId() : null;
            Long last2Group = sz >= 2 ? diversified.get(sz - 2).getGroupId() : null;
            Long last1Author = sz >= 1 ? diversified.get(sz - 1).getAuthorId() : null;
            Long last2Author = sz >= 2 ? diversified.get(sz - 2).getAuthorId() : null;

            for (int i = 0; i < pool.size(); i++) {
                PostDTO cand = pool.get(i);
                boolean wouldViolateGroup = cand.getGroupId() != null 
                        && last1Group != null 
                        && last2Group != null 
                        && cand.getGroupId().equals(last1Group) 
                        && cand.getGroupId().equals(last2Group);

                boolean wouldViolateAuthor = cand.getAuthorId() != null 
                        && last1Author != null 
                        && last2Author != null 
                        && cand.getAuthorId().equals(last1Author) 
                        && cand.getAuthorId().equals(last2Author);

                if (!wouldViolateGroup && !wouldViolateAuthor) {
                    selectedIdx = i;
                    break;
                }
            }

            if (selectedIdx == -1) {
                selectedIdx = 0; // Nếu tất cả ứng viên còn lại đều từ cùng group/author thì lấy phần tử tiếp theo
            }
            diversified.add(pool.remove(selectedIdx));
        }

        return new ResponseData<>(200, "Lấy danh sách bài viết thành công", diversified);
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

            if ("PENDING".equalsIgnoreCase(grp.getStatus())) {
                boolean isAdminGroup = currentUser.getRoles() != null && (currentUser.getRoles().contains("ROLE_ADMIN") || currentUser.getRoles().contains("ROLE_AMDIN"));
                if (!isAdminGroup) {
                    throw new AppException(403, "Cộng đồng đang chờ Admin phê duyệt. Chưa thể đăng bài lúc này!", 403);
                }
            }

            // Kiểm tra tư cách thành viên
            Optional<CommunityMemberEntity> memberOpt = this.memberRepository.findByGroupAndUser(grp, currentUser);
            boolean isMember = memberOpt.isPresent() && "ACTIVE".equalsIgnoreCase(memberOpt.get().getStatus());
            boolean isAdmin = currentUser.getRoles() != null && (currentUser.getRoles().contains("ROLE_ADMIN") || currentUser.getRoles().contains("ROLE_AMDIN"));
            if (!isMember && !isAdmin) {
                if (memberOpt.isPresent() && "PENDING".equalsIgnoreCase(memberOpt.get().getStatus())) {
                    throw new AppException(403, "Yêu cầu gia nhập cộng đồng của bạn đang chờ phê duyệt. Bạn chỉ có thể đăng bài sau khi được duyệt!", 403);
                }
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

    private static class ScoredPost {
        final PostEntity post;
        final double score;
        final boolean isRecommendation;
        final String recommendReason;

        ScoredPost(PostEntity post, double score, boolean isRecommendation, String recommendReason) {
            this.post = post;
            this.score = score;
            this.isRecommendation = isRecommendation;
            this.recommendReason = recommendReason;
        }
    }

    @Transactional
    public ResponseData<List<PostDTO>> searchPosts(JwtAuthenticationToken token, String keyword) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);

        String kw = keyword != null ? keyword.trim() : "";
        if (kw.isEmpty()) {
            return new ResponseData<>(200, "Vui lòng nhập từ khóa tìm kiếm", Collections.emptyList());
        }

        // Tự động học & ghi nhận từ khóa tìm kiếm
        trackSearch(kw);

        // Lấy danh sách bài viết hợp lệ để tính điểm phân tích ngữ nghĩa (Elastic-like relevance ranking)
        List<PostEntity> allPosts = this.postRepository.findAllPostsWithDetails();
        String kwLower = kw.toLowerCase();
        String[] tokens = kwLower.split("\\s+");

        List<ScoredPost> scoredList = new ArrayList<>();
        List<PostEntity> potentialRecommendations = new ArrayList<>();

        for (PostEntity post : allPosts) {
            String content = post.getContent() != null ? post.getContent().toLowerCase() : "";
            String vibe = post.getVibe() != null ? post.getVibe().toLowerCase() : "";
            String authorNick = post.getUser() != null && post.getUser().getNickname() != null ? post.getUser().getNickname().toLowerCase() : "";
            String authorAccount = post.getUser() != null && post.getUser().getAccount() != null ? post.getUser().getAccount().toLowerCase() : "";
            String groupName = post.getGroupName() != null ? post.getGroupName().toLowerCase() : "";

            double score = 0.0;

            // 1. Khớp nguyên cụm từ khóa (Exact phrase match)
            if (content.contains(kwLower)) {
                score += 50.0;
                if (content.startsWith(kwLower)) score += 20.0;
            }
            if (vibe.contains(kwLower)) score += 40.0;
            if (authorNick.contains(kwLower) || authorAccount.contains(kwLower)) score += 35.0;
            if (groupName.contains(kwLower)) score += 25.0;

            // 2. Khớp từng từ đơn / token (Tokenized multi-field match)
            for (String t : tokens) {
                if (t.length() < 2) continue;
                if (content.contains(t)) score += 15.0;
                if (vibe.contains(t)) score += 15.0;
                if (authorNick.contains(t) || authorAccount.contains(t)) score += 12.0;
                if (groupName.contains(t)) score += 10.0;
            }

            // 3. Tăng điểm dựa trên mức độ tương tác cộng đồng (Engagement Signals)
            int likes = post.getLikes() != null ? post.getLikes().size() : 0;
            int comments = post.getComments() != null ? post.getComments().size() : 0;
            long searchHits = post.getSearchHits() != null ? post.getSearchHits() : 0L;
            score += (likes * 1.5) + (comments * 2.5) + (searchHits * 0.5);

            if (score > 0.0) {
                scoredList.add(new ScoredPost(post, score, false, null));
            } else {
                potentialRecommendations.add(post);
            }
        }

        // Sắp xếp bài viết khớp trực tiếp theo điểm liên quan giảm dần
        scoredList.sort((a, b) -> Double.compare(b.score, a.score));

        // Tăng searchHits cho các bài viết khớp hàng đầu
        if (!scoredList.isEmpty()) {
            List<PostEntity> toUpdateHits = new ArrayList<>();
            for (int i = 0; i < Math.min(scoredList.size(), 10); i++) {
                PostEntity p = scoredList.get(i).post;
                p.setSearchHits((p.getSearchHits() != null ? p.getSearchHits() : 0L) + 1);
                toUpdateHits.add(p);
            }
            this.postRepository.saveAll(toUpdateHits);
        }

        // 4. Thuật toán mở rộng đề xuất chủ đề liên quan (Deep Semantic & Related Topic Expansion)
        // Nếu kết quả trực tiếp ít hơn 6 bài: Gợi ý thêm các bài cùng chủ đề hoặc thịnh hành để người dùng lướt phong phú
        if (scoredList.size() < 6 && !potentialRecommendations.isEmpty()) {
            Set<String> matchedVibes = scoredList.stream()
                    .map(sp -> sp.post.getVibe())
                    .filter(v -> v != null && !v.trim().isEmpty())
                    .collect(Collectors.toSet());

            List<ScoredPost> recommendedList = new ArrayList<>();
            for (PostEntity recPost : potentialRecommendations) {
                boolean hasSameVibe = recPost.getVibe() != null && matchedVibes.contains(recPost.getVibe());
                int likes = recPost.getLikes() != null ? recPost.getLikes().size() : 0;
                int comments = recPost.getComments() != null ? recPost.getComments().size() : 0;
                double engagementScore = (likes * 2.0) + (comments * 3.0);

                if (hasSameVibe) {
                    recommendedList.add(new ScoredPost(recPost, engagementScore + 100.0, true, "Gợi ý chủ đề liên quan: #" + recPost.getVibe()));
                } else if (engagementScore > 0) {
                    recommendedList.add(new ScoredPost(recPost, engagementScore, true, "Đề xuất sôi nổi trong sảnh"));
                }
            }

            recommendedList.sort((a, b) -> Double.compare(b.score, a.score));

            int needed = Math.max(0, 8 - scoredList.size());
            for (int i = 0; i < Math.min(needed, recommendedList.size()); i++) {
                scoredList.add(recommendedList.get(i));
            }
        }

        List<PostDTO> dtos = scoredList.stream().map(sp -> {
            PostDTO dto = mapToPostDTO(sp.post, currentUser);
            if (sp.isRecommendation && sp.recommendReason != null) {
                dto.setRecommendationReason(sp.recommendReason);
            }
            return dto;
        }).collect(Collectors.toList());

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
        String termClean = keyword.trim().toLowerCase();
        if (termClean.length() > 80) termClean = termClean.substring(0, 80);

        try {
            Optional<SearchTermEntity> opt = this.searchTermRepository.findByTermIgnoreCase(termClean);
            if (opt.isPresent()) {
                SearchTermEntity entity = opt.get();
                entity.setSearchCount(entity.getSearchCount() + 1);
                entity.setLastSearchedAt(LocalDateTime.now());
                this.searchTermRepository.save(entity);
            } else {
                SearchTermEntity entity = SearchTermEntity.builder()
                        .term(termClean)
                        .searchCount(1L)
                        .lastSearchedAt(LocalDateTime.now())
                        .build();
                this.searchTermRepository.save(entity);
            }
            // Invalidate cache để cập nhật ngay từ khóa hot
            this.lastHotSearchesCacheTime = 0;
        } catch (Exception ignored) {}
    }

    public ResponseData<List<java.util.Map<String, Object>>> getHotSearches() {
        long now = System.currentTimeMillis();
        if (!hotSearchesCache.isEmpty() && (now - lastHotSearchesCacheTime < HOT_SEARCHES_CACHE_TTL)) {
            return new ResponseData<>(200, "Lấy danh sách tìm kiếm hot từ cache thành công", hotSearchesCache);
        }

        List<SearchTermEntity> terms = this.searchTermRepository.findTopHotSearches();
        List<java.util.Map<String, Object>> result = new ArrayList<>();

        if (terms.isEmpty()) {
            String[] defaultHot = {"Thư giãn", "Âm nhạc", "Tâm sự", "Công nghệ", "Tìm bạn", "Đời sống"};
            for (String kw : defaultHot) {
                java.util.Map<String, Object> map = new java.util.HashMap<>();
                map.put("term", kw);
                map.put("count", 1L);
                result.add(map);
            }
        } else {
            for (SearchTermEntity st : terms) {
                java.util.Map<String, Object> map = new java.util.HashMap<>();
                map.put("term", st.getTerm());
                map.put("count", st.getSearchCount());
                result.add(map);
            }
        }

        hotSearchesCache.clear();
        hotSearchesCache.addAll(result);
        lastHotSearchesCacheTime = now;

        return new ResponseData<>(200, "Lấy danh sách tìm kiếm hot thành công", result);
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
        if (targetUserId == null) {
            return new ResponseData<>(200, "Danh sách bài viết trống", List.of());
        }

        UserEntity targetUser = this.userRepository.findById(targetUserId).orElse(null);
        if (targetUser == null) {
            // Không ném 404 để tránh lỗi giao diện profile khi user mới hoặc id không khớp
            return new ResponseData<>(200, "Không tìm thấy người dùng", List.of());
        }

        List<PostEntity> posts = this.postRepository.findAllPostsWithDetails().stream()
                .filter(p -> p.getUser() != null && p.getUser().getId().equals(targetUserId))
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .collect(Collectors.toList());

        List<PostDTO> dtos = posts.stream().map(p -> mapToPostDTO(p, currentUser)).collect(Collectors.toList());
        return new ResponseData<>(200, "Lấy danh sách bài viết của người dùng thành công", dtos);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<PostDTO>> getUserReposts(JwtAuthenticationToken token, Long targetUserId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (targetUserId == null) {
            return new ResponseData<>(200, "Danh sách bài đăng lại trống", List.of());
        }

        UserEntity targetUser = this.userRepository.findById(targetUserId).orElse(null);
        if (targetUser == null) {
            return new ResponseData<>(200, "Không tìm thấy người dùng", List.of());
        }

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
