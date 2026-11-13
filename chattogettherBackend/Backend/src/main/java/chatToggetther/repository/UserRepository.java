package chatToggetther.repository;

import chatToggetther.modelEntity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity , Long> {
    boolean existsByAccount(String account);
    Optional<UserEntity> findByAccount(String account);

    @Query("SELECT u FROM UserEntity u WHERE LOWER(u.account) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(u.nickname) LIKE LOWER(CONCAT('%', :query, '%'))")
    java.util.List<UserEntity> searchUsers(@Param("query") String query);
}
