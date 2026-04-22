package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.cglib.core.Local;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@Entity
@Table(name = "user-room")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UserRoomEntity {
    @Id
    @GeneratedValue(strategy =  GenerationType.IDENTITY)
    @Column(name = "user-room_id")
    private Long id;
    @Column(name = "timeJoin" , nullable = false , columnDefinition = "TIMESTAMP")
    private LocalDateTime timeJoin;
    @Column(name = "timeLeft"  , columnDefinition = "TIMESTAMP")
    private LocalDateTime timeLeft;
    @OneToOne(cascade = CascadeType.ALL , fetch =  FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserEntity userEntity;
    @ManyToOne(cascade = CascadeType.ALL , fetch = FetchType.LAZY)
    @JoinColumn(name = "id_room" , nullable = false)
    private RoomEntity roomEntity;


}
