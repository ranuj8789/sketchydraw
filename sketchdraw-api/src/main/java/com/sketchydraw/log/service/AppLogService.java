package com.sketchydraw.log.service;


import com.sketchydraw.common.util.RequestContextUtil;
import com.sketchydraw.log.entity.AppLog;
import com.sketchydraw.log.repository.AppLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AppLogService {

    private final AppLogRepository repository;

    public void info(String logType, String message) {
        save("INFO", logType, null, null, null, message, null, null, null, null);
    }

    public void warn(String logType, String message) {
        save("WARN", logType, null, null, null, message, null, null, null, null);
    }

    public void error(String logType, String message, String errorMessage) {
        save("ERROR", logType, null, null, null, message, errorMessage, null, null, null);
    }

    public void mediaJob(
            String level,
            String logType,
            Long userId,
            Long jobId,
            String toolName,
            String message,
            String errorMessage,
            Long fileSizeBytes,
            Long processingTimeMs,
            BigDecimal creditsUsedMb
    ) {
        save(
                level,
                logType,
                userId,
                jobId,
                toolName,
                message,
                errorMessage,
                fileSizeBytes,
                processingTimeMs,
                creditsUsedMb
        );
    }

    public List<AppLog> latestLogs() {
        return repository.findTop100ByOrderByCreatedAtDesc();
    }

    public List<AppLog> latestErrorLogs() {
        return repository.findTop100ByLogLevelOrderByCreatedAtDesc("ERROR");
    }

    public List<AppLog> logsByUser(Long userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<AppLog> logsByJob(Long jobId) {
        return repository.findByJobIdOrderByCreatedAtDesc(jobId);
    }

    public List<AppLog> logsByCorrelationId(String correlationId) {
        return repository.findByCorrelationIdOrderByCreatedAtDesc(correlationId);
    }

    private void save(
            String level,
            String logType,
            Long userId,
            Long jobId,
            String toolName,
            String message,
            String errorMessage,
            Long fileSizeBytes,
            Long processingTimeMs,
            BigDecimal creditsUsedMb
    ) {
        try {
            AppLog logEntity = new AppLog();

            logEntity.setLogLevel(safeValue(level, "INFO"));
            logEntity.setLogType(safeValue(logType, "GENERAL"));

            logEntity.setUserId(userId);
            logEntity.setJobId(jobId);
            logEntity.setToolName(limit(toolName, 255));

            logEntity.setEndpoint(limit(safeCall(RequestContextUtil::endpoint, "UNKNOWN"), 255));
            logEntity.setHttpMethod(limit(resolveMethod(), 20));

            logEntity.setIpAddress(limit(safeCall(RequestContextUtil::ipAddress, "UNKNOWN"), 100));
            logEntity.setUserAgent(limit(safeCall(RequestContextUtil::userAgent, "UNKNOWN"), 1000));
            logEntity.setSessionId(limit(safeCall(RequestContextUtil::sessionId, "UNKNOWN"), 255));
            logEntity.setCorrelationId(limit(safeCall(RequestContextUtil::correlationId, "UNKNOWN"), 255));

            logEntity.setMessage(limit(message, 2000));
            logEntity.setErrorMessage(limit(errorMessage, 4000));

            logEntity.setFileSizeBytes(fileSizeBytes);
            logEntity.setProcessingTimeMs(processingTimeMs);

            logEntity.setCreatedAt(LocalDateTime.now());

            try {
                repository.save(logEntity);
            } catch (Exception e) {
                log.warn(
                        "Failed to save app log. level={}, logType={}, message={}, error={}",
                        level,
                        logType,
                        limit(message, 200),
                        e.getMessage()
                );
            }

        } catch (Exception e) {
            log.warn(
                    "Failed to build app log. level={}, logType={}, error={}",
                    level,
                    logType,
                    e.getMessage()
            );
        }
    }

    private String resolveMethod() {
        try {
            var attrs = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();

            if (attrs instanceof org.springframework.web.context.request.ServletRequestAttributes servletAttrs) {
                return servletAttrs.getRequest().getMethod();
            }

            return "UNKNOWN";
        } catch (Exception e) {
            return "UNKNOWN";
        }
    }

    private String safeValue(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        return value;
    }

    private String safeCall(SafeStringSupplier supplier, String fallback) {
        try {
            String value = supplier.get();

            if (value == null || value.isBlank()) {
                return fallback;
            }

            return value;
        } catch (Exception e) {
            return fallback;
        }
    }

    private String limit(String value, int max) {
        if (value == null) {
            return null;
        }

        if (value.length() <= max) {
            return value;
        }

        return value.substring(0, max);
    }

    @FunctionalInterface
    private interface SafeStringSupplier {
        String get();
    }
}