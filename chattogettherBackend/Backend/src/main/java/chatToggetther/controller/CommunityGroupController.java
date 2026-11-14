package chatToggetther.controller;

import chatToggetther.DTO.CommunityGroupDTO;
import chatToggetther.DTO.CommunityMemberDTO;
import chatToggetther.DataRequest.CreateGroupRequest;
import chatToggetther.DataRequest.UpdateGroupRequest;
import chatToggetther.Customize.ResponseData;
import chatToggetther.service.CommunityGroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class CommunityGroupController {
    private final CommunityGroupService groupService;

    @GetMapping
    public ResponseEntity<ResponseData<List<CommunityGroupDTO>>> getAllGroups(
            JwtAuthenticationToken token,
            @RequestParam(value = "keyword", required = false) String keyword
    ) {
        return ResponseEntity.ok(this.groupService.getAllGroups(keyword, token));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseData<CommunityGroupDTO>> getGroupById(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        return ResponseEntity.ok(this.groupService.getGroupById(id, token));
    }

    @PostMapping
    public ResponseEntity<ResponseData<CommunityGroupDTO>> createGroup(
            JwtAuthenticationToken token,
            @RequestBody @Valid CreateGroupRequest request
    ) {
        return ResponseEntity.ok(this.groupService.createGroup(token, request));
    }

    @RequestMapping(value = {"/{id}", "/{id}/update"}, method = {RequestMethod.PUT, RequestMethod.POST})
    public ResponseEntity<ResponseData<CommunityGroupDTO>> updateGroup(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @RequestBody @Valid UpdateGroupRequest request
    ) {
        return ResponseEntity.ok(this.groupService.updateGroup(token, id, request));
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<ResponseData<String>> joinGroup(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        return ResponseEntity.ok(this.groupService.joinGroup(token, id));
    }

    @PostMapping("/{id}/leave")
    public ResponseEntity<ResponseData<Boolean>> leaveGroup(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        return ResponseEntity.ok(this.groupService.leaveGroup(token, id));
    }

    @GetMapping("/{id}/pending")
    public ResponseEntity<ResponseData<List<CommunityMemberDTO>>> getPendingMembers(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        return ResponseEntity.ok(this.groupService.getPendingMembers(token, id));
    }

    @PostMapping("/{id}/approve/{userId}")
    public ResponseEntity<ResponseData<Boolean>> approveMember(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @PathVariable("userId") Long userId
    ) {
        return ResponseEntity.ok(this.groupService.approveMember(token, id, userId));
    }

    @PostMapping("/{id}/reject/{userId}")
    public ResponseEntity<ResponseData<Boolean>> rejectMember(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @PathVariable("userId") Long userId
    ) {
        return ResponseEntity.ok(this.groupService.rejectMember(token, id, userId));
    }

    @PostMapping("/{id}/set-role")
    public ResponseEntity<ResponseData<Boolean>> setRole(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> body
    ) {
        Long targetUserId = Long.valueOf(body.get("userId").toString());
        String newRole = body.get("role").toString();
        return ResponseEntity.ok(this.groupService.setMemberRole(token, id, targetUserId, newRole));
    }

    @PostMapping("/{id}/invite/{friendUserId}")
    public ResponseEntity<ResponseData<String>> inviteFriend(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id,
            @PathVariable("friendUserId") Long friendUserId
    ) {
        return ResponseEntity.ok(this.groupService.inviteFriend(token, id, friendUserId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Boolean>> deleteGroup(
            JwtAuthenticationToken token,
            @PathVariable("id") Long id
    ) {
        return ResponseEntity.ok(this.groupService.deleteGroup(token, id));
    }
}
