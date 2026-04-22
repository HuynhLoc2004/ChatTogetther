package chatToggetther.modelEntity;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


@Entity
@Table(name = "revokeToken")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RevokeTokenEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_revokeToken" )
    private Long id;
    @Column(name = "revoketoken_refresh" , columnDefinition = "TEXT")
    private String refreshToken;
}
