package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.CommunityGroupDTO;
import chatToggetther.service.CommunityGroupService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/admin/communities", "/api/admin/groups"})
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_AMDIN', 'TL_SYS_SUPERADMIN', 'TL_PERM_ALL', 'ADMIN') or hasRole('ADMIN')")
public class AdminCommunityController {

    private final CommunityGroupService communityGroupService;

    public AdminCommunityController(CommunityGroupService communityGroupService) {
        this.communityGroupService = communityGroupService;
    }

    /**
     * Lấy danh sách cộng đồng phục vụ quản trị hệ thống (hỗ trợ filter status, keyword tìm kiếm, phân trang).
     */
    @GetMapping
    public ResponseEntity<ResponseData<List<CommunityGroupDTO>>> getAdminCommunities(
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size,
            JwtAuthenticationToken token
    ) {
        return ResponseEntity.ok(this.communityGroupService.getAdminCommunities(status, keyword, page, size, token));
    }

    /**
     * Cập nhật trạng thái kiểm duyệt (ACTIVE, RESTRICTED, SUSPENDED) hoặc ghim nổi bật (isFeatured).
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<ResponseData<CommunityGroupDTO>> updateCommunityStatus(
            @PathVariable("id") Long id,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "status", required = false) String paramStatus,
            @RequestParam(value = "isFeatured", required = false) Boolean paramIsFeatured,
            JwtAuthenticationToken token
    ) {
        String status = paramStatus;
        Boolean isFeatured = paramIsFeatured;

        if (body != null) {
            if (body.containsKey("status") && body.get("status") != null) {
                status = body.get("status").toString();
            }
            if (body.containsKey("isFeatured") && body.get("isFeatured") != null) {
                isFeatured = Boolean.valueOf(body.get("isFeatured").toString());
            }
        }

        return ResponseEntity.ok(this.communityGroupService.updateCommunityStatusByAdmin(token, id, status, isFeatured));
    }

    /**
     * Xóa vĩnh viễn cộng đồng vi phạm khỏi hệ thống.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Boolean>> deleteCommunity(
            @PathVariable("id") Long id,
            JwtAuthenticationToken token
    ) {
        return ResponseEntity.ok(this.communityGroupService.deleteCommunityByAdmin(token, id));
    }
}
