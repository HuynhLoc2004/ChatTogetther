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

    @Query("SELECT m FROM MessageEntity m " +
           "LEFT JOIN FETCH m.userEntity u " +
           "WHERE m.id IN (SELECT MAX(m2.id) FROM MessageEntity m2 WHERE m2.roomEntity.id IN :roomIds GROUP BY m2.roomEntity.id)")
    List<MessageEntity> findLatestMessagesForRooms(@Param("roomIds") java.util.Collection<Long> roomIds);

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE MessageEntity m SET m.isRead = true, m.timeRead = :now " +
           "WHERE m.roomEntity.id = :roomId AND m.userEntity.id = :senderId " +
           "AND (:upToId IS NULL OR m.id <= :upToId) AND (m.isRead = false OR m.isRead IS NULL)")
    int markMessagesAsRead(
            @Param("roomId") Long roomId,
            @Param("senderId") Long senderId,
            @Param("upToId") Long upToId,
            @Param("now") java.time.LocalDateTime now
    );

    @Query("SELECT COUNT(m) FROM MessageEntity m " +
           "WHERE m.roomEntity.id = :roomId AND m.userEntity.id = :senderId " +
           "AND (m.isRead = false OR m.isRead IS NULL)")
    long countUnreadMessages(
            @Param("roomId") Long roomId,
            @Param("senderId") Long senderId
    );

    @Query("SELECT COUNT(m) > 0 FROM MessageEntity m " +
           "WHERE m.roomEntity.id = :roomId " +
           "AND m.timeSend >= :since " +
           "AND (m.message LIKE '📞 Cuộc gọi%' OR m.message LIKE '📹 Cuộc gọi%')")
    boolean existsRecentCallLog(@Param("roomId") Long roomId, @Param("since") java.time.LocalDateTime since);
}
