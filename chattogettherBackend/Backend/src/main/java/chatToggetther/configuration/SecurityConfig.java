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
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/users/create", "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/rooms/info-rooms", "/api/auth/refresh_token").permitAll()
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
    public UrlBasedCorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList("http://localhost:5173"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
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
