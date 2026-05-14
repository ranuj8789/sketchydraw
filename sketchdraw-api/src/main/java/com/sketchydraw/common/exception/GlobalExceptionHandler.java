package com.sketchydraw.common.exception;


import com.sketchydraw.common.dto.ErrorResponse;
import com.sketchydraw.log.service.AppLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.LocalDateTime;

@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    private final AppLogService appLogService;

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        logError("BAD_REQUEST", "Illegal argument exception occurred", ex);
        return build(HttpStatus.BAD_REQUEST, "BAD_REQUEST", ex.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUpload(MaxUploadSizeExceededException ex) {
        logError("FILE_TOO_LARGE", "Uploaded file is too large", ex);
        return build(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Uploaded file is too large");
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntime(RuntimeException ex) {
        logError("RUNTIME_ERROR", "Runtime exception occurred", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "RUNTIME_ERROR", safeMessage(ex));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        logError("INTERNAL_SERVER_ERROR", "Unhandled exception occurred", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR", safeMessage(ex));
    }

    private void logError(String logType, String message, Exception ex) {
        try {
            appLogService.error(
                    logType,
                    message,
                    ex.getClass().getSimpleName() + ": " + safeMessage(ex)
            );
        } catch (Exception ignored) {
            // Never allow logging failure to break exception response
        }
    }

    private ResponseEntity<ErrorResponse> build(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(
                new ErrorResponse(
                        false,
                        message == null || message.isBlank() ? "Unexpected error" : message,
                        code,
                        status.value(),
                        LocalDateTime.now()
                )
        );
    }

    private String safeMessage(Exception ex) {
        if (ex == null || ex.getMessage() == null || ex.getMessage().isBlank()) {
            return "Unexpected error";
        }

        return ex.getMessage();
    }
}