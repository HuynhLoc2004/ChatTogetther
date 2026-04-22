package chatToggetther.configuration;

import chatToggetther.Customize.AppException;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.RevokeTokenEntity;
import chatToggetther.repository.RevokeTokenRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.GrantedAuthoritiesContainer;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import javax.crypto.spec.SecretKeySpec;
import java.util.Arrays;

@Configuration
@EnableWebSecurity
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
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/users/create").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.GET , "/api/rooms/info-rooms").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(httpSecurityOAuth2ResourceServerConfigurer ->
                        httpSecurityOAuth2ResourceServerConfigurer.bearerTokenResolver(this.bearerTokenResolver())
                                .jwt(jwt->jwt.decoder(this.jwtDecoder())
                                        .jwtAuthenticationConverter(authenticationConverter)
                                )

                    );

        return httpSecurity.build();
    }

    @Bean
    public UrlBasedCorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList("http://localhost:5173"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
    @Bean
    public BearerTokenResolver bearerTokenResolver() {
        return request -> {
            // Bước A: Thử lấy từ Header chuẩn (Authorization: Bearer <token>)
            DefaultBearerTokenResolver defaultResolver = new DefaultBearerTokenResolver();
            String token = defaultResolver.resolve(request);

            // Bước B: Nếu Header không có (token == null), ta mới lục trong Cookies
            if (token == null && request.getCookies() != null) {
                for (Cookie cookie : request.getCookies()) {
                    // "access_token" là cái tên bạn đặt khi tạo cookie lúc Login
                    if ("access_token".equals(cookie.getName())) {
                        return cookie.getValue();
                    }
                }
            }

            // Trả về token (hoặc null nếu cả 2 nơi đều không có)
            return token;
        };
    }
    @Bean
    public JwtDecoder jwtDecoder() {
        // Dùng Lambda: token đại diện cho chuỗi String mà BearerTokenResolver vừa trả về
        return token -> {
            // 1. Kiểm tra Blacklist trong DB trước
            revokeTokenRepository.findRevokeTokenByRefresh(token)
                    .ifPresent(entity -> {
                        throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Token này đã bị đăng xuất!" , ErrorCode.UNAUTHENTICATED.getStatusCode().value());
                    });

            // 2. Giải mã và kiểm tra logic (Signature, Expiry)
            try {
                String secretKey = this.secretKey;
                SecretKeySpec secretKeySpec = new SecretKeySpec(secretKey.getBytes(), "HmacSHA256");

                // Vẫn dùng Nimbus để lo phần lõi giải mã
                NimbusJwtDecoder nimbusDecoder = NimbusJwtDecoder.withSecretKey(secretKeySpec).build();

                // Trả về đối tượng Jwt sau khi nimbus đã check 'exp' và signature
                return nimbusDecoder.decode(token);

            } catch (AppException e) {
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
