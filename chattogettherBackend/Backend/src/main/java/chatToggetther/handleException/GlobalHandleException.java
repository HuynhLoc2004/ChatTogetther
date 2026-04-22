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
        String message = ex.getRootCause() != null ? ex.getRootCause().getMessage() : ex.getMessage();
        responseErr.setTime(new Date());
        if (message != null && message.contains("user_id")) {
           responseErr.setMessage("Người dùng này đã tham gia một phòng khác rồi. Vui lòng thoát phòng cũ trước khi tạo phòng mới.");
        } else {
            responseErr.setMessage("Vi phạm ràng buộc dữ liệu trong hệ thống.");
        }
        return  ResponseEntity.status(responseErr.getCode()).body(responseErr);
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ResponseErr> handleUncaughtException(Exception e) {
        System.err.println("Dòng lỗi 'Trời ơi đất hỡi': " + e.getMessage());
        e.printStackTrace();

        ResponseErr responseErr = new ResponseErr();
        responseErr.setCode(9999); // Mã lỗi hệ thống chung
        responseErr.setMessage("Hệ thống bận, vui lòng thử lại sau!");
        responseErr.setStatusCode(500);
        responseErr.setTime(new Date());

        return ResponseEntity.status(500).body(responseErr);
    }
}
