package chatToggetther.service;

import chatToggetther.Customize.AppException;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class MediaStorageService {

    private final Path storageDirectory;
    private final CloudflareR2Service cloudflareR2Service;

    public MediaStorageService(CloudflareR2Service cloudflareR2Service) {
        this.cloudflareR2Service = cloudflareR2Service;
        Path targetDir = Paths.get("uploads").toAbsolutePath().normalize();
        Path effectiveDir;
        try {
            Files.createDirectories(targetDir);
            Files.createDirectories(targetDir.resolve("chat"));
            Files.createDirectories(targetDir.resolve("voice-samples"));
            Files.createDirectories(targetDir.resolve("tracks"));
            effectiveDir = targetDir;
        } catch (Exception e) {
            System.err.println("Không thể tạo thư mục lưu trữ mặc định: " + targetDir + ". Chuyển sang thư mục tạm: " + e.getMessage());
            try {
                Path tmpDir = Paths.get(System.getProperty("java.io.tmpdir"), "uploads").toAbsolutePath().normalize();
                Files.createDirectories(tmpDir);
                Files.createDirectories(tmpDir.resolve("chat"));
                Files.createDirectories(tmpDir.resolve("voice-samples"));
                Files.createDirectories(tmpDir.resolve("tracks"));
                effectiveDir = tmpDir;
            } catch (Exception ex) {
                System.err.println("Cảnh báo: Không thể tạo thư mục lưu trữ tạm: " + ex.getMessage());
                effectiveDir = Paths.get(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();
            }
        }
        this.storageDirectory = effectiveDir;
    }

    public String storeAudioSample(MultipartFile file, Long userId) {
        if (file == null || file.isEmpty()) {
            throw new AppException(400, "Tệp âm thanh mẫu không được để trống", 400);
        }

        // Kiểm tra kích thước tệp tối đa 500KB cho audio 5s (chống tràn băng thông & dung lượng)
        if (file.getSize() > 500 * 1024) {
            throw new AppException(400, "Kích thước đoạn ghi âm vượt quá 500KB (vui lòng thu âm trong khoảng 5 giây)", 400);
        }

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "audio.webm");
        String extension = "webm";
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex > 0) {
            extension = originalFilename.substring(dotIndex + 1).toLowerCase();
        }

        String key = String.format("voice-samples/sample_user_%d_%d_%s.%s",
                userId != null ? userId : 0,
                System.currentTimeMillis(),
                UUID.randomUUID().toString().substring(0, 8),
                extension
        );

        // 1. Tải lên Cloudflare R2 siêu tốc nếu đã cấu hình
        if (this.cloudflareR2Service != null && this.cloudflareR2Service.isConfigured()) {
            boolean r2Success = this.cloudflareR2Service.uploadFileWithKey(file, key);
            if (r2Success) {
                try {
                    Path localTarget = this.storageDirectory.resolve(key).normalize();
                    Files.createDirectories(localTarget.getParent());
                    Files.copy(file.getInputStream(), localTarget, StandardCopyOption.REPLACE_EXISTING);
                } catch (Exception ignored) {}
                return "/api/match/audio/" + key.replace("voice-samples/", "");
            }
        }

        try {
            Path targetLocation = this.storageDirectory.resolve(key).normalize();
            Files.createDirectories(targetLocation.getParent());
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
            return "/api/match/audio/" + key.replace("voice-samples/", "");
        } catch (IOException e) {
            throw new AppException(500, "Lỗi khi lưu trữ tệp âm thanh: " + e.getMessage(), 500);
        }
    }

    public String storeMusicFile(MultipartFile file) {
        return storeMusicTrack(file, "music");
    }

    public String storeMusicTrack(MultipartFile file, String subFolder) {
        if (file == null || file.isEmpty()) {
            throw new AppException(400, "Tệp nhạc không được để trống", 400);
        }

        if (file.getSize() > 25 * 1024 * 1024) {
            throw new AppException(400, "Kích thước tệp nhạc vượt quá 25MB", 400);
        }

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "track.mp3");
        String extension = "mp3";
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex > 0) {
            extension = originalFilename.substring(dotIndex + 1).toLowerCase();
        }

        String key = String.format("tracks/%d_%s.%s",
                System.currentTimeMillis(),
                UUID.randomUUID().toString().substring(0, 8),
                extension
        );

        if (this.cloudflareR2Service != null && this.cloudflareR2Service.isConfigured()) {
            boolean r2Success = this.cloudflareR2Service.uploadFileWithKey(file, key);
            if (r2Success) {
                try {
                    Path localTarget = this.storageDirectory.resolve(key).normalize();
                    Files.createDirectories(localTarget.getParent());
                    Files.copy(file.getInputStream(), localTarget, StandardCopyOption.REPLACE_EXISTING);
                } catch (Exception ignored) {}
                return "/api/music/files/" + key.replace("tracks/", "");
            }
        }

        try {
            Path targetLocation = this.storageDirectory.resolve(key).normalize();
            Files.createDirectories(targetLocation.getParent());
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
            return "/api/music/files/" + key.replace("tracks/", "");
        } catch (IOException e) {
            throw new AppException(500, "Lỗi khi lưu trữ tệp nhạc: " + e.getMessage(), 500);
        }
    }

    public String storeChatMedia(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(400, "Tệp không được để trống", 400);
        }
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "media.dat");
        String extension = "bin";
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex > 0) {
            extension = originalFilename.substring(dotIndex + 1).toLowerCase();
        }

        String key = String.format("chat/%d_%s.%s",
                System.currentTimeMillis(),
                UUID.randomUUID().toString().substring(0, 8),
                extension
        );

        // 1. Tải lên Cloudflare R2 (Lưu trữ Cloud 0$ băng thông, vĩnh viễn, không lo tốn dung lượng VPS)
        if (this.cloudflareR2Service != null && this.cloudflareR2Service.isConfigured()) {
            boolean r2Success = this.cloudflareR2Service.uploadFileWithKey(file, key);
            if (r2Success) {
                // Lưu bản sao cục bộ vào bộ nhớ cache nhanh trên VPS để phục vụ ngay
                try {
                    Path localTarget = this.storageDirectory.resolve(key).normalize();
                    Files.createDirectories(localTarget.getParent());
                    Files.copy(file.getInputStream(), localTarget, StandardCopyOption.REPLACE_EXISTING);
                } catch (Exception ignored) {}

                // Trả về endpoint proxy nội bộ đảm bảo 100% người dùng xem được mượt mà
                return "/api/message/files/" + key;
            }
        }

        // 2. Fallback lưu trữ cục bộ nếu chưa có Cloudflare R2
        try {
            Path targetLocation = this.storageDirectory.resolve(key).normalize();
            Files.createDirectories(targetLocation.getParent());
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
            return "/api/message/files/" + key;
        } catch (IOException e) {
            throw new AppException(500, "Lỗi khi lưu trữ tệp media: " + e.getMessage(), 500);
        }
    }

    public Resource loadChatMediaAsResource(String relativeKey) {
        if (relativeKey == null || relativeKey.isBlank()) {
            throw new AppException(400, "Tên tệp không hợp lệ", 400);
        }
        String cleanKey = relativeKey.replaceAll("^/+", "");
        try {
            // 1. Kiểm tra cache cục bộ trên đĩa
            Path filePath = this.storageDirectory.resolve(cleanKey).normalize();
            if (Files.exists(filePath) && Files.isReadable(filePath)) {
                return new UrlResource(filePath.toUri());
            }

            // Kiểm tra trong thư mục con chat nếu cleanKey chưa có tiền tố
            if (!cleanKey.startsWith("chat/")) {
                Path chatSubPath = this.storageDirectory.resolve("chat").resolve(cleanKey).normalize();
                if (Files.exists(chatSubPath) && Files.isReadable(chatSubPath)) {
                    return new UrlResource(chatSubPath.toUri());
                }
            }

            // Kiểm tra trong thư mục voice-samples (tương thích ngược)
            Path voiceSubPath = this.storageDirectory.resolve("voice-samples").resolve(cleanKey).normalize();
            if (Files.exists(voiceSubPath) && Files.isReadable(voiceSubPath)) {
                return new UrlResource(voiceSubPath.toUri());
            }

            // 2. Nếu cục bộ chưa có, tải từ Cloudflare R2 về đệm cục bộ
            if (this.cloudflareR2Service != null && this.cloudflareR2Service.isConfigured()) {
                // Thử cả cleanKey và chat/cleanKey
                String[] candidateKeys = cleanKey.startsWith("chat/") ? new String[]{cleanKey} : new String[]{cleanKey, "chat/" + cleanKey};
                for (String k : candidateKeys) {
                    try (ResponseInputStream<GetObjectResponse> r2Stream = this.cloudflareR2Service.getObjectStream(k)) {
                        if (r2Stream != null) {
                            Files.createDirectories(filePath.getParent());
                            Files.copy(r2Stream, filePath, StandardCopyOption.REPLACE_EXISTING);
                            return new UrlResource(filePath.toUri());
                        }
                    } catch (Exception ex) {
                        System.err.println("Không thể đồng bộ từ Cloudflare R2 (key: " + k + "): " + ex.getMessage());
                    }
                }
            }

            throw new AppException(404, "Tệp media không tồn tại hoặc đã bị xóa", 404);
        } catch (AppException ae) {
            throw ae;
        } catch (Exception e) {
            throw new AppException(500, "Lỗi khi truy xuất tệp: " + e.getMessage(), 500);
        }
    }

    public Resource loadAudioSampleAsResource(String fileName) {
        return loadChatMediaAsResource("voice-samples/" + fileName);
    }
}
