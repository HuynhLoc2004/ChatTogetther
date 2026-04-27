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

    @PostMapping("/join-room")
    public ResponseEntity<ResponseData<Long>> joinRoom(JwtAuthenticationToken jwtAuthenticationToken, @RequestParam("room_id") Long idRoom, @RequestBody JoinRoomRequest joinRoomRequest){
         return ResponseEntity.ok(this.roomService.joinRoom(jwtAuthenticationToken , idRoom , joinRoomRequest));
    }

    @PostMapping("/leave-room")
    public ResponseEntity<ResponseData<Boolean>> leaveRoom(JwtAuthenticationToken jwtAuthenticationToken, @RequestParam("room_id") Long room_id){
         return ResponseEntity.ok(this.roomService.leaveRoom(jwtAuthenticationToken , room_id));
    }

    @PreAuthorize("hasAuthority('ADMIN_ROOM')")
    @PostMapping("/remove-user")
    public ResponseEntity<ResponseData<Boolean>> removeUser(JwtAuthenticationToken jwtAuthenticationToken, @RequestParam("user_id") Long userId, @RequestParam("room_id") Long roomId) {
        return ResponseEntity.ok(this.roomService.removeUserFromRoom(jwtAuthenticationToken, userId, roomId));
    }

    @PreAuthorize("hasAuthority('ADMIN_ROOM')")
    @PostMapping("/disband-room")
    public ResponseEntity<ResponseData<Boolean>> disbandRoom(JwtAuthenticationToken jwtAuthenticationToken, @RequestParam("room_id") Long roomId) {
        return ResponseEntity.ok(this.roomService.disbandRoom(jwtAuthenticationToken, roomId));
    }

    @PreAuthorize("hasAuthority('ADMIN_ROOM')")
    @PostMapping("/delegate-admin")
    public ResponseEntity<ResponseData<Boolean>> delegateAdmin(JwtAuthenticationToken jwtAuthenticationToken, @RequestParam("room_id") Long roomId, @RequestParam("new_admin_id") Long newAdminUserId) {
        return ResponseEntity.ok(this.roomService.delegateAdmin(jwtAuthenticationToken, roomId, newAdminUserId));
    }
}
