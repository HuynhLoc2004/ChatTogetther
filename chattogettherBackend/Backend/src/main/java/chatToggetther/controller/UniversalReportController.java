package chatToggetther.controller;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.DataRequest.CreateUniversalReportRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.CommunityGroupEntity;
import chatToggetther.modelEntity.CommunityReportEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.CommunityGroupRepository;
import chatToggetther.repository.CommunityReportRepository;
import chatToggetther.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class UniversalReportController {

    private final CommunityReportRepository communityReportRepository;
    private final UserRepository userRepository;
    private final CommunityGroupRepository communityGroupRepository;

    public UniversalReportController(
            CommunityReportRepository communityReportRepository,
            UserRepository userRepository,
            CommunityGroupRepository communityGroupRepository
    ) {
        this.communityReportRepository = communityReportRepository;
        this.userRepository = userRepository;
        this.communityGroupRepository = communityGroupRepository;
    }

    @PostMapping
    public ResponseEntity<ResponseData<Map<String, Object>>> submitReport(
            JwtAuthenticationToken token,
            @Valid @RequestBody CreateUniversalReportRequest request
    ) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Bạn cần đăng nhập để gửi báo cáo vi phạm!", 401);
        }

        UserEntity reporter = this.userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Không tìm thấy thông tin tài khoản!", 404));

        String targetType = request.getTargetType().toUpperCase().trim();
        CommunityGroupEntity community = null;

        if ("COMMUNITY".equals(targetType)) {
            community = this.communityGroupRepository.findById(request.getTargetId()).orElse(null);
        }

        CommunityReportEntity report = CommunityReportEntity.builder()
                .reporter(reporter)
                .community(community)
                .targetType(targetType)
                .targetId(request.getTargetId())
                .reason(request.getReason())
                .reasonCode(request.getReason())
                .description(request.getDescription())
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .build();

        CommunityReportEntity saved = this.communityReportRepository.save(report);

        Map<String, Object> resData = new HashMap<>();
        resData.put("reportId", saved.getId());
        resData.put("targetType", saved.getTargetType());
        resData.put("targetId", saved.getTargetId());
        resData.put("status", saved.getStatus());

        return ResponseEntity.ok(new ResponseData<>(200, "Đã tiếp nhận báo cáo của bạn. Đội ngũ quản trị sẽ xử lý trong thời gian sớm nhất!", resData));
    }
}
