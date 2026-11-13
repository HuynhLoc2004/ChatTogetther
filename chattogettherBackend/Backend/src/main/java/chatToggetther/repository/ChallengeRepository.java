package chatToggetther.repository;

import chatToggetther.modelEntity.ChallengeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChallengeRepository extends JpaRepository<ChallengeEntity, Long> {
    List<ChallengeEntity> findByActiveTrue();

    List<ChallengeEntity> findByCategoryAndActiveTrue(String category);

    long countByActiveTrue();
}

