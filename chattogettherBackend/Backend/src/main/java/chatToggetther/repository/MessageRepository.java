package chatToggetther.repository;

import chatToggetther.modelEntity.MessageEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<MessageEntity , Long> {
    @Query("SELECT m FROM MessageEntity m " +
           "LEFT JOIN FETCH m.userEntity u " +
           "WHERE m.roomEntity.id = :roomId " +
           "ORDER BY m.timeSend ASC")
    List<MessageEntity> findByRoomEntity_IdOrderByTimeSendAsc(@Param("roomId") Long roomId);

    @Query("SELECT m FROM MessageEntity m " +
           "LEFT JOIN FETCH m.userEntity u " +
           "WHERE m.roomEntity.id = :roomId AND (:beforeId IS NULL OR m.id < :beforeId) " +
           "ORDER BY m.id DESC")
    List<MessageEntity> findMessagesBeforeId(@Param("roomId") Long roomId, @Param("beforeId") Long beforeId, Pageable pageable);
}
