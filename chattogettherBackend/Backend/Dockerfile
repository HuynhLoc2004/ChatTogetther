# Stage 1: Build source code với Maven và Java 21
FROM maven:3.9.6-eclipse-temurin-21-alpine AS build
WORKDIR /app

# Copy file cấu hình maven để tận dụng cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy mã nguồn và đóng gói JAR
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Runtime image gọn nhẹ với JRE 21
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Tạo non-root user để tăng tính bảo mật
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy file jar đã build từ Stage 1
COPY --from=build /app/target/*.jar app.jar

# Render tự động gán biến PORT (mặc định 8080 nếu chạy local)
ENV PORT=8080
EXPOSE 8080

# Chạy ứng dụng Spring Boot với cổng động từ Render
ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT} -jar app.jar"]

