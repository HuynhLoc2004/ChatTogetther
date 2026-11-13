package chatToggetther.repository;

import chatToggetther.modelEntity.PostEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<PostEntity, Long> {

    @Query("SELECT DISTINCT p FROM PostEntity p " +
           "JOIN FETCH p.user u " +
           "ORDER BY p.createdAt DESC")
    List<PostEntity> findAllPostsWithDetails(Pageable pageable);

    @Query("SELECT DISTINCT p FROM PostEntity p " +
           "JOIN FETCH p.user u " +
           "ORDER BY p.createdAt DESC")
    List<PostEntity> findAllPostsWithDetails();

    @Query("SELECT DISTINCT p FROM PostEntity p " +
           "JOIN FETCH p.user u " +
           "WHERE LOWER(p.content) LIKE LOWER(CONCAT('%', :kw, '%')) " +
           "OR LOWER(COALESCE(p.vibe, '')) LIKE LOWER(CONCAT('%', :kw, '%')) " +
           "ORDER BY p.createdAt DESC")
    List<PostEntity> searchPosts(@Param("kw") String keyword);
}

