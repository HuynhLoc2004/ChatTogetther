package chatToggetther.modelEntity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "search_terms", indexes = {
    @Index(name = "idx_search_term_count", columnList = "search_count DESC"),
    @Index(name = "idx_search_term_keyword", columnList = "term")
})
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class SearchTermEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "term", nullable = false, unique = true, length = 120)
    private String term;

    @Column(name = "search_count", nullable = false)
    @Builder.Default
    private Long searchCount = 1L;

    @Column(name = "last_searched_at", nullable = false)
    @Builder.Default
    private LocalDateTime lastSearchedAt = LocalDateTime.now();
}
