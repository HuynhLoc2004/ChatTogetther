package chatToggetther.repository;

import chatToggetther.modelEntity.CommentEntity;
import chatToggetther.modelEntity.PostEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<CommentEntity, Long> {
    @Query("SELECT c FROM CommentEntity c " +
           "JOIN FETCH c.user u " +
           "WHERE c.post = :post " +
           "ORDER BY c.createdAt ASC")
    List<CommentEntity> findCommentsByPost(@Param("post") PostEntity post);
    
    int countByPost(PostEntity post);

    @Query("SELECT c.post.id, COUNT(c.id) FROM CommentEntity c WHERE c.post.id IN :postIds GROUP BY c.post.id")
    List<Object[]> countCommentsByPostIds(@Param("postIds") List<Long> postIds);
}

