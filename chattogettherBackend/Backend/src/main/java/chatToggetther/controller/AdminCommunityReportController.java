package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.CommunityReportDTO;
import chatToggetther.DataRequest.ResolveReportRequest;
import chatToggetther.service.CommunityGroupService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/community-reports")
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_AMDIN')")
public class AdminCommunityReportController {

    private final CommunityGroupService communityGroupService;

    public AdminCommunityReportController(CommunityGroupService communityGroupService) {
        this.communityGroupService = communityGroupService;
    }

    /**
     * Lấy danh sách các báo cáo vi phạm cộng đồng / nội dung trong nhóm.
     */
    @GetMapping
    public ResponseEntity<ResponseData<List<CommunityReportDTO>>> getCommunityReports(
            @RequestParam(value = "status", required = false) String status,
            JwtAuthenticationToken token
    ) {
        return ResponseEntity.ok(this.communityGroupService.getCommunityReports(status, token));
    }

    /**
     * Super Admin giải quyết báo cáo vi phạm (DISMISSED, RESOLVED_WARNED, RESOLVED_SUSPENDED).
     */
    @PatchMapping("/{reportId}/resolve")
    public ResponseEntity<ResponseData<CommunityReportDTO>> resolveCommunityReport(
            @PathVariable("reportId") Long reportId,
            @Valid @RequestBody ResolveReportRequest request,
            JwtAuthenticationToken token
    ) {
        return ResponseEntity.ok(this.communityGroupService.resolveCommunityReport(token, reportId, request));
    }
}
