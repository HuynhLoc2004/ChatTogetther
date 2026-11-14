package chatToggetther.repository;

import chatToggetther.modelEntity.CommunityGroupEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommunityGroupRepository extends JpaRepository<CommunityGroupEntity, Long> {

    // Query cho Client: Lấy các nhóm ACTIVE, lọc category & keyword, ưu tiên isFeatured DESC
    @Query("SELECT g FROM CommunityGroupEntity g WHERE (g.status = 'ACTIVE' OR g.status IS NULL) " +
           "AND (:category IS NULL OR :category = '' OR :category = 'ALL' OR g.categoryCode = :category) " +
           "AND (:kw IS NULL OR :kw = '' OR LOWER(g.name) LIKE LOWER(CONCAT('%', :kw, '%')) OR LOWER(g.description) LIKE LOWER(CONCAT('%', :kw, '%'))) " +
           "ORDER BY CASE WHEN g.isFeatured = true THEN 1 ELSE 0 END DESC, g.createdAt DESC")
    Page<CommunityGroupEntity> findActiveCommunitiesWithPaging(
            @Param("category") String categoryCode,
            @Param("kw") String keyword,
            Pageable pageable
    );

    @Query("SELECT g FROM CommunityGroupEntity g WHERE (g.status = 'ACTIVE' OR g.status IS NULL) " +
           "AND (:category IS NULL OR :category = '' OR :category = 'ALL' OR g.categoryCode = :category) " +
           "AND (:kw IS NULL OR :kw = '' OR LOWER(g.name) LIKE LOWER(CONCAT('%', :kw, '%')) OR LOWER(g.description) LIKE LOWER(CONCAT('%', :kw, '%'))) " +
           "ORDER BY CASE WHEN g.isFeatured = true THEN 1 ELSE 0 END DESC, g.createdAt DESC")
    List<CommunityGroupEntity> findActiveCommunities(
            @Param("category") String categoryCode,
            @Param("kw") String keyword
    );

    // Query cho Super Admin: Xem toàn bộ (ACTIVE, RESTRICTED, SUSPENDED)
    @Query("SELECT g FROM CommunityGroupEntity g WHERE (:status IS NULL OR :status = '' OR :status = 'ALL' OR g.status = :status) " +
           "AND (:kw IS NULL OR :kw = '' OR LOWER(g.name) LIKE LOWER(CONCAT('%', :kw, '%')) OR LOWER(g.description) LIKE LOWER(CONCAT('%', :kw, '%'))) " +
           "ORDER BY g.createdAt DESC")
    Page<CommunityGroupEntity> findAdminCommunitiesWithPaging(
            @Param("status") String status,
            @Param("kw") String keyword,
            Pageable pageable
    );

    @Query("SELECT g FROM CommunityGroupEntity g WHERE (:status IS NULL OR :status = '' OR :status = 'ALL' OR g.status = :status) " +
           "AND (:kw IS NULL OR :kw = '' OR LOWER(g.name) LIKE LOWER(CONCAT('%', :kw, '%')) OR LOWER(g.description) LIKE LOWER(CONCAT('%', :kw, '%'))) " +
           "ORDER BY g.createdAt DESC")
    List<CommunityGroupEntity> findAdminCommunities(
            @Param("status") String status,
            @Param("kw") String keyword
    );

    @Query("SELECT g FROM CommunityGroupEntity g WHERE LOWER(g.name) LIKE LOWER(CONCAT('%', :kw, '%')) OR LOWER(g.description) LIKE LOWER(CONCAT('%', :kw, '%')) ORDER BY g.createdAt DESC")
    List<CommunityGroupEntity> searchGroups(@Param("kw") String keyword);

    @Query("SELECT g FROM CommunityGroupEntity g ORDER BY g.createdAt DESC")
    List<CommunityGroupEntity> findAllOrderByCreatedAtDesc();
}
