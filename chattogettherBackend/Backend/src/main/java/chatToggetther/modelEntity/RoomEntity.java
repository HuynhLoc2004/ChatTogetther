package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "rooms")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RoomEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_room")
    private Long id;
    @Column(name = "name_room" , nullable = false , columnDefinition = "TEXT")
    private String roomName;
    @Column(name = "password" , nullable = false , columnDefinition = "TEXT")
    private String password;
    @Column(name = "active" , nullable = false , columnDefinition = "BOOLEAN")
    private Boolean active;
    @Column(name = "create_time" , nullable = false , columnDefinition = "TIMESTAMP")
    private LocalDateTime localDateTime;
    @OneToMany(cascade = CascadeType.ALL ,fetch =  FetchType.LAZY , mappedBy = "roomEntity")
    private List<UserRoomEntity> userRoomEntityList = new ArrayList<>();
    @OneToMany(mappedBy = "roomEntity", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MessageEntity> messages = new ArrayList<>();
}
