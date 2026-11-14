package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.DTO.AudioChannelDTO;
import chatToggetther.DTO.BroadcastStationDTO;
import chatToggetther.DTO.FrequencyConfigResponseDTO;
import chatToggetther.DTO.MatchIntentDTO;
import chatToggetther.DataRequest.LockTargetRequest;
import chatToggetther.DataRequest.ScanStationRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.MatchIntentEntity;
import chatToggetther.modelEntity.RoomEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.modelEntity.UserRoomEntity;
import chatToggetther.repository.AudioChannelRepository;
import chatToggetther.repository.MatchIntentRepository;
import chatToggetther.repository.RoomRepository;
import chatToggetther.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

@Service
public class FrequencyMatchService {

    private static final Logger log = LoggerFactory.getLogger(FrequencyMatchService.class);

    // Thời gian sống tối đa của một trạm phát sóng là 15 phút (900,000 ms)
    private static final long STATION_TTL_MS = 15 * 60 * 1000L;

    public static class StationRecord {
        public Long userId;
        public String account;
        public String nickname;
        public String avatar;
        public String bio;
        public String displayNameMasked;
        public Double frequency;
        public String audioUrl;
        public String intentCode;
        public String intentTitle;
        public String genreTag;
        public long broadcastAt;

        public StationRecord(Long userId, String account, String nickname, String avatar, String bio,
                             String displayNameMasked, Double frequency, String audioUrl,
                             String intentCode, String intentTitle, String genreTag) {
            this.userId = userId;
            this.account = account;
            this.nickname = nickname;
            this.avatar = avatar;
            this.bio = bio;
            this.displayNameMasked = displayNameMasked;
            this.frequency = frequency;
            this.audioUrl = audioUrl;
            this.intentCode = intentCode;
            this.intentTitle = intentTitle;
            this.genreTag = genreTag;
            this.broadcastAt = System.currentTimeMillis();
        }
    }

    // In-memory Concurrent registry (UserId -> StationRecord) với cơ chế tự dọn dẹp theo TTL 15 phút
    private static final Map<Long, StationRecord> ACTIVE_STATIONS = new ConcurrentHashMap<>();

    // Khóa nguyên tử để tránh Race Condition khi 2 người cùng bấm Khóa (Lock) 1 trạm sóng
    private final ReentrantLock matchLock = new ReentrantLock();

    private final MatchIntentRepository matchIntentRepository;
    private final AudioChannelRepository audioChannelRepository;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final MediaStorageService mediaStorageService;
    private final SimpMessagingTemplate messagingTemplate;

    public FrequencyMatchService(MatchIntentRepository matchIntentRepository,
                                 AudioChannelRepository audioChannelRepository,
                                 UserRepository userRepository,
                                 RoomRepository roomRepository,
                                 MediaStorageService mediaStorageService,
                                 SimpMessagingTemplate messagingTemplate) {
        this.matchIntentRepository = matchIntentRepository;
        this.audioChannelRepository = audioChannelRepository;
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.mediaStorageService = mediaStorageService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Dọn dẹp định kỳ các trạm sóng đã mở quá 15 phút (mỗi 60 giây chạy 1 lần)
     */
    @Scheduled(fixedRate = 60000)
    public void cleanStaleBroadcasts() {
        long now = System.currentTimeMillis();
        int initialSize = ACTIVE_STATIONS.size();
        ACTIVE_STATIONS.entrySet().removeIf(entry -> (now - entry.getValue().broadcastAt) > STATION_TTL_MS);
        int removed = initialSize - ACTIVE_STATIONS.size();
        if (removed > 0) {
            log.info(">>> Đã tự động thu hồi {} trạm sóng FM hết hạn TTL (15 phút).", removed);
        }
    }

    /**
     * 1. Lấy toàn bộ cấu hình MatchIntent và AudioChannel đang hoạt động (Public / Authenticated)
     */
    public ResponseData<FrequencyConfigResponseDTO> getActiveFrequencyConfig() {
        List<MatchIntentDTO> intents = this.matchIntentRepository.findByIsActiveTrueOrderByDisplayOrderAsc().stream()
                .map(this::mapToIntentDTO)
                .collect(Collectors.toList());

        List<AudioChannelDTO> channels = this.audioChannelRepository.findByIsActiveTrueOrderByIdAsc().stream()
                .map(this::mapToChannelDTO)
                .collect(Collectors.toList());

        FrequencyConfigResponseDTO config = FrequencyConfigResponseDTO.builder()
                .intents(intents)
                .audioChannels(channels)
                .build();

        return new ResponseData<>(200, "Tải cấu hình sóng FM thành công", config);
    }

    /**
     * 2. Bắt đầu phát sóng (Broadcast FM): upload giọng nói, cấp phát tần số riêng, đăng ký trạm
     */
    public ResponseData<BroadcastStationDTO> broadcast(JwtAuthenticationToken token, String intentCode, MultipartFile audioSample) {
        return broadcast(token, intentCode, audioSample, null);
    }

    public ResponseData<BroadcastStationDTO> broadcast(JwtAuthenticationToken token, String intentCode, MultipartFile audioSample, Double customFrequency) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        UserEntity user = this.userRepository.findById(currentUserId).orElseThrow(() ->
                new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại", 404)
        );

        String effectiveIntentCode = intentCode;
        if (effectiveIntentCode == null || effectiveIntentCode.trim().isEmpty()) {
            effectiveIntentCode = user.getMatchIntentCode() != null ? user.getMatchIntentCode() : "NIGHT_OWL";
        }

        MatchIntentEntity intent = this.matchIntentRepository.findByCode(effectiveIntentCode.trim().toUpperCase())
                .orElseGet(() -> this.matchIntentRepository.findAll().stream().findFirst().orElse(null));

        if (intent == null) {
            throw new AppException(404, "Không tìm thấy băng tần phù hợp", 404);
        }

        // 1. Lưu trữ đoạn ghi âm 3-5 giây thông qua MediaStorageService (không lưu Base64 trong RAM)
        String audioUrl = this.mediaStorageService.storeAudioSample(audioSample, currentUserId);

        // 2. Tần số phát sóng: ưu tiên tần số custom hoặc personalFrequency của user
        Double allocatedFrequency;
        if (customFrequency != null) {
            double clamped = Math.max(88.0, Math.min(108.0, customFrequency));
            allocatedFrequency = Math.round(clamped * 10.0) / 10.0;
        } else if (user.getPersonalFrequency() != null) {
            allocatedFrequency = user.getPersonalFrequency();
        } else {
            allocatedFrequency = allocateUniqueFrequency(intent.getFreqStart(), intent.getFreqEnd(), intent.getCode(), currentUserId);
        }

        if (user.getPersonalFrequency() == null || !user.getPersonalFrequency().equals(allocatedFrequency)) {
            user.setPersonalFrequency(allocatedFrequency);
            this.userRepository.save(user);
        }

        // 3. Ẩn danh tên hiển thị để tạo cảm giác bí ẩn cho trạm radio
        String rawName = (user.getNickname() != null && !user.getNickname().isEmpty()) ? user.getNickname() : user.getAccount();
        String maskedName = maskDisplayName(rawName);

        // 4. Lưu trạm vào registry
        StationRecord station = new StationRecord(
                user.getId(),
                user.getAccount(),
                user.getNickname(),
                user.getAvatar(),
                user.getBio(),
                maskedName,
                allocatedFrequency,
                audioUrl,
                intent.getCode(),
                intent.getTitle(),
                intent.getSubtitle() != null ? intent.getSubtitle() : intent.getTitle()
        );

        ACTIVE_STATIONS.put(currentUserId, station);
        log.info(">>> Người dùng #{} đã mở trạm sóng tại tần số {} MHz (Mục đích: {})", currentUserId, allocatedFrequency, intent.getCode());

        BroadcastStationDTO dto = mapToStationDTO(station);
        return new ResponseData<>(200, "Bắt đầu phát sóng thành công!", dto);
    }

    /**
     * 3. Quét sóng FM (Scan): Lọc các trạm phát sóng theo intentCode (loại trừ bản thân và danh sách excludedUserIds)
     */
    public ResponseData<List<BroadcastStationDTO>> scan(JwtAuthenticationToken token, ScanStationRequest request) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        long now = System.currentTimeMillis();
        String targetIntent = request != null && request.getIntentCode() != null ? request.getIntentCode().trim().toUpperCase() : null;
        Set<Long> excluded = new HashSet<>();
        excluded.add(currentUserId);
        if (request != null && request.getExcludedUserIds() != null) {
            excluded.addAll(request.getExcludedUserIds());
        }

        // Lọc các trạm hợp lệ, còn hạn TTL, thuộc intent mong muốn và không nằm trong excluded
        List<BroadcastStationDTO> matchedStations = ACTIVE_STATIONS.values().stream()
                .filter(s -> (now - s.broadcastAt) <= STATION_TTL_MS)
                .filter(s -> !excluded.contains(s.userId))
                .filter(s -> targetIntent == null || s.intentCode.equalsIgnoreCase(targetIntent))
                .sorted(Comparator.comparingDouble(s -> s.frequency))
                .limit(12) // Lấy tối đa 12 trạm sóng
                .map(this::mapToStationDTO)
                .collect(Collectors.toList());

        return new ResponseData<>(200, "Quét sóng hoàn tất", matchedStations);
    }

    /**
     * 4. Khóa sóng & Ghép đôi 1-1 nguyên tử (Atomic Lock): Tạo phòng thoại & bắn WebSocket
     */
    @Transactional
    public ResponseData<Map<String, Object>> lockTarget(JwtAuthenticationToken token, LockTargetRequest request) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        if (request == null || request.getTargetUserId() == null) {
            throw new AppException(400, "targetUserId không được để trống", 400);
        }

        Long targetUserId = request.getTargetUserId();
        if (currentUserId.equals(targetUserId)) {
            throw new AppException(400, "Không thể khóa sóng chính trạm của bạn", 400);
        }

        StationRecord targetStation;
        matchLock.lock();
        try {
            // Kiểm tra tính hợp lệ và lấy trạm sóng mục tiêu một cách nguyên tử
            targetStation = ACTIVE_STATIONS.get(targetUserId);
            if (targetStation == null || (System.currentTimeMillis() - targetStation.broadcastAt) > STATION_TTL_MS) {
                ACTIVE_STATIONS.remove(targetUserId);
                throw new AppException(400, "Trạm phát sóng này đã dừng phát sóng hoặc vừa kết nối với người khác!", 400);
            }

            // Xóa cả hai khỏi danh sách chờ phát sóng để không ai khác có thể quét hoặc khóa trúng
            ACTIVE_STATIONS.remove(targetUserId);
            ACTIVE_STATIONS.remove(currentUserId);
        } finally {
            matchLock.unlock();
        }

        UserEntity userA = this.userRepository.findById(currentUserId).orElseThrow(() ->
                new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng gọi không tồn tại", 404)
        );

        UserEntity userB = this.userRepository.findById(targetUserId).orElseThrow(() ->
                new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng mục tiêu không tồn tại", 404)
        );

        // Tạo phòng thoại 1-1 chuyên biệt trên cơ sở dữ liệu
        RoomEntity room = new RoomEntity();
        room.setActive(true);
        room.setRoomName("FM Đài Sóng " + targetStation.frequency + " MHz");
        room.setDescription("Không gian kết nối âm thanh 1-1 từ trạm sóng FM (" + targetStation.intentTitle + ")");
        room.setAvatar(userB.getAvatar() != null ? userB.getAvatar() : userA.getAvatar());
        room.setLocalDateTime(LocalDateTime.now());

        // Gắn User A (người bấm khóa sóng)
        UserRoomEntity userRoomA = userA.getUserRoomEntity();
        if (userRoomA == null) {
            userRoomA = new UserRoomEntity();
            userRoomA.setUserEntity(userA);
        }
        userRoomA.setRoomEntity(room);
        userRoomA.setActive(true);
        userRoomA.setIsAdmin(true);
        userRoomA.getTimeJoin().add(LocalDateTime.now());
        room.getUserRoomEntityList().add(userRoomA);
        userA.setUserRoomEntity(userRoomA);

        // Gắn User B (người mở sóng đón nhận)
        UserRoomEntity userRoomB = userB.getUserRoomEntity();
        if (userRoomB == null) {
            userRoomB = new UserRoomEntity();
            userRoomB.setUserEntity(userB);
        }
        userRoomB.setRoomEntity(room);
        userRoomB.setActive(true);
        userRoomB.setIsAdmin(false);
        userRoomB.getTimeJoin().add(LocalDateTime.now());
        room.getUserRoomEntityList().add(userRoomB);
        userB.setUserRoomEntity(userRoomB);

        this.roomRepository.saveAndFlush(room);

        String userAName = userA.getNickname() != null && !userA.getNickname().isEmpty() ? userA.getNickname() : userA.getAccount();
        String userBName = userB.getNickname() != null && !userB.getNickname().isEmpty() ? userB.getNickname() : userB.getAccount();

        // Bắn WebSocket thông báo cho targetUserId (User B) để trình duyệt tự chuyển vào phòng
        Map<String, Object> wsPayloadForTarget = Map.of(
                "event", "MATCH_LOCKED",
                "roomId", room.getId(),
                "roomName", room.getRoomName(),
                "frequency", targetStation.frequency,
                "partner", Map.of(
                        "userId", userA.getId(),
                        "account", userA.getAccount(),
                        "nickname", userAName,
                        "avatar", userA.getAvatar() != null ? userA.getAvatar() : ""
                ),
                "isInitiator", false
        );

        try {
            this.messagingTemplate.convertAndSend("/topic/match-locked/" + targetUserId, wsPayloadForTarget);
            this.messagingTemplate.convertAndSend("/topic/rooms", "NEW_ROOM_CREATED");
        } catch (Exception e) {
            log.warn("Lỗi gửi thông báo WebSocket match-locked: {}", e.getMessage());
        }

        // Trả kết quả trực tiếp cho người chủ động bấm khóa (User A)
        Map<String, Object> resultForInitiator = Map.of(
                "matched", true,
                "roomId", room.getId(),
                "roomName", room.getRoomName(),
                "frequency", targetStation.frequency,
                "partner", Map.of(
                        "userId", userB.getId(),
                        "account", userB.getAccount(),
                        "nickname", userBName,
                        "avatar", userB.getAvatar() != null ? userB.getAvatar() : ""
                ),
                "isInitiator", true
        );

        return new ResponseData<>(200, "Đã khóa sóng thành công! Đang chuyển vào phòng trò chuyện...", resultForInitiator);
    }

    /**
     * 5. Dừng phát sóng FM của người dùng hiện tại
     */
    public ResponseData<Boolean> stopBroadcast(JwtAuthenticationToken token) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId != null) {
            ACTIVE_STATIONS.remove(currentUserId);
            log.info(">>> Người dùng #{} đã tắt phát sóng FM.", currentUserId);
        }
        return new ResponseData<>(200, "Đã dừng phát sóng", true);
    }

    /**
     * Thống kê số lượng trạm sóng đang hoạt động theo từng mục đích (cho Admin)
     */
    public Map<String, Object> getLiveBroadcastStats() {
        long now = System.currentTimeMillis();
        Map<String, Long> countByIntent = ACTIVE_STATIONS.values().stream()
                .filter(s -> (now - s.broadcastAt) <= STATION_TTL_MS)
                .collect(Collectors.groupingBy(s -> s.intentCode, Collectors.counting()));

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalLiveBroadcasters", countByIntent.values().stream().mapToLong(Long::longValue).sum());
        stats.put("byIntent", countByIntent);
        stats.put("activePoolSize", ACTIVE_STATIONS.size());
        return stats;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private Double allocateUniqueFrequency(Double start, Double end, String intentCode, Long currentUserId) {
        double min = start != null ? start + 0.3 : 88.5;
        double max = end != null ? end - 0.3 : 92.5;
        if (min >= max) {
            min = start;
            max = end;
        }

        // Lấy tất cả tần số hiện tại trong cùng intentCode (ngoại trừ chính mình nếu đang phát)
        List<Double> occupied = ACTIVE_STATIONS.values().stream()
                .filter(s -> s.intentCode.equalsIgnoreCase(intentCode) && !s.userId.equals(currentUserId))
                .map(s -> s.frequency)
                .collect(Collectors.toList());

        // Thử tìm tần số ngẫu nhiên cách các trạm khác ít nhất 0.8 MHz (thử tối đa 25 lần)
        Random random = new Random();
        for (int i = 0; i < 25; i++) {
            double candidate = min + (random.nextDouble() * (max - min));
            candidate = Math.round(candidate * 10.0) / 10.0; // Làm tròn 1 chữ số thập phân

            boolean farEnough = true;
            for (Double occ : occupied) {
                if (Math.abs(candidate - occ) < 0.8) {
                    farEnough = false;
                    break;
                }
            }
            if (farEnough) {
                return candidate;
            }
        }

        // Nếu dải tần đã đông, chia đều dải tần và lấy điểm cách xa nhất
        double bestFreq = min;
        double maxDist = -1;
        for (double f = min; f <= max; f += 0.2) {
            double currentF = Math.round(f * 10.0) / 10.0;
            double minDist = occupied.stream()
                    .mapToDouble(occ -> Math.abs(currentF - occ))
                    .min()
                    .orElse(100.0);

            if (minDist > maxDist) {
                maxDist = minDist;
                bestFreq = currentF;
            }
        }

        return Math.round(bestFreq * 10.0) / 10.0;
    }

    private String maskDisplayName(String name) {
        if (name == null || name.trim().isEmpty()) return "Thính giả bí ẩn";
        String clean = name.trim();
        if (clean.length() <= 2) {
            return clean.charAt(0) + "***";
        }
        return clean.charAt(0) + "***" + clean.substring(clean.length() - 1);
    }

    private MatchIntentDTO mapToIntentDTO(MatchIntentEntity entity) {
        return MatchIntentDTO.builder()
                .id(entity.getId())
                .code(entity.getCode())
                .title(entity.getTitle())
                .subtitle(entity.getSubtitle())
                .iconName(entity.getIconName())
                .freqStart(entity.getFreqStart())
                .freqEnd(entity.getFreqEnd())
                .isActive(entity.getIsActive())
                .displayOrder(entity.getDisplayOrder())
                .build();
    }

    private AudioChannelDTO mapToChannelDTO(chatToggetther.modelEntity.AudioChannelEntity entity) {
        return AudioChannelDTO.builder()
                .id(entity.getId())
                .name(entity.getName())
                .genreTag(entity.getGenreTag())
                .streamUrl(entity.getStreamUrl())
                .isActive(entity.getIsActive())
                .build();
    }

    private BroadcastStationDTO mapToStationDTO(StationRecord record) {
        return BroadcastStationDTO.builder()
                .userId(record.userId)
                .username(record.account)
                .displayName(record.nickname != null && !record.nickname.isEmpty() ? record.nickname : record.account)
                .avatarUrl(record.avatar)
                .bio(record.bio)
                .displayNameMasked(record.displayNameMasked)
                .frequency(record.frequency)
                .audioUrl(record.audioUrl)
                .intentCode(record.intentCode)
                .intentTitle(record.intentTitle)
                .genreTag(record.genreTag)
                .broadcastAt(record.broadcastAt)
                .build();
    }

    /**
     * Lấy toàn bộ trạm phát sóng đang hoạt động (loại trừ chính mình nếu đang login)
     */
    public ResponseData<List<BroadcastStationDTO>> getAllActiveStations(JwtAuthenticationToken token) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        long now = System.currentTimeMillis();
        List<BroadcastStationDTO> list = ACTIVE_STATIONS.values().stream()
                .filter(s -> (now - s.broadcastAt) <= STATION_TTL_MS)
                .filter(s -> currentUserId == null || !s.userId.equals(currentUserId))
                .sorted(Comparator.comparingDouble(s -> s.frequency))
                .map(this::mapToStationDTO)
                .collect(Collectors.toList());
        return new ResponseData<>(200, "Danh sách trạm phát sóng trực tuyến", list);
    }
}
