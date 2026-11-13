package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "tracks")
@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class TrackEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "track_id")
    private Long id;

    @Column(name = "name_track", nullable = false)
    private String name;

    @Column(name = "genre_track")
    private String genre;

    @Column(name = "audio_src", columnDefinition = "TEXT", nullable = false)
    private String audioSrc;

    @Column(name = "artist_track")
    private String artist;

    @Column(name = "active_track")
    private Boolean active = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}

