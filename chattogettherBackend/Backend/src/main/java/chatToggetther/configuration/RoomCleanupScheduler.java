package chatToggetther.configuration;

import chatToggetther.modelEntity.RoomEntity;
import chatToggetther.repository.RoomRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
@Slf4j
public class RoomCleanupScheduler {

    private final RoomRepository roomRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public RoomCleanupScheduler(RoomRepository roomRepository, SimpMessagingTemplate messagingTemplate) {
        this.roomRepository = roomRepository;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Chạy mỗi phút (60000ms) để dọn dẹp các phòng không có user online.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cleanupEmptyRooms() {
        log.info("Bắt đầu kiểm tra và dọn dẹp phòng trống...");
        
        List<RoomEntity> emptyRooms = roomRepository.findAllEmptyRooms();
        
        if (!emptyRooms.isEmpty()) {
            log.info("Tìm thấy {} phòng trống. Đang tiến hành chuyển sang inactive...", emptyRooms.size());
            emptyRooms.forEach(room -> room.setActive(false));
            roomRepository.saveAll(emptyRooms);
            
            // Thông báo qua WebSocket để FE cập nhật lại danh sách phòng
            messagingTemplate.convertAndSend("/topic/rooms", "ROOM_CLEANUP_SYNC");
        } else {
            log.info("Không có phòng trống nào cần dọn dẹp.");
        }
    }
}
