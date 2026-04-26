package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.cglib.core.Local;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "user_room")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UserRoomEntity {
    @Id
    @GeneratedValue(strategy =  GenerationType.IDENTITY)
    @Column(name = "user-room_id")
    private Long id;

    @Column(name = "time_join", columnDefinition = "timestamp[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private List<LocalDateTime> timeJoin = new ArrayList<>();

    @Column(name = "time_left", columnDefinition = "timestamp[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private List<LocalDateTime> timeLeft = new ArrayList<>();

    @OneToOne(fetch =  FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserEntity userEntity;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_room" , nullable = false)
    private RoomEntity roomEntity;
    @Column(name = "active" , columnDefinition = "BOOLEAN")
    private Boolean active;


}
