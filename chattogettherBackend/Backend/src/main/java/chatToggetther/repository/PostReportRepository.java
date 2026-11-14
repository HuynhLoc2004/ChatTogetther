package chatToggetther.repository;

import chatToggetther.modelEntity.PostReportEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostReportRepository extends JpaRepository<PostReportEntity, Long> {
    List<PostReportEntity> findAllByOrderByCreatedAtDesc();
    List<PostReportEntity> findByStatusOrderByCreatedAtDesc(String status);
    long countByStatus(String status);
}
