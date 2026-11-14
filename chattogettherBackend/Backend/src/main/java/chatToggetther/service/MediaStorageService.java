package chatToggetther.service;

import chatToggetther.Customize.AppException;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

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

    public MediaStorageService() {
        this.storageDirectory = Paths.get("uploads", "voice-samples").toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.storageDirectory);
        } catch (IOException e) {
            throw new RuntimeException("Không thể tạo thư mục lưu trữ âm thanh: " + this.storageDirectory, e);
        }
    }

    public String storeAudioSample(MultipartFile file, Long userId) {
        if (file == null || file.isEmpty()) {
            throw new AppException(400, "Tệp âm thanh mẫu không được để trống", 400);
        }

        // Kiểm tra kích thước tệp tối đa 10MB
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new AppException(400, "Kích thước đoạn ghi âm vượt quá 10MB", 400);
        }

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "audio.webm");
        String extension = "webm";
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex > 0) {
            extension = originalFilename.substring(dotIndex + 1).toLowerCase();
        }

        // Tên file chuẩn mực, ngẫu nhiên hóa để chống ghi đè
        String uniqueFileName = String.format("sample_user_%d_%d_%s.%s",
                userId != null ? userId : 0,
                System.currentTimeMillis(),
                UUID.randomUUID().toString().substring(0, 8),
                extension
        );

        try {
            Path targetLocation = this.storageDirectory.resolve(uniqueFileName);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
            return "/api/match/audio/" + uniqueFileName;
        } catch (IOException e) {
            throw new AppException(500, "Lỗi khi lưu trữ tệp âm thanh: " + e.getMessage(), 500);
        }
    }

    public Resource loadAudioSampleAsResource(String fileName) {
        try {
            Path filePath = this.storageDirectory.resolve(fileName).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new AppException(404, "Tệp âm thanh không tồn tại hoặc không thể đọc", 404);
            }
        } catch (MalformedURLException e) {
            throw new AppException(404, "Đường dẫn tệp âm thanh không hợp lệ", 404);
        }
    }
}
