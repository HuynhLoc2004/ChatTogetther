package chatToggetther.repository;

import chatToggetther.modelEntity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity , Long> {
    @Query("SELECT COUNT(u) > 0 FROM UserEntity u WHERE u.account = :account" )
    boolean findbyAccounnt(@Param("account") String account);
    @Query("SELECT u FROM UserEntity u WHERE u.account = :account")
    Optional<UserEntity> findUserByAccount(@Param("account") String account);
}
