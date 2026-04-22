package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
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
    @Column(name = "create_time")
    private LocalDateTime create_time;


}
