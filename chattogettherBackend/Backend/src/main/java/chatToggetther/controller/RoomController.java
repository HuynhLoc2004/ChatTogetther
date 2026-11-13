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
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {
    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @PostMapping("/create")
    public ResponseEntity<ResponseData<CreateRoomResponseDTO>> createRoom(JwtAuthenticationToken jwtAuthenticationToken , @RequestBody @Valid RoomRequest roomRequest, HttpServletResponse httpServletResponse){
        return ResponseEntity.ok(this.roomService.createRoom(jwtAuthenticationToken , roomRequest, httpServletResponse));
    }

    @GetMapping("/info-rooms")
    public ResponseEntity<ResponseData<List<RoomDTO>>> getallRoomActive(){
        return ResponseEntity.ok(this.roomService.getAllRoomActive());
    }

    @GetMapping("/detail")
    public ResponseEntity<ResponseData<RoomDTO>> getRoomDetail(
            @RequestParam(value = "room_id", required = false) Long roomId,
            @RequestParam(value = "idRoom", required = false) Long idRoomAlt
    ) {
        Long effectiveId = roomId != null ? roomId : idRoomAlt;
        return ResponseEntity.ok(this.roomService.getRoomDetail(effectiveId));
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
