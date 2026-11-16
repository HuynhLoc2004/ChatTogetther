# Runtime image gọn nhẹ với Eclipse Temurin Java 21 JRE Alpine (khớp pom.xml)
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Tạo non-root user (appuser:appgroup) & cấp quyền bảo mật cho thư mục làm việc
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && mkdir -p /app/uploads \
    && chown -R appuser:appgroup /app

# Copy duy nhất file JAR đã build từ target/*.jar thành app.jar (không build Maven trong Docker)
COPY --chown=appuser:appgroup target/*.jar app.jar

USER appuser

EXPOSE 8080

# Khởi chạy tối ưu bộ nhớ & tốc độ cho VPS 1C-4G (G1GC, entropy urandom, profile prod)
ENTRYPOINT ["java", "-Xms512m", "-Xmx1280m", "-XX:+UseG1GC", "-XX:MaxGCPauseMillis=100", "-Djava.security.egd=file:/dev/./urandom", "-Dspring.profiles.active=prod", "-jar", "app.jar"]
