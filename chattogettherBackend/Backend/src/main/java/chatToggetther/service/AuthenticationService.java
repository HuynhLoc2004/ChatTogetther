package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.DataRequest.UserRequest;
import chatToggetther.DataRequest.UserloginRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.RevokeTokenEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.RevokeTokenRepository;
import chatToggetther.repository.UserRepository;
import com.nimbusds.jose.Algorithm;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.LongSummaryStatistics;

@Service
public class AuthenticationService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);
    private final RevokeTokenRepository revokeTokenRepository;
    @Value("${jwt.secret_key}")
    private String secretKey;
    @Value("${jwt.exp_access}")
    private int expAcctoken;
    @Value("${jwt.exp_refresh}")
    private int expRefresh;
    public AuthenticationService(UserRepository userRepository, RevokeTokenRepository revokeTokenRepository) {
        this.userRepository = userRepository;
        this.revokeTokenRepository = revokeTokenRepository;
    }

    public ResponseData<chatToggetther.DTO.LoginResponseDTO> userLogin(UserloginRequest userloginRequest , HttpServletResponse httpServletResponse){
            UserEntity userEntity = this.userRepository.findByAccount(userloginRequest.getAccount()).orElseThrow(()->{
                throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode() , "tài khoản hoặc mật khẩu không hợp lệ" , ErrorCode.USER_NOT_EXISTED.getStatusCode().value());
            });
            if(this.passwordEncoder.matches(userloginRequest.getPassword() , userEntity.getPassword())){
                String accessToken = this.genAccessToken(userEntity);
                this.genRefreshToken(userEntity ,httpServletResponse);
                
                Long roomId = null;
                if (userEntity.getUserRoomEntity() != null && userEntity.getUserRoomEntity().getActive() && userEntity.getUserRoomEntity().getRoomEntity() != null) {
                    roomId = userEntity.getUserRoomEntity().getRoomEntity().getId();
                }
                
                chatToggetther.DTO.LoginResponseDTO loginResponseDTO = new chatToggetther.DTO.LoginResponseDTO(accessToken, roomId);
                return new ResponseData<>(200 , "login thành công" , loginResponseDTO);

            }else{
                throw new AppException(ErrorCode.LOGIN_FAILED.getCode(), "tài khoản hoặc mật khẩu không đúng" , ErrorCode.LOGIN_FAILED.getStatusCode().value());
            }

    }
    public String genAccessToken(UserEntity userEntity){
        SecretKey key = Keys.hmacShaKeyFor(this.secretKey.getBytes(StandardCharsets.UTF_8));

        List<String> authorites = new ArrayList<>();
         userEntity.getRoles().forEach(r -> authorites.add(r));
         userEntity.getPermissions().forEach(p -> authorites.add(p));
         String scope = String.join(" " , authorites);
        return Jwts.builder()
                .issuer("jwt-chattogetther")
                .subject(userEntity.getAccount())
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plus(expAcctoken , ChronoUnit.MINUTES)))
                .claim("scope" , scope)
                .claim("user_id" , userEntity.getId())
                .signWith(key)
                .compact();
    }
    public void genRefreshToken(UserEntity userEntity , HttpServletResponse httpServletResponse){
        SecretKey key = Keys.hmacShaKeyFor(this.secretKey.getBytes(StandardCharsets.UTF_8));

        List<String> authorites = new ArrayList<>();
        userEntity.getRoles().forEach(r -> authorites.add(r));
        userEntity.getPermissions().forEach(p -> authorites.add(p));
        String scope = String.join(" " , authorites);
       String refreshToken =  Jwts.builder()
                .issuer("jwt-chattogetther")
                .subject(userEntity.getAccount())
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plus(expRefresh , ChronoUnit.MINUTES)))
                .claim("scope" , scope)
                .claim("user_id" , userEntity.getId())
                .signWith(key)
                .compact();
        Cookie cookie = new Cookie("refreshToken" , refreshToken);
        cookie.setMaxAge(expRefresh * 60);
        cookie.setSecure(false);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        httpServletResponse.addCookie(cookie);

    }

    public ResponseData<String> refreshToken(String refreshToken , HttpServletResponse httpServletResponse){
        SecretKey key = Keys.hmacShaKeyFor(this.secretKey.getBytes(StandardCharsets.UTF_8));
        try {
            var claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(refreshToken)
                    .getPayload();

            this.revokeTokenRepository.findRevokeTokenByRefresh(refreshToken).ifPresent(r -> {
                throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Token đã bị thu hồi", ErrorCode.UNAUTHENTICATED.getStatusCode().value());
            });

            Number userIdNumber = claims.get("user_id", Number.class);
            Long user_id = userIdNumber.longValue();

            UserEntity userEntity = this.userRepository.findById(user_id).orElseThrow(()->{
                throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "không tồn tại user" , ErrorCode.USER_NOT_EXISTED.getStatusCode().value());
            });

            String accesstoken = this.genAccessToken(userEntity);
            this.genRefreshToken(userEntity , httpServletResponse);

            RevokeTokenEntity revokeTokenEntity = new RevokeTokenEntity();
            revokeTokenEntity.setRefreshToken(refreshToken);
            this.revokeTokenRepository.save(revokeTokenEntity);
            return new ResponseData<>(200 , "refresh token thành công" , accesstoken);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Refresh token không hợp lệ hoặc đã hết hạn!" , ErrorCode.UNAUTHENTICATED.getStatusCode().value());
        }
    }


}
