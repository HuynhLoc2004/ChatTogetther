package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.UserDTO;
import chatToggetther.modelEntity.TrackEntity;
import chatToggetther.service.AdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/stats")
    public ResponseEntity<ResponseData<Map<String, Object>>> getStats(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.adminService.getSystemStats(token));
    }

    @GetMapping("/users")
    public ResponseEntity<ResponseData<List<UserDTO>>> getUsers(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.adminService.getAllUsers(token));
    }

    @PutMapping("/users/{id}/status")
    public ResponseEntity<ResponseData<Boolean>> updateUserStatus(
            JwtAuthenticationToken token,
            @PathVariable("id") Long userId,
            @RequestParam("active") Boolean active
    ) {
        return ResponseEntity.ok(this.adminService.updateUserStatus(token, userId, active));
    }

    @PutMapping("/users/{id}/roles")
    public ResponseEntity<ResponseData<Boolean>> updateUserRoles(
            JwtAuthenticationToken token,
            @PathVariable("id") Long userId,
            @RequestBody List<String> roles
    ) {
        return ResponseEntity.ok(this.adminService.updateUserRoles(token, userId, roles));
    }

    @DeleteMapping("/posts/{id}")
    public ResponseEntity<ResponseData<Boolean>> deletePost(
            JwtAuthenticationToken token,
            @PathVariable("id") Long postId
    ) {
        return ResponseEntity.ok(this.adminService.deletePostByAdmin(token, postId));
    }

    @PostMapping("/tracks")
    public ResponseEntity<ResponseData<TrackEntity>> addTrack(
            JwtAuthenticationToken token,
            @RequestBody TrackEntity track
    ) {
        return ResponseEntity.ok(this.adminService.addTrack(token, track));
    }

    @DeleteMapping("/tracks/{id}")
    public ResponseEntity<ResponseData<Boolean>> deleteTrack(
            JwtAuthenticationToken token,
            @PathVariable("id") Long trackId
    ) {
        return ResponseEntity.ok(this.adminService.deleteTrack(token, trackId));
    }
}

