package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UserDTO {
    private Long id;
    private String nickname;
    private Boolean active;
    private String account;
    private String avatar;
    private Integer age;
    private String location;
    private String bio;
    private String email;
    private String phone;
    private String friendshipStatus; // NONE, PENDING_SENT, PENDING_RECEIVED, ACCEPTED
    
    // Đặc quyền & Danh hiệu người dùng
    private List<String> roles;
    private String vipTier; // FOUNDER, VIP_DIAMOND, VIP_PRO, MEMBER
    private String customTitle; // e.g. "👑 Sáng Lập Viên", "💎 VIP Kim Cương", "✨ Vibe Master"
    private Integer level;
    private Integer streakDays;
    private Boolean isVerified;
}
