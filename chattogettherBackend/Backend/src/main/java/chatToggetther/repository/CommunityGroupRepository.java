package chatToggetther.repository;

import chatToggetther.modelEntity.CommunityGroupEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommunityGroupRepository extends JpaRepository<CommunityGroupEntity, Long> {
    @Query("SELECT g FROM CommunityGroupEntity g WHERE LOWER(g.name) LIKE LOWER(CONCAT('%', :kw, '%')) OR LOWER(g.description) LIKE LOWER(CONCAT('%', :kw, '%')) ORDER BY g.createdAt DESC")
    List<CommunityGroupEntity> searchGroups(@Param("kw") String keyword);

    @Query("SELECT g FROM CommunityGroupEntity g ORDER BY g.createdAt DESC")
    List<CommunityGroupEntity> findAllOrderByCreatedAtDesc();
}

