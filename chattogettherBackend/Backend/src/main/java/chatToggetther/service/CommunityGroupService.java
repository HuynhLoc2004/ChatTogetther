package chatToggetther.service;

import chatToggetther.DTO.CommunityGroupDTO;
import chatToggetther.DTO.CommunityMemberDTO;
import chatToggetther.DataRequest.CreateGroupRequest;
import chatToggetther.DataRequest.UpdateGroupRequest;
import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.modelEntity.CommunityGroupEntity;
import chatToggetther.modelEntity.CommunityMemberEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.CommunityGroupRepository;
import chatToggetther.repository.CommunityMemberRepository;
import chatToggetther.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommunityGroupService {
    private final CommunityGroupRepository groupRepository;
    private final CommunityMemberRepository memberRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public ResponseData<List<CommunityGroupDTO>> getAllGroups(String keyword, JwtAuthenticationToken token) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        List<CommunityGroupEntity> groups;
        if (keyword != null && !keyword.trim().isEmpty()) {
            groups = this.groupRepository.searchGroups(keyword.trim());
        } else {
            groups = this.groupRepository.findAllOrderByCreatedAtDesc();
        }

        List<CommunityGroupDTO> dtos = groups.stream()
                .map(g -> mapToGroupDTO(g, currentUser, false))
                .collect(Collectors.toList());

        return new ResponseData<>(200, "Lấy danh sách cộng đồng thành công", dtos);
    }

    @Transactional(readOnly = true)
    public ResponseData<CommunityGroupDTO> getGroupById(Long groupId, JwtAuthenticationToken token) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        return new ResponseData<>(200, "Lấy chi tiết cộng đồng thành công", mapToGroupDTO(group, currentUser, true));
    }

    @Transactional
    public ResponseData<CommunityGroupDTO> createGroup(JwtAuthenticationToken token, CreateGroupRequest request) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(401, "Yêu cầu đăng nhập để tạo cộng đồng", 401);
        }

        CommunityGroupEntity group = new CommunityGroupEntity();
        group.setName(request.getName().trim());
        group.setDescription(request.getDescription());
        group.setRules(request.getRules() != null && !request.getRules().trim().isEmpty() 
            ? request.getRules() 
            : "1. Tôn trọng mọi thành viên.\n2. Không spam hoặc phát tán nội dung phản cảm.\n3. Tuân thủ định hướng chia sẻ lành mạnh của cộng đồng.");
        group.setCoverUrl(request.getCoverUrl());
        group.setAvatarUrl(request.getAvatarUrl());
        group.setIsPrivate(Boolean.TRUE.equals(request.getIsPrivate()));
        group.setRequiresApproval(Boolean.TRUE.equals(request.getRequiresApproval()));
        group.setOwner(currentUser);
        group.setCreatedAt(LocalDateTime.now());

        group = this.groupRepository.save(group);

        // Tạo thành viên là Chủ Nhóm (OWNER)
        CommunityMemberEntity ownerMember = new CommunityMemberEntity();
        ownerMember.setGroup(group);
        ownerMember.setUser(currentUser);
        ownerMember.setRole("OWNER");
        ownerMember.setStatus("ACTIVE");
        ownerMember.setJoinedAt(LocalDateTime.now());
        this.memberRepository.save(ownerMember);

        return new ResponseData<>(200, "Khởi tạo cộng đồng thành công", mapToGroupDTO(group, currentUser, true));
    }

    @Transactional
    public ResponseData<CommunityGroupDTO> updateGroup(JwtAuthenticationToken token, Long groupId, UpdateGroupRequest request) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        CommunityMemberEntity member = this.memberRepository.findByGroupAndUser(group, currentUser).orElseThrow(() ->
            new AppException(403, "Bạn không có quyền quản trị cộng đồng này!", 403)
        );

        if (!"OWNER".equals(member.getRole()) && !"DEPUTY".equals(member.getRole())) {
            throw new AppException(403, "Chỉ Chủ nhóm hoặc Phó nhóm mới có quyền cập nhật thông tin!", 403);
        }

        if (request.getName() != null && !request.getName().trim().isEmpty()) {
            group.setName(request.getName().trim());
        }
        if (request.getDescription() != null) {
            group.setDescription(request.getDescription());
        }
        if (request.getRules() != null) {
            group.setRules(request.getRules());
        }
        if (request.getCoverUrl() != null) {
            group.setCoverUrl(request.getCoverUrl());
        }
        if (request.getAvatarUrl() != null) {
            group.setAvatarUrl(request.getAvatarUrl());
        }
        if (request.getRequiresApproval() != null && "OWNER".equals(member.getRole())) {
            group.setRequiresApproval(request.getRequiresApproval());
        }

        this.groupRepository.save(group);
        return new ResponseData<>(200, "Cập nhật cộng đồng thành công", mapToGroupDTO(group, currentUser, true));
    }

    @Transactional
    public ResponseData<String> joinGroup(JwtAuthenticationToken token, Long groupId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(401, "Yêu cầu đăng nhập để gia nhập cộng đồng", 401);
        }

        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        Optional<CommunityMemberEntity> existing = this.memberRepository.findByGroupAndUser(group, currentUser);
        if (existing.isPresent()) {
            CommunityMemberEntity mem = existing.get();
            if ("ACTIVE".equals(mem.getStatus())) {
                return new ResponseData<>(200, "Bạn đã là thành viên của cộng đồng này", "ACTIVE");
            } else {
                return new ResponseData<>(200, "Yêu cầu tham gia của bạn đang chờ phê duyệt", "PENDING");
            }
        }

        CommunityMemberEntity newMember = new CommunityMemberEntity();
        newMember.setGroup(group);
        newMember.setUser(currentUser);
        newMember.setRole("MEMBER");
        newMember.setJoinedAt(LocalDateTime.now());

        if (Boolean.TRUE.equals(group.getRequiresApproval())) {
            newMember.setStatus("PENDING");
            this.memberRepository.save(newMember);
            return new ResponseData<>(200, "Đã gửi yêu cầu tham gia. Vui lòng chờ Chủ/Phó nhóm duyệt!", "PENDING");
        } else {
            newMember.setStatus("ACTIVE");
            this.memberRepository.save(newMember);
            return new ResponseData<>(200, "Gia nhập cộng đồng thành công!", "ACTIVE");
        }
    }

    @Transactional
    public ResponseData<Boolean> leaveGroup(JwtAuthenticationToken token, Long groupId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        CommunityMemberEntity member = this.memberRepository.findByGroupAndUser(group, currentUser).orElseThrow(() ->
            new AppException(400, "Bạn chưa tham gia cộng đồng này", 400)
        );

        if ("OWNER".equals(member.getRole())) {
            throw new AppException(400, "Chủ nhóm không thể rời nhóm! Bạn cần chuyển quyền hoặc giải tán nhóm.", 400);
        }

        this.memberRepository.delete(member);
        return new ResponseData<>(200, "Đã rời khỏi cộng đồng", true);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<CommunityMemberDTO>> getPendingMembers(JwtAuthenticationToken token, Long groupId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        CommunityMemberEntity currentMember = this.memberRepository.findByGroupAndUser(group, currentUser).orElseThrow(() ->
            new AppException(403, "Bạn không có quyền quản lý thành viên!", 403)
        );

        if (!"OWNER".equals(currentMember.getRole()) && !"DEPUTY".equals(currentMember.getRole())) {
            throw new AppException(403, "Chỉ Chủ nhóm hoặc Phó nhóm mới có quyền xem danh sách chờ duyệt!", 403);
        }

        List<CommunityMemberEntity> pendingList = this.memberRepository.findByGroupAndStatus(group, "PENDING");
        List<CommunityMemberDTO> dtos = pendingList.stream().map(this::mapToMemberDTO).collect(Collectors.toList());
        return new ResponseData<>(200, "Danh sách chờ duyệt", dtos);
    }

    @Transactional
    public ResponseData<Boolean> approveMember(JwtAuthenticationToken token, Long groupId, Long targetUserId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        CommunityMemberEntity currentMember = this.memberRepository.findByGroupAndUser(group, currentUser).orElseThrow(() ->
            new AppException(403, "Bạn không có quyền quản lý thành viên!", 403)
        );

        if (!"OWNER".equals(currentMember.getRole()) && !"DEPUTY".equals(currentMember.getRole())) {
            throw new AppException(403, "Chỉ Chủ nhóm hoặc Phó nhóm mới có quyền phê duyệt!", 403);
        }

        UserEntity targetUser = this.userRepository.findById(targetUserId).orElseThrow(() ->
            new AppException(404, "Người dùng không tồn tại", 404)
        );

        CommunityMemberEntity targetMember = this.memberRepository.findByGroupAndUser(group, targetUser).orElseThrow(() ->
            new AppException(404, "Yêu cầu tham gia không tồn tại", 404)
        );

        targetMember.setStatus("ACTIVE");
        this.memberRepository.save(targetMember);
        return new ResponseData<>(200, "Đã phê duyệt thành viên vào nhóm", true);
    }

    @Transactional
    public ResponseData<Boolean> rejectMember(JwtAuthenticationToken token, Long groupId, Long targetUserId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        CommunityMemberEntity currentMember = this.memberRepository.findByGroupAndUser(group, currentUser).orElseThrow(() ->
            new AppException(403, "Bạn không có quyền quản lý thành viên!", 403)
        );

        if (!"OWNER".equals(currentMember.getRole()) && !"DEPUTY".equals(currentMember.getRole())) {
            throw new AppException(403, "Chỉ Chủ nhóm hoặc Phó nhóm mới có quyền từ chối!", 403);
        }

        UserEntity targetUser = this.userRepository.findById(targetUserId).orElseThrow(() ->
            new AppException(404, "Người dùng không tồn tại", 404)
        );

        CommunityMemberEntity targetMember = this.memberRepository.findByGroupAndUser(group, targetUser).orElseThrow(() ->
            new AppException(404, "Yêu cầu tham gia không tồn tại", 404)
        );

        this.memberRepository.delete(targetMember);
        return new ResponseData<>(200, "Đã từ chối yêu cầu tham gia", true);
    }

    @Transactional
    public ResponseData<Boolean> setMemberRole(JwtAuthenticationToken token, Long groupId, Long targetUserId, String newRole) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        CommunityMemberEntity currentMember = this.memberRepository.findByGroupAndUser(group, currentUser).orElseThrow(() ->
            new AppException(403, "Bạn không có quyền trong cộng đồng này!", 403)
        );

        if (!"OWNER".equals(currentMember.getRole())) {
            throw new AppException(403, "Chỉ Chủ nhóm mới có quyền bổ nhiệm hoặc bãi nhiệm Phó nhóm!", 403);
        }

        UserEntity targetUser = this.userRepository.findById(targetUserId).orElseThrow(() ->
            new AppException(404, "Người dùng không tồn tại", 404)
        );

        if (targetUser.getId().equals(currentUser.getId())) {
            throw new AppException(400, "Không thể thay đổi quyền của chính mình", 400);
        }

        CommunityMemberEntity targetMember = this.memberRepository.findByGroupAndUser(group, targetUser).orElseThrow(() ->
            new AppException(404, "Thành viên không tồn tại trong cộng đồng", 404)
        );

        if (!"DEPUTY".equals(newRole) && !"MEMBER".equals(newRole)) {
            throw new AppException(400, "Vai trò không hợp lệ (chỉ hỗ trợ DEPUTY hoặc MEMBER)", 400);
        }

        targetMember.setRole(newRole);
        this.memberRepository.save(targetMember);
        return new ResponseData<>(200, "Đã cập nhật quyền thành viên thành công", true);
    }

    @Transactional
    public ResponseData<Boolean> deleteGroup(JwtAuthenticationToken token, Long groupId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        if (!group.getOwner().getId().equals(currentUser.getId())) {
            throw new AppException(403, "Chỉ Chủ nhóm mới có quyền giải tán cộng đồng!", 403);
        }

        this.groupRepository.delete(group);
        return new ResponseData<>(200, "Đã giải tán cộng đồng thành công", true);
    }

    private CommunityGroupDTO mapToGroupDTO(CommunityGroupEntity g, UserEntity currentUser, boolean includeMembers) {
        CommunityGroupDTO dto = new CommunityGroupDTO();
        dto.setId(g.getId());
        dto.setName(g.getName());
        dto.setDescription(g.getDescription());
        dto.setRules(g.getRules());
        dto.setCoverUrl(g.getCoverUrl());
        dto.setAvatarUrl(g.getAvatarUrl());
        dto.setIsPrivate(g.getIsPrivate());
        dto.setRequiresApproval(g.getRequiresApproval());
        if (g.getOwner() != null) {
            dto.setOwnerId(g.getOwner().getId());
            dto.setOwnerName(g.getOwner().getNickname() != null && !g.getOwner().getNickname().isEmpty() 
                ? g.getOwner().getNickname() 
                : g.getOwner().getAccount());
            dto.setOwnerAvatar(g.getOwner().getAvatar());
        } else {
            dto.setOwnerName("Hệ thống");
        }
        dto.setCreatedAt(g.getCreatedAt());

        long activeCount = (g.getMembers() != null) 
            ? g.getMembers().stream().filter(m -> m != null && "ACTIVE".equals(m.getStatus())).count() 
            : 0;
        dto.setMembersCount(activeCount > 0 ? activeCount : 1L);

        if (currentUser != null && g.getMembers() != null) {
            Optional<CommunityMemberEntity> userMem = g.getMembers().stream()
                    .filter(m -> m != null && m.getUser() != null && m.getUser().getId().equals(currentUser.getId()))
                    .findFirst();
            if (userMem.isPresent()) {
                CommunityMemberEntity mem = userMem.get();
                if ("ACTIVE".equals(mem.getStatus())) {
                    dto.setCurrentUserRole(mem.getRole());
                } else {
                    dto.setCurrentUserRole("PENDING");
                }
            } else {
                dto.setCurrentUserRole(null);
            }
        } else {
            dto.setCurrentUserRole(null);
        }

        if (includeMembers && g.getMembers() != null) {
            List<CommunityMemberDTO> memberDTOs = g.getMembers().stream()
                    .filter(m -> m != null && "ACTIVE".equals(m.getStatus()))
                    .map(this::mapToMemberDTO)
                    .collect(Collectors.toList());
            dto.setMembers(memberDTOs);
        }

        return dto;
    }

    private CommunityMemberDTO mapToMemberDTO(CommunityMemberEntity m) {
        CommunityMemberDTO dto = new CommunityMemberDTO();
        dto.setId(m.getId());
        dto.setUserId(m.getUser().getId());
        dto.setAccount(m.getUser().getAccount());
        dto.setNickname(m.getUser().getNickname() != null && !m.getUser().getNickname().isEmpty() 
            ? m.getUser().getNickname() 
            : m.getUser().getAccount());
        dto.setAvatar(m.getUser().getAvatar());
        dto.setRole(m.getRole());
        dto.setStatus(m.getStatus());
        dto.setJoinedAt(m.getJoinedAt());
        return dto;
    }
}
