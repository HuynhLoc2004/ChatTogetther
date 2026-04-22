package chatToggetther.ENUMS;

import lombok.Getter;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
public enum ErrorCode {
    // --- 0. Success Codes (0xxx) ---
    // Thường dùng code 0 hoặc 200 cho thành công
    SUCCESS(0, "Operation successful", HttpStatus.OK),
    CREATED_SUCCESS(201, "Resource created successfully", HttpStatus.CREATED),
    UPDATED_SUCCESS(202, "Resource updated successfully", HttpStatus.OK),
    DELETED_SUCCESS(203, "Resource deleted successfully", HttpStatus.OK),

    // --- 1. System & General Errors (9xxx) ---
    UNCATEGORIZED_EXCEPTION(9999, "Uncategorized error", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_KEY(8888, "Invalid message key", HttpStatus.BAD_REQUEST),
    DB_CONNECTION_FAILED(9001, "Database connection failed", HttpStatus.SERVICE_UNAVAILABLE),
    DATA_INTEGRITY_VIOLATION(9002, "Data integrity violation", HttpStatus.CONFLICT),

    // --- 2. Request & Validation Errors (4xxx) ---
    INVALID_REQUEST_PAYLOAD(4000, "Invalid request payload", HttpStatus.BAD_REQUEST),
    VALIDATION_ERROR(4001, "Validation failed", HttpStatus.BAD_REQUEST),
    INVALID_INPUT_FORMAT(4002, "Invalid input format", HttpStatus.BAD_REQUEST),
    MISSING_REQUIRED_FIELD(4003, "Missing required fields", HttpStatus.BAD_REQUEST),
    FILE_TOO_LARGE(4004, "Uploaded file is too large", HttpStatus.PAYLOAD_TOO_LARGE),
    UNSUPPORTED_MEDIA_TYPE(4005, "File type not supported", HttpStatus.UNSUPPORTED_MEDIA_TYPE),

    // --- 3. Authentication & Authorization (1xxx) ---
    USER_EXISTED(1001, "User already exists", HttpStatus.BAD_REQUEST),
    USER_NOT_EXISTED(1002, "User not found", HttpStatus.NOT_FOUND),
    UNAUTHENTICATED(1003, "Full authentication is required", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(1004, "You do not have permission", HttpStatus.FORBIDDEN),
    INVALID_PASSWORD(1005, "Password must be at least 6 characters", HttpStatus.BAD_REQUEST),
    LOGIN_FAILED(1006, "Incorrect username or password", HttpStatus.UNAUTHORIZED),
    ACCOUNT_LOCKED(1007, "Account has been locked", HttpStatus.FORBIDDEN),
    TOKEN_EXPIRED(1008, "Token has expired", HttpStatus.UNAUTHORIZED),
    INVALID_TOKEN(1009, "Invalid token", HttpStatus.UNAUTHORIZED),

    // --- 4. Chat Business Logic (2xxx) ---
    ROOM_NOT_FOUND(2001, "Chat room not found", HttpStatus.NOT_FOUND),
    NOT_IN_ROOM(2002, "You must join the room to send messages", HttpStatus.BAD_REQUEST),
    MESSAGE_TOO_LONG(2003, "Message content is too long", HttpStatus.BAD_REQUEST),
    EMPTY_MESSAGE(2004, "Message content cannot be empty", HttpStatus.BAD_REQUEST),
    ACCESS_DENIED_ROOM(2005, "You do not have access to this chat room", HttpStatus.FORBIDDEN),
    USER_ALREADY_IN_ROOM(2006, "User is already a member of this room", HttpStatus.BAD_REQUEST),

    // Bổ sung các mã này:
    DUPLICATE_KEY(9003, "Dữ liệu đã tồn tại trong hệ thống (Duplicate Key)", HttpStatus.CONFLICT),
    NOT_NULL_VIOLATION(9004, "Thông tin bắt buộc không được để trống (Not-null violation)", HttpStatus.BAD_REQUEST),
    FOREIGN_KEY_VIOLATION(9005, "Lỗi ràng buộc liên kết dữ liệu (Foreign key violation)", HttpStatus.BAD_REQUEST),

    // --- 4. Chat Business Logic (2xxx) ---
    // Bạn cũng có thể thêm lỗi cụ thể cho User-Room ở đây để message thân thiện hơn
    ALREADY_IN_ANOTHER_ROOM(2007, "Bạn đang ở trong một phòng khác, vui lòng thoát trước khi thực hiện", HttpStatus.CONFLICT);
    private final int code;
    private final String message;
    private final HttpStatusCode statusCode;

    ErrorCode(int code, String message, HttpStatusCode statusCode) {
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
    }
}