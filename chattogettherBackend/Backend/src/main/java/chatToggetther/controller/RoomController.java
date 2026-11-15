package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.RoomDTO;
import chatToggetther.DTO.CreateRoomResponseDTO;
import chatToggetther.DataRequest.JoinRoomRequest;
import chatToggetther.DataRequest.RoomRequest;
import chatToggetther.service.RoomService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/rooms", "/rooms"})
public class RoomController {
    private final RoomService roomService;
    private final chatToggetther.service.ChatService chatService;

    public RoomController(RoomService roomService, chatToggetther.service.ChatService chatService) {
        this.roomService = roomService;
        this.chatService = chatService;
    }

    @GetMapping({"/{roomId}/messages", "/{roomId}/history"})
    public ResponseEntity<ResponseData<List<chatToggetther.DTO.SendMessageDTO>>> getRoomMessages(
            Authentication authentication,
            @PathVariable("roomId") Long roomId,
            @RequestParam(value = "before_id", required = false) Long beforeId,
            @RequestParam(value = "size", required = false, defaultValue = "50") Integer size
    ) {
        JwtAuthenticationToken jwtAuth = (authentication instanceof JwtAuthenticationToken) ? (JwtAuthenticationToken) authentication : null;
        return ResponseEntity.ok(this.chatService.getMessageHistory(jwtAuth, roomId, beforeId, size));
    }

    @RequestMapping(value = {"/direct/{targetUserId}", "/direct-room/{targetUserId}"}, method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<ResponseData<java.util.Map<String, Object>>> getOrCreateDirectRoom(
            Authentication authentication,
            @PathVariable("targetUserId") String targetUserId
    ) {
        JwtAuthenticationToken jwtAuth = (authentication instanceof JwtAuthenticationToken) ? (JwtAuthenticationToken) authentication : null;
        return ResponseEntity.ok(this.chatService.getOrCreateDirectRoom(jwtAuth, targetUserId));
    }

    @RequestMapping(value = {"/{roomId}/mute", "/{roomId}/notification"}, method = {RequestMethod.PATCH, RequestMethod.PUT, RequestMethod.POST})
    public ResponseEntity<ResponseData<java.util.Map<String, Object>>> toggleMuteRoom(
            Authentication authentication,
            @PathVariable("roomId") Long roomId
    ) {
        JwtAuthenticationToken jwtAuth = (authentication instanceof JwtAuthenticationToken) ? (JwtAuthenticationToken) authentication : null;
        return ResponseEntity.ok(this.roomService.toggleMuteRoom(jwtAuth, roomId));
    }

    @GetMapping({"/{roomId}/mute", "/{roomId}/notification-status"})
    public ResponseEntity<ResponseData<java.util.Map<String, Object>>> getMuteStatus(
            Authentication authentication,
            @PathVariable("roomId") Long roomId
    ) {
        JwtAuthenticationToken jwtAuth = (authentication instanceof JwtAuthenticationToken) ? (JwtAuthenticationToken) authentication : null;
        return ResponseEntity.ok(this.roomService.getMuteStatus(jwtAuth, roomId));
    }

    @PostMapping({"/create", "/create-room"})
    public ResponseEntity<ResponseData<CreateRoomResponseDTO>> createRoom(JwtAuthenticationToken jwtAuthenticationToken , @RequestBody @Valid RoomRequest roomRequest, HttpServletResponse httpServletResponse){
        return ResponseEntity.ok(this.roomService.createRoom(jwtAuthenticationToken , roomRequest, httpServletResponse));
    }

    @GetMapping("/info-rooms")
    public ResponseEntity<ResponseData<List<RoomDTO>>> getallRoomActive(Authentication authentication){
        JwtAuthenticationToken jwtAuth = (authentication instanceof JwtAuthenticationToken) ? (JwtAuthenticationToken) authentication : null;
        return ResponseEntity.ok(this.roomService.getAllRoomActive(jwtAuth));
    }

    @GetMapping({"/my-active-room", "/active"})
    public ResponseEntity<ResponseData<RoomDTO>> getMyActiveRoom(Authentication authentication) {
        JwtAuthenticationToken jwtAuth = (authentication instanceof JwtAuthenticationToken) ? (JwtAuthenticationToken) authentication : null;
        return ResponseEntity.ok(this.roomService.getMyActiveRoom(jwtAuth));
    }

    @GetMapping("/detail")
    public ResponseEntity<ResponseData<RoomDTO>> getRoomDetail(
            @RequestParam(value = "room_id", required = false) Long roomId,
            @RequestParam(value = "idRoom", required = false) Long idRoomAlt
    ) {
        Long effectiveId = roomId != null ? roomId : idRoomAlt;
        return ResponseEntity.ok(this.roomService.getRoomDetail(effectiveId));
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<ResponseData<RoomDTO>> getRoomById(
            @PathVariable("roomId") Long roomId
    ) {
        return ResponseEntity.ok(this.roomService.getRoomDetail(roomId));
    }

    @PostMapping("/join-room")
    public ResponseEntity<ResponseData<Long>> joinRoom(
            JwtAuthenticationToken jwtAuthenticationToken, 
            @RequestParam(value = "room_id", required = false) Long idRoom,
            @RequestParam(value = "idRoom", required = false) Long idRoomAlt,
            @RequestBody JoinRoomRequest joinRoomRequest
    ){
        Long effectiveId = idRoom != null ? idRoom : (idRoomAlt != null ? idRoomAlt : (joinRoomRequest != null ? joinRoomRequest.getRoomId() : null));
        return ResponseEntity.ok(this.roomService.joinRoom(jwtAuthenticationToken, effectiveId, joinRoomRequest));
    }

    @PostMapping("/leave-room")
    public ResponseEntity<ResponseData<Boolean>> leaveRoom(
            JwtAuthenticationToken jwtAuthenticationToken, 
            @RequestParam(value = "room_id", required = false) Long room_id,
            @RequestParam(value = "idRoom", required = false) Long idRoomAlt
    ){
        Long effectiveId = room_id != null ? room_id : idRoomAlt;
        return ResponseEntity.ok(this.roomService.leaveRoom(jwtAuthenticationToken, effectiveId));
    }

    @PostMapping("/remove-user")
    public ResponseEntity<ResponseData<Boolean>> removeUser(
            JwtAuthenticationToken jwtAuthenticationToken, 
            @RequestParam("user_id") Long userId, 
            @RequestParam(value = "room_id", required = false) Long roomId,
            @RequestParam(value = "idRoom", required = false) Long idRoomAlt
    ) {
        Long effectiveId = roomId != null ? roomId : idRoomAlt;
        return ResponseEntity.ok(this.roomService.removeUserFromRoom(jwtAuthenticationToken, userId, effectiveId));
    }

    @PostMapping("/disband-room")
    public ResponseEntity<ResponseData<Boolean>> disbandRoom(
            JwtAuthenticationToken jwtAuthenticationToken, 
            @RequestParam(value = "room_id", required = false) Long roomId,
            @RequestParam(value = "idRoom", required = false) Long idRoomAlt
    ) {
        Long effectiveId = roomId != null ? roomId : idRoomAlt;
        return ResponseEntity.ok(this.roomService.disbandRoom(jwtAuthenticationToken, effectiveId));
    }

    @PostMapping("/delegate-admin")
    public ResponseEntity<ResponseData<Boolean>> delegateAdmin(
            JwtAuthenticationToken jwtAuthenticationToken, 
            @RequestParam(value = "room_id", required = false) Long roomId,
            @RequestParam(value = "idRoom", required = false) Long idRoomAlt,
            @RequestParam("new_admin_id") Long newAdminUserId
    ) {
        Long effectiveId = roomId != null ? roomId : idRoomAlt;
        return ResponseEntity.ok(this.roomService.delegateAdmin(jwtAuthenticationToken, effectiveId, newAdminUserId));
    }

    @RequestMapping(value = {"/{id}/avatar", "/{id}/update-avatar"}, method = {RequestMethod.PUT, RequestMethod.POST})
    public ResponseEntity<ResponseData<RoomDTO>> updateRoomAvatar(
            JwtAuthenticationToken token,
            @PathVariable("id") Long roomId,
            @RequestBody java.util.Map<String, String> body
    ) {
        String avatar = body != null ? body.get("avatar") : null;
        return ResponseEntity.ok(this.roomService.updateRoomAvatar(token, roomId, avatar));
    }
}
