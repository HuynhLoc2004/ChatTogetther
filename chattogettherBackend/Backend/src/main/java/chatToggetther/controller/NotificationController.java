package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.NotificationListResponseDTO;
import chatToggetther.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/notifications", "/notifications"})
public class NotificationController {
    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<ResponseData<NotificationListResponseDTO>> getNotifications(JwtAuthenticationToken token) {
        return ResponseEntity.ok(notificationService.getNotifications(token));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ResponseData<Long>> getUnreadCount(JwtAuthenticationToken token) {
        return ResponseEntity.ok(notificationService.getUnreadCount(token));
    }

    @PutMapping("/read-all")
    public ResponseEntity<ResponseData<Boolean>> markAllAsRead(JwtAuthenticationToken token) {
        return ResponseEntity.ok(notificationService.markAllAsRead(token));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<ResponseData<Boolean>> markAsRead(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        return ResponseEntity.ok(notificationService.markAsRead(token, id));
    }

    @DeleteMapping
    public ResponseEntity<ResponseData<Boolean>> deleteAll(JwtAuthenticationToken token) {
        return ResponseEntity.ok(notificationService.deleteAll(token));
    }
}
