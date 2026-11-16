package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "messages", indexes = {
    @Index(name = "idx_messages_room_id", columnList = "room_id"),
    @Index(name = "idx_messages_room_user", columnList = "room_id, user_id"),
    @Index(name = "idx_messages_room_read", columnList = "room_id, user_id, is_read")
})
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
    private LocalDateTime timeSend;
    
    @Column(name = "time_retrieve")
    private LocalDateTime timeRetrieve;

    @Column(name = "is_read")
    private Boolean isRead = false;

    @Column(name = "time_read")
    private LocalDateTime timeRead;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserEntity userEntity;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private RoomEntity roomEntity;
}
