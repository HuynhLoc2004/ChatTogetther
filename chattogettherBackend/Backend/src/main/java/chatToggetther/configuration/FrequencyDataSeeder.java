package chatToggetther.configuration;

import chatToggetther.modelEntity.AudioChannelEntity;
import chatToggetther.modelEntity.MatchIntentEntity;
import chatToggetther.modelEntity.MusicTrackEntity;
import chatToggetther.modelEntity.SystemConfigEntity;
import chatToggetther.repository.AudioChannelRepository;
import chatToggetther.repository.MatchIntentRepository;
import chatToggetther.repository.MusicTrackRepository;
import chatToggetther.repository.SystemConfigRepository;
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
    private final MusicTrackRepository musicTrackRepository;
    private final SystemConfigRepository systemConfigRepository;

    public FrequencyDataSeeder(
            MatchIntentRepository matchIntentRepository,
            AudioChannelRepository audioChannelRepository,
            MusicTrackRepository musicTrackRepository,
            SystemConfigRepository systemConfigRepository
    ) {
        this.matchIntentRepository = matchIntentRepository;
        this.audioChannelRepository = audioChannelRepository;
        this.musicTrackRepository = musicTrackRepository;
        this.systemConfigRepository = systemConfigRepository;
    }

    @Override
    public void run(String... args) {
        seedMatchIntents();
        seedAudioChannels();
        seedMusicTracks();
        seedSystemConfigs();
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

    private void seedMusicTracks() {
        if (this.musicTrackRepository.count() == 0) {
            log.info(">>> Khởi tạo 5 bản nhạc nền Lo-Fi Royalty-Free hoạt động thật...");

            List<MusicTrackEntity> defaultTracks = List.of(
                    MusicTrackEntity.builder()
                            .title("Chill Tokyo Night")
                            .artist("Talovin Lo-Fi Station")
                            .genreTag("Lofi / Study")
                            .coverUrl("https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=60")
                            .audioUrl("https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3")
                            .isFeatured(true)
                            .isActive(true)
                            .build(),

                    MusicTrackEntity.builder()
                            .title("Sunset Coffee Vibe")
                            .artist("Acoustic Room")
                            .genreTag("Coffee / Relax")
                            .coverUrl("https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60")
                            .audioUrl("https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=chill-abstract-intention-12099.mp3")
                            .isFeatured(true)
                            .isActive(true)
                            .build(),

                    MusicTrackEntity.builder()
                            .title("Deep Coding Flow")
                            .artist("Focus Frequency")
                            .genreTag("Ambient / Focus")
                            .coverUrl("https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop&q=60")
                            .audioUrl("https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=lofi-chill-medium-version-159456.mp3")
                            .isFeatured(false)
                            .isActive(true)
                            .build(),

                    MusicTrackEntity.builder()
                            .title("Rainy Windowpane")
                            .artist("Sleep & Dream")
                            .genreTag("Rain / Sleep")
                            .coverUrl("https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=500&auto=format&fit=crop&q=60")
                            .audioUrl("https://cdn.pixabay.com/download/audio/2021/09/06/audio_73bbd80a13.mp3?filename=rain-and-nostalgia-version-60s-10820.mp3")
                            .isFeatured(false)
                            .isActive(true)
                            .build(),

                    MusicTrackEntity.builder()
                            .title("Cosmic Lounge FM")
                            .artist("Starlight Synthesizer")
                            .genreTag("Synth / Space")
                            .coverUrl("https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=60")
                            .audioUrl("https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f77626.mp3?filename=spirit-blossom-15285.mp3")
                            .isFeatured(false)
                            .isActive(true)
                            .build()
            );

            this.musicTrackRepository.saveAll(defaultTracks);
            log.info(">>> Đã nạp thành công {} bản nhạc Lo-Fi Royalty-Free!", defaultTracks.size());
        }
    }

    private void seedSystemConfigs() {
        seedConfigIfAbsent("MAX_ROOM_MEMBERS_FREE", "6");
        seedConfigIfAbsent("MAX_ROOM_MEMBERS_PRO", "20");
        seedConfigIfAbsent("SIGNAL_TTL_MINUTES", "15");
    }

    private void seedConfigIfAbsent(String key, String value) {
        if (!this.systemConfigRepository.existsById(key)) {
            this.systemConfigRepository.save(SystemConfigEntity.builder()
                    .configKey(key)
                    .configValue(value)
                    .build());
            log.info(">>> Đã nạp cấu hình hệ thống: {} = {}", key, value);
        }
    }
}
