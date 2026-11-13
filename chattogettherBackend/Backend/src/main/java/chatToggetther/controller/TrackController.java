package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.modelEntity.TrackEntity;
import chatToggetther.repository.TrackRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tracks")
public class TrackController {
    private final TrackRepository trackRepository;

    public TrackController(TrackRepository trackRepository) {
        this.trackRepository = trackRepository;
    }

    @GetMapping
    public ResponseEntity<ResponseData<List<TrackEntity>>> getActiveTracks() {
        List<TrackEntity> tracks = trackRepository.findByActiveTrueOrderByCreatedAtDesc();
        return ResponseEntity.ok(new ResponseData<>(200, "Lấy danh sách bản nhạc thành công", tracks));
    }
}

