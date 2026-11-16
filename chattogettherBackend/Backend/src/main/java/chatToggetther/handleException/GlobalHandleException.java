package chatToggetther.handleException;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseErr;
import chatToggetther.ENUMS.ErrorCode;
import lombok.Data;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalHandleException {
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ResponseErr> handleAppexception(AppException exception){
        ResponseErr responseErr = new ResponseErr();
        responseErr.setCode(exception.getCode());
        responseErr.setMessage(exception.getMessage());
        responseErr.setTime(new Date());
        responseErr.setStatusCode(exception.getStatusCode());
        return ResponseEntity.status(responseErr.getStatusCode()).body(responseErr);
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ResponseErr> handleValidException(MethodArgumentNotValidException e){
        String message =  e.getMessage();
        int indexStart = message.lastIndexOf("[");
        int indexend = message.lastIndexOf("]");
        message = message.substring(indexStart+1 , indexend-1);
        ResponseErr responseError = new ResponseErr();
        responseError.setStatusCode(ErrorCode.VALIDATION_ERROR.getStatusCode().value());
        responseError.setCode(ErrorCode.VALIDATION_ERROR.getCode());
        responseError.setTime(new Date());
        responseError.setMessage(message);
        return ResponseEntity.status(responseError.getStatusCode()).body(responseError);
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ResponseErr> handleDuplicateKeyException(DataIntegrityViolationException ex) {
        ResponseErr responseErr = new ResponseErr();
        responseErr.setStatusCode(ErrorCode.DATA_INTEGRITY_VIOLATION.getStatusCode().value());
        responseErr.setCode(ErrorCode.DATA_INTEGRITY_VIOLATION.getCode());
        responseErr.setTime(new Date());
        responseErr.setMessage("Dữ liệu đã tồn tại hoặc vi phạm ràng buộc hệ thống.");
        return ResponseEntity.status(responseErr.getStatusCode()).body(responseErr);
    }
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<ResponseErr> handleNoResourceFound(org.springframework.web.servlet.resource.NoResourceFoundException e) {
        ResponseErr responseErr = new ResponseErr();
        responseErr.setCode(404);
        responseErr.setStatusCode(404);
        responseErr.setTime(new Date());
        String path = e.getResourcePath() != null ? e.getResourcePath().toLowerCase() : "";
        if (path.contains("/posts") || path.startsWith("posts")) {
            responseErr.setMessage("Nội dung hoặc bài viết này không tồn tại hoặc đã được gỡ bỏ.");
        } else if (path.contains("/friends") || path.startsWith("friends")) {
            responseErr.setMessage("Yêu cầu bạn bè hoặc tài khoản không tồn tại.");
        } else if (path.contains("/users") || path.startsWith("users") || path.contains("profile")) {
            responseErr.setMessage("Người dùng không tồn tại hoặc đã xóa tài khoản.");
        } else {
            responseErr.setMessage("Tài nguyên yêu cầu không tồn tại.");
        }
        return ResponseEntity.status(404).body(responseErr);
    }

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<ResponseErr> handleAccessDeniedException(org.springframework.security.access.AccessDeniedException e) {
        ResponseErr responseErr = new ResponseErr();
        responseErr.setCode(403);
        responseErr.setMessage("Bạn không có quyền gửi tin nhắn vì đã bị khoá!");
        responseErr.setStatusCode(403);
        responseErr.setTime(new Date());
        return ResponseEntity.status(403).body(responseErr);
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ResponseErr> handleUncaughtException(Exception e) {
        System.err.println(">>> Lỗi hệ thống chưa bắt (Internal Server Error): " + e.getMessage());
        e.printStackTrace();

        ResponseErr responseErr = new ResponseErr();
        responseErr.setCode(9999);
        String detail = e.getClass().getSimpleName() + ": " + e.getMessage();
        if (e.getCause() != null) {
            detail += " -> Cause: " + e.getCause().getClass().getSimpleName() + ": " + e.getCause().getMessage();
        }
        responseErr.setMessage(detail);
        responseErr.setStatusCode(500);
        responseErr.setTime(new Date());

        return ResponseEntity.status(500).body(responseErr);
    }
}
