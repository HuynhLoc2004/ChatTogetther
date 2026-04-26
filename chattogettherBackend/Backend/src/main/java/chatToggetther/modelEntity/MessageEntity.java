package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.cglib.core.Local;
import org.springframework.scheduling.annotation.Schedules;

import java.time.LocalDateTime;

@Entity
@Table(name = "messages")
@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class MessageEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "messsage_id")
    private Long id;
    @Column(name = "message" , columnDefinition = "TEXT")
    private String message;
    @Column(name = "time_send")
    private LocalDateTime time_send;
    @Column(name = "time_retrieve")
    private LocalDateTime time_retrieve;
    @ManyToOne(cascade =  CascadeType.ALL , fetch = FetchType.LAZY )
    private UserEntity userEntity;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private RoomEntity roomEntity;
}
