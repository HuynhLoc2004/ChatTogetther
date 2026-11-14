package chatToggetther.controller;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/matchmaking")
public class MatchmakingController {

    private final UserRepository userRepository;

    public static class QueueEntry {
        public Long userId;
        public String account;
        public String nickname;
        public String avatar;
        public String intent;
        public long joinedAt;

        public QueueEntry(Long userId, String account, String nickname, String avatar, String intent) {
            this.userId = userId;
            this.account = account;
            this.nickname = nickname;
            this.avatar = avatar;
            this.intent = intent;
            this.joinedAt = System.currentTimeMillis();
        }
    }

    // In-memory concurrent matchmaking queue (userId -> QueueEntry)
    private static final Map<Long, QueueEntry> QUEUE = new ConcurrentHashMap<>();

    // Map storing completed match results (userId -> PartnerInfo)
    private static final Map<Long, Map<String, Object>> MATCH_RESULTS = new ConcurrentHashMap<>();

    public MatchmakingController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    private void cleanStaleEntries() {
        long now = System.currentTimeMillis();
        QUEUE.entrySet().removeIf(entry -> (now - entry.getValue().joinedAt) > 45000);
    }

    @PostMapping("/join")
    public ResponseEntity<ResponseData<Map<String, Object>>> joinMatchmaking(
            JwtAuthenticationToken token,
            @RequestBody(required = false) Map<String, String> request
    ) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        cleanStaleEntries();

        // Check if an existing match was already formed for this user
        if (MATCH_RESULTS.containsKey(currentUserId)) {
            Map<String, Object> result = MATCH_RESULTS.remove(currentUserId);
            return ResponseEntity.ok(new ResponseData<>(200, "Ghép đôi thành công!", result));
        }

        UserEntity user = this.userRepository.findById(currentUserId).orElseThrow(() ->
                new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "Người dùng không tồn tại", 404)
        );

        String intent = (request != null && request.get("intent") != null) ? request.get("intent") : "any";

        // Look for another waiting user in the queue
        QueueEntry matchedCandidate = null;
        for (Map.Entry<Long, QueueEntry> entry : QUEUE.entrySet()) {
            if (!entry.getKey().equals(currentUserId)) {
                matchedCandidate = entry.getValue();
                QUEUE.remove(entry.getKey());
                break;
            }
        }

        if (matchedCandidate != null) {
            // Remove self from queue if present
            QUEUE.remove(currentUserId);

            // Create match payload for candidate
            Map<String, Object> partnerForMe = Map.of(
                    "matched", true,
                    "partner", Map.of(
                            "userId", matchedCandidate.userId,
                            "account", matchedCandidate.account,
                            "nickname", matchedCandidate.nickname,
                            "avatar", matchedCandidate.avatar != null ? matchedCandidate.avatar : "",
                            "intent", matchedCandidate.intent
                    )
            );

            // Store result for the candidate so when they poll or check, they get the match
            MATCH_RESULTS.put(matchedCandidate.userId, Map.of(
                    "matched", true,
                    "partner", Map.of(
                            "userId", user.getId(),
                            "account", user.getAccount(),
                            "nickname", user.getNickname() != null ? user.getNickname() : user.getAccount(),
                            "avatar", user.getAvatar() != null ? user.getAvatar() : "",
                            "intent", intent
                    )
            ));

            return ResponseEntity.ok(new ResponseData<>(200, "Đã tìm thấy người dùng đồng điệu!", partnerForMe));
        } else {
            // Put current user in queue
            String nick = user.getNickname() != null && !user.getNickname().isEmpty() ? user.getNickname() : user.getAccount();
            QUEUE.put(currentUserId, new QueueEntry(user.getId(), user.getAccount(), nick, user.getAvatar(), intent));

            return ResponseEntity.ok(new ResponseData<>(200, "Đang trong hàng đợi tìm kiếm đồng điệu", Map.of(
                    "matched", false,
                    "queueSize", QUEUE.size(),
                    "message", "Chưa có người dùng nào khác đang tìm kiếm cùng lúc."
            )));
        }
    }

    @PostMapping("/leave")
    public ResponseEntity<ResponseData<Boolean>> leaveMatchmaking(JwtAuthenticationToken token) {
        Long currentUserId = SecurityUtils.extractUserId(token);
        if (currentUserId != null) {
            QUEUE.remove(currentUserId);
            MATCH_RESULTS.remove(currentUserId);
        }
        return ResponseEntity.ok(new ResponseData<>(200, "Đã rời hàng đợi", true));
    }
}

