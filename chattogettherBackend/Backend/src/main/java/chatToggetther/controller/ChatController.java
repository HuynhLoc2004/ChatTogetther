package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.SendMessageDTO;
import chatToggetther.DataRequest.MessageRequest;
import chatToggetther.service.ChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/message")
public class ChatController {
    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('WRITE')")
    @PostMapping("/send")
    public ResponseEntity<ResponseData<Boolean>> sendMessage(JwtAuthenticationToken jwtAuthenticationToken , @RequestParam("user_room") Long user_room , @RequestBody MessageRequest messageRequest){
        return ResponseEntity.ok(this.chatService.sendMessage(jwtAuthenticationToken , messageRequest , user_room));
    }

    @GetMapping("/history")
    public ResponseEntity<ResponseData<List<SendMessageDTO>>> getHistory(
            JwtAuthenticationToken jwtAuthenticationToken,
            @RequestParam(value = "room_id", required = false) Long roomId,
            @RequestParam(value = "idRoom", required = false) Long idRoom,
            @RequestParam(value = "before_id", required = false) Long beforeId,
            @RequestParam(value = "size", required = false, defaultValue = "30") Integer size
    ) {
        Long targetRoomId = (roomId != null) ? roomId : idRoom;
        return ResponseEntity.ok(this.chatService.getMessageHistory(jwtAuthenticationToken, targetRoomId, beforeId, size));
    }
}
