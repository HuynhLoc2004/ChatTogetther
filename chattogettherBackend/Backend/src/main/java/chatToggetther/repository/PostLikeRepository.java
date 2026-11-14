package chatToggetther.repository;

import chatToggetther.modelEntity.PostEntity;
import chatToggetther.modelEntity.PostLikeEntity;
import chatToggetther.modelEntity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PostLikeRepository extends JpaRepository<PostLikeEntity, Long> {
    Optional<PostLikeEntity> findByPostAndUser(PostEntity post, UserEntity user);
    boolean existsByPostAndUser(PostEntity post, UserEntity user);
    int countByPost(PostEntity post);

    @Query("SELECT pl.post.id, COUNT(pl.id) FROM PostLikeEntity pl WHERE pl.post.id IN :postIds GROUP BY pl.post.id")
    List<Object[]> countLikesByPostIds(@Param("postIds") List<Long> postIds);

    @Query("SELECT pl FROM PostLikeEntity pl WHERE pl.user = :user AND pl.post.id IN :postIds")
    List<PostLikeEntity> findByUserAndPostIds(@Param("user") UserEntity user, @Param("postIds") List<Long> postIds);

    @Query("SELECT pl.post.id, pl.user.id, pl.user.account, pl.user.nickname FROM PostLikeEntity pl WHERE pl.post.id IN :postIds AND pl.user.id IN :friendIds")
    List<Object[]> findFriendLikesOnPosts(@Param("postIds") List<Long> postIds, @Param("friendIds") java.util.Set<Long> friendIds);
}

