package chatToggetther.repository;

import chatToggetther.modelEntity.CommunityCategoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommunityCategoryRepository extends JpaRepository<CommunityCategoryEntity, Long> {
    List<CommunityCategoryEntity> findByIsActiveTrueOrderByDisplayOrderAscIdAsc();
    List<CommunityCategoryEntity> findAllByOrderByDisplayOrderAscIdAsc();
    Optional<CommunityCategoryEntity> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
