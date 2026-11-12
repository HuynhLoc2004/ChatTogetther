package chatToggetther.repository;

import chatToggetther.modelEntity.PostEntity;
import chatToggetther.modelEntity.PostLikeEntity;
import chatToggetther.modelEntity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PostLikeRepository extends JpaRepository<PostLikeEntity, Long> {
    Optional<PostLikeEntity> findByPostAndUser(PostEntity post, UserEntity user);
    boolean existsByPostAndUser(PostEntity post, UserEntity user);
    int countByPost(PostEntity post);
}

