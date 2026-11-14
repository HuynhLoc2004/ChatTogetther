package chatToggetther.repository;

import chatToggetther.modelEntity.PostEntity;
import chatToggetther.modelEntity.PostRepostEntity;
import chatToggetther.modelEntity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PostRepostRepository extends JpaRepository<PostRepostEntity, Long> {
    Optional<PostRepostEntity> findByPostAndUser(PostEntity post, UserEntity user);
    long countByPost(PostEntity post);
    boolean existsByPostAndUser(PostEntity post, UserEntity user);
    
    @Query("SELECT r FROM PostRepostEntity r JOIN FETCH r.post p JOIN FETCH p.user u WHERE r.user = :user ORDER BY r.createdAt DESC")
    List<PostRepostEntity> findByUserOrderByCreatedAtDesc(@Param("user") UserEntity user);

    @Query("SELECT r FROM PostRepostEntity r JOIN FETCH r.post p JOIN FETCH r.user u JOIN FETCH p.user pu ORDER BY r.createdAt DESC")
    List<PostRepostEntity> findAllRepostsForAdmin();

    void deleteAllByPost(PostEntity post);
}
