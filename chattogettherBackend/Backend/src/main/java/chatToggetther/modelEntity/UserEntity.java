package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class UserEntity {
    @Id
    @GeneratedValue(strategy =  GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long id;
    @Column(name = "account_user" , unique = true , nullable = false)
    private String account;
    @Column(name = "password_user"  , columnDefinition = "TEXT" , nullable = false)
    private String password;
    @Column(name = "avatar_user" , columnDefinition = "TEXT")
    private String avatar;
    @Column(name = "phone_user" ,unique = true , columnDefinition = "TEXT")
    private String phone;
    @Column(name = "nickname_user" , columnDefinition = "TEXT")
    private String nickname;
    @Column(name = "active_user")
    private Boolean active = true;

    @Column(name = "email_user", columnDefinition = "TEXT")
    private String email;

    @Column(name = "roles_user", nullable = false, columnDefinition = "TEXT[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private List<String> roles = new ArrayList<>();

    @Column(name = "permissions_user", nullable = false, columnDefinition = "TEXT[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private List<String> permissions = new ArrayList<>();
    @OneToOne(mappedBy = "userEntity" , fetch = FetchType.LAZY , cascade =  CascadeType.ALL)
    private UserRoomEntity userRoomEntity;
    @OneToMany(fetch = FetchType.LAZY , mappedBy = "userEntity")
    private List<MessageEntity> messageEntityList = new ArrayList<>();

}
