package com.sketchydraw.auth.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "app_user")
@Getter
@Setter
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Column(nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 120)
    private String fullName;

    @Column(nullable = false)
    private boolean emailVerified = false;

    @Column(length = 200)
    private String verificationToken;

    @Column(length = 200)
    private String resetToken;

    @Column(length = 40)
    private String provider;

    @Column(length = 150)
    private String providerUserId;

    @Column(length = 1000)
    private String profilePictureUrl;

    private LocalDateTime lastLoginAt;

    private LocalDateTime verificationTokenCreatedAt;
    private LocalDateTime resetTokenCreatedAt;
    private LocalDateTime createdAt;
}