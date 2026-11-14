package chatToggetther.repository;

import chatToggetther.modelEntity.SearchTermEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SearchTermRepository extends JpaRepository<SearchTermEntity, Long> {
    Optional<SearchTermEntity> findByTermIgnoreCase(String term);

    @Query("SELECT s FROM SearchTermEntity s ORDER BY s.searchCount DESC, s.lastSearchedAt DESC LIMIT 10")
    List<SearchTermEntity> findTopHotSearches();
}
