package chatToggetther.repository;

import chatToggetther.modelEntity.HiddenChatEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HiddenChatRepository extends JpaRepository<HiddenChatEntity, Long> {
    List<HiddenChatEntity> findByUserId(Long userId);
    Optional<HiddenChatEntity> findByUserIdAndPartnerId(Long userId, Long partnerId);
    boolean existsByUserIdAndPartnerId(Long userId, Long partnerId);
    void deleteByUserIdAndPartnerId(Long userId, Long partnerId);
}
