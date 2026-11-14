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
    // Nâng ngưỡng rộng rãi để người dùng đăng nhập / đăng ký / thao tác không bao giờ bị nghẽn oan
    private static final int LIMIT_AUTH = 120;        // Login, Register (POST /auth/login, POST /users/create)
    private static final int LIMIT_POST_CREATE = 60;  // Tạo bài viết mới (chống spam feed)
    private static final int LIMIT_COMMENT = 120;     // Bình luận
    private static final int LIMIT_GENERAL = 1200;    // Các API đọc thông thường (feed, rooms, notifications, music,...)

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
        EndpointPolicy policy = resolvePolicy(uri, method);

        // Khóa định danh độc lập theo cả IP và Phân loại API (IP:CATEGORY)
        // Đảm bảo lượt đọc feed/rooms/notifications KHÔNG bao giờ làm cạn kiệt lượt đăng nhập của người dùng
        String trackerKey = clientIp + ":" + policy.category;

        // Chống tràn RAM nếu có kẻ tấn công dùng hàng chục ngàn IP spoofed
        if (clientTrackers.size() > MAX_TRACKED_IPS && !clientTrackers.containsKey(trackerKey)) {
            evictExpiredTrackers();
            if (clientTrackers.size() > MAX_TRACKED_IPS) {
                // Tạm thời bảo vệ bộ nhớ nếu lượng IP giả lập quá tải
                sendRateLimitResponse(request, response, "Hệ thống đang chịu tải cao, vui lòng thử lại sau giây lát.");
                return;
            }
        }

        long now = System.currentTimeMillis();
        ClientWindow window = clientTrackers.compute(trackerKey, (key, existing) -> {
            if (existing == null || (now - existing.windowStartTime) > WINDOW_DURATION_MILLIS) {
                return new ClientWindow(now, 1);
            }
            existing.requestCount.incrementAndGet();
            existing.lastAccessTime = now;
            return existing;
        });

        // Kiểm tra xem đã vượt ngưỡng cho phép chưa
        if (window.requestCount.get() > policy.limit) {
            long retryAfterSec = Math.max(1, (WINDOW_DURATION_MILLIS - (now - window.windowStartTime)) / 1000);
            response.setHeader("Retry-After", String.valueOf(retryAfterSec));
            response.setHeader("X-RateLimit-Limit", String.valueOf(policy.limit));
            response.setHeader("X-RateLimit-Remaining", "0");
            
            log.warn("Rate limit exceeded for IP [{}] on category [{}] - URI [{}] - Count: {}/{}", clientIp, policy.category, uri, window.requestCount.get(), policy.limit);
            sendRateLimitResponse(request, response, "Bạn đang gửi yêu cầu quá nhanh. Vui lòng đợi " + retryAfterSec + " giây trước khi tiếp tục.");
            return;
        }

        // Đính kèm headers thông tin lượt dùng còn lại
        response.setHeader("X-RateLimit-Limit", String.valueOf(policy.limit));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, policy.limit - window.requestCount.get())));

        filterChain.doFilter(request, response);
    }

    /**
     * Xác định chính sách giới hạn độc lập cho từng nhóm endpoint
     */
    private EndpointPolicy resolvePolicy(String uri, String method) {
        // Chỉ áp dụng giới hạn chặt chẽ cho thao tác ĐĂNG NHẬP / ĐĂNG KÝ (POST) để chống dò mật khẩu
        if (("POST".equalsIgnoreCase(method)) && 
            (uri.contains("/auth/login") || uri.contains("/users/create") || uri.contains("/auth/register"))) {
            return new EndpointPolicy("AUTH", LIMIT_AUTH);
        }
        if (uri.contains("/api/posts") && "POST".equalsIgnoreCase(method)) {
            return new EndpointPolicy("POST_CREATE", LIMIT_POST_CREATE);
        }
        if ((uri.contains("/comments") || uri.contains("/comment")) && "POST".equalsIgnoreCase(method)) {
            return new EndpointPolicy("COMMENT", LIMIT_COMMENT);
        }
        return new EndpointPolicy("GENERAL", LIMIT_GENERAL);
    }

    private static class EndpointPolicy {
        final String category;
        final int limit;

        EndpointPolicy(String category, int limit) {
            this.category = category;
            this.limit = limit;
        }
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

    private void sendRateLimitResponse(HttpServletRequest request, HttpServletResponse response, String message) throws IOException {
        String origin = request.getHeader("Origin");
        if (origin != null && !origin.isEmpty()) {
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Access-Control-Allow-Credentials", "true");
            response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
            response.setHeader("Access-Control-Allow-Headers", "*");
        }

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

