package chatToggetther.repository;

import chatToggetther.modelEntity.RoomEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<RoomEntity , Long> {
    @Query("SELECT DISTINCT r FROM RoomEntity r LEFT JOIN r.userRoomEntityList ur WHERE r.active = :active")
    public List<RoomEntity> getallRoomActive(@Param("active") Boolean active);

    @Query("SELECT r FROM RoomEntity r WHERE r.active = true AND r.id NOT IN " +
           "(SELECT ur.roomEntity.id FROM UserRoomEntity ur WHERE ur.active = true)")
    List<RoomEntity> findAllEmptyRooms();
}
