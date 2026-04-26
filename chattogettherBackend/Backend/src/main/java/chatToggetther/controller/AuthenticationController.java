package chatToggetther.controller;


import chatToggetther.Customize.ResponseData;
import chatToggetther.DataRequest.UserloginRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.service.AuthenticationService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.Getter;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthenticationController {
    private final AuthenticationService authenticationService;

    public AuthenticationController(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @PostMapping("/login")
    public ResponseEntity<ResponseData<chatToggetther.DTO.LoginResponseDTO>> UserLogin(@RequestBody @Valid UserloginRequest userloginRequest , HttpServletResponse httpServletResponse){
        return ResponseEntity.ok(this.authenticationService.userLogin(userloginRequest , httpServletResponse));
    }
    @GetMapping("/refresh_token")
    public ResponseEntity<ResponseData<String>> refreshToken(@CookieValue(name = "refreshToken") String refreshToken , HttpServletResponse httpServletResponse){
         return ResponseEntity.ok(this.authenticationService.refreshToken(refreshToken , httpServletResponse));
    }
}
