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
    public ResponseEntity<ResponseData<List<PostDTO>>> getAllPosts(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.postService.getAllPosts(token));
    }

    @PostMapping
    public ResponseEntity<ResponseData<PostDTO>> createPost(
            JwtAuthenticationToken token,
            @RequestBody @Valid CreatePostRequest request
    ) {
        return ResponseEntity.ok(this.postService.createPost(token, request));
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
    public ResponseEntity<ResponseData<List<CommentDTO>>> getComments(@PathVariable("id") Long postId) {
        return ResponseEntity.ok(this.postService.getPostComments(postId));
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

    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Boolean>> deletePost(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId
    ) {
        return ResponseEntity.ok(this.postService.deletePost(token, postId));
    }

    @PutMapping("/{id}/comments/{commentId}")
    public ResponseEntity<ResponseData<CommentDTO>> updateComment(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId,
            @PathVariable("commentId") Long commentId,
            @RequestBody @Valid CreateCommentRequest request
    ) {
        return ResponseEntity.ok(this.postService.updateComment(token, postId, commentId, request));
    }

    @DeleteMapping("/{id}/comments/{commentId}")
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
}
