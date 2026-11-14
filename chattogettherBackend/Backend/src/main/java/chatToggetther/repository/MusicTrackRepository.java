package chatToggetther.repository;

import chatToggetther.modelEntity.MusicTrackEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MusicTrackRepository extends JpaRepository<MusicTrackEntity, Long> {
    List<MusicTrackEntity> findByIsActiveTrueOrderByIsFeaturedDescIdDesc();
    List<MusicTrackEntity> findAllByOrderByIdDesc();
}
