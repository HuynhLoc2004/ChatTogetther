package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
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
import java.util.List;
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
        dto.setCreatedAt(post.getCreatedAt());
        dto.setFormattedTime(post.getCreatedAt() != null ? post.getCreatedAt().format(TIME_FORMATTER) : "");

        UserEntity author = post.getUser();
        if (author != null) {
            dto.setAuthorId(author.getId());
            dto.setAuthorNickname(author.getNickname() != null && !author.getNickname().isEmpty() ? author.getNickname() : author.getAccount());
            dto.setAuthorAccount(author.getAccount());
            dto.setAuthorAvatar(author.getAvatar());
            dto.setAuthorLocation(author.getLocation());
        }

        dto.setLikesCount(this.postLikeRepository.countByPost(post));
        dto.setCommentsCount(this.commentRepository.countByPost(post));
        dto.setIsLikedByMe(currentUser != null && this.postLikeRepository.existsByPostAndUser(post, currentUser));

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
        Long currentUserId = token.getToken().getClaim("user_id");
        UserEntity currentUser = this.userRepository.findById(currentUserId).orElse(null);

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

        Long currentUserId = token.getToken().getClaim("user_id");
        UserEntity currentUser = this.userRepository.findById(currentUserId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại", 404)
        );

        PostEntity post = new PostEntity();
        post.setUser(currentUser);
        post.setContent(request.getContent().trim());
        post.setCreatedAt(LocalDateTime.now());
        this.postRepository.save(post);

        PostDTO dto = mapToPostDTO(post, currentUser);

        // Thông báo realtime bài đăng mới qua WebSocket
        this.messagingTemplate.convertAndSend("/topic/posts", "NEW_POST");

        return new ResponseData<>(200, "Đăng bài viết thành công", dto);
    }

    @Transactional
    public ResponseData<PostDTO> toggleLikePost(JwtAuthenticationToken token, Long postId) {
        Long currentUserId = token.getToken().getClaim("user_id");
        UserEntity currentUser = this.userRepository.findById(currentUserId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại", 404)
        );

        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        Optional<PostLikeEntity> existingLike = this.postLikeRepository.findByPostAndUser(post, currentUser);
        if (existingLike.isPresent()) {
            this.postLikeRepository.delete(existingLike.get());
        } else {
            PostLikeEntity like = new PostLikeEntity();
            like.setPost(post);
            like.setUser(currentUser);
            like.setCreatedAt(LocalDateTime.now());
            this.postLikeRepository.save(like);
        }

        PostDTO dto = mapToPostDTO(post, currentUser);
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

        Long currentUserId = token.getToken().getClaim("user_id");
        UserEntity currentUser = this.userRepository.findById(currentUserId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại", 404)
        );

        PostEntity post = this.postRepository.findById(postId).orElseThrow(() ->
            new AppException(404, "Bài viết không tồn tại", 404)
        );

        CommentEntity comment = new CommentEntity();
        comment.setPost(post);
        comment.setUser(currentUser);
        comment.setContent(request.getContent().trim());
        comment.setCreatedAt(LocalDateTime.now());
        this.commentRepository.save(comment);

        return new ResponseData<>(200, "Bình luận thành công", mapToCommentDTO(comment));
    }

    @Transactional(readOnly = true)
    public ResponseData<List<PostDTO>> searchPosts(JwtAuthenticationToken token, String keyword) {
        Long currentUserId = token.getToken().getClaim("user_id");
        UserEntity currentUser = this.userRepository.findById(currentUserId).orElse(null);

        List<PostEntity> posts = this.postRepository.searchPosts(keyword != null ? keyword.trim() : "");
        List<PostDTO> dtos = posts.stream()
                .map(p -> mapToPostDTO(p, currentUser))
                .collect(Collectors.toList());

        return new ResponseData<>(200, "Tìm kiếm bài viết thành công", dtos);
    }
}
