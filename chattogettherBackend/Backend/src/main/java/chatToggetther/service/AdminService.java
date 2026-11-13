package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.DTO.PostDTO;
import chatToggetther.DTO.UserDTO;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.ChallengeEntity;
import chatToggetther.modelEntity.PostEntity;
import chatToggetther.modelEntity.RoomEntity;
import chatToggetther.modelEntity.SystemConfigEntity;
import chatToggetther.modelEntity.TrackEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class AdminService {
    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final RoomRepository roomRepository;
    private final MessageRepository messageRepository;
    private final TrackRepository trackRepository;
    private final ChallengeRepository challengeRepository;
    private final SystemConfigRepository systemConfigRepository;

    public AdminService(
            UserRepository userRepository,
            PostRepository postRepository,
            RoomRepository roomRepository,
            MessageRepository messageRepository,
            TrackRepository trackRepository,
            ChallengeRepository challengeRepository,
            SystemConfigRepository systemConfigRepository
    ) {
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.roomRepository = roomRepository;
        this.messageRepository = messageRepository;
        this.trackRepository = trackRepository;
        this.challengeRepository = challengeRepository;
        this.systemConfigRepository = systemConfigRepository;
    }

    private void verifyAdmin(JwtAuthenticationToken token) {
        Long userId = SecurityUtils.extractUserId(token);
        if (userId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập tài khoản quản trị", 401);
        }
        UserEntity user = userRepository.findById(userId).orElseThrow(() ->
                new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại", 404)
        );
        boolean isAdmin = user.getRoles() != null && 
                (user.getRoles().contains("ROLE_ADMIN") || user.getRoles().contains("ROLE_AMDIN"));
        if (!isAdmin) {
            throw new AppException(403, "Bạn không có quyền quản trị hệ thống", 403);
        }
    }

    @Transactional(readOnly = true)
    public ResponseData<Map<String, Object>> getSystemStats(JwtAuthenticationToken token) {
        verifyAdmin(token);

        long totalUsers = userRepository.count();
        long totalPosts = postRepository.count();
        long totalRooms = roomRepository.count();
        long totalMessages = messageRepository.count();
        long totalTracks = trackRepository.count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("totalPosts", totalPosts);
        stats.put("totalRooms", totalRooms);
        stats.put("totalMessages", totalMessages);
        stats.put("totalTracks", totalTracks);
        stats.put("timestamp", LocalDateTime.now());

        return new ResponseData<>(200, "Lấy thống kê hệ thống thành công", stats);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<UserDTO>> getAllUsers(JwtAuthenticationToken token) {
        verifyAdmin(token);

        List<UserEntity> users = userRepository.findAll();
        List<UserDTO> dtoList = users.stream().map(u -> {
            UserDTO dto = new UserDTO();
            dto.setId(u.getId());
            dto.setAccount(u.getAccount());
            dto.setNickname(u.getNickname() != null ? u.getNickname() : u.getAccount());
            dto.setEmail(u.getEmail());
            dto.setPhone(u.getPhone());
            dto.setAvatar(u.getAvatar());
            dto.setAge(u.getAge());
            dto.setLocation(u.getLocation());
            dto.setBio(u.getBio());
            dto.setActive(u.getActive());
            dto.setRoles(u.getRoles());
            boolean isAdmin = u.getRoles() != null && (u.getRoles().contains("ROLE_ADMIN") || u.getRoles().contains("ROLE_AMDIN"));
            dto.setIsVerified(isAdmin);
            dto.setVipTier(isAdmin ? "ADMIN" : "MEMBER");
            dto.setCustomTitle(isAdmin ? "Quản trị viên" : "Thành viên");
            return dto;
        }).collect(Collectors.toList());

        return new ResponseData<>(200, "Lấy danh sách người dùng thành công", dtoList);
    }

    @Transactional
    public ResponseData<Boolean> updateUserStatus(JwtAuthenticationToken token, Long targetUserId, Boolean active) {
        verifyAdmin(token);

        UserEntity user = userRepository.findById(targetUserId).orElseThrow(() ->
                new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại", 404)
        );
        user.setActive(active);
        userRepository.save(user);

        return new ResponseData<>(200, "Cập nhật trạng thái người dùng thành công", true);
    }

    @Transactional
    public ResponseData<Boolean> updateUserRoles(JwtAuthenticationToken token, Long targetUserId, List<String> roles) {
        verifyAdmin(token);

        UserEntity user = userRepository.findById(targetUserId).orElseThrow(() ->
                new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại", 404)
        );
        user.setRoles(roles);
        userRepository.save(user);

        return new ResponseData<>(200, "Cập nhật vai trò người dùng thành công", true);
    }

    @Transactional
    public ResponseData<Boolean> deletePostByAdmin(JwtAuthenticationToken token, Long postId) {
        verifyAdmin(token);

        PostEntity post = postRepository.findById(postId).orElseThrow(() ->
                new AppException(404, "Bài viết không tồn tại", 404)
        );
        postRepository.delete(post);

        return new ResponseData<>(200, "Đã gỡ bài viết vi phạm", true);
    }

    @Transactional
    public ResponseData<TrackEntity> addTrack(JwtAuthenticationToken token, TrackEntity track) {
        verifyAdmin(token);

        if (track.getName() == null || track.getName().trim().isEmpty()) {
            throw new AppException(400, "Tên bản nhạc không được để trống", 400);
        }
        if (track.getAudioSrc() == null || track.getAudioSrc().trim().isEmpty()) {
            throw new AppException(400, "Đường dẫn âm thanh không được để trống", 400);
        }

        track.setName(track.getName().trim());
        track.setAudioSrc(track.getAudioSrc().trim());
        if (track.getGenre() != null) track.setGenre(track.getGenre().trim());
        if (track.getArtist() != null) track.setArtist(track.getArtist().trim());
        track.setActive(true);
        track.setCreatedAt(LocalDateTime.now());

        TrackEntity saved = trackRepository.save(track);
        return new ResponseData<>(200, "Thêm bản nhạc thành công", saved);
    }

    @Transactional
    public ResponseData<Boolean> deleteTrack(JwtAuthenticationToken token, Long trackId) {
        verifyAdmin(token);

        TrackEntity track = trackRepository.findById(trackId).orElseThrow(() ->
                new AppException(404, "Bản nhạc không tồn tại", 404)
        );
        trackRepository.delete(track);

        return new ResponseData<>(200, "Đã xóa bản nhạc", true);
    }

    @Transactional(readOnly = true)
    public ResponseData<List<TrackEntity>> getAllTracks(JwtAuthenticationToken token) {
        verifyAdmin(token);
        return new ResponseData<>(200, "Lấy danh sách bản nhạc thành công", trackRepository.findAll());
    }

    // ==========================================
    // QUẢN LÝ CẤU HÌNH HỆ THỐNG (SYSTEM CONFIG)
    // ==========================================

    @Transactional(readOnly = true)
    public ResponseData<Map<String, String>> getSystemConfig() {
        List<SystemConfigEntity> all = systemConfigRepository.findAll();
        Map<String, String> map = new HashMap<>();

        // Nạp các giá trị đã lưu trong DB
        for (SystemConfigEntity cfg : all) {
            map.put(cfg.getConfigKey(), cfg.getConfigValue());
        }

        // Giá trị mặc định chuẩn nếu chưa cấu hình
        if (!map.containsKey("brand_name")) map.put("brand_name", "Talovin");
        if (!map.containsKey("brand_slogan")) map.put("brand_slogan", "Social Lounge");
        if (!map.containsKey("vibe_options")) {
            map.put("vibe_options", "[\"Thư giãn\",\"Tích cực\",\"Lắng đọng\",\"Tìm bạn\",\"Tâm sự\"]");
        }
        if (!map.containsKey("menu_items")) {
            map.put("menu_items", "[{\"id\":\"lobby\",\"label\":\"Sảnh trực tuyến\",\"visible\":true,\"order\":1},{\"id\":\"groups\",\"label\":\"Cộng đồng\",\"visible\":true,\"order\":2},{\"id\":\"rooms\",\"label\":\"Phòng đàm thoại\",\"visible\":true,\"order\":3},{\"id\":\"trending\",\"label\":\"Thịnh hành\",\"visible\":true,\"order\":4},{\"id\":\"saved\",\"label\":\"Đã lưu\",\"visible\":true,\"order\":5},{\"id\":\"friends\",\"label\":\"Bạn bè\",\"visible\":true,\"order\":6},{\"id\":\"profile\",\"label\":\"Hồ sơ & Huy hiệu\",\"visible\":true,\"order\":7}]");
        }
        if (!map.containsKey("feature_toggles")) {
            map.put("feature_toggles", "{\"enableRadio\":true,\"enableSpeedMatch\":true,\"enableChallengeDeck\":true,\"enableCommunity\":true}");
        }

        return new ResponseData<>(200, "Lấy cấu hình hệ thống thành công", map);
    }

    @Transactional
    public ResponseData<Boolean> updateSystemConfig(JwtAuthenticationToken token, Map<String, String> configs) {
        verifyAdmin(token);

        if (configs != null) {
            for (Map.Entry<String, String> entry : configs.entrySet()) {
                if (entry.getKey() != null && entry.getValue() != null) {
                    SystemConfigEntity entity = systemConfigRepository.findById(entry.getKey())
                            .orElse(SystemConfigEntity.builder()
                                    .configKey(entry.getKey())
                                    .build());
                    entity.setConfigValue(entry.getValue());
                    entity.setUpdatedAt(LocalDateTime.now());
                    systemConfigRepository.save(entity);
                }
            }
        }

        return new ResponseData<>(200, "Cập nhật cấu hình hệ thống thành công", true);
    }

    // ==========================================
    // QUẢN LÝ THẺ BÀI THỬ THÁCH (CHALLENGES)
    // ==========================================

    @Transactional(readOnly = true)
    public ResponseData<List<ChallengeEntity>> getAllChallenges(JwtAuthenticationToken token) {
        verifyAdmin(token);
        return new ResponseData<>(200, "Lấy danh sách câu hỏi thử thách thành công", challengeRepository.findAll());
    }

    @Transactional
    public ResponseData<ChallengeEntity> addChallenge(JwtAuthenticationToken token, ChallengeEntity challenge) {
        verifyAdmin(token);

        if (challenge.getQuestion() == null || challenge.getQuestion().trim().isEmpty()) {
            throw new AppException(400, "Nội dung câu hỏi không được để trống", 400);
        }

        challenge.setQuestion(challenge.getQuestion().trim());
        if (challenge.getCategory() == null || challenge.getCategory().trim().isEmpty()) {
            challenge.setCategory("DEEP_TALK");
        }
        if (challenge.getCategoryName() == null || challenge.getCategoryName().trim().isEmpty()) {
            challenge.setCategoryName("Tâm sự sâu lắng");
        }
        if (challenge.getBadgeColor() == null) challenge.setBadgeColor("#818cf8");
        challenge.setAuthor("Quản trị viên");
        challenge.setActive(true);
        challenge.setUsageCount(0);
        challenge.setCreatedAt(LocalDateTime.now());

        ChallengeEntity saved = challengeRepository.save(challenge);
        return new ResponseData<>(200, "Thêm câu hỏi thử thách thành công", saved);
    }

    @Transactional
    public ResponseData<ChallengeEntity> updateChallenge(JwtAuthenticationToken token, Long id, ChallengeEntity updated) {
        verifyAdmin(token);

        ChallengeEntity existing = challengeRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Câu hỏi không tồn tại", 404)
        );

        if (updated.getQuestion() != null && !updated.getQuestion().trim().isEmpty()) {
            existing.setQuestion(updated.getQuestion().trim());
        }
        if (updated.getCategory() != null) existing.setCategory(updated.getCategory());
        if (updated.getCategoryName() != null) existing.setCategoryName(updated.getCategoryName());
        if (updated.getBadgeColor() != null) existing.setBadgeColor(updated.getBadgeColor());
        if (updated.getActive() != null) existing.setActive(updated.getActive());

        ChallengeEntity saved = challengeRepository.save(existing);
        return new ResponseData<>(200, "Cập nhật câu hỏi thành công", saved);
    }

    @Transactional
    public ResponseData<Boolean> deleteChallenge(JwtAuthenticationToken token, Long id) {
        verifyAdmin(token);

        ChallengeEntity existing = challengeRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Câu hỏi không tồn tại", 404)
        );
        challengeRepository.delete(existing);

        return new ResponseData<>(200, "Đã xóa câu hỏi thử thách", true);
    }
}

