package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.UserDTO;
import chatToggetther.service.FriendService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/friends")
public class FriendController {
    private final FriendService friendService;

    public FriendController(FriendService friendService) {
        this.friendService = friendService;
    }

    @PostMapping("/request")
    public ResponseEntity<ResponseData<Boolean>> sendRequest(
            JwtAuthenticationToken token,
            @RequestParam("receiver_id") Long receiverId
    ) {
        return ResponseEntity.ok(this.friendService.sendFriendRequest(token, receiverId));
    }

    @PostMapping("/accept")
    public ResponseEntity<ResponseData<Boolean>> acceptRequest(
            JwtAuthenticationToken token,
            @RequestParam("sender_id") Long senderId
    ) {
        return ResponseEntity.ok(this.friendService.acceptFriendRequest(token, senderId));
    }

    @PostMapping("/remove")
    public ResponseEntity<ResponseData<Boolean>> removeFriend(
            JwtAuthenticationToken token,
            @RequestParam("friend_id") Long friendId
    ) {
        return ResponseEntity.ok(this.friendService.removeFriend(token, friendId));
    }

    @GetMapping("/list")
    public ResponseEntity<ResponseData<List<UserDTO>>> getFriendsList(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.friendService.getFriendsList(token));
    }

    @GetMapping("/pending")
    public ResponseEntity<ResponseData<List<UserDTO>>> getPendingRequests(JwtAuthenticationToken token) {
        return ResponseEntity.ok(this.friendService.getPendingRequests(token));
    }
}

