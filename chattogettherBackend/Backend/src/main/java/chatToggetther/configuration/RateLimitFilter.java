package chatToggetther.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Bộ lọc bảo mật Giới hạn Tần suất (Rate Limiter) chống Spam, Brute-force & DDoS.
 * - Hoạt động độc lập, không tốn thêm tài nguyên Redis/NoSQL.
 * - Có cơ chế LRU & Auto-eviction để CHỐNG TRÀN RAM (Out Of Memory) ngay cả khi bị spam triệu IP ảo.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    // Giới hạn số lượng IP tối đa lưu trong RAM cùng lúc để tuyệt đối không tràn RAM
    private static final int MAX_TRACKED_IPS = 30000;

    // Bộ nhớ đệm lưu trữ số lượt gọi của từng IP
    private final ConcurrentHashMap<String, ClientWindow> clientTrackers = new ConcurrentHashMap<>();

    private final ObjectMapper objectMapper = new ObjectMapper();

    // Cấu hình số lượt cho phép theo từng loại API (số request / 60 giây)
    private static final int LIMIT_AUTH = 12;         // Login, Register (chống dò mật khẩu)
    private static final int LIMIT_POST_CREATE = 20;  // Tạo bài viết (chống spam feed)
    private static final int LIMIT_COMMENT = 40;      // Bình luận
    private static final int LIMIT_GENERAL = 200;     // Các API đọc thông thường

    private static final long WINDOW_DURATION_MILLIS = 60000L; // Cửa sổ 1 phút

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // Bỏ qua các yêu cầu OPTIONS (CORS Preflight) và WebSocket handshake
        String method = request.getMethod();
        String uri = request.getRequestURI();
        if ("OPTIONS".equalsIgnoreCase(method) || uri.startsWith("/ws-gs-guide")) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);
        int maxAllowed = getLimitForUri(uri, method);

        // Chống tràn RAM nếu có kẻ tấn công dùng hàng chục ngàn IP spoofed
        if (clientTrackers.size() > MAX_TRACKED_IPS && !clientTrackers.containsKey(clientIp)) {
            evictExpiredTrackers();
            if (clientTrackers.size() > MAX_TRACKED_IPS) {
                // Tạm thời bảo vệ bộ nhớ nếu lượng IP giả lập quá tải
                sendRateLimitResponse(response, "Hệ thống đang chịu tải cao, vui lòng thử lại sau giây lát.");
                return;
            }
        }

        long now = System.currentTimeMillis();
        ClientWindow window = clientTrackers.compute(clientIp, (key, existing) -> {
            if (existing == null || (now - existing.windowStartTime) > WINDOW_DURATION_MILLIS) {
                return new ClientWindow(now, 1);
            }
            existing.requestCount.incrementAndGet();
            existing.lastAccessTime = now;
            return existing;
        });

        // Kiểm tra xem đã vượt ngưỡng cho phép chưa
        if (window.requestCount.get() > maxAllowed) {
            long retryAfterSec = Math.max(1, (WINDOW_DURATION_MILLIS - (now - window.windowStartTime)) / 1000);
            response.setHeader("Retry-After", String.valueOf(retryAfterSec));
            response.setHeader("X-RateLimit-Limit", String.valueOf(maxAllowed));
            response.setHeader("X-RateLimit-Remaining", "0");
            
            log.warn("Rate limit exceeded for IP [{}] on [{}] - Count: {}/{}", clientIp, uri, window.requestCount.get(), maxAllowed);
            sendRateLimitResponse(response, "Bạn đang gửi yêu cầu quá nhanh. Vui lòng đợi " + retryAfterSec + " giây trước khi tiếp tục.");
            return;
        }

        // Đính kèm headers thông tin lượt dùng còn lại
        response.setHeader("X-RateLimit-Limit", String.valueOf(maxAllowed));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, maxAllowed - window.requestCount.get())));

        filterChain.doFilter(request, response);
    }

    /**
     * Xác định giới hạn tối đa tùy theo endpoint và method
     */
    private int getLimitForUri(String uri, String method) {
        if (uri.contains("/api/auth/login") || uri.contains("/api/users/create")) {
            return LIMIT_AUTH;
        }
        if (uri.contains("/api/posts") && "POST".equalsIgnoreCase(method)) {
            return LIMIT_POST_CREATE;
        }
        if (uri.contains("/comments") && "POST".equalsIgnoreCase(method)) {
            return LIMIT_COMMENT;
        }
        return LIMIT_GENERAL;
    }

    /**
     * Lấy IP thật của người dùng (hỗ trợ qua Cloudflare, Nginx, Load Balancer)
     */
    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("CF-Connecting-IP"); // Cloudflare
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Forwarded-For");
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                // X-Forwarded-For có thể chứa nhiều IP cách nhau bằng dấu phẩy, lấy IP đầu tiên (client thật)
                ip = ip.split(",")[0].trim();
            }
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return (ip != null) ? ip : "127.0.0.1";
    }

    private void sendRateLimitResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        Map<String, Object> body = new HashMap<>();
        body.put("code", 429);
        body.put("statusCode", 429);
        body.put("message", message);
        body.put("time", Instant.now().toString());

        response.getWriter().write(objectMapper.writeValueAsString(body));
    }

    /**
     * Định kỳ dọn dẹp các IP đã hết hạn để giải phóng bộ nhớ RAM
     * Chạy tự động mỗi 2 phút (120000ms)
     */
    @Scheduled(fixedRate = 120000)
    public void evictExpiredTrackers() {
        long now = System.currentTimeMillis();
        int initialSize = clientTrackers.size();
        
        clientTrackers.entrySet().removeIf(entry -> {
            ClientWindow window = entry.getValue();
            // Xóa những client không hoạt động quá 2 phút
            return (now - window.lastAccessTime) > (WINDOW_DURATION_MILLIS * 2);
        });
        
        int cleaned = initialSize - clientTrackers.size();
        if (cleaned > 0) {
            log.debug("RateLimit Cache Eviction: Đã dọn dẹp {} IP hết hạn. Còn lại {} IP trong bộ nhớ.", cleaned, clientTrackers.size());
        }
    }

    /**
     * Lớp lưu trữ thông tin cửa sổ thời gian của Client
     */
    private static class ClientWindow {
        final long windowStartTime;
        final AtomicInteger requestCount;
        volatile long lastAccessTime;

        ClientWindow(long startTime, int initialCount) {
            this.windowStartTime = startTime;
            this.requestCount = new AtomicInteger(initialCount);
            this.lastAccessTime = startTime;
        }
    }
}

