package chatToggetther.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.InputStream;
import java.net.URI;
import java.util.UUID;

@Service
public class CloudflareR2Service {

    private static final Logger log = LoggerFactory.getLogger(CloudflareR2Service.class);

    @Value("${r2.account_id:${R2_ACCOUNT_ID:58adca9a5a385fdb2618f638bfda563}}")
    private String accountId;

    @Value("${r2.access_key_id:${R2_ACCESS_KEY_ID:4c92a085f610b93b0b89701c91978faa}}")
    private String accessKeyId;

    @Value("${r2.secret_access_key:${R2_SECRET_ACCESS_KEY:0079051cc76a1e244a101d77f532b4be843405f88d5e0631c429224796f80715}}")
    private String secretAccessKey;

    @Value("${r2.bucket_name:${R2_BUCKET_NAME:talovin-media}}")
    private String bucketName;

    @Value("${r2.public_url:${R2_PUBLIC_URL:https://pub-9618b6a7a3a9489ab05ddd69d79a4b9b.r2.dev}}")
    private String publicUrl;

    private S3Client s3Client;
    private boolean isReady = false;

    @PostConstruct
    public void init() {
        try {
            if (accessKeyId == null || accessKeyId.isBlank() || secretAccessKey == null || secretAccessKey.isBlank()) {
                log.warn("Cloudflare R2 chưa cấu hình access keys, dùng bộ nhớ cục bộ.");
                return;
            }

            String endpoint = String.format("https://%s.r2.cloudflarestorage.com", accountId.trim());

            AwsBasicCredentials credentials = AwsBasicCredentials.create(accessKeyId.trim(), secretAccessKey.trim());

            this.s3Client = S3Client.builder()
                    .endpointOverride(URI.create(endpoint))
                    .credentialsProvider(StaticCredentialsProvider.create(credentials))
                    .region(Region.of("auto"))
                    .serviceConfiguration(S3Configuration.builder()
                            .pathStyleAccessEnabled(true)
                            .build())
                    .build();

            this.isReady = true;
            log.info(">>> Khởi tạo Cloudflare R2 S3Client thành công! (Bucket: {}, Endpoint: {})", bucketName, endpoint);
        } catch (Exception ex) {
            log.error(">>> Lỗi khởi tạo Cloudflare R2 Client: {}", ex.getMessage());
            this.isReady = false;
        }
    }

    public boolean isConfigured() {
        return this.isReady && this.s3Client != null;
    }

    /**
     * Upload file lên Cloudflare R2 theo key cụ thể
     */
    public boolean uploadFileWithKey(MultipartFile file, String key) {
        if (!isConfigured() || file == null || file.isEmpty() || key == null || key.isBlank()) {
            return false;
        }
        try {
            String contentType = file.getContentType();
            if (contentType == null || contentType.isBlank()) {
                contentType = "application/octet-stream";
            }

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .contentType(contentType)
                    .build();

            try (InputStream is = file.getInputStream()) {
                s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(is, file.getSize()));
            }

            log.info(">>> Đã lưu tệp vào Cloudflare R2 thành công: {}", key);
            return true;
        } catch (Exception ex) {
            log.error(">>> Thất bại khi upload file lên Cloudflare R2 (key: {}): {}", key, ex.getMessage());
            return false;
        }
    }

    /**
     * Upload file lên Cloudflare R2 và trả về URL công khai CDN
     */
    public String uploadFile(MultipartFile file, String folderPrefix) {
        if (!isConfigured() || file == null || file.isEmpty()) {
            return null;
        }

        try {
            String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file.bin";
            String extension = "bin";
            int dotIndex = originalFilename.lastIndexOf('.');
            if (dotIndex > 0) {
                extension = originalFilename.substring(dotIndex + 1).toLowerCase();
            }

            String prefix = (folderPrefix != null && !folderPrefix.isBlank())
                    ? folderPrefix.replaceAll("^/|/$", "") + "/"
                    : "";
            String key = String.format("%s%d_%s.%s", prefix, System.currentTimeMillis(), UUID.randomUUID().toString().substring(0, 8), extension);

            boolean success = uploadFileWithKey(file, key);
            if (!success) {
                return null;
            }

            String baseUrl = (publicUrl != null) ? publicUrl.replaceAll("/$", "") : "";
            if (!baseUrl.isBlank()) {
                return baseUrl + "/" + key;
            }
            return key;
        } catch (Exception ex) {
            log.error(">>> Thất bại khi upload file lên Cloudflare R2: {}", ex.getMessage());
            return null;
        }
    }

    /**
     * Tải luồng dữ liệu (stream) của object từ Cloudflare R2
     */
    public ResponseInputStream<GetObjectResponse> getObjectStream(String key) {
        if (!isConfigured() || key == null || key.isBlank()) {
            return null;
        }
        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();
            return s3Client.getObject(getObjectRequest);
        } catch (Exception ex) {
            log.warn("Không tìm thấy tệp trên Cloudflare R2 (key: {}): {}", key, ex.getMessage());
            return null;
        }
    }
}
