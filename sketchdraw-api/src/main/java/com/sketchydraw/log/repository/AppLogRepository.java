package com.sketchydraw.log.repository;


import com.sketchydraw.log.entity.AppLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

public interface AppLogRepository extends JpaRepository<AppLog, Long> {

    List<AppLog> findTop100ByOrderByCreatedAtDesc();

    List<AppLog> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<AppLog> findByJobIdOrderByCreatedAtDesc(Long jobId);

    List<AppLog> findByCorrelationIdOrderByCreatedAtDesc(String correlationId);

    @Transactional
    long deleteByCreatedAtBefore(LocalDateTime before);

    List<AppLog> findTop100ByLogLevelOrderByCreatedAtDesc(String logLevel);
}