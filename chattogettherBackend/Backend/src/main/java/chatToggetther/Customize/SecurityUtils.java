package chatToggetther.Customize;

import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.UserRepository;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.regex.Pattern;

public class SecurityUtils {

    private static final Pattern SQL_INJECTION_PATTERN = Pattern.compile(
        "(?i)(\\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|DECLARE|XP_)\\b|--|\\/\\*|\\*\\/|;|\\bOR\\b\\s+['\"\\d\\w]+\\s*=\\s*['\"\\d\\w]+|<script)"
    );

    /**
     * Kiểm tra chống tấn công SQL Injection và Script Injection.
     */
    public static boolean containsSqlInjection(String input) {
        if (input == null || input.trim().isEmpty()) return false;
        return SQL_INJECTION_PATTERN.matcher(input.trim()).find();
    }

    /**
     * Xác thực chuỗi an toàn: độ dài và không chứa ký tự/từ khóa injection.
     */
    public static void validateSafeInput(String input, String fieldName, int minLen, int maxLen) {
        if (input == null || input.trim().isEmpty()) {
            if (minLen > 0) throw new AppException(400, fieldName + " không được để trống", 400);
            return;
        }
        String trimmed = input.trim();
        if (trimmed.length() < minLen || trimmed.length() > maxLen) {
            throw new AppException(400, fieldName + " phải từ " + minLen + " đến " + maxLen + " ký tự", 400);
        }
        if (containsSqlInjection(trimmed)) {
            throw new AppException(400, fieldName + " chứa ký tự hoặc từ khóa không an toàn (phòng chống SQL injection)", 400);
        }
    }

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
