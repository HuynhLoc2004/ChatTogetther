package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class CommunityMemberDTO {
    private Long id;
    private Long userId;
    private String account;
    private String nickname;
    private String avatar;
    private String role; // OWNER, DEPUTY, MEMBER
    private String status; // ACTIVE, PENDING
    private LocalDateTime joinedAt;
}

