package chatToggetther.configuration;

import chatToggetther.repository.RoomRepository;
import chatToggetther.repository.UserRoomRepository;
import chatToggetther.repository.MessageRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@Configuration
public class DatabaseCleanupConfig {

    private final RoomRepository roomRepository;
    private final UserRoomRepository userRoomRepository;
    private final MessageRepository messageRepository;
    private final JdbcTemplate jdbcTemplate;

    public DatabaseCleanupConfig(RoomRepository roomRepository, UserRoomRepository userRoomRepository, MessageRepository messageRepository, JdbcTemplate jdbcTemplate) {
        this.roomRepository = roomRepository;
        this.userRoomRepository = userRoomRepository;
        this.messageRepository = messageRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    // Tắt tự động dọn dẹp để không bị mất phòng và tin nhắn mỗi khi restart server
    // @PostConstruct
    // @Transactional
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

    @PostConstruct
    public void ensureMessageReadColumns() {
        try {
            jdbcTemplate.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false");
            jdbcTemplate.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS time_read timestamp without time zone");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_messages_room_read ON messages (room_id, user_id, is_read)");
        } catch (Exception e) {
            System.err.println(">>> [DB MIGRATION NOTICE] Kiểm tra cột tin nhắn: " + e.getMessage());
        }
    }

    @PostConstruct
    @Transactional
    public void cleanupLegacyDmUserRooms() {
        try {
            int count = userRoomRepository.deleteDmUserRooms();
            if (count > 0) {
                System.out.println(">>> Đã giải phóng " + count + " bản ghi user_room cũ từ các phòng chat 1-1.");
            }
        } catch (Exception e) {
            System.err.println(">>> Bỏ qua dọn dẹp user_room phòng 1-1: " + e.getMessage());
        }
    }
}
