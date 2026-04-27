package chatToggetther.repository;

import chatToggetther.modelEntity.MessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<MessageEntity , Long> {
    List<MessageEntity> findByRoomEntity_IdOrderByTimeSendAsc(Long roomId);
}
