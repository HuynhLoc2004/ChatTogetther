package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/system")
@RequiredArgsConstructor
public class SystemController {

    private final AdminService adminService;

    @GetMapping("/config")
    public ResponseEntity<ResponseData<Map<String, String>>> getPublicConfig() {
        return ResponseEntity.ok(this.adminService.getSystemConfig());
    }
}
