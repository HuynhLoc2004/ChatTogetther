package chatToggetther.Customize;

import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

public class SecurityUtils {

    /**
     * Trích xuất user_id từ JWT một cách an toàn, tránh hoàn toàn lỗi ClassCastException
     * khi NimbusJwtDecoder phân giải số nguyên thành java.lang.Integer thay vì java.lang.Long.
     */
    public static Long extractUserId(JwtAuthenticationToken token) {
        if (token == null || token.getToken() == null) {
            return null;
        }
        Object claim = token.getToken().getClaim("user_id");
        if (claim == null) {
            return null;
        }
        if (claim instanceof Number) {
            return ((Number) claim).longValue();
        }
        try {
            return Long.parseLong(claim.toString().trim());
        } catch (Exception e) {
            return null;
        }
    }
}

