package chatToggetther.repository;

import chatToggetther.modelEntity.RevokeTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RevokeTokenRepository extends JpaRepository<RevokeTokenEntity, Long> {
    @Query("SELECT rv FROM RevokeTokenEntity rv WHERE rv.refreshToken = :token")
    public Optional<RevokeTokenEntity> findRevokeTokenByRefresh(@Param("token") String token);
}
