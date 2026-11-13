package chatToggetther.configuration;

import chatToggetther.repository.RevokeTokenRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Tác vụ định kỳ bảo trì & dọn dẹp dữ liệu rác, bộ nhớ đệm:
 * - Xóa các Token đã hết hạn trong danh sách đen (Blacklist).
 * - Đảm bảo Database và RAM không bị phình to theo thời gian.
 */
@Component
@Slf4j
public class SecurityDataCleanupScheduler {

    private final RevokeTokenRepository revokeTokenRepository;

    public SecurityDataCleanupScheduler(RevokeTokenRepository revokeTokenRepository) {
        this.revokeTokenRepository = revokeTokenRepository;
    }

    /**
     * Chạy mỗi ngày một lần vào lúc 03:00 sáng.
     * Xóa toàn bộ token thu hồi đã tạo quá 7 ngày (vì refresh token tối đa 7 ngày).
     */
    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional
    public void cleanupExpiredRevokedTokens() {
        try {
            LocalDateTime threshold = LocalDateTime.now().minusDays(7);
            int deletedCount = revokeTokenRepository.deleteExpiredRevokeTokens(threshold);
            if (deletedCount > 0) {
                log.info(">>> Security Maintenance: Đã xóa {} token thu hồi hết hạn (>7 ngày).", deletedCount);
            }
        } catch (Exception e) {
            log.error(">>> Lỗi khi dọn dẹp token thu hồi: {}", e.getMessage());
        }
    }
}

