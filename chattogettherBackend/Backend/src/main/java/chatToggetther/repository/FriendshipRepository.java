package chatToggetther.repository;

import chatToggetther.modelEntity.FriendshipEntity;
import chatToggetther.modelEntity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends JpaRepository<FriendshipEntity, Long> {

    @Query("SELECT f FROM FriendshipEntity f WHERE " +
           "(f.user = :u1 AND f.friend = :u2) OR (f.user = :u2 AND f.friend = :u1)")
    Optional<FriendshipEntity> findFriendshipBetween(@Param("u1") UserEntity u1, @Param("u2") UserEntity u2);

    @Query("SELECT f FROM FriendshipEntity f " +
           "JOIN FETCH f.user u " +
           "JOIN FETCH f.friend fr " +
           "WHERE (f.user = :user OR f.friend = :user) AND f.status = 'ACCEPTED'")
    List<FriendshipEntity> findAllAcceptedFriends(@Param("user") UserEntity user);

    @Query("SELECT f FROM FriendshipEntity f " +
           "JOIN FETCH f.user u " +
           "WHERE f.friend = :user AND f.status = 'PENDING'")
    List<FriendshipEntity> findPendingRequestsFor(@Param("user") UserEntity user);
}

