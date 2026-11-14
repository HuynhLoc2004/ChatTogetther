package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.modelEntity.MatchIntentEntity;
import chatToggetther.modelEntity.MusicTrackEntity;
import chatToggetther.modelEntity.SystemConfigEntity;
import chatToggetther.repository.MatchIntentRepository;
import chatToggetther.repository.MusicTrackRepository;
import chatToggetther.repository.SystemConfigRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public")
public class LobbyConfigController {

    private final MatchIntentRepository matchIntentRepository;
    private final MusicTrackRepository musicTrackRepository;
    private final SystemConfigRepository systemConfigRepository;

    public LobbyConfigController(
            MatchIntentRepository matchIntentRepository,
            MusicTrackRepository musicTrackRepository,
            SystemConfigRepository systemConfigRepository
    ) {
        this.matchIntentRepository = matchIntentRepository;
        this.musicTrackRepository = musicTrackRepository;
        this.systemConfigRepository = systemConfigRepository;
    }

    @GetMapping("/lobby-config")
    public ResponseEntity<ResponseData<Map<String, Object>>> getLobbyConfig() {
        List<MatchIntentEntity> intents = this.matchIntentRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
        List<MusicTrackEntity> tracks = this.musicTrackRepository.findByIsActiveTrueOrderByIsFeaturedDescIdDesc();
        Map<String, String> configs = this.systemConfigRepository.findAll().stream()
                .collect(Collectors.toMap(SystemConfigEntity::getConfigKey, SystemConfigEntity::getConfigValue, (v1, v2) -> v1));

        Map<String, Object> data = new HashMap<>();
        data.put("intents", intents);
        data.put("tracks", tracks);
        data.put("musicTracks", tracks);
        data.put("systemConfigs", configs);

        return ResponseEntity.ok(new ResponseData<>(200, "Lấy cấu hình sảnh trực tuyến thành công!", data));
    }
}
