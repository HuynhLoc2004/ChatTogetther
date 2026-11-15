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

    // 1. Gửi lời mời kết bạn (Hỗ trợ cả PathVariable: /friends/request/{id}, RequestParam: receiver_id, user_id)
    @PostMapping({"/request", "/request/{userId}", "/add/{userId}"})
    public ResponseEntity<ResponseData<Boolean>> sendRequest(
            JwtAuthenticationToken token,
            @PathVariable(value = "userId", required = false) Long pathUserId,
            @RequestParam(value = "receiver_id", required = false) Long receiverIdParam,
            @RequestParam(value = "user_id", required = false) Long userIdParam
    ) {
        Long effectiveId = pathUserId != null ? pathUserId : (receiverIdParam != null ? receiverIdParam : userIdParam);
        return ResponseEntity.ok(this.friendService.sendFriendRequest(token, effectiveId));
    }

    // 2. Chấp nhận lời mời kết bạn (Hỗ trợ cả PathVariable: /friends/accept/{id}, RequestParam: sender_id, user_id)
    @PostMapping({"/accept", "/accept/{senderId}"})
    public ResponseEntity<ResponseData<Boolean>> acceptRequest(
            JwtAuthenticationToken token,
            @PathVariable(value = "senderId", required = false) Long pathSenderId,
            @RequestParam(value = "sender_id", required = false) Long senderIdParam,
            @RequestParam(value = "user_id", required = false) Long userIdParam
    ) {
        Long effectiveId = pathSenderId != null ? pathSenderId : (senderIdParam != null ? senderIdParam : userIdParam);
        return ResponseEntity.ok(this.friendService.acceptFriendRequest(token, effectiveId));
    }

    // 3. Từ chối lời mời kết bạn (Hỗ trợ cả PathVariable: /friends/reject/{id}, /friends/decline/{id})
    @PostMapping({"/decline", "/decline/{senderId}", "/reject/{senderId}"})
    public ResponseEntity<ResponseData<Boolean>> declineFriendRequest(
            JwtAuthenticationToken token,
            @PathVariable(value = "senderId", required = false) Long pathSenderId,
            @RequestParam(value = "sender_id", required = false) Long senderIdParam,
            @RequestParam(value = "friend_id", required = false) Long friendIdParam,
            @RequestParam(value = "user_id", required = false) Long userIdParam
    ) {
        Long effectiveId = pathSenderId != null ? pathSenderId : (senderIdParam != null ? senderIdParam : (friendIdParam != null ? friendIdParam : userIdParam));
        return ResponseEntity.ok(this.friendService.removeFriend(token, effectiveId));
    }

    // 4. Hủy kết bạn / Hủy lời mời kết bạn đã gửi (Hỗ trợ cả /remove, /unfriend, /cancel)
    @PostMapping({"/remove", "/remove/{friendId}", "/unfriend/{friendId}", "/cancel/{friendId}"})
    public ResponseEntity<ResponseData<Boolean>> removeFriend(
            JwtAuthenticationToken token,
            @PathVariable(value = "friendId", required = false) Long pathFriendId,
            @RequestParam(value = "friend_id", required = false) Long friendIdParam,
            @RequestParam(value = "sender_id", required = false) Long senderIdParam,
            @RequestParam(value = "user_id", required = false) Long userIdParam
    ) {
        Long effectiveId = pathFriendId != null ? pathFriendId : (friendIdParam != null ? friendIdParam : (senderIdParam != null ? senderIdParam : userIdParam));
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
