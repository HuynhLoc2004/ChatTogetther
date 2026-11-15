package chatToggetther.repository;

import chatToggetther.modelEntity.ChallengeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ChallengeRepository extends JpaRepository<ChallengeEntity, Long> {
    List<ChallengeEntity> findByActiveTrue();

    List<ChallengeEntity> findByCategoryAndActiveTrue(String category);

    long countByActiveTrue();

    // Atomic Draw Counter query - updates both drawCount and usageCount in one atomic DB operation
    @Modifying
    @Query("UPDATE ChallengeEntity c SET c.drawCount = COALESCE(c.drawCount, 0) + 1, c.usageCount = COALESCE(c.usageCount, 0) + 1 WHERE c.id = :id")
    int atomicIncrementDrawCount(@Param("id") Long id);

    @Query("SELECT COALESCE(c.drawCount, c.usageCount, 0) FROM ChallengeEntity c WHERE c.id = :id")
    Integer getDrawCountById(@Param("id") Long id);

    // Queries for Active Icebreakers
    @Query("SELECT c FROM ChallengeEntity c WHERE c.status = 'ACTIVE' OR (c.status IS NULL AND c.active = true) ORDER BY COALESCE(c.sortOrder, 0) ASC, c.createdAt DESC")
    List<ChallengeEntity> findActiveIcebreakers();

    @Query("SELECT c FROM ChallengeEntity c WHERE (c.status = 'ACTIVE' OR (c.status IS NULL AND c.active = true)) AND UPPER(c.category) = UPPER(:category) ORDER BY COALESCE(c.sortOrder, 0) ASC, c.createdAt DESC")
    List<ChallengeEntity> findActiveIcebreakersByCategory(@Param("category") String category);

    // Rate limiting: count submissions by author in the last hour
    long countByAuthorIdAndCreatedAtAfter(Long authorId, LocalDateTime after);

    // Admin filtering by status
    List<ChallengeEntity> findByStatusOrderByCreatedAtDesc(String status);

    long countByStatus(String status);

    @Query("SELECT COALESCE(SUM(COALESCE(c.drawCount, c.usageCount, 0)), 0) FROM ChallengeEntity c")
    long getTotalDrawCount();
}
