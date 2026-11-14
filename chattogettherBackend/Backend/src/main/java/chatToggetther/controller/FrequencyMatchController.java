package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.BroadcastStationDTO;
import chatToggetther.DTO.FrequencyConfigResponseDTO;
import chatToggetther.DataRequest.LockTargetRequest;
import chatToggetther.DataRequest.ScanStationRequest;
import chatToggetther.service.FrequencyMatchService;
import chatToggetther.service.MediaStorageService;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/match")
public class FrequencyMatchController {

    private final FrequencyMatchService frequencyMatchService;
    private final MediaStorageService mediaStorageService;

    public FrequencyMatchController(FrequencyMatchService frequencyMatchService, MediaStorageService mediaStorageService) {
        this.frequencyMatchService = frequencyMatchService;
        this.mediaStorageService = mediaStorageService;
    }

    /**
     * Lấy toàn bộ danh sách MatchIntent và AudioChannel đang hoạt động (Public / Authenticated)
     */
    @GetMapping("/config")
    public ResponseEntity<ResponseData<FrequencyConfigResponseDTO>> getActiveConfig() {
        return ResponseEntity.ok(this.frequencyMatchService.getActiveFrequencyConfig());
    }

    /**
     * Lấy danh sách các trạm sóng FM trực tuyến (loại trừ chính user hiện tại)
     */
    @GetMapping("/stations")
    public ResponseEntity<ResponseData<List<BroadcastStationDTO>>> getStations(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.frequencyMatchService.getAllActiveStations(token));
    }

    /**
     * Mở sóng phát thanh FM cá nhân: nhận audio, intentCode và frequency (hoặc dùng personalFrequency)
     */
    @PostMapping(value = "/broadcast", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ResponseData<BroadcastStationDTO>> broadcastStation(
            JwtAuthenticationToken token,
            @RequestParam(value = "intentCode", required = false) String intentCode,
            @RequestParam(value = "audioSample", required = false) MultipartFile audioSample,
            @RequestParam(value = "audio", required = false) MultipartFile audio,
            @RequestParam(value = "frequency", required = false) Double frequency
    ) {
        MultipartFile effectiveAudio = audioSample != null ? audioSample : audio;
        return ResponseEntity.ok(this.frequencyMatchService.broadcast(token, intentCode, effectiveAudio, frequency));
    }

    /**
     * Quét trạm sóng xung quanh theo intentCode và loại trừ các user đã xem qua
     */
    @PostMapping("/scan")
    public ResponseEntity<ResponseData<List<BroadcastStationDTO>>> scanStations(
            JwtAuthenticationToken token,
            @RequestBody(required = false) ScanStationRequest request
    ) {
        return ResponseEntity.ok(this.frequencyMatchService.scan(token, request));
    }

    /**
     * Khóa sóng mục tiêu (Atomic Lock): tạo phòng đàm thoại 1-1 và gửi WebSocket chuyển phòng
     */
    @PostMapping("/lock")
    public ResponseEntity<ResponseData<Map<String, Object>>> lockStation(
            JwtAuthenticationToken token,
            @RequestBody @Valid LockTargetRequest request
    ) {
        return ResponseEntity.ok(this.frequencyMatchService.lockTarget(token, request));
    }

    /**
     * Tắt phát sóng FM của người dùng hiện tại
     */
    @DeleteMapping("/broadcast")
    public ResponseEntity<ResponseData<Boolean>> stopBroadcast(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.frequencyMatchService.stopBroadcast(token));
    }

    /**
     * Phát luồng audio sample giọng nói đã ghi âm
     */
    @GetMapping("/audio/{fileName:.+}")
    public ResponseEntity<Resource> getAudioSample(@PathVariable("fileName") String fileName) {
        Resource resource = this.mediaStorageService.loadAudioSampleAsResource(fileName);
        String contentType = "audio/webm";
        if (fileName.toLowerCase().endsWith(".opus")) {
            contentType = "audio/opus";
        } else if (fileName.toLowerCase().endsWith(".mp3")) {
            contentType = "audio/mpeg";
        } else if (fileName.toLowerCase().endsWith(".wav")) {
            contentType = "audio/wav";
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }
}
