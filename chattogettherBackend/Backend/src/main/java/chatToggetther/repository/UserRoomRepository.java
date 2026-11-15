package chatToggetther.repository;

import chatToggetther.modelEntity.UserRoomEntity;
import chatToggetther.modelEntity.RoomEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface UserRoomRepository extends JpaRepository<UserRoomEntity , Long> {
    long countByRoomEntityAndActive(RoomEntity roomEntity, Boolean active);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserRoomEntity ur WHERE ur.roomEntity.password LIKE 'DM_%'")
    int deleteDmUserRooms();
}

