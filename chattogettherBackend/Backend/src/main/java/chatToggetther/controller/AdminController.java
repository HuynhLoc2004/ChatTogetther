package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.UserDTO;
import chatToggetther.DTO.RoomDTO;
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

    @GetMapping("/tracks")
    public ResponseEntity<ResponseData<List<TrackEntity>>> getAllTracks(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.adminService.getAllTracks(token));
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

    // ==========================================
    // CẤU HÌNH HỆ THỐNG (SYSTEM CONFIG)
    // ==========================================

    @GetMapping("/config")
    public ResponseEntity<ResponseData<Map<String, String>>> getSystemConfig() {
        return ResponseEntity.ok(this.adminService.getSystemConfig());
    }

    @PutMapping("/config")
    public ResponseEntity<ResponseData<Boolean>> updateSystemConfig(
            JwtAuthenticationToken token,
            @RequestBody Map<String, Object> configs
    ) {
        return ResponseEntity.ok(this.adminService.updateSystemConfig(token, configs));
    }

    // ==========================================
    // QUẢN LÝ CÂU HỎI THỬ THÁCH (CHALLENGES)
    // ==========================================

    @GetMapping("/challenges")
    public ResponseEntity<ResponseData<List<chatToggetther.modelEntity.ChallengeEntity>>> getAllChallenges(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.adminService.getAllChallenges(token));
    }

    @PostMapping("/challenges")
    public ResponseEntity<ResponseData<chatToggetther.modelEntity.ChallengeEntity>> addChallenge(
            JwtAuthenticationToken token,
            @RequestBody chatToggetther.modelEntity.ChallengeEntity challenge
    ) {
        return ResponseEntity.ok(this.adminService.addChallenge(token, challenge));
    }

    @PutMapping("/challenges/{id}")
    public ResponseEntity<ResponseData<chatToggetther.modelEntity.ChallengeEntity>> updateChallenge(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @RequestBody chatToggetther.modelEntity.ChallengeEntity challenge
    ) {
        return ResponseEntity.ok(this.adminService.updateChallenge(token, id, challenge));
    }

    @DeleteMapping("/challenges/{id}")
    public ResponseEntity<ResponseData<Boolean>> deleteChallenge(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        return ResponseEntity.ok(this.adminService.deleteChallenge(token, id));
    }

    // ==========================================
    // QUẢN TRỊ CỘNG ĐỒNG (COMMUNITY GROUPS)
    // ==========================================

    @GetMapping("/groups")
    public ResponseEntity<ResponseData<List<chatToggetther.DTO.CommunityGroupDTO>>> getAllGroupsAdmin(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.adminService.getAllGroupsAdmin(token));
    }

    @PostMapping("/groups/{id}/toggle-feed")
    public ResponseEntity<ResponseData<Boolean>> toggleGroupFeed(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @RequestBody Map<String, Boolean> body
    ) {
        Boolean isPublicToFeed = body != null ? body.get("isPublicToFeed") : true;
        return ResponseEntity.ok(this.adminService.toggleGroupFeed(token, id, isPublicToFeed));
    }

    @PostMapping("/groups/{id}/toggle-approval")
    public ResponseEntity<ResponseData<Boolean>> toggleGroupPostApproval(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @RequestBody Map<String, Boolean> body
    ) {
        Boolean requiresPostApproval = body != null ? body.get("requiresPostApproval") : false;
        return ResponseEntity.ok(this.adminService.toggleGroupPostApproval(token, id, requiresPostApproval));
    }

    // ==========================================
    // QUẢN TRỊ BÁO CÁO VI PHẠM (POST REPORTS)
    // ==========================================

    @GetMapping("/reports")
    public ResponseEntity<ResponseData<List<chatToggetther.DTO.PostReportDTO>>> getAllReports(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.adminService.getAllReports(token));
    }

    @PostMapping("/reports/{id}/resolve")
    public ResponseEntity<ResponseData<Boolean>> resolveReport(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> body
    ) {
        return ResponseEntity.ok(this.adminService.resolveReport(token, id, body));
    }

    @GetMapping("/rooms")
    public ResponseEntity<ResponseData<List<RoomDTO>>> getAdminRooms() {
        return ResponseEntity.ok(this.adminService.getAdminRooms());
    }

    @RequestMapping(value = "/rooms/{id}/close", method = {RequestMethod.POST, RequestMethod.PATCH})
    public ResponseEntity<ResponseData<Boolean>> forceCloseRoom(@PathVariable("id") Long roomId) {
        return ResponseEntity.ok(this.adminService.forceCloseRoom(roomId));
    }

}
