package chatToggetther.repository;

import chatToggetther.modelEntity.CommunityGroupEntity;
import chatToggetther.modelEntity.CommunityReportEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommunityReportRepository extends JpaRepository<CommunityReportEntity, Long> {
    List<CommunityReportEntity> findByCommunity(CommunityGroupEntity community);

    List<CommunityReportEntity> findByStatusOrderByCreatedAtDesc(String status);

    List<CommunityReportEntity> findAllByOrderByCreatedAtDesc();

    long countByCommunityAndStatus(CommunityGroupEntity community, String status);

    @Query("SELECT r.community.id, COUNT(r.id) FROM CommunityReportEntity r WHERE r.status = 'PENDING' GROUP BY r.community.id")
    List<Object[]> countPendingReportsByCommunity();
}
