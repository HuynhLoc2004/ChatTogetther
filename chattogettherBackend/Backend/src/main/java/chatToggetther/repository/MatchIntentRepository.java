package chatToggetther.repository;

import chatToggetther.modelEntity.MatchIntentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MatchIntentRepository extends JpaRepository<MatchIntentEntity, Long> {
    Optional<MatchIntentEntity> findByCode(String code);

    List<MatchIntentEntity> findByIsActiveTrueOrderByDisplayOrderAsc();

    List<MatchIntentEntity> findAllByOrderByDisplayOrderAsc();

    boolean existsByCode(String code);
}
