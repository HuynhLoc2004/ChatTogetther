package chatToggetther.repository;

import chatToggetther.DTO.RoomDTO;
import chatToggetther.modelEntity.RoomEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import javax.swing.text.html.parser.Entity;
import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<RoomEntity , Long> {
    @Query("SELECT r FROM RoomEntity r  join  r.userRoomEntityList ur  join  ur.userEntity u WHERE r.active =:active  ")
    public List<RoomEntity> getallRoomActive(@Param("active") Boolean active);
}
