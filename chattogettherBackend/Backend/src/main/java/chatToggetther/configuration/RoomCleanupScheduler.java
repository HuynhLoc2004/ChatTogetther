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
     * Chạy mỗi phút (60000ms) để chuyển trạng thái các phòng không có thành viên sang Inactive.
     * Các phòng này sẽ không còn xuất hiện trong danh sách lấy ra cho người dùng.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cleanupEmptyRooms() {
        log.info(">>> Đang kiểm tra các phòng không có thành viên để chuyển sang Inactive...");
        
        List<RoomEntity> emptyRooms = roomRepository.findAllEmptyRooms();
        
        if (!emptyRooms.isEmpty()) {
            log.info(">>> Tìm thấy {} phòng trống. Đang chuyển trạng thái active = false...", emptyRooms.size());
            
            // Chỉ set active = false chứ không xóa khỏi DB
            emptyRooms.forEach(room -> room.setActive(false));
            roomRepository.saveAll(emptyRooms);
            
            // Thông báo qua WebSocket để các Client cập nhật lại danh sách phòng ngay lập tức
            messagingTemplate.convertAndSend("/topic/rooms", "ROOMS_DEACTIVATED_CLEANUP");
            
            log.info(">>> Đã chuyển trạng thái các phòng trống sang Inactive thành công.");
        }
    }
}
