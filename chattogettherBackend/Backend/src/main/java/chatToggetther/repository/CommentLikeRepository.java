package chatToggetther.repository;

import chatToggetther.modelEntity.CommentEntity;
import chatToggetther.modelEntity.CommentLikeEntity;
import chatToggetther.modelEntity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CommentLikeRepository extends JpaRepository<CommentLikeEntity, Long> {
    Optional<CommentLikeEntity> findByCommentAndUser(CommentEntity comment, UserEntity user);
    long countByComment(CommentEntity comment);
    boolean existsByCommentAndUser(CommentEntity comment, UserEntity user);
    void deleteAllByComment(CommentEntity comment);
}
