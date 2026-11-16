package chatToggetther.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
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

    @Value("${r2.bucket_name:${R2_BUCKET_NAME:museum}}")
    private String bucketName;

    @Value("${r2.public_url:${R2_PUBLIC_URL:https://pub-bb1eeff16fd349f2abb33e4e71fe1ae7.r2.dev}}")
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

            String baseUrl = publicUrl.replaceAll("/$", "");
            String resultUrl = baseUrl + "/" + key;
            log.info(">>> Đã tải tệp lên Cloudflare R2 thành công: {}", resultUrl);
            return resultUrl;
        } catch (Exception ex) {
            log.error(">>> Thất bại khi upload file lên Cloudflare R2: {}", ex.getMessage());
            return null;
        }
    }
}
