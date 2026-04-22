package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.RoomDTO;
import chatToggetther.DataRequest.RoomRequest;
import chatToggetther.DataRequest.UserRequest;
import chatToggetther.service.RoomService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RequestMapping("/api/rooms")
@RestController
public class RoomController {
    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @PostMapping("/create")
    public ResponseEntity<ResponseData<Long>> create_room(JwtAuthenticationToken jwtAuthenticationToken , @RequestBody @Valid RoomRequest roomRequest){
        return ResponseEntity.ok(this.roomService.createRoom(jwtAuthenticationToken ,roomRequest));
    }
    @GetMapping("/info-rooms")
    public ResponseEntity<ResponseData<List<RoomDTO>>> getRooms(){
        return ResponseEntity.ok(this.roomService.getAllRoomActive());
    }

}
