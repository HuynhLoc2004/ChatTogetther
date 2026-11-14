package chatToggetther.controller;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.DTO.AudioChannelDTO;
import chatToggetther.DTO.MatchIntentDTO;
import chatToggetther.DataRequest.CreateAudioChannelRequest;
import chatToggetther.DataRequest.CreateMatchIntentRequest;
import chatToggetther.DataRequest.UpdateAudioChannelRequest;
import chatToggetther.DataRequest.UpdateMatchIntentRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.AudioChannelEntity;
import chatToggetther.modelEntity.MatchIntentEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.AudioChannelRepository;
import chatToggetther.repository.MatchIntentRepository;
import chatToggetther.repository.UserRepository;
import chatToggetther.service.FrequencyMatchService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/frequency-config")
public class AdminFrequencyConfigController {

    private final MatchIntentRepository matchIntentRepository;
    private final AudioChannelRepository audioChannelRepository;
    private final UserRepository userRepository;
    private final FrequencyMatchService frequencyMatchService;

    public AdminFrequencyConfigController(MatchIntentRepository matchIntentRepository,
                                          AudioChannelRepository audioChannelRepository,
                                          UserRepository userRepository,
                                          FrequencyMatchService frequencyMatchService) {
        this.matchIntentRepository = matchIntentRepository;
        this.audioChannelRepository = audioChannelRepository;
        this.userRepository = userRepository;
        this.frequencyMatchService = frequencyMatchService;
    }

    private void checkAdminPermission(JwtAuthenticationToken token) {
        Long userId = SecurityUtils.extractUserId(token);
        if (userId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        UserEntity user = this.userRepository.findById(userId).orElseThrow(() ->
                new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại", 404)
        );

        boolean isAdmin = user.getRoles() != null && (
                user.getRoles().contains("ROLE_ADMIN") ||
                user.getRoles().contains("ROLE_AMDIN") ||
                user.getRoles().contains("TL_SYS_SUPERADMIN")
        );

        if (!isAdmin) {
            throw new AppException(ErrorCode.UNAUTHORIZED.getCode(), "Bạn không có quyền quản trị viên hệ thống!", 403);
        }
    }

    // =========================================================================
    // 1. MATCH INTENT (BĂNG TẦN FM) CRUD
    // =========================================================================

    @GetMapping("/intents")
    public ResponseEntity<ResponseData<List<MatchIntentDTO>>> getAllIntents(JwtAuthenticationToken token) {
        checkAdminPermission(token);
        List<MatchIntentDTO> list = this.matchIntentRepository.findAllByOrderByDisplayOrderAsc().stream()
                .map(this::mapToIntentDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(new ResponseData<>(200, "Lấy danh sách băng tần thành công", list));
    }

    @PostMapping("/intents")
    public ResponseEntity<ResponseData<MatchIntentDTO>> createIntent(
            JwtAuthenticationToken token,
            @RequestBody @Valid CreateMatchIntentRequest request
    ) {
        checkAdminPermission(token);

        String code = request.getCode().trim().toUpperCase();
        if (this.matchIntentRepository.existsByCode(code)) {
            throw new AppException(400, "Mã băng tần (code) đã tồn tại: " + code, 400);
        }

        if (request.getFreqStart() >= request.getFreqEnd()) {
            throw new AppException(400, "Tần số bắt đầu phải nhỏ hơn tần số kết thúc", 400);
        }

        MatchIntentEntity entity = MatchIntentEntity.builder()
                .code(code)
                .title(request.getTitle().trim())
                .subtitle(request.getSubtitle())
                .iconName(request.getIconName())
                .freqStart(request.getFreqStart())
                .freqEnd(request.getFreqEnd())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .displayOrder(request.getDisplayOrder() != null ? request.getDisplayOrder() : 1)
                .build();

        MatchIntentEntity saved = this.matchIntentRepository.save(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Thêm mới băng tần thành công", mapToIntentDTO(saved)));
    }

    @PutMapping("/intents/{id}")
    public ResponseEntity<ResponseData<MatchIntentDTO>> updateIntent(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @RequestBody @Valid UpdateMatchIntentRequest request
    ) {
        checkAdminPermission(token);

        MatchIntentEntity entity = this.matchIntentRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Không tìm thấy băng tần với id: " + id, 404)
        );

        if (request.getTitle() != null && !request.getTitle().trim().isEmpty()) {
            entity.setTitle(request.getTitle().trim());
        }
        if (request.getSubtitle() != null) entity.setSubtitle(request.getSubtitle());
        if (request.getIconName() != null) entity.setIconName(request.getIconName());
        if (request.getFreqStart() != null) entity.setFreqStart(request.getFreqStart());
        if (request.getFreqEnd() != null) entity.setFreqEnd(request.getFreqEnd());
        if (request.getIsActive() != null) entity.setIsActive(request.getIsActive());
        if (request.getDisplayOrder() != null) entity.setDisplayOrder(request.getDisplayOrder());

        if (entity.getFreqStart() >= entity.getFreqEnd()) {
            throw new AppException(400, "Tần số bắt đầu phải nhỏ hơn tần số kết thúc", 400);
        }

        MatchIntentEntity saved = this.matchIntentRepository.save(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Cập nhật băng tần thành công", mapToIntentDTO(saved)));
    }

    @PatchMapping("/intents/{id}/toggle")
    public ResponseEntity<ResponseData<MatchIntentDTO>> toggleIntent(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        checkAdminPermission(token);

        MatchIntentEntity entity = this.matchIntentRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Không tìm thấy băng tần với id: " + id, 404)
        );

        entity.setIsActive(!Boolean.TRUE.equals(entity.getIsActive()));
        MatchIntentEntity saved = this.matchIntentRepository.save(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Chuyển trạng thái băng tần thành công", mapToIntentDTO(saved)));
    }

    @DeleteMapping("/intents/{id}")
    public ResponseEntity<ResponseData<Boolean>> deleteIntent(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        checkAdminPermission(token);

        MatchIntentEntity entity = this.matchIntentRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Không tìm thấy băng tần với id: " + id, 404)
        );

        this.matchIntentRepository.delete(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Đã xóa băng tần", true));
    }

    // =========================================================================
    // 2. AUDIO CHANNEL (ĐÀI PHÁT NHẠC HỆ THỐNG) CRUD
    // =========================================================================

    @GetMapping("/channels")
    public ResponseEntity<ResponseData<List<AudioChannelDTO>>> getAllChannels(JwtAuthenticationToken token) {
        checkAdminPermission(token);
        List<AudioChannelDTO> list = this.audioChannelRepository.findAllByOrderByIdAsc().stream()
                .map(this::mapToChannelDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(new ResponseData<>(200, "Lấy danh sách đài phát nhạc thành công", list));
    }

    @PostMapping("/channels")
    public ResponseEntity<ResponseData<AudioChannelDTO>> createChannel(
            JwtAuthenticationToken token,
            @RequestBody @Valid CreateAudioChannelRequest request
    ) {
        checkAdminPermission(token);

        AudioChannelEntity entity = AudioChannelEntity.builder()
                .name(request.getName().trim())
                .genreTag(request.getGenreTag())
                .streamUrl(request.getStreamUrl().trim())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        AudioChannelEntity saved = this.audioChannelRepository.save(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Thêm mới đài phát nhạc thành công", mapToChannelDTO(saved)));
    }

    @PutMapping("/channels/{id}")
    public ResponseEntity<ResponseData<AudioChannelDTO>> updateChannel(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @RequestBody @Valid UpdateAudioChannelRequest request
    ) {
        checkAdminPermission(token);

        AudioChannelEntity entity = this.audioChannelRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Không tìm thấy đài phát nhạc với id: " + id, 404)
        );

        if (request.getName() != null && !request.getName().trim().isEmpty()) {
            entity.setName(request.getName().trim());
        }
        if (request.getGenreTag() != null) entity.setGenreTag(request.getGenreTag());
        if (request.getStreamUrl() != null && !request.getStreamUrl().trim().isEmpty()) {
            entity.setStreamUrl(request.getStreamUrl().trim());
        }
        if (request.getIsActive() != null) entity.setIsActive(request.getIsActive());

        AudioChannelEntity saved = this.audioChannelRepository.save(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Cập nhật đài phát nhạc thành công", mapToChannelDTO(saved)));
    }

    @PatchMapping("/channels/{id}/toggle")
    public ResponseEntity<ResponseData<AudioChannelDTO>> toggleChannel(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        checkAdminPermission(token);

        AudioChannelEntity entity = this.audioChannelRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Không tìm thấy đài phát nhạc với id: " + id, 404)
        );

        entity.setIsActive(!Boolean.TRUE.equals(entity.getIsActive()));
        AudioChannelEntity saved = this.audioChannelRepository.save(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Chuyển trạng thái đài phát nhạc thành công", mapToChannelDTO(saved)));
    }

    @DeleteMapping("/channels/{id}")
    public ResponseEntity<ResponseData<Boolean>> deleteChannel(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        checkAdminPermission(token);

        AudioChannelEntity entity = this.audioChannelRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Không tìm thấy đài phát nhạc với id: " + id, 404)
        );

        this.audioChannelRepository.delete(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Đã xóa đài phát nhạc", true));
    }

    // =========================================================================
    // 3. THỐNG KÊ REALTIME (LIVE STATS)
    // =========================================================================

    @GetMapping("/live-stats")
    public ResponseEntity<ResponseData<Map<String, Object>>> getLiveStats(JwtAuthenticationToken token) {
        checkAdminPermission(token);
        return ResponseEntity.ok(new ResponseData<>(200, "Lấy thống kê trạm sóng thời gian thực thành công",
                this.frequencyMatchService.getLiveBroadcastStats()));
    }

    // =========================================================================
    // HELPER MAPPERS
    // =========================================================================

    private MatchIntentDTO mapToIntentDTO(MatchIntentEntity entity) {
        return MatchIntentDTO.builder()
                .id(entity.getId())
                .code(entity.getCode())
                .title(entity.getTitle())
                .subtitle(entity.getSubtitle())
                .iconName(entity.getIconName())
                .freqStart(entity.getFreqStart())
                .freqEnd(entity.getFreqEnd())
                .isActive(entity.getIsActive())
                .displayOrder(entity.getDisplayOrder())
                .build();
    }

    private AudioChannelDTO mapToChannelDTO(AudioChannelEntity entity) {
        return AudioChannelDTO.builder()
                .id(entity.getId())
                .name(entity.getName())
                .genreTag(entity.getGenreTag())
                .streamUrl(entity.getStreamUrl())
                .isActive(entity.getIsActive())
                .build();
    }
}
