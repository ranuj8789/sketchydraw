package com.sketchydraw.log.scheduler;

import com.sketchydraw.log.repository.AppLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class AppLogCleanupScheduler {

    private final AppLogRepository appLogRepository;

    @Value("${app.logs.retention-days:5}")
    private int retentionDays;

    @Scheduled(cron = "${app.logs.cleanup-cron:0 30 2 * * *}")
    @Transactional
    public void cleanupOldLogs() {
        LocalDateTime before = LocalDateTime.now().minusDays(retentionDays);

        long deleted = appLogRepository.deleteByCreatedAtBefore(before);

        log.info("Old app logs cleanup completed. retentionDays={}, deletedRows={}", retentionDays, deleted);
    }
}