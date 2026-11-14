package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.CommentDTO;
import chatToggetther.DTO.PostDTO;
import chatToggetther.DataRequest.CreateCommentRequest;
import chatToggetther.DataRequest.CreatePostRequest;
import chatToggetther.service.PostService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
public class PostController {
    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    @GetMapping
    public ResponseEntity<ResponseData<List<PostDTO>>> getAllPosts(
            JwtAuthenticationToken token,
            @RequestParam(value = "page", required = false, defaultValue = "0") Integer page,
            @RequestParam(value = "size", required = false, defaultValue = "25") Integer size
    ) {
        return ResponseEntity.ok(this.postService.getAllPosts(token, page, size));
    }

    @GetMapping("/feed")
    public ResponseEntity<ResponseData<List<PostDTO>>> getFeedPosts(
            JwtAuthenticationToken token,
            @RequestParam(value = "page", required = false, defaultValue = "0") Integer page,
            @RequestParam(value = "size", required = false, defaultValue = "25") Integer size
    ) {
        return ResponseEntity.ok(this.postService.getAllPosts(token, page, size));
    }

    @PostMapping
    public ResponseEntity<ResponseData<PostDTO>> createPost(
            JwtAuthenticationToken token,
            @RequestBody @Valid CreatePostRequest request
    ) {
        return ResponseEntity.ok(this.postService.createPost(token, request));
    }

    @GetMapping("/group/{groupId}")
    public ResponseEntity<ResponseData<List<PostDTO>>> getGroupPosts(
            JwtAuthenticationToken token,
            @PathVariable("groupId") Long groupId,
            @RequestParam(value = "status", required = false, defaultValue = "APPROVED") String status
    ) {
        return ResponseEntity.ok(this.postService.getGroupPosts(token, groupId, status));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ResponseData<PostDTO>> approvePost(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId
    ) {
        return ResponseEntity.ok(this.postService.approvePost(token, postId));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ResponseData<PostDTO>> rejectPost(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId,
            @RequestBody(required = false) java.util.Map<String, String> body
    ) {
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(this.postService.rejectPost(token, postId, reason));
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<ResponseData<PostDTO>> toggleLike(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId,
            @RequestParam(value = "type", required = false) String reactionType,
            @RequestParam(value = "reactionType", required = false) String reactionTypeAlt
    ) {
        String effectiveType = (reactionType != null && !reactionType.trim().isEmpty()) ? reactionType : reactionTypeAlt;
        return ResponseEntity.ok(this.postService.toggleLikePost(token, postId, effectiveType));
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<ResponseData<List<CommentDTO>>> getComments(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId
    ) {
        return ResponseEntity.ok(this.postService.getPostComments(token, postId));
    }

    @PostMapping("/comments/{commentId}/like")
    public ResponseEntity<ResponseData<CommentDTO>> toggleLikeComment(
            JwtAuthenticationToken token,
            @PathVariable("commentId") Long commentId
    ) {
        return ResponseEntity.ok(this.postService.toggleLikeComment(token, commentId));
    }

    @PostMapping("/{id}/comments/{commentId}/like")
    public ResponseEntity<ResponseData<CommentDTO>> toggleLikeCommentWithPost(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId,
            @PathVariable("commentId") Long commentId
    ) {
        return ResponseEntity.ok(this.postService.toggleLikeComment(token, commentId));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<ResponseData<CommentDTO>> addComment(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId,
            @RequestBody @Valid CreateCommentRequest request
    ) {
        return ResponseEntity.ok(this.postService.addComment(token, postId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResponseData<PostDTO>> updatePost(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId,
            @RequestBody @Valid CreatePostRequest request
    ) {
        return ResponseEntity.ok(this.postService.updatePost(token, postId, request));
    }

    @RequestMapping(value = {"/{id}", "/{id}/delete", "/delete/{id}"}, method = {RequestMethod.DELETE, RequestMethod.POST})
    public ResponseEntity<ResponseData<Boolean>> deletePost(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId
    ) {
        return ResponseEntity.ok(this.postService.deletePost(token, postId));
    }

    @RequestMapping(value = {"/{id}/comments/{commentId}", "/{id}/comments/{commentId}/update"}, method = {RequestMethod.PUT, RequestMethod.POST})
    public ResponseEntity<ResponseData<CommentDTO>> updateComment(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId,
            @PathVariable("commentId") Long commentId,
            @RequestBody @Valid CreateCommentRequest request
    ) {
        return ResponseEntity.ok(this.postService.updateComment(token, postId, commentId, request));
    }

    @RequestMapping(value = {"/{id}/comments/{commentId}", "/{id}/comments/{commentId}/delete"}, method = {RequestMethod.DELETE, RequestMethod.POST})
    public ResponseEntity<ResponseData<Boolean>> deleteComment(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId,
            @PathVariable("commentId") Long commentId
    ) {
        return ResponseEntity.ok(this.postService.deleteComment(token, postId, commentId));
    }

    @GetMapping("/search")
    public ResponseEntity<ResponseData<List<PostDTO>>> searchPosts(
            JwtAuthenticationToken token,
            @RequestParam("keyword") String keyword
    ) {
        return ResponseEntity.ok(this.postService.searchPosts(token, keyword));
    }

    @GetMapping("/hot-searches")
    public ResponseEntity<ResponseData<List<java.util.Map<String, Object>>>> getHotSearches() {
        return ResponseEntity.ok(this.postService.getHotSearches());
    }

    @GetMapping("/trending")
    public ResponseEntity<ResponseData<List<PostDTO>>> getTrendingPosts(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.postService.getTrendingPosts(token));
    }

    @PostMapping("/track-search")
    public ResponseEntity<ResponseData<Void>> trackSearch(
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestBody(required = false) java.util.Map<String, String> body
    ) {
        String effectiveKw = (keyword != null && !keyword.trim().isEmpty()) ? keyword : (body != null ? body.get("keyword") : null);
        this.postService.trackSearch(effectiveKw);
        return ResponseEntity.ok(new ResponseData<>(200, "Đã ghi nhận dữ liệu tìm kiếm thành công", null));
    }

    @PostMapping("/{id}/report")
    public ResponseEntity<ResponseData<Boolean>> reportPost(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @RequestBody(required = false) java.util.Map<String, String> request
    ) {
        return ResponseEntity.ok(this.postService.reportPost(token, id, request));
    }

    @PostMapping("/{id}/repost")
    public ResponseEntity<ResponseData<PostDTO>> toggleRepost(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        return ResponseEntity.ok(this.postService.toggleRepost(token, id));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<ResponseData<List<PostDTO>>> getUserPosts(
            JwtAuthenticationToken token,
            @PathVariable("userId") Long userId
    ) {
        return ResponseEntity.ok(this.postService.getUserPosts(token, userId));
    }

    @GetMapping("/user/{userId}/reposts")
    public ResponseEntity<ResponseData<List<PostDTO>>> getUserReposts(
            JwtAuthenticationToken token,
            @PathVariable("userId") Long userId
    ) {
        return ResponseEntity.ok(this.postService.getUserReposts(token, userId));
    }

    // ==========================================
    // QUẢN TRỊ BÀI VIẾT & ĐĂNG LẠI (ADMIN MODERATION)
    // ==========================================

    @GetMapping("/admin/all")
    public ResponseEntity<ResponseData<List<PostDTO>>> getAdminPosts(
            JwtAuthenticationToken token,
            @RequestParam(value = "filter", defaultValue = "ALL") String filter
    ) {
        return ResponseEntity.ok(this.postService.getAdminPosts(token, filter));
    }

    @PostMapping("/{id}/admin-takedown")
    public ResponseEntity<ResponseData<PostDTO>> adminSoftDeletePost(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @RequestBody(required = false) java.util.Map<String, String> request
    ) {
        String reason = request != null && request.containsKey("reason") ? request.get("reason") : null;
        return ResponseEntity.ok(this.postService.adminSoftDeletePost(token, id, reason));
    }

    @PostMapping("/{id}/admin-restore")
    public ResponseEntity<ResponseData<PostDTO>> adminRestorePost(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        return ResponseEntity.ok(this.postService.adminRestorePost(token, id));
    }

    @DeleteMapping("/{id}/admin-hard-delete")
    public ResponseEntity<ResponseData<Boolean>> adminHardDeletePost(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        return ResponseEntity.ok(this.postService.adminHardDeletePost(token, id));
    }

    @GetMapping("/admin/reposts")
    public ResponseEntity<ResponseData<List<java.util.Map<String, Object>>>> getAdminReposts(
            JwtAuthenticationToken token
    ) {
        return ResponseEntity.ok(this.postService.getAdminReposts(token));
    }

    @DeleteMapping("/admin/reposts/{repostId}")
    public ResponseEntity<ResponseData<Boolean>> adminDeleteRepost(
            JwtAuthenticationToken token,
            @PathVariable("repostId") Long repostId
    ) {
        return ResponseEntity.ok(this.postService.adminDeleteRepost(token, repostId));
    }
}
