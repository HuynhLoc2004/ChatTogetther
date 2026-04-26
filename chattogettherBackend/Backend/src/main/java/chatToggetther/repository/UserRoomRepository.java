package chatToggetther.repository;

import chatToggetther.modelEntity.UserRoomEntity;
import chatToggetther.modelEntity.RoomEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRoomRepository extends JpaRepository<UserRoomEntity , Long> {
    long countByRoomEntityAndActive(RoomEntity roomEntity, Boolean active);
}
