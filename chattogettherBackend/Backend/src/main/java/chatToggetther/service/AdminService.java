package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.DTO.PostDTO;
import chatToggetther.DTO.UserDTO;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.PostEntity;
import chatToggetther.modelEntity.RoomEntity;
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
import java.util.stream.Collectors;

@Service
public class AdminService {
    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final RoomRepository roomRepository;
    private final MessageRepository messageRepository;
    private final TrackRepository trackRepository;

    public AdminService(
            UserRepository userRepository,
            PostRepository postRepository,
            RoomRepository roomRepository,
            MessageRepository messageRepository,
            TrackRepository trackRepository
    ) {
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.roomRepository = roomRepository;
        this.messageRepository = messageRepository;
        this.trackRepository = trackRepository;
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
}
