package com.sketchydraw.log.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "app_log")
@Getter
@Setter
public class AppLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String logLevel;
    private String logType;

    private Long userId;
    private Long jobId;

    private String toolName;
    private String endpoint;
    private String httpMethod;

    private String ipAddress;

    @Column(length = 1000)
    private String userAgent;

    private String correlationId;
    private String sessionId;

    @Column(length = 2000)
    private String message;

    @Column(length = 4000)
    private String errorMessage;

    private Long fileSizeBytes;
    private Long processingTimeMs;

    private LocalDateTime createdAt;
}