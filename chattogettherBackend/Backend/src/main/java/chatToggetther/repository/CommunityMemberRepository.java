package chatToggetther.repository;

import chatToggetther.modelEntity.CommunityGroupEntity;
import chatToggetther.modelEntity.CommunityMemberEntity;
import chatToggetther.modelEntity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommunityMemberRepository extends JpaRepository<CommunityMemberEntity, Long> {
    Optional<CommunityMemberEntity> findByGroupAndUser(CommunityGroupEntity group, UserEntity user);
    List<CommunityMemberEntity> findByGroupAndStatus(CommunityGroupEntity group, String status);
    List<CommunityMemberEntity> findByGroup(CommunityGroupEntity group);
    List<CommunityMemberEntity> findByUserAndStatus(UserEntity user, String status);
    void deleteByGroupAndUser(CommunityGroupEntity group, UserEntity user);
}

