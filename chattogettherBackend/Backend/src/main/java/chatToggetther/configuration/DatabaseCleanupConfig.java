package chatToggetther.configuration;

import chatToggetther.repository.RoomRepository;
import chatToggetther.repository.UserRoomRepository;
import chatToggetther.repository.MessageRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.annotation.Transactional;

@Configuration
public class DatabaseCleanupConfig {

    private final RoomRepository roomRepository;
    private final UserRoomRepository userRoomRepository;
    private final MessageRepository messageRepository;

    public DatabaseCleanupConfig(RoomRepository roomRepository, UserRoomRepository userRoomRepository, MessageRepository messageRepository) {
        this.roomRepository = roomRepository;
        this.userRoomRepository = userRoomRepository;
        this.messageRepository = messageRepository;
    }

    @PostConstruct
    @Transactional
    public void cleanDatabaseOnStartup() {
        System.out.println(">>> Đang thực hiện DỌN DẸP SẠCH Database (Xóa hoàn toàn)...");
        try {
            // Xóa theo thứ tự để tránh lỗi ràng buộc khóa ngoại
            messageRepository.deleteAll();
            userRoomRepository.deleteAll();
            roomRepository.deleteAll();
            
            System.out.println(">>> ĐÃ XÓA SẠCH TẤT CẢ PHÒNG VÀ TIN NHẮN THÀNH CÔNG!");
        } catch (Exception e) {
            System.err.println(">>> Lỗi khi xóa Database: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
