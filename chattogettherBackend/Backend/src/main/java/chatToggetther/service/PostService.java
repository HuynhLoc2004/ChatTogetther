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
import chatToggetther.modelEntity.PostEntity;
import chatToggetther.modelEntity.PostLikeEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.CommentRepository;
import chatToggetther.repository.PostLikeRepository;
import chatToggetther.repository.PostRepository;
import chatToggetther.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class PostService {
    private final PostRepository postRepository;
    private final PostLikeRepository postLikeRepository;
    private final CommentRepository commentRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm dd/MM");

    public PostService(
            PostRepository postRepository,
            PostLikeRepository postLikeRepository,
            CommentRepository commentRepository,
            UserRepository userRepository,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.postRepository = postRepository;
        this.postLikeRepository = postLikeRepository;
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
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
        long hits = post.getSearchHits() != null ? post.getSearchHits() : 0L;

        dto.setLikesCount(likesCount);
        dto.setCommentsCount(commentsCount);
        dto.setSearchHits(hits);

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
        } else {
            dto.setIsLikedByMe(false);
            dto.setMyReaction(null);
        }

        return dto;
    }

    private CommentDTO mapToCommentDTO(CommentEntity comment) {
        CommentDTO dto = new CommentDTO();
        dto.setId(comment.getId());
        dto.setContent(comment.getContent());
        dto.setCreatedAt(comment.getCreatedAt());
        dto.setFormattedTime(comment.getCreatedAt() != null ? comment.getCreatedAt().format(TIME_FORMATTER) : "");

        UserEntity author = comment.getUser();
        if (author != null) {
            dto.setAuthorId(author.getId());
            dto.setAuthorNickname(author.getNickname() != null && !author.getNickname().isEmpty() ? author.getNickname() : author.getAccount());
            dto.setAuthorAccount(author.getAccount());
            dto.setAuthorAvatar(author.getAvatar());
        }

        return dto;
    }

    @Transactional(readOnly = true)
    public ResponseData<List<PostDTO>> getAllPosts(JwtAuthenticationToken token) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);

        List<PostEntity> posts = this.postRepository.findAllPostsWithDetails();
        List<PostDTO> dtos = posts.stream()
                .map(p -> mapToPostDTO(p, currentUser))
                .collect(Collectors.toList());

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
        post.setCreatedAt(LocalDateTime.now());
        this.postRepository.save(post);

        PostDTO dto = mapToPostDTO(post, currentUser);

        // Thông báo realtime bài đăng mới qua WebSocket
        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "NEW_POST");
        } catch (Exception ignored) {}

        return new ResponseData<>(200, "Đăng bài viết thành công", dto);
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
        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        List<CommentEntity> comments = this.commentRepository.findCommentsByPost(post);
        List<CommentDTO> dtos = comments.stream().map(this::mapToCommentDTO).collect(Collectors.toList());
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
        comment.setCreatedAt(LocalDateTime.now());
        this.commentRepository.save(comment);

        try {
            this.messagingTemplate.convertAndSend("/topic/posts", "POST_COMMENT_ADDED");
            if (post.getUser() != null && !post.getUser().getId().equals(currentUser.getId())) {
                String senderName = currentUser.getNickname() != null && !currentUser.getNickname().isEmpty() ? currentUser.getNickname() : currentUser.getAccount();
                Map<String, Object> notif = new HashMap<>();
                notif.put("id", System.currentTimeMillis());
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

        return new ResponseData<>(200, "Cập nhật bình luận thành công", mapToCommentDTO(comment));
    }
}
