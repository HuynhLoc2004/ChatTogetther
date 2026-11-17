package chatToggetther.configuration;

import chatToggetther.Customize.AppException;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.repository.RevokeTokenRepository;
import jakarta.servlet.http.Cookie;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import javax.crypto.spec.SecretKeySpec;
import java.util.Arrays;

@Configuration
@EnableWebSecurity
@org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
public class SecurityConfig {
    @Value("${jwt.secret_key}")
    private String secretKey;

    @Value("${allowed.origins:${ALLOWED_ORIGINS:${CORS_ORIGINS:}}}")
    private String allowedOrigins;

    private final RevokeTokenRepository revokeTokenRepository;

    public SecurityConfig(RevokeTokenRepository revokeTokenRepository) {
        this.revokeTokenRepository = revokeTokenRepository;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity httpSecurity , JwtAuthenticationConverter authenticationConverter) throws Exception {
        httpSecurity
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny()) // Chống Clickjacking
                        .contentTypeOptions(contentType -> {}) // Chống MIME-type sniffing
                        .xssProtection(xss -> xss.headerValue(org.springframework.security.web.header.writers.XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31536000))
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, 
                                "/api/users/create", "/users/create",
                                "/api/auth/**", "/auth/**",
                                "/api/challenges", "/challenges",
                                "/api/posts/track-search", "/posts/track-search",
                                "/api/public/**", "/public/**",
                                "/api/presence/**", "/presence/**",
                                "/api/call/**", "/call/**"
                        ).permitAll()
                        .requestMatchers(HttpMethod.GET, 
                                "/api/rooms/info-rooms", "/rooms/info-rooms",
                                "/api/rooms/my-active-room", "/rooms/my-active-room",
                                "/api/rooms/active", "/rooms/active",
                                "/api/rooms/*/online-users", "/rooms/*/online-users",
                                "/api/groups", "/groups", "/api/groups/**", "/groups/**",
                                "/api/communities", "/communities", "/api/communities/**", "/communities/**",
                                "/api/auth/refresh_token", "/auth/refresh_token",
                                "/api/ping", "/ping",
                                "/api/posts", "/posts", "/api/posts/**", "/posts/**",
                                "/api/tracks", "/tracks", "/api/tracks/**", "/tracks/**",
                                "/api/challenges", "/challenges", "/api/challenges/**", "/challenges/**",
                                "/api/system/**", "/system/**",
                                "/api/match/config", "/match/config",
                                "/api/match/stations", "/match/stations",
                                "/api/match/audio/**", "/match/audio/**",
                                "/api/public/**", "/public/**",
                                "/api/notifications", "/notifications", "/api/notifications/**", "/notifications/**",
                                "/api/users/online-ids", "/users/online-ids",
                                "/public/online-users", "/api/public/online-users",
                                "/api/presence/**", "/presence/**",
                                "/api/message/files/**", "/message/files/**",
                                "/api/messages/files/**", "/messages/files/**"
                        ).permitAll()
                        .requestMatchers("/ws-gs-guide", "/ws-gs-guide/**", "/ws", "/ws/**", "/ws-native", "/ws-native/**", "/ws-sockjs", "/ws-sockjs/**").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .bearerTokenResolver(this.bearerTokenResolver())
                        .jwt(jwt -> jwt
                                .decoder(this.jwtDecoder())
                                .jwtAuthenticationConverter(authenticationConverter)
                        )
                );

        return httpSecurity.build();
    }

    @Bean
    public org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // Đọc danh sách domain từ ALLOWED_ORIGINS hoặc CORS_ORIGINS
        String envCors = (allowedOrigins != null && !allowedOrigins.trim().isEmpty())
                ? allowedOrigins
                : System.getenv("ALLOWED_ORIGINS");
        if (envCors == null || envCors.trim().isEmpty()) {
            envCors = System.getenv("CORS_ORIGINS");
        }

        if (envCors != null && !envCors.trim().isEmpty() && !envCors.trim().equals("*")) {
            java.util.List<String> origins = Arrays.stream(envCors.split("[,;]"))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList();
            configuration.setAllowedOriginPatterns(origins);
        } else {
            // Cho phép các domain development và production chính thống (Vercel, Localhost, Klyvix, DuckDNS)
            configuration.setAllowedOriginPatterns(Arrays.asList(
                    "http://localhost:5173",
                    "http://localhost:3000",
                    "https://*.vercel.app",
                    "https://*.klyvix.space",
                    "https://chat-togetther.vercel.app",
                    "https://talovin.duckdns.org"
            ));
        }

        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setExposedHeaders(Arrays.asList("Authorization", "Set-Cookie", "x-refresh-token"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public BearerTokenResolver bearerTokenResolver() {
        return request -> {
            String path = request.getRequestURI();
            if (path != null && (
                    path.contains("/auth/login") ||
                    path.contains("/auth/register") ||
                    path.contains("/users/create") ||
                    path.contains("/ping")
            )) {
                return null;
            }

            DefaultBearerTokenResolver defaultResolver = new DefaultBearerTokenResolver();
            String token = defaultResolver.resolve(request);

            if (token == null && request.getCookies() != null) {
                for (Cookie cookie : request.getCookies()) {
                    if ("access_token".equals(cookie.getName())) {
                        return cookie.getValue();
                    }
                }
            }
            return token;
        };
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        return token -> {
            revokeTokenRepository.findRevokeTokenByRefresh(token)
                    .ifPresent(entity -> {
                        throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Token này đã bị đăng xuất!" , ErrorCode.UNAUTHENTICATED.getStatusCode().value());
                    });

            try {
                String secretKey = this.secretKey;
                SecretKeySpec secretKeySpec = new SecretKeySpec(secretKey.getBytes(), "HmacSHA256");
                NimbusJwtDecoder nimbusDecoder = NimbusJwtDecoder.withSecretKey(secretKeySpec).build();
                return nimbusDecoder.decode(token);
            } catch (Exception e) {
                throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Token không hợp lệ hoặc đã hết hạn!" ,ErrorCode.UNAUTHENTICATED.getStatusCode().value());
            }
        };
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter(){
        JwtGrantedAuthoritiesConverter jwtGrantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
        jwtGrantedAuthoritiesConverter.setAuthoritiesClaimName("scope");
        jwtGrantedAuthoritiesConverter.setAuthorityPrefix("");
        JwtAuthenticationConverter authenticationConverter = new JwtAuthenticationConverter();
        authenticationConverter.setJwtGrantedAuthoritiesConverter(jwtGrantedAuthoritiesConverter);
        return authenticationConverter;
    }
}
