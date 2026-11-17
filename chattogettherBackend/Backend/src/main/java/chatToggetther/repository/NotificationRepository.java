package chatToggetther.repository;

import chatToggetther.modelEntity.NotificationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository extends JpaRepository<NotificationEntity, Long> {
    List<NotificationEntity> findByRecipientIdOrderByCreatedAtDesc(Long recipientId);

    long countByRecipientIdAndIsReadFalse(Long recipientId);

    Optional<NotificationEntity> findFirstByRecipientIdAndActorIdAndTypeOrderByCreatedAtDesc(
            Long recipientId, Long actorId, String type
    );

    List<NotificationEntity> findByRecipientIdAndActorIdAndTypeAndReferenceIdOrderByCreatedAtDesc(
            Long recipientId, Long actorId, String type, Long referenceId
    );

    @Modifying
    @Query("UPDATE NotificationEntity n SET n.isRead = true WHERE n.recipientId = :recipientId")
    void markAllAsRead(@Param("recipientId") Long recipientId);

    @Modifying
    @Query("DELETE FROM NotificationEntity n WHERE n.recipientId = :recipientId")
    void deleteAllByRecipientId(@Param("recipientId") Long recipientId);
}
