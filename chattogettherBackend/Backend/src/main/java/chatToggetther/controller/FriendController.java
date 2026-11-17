package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.UserDTO;
import chatToggetther.service.FriendService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/friends", "/friends"})
public class FriendController {
    private final FriendService friendService;

    public FriendController(FriendService friendService) {
        this.friendService = friendService;
    }

    private Long extractId(Long pathId, Long p1, Long p2, Long p3, java.util.Map<String, Object> body) {
        if (pathId != null) return pathId;
        if (p1 != null) return p1;
        if (p2 != null) return p2;
        if (p3 != null) return p3;
        if (body != null) {
            for (String key : new String[]{"receiver_id", "receiverId", "user_id", "userId", "sender_id", "senderId", "friend_id", "friendId", "targetUserId"}) {
                Object val = body.get(key);
                if (val instanceof Number) return ((Number) val).longValue();
                if (val != null) {
                    try {
                        return Long.parseLong(val.toString().trim());
                    } catch (Exception ignored) {}
                }
            }
        }
        return null;
    }

    // 1. Gửi lời mời kết bạn (Hỗ trợ cả PathVariable, RequestParam và RequestBody)
    @PostMapping({"/request", "/request/{userId}", "/add/{userId}"})
    public ResponseEntity<ResponseData<Boolean>> sendRequest(
            JwtAuthenticationToken token,
            @PathVariable(value = "userId", required = false) Long pathUserId,
            @RequestParam(value = "receiver_id", required = false) Long receiverIdParam,
            @RequestParam(value = "user_id", required = false) Long userIdParam,
            @RequestBody(required = false) java.util.Map<String, Object> body
    ) {
        Long effectiveId = extractId(pathUserId, receiverIdParam, userIdParam, null, body);
        return ResponseEntity.ok(this.friendService.sendFriendRequest(token, effectiveId));
    }

    // 2. Chấp nhận lời mời kết bạn (Hỗ trợ cả PathVariable, RequestParam và RequestBody)
    @PostMapping({"/accept", "/accept/{senderId}"})
    public ResponseEntity<ResponseData<Boolean>> acceptRequest(
            JwtAuthenticationToken token,
            @PathVariable(value = "senderId", required = false) Long pathSenderId,
            @RequestParam(value = "sender_id", required = false) Long senderIdParam,
            @RequestParam(value = "user_id", required = false) Long userIdParam,
            @RequestBody(required = false) java.util.Map<String, Object> body
    ) {
        Long effectiveId = extractId(pathSenderId, senderIdParam, userIdParam, null, body);
        return ResponseEntity.ok(this.friendService.acceptFriendRequest(token, effectiveId));
    }

    // 3. Từ chối lời mời kết bạn (Hỗ trợ cả PathVariable, RequestParam và RequestBody)
    @PostMapping({"/decline", "/decline/{senderId}", "/reject/{senderId}"})
    public ResponseEntity<ResponseData<Boolean>> declineFriendRequest(
            JwtAuthenticationToken token,
            @PathVariable(value = "senderId", required = false) Long pathSenderId,
            @RequestParam(value = "sender_id", required = false) Long senderIdParam,
            @RequestParam(value = "friend_id", required = false) Long friendIdParam,
            @RequestParam(value = "user_id", required = false) Long userIdParam,
            @RequestBody(required = false) java.util.Map<String, Object> body
    ) {
        Long effectiveId = extractId(pathSenderId, senderIdParam, friendIdParam, userIdParam, body);
        return ResponseEntity.ok(this.friendService.removeFriend(token, effectiveId));
    }

    // 4. Hủy kết bạn / Hủy lời mời kết bạn đã gửi (Hỗ trợ cả PathVariable, RequestParam và RequestBody)
    @PostMapping({"/remove", "/remove/{friendId}", "/unfriend/{friendId}", "/cancel/{friendId}"})
    public ResponseEntity<ResponseData<Boolean>> removeFriend(
            JwtAuthenticationToken token,
            @PathVariable(value = "friendId", required = false) Long pathFriendId,
            @RequestParam(value = "friend_id", required = false) Long friendIdParam,
            @RequestParam(value = "sender_id", required = false) Long senderIdParam,
            @RequestParam(value = "user_id", required = false) Long userIdParam,
            @RequestBody(required = false) java.util.Map<String, Object> body
    ) {
        Long effectiveId = extractId(pathFriendId, friendIdParam, senderIdParam, userIdParam, body);
        return ResponseEntity.ok(this.friendService.removeFriend(token, effectiveId));
    }

    // 5. Kiểm tra trạng thái quan hệ bạn bè giữa tôi và một người dùng
    @GetMapping({"/status/{userId}", "/status"})
    public ResponseEntity<ResponseData<String>> getFriendStatus(
            JwtAuthenticationToken token,
            @PathVariable(value = "userId", required = false) Long pathUserId,
            @RequestParam(value = "user_id", required = false) Long queryUserId
    ) {
        Long effectiveId = pathUserId != null ? pathUserId : queryUserId;
        return ResponseEntity.ok(this.friendService.getFriendshipStatus(token, effectiveId));
    }

    // 6. Danh sách bạn bè đã đồng ý kết nối
    @GetMapping({"/list", ""})
    public ResponseEntity<ResponseData<List<UserDTO>>> getFriendsList(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.friendService.getFriendsList(token));
    }

    // 7. Danh sách lời mời kết bạn đang chờ phê duyệt
    @GetMapping("/pending")
    public ResponseEntity<ResponseData<List<UserDTO>>> getPendingRequests(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.friendService.getPendingRequests(token));
    }
}
