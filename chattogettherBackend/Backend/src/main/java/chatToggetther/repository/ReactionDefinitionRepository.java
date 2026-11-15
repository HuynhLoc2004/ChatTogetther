package chatToggetther.repository;

import chatToggetther.modelEntity.ReactionDefinitionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReactionDefinitionRepository extends JpaRepository<ReactionDefinitionEntity, Long> {
    List<ReactionDefinitionEntity> findByStatusOrderBySortOrderAsc(String status);
    List<ReactionDefinitionEntity> findAllByOrderBySortOrderAsc();
    Optional<ReactionDefinitionEntity> findByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCase(String code);
}
