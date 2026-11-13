package chatToggetther.Customize;

import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.UserRepository;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

public class SecurityUtils {

    /**
     * Trích xuất user_id từ JWT an toàn, hỗ trợ Number, String, Integer, Long.
     */
    public static Long extractUserId(JwtAuthenticationToken token) {
        if (token == null || token.getToken() == null) {
            return null;
        }
        Object claim = token.getToken().getClaim("user_id");
        if (claim instanceof Number) {
            return ((Number) claim).longValue();
        }
        if (claim != null) {
            try {
                return Long.parseLong(claim.toString().trim());
            } catch (Exception ignored) {}
        }
        return null;
    }

    /**
     * Tìm UserEntity của người dùng đang đăng nhập:
     * 1. Tìm theo claim user_id
     * 2. Nếu không thấy, fallback tìm theo subject (account username)
     */
    public static UserEntity getAuthenticatedUser(JwtAuthenticationToken token, UserRepository userRepository) {
        if (token == null || token.getToken() == null || userRepository == null) {
            return null;
        }
        Long userId = extractUserId(token);
        if (userId != null) {
            UserEntity u = userRepository.findById(userId).orElse(null);
            if (u != null) return u;
        }
        String subject = token.getToken().getSubject();
        if (subject != null && !subject.trim().isEmpty()) {
            return userRepository.findByAccount(subject.trim()).orElse(null);
        }
        return null;
    }
}
