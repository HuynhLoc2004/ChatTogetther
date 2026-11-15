package chatToggetther.repository;

import chatToggetther.modelEntity.AdminAuditLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLogEntity, Long> {
    List<AdminAuditLogEntity> findTop100ByOrderByCreatedAtDesc();
}
