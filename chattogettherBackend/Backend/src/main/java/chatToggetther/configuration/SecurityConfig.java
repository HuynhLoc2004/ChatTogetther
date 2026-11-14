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
                        .requestMatchers(HttpMethod.POST, "/api/users/create", "/api/auth/login", "/api/challenges", "/api/posts/track-search").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/rooms/info-rooms", "/api/rooms/*/online-users", "/api/groups", "/api/groups/**", "/api/communities", "/api/communities/**", "/api/auth/refresh_token", "/api/ping", "/api/posts", "/api/posts/**", "/api/tracks", "/api/tracks/**", "/api/challenges", "/api/challenges/**", "/api/system/**", "/api/match/config", "/api/match/audio/**", "/api/public/**").permitAll()
                        .requestMatchers("/ws-gs-guide/**").permitAll()
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
        
        // Hỗ trợ biến môi trường CORS_ORIGINS trên Render
        String envCors = System.getenv("CORS_ORIGINS");
        if (envCors != null && !envCors.trim().isEmpty() && !envCors.trim().equals("*")) {
            java.util.List<String> origins = Arrays.stream(envCors.split(","))
                    .map(String::trim)
                    .toList();
            configuration.setAllowedOriginPatterns(origins);
        } else {
            // Cho phép các domain development và production chính thống (Vercel, Localhost, Klyvix)
            configuration.setAllowedOriginPatterns(Arrays.asList(
                    "http://localhost:5173",
                    "http://localhost:3000",
                    "https://*.vercel.app",
                    "https://*.klyvix.space",
                    "https://chat-togetther.vercel.app"
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
