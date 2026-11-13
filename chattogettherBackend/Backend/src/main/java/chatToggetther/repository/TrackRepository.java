package chatToggetther.repository;

import chatToggetther.modelEntity.TrackEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TrackRepository extends JpaRepository<TrackEntity, Long> {
    List<TrackEntity> findByActiveTrueOrderByCreatedAtDesc();
}

