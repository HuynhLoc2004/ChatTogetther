package chatToggetther.controller;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.DataRequest.CreateMusicTrackRequest;
import chatToggetther.DataRequest.UpdateMusicTrackRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.MusicTrackEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.MusicTrackRepository;
import chatToggetther.repository.UserRepository;
import chatToggetther.service.MediaStorageService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminMusicTrackController {

    private final MusicTrackRepository musicTrackRepository;
    private final UserRepository userRepository;
    private final MediaStorageService mediaStorageService;

    public AdminMusicTrackController(
            MusicTrackRepository musicTrackRepository,
            UserRepository userRepository,
            MediaStorageService mediaStorageService
    ) {
        this.musicTrackRepository = musicTrackRepository;
        this.userRepository = userRepository;
        this.mediaStorageService = mediaStorageService;
    }

    private void checkAdminPermission(JwtAuthenticationToken token) {
        Long userId = SecurityUtils.extractUserId(token);
        if (userId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập tài khoản quản trị!", 401);
        }

        UserEntity user = this.userRepository.findById(userId).orElseThrow(() ->
                new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại!", 404)
        );

        boolean isAdmin = user.getRoles() != null && user.getRoles().stream().anyMatch(r -> {
            String u = String.valueOf(r).toUpperCase();
            return u.contains("ADMIN") || u.contains("AMDIN") || u.startsWith("TL_") || u.startsWith("PERM_");
        });

        if (!isAdmin) {
            throw new AppException(ErrorCode.UNAUTHORIZED.getCode(), "Bạn không có quyền quản trị viên!", 403);
        }
    }

    @GetMapping({"/music-tracks", "/music"})
    public ResponseEntity<ResponseData<List<MusicTrackEntity>>> getAllMusicTracks(JwtAuthenticationToken token) {
        checkAdminPermission(token);
        List<MusicTrackEntity> tracks = this.musicTrackRepository.findAllByOrderByIdDesc();
        return ResponseEntity.ok(new ResponseData<>(200, "Lấy danh sách bản nhạc thành công!", tracks));
    }

    @PostMapping({"/music-tracks", "/music"})
    public ResponseEntity<ResponseData<MusicTrackEntity>> createMusicTrack(
            JwtAuthenticationToken token,
            @Valid @RequestBody CreateMusicTrackRequest request
    ) {
        checkAdminPermission(token);

        MusicTrackEntity track = MusicTrackEntity.builder()
                .title(request.getTitle())
                .artist(request.getArtist())
                .coverUrl(request.getCoverUrl())
                .audioUrl(request.getAudioUrl())
                .genreTag(request.getGenreTag())
                .isFeatured(Boolean.TRUE.equals(request.getIsFeatured()))
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        MusicTrackEntity saved = this.musicTrackRepository.save(track);
        return ResponseEntity.ok(new ResponseData<>(200, "Thêm bản nhạc mới thành công!", saved));
    }

    @PutMapping({"/music-tracks/{id}", "/music/{id}"})
    public ResponseEntity<ResponseData<MusicTrackEntity>> updateMusicTrack(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateMusicTrackRequest request
    ) {
        checkAdminPermission(token);

        MusicTrackEntity track = this.musicTrackRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Không tìm thấy bản nhạc ID: " + id, 404)
        );

        if (request.getTitle() != null) track.setTitle(request.getTitle());
        if (request.getArtist() != null) track.setArtist(request.getArtist());
        if (request.getCoverUrl() != null) track.setCoverUrl(request.getCoverUrl());
        if (request.getAudioUrl() != null) track.setAudioUrl(request.getAudioUrl());
        if (request.getGenreTag() != null) track.setGenreTag(request.getGenreTag());
        if (request.getIsFeatured() != null) track.setIsFeatured(request.getIsFeatured());
        if (request.getIsActive() != null) track.setIsActive(request.getIsActive());

        MusicTrackEntity updated = this.musicTrackRepository.save(track);
        return ResponseEntity.ok(new ResponseData<>(200, "Cập nhật bản nhạc thành công!", updated));
    }

    @PatchMapping({"/music-tracks/{id}/toggle", "/music/{id}/toggle"})
    public ResponseEntity<ResponseData<MusicTrackEntity>> toggleMusicTrack(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @RequestParam(name = "field", defaultValue = "active") String field
    ) {
        checkAdminPermission(token);

        MusicTrackEntity track = this.musicTrackRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Không tìm thấy bản nhạc ID: " + id, 404)
        );

        if ("featured".equalsIgnoreCase(field)) {
            track.setIsFeatured(!Boolean.TRUE.equals(track.getIsFeatured()));
        } else {
            track.setIsActive(!Boolean.TRUE.equals(track.getIsActive()));
        }

        MusicTrackEntity updated = this.musicTrackRepository.save(track);
        return ResponseEntity.ok(new ResponseData<>(200, "Chuyển trạng thái bản nhạc thành công!", updated));
    }

    @DeleteMapping({"/music-tracks/{id}", "/music/{id}"})
    public ResponseEntity<ResponseData<Boolean>> deleteMusicTrack(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        checkAdminPermission(token);

        if (!this.musicTrackRepository.existsById(id)) {
            throw new AppException(404, "Không tìm thấy bản nhạc ID: " + id, 404);
        }

        this.musicTrackRepository.deleteById(id);
        return ResponseEntity.ok(new ResponseData<>(200, "Xóa bản nhạc thành công!", true));
    }

    @PostMapping(value = {"/music/upload", "/music-tracks/upload"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ResponseData<Map<String, String>>> uploadMusicFile(
            JwtAuthenticationToken token,
            @RequestParam("file") MultipartFile file
    ) {
        checkAdminPermission(token);

        String audioUrl = this.mediaStorageService.storeMusicFile(file);
        Map<String, String> res = new HashMap<>();
        res.put("audioUrl", audioUrl);
        return ResponseEntity.ok(new ResponseData<>(200, "Tải lên tệp âm thanh thành công!", res));
    }
}
