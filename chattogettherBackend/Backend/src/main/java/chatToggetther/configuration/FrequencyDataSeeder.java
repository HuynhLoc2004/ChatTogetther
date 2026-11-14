package chatToggetther.configuration;

import chatToggetther.modelEntity.AudioChannelEntity;
import chatToggetther.modelEntity.MatchIntentEntity;
import chatToggetther.repository.AudioChannelRepository;
import chatToggetther.repository.MatchIntentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class FrequencyDataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(FrequencyDataSeeder.class);

    private final MatchIntentRepository matchIntentRepository;
    private final AudioChannelRepository audioChannelRepository;

    public FrequencyDataSeeder(MatchIntentRepository matchIntentRepository, AudioChannelRepository audioChannelRepository) {
        this.matchIntentRepository = matchIntentRepository;
        this.audioChannelRepository = audioChannelRepository;
    }

    @Override
    public void run(String... args) {
        seedMatchIntents();
        seedAudioChannels();
    }

    private void seedMatchIntents() {
        if (this.matchIntentRepository.count() == 0) {
            log.info(">>> Khởi tạo 4 băng tần FM mặc định trải đều 88.0 - 108.0 MHz...");

            List<MatchIntentEntity> defaultIntents = List.of(
                    MatchIntentEntity.builder()
                            .code("CHILL_MUSIC")
                            .title("Nghe Nhạc & Thư Giãn")
                            .subtitle("Cùng nghe những giai điệu êm dịu, thả lỏng tâm hồn")
                            .iconName("Headphones")
                            .freqStart(88.0)
                            .freqEnd(92.9)
                            .displayOrder(1)
                            .isActive(true)
                            .build(),

                    MatchIntentEntity.builder()
                            .code("DEADLINE_SPRINT")
                            .title("Chạy Deadline Tập Trung")
                            .subtitle("Pomodoro, cùng nhau làm việc và học tập hiệu quả")
                            .iconName("Laptop")
                            .freqStart(93.0)
                            .freqEnd(97.9)
                            .displayOrder(2)
                            .isActive(true)
                            .build(),

                    MatchIntentEntity.builder()
                            .code("DEEP_TALK")
                            .title("Tâm Sự Đêm Khuya")
                            .subtitle("Chia sẻ những câu chuyện thật, lắng đọng góc nhìn cuộc sống")
                            .iconName("MessageCircle")
                            .freqStart(98.0)
                            .freqEnd(102.9)
                            .displayOrder(3)
                            .isActive(true)
                            .build(),

                    MatchIntentEntity.builder()
                            .code("FREE_CONNECT")
                            .title("Kết Nối Tự Do")
                            .subtitle("Trò chuyện ngẫu hứng, giao lưu mở rộng bạn bè bốn phương")
                            .iconName("Sparkles")
                            .freqStart(103.0)
                            .freqEnd(108.0)
                            .displayOrder(4)
                            .isActive(true)
                            .build()
            );

            this.matchIntentRepository.saveAll(defaultIntents);
            log.info(">>> Đã nạp thành công {} băng tần FM!", defaultIntents.size());
        }
    }

    private void seedAudioChannels() {
        if (this.audioChannelRepository.count() == 0) {
            log.info(">>> Khởi tạo 3 đài phát nhạc hệ thống Lo-Fi / Ambient miễn phí bản quyền...");

            List<AudioChannelEntity> defaultChannels = List.of(
                    AudioChannelEntity.builder()
                            .name("Lofi Chill Radio")
                            .genreTag("Lofi / Relax")
                            .streamUrl("https://stream.zeno.fm/f3wvbbqmdg8uv")
                            .isActive(true)
                            .build(),

                    AudioChannelEntity.builder()
                            .name("Deep Ambient Soundscapes")
                            .genreTag("Ambient / Focus")
                            .streamUrl("https://stream.zeno.fm/4wgahv592f8uv")
                            .isActive(true)
                            .build(),

                    AudioChannelEntity.builder()
                            .name("Coffee Shop Acoustics")
                            .genreTag("Acoustic / Study")
                            .streamUrl("https://stream.zeno.fm/0r0xa792kwzuv")
                            .isActive(true)
                            .build()
            );

            this.audioChannelRepository.saveAll(defaultChannels);
            log.info(">>> Đã nạp thành công {} đài phát nhạc hệ thống!", defaultChannels.size());
        }
    }
}
