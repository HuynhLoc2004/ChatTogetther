package chatToggetther.repository;

import chatToggetther.modelEntity.AudioChannelEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AudioChannelRepository extends JpaRepository<AudioChannelEntity, Long> {
    List<AudioChannelEntity> findByIsActiveTrueOrderByIdAsc();

    List<AudioChannelEntity> findAllByOrderByIdAsc();
}
