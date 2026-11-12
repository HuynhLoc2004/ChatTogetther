package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.UserDTO;
import chatToggetther.DataRequest.UpdateProfileRequest;
import chatToggetther.DataRequest.UserRequest;
import chatToggetther.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/active-room")
    public ResponseEntity<ResponseData<Long>> getActiveRoom(JwtAuthenticationToken jwtAuthenticationToken) {
        return ResponseEntity.ok(this.userService.getActiveRoom(jwtAuthenticationToken));
    }

    @GetMapping("/profile")
    public ResponseEntity<ResponseData<UserDTO>> getProfile(
            JwtAuthenticationToken jwtAuthenticationToken,
            @RequestParam(value = "user_id", required = false) Long targetUserId
    ) {
        return ResponseEntity.ok(this.userService.getUserProfile(jwtAuthenticationToken, targetUserId));
    }

    @PutMapping("/profile")
    public ResponseEntity<ResponseData<UserDTO>> updateProfile(
            JwtAuthenticationToken jwtAuthenticationToken,
            @RequestBody UpdateProfileRequest request
    ) {
        return ResponseEntity.ok(this.userService.updateUserProfile(jwtAuthenticationToken, request));
    }

    @PostMapping("/create")
    public ResponseEntity<ResponseData<Boolean>> createUser(@RequestBody @Valid UserRequest userRequest){
        return ResponseEntity.ok(this.userService.create_user(userRequest));
    }
}
