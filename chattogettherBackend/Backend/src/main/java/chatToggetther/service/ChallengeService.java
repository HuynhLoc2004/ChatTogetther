package chatToggetther.service;

import chatToggetther.Customize.SecurityUtils;
import chatToggetther.DTO.ChallengeDTO;
import chatToggetther.DataRequest.CreateChallengeRequest;
import chatToggetther.modelEntity.ChallengeEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.ChallengeRepository;
import chatToggetther.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChallengeService {

    private final ChallengeRepository challengeRepository;
    private final UserRepository userRepository;

    public static final Map<String, CategoryMeta> CATEGORIES_META = new LinkedHashMap<>();

    static {
        CATEGORIES_META.put("ALL", new CategoryMeta("ALL", "Tất cả", "#a1a1aa"));
        CATEGORIES_META.put("TRUTH", new CategoryMeta("TRUTH", "Thú nhận", "#ec4899"));
        CATEGORIES_META.put("DARE", new CategoryMeta("DARE", "Thử thách vui", "#f59e0b"));
        CATEGORIES_META.put("DEEP_TALK", new CategoryMeta("DEEP_TALK", "Tâm sự sâu lắng", "#818cf8"));
        CATEGORIES_META.put("MUSIC", new CategoryMeta("MUSIC", "Gu âm nhạc", "#38bdf8"));
        CATEGORIES_META.put("PHILOSOPHY", new CategoryMeta("PHILOSOPHY", "Góc nhìn cuộc sống", "#10b981"));
    }

    public record CategoryMeta(String key, String label, String color) {}

    @PostConstruct
    @Transactional
    public void initSeedChallenges() {
        if (challengeRepository.countByActiveTrue() > 0) {
            return;
        }

        log.info("Kho dữ liệu Thẻ Bài Thử Thách trống. Bắt đầu nạp 40+ câu hỏi tâm lý & tương tác thực...");

        List<ChallengeEntity> seeds = new ArrayList<>();

        // 1. TRUTH - THÚ NHẬN (Thực tế, gần gũi, không sến súa)
        addSeed(seeds, "TRUTH", "Lời nói dối vô hại gần đây nhất bạn từng nói với ai đó là gì?");
        addSeed(seeds, "TRUTH", "Thói quen kỳ quặc nhất của bạn mỗi khi ở một mình trong phòng là gì?");
        addSeed(seeds, "TRUTH", "Điều ngớ ngẩn hoặc bối rối nhất bạn từng làm khi thích một ai đó?");
        addSeed(seeds, "TRUTH", "Nỗi sợ có phần 'trẻ con' nhưng đến giờ bạn vẫn chưa hoàn toàn bỏ được?");
        addSeed(seeds, "TRUTH", "Bạn đã từng gửi nhầm một tin nhắn nhạy cảm hoặc hài hước cho nhầm người chưa? Diễn biến sau đó thế nào?");
        addSeed(seeds, "TRUTH", "Một điều gì đó trong quá khứ bạn từng ghét cay ghét đắng, nhưng hiện tại lại thấy thích hoặc thấu hiểu?");
        addSeed(seeds, "TRUTH", "Khoảnh khắc nào khiến bạn nhận ra bản thân đã chính thức trưởng thành?");
        addSeed(seeds, "TRUTH", "Nếu có một chiếc gương soi thấy tâm tư thầm kín nhất của bạn lúc này, nó sẽ phản chiếu điều gì?");

        // 2. DARE - THỬ THÁCH VUI (Hành động tức thì, lan tỏa năng lượng tích cực)
        addSeed(seeds, "DARE", "Chụp lại góc bàn làm việc hoặc không gian quanh bạn hiện tại và đăng lên Sảnh cùng cảm xúc thật!");
        addSeed(seeds, "DARE", "Chia sẻ một bản nhạc bạn nghe lặp đi lặp lại nhiều nhất trong tuần này kèm 1 câu lý do.");
        addSeed(seeds, "DARE", "Gửi một lời cảm ơn hoặc tin nhắn hỏi thăm bất ngờ đến một người bạn lâu ngày chưa liên lạc.");
        addSeed(seeds, "DARE", "Cập nhật tiểu sử (Bio) trang cá nhân thành một câu nói bạn tâm đắc nhất hôm nay.");
        addSeed(seeds, "DARE", "Thả một lời khen chân thành ngẫu nhiên vào bài viết của một thành viên bất kỳ trên Sảnh.");
        addSeed(seeds, "DARE", "Kể lại một tình huống dở khóc dở cười mà bạn từng trải qua trong tuần này.");
        addSeed(seeds, "DARE", "Gợi ý cho mọi người 1 cuốn sách, 1 bộ phim hoặc 1 kênh podcast giúp bạn chữa lành.");

        // 3. DEEP_TALK - TÂM SỰ SÂU LẮNG (Kết nối tâm hồn, chân thật)
        addSeed(seeds, "DEEP_TALK", "Khoảng thời gian nào trong ngày bạn dễ cảm thấy trống trải nhất, và bạn thường làm gì để vượt qua?");
        addSeed(seeds, "DEEP_TALK", "Nếu được quay ngược thời gian nhắn nhủ với chính mình 3 năm trước, bạn sẽ nói điều gì?");
        addSeed(seeds, "DEEP_TALK", "Bài học lớn nhất mà một mối quan hệ tan vỡ đã để lại cho bạn là gì?");
        addSeed(seeds, "DEEP_TALK", "Điều gì đang khiến bạn trăn trở hoặc áp lực nhất trong giai đoạn hiện tại?");
        addSeed(seeds, "DEEP_TALK", "Theo bạn, một ngày hoàn hảo không áp lực công việc sẽ diễn ra như thế nào?");
        addSeed(seeds, "DEEP_TALK", "Ai là người có ảnh hưởng tích cực nhất đến cách suy nghĩ và thế giới quan của bạn hiện nay?");
        addSeed(seeds, "DEEP_TALK", "Điều can đảm nhất bạn từng làm để bảo vệ cảm xúc hoặc nguyên tắc sống của mình là gì?");

        // 4. MUSIC - GU ÂM NHẠC & VIBE
        addSeed(seeds, "MUSIC", "Giai điệu hoặc bài hát nào mỗi khi cất lên là cả một bầu trời kỷ niệm cũ ùa về?");
        addSeed(seeds, "MUSIC", "Thể loại nhạc bạn nghe nhiều nhất khi cần tập trung cao độ: Lofi, Jazz, Cổ điển hay Ambient Sound?");
        addSeed(seeds, "MUSIC", "Nếu cuộc đời bạn là một bộ phim điện ảnh, bài hát nào xứng đáng vang lên ở đoạn kết?");
        addSeed(seeds, "MUSIC", "Bạn thích nghe nhạc một mình trong bóng tối hay bật loa hòa mình giữa không gian đông người?");
        addSeed(seeds, "MUSIC", "Một ca sĩ hoặc nhóm nhạc mà gu âm nhạc của họ bạn cảm thấy đồng điệu nhất với tâm hồn mình?");
        addSeed(seeds, "MUSIC", "Buổi tối lý tưởng của bạn: Dạo phố đêm nghe nhạc, chill quán acoustic hay ở nhà cuộn chăn ấm?");

        // 5. PHILOSOPHY - GÓC NHÌN CUỘC SỐNG
        addSeed(seeds, "PHILOSOPHY", "Ở giai đoạn này của cuộc đời, bạn chọn sự bình yên thanh thản hay đam mê bứt phá mãnh liệt?");
        addSeed(seeds, "PHILOSOPHY", "Tiêu chuẩn quan trọng nhất để bạn chọn duy trì một mối quan hệ bạn bè lâu dài là gì?");
        addSeed(seeds, "PHILOSOPHY", "Theo bạn, hạnh phúc là một đích đến cần đạt được hay là năng lực cảm nhận từng khoảnh khắc?");
        addSeed(seeds, "PHILOSOPHY", "Bạn tin vào trực giác mách bảo ban đầu hay lý trí phân tích logic nhiều hơn khi đứng trước quyết định lớn?");
        addSeed(seeds, "PHILOSOPHY", "Một định kiến xã hội nào mà bạn nghĩ mọi người nên cởi mở thay đổi góc nhìn?");
        addSeed(seeds, "PHILOSOPHY", "Nếu tiền bạc không còn là gánh nặng, bạn muốn dành trọn thời gian của mình để làm công việc gì?");

        challengeRepository.saveAll(seeds);
        log.info("Đã nạp thành công {} câu hỏi Thẻ Bài Thử Thách chuẩn mực vào database!", seeds.size());
    }

    private void addSeed(List<ChallengeEntity> list, String category, String question) {
        CategoryMeta meta = CATEGORIES_META.getOrDefault(category, new CategoryMeta(category, "Thử thách", "#a1a1aa"));
        list.add(ChallengeEntity.builder()
                .category(category)
                .categoryName(meta.label())
                .badgeColor(meta.color())
                .question(question)
                .author("Hệ thống Talovin")
                .usageCount(ThreadLocalRandom.current().nextInt(5, 35))
                .active(true)
                .createdAt(LocalDateTime.now())
                .build());
    }

    @Transactional
    public ChallengeDTO getRandomChallenge(String category) {
        List<ChallengeEntity> pool;
        if (category == null || category.trim().isEmpty() || "ALL".equalsIgnoreCase(category.trim())) {
            pool = challengeRepository.findByActiveTrue();
        } else {
            pool = challengeRepository.findByCategoryAndActiveTrue(category.trim().toUpperCase());
            if (pool.isEmpty()) {
                pool = challengeRepository.findByActiveTrue();
            }
        }

        if (pool.isEmpty()) {
            return ChallengeDTO.builder()
                    .id(0L)
                    .category("DEEP_TALK")
                    .categoryName("Tâm sự")
                    .badgeColor("#818cf8")
                    .question("Khoảnh khắc nào trong ngày bạn cảm thấy bình yên và là chính mình nhất?")
                    .author("Hệ thống Talovin")
                    .usageCount(1)
                    .build();
        }

        ChallengeEntity selected = pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
        selected.setUsageCount((selected.getUsageCount() == null ? 0 : selected.getUsageCount()) + 1);
        challengeRepository.save(selected);

        return toDTO(selected);
    }

    public List<Map<String, Object>> getCategories() {
        List<Map<String, Object>> res = new ArrayList<>();
        for (Map.Entry<String, CategoryMeta> entry : CATEGORIES_META.entrySet()) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("key", entry.getKey());
            map.put("label", entry.getValue().label());
            map.put("color", entry.getValue().color());
            if ("ALL".equalsIgnoreCase(entry.getKey())) {
                map.put("count", challengeRepository.countByActiveTrue());
            } else {
                map.put("count", challengeRepository.findByCategoryAndActiveTrue(entry.getKey()).size());
            }
            res.add(map);
        }
        return res;
    }

    @Transactional
    public ChallengeDTO createChallenge(JwtAuthenticationToken token, CreateChallengeRequest request) {
        if (request == null || request.getQuestion() == null || request.getQuestion().trim().isEmpty()) {
            throw new IllegalArgumentException("Nội dung câu hỏi không được để trống");
        }

        String question = request.getQuestion().trim();
        String cat = (request.getCategory() != null && !request.getCategory().trim().isEmpty()) 
                ? request.getCategory().trim().toUpperCase() : "DEEP_TALK";

        CategoryMeta meta = CATEGORIES_META.getOrDefault(cat, CATEGORIES_META.get("DEEP_TALK"));

        String authorName = "Thành viên cộng đồng";
        Long authorId = null;

        UserEntity currentUser = SecurityUtils.getAuthenticatedUser(token, userRepository);
        if (currentUser != null) {
            authorName = (currentUser.getNickname() != null && !currentUser.getNickname().isEmpty())
                    ? currentUser.getNickname() : currentUser.getAccount();
            authorId = currentUser.getId();
        }

        ChallengeEntity entity = ChallengeEntity.builder()
                .question(question)
                .category(meta.key())
                .categoryName(meta.label())
                .badgeColor(meta.color())
                .author(authorName)
                .authorId(authorId)
                .usageCount(1)
                .active(true)
                .createdAt(LocalDateTime.now())
                .build();

        ChallengeEntity saved = challengeRepository.save(entity);
        return toDTO(saved);
    }

    private ChallengeDTO toDTO(ChallengeEntity e) {
        return ChallengeDTO.builder()
                .id(e.getId())
                .question(e.getQuestion())
                .category(e.getCategory())
                .categoryName(e.getCategoryName())
                .badgeColor(e.getBadgeColor())
                .author(e.getAuthor())
                .authorId(e.getAuthorId())
                .usageCount(e.getUsageCount())
                .build();
    }
}
