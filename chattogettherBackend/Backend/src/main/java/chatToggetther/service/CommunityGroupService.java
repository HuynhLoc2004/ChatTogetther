package chatToggetther.service;

import chatToggetther.DTO.CommunityGroupDTO;
import chatToggetther.DTO.CommunityMemberDTO;
import chatToggetther.DTO.CommunityReportDTO;
import chatToggetther.DataRequest.CreateCommunityReportRequest;
import chatToggetther.DataRequest.CreateGroupRequest;
import chatToggetther.DataRequest.ResolveReportRequest;
import chatToggetther.DataRequest.UpdateGroupRequest;
import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.modelEntity.CommunityGroupEntity;
import chatToggetther.modelEntity.CommunityCategoryEntity;
import chatToggetther.modelEntity.CommunityMemberEntity;
import chatToggetther.modelEntity.CommunityReportEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.CommunityGroupRepository;
import chatToggetther.repository.CommunityMemberRepository;
import chatToggetther.repository.CommunityReportRepository;
import chatToggetther.repository.CommunityCategoryRepository;
import chatToggetther.repository.PostRepository;
import chatToggetther.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import jakarta.annotation.PostConstruct;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommunityGroupService {
    private final CommunityGroupRepository groupRepository;
    private final CommunityMemberRepository memberRepository;
    private final CommunityReportRepository reportRepository;
    private final CommunityCategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final PostRepository postRepository;

    // ==========================================
    // 0. SYSTEM INITIALIZATION & LEGACY SYNC
    // ==========================================

    @PostConstruct
    @Transactional
    public void syncLegacyCommunities() {
        try {
            List<CommunityGroupEntity> all = this.groupRepository.findAll();
            for (CommunityGroupEntity g : all) {
                boolean changed = false;
                if (!"SUSPENDED".equalsIgnoreCase(g.getStatus()) && !"DELETED".equalsIgnoreCase(g.getStatus())) {
                    if (!"ACTIVE".equalsIgnoreCase(g.getStatus())) {
                        g.setStatus("ACTIVE");
                        changed = true;
                    }
                }
                if (g.getRequiresApproval() == null) {
                    g.setRequiresApproval(false);
                    changed = true;
                }
                if (changed) {
                    this.groupRepository.save(g);
                }

                if (g.getOwner() != null) {
                    Optional<CommunityMemberEntity> ownerMemberOpt = this.memberRepository.findByGroupAndUser(g, g.getOwner());
                    if (ownerMemberOpt.isEmpty()) {
                        CommunityMemberEntity mem = new CommunityMemberEntity();
                        mem.setGroup(g);
                        mem.setUser(g.getOwner());
                        mem.setRole("OWNER");
                        mem.setStatus("ACTIVE");
                        mem.setJoinedAt(g.getCreatedAt() != null ? g.getCreatedAt() : LocalDateTime.now());
                        this.memberRepository.save(mem);
                    } else {
                        CommunityMemberEntity mem = ownerMemberOpt.get();
                        if (!"OWNER".equalsIgnoreCase(mem.getRole()) || !"ACTIVE".equalsIgnoreCase(mem.getStatus())) {
                            mem.setRole("OWNER");
                            mem.setStatus("ACTIVE");
                            this.memberRepository.save(mem);
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error syncing legacy communities: " + e.getMessage());
        }
    }

    // ==========================================
    // 1. CLIENT & GROUP OWNER APIS
    // ==========================================

    @Transactional(readOnly = true)
    public ResponseData<List<CommunityGroupDTO>> getAllGroups(
            String keyword, 
            String categoryCode,
            Integer page,
            Integer size,
            JwtAuthenticationToken token
    ) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        List<CommunityGroupEntity> groups;

        String safeKw = (keyword != null && !keyword.trim().isEmpty()) ? keyword.trim() : null;
        String safeCategory = (categoryCode != null && !categoryCode.trim().isEmpty() && !categoryCode.equalsIgnoreCase("ALL")) 
                ? categoryCode.trim() 
                : null;

        if (page != null && size != null && size > 0) {
            Pageable pageable = PageRequest.of(Math.max(0, page), size);
            Page<CommunityGroupEntity> pageResult = this.groupRepository.findActiveCommunitiesWithPaging(safeCategory, safeKw, pageable);
            groups = pageResult.getContent();
        } else {
            groups = this.groupRepository.findActiveCommunities(safeCategory, safeKw);
        }

        List<CommunityGroupDTO> dtos = groups.stream()
                .map(g -> mapToGroupDTO(g, currentUser, false))
                .collect(Collectors.toList());

        return new ResponseData<>(200, "Lấy danh sách cộng đồng thành công", dtos);
    }

    @Transactional(readOnly = true)
    public ResponseData<Map<String, Object>> getCommunitiesOverview(JwtAuthenticationToken token) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        List<CommunityGroupEntity> allActiveGroups = this.groupRepository.findActiveCommunities(null, null);

        List<CommunityGroupDTO> joined = new ArrayList<>();
        List<CommunityGroupDTO> suggested = new ArrayList<>();

        for (CommunityGroupEntity g : allActiveGroups) {
            CommunityGroupDTO dto = mapToGroupDTO(g, currentUser, false);
            boolean isOwner = currentUser != null && g.getOwner() != null && currentUser.getId().equals(g.getOwner().getId());
            if (isOwner || (dto.getCurrentUserRole() != null && !"BANNED".equalsIgnoreCase(dto.getCurrentUserRole()))) {
                joined.add(dto);
            } else {
                suggested.add(dto);
            }
        }

        // Ưu tiên trạm của chủ sở hữu lên đầu
        joined.sort((a, b) -> {
            boolean aIsOwner = Boolean.TRUE.equals(a.getIsOwner()) || "OWNER".equalsIgnoreCase(a.getCurrentUserRole());
            boolean bIsOwner = Boolean.TRUE.equals(b.getIsOwner()) || "OWNER".equalsIgnoreCase(b.getCurrentUserRole());
            if (aIsOwner != bIsOwner) return bIsOwner ? 1 : -1;
            return 0;
        });

        suggested.sort((a, b) -> {
            int feat = Boolean.compare(Boolean.TRUE.equals(b.getIsFeatured()), Boolean.TRUE.equals(a.getIsFeatured()));
            if (feat != 0) return feat;
            return Long.compare(b.getMembersCount() != null ? b.getMembersCount() : 0, a.getMembersCount() != null ? a.getMembersCount() : 0);
        });

        Map<String, Object> result = new HashMap<>();
        result.put("joinedCommunities", joined);
        result.put("suggestedCommunities", suggested);

        return new ResponseData<>(200, "Lấy tổng quan cộng đồng thành công", result);
    }

    @Transactional(readOnly = true)
    public ResponseData<CommunityGroupDTO> getGroupById(Long groupId, JwtAuthenticationToken token) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        if ("SUSPENDED".equalsIgnoreCase(group.getStatus())) {
            boolean isAdmin = currentUser != null && currentUser.getRoles() != null && currentUser.getRoles().contains("ROLE_ADMIN");
            if (!isAdmin) {
                throw new AppException(403, "Cộng đồng này đã bị đình chỉ do vi phạm tiêu chuẩn cộng đồng!", 403);
            }
        }

        return new ResponseData<>(200, "Lấy chi tiết cộng đồng thành công", mapToGroupDTO(group, currentUser, true));
    }

    @Transactional
    public ResponseData<CommunityGroupDTO> createGroup(JwtAuthenticationToken token, CreateGroupRequest request) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(401, "Yêu cầu đăng nhập để tạo cộng đồng", 401);
        }

        SecurityUtils.validateSafeInput(request.getName(), "Tên cộng đồng", 3, 80);
        if (request.getDescription() != null && !request.getDescription().trim().isEmpty()) {
            SecurityUtils.validateSafeInput(request.getDescription(), "Mô tả cộng đồng", 0, 500);
        }
        if (request.getRules() != null && !request.getRules().trim().isEmpty()) {
            SecurityUtils.validateSafeInput(request.getRules(), "Nội quy cộng đồng", 0, 1000);
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
        boolean reqApproval = request.getRequireMemberApproval() != null 
            ? request.getRequireMemberApproval() 
            : Boolean.TRUE.equals(request.getRequiresApproval());
        group.setRequiresApproval(reqApproval);

        boolean pubFeed = request.getAllowFeedPromotion() != null 
            ? request.getAllowFeedPromotion() 
            : (request.getIsPublicToFeed() != null ? request.getIsPublicToFeed() : true);
        group.setIsPublicToFeed(pubFeed);

        boolean reqPostApproval = request.getRequirePostApproval() != null 
            ? request.getRequirePostApproval() 
            : Boolean.TRUE.equals(request.getRequiresPostApproval());
        group.setRequiresPostApproval(reqPostApproval);

        if (request.getCategoryId() != null) {
            group.setCategoryId(request.getCategoryId());
            Optional<CommunityCategoryEntity> catOpt = this.categoryRepository.findById(request.getCategoryId());
            if (catOpt.isPresent()) {
                group.setCategoryCode(catOpt.get().getSlug());
            }
        } else if (request.getCategoryCode() != null && !request.getCategoryCode().trim().isEmpty()) {
            group.setCategoryCode(request.getCategoryCode().trim());
            Optional<CommunityCategoryEntity> catOpt = this.categoryRepository.findBySlug(request.getCategoryCode().trim().toLowerCase());
            if (catOpt.isPresent()) {
                group.setCategoryId(catOpt.get().getId());
            }
        } else {
            group.setCategoryCode("GENERAL");
        }

        group.setStatus("ACTIVE");
        group.setIsFeatured(Boolean.TRUE.equals(request.getIsPinnedFeatured()));
        group.setActiveVoiceRoomId(request.getActiveVoiceRoomId());
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
        if (request.getIsPrivate() != null) {
            group.setIsPrivate(request.getIsPrivate());
        }
        if (request.getRequireMemberApproval() != null) {
            group.setRequiresApproval(request.getRequireMemberApproval());
        } else if (request.getRequiresApproval() != null) {
            group.setRequiresApproval(request.getRequiresApproval());
        }
        if (request.getAllowFeedPromotion() != null) {
            group.setIsPublicToFeed(request.getAllowFeedPromotion());
        } else if (request.getIsPublicToFeed() != null) {
            group.setIsPublicToFeed(request.getIsPublicToFeed());
        }
        if (request.getRequirePostApproval() != null) {
            group.setRequiresPostApproval(request.getRequirePostApproval());
        } else if (request.getRequiresPostApproval() != null) {
            group.setRequiresPostApproval(request.getRequiresPostApproval());
        }
        if (request.getCategoryId() != null) {
            group.setCategoryId(request.getCategoryId());
            Optional<CommunityCategoryEntity> catOpt = this.categoryRepository.findById(request.getCategoryId());
            if (catOpt.isPresent()) {
                group.setCategoryCode(catOpt.get().getSlug());
            }
        } else if (request.getCategoryCode() != null && !request.getCategoryCode().trim().isEmpty()) {
            group.setCategoryCode(request.getCategoryCode().trim());
            Optional<CommunityCategoryEntity> catOpt = this.categoryRepository.findBySlug(request.getCategoryCode().trim().toLowerCase());
            if (catOpt.isPresent()) {
                group.setCategoryId(catOpt.get().getId());
            }
        }
        if (request.getIsPinnedFeatured() != null) {
            group.setIsFeatured(request.getIsPinnedFeatured());
        } else if (request.getIsFeatured() != null) {
            group.setIsFeatured(request.getIsFeatured());
        }
        if (request.getStatus() != null && !request.getStatus().trim().isEmpty()) {
            group.setStatus(request.getStatus().trim().toUpperCase());
        }
        if (request.getActiveVoiceRoomId() != null) {
            group.setActiveVoiceRoomId(request.getActiveVoiceRoomId());
        }

        group = this.groupRepository.save(group);
        return new ResponseData<>(200, "Cập nhật thông tin cộng đồng thành công", mapToGroupDTO(group, currentUser, true));
    }

    @Transactional
    public ResponseData<String> joinGroup(JwtAuthenticationToken token, Long groupId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(401, "Yêu cầu đăng nhập", 401);
        }

        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        if ("SUSPENDED".equalsIgnoreCase(group.getStatus())) {
            throw new AppException(403, "Cộng đồng này đã bị đình chỉ hoạt động!", 403);
        }

        if (group.getOwner() != null && group.getOwner().getId().equals(currentUser.getId())) {
            return new ResponseData<>(200, "Bạn là chủ sở hữu của cộng đồng này", "ALREADY_MEMBER");
        }

        Optional<CommunityMemberEntity> existing = this.memberRepository.findByGroupAndUser(group, currentUser);
        if (existing.isPresent()) {
            CommunityMemberEntity mem = existing.get();
            if ("ACTIVE".equals(mem.getStatus())) {
                return new ResponseData<>(200, "Bạn đã là thành viên của cộng đồng này", "ALREADY_MEMBER");
            } else if ("PENDING".equals(mem.getStatus())) {
                return new ResponseData<>(200, "Yêu cầu tham gia của bạn đang chờ phê duyệt", "PENDING_APPROVAL");
            } else if ("BANNED".equals(mem.getStatus())) {
                throw new AppException(403, "Bạn đã bị chặn khỏi cộng đồng này!", 403);
            }
        }

        CommunityMemberEntity newMember = new CommunityMemberEntity();
        newMember.setGroup(group);
        newMember.setUser(currentUser);
        newMember.setRole("MEMBER");

        if (Boolean.TRUE.equals(group.getRequiresApproval())) {
            newMember.setStatus("PENDING");
            this.memberRepository.save(newMember);
            return new ResponseData<>(200, "Đã gửi yêu cầu tham gia, chờ quản trị viên duyệt", "PENDING_APPROVAL");
        } else {
            newMember.setStatus("ACTIVE");
            this.memberRepository.save(newMember);
            return new ResponseData<>(200, "Gia nhập cộng đồng thành công!", "JOINED");
        }
    }

    @Transactional
    public ResponseData<Boolean> leaveGroup(JwtAuthenticationToken token, Long groupId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        if (group.getOwner().getId().equals(currentUser.getId())) {
            throw new AppException(400, "Chủ nhóm không thể rời cộng đồng! Hãy chuyển quyền Chủ nhóm hoặc giải tán cộng đồng.", 400);
        }

        CommunityMemberEntity member = this.memberRepository.findByGroupAndUser(group, currentUser).orElseThrow(() ->
            new AppException(400, "Bạn không phải thành viên của nhóm này", 400)
        );

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
            new AppException(403, "Bạn không phải quản trị viên nhóm này!", 403)
        );

        if (!"OWNER".equals(currentMember.getRole()) && !"DEPUTY".equals(currentMember.getRole())) {
            throw new AppException(403, "Chỉ Chủ nhóm hoặc Phó nhóm mới có quyền duyệt thành viên!", 403);
        }

        List<CommunityMemberEntity> pendings = this.memberRepository.findByGroupAndStatus(group, "PENDING");
        List<CommunityMemberDTO> dtos = pendings.stream().map(this::mapToMemberDTO).collect(Collectors.toList());
        return new ResponseData<>(200, "Lấy danh sách chờ duyệt thành công", dtos);
    }

    @Transactional
    public ResponseData<Boolean> approveMember(JwtAuthenticationToken token, Long groupId, Long targetUserId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        CommunityMemberEntity currentMember = this.memberRepository.findByGroupAndUser(group, currentUser).orElseThrow(() ->
            new AppException(403, "Bạn không phải quản trị viên nhóm này!", 403)
        );

        if (!"OWNER".equals(currentMember.getRole()) && !"DEPUTY".equals(currentMember.getRole())) {
            throw new AppException(403, "Chỉ Chủ nhóm hoặc Phó nhóm mới có quyền duyệt thành viên!", 403);
        }

        UserEntity targetUser = this.userRepository.findById(targetUserId).orElseThrow(() ->
            new AppException(404, "Người dùng không tồn tại", 404)
        );

        CommunityMemberEntity targetMember = this.memberRepository.findByGroupAndUser(group, targetUser).orElseThrow(() ->
            new AppException(404, "Yêu cầu tham gia không tồn tại", 404)
        );

        targetMember.setStatus("ACTIVE");
        targetMember.setJoinedAt(LocalDateTime.now());
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
            new AppException(403, "Bạn không phải quản trị viên nhóm này!", 403)
        );

        if (!"OWNER".equals(currentMember.getRole()) && !"DEPUTY".equals(currentMember.getRole())) {
            throw new AppException(403, "Chỉ Chủ nhóm hoặc Phó nhóm mới có quyền từ chối thành viên!", 403);
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
    public ResponseData<Boolean> banMember(JwtAuthenticationToken token, Long groupId, Long targetUserId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        CommunityMemberEntity currentMember = this.memberRepository.findByGroupAndUser(group, currentUser).orElseThrow(() ->
            new AppException(403, "Bạn không phải quản trị viên nhóm này!", 403)
        );

        if (!"OWNER".equals(currentMember.getRole()) && !"DEPUTY".equals(currentMember.getRole())) {
            throw new AppException(403, "Chỉ Chủ nhóm hoặc Phó nhóm mới có quyền chặn thành viên!", 403);
        }

        UserEntity targetUser = this.userRepository.findById(targetUserId).orElseThrow(() ->
            new AppException(404, "Người dùng không tồn tại", 404)
        );

        if (group.getOwner() != null && group.getOwner().getId().equals(targetUserId)) {
            throw new AppException(400, "Không thể chặn Chủ nhóm!", 400);
        }

        CommunityMemberEntity targetMember = this.memberRepository.findByGroupAndUser(group, targetUser).orElse(null);
        if (targetMember == null) {
            targetMember = new CommunityMemberEntity();
            targetMember.setGroup(group);
            targetMember.setUser(targetUser);
            targetMember.setRole("MEMBER");
        }
        targetMember.setStatus("BANNED");
        this.memberRepository.save(targetMember);
        return new ResponseData<>(200, "Đã chặn thành viên khỏi nhóm", true);
    }

    @Transactional
    public ResponseData<Boolean> unbanMember(JwtAuthenticationToken token, Long groupId, Long targetUserId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        CommunityMemberEntity currentMember = this.memberRepository.findByGroupAndUser(group, currentUser).orElseThrow(() ->
            new AppException(403, "Bạn không phải quản trị viên nhóm này!", 403)
        );

        if (!"OWNER".equals(currentMember.getRole()) && !"DEPUTY".equals(currentMember.getRole())) {
            throw new AppException(403, "Chỉ Chủ nhóm hoặc Phó nhóm mới có quyền gỡ chặn!", 403);
        }

        UserEntity targetUser = this.userRepository.findById(targetUserId).orElseThrow(() ->
            new AppException(404, "Người dùng không tồn tại", 404)
        );

        Optional<CommunityMemberEntity> targetMemberOpt = this.memberRepository.findByGroupAndUser(group, targetUser);
        if (targetMemberOpt.isPresent()) {
            CommunityMemberEntity targetMember = targetMemberOpt.get();
            this.memberRepository.delete(targetMember);
        }
        return new ResponseData<>(200, "Đã gỡ chặn thành viên khỏi nhóm", true);
    }

    @Transactional
    public ResponseData<Boolean> setMemberRole(JwtAuthenticationToken token, Long groupId, Long targetUserId, String newRole) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        if (!group.getOwner().getId().equals(currentUser.getId())) {
            throw new AppException(403, "Chỉ Chủ nhóm mới có quyền phân quyền thành viên!", 403);
        }

        UserEntity targetUser = this.userRepository.findById(targetUserId).orElseThrow(() ->
            new AppException(404, "Người dùng không tồn tại", 404)
        );

        CommunityMemberEntity targetMember = this.memberRepository.findByGroupAndUser(group, targetUser).orElseThrow(() ->
            new AppException(404, "Thành viên không thuộc nhóm này", 404)
        );

        targetMember.setRole(newRole);
        this.memberRepository.save(targetMember);
        return new ResponseData<>(200, "Đã cập nhật quyền thành viên thành công", true);
    }

    @Transactional
    public ResponseData<String> inviteFriend(JwtAuthenticationToken token, Long groupId, Long friendUserId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        UserEntity friend = this.userRepository.findById(friendUserId).orElseThrow(() ->
            new AppException(404, "Bạn bè không tồn tại", 404)
        );

        Optional<CommunityMemberEntity> existing = this.memberRepository.findByGroupAndUser(group, friend);
        if (existing.isPresent()) {
            return new ResponseData<>(200, "Người này đã ở trong nhóm hoặc đã gửi yêu cầu", "ALREADY_IN_GROUP");
        }

        CommunityMemberEntity invite = new CommunityMemberEntity();
        invite.setGroup(group);
        invite.setUser(friend);
        invite.setRole("MEMBER");
        invite.setStatus("ACTIVE");
        invite.setJoinedAt(LocalDateTime.now());
        this.memberRepository.save(invite);

        return new ResponseData<>(200, "Đã thêm bạn bè vào cộng đồng thành công!", "INVITED");
    }

    @Transactional
    public ResponseData<Boolean> deleteGroup(JwtAuthenticationToken token, Long groupId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        if (!group.getOwner().getId().equals(currentUser.getId())) {
            boolean isAdmin = currentUser.getRoles() != null && currentUser.getRoles().contains("ROLE_ADMIN");
            if (!isAdmin) {
                throw new AppException(403, "Chỉ Chủ nhóm hoặc Super Admin mới có quyền giải tán cộng đồng!", 403);
            }
        }

        this.groupRepository.delete(group);
        return new ResponseData<>(200, "Đã giải tán cộng đồng thành công", true);
    }

    // Gửi báo cáo vi phạm cộng đồng / bài viết trong nhóm
    @Transactional
    public ResponseData<CommunityReportDTO> reportCommunity(
            JwtAuthenticationToken token,
            Long groupId,
            CreateCommunityReportRequest request
    ) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        if (currentUser == null) {
            throw new AppException(401, "Yêu cầu đăng nhập để gửi báo cáo vi phạm", 401);
        }

        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        CommunityReportEntity report = new CommunityReportEntity();
        report.setCommunity(group);
        report.setReporter(currentUser);
        report.setTargetType("COMMUNITY");
        report.setTargetId(groupId);
        report.setTargetPostId(request.getTargetPostId());
        report.setReason(request.getReasonCode().trim().toUpperCase());
        report.setReasonCode(request.getReasonCode().trim().toUpperCase());
        report.setDescription(request.getDescription());
        report.setStatus("PENDING");
        report.setCreatedAt(LocalDateTime.now());

        report = this.reportRepository.save(report);

        return new ResponseData<>(200, "Báo cáo vi phạm đã được gửi đến ban quản trị hệ thống!", mapToReportDTO(report));
    }

    // ==========================================
    // 2. SUPER ADMIN SCALE & MODERATION APIS
    // ==========================================

    @Transactional(readOnly = true)
    public ResponseData<List<CommunityGroupDTO>> getAdminCommunities(
            String status,
            String keyword,
            Integer page,
            Integer size,
            JwtAuthenticationToken token
    ) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        checkSuperAdminRole(currentUser);

        String safeKw = (keyword != null && !keyword.trim().isEmpty()) ? keyword.trim() : null;
        String safeStatus = (status != null && !status.trim().isEmpty() && !status.equalsIgnoreCase("ALL")) ? status.trim() : null;

        List<CommunityGroupEntity> groups;
        if (page != null && size != null && size > 0) {
            Pageable pageable = PageRequest.of(Math.max(0, page), size);
            Page<CommunityGroupEntity> pageResult = this.groupRepository.findAdminCommunitiesWithPaging(safeStatus, safeKw, pageable);
            groups = pageResult.getContent();
        } else {
            groups = this.groupRepository.findAdminCommunities(safeStatus, safeKw);
        }

        // Lấy thống kê số báo cáo đang chờ
        Map<Long, Long> pendingReportsMap = new HashMap<>();
        try {
            List<Object[]> counts = this.reportRepository.countPendingReportsByCommunity();
            for (Object[] row : counts) {
                if (row.length >= 2 && row[0] != null && row[1] != null) {
                    pendingReportsMap.put((Long) row[0], (Long) row[1]);
                }
            }
        } catch (Exception ignored) {}

        List<CommunityGroupDTO> dtos = groups.stream().map(g -> {
            CommunityGroupDTO dto = mapToGroupDTO(g, currentUser, false);
            dto.setPendingReportsCount(pendingReportsMap.getOrDefault(g.getId(), 0L));
            return dto;
        }).collect(Collectors.toList());

        return new ResponseData<>(200, "Lấy danh sách quản trị cộng đồng thành công", dtos);
    }

    @Transactional
    public ResponseData<CommunityGroupDTO> updateCommunityStatusByAdmin(
            JwtAuthenticationToken token,
            Long groupId,
            String newStatus,
            Boolean isFeatured
    ) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        checkSuperAdminRole(currentUser);

        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        if (newStatus != null && !newStatus.trim().isEmpty()) {
            group.setStatus(newStatus.trim().toUpperCase());
        }
        if (isFeatured != null) {
            group.setIsFeatured(isFeatured);
        }

        group = this.groupRepository.save(group);
        return new ResponseData<>(200, "Đã cập nhật trạng thái cộng đồng thành công", mapToGroupDTO(group, currentUser, false));
    }

    @Transactional
    public ResponseData<Boolean> deleteCommunityByAdmin(JwtAuthenticationToken token, Long groupId) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        checkSuperAdminRole(currentUser);

        CommunityGroupEntity group = this.groupRepository.findById(groupId).orElseThrow(() ->
            new AppException(404, "Cộng đồng không tồn tại", 404)
        );

        this.groupRepository.delete(group);
        return new ResponseData<>(200, "Đã xóa vĩnh viễn cộng đồng khỏi hệ thống", true);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<CommunityReportDTO>> getCommunityReports(String status, JwtAuthenticationToken token) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        checkSuperAdminRole(currentUser);

        List<CommunityReportEntity> reports;
        if (status != null && !status.trim().isEmpty() && !status.equalsIgnoreCase("ALL")) {
            reports = this.reportRepository.findByStatusOrderByCreatedAtDesc(status.trim().toUpperCase());
        } else {
            reports = this.reportRepository.findAllByOrderByCreatedAtDesc();
        }

        List<CommunityReportDTO> dtos = reports.stream().map(this::mapToReportDTO).collect(Collectors.toList());
        return new ResponseData<>(200, "Lấy danh sách báo cáo vi phạm cộng đồng thành công", dtos);
    }

    @Transactional
    public ResponseData<CommunityReportDTO> resolveCommunityReport(
            JwtAuthenticationToken token,
            Long reportId,
            ResolveReportRequest request
    ) {
        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, this.userRepository);
        checkSuperAdminRole(currentUser);

        CommunityReportEntity report = this.reportRepository.findById(reportId).orElseThrow(() ->
            new AppException(404, "Báo cáo không tồn tại", 404)
        );

        String action = request.getAction().trim().toUpperCase();
        report.setStatus(action);
        report.setAdminNote(request.getAdminNote());
        report.setResolvedBy(currentUser.getId());
        report.setResolvedAt(LocalDateTime.now());

        // Nếu quyết định đình chỉ nhóm -> cập nhật status nhóm sang SUSPENDED
        if ("RESOLVED_SUSPENDED".equals(action) && report.getCommunity() != null) {
            CommunityGroupEntity community = report.getCommunity();
            community.setStatus("SUSPENDED");
            this.groupRepository.save(community);
        }

        report = this.reportRepository.save(report);
        return new ResponseData<>(200, "Đã xử lý báo cáo vi phạm thành công", mapToReportDTO(report));
    }

    private void checkSuperAdminRole(UserEntity user) {
        if (user == null || user.getRoles() == null) {
            throw new AppException(403, "Yêu cầu quyền Quản trị viên hệ thống (Super Admin)!", 403);
        }
        boolean isAdmin = user.getRoles().stream().anyMatch(r -> {
            String u = String.valueOf(r).toUpperCase();
            return u.contains("ADMIN") || u.contains("AMDIN") || u.startsWith("TL_") || u.startsWith("PERM_");
        });
        if (!isAdmin) {
            throw new AppException(403, "Yêu cầu quyền Quản trị viên hệ thống (Super Admin)!", 403);
        }
    }

    // ==========================================
    // DTO MAPPERS
    // ==========================================

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
        dto.setRequireMemberApproval(Boolean.TRUE.equals(g.getRequiresApproval()));
        dto.setIsPublicToFeed(Boolean.TRUE.equals(g.getIsPublicToFeed()));
        dto.setAllowFeedPromotion(Boolean.TRUE.equals(g.getIsPublicToFeed()));
        dto.setRequiresPostApproval(Boolean.TRUE.equals(g.getRequiresPostApproval()));
        dto.setRequirePostApproval(Boolean.TRUE.equals(g.getRequiresPostApproval()));
        dto.setCategoryId(g.getCategoryId());
        dto.setCategoryCode(g.getCategoryCode() != null ? g.getCategoryCode() : "GENERAL");
        if (g.getCategoryId() != null) {
            this.categoryRepository.findById(g.getCategoryId()).ifPresent(cat -> dto.setCategoryName(cat.getName()));
        } else if (g.getCategoryCode() != null) {
            this.categoryRepository.findBySlug(g.getCategoryCode().toLowerCase()).ifPresent(cat -> {
                dto.setCategoryId(cat.getId());
                dto.setCategoryName(cat.getName());
            });
        }
        dto.setStatus(g.getStatus() != null ? g.getStatus() : "ACTIVE");
        dto.setIsFeatured(Boolean.TRUE.equals(g.getIsFeatured()));
        dto.setIsPinnedFeatured(Boolean.TRUE.equals(g.getIsFeatured()));
        dto.setActiveVoiceRoomId(g.getActiveVoiceRoomId());
        dto.setPostsCount(this.postRepository != null ? this.postRepository.countByGroupIdAndStatus(g.getId(), "APPROVED") : 0L);

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

        boolean isOwner = currentUser != null && g.getOwner() != null && currentUser.getId().equals(g.getOwner().getId());
        dto.setIsOwner(isOwner);

        if (currentUser != null && g.getMembers() != null) {
            Optional<CommunityMemberEntity> userMem = g.getMembers().stream()
                    .filter(m -> m != null && m.getUser() != null && m.getUser().getId().equals(currentUser.getId()))
                    .findFirst();
            if (userMem.isPresent()) {
                CommunityMemberEntity mem = userMem.get();
                if ("BANNED".equalsIgnoreCase(mem.getStatus())) {
                    dto.setCurrentUserRole("BANNED");
                } else if ("ACTIVE".equalsIgnoreCase(mem.getStatus()) || "APPROVED".equalsIgnoreCase(mem.getStatus())) {
                    dto.setCurrentUserRole(mem.getRole());
                } else {
                    dto.setCurrentUserRole(isOwner ? "OWNER" : "PENDING");
                }
            } else if (isOwner) {
                dto.setCurrentUserRole("OWNER");
            } else {
                dto.setCurrentUserRole(null);
            }
        } else if (isOwner) {
            dto.setCurrentUserRole("OWNER");
        } else {
            dto.setCurrentUserRole(null);
        }

        if (isOwner) {
            dto.setCurrentUserRole("OWNER");
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

    private CommunityReportDTO mapToReportDTO(CommunityReportEntity r) {
        CommunityReportDTO dto = new CommunityReportDTO();
        dto.setId(r.getId());
        dto.setTargetType(r.getTargetType());
        dto.setTargetId(r.getTargetId());
        dto.setReason(r.getReason() != null ? r.getReason() : r.getReasonCode());
        if (r.getCommunity() != null) {
            dto.setCommunityId(r.getCommunity().getId());
            dto.setCommunityName(r.getCommunity().getName());
        }
        if (r.getReporter() != null) {
            dto.setReporterId(r.getReporter().getId());
            dto.setReporterName(r.getReporter().getNickname() != null ? r.getReporter().getNickname() : r.getReporter().getAccount());
            dto.setReporterAccount(r.getReporter().getAccount());
        }
        dto.setTargetPostId(r.getTargetPostId());
        dto.setReasonCode(r.getReasonCode());
        dto.setDescription(r.getDescription());
        dto.setStatus(r.getStatus());
        dto.setAdminNote(r.getAdminNote());
        dto.setResolvedBy(r.getResolvedBy());
        dto.setCreatedAt(r.getCreatedAt());
        dto.setResolvedAt(r.getResolvedAt());
        return dto;
    }
}
