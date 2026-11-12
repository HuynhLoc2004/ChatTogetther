package chatToggetther.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class PingController {

    /**
     * Endpoint thức giấc (Wake-up ping) cho Render Free Tier.
     * Khi người dùng mở web trên Vercel, client sẽ gửi request ping ngay lập tức
     * để Render khởi động máy chủ từ trạng thái ngủ (Sleep/Spin down).
     */
    @GetMapping("/ping")
    public ResponseEntity<Map<String, Object>> ping() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "message", "Chat Togetther Backend is awake and ready!",
            "timestamp", System.currentTimeMillis()
        ));
    }
}

